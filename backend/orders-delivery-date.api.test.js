/**
 * Testy API dla walidacji pola deliveryDate w POST /api/orders
 * Uruchomienie: node backend/orders-delivery-date.api.test.js
 *
 * Wymagania:
 * - Działający serwer backendu (node backend/server.js)
 * - Skonfigurowany backend/.env + testowy użytkownik ADMIN:
 *   - TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD
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

async function loginAsAdmin() {
  const adminEmail = process.env.TEST_ADMIN_EMAIL;
  const adminPassword = process.env.TEST_ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    log('info', 'Brak TEST_ADMIN_EMAIL/TEST_ADMIN_PASSWORD w .env – pomijam testy POST /api/orders');
    return null;
  }

  const res = await httpRequest('POST', '/api/auth/login', {
    body: { email: adminEmail, password: adminPassword },
  });

  if (res.status !== 200 || !res.cookies || res.cookies.length === 0) {
    log('info', `Logowanie ADMIN nieudane – status ${res.status}`);
    return null;
  }

  return {
    cookies: toCookieHeader(res.cookies),
  };
}

async function runTests() {
  console.log('\n📦 Testy POST /api/orders – walidacja deliveryDate');
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

  // Logowanie ADMIN
  log('section', 'Logowanie ADMIN (dla POST /api/orders)');
  let adminSession = null;

  await test('Logowanie ADMIN', async () => {
    adminSession = await loginAsAdmin();
    if (!adminSession) skip();
    assert(adminSession.cookies, 'Brak cookies po logowaniu ADMIN');
  });

  if (!adminSession) {
    console.log('\n' + '='.repeat(60));
    console.log(`${colors.yellow}Pominięto testy POST /api/orders – brak sesji ADMIN.${colors.reset}`);
    summaryAndExit();
    return;
  }

  log('section', 'Walidacja deliveryDate w POST /api/orders');

  const baseHeaders = { Cookie: adminSession.cookies };

  const baseBody = {
    customerId: 'TEST_CUSTOMER_ID',
    // Minimalne items – nie dotrzemy do logiki Supabase, bo testujemy wczesne walidacje
    items: [
      {
        productCode: 'TEST_PRODUCT',
        quantity: 1,
        unitPrice: 0,
      },
    ],
  };

  await test('Brak deliveryDate → 400 i czytelny komunikat', async () => {
    const res = await httpRequest('POST', '/api/orders', {
      headers: baseHeaders,
      body: { ...baseBody },
    });

    assert(res.status === 400, `Oczekiwano 400, otrzymano ${res.status}`);
    assert(
      res.body && typeof res.body.message === 'string' && res.body.message.includes('deliveryDate jest wymagane'),
      'Oczekiwano komunikatu o wymaganym deliveryDate'
    );
  });

  await test('Nieprawidłowy format deliveryDate → 400', async () => {
    const res = await httpRequest('POST', '/api/orders', {
      headers: baseHeaders,
      body: {
        ...baseBody,
        deliveryDate: '2025-13-01', // nieprawidłowy miesiąc
      },
    });

    assert(res.status === 400, `Oczekiwano 400, otrzymano ${res.status}`);
    assert(
      res.body && typeof res.body.message === 'string' && res.body.message.includes('ma nieprawidłowy format'),
      'Oczekiwano komunikatu o nieprawidłowym formacie deliveryDate'
    );
  });

  await test('Data deliveryDate w przeszłości → 400', async () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yYear = yesterday.getFullYear();
    const yMonth = String(yesterday.getMonth() + 1).padStart(2, '0');
    const yDay = String(yesterday.getDate()).padStart(2, '0');
    const yesterdayStr = `${yYear}-${yMonth}-${yDay}`;

    const res = await httpRequest('POST', '/api/orders', {
      headers: baseHeaders,
      body: {
        ...baseBody,
        deliveryDate: yesterdayStr,
      },
    });

    assert(res.status === 400, `Oczekiwano 400, otrzymano ${res.status}`);
    assert(
      res.body && typeof res.body.message === 'string' && res.body.message.includes('nie może być datą z przeszłości'),
      'Oczekiwano komunikatu o dacie z przeszłości'
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
