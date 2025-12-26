/**
 * Router dla endpointów użytkownika
 * Endpointy dla zwykłych użytkowników do sprawdzania swoich uprawnień
 */

const express = require('express');
const { requireRole } = require('../modules/auth');
const { getAuthContext } = require('../modules/auth');

const router = express.Router();

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
// Dostęp do folderów użytkownika
// ============================================

router.get('/user-folder-access', async (req, res) => {
    const supabase = req.app.locals.supabase;
    
    try {
        const { userId } = await getAuthContext(req);
        
        if (!userId) {
            return res.status(401).json({ status: 'error', message: 'Brak autoryzacji' });
        }

        const { data, error } = await supabase
            .from('UserFolderAccess')
            .select('*')
            .eq('userId', userId)
            .order('createdAt', { ascending: false });

        if (error) throw error;

        return res.json({ status: 'success', data });
    } catch (err) {
        console.error('Błąd pobierania dostępu do folderów:', err);
        return res.status(500).json({ 
            status: 'error', 
            message: 'Nie udało się pobrać dostępu do folderów', 
            details: err.message 
        });
    }
});

// ============================================
// Przydziały pokoi produkcyjnych
// ============================================

router.get('/user-production-rooms', async (req, res) => {
    const supabase = req.app.locals.supabase;
    
    try {
        const { userId } = await getAuthContext(req);
        
        if (!userId) {
            return res.status(401).json({ status: 'error', message: 'Brak autoryzacji' });
        }

        const { data, error } = await supabase
            .from('UserProductionRoom')
            .select(`
                *,
                ProductionRoom:roomId (id, name, roomId)
            `)
            .eq('userId', userId)
            .eq('isActive', true)
            .order('createdAt', { ascending: false });

        if (error) throw error;

        return res.json({ status: 'success', data });
    } catch (err) {
        console.error('Błąd pobierania przydziałów pokoi:', err);
        return res.status(500).json({ 
            status: 'error', 
            message: 'Nie udało się pobrać przydziałów', 
            details: err.message 
        });
    }
});

// ============================================
// Dostęp do miast
// ============================================

router.get('/user-city-access', async (req, res) => {
    const supabase = req.app.locals.supabase;
    
    try {
        const { userId } = await getAuthContext(req);
        
        if (!userId) {
            return res.status(401).json({ status: 'error', message: 'Brak autoryzacji' });
        }

        const { data, error } = await supabase
            .from('UserCityAccess')
            .select('*')
            .eq('userId', userId)
            .order('createdAt', { ascending: false });

        if (error) throw error;

        return res.json({ status: 'success', data });
    } catch (err) {
        console.error('Błąd pobierania dostępu do miast:', err);
        return res.status(500).json({ 
            status: 'error', 
            message: 'Nie udało się pobrać dostępu do miast', 
            details: err.message 
        });
    }
});

// ============================================
// GET /api/user - dane zalogowanego użytkownika (alias dla /me)
// ============================================

router.get('/user', async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { getAuthContext } = require('../modules/auth');

    try {
        const { userId, role } = await getAuthContext(req);
        
        if (!userId || !role) {
            return res.status(401).json({ status: 'error', message: 'Brak autoryzacji' });
        }

        const { data, error } = await supabase
            .from('User')
            .select(`
                id,
                name,
                email,
                role,
                departmentId,
                productionRoomId,
                isActive,
                Department:departmentId (id, name),
                ProductionRoom:productionRoomId (id, name)
            `)
            .eq('id', userId)
            .single();

        if (error) throw error;

        return res.json({ status: 'success', data });
    } catch (err) {
        console.error('Błąd pobierania danych użytkownika:', err);
        return res.status(500).json({ 
            status: 'error', 
            message: 'Nie udało się pobrać danych użytkownika', 
            details: err.message 
        });
    }
});

// ============================================
// GET /api/users - lista użytkowników (dla autoryzowanych)
// ============================================

router.get('/users', async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { getAuthContext } = require('../modules/auth');

    try {
        const { userId, role } = await getAuthContext(req);
        
        if (!userId || !role) {
            return res.status(401).json({ status: 'error', message: 'Brak autoryzacji' });
        }

        if (!['ADMIN', 'SALES_DEPT', 'GRAPHICS', 'GRAPHIC_DESIGNER'].includes(role)) {
            return res.status(403).json({ status: 'error', message: 'Brak uprawnień' });
        }

        const { data, error } = await supabase
            .from('User')
            .select(`
                id,
                name,
                email,
                role,
                departmentId,
                productionRoomId,
                isActive,
                Department:departmentId (id, name),
                ProductionRoom:productionRoomId (id, name)
            `)
            .eq('isActive', true)
            .order('name', { ascending: true });

        if (error) throw error;

        return res.json({ status: 'success', data: data || [] });
    } catch (err) {
        console.error('Błąd pobierania listy użytkowników:', err);
        return res.status(500).json({ 
            status: 'error', 
            message: 'Nie udało się pobrać listy użytkowników', 
            details: err.message 
        });
    }
});

module.exports = router;
