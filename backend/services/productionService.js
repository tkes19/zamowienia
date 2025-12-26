/**
 * Serwis produkcji - logika biznesowa modułu produkcyjnego
 */

// Cache aktywnych ścieżek produkcyjnych
let prodPathsCache = { at: 0, byCode: {} };

/**
 * Parsowanie wyrażenia ścieżki produkcyjnej
 */
function parseProductionPathExpression(expr) {
  if (!expr || typeof expr !== 'string') {
    return null;
  }

  const trimmed = expr.trim();
  if (!trimmed) {
    return null;
  }

  // Format: "PATH1+PATH2|PATH3+PATH4" (branches separated by |, paths by +)
  const branchStrings = trimmed.split('|').map(b => b.trim()).filter(Boolean);
  
  if (branchStrings.length === 0) {
    return null;
  }

  const branches = branchStrings.map(branchStr => {
    const pathCodes = branchStr.split('+').map(p => p.trim()).filter(Boolean);
    return { pathCodes };
  });

  return { branches };
}

/**
 * Pobranie aktywnych ścieżek produkcyjnych (z cache)
 */
async function getActiveProductionPathsByCode(supabase) {
  const now = Date.now();
  
  // Cache na 60 sekund
  if (prodPathsCache.at && (now - prodPathsCache.at) < 60000) {
    return prodPathsCache.byCode || {};
  }

  const { data: allPaths } = await supabase
    .from('ProductionPath')
    .select('*')
    .eq('isActive', true);

  const byCode = {};
  (allPaths || []).forEach(p => { 
    byCode[p.code] = p; 
  });
  
  prodPathsCache = { at: now, byCode };
  return byCode;
}

/**
 * Obliczenie oczekiwanej liczby operacji dla zlecenia produkcyjnego
 */
async function computeExpectedOperationsCount(supabase, prodOrderRow) {
  const expr = prodOrderRow?.productionpathexpression;
  if (!expr) return null;

  let parsed = null;
  try {
    parsed = parseProductionPathExpression(expr);
  } catch (e) {
    return null;
  }

  if (!parsed || !Array.isArray(parsed.branches) || parsed.branches.length === 0) {
    return null;
  }

  const branchCode = prodOrderRow?.branchcode || null;
  const branch = branchCode
    ? parsed.branches.find((b, idx) => {
        const code = parsed.branches.length > 1 ? String.fromCharCode(65 + idx) : null;
        return code === branchCode;
      })
    : parsed.branches[0];

  if (!branch || !Array.isArray(branch.pathCodes) || branch.pathCodes.length === 0) {
    return null;
  }

  const pathsByCode = await getActiveProductionPathsByCode(supabase);
  let expected = 0;

  for (const pathCode of branch.pathCodes) {
    const pathDef = pathsByCode[pathCode];
    if (!pathDef) {
      expected += 1;
      continue;
    }
    const ops = pathDef.operations || [];
    expected += (Array.isArray(ops) && ops.length > 0) ? ops.length : 1;
  }

  return expected;
}

/**
 * Obliczenie statusu produkcji dla zamówienia
 */
async function computeProductionStatusForOrder(supabase, orderId) {
  if (!supabase || !orderId) {
    return { status: 'NOT_STARTED', label: 'Nie uruchomione', details: [] };
  }

  const { data: prodOrders, error: prodError } = await supabase
    .from('ProductionOrder')
    .select('id, sourceorderid, status, productionpathexpression, branchcode')
    .eq('sourceorderid', orderId);

  if (prodError || !prodOrders || prodOrders.length === 0) {
    return { status: 'NOT_STARTED', label: 'Nie uruchomione', details: [] };
  }

  const prodOrderIds = prodOrders.map(po => po.id);
  let operationsMap = {};
  
  if (prodOrderIds.length > 0) {
    const { data: operations } = await supabase
      .from('ProductionOperation')
      .select('id, productionorderid, status')
      .in('productionorderid', prodOrderIds);

    (operations || []).forEach(op => {
      if (!operationsMap[op.productionorderid]) {
        operationsMap[op.productionorderid] = [];
      }
      operationsMap[op.productionorderid].push(op);
    });
  }

  let allCompleted = true;
  let anyInProgress = false;
  let details = [];

  for (const po of (prodOrders || [])) {
    const ops = operationsMap[po.id] || [];
    const hasActive = ops.some(op => op.status === 'active');
    const hasPaused = ops.some(op => op.status === 'paused');
    const expectedOpsCount = await computeExpectedOperationsCount(supabase, po);
    const hasAllExpectedOps = expectedOpsCount ? (ops.length >= expectedOpsCount) : (ops.length > 0);
    const allOpsCompleted = hasAllExpectedOps && ops.every(op => op.status === 'completed');

    if (po.status === 'completed' || allOpsCompleted) {
      details.push({ orderId: po.id, status: 'completed' });
    } else if (po.status === 'in_progress' || hasActive || hasPaused) {
      anyInProgress = true;
      allCompleted = false;
      details.push({ orderId: po.id, status: 'in_progress' });
    } else {
      allCompleted = false;
      details.push({ orderId: po.id, status: 'pending' });
    }
  }

  if (allCompleted) {
    return { status: 'COMPLETED', label: 'Produkcja gotowa', details };
  }
  if (anyInProgress) {
    return { status: 'IN_PROGRESS', label: 'W trakcie', details };
  }
  return { status: 'PENDING', label: 'Zaplanowane', details };
}

/**
 * Normalizacja URL podglądu projektu
 */
function normalizeProjectViewUrl(value) {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'string') return value;

  const raw = value.trim();
  if (!raw) return raw;

  if (raw === '/') {
    return null;
  }

  try {
    const parsed = new URL(raw);
    const pathname = parsed.pathname || '';
    const search = parsed.search || '';

    if ((pathname === '' || pathname === '/') && !search) {
      return null;
    }

    if (pathname.startsWith('/api/gallery/')) {
      return `${pathname}${search}`;
    }

    return raw;
  } catch (e) {
    // Nie jest absolutnym URL-em
  }

  if (raw.startsWith('/api/gallery/')) {
    return raw;
  }

  if (raw.startsWith('api/gallery/')) {
    return `/${raw}`;
  }

  return raw;
}

// ============================================
// Funkcje priorytetyzacji zamówień
// ============================================

function computeOrderTimePriority({ deliveryDate, estimatedTimeMinutes = 0, now = new Date() }) {
  // Domyślne wartości dla brakujących danych
  if (!deliveryDate) {
    return {
      timeToDeadlineMinutes: null,
      slackMinutes: null,
      timeStatus: 'UNKNOWN',
      priority: 3
    };
  }

  const deadline = new Date(deliveryDate);
  if (isNaN(deadline.getTime())) {
    return {
      timeToDeadlineMinutes: null,
      slackMinutes: null,
      timeStatus: 'UNKNOWN',
      priority: 3
    };
  }

  const timeToDeadlineMinutes = Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60));
  const slackMinutes = timeToDeadlineMinutes - (estimatedTimeMinutes || 0);

  // Progi konfigurowalne (domyślne wartości)
  const AT_RISK_HOURS = 24;
  const HIGH_PRIORITY_HOURS = 4;
  const LOW_PRIORITY_HOURS = 72;

  let timeStatus;
  let priority;

  // Określ timeStatus
  if (timeToDeadlineMinutes < 0) {
    timeStatus = 'OVERDUE';
  } else if (timeToDeadlineMinutes <= AT_RISK_HOURS * 60 || slackMinutes <= 0) {
    timeStatus = 'AT_RISK';
  } else {
    timeStatus = 'ON_TIME';
  }

  // Określ priority (1-4)
  if (timeStatus === 'OVERDUE') {
    priority = 1; // urgent
  } else if (timeStatus === 'AT_RISK' && (timeToDeadlineMinutes <= HIGH_PRIORITY_HOURS * 60 || slackMinutes <= 60)) {
    priority = 2; // high
  } else if (timeStatus === 'ON_TIME' && timeToDeadlineMinutes > LOW_PRIORITY_HOURS * 60 && slackMinutes > 2 * (estimatedTimeMinutes || 0)) {
    priority = 4; // low
  } else {
    priority = 3; // normal
  }

  return {
    timeToDeadlineMinutes,
    slackMinutes,
    timeStatus,
    priority
  };
}

/**
 * Aktualizacja statusu work order na podstawie statusów operacji
 * Wywołuje emisję zdarzenia SSE po zmianie statusu
 */
async function updateWorkOrderStatusFromOperations(supabase, workOrderId, emitEvent = true) {
  if (!supabase || !workOrderId) {
    return null;
  }

  // Pobierz wszystkie zlecenia produkcyjne dla tego work order
  const { data: prodOrders, error: ordersError } = await supabase
    .from('ProductionOrder')
    .select('id, status, workOrderId')
    .eq('workOrderId', workOrderId);

  if (ordersError || !prodOrders || prodOrders.length === 0) {
    return null;
  }

  const orderIds = prodOrders.map(o => o.id);

  // Pobierz wszystkie operacje dla tych zleceń
  const { data: operations, error: opsError } = await supabase
    .from('ProductionOperation')
    .select('id, status, productionorderid')
    .in('productionorderid', orderIds);

  if (opsError) {
    return null;
  }

  const ops = operations || [];
  
  // Określ nowy status work order na podstawie operacji
  let newStatus = 'planned';
  
  if (ops.length === 0) {
    newStatus = 'planned';
  } else if (ops.every(op => op.status === 'completed')) {
    newStatus = 'completed';
  } else if (ops.some(op => op.status === 'active')) {
    newStatus = 'in_progress';
  } else if (ops.some(op => op.status === 'paused')) {
    newStatus = 'paused';
  } else if (ops.some(op => op.status === 'pending')) {
    newStatus = 'approved';
  }

  // Pobierz obecny work order
  const { data: currentWO, error: woError } = await supabase
    .from('ProductionWorkOrder')
    .select('id, status, roomId')
    .eq('id', workOrderId)
    .single();

  if (woError || !currentWO) {
    return null;
  }

  // Jeśli status się zmienił, zaktualizuj
  if (currentWO.status !== newStatus) {
    const { data: updatedWO, error: updateError } = await supabase
      .from('ProductionWorkOrder')
      .update({ 
        status: newStatus,
        updatedAt: new Date().toISOString()
      })
      .eq('id', workOrderId)
      .select()
      .single();

    if (updateError) {
      console.error('[updateWorkOrderStatusFromOperations] Update error:', updateError);
      return null;
    }

    // Emit SSE event jeśli włączone
    if (emitEvent) {
      try {
        const { emitWorkOrderUpdated } = require('../modules/sse/productionEvents');
        emitWorkOrderUpdated(workOrderId, currentWO.roomId, {
          oldStatus: currentWO.status,
          newStatus,
          operationsCount: ops.length
        });
      } catch (e) {
        console.error('[updateWorkOrderStatusFromOperations] SSE emit error:', e);
      }
    }

    return updatedWO;
  }

  return currentWO;
}

module.exports = {
  parseProductionPathExpression,
  getActiveProductionPathsByCode,
  computeExpectedOperationsCount,
  computeProductionStatusForOrder,
  normalizeProjectViewUrl,
  computeOrderTimePriority,
  updateWorkOrderStatusFromOperations
};
