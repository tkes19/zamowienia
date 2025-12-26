/**
 * Router zamówień - endpointy zarządzania zamówieniami
 */

const express = require('express');
const { requireRole } = require('../modules/auth');
const { computeProductionStatusForOrder, normalizeProjectViewUrl } = require('../services/productionService');
const orderService = require('../services/orderService');
const { broadcastEvent } = require('../modules/sse');

const router = express.Router();

// ============================================
// ENDPOINTY ZAMÓWIEŃ
// ============================================

/**
 * GET /api/orders
 * Lista zamówień
 */
router.get('/', requireRole(['ADMIN', 'SALES_REP', 'SALES_DEPT', 'WAREHOUSE', 'PRODUCTION']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { status, userId: filterUserId, customerId, dateFrom, dateTo, belowStockOnly } = req.query;
    const { userId, role } = req.user || {};

    if (!supabase) {
        return res.status(500).json({
            status: 'error',
            message: 'Supabase nie jest skonfigurowany'
        });
    }

    try {
        let query = supabase
            .from('Order')
            .select(`
                id,
                orderNumber,
                customerId,
                userId,
                status,
                total,
                deliveryDate,
                priority,
                notes,
                createdAt,
                updatedAt,
                Customer:customerId(id, name),
                User:userId(name, shortCode),
                OrderItem (
                    id,
                    productId,
                    quantity,
                    unitPrice,
                    selectedProjects,
                    projectQuantities,
                    quantitySource,
                    totalQuantity,
                    source,
                    locationName,
                    projectName,
                    customization,
                    productionNotes,
                    projectviewurl,
                    stockAtOrder,
                    belowStock,
                    Product:productId(id, name, identifier, index)
                )
            `)
            .order('createdAt', { ascending: false });

        if (role === 'SALES_REP') {
            query = query.eq('userId', userId);
        }

        if (status) {
            query = query.eq('status', status);
        }

        if (filterUserId) {
            query = query.eq('userId', filterUserId);
        }

        if (customerId) {
            query = query.eq('customerId', customerId);
        }

        if (dateFrom) {
            query = query.gte('createdAt', dateFrom);
        }

        if (dateTo) {
            query = query.lte('createdAt', dateTo);
        }

        const { data: orders, error } = await query;

        if (error) {
            console.error('Błąd Supabase w GET /api/orders:', error);
            return res.status(500).json({ status: 'error', message: 'Błąd pobierania zamówień' });
        }

        let enrichedOrders = orders || [];

        if (enrichedOrders.length > 0) {
            const orderIds = enrichedOrders.map(o => o.id).filter(Boolean);

            const { data: belowStockItems, error: belowStockError } = await supabase
                .from('OrderItem')
                .select('orderId')
                .in('orderId', orderIds)
                .eq('belowStock', true);

            if (belowStockError) {
                console.error('Błąd Supabase w GET /api/orders (belowStock):', belowStockError);
            }

            const belowStockSet = new Set((belowStockItems || []).map(row => row.orderId));

            const { data: prodOrders, error: prodError } = await supabase
                .from('ProductionOrder')
                .select('id, sourceorderid, status')
                .in('sourceorderid', orderIds);

            if (prodError) {
                console.error('Błąd Supabase w GET /api/orders (ProductionOrder):', prodError);
            }

            const prodOrderIds = (prodOrders || []).map(po => po.id);
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

            const productionStatusMap = {};
            orderIds.forEach(orderId => {
                const orderProdOrders = (prodOrders || []).filter(po => po.sourceorderid === orderId);

                if (orderProdOrders.length === 0) {
                    productionStatusMap[orderId] = { status: 'NOT_STARTED', label: 'Nie uruchomione', details: [] };
                    return;
                }

                let allCompleted = true;
                let anyInProgress = false;
                let details = [];

                orderProdOrders.forEach(po => {
                    const ops = operationsMap[po.id] || [];
                    const hasActive = ops.some(op => op.status === 'active');
                    const hasPaused = ops.some(op => op.status === 'paused');
                    const allOpsCompleted = ops.length > 0 && ops.every(op => op.status === 'completed');

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
                });

                if (allCompleted) {
                    productionStatusMap[orderId] = { status: 'COMPLETED', label: 'Produkcja gotowa', details };
                } else if (anyInProgress) {
                    productionStatusMap[orderId] = { status: 'IN_PROGRESS', label: 'W trakcie', details };
                } else {
                    productionStatusMap[orderId] = { status: 'PENDING', label: 'Zaplanowane', details };
                }
            });

            enrichedOrders = enrichedOrders.map(o => ({
                ...o,
                hasBelowStock: belowStockSet.has(o.id),
                productionStatus: productionStatusMap[o.id] || { status: 'NOT_STARTED', label: 'Nie uruchomione', details: [] }
            }));

            if (belowStockOnly && ['true', '1', 'on'].includes(String(belowStockOnly).toLowerCase())) {
                enrichedOrders = enrichedOrders.filter(o => o.hasBelowStock);
            }
        }

        const normalizedOrders = (enrichedOrders || []).map(order => {
            if (!order || !Array.isArray(order.OrderItem)) return order;
            const normalizedItems = order.OrderItem.map(item => ({
                ...item,
                projectviewurl: normalizeProjectViewUrl(item.projectviewurl)
            }));
            return {
                ...order,
                OrderItem: normalizedItems
            };
        });

        return res.json({
            status: 'success',
            data: normalizedOrders
        });
    } catch (error) {
        console.error('Błąd w GET /api/orders:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

/**
 * GET /api/orders/my
 * Zamówienia bieżącego użytkownika
 */
router.get('/my', requireRole(['ADMIN', 'SALES_REP', 'SALES_DEPT', 'WAREHOUSE', 'PRODUCTION']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { userId } = req.user || {};

    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        const { status, customerId, dateFrom, dateTo } = req.query;

        let query = supabase
            .from('Order')
            .select(`
                id,
                orderNumber,
                customerId,
                userId,
                status,
                total,
                notes,
                createdAt,
                updatedAt,
                Customer:customerId(id, name),
                User:userId(id, name, shortCode)
            `)
            .eq('userId', userId)
            .order('createdAt', { ascending: false });

        if (status) {
            query = query.eq('status', status);
        }

        if (customerId) {
            query = query.eq('customerId', customerId);
        }

        if (dateFrom) {
            query = query.gte('createdAt', new Date(dateFrom).toISOString());
        }

        if (dateTo) {
            const endOfDay = new Date(dateTo);
            endOfDay.setHours(23, 59, 59, 999);
            query = query.lte('createdAt', endOfDay.toISOString());
        }

        const { data: orders, error } = await query;

        if (error) {
            console.error('Błąd pobierania zamówień:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się pobrać zamówień' });
        }

        return res.json({
            status: 'success',
            data: orders || []
        });
    } catch (error) {
        console.error('Błąd w GET /api/orders/my:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

/**
 * GET /api/orders/:id
 * Szczegóły zamówienia
 */
router.get('/:id', requireRole(['ADMIN', 'SALES_REP', 'SALES_DEPT', 'WAREHOUSE', 'PRODUCTION']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { id } = req.params;
    const { userId, role } = req.user || {};

    if (!supabase) {
        return res.status(500).json({
            status: 'error',
            message: 'Supabase nie jest skonfigurowany'
        });
    }

    try {
        const { data: order, error: orderError } = await supabase
            .from('Order')
            .select(`
                id,
                orderNumber,
                customerId,
                userId,
                status,
                total,
                deliveryDate,
                priority,
                notes,
                createdAt,
                updatedAt,
                Customer:customerId(id, name, email, phone),
                User:userId(id, name, shortCode)
            `)
            .eq('id', id)
            .single();

        if (orderError || !order) {
            return res.status(404).json({ status: 'error', message: 'Zamówienie nie znalezione' });
        }

        const canSeeAllOrders = ['ADMIN', 'SALES_DEPT', 'WAREHOUSE', 'PRODUCTION'].includes(role);
        if (!canSeeAllOrders && order.userId !== userId) {
            return res.status(403).json({ status: 'error', message: 'Brak dostępu do tego zamówienia' });
        }

        const { data: items, error: itemsError } = await supabase
            .from('OrderItem')
            .select(`
                id,
                orderId,
                productId,
                quantity,
                unitPrice,
                selectedProjects,
                projectQuantities,
                quantitySource,
                totalQuantity,
                source,
                locationName,
                projectName,
                customization,
                productionNotes,
                projectviewurl,
                stockAtOrder,
                belowStock,
                Product:productId(id, name, identifier, index)
            `)
            .eq('orderId', id);

        if (itemsError) {
            console.error('Błąd pobierania pozycji:', itemsError);
            return res.status(500).json({ status: 'error', message: 'Nie udało się pobrać pozycji zamówienia' });
        }

        const normalizedItems = (items || []).map(item => ({
            ...item,
            projectviewurl: normalizeProjectViewUrl(item.projectviewurl)
        }));

        return res.json({
            status: 'success',
            data: {
                ...order,
                items: normalizedItems
            }
        });
    } catch (error) {
        console.error('Błąd w GET /api/orders/:id:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

/**
 * POST /api/orders
 * Tworzenie zamówienia
 */
router.post('/', requireRole(['ADMIN', 'SALES_REP', 'SALES_DEPT']), async (req, res) => {
    const supabase = req.app.locals.supabase;

    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const userId = req.user?.id;
    const { customerId, deliveryDate, notes, items } = req.body || {};

    if (!userId) {
        return res.status(401).json({ status: 'error', message: 'Brak autoryzacji' });
    }

    if (!customerId) {
        return res.status(400).json({ status: 'error', message: 'customerId jest wymagane' });
    }

    if (!deliveryDate) {
        return res.status(400).json({ status: 'error', message: 'deliveryDate jest wymagane (data "Na kiedy potrzebne")' });
    }

    const deliveryDateParsed = new Date(deliveryDate);
    if (Number.isNaN(deliveryDateParsed.getTime())) {
        return res.status(400).json({ status: 'error', message: 'deliveryDate ma nieprawidłowy format (oczekiwany: YYYY-MM-DD)' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deliveryDay = new Date(deliveryDateParsed);
    deliveryDay.setHours(0, 0, 0, 0);

    if (deliveryDay < today) {
        return res.status(400).json({ status: 'error', message: 'deliveryDate nie może być datą z przeszłości' });
    }

    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ status: 'error', message: 'items musi być niepustą tablicą' });
    }

    for (const item of items) {
        if (!item.productCode) {
            return res.status(400).json({ status: 'error', message: 'productCode jest wymagane dla każdej pozycji' });
        }
        if (!item.quantity || item.quantity <= 0) {
            return res.status(400).json({ status: 'error', message: 'quantity musi być > 0' });
        }
        if (item.unitPrice === undefined || item.unitPrice < 0) {
            return res.status(400).json({ status: 'error', message: 'unitPrice jest wymagane i musi być >= 0' });
        }
    }

    try {
        const { data: customer, error: customerError } = await supabase
            .from('Customer')
            .select('id')
            .eq('id', customerId)
            .single();

        if (customerError || !customer) {
            return res.status(404).json({ status: 'error', message: 'Klient nie znaleziony' });
        }

        const total = items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unitPrice)), 0);

        let order = null;
        let orderError = null;
        let orderNumber = null;

        for (let attempt = 0; attempt < 7; attempt++) {
            orderNumber = await orderService.generateOrderNumber(supabase, userId);

            const insertResult = await supabase
                .from('Order')
                .insert({
                    customerId,
                    userId,
                    orderNumber,
                    status: 'PENDING',
                    total: parseFloat(Number(total).toFixed(2)),
                    deliveryDate: deliveryDateParsed.toISOString(),
                    priority: 3,
                    notes: notes || null,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                })
                .select('id')
                .single();

            order = insertResult.data;
            orderError = insertResult.error;

            if (!orderError && order) {
                break;
            }

            const isUniqueViolation =
                orderError &&
                (orderError.code === '23505' ||
                    (typeof orderError.message === 'string' && orderError.message.toLowerCase().includes('duplicate')));

            if (!isUniqueViolation) {
                break;
            }
        }

        if (orderError || !order) {
            console.error('Błąd tworzenia Order:', orderError);
            return res.status(500).json({ status: 'error', message: 'Nie udało się utworzyć zamówienia', details: orderError?.message });
        }

        const orderId = order.id;

        const uniqueCodes = Array.from(new Set(items.map(i => i.productCode).filter(Boolean)));
        const { data: products, error: productsError } = await supabase
            .from('Product')
            .select('id, index')
            .in('index', uniqueCodes);

        if (productsError) {
            console.error('Błąd pobierania produktów dla zamówienia:', productsError);
            return res.status(500).json({ status: 'error', message: 'Nie udało się pobrać produktów dla zamówienia', details: productsError.message });
        }

        const productIdByCode = new Map();
        (products || []).forEach(p => {
            if (p.index) {
                productIdByCode.set(p.index, p.id);
            }
        });

        for (const item of items) {
            if (!item.productCode || !productIdByCode.get(item.productCode)) {
                return res.status(400).json({ status: 'error', message: `Nie znaleziono produktu o kodzie ${item.productCode}` });
            }
        }

        const orderItems = items.map(item => ({
            orderId,
            productId: productIdByCode.get(item.productCode),
            quantity: item.quantity,
            unitPrice: parseFloat(item.unitPrice),
            selectedProjects: item.selectedProjects || null,
            projectQuantities: item.projectQuantities || null,
            quantitySource: item.quantitySource || 'total',
            totalQuantity: item.totalQuantity || item.quantity,
            source: item.source || 'MIEJSCOWOSCI',
            locationName: item.locationName || null,
            projectName: item.projectName || null,
            customization: item.customization || null,
            productionNotes: item.productionNotes || null,
            projectviewurl: item.projectviewurl || null,
            stockAtOrder: Number.isFinite(Number(item.stockAtOrder)) ? Number(item.stockAtOrder) : null,
            belowStock: item.belowStock === true
        }));

        const { data: insertedItems, error: itemsError } = await supabase
            .from('OrderItem')
            .insert(orderItems)
            .select();

        if (itemsError) {
            console.error('Błąd tworzenia OrderItems:', itemsError);
            await supabase.from('Order').delete().eq('id', orderId);
            return res.status(500).json({ status: 'error', message: 'Nie udało się dodać pozycji do zamówienia', details: itemsError.message });
        }

        // Automatyczne tworzenie zadań grafiki dla pozycji wymagających projektu
        let createdGraphicTasks = 0;
        if (insertedItems && insertedItems.length > 0) {
            const tasksToInsert = insertedItems
                .filter(oi =>
                    (oi.source === 'MIEJSCOWOSCI' || oi.source === 'KLIENCI_INDYWIDUALNI') &&
                    (!oi.selectedProjects || String(oi.selectedProjects).trim() === '')
                )
                .map(oi => ({
                    orderId: oi.orderId,
                    orderItemId: oi.id,
                    status: 'todo',
                    approvalRequired: false,
                    approvalStatus: 'not_required',
                    createdBy: userId,
                    galleryContext: {
                        source: oi.source,
                        locationName: oi.locationName,
                        projectName: oi.projectName
                    }
                }));

            if (tasksToInsert.length > 0) {
                const { error: tasksError } = await supabase
                    .from('GraphicTask')
                    .insert(tasksToInsert);

                if (tasksError) {
                    console.error('Błąd tworzenia zadań graficznych dla zamówienia:', tasksError);
                } else {
                    createdGraphicTasks = tasksToInsert.length;

                    const { error: orderUpdateError } = await supabase
                        .from('Order')
                        .update({
                            ordertype: 'PRODUCTS_AND_PROJECTS',
                            projectsReady: false
                        })
                        .eq('id', orderId);

                    if (orderUpdateError) {
                        console.error('Błąd aktualizacji Order.orderType po utworzeniu zadań graficznych:', orderUpdateError);
                    }
                }
            }
        }

        // Broadcast SSE event
        broadcastEvent({
            type: 'orderCreated',
            orderId,
            orderNumber,
            customerId,
            total,
            itemCount: items.length,
            status: 'PENDING',
            userId
        });

        return res.status(201).json({
            status: 'success',
            message: 'Zamówienie zostało utworzone',
            data: {
                orderId,
                orderNumber,
                total,
                itemCount: items.length,
                createdGraphicTasks
            }
        });
    } catch (error) {
        console.error('Wyjątek w POST /api/orders:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd podczas tworzenia zamówienia', details: error.message });
    }
});

/**
 * GET /api/orders/:id/production-status
 * Status produkcji dla zamówienia
 */
router.get('/:id/production-status', requireRole(['ADMIN', 'SALES_REP', 'SALES_DEPT', 'WAREHOUSE', 'PRODUCTION']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { id: orderId } = req.params;
    
    if (!supabase) {
        return res.status(500).json({ 
            status: 'error', 
            message: 'Supabase nie jest skonfigurowany' 
        });
    }

    try {
        const productionStatus = await computeProductionStatusForOrder(supabase, orderId);
        
        res.json({
            status: 'success',
            data: productionStatus
        });

    } catch (error) {
        console.error(`[GET /api/orders/${orderId}/production-status] Error:`, error);
        res.status(500).json({
            status: 'error',
            message: 'Błąd pobierania statusu produkcji'
        });
    }
});

/**
 * PATCH /api/orders/:id/status
 * Zmiana statusu zamówienia
 */
router.patch('/:id/status', requireRole(['ADMIN', 'SALES_DEPT', 'WAREHOUSE', 'PRODUCTION']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { id: orderId } = req.params;
    const { status: newStatus, notes } = req.body || {};
    
    if (!supabase) {
        return res.status(500).json({ 
            status: 'error', 
            message: 'Supabase nie jest skonfigurowany' 
        });
    }

    if (!newStatus) {
        return res.status(400).json({
            status: 'error',
            message: 'Nowy status jest wymagany'
        });
    }

    try {
        // Pobierz aktualne zamówienie
        const { data: currentOrder, error: fetchError } = await supabase
            .from('Order')
            .select('id, status, orderNumber')
            .eq('id', orderId)
            .single();

        if (fetchError || !currentOrder) {
            return res.status(404).json({
                status: 'error',
                message: 'Zamówienie nie zostało znalezione'
            });
        }

        // Walidacja przejścia statusu
        if (!orderService.validateStatusTransition(currentOrder.status, newStatus)) {
            return res.status(400).json({
                status: 'error',
                message: `Nieprawidłowe przejście statusu z ${currentOrder.status} na ${newStatus}`
            });
        }

        // Aktualizuj status
        const { data: updatedOrder, error: updateError } = await supabase
            .from('Order')
            .update({ 
                status: newStatus,
                updatedAt: new Date().toISOString()
            })
            .eq('id', orderId)
            .select('id, status, orderNumber')
            .single();

        if (updateError) {
            console.error(`[PATCH /api/orders/${orderId}/status] Update error:`, updateError);
            return res.status(500).json({
                status: 'error',
                message: 'Błąd aktualizacji statusu'
            });
        }

        // Zapisz w historii
        const { error: historyError } = await supabase
            .from('OrderStatusHistory')
            .insert({
                orderId,
                oldStatus: currentOrder.status,
                newStatus,
                notes: notes || null,
                changedAt: new Date().toISOString()
            });

        if (historyError) {
            console.error(`[PATCH /api/orders/${orderId}/status] History error:`, historyError);
        }

        // Broadcast zdarzenia
        broadcastEvent({
            type: 'orderStatusChanged',
            orderId,
            orderNumber: currentOrder.orderNumber,
            oldStatus: currentOrder.status,
            newStatus,
            timestamp: new Date().toISOString()
        });

        res.json({
            status: 'success',
            message: 'Status zamówienia został zaktualizowany',
            data: updatedOrder
        });

    } catch (error) {
        console.error(`[PATCH /api/orders/${orderId}/status] Exception:`, error);
        res.status(500).json({
            status: 'error',
            message: 'Błąd serwera'
        });
    }
});

/**
 * GET /api/orders/:id/history
 * Historia zmian statusu zamówienia
 */
router.get('/:id/history', requireRole(['ADMIN', 'SALES_DEPT', 'SALES_REP', 'WAREHOUSE', 'PRODUCTION']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { id: orderId } = req.params;
    
    if (!supabase) {
        return res.status(500).json({ 
            status: 'error', 
            message: 'Supabase nie jest skonfigurowany' 
        });
    }

    try {
        const { data: history, error } = await supabase
            .from('OrderStatusHistory')
            .select('*')
            .eq('orderId', orderId)
            .order('changedAt', { ascending: false });

        if (error) {
            console.error(`[GET /api/orders/${orderId}/history] Error:`, error);
            return res.status(500).json({
                status: 'error',
                message: 'Błąd pobierania historii'
            });
        }

        res.json({
            status: 'success',
            data: history || []
        });

    } catch (error) {
        console.error(`[GET /api/orders/${orderId}/history] Exception:`, error);
        res.status(500).json({
            status: 'error',
            message: 'Błąd serwera'
        });
    }
});

/**
 * PATCH /api/orders/:id
 * Edycja notatek zamówienia
 */
router.patch('/:id', requireRole(['ADMIN', 'SALES_DEPT', 'SALES_REP']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { id: orderId } = req.params;
    const { notes } = req.body || {};
    
    if (!supabase) {
        return res.status(500).json({ 
            status: 'error', 
            message: 'Supabase nie jest skonfigurowany' 
        });
    }

    try {
        // Sprawdź czy zamówienie istnieje
        const { data: existingOrder, error: fetchError } = await supabase
            .from('Order')
            .select('id, userId')
            .eq('id', orderId)
            .single();

        if (fetchError || !existingOrder) {
            return res.status(404).json({
                status: 'error',
                message: 'Zamówienie nie zostało znalezione'
            });
        }

        // Sprawdź uprawnienia (SALES_REP może edytować tylko swoje)
        const { userId: currentUserId, role } = req.user || {};
        if (!orderService.canEditOrder(existingOrder, currentUserId, role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Brak uprawnień do edycji tego zamówienia'
            });
        }

        // Aktualizuj notatki
        const { data: updatedOrder, error: updateError } = await supabase
            .from('Order')
            .update({ 
                notes: notes || null,
                updatedAt: new Date().toISOString()
            })
            .eq('id', orderId)
            .select('id, notes')
            .single();

        if (updateError) {
            console.error(`[PATCH /api/orders/${orderId}] Update error:`, updateError);
            return res.status(500).json({
                status: 'error',
                message: 'Błąd aktualizacji zamówienia'
            });
        }

        res.json({
            status: 'success',
            message: 'Zamówienie zostało zaktualizowane',
            data: updatedOrder
        });

    } catch (error) {
        console.error(`[PATCH /api/orders/${orderId}] Exception:`, error);
        res.status(500).json({
            status: 'error',
            message: 'Błąd serwera'
        });
    }
});

/**
 * DELETE /api/orders/:id
 * Usunięcie zamówienia (tylko ADMIN)
 */
router.delete('/:id', requireRole(['ADMIN']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { id: orderId } = req.params;
    
    if (!supabase) {
        return res.status(500).json({ 
            status: 'error', 
            message: 'Supabase nie jest skonfigurowany' 
        });
    }

    try {
        // Sprawdź czy zamówienie istnieje
        const { data: existingOrder, error: fetchError } = await supabase
            .from('Order')
            .select('id, orderNumber, status')
            .eq('id', orderId)
            .single();

        if (fetchError || !existingOrder) {
            return res.status(404).json({
                status: 'error',
                message: 'Zamówienie nie zostało znalezione'
            });
        }

        // Sprawdź czy można usunąć (tylko PENDING)
        if (existingOrder.status !== 'PENDING') {
            return res.status(400).json({
                status: 'error',
                message: 'Można usuwać tylko zamówienia w statusie PENDING'
            });
        }

        // Usuń pozycje zamówienia
        const { error: itemsError } = await supabase
            .from('OrderItem')
            .delete()
            .eq('orderId', orderId);

        if (itemsError) {
            console.error(`[DELETE /api/orders/${orderId}] Items delete error:`, itemsError);
            return res.status(500).json({
                status: 'error',
                message: 'Błąd usuwania pozycji zamówienia'
            });
        }

        // Usuń zamówienie
        const { error: orderError } = await supabase
            .from('Order')
            .delete()
            .eq('id', orderId);

        if (orderError) {
            console.error(`[DELETE /api/orders/${orderId}] Order delete error:`, orderError);
            return res.status(500).json({
                status: 'error',
                message: 'Błąd usuwania zamówienia'
            });
        }

        // Broadcast zdarzenia
        broadcastEvent({
            type: 'orderDeleted',
            orderId,
            orderNumber: existingOrder.orderNumber,
            timestamp: new Date().toISOString()
        });

        res.json({
            status: 'success',
            message: `Zamówienie ${existingOrder.orderNumber} zostało usunięte`
        });

    } catch (error) {
        console.error(`[DELETE /api/orders/${orderId}] Exception:`, error);
        res.status(500).json({
            status: 'error',
            message: 'Błąd serwera'
        });
    }
});

/**
 * POST /api/orders/bulk-delete
 * Hurtowe usuwanie zamówień (tylko ADMIN)
 */
router.post('/bulk-delete', requireRole(['ADMIN']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { orderIds } = req.body || {};
    
    if (!supabase) {
        return res.status(500).json({ 
            status: 'error', 
            message: 'Supabase nie jest skonfigurowany' 
        });
    }

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
        return res.status(400).json({
            status: 'error',
            message: 'Lista ID zamówień jest wymagana'
        });
    }

    try {
        // Sprawdź które zamówienia można usunąć
        const { data: orders, error: fetchError } = await supabase
            .from('Order')
            .select('id, orderNumber, status')
            .in('id', orderIds);

        if (fetchError) {
            console.error('[POST /api/orders/bulk-delete] Fetch error:', fetchError);
            return res.status(500).json({
                status: 'error',
                message: 'Błąd pobierania zamówień'
            });
        }

        const deletableOrders = (orders || []).filter(o => o.status === 'PENDING');
        const nonDeletableOrders = (orders || []).filter(o => o.status !== 'PENDING');

        if (deletableOrders.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Żadne z wybranych zamówień nie może być usunięte (tylko PENDING)'
            });
        }

        const deletableIds = deletableOrders.map(o => o.id);

        // Usuń pozycje zamówień
        const { error: itemsError } = await supabase
            .from('OrderItem')
            .delete()
            .in('orderId', deletableIds);

        if (itemsError) {
            console.error('[POST /api/orders/bulk-delete] Items delete error:', itemsError);
            return res.status(500).json({
                status: 'error',
                message: 'Błąd usuwania pozycji zamówień'
            });
        }

        // Usuń zamówienia
        const { error: ordersError } = await supabase
            .from('Order')
            .delete()
            .in('id', deletableIds);

        if (ordersError) {
            console.error('[POST /api/orders/bulk-delete] Orders delete error:', ordersError);
            return res.status(500).json({
                status: 'error',
                message: 'Błąd usuwania zamówień'
            });
        }

        // Broadcast zdarzenia
        broadcastEvent({
            type: 'ordersBulkDeleted',
            deletedCount: deletableOrders.length,
            orderNumbers: deletableOrders.map(o => o.orderNumber),
            timestamp: new Date().toISOString()
        });

        res.json({
            status: 'success',
            message: `Usunięto ${deletableOrders.length} zamówień`,
            data: {
                deleted: deletableOrders.length,
                skipped: nonDeletableOrders.length,
                skippedOrders: nonDeletableOrders.map(o => ({
                    id: o.id,
                    orderNumber: o.orderNumber,
                    status: o.status,
                    reason: 'Status inny niż PENDING'
                }))
            }
        });

    } catch (error) {
        console.error('[POST /api/orders/bulk-delete] Exception:', error);
        res.status(500).json({
            status: 'error',
            message: 'Błąd serwera'
        });
    }
});

/**
 * GET /api/orders/:id/production-status
 * Pobiera status produkcyjny zamówienia
 */
router.get('/:id/production-status', async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { getAuthContext } = require('../modules/auth');

    try {
        if (!supabase) {
            return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
        }

        const { userId, role } = await getAuthContext(req);
        if (!userId || !role) {
            return res.status(401).json({ status: 'error', message: 'Brak autoryzacji' });
        }

        if (!['SALES_REP', 'ADMIN', 'SALES_DEPT', 'WAREHOUSE', 'PRODUCTION'].includes(role)) {
            return res.status(403).json({ status: 'error', message: 'Brak uprawnień do tego zasobu' });
        }

        const orderId = req.params.id;
        if (!orderId) {
            return res.status(400).json({ status: 'error', message: 'Brak orderId' });
        }

        let orderStatus = null;

        // SALES_REP tylko swoje
        if (role === 'SALES_REP') {
            const { data: order, error: orderError } = await supabase
                .from('Order')
                .select('id, userId, status')
                .eq('id', orderId)
                .single();

            if (orderError || !order) {
                return res.status(404).json({ status: 'error', message: 'Zamówienie nie znalezione' });
            }

            if (order.userId !== userId) {
                return res.status(403).json({ status: 'error', message: 'Brak uprawnień do tego zasobu' });
            }

            orderStatus = order.status || null;
        }

        if (!orderStatus) {
            const { data: orderRow, error: orderRowError } = await supabase
                .from('Order')
                .select('status')
                .eq('id', orderId)
                .single();

            if (orderRowError || !orderRow) {
                return res.status(404).json({ status: 'error', message: 'Zamówienie nie znalezione' });
            }

            orderStatus = orderRow.status;
        }

        const productionStatus = await computeProductionStatusForOrder(orderId, orderStatus);

        res.json({
            status: 'success',
            data: productionStatus
        });

    } catch (error) {
        console.error('[GET /api/orders/:id/production-status] Exception:', error);
        res.status(500).json({
            status: 'error',
            message: 'Błąd serwera'
        });
    }
});

// ============================================
// ENDPOINTY DRUKU
// ============================================

/**
 * GET /api/orders/:id/production-work-orders/print
 * Generuje jeden połączony PDF ze wszystkimi zleceniami produkcyjnymi dla zamówienia
 */
router.get('/:id/production-work-orders/print', requireRole(['ADMIN', 'SALES_DEPT', 'PRODUCTION_MANAGER', 'PRODUCTION', 'OPERATOR', 'WAREHOUSE', 'SALES_REP']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { userId, role } = req.user;
    
    try {
        const orderId = parseInt(req.params.id, 10);
        if (isNaN(orderId)) {
            return res.status(400).json({ status: 'error', message: 'Nieprawidłowe ID zamówienia' });
        }

        // Sprawdź uprawnienia dla SALES_REP
        if (role === 'SALES_REP') {
            const { data: order, error: orderError } = await supabase
                .from('Order')
                .select('userId')
                .eq('id', orderId)
                .single();

            if (orderError || !order || order.userId !== userId) {
                return res.status(403).json({ status: 'error', message: 'Brak uprawnień do tego zamówienia' });
            }
        }

        // TODO: Implementuj generowanie PDF dla zleceń produkcyjnych
        res.status(501).json({ 
            status: 'error', 
            message: 'Generowanie PDF zleceń produkcyjnych nie jest jeszcze zaimplementowane',
            orderId 
        });

    } catch (error) {
        console.error('[GET /api/orders/:id/production-work-orders/print] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd generowania PDF' });
    }
});

/**
 * GET /api/orders/:id/packing-list/print
 * Generuje PDF listy kompletacyjnej
 */
router.get('/:id/packing-list/print', requireRole(['ADMIN', 'SALES_DEPT', 'PRODUCTION_MANAGER', 'WAREHOUSE', 'PRODUCTION', 'OPERATOR']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { userId } = req.user;
    
    try {
        const orderId = parseInt(req.params.id, 10);
        if (isNaN(orderId)) {
            return res.status(400).json({ status: 'error', message: 'Nieprawidłowe ID zamówienia' });
        }

        // TODO: Implementuj generowanie PDF listy kompletacyjnej
        res.status(501).json({ 
            status: 'error', 
            message: 'Generowanie PDF listy kompletacyjnej nie jest jeszcze zaimplementowane',
            orderId 
        });

    } catch (error) {
        console.error('[GET /api/orders/:id/packing-list/print] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd generowania PDF' });
    }
});

/**
 * DELETE /api/orders/:orderId/items/:itemId
 * Usuwa pojedynczą pozycję z zamówienia
 */
router.delete('/:orderId/items/:itemId', requireRole(['ADMIN', 'SALES_DEPT']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { userId, role } = req.user;
    
    try {
        const { orderId, itemId } = req.params;

        // Pobierz zamówienie
        const { data: order, error: orderError } = await supabase
            .from('Order')
            .select('id, userId, status')
            .eq('id', orderId)
            .single();

        if (orderError || !order) {
            return res.status(404).json({ status: 'error', message: 'Zamówienie nie znalezione' });
        }

        // Uprawnienia do usuwania pozycji
        const canDeleteStatuses = {
            SALES_DEPT: ['PENDING', 'APPROVED'],
            ADMIN: ['PENDING', 'APPROVED']
        };

        const allowedStatuses = canDeleteStatuses[role] || [];
        if (allowedStatuses.length === 0) {
            return res.status(403).json({ status: 'error', message: 'Brak uprawnień do usuwania pozycji zamówienia' });
        }

        if (!allowedStatuses.includes(order.status)) {
            return res.status(403).json({ 
                status: 'error', 
                message: `Nie można usuwać pozycji w statusie "${order.status}". Dozwolone statusy: ${allowedStatuses.join(', ') || 'brak'}` 
            });
        }

        // Sprawdź, czy pozycja należy do tego zamówienia
        const { data: item, error: itemError } = await supabase
            .from('OrderItem')
            .select('id, orderId')
            .eq('id', itemId)
            .single();

        if (itemError || !item || item.orderId !== orderId) {
            return res.status(404).json({ status: 'error', message: 'Pozycja zamówienia nie znaleziona' });
        }

        const { error: deleteError } = await supabase
            .from('OrderItem')
            .delete()
            .eq('id', itemId);

        if (deleteError) {
            console.error('Błąd usuwania pozycji zamówienia:', deleteError);
            return res.status(500).json({ status: 'error', message: 'Nie udało się usunąć pozycji zamówienia' });
        }

        // Przelicz total po usunięciu
        let newTotal = 0;
        const { data: remainingItems, error: remainingError } = await supabase
            .from('OrderItem')
            .select('quantity, unitPrice')
            .eq('orderId', orderId);

        if (!remainingError && remainingItems) {
            newTotal = remainingItems.reduce((sum, row) => sum + (row.quantity * row.unitPrice), 0);
        }

        const { error: orderUpdateError } = await supabase
            .from('Order')
            .update({ total: newTotal, updatedAt: new Date().toISOString() })
            .eq('id', orderId);

        if (orderUpdateError) {
            console.error('Błąd aktualizacji total zamówienia po usunięciu pozycji:', orderUpdateError);
        }

        console.log(`[DELETE /api/orders/${orderId}/items/${itemId}] Nowy total: ${newTotal}`);

        return res.json({
            status: 'success',
            message: 'Pozycja została usunięta',
            data: { total: newTotal }
        });

    } catch (error) {
        console.error('Błąd w DELETE /api/orders/:orderId/items/:itemId:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

module.exports = router;
