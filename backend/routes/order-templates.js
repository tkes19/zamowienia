/**
 * Router dla szablonów zamówień
 * Endpointy do zarządzania szablonami zamówień
 */

const express = require('express');
const { requireRole } = require('../modules/auth');

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
// GET /api/order-templates - Lista szablonów widocznych dla użytkownika
// ============================================

router.get('/', requireRole(['SALES_REP', 'SALES_DEPT', 'ADMIN']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { userId, role } = req.user || {};

    try {
        let query = supabase
            .from('OrderTemplate')
            .select('*')
            .eq('isActive', true)
            .order('createdAt', { ascending: false });

        // SALES_REP widzi tylko swoje i publiczne
        if (role === 'SALES_REP') {
            query = query.or(`userId.eq.${userId},isPublic.eq.true`);
        }

        const { data, error } = await query;

        if (error) throw error;

        return res.json({ status: 'success', data: data || [] });
    } catch (error) {
        console.error('Wyjątek w GET /api/order-templates:', error);
        return res.status(500).json({ 
            status: 'error', 
            message: 'Błąd serwera' 
        });
    }
});

// ============================================
// POST /api/order-templates - Zapis bieżącego koszyka jako szablon
// ============================================

router.post('/', requireRole(['SALES_REP', 'SALES_DEPT', 'ADMIN']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { userId } = req.user || {};
    const { name, description, items, isPublic = false } = req.body;

    try {
        if (!name || !items || !Array.isArray(items)) {
            return res.status(400).json({
                status: 'error',
                message: 'Nazwa i przedmioty są wymagane'
            });
        }

        const { data, error } = await supabase
            .from('OrderTemplate')
            .insert({
                name,
                description,
                userId,
                items: JSON.stringify(items),
                isPublic,
                isActive: true,
                createdAt: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;

        return res.json({
            status: 'success',
            message: 'Szablon został zapisany',
            data
        });
    } catch (error) {
        console.error('Wyjątek w POST /api/order-templates:', error);
        return res.status(500).json({ 
            status: 'error', 
            message: 'Błąd serwera' 
        });
    }
});

// ============================================
// PATCH /api/order-templates/:id - Aktualizacja metadanych szablonu
// ============================================

router.patch('/:id', requireRole(['SALES_REP', 'SALES_DEPT', 'ADMIN']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { userId, role } = req.user || {};
    const { id } = req.params;
    const { name, description, isPublic } = req.body;

    try {
        // Sprawdź uprawnienia
        let query = supabase
            .from('OrderTemplate')
            .select('userId, isPublic')
            .eq('id', id)
            .single();

        const { data: template, error: fetchError } = await query;
        if (fetchError || !template) {
            return res.status(404).json({
                status: 'error',
                message: 'Szablon nie został znaleziony'
            });
        }

        // Sprawdź, czy użytkownik może edytować
        if (template.userId !== userId && role !== 'ADMIN' && role !== 'SALES_DEPT') {
            return res.status(403).json({
                status: 'error',
                message: 'Brak uprawnień do edycji tego szablonu'
            });
        }

        const updateData = {
            updatedAt: new Date().toISOString()
        };

        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (isPublic !== undefined && (role === 'ADMIN' || role === 'SALES_DEPT')) {
            updateData.isPublic = isPublic;
        }

        const { data, error } = await supabase
            .from('OrderTemplate')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return res.json({
            status: 'success',
            message: 'Szablon został zaktualizowany',
            data
        });
    } catch (error) {
        console.error('Wyjątek w PATCH /api/order-templates/:id:', error);
        return res.status(500).json({ 
            status: 'error', 
            message: 'Błąd serwera' 
        });
    }
});

// ============================================
// DELETE /api/order-templates/:id - Usunięcie szablonu
// ============================================

router.delete('/:id', requireRole(['SALES_REP', 'SALES_DEPT', 'ADMIN']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { userId, role } = req.user || {};
    const { id } = req.params;

    try {
        // Sprawdź uprawnienia
        const { data: template, error: fetchError } = await supabase
            .from('OrderTemplate')
            .select('userId')
            .eq('id', id)
            .single();

        if (fetchError || !template) {
            return res.status(404).json({
                status: 'error',
                message: 'Szablon nie został znaleziony'
            });
        }

        // Sprawdź, czy użytkownik może usunąć
        if (template.userId !== userId && role !== 'ADMIN' && role !== 'SALES_DEPT') {
            return res.status(403).json({
                status: 'error',
                message: 'Brak uprawnień do usunięcia tego szablonu'
            });
        }

        const { error } = await supabase
            .from('OrderTemplate')
            .update({ isActive: false })
            .eq('id', id);

        if (error) throw error;

        return res.json({
            status: 'success',
            message: 'Szablon został usunięty'
        });
    } catch (error) {
        console.error('Wyjątek w DELETE /api/order-templates/:id:', error);
        return res.status(500).json({ 
            status: 'error', 
            message: 'Błąd serwera' 
        });
    }
});

// ============================================
// POST /api/order-templates/:id/duplicate - Duplikuj szablon
// ============================================

router.post('/:id/duplicate', requireRole(['SALES_REP', 'SALES_DEPT', 'ADMIN']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { userId } = req.user || {};
    const { id } = req.params;
    const { name } = req.body;

    try {
        // Pobierz oryginalny szablon
        const { data: template, error: fetchError } = await supabase
            .from('OrderTemplate')
            .select('*')
            .eq('id', id)
            .eq('isActive', true)
            .single();

        if (fetchError || !template) {
            return res.status(404).json({
                status: 'error',
                message: 'Szablon nie został znaleziony'
            });
        }

        // Sprawdź uprawnienia (publiczne lub własne)
        if (!template.isPublic && template.userId !== userId && role !== 'ADMIN' && role !== 'SALES_DEPT') {
            return res.status(403).json({
                status: 'error',
                message: 'Brak uprawnień do tego szablonu'
            });
        }

        // Utwórz duplikat
        const { data, error } = await supabase
            .from('OrderTemplate')
            .insert({
                name: name || `${template.name} (kopia)`,
                description: template.description,
                userId,
                items: template.items,
                isPublic: false, // duplikat jest zawsze prywatny
                isActive: true,
                createdAt: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;

        return res.json({
            status: 'success',
            message: 'Szablon został zduplikowany',
            data
        });
    } catch (error) {
        console.error('Wyjątek w POST /api/order-templates/:id/duplicate:', error);
        return res.status(500).json({ 
            status: 'error', 
            message: 'Błąd serwera' 
        });
    }
});

// ============================================
// POST /api/order-templates/:id/use - Użyj szablonu do koszyka
// ============================================

router.post('/:id/use', requireRole(['SALES_REP', 'SALES_DEPT', 'ADMIN']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { userId, role } = req.user || {};
    const { id } = req.params;

    try {
        // Pobierz szablon
        const { data: template, error: fetchError } = await supabase
            .from('OrderTemplate')
            .select('items, userId, isPublic')
            .eq('id', id)
            .eq('isActive', true)
            .single();

        if (fetchError || !template) {
            return res.status(404).json({
                status: 'error',
                message: 'Szablon nie został znaleziony'
            });
        }

        // Sprawdź uprawnienia
        if (!template.isPublic && template.userId !== userId && role !== 'ADMIN' && role !== 'SALES_DEPT') {
            return res.status(403).json({
                status: 'error',
                message: 'Brak uprawnień do tego szablonu'
            });
        }

        const items = JSON.parse(template.items);

        return res.json({
            status: 'success',
            message: 'Szablon został załadowany',
            data: items
        });
    } catch (error) {
        console.error('Wyjątek w POST /api/order-templates/:id/use:', error);
        return res.status(500).json({ 
            status: 'error', 
            message: 'Błąd serwera' 
        });
    }
});

// ============================================
// POST /api/order-templates/:id/favorite - Dodaj/usuń z ulubionych
// ============================================

router.post('/:id/favorite', requireRole(['SALES_REP', 'SALES_DEPT', 'ADMIN']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { userId } = req.user || {};
    const { id } = req.params;

    try {
        // Sprawdź, czy szablon istnieje
        const { data: template, error: fetchError } = await supabase
            .from('OrderTemplate')
            .select('id')
            .eq('id', id)
            .eq('isActive', true)
            .single();

        if (fetchError || !template) {
            return res.status(404).json({
                status: 'error',
                message: 'Szablon nie został znaleziony'
            });
        }

        // Sprawdź, czy już jest w ulubionych
        const { data: favorite, error: favError } = await supabase
            .from('Favorite')
            .select('id')
            .eq('userId', userId)
            .eq('type', 'order-template')
            .eq('itemId', id)
            .single();

        if (favError && favError.code !== 'PGRST116') {
            throw favError;
        }

        if (favorite) {
            // Usuń z ulubionych
            await supabase
                .from('Favorite')
                .delete()
                .eq('userId', userId)
                .eq('type', 'order-template')
                .eq('itemId', id);

            return res.json({
                status: 'success',
                message: 'Usunięto z ulubionych',
                isFavorite: false
            });
        } else {
            // Dodaj do ulubionych
            await supabase
                .from('Favorite')
                .insert({
                    userId,
                    type: 'order-template',
                    itemId: id,
                    createdAt: new Date().toISOString()
                });

            return res.json({
                status: 'success',
                message: 'Dodano do ulubionych',
                isFavorite: true
            });
        }
    } catch (error) {
        console.error('Wyjątek w POST /api/order-templates/:id/favorite:', error);
        return res.status(500).json({ 
            status: 'error', 
            message: 'Błąd serwera' 
        });
    }
});

module.exports = router;
