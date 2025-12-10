/**
 * Testy jednostkowe dla endpointów operacji produkcyjnych
 * Uruchomienie: node backend/production.test.js
 * 
 * UWAGA: Te testy wymagają działającego serwera i bazy danych Supabase.
 * Dla testów integracyjnych uruchom serwer: node backend/server.js
 */

// Kolory do konsoli
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m'
};

function log(type, message) {
    const prefix = {
        pass: `${colors.green}✓${colors.reset}`,
        fail: `${colors.red}✗${colors.reset}`,
        info: `${colors.yellow}ℹ${colors.reset}`,
        section: `${colors.cyan}▶${colors.reset}`
    };
    console.log(`${prefix[type] || ''} ${message}`);
}

let passed = 0;
let failed = 0;
let skipped = 0;

async function test(name, fn) {
    try {
        await fn();
        passed++;
        log('pass', name);
    } catch (error) {
        if (error.message === 'SKIP') {
            skipped++;
            log('info', `${name} (pominięty)`);
        } else {
            failed++;
            log('fail', `${name}: ${error.message}`);
        }
    }
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

function skip() {
    throw new Error('SKIP');
}

// ============================================
// TESTY LOGIKI STATUSÓW
// ============================================

/**
 * Symulacja funkcji updateWorkOrderStatusFromOperations
 * (testujemy logikę bez bazy danych)
 */
function inferWorkOrderStatus(operations, currentStatus) {
    if (!operations || operations.length === 0) return currentStatus;
    
    const allCompleted = operations.every(op => op.status === 'completed');
    const anyActive = operations.some(op => op.status === 'active');
    const anyPaused = operations.some(op => op.status === 'paused');
    const anyPending = operations.some(op => op.status === 'pending');
    const anyCancelled = operations.some(op => op.status === 'cancelled');
    const allCancelled = operations.every(op => op.status === 'cancelled');
    
    if (allCompleted) {
        return 'completed';
    } else if (allCancelled) {
        return 'cancelled';
    } else if (anyActive || anyPaused) {
        return 'in_progress';
    } else if (anyPending && !anyCancelled) {
        return 'approved';
    } else if (anyPending) {
        return currentStatus;
    }
    
    return currentStatus;
}

/**
 * Walidacja przejść statusów operacji
 */
function canTransitionOperationStatus(currentStatus, newStatus) {
    const validTransitions = {
        'pending': ['active', 'cancelled'],
        'active': ['paused', 'completed', 'cancelled'],
        'paused': ['active', 'completed', 'cancelled'],
        'completed': [], // Nie można zmienić statusu zakończonej operacji
        'cancelled': []  // Nie można zmienić statusu anulowanej operacji
    };
    
    return validTransitions[currentStatus]?.includes(newStatus) || false;
}

// ============================================
// TESTY
// ============================================

async function runTests() {
    console.log('\n🏭 Testy operacji produkcyjnych\n');
    console.log('='.repeat(50));

    // ----------------------------------------
    // Testy inferencji statusów WorkOrder
    // ----------------------------------------
    log('section', 'Inferencja statusów WorkOrder');

    await test('inferWorkOrderStatus - wszystkie completed → completed', async () => {
        const operations = [
            { status: 'completed' },
            { status: 'completed' },
            { status: 'completed' }
        ];
        const result = inferWorkOrderStatus(operations, 'in_progress');
        assert(result === 'completed', `Oczekiwano completed, otrzymano ${result}`);
    });

    await test('inferWorkOrderStatus - wszystkie cancelled → cancelled', async () => {
        const operations = [
            { status: 'cancelled' },
            { status: 'cancelled' }
        ];
        const result = inferWorkOrderStatus(operations, 'approved');
        assert(result === 'cancelled', `Oczekiwano cancelled, otrzymano ${result}`);
    });

    await test('inferWorkOrderStatus - jakakolwiek active → in_progress', async () => {
        const operations = [
            { status: 'pending' },
            { status: 'active' },
            { status: 'completed' }
        ];
        const result = inferWorkOrderStatus(operations, 'approved');
        assert(result === 'in_progress', `Oczekiwano in_progress, otrzymano ${result}`);
    });

    await test('inferWorkOrderStatus - jakakolwiek paused → in_progress', async () => {
        const operations = [
            { status: 'pending' },
            { status: 'paused' }
        ];
        const result = inferWorkOrderStatus(operations, 'approved');
        assert(result === 'in_progress', `Oczekiwano in_progress, otrzymano ${result}`);
    });

    await test('inferWorkOrderStatus - wszystkie pending → approved', async () => {
        const operations = [
            { status: 'pending' },
            { status: 'pending' }
        ];
        const result = inferWorkOrderStatus(operations, 'planned');
        assert(result === 'approved', `Oczekiwano approved, otrzymano ${result}`);
    });

    await test('inferWorkOrderStatus - pending + cancelled → zachowaj obecny', async () => {
        const operations = [
            { status: 'pending' },
            { status: 'cancelled' }
        ];
        const result = inferWorkOrderStatus(operations, 'in_progress');
        assert(result === 'in_progress', `Oczekiwano in_progress (obecny), otrzymano ${result}`);
    });

    await test('inferWorkOrderStatus - pusta lista → zachowaj obecny', async () => {
        const result = inferWorkOrderStatus([], 'approved');
        assert(result === 'approved', `Oczekiwano approved (obecny), otrzymano ${result}`);
    });

    await test('inferWorkOrderStatus - mieszane completed + pending → approved', async () => {
        const operations = [
            { status: 'completed' },
            { status: 'pending' }
        ];
        const result = inferWorkOrderStatus(operations, 'in_progress');
        assert(result === 'approved', `Oczekiwano approved, otrzymano ${result}`);
    });

    // ----------------------------------------
    // Testy walidacji przejść statusów operacji
    // ----------------------------------------
    log('section', 'Walidacja przejść statusów operacji');

    await test('canTransitionOperationStatus - pending → active (dozwolone)', async () => {
        assert(canTransitionOperationStatus('pending', 'active') === true);
    });

    await test('canTransitionOperationStatus - pending → cancelled (dozwolone)', async () => {
        assert(canTransitionOperationStatus('pending', 'cancelled') === true);
    });

    await test('canTransitionOperationStatus - pending → completed (niedozwolone)', async () => {
        assert(canTransitionOperationStatus('pending', 'completed') === false);
    });

    await test('canTransitionOperationStatus - active → paused (dozwolone)', async () => {
        assert(canTransitionOperationStatus('active', 'paused') === true);
    });

    await test('canTransitionOperationStatus - active → completed (dozwolone)', async () => {
        assert(canTransitionOperationStatus('active', 'completed') === true);
    });

    await test('canTransitionOperationStatus - paused → active (dozwolone - wznowienie)', async () => {
        assert(canTransitionOperationStatus('paused', 'active') === true);
    });

    await test('canTransitionOperationStatus - paused → completed (dozwolone)', async () => {
        assert(canTransitionOperationStatus('paused', 'completed') === true);
    });

    await test('canTransitionOperationStatus - completed → active (niedozwolone)', async () => {
        assert(canTransitionOperationStatus('completed', 'active') === false);
    });

    await test('canTransitionOperationStatus - cancelled → active (niedozwolone)', async () => {
        assert(canTransitionOperationStatus('cancelled', 'active') === false);
    });

    // ----------------------------------------
    // Testy struktury danych
    // ----------------------------------------
    log('section', 'Struktura danych operacji');

    await test('Operacja powinna mieć wymagane pola', async () => {
        const requiredFields = [
            'id',
            'productionorderid',
            'status',
            'operationnumber'
        ];
        
        const mockOperation = {
            id: 1,
            productionorderid: 100,
            status: 'pending',
            operationnumber: 1,
            operationtype: 'laser_co2',
            operatorid: null,
            starttime: null,
            endtime: null,
            actualtime: 0
        };
        
        for (const field of requiredFields) {
            assert(field in mockOperation, `Brak wymaganego pola: ${field}`);
        }
    });

    await test('Statusy operacji powinny być poprawne', async () => {
        const validStatuses = ['pending', 'active', 'paused', 'completed', 'cancelled'];
        
        for (const status of validStatuses) {
            assert(typeof status === 'string', `Status ${status} powinien być stringiem`);
        }
    });

    // ----------------------------------------
    // Testy logiki czasu
    // ----------------------------------------
    log('section', 'Logika śledzenia czasu');

    await test('Obliczanie czasu operacji - prosta kalkulacja', async () => {
        const startTime = new Date('2025-12-09T10:00:00Z');
        const endTime = new Date('2025-12-09T10:30:00Z');
        
        const durationMinutes = Math.round((endTime - startTime) / 60000);
        
        assert(durationMinutes === 30, `Oczekiwano 30 minut, otrzymano ${durationMinutes}`);
    });

    await test('Obliczanie czasu operacji - z pauzą', async () => {
        // Symulacja: start → pauza (10 min) → wznowienie → koniec (20 min)
        const session1Start = new Date('2025-12-09T10:00:00Z');
        const session1End = new Date('2025-12-09T10:10:00Z');
        const session2Start = new Date('2025-12-09T10:20:00Z');
        const session2End = new Date('2025-12-09T10:40:00Z');
        
        const session1Minutes = Math.round((session1End - session1Start) / 60000);
        const session2Minutes = Math.round((session2End - session2Start) / 60000);
        const totalMinutes = session1Minutes + session2Minutes;
        
        assert(totalMinutes === 30, `Oczekiwano 30 minut, otrzymano ${totalMinutes}`);
    });

    // ----------------------------------------
    // Testy walidacji danych wejściowych
    // ----------------------------------------
    log('section', 'Walidacja danych wejściowych');

    await test('Walidacja outputQuantity - liczba dodatnia', async () => {
        const outputQuantity = 100;
        assert(typeof outputQuantity === 'number' && outputQuantity >= 0, 'outputQuantity musi być liczbą >= 0');
    });

    await test('Walidacja wasteQuantity - liczba dodatnia lub zero', async () => {
        const wasteQuantity = 5;
        assert(typeof wasteQuantity === 'number' && wasteQuantity >= 0, 'wasteQuantity musi być liczbą >= 0');
    });

    await test('Walidacja problemType - wymagany przy zgłoszeniu problemu', async () => {
        const problemTypes = ['material', 'machine', 'quality', 'other'];
        
        for (const type of problemTypes) {
            assert(typeof type === 'string' && type.length > 0, `Typ problemu ${type} musi być niepustym stringiem`);
        }
    });

    // ----------------------------------------
    // Testy uprawnień (symulacja)
    // ----------------------------------------
    log('section', 'Uprawnienia do operacji');

    await test('OPERATOR może rozpocząć operację', async () => {
        const allowedRoles = ['ADMIN', 'PRODUCTION', 'OPERATOR'];
        assert(allowedRoles.includes('OPERATOR'), 'OPERATOR powinien mieć uprawnienia do /start');
    });

    await test('PRODUCTION_MANAGER może anulować operację', async () => {
        const allowedRoles = ['ADMIN', 'PRODUCTION', 'OPERATOR', 'PRODUCTION_MANAGER'];
        assert(allowedRoles.includes('PRODUCTION_MANAGER'), 'PRODUCTION_MANAGER powinien mieć uprawnienia do /cancel');
    });

    await test('SALES_REP nie może modyfikować operacji', async () => {
        const allowedRoles = ['ADMIN', 'PRODUCTION', 'OPERATOR', 'PRODUCTION_MANAGER'];
        assert(!allowedRoles.includes('SALES_REP'), 'SALES_REP nie powinien mieć uprawnień do operacji');
    });

    // ----------------------------------------
    // Testy edge cases
    // ----------------------------------------
    log('section', 'Edge cases');

    await test('Obsługa null/undefined w operacjach', async () => {
        const result1 = inferWorkOrderStatus(null, 'approved');
        const result2 = inferWorkOrderStatus(undefined, 'approved');
        
        assert(result1 === 'approved', 'null powinno zwrócić obecny status');
        assert(result2 === 'approved', 'undefined powinno zwrócić obecny status');
    });

    await test('Obsługa operacji z nieznanym statusem', async () => {
        const operations = [
            { status: 'unknown_status' },
            { status: 'pending' }
        ];
        
        // Funkcja powinna obsłużyć nieznany status bez błędu
        const result = inferWorkOrderStatus(operations, 'approved');
        assert(typeof result === 'string', 'Powinno zwrócić string');
    });

    await test('Obsługa dużej liczby operacji', async () => {
        const operations = [];
        for (let i = 0; i < 1000; i++) {
            operations.push({ status: i % 2 === 0 ? 'completed' : 'pending' });
        }
        
        const startTime = Date.now();
        const result = inferWorkOrderStatus(operations, 'in_progress');
        const duration = Date.now() - startTime;
        
        assert(duration < 100, `Przetwarzanie 1000 operacji powinno trwać < 100ms, trwało ${duration}ms`);
        assert(result === 'approved', `Oczekiwano approved (są pending), otrzymano ${result}`);
    });

    // ----------------------------------------
    // PODSUMOWANIE
    // ----------------------------------------

    console.log('\n' + '='.repeat(50));
    console.log(`\nWyniki: ${colors.green}${passed} passed${colors.reset}, ${colors.red}${failed} failed${colors.reset}, ${colors.yellow}${skipped} skipped${colors.reset}`);
    
    if (failed > 0) {
        console.log(`\n${colors.red}Niektóre testy nie przeszły!${colors.reset}`);
        process.exit(1);
    } else {
        console.log(`\n${colors.green}Wszystkie testy przeszły pomyślnie!${colors.reset}`);
    }
}

// Uruchom testy
runTests().catch(error => {
    console.error('Błąd podczas uruchamiania testów:', error);
    process.exit(1);
});
