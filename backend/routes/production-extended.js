/**
 * Router dla rozszerzonych endpointów produkcyjnych
 * Endpointy przeniesione ze starego server.js (linie 8608-13511)
 * 
 * TODO: Brakujące endpointy do migracji:
 * - GET /api/production/path-codes - kody ścieżek produkcyjnych
 * - GET /api/production/workcenters/:workCenterId/path-mappings - mapowania ścieżek dla centrum
 * - POST /api/production/workcenters/:workCenterId/path-mappings - dodaj mapowanie
 * - DELETE /api/production/workcenters/:workCenterId/path-mappings/:pathCode - usuń mapowanie
 * - GET /api/production/orders/:id - szczegóły zamówienia produkcyjnego
 * - POST /api/production/orders/fix-orphaned - napraw osierocone zlecenia
 */

const express = require('express');
const { requireRole } = require('../modules/auth');
const { broadcastEvent } = require('../modules/sse');

const router = express.Router();

const WORKCENTER_TYPE_TO_PATH_CODES = {
    laser_co2: ['3'],
    uv_print: ['1'],
    solvent: ['2'],
    cnc: ['4'],
    finishing: ['5']
};

function parsePathExpression(expr) {
    if (!expr) return [];
    const normalized = expr.replace(/[%$&]/g, '|');
    return normalized
        .split('|')
        .map(s => s.trim())
        .filter(Boolean);
}

// Middleware do sprawdzania konfiguracji Supabase
router.use((req, res, next) => {
    if (!req.app.locals.supabase) {
        return res.status(500).json({ 
            status: 'error', 
            message: 'Supabase nie jest skonfigurowany' 
        });
    }
    next();
});


// ============================================
// GET /api/production/rooms/:id - szczegóły pokoju
// ============================================
router.get('/rooms/:id', requireRole(['ADMIN', 'PRODUCTION', 'SALES_DEPT']), async (req, res) => {
    const supabase = req.app.locals.supabase;

    try {
        const { id } = req.params;

        const { data: room, error } = await supabase
            .from('ProductionRoom')
            .select(`
                *,
                supervisor:User!ProductionRoom_supervisorId_fkey(id, name, email),
                workCenters:WorkCenter(
                    id, name, code, type, description, isActive,
                    workStations:WorkStation(id, name, code, type, status, manufacturer, model)
                )
            `)
            .eq('id', id)
            .single();

        if (error) {
            console.error('[GET /api/production/rooms/:id] Błąd:', error);
            return res.status(404).json({ status: 'error', message: 'Pokój nie znaleziony' });
        }

        return res.json({ status: 'success', data: room });
    } catch (error) {
        console.error('[GET /api/production/rooms/:id] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// POST /api/production/rooms - tworzenie pokoju
// ============================================
router.post('/rooms', requireRole(['ADMIN']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { name, code, area, description, supervisorId, roomManagerUserId } = req.body;

    try {
        const { data, error } = await supabase
            .from('ProductionRoom')
            .insert({
                name,
                code,
                area,
                description,
                supervisorId,
                roomManagerUserId,
                isActive: true,
                createdAt: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;

        // Broadcast zdarzenia
        broadcastEvent({
            type: 'productionRoomCreated',
            roomId: data.id,
            room: data
        });

        return res.json({
            status: 'success',
            message: 'Pokój został utworzony',
            data
        });
    } catch (error) {
        console.error('[POST /api/production/rooms] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// PATCH /api/production/rooms/:id - aktualizacja pokoju
// ============================================
router.patch('/rooms/:id', requireRole(['ADMIN']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { id } = req.params;
    const { name, code, area, description, supervisorId, roomManagerUserId } = req.body;

    try {
        const { data, error } = await supabase
            .from('ProductionRoom')
            .update({
                name,
                code,
                area,
                description,
                supervisorId,
                roomManagerUserId,
                updatedAt: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // Broadcast zdarzenia
        broadcastEvent({
            type: 'productionRoomUpdated',
            roomId: data.id,
            room: data
        });

        return res.json({
            status: 'success',
            message: 'Pokój został zaktualizowany',
            data
        });
    } catch (error) {
        console.error('[PATCH /api/production/rooms/:id] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// DELETE /api/production/rooms/:id - usuwanie pokoju
// ============================================
router.delete('/rooms/:id', requireRole(['ADMIN']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { id } = req.params;

    try {
        // Sprawdź, czy pokój nie ma przypisanych stanowisk
        const { data: workStations, error: wsError } = await supabase
            .from('WorkStation')
            .select('id')
            .eq('roomId', id)
            .eq('isActive', true);

        if (wsError) throw wsError;

        if (workStations && workStations.length > 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Nie można usunąć pokoju z przypisanymi stanowiskami'
            });
        }

        // Dezaktywuj pokój
        const { error } = await supabase
            .from('ProductionRoom')
            .update({ 
                isActive: false,
                updatedAt: new Date().toISOString()
            })
            .eq('id', id);

        if (error) throw error;

        // Broadcast zdarzenia
        broadcastEvent({
            type: 'productionRoomDeleted',
            roomId: parseInt(id)
        });

        return res.json({
            status: 'success',
            message: 'Pokój został usunięty'
        });
    } catch (error) {
        console.error('[DELETE /api/production/rooms/:id] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// GET /api/production/work-center-types - typy centrów roboczych
// ============================================
router.get('/work-center-types', requireRole(['ADMIN', 'PRODUCTION', 'PRODUCTION_MANAGER']), async (req, res) => {
    const supabase = req.app.locals.supabase;

    try {
        const { data, error } = await supabase
            .from('WorkCenterType')
            .select('*')
            .eq('isActive', true)
            .order('name');

        if (error) throw error;

        return res.json({ status: 'success', data: data || [] });
    } catch (error) {
        console.error('[GET /api/production/work-center-types] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// POST /api/production/work-center-types - tworzenie typu centrum
// ============================================
router.post('/work-center-types', requireRole(['ADMIN']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { name, code, description } = req.body;

    try {
        const { data, error } = await supabase
            .from('WorkCenterType')
            .insert({
                name,
                code,
                description,
                isActive: true,
                createdAt: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;

        return res.json({
            status: 'success',
            message: 'Typ centrum został utworzony',
            data
        });
    } catch (error) {
        console.error('[POST /api/production/work-center-types] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// PATCH /api/production/work-center-types/:id - aktualizacja typu
// ============================================
router.patch('/work-center-types/:id', requireRole(['ADMIN']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { id } = req.params;
    const { name, code, description } = req.body;

    try {
        const { data, error } = await supabase
            .from('WorkCenterType')
            .update({
                name,
                code,
                description,
                updatedAt: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return res.json({
            status: 'success',
            message: 'Typ centrum został zaktualizowany',
            data
        });
    } catch (error) {
        console.error('[PATCH /api/production/work-center-types/:id] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// GET /api/production/operation-types - typy operacji
// ============================================
router.get('/operation-types', requireRole(['ADMIN', 'PRODUCTION', 'PRODUCTION_MANAGER']), async (req, res) => {
    const supabase = req.app.locals.supabase;

    try {
        const { data, error } = await supabase
            .from('OperationType')
            .select('*')
            .eq('isActive', true)
            .order('name');

        if (error) throw error;

        return res.json({ status: 'success', data: data || [] });
    } catch (error) {
        console.error('[GET /api/production/operation-types] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// POST /api/production/operation-types - tworzenie typu operacji
// ============================================
router.post('/operation-types', requireRole(['ADMIN']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { name, code, description, defaultDuration } = req.body;

    try {
        const { data, error } = await supabase
            .from('OperationType')
            .insert({
                name,
                code,
                description,
                defaultDuration,
                isActive: true,
                createdAt: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;

        return res.json({
            status: 'success',
            message: 'Typ operacji został utworzony',
            data
        });
    } catch (error) {
        console.error('[POST /api/production/operation-types] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// PATCH /api/production/operation-types/:id - aktualizacja typu operacji
// ============================================
router.patch('/operation-types/:id', requireRole(['ADMIN']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { id } = req.params;
    const { name, code, description, defaultDuration } = req.body;

    try {
        const { data, error } = await supabase
            .from('OperationType')
            .update({
                name,
                code,
                description,
                defaultDuration,
                updatedAt: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return res.json({
            status: 'success',
            message: 'Typ operacji został zaktualizowany',
            data
        });
    } catch (error) {
        console.error('[PATCH /api/production/operation-types/:id] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// GET /api/production/work-centers - centra robocze
// ============================================
router.get('/work-centers', requireRole(['ADMIN', 'PRODUCTION', 'SALES_DEPT']), async (req, res) => {
    const supabase = req.app.locals.supabase;

    try {
        const { roomId } = req.query;
        let query = supabase
            .from('WorkCenter')
            .select(`
                *,
                room:ProductionRoom(id, name, code),
                type:WorkCenterType(id, name, code),
                workStations:WorkStation(id, name, code, status)
            `)
            .eq('isActive', true);

        if (roomId) {
            query = query.eq('roomId', roomId);
        }

        const { data, error } = await query.order('name');

        if (error) throw error;

        return res.json({ status: 'success', data: data || [] });
    } catch (error) {
        console.error('[GET /api/production/work-centers] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// POST /api/production/work-centers - tworzenie centrum
// ============================================
router.post('/work-centers', requireRole(['ADMIN']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { name, code, type, roomId, description, capacity } = req.body;

    try {
        const { data, error } = await supabase
            .from('WorkCenter')
            .insert({
                name,
                code,
                type,
                roomId,
                description,
                capacity,
                isActive: true,
                createdAt: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;

        return res.json({
            status: 'success',
            message: 'Centrum robocze zostało utworzone',
            data
        });
    } catch (error) {
        console.error('[POST /api/production/work-centers] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// GET /api/production/work-stations - stanowiska pracy
// ============================================
router.get('/work-stations', requireRole(['ADMIN', 'PRODUCTION', 'SALES_DEPT']), async (req, res) => {
    const supabase = req.app.locals.supabase;

    try {
        const { workCenterId } = req.query;
        let query = supabase
            .from('WorkStation')
            .select(`
                *,
                workCenter:WorkCenter(id, name, code),
                room:ProductionRoom(id, name, code)
            `)
            .eq('isActive', true);

        if (workCenterId) {
            query = query.eq('workCenterId', workCenterId);
        }

        const { data, error } = await query.order('name');

        if (error) throw error;

        return res.json({ status: 'success', data: data || [] });
    } catch (error) {
        console.error('[GET /api/production/work-stations] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// POST /api/production/work-stations - tworzenie stanowiska
// ============================================
router.post('/work-stations', requireRole(['ADMIN']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { name, code, type, workCenterId, roomId, manufacturer, model, description } = req.body;

    try {
        const { data, error } = await supabase
            .from('WorkStation')
            .insert({
                name,
                code,
                type,
                workCenterId,
                roomId,
                manufacturer,
                model,
                description,
                status: 'available',
                isActive: true,
                createdAt: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;

        return res.json({
            status: 'success',
            message: 'Stanowisko zostało utworzone',
            data
        });
    } catch (error) {
        console.error('[POST /api/production/work-stations] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// PATCH /api/production/work-stations/:id/status - zmiana statusu stanowiska
// ============================================
router.patch('/work-stations/:id/status', requireRole(['ADMIN', 'PRODUCTION']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { id } = req.params;
    const { status } = req.body;

    try {
        const { data, error } = await supabase
            .from('WorkStation')
            .update({
                status,
                updatedAt: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // Broadcast zdarzenia
        broadcastEvent({
            type: 'workStationStatusChanged',
            stationId: data.id,
            status: data.status
        });

        return res.json({
            status: 'success',
            message: 'Status stanowiska został zmieniony',
            data
        });
    } catch (error) {
        console.error('[PATCH /api/production/work-stations/:id/status] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// GET /api/production/stats - statystyki produkcyjne
// ============================================
router.get('/stats', requireRole(['ADMIN', 'PRODUCTION', 'SALES_DEPT']), async (req, res) => {
    const supabase = req.app.locals.supabase;

    try {
        const { dateFrom, dateTo } = req.query;
        
        // Statystyki zamówień produkcyjnych
        let ordersQuery = supabase
            .from('ProductionOrder')
            .select('status, quantity, completedquantity, createdAt, completedAt');

        if (dateFrom) ordersQuery = ordersQuery.gte('createdAt', dateFrom);
        if (dateTo) ordersQuery = ordersQuery.lte('createdAt', dateTo);

        const { data: orders, error: ordersError } = await ordersQuery;
        if (ordersError) throw ordersError;

        // Statystyki operacji
        const { data: operations, error: opsError } = await supabase
            .from('ProductionOperation')
            .select('status, assignedUserId, startedAt, completedAt');

        if (opsError) throw opsError;

        const stats = {
            totalOrders: orders?.length || 0,
            completedOrders: orders?.filter(o => o.status === 'COMPLETED').length || 0,
            inProgressOrders: orders?.filter(o => o.status === 'IN_PROGRESS').length || 0,
            totalOperations: operations?.length || 0,
            activeOperations: operations?.filter(o => o.status === 'active').length || 0,
            completedOperations: operations?.filter(o => o.status === 'completed').length || 0
        };

        return res.json({ status: 'success', data: stats });
    } catch (error) {
        console.error('[GET /api/production/stats] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// GET /api/production/paths - ścieżki produkcyjne
// ============================================
router.get('/paths', requireRole(['ADMIN', 'PRODUCTION', 'SALES_DEPT']), async (req, res) => {
    const supabase = req.app.locals.supabase;

    try {
        const { data, error } = await supabase
            .from('ProductionPath')
            .select(`
                *,
                operations:ProductionOperationType(
                    id,
                    name,
                    code,
                    operationType:OperationType(id, name),
                    sequenceOrder,
                    defaultDuration
                )
            `)
            .eq('isActive', true)
            .order('name');

        if (error) throw error;

        return res.json({ status: 'success', data: data || [] });
    } catch (error) {
        console.error('[GET /api/production/paths] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// GET /api/production/paths/:id - szczegóły ścieżki
// ============================================
router.get('/paths/:id', requireRole(['ADMIN', 'PRODUCTION', 'SALES_DEPT']), async (req, res) => {
    const supabase = req.app.locals.supabase;

    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('ProductionPath')
            .select(`
                *,
                operations:ProductionOperationType(
                    *,
                    operationType:OperationType(id, name, code)
                )
            `)
            .eq('id', id)
            .single();

        if (error) throw error;

        return res.json({ status: 'success', data });
    } catch (error) {
        console.error('[GET /api/production/paths/:id] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// POST /api/production/paths - tworzenie ścieżki
// ============================================
router.post('/paths', requireRole(['ADMIN']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { name, code, description, operations } = req.body;

    try {
        const { data: path, error: pathError } = await supabase
            .from('ProductionPath')
            .insert({
                name,
                code,
                description,
                isActive: true,
                createdAt: new Date().toISOString()
            })
            .select()
            .single();

        if (pathError) throw pathError;

        // Dodaj operacje do ścieżki
        if (operations && operations.length > 0) {
            const operationsToInsert = operations.map((op, index) => ({
                productionPathId: path.id,
                operationTypeId: op.operationTypeId,
                sequenceOrder: index + 1,
                defaultDuration: op.defaultDuration,
                createdAt: new Date().toISOString()
            }));

            const { error: opsError } = await supabase
                .from('ProductionOperationType')
                .insert(operationsToInsert);

            if (opsError) throw opsError;
        }

        return res.json({
            status: 'success',
            message: 'Ścieżka produkcyjna została utworzona',
            data: path
        });
    } catch (error) {
        console.error('[POST /api/production/paths] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// PATCH /api/production/paths/:id - aktualizacja ścieżki
// ============================================
router.patch('/paths/:id', requireRole(['ADMIN']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { id } = req.params;
    const { name, code, description } = req.body;

    try {
        const { data, error } = await supabase
            .from('ProductionPath')
            .update({
                name,
                code,
                description,
                updatedAt: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return res.json({
            status: 'success',
            message: 'Ścieżka została zaktualizowana',
            data
        });
    } catch (error) {
        console.error('[PATCH /api/production/paths/:id] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// DELETE /api/production/paths/:id - usuwanie ścieżki
// ============================================
router.delete('/paths/:id', requireRole(['ADMIN']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { id } = req.params;

    try {
        // Sprawdź, czy ścieżka nie jest używana
        const { data: orders, error: ordersError } = await supabase
            .from('ProductionOrder')
            .select('id')
            .eq('productionPathId', id)
            .eq('isActive', true);

        if (ordersError) throw ordersError;

        if (orders && orders.length > 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Nie można usunąć ścieżki używanej w zamówieniach'
            });
        }

        // Dezaktywuj ścieżkę
        const { error } = await supabase
            .from('ProductionPath')
            .update({ 
                isActive: false,
                updatedAt: new Date().toISOString()
            })
            .eq('id', id);

        if (error) throw error;

        return res.json({
            status: 'success',
            message: 'Ścieżka została usunięta'
        });
    } catch (error) {
        console.error('[DELETE /api/production/paths/:id] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// GET /api/production/work-orders/:id/print - druk zlecenia produkcyjnego
// ============================================
router.get('/work-orders/:id/print', async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { getAuthContext } = require('../modules/auth');

    try {
        const { userId, role } = await getAuthContext(req);
        
        if (!userId || !role) {
            return res.status(401).json({ status: 'error', message: 'Brak autoryzacji' });
        }

        const fullAccessRoles = ['ADMIN', 'SALES_DEPT', 'PRODUCTION_MANAGER', 'PRODUCTION', 'OPERATOR'];
        const isSalesRep = role === 'SALES_REP';

        if (!fullAccessRoles.includes(role) && !isSalesRep) {
            return res.status(403).json({ status: 'error', message: 'Brak uprawnień do druku zleceń' });
        }

        const workOrderId = parseInt(req.params.id, 10);
        if (isNaN(workOrderId)) {
            return res.status(400).json({ status: 'error', message: 'Nieprawidłowe ID zlecenia' });
        }

        // Pobierz dane zlecenia produkcyjnego
        const { data: workOrder, error: woError } = await supabase
            .from('ProductionWorkOrder')
            .select('*')
            .eq('id', workOrderId)
            .single();

        if (woError || !workOrder) {
            return res.status(404).json({ status: 'error', message: 'Zlecenie nie znalezione' });
        }

        // Sprawdź uprawnienia dla SALES_REP
        if (isSalesRep) {
            const { data: order, error: orderError } = await supabase
                .from('Order')
                .select('userId')
                .eq('id', workOrder.orderId)
                .single();

            if (orderError || !order || order.userId !== userId) {
                return res.status(403).json({ status: 'error', message: 'Brak uprawnień do tego zlecenia' });
            }
        }

        // Generuj PDF (uproszczona implementacja)
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="work-order-${workOrderId}.pdf"`);
        
        // Tutaj powinna być logika generowania PDF
        // Na razie zwracam prosty placeholder
        res.send('PDF generation not implemented yet');

    } catch (error) {
        console.error('[GET /api/production/work-orders/:id/print] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// GET /api/production/orders - lista zleceń produkcyjnych
// ============================================
router.get('/orders', requireRole(['ADMIN', 'PRODUCTION', 'SALES_DEPT', 'SALES_REP']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { userId, role } = req.user || {};
    const { status, roomId, dateFrom, dateTo } = req.query;

    try {
        let query = supabase
            .from('ProductionOrder')
            .select(`
                *,
                Order:orderId(id, orderNumber, Customer(name), status),
                ProductionPath:productionPathId(id, name, code),
                Room:roomId(id, name, code),
                operations:ProductionOperation(
                    id, status, sequenceOrder, startedAt, completedAt,
                    assignedUserId, User:assignedUserId(name)
                )
            `);

        // Filtry
        if (status) query = query.eq('status', status);
        if (roomId) query = query.eq('roomId', roomId);
        if (dateFrom) query = query.gte('createdAt', dateFrom);
        if (dateTo) query = query.lte('createdAt', dateTo);

        // SALES_REP widzi tylko swoje
        if (role === 'SALES_REP') {
            query = query.eq('Order.userId', userId);
        }

        const { data, error } = await query.order('createdAt', { ascending: false });

        if (error) throw error;

        // Oblicz postęp dla każdego zamówienia
        const ordersWithProgress = (data || []).map(order => {
            const totalOps = order.operations?.length || 0;
            const completedOps = order.operations?.filter(op => op.status === 'completed').length || 0;
            const activeOps = order.operations?.filter(op => op.status === 'active').length || 0;
            const progress = totalOps > 0 ? (completedOps / totalOps) * 100 : 0;

            return {
                ...order,
                progress: Math.round(progress),
                totalOperations: totalOps,
                completedOperations: completedOps,
                activeOperations: activeOps,
                currentOperation: order.operations?.find(op => op.status === 'active') || null
            };
        });

        return res.json({ status: 'success', data: ordersWithProgress });
    } catch (error) {
        console.error('[GET /api/production/orders] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// POST /api/production/orders/from-order/:orderId - tworzenie zleceń z zamówienia
// ============================================
router.post('/orders/from-order/:orderId', requireRole(['ADMIN', 'PRODUCTION']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { orderId } = req.params;
    const { items, priority, notes } = req.body;

    try {
        // Pobierz zamówienie
        const { data: order, error: orderError } = await supabase
            .from('Order')
            .select('*')
            .eq('id', orderId)
            .single();

        if (orderError || !order) {
            return res.status(404).json({ status: 'error', message: 'Zamówienie nie znalezione' });
        }

        // Utwórz zlecenia produkcyjne dla każdego przedmiotu
        const productionOrders = [];
        for (const item of items || []) {
            const { data: prodOrder, error: prodError } = await supabase
                .from('ProductionOrder')
                .insert({
                    orderId,
                    orderItemId: item.id,
                    quantity: item.quantity,
                    status: 'PLANNED',
                    priority: priority || 'NORMAL',
                    notes,
                    createdAt: new Date().toISOString()
                })
                .select()
                .single();

            if (prodError) throw prodError;
            productionOrders.push(prodOrder);
        }

        return res.json({
            status: 'success',
            message: `Utworzono ${productionOrders.length} zleceń produkcyjnych`,
            data: productionOrders
        });
    } catch (error) {
        console.error('[POST /api/production/orders/from-order] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// PATCH /api/production/orders/:id/status - zmiana statusu zlecenia
// ============================================
router.patch('/orders/:id/status', requireRole(['ADMIN', 'PRODUCTION']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { id } = req.params;
    const { status } = req.body;

    try {
        const { data, error } = await supabase
            .from('ProductionOrder')
            .update({
                status,
                updatedAt: new Date().toISOString(),
                ...(status === 'COMPLETED' ? { completedAt: new Date().toISOString() } : {})
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // Broadcast zdarzenia
        broadcastEvent({
            type: 'productionOrderStatusChanged',
            orderId: data.id,
            status: data.status
        });

        return res.json({
            status: 'success',
            message: 'Status zlecenia został zmieniony',
            data
        });
    } catch (error) {
        console.error('[PATCH /api/production/orders/:id/status] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// DELETE /api/production/orders/:id - usunięcie zlecenia
// ============================================
router.delete('/orders/:id', requireRole(['ADMIN']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { id } = req.params;

    try {
        // Sprawdź, czy zlecenie ma aktywne operacje
        const { data: operations, error: opsError } = await supabase
            .from('ProductionOperation')
            .select('id')
            .eq('productionOrderId', id)
            .in('status', ['active', 'pending']);

        if (opsError) throw opsError;

        if (operations && operations.length > 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Nie można usunąć zlecenia z aktywnymi operacjami'
            });
        }

        // Dezaktywuj zlecenie
        const { error } = await supabase
            .from('ProductionOrder')
            .update({ 
                isActive: false,
                updatedAt: new Date().toISOString()
            })
            .eq('id', id);

        if (error) throw error;

        return res.json({
            status: 'success',
            message: 'Zlecenie zostało usunięte'
        });
    } catch (error) {
        console.error('[DELETE /api/production/orders/:id] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// PATCH /api/production/operations/:id/status - zmiana statusu operacji
// ============================================
router.patch('/operations/:id/status', requireRole(['ADMIN', 'PRODUCTION', 'OPERATOR']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { id } = req.params;
    const { status } = req.body;

    try {
        const { data, error } = await supabase
            .from('ProductionOperation')
            .update({
                status,
                updatedAt: new Date().toISOString(),
                ...(status === 'completed' ? { completedAt: new Date().toISOString() } : {}),
                ...(status === 'active' ? { startedAt: new Date().toISOString() } : {})
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // Broadcast zdarzenia
        broadcastEvent({
            type: 'operationStatusChanged',
            operationId: data.id,
            status: data.status
        });

        return res.json({
            status: 'success',
            message: 'Status operacji został zmieniony',
            data
        });
    } catch (error) {
        console.error('[PATCH /api/production/operations/:id/status] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// POST /api/production/operations/:id/problem - zgłoszenie problemu z operacją
// ============================================
router.post('/operations/:id/problem', requireRole(['ADMIN', 'PRODUCTION', 'OPERATOR']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { id } = req.params;
    const { description, severity } = req.body;
    const { userId } = req.user || {};

    try {
        // Zaktualizuj status operacji
        const { data: operation, error: opError } = await supabase
            .from('ProductionOperation')
            .update({
                status: 'problem',
                updatedAt: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (opError) throw opError;

        // Zapisz w logu
        const { error: logError } = await supabase
            .from('ProductionLog')
            .insert({
                productionOperationId: id,
                action: 'problem',
                userId,
                timestamp: new Date().toISOString(),
                metadata: { description, severity }
            });

        if (logError) throw logError;

        // Broadcast zdarzenia
        broadcastEvent({
            type: 'operationProblem',
            operationId: id,
            description,
            severity
        });

        return res.json({
            status: 'success',
            message: 'Problem został zgłoszony',
            data: operation
        });
    } catch (error) {
        console.error('[POST /api/production/operations/:id/problem] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// POST /api/production/operations/:id/cancel - anulowanie operacji
// ============================================
router.post('/operations/:id/cancel', requireRole(['ADMIN', 'PRODUCTION', 'OPERATOR', 'PRODUCTION_MANAGER']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { id } = req.params;
    const { reason } = req.body;
    const { userId } = req.user || {};

    try {
        // Zaktualizuj status operacji
        const { data: operation, error: opError } = await supabase
            .from('ProductionOperation')
            .update({
                status: 'cancelled',
                updatedAt: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (opError) throw opError;

        // Zapisz w logu
        const { error: logError } = await supabase
            .from('ProductionLog')
            .insert({
                productionOperationId: id,
                action: 'cancel',
                userId,
                timestamp: new Date().toISOString(),
                metadata: { reason }
            });

        if (logError) throw logError;

        // Broadcast zdarzenia
        broadcastEvent({
            type: 'operationCancelled',
            operationId: id,
            reason
        });

        return res.json({
            status: 'success',
            message: 'Operacja została anulowana',
            data: operation
        });
    } catch (error) {
        console.error('[POST /api/production/operations/:id/cancel] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// GET /api/production/kpi/overview - przegląd KPI produkcji
// ============================================
router.get('/kpi/overview', requireRole(['ADMIN', 'PRODUCTION_MANAGER', 'PRODUCTION']), async (req, res) => {
    const supabase = req.app.locals.supabase;

    try {
        const { dateFrom, dateTo } = req.query;
        
        // Okres czasu
        const defaultDateFrom = new Date();
        defaultDateFrom.setDate(defaultDateFrom.getDate() - 30);
        const fromDate = dateFrom || defaultDateFrom.toISOString();
        const toDate = dateTo || new Date().toISOString();

        // Statystyki zamówień
        const { data: orders, error: ordersError } = await supabase
            .from('ProductionOrder')
            .select('status, quantity, completedquantity, createdAt, completedAt')
            .gte('createdAt', fromDate)
            .lte('createdAt', toDate);

        if (ordersError) throw ordersError;

        // Statystyki operacji
        const { data: operations, error: opsError } = await supabase
            .from('ProductionOperation')
            .select('status, startedAt, completedAt')
            .gte('createdAt', fromDate)
            .lte('createdAt', toDate);

        if (opsError) throw opsError;

        // Oblicz KPI
        const totalOrders = orders?.length || 0;
        const completedOrders = orders?.filter(o => o.status === 'COMPLETED').length || 0;
        const onTimeDelivery = orders?.filter(o => 
            o.status === 'COMPLETED' && o.completedAt <= o.expectedCompletionDate
        ).length || 0;

        const totalOperations = operations?.length || 0;
        const completedOperations = operations?.filter(o => o.status === 'completed').length || 0;
        
        // Czas cyklu (średni czas od rozpoczęcia do zakończenia)
        const cycleTimes = operations
            ?.filter(o => o.status === 'completed' && o.startedAt && o.completedAt)
            .map(o => new Date(o.completedAt) - new Date(o.startedAt)) || [];
        
        const avgCycleTime = cycleTimes.length > 0 
            ? cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length / (1000 * 60 * 60) // w godzinach
            : 0;

        const kpi = {
            totalOrders,
            completedOrders,
            completionRate: totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0,
            onTimeDeliveryRate: completedOrders > 0 ? (onTimeDelivery / completedOrders) * 100 : 0,
            totalOperations,
            completedOperations,
            operationCompletionRate: totalOperations > 0 ? (completedOperations / totalOperations) * 100 : 0,
            averageCycleTimeHours: Math.round(avgCycleTime * 100) / 100
        };

        return res.json({ status: 'success', data: kpi });
    } catch (error) {
        console.error('[GET /api/production/kpi/overview] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// GET /api/production/rooms/:roomId/machine-assignments - przypisania maszyn do pokoju
// ============================================
router.get('/rooms/:roomId/machine-assignments', requireRole(['ADMIN', 'PRODUCTION_MANAGER', 'PRODUCTION', 'OPERATOR']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const roomId = parseInt(req.params.roomId);

    try {
        console.log('[DEBUG] Request for roomId:', roomId);
        
        // Pobierz dane pokoju
        const { data: room, error: roomError } = await supabase
            .from('ProductionRoom')
            .select('id, name, code')
            .eq('id', roomId)
            .single();

        console.log('[DEBUG] Room data:', room, 'Error:', roomError);

        if (roomError || !room) {
            return res.status(404).json({ status: 'error', message: 'Pokój nie znaleziony' });
        }

        // Pobierz maszyny wraz z gniazdami przypisanymi do pokoju
        const { data: machines, error: machinesError } = await supabase
            .from('WorkStation')
            .select(`
                id, name, code, status, "isActive", "restrictToAssignedProducts", type,
                WorkCenter!inner(id, "roomId", type)
            `)
            .eq('WorkCenter.roomId', roomId)
            .eq('isActive', true);

        if (machinesError) {
            console.error('[GET /api/production/rooms/:roomId/machine-assignments] Błąd pobierania maszyn:', machinesError);
            return res.status(500).json({ status: 'error', message: 'Błąd pobierania maszyn' });
        }

        console.log('[machine-assignments] Machines count:', machines?.length || 0, 'roomId:', roomId);

        // Zbuduj listę gniazd (WorkCenter) dla pokoju
        const workCenterIds = [...new Set((machines || []).map(m => m.WorkCenter?.id).filter(Boolean))];
        const workCenterInfoById = new Map((machines || [])
            .map(m => m.WorkCenter)
            .filter(Boolean)
            .map(wc => [wc.id, wc]));

        // Pobierz aktywne mapowania ścieżek
        const roomPathCodes = new Set();
        if (workCenterIds.length > 0) {
            const { data: mappings, error: mappingError } = await supabase
                .from('WorkCenterPathMapping')
                .select('workcenterid, pathcode')
                .in('workcenterid', workCenterIds)
                .eq('isactive', true);

            if (mappingError) {
                console.warn('[machine-assignments] Błąd mapowań, fallback:', mappingError.message);
            } else {
                (mappings || []).forEach(m => roomPathCodes.add(m.pathcode));
            }
        }

        // Fallback na podstawie typu gniazda
        if (roomPathCodes.size === 0) {
            for (const machine of machines || []) {
                const wcType = workCenterInfoById.get(machine.WorkCenter?.id || null)?.type || machine.type;
                if (!wcType) continue;
                const mapped = WORKCENTER_TYPE_TO_PATH_CODES[wcType];
                if (mapped && mapped.length) {
                    mapped.forEach(code => roomPathCodes.add(code));
                }
            }
        }

        // Pobierz przypisania maszyn
        const machineIds = machines?.map(m => m.id) || [];
        let assignments = [];
        
        if (machineIds.length > 0) {
            const { data: assignmentsData, error: assignmentsError } = await supabase
                .from('MachineProductAssignment')
                .select(`
                    workstationid, productid, notes,
                    "Product"(id, name, identifier)
                `)
                .in('workstationid', machineIds);

            if (assignmentsError) {
                console.error('[machine-assignments] Błąd przypisań:', assignmentsError);
            } else {
                assignments = assignmentsData || [];
            }
        }

        // Mapuj przypisania do maszyn
        const machinesWithProducts = (machines || []).map(machine => {
            const machineAssignments = assignments.filter(a => a.workstationid === machine.id);
            return {
                id: machine.id,
                name: machine.name,
                code: machine.code,
                status: machine.status,
                isActive: machine.isActive,
                restrictToAssignedProducts: machine.restrictToAssignedProducts || false,
                workCenterId: machine.WorkCenter?.id || null,
                workCenterType: machine.WorkCenter?.type || null,
                products: machineAssignments.map(a => ({
                    id: a.Product?.id || a.productid,
                    name: a.Product?.name || 'Nieznany produkt',
                    identifier: a.Product?.identifier || '',
                    notes: a.notes
                }))
            };
        });

        // Pobierz produkty nieprzypisane
        const assignedProductIds = assignments.map(a => a.productid);
        const { data: allProducts } = await supabase
            .from('Product')
            .select('id, name, identifier, "productionPath"')
            .eq('isActive', true)
            .limit(500);

        const unassignedProducts = (allProducts || [])
            .filter(p => {
                if (assignedProductIds.includes(p.id)) return false;
                const pathCodes = parsePathExpression(p.productionPath);
                if (roomPathCodes.size === 0) return true;
                return pathCodes.some(code => {
                    if (roomPathCodes.has(code)) return true;
                    const base = code?.split('.')[0];
                    return base && roomPathCodes.has(base);
                });
            })
            .map(p => ({
                id: p.id,
                name: p.name,
                identifier: p.identifier,
                productionPath: p.productionPath
            }));

        console.log('[machine-assignments] assignedProductIds:', assignedProductIds.length, 'allProducts:', allProducts?.length || 0, 'unassigned:', unassignedProducts.length);

        return res.json({ 
            status: 'success', 
            data: {
                room,
                machines: machinesWithProducts,
                unassignedProducts
            }
        });

    } catch (error) {
        console.error('[GET /api/production/rooms/:roomId/machine-assignments] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// POST /api/production/machine-assignments - dodaj przypisanie maszyny
// ============================================
router.post('/machine-assignments', requireRole(['ADMIN', 'PRODUCTION_MANAGER']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { workStationId, productId, roomId, capacity } = req.body;

    try {
        const { data, error } = await supabase
            .from('MachineAssignment')
            .insert({
                workStationId,
                productId,
                roomId,
                capacity,
                isActive: true,
                createdAt: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;

        return res.json({
            status: 'success',
            message: 'Przypisanie zostało dodane',
            data
        });
    } catch (error) {
        console.error('[POST /api/production/machine-assignments] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// DELETE /api/production/machine-assignments/:workStationId/:productId - usuń przypisanie
// ============================================
router.delete('/machine-assignments/:workStationId/:productId', requireRole(['ADMIN', 'PRODUCTION_MANAGER']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { workStationId, productId } = req.params;

    try {
        const { error } = await supabase
            .from('MachineAssignment')
            .update({ 
                isActive: false,
                updatedAt: new Date().toISOString()
            })
            .eq('workStationId', workStationId)
            .eq('productId', productId);

        if (error) throw error;

        return res.json({
            status: 'success',
            message: 'Przypisanie zostało usunięte'
        });
    } catch (error) {
        console.error('[DELETE /api/production/machine-assignments] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

module.exports = router;
