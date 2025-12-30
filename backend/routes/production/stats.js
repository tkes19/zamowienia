/**
 * Router statystyk produkcji
 */

const express = require('express');
const { requireRole, parseCookies } = require('../../modules/auth');

const router = express.Router();

/**
 * GET /api/production/operator/stats
 * Statystyki operatora
 */
router.get('/operator/stats', requireRole(['ADMIN', 'PRODUCTION', 'OPERATOR', 'PRODUCTION_MANAGER']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    
    if (!supabase) {
        return res.status(500).json({ 
            status: 'error', 
            message: 'Supabase nie jest skonfigurowany' 
        });
    }

    try {
        const cookies = req.headers.cookie ? parseCookies(req) : {};
        const userId = cookies.auth_id;
        const userRole = cookies.auth_role;

        // Pobierz pokój użytkownika i dozwolone typy operacji
        let allowedWorkCenterTypes = null;
        let userRoomName = null;
        let userRoomId = null;
        
        if (userId) {
            const { data: user } = await supabase
                .from('User')
                .select('productionroomid, productionRoom:ProductionRoom!User_productionroomid_fkey(id, name)')
                .eq('id', userId)
                .single();
            
            if (user?.productionroomid) {
                userRoomId = user.productionroomid;
                userRoomName = user.productionRoom?.name;
                
                const { data: workCenters } = await supabase
                    .from('WorkCenter')
                    .select('type')
                    .eq('roomId', user.productionroomid);
                
                if (workCenters && workCenters.length > 0) {
                    allowedWorkCenterTypes = workCenters.map(wc => wc.type).filter(t => !!t);
                }
            }
        }
        
        // Dla ADMIN i PRODUCTION_MANAGER bez przypisanego pokoju - pokaż wszystkie statystyki
        const showAllStats = (userRole === 'ADMIN' || userRole === 'PRODUCTION_MANAGER') && !userRoomId;

        // Pobierz wszystkie zlecenia z operacjami
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayISO = today.toISOString();

        const { data: orders } = await supabase
            .from('ProductionOrder')
            .select('id, status, actualenddate')
            .in('status', ['planned', 'approved', 'in_progress', 'paused', 'completed']);

        console.log(`[operator/stats] Znaleziono ${(orders || []).length} zleceń, userRoomId: ${userRoomId}, showAllStats: ${showAllStats}, allowedWorkCenterTypes:`, allowedWorkCenterTypes);

        // Jeśli operator ma przypisany pokój, filtruj zlecenia po typie operacji
        // Dla ADMIN/PRODUCTION_MANAGER bez pokoju - pokaż wszystkie
        let filteredOrders = orders || [];
        
        if (!showAllStats && allowedWorkCenterTypes && allowedWorkCenterTypes.length > 0) {
            const orderIds = filteredOrders.map(o => o.id);
            
            if (orderIds.length > 0) {
                const { data: operations } = await supabase
                    .from('ProductionOperation')
                    .select('productionorderid, operationtype')
                    .in('productionorderid', orderIds);
                
                // Grupuj operacje po zleceniu
                const orderOpsMap = {};
                (operations || []).forEach(op => {
                    if (!orderOpsMap[op.productionorderid]) {
                        orderOpsMap[op.productionorderid] = [];
                    }
                    orderOpsMap[op.productionorderid].push(op.operationtype);
                });
                
                // Filtruj zlecenia, które mają operacje z dozwolonymi typami
                filteredOrders = filteredOrders.filter(order => {
                    const opTypes = orderOpsMap[order.id] || [];
                    return opTypes.some(opType => {
                        if (!opType) return false;
                        return allowedWorkCenterTypes.some(t => opType === `path_${t}` || opType.includes(t));
                    });
                });
            }
        }

        const stats = {
            active: 0,          // in_progress w moim pokoju
            queue: 0,           // planned + approved w moim pokoju
            completedToday: 0,  // completed dziś w moim pokoju
            roomName: showAllStats ? 'Wszystkie pokoje' : (userRoomName || 'Brak przypisanego pokoju'),
            showAllStats: showAllStats
        };

        filteredOrders.forEach(order => {
            if (order.status === 'in_progress' || order.status === 'paused') {
                stats.active++;
            } else if (order.status === 'planned' || order.status === 'approved') {
                stats.queue++;
            } else if (order.status === 'completed') {
                // Sprawdź czy ukończone dziś
                if (order.actualenddate && new Date(order.actualenddate) >= today) {
                    stats.completedToday++;
                }
            }
        });

        console.log(`[operator/stats] Po filtrowaniu: ${filteredOrders.length} zleceń, stats:`, stats);

        res.json({
            status: 'success',
            data: stats
        });

    } catch (error) {
        console.error('[GET /api/production/operator/stats] Exception:', error);
        res.status(500).json({
            status: 'error',
            message: 'Błąd serwera'
        });
    }
});

/**
 * GET /api/production/stats
 * Statystyki ogólne produkcji
 */
router.get('/', requireRole(['ADMIN', 'PRODUCTION', 'SALES_DEPT']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    
    if (!supabase) {
        return res.status(500).json({ 
            status: 'error', 
            message: 'Supabase nie jest skonfigurowany' 
        });
    }

    try {
        // Najpierw sprawdzamy strukturę tabeli
        const { data: orders, error } = await supabase
            .from('ProductionOrder')
            .select('*')
            .limit(1);

        if (error) {
            console.error('[GET /api/production/stats] Error checking table:', error);
            // Jeśli tabela nie istnieje lub ma błąd, zwracamy zera
            return res.json({
                status: 'success',
                data: {
                    total: 0,
                    active: 0,
                    queue: 0,
                    completed: 0,
                    totalQuantity: 0,
                    completedQuantity: 0
                }
            });
        }

        // Jeśli tabela istnieje, pobieramy dane
        const { data: allOrders, error: fetchError } = await supabase
            .from('ProductionOrder')
            .select('id, status, quantity, completedquantity')
            .in('status', ['planned', 'approved', 'in_progress', 'paused', 'completed']);

        if (fetchError) {
            console.error('[GET /api/production/stats] Fetch error:', fetchError);
            // Jeśli kolumny nie istnieją, próbujemy bez nich
            const { data: simpleOrders } = await supabase
                .from('ProductionOrder')
                .select('id, status')
                .in('status', ['planned', 'approved', 'in_progress', 'paused', 'completed']);
            
            const stats = {
                total: (simpleOrders || []).length,
                active: (simpleOrders || []).filter(o => o.status === 'in_progress' || o.status === 'paused').length,
                queue: (simpleOrders || []).filter(o => o.status === 'planned' || o.status === 'approved').length,
                completed: (simpleOrders || []).filter(o => o.status === 'completed').length,
                totalQuantity: 0,
                completedQuantity: 0
            };

            return res.json({
                status: 'success',
                data: stats
            });
        }

        const stats = {
            total: (allOrders || []).length,
            active: (allOrders || []).filter(o => o.status === 'in_progress' || o.status === 'paused').length,
            queue: (allOrders || []).filter(o => o.status === 'planned' || o.status === 'approved').length,
            completed: (allOrders || []).filter(o => o.status === 'completed').length,
            totalQuantity: (allOrders || []).reduce((sum, o) => sum + (o.quantity || 0), 0),
            completedQuantity: (allOrders || []).reduce((sum, o) => sum + (o.completedquantity || 0), 0)
        };

        res.json({
            status: 'success',
            data: stats
        });

    } catch (error) {
        console.error('[GET /api/production/stats] Exception:', error);
        res.status(500).json({
            status: 'error',
            message: 'Błąd serwera'
        });
    }
});

module.exports = router;
