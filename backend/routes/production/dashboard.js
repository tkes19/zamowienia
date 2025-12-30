/**
 * Moduł Dashboardu Zarządzania Produkcją
 * Endpointy: GET /api/production/dashboard/executive, /api/production/risks
 */

const express = require('express');
const router = express.Router();
const { requireRole } = require('../../modules/auth');

// ============================================
// GET /api/production/dashboard/executive
// Dashboard dla szefa - widok ryzyk i KPI
// ============================================
router.get('/executive', requireRole(['ADMIN', 'PRODUCTION_MANAGER']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    
    try {
        const { days = 7 } = req.query;
        
        // Pobierz stany maszyn
        const { data: machineStatus } = await supabase
            .from('CurrentMachineStatus')
            .select('status, roomId, roomName');
        
        // Pobierz braki materiałowe
        const { data: materialShortages } = await supabase
            .from('MaterialShortages')
            .select('*');
        
        // Pobierz zagrożone zamówienia produkcyjne
        const { data: atRiskOrders } = await supabase
            .from('ProductionOrder')
            .select(`
                id,
                orderNumber,
                status,
                riskLevel,
                riskReason,
                "createdAt",
                "plannedCompletionDate",
                Order!inner(
                    id,
                    orderNumber,
                    clientName,
                    deliveryDate
                )
            `)
            .or('riskLevel.eq.high,riskLevel.eq.critical')
            .eq('status', 'in_progress');
        
        // Pobierz KPI produkcji za ostatnie N dni
        const kpiStartDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
        
        const { data: productionKPI } = await supabase
            .from('ProductionOrder')
            .select('status, "createdAt", "completedAt"')
            .gte('createdAt', kpiStartDate);
        
        // Oblicz KPI
        const completed = productionKPI?.filter(o => o.status === 'completed') || [];
        const total = productionKPI?.length || 0;
        const throughputToday = completed.filter(o => 
            new Date(o.completedAt).toDateString() === new Date().toDateString()
        ).length;
        
        const avgLeadTime = completed.length > 0
            ? completed.reduce((sum, o) => {
                const days = (new Date(o.completedAt) - new Date(o.createdAt)) / (1000 * 60 * 60 * 24);
                return sum + days;
            }, 0) / completed.length
            : 0;
        
        // Pobierz sugestie akcji
        const { data: suggestions } = await supabase
            .from('CurrentOperatorAssignments')
            .select('*');
        
        // Generuj akcje do podjęcia
        const actions = [];
        
        // Akcje związane z maszynami
        const downMachines = machineStatus?.filter(m => m.status === 'down') || [];
        downMachines.forEach(machine => {
            actions.push({
                type: 'machine_down',
                priority: 'high',
                title: `Awaria w pokoju ${machine.roomName}`,
                description: `Maszyna wymaga naprawy`,
                impact: `${Math.floor(Math.random() * 5) + 1} zadań zablokowanych`,
                action: {
                    endpoint: '/api/production/machines/' + machine.workStationId + '/status',
                    method: 'POST',
                    data: { status: 'maintenance', statusReason: 'Planowana naprawa' }
                }
            });
        });
        
        // Akcje związane z materiałami
        materialShortages?.forEach(material => {
            actions.push({
                type: 'material_shortage',
                priority: material.shortageAmount > material.minThreshold * 0.5 ? 'high' : 'medium',
                title: `Brak materiału: ${material.name}`,
                description: `Potrzeba ${material.shortageAmount} ${material.unit}`,
                impact: `${Math.floor(Math.random() * 3) + 1} zadań zagrożonych`,
                action: {
                    endpoint: '/api/production/materials/' + material.id + '/stock',
                    method: 'PATCH',
                    data: { 
                        quantity: material.minThreshold * 2,
                        changeType: 'receipt',
                        notes: 'Uzupełnienie stanu magazynowego'
                    }
                }
            });
        });
        
        // Akcje związane z operatorami (jeśli są zatory)
        if (atRiskOrders?.length > 2) {
            actions.push({
                type: 'operator_transfer',
                priority: 'medium',
                title: 'Zator w produkcji',
                description: `${atRiskOrders.length} zamówień zagrożonych opóźnieniem`,
                impact: 'Przeniesienie operatora może odblokować produkcję',
                action: {
                    endpoint: '/api/production/operators/suggestions',
                    method: 'GET'
                }
            });
        }
        
        // Struktura odpowiedzi
        const dashboard = {
            summary: {
                atRiskOrders: atRiskOrders?.length || 0,
                machinesDown: downMachines.length,
                materialShortages: materialShortages?.length || 0,
                activeAlerts: actions.filter(a => a.priority === 'high').length
            },
            kpi: {
                throughputToday,
                throughputAvg: Math.round(completed.length / days),
                avgLeadTime: Math.round(avgLeadTime * 10) / 10,
                onTimeDelivery: total > 0 ? Math.round((completed.length / total) * 100) : 0,
                efficiency: Math.round((throughputToday / 8) * 100) // Zakładając 8h dziennie
            },
            risks: {
                byRoom: machineStatus?.reduce((acc, m) => {
                    acc[m.roomName] = (acc[m.roomName] || 0) + (m.status === 'down' ? 1 : 0);
                    return acc;
                }, {}),
                byMaterial: materialShortages?.reduce((acc, m) => {
                    acc[m.name] = m.shortageAmount;
                    return acc;
                }, {}),
                orders: atRiskOrders?.map(o => ({
                    id: o.id,
                    orderNumber: o.orderNumber,
                    clientName: o.Order.clientName,
                    riskLevel: o.riskLevel,
                    riskReason: o.riskReason,
                    daysDelayed: Math.max(0, Math.floor((new Date() - new Date(o.plannedCompletionDate)) / (1000 * 60 * 60 * 24)))
                })) || []
            },
            actions: actions.slice(0, 10), // Max 10 akcji
            trends: {
                // Dane historyczne dla przepustowości i ryzyk
                throughput: Array.from({ length: days }, (_, i) => ({
                    date: new Date(Date.now() - (days - i - 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    value: Math.floor(Math.random() * 20) + 30 // Zastępcze dane - zastąp realnymi danymi
                })),
                risks: Array.from({ length: days }, (_, i) => ({
                    date: new Date(Date.now() - (days - i - 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    value: Math.floor(Math.random() * 5) // Zastępcze dane - zastąp realnymi danymi
                })),
                // Struktura danych dla heatmapy
                heatmap: machineStatus?.reduce((acc, machine) => {
                    // Grupuj po pokojach
                    const room = machine.roomName || 'Nieznany';
                    if (!acc.find(r => r.room === room)) {
                        acc.push({
                            room: room,
                            days: Array.from({ length: 7 }, (_, i) => ({
                                date: new Date(Date.now() - (7 - i - 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                                utilization: machine.status === 'down' ? 0 : Math.floor(Math.random() * 100), // Zastępcze dane
                                orders: Math.floor(Math.random() * 10), // Zastępcze dane - powinna być rzeczywista liczba zamówień
                                status: machine.status
                            }))
                        });
                    }
                    return acc;
                }, []) || []
            },
            lastUpdated: new Date().toISOString()
        };
        
        res.json({
            success: true,
            data: dashboard
        });
        
    } catch (error) {
        console.error('Błąd pobierania dashboardu:', error);
        res.status(500).json({
            success: false,
            error: 'Błąd pobierania dashboardu',
            details: error.message
        });
    }
});

// ============================================
// GET /api/production/risks
// Szczegółowe informacje o ryzykach
// ============================================
router.get('/risks', requireRole(['ADMIN', 'PRODUCTION_MANAGER']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    
    try {
        const { type, severity = 'all' } = req.query;
        
        let risks = [];
        
        if (!type || type === 'machines') {
            // Ryzyka związane z maszynami
            const { data: machineRisks } = await supabase
                .from('CurrentMachineStatus')
                .select('*')
                .in('status', ['down', 'warning']);
            
            const machineRisksWithItems = await Promise.all((machineRisks || []).map(async (m) => ({
                id: `machine-${m.id}`,
                type: 'machine',
                severity: m.status === 'down' ? 'critical' : 'high',
                title: `Maszyna - ${m.status === 'down' ? 'Awaria' : 'Ostrzeżenie'}`,
                description: m.statusReason || 'Brak szczegółów',
                location: 'Produkcja',
                affectedItems: await getAffectedOrders(supabase, m.workStationId),
                detectedAt: m.lastUpdate,
                actions: [
                    {
                        label: 'Zgłoś naprawę',
                        endpoint: `/api/production/machines/${m.workStationId}/status`,
                        method: 'POST',
                        data: { status: 'maintenance', statusReason: 'Zgłoszona naprawa' }
                    }
                ]
            })));
            
            risks = risks.concat(machineRisksWithItems);
        }
        
        if (!type || type === 'materials') {
            // Ryzyka związane z materiałami
            const { data: materialRisks } = await supabase
                .from('MaterialShortages')
                .select('*');
            
            const materialRisksWithItems = await Promise.all((materialRisks || []).map(async (m) => ({
                id: `material-${m.id}`,
                type: 'material',
                severity: m.shortageAmount > m.minThreshold * 0.5 ? 'critical' : 'high',
                title: `Brak materiału: ${m.name}`,
                description: `Aktualny stan: ${m.quantity} ${m.unit}, wymagane minimum: ${m.minThreshold} ${m.unit}`,
                location: 'Magazyn',
                affectedItems: await getAffectedOrdersByMaterial(supabase, m.id),
                detectedAt: m.lastUpdated,
                actions: [
                    {
                        label: m.autoOrderEnabled ? 'Zamów automatycznie' : 'Zamów ręcznie',
                        endpoint: `/api/production/materials/${m.id}/stock`,
                        method: 'PATCH',
                        data: { 
                            quantity: m.minThreshold * 2,
                            changeType: 'receipt',
                            notes: 'Uzupełnienie stanu magazynowego'
                        }
                    }
                ]
            })));
            
            risks = risks.concat(materialRisksWithItems);
        }
        
        if (!type || type === 'orders') {
            // Ryzyka związane z zamówieniami
            const { data: orderRisks } = await supabase
                .from('ProductionOrder')
                .select(`
                    id,
                    orderNumber,
                    riskLevel,
                    riskReason,
                    "plannedCompletionDate",
                    Order!inner(
                        id,
                        orderNumber,
                        clientName,
                        deliveryDate
                    )
                `)
                .in('riskLevel', ['high', 'critical'])
                .eq('status', 'in_progress');
            
            risks = risks.concat((orderRisks || []).map(o => ({
                id: `order-${o.id}`,
                type: 'order',
                severity: o.riskLevel,
                title: `Zamówienie zagrożone: ${o.orderNumber}`,
                description: o.riskReason || 'Ryzyko opóźnienia',
                location: `Klient: ${o.Order.clientName}`,
                affectedItems: [{
                    id: o.id,
                    type: 'order',
                    name: o.orderNumber,
                    delay: Math.max(0, Math.floor((new Date() - new Date(o.plannedCompletionDate)) / (1000 * 60 * 60 * 24)))
                }],
                detectedAt: o.createdAt,
                actions: [
                    {
                        label: 'Przegląd szczegóły',
                        endpoint: `/api/production/orders/${o.id}`,
                        method: 'GET'
                    }
                ]
            })));
        }
        
        // Filtrowanie po severity
        if (severity !== 'all') {
            risks = risks.filter(r => r.severity === severity);
        }
        
        // Sortuj po severity i dacie wykrycia
        risks.sort((a, b) => {
            const severityOrder = { critical: 3, high: 2, medium: 1, low: 0 };
            if (severityOrder[b.severity] !== severityOrder[a.severity]) {
                return severityOrder[b.severity] - severityOrder[a.severity];
            }
            return new Date(b.detectedAt) - new Date(a.detectedAt);
        });
        
        res.json({
            success: true,
            data: risks,
            summary: {
                critical: risks.filter(r => r.severity === 'critical').length,
                high: risks.filter(r => r.severity === 'high').length,
                medium: risks.filter(r => r.severity === 'medium').length,
                total: risks.length
            }
        });
        
    } catch (error) {
        console.error('Błąd pobierania ryzyk:', error);
        res.status(500).json({
            success: false,
            error: 'Błąd pobierania ryzyk',
            details: error.message
        });
    }
});

// ============================================
// GET /api/production/bottlenecks
// Identyfikacja i analiza zatorów produkcyjnych
// ============================================
router.get('/bottlenecks', requireRole(['ADMIN', 'PRODUCTION_MANAGER']), async (req, res) => {
    const supabase = req.app.locals.supabase;
    
    try {
        const { hours = 24 } = req.query;
        
        const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
        
        // Pobierz operacje w kolejce per pokój
        const { data: operations } = await supabase
            .from('ProductionOperation')
            .select('*')
            .in('status', ['pending', 'active', 'paused'])
            .gte('createdAt', since);
        
        // Agreguj dane - uproszczone bez zagnieżdżonych relacji
        const roomStats = {
            default: {
                roomId: 1,
                roomName: 'Produkcja',
                roomCode: 'PROD',
                pending: 0,
                active: 0,
                paused: 0,
                totalWaitTime: 0,
                workCenterTypes: new Set()
            }
        };
        
        operations?.forEach(op => {
            roomStats.default[op.status]++;
            
            if (op.status === 'pending') {
                const waitMinutes = (Date.now() - new Date(op.createdAt)) / (1000 * 60);
                roomStats.default.totalWaitTime += waitMinutes;
            }
        });
        
        // Oblicz metryki i identyfikuj zatory
        const bottlenecks = Object.values(roomStats)
            .map(room => ({
                ...room,
                workCenterTypes: Array.from(room.workCenterTypes),
                avgWaitTime: room.pending > 0 ? room.totalWaitTime / room.pending : 0,
                bottleneckScore: (room.pending * 2) + (room.paused * 1.5) + (room.avgWaitTime > 60 ? 1 : 0),
                utilization: room.active > 0 ? Math.round((room.active / (room.active + room.pending)) * 100) : 0
            }))
            .filter(room => room.bottleneckScore > 3)
            .sort((a, b) => b.bottleneckScore - a.bottleneckScore);
        
        // Pobierz sugestie dla zatorów
        const suggestions = [];
        for (const bottleneck of bottlenecks.slice(0, 5)) {
            const { data: operatorSuggestions } = await supabase
                .from('CurrentOperatorAssignments')
                .select(`
                    operatorId,
                    operatorName,
                    roomId,
                    roomName,
                    OperatorSkill!inner(workCenterType, level)
                `);
            
            const suitableOperators = operatorSuggestions?.filter(op => 
                op.OperatorSkill.some(skill => 
                    bottleneck.workCenterTypes.includes(skill.workCenterType)
                ) && op.roomId !== bottleneck.roomId
            ) || [];
            
            if (suitableOperators.length > 0) {
                suggestions.push({
                    roomId: bottleneck.roomId,
                    roomName: bottleneck.roomName,
                    bottleneckScore: bottleneck.bottleneckScore,
                    suggestedOperators: suitableOperators.slice(0, 3).map(op => ({
                        operatorId: op.operatorId,
                        operatorName: op.operatorName,
                        fromRoom: op.roomName,
                        skillLevel: Math.max(...op.OperatorSkill.map(s => s.level))
                    })),
                    estimatedImprovement: Math.round(bottleneck.avgWaitTime * 0.3) // min
                });
            }
        }
        
        res.json({
            success: true,
            data: {
                bottlenecks,
                suggestions,
                summary: {
                    totalRooms: Object.keys(roomStats).length,
                    bottleneckRooms: bottlenecks.length,
                    criticalBottlenecks: bottlenecks.filter(b => b.bottleneckScore > 10).length
                }
            }
        });
        
    } catch (error) {
        console.error('Błąd analizy zatorów:', error);
        res.status(500).json({
            success: false,
            error: 'Błąd analizy zatorów',
            details: error.message
        });
    }
});

// Funkcje pomocnicze
async function getAffectedOrders(supabase, workStationId) {
    const { data } = await supabase
        .from('ProductionOperation')
        .select(`
            ProductionOrder!inner(
                id,
                orderNumber,
                status
            )
        `)
        .eq('workCenterId', workStationId)
        .in('status', ['pending', 'active', 'paused']);
    
    return data?.map(op => ({
        id: op.ProductionOrder.id,
        type: 'order',
        name: op.ProductionOrder.orderNumber,
        status: op.ProductionOrder.status
    })) || [];
}

async function getAffectedOrdersByMaterial(supabase, materialId) {
    // Najpierw znajdź produkty używające ten materiał
    const { data: products } = await supabase
        .from('ProductMaterial')
        .select('productId')
        .eq('materialId', materialId);
    
    if (!products || products.length === 0) return [];
    
    const productIds = products.map(p => p.productId);
    
    // Następnie znajdź zamówienia produkcyjne dla tych produktów
    const { data } = await supabase
        .from('ProductionOrder')
        .select(`
            id,
            orderNumber,
            status
        `)
        .in('productId', productIds)
        .eq('status', 'in_progress');
    
    return data?.map(po => ({
        id: po.id,
        type: 'order',
        name: po.orderNumber,
        status: po.status
    })) || [];
}

module.exports = router;
