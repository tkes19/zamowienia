/**
 * Testy jednostkowe dla systemu ról i uprawnień MES
 * Uruchomienie: node backend/roles-permissions.test.js
 * 
 * Testuje:
 * - Hierarchię ról produkcyjnych
 * - Helpery uprawnień (getRoomAccessLevel, canManageRoomAssignments, etc.)
 * - Wielorole użytkowników
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
// SYMULACJA HELPERÓW Z server.js
// ============================================

/**
 * Enum ról użytkowników (MES-compliant)
 */
const UserRole = {
    ADMIN: 'ADMIN',
    PRODUCTION_MANAGER: 'PRODUCTION_MANAGER',
    PRODUCTION: 'PRODUCTION',           // Brygadzista
    OPERATOR: 'OPERATOR',
    GRAPHIC_DESIGNER: 'GRAPHIC_DESIGNER',
    WAREHOUSE: 'WAREHOUSE',
    SALES_REP: 'SALES_REP',
    SALES_DEPT: 'SALES_DEPT',
    GRAPHICS: 'GRAPHICS',               // Legacy
    NEW_USER: 'NEW_USER'
};

/**
 * Poziomy dostępu do pokoju produkcyjnego
 */
const RoomAccessLevel = {
    NONE: 'none',
    VIEW: 'view',
    OPERATE: 'operate',
    MANAGE: 'manage',
    FULL: 'full'
};

/**
 * Symulacja getRoomAccessLevel
 */
function getRoomAccessLevel(userRole, userId, room) {
    // ADMIN ma pełny dostęp
    if (userRole === UserRole.ADMIN) {
        return RoomAccessLevel.FULL;
    }
    
    // PRODUCTION_MANAGER ma dostęp do zarządzania wszystkimi pokojami
    if (userRole === UserRole.PRODUCTION_MANAGER) {
        return RoomAccessLevel.MANAGE;
    }
    
    // Sprawdź czy użytkownik jest Room Managerem
    if (room?.roomManagerUserId === userId) {
        return RoomAccessLevel.MANAGE;
    }
    
    // Sprawdź czy użytkownik jest supervisorem
    if (room?.supervisorId === userId) {
        return RoomAccessLevel.MANAGE;
    }
    
    // PRODUCTION (brygadzista) ma dostęp do operowania
    if (userRole === UserRole.PRODUCTION) {
        return RoomAccessLevel.OPERATE;
    }
    
    // OPERATOR ma dostęp do operowania tylko w przypisanym pokoju
    if (userRole === UserRole.OPERATOR) {
        // Sprawdź czy operator jest przypisany do pokoju
        const isAssigned = room?.operators?.some(op => op.userId === userId);
        if (isAssigned || room?.productionRoomId === userId) {
            return RoomAccessLevel.OPERATE;
        }
        return RoomAccessLevel.VIEW;
    }
    
    // GRAPHIC_DESIGNER ma dostęp do podglądu
    if (userRole === UserRole.GRAPHIC_DESIGNER || userRole === UserRole.GRAPHICS) {
        return RoomAccessLevel.VIEW;
    }
    
    // Pozostałe role - brak dostępu
    return RoomAccessLevel.NONE;
}

/**
 * Symulacja canManageRoomAssignments
 */
function canManageRoomAssignments(userRole, userId, room) {
    const accessLevel = getRoomAccessLevel(userRole, userId, room);
    return accessLevel === RoomAccessLevel.FULL || accessLevel === RoomAccessLevel.MANAGE;
}

/**
 * Symulacja canViewRoom
 */
function canViewRoom(userRole, userId, room) {
    const accessLevel = getRoomAccessLevel(userRole, userId, room);
    return accessLevel !== RoomAccessLevel.NONE;
}

/**
 * Symulacja canOperateInRoom
 */
function canOperateInRoom(userRole, userId, room) {
    const accessLevel = getRoomAccessLevel(userRole, userId, room);
    return [RoomAccessLevel.OPERATE, RoomAccessLevel.MANAGE, RoomAccessLevel.FULL].includes(accessLevel);
}

/**
 * Sprawdza czy użytkownik ma daną rolę (z uwzględnieniem wieloról)
 */
function hasRole(userRole, activeRoles, requiredRole) {
    if (userRole === requiredRole) return true;
    if (Array.isArray(activeRoles)) {
        return activeRoles.includes(requiredRole);
    }
    return false;
}

/**
 * Sprawdza czy użytkownik ma którąkolwiek z wymaganych ról
 */
function hasAnyRole(userRole, activeRoles, requiredRoles) {
    return requiredRoles.some(role => hasRole(userRole, activeRoles, role));
}

// ============================================
// TESTY
// ============================================

async function runTests() {
    console.log('\n🔐 Testy systemu ról i uprawnień MES\n');
    console.log('='.repeat(50));

    // ----------------------------------------
    // Testy hierarchii ról
    // ----------------------------------------
    log('section', 'Hierarchia ról produkcyjnych');

    await test('ADMIN ma pełny dostęp do pokoju', async () => {
        const room = { id: 'room-1', name: 'Pokój A' };
        const level = getRoomAccessLevel(UserRole.ADMIN, 'user-1', room);
        assert(level === RoomAccessLevel.FULL, `Oczekiwano FULL, otrzymano ${level}`);
    });

    await test('PRODUCTION_MANAGER ma dostęp MANAGE do wszystkich pokojów', async () => {
        const room = { id: 'room-1', name: 'Pokój A' };
        const level = getRoomAccessLevel(UserRole.PRODUCTION_MANAGER, 'user-1', room);
        assert(level === RoomAccessLevel.MANAGE, `Oczekiwano MANAGE, otrzymano ${level}`);
    });

    await test('PRODUCTION (brygadzista) ma dostęp OPERATE', async () => {
        const room = { id: 'room-1', name: 'Pokój A' };
        const level = getRoomAccessLevel(UserRole.PRODUCTION, 'user-1', room);
        assert(level === RoomAccessLevel.OPERATE, `Oczekiwano OPERATE, otrzymano ${level}`);
    });

    await test('OPERATOR przypisany do pokoju ma dostęp OPERATE', async () => {
        const room = { 
            id: 'room-1', 
            name: 'Pokój A',
            operators: [{ userId: 'operator-1' }]
        };
        const level = getRoomAccessLevel(UserRole.OPERATOR, 'operator-1', room);
        assert(level === RoomAccessLevel.OPERATE, `Oczekiwano OPERATE, otrzymano ${level}`);
    });

    await test('OPERATOR nieprzypisany do pokoju ma tylko VIEW', async () => {
        const room = { 
            id: 'room-1', 
            name: 'Pokój A',
            operators: [{ userId: 'other-operator' }]
        };
        const level = getRoomAccessLevel(UserRole.OPERATOR, 'operator-1', room);
        assert(level === RoomAccessLevel.VIEW, `Oczekiwano VIEW, otrzymano ${level}`);
    });

    await test('GRAPHIC_DESIGNER ma dostęp VIEW', async () => {
        const room = { id: 'room-1', name: 'Pokój A' };
        const level = getRoomAccessLevel(UserRole.GRAPHIC_DESIGNER, 'user-1', room);
        assert(level === RoomAccessLevel.VIEW, `Oczekiwano VIEW, otrzymano ${level}`);
    });

    await test('SALES_REP nie ma dostępu do pokoju produkcyjnego', async () => {
        const room = { id: 'room-1', name: 'Pokój A' };
        const level = getRoomAccessLevel(UserRole.SALES_REP, 'user-1', room);
        assert(level === RoomAccessLevel.NONE, `Oczekiwano NONE, otrzymano ${level}`);
    });

    // ----------------------------------------
    // Testy Room Manager
    // ----------------------------------------
    log('section', 'Room Manager');

    await test('Room Manager ma dostęp MANAGE do swojego pokoju', async () => {
        const room = { 
            id: 'room-1', 
            name: 'Pokój A',
            roomManagerUserId: 'manager-1'
        };
        const level = getRoomAccessLevel(UserRole.PRODUCTION, 'manager-1', room);
        assert(level === RoomAccessLevel.MANAGE, `Oczekiwano MANAGE, otrzymano ${level}`);
    });

    await test('Supervisor ma dostęp MANAGE do swojego pokoju', async () => {
        const room = { 
            id: 'room-1', 
            name: 'Pokój A',
            supervisorId: 'supervisor-1'
        };
        const level = getRoomAccessLevel(UserRole.PRODUCTION, 'supervisor-1', room);
        assert(level === RoomAccessLevel.MANAGE, `Oczekiwano MANAGE, otrzymano ${level}`);
    });

    await test('Room Manager może zarządzać przypisaniami', async () => {
        const room = { 
            id: 'room-1', 
            roomManagerUserId: 'manager-1'
        };
        const canManage = canManageRoomAssignments(UserRole.PRODUCTION, 'manager-1', room);
        assert(canManage === true, 'Room Manager powinien móc zarządzać przypisaniami');
    });

    await test('Zwykły PRODUCTION nie może zarządzać przypisaniami', async () => {
        const room = { 
            id: 'room-1', 
            roomManagerUserId: 'other-manager'
        };
        const canManage = canManageRoomAssignments(UserRole.PRODUCTION, 'user-1', room);
        assert(canManage === false, 'Zwykły PRODUCTION nie powinien móc zarządzać przypisaniami');
    });

    // ----------------------------------------
    // Testy helperów uprawnień
    // ----------------------------------------
    log('section', 'Helpery uprawnień');

    await test('canViewRoom - ADMIN może widzieć pokój', async () => {
        const room = { id: 'room-1' };
        assert(canViewRoom(UserRole.ADMIN, 'user-1', room) === true);
    });

    await test('canViewRoom - SALES_REP nie może widzieć pokoju', async () => {
        const room = { id: 'room-1' };
        assert(canViewRoom(UserRole.SALES_REP, 'user-1', room) === false);
    });

    await test('canOperateInRoom - OPERATOR przypisany może operować', async () => {
        const room = { 
            id: 'room-1',
            operators: [{ userId: 'operator-1' }]
        };
        assert(canOperateInRoom(UserRole.OPERATOR, 'operator-1', room) === true);
    });

    await test('canOperateInRoom - OPERATOR nieprzypisany nie może operować', async () => {
        const room = { 
            id: 'room-1',
            operators: []
        };
        assert(canOperateInRoom(UserRole.OPERATOR, 'operator-1', room) === false);
    });

    await test('canManageRoomAssignments - ADMIN może zarządzać', async () => {
        const room = { id: 'room-1' };
        assert(canManageRoomAssignments(UserRole.ADMIN, 'user-1', room) === true);
    });

    await test('canManageRoomAssignments - PRODUCTION_MANAGER może zarządzać', async () => {
        const room = { id: 'room-1' };
        assert(canManageRoomAssignments(UserRole.PRODUCTION_MANAGER, 'user-1', room) === true);
    });

    // ----------------------------------------
    // Testy wieloról
    // ----------------------------------------
    log('section', 'Wielorole użytkowników');

    await test('hasRole - sprawdza główną rolę', async () => {
        assert(hasRole(UserRole.OPERATOR, [], UserRole.OPERATOR) === true);
    });

    await test('hasRole - sprawdza dodatkowe role', async () => {
        const activeRoles = [UserRole.OPERATOR, UserRole.GRAPHIC_DESIGNER];
        assert(hasRole(UserRole.PRODUCTION, activeRoles, UserRole.GRAPHIC_DESIGNER) === true);
    });

    await test('hasRole - zwraca false dla nieprzypisanej roli', async () => {
        const activeRoles = [UserRole.OPERATOR];
        assert(hasRole(UserRole.PRODUCTION, activeRoles, UserRole.ADMIN) === false);
    });

    await test('hasAnyRole - sprawdza czy ma którąkolwiek z ról', async () => {
        const activeRoles = [UserRole.OPERATOR, UserRole.GRAPHIC_DESIGNER];
        const required = [UserRole.ADMIN, UserRole.GRAPHIC_DESIGNER];
        assert(hasAnyRole(UserRole.PRODUCTION, activeRoles, required) === true);
    });

    await test('hasAnyRole - zwraca false gdy nie ma żadnej z ról', async () => {
        const activeRoles = [UserRole.OPERATOR];
        const required = [UserRole.ADMIN, UserRole.PRODUCTION_MANAGER];
        assert(hasAnyRole(UserRole.PRODUCTION, activeRoles, required) === false);
    });

    // ----------------------------------------
    // Testy edge cases
    // ----------------------------------------
    log('section', 'Edge cases');

    await test('getRoomAccessLevel - null room', async () => {
        const level = getRoomAccessLevel(UserRole.ADMIN, 'user-1', null);
        assert(level === RoomAccessLevel.FULL, 'ADMIN powinien mieć FULL nawet dla null room');
    });

    await test('getRoomAccessLevel - undefined operators', async () => {
        const room = { id: 'room-1' };
        const level = getRoomAccessLevel(UserRole.OPERATOR, 'operator-1', room);
        assert(level === RoomAccessLevel.VIEW, 'OPERATOR bez przypisania powinien mieć VIEW');
    });

    await test('hasRole - null activeRoles', async () => {
        assert(hasRole(UserRole.OPERATOR, null, UserRole.OPERATOR) === true);
    });

    await test('hasAnyRole - pusta tablica wymaganych ról', async () => {
        assert(hasAnyRole(UserRole.OPERATOR, [], []) === false);
    });

    // ----------------------------------------
    // Testy zgodności z MES
    // ----------------------------------------
    log('section', 'Zgodność z MES best practices');

    await test('Hierarchia: ADMIN > PRODUCTION_MANAGER > PRODUCTION > OPERATOR', async () => {
        const room = { id: 'room-1' };
        
        const adminLevel = getRoomAccessLevel(UserRole.ADMIN, 'u1', room);
        const pmLevel = getRoomAccessLevel(UserRole.PRODUCTION_MANAGER, 'u2', room);
        const prodLevel = getRoomAccessLevel(UserRole.PRODUCTION, 'u3', room);
        const opLevel = getRoomAccessLevel(UserRole.OPERATOR, 'u4', room);
        
        const levels = {
            [RoomAccessLevel.FULL]: 4,
            [RoomAccessLevel.MANAGE]: 3,
            [RoomAccessLevel.OPERATE]: 2,
            [RoomAccessLevel.VIEW]: 1,
            [RoomAccessLevel.NONE]: 0
        };
        
        assert(levels[adminLevel] > levels[pmLevel], 'ADMIN > PRODUCTION_MANAGER');
        assert(levels[pmLevel] > levels[prodLevel], 'PRODUCTION_MANAGER > PRODUCTION');
        assert(levels[prodLevel] > levels[opLevel], 'PRODUCTION > OPERATOR (nieprzypisany)');
    });

    await test('Separacja obowiązków - SALES nie ma dostępu do produkcji', async () => {
        const room = { id: 'room-1' };
        
        const salesRepLevel = getRoomAccessLevel(UserRole.SALES_REP, 'u1', room);
        const salesDeptLevel = getRoomAccessLevel(UserRole.SALES_DEPT, 'u2', room);
        
        assert(salesRepLevel === RoomAccessLevel.NONE, 'SALES_REP nie powinien mieć dostępu');
        assert(salesDeptLevel === RoomAccessLevel.NONE, 'SALES_DEPT nie powinien mieć dostępu');
    });

    await test('Room Manager może delegować uprawnienia w swoim pokoju', async () => {
        const room = { 
            id: 'room-1',
            roomManagerUserId: 'rm-1',
            operators: [{ userId: 'op-1' }]
        };
        
        // Room Manager może zarządzać
        assert(canManageRoomAssignments(UserRole.PRODUCTION, 'rm-1', room) === true);
        
        // Operator przypisany może operować
        assert(canOperateInRoom(UserRole.OPERATOR, 'op-1', room) === true);
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
