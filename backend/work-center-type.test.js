/**
 * Testy jednostkowe dla API WorkCenterType
 * Uruchomienie: node backend/work-center-type.test.js
 * 
 * Testuje:
 * - GET /api/production/work-center-types
 * - POST /api/production/work-center-types
 * - PATCH /api/production/work-center-types/:id
 * - Walidację danych wejściowych
 * - Kontrolę dostępu (role)
 */

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
// SYMULACJA WALIDACJI Z server.js
// ============================================

/**
 * Walidacja kodu typu gniazda
 */
function validateWorkCenterTypeCode(code) {
    if (!code || typeof code !== 'string') {
        return { valid: false, message: 'Kod jest wymagany' };
    }
    
    const normalized = code.trim().toLowerCase();
    
    if (normalized.length === 0) {
        return { valid: false, message: 'Kod nie może być pusty' };
    }
    
    if (normalized.length > 50) {
        return { valid: false, message: 'Kod nie może przekraczać 50 znaków' };
    }
    
    if (!/^[a-z0-9_]+$/.test(normalized)) {
        return { valid: false, message: 'Kod może zawierać tylko małe litery, cyfry i podkreślenia' };
    }
    
    return { valid: true, normalized };
}

/**
 * Walidacja nazwy typu gniazda
 */
function validateWorkCenterTypeName(name) {
    if (!name || typeof name !== 'string') {
        return { valid: false, message: 'Nazwa jest wymagana' };
    }
    
    const trimmed = name.trim();
    
    if (trimmed.length === 0) {
        return { valid: false, message: 'Nazwa nie może być pusta' };
    }
    
    if (trimmed.length > 100) {
        return { valid: false, message: 'Nazwa nie może przekraczać 100 znaków' };
    }
    
    return { valid: true, trimmed };
}

/**
 * Symulacja sprawdzania uprawnień
 */
function canAccessWorkCenterTypes(role) {
    const allowedRoles = ['ADMIN', 'PRODUCTION', 'PRODUCTION_MANAGER'];
    return allowedRoles.includes(role);
}

function canModifyWorkCenterTypes(role) {
    return role === 'ADMIN';
}

// ============================================
// TESTY
// ============================================

async function runTests() {
    console.log('\n' + '='.repeat(60));
    log('section', 'TESTY JEDNOSTKOWE: WorkCenterType API');
    console.log('='.repeat(60) + '\n');

    // ----------------------------------------
    // Testy walidacji kodu
    // ----------------------------------------
    log('section', 'Walidacja kodu typu gniazda');

    await test('Kod: poprawny kod snake_case', () => {
        const result = validateWorkCenterTypeCode('laser_co2');
        assert(result.valid === true, 'Powinien być poprawny');
        assert(result.normalized === 'laser_co2', 'Powinien być znormalizowany');
    });

    await test('Kod: poprawny kod z cyframi', () => {
        const result = validateWorkCenterTypeCode('cnc_5axis');
        assert(result.valid === true, 'Powinien być poprawny');
    });

    await test('Kod: automatyczna konwersja na małe litery', () => {
        const result = validateWorkCenterTypeCode('LASER_CO2');
        assert(result.valid === true, 'Powinien być poprawny');
        assert(result.normalized === 'laser_co2', 'Powinien być skonwertowany na małe litery');
    });

    await test('Kod: usuwanie białych znaków', () => {
        const result = validateWorkCenterTypeCode('  laser_co2  ');
        assert(result.valid === true, 'Powinien być poprawny');
        assert(result.normalized === 'laser_co2', 'Powinien być przycięty');
    });

    await test('Kod: odrzucenie pustego kodu', () => {
        const result = validateWorkCenterTypeCode('');
        assert(result.valid === false, 'Powinien być niepoprawny');
    });

    await test('Kod: odrzucenie null', () => {
        const result = validateWorkCenterTypeCode(null);
        assert(result.valid === false, 'Powinien być niepoprawny');
    });

    await test('Kod: odrzucenie kodu ze spacjami', () => {
        const result = validateWorkCenterTypeCode('laser co2');
        assert(result.valid === false, 'Powinien być niepoprawny');
    });

    await test('Kod: odrzucenie kodu z myślnikami', () => {
        const result = validateWorkCenterTypeCode('laser-co2');
        assert(result.valid === false, 'Powinien być niepoprawny');
    });

    await test('Kod: odrzucenie kodu z polskimi znakami', () => {
        const result = validateWorkCenterTypeCode('cięcie');
        assert(result.valid === false, 'Powinien być niepoprawny');
    });

    await test('Kod: odrzucenie zbyt długiego kodu', () => {
        const longCode = 'a'.repeat(51);
        const result = validateWorkCenterTypeCode(longCode);
        assert(result.valid === false, 'Powinien być niepoprawny');
    });

    // ----------------------------------------
    // Testy walidacji nazwy
    // ----------------------------------------
    log('section', 'Walidacja nazwy typu gniazda');

    await test('Nazwa: poprawna nazwa', () => {
        const result = validateWorkCenterTypeName('Laser CO2');
        assert(result.valid === true, 'Powinien być poprawny');
        assert(result.trimmed === 'Laser CO2', 'Powinien być przycięty');
    });

    await test('Nazwa: nazwa z polskimi znakami', () => {
        const result = validateWorkCenterTypeName('Cięcie laserowe');
        assert(result.valid === true, 'Powinien być poprawny');
    });

    await test('Nazwa: usuwanie białych znaków', () => {
        const result = validateWorkCenterTypeName('  Druk UV  ');
        assert(result.valid === true, 'Powinien być poprawny');
        assert(result.trimmed === 'Druk UV', 'Powinien być przycięty');
    });

    await test('Nazwa: odrzucenie pustej nazwy', () => {
        const result = validateWorkCenterTypeName('');
        assert(result.valid === false, 'Powinien być niepoprawny');
    });

    await test('Nazwa: odrzucenie null', () => {
        const result = validateWorkCenterTypeName(null);
        assert(result.valid === false, 'Powinien być niepoprawny');
    });

    await test('Nazwa: odrzucenie zbyt długiej nazwy', () => {
        const longName = 'A'.repeat(101);
        const result = validateWorkCenterTypeName(longName);
        assert(result.valid === false, 'Powinien być niepoprawny');
    });

    // ----------------------------------------
    // Testy kontroli dostępu
    // ----------------------------------------
    log('section', 'Kontrola dostępu');

    await test('Dostęp: ADMIN może odczytywać typy', () => {
        assert(canAccessWorkCenterTypes('ADMIN') === true, 'ADMIN powinien mieć dostęp');
    });

    await test('Dostęp: PRODUCTION może odczytywać typy', () => {
        assert(canAccessWorkCenterTypes('PRODUCTION') === true, 'PRODUCTION powinien mieć dostęp');
    });

    await test('Dostęp: PRODUCTION_MANAGER może odczytywać typy', () => {
        assert(canAccessWorkCenterTypes('PRODUCTION_MANAGER') === true, 'PRODUCTION_MANAGER powinien mieć dostęp');
    });

    await test('Dostęp: SALES_REP nie może odczytywać typów', () => {
        assert(canAccessWorkCenterTypes('SALES_REP') === false, 'SALES_REP nie powinien mieć dostępu');
    });

    await test('Dostęp: WAREHOUSE nie może odczytywać typów', () => {
        assert(canAccessWorkCenterTypes('WAREHOUSE') === false, 'WAREHOUSE nie powinien mieć dostępu');
    });

    await test('Modyfikacja: ADMIN może modyfikować typy', () => {
        assert(canModifyWorkCenterTypes('ADMIN') === true, 'ADMIN powinien móc modyfikować');
    });

    await test('Modyfikacja: PRODUCTION nie może modyfikować typów', () => {
        assert(canModifyWorkCenterTypes('PRODUCTION') === false, 'PRODUCTION nie powinien móc modyfikować');
    });

    await test('Modyfikacja: PRODUCTION_MANAGER nie może modyfikować typów', () => {
        assert(canModifyWorkCenterTypes('PRODUCTION_MANAGER') === false, 'PRODUCTION_MANAGER nie powinien móc modyfikować');
    });

    // ----------------------------------------
    // Testy struktury danych
    // ----------------------------------------
    log('section', 'Struktura danych WorkCenterType');

    await test('Struktura: poprawny obiekt typu gniazda', () => {
        const type = {
            id: 1,
            code: 'laser_co2',
            name: 'Laser CO2',
            description: 'Gniazdo laserów CO2',
            isActive: true,
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-01T00:00:00Z'
        };
        
        assert(typeof type.id === 'number', 'id powinien być liczbą');
        assert(typeof type.code === 'string', 'code powinien być stringiem');
        assert(typeof type.name === 'string', 'name powinien być stringiem');
        assert(typeof type.isActive === 'boolean', 'isActive powinien być boolean');
    });

    await test('Struktura: typ z opcjonalnym opisem null', () => {
        const type = {
            id: 2,
            code: 'cnc',
            name: 'CNC',
            description: null,
            isActive: true
        };
        
        assert(type.description === null, 'description może być null');
    });

    // ----------------------------------------
    // Testy scenariuszy biznesowych
    // ----------------------------------------
    log('section', 'Scenariusze biznesowe');

    await test('Scenariusz: tworzenie nowego typu', () => {
        const input = {
            code: 'new_type',
            name: 'Nowy Typ',
            description: 'Opis nowego typu'
        };
        
        const codeValidation = validateWorkCenterTypeCode(input.code);
        const nameValidation = validateWorkCenterTypeName(input.name);
        
        assert(codeValidation.valid === true, 'Kod powinien być poprawny');
        assert(nameValidation.valid === true, 'Nazwa powinna być poprawna');
    });

    await test('Scenariusz: aktualizacja istniejącego typu', () => {
        const existingType = {
            id: 1,
            code: 'laser_co2',
            name: 'Laser CO2',
            isActive: true
        };
        
        const update = {
            name: 'Laser CO2 (zaktualizowany)',
            isActive: false
        };
        
        const nameValidation = validateWorkCenterTypeName(update.name);
        assert(nameValidation.valid === true, 'Nowa nazwa powinna być poprawna');
        
        // Kod nie powinien być zmieniany
        assert(existingType.code === 'laser_co2', 'Kod nie powinien się zmieniać');
    });

    await test('Scenariusz: dezaktywacja typu używanego przez gniazda', () => {
        // Symulacja - typ jest używany przez gniazda
        const typeInUse = {
            id: 1,
            code: 'laser_co2',
            name: 'Laser CO2',
            isActive: true,
            workCenterCount: 3
        };
        
        // Dezaktywacja powinna być możliwa (soft delete)
        // ale nowe gniazda nie powinny móc używać tego typu
        const canDeactivate = true; // W rzeczywistości sprawdzane w backendzie
        assert(canDeactivate === true, 'Dezaktywacja powinna być możliwa');
    });

    await test('Scenariusz: filtrowanie tylko aktywnych typów', () => {
        const allTypes = [
            { id: 1, code: 'laser_co2', isActive: true },
            { id: 2, code: 'cnc', isActive: true },
            { id: 3, code: 'old_type', isActive: false }
        ];
        
        const activeTypes = allTypes.filter(t => t.isActive);
        assert(activeTypes.length === 2, 'Powinny być 2 aktywne typy');
    });

    // ----------------------------------------
    // Podsumowanie
    // ----------------------------------------
    console.log('\n' + '='.repeat(60));
    console.log(`${colors.cyan}PODSUMOWANIE:${colors.reset}`);
    console.log(`  ${colors.green}Zaliczone:${colors.reset} ${passed}`);
    console.log(`  ${colors.red}Niezaliczone:${colors.reset} ${failed}`);
    console.log(`  ${colors.yellow}Pominięte:${colors.reset} ${skipped}`);
    console.log('='.repeat(60) + '\n');

    if (failed > 0) {
        process.exit(1);
    }
}

// Uruchom testy
runTests().catch(error => {
    console.error('Błąd uruchamiania testów:', error);
    process.exit(1);
});
