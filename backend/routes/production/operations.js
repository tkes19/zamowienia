/**
 * Router operacji produkcyjnych
 */

const express = require('express');
const { requireRole, parseCookies } = require('../../modules/auth');
const { broadcastEvent } = require('../../modules/sse');
const { 
  emitOperationStarted, 
  emitOperationPaused, 
  emitOperationCompleted 
} = require('../../modules/sse/productionEvents');
const { updateWorkOrderStatusFromOperations } = require('../../services/productionService');

const router = express.Router();

/**
 * POST /api/production/operations/:id/start
 * Rozpoczęcie operacji produkcyjnej
 */
router.post('/operations/:id/start', requireRole(['ADMIN', 'PRODUCTION', 'OPERATOR']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { id: operationId } = req.params;
    const cookies = req.headers.cookie ? parseCookies(req) : {};
    const userId = cookies.auth_id;
    
    if (!supabase) {
        return res.status(500).json({ 
            status: 'error', 
            message: 'Supabase nie jest skonfigurowany' 
        });
    }

    try {
        // Sprawdź czy operacja istnieje i można ją rozpocząć
        const { data: operation, error: fetchError } = await supabase
            .from('ProductionOperation')
            .select('id, status, productionorderid')
            .eq('id', operationId)
            .single();

        if (fetchError || !operation) {
            return res.status(404).json({
                status: 'error',
                message: 'Operacja nie została znaleziona'
            });
        }

        if (operation.status !== 'pending') {
            return res.status(400).json({
                status: 'error',
                message: `Operacja ma status ${operation.status} - można rozpocząć tylko operacje w statusie 'pending'`
            });
        }

        const now = new Date().toISOString();

        // Aktualizuj status operacji
        const { data: updatedOperation, error: updateError } = await supabase
            .from('ProductionOperation')
            .update({ 
                status: 'active',
                operatorid: userId,
                starttime: now,
                updatedat: now
            })
            .eq('id', operationId)
            .select('*')
            .single();

        if (updateError) {
            console.error(`[POST /api/production/operations/${operationId}/start] Update error:`, updateError);
            return res.status(500).json({
                status: 'error',
                message: 'Błąd aktualizacji operacji'
            });
        }

        // Zaktualizuj status zlecenia na in_progress jeśli trzeba
        const { data: prodOrder } = await supabase
            .from('ProductionOrder')
            .select('id, status')
            .eq('id', operation.productionorderid)
            .single();

        if (prodOrder && prodOrder.status !== 'in_progress') {
            await supabase
                .from('ProductionOrder')
                .update({ 
                    status: 'in_progress', 
                    actualstartdate: now,
                    updatedat: now
                })
                .eq('id', operation.productionorderid);
        }

        // Zapisz w logu
        const { error: logError } = await supabase
            .from('ProductionLog')
            .insert({
                productionOrderId: operation.productionorderid,
                action: 'operation_started',
                previousStatus: operation.status,
                newStatus: 'active',
                userId,
                notes: `Operacja #${operationId} rozpoczęta`
            });

        if (logError) {
            console.error(`[POST /api/production/operations/${operationId}/start] Log error:`, logError);
        }

        // Pobierz workOrderId i roomId dla SSE
        const { data: prodOrderData } = await supabase
            .from('ProductionOrder')
            .select('workOrderId, workOrder:ProductionWorkOrder!ProductionOrder_workOrderId_fkey(roomId)')
            .eq('id', operation.productionorderid)
            .single();

        const workOrderId = prodOrderData?.workOrderId;
        const roomId = prodOrderData?.workOrder?.roomId;

        // Broadcast zdarzenia (legacy)
        broadcastEvent({
            type: 'operationStarted',
            operationId,
            productionOrderId: operation.productionorderid,
            userId,
            timestamp: now
        });

        // Emit SSE event (nowy system)
        emitOperationStarted(operationId, operation.productionorderid, workOrderId, roomId, {
            userId,
            status: 'active'
        });

        res.json({
            status: 'success',
            message: 'Operacja została rozpoczęta',
            data: updatedOperation
        });

    } catch (error) {
        console.error(`[POST /api/production/operations/${operationId}/start] Exception:`, error);
        res.status(500).json({
            status: 'error',
            message: 'Błąd serwera'
        });
    }
});

/**
 * POST /api/production/operations/:id/complete
 * Zakończenie operacji produkcyjnej
 */
router.post('/operations/:id/complete', requireRole(['ADMIN', 'PRODUCTION', 'OPERATOR']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { id: operationId } = req.params;
    const { quantity, notes } = req.body || {};
    const cookies = req.headers.cookie ? parseCookies(req) : {};
    const userId = cookies.auth_id;
    
    if (!supabase) {
        return res.status(500).json({ 
            status: 'error', 
            message: 'Supabase nie jest skonfigurowany' 
        });
    }

    if (!quantity || quantity <= 0) {
        return res.status(400).json({
            status: 'error',
            message: 'Ilość wyprodukowana jest wymagana i musi być większa od 0'
        });
    }

    try {
        // Sprawdź operację
        const { data: operation, error: fetchError } = await supabase
            .from('ProductionOperation')
            .select('id, status, productionorderid, starttime, actualtime')
            .eq('id', operationId)
            .single();

        if (fetchError || !operation) {
            return res.status(404).json({
                status: 'error',
                message: 'Operacja nie została znaleziona'
            });
        }

        if (operation.status !== 'active' && operation.status !== 'paused') {
            return res.status(400).json({
                status: 'error',
                message: `Operacja ma status ${operation.status} - można zakończyć tylko aktywne lub wstrzymane operacje`
            });
        }

        const now = new Date().toISOString();
        
        // Oblicz całkowity czas
        let actualTime = operation.actualtime || 0;
        if (operation.status === 'active' && operation.starttime) {
            const opStartTime = new Date(operation.starttime);
            const nowDate = new Date();
            actualTime += Math.round((nowDate - opStartTime) / 60000); // minuty
        }

        // Aktualizuj operację
        const { data: updatedOperation, error: updateError } = await supabase
            .from('ProductionOperation')
            .update({ 
                status: 'completed',
                endtime: now,
                actualtime: actualTime,
                outputquantity: quantity || 0,
                updatedat: now
            })
            .eq('id', operationId)
            .select('*')
            .single();

        if (updateError) {
            console.error(`[POST /api/production/operations/${operationId}/complete] Update error:`, updateError);
            return res.status(500).json({
                status: 'error',
                message: 'Błąd aktualizacji operacji'
            });
        }

        // Zapisz w logu
        const { error: logError } = await supabase
            .from('ProductionLog')
            .insert({
                productionOrderId: operation.productionorderid,
                action: 'operation_completed',
                previousStatus: operation.status,
                newStatus: 'completed',
                userId,
                notes: `Operacja #${operationId} zakończona - ilość: ${quantity}`
            });

        if (logError) {
            console.error(`[POST /api/production/operations/${operationId}/complete] Log error:`, logError);
        }

        // Pobierz workOrderId i roomId dla SSE
        const { data: prodOrderData } = await supabase
            .from('ProductionOrder')
            .select('workOrderId, workOrder:ProductionWorkOrder!ProductionOrder_workOrderId_fkey(roomId)')
            .eq('id', operation.productionorderid)
            .single();

        const workOrderId = prodOrderData?.workOrderId;
        const roomId = prodOrderData?.workOrder?.roomId;

        // Broadcast zdarzenia (legacy)
        broadcastEvent({
            type: 'operationCompleted',
            operationId,
            productionOrderId: operation.productionorderid,
            quantity,
            userId,
            timestamp: now
        });

        // Emit SSE event (nowy system)
        emitOperationCompleted(operationId, operation.productionorderid, workOrderId, roomId, {
            userId,
            quantity,
            actualTime,
            status: 'completed'
        });

        // Zaktualizuj status work order na podstawie operacji
        if (workOrderId) {
            await updateWorkOrderStatusFromOperations(supabase, workOrderId, true);
        }

        res.json({
            status: 'success',
            message: 'Operacja została zakończona',
            data: updatedOperation
        });

    } catch (error) {
        console.error(`[POST /api/production/operations/${operationId}/complete] Exception:`, error);
        res.status(500).json({
            status: 'error',
            message: 'Błąd serwera'
        });
    }
});

/**
 * POST /api/production/operations/:id/pause
 * Wstrzymanie operacji produkcyjnej
 */
router.post('/operations/:id/pause', requireRole(['ADMIN', 'PRODUCTION', 'OPERATOR']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { id: operationId } = req.params;
    const { reason } = req.body || {};
    const cookies = req.headers.cookie ? parseCookies(req) : {};
    const userId = cookies.auth_id;
    
    if (!supabase) {
        return res.status(500).json({ 
            status: 'error', 
            message: 'Supabase nie jest skonfigurowany' 
        });
    }

    try {
        // Sprawdź operację
        const { data: operation, error: fetchError } = await supabase
            .from('ProductionOperation')
            .select('id, status, productionorderid, starttime, actualtime')
            .eq('id', operationId)
            .single();

        if (fetchError || !operation) {
            return res.status(404).json({
                status: 'error',
                message: 'Operacja nie została znaleziona'
            });
        }

        if (operation.status !== 'active') {
            return res.status(400).json({
                status: 'error',
                message: `Operacja ma status ${operation.status} - można wstrzymać tylko aktywne operacje`
            });
        }

        const now = new Date().toISOString();

        // Oblicz dotychczasowy czas
        let actualTime = operation.actualtime || 0;
        if (operation.starttime) {
            const startTime = new Date(operation.starttime);
            const nowDate = new Date();
            actualTime += Math.round((nowDate - startTime) / 60000); // minuty
        }

        // Aktualizuj status
        const { data: updatedOperation, error: updateError } = await supabase
            .from('ProductionOperation')
            .update({ 
                status: 'paused',
                actualtime: actualTime,
                updatedat: now
            })
            .eq('id', operationId)
            .select('*')
            .single();

        if (updateError) {
            console.error(`[POST /api/production/operations/${operationId}/pause] Update error:`, updateError);
            return res.status(500).json({
                status: 'error',
                message: 'Błąd aktualizacji operacji'
            });
        }

        // Zapisz w logu
        const { error: logError } = await supabase
            .from('ProductionLog')
            .insert({
                productionOrderId: operation.productionorderid,
                action: 'operation_paused',
                previousStatus: operation.status,
                newStatus: 'paused',
                userId,
                notes: reason ? `Operacja #${operationId} wstrzymana - powód: ${reason}` : `Operacja #${operationId} wstrzymana`
            });

        if (logError) {
            console.error(`[POST /api/production/operations/${operationId}/pause] Log error:`, logError);
        }

        // Pobierz workOrderId i roomId dla SSE
        const { data: prodOrderData } = await supabase
            .from('ProductionOrder')
            .select('workOrderId, workOrder:ProductionWorkOrder!ProductionOrder_workOrderId_fkey(roomId)')
            .eq('id', operation.productionorderid)
            .single();

        const workOrderId = prodOrderData?.workOrderId;
        const roomId = prodOrderData?.workOrder?.roomId;

        // Broadcast zdarzenia (legacy)
        broadcastEvent({
            type: 'operationPaused',
            operationId,
            productionOrderId: operation.productionorderid,
            reason,
            userId,
            timestamp: now
        });

        // Emit SSE event (nowy system)
        emitOperationPaused(operationId, operation.productionorderid, workOrderId, roomId, {
            userId,
            reason,
            actualTime,
            status: 'paused'
        });

        res.json({
            status: 'success',
            message: 'Operacja została wstrzymana',
            data: updatedOperation
        });

    } catch (error) {
        console.error(`[POST /api/production/operations/${operationId}/pause] Exception:`, error);
        res.status(500).json({
            status: 'error',
            message: 'Błąd serwera'
        });
    }
});

module.exports = router;
