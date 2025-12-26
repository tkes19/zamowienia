/**
 * Router dla endpointów ustawień systemowych
 * Endpointy do zarządzania workflow zamówień i innymi ustawieniami
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
// GET /api/settings/order-workflow - pobierz ustawienia workflow zamówień
// ============================================

router.get('/order-workflow', requireRole(['ADMIN', 'SALES_DEPT']), async (req, res) => {
    const supabase = req.app.locals.supabase;

    try {
        const { data, error } = await supabase
            .from('Settings')
            .select('*')
            .eq('key', 'orderWorkflow')
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = not found
            throw error;
        }

        const settings = data ? JSON.parse(data.value) : {
            statuses: [
                { key: 'PENDING', label: 'Oczekujące', color: '#ffc107', order: 1 },
                { key: 'CONFIRMED', label: 'Potwierdzone', color: '#17a2b8', order: 2 },
                { key: 'IN_PRODUCTION', label: 'W produkcji', color: '#6c757d', order: 3 },
                { key: 'COMPLETED', label: 'Zakończone', color: '#28a745', order: 4 },
                { key: 'CANCELLED', label: 'Anulowane', color: '#dc3545', order: 5 }
            ],
            transitions: {
                'PENDING': ['CONFIRMED', 'CANCELLED'],
                'CONFIRMED': ['IN_PRODUCTION', 'CANCELLED'],
                'IN_PRODUCTION': ['COMPLETED'],
                'COMPLETED': [],
                'CANCELLED': []
            }
        };

        return res.json({ status: 'success', data: settings });
    } catch (error) {
        console.error('Błąd w GET /api/settings/order-workflow:', error);
        return res.status(500).json({ 
            status: 'error', 
            message: 'Błąd serwera' 
        });
    }
});

// ============================================
// PATCH /api/settings/order-workflow - aktualizuj ustawienia workflow zamówień
// ============================================

router.patch('/order-workflow', requireRole(['ADMIN', 'SALES_DEPT']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { statuses, transitions } = req.body;

    try {
        const settings = { statuses, transitions };

        const { data, error } = await supabase
            .from('Settings')
            .upsert({
                key: 'orderWorkflow',
                value: JSON.stringify(settings),
                updatedAt: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;

        return res.json({ 
            status: 'success', 
            message: 'Ustawienia zostały zaktualizowane',
            data: settings
        });
    } catch (error) {
        console.error('Błąd w PATCH /api/settings/order-workflow:', error);
        return res.status(500).json({ 
            status: 'error', 
            message: 'Błąd serwera' 
        });
    }
});

module.exports = router;
