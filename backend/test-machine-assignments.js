/**
 * Testy automatyczne dla Machine Product Assignments API
 * Uruchom: node backend/test-machine-assignments.js
 */

const API_BASE = 'http://localhost:3001';

// Symulowane cookies dla testów (ustaw prawdziwe wartości)
const TEST_COOKIES = {
    auth_id: 'test-admin-user-id',  // Zmień na prawdziwy ID usera ADMIN
    auth_role: 'ADMIN'
};

// Helper do fetch z cookies
async function fetchWithAuth(url, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        'Cookie': `auth_id=${TEST_COOKIES.auth_id}; auth_role=${TEST_COOKIES.auth_role}`,
        ...options.headers
    };
    
    return fetch(url, {
        ...options,
        headers,
        credentials: 'include'
    });
}

// Test results
const results = {
    passed: 0,
    failed: 0,
    tests: []
};

function logTest(name, passed, details = '') {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status}: ${name}${details ? ` - ${details}` : ''}`);
    results.tests.push({ name, passed, details });
    if (passed) results.passed++;
    else results.failed++;
}

// =====================
// TESTY
// =====================

async function testGetRooms() {
    console.log('\n--- Test: GET /api/production/rooms ---');
    try {
        const response = await fetchWithAuth(`${API_BASE}/api/production/rooms`);
        const data = await response.json();
        
        logTest('GET /api/production/rooms - status 200', response.status === 200, `status: ${response.status}`);
        logTest('GET /api/production/rooms - has data array', Array.isArray(data.data), `type: ${typeof data.data}`);
        
        if (data.data && data.data.length > 0) {
            logTest('GET /api/production/rooms - room has id', !!data.data[0].id);
            logTest('GET /api/production/rooms - room has name', !!data.data[0].name);
            return data.data[0].id; // Return first room ID for next tests
        } else {
            logTest('GET /api/production/rooms - has rooms', false, 'No rooms found - create some first');
            return null;
        }
    } catch (error) {
        logTest('GET /api/production/rooms - no error', false, error.message);
        return null;
    }
}

async function testGetMachineAssignments(roomId) {
    console.log('\n--- Test: GET /api/production/rooms/:roomId/machine-assignments ---');
    if (!roomId) {
        logTest('GET machine-assignments - skipped', false, 'No roomId');
        return null;
    }
    
    try {
        const response = await fetchWithAuth(`${API_BASE}/api/production/rooms/${roomId}/machine-assignments`);
        const data = await response.json();
        
        logTest('GET machine-assignments - status 200', response.status === 200, `status: ${response.status}`);
        logTest('GET machine-assignments - has room', !!data.data?.room);
        logTest('GET machine-assignments - has machines array', Array.isArray(data.data?.machines));
        logTest('GET machine-assignments - has unassignedProducts array', Array.isArray(data.data?.unassignedProducts));
        
        if (data.data?.machines?.length > 0) {
            const machine = data.data.machines[0];
            logTest('GET machine-assignments - machine has id', !!machine.id);
            logTest('GET machine-assignments - machine has products array', Array.isArray(machine.products));
            logTest('GET machine-assignments - machine has restrictToAssignedProducts', typeof machine.restrictToAssignedProducts === 'boolean');
            return { 
                machineId: machine.id, 
                productId: data.data.unassignedProducts[0]?.id 
            };
        }
        
        return null;
    } catch (error) {
        logTest('GET machine-assignments - no error', false, error.message);
        return null;
    }
}

async function testPostAssignment(machineId, productId) {
    console.log('\n--- Test: POST /api/production/machine-assignments ---');
    if (!machineId || !productId) {
        logTest('POST assignment - skipped', false, 'No machineId or productId');
        return false;
    }
    
    try {
        const response = await fetchWithAuth(`${API_BASE}/api/production/machine-assignments`, {
            method: 'POST',
            body: JSON.stringify({
                workStationId: machineId,
                productId: productId,
                notes: 'Test assignment'
            })
        });
        const data = await response.json();
        
        logTest('POST assignment - status 200 or 409', [200, 409].includes(response.status), `status: ${response.status}`);
        
        if (response.status === 200) {
            logTest('POST assignment - success status', data.status === 'success');
            logTest('POST assignment - has data', !!data.data);
            return true;
        } else if (response.status === 409) {
            logTest('POST assignment - duplicate handled', data.message.includes('już przypisany'));
            return true; // Already assigned is OK
        }
        
        return false;
    } catch (error) {
        logTest('POST assignment - no error', false, error.message);
        return false;
    }
}

async function testDeleteAssignment(machineId, productId) {
    console.log('\n--- Test: DELETE /api/production/machine-assignments/:workStationId/:productId ---');
    if (!machineId || !productId) {
        logTest('DELETE assignment - skipped', false, 'No machineId or productId');
        return;
    }
    
    try {
        const response = await fetchWithAuth(
            `${API_BASE}/api/production/machine-assignments/${machineId}/${productId}`,
            { method: 'DELETE' }
        );
        const data = await response.json();
        
        logTest('DELETE assignment - status 200', response.status === 200, `status: ${response.status}`);
        logTest('DELETE assignment - success status', data.status === 'success');
        logTest('DELETE assignment - has deleted count', typeof data.deleted === 'number');
    } catch (error) {
        logTest('DELETE assignment - no error', false, error.message);
    }
}

async function testPatchRestriction(machineId) {
    console.log('\n--- Test: PATCH /api/production/workstations/:id/restriction ---');
    if (!machineId) {
        logTest('PATCH restriction - skipped', false, 'No machineId');
        return;
    }
    
    try {
        // Test setting to true
        const response1 = await fetchWithAuth(
            `${API_BASE}/api/production/workstations/${machineId}/restriction`,
            {
                method: 'PATCH',
                body: JSON.stringify({ restrictToAssignedProducts: true })
            }
        );
        const data1 = await response1.json();
        
        logTest('PATCH restriction true - status 200', response1.status === 200, `status: ${response1.status}`);
        logTest('PATCH restriction true - success', data1.status === 'success');
        
        // Test setting back to false
        const response2 = await fetchWithAuth(
            `${API_BASE}/api/production/workstations/${machineId}/restriction`,
            {
                method: 'PATCH',
                body: JSON.stringify({ restrictToAssignedProducts: false })
            }
        );
        const data2 = await response2.json();
        
        logTest('PATCH restriction false - status 200', response2.status === 200);
        logTest('PATCH restriction false - success', data2.status === 'success');
        
        // Test invalid value
        const response3 = await fetchWithAuth(
            `${API_BASE}/api/production/workstations/${machineId}/restriction`,
            {
                method: 'PATCH',
                body: JSON.stringify({ restrictToAssignedProducts: 'invalid' })
            }
        );
        
        logTest('PATCH restriction invalid - status 400', response3.status === 400);
    } catch (error) {
        logTest('PATCH restriction - no error', false, error.message);
    }
}

async function testUnauthorized() {
    console.log('\n--- Test: Unauthorized access ---');
    try {
        // Test without auth cookies
        const response = await fetch(`${API_BASE}/api/production/rooms`);
        logTest('Unauthorized - returns 401 or 403', [401, 403].includes(response.status), `status: ${response.status}`);
    } catch (error) {
        logTest('Unauthorized test - no error', false, error.message);
    }
}

// =====================
// RUN ALL TESTS
// =====================

async function runAllTests() {
    console.log('='.repeat(60));
    console.log('MACHINE PRODUCT ASSIGNMENTS - TESTY AUTOMATYCZNE');
    console.log('='.repeat(60));
    console.log(`API: ${API_BASE}`);
    console.log(`Test user: ${TEST_COOKIES.auth_id} (${TEST_COOKIES.auth_role})`);
    console.log('='.repeat(60));

    // Run tests in sequence
    const roomId = await testGetRooms();
    const assignmentData = await testGetMachineAssignments(roomId);
    
    if (assignmentData) {
        const { machineId, productId } = assignmentData;
        await testPostAssignment(machineId, productId);
        await testPatchRestriction(machineId);
        await testDeleteAssignment(machineId, productId);
    }
    
    await testUnauthorized();

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('PODSUMOWANIE');
    console.log('='.repeat(60));
    console.log(`✅ Passed: ${results.passed}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`📊 Total:  ${results.passed + results.failed}`);
    console.log('='.repeat(60));

    if (results.failed > 0) {
        console.log('\n❌ NIEKTÓRE TESTY NIE PRZESZŁY');
        console.log('Sprawdź:');
        console.log('1. Czy serwer działa na localhost:3001?');
        console.log('2. Czy masz pokoje produkcyjne i maszyny w bazie?');
        console.log('3. Czy TEST_COOKIES zawiera prawidłowe dane?');
        process.exit(1);
    } else {
        console.log('\n✅ WSZYSTKIE TESTY PRZESZŁY');
        process.exit(0);
    }
}

// Run
runAllTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
