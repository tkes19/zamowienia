/**
 * Moduł zarządzania stanami maszyn
 * Endpointy: GET/POST /api/production/machines/status
 */

const express = require('express');
const router = express.Router();
const { requireRole } = require('../../modules/auth');

// ============================================
// GET /api/production/machines/status
// Pobierz aktualne stany wszystkich maszyn
// ============================================
router.get('/status', requireRole(['ADMIN', 'PRODUCTION_MANAGER', 'OPERATOR']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    
    try {
        const { roomId, status } = req.query;
        
        // Użyj widoku CurrentMachineStatus
        let query = supabase
            .from('CurrentMachineStatus')
            .select('*');
        
        if (roomId) {
            query = query.eq('roomId', roomId);
        }
        
        if (status) {
            query = query.eq('status', status);
        }
        
        const { data, error } = await query.order('roomName');
        
        if (error) throw error;
        
        res.json({
            success: true,
            data: data || [],
            count: data?.length || 0
        });
        
    } catch (error) {
        console.error('Błąd pobierania stanów maszyn:', error);
        res.status(500).json({
            success: false,
            error: 'Błąd pobierania stanów maszyn',
            details: error.message
        });
    }
});

// ============================================
// GET /api/production/machines/:workStationId/status
// Pobierz historię stanów konkretnej maszyny
// ============================================
router.get('/:workStationId/status', requireRole(['ADMIN', 'PRODUCTION_MANAGER', 'OPERATOR']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { workStationId } = req.params;
    const { limit = 10 } = req.query;
    
    try {
        const { data, error } = await supabase
            .from('MachineStatus')
            .select(`
                *,
                updatedByUser:User!updatedBy(id, name, email)
            `)
            .eq('workStationId', workStationId)
            .order('lastUpdate', { ascending: false })
            .limit(parseInt(limit));
        
        if (error) throw error;
        
        res.json({
            success: true,
            data: data || [],
            workStationId
        });
        
    } catch (error) {
        console.error('Błąd pobierania historii maszyny:', error);
        res.status(500).json({
            success: false,
            error: 'Błąd pobierania historii maszyny',
            details: error.message
        });
    }
});

// ============================================
// POST /api/production/machines/:workStationId/status
// Aktualizuj stan maszyny (zgłoś awarię, konserwację itp.)
// ============================================
router.post('/:workStationId/status', requireRole(['ADMIN', 'PRODUCTION_MANAGER', 'OPERATOR']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { workStationId } = req.params;
    const { status, statusReason, notes } = req.body;
    const userId = req.user?.id;
    
    // Walidacja
    const validStatuses = ['ok', 'warning', 'down', 'maintenance'];
    if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({
            success: false,
            error: `Nieprawidłowy status. Dozwolone: ${validStatuses.join(', ')}`
        });
    }
    
    try {
        // Sprawdź czy maszyna istnieje
        const { data: workStation, error: wsError } = await supabase
            .from('WorkStation')
            .select('id, name, code')
            .eq('id', workStationId)
            .single();
        
        if (wsError || !workStation) {
            return res.status(404).json({
                success: false,
                error: 'Maszyna nie znaleziona'
            });
        }
        
        // Dodaj nowy wpis statusu
        const { data: newStatus, error: insertError } = await supabase
            .from('MachineStatus')
            .insert({
                workStationId: parseInt(workStationId),
                status,
                statusReason: statusReason || null,
                notes: notes || null,
                updatedBy: userId,
                lastUpdate: new Date().toISOString()
            })
            .select()
            .single();
        
        if (insertError) throw insertError;
        
        // Aktualizuj status w tabeli WorkStation
        const { error: updateError } = await supabase
            .from('WorkStation')
            .update({ 
                status: status === 'ok' ? 'available' : 
                        status === 'down' ? 'breakdown' : 
                        status === 'maintenance' ? 'maintenance' : 'available'
            })
            .eq('id', workStationId);
        
        if (updateError) {
            console.warn('Nie udało się zaktualizować statusu WorkStation:', updateError);
        }
        
        // Emituj zdarzenie SSE
        const sseModule = req.app.locals.sse;
        if (sseModule) {
            sseModule.broadcastEvent({
                type: 'machine_status_changed',
                data: {
                    machineId: workStationId,
                    machineName: workStation.name,
                    machineCode: workStation.code,
                    newStatus: status,
                    statusReason,
                    timestamp: new Date().toISOString(),
                    updatedBy: userId
                }
            });
        }
        
        res.json({
            success: true,
            data: newStatus,
            message: `Status maszyny ${workStation.name} zmieniony na: ${status}`
        });
        
    } catch (error) {
        console.error('Błąd aktualizacji statusu maszyny:', error);
        res.status(500).json({
            success: false,
            error: 'Błąd aktualizacji statusu maszyny',
            details: error.message
        });
    }
});

// ============================================
// GET /api/production/machines/down
// Pobierz listę maszyn w awarii wraz z zablokowanymi ZP
// ============================================
router.get('/down', requireRole(['ADMIN', 'PRODUCTION_MANAGER']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    
    try {
        // Pobierz maszyny w awarii
        const { data: downMachines, error: machineError } = await supabase
            .from('CurrentMachineStatus')
            .select('*')
            .eq('status', 'down');
        
        if (machineError) throw machineError;
        
        // Dla każdej maszyny znajdź zablokowane operacje
        const machinesWithBlockedOps = await Promise.all(
            (downMachines || []).map(async (machine) => {
                const { data: blockedOps, error: opsError } = await supabase
                    .from('ProductionOperation')
                    .select(`
                        id,
                        status,
                        ProductionOrder!inner(
                            id,
                            orderNumber,
                            status
                        )
                    `)
                    .eq('workCenterId', machine.workCenterId)
                    .in('status', ['pending', 'active', 'paused']);
                
                return {
                    ...machine,
                    blockedOperations: blockedOps || [],
                    blockedCount: blockedOps?.length || 0
                };
            })
        );
        
        res.json({
            success: true,
            data: machinesWithBlockedOps,
            totalDown: machinesWithBlockedOps.length,
            totalBlocked: machinesWithBlockedOps.reduce((sum, m) => sum + m.blockedCount, 0)
        });
        
    } catch (error) {
        console.error('Błąd pobierania maszyn w awarii:', error);
        res.status(500).json({
            success: false,
            error: 'Błąd pobierania maszyn w awarii',
            details: error.message
        });
    }
});

module.exports = router;
