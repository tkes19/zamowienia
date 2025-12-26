/**
 * Router produkcji - endpointy zarządzania produkcją
 */

const express = require('express');
const { requireRole, parseCookies } = require('../modules/auth');
const { broadcastEvent } = require('../modules/sse');

const router = express.Router();

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Oblicza priorytet czasowy dla zlecenia produkcyjnego
 */
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

// ============================================
// ENDPOINTY PRODUKCJI
// ============================================

/**
 * GET /api/production/orders/active
 * Aktywne zlecenia produkcyjne
 */
router.get('/orders/active', requireRole(['ADMIN', 'PRODUCTION', 'PRODUCTION_MANAGER', 'OPERATOR', 'GRAPHICS', 'WAREHOUSE', 'SALES_DEPT']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    
    if (!supabase) {
        return res.status(500).json({ 
            status: 'error', 
            message: 'Supabase nie jest skonfigurowany' 
        });
    }

    try {
        const { workStationId, workCenterId, limit = 50, workOrdersView = 'open' } = req.query;
        const cookies = req.headers.cookie ? parseCookies(req) : {};
        const userId = cookies.auth_id;

        // Pobierz dane użytkownika, aby sprawdzić przypisany pokój
        let userRoomId = null;
        let allowedWorkCenterIds = null;
        let allowedWorkCenterTypes = null;
        
        if (userId) {
            const { data: user } = await supabase
                .from('User')
                .select('productionroomid')
                .eq('id', userId)
                .single();
            
            if (user && user.productionroomid) {
                userRoomId = user.productionroomid;
                
                // Pobierz centra pracy dla pokoju
                const { data: roomCenters } = await supabase
                    .from('WorkCenter')
                    .select('id, type')
                    .eq('roomId', userRoomId);
                
                if (roomCenters && roomCenters.length > 0) {
                    allowedWorkCenterIds = roomCenters.map(c => c.id);
                    allowedWorkCenterTypes = roomCenters.map(c => c.type).filter(t => t);
                }
            }
        }

        // Określ statusy do pobrania w zależności od widoku
        let statusFilter = ['planned', 'approved', 'in_progress', 'paused'];
        if (workOrdersView === 'completed') {
            statusFilter = ['completed'];
        } else if (workOrdersView === 'all') {
            statusFilter = ['planned', 'approved', 'in_progress', 'paused', 'completed'];
        }

        // Dla widoku 'completed' i 'all' ograniczamy do dzisiaj
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayISO = today.toISOString();

        let query = supabase
            .from('ProductionOrder')
            .select(`
                *,
                product:Product(id, name, code, identifier, imageUrl),
                sourceOrder:Order(id, orderNumber, customerId, deliveryDate, priority, customer:Customer(id, name)),
                sourceOrderItem:OrderItem(
                    id,
                    selectedProjects,
                    projectQuantities,
                    totalQuantity,
                    productionNotes,
                    source,
                    quantity,
                    locationName,
                    projectName,
                    projectViewUrl:projectviewurl
                ),
                workOrder:ProductionWorkOrder!ProductionOrder_workOrderId_fkey(id, workOrderNumber, roomName, status, priority, updatedAt)
            `)
            .in('status', statusFilter)
            .order('priority', { ascending: true })
            .order('createdat', { ascending: true })
            .limit(parseInt(limit, 10));

        // Dla widoku 'completed' filtruj tylko zakończone dzisiaj
        if (workOrdersView === 'completed') {
            query = query.gte('actualenddate', todayISO);
        }

        if (workStationId) {
            query = query.eq('assignedworkstationid', workStationId);
        }
        if (workCenterId) {
            query = query.eq('assignedworkcenterid', workCenterId);
        }

        const { data: orders, error } = await query;

        if (error) {
            console.error('[GET /api/production/orders/active] Error:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Błąd pobierania aktywnych zleceń'
            });
        }

        // Pobierz operacje dla wszystkich zleceń
        const orderIds = (orders || []).map(o => o.id);
        let operationsMap = {};

        if (orderIds.length > 0) {
            const { data: operations } = await supabase
                .from('ProductionOperation')
                .select(`
                    *,
                    workCenter:WorkCenter(id, name, code, type, roomId),
                    workStation:WorkStation(id, name, code, type)
                `)
                .in('productionorderid', orderIds)
                .order('operationnumber', { ascending: true });

            if (operations) {
                operations.forEach(op => {
                    const orderId = op.productionorderid;
                    if (!operationsMap[orderId]) {
                        operationsMap[orderId] = [];
                    }
                    operationsMap[orderId].push(op);
                });
            }
        }

        // Dla użytkowników z przypisanym pokojem - filtruj zlecenia po operacjach w tym pokoju
        let filteredOrders = (orders || []).filter(order => {
            // Jeśli użytkownik nie ma przypisanego pokoju, pokaż wszystkie
            if (!userRoomId || !allowedWorkCenterIds || allowedWorkCenterIds.length === 0) {
                return true;
            }
            
            // Sprawdź czy zlecenie ma operacje w centrach pracy z tego pokoju
            const ops = operationsMap[order.id] || [];
            return ops.some(op => op.workCenter && allowedWorkCenterIds.includes(op.workCenter.id));
        }).map(order => {
            const ops = operationsMap[order.id] || [];
            
            // Auto-fix: jeśli zlecenie ma status in_progress/paused ale brak operacji → zmień na planned
            if ((order.status === 'in_progress' || order.status === 'paused') && ops.length === 0) {
                console.log(`[AUTO-FIX] Zlecenie ${order.ordernumber} (${order.id}): status ${order.status} ale brak operacji → zmiana na planned`);
                supabase
                    .from('ProductionOrder')
                    .update({ status: 'planned', updatedAt: new Date().toISOString() })
                    .eq('id', order.id)
                    .then(() => console.log(`[AUTO-FIX] Zlecenie ${order.ordernumber} naprawione`))
                    .catch(err => console.error(`[AUTO-FIX] Błąd naprawy ${order.ordernumber}:`, err));
                order.status = 'planned';
            }
            
            // Oblicz postęp
            const completedOps = ops.filter(op => op.status === 'completed').length;
            const totalOps = ops.length;
            const activeOp = ops.find(op => op.status === 'active') || ops.find(op => op.status === 'paused');
            
            // Znajdź pierwszą operację pending (następną do wykonania)
            const nextPendingOp = ops.find(op => op.status === 'pending');

            // Oblicz auto-priorytet na podstawie deliveryDate z powiązanego zamówienia
            const deliveryDate = order.sourceOrder?.deliveryDate || order.plannedenddate;
            const estimatedTimeMinutes = order.estimatedtime || 0;
            const timePriority = computeOrderTimePriority({ deliveryDate, estimatedTimeMinutes });

            const sourceOrderItem = order.sourceOrderItem || null;
            const normalizedSourceOrderItem = sourceOrderItem
                ? {
                    ...sourceOrderItem,
                    projectViewUrl: sourceOrderItem.projectviewurl || sourceOrderItem.projectViewUrl
                }
                : sourceOrderItem;

            return {
                ...order,
                sourceOrderItem: normalizedSourceOrderItem,
                operations: ops,
                // Dane czasowe z auto-priorytetu
                deliveryDate: deliveryDate || null,
                timeToDeadlineMinutes: timePriority.timeToDeadlineMinutes,
                slackMinutes: timePriority.slackMinutes,
                timeStatus: timePriority.timeStatus,
                computedPriority: timePriority.priority,
                progress: {
                    completed: completedOps,
                    total: totalOps,
                    percent: totalOps > 0 ? Math.round((completedOps / totalOps) * 100) : 0
                },
                currentOperation: activeOp || null,
                nextOperation: nextPendingOp || null
            };
        });

        // Sortuj: najpierw in_progress, potem approved, potem planned
        // W ramach statusu: najpierw po deliveryDate (rosnąco), potem po computedPriority (1-4)
        const statusOrder = { 'in_progress': 0, 'paused': 0, 'approved': 1, 'planned': 2 };
        filteredOrders.sort((a, b) => {
            const statusDiff = (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
            if (statusDiff !== 0) return statusDiff;
            
            // Sortuj po deliveryDate (rosnąco, null na końcu)
            const aDate = a.deliveryDate ? new Date(a.deliveryDate).getTime() : Infinity;
            const bDate = b.deliveryDate ? new Date(b.deliveryDate).getTime() : Infinity;
            if (aDate !== bDate) return aDate - bDate;
            
            // Potem po computedPriority (1=urgent, 4=low)
            return (a.computedPriority || 3) - (b.computedPriority || 3);
        });

        // Grupuj zlecenia po ProductionWorkOrder (Zbiorcze ZP)
        const workOrdersMap = new Map();
        for (const order of filteredOrders) {
            const woId = order.workOrderId || order.workorderid;
            if (woId) {
                if (!workOrdersMap.has(woId)) {
                    workOrdersMap.set(woId, {
                        id: woId,
                        workOrderNumber: order.workOrder?.workOrderNumber || `ZP-${woId}`,
                        roomName: order.workOrder?.roomName || 'Nieznany pokój',
                        status: order.workOrder?.status || 'planned',
                        priority: order.workOrder?.priority || 3,
                        orders: [],
                        totalQuantity: 0,
                        completedQuantity: 0,
                        productsCount: 0
                    });
                }
                const wo = workOrdersMap.get(woId);
                wo.orders.push(order);
                wo.totalQuantity += order.quantity || 0;
                wo.completedQuantity += order.completedquantity || 0;
                wo.productsCount++;
            }
        }

        // Oblicz podsumowanie kolejki
        const queueOrders = filteredOrders.filter(o => o.status === 'planned' || o.status === 'approved');
        const activeOrders = filteredOrders.filter(o => o.status === 'in_progress');
        const summary = {
            totalOrders: filteredOrders.length,
            queueCount: queueOrders.length,
            activeCount: activeOrders.length,
            totalQuantity: filteredOrders.reduce((sum, o) => sum + (o.quantity || 0), 0),
            queueQuantity: queueOrders.reduce((sum, o) => sum + (o.quantity || 0), 0)
        };

        return res.json({ 
            status: 'success', 
            data: filteredOrders,
            workOrders: Array.from(workOrdersMap.values()),
            summary
        });

    } catch (error) {
        console.error('[GET /api/production/orders/active] Exception:', error);
        res.status(500).json({
            status: 'error',
            message: 'Błąd serwera'
        });
    }
});

/**
 * GET /api/production/orders/:id
 * Szczegóły zlecenia produkcyjnego z operacjami i logami
 */
router.get('/orders/:id', requireRole(['ADMIN', 'PRODUCTION', 'OPERATOR', 'SALES_DEPT']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    
    if (!supabase) {
        return res.status(500).json({ 
            status: 'error', 
            message: 'Supabase nie jest skonfigurowany' 
        });
    }

    try {
        const { id } = req.params;

        const { data: order, error } = await supabase
            .from('ProductionOrder')
            .select(`
                *,
                product:Product(id, name, code, identifier, imageUrl, dimensions),
                sourceOrder:Order(id, orderNumber, customerId, notes, customer:Customer(id, name, city, phone)),
                workCenter:WorkCenter(id, name, code, type),
                workStation:WorkStation(id, name, code, type, manufacturer, model)
            `)
            .eq('id', id)
            .single();

        if (error || !order) {
            return res.status(404).json({ 
                status: 'error', 
                message: 'Zlecenie nie znalezione' 
            });
        }

        // Pobierz operacje
        const { data: operations } = await supabase
            .from('ProductionOperation')
            .select(`
                *,
                operator:User(id, name),
                workStation:WorkStation(id, name, code)
            `)
            .eq('productionorderid', id)
            .order('operationnumber', { ascending: true });

        // Pobierz logi
        const { data: logs } = await supabase
            .from('ProductionLog')
            .select(`
                *,
                user:User(id, name)
            `)
            .eq('productionOrderId', id)
            .order('createdAt', { ascending: false })
            .limit(20);

        return res.json({
            status: 'success',
            data: {
                ...order,
                operations: operations || [],
                logs: logs || []
            }
        });
    } catch (error) {
        console.error('[GET /api/production/orders/:id] Exception:', error);
        return res.status(500).json({ 
            status: 'error', 
            message: 'Błąd serwera' 
        });
    }
});

/**
 * GET /api/production/orders
 * Lista zleceń produkcyjnych
 */
router.get('/orders', requireRole(['ADMIN', 'PRODUCTION', 'SALES_DEPT', 'SALES_REP', 'WAREHOUSE']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    
    if (!supabase) {
        return res.status(500).json({ 
            status: 'error', 
            message: 'Supabase nie jest skonfigurowany' 
        });
    }

    try {
        const { 
            page = 1, 
            limit = 50, 
            status, 
            workOrderId, 
            priority, 
            search,
            sortBy = 'createdAt',
            sortOrder = 'desc' 
        } = req.query;

        const SORTABLE_COLUMNS = {
            createdAt: 'createdat',
            updatedAt: 'updatedat',
            priority: 'priority',
            status: 'status',
            orderNumber: 'ordernumber',
            estimatedTime: 'estimatedtime'
        };
        const sortColumn = SORTABLE_COLUMNS[sortBy] || SORTABLE_COLUMNS.createdAt;

        let query = supabase
            .from('ProductionOrder')
            .select(`
                *,
                product:Product(id, name, code, identifier, imageUrl),
                sourceOrder:Order(id, orderNumber, customerId, deliveryDate, priority, customer:Customer(id, name)),
                sourceOrderItem:OrderItem(
                    id,
                    selectedProjects,
                    projectQuantities,
                    totalQuantity,
                    productionNotes,
                    source,
                    quantity,
                    locationName,
                    projectName,
                    projectViewUrl:projectviewurl
                ),
                workOrder:ProductionWorkOrder!ProductionOrder_workOrderId_fkey(id, workOrderNumber, roomName, status, priority, updatedAt)
            `, { count: 'exact' });

        // Filtry
        if (status) {
            query = query.in('status', Array.isArray(status) ? status : [status]);
        }
        if (workOrderId) {
            query = query.eq('workOrderId', workOrderId);
        }
        if (priority) {
            query = query.eq('priority', parseInt(priority));
        }
        if (search) {
            query = query.or(`ordernumber.ilike.%${search}%,product.name.ilike.%${search}%`);
        }

        // Sortowanie (kolumny w bazie są snake_case)
        query = query.order(sortColumn, { ascending: sortOrder === 'asc' });

        // Paginacja
        const offset = (parseInt(page) - 1) * parseInt(limit);
        query = query.range(offset, offset + parseInt(limit) - 1);

        const { data: orders, error, count } = await query;

        if (error) {
            console.error('[GET /api/production/orders] Error:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Błąd pobierania zleceń'
            });
        }

        res.json({
            status: 'success',
            data: orders || [],
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: count || 0,
                pages: Math.ceil((count || 0) / parseInt(limit))
            }
        });

    } catch (error) {
        console.error('[GET /api/production/orders] Exception:', error);
        res.status(500).json({
            status: 'error',
            message: 'Błąd serwera'
        });
    }
});

/**
 * POST /api/production/orders/from-order/:orderId
 * Tworzenie zleceń produkcyjnych z zamówienia
 */
router.post('/orders/from-order/:orderId', requireRole(['ADMIN', 'PRODUCTION', 'PRODUCTION_MANAGER']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    
    if (!supabase) {
        return res.status(500).json({ 
            status: 'error', 
            message: 'Supabase nie jest skonfigurowany' 
        });
    }

    try {
        const { orderId } = req.params;
        const { items, workOrderId } = req.body || {};

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Brak pozycji do utworzenia'
            });
        }

        // Pobierz zamówienie
        const { data: order, error: orderError } = await supabase
            .from('Order')
            .select('id, orderNumber, customerId')
            .eq('id', orderId)
            .single();

        if (orderError || !order) {
            return res.status(404).json({
                status: 'error',
                message: 'Zamówienie nie znalezione'
            });
        }

        const createdOrders = [];
        const now = new Date().toISOString();

        for (const item of items) {
            const { data: newOrder, error: createError } = await supabase
                .from('ProductionOrder')
                .insert({
                    sourceOrderId: orderId,
                    sourceOrderItemId: item.id,
                    productId: item.productId,
                    quantity: item.quantity || 1,
                    status: 'planned',
                    priority: item.priority || 3,
                    workOrderId: workOrderId || null,
                    estimatedTime: item.estimatedTime || 0,
                    createdAt: now,
                    updatedAt: now
                })
                .select()
                .single();

            if (!createError && newOrder) {
                createdOrders.push(newOrder);
            }
        }

        res.json({
            status: 'success',
            message: `Utworzono ${createdOrders.length} zleceń produkcyjnych`,
            data: createdOrders
        });

    } catch (error) {
        console.error('[POST /api/production/orders/from-order/:orderId] Exception:', error);
        res.status(500).json({
            status: 'error',
            message: 'Błąd serwera'
        });
    }
});

/**
 * POST /api/production/orders/fix-orphaned
 * Naprawia zlecenia bez operacji (zmienia status na planned)
 */
router.post('/orders/fix-orphaned', requireRole(['ADMIN', 'PRODUCTION_MANAGER']), async (req, res) => {
    const supabase = req.app.locals.supabase;

    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        const { data: orders } = await supabase
            .from('ProductionOrder')
            .select('id, ordernumber, status')
            .in('status', ['in_progress', 'paused', 'approved']);

        const orphaned = [];
        for (const order of orders || []) {
            const { data: operations } = await supabase
                .from('ProductionOperation')
                .select('id')
                .eq('productionorderid', order.id)
                .limit(1);

            if (!operations || operations.length === 0) {
                orphaned.push(order);
            }
        }

        if (orphaned.length === 0) {
            return res.json({ status: 'success', message: 'Brak zleceń bez operacji', fixed: 0 });
        }

        const orphanedIds = orphaned.map(o => o.id);
        const { error: updateError } = await supabase
            .from('ProductionOrder')
            .update({ status: 'planned', updatedAt: new Date().toISOString() })
            .in('id', orphanedIds);

        if (updateError) {
            console.error('[POST /api/production/orders/fix-orphaned] Błąd:', updateError);
            return res.status(500).json({ status: 'error', message: 'Błąd aktualizacji' });
        }

        console.log(`[POST /api/production/orders/fix-orphaned] Naprawiono ${orphaned.length} zleceń:`, orphaned.map(o => o.ordernumber));
        return res.json({ 
            status: 'success', 
            message: `Naprawiono ${orphaned.length} zleceń bez operacji`, 
            fixed: orphaned.length,
            orders: orphaned.map(o => ({ id: o.id, orderNumber: o.ordernumber, oldStatus: o.status, newStatus: 'planned' }))
        });
    } catch (error) {
        console.error('[POST /api/production/orders/fix-orphaned] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

module.exports = router;
