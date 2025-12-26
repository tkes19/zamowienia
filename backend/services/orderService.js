/**
 * Serwis zamówień - logika biznesowa modułu zamówień
 */

/**
 * Normalizacja tekstu (polskie znaki → ASCII)
 */
function normalizeText(text) {
  if (!text) return '';
  
  const map = {
    'Ą': 'A', 'ą': 'a',
    'Ć': 'C', 'ć': 'c',
    'Ę': 'E', 'ę': 'e',
    'Ł': 'L', 'ł': 'l',
    'Ń': 'N', 'ń': 'n',
    'Ó': 'O', 'ó': 'o',
    'Ś': 'S', 'ś': 's',
    'Ź': 'Z', 'ź': 'z',
    'Ż': 'Z', 'ż': 'z'
  };
  
  let result = text;
  for (const [polish, ascii] of Object.entries(map)) {
    result = result.replace(new RegExp(polish, 'g'), ascii);
  }
  
  return result.toUpperCase();
}

/**
 * Generowanie krótkiego kodu użytkownika
 */
async function generateShortCode(supabase, userId, userName) {
  if (!userName || typeof userName !== 'string') {
    throw new Error('Brak nazwy użytkownika');
  }

  // Parsowanie imienia i nazwiska
  const parts = userName.trim().split(/\s+/);
  if (parts.length < 2) {
    throw new Error('Nazwa użytkownika musi zawierać imię i nazwisko');
  }

  const firstName = normalizeText(parts[0]);
  const lastName = normalizeText(parts[parts.length - 1]);

  if (!firstName || !lastName) {
    throw new Error('Nieprawidłowa nazwa użytkownika');
  }

  // Bazowy kod: pierwsza litera imienia + dwie pierwsze litery nazwiska
  let baseCode = firstName[0] + lastName.substring(0, 2);
  let shortCode = baseCode;
  let suffix = 1;

  // Sprawdź kolizje
  while (true) {
    const { data: existing } = await supabase
      .from('User')
      .select('id')
      .eq('shortCode', shortCode)
      .neq('id', userId)
      .single();

    if (!existing) {
      break; // Kod jest unikalny
    }

    // Kolizja - dodaj cyfrę
    shortCode = firstName[0] + lastName[0] + suffix;
    suffix++;

    if (suffix > 99) {
      throw new Error('Nie można wygenerować unikalnego kodu');
    }
  }

  return shortCode;
}

/**
 * Generowanie numeru zamówienia
 */
function computeNextOrderNumber({ year, shortCode, existingOrderNumbers }) {
  const numbers = Array.isArray(existingOrderNumbers) ? existingOrderNumbers : [];
  let maxSequence = 0;

  for (const raw of numbers) {
    if (!raw || typeof raw !== 'string') continue;
    const match = raw.match(new RegExp(`^${year}\\/(\\d+)(?:\\/|$)`));
    if (!match) continue;
    const seq = parseInt(match[1], 10);
    if (Number.isFinite(seq) && seq > maxSequence) {
      maxSequence = seq;
    }
  }

  const nextSequence = maxSequence + 1;
  return `${year}/${nextSequence}/${shortCode}`;
}

async function generateOrderNumber(supabase, userId) {
  // Pobierz shortCode użytkownika
  const { data: user, error: userError } = await supabase
    .from('User')
    .select('shortCode, name')
    .eq('id', userId)
    .single();

  if (userError || !user) {
    throw new Error('Nie znaleziono użytkownika');
  }

  let shortCode = user.shortCode;

  // Jeśli brak shortCode, wygeneruj
  if (!shortCode) {
    shortCode = await generateShortCode(supabase, userId, user.name);
    
    // Zapisz w bazie
    await supabase
      .from('User')
      .update({ shortCode })
      .eq('id', userId);
  }

  // Pobierz rok
  const year = new Date().getFullYear();

  const { data: yearOrders, error: fetchError } = await supabase
    .from('Order')
    .select('orderNumber')
    .ilike('orderNumber', `${year}/%`);

  if (fetchError) {
    throw new Error('Błąd pobierania zamówień');
  }

  const existingOrderNumbers = (yearOrders || []).map(row => row.orderNumber || row.ordernumber);
  return computeNextOrderNumber({ year, shortCode, existingOrderNumbers });
}

/**
 * Walidacja pozycji zamówienia
 */
function validateOrderItem(item) {
  const errors = [];

  if (!item.productId) {
    errors.push('Brak productId');
  }

  if (!item.quantity || item.quantity <= 0) {
    errors.push('Nieprawidłowa ilość');
  }

  if (item.unitPrice === undefined || item.unitPrice < 0) {
    errors.push('Nieprawidłowa cena jednostkowa');
  }

  return errors;
}

/**
 * Walidacja danych zamówienia
 */
function validateOrderData(orderData) {
  const errors = [];

  if (!orderData.customerId) {
    errors.push('Brak customerId');
  }

  if (!orderData.items || !Array.isArray(orderData.items)) {
    errors.push('Brak pozycji zamówienia');
  } else if (orderData.items.length === 0) {
    errors.push('Zamówienie musi zawierać przynajmniej jedną pozycję');
  } else {
    orderData.items.forEach((item, index) => {
      const itemErrors = validateOrderItem(item);
      if (itemErrors.length > 0) {
        errors.push(`Pozycja ${index + 1}: ${itemErrors.join(', ')}`);
      }
    });
  }

  return errors;
}

/**
 * Obliczenie sumy zamówienia
 */
function calculateOrderTotal(items) {
  return items.reduce((sum, item) => {
    return sum + (item.quantity * item.unitPrice);
  }, 0);
}

/**
 * Sprawdzenie czy użytkownik może edytować zamówienie
 */
function canEditOrder(order, userId, userRole) {
  // Admin i SALES_DEPT mogą edytować wszystko
  if (['ADMIN', 'SALES_DEPT'].includes(userRole)) {
    return true;
  }

  // SALES_REP może edytować tylko swoje zamówienia
  if (userRole === 'SALES_REP' && order.userId === userId) {
    return true;
  }

  return false;
}

/**
 * Sprawdzenie czy użytkownik może zobaczyć zamówienie
 */
function canViewOrder(order, userId, userRole) {
  // Admin, SALES_DEPT, WAREHOUSE, PRODUCTION mogą widzieć wszystko
  if (['ADMIN', 'SALES_DEPT', 'WAREHOUSE', 'PRODUCTION', 'PRODUCTION_MANAGER'].includes(userRole)) {
    return true;
  }

  // SALES_REP może widzieć tylko swoje
  if (userRole === 'SALES_REP' && order.userId === userId) {
    return true;
  }

  return false;
}

/**
 * Walidacja przejścia statusu zamówienia
 */
function validateStatusTransition(currentStatus, newStatus) {
  const allowedTransitions = {
    'PENDING': ['APPROVED', 'CANCELLED'],
    'APPROVED': ['IN_PRODUCTION', 'CANCELLED'],
    'IN_PRODUCTION': ['READY', 'CANCELLED'],
    'READY': ['SHIPPED', 'CANCELLED'],
    'SHIPPED': ['DELIVERED'],
    'DELIVERED': [],
    'CANCELLED': []
  };

  const allowed = allowedTransitions[currentStatus] || [];
  return allowed.includes(newStatus);
}

module.exports = {
  normalizeText,
  generateShortCode,
  computeNextOrderNumber,
  generateOrderNumber,
  validateOrderItem,
  validateOrderData,
  calculateOrderTotal,
  canEditOrder,
  canViewOrder,
  validateStatusTransition
};
