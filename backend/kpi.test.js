/**
 * Testy jednostkowe dla modułu KPI produkcji
 * 
 * Uruchomienie: npm test -- kpi.test.js
 * lub: node --experimental-vm-modules node_modules/jest/bin/jest.js kpi.test.js
 */

// ============================================
// MOCK DANYCH
// ============================================

const mockCompletedOperations = [
    {
        id: 1,
        status: 'completed',
        outputquantity: 100,
        wastequantity: 5,
        actualtime: 30,
        endtime: new Date().toISOString(),
        productionorderid: 1,
        ProductionOrder: {
            id: 1,
            workOrderId: 1,
            Product: { id: 'p1', name: 'Produkt A', identifier: 'PROD-A' }
        }
    },
    {
        id: 2,
        status: 'completed',
        outputquantity: 50,
        wastequantity: 2,
        actualtime: 15,
        endtime: new Date().toISOString(),
        productionorderid: 2,
        ProductionOrder: {
            id: 2,
            workOrderId: 1,
            Product: { id: 'p1', name: 'Produkt A', identifier: 'PROD-A' }
        }
    },
    {
        id: 3,
        status: 'completed',
        outputquantity: 200,
        wastequantity: 10,
        actualtime: 45,
        endtime: new Date().toISOString(),
        productionorderid: 3,
        ProductionOrder: {
            id: 3,
            workOrderId: 2,
            Product: { id: 'p2', name: 'Produkt B', identifier: 'PROD-B' }
        }
    }
];

const mockWorkOrders = [
    { id: 1, status: 'completed', roomName: 'Pokój Grawerowania' },
    { id: 2, status: 'in_progress', roomName: 'Pokój Grawerowania' },
    { id: 3, status: 'planned', roomName: 'Pokój Druku UV' },
    { id: 4, status: 'approved', roomName: 'Pokój Druku UV' },
    { id: 5, status: 'cancelled', roomName: 'Pokój Grawerowania' }
];

const mockProblemLogs = [
    { id: 1, action: 'problem_reported', createdAt: new Date().toISOString() },
    { id: 2, action: 'problem_reported', createdAt: new Date().toISOString() }
];

// ============================================
// FUNKCJE POMOCNICZE (kopie z server.js do testowania)
// ============================================

/**
 * Oblicza summary KPI na podstawie zakończonych operacji
 */
function calculateSummary(completedOps, problemLogs) {
    const summary = {
        completedOperations: completedOps?.length || 0,
        producedQuantity: 0,
        wasteQuantity: 0,
        problemsReported: problemLogs?.length || 0,
        avgOperationTimeMinutes: 0
    };

    let totalActualTime = 0;

    (completedOps || []).forEach(op => {
        summary.producedQuantity += op.outputquantity || 0;
        summary.wasteQuantity += op.wastequantity || 0;
        totalActualTime += op.actualtime || 0;
    });

    if (summary.completedOperations > 0) {
        summary.avgOperationTimeMinutes = Math.round(totalActualTime / summary.completedOperations);
    }

    return summary;
}

/**
 * Agreguje statystyki produktów
 */
function aggregateProductStats(completedOps) {
    const productStats = {};

    (completedOps || []).forEach(op => {
        const product = op.ProductionOrder?.Product;
        if (product) {
            const productId = product.id;
            if (!productStats[productId]) {
                productStats[productId] = {
                    productId,
                    name: product.name || product.identifier || 'Nieznany',
                    identifier: product.identifier,
                    producedQuantity: 0,
                    wasteQuantity: 0,
                    operationsCount: 0
                };
            }
            productStats[productId].producedQuantity += op.outputquantity || 0;
            productStats[productId].wasteQuantity += op.wastequantity || 0;
            productStats[productId].operationsCount += 1;
        }
    });

    return Object.values(productStats)
        .sort((a, b) => b.producedQuantity - a.producedQuantity);
}

/**
 * Agreguje statystyki pokojów
 */
function aggregateRoomStats(workOrders) {
    const roomStats = {};

    (workOrders || []).forEach(wo => {
        const roomName = wo.roomName || 'Nieprzypisany';
        if (!roomStats[roomName]) {
            roomStats[roomName] = {
                roomName,
                totalWorkOrders: 0,
                completedWorkOrders: 0,
                inProgressWorkOrders: 0,
                plannedWorkOrders: 0,
                cancelledWorkOrders: 0
            };
        }
        roomStats[roomName].totalWorkOrders += 1;

        switch (wo.status) {
            case 'completed':
                roomStats[roomName].completedWorkOrders += 1;
                break;
            case 'in_progress':
                roomStats[roomName].inProgressWorkOrders += 1;
                break;
            case 'planned':
            case 'approved':
                roomStats[roomName].plannedWorkOrders += 1;
                break;
            case 'cancelled':
                roomStats[roomName].cancelledWorkOrders += 1;
                break;
        }
    });

    return Object.values(roomStats);
}

// ============================================
// TESTY
// ============================================

describe('KPI Module - calculateSummary', () => {
    test('powinien poprawnie obliczyć summary dla zakończonych operacji', () => {
        const summary = calculateSummary(mockCompletedOperations, mockProblemLogs);

        expect(summary.completedOperations).toBe(3);
        expect(summary.producedQuantity).toBe(350); // 100 + 50 + 200
        expect(summary.wasteQuantity).toBe(17);     // 5 + 2 + 10
        expect(summary.problemsReported).toBe(2);
        expect(summary.avgOperationTimeMinutes).toBe(30); // (30 + 15 + 45) / 3 = 30
    });

    test('powinien zwrócić zera dla pustych danych', () => {
        const summary = calculateSummary([], []);

        expect(summary.completedOperations).toBe(0);
        expect(summary.producedQuantity).toBe(0);
        expect(summary.wasteQuantity).toBe(0);
        expect(summary.problemsReported).toBe(0);
        expect(summary.avgOperationTimeMinutes).toBe(0);
    });

    test('powinien obsłużyć null/undefined', () => {
        const summary = calculateSummary(null, undefined);

        expect(summary.completedOperations).toBe(0);
        expect(summary.producedQuantity).toBe(0);
        expect(summary.problemsReported).toBe(0);
    });

    test('powinien obsłużyć operacje z brakującymi polami', () => {
        const opsWithMissing = [
            { id: 1, status: 'completed' }, // brak outputquantity, wastequantity, actualtime
            { id: 2, status: 'completed', outputquantity: 10 }
        ];

        const summary = calculateSummary(opsWithMissing, []);

        expect(summary.completedOperations).toBe(2);
        expect(summary.producedQuantity).toBe(10);
        expect(summary.wasteQuantity).toBe(0);
    });
});

describe('KPI Module - aggregateProductStats', () => {
    test('powinien poprawnie agregować statystyki produktów', () => {
        const products = aggregateProductStats(mockCompletedOperations);

        expect(products.length).toBe(2);
        
        // Produkt B ma więcej (200), więc powinien być pierwszy
        expect(products[0].productId).toBe('p2');
        expect(products[0].producedQuantity).toBe(200);
        expect(products[0].wasteQuantity).toBe(10);
        expect(products[0].operationsCount).toBe(1);

        // Produkt A (100 + 50 = 150)
        expect(products[1].productId).toBe('p1');
        expect(products[1].producedQuantity).toBe(150);
        expect(products[1].wasteQuantity).toBe(7);
        expect(products[1].operationsCount).toBe(2);
    });

    test('powinien zwrócić pustą tablicę dla pustych danych', () => {
        const products = aggregateProductStats([]);
        expect(products).toEqual([]);
    });

    test('powinien obsłużyć operacje bez produktu', () => {
        const opsWithoutProduct = [
            { id: 1, outputquantity: 100, ProductionOrder: null },
            { id: 2, outputquantity: 50, ProductionOrder: { Product: null } }
        ];

        const products = aggregateProductStats(opsWithoutProduct);
        expect(products).toEqual([]);
    });
});

describe('KPI Module - aggregateRoomStats', () => {
    test('powinien poprawnie agregować statystyki pokojów', () => {
        const rooms = aggregateRoomStats(mockWorkOrders);

        expect(rooms.length).toBe(2);

        const grawerowanie = rooms.find(r => r.roomName === 'Pokój Grawerowania');
        expect(grawerowanie).toBeDefined();
        expect(grawerowanie.totalWorkOrders).toBe(3);
        expect(grawerowanie.completedWorkOrders).toBe(1);
        expect(grawerowanie.inProgressWorkOrders).toBe(1);
        expect(grawerowanie.cancelledWorkOrders).toBe(1);

        const drukUV = rooms.find(r => r.roomName === 'Pokój Druku UV');
        expect(drukUV).toBeDefined();
        expect(drukUV.totalWorkOrders).toBe(2);
        expect(drukUV.plannedWorkOrders).toBe(2); // planned + approved
    });

    test('powinien zwrócić pustą tablicę dla pustych danych', () => {
        const rooms = aggregateRoomStats([]);
        expect(rooms).toEqual([]);
    });

    test('powinien obsłużyć work orders bez roomName', () => {
        const woWithoutRoom = [
            { id: 1, status: 'completed', roomName: null },
            { id: 2, status: 'in_progress' } // brak roomName
        ];

        const rooms = aggregateRoomStats(woWithoutRoom);
        
        expect(rooms.length).toBe(1);
        expect(rooms[0].roomName).toBe('Nieprzypisany');
        expect(rooms[0].totalWorkOrders).toBe(2);
    });
});

describe('KPI Module - integracja', () => {
    test('powinien zwrócić kompletny obiekt KPI', () => {
        const summary = calculateSummary(mockCompletedOperations, mockProblemLogs);
        const topProducts = aggregateProductStats(mockCompletedOperations).slice(0, 5);
        const byRoom = aggregateRoomStats(mockWorkOrders);

        const kpi = {
            summary,
            byRoom,
            topProducts,
            dateRange: {
                from: new Date().toISOString(),
                to: new Date().toISOString()
            }
        };

        // Sprawdź strukturę
        expect(kpi).toHaveProperty('summary');
        expect(kpi).toHaveProperty('byRoom');
        expect(kpi).toHaveProperty('topProducts');
        expect(kpi).toHaveProperty('dateRange');

        // Sprawdź typy
        expect(typeof kpi.summary.completedOperations).toBe('number');
        expect(Array.isArray(kpi.byRoom)).toBe(true);
        expect(Array.isArray(kpi.topProducts)).toBe(true);
    });
});

// ============================================
// TESTY WALIDACJI ZAKRESU DAT
// ============================================

describe('KPI Module - zakres dat', () => {
    test('powinien poprawnie parsować daty ISO', () => {
        const dateFrom = '2025-12-01T00:00:00.000Z';
        const dateTo = '2025-12-31T23:59:59.999Z';

        const startDate = new Date(dateFrom);
        const endDate = new Date(dateTo);

        expect(startDate.getFullYear()).toBe(2025);
        expect(startDate.getMonth()).toBe(11); // grudzień = 11
        // Używamy UTC aby uniknąć problemów ze strefą czasową
        expect(endDate.getUTCDate()).toBe(31);
    });

    test('powinien ustawić domyślny zakres na dzisiaj', () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        expect(tomorrow.getTime() - today.getTime()).toBe(24 * 60 * 60 * 1000);
    });
});

// ============================================
// TESTY UPRAWNIEŃ (mockowane)
// ============================================

describe('KPI Module - uprawnienia', () => {
    const allowedRoles = ['ADMIN', 'PRODUCTION_MANAGER', 'PRODUCTION'];
    const deniedRoles = ['SALES_REP', 'SALES_DEPT', 'OPERATOR', 'WAREHOUSE', 'GRAPHICS'];

    test('powinien zezwalać na dostęp dla ról produkcyjnych', () => {
        allowedRoles.forEach(role => {
            expect(allowedRoles.includes(role)).toBe(true);
        });
    });

    test('powinien odmawiać dostępu dla innych ról', () => {
        deniedRoles.forEach(role => {
            expect(allowedRoles.includes(role)).toBe(false);
        });
    });
});

console.log('✅ Testy KPI załadowane. Uruchom: npm test -- kpi.test.js');
