/**
 * Testy jednostkowe dla logiki widoków ZP (workOrdersView)
 * i filtrowania po ścieżce produkcyjnej (R1)
 */

// Mock dla Supabase
const mockSupabase = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn()
};

// ============================================
// TESTY: Reguła R1 - filtrowanie po statusie operacji
// ============================================
describe('R1: Filtrowanie hasOperationsInUserRoom', () => {
    
    // Funkcja pomocnicza symulująca logikę z backendu
    function hasOperationsInUserRoom(ops, allowedWorkCenterTypes) {
        const pendingStatuses = ['pending', 'active', 'paused'];
        const relevantOps = ops.filter(op => pendingStatuses.includes(op.status));
        
        return relevantOps.some(op => {
            const opType = op.operationtype || op.operationType;
            let matchesByType = false;
            if (opType) {
                matchesByType = allowedWorkCenterTypes.includes(opType) ||
                    allowedWorkCenterTypes.some(t => opType === `path_${t}` || opType.includes(t));
            }
            return matchesByType;
        });
    }
    
    test('Pozycja z pending operacją w pokoju powinna być widoczna', () => {
        const ops = [
            { id: 1, operationtype: 'laser_co2', status: 'pending' },
            { id: 2, operationtype: 'uv_print', status: 'pending' }
        ];
        const allowedTypes = ['laser_co2'];
        
        expect(hasOperationsInUserRoom(ops, allowedTypes)).toBe(true);
    });
    
    test('Pozycja z active operacją w pokoju powinna być widoczna', () => {
        const ops = [
            { id: 1, operationtype: 'laser_co2', status: 'active' }
        ];
        const allowedTypes = ['laser_co2'];
        
        expect(hasOperationsInUserRoom(ops, allowedTypes)).toBe(true);
    });
    
    test('Pozycja z paused operacją w pokoju powinna być widoczna', () => {
        const ops = [
            { id: 1, operationtype: 'laser_co2', status: 'paused' }
        ];
        const allowedTypes = ['laser_co2'];
        
        expect(hasOperationsInUserRoom(ops, allowedTypes)).toBe(true);
    });
    
    test('Pozycja z completed operacją w pokoju NIE powinna być widoczna (znika po zakończeniu)', () => {
        const ops = [
            { id: 1, operationtype: 'laser_co2', status: 'completed' }
        ];
        const allowedTypes = ['laser_co2'];
        
        expect(hasOperationsInUserRoom(ops, allowedTypes)).toBe(false);
    });
    
    test('Pozycja z cancelled operacją w pokoju NIE powinna być widoczna', () => {
        const ops = [
            { id: 1, operationtype: 'laser_co2', status: 'cancelled' }
        ];
        const allowedTypes = ['laser_co2'];
        
        expect(hasOperationsInUserRoom(ops, allowedTypes)).toBe(false);
    });
    
    test('Pozycja z completed w pokoju A i pending w pokoju B - widoczna tylko w B', () => {
        const ops = [
            { id: 1, operationtype: 'laser_co2', status: 'completed' },
            { id: 2, operationtype: 'uv_print', status: 'pending' }
        ];
        
        // Pokój A (laser_co2) - nie widzi, bo completed
        expect(hasOperationsInUserRoom(ops, ['laser_co2'])).toBe(false);
        
        // Pokój B (uv_print) - widzi, bo pending
        expect(hasOperationsInUserRoom(ops, ['uv_print'])).toBe(true);
    });
    
    test('Pozycja bez operacji w danym pokoju NIE powinna być widoczna', () => {
        const ops = [
            { id: 1, operationtype: 'cnc', status: 'pending' }
        ];
        const allowedTypes = ['laser_co2'];
        
        expect(hasOperationsInUserRoom(ops, allowedTypes)).toBe(false);
    });
    
    test('Obsługa prefiksu path_ w typie operacji', () => {
        const ops = [
            { id: 1, operationtype: 'path_laser_co2', status: 'pending' }
        ];
        const allowedTypes = ['laser_co2'];
        
        expect(hasOperationsInUserRoom(ops, allowedTypes)).toBe(true);
    });
});

// ============================================
// TESTY: Parametr workOrdersView
// ============================================
describe('workOrdersView: Filtrowanie statusów', () => {
    
    function getStatusFilter(workOrdersView) {
        if (workOrdersView === 'completed') {
            return ['completed'];
        }
        return ['planned', 'approved', 'in_progress'];
    }
    
    test('open: zwraca tylko planned, approved, in_progress', () => {
        const filter = getStatusFilter('open');
        expect(filter).toEqual(['planned', 'approved', 'in_progress']);
        expect(filter).not.toContain('completed');
    });
    
    test('completed: zwraca tylko completed', () => {
        const filter = getStatusFilter('completed');
        expect(filter).toEqual(['completed']);
    });
    
    test('domyślnie (undefined): zwraca open', () => {
        const filter = getStatusFilter(undefined);
        expect(filter).toEqual(['planned', 'approved', 'in_progress']);
    });
});

// ============================================
// TESTY: Dołączanie completed do otwartych ZP
// ============================================
describe('Dołączanie completed pozycji do otwartych ZP', () => {
    
    function shouldIncludeCompletedInWorkOrder(workOrdersView, openWorkOrderIds, completedOrderWorkOrderId) {
        if (workOrdersView !== 'open') return false;
        return openWorkOrderIds.includes(completedOrderWorkOrderId);
    }
    
    test('W widoku open: completed pozycja z otwartego ZP powinna być dołączona', () => {
        const openWorkOrderIds = [1, 2, 3];
        const completedOrderWorkOrderId = 2;
        
        expect(shouldIncludeCompletedInWorkOrder('open', openWorkOrderIds, completedOrderWorkOrderId)).toBe(true);
    });
    
    test('W widoku open: completed pozycja z zamkniętego ZP NIE powinna być dołączona', () => {
        const openWorkOrderIds = [1, 2, 3];
        const completedOrderWorkOrderId = 99; // nie ma w otwartych
        
        expect(shouldIncludeCompletedInWorkOrder('open', openWorkOrderIds, completedOrderWorkOrderId)).toBe(false);
    });
    
    test('W widoku completed: nie dołączamy completed do otwartych', () => {
        const openWorkOrderIds = [1, 2, 3];
        const completedOrderWorkOrderId = 2;
        
        expect(shouldIncludeCompletedInWorkOrder('completed', openWorkOrderIds, completedOrderWorkOrderId)).toBe(false);
    });
});

// ============================================
// TESTY: Obliczanie postępu ZP
// ============================================
describe('Obliczanie postępu ZP', () => {
    
    function calculateProgress(orders) {
        const completedOrders = orders.filter(o => o.status === 'completed').length;
        const totalOrders = orders.length;
        const progressPercent = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0;
        const isAllCompleted = completedOrders === totalOrders && totalOrders > 0;
        
        return { completedOrders, totalOrders, progressPercent, isAllCompleted };
    }
    
    test('ZP bez pozycji: 0%', () => {
        const progress = calculateProgress([]);
        expect(progress.progressPercent).toBe(0);
        expect(progress.isAllCompleted).toBe(false);
    });
    
    test('ZP z 0/3 completed: 0%', () => {
        const orders = [
            { status: 'planned' },
            { status: 'approved' },
            { status: 'in_progress' }
        ];
        const progress = calculateProgress(orders);
        expect(progress.progressPercent).toBe(0);
        expect(progress.isAllCompleted).toBe(false);
    });
    
    test('ZP z 1/3 completed: 33%', () => {
        const orders = [
            { status: 'completed' },
            { status: 'approved' },
            { status: 'in_progress' }
        ];
        const progress = calculateProgress(orders);
        expect(progress.progressPercent).toBe(33);
        expect(progress.isAllCompleted).toBe(false);
    });
    
    test('ZP z 2/3 completed: 67%', () => {
        const orders = [
            { status: 'completed' },
            { status: 'completed' },
            { status: 'in_progress' }
        ];
        const progress = calculateProgress(orders);
        expect(progress.progressPercent).toBe(67);
        expect(progress.isAllCompleted).toBe(false);
    });
    
    test('ZP z 3/3 completed: 100% i isAllCompleted=true', () => {
        const orders = [
            { status: 'completed' },
            { status: 'completed' },
            { status: 'completed' }
        ];
        const progress = calculateProgress(orders);
        expect(progress.progressPercent).toBe(100);
        expect(progress.isAllCompleted).toBe(true);
    });
});

// ============================================
// TESTY: Parsowanie numeru matrycy z notatek
// ============================================
describe('Parsowanie numeru matrycy z notatek', () => {
    
    function parseMatrixNumber(notes) {
        if (!notes) return null;
        const match = notes.match(/MATRYCA:\s*(\S+)/i);
        return match ? match[1] : null;
    }
    
    test('Notatka z numerem matrycy: MATRYCA: 12345', () => {
        expect(parseMatrixNumber('MATRYCA: 12345')).toBe('12345');
    });
    
    test('Notatka z numerem matrycy małymi literami: matryca: ABC123', () => {
        expect(parseMatrixNumber('matryca: ABC123')).toBe('ABC123');
    });
    
    test('Notatka z numerem matrycy i dodatkowym tekstem', () => {
        expect(parseMatrixNumber('MATRYCA: 12345\nUwagi: test')).toBe('12345');
    });
    
    test('Notatka bez numeru matrycy', () => {
        expect(parseMatrixNumber('Zwykłe uwagi')).toBe(null);
    });
    
    test('Pusta notatka', () => {
        expect(parseMatrixNumber('')).toBe(null);
    });
    
    test('Null notatka', () => {
        expect(parseMatrixNumber(null)).toBe(null);
    });
});

// ============================================
// TESTY: Walidacja przełącznika widoku (tylko open/completed)
// ============================================
describe('Walidacja przełącznika widoku', () => {
    
    const WORKORDER_VIEWS = ['open', 'completed'];
    
    function isValidWorkOrdersView(view) {
        return WORKORDER_VIEWS.includes(view);
    }
    
    test('open jest prawidłowy', () => {
        expect(isValidWorkOrdersView('open')).toBe(true);
    });
    
    test('completed jest prawidłowy', () => {
        expect(isValidWorkOrdersView('completed')).toBe(true);
    });
    
    test('all NIE jest prawidłowy (usunięty z UI)', () => {
        expect(isValidWorkOrdersView('all')).toBe(false);
    });
    
    test('invalid jest nieprawidłowy', () => {
        expect(isValidWorkOrdersView('invalid')).toBe(false);
    });
    
    test('pusty string jest nieprawidłowy', () => {
        expect(isValidWorkOrdersView('')).toBe(false);
    });
    
    test('undefined jest nieprawidłowy', () => {
        expect(isValidWorkOrdersView(undefined)).toBe(false);
    });
});

// ============================================
// TESTY: Badge SLA/termin
// ============================================
describe('Badge SLA/termin', () => {
    
    function getSlaBadgeType(deliveryDate) {
        if (!deliveryDate) return null;
        
        const delivery = new Date(deliveryDate);
        delivery.setHours(0, 0, 0, 0);
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const diffDays = Math.round((delivery - today) / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) return 'overdue';
        if (diffDays === 0) return 'today';
        if (diffDays === 1) return 'tomorrow';
        if (diffDays <= 3) return 'soon';
        return null;
    }
    
    test('Termin przeterminowany: overdue', () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        expect(getSlaBadgeType(yesterday.toISOString())).toBe('overdue');
    });
    
    test('Termin dziś: today', () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        expect(getSlaBadgeType(today.toISOString())).toBe('today');
    });
    
    test('Termin jutro: tomorrow', () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        expect(getSlaBadgeType(tomorrow.toISOString())).toBe('tomorrow');
    });
    
    test('Termin za 2-3 dni: soon', () => {
        const inTwoDays = new Date();
        inTwoDays.setDate(inTwoDays.getDate() + 2);
        inTwoDays.setHours(0, 0, 0, 0);
        expect(getSlaBadgeType(inTwoDays.toISOString())).toBe('soon');
    });
    
    test('Termin za 4+ dni: null (brak badge)', () => {
        const inFiveDays = new Date();
        inFiveDays.setDate(inFiveDays.getDate() + 5);
        inFiveDays.setHours(0, 0, 0, 0);
        expect(getSlaBadgeType(inFiveDays.toISOString())).toBe(null);
    });
    
    test('Brak terminu: null', () => {
        expect(getSlaBadgeType(null)).toBe(null);
    });
});

// ============================================
// TESTY: Optymistyczne aktualizacje UI
// ============================================
describe('Optymistyczne aktualizacje UI', () => {
    
    function updateOrderStatus(orders, orderId, newStatus) {
        const orderIndex = orders.findIndex(o => o.id === orderId || String(o.id) === String(orderId));
        if (orderIndex === -1) return null;
        
        orders[orderIndex].status = newStatus;
        return orders[orderIndex];
    }
    
    test('Aktualizacja statusu zlecenia na in_progress', () => {
        const orders = [
            { id: 1, status: 'approved' },
            { id: 2, status: 'planned' }
        ];
        
        const updated = updateOrderStatus(orders, 1, 'in_progress');
        expect(updated.status).toBe('in_progress');
        expect(orders[0].status).toBe('in_progress');
    });
    
    test('Aktualizacja statusu zlecenia na completed', () => {
        const orders = [
            { id: 1, status: 'in_progress' }
        ];
        
        const updated = updateOrderStatus(orders, 1, 'completed');
        expect(updated.status).toBe('completed');
    });
    
    test('Aktualizacja nieistniejącego zlecenia zwraca null', () => {
        const orders = [
            { id: 1, status: 'approved' }
        ];
        
        const updated = updateOrderStatus(orders, 999, 'in_progress');
        expect(updated).toBe(null);
    });
    
    test('Aktualizacja po string ID', () => {
        const orders = [
            { id: 'abc-123', status: 'approved' }
        ];
        
        const updated = updateOrderStatus(orders, 'abc-123', 'in_progress');
        expect(updated.status).toBe('in_progress');
    });
});

// ============================================
// TESTY: Stan otwarcia kafelków (localStorage)
// ============================================
describe('Stan otwarcia kafelków', () => {
    
    function toggleWorkOrderOpen(openSet, woId) {
        const idStr = String(woId);
        if (openSet.has(idStr)) {
            openSet.delete(idStr);
            return false;
        } else {
            openSet.add(idStr);
            return true;
        }
    }
    
    test('Toggle zamkniętego kafelka otwiera go', () => {
        const openSet = new Set();
        const isNowOpen = toggleWorkOrderOpen(openSet, 1);
        
        expect(isNowOpen).toBe(true);
        expect(openSet.has('1')).toBe(true);
    });
    
    test('Toggle otwartego kafelka zamyka go', () => {
        const openSet = new Set(['1']);
        const isNowOpen = toggleWorkOrderOpen(openSet, 1);
        
        expect(isNowOpen).toBe(false);
        expect(openSet.has('1')).toBe(false);
    });
    
    test('Wielokrotny toggle przełącza stan', () => {
        const openSet = new Set();
        
        toggleWorkOrderOpen(openSet, 1); // open
        toggleWorkOrderOpen(openSet, 1); // close
        toggleWorkOrderOpen(openSet, 1); // open
        
        expect(openSet.has('1')).toBe(true);
    });
    
    test('Różne kafelki są niezależne', () => {
        const openSet = new Set();
        
        toggleWorkOrderOpen(openSet, 1);
        toggleWorkOrderOpen(openSet, 2);
        toggleWorkOrderOpen(openSet, 1); // close 1
        
        expect(openSet.has('1')).toBe(false);
        expect(openSet.has('2')).toBe(true);
    });
});

console.log('Testy workorders-view.test.js załadowane');
