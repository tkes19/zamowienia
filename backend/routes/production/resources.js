/**
 * Router zasobów produkcyjnych (pokoje, centra pracy, stacje robocze)
 */

const express = require('express');
const { requireRole } = require('../../modules/auth');

const router = express.Router();

/**
 * GET /api/production/rooms
 * Lista pokojów produkcyjnych
 */
router.get('/rooms', requireRole(['ADMIN', 'PRODUCTION', 'PRODUCTION_MANAGER', 'OPERATOR', 'SALES_DEPT']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    
    if (!supabase) {
        return res.status(500).json({ 
            status: 'error', 
            message: 'Supabase nie jest skonfigurowany' 
        });
    }

    try {
        const { data: rooms, error } = await supabase
            .from('ProductionRoom')
            .select('id, name, code, "isActive", "roomManagerUserId"')
            .eq('isActive', true)
            .order('name');

        if (error) {
            console.error('[GET /api/production/rooms] Error:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Błąd pobierania pokojów'
            });
        }

        res.json({
            status: 'success',
            data: rooms || []
        });

    } catch (error) {
        console.error('[GET /api/production/rooms] Exception:', error);
        res.status(500).json({
            status: 'error',
            message: 'Błąd serwera'
        });
    }
});

/**
 * GET /api/production/work-centers
 * Lista centrów pracy
 */
router.get('/work-centers', requireRole(['ADMIN', 'PRODUCTION', 'SALES_DEPT']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    
    if (!supabase) {
        return res.status(500).json({ 
            status: 'error', 
            message: 'Supabase nie jest skonfigurowany' 
        });
    }

    try {
        const { roomId } = req.query;

        let query = supabase
            .from('WorkCenter')
            .select('*')
            .eq('isActive', true)
            .order('name');

        if (roomId) {
            query = query.eq('roomId', roomId);
        }

        const { data: workCenters, error } = await query;

        if (error) {
            console.error('[GET /api/production/work-centers] Error:', error);
            return res.status(500).json({ 
                status: 'error', 
                message: 'Błąd pobierania centrów pracy' 
            });
        }

        return res.json({ status: 'success', data: workCenters || [] });
    } catch (error) {
        console.error('[GET /api/production/work-centers] Exception:', error);
        return res.status(500).json({ 
            status: 'error', 
            message: 'Błąd serwera' 
        });
    }
});

/**
 * GET /api/production/work-stations
 * Lista stacji roboczych
 */
router.get('/work-stations', requireRole(['ADMIN', 'PRODUCTION', 'SALES_DEPT']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    
    if (!supabase) {
        return res.status(500).json({ 
            status: 'error', 
            message: 'Supabase nie jest skonfigurowany' 
        });
    }

    try {
        const { workCenterId, status } = req.query;

        let query = supabase
            .from('WorkStation')
            .select('*')
            .eq('isActive', true)
            .order('name');

        if (workCenterId) {
            query = query.eq('workCenterId', workCenterId);
        }
        if (status) {
            query = query.eq('status', status);
        }

        const { data: workStations, error } = await query;

        if (error) {
            console.error('[GET /api/production/work-stations] Error:', error);
            return res.status(500).json({ 
                status: 'error', 
                message: 'Błąd pobierania stacji roboczych' 
            });
        }

        res.json({
            status: 'success',
            data: workStations || []
        });

    } catch (error) {
        console.error('[GET /api/production/work-stations] Exception:', error);
        res.status(500).json({
            status: 'error',
            message: 'Błąd serwera'
        });
    }
});

/**
 * PATCH /api/production/workstations/:id/restriction
 * Aktualizuje restrykcje stacji roboczej
 */
router.patch('/workstations/:id/restriction', requireRole(['ADMIN', 'PRODUCTION_MANAGER']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const tag = '[PATCH /api/production/workstations/:id/restriction]';
    const { userId, role } = req.user;
    const workStationId = parseInt(req.params.id);
    const { restrictToAssignedProducts } = req.body;

    try {
        if (typeof restrictToAssignedProducts !== 'boolean') {
            return res.status(400).json({ status: 'error', message: 'Wymagane: restrictToAssignedProducts (boolean)' });
        }

        // Znajdź pokój maszyny i sprawdź uprawnienia
        const { data: machine } = await supabase
            .from('WorkStation')
            .select(`
                id,
                "WorkCenter"!inner(id, "roomId")
            `)
            .eq('id', workStationId)
            .single();

        if (!machine) {
            return res.status(404).json({ status: 'error', message: 'Maszyna nie znaleziona' });
        }

        const roomId = machine.WorkCenter?.roomId;
        
        // Sprawdź uprawnienia do zarządzania pokojem
        const { data: roomAccess } = await supabase
            .from('UserProductionRoom')
            .select('id')
            .eq('userId', userId)
            .eq('roomId', roomId)
            .single();

        const canManage = role === 'ADMIN' || role === 'PRODUCTION_MANAGER' || roomAccess;
        
        if (!canManage) {
            return res.status(403).json({ status: 'error', message: 'Brak uprawnień do zarządzania restrykcjami w tym pokoju' });
        }

        // Zaktualizuj flagę
        const { data: updated, error: updateError } = await supabase
            .from('WorkStation')
            .update({ 
                restrictToAssignedProducts,
                updatedAt: new Date().toISOString()
            })
            .eq('id', workStationId)
            .select('id, name, "restrictToAssignedProducts"')
            .single();

        if (updateError) {
            console.error(`${tag} Błąd aktualizacji:`, updateError);
            return res.status(500).json({ status: 'error', message: 'Błąd aktualizacji' });
        }

        console.log(`${tag} Zaktualizowano restrykcje dla stacji ${workStationId}: restrictToAssignedProducts=${restrictToAssignedProducts}`);

        return res.json({
            status: 'success',
            message: 'Restrykcje zaktualizowane',
            data: updated
        });

    } catch (error) {
        console.error(`${tag} Wyjątek:`, error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

module.exports = router;
