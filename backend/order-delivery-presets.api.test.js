/**
 * Testy API dla OrderDeliveryPreset (presety terminów dostawy)
 * Uruchomienie: node backend/order-delivery-presets.api.test.js
 *
 * Wymagania:
 * - Działający serwer backendu (node backend/server.js)
 * - Skonfigurowany backend/.env + testowy użytkownik ADMIN oraz (opcjonalnie) USER:
 *   - TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD
 *   - TEST_USER_EMAIL,  TEST_USER_PASSWORD
 */

const path = require('path');
const http = require('http');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const PORT = process.env.PORT || 3001;
const BASE_URL = process.env.TEST_BACKEND_URL || `http://localhost:${PORT}`;

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
};

function log(type, message) {
  const prefix = {
    pass: `${colors.green}✓${colors.reset}`,
    fail: `${colors.red}✗${colors.reset}`,
    info: `${colors.yellow}ℹ${colors.reset}`,
    section: `${colors.cyan}▶${colors.reset}`,
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
        Origin: BASE_URL,
        ...headers,
      },
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
        } catch (_) {
          // ignoruj błąd parsowania – zostaw rawBody
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
  return setCookieArray.map((c) => c.split(';')[0]).join('; ');
}

async function login(email, password, label) {
  if (!email || !password) {
    log('info', `Pomijam logowanie (${label}) – brak danych w .env`);
    return null;
  }

  const res = await httpRequest('POST', '/api/auth/login', {
    body: { email, password },
  });

  if (res.status !== 200 || !res.cookies || res.cookies.length === 0) {
    log('info', `Logowanie nieudane (${label}) – status ${res.status}`);
    return null;
  }

  return {
    cookies: toCookieHeader(res.cookies),
    body: res.body,
  };
}

async function runTests() {
  console.log('\n🗓️  Testy API OrderDeliveryPreset');
  console.log('='.repeat(60));

  // Health check
  log('section', 'Health check serwera');
  let serverOk = true;
  await test('GET /api/health zwraca 200', async () => {
    try {
      const res = await httpRequest('GET', '/api/health');
      assert(res.status === 200, `Oczekiwano 200, otrzymano ${res.status}`);
      assert(res.body && res.body.status === 'OK', 'Oczekiwano body.status = OK');
    } catch (err) {
      serverOk = false;
      throw err;
    }
  });

  if (!serverOk) {
    console.log('\n' + '='.repeat(60));
    console.log(`${colors.red}Serwer nie odpowiada. Uruchom najpierw: node backend/server.js${colors.reset}`);
    summaryAndExit();
    return;
  }

  // Logowanie ADMIN i USER (opcjonalnie)
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

  if (!adminSession) {
    console.log('\n' + '='.repeat(60));
    console.log(`${colors.yellow}Pominięto testy admin API OrderDeliveryPreset – brak sesji ADMIN.${colors.reset}`);
    summaryAndExit();
    return;
  }

  // ===============================
  // Publiczne API /config
  // ===============================
  log('section', 'GET /api/config/order-delivery-presets');

  await test('GET /api/config/order-delivery-presets zwraca listę presetów', async () => {
    const res = await httpRequest('GET', '/api/config/order-delivery-presets');
    assert(res.status === 200, `Oczekiwano 200, otrzymano ${res.status}`);
    assert(res.body && res.body.status === 'success', 'Oczekiwano status=success w body');
    assert(Array.isArray(res.body.data), 'data powinna być tablicą presetów');
  });

  // ===============================
  // Admin API – lista
  // ===============================
  log('section', 'GET /api/admin/order-delivery-presets');

  await test('ADMIN: GET /api/admin/order-delivery-presets → 200', async () => {
    const res = await httpRequest('GET', '/api/admin/order-delivery-presets', {
      headers: { Cookie: adminSession.cookies },
    });
    assert(res.status === 200, `Oczekiwano 200, otrzymano ${res.status}`);
    assert(res.body && res.body.status === 'success', 'Oczekiwano status=success w body');
    assert(Array.isArray(res.body.data), 'data powinna być tablicą presetów');
  });

  await test('USER bez ADMIN: GET /api/admin/order-delivery-presets → 403', async () => {
    if (!userSession) return skip();
    const res = await httpRequest('GET', '/api/admin/order-delivery-presets', {
      headers: { Cookie: userSession.cookies },
    });
    assert(res.status === 403, `Oczekiwano 403 dla roli nie-ADMIN, otrzymano ${res.status}`);
  });

  // ===============================
  // Admin API – walidacja POST
  // ===============================
  log('section', 'POST /api/admin/order-delivery-presets – walidacja');

  await test('ADMIN: brak label → 400', async () => {
    const res = await httpRequest('POST', '/api/admin/order-delivery-presets', {
      headers: { Cookie: adminSession.cookies },
      body: {
        // brak label
        offsetDays: 5,
      },
    });

    assert(res.status === 400, `Oczekiwano 400, otrzymano ${res.status}`);
    assert(
      res.body && typeof res.body.message === 'string' && res.body.message.includes('label jest wymagane'),
      'Oczekiwano komunikatu o wymaganym label'
    );
  });

  await test('ADMIN: mode=FIXED_DATE bez fixedDate → 400', async () => {
    const res = await httpRequest('POST', '/api/admin/order-delivery-presets', {
      headers: { Cookie: adminSession.cookies },
      body: {
        label: 'Test FIXED_DATE bez daty',
        mode: 'FIXED_DATE',
        // brak fixedDate
      },
    });

    assert(res.status === 400, `Oczekiwano 400, otrzymano ${res.status}`);
    assert(
      res.body && typeof res.body.message === 'string' && res.body.message.includes('fixedDate jest wymagane'),
      'Oczekiwano komunikatu o wymaganym fixedDate dla FIXED_DATE'
    );
  });

  console.log('\n' + '='.repeat(60));
  summaryAndExit();
}

function summaryAndExit() {
  console.log(`\nPodsumowanie: ${colors.green}${passed} OK${colors.reset}, ${colors.red}${failed} błędów${colors.reset}, ${colors.yellow}${skipped} pominiętych${colors.reset}`);
  process.exitCode = failed > 0 ? 1 : 0;
}

if (require.main === module) {
  runTests().catch((err) => {
    console.error('Nieoczekiwany błąd testów:', err);
    process.exitCode = 1;
  });
}
