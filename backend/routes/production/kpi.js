const express = require('express');
const { requireRole } = require('../../modules/auth');
const { emitKpiUpdated } = require('../../modules/sse/productionEvents');

const router = express.Router();

router.get('/overview', requireRole(['ADMIN', 'PRODUCTION_MANAGER', 'PRODUCTION']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    
    if (!supabase) {
        return res.status(500).json({ 
            status: 'error', 
            message: 'Supabase not configured' 
        });
    }

    try {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        const [todayResult, weekResult, monthResult] = await Promise.all([
            supabase.from('ProductionOrder').select('id, status, quantity, completedquantity', { count: 'exact' })
                .gte('createdAt', todayStart),
            supabase.from('ProductionOrder').select('id, status, quantity, completedquantity', { count: 'exact' })
                .gte('createdAt', weekStart),
            supabase.from('ProductionOrder').select('id, status, quantity, completedquantity', { count: 'exact' })
                .gte('createdAt', monthStart)
        ]);

        const calculateStats = (data) => {
            const orders = data || [];
            return {
                total: orders.length,
                completed: orders.filter(o => o.status === 'completed').length,
                inProgress: orders.filter(o => o.status === 'in_progress' || o.status === 'paused').length,
                planned: orders.filter(o => o.status === 'planned' || o.status === 'approved').length,
                totalQuantity: orders.reduce((sum, o) => sum + (o.quantity || 0), 0),
                completedQuantity: orders.reduce((sum, o) => sum + (o.completedquantity || 0), 0)
            };
        };

        const kpiData = {
            today: calculateStats(todayResult.data),
            week: calculateStats(weekResult.data),
            month: calculateStats(monthResult.data)
        };

        // Emit KPI update event (opcjonalnie z roomId jeśli jest w query)
        const { roomId } = req.query;
        emitKpiUpdated(roomId ? parseInt(roomId, 10) : null, kpiData);

        res.json({
            status: 'success',
            data: kpiData
        });

    } catch (error) {
        console.error('[GET /api/production/kpi/overview] Exception:', error);
        res.status(500).json({
            status: 'error',
            message: 'Server error'
        });
    }
});

module.exports = router;