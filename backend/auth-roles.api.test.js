/**
 * Testy API dla wieloról i endpointów auth/admin
 * Uruchomienie: node backend/auth-roles.api.test.js
 *
 * Wymagania:
 * - Działający serwer backendu (uruchom w drugim terminalu: node backend/server.js)
 * - Skonfigurowane środowisko Supabase w backend/.env
 * - Opcjonalnie zmienne środowiskowe w backend/.env (lub systemowo):
 *   - TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD  (użytkownik z rolą ADMIN)
 *   - TEST_USER_EMAIL,  TEST_USER_PASSWORD   (zwykły użytkownik, np. OPERATOR)
 *   Jeśli brak lub logowanie się nie uda, część testów zostanie pominięta (SKIP).
 */

const path = require('path');
const http = require('http');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const PORT = process.env.PORT || 3001;
const BASE_URL = process.env.TEST_BACKEND_URL || `http://localhost:${PORT}`;

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
        if (error && error.message === 'SKIP') {
            skipped++;
            log('info', `${name} (pominięty)`);
        } else {
            failed++;
            log('fail', `${name}: ${error && error.message ? error.message : error}`);
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

// Prosty klient HTTP (bez supertest)
function httpRequest(method, urlPath, { headers = {}, body = null } = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(urlPath, BASE_URL);
        const data = body ? JSON.stringify(body) : null;

        const options = {
            method,
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            headers: {
                'Origin': BASE_URL,
                ...headers,
            }
        };

        if (data) {
            options.headers['Content-Type'] = 'application/json';
            options.headers['Content-Length'] = Buffer.byteLength(data);
        }

        const req = http.request(options, (res) => {
            let chunks = '';
            res.on('data', (d) => {
                chunks += d;
            });
            res.on('end', () => {
                let json = null;
                try {
                    json = chunks ? JSON.parse(chunks) : null;
                } catch (e) {
                    // Ignoruj błąd parsowania – zwróć rawBody
                }
                const setCookie = res.headers['set-cookie'] || [];
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body: json,
                    rawBody: chunks,
                    cookies: setCookie,
                });
            });
        });

        req.on('error', (err) => {
            reject(err);
        });

        if (data) {
            req.write(data);
        }

        req.end();
    });
}

function toCookieHeader(setCookieArray) {
    if (!Array.isArray(setCookieArray) || setCookieArray.length === 0) return '';
    return setCookieArray
        .map(c => c.split(';')[0])
        .join('; ');
}

async function login(email, password, label) {
    if (!email || !password) {
        log('info', `Pomijam logowanie (${label}) – brak danych w .env`);
        return null;
    }

    const res = await httpRequest('POST', '/api/auth/login', {
        body: { email, password }
    });

    if (res.status !== 200 || !res.cookies || res.cookies.length === 0) {
        log('info', `Logowanie nieudane (${label}) – status ${res.status}`);
        return null;
    }

    const cookieHeader = toCookieHeader(res.cookies);
    return {
        cookies: cookieHeader,
        body: res.body,
    };
}

async function runTests() {
    console.log('\n🔐 Testy API wieloról (auth + admin)\n');
    console.log('='.repeat(50));

    // 1. Sprawdź czy serwer działa
    log('section', 'Health check serwera');

    let serverOk = true;
    await test('GET /api/health zwraca 200', async () => {
        try {
            const res = await httpRequest('GET', '/api/health');
            assert(res.status === 200, `Oczekiwano status 200, otrzymano ${res.status}`);
            assert(res.body && res.body.status === 'OK', 'Oczekiwano body.status = OK');
        } catch (err) {
            serverOk = false;
            throw err;
        }
    });

    if (!serverOk) {
        console.log('\n' + '='.repeat(50));
        console.log(`${colors.red}Serwer nie odpowiada. Uruchom najpierw: node backend/server.js${colors.reset}`);
        summaryAndExit();
        return;
    }

    // 2. Logowanie ADMIN i USER (jeśli dostępne)
    log('section', 'Logowanie testowych użytkowników');

    const adminEmail = process.env.TEST_ADMIN_EMAIL;
    const adminPassword = process.env.TEST_ADMIN_PASSWORD;
    const userEmail = process.env.TEST_USER_EMAIL;
    const userPassword = process.env.TEST_USER_PASSWORD;

    let adminSession = null;
    let userSession = null;

    await test('Logowanie ADMIN (TEST_ADMIN_EMAIL)', async () => {
        adminSession = await login(adminEmail, adminPassword, 'ADMIN');
        if (!adminSession) skip();
        assert(adminSession.cookies, 'Brak ciasteczek po logowaniu ADMIN');
    });

    await test('Logowanie USER (TEST_USER_EMAIL)', async () => {
        userSession = await login(userEmail, userPassword, 'USER');
        if (!userSession) skip();
        assert(userSession.cookies, 'Brak ciasteczek po logowaniu USER');
    });

    // 3. Scenariusze API A–F (ograniczone do tego, co da się przetestować bez twardych założeń o danych)

    // A: GET /api/admin/user-role-assignments – wymaga ADMIN
    log('section', 'GET /api/admin/user-role-assignments');

    await test('ADMIN: GET /api/admin/user-role-assignments wymaga parametru userId', async () => {
        if (!adminSession) return skip();
        const res = await httpRequest('GET', '/api/admin/user-role-assignments', {
            headers: { Cookie: adminSession.cookies }
        });
        assert(res.status === 400, `Oczekiwano 400 bez userId, otrzymano ${res.status}`);
    });

    await test('Bez ADMIN: GET /api/admin/user-role-assignments zwraca 403', async () => {
        if (!userSession) return skip();
        const res = await httpRequest('GET', '/api/admin/user-role-assignments?userId=dummy', {
            headers: { Cookie: userSession.cookies }
        });
        assert(res.status === 403, `Oczekiwano 403 dla nie-ADMIN, otrzymano ${res.status}`);
    });

    // B: POST /api/admin/user-role-assignments – walidacja danych
    log('section', 'POST /api/admin/user-role-assignments');

    await test('ADMIN: POST /api/admin/user-role-assignments bez body → 400', async () => {
        if (!adminSession) return skip();
        const res = await httpRequest('POST', '/api/admin/user-role-assignments', {
            headers: { Cookie: adminSession.cookies }
        });
        assert(res.status === 400, `Oczekiwano 400 przy braku body, otrzymano ${res.status}`);
    });

    await test('ADMIN: POST /api/admin/user-role-assignments z nieprawidłową rolą → 400', async () => {
        if (!adminSession || !userSession || !userSession.body || !userSession.body.data) return skip();
        const userId = userSession.body.data.id;
        const res = await httpRequest('POST', '/api/admin/user-role-assignments', {
            headers: { Cookie: adminSession.cookies },
            body: { userId, role: 'NOT_A_ROLE' }
        });
        assert(res.status === 400, `Oczekiwano 400 dla nieprawidłowej roli, otrzymano ${res.status}`);
    });

    // C: GET /api/auth/roles – podstawowa struktura
    log('section', 'GET /api/auth/roles');

    await test('USER: GET /api/auth/roles zwraca strukturę z roles[]', async () => {
        if (!userSession) return skip();
        const res = await httpRequest('GET', '/api/auth/roles', {
            headers: { Cookie: userSession.cookies }
        });
        assert(res.status === 200, `Oczekiwano 200, otrzymano ${res.status}`);
        assert(res.body && res.body.data, 'Brak pola data w odpowiedzi');
        assert(Array.isArray(res.body.data.roles), 'data.roles powinno być tablicą');
    });

    await test('Bez ciasteczek: GET /api/auth/roles → 401', async () => {
        const res = await httpRequest('GET', '/api/auth/roles');
        assert(res.status === 401, `Oczekiwano 401 bez ciasteczek, otrzymano ${res.status}`);
    });

    // D: POST /api/auth/active-role – walidacja roli i autoryzacja
    log('section', 'POST /api/auth/active-role');

    await test('Bez ciasteczek: POST /api/auth/active-role → 401', async () => {
        const res = await httpRequest('POST', '/api/auth/active-role', {
            body: { role: 'OPERATOR' }
        });
        assert(res.status === 401, `Oczekiwano 401 bez ciasteczek, otrzymano ${res.status}`);
    });

    await test('USER: POST /api/auth/active-role z nieprawidłową rolą → 400', async () => {
        if (!userSession) return skip();
        const res = await httpRequest('POST', '/api/auth/active-role', {
            headers: { Cookie: userSession.cookies },
            body: { role: 'NOT_A_ROLE' }
        });
        assert(res.status === 400, `Oczekiwano 400 dla nieprawidłowej roli, otrzymano ${res.status}`);
    });

    // Uwaga: pozytywne scenariusze zmiany roli wymagają pewności, że użytkownik ma przypisaną daną rolę.
    // Tutaj tylko sprawdzamy, że endpoint istnieje i waliduje wejście / autoryzację.

    console.log('\n' + '='.repeat(50));
    summaryAndExit();
}

function summaryAndExit() {
    console.log(`\nWyniki: ${colors.green}${passed} passed${colors.reset}, ${colors.red}${failed} failed${colors.reset}, ${colors.yellow}${skipped} skipped${colors.reset}`);

    if (failed > 0) {
        console.log(`\n${colors.red}Niektóre testy API nie przeszły!${colors.reset}`);
        process.exit(1);
    } else {
        console.log(`\n${colors.green}Testy API zakończone – brak krytycznych błędów.${colors.reset}`);
        process.exit(0);
    }
}

runTests().catch(err => {
    console.error('Błąd podczas uruchamiania testów API:', err);
    process.exit(1);
});
