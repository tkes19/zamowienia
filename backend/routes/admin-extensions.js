/**
 * Rozszerzenia routera admin - dodatkowe endpointy
 * Foldery KI, Pokoje produkcyjne, Miejscowości PM
 */

const express = require('express');
const { requireRole } = require('../modules/auth');

const router = express.Router();

// Helper: logowanie audytu zmian w UserFolderAccess
async function logFolderAccessChange(supabase, actorId, targetUserId, action, folderName, userFolderAccessId = null, oldValue = null, newValue = null) {
    if (!supabase) return;
    try {
        await supabase.from('UserFolderAccessLog').insert({
            userFolderAccessId,
            targetUserId,
            actorId,
            action,
            folderName,
            oldValue: oldValue ? JSON.stringify(oldValue) : null,
            newValue: newValue ? JSON.stringify(newValue) : null,
            createdAt: new Date().toISOString()
        });
    } catch (err) {
        console.error('Błąd logowania audytu UserFolderAccess:', err);
    }
}

// Helper: logowanie audytu zmian w UserCityAccess
async function logCityAccessChange(supabase, actorId, targetUserId, action, cityName, userCityAccessId = null, oldValue = null, newValue = null) {
    if (!supabase) return;
    try {
        await supabase.from('UserCityAccessLog').insert({
            userCityAccessId,
            targetUserId,
            actorId,
            action,
            cityName,
            oldValue: oldValue ? JSON.stringify(oldValue) : null,
            newValue: newValue ? JSON.stringify(newValue) : null,
            createdAt: new Date().toISOString()
        });
    } catch (err) {
        console.error('Błąd logowania audytu UserCityAccess:', err);
    }
}

// ============================================
// Przypisania folderów KI (User Folder Access)
// ============================================

// Lista wszystkich przypisań folderów
router.get('/user-folder-access', requireRole(['ADMIN', 'SALES_DEPT']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { userId } = req.query;

    try {
        let query = supabase
            .from('UserFolderAccess')
            .select(`
                id,
                userId,
                folderName,
                isActive,
                assignedBy,
                notes,
                createdAt,
                updatedAt,
                user:User!UserFolderAccess_userId_fkey(id, name, email, role),
                assignedByUser:User!UserFolderAccess_assignedBy_fkey(id, name, email)
            `)
            .order('createdAt', { ascending: false });

        if (userId) {
            query = query.eq('userId', userId);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Błąd pobierania przypisań folderów:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się pobrać przypisań', details: error.message });
        }

        return res.json({
            status: 'success',
            data: data || [],
            count: data?.length || 0
        });
    } catch (err) {
        console.error('Wyjątek w GET /api/admin/user-folder-access:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
    }
});

// Tworzenie nowego przypisania folderu
router.post('/user-folder-access', requireRole(['ADMIN', 'SALES_DEPT']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { id: assignedById } = req.user;
    const { userId, folderName, notes } = req.body || {};

    if (!userId || !folderName?.trim()) {
        return res.status(400).json({ status: 'error', message: 'userId i folderName są wymagane' });
    }

    try {
        const { data: userExists, error: userError } = await supabase
            .from('User')
            .select('id')
            .eq('id', userId)
            .single();

        if (userError || !userExists) {
            return res.status(404).json({ status: 'error', message: 'Użytkownik nie istnieje' });
        }

        const { data: existing } = await supabase
            .from('UserFolderAccess')
            .select('id, isActive, folderName, notes')
            .eq('userId', userId)
            .eq('folderName', folderName.trim())
            .single();

        if (existing) {
            if (!existing.isActive) {
                const oldValue = { isActive: false, folderName: existing.folderName, notes: existing.notes };
                
                const { data: reactivated, error: reactivateError } = await supabase
                    .from('UserFolderAccess')
                    .update({ isActive: true, assignedBy: assignedById, updatedAt: new Date().toISOString() })
                    .eq('id', existing.id)
                    .select()
                    .single();

                if (reactivateError) {
                    return res.status(500).json({ status: 'error', message: 'Nie udało się reaktywować przypisania', details: reactivateError.message });
                }

                await logFolderAccessChange(supabase, assignedById, userId, 'REACTIVATE', folderName.trim(), existing.id, oldValue, { isActive: true });

                return res.json({ status: 'success', data: reactivated, message: 'Przypisanie reaktywowane' });
            }
            return res.status(409).json({ status: 'error', message: 'Przypisanie już istnieje' });
        }

        const { data, error } = await supabase
            .from('UserFolderAccess')
            .insert({
                userId,
                folderName: folderName.trim(),
                isActive: true,
                assignedBy: assignedById,
                notes: notes?.trim() || null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            })
            .select()
            .single();

        if (error) {
            console.error('Błąd tworzenia przypisania:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się utworzyć przypisania', details: error.message });
        }

        await logFolderAccessChange(supabase, assignedById, userId, 'CREATE', folderName.trim(), data.id, null, { isActive: true, folderName: folderName.trim(), notes: notes?.trim() || null });

        return res.status(201).json({ status: 'success', data, message: 'Przypisanie utworzone' });
    } catch (err) {
        console.error('Wyjątek w POST /api/admin/user-folder-access:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
    }
});

// Aktualizacja przypisania folderu
router.patch('/user-folder-access/:id', requireRole(['ADMIN', 'SALES_DEPT']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { role, id: actorId } = req.user;
    const { id } = req.params;
    const { folderName, isActive, notes } = req.body || {};

    try {
        const { data: currentData } = await supabase
            .from('UserFolderAccess')
            .select('userId, folderName, isActive, notes')
            .eq('id', id)
            .single();

        if (!currentData) {
            return res.status(404).json({ status: 'error', message: 'Przypisanie nie znalezione' });
        }

        const oldValue = { folderName: currentData.folderName, isActive: currentData.isActive, notes: currentData.notes };
        const updateData = { updatedAt: new Date().toISOString() };

        if (role === 'SALES_DEPT') {
            if (isActive !== undefined) updateData.isActive = isActive;
            if (notes !== undefined) updateData.notes = notes?.trim() || null;
        } else {
            if (folderName !== undefined) updateData.folderName = folderName.trim();
            if (isActive !== undefined) updateData.isActive = isActive;
            if (notes !== undefined) updateData.notes = notes?.trim() || null;
        }

        const { data, error } = await supabase
            .from('UserFolderAccess')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Błąd aktualizacji przypisania:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się zaktualizować przypisania', details: error.message });
        }

        let action = 'UPDATE';
        if (isActive !== undefined && oldValue.isActive !== isActive) {
            action = isActive ? 'REACTIVATE' : 'DEACTIVATE';
        }

        const newValue = { folderName: data.folderName, isActive: data.isActive, notes: data.notes };
        await logFolderAccessChange(supabase, actorId, currentData.userId, action, data.folderName, parseInt(id), oldValue, newValue);

        return res.json({ status: 'success', data, message: 'Przypisanie zaktualizowane' });
    } catch (err) {
        console.error('Wyjątek w PATCH /api/admin/user-folder-access/:id:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
    }
});

// Usunięcie przypisania folderu
router.delete('/user-folder-access/:id', requireRole(['ADMIN', 'SALES_DEPT']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { id: actorId } = req.user;
    const { id } = req.params;

    try {
        const { data: toDelete } = await supabase
            .from('UserFolderAccess')
            .select('userId, folderName, isActive, notes')
            .eq('id', id)
            .single();

        if (!toDelete) {
            return res.status(404).json({ status: 'error', message: 'Przypisanie nie znalezione' });
        }

        const { error } = await supabase
            .from('UserFolderAccess')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Błąd usuwania przypisania:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się usunąć przypisania', details: error.message });
        }

        await logFolderAccessChange(supabase, actorId, toDelete.userId, 'DELETE', toDelete.folderName, parseInt(id), 
            { folderName: toDelete.folderName, isActive: toDelete.isActive, notes: toDelete.notes }, null);

        return res.json({ status: 'success', message: 'Przypisanie usunięte' });
    } catch (err) {
        console.error('Wyjątek w DELETE /api/admin/user-folder-access/:id:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
    }
});

// ============================================
// Przypisania pokoi produkcyjnych (User Production Rooms)
// ============================================

// Lista przypisań pokoi produkcyjnych
router.get('/user-production-rooms', requireRole(['ADMIN', 'PRODUCTION_MANAGER']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { userId } = req.query;

    try {
        let query = supabase
            .from('UserProductionRoom')
            .select(`
                id,
                userId,
                roomId,
                isPrimary,
                notes,
                assignedBy,
                createdAt,
                user:User!UserProductionRoom_userId_fkey(id, name, email, role),
                room:ProductionRoom!UserProductionRoom_roomId_fkey(id, name, code),
                assignedByUser:User!UserProductionRoom_assignedBy_fkey(id, name, email)
            `)
            .order('createdAt', { ascending: false });

        if (userId) {
            query = query.eq('userId', userId);
        }

        const { data, error } = await query;

        if (error) {
            console.error('[GET /api/admin/user-production-rooms] Błąd:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się pobrać przypisań', details: error.message });
        }

        return res.json({
            status: 'success',
            data: data || [],
            count: data?.length || 0
        });
    } catch (err) {
        console.error('[GET /api/admin/user-production-rooms] Wyjątek:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
    }
});

// Tworzenie nowego przypisania pokoju
router.post('/user-production-rooms', requireRole(['ADMIN', 'PRODUCTION_MANAGER']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { id: assignedById } = req.user;
    const { userId, roomId, isPrimary, notes } = req.body || {};

    if (!userId || !roomId) {
        return res.status(400).json({ status: 'error', message: 'userId i roomId są wymagane' });
    }

    try {
        const { data: userExists } = await supabase
            .from('User')
            .select('id')
            .eq('id', userId)
            .single();

        if (!userExists) {
            return res.status(404).json({ status: 'error', message: 'Użytkownik nie istnieje' });
        }

        const { data: roomExists } = await supabase
            .from('ProductionRoom')
            .select('id')
            .eq('id', roomId)
            .single();

        if (!roomExists) {
            return res.status(404).json({ status: 'error', message: 'Pokój produkcyjny nie istnieje' });
        }

        const { data: existing } = await supabase
            .from('UserProductionRoom')
            .select('id')
            .eq('userId', userId)
            .eq('roomId', roomId)
            .single();

        if (existing) {
            return res.status(409).json({ status: 'error', message: 'Użytkownik jest już przypisany do tego pokoju' });
        }

        if (isPrimary === true) {
            await supabase
                .from('UserProductionRoom')
                .update({ isPrimary: false })
                .eq('userId', userId)
                .eq('isPrimary', true);
        }

        const { data, error } = await supabase
            .from('UserProductionRoom')
            .insert({
                userId,
                roomId,
                isPrimary: isPrimary === true,
                notes: notes?.trim() || null,
                assignedBy: assignedById,
                createdAt: new Date().toISOString()
            })
            .select(`
                id,
                userId,
                roomId,
                isPrimary,
                notes,
                createdAt,
                room:ProductionRoom!UserProductionRoom_roomId_fkey(id, name, code)
            `)
            .single();

        if (error) {
            console.error('[POST /api/admin/user-production-rooms] Błąd:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się utworzyć przypisania', details: error.message });
        }

        console.log(`[POST /api/admin/user-production-rooms] Admin ${assignedById} przypisał użytkownika ${userId} do pokoju ${roomId}`);

        return res.status(201).json({ status: 'success', data, message: 'Przypisanie utworzone' });
    } catch (err) {
        console.error('[POST /api/admin/user-production-rooms] Wyjątek:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
    }
});

// Aktualizacja przypisania pokoju
router.patch('/user-production-rooms/:id', requireRole(['ADMIN', 'PRODUCTION_MANAGER']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { id } = req.params;
    const { isPrimary, notes } = req.body || {};

    try {
        const { data: current } = await supabase
            .from('UserProductionRoom')
            .select('id, userId, roomId, isPrimary')
            .eq('id', id)
            .single();

        if (!current) {
            return res.status(404).json({ status: 'error', message: 'Przypisanie nie znalezione' });
        }

        const updateData = {};
        if (notes !== undefined) updateData.notes = notes?.trim() || null;

        if (isPrimary === true && !current.isPrimary) {
            await supabase
                .from('UserProductionRoom')
                .update({ isPrimary: false })
                .eq('userId', current.userId)
                .eq('isPrimary', true);
            updateData.isPrimary = true;
        } else if (isPrimary === false) {
            updateData.isPrimary = false;
        }

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ status: 'error', message: 'Brak danych do aktualizacji' });
        }

        const { data, error } = await supabase
            .from('UserProductionRoom')
            .update(updateData)
            .eq('id', id)
            .select(`
                id,
                userId,
                roomId,
                isPrimary,
                notes,
                createdAt,
                room:ProductionRoom!UserProductionRoom_roomId_fkey(id, name, code)
            `)
            .single();

        if (error) {
            console.error('[PATCH /api/admin/user-production-rooms/:id] Błąd:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się zaktualizować przypisania', details: error.message });
        }

        return res.json({ status: 'success', data, message: 'Przypisanie zaktualizowane' });
    } catch (err) {
        console.error('[PATCH /api/admin/user-production-rooms/:id] Wyjątek:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
    }
});

// Usunięcie przypisania pokoju
router.delete('/user-production-rooms/:id', requireRole(['ADMIN', 'PRODUCTION_MANAGER']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { id } = req.params;

    try {
        const { data: toDelete } = await supabase
            .from('UserProductionRoom')
            .select('id, userId, roomId')
            .eq('id', id)
            .single();

        if (!toDelete) {
            return res.status(404).json({ status: 'error', message: 'Przypisanie nie znalezione' });
        }

        const { error } = await supabase
            .from('UserProductionRoom')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('[DELETE /api/admin/user-production-rooms/:id] Błąd:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się usunąć przypisania', details: error.message });
        }

        console.log(`[DELETE /api/admin/user-production-rooms/:id] Usunięto przypisanie ${id} (user: ${toDelete.userId}, room: ${toDelete.roomId})`);

        return res.json({ status: 'success', message: 'Przypisanie usunięte' });
    } catch (err) {
        console.error('[DELETE /api/admin/user-production-rooms/:id] Wyjątek:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
    }
});

// ============================================
// Przypisania miejscowości PM (User City Access)
// ============================================

// Lista przypisań miejscowości
router.get('/user-city-access', requireRole(['ADMIN', 'SALES_DEPT', 'GRAPHICS', 'GRAPHIC_DESIGNER']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { userId } = req.query;

    try {
        let query = supabase
            .from('UserCityAccess')
            .select(`
                id,
                userId,
                cityName,
                isActive,
                assignedBy,
                notes,
                createdAt,
                updatedAt,
                user:User!UserCityAccess_userId_fkey(id, name, email, role),
                assignedByUser:User!UserCityAccess_assignedBy_fkey(id, name, email)
            `)
            .order('createdAt', { ascending: false });

        if (userId) {
            query = query.eq('userId', userId);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Błąd pobierania przypisań miejscowości:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się pobrać przypisań', details: error.message });
        }

        return res.json({
            status: 'success',
            data: data || [],
            count: data?.length || 0
        });
    } catch (err) {
        console.error('Wyjątek w GET /api/admin/user-city-access:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
    }
});

// Tworzenie nowego przypisania miejscowości
router.post('/user-city-access', requireRole(['ADMIN', 'SALES_DEPT', 'GRAPHICS', 'GRAPHIC_DESIGNER']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { id: assignedById } = req.user;
    const { userId, cityName, notes } = req.body || {};

    if (!userId || !cityName?.trim()) {
        return res.status(400).json({ status: 'error', message: 'userId i cityName są wymagane' });
    }

    try {
        const { data: userExists, error: userError } = await supabase
            .from('User')
            .select('id')
            .eq('id', userId)
            .single();

        if (userError || !userExists) {
            return res.status(404).json({ status: 'error', message: 'Użytkownik nie istnieje' });
        }

        const { data: existing } = await supabase
            .from('UserCityAccess')
            .select('id, isActive, cityName, notes')
            .eq('userId', userId)
            .eq('cityName', cityName.trim())
            .single();

        if (existing) {
            if (!existing.isActive) {
                const oldValue = { isActive: false, cityName: existing.cityName, notes: existing.notes };
                
                const { data: reactivated, error: reactivateError } = await supabase
                    .from('UserCityAccess')
                    .update({ isActive: true, assignedBy: assignedById, updatedAt: new Date().toISOString() })
                    .eq('id', existing.id)
                    .select()
                    .single();

                if (reactivateError) {
                    return res.status(500).json({ status: 'error', message: 'Nie udało się reaktywować przypisania', details: reactivateError.message });
                }

                await logCityAccessChange(supabase, assignedById, userId, 'REACTIVATE', cityName.trim(), existing.id, oldValue, { isActive: true });

                return res.json({ status: 'success', data: reactivated, message: 'Przypisanie reaktywowane' });
            }
            return res.status(409).json({ status: 'error', message: 'Przypisanie już istnieje' });
        }

        const { data, error } = await supabase
            .from('UserCityAccess')
            .insert({
                userId,
                cityName: cityName.trim(),
                isActive: true,
                assignedBy: assignedById,
                notes: notes?.trim() || null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            })
            .select()
            .single();

        if (error) {
            console.error('Błąd tworzenia przypisania miejscowości:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się utworzyć przypisania', details: error.message });
        }

        await logCityAccessChange(supabase, assignedById, userId, 'CREATE', cityName.trim(), data.id, null, { isActive: true, cityName: cityName.trim(), notes: notes?.trim() || null });

        return res.status(201).json({ status: 'success', data, message: 'Przypisanie utworzone' });
    } catch (err) {
        console.error('Wyjątek w POST /api/admin/user-city-access:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
    }
});

// Aktualizacja przypisania miejscowości
router.patch('/user-city-access/:id', requireRole(['ADMIN', 'SALES_DEPT', 'GRAPHICS', 'GRAPHIC_DESIGNER']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { role, id: actorId } = req.user;
    const { id } = req.params;
    const { cityName, isActive, notes } = req.body || {};

    try {
        const { data: currentData } = await supabase
            .from('UserCityAccess')
            .select('userId, cityName, isActive, notes')
            .eq('id', id)
            .single();

        if (!currentData) {
            return res.status(404).json({ status: 'error', message: 'Przypisanie nie znalezione' });
        }

        const oldValue = { cityName: currentData.cityName, isActive: currentData.isActive, notes: currentData.notes };
        const updateData = { updatedAt: new Date().toISOString() };

        if (role === 'SALES_DEPT') {
            if (isActive !== undefined) updateData.isActive = isActive;
            if (notes !== undefined) updateData.notes = notes?.trim() || null;
        } else {
            if (cityName !== undefined) updateData.cityName = cityName.trim();
            if (isActive !== undefined) updateData.isActive = isActive;
            if (notes !== undefined) updateData.notes = notes?.trim() || null;
        }

        const { data, error } = await supabase
            .from('UserCityAccess')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Błąd aktualizacji przypisania miejscowości:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się zaktualizować przypisania', details: error.message });
        }

        let action = 'UPDATE';
        if (isActive !== undefined && oldValue.isActive !== isActive) {
            action = isActive ? 'REACTIVATE' : 'DEACTIVATE';
        }

        const newValue = { cityName: data.cityName, isActive: data.isActive, notes: data.notes };
        await logCityAccessChange(supabase, actorId, currentData.userId, action, data.cityName, parseInt(id), oldValue, newValue);

        return res.json({ status: 'success', data, message: 'Przypisanie zaktualizowane' });
    } catch (err) {
        console.error('Wyjątek w PATCH /api/admin/user-city-access/:id:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
    }
});

// Usunięcie przypisania miejscowości
router.delete('/user-city-access/:id', requireRole(['ADMIN', 'SALES_DEPT', 'GRAPHICS', 'GRAPHIC_DESIGNER']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { id: actorId } = req.user;
    const { id } = req.params;

    try {
        const { data: toDelete } = await supabase
            .from('UserCityAccess')
            .select('userId, cityName, isActive, notes')
            .eq('id', id)
            .single();

        if (!toDelete) {
            return res.status(404).json({ status: 'error', message: 'Przypisanie nie znalezione' });
        }

        const { error } = await supabase
            .from('UserCityAccess')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Błąd usuwania przypisania miejscowości:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się usunąć przypisania', details: error.message });
        }

        await logCityAccessChange(supabase, actorId, toDelete.userId, 'DELETE', toDelete.cityName, parseInt(id), 
            { cityName: toDelete.cityName, isActive: toDelete.isActive, notes: toDelete.notes }, null);

        return res.json({ status: 'success', message: 'Przypisanie usunięte' });
    } catch (err) {
        console.error('Wyjątek w DELETE /api/admin/user-city-access/:id:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
    }
});

module.exports = router;
