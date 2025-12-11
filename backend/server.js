const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const crypto = require('crypto'); // Dodano import crypto
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');
const { 
    createProductionWorkOrderPDF, 
    createGraphicsTaskPDF, 
    createPackingListPDF 
} = require('./pdfGenerator');

const app = express();
const PORT = process.env.PORT || 3001;
const GALLERY_BASE = process.env.GALLERY_BASE || 'http://rezon.myqnapcloud.com:81/home';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Konfiguracja Supabase – wartości muszą być ustawione w backend/.env
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_TABLE_PRODUCTS = process.env.SUPABASE_TABLE_PRODUCTS || 'products';
const AUTH_COOKIE_SECRET = process.env.AUTH_COOKIE_SECRET || (SUPABASE_SERVICE_ROLE_KEY
    ? crypto.createHash('sha256').update(String(SUPABASE_SERVICE_ROLE_KEY)).digest('hex')
    : 'dev-insecure-auth-secret');

const LOGIN_MAX_ATTEMPTS = Number(process.env.LOGIN_MAX_ATTEMPTS || 5);
const LOGIN_WINDOW_MS = Number(process.env.LOGIN_WINDOW_MS || 15 * 60 * 1000);
const loginAttempts = new Map();

let supabase = null;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
} else {
  console.warn('Supabase nie jest skonfigurowany – brak SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY w .env');
}

// Blokada bezpośredniego dostępu do katalogów SOURCE i SOURCE 2 (legacy/reference)
app.use((req, res, next) => {
  const p = req.path || '';
  if (p.startsWith('/SOURCE') || p.startsWith('/SOURCE 2')) {
    return res.status(404).end();
  }
  next();
});

// Serwowanie plików statycznych z folderu nadrzędnego
app.use(express.static(path.join(__dirname, '..')));

// Dopuszczalny origin frontendu (np. https://zamowienia.example.com) – w produkcji warto ustawić w .env
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || '';

// Konfiguracja CORS
const corsOptions = {
  origin: (origin, callback) => {
    // Brak nagłówka Origin (np. curl, Postman, same-origin) -> nie wymaga CORS
    if (!origin) {
      return callback(null, true);
    }

    // Jeśli nie zdefiniowano FRONTEND_ORIGIN:
    //  - w produkcji blokujemy wszystkie żądania cross-origin
    //  - w środowisku deweloperskim pozwalamy na dowolny origin (ułatwia testy)
    if (!FRONTEND_ORIGIN) {
      if (IS_PRODUCTION) {
        return callback(null, false);
      }
      return callback(null, true);
    }

    // Jeśli ustawiono FRONTEND_ORIGIN – w produkcji akceptujemy tylko ten origin
    if (origin === FRONTEND_ORIGIN) {
      return callback(null, true);
    }

    // Poza produkcją pozwalamy na inne originy (np. lokalne testy)
    if (!IS_PRODUCTION) {
      return callback(null, true);
    }

    // Produkcja + inny origin niż FRONTEND_ORIGIN -> blokada
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

// Middleware do parsowania JSON i ochrona CSRF dla metod modyfikujących
app.use(express.json({ limit: '10mb' }));

// Podstawowe nagłówki bezpieczeństwa HTTP
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (IS_PRODUCTION) {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
    res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; font-src 'self' https://cdnjs.cloudflare.com data:; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; connect-src 'self'");
  }
  next();
});

app.use(verifySameOrigin);

// Proste parsowanie cookies (bez zewnętrznych bibliotek)
function parseCookies(req) {
    const header = req.headers.cookie;
    if (!header) return {};

    const cookies = header.split(';').reduce((acc, part) => {
        const [rawKey, ...rest] = part.split('=');
        if (!rawKey) return acc;
        const key = rawKey.trim();
        const value = rest.join('=').trim();
        if (!key) return acc;
        acc[key] = decodeURIComponent(value || '');
        return acc;
    }, {});

    if (cookies.auth_id && cookies.auth_role) {
        const sig = cookies.auth_sig;
        const payload = `${cookies.auth_id}|${cookies.auth_role}`;

        if (!sig) {
            if (IS_PRODUCTION) {
                delete cookies.auth_id;
                delete cookies.auth_role;
            }
        } else {
            try {
                const expected = crypto
                    .createHmac('sha256', AUTH_COOKIE_SECRET)
                    .update(payload)
                    .digest('hex');

                if (expected !== sig) {
                    delete cookies.auth_id;
                    delete cookies.auth_role;
                    delete cookies.auth_sig;
                }
            } catch (e) {
                delete cookies.auth_id;
                delete cookies.auth_role;
                delete cookies.auth_sig;
            }
        }
    }

    return cookies;
}

function setAuthCookies(res, { id, role }) {
    const cookies = [];
    const cookieBase = `; Path=/; HttpOnly; SameSite=Lax${IS_PRODUCTION ? '; Secure' : ''}`;

    const payload = `${id}|${role}`;
    const sig = crypto
        .createHmac('sha256', AUTH_COOKIE_SECRET)
        .update(payload)
        .digest('hex');

    cookies.push(`auth_id=${encodeURIComponent(id)}${cookieBase}`);
    cookies.push(`auth_role=${encodeURIComponent(role)}${cookieBase}`);
    cookies.push(`auth_sig=${sig}${cookieBase}`);

    res.setHeader('Set-Cookie', cookies);
}

function clearAuthCookies(res) {
    const expired = `; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${IS_PRODUCTION ? '; Secure' : ''}`;
    res.setHeader('Set-Cookie', [
        `auth_id=${expired}`,
        `auth_role=${expired}`,
        `auth_sig=${expired}`,
    ]);
}

function getLoginAttemptKey(req, email) {
    const ip = req.ip || (req.connection && req.connection.remoteAddress) || '';
    const normalizedEmail = (email || '').toString().toLowerCase();
    return `${ip}|${normalizedEmail}`;
}

function isLoginBlocked(key) {
    const state = loginAttempts.get(key);
    if (!state) return false;
    const now = Date.now();
    if (now - state.firstAttemptAt > LOGIN_WINDOW_MS) {
        loginAttempts.delete(key);
        return false;
    }
    return state.count >= LOGIN_MAX_ATTEMPTS;
}

function registerFailedLogin(key) {
    const now = Date.now();
    const existing = loginAttempts.get(key);
    if (!existing || now - existing.firstAttemptAt > LOGIN_WINDOW_MS) {
        loginAttempts.set(key, { count: 1, firstAttemptAt: now });
        return;
    }
    existing.count += 1;
    loginAttempts.set(key, existing);
}

function resetLoginAttempts(key) {
    loginAttempts.delete(key);
}

function isSafeMethod(method) {
    return method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
}

function verifySameOrigin(req, res, next) {
    if (isSafeMethod(req.method)) {
        return next();
    }

    const origin = req.headers.origin;
    if (!origin) {
        return next();
    }

    try {
        const originHost = new URL(origin).host;
        const host = req.headers.host;

        if (!host || originHost !== host) {
            return res.status(403).json({ status: 'error', message: 'Nieprawidłowe źródło żądania' });
        }

        return next();
    } catch (e) {
        return res.status(400).json({ status: 'error', message: 'Nieprawidłowe nagłówki źródła żądania' });
    }
}

function attachErrorDetails(payload, error) {
    if (!IS_PRODUCTION && error && error.message) {
        payload.details = error.message;
    }
    return payload;
}

async function getAuthContext(req) {
    if (req._authContext) {
        return req._authContext;
    }

    const cookies = parseCookies(req);
    const userId = cookies.auth_id || null;
    const roleFromCookie = cookies.auth_role || null;

    // Brak identyfikatora użytkownika – traktujemy jako niezalogowanego
    if (!userId) {
        const anonymous = { userId: null, role: null, user: null };
        req._authContext = anonymous;
        return anonymous;
    }

    // Jeśli Supabase nie jest skonfigurowany – zachowujemy stare zachowanie oparte na roli z cookies
    if (!supabase) {
        const ctx = {
            userId,
            role: roleFromCookie || 'NEW_USER',
            user: null,
        };
        req._authContext = ctx;
        return ctx;
    }

    try {
        const { data: user, error } = await supabase
            .from('User')
            .select('id, role, isActive')
            .eq('id', userId)
            .single();

        if (error || !user || user.isActive === false) {
            const anonymous = { userId: null, role: null, user: null };
            req._authContext = anonymous;
            return anonymous;
        }

        const ctx = {
            userId: user.id,
            role: user.role || roleFromCookie || 'NEW_USER',
            user,
        };
        req._authContext = ctx;
        return ctx;
    } catch (err) {
        console.error('Błąd getAuthContext:', err);
        const anonymous = { userId: null, role: null, user: null };
        req._authContext = anonymous;
        return anonymous;
    }
}

function requireRole(allowedRoles = []) {
    return async (req, res, next) => {
        const { userId, role } = await getAuthContext(req);

        if (!userId || !role) {
            return res.status(401).json({ status: 'error', message: 'Nieautoryzowany – zaloguj się.' });
        }

        if (Array.isArray(allowedRoles) && allowedRoles.length && !allowedRoles.includes(role)) {
            return res.status(403).json({ status: 'error', message: 'Brak uprawnień do tego zasobu.' });
        }

        req.user = { id: userId, role };
        return next();
    };
}

const ORDER_STATUSES = ['PENDING', 'APPROVED', 'IN_PRODUCTION', 'READY', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

const ROLE_STATUS_TRANSITIONS = {
    SALES_REP: [
        { from: 'PENDING', to: 'CANCELLED' }
    ],
    SALES_DEPT: [
        { from: 'PENDING', to: 'APPROVED' },
        // SALES_DEPT NIE może: APPROVED → IN_PRODUCTION (to robi produkcja/operator)
        { from: 'APPROVED', to: 'CANCELLED' },
        { from: 'IN_PRODUCTION', to: 'CANCELLED' },
        { from: 'READY', to: 'CANCELLED' },
        { from: 'SHIPPED', to: 'DELIVERED' }
    ],
    PRODUCTION: [
        { from: 'APPROVED', to: 'IN_PRODUCTION' },
        { from: 'IN_PRODUCTION', to: 'READY' }
    ],
    WAREHOUSE: [
        { from: 'READY', to: 'SHIPPED' }
    ],
    ADMIN: 'ALL'
};

function isValidStatus(status) {
    return typeof status === 'string' && ORDER_STATUSES.includes(status.toUpperCase());
}

function canRoleChangeStatus(role, currentStatus, nextStatus) {
    if (!role || !currentStatus || !nextStatus || currentStatus === nextStatus) return false;
    if (role === 'ADMIN') return true;

    const transitions = ROLE_STATUS_TRANSITIONS[role] || [];
    return transitions.some((transition) => transition.from === currentStatus && transition.to === nextStatus);
}

function canRoleAccessOrder(role, requesterId, orderOwnerId) {
    if (!role) return false;
    if (['ADMIN', 'SALES_DEPT', 'WAREHOUSE', 'PRODUCTION'].includes(role)) {
        return true;
    }

    if (role === 'SALES_REP') {
        return requesterId === orderOwnerId;
    }

    return false;
}

// Główna ścieżka - serwowanie pliku index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});

// Strona logowania (publiczna)
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../login.html'));
});

// Panel admina – wymaga zalogowania jako ADMIN, SALES_DEPT, GRAPHICS/GRAPHIC_DESIGNER, WAREHOUSE lub PRODUCTION
app.get('/admin', requireRole(['ADMIN', 'SALES_DEPT', 'GRAPHICS', 'GRAPHIC_DESIGNER', 'WAREHOUSE', 'PRODUCTION']), (req, res) => {
  res.sendFile(path.join(__dirname, '../admin/index.html'));
});

// Panel klientów – wymaga zalogowania jako SALES_REP, SALES_DEPT lub ADMIN
app.get('/clients', requireRole(['SALES_REP', 'SALES_DEPT', 'ADMIN']), (req, res) => {
  res.sendFile(path.join(__dirname, '../clients.html'));
});

// Widok zamówień – wymaga zalogowania jako SALES_REP, SALES_DEPT, ADMIN, WAREHOUSE lub PRODUCTION
app.get('/orders', requireRole(['SALES_REP', 'SALES_DEPT', 'ADMIN', 'WAREHOUSE', 'PRODUCTION']), (req, res) => {
  res.sendFile(path.join(__dirname, '../orders.html'));
});

// Panel produkcji – wymaga zalogowania jako PRODUCTION, OPERATOR lub ADMIN
app.get('/production', requireRole(['PRODUCTION', 'OPERATOR', 'ADMIN']), (req, res) => {
  res.sendFile(path.join(__dirname, '../production.html'));
});

// Test endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Serwer działa poprawnie' });
});

// Prosty endpoint logowania – sprawdza użytkownika w Supabase.User po emailu i haśle (plain text)
app.post('/api/auth/login', async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const { email, password } = req.body || {};

    if (!email || !password) {
        return res.status(400).json({ status: 'error', message: 'Podaj email i hasło.' });
    }

    try {
        const attemptKey = getLoginAttemptKey(req, email);

        if (isLoginBlocked(attemptKey)) {
            return res.status(429).json({ status: 'error', message: 'Zbyt wiele nieudanych prób logowania. Spróbuj ponownie później.' });
        }

        const { data: user, error } = await supabase
            .from('User')
            .select('id, email, password, name, role, departmentId, createdAt, isActive, productionroomid')
            .eq('email', email)
            .single();

        if (error || !user) {
            registerFailedLogin(attemptKey);
            return res.status(401).json({ status: 'error', message: 'Nieprawidłowe dane logowania.' });
        }

        if (user.isActive === false) {
            registerFailedLogin(attemptKey);
            return res.status(403).json({ status: 'error', message: 'Konto jest nieaktywne.' });
        }

        if (!user.password) {
            registerFailedLogin(attemptKey);
            return res.status(401).json({ status: 'error', message: 'Nieprawidłowe dane logowania.' });
        }

        let passwordOk = false;

        // Jeśli hasło wygląda na hash bcrypta (tak jak w starym systemie), porównaj przez bcrypt
        if (typeof user.password === 'string' && user.password.startsWith('$2')) {
            try {
                passwordOk = await bcrypt.compare(password, user.password);
            } catch (compareError) {
                console.warn('Błąd porównania hasła bcrypt:', compareError);
                passwordOk = false;
            }
        } else if (!IS_PRODUCTION) {
            // Fallback w środowisku nieprodukcyjnym – np. dla kont testowych
            passwordOk = user.password === password;
        } else {
            // W produkcji nie akceptujemy haseł w postaci jawnej
            passwordOk = false;
        }

        if (!passwordOk) {
            registerFailedLogin(attemptKey);
            return res.status(401).json({ status: 'error', message: 'Nieprawidłowe dane logowania.' });
        }

        const role = user.role || 'NEW_USER';

        setAuthCookies(res, { id: user.id, role });

        resetLoginAttempts(attemptKey);

        return res.json({
            status: 'success',
            data: {
                id: user.id,
                email: user.email,
                role,
            },
        });
    } catch (err) {
        console.error('Błąd logowania:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera podczas logowania', details: err.message });
    }
});

// ============================================
// PATCH /api/orders/:id/status - zmiana statusu zamówienia
// ============================================
app.patch('/api/orders/:id/status', async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        const cookies = parseCookies(req);
        const requesterId = cookies.auth_id;
        const role = cookies.auth_role;

        if (!requesterId || !role) {
            return res.status(401).json({ status: 'error', message: 'Brak autoryzacji' });
        }

        const orderId = req.params.id;
        const { status: nextStatus } = req.body || {};

        if (!isValidStatus(nextStatus)) {
            return res.status(400).json({ status: 'error', message: 'Nieprawidłowy status' });
        }

        const { data: order, error } = await supabase
            .from('Order')
            .select('id, userId, status')
            .eq('id', orderId)
            .single();

        if (error) {
            console.error('Błąd pobierania zamówienia do zmiany statusu:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się pobrać zamówienia' });
        }

        if (!order) {
            return res.status(404).json({ status: 'error', message: 'Zamówienie nie istnieje' });
        }

        if (!canRoleAccessOrder(role, requesterId, order.userId)) {
            return res.status(403).json({ status: 'error', message: 'Brak uprawnień do zmiany statusu zamówienia' });
        }

        if (!canRoleChangeStatus(role, order.status, nextStatus)) {
            return res.status(403).json({ status: 'error', message: 'Nie możesz zmienić statusu w ten sposób' });
        }

        const { error: updateError } = await supabase
            .from('Order')
            .update({ status: nextStatus, updatedAt: new Date().toISOString() })
            .eq('id', orderId);

        if (updateError) {
            console.error('Błąd aktualizacji statusu zamówienia:', updateError);
            return res.status(500).json({ status: 'error', message: 'Nie udało się zaktualizować statusu zamówienia' });
        }

        // Zapis do historii zmian statusu z poprawnym użytkownikiem (zalogowany)
        const { error: historyError } = await supabase
            .from('OrderStatusHistory')
            .insert({
                orderId: orderId,
                oldStatus: order.status,
                newStatus: nextStatus,
                changedBy: requesterId, // Używamy zalogowanego użytkownika, nie twórcy zamówienia
                changedAt: new Date().toISOString(),
                notes: `Zmiana statusu przez ${role}`
            });

        if (historyError) {
            console.error('Błąd zapisu do historii zmian:', historyError);
            // Nie przerywamy operacji, tylko logujemy błąd
        }

        // ============================================
        // AUTOMATYCZNE AKCJE PO ZMIANIE STATUSU
        // ============================================
        
        // Przy przejściu na APPROVED → automatycznie tworzymy zlecenia produkcyjne
        if (nextStatus === 'APPROVED') {
            try {
                const result = await createProductionOrdersForOrder(orderId, { userId: requesterId });
                if (result.created > 0) {
                    console.log(`[PATCH /api/orders/:id/status] Automatycznie utworzono ${result.created} zleceń produkcyjnych dla zamówienia ${orderId}`);
                }
                if (result.errors && result.errors.length > 0) {
                    console.warn(`[PATCH /api/orders/:id/status] Błędy przy tworzeniu zleceń:`, result.errors);
                }
            } catch (prodError) {
                console.error('[PATCH /api/orders/:id/status] Błąd automatycznego tworzenia zleceń:', prodError);
                // Nie blokujemy zmiany statusu - zlecenia można utworzyć ręcznie później
            }
        }

        // Przy przejściu na CANCELLED → automatycznie anulujemy zlecenia produkcyjne
        if (nextStatus === 'CANCELLED') {
            try {
                const result = await cancelProductionOrdersForOrder(orderId);
                if (result.cancelled > 0) {
                    console.log(`[PATCH /api/orders/:id/status] Automatycznie anulowano ${result.cancelled} zleceń produkcyjnych dla zamówienia ${orderId}`);
                }
            } catch (cancelError) {
                console.error('[PATCH /api/orders/:id/status] Błąd automatycznego anulowania zleceń:', cancelError);
                // Nie blokujemy zmiany statusu
            }
        }

        return res.json({ status: 'success', data: { id: orderId, status: nextStatus } });
    } catch (error) {
        console.error('Błąd w PATCH /api/orders/:id/status:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera podczas zmiany statusu' });
    }
});

// ============================================
// GET /api/orders/:id/history - pobranie historii zmian statusu zamówienia
// ============================================
// Pobiera historię zmian statusu zamówienia
app.get('/api/orders/:id/history', async (req, res) => {
    console.log('[GET /api/orders/:id/history] START');
    
    if (!supabase) {
        console.log('[GET /api/orders/:id/history] Brak Supabase');
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        const orderId = req.params.id;
        const cookies = parseCookies(req);
        const userId = cookies.auth_id;
        const role = cookies.auth_role;
        
        console.log('[GET /api/orders/:id/history] orderId:', orderId, 'userId:', userId, 'role:', role);

        // Sprawdź, czy użytkownik ma dostęp do zamówienia
        const { data: order, error: orderError } = await supabase
            .from('Order')
            .select('id, userId')
            .eq('id', orderId)
            .single();

        if (orderError) {
            console.error('[GET /api/orders/:id/history] Błąd pobierania zamówienia:', orderError);
            throw orderError;
        }
        
        if (!order) {
            console.log('[GET /api/orders/:id/history] Zamówienie nie znalezione');
            return res.status(404).json({ status: 'error', message: 'Zamówienie nie znalezione' });
        }

        // Sprawdź uprawnienia
        console.log('[GET /api/orders/:id/history] Sprawdzanie uprawnień:', {
            role: role,
            userId: userId,
            orderUserId: order.userId,
            canAccess: canRoleAccessOrder(role, userId, order.userId)
        });
        
        if (!canRoleAccessOrder(role, userId, order.userId)) {
            console.log('[GET /api/orders/:id/history] Brak uprawnień - role:', role, 'userId:', userId, 'orderUserId:', order.userId);
            return res.status(403).json({ 
                status: 'error', 
                message: 'Brak uprawnień do przeglądania historii tego zamówienia' 
            });
        }

        // Pobierz historię zmian statusu
        console.log('[GET /api/orders/:id/history] Pobieranie historii...');
        
        const { data: history, error: historyError } = await supabase
            .from('OrderStatusHistory')
            .select('id, oldStatus, newStatus, changedAt, notes, changedBy')
            .eq('orderId', orderId)
            .order('changedAt', { ascending: false });

        console.log('[GET /api/orders/:id/history] historyError:', historyError);
        console.log('[GET /api/orders/:id/history] history:', history);

        if (historyError) {
            console.error('[GET /api/orders/:id/history] Błąd Supabase:', historyError);
            return res.status(500).json({ 
                status: 'error', 
                message: 'Błąd bazy danych: ' + historyError.message 
            });
        }

        // Pobierz dane użytkowników dla historii
        if (history && history.length > 0) {
            const userIds = [...new Set(history.map(h => h.changedBy))];
            const { data: users, error: usersError } = await supabase
                .from('User')
                .select('id, name')
                .in('id', userIds);

            if (!usersError && users) {
                // Dołącz dane użytkowników do historii
                history.forEach(entry => {
                    const user = users.find(u => u.id === entry.changedBy);
                    entry.User = user || { name: 'System' };
                });
            }
        }

        console.log('[GET /api/orders/:id/history] Sukces, zwracam', (history || []).length, 'wpisów');
        return res.json({ 
            status: 'success', 
            data: history || [] 
        });

    } catch (error) {
        console.error('[GET /api/orders/:id/history] CATCH ERROR:', error);
        return res.status(500).json({ 
            status: 'error', 
            message: 'Błąd serwera: ' + (error.message || String(error))
        });
    }
});

// ============================================
// PATCH /api/orders/:id - edycja notatek
// ============================================
app.patch('/api/orders/:id', async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        const cookies = parseCookies(req);
        const requesterId = cookies.auth_id;
        const role = cookies.auth_role;

        if (!requesterId || !role) {
            return res.status(401).json({ status: 'error', message: 'Brak autoryzacji' });
        }

        const orderId = req.params.id;
        const { notes } = req.body || {};

        if (typeof notes !== 'string') {
            return res.status(400).json({ status: 'error', message: 'Pole notes jest wymagane' });
        }

        const { data: order, error } = await supabase
            .from('Order')
            .select('id, userId')
            .eq('id', orderId)
            .single();

        if (error) {
            console.error('Błąd pobierania zamówienia do edycji notatek:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się pobrać zamówienia' });
        }

        if (!order) {
            return res.status(404).json({ status: 'error', message: 'Zamówienie nie istnieje' });
        }

        const canEditNotes = ['ADMIN', 'SALES_DEPT'].includes(role) || (role === 'SALES_REP' && order.userId === requesterId);

        if (!canEditNotes) {
            return res.status(403).json({ status: 'error', message: 'Brak uprawnień do edycji notatek' });
        }

        const { error: updateError } = await supabase
            .from('Order')
            .update({ notes, updatedAt: new Date().toISOString() })
            .eq('id', orderId);

        if (updateError) {
            console.error('Błąd aktualizacji notatek zamówienia:', updateError);
            return res.status(500).json({ status: 'error', message: 'Nie udało się zaktualizować notatek zamówienia' });
        }

        return res.json({ status: 'success', data: { id: orderId, notes } });
    } catch (error) {
        console.error('Błąd w PATCH /api/orders/:id:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera podczas edycji zamówienia' });
    }
});

// ============================================
// DELETE /api/orders/:id - usunięcie zamówienia (tylko ADMIN)
// ============================================
app.delete('/api/orders/:id', async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        const cookies = parseCookies(req);
        const requesterId = cookies.auth_id;
        const role = cookies.auth_role;

        if (!requesterId || !role) {
            return res.status(401).json({ status: 'error', message: 'Brak autoryzacji' });
        }

        // Tylko ADMIN może usuwać zamówienia
        if (role !== 'ADMIN') {
            return res.status(403).json({ status: 'error', message: 'Tylko administrator może usuwać zamówienia' });
        }

        const orderId = req.params.id;

        // Sprawdź czy zamówienie istnieje
        const { data: order, error: fetchError } = await supabase
            .from('Order')
            .select('id, orderNumber')
            .eq('id', orderId)
            .single();

        if (fetchError || !order) {
            return res.status(404).json({ status: 'error', message: 'Zamówienie nie istnieje' });
        }

        // Pobierz powiązane zlecenia produkcyjne
        const { data: productionOrders } = await supabase
            .from('ProductionOrder')
            .select('id, orderNumber, status')
            .eq('sourceorderid', orderId);

        let deletedProductionOrders = 0;
        let skippedProductionOrders = 0;

        if (productionOrders && productionOrders.length > 0) {
            // Sprawdź czy któreś zlecenie jest w trakcie
            const inProgressOrders = productionOrders.filter(po => po.status === 'in_progress');
            
            if (inProgressOrders.length > 0 && req.query.force !== 'true') {
                return res.status(400).json({ 
                    status: 'error', 
                    message: `Nie można usunąć - ${inProgressOrders.length} zleceń produkcyjnych jest w trakcie realizacji`,
                    productionOrders: productionOrders.map(po => ({ id: po.id, orderNumber: po.orderNumber, status: po.status })),
                    requiresForce: true
                });
            }

            // Usuń operacje produkcyjne dla każdego zlecenia
            for (const po of productionOrders) {
                const { error: deleteOpsError } = await supabase
                    .from('ProductionOperation')
                    .delete()
                    .eq('productionorderid', po.id);

                if (deleteOpsError) {
                    console.error(`Błąd usuwania operacji dla zlecenia ${po.id}:`, deleteOpsError);
                    skippedProductionOrders++;
                    continue;
                }

                // Usuń zlecenie produkcyjne
                const { error: deletePOError } = await supabase
                    .from('ProductionOrder')
                    .delete()
                    .eq('id', po.id);

                if (deletePOError) {
                    console.error(`Błąd usuwania zlecenia produkcyjnego ${po.id}:`, deletePOError);
                    skippedProductionOrders++;
                } else {
                    deletedProductionOrders++;
                }
            }
        }

        // Usuń pozycje zamówienia (OrderItem)
        const { error: deleteItemsError } = await supabase
            .from('OrderItem')
            .delete()
            .eq('orderId', orderId);

        if (deleteItemsError) {
            console.error('Błąd usuwania pozycji zamówienia:', deleteItemsError);
            return res.status(500).json({ status: 'error', message: 'Nie udało się usunąć pozycji zamówienia' });
        }

        // Usuń zamówienie
        const { error: deleteOrderError } = await supabase
            .from('Order')
            .delete()
            .eq('id', orderId);

        if (deleteOrderError) {
            console.error('Błąd usuwania zamówienia:', deleteOrderError);
            return res.status(500).json({ status: 'error', message: 'Nie udało się usunąć zamówienia' });
        }

        console.log(`[DELETE /api/orders/${orderId}] Zamówienie ${order.orderNumber} usunięte przez ${requesterId}, zlecenia produkcyjne: ${deletedProductionOrders} usunięte, ${skippedProductionOrders} pominięte`);
        return res.json({ 
            status: 'success', 
            message: 'Zamówienie zostało usunięte',
            deletedProductionOrders,
            skippedProductionOrders
        });
    } catch (error) {
        console.error('Błąd w DELETE /api/orders/:id:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera podczas usuwania zamówienia' });
    }
});

// ============================================
// POST /api/orders/bulk-delete - hurtowe usuwanie zamówień (tylko ADMIN)
// ============================================
app.post('/api/orders/bulk-delete', requireRole(['ADMIN']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        const { orderIds, forceDeleteProduction = false } = req.body;
        const { userId: requesterId } = await getAuthContext(req);

        if (!Array.isArray(orderIds) || orderIds.length === 0) {
            return res.status(400).json({ status: 'error', message: 'Brak listy zamówień do usunięcia' });
        }

        if (orderIds.length > 100) {
            return res.status(400).json({ status: 'error', message: 'Maksymalnie 100 zamówień na raz' });
        }

        console.log(`[BULK DELETE] Admin ${requesterId} usuwa ${orderIds.length} zamówień, forceDeleteProduction: ${forceDeleteProduction}`);

        const results = {
            deleted: [],
            failed: [],
            productionOrdersDeleted: 0,
            productionOrdersSkipped: 0
        };

        for (const orderId of orderIds) {
            try {
                // Pobierz zamówienie
                const { data: order, error: orderError } = await supabase
                    .from('Order')
                    .select('id, orderNumber, status')
                    .eq('id', orderId)
                    .single();

                if (orderError || !order) {
                    results.failed.push({ id: orderId, reason: 'Nie znaleziono zamówienia' });
                    continue;
                }

                // Pobierz zlecenia produkcyjne
                const { data: productionOrders } = await supabase
                    .from('ProductionOrder')
                    .select('id, ordernumber, status')
                    .eq('sourceorderid', orderId);

                // Usuń zlecenia produkcyjne
                if (productionOrders && productionOrders.length > 0) {
                    for (const po of productionOrders) {
                        // Jeśli nie forceDeleteProduction, pomijamy zlecenia w trakcie
                        if (!forceDeleteProduction && po.status === 'in_progress') {
                            results.productionOrdersSkipped++;
                            continue;
                        }

                        // Usuń operacje
                        await supabase
                            .from('ProductionOperation')
                            .delete()
                            .eq('productionorderid', po.id);

                        // Usuń zlecenie
                        const { error: deletePOError } = await supabase
                            .from('ProductionOrder')
                            .delete()
                            .eq('id', po.id);

                        if (!deletePOError) {
                            results.productionOrdersDeleted++;
                        }
                    }
                }

                // Usuń zadania grafiki
                await supabase
                    .from('GraphicTask')
                    .delete()
                    .eq('orderId', orderId);

                // Usuń pozycje zamówienia
                await supabase
                    .from('OrderItem')
                    .delete()
                    .eq('orderId', orderId);

                // Usuń zamówienie
                const { error: deleteOrderError } = await supabase
                    .from('Order')
                    .delete()
                    .eq('id', orderId);

                if (deleteOrderError) {
                    results.failed.push({ id: orderId, orderNumber: order.orderNumber, reason: 'Błąd usuwania' });
                } else {
                    results.deleted.push({ id: orderId, orderNumber: order.orderNumber });
                }
            } catch (err) {
                console.error(`[BULK DELETE] Błąd dla zamówienia ${orderId}:`, err);
                results.failed.push({ id: orderId, reason: err.message });
            }
        }

        console.log(`[BULK DELETE] Zakończono: ${results.deleted.length} usunięte, ${results.failed.length} nieudane, ${results.productionOrdersDeleted} zleceń produkcyjnych usunięte`);

        return res.json({
            status: 'success',
            message: `Usunięto ${results.deleted.length} z ${orderIds.length} zamówień`,
            ...results
        });
    } catch (error) {
        console.error('Błąd w POST /api/orders/bulk-delete:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera podczas hurtowego usuwania' });
    }
});

// Sync user role from database to cookie
app.post('/api/auth/sync-role', async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const cookies = parseCookies(req);
    const userId = cookies.auth_id;

    if (!userId) {
        return res.status(401).json({ status: 'error', message: 'Brak autoryzacji' });
    }

    try {
        const { data: user, error } = await supabase
            .from('User')
            .select('id, role')
            .eq('id', userId)
            .single();

        if (error || !user) {
            return res.status(404).json({ status: 'error', message: 'Użytkownik nie znaleziony' });
        }

        const role = user.role || 'NEW_USER';
        setAuthCookies(res, { id: user.id, role });

        return res.json({
            status: 'success',
            data: {
                id: user.id,
                role: role
            }
        });
    } catch (error) {
        console.error('Błąd synchronizacji roli:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// Wylogowanie – czyści ciasteczka auth
app.post('/api/auth/logout', (req, res) => {
    clearAuthCookies(res);
    return res.json({ status: 'success', message: 'Wylogowano.' });
});

// Sprawdzenie aktualnego użytkownika
app.get('/api/auth/me', async (req, res) => {
    const cookies = parseCookies(req);
    const userId = cookies.auth_id;
    const role = cookies.auth_role;

    if (!userId || !role) {
        return res.status(401).json({ status: 'error', message: 'Nieautoryzowany' });
    }

    // Jeśli Supabase nie jest skonfigurowany – zwróć minimalne dane z ciasteczka
    if (!supabase) {
        return res.json({
            status: 'success',
            id: userId,
            role: role
        });
    }

    try {
        const { data: user, error } = await supabase
            .from('User')
            .select(`
                id, email, name, role, departmentId, createdAt, isActive, productionroomid,
                productionRoom:ProductionRoom!User_productionroomid_fkey(id, name, code)
            `)
            .eq('id', userId)
            .single();

        if (error) {
            console.error('Błąd pobierania użytkownika w /api/auth/me:', error);
            return res.status(500).json({ status: 'error', message: 'Błąd pobierania użytkownika' });
        }

        if (!user) {
            return res.status(404).json({ status: 'error', message: 'Użytkownik nie znaleziony' });
        }

        return res.json({
            status: 'success',
            id: user.id,
            role: role,
            email: user.email || null,
            name: user.name || null,
            departmentId: user.departmentId || null,
            productionroomid: user.productionroomid || null,
            productionRoomName: user.productionRoom?.name || null,
            productionRoomCode: user.productionRoom?.code || null
        });
    } catch (err) {
        console.error('Wyjątek w /api/auth/me:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera podczas pobierania użytkownika' });
    }
});

// ============================================
// WIELOROLE - MES-compliant role management
// ============================================

/**
 * Lista wszystkich dozwolonych ról w systemie (MES-compliant)
 * Używana do walidacji i UI
 */
const ALL_ROLES = [
    'ADMIN',
    'SALES_REP',
    'SALES_DEPT',
    'WAREHOUSE',
    'PRODUCTION',
    'PRODUCTION_MANAGER',
    'OPERATOR',
    'GRAPHIC_DESIGNER',
    'GRAPHICS',  // legacy, do stopniowej migracji na GRAPHIC_DESIGNER
    'CLIENT',
    'NEW_USER'
];

/**
 * Role produkcyjne - wymagają przypisania do pokoju produkcyjnego
 */
const PRODUCTION_ROLES = ['PRODUCTION', 'PRODUCTION_MANAGER', 'OPERATOR'];

/**
 * GET /api/auth/roles
 * Zwraca wszystkie aktywne role zalogowanego użytkownika
 */
app.get('/api/auth/roles', async (req, res) => {
    const cookies = parseCookies(req);
    const userId = cookies.auth_id;

    if (!userId) {
        return res.status(401).json({ status: 'error', message: 'Nieautoryzowany' });
    }

    if (!supabase) {
        // Fallback: zwróć rolę z ciasteczka
        const role = cookies.auth_role;
        return res.json({
            status: 'success',
            data: {
                userId,
                activeRole: role,
                roles: role ? [role] : []
            }
        });
    }

    try {
        // Pobierz wszystkie aktywne role użytkownika
        const { data: assignments, error } = await supabase
            .from('UserRoleAssignment')
            .select('role, assignedAt')
            .eq('userId', userId)
            .eq('isActive', true)
            .order('assignedAt', { ascending: true });

        if (error) {
            console.error('[GET /api/auth/roles] Błąd:', error);
            // Fallback do roli z User
            const { data: user } = await supabase
                .from('User')
                .select('role')
                .eq('id', userId)
                .single();
            
            return res.json({
                status: 'success',
                data: {
                    userId,
                    activeRole: cookies.auth_role || user?.role,
                    roles: user?.role ? [user.role] : []
                }
            });
        }

        const roles = (assignments || []).map(a => a.role);
        const activeRole = cookies.auth_role;

        return res.json({
            status: 'success',
            data: {
                userId,
                activeRole,
                roles,
                allAvailableRoles: ALL_ROLES
            }
        });
    } catch (err) {
        console.error('[GET /api/auth/roles] Wyjątek:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

/**
 * POST /api/auth/active-role
 * Zmienia aktywną rolę użytkownika (musi mieć tę rolę przypisaną)
 */
app.post('/api/auth/active-role', async (req, res) => {
    const cookies = parseCookies(req);
    const userId = cookies.auth_id;
    const { role } = req.body || {};

    if (!userId) {
        return res.status(401).json({ status: 'error', message: 'Nieautoryzowany' });
    }

    if (!role || !ALL_ROLES.includes(role)) {
        return res.status(400).json({ status: 'error', message: 'Nieprawidłowa rola' });
    }

    if (!supabase) {
        // Bez Supabase - po prostu ustaw ciasteczko
        setAuthCookies(res, { id: userId, role });
        return res.json({ status: 'success', data: { activeRole: role } });
    }

    try {
        // Sprawdź czy użytkownik ma tę rolę
        const { data: assignment, error } = await supabase
            .from('UserRoleAssignment')
            .select('id')
            .eq('userId', userId)
            .eq('role', role)
            .eq('isActive', true)
            .single();

        if (error || !assignment) {
            // Sprawdź też główną rolę w User
            const { data: user } = await supabase
                .from('User')
                .select('role')
                .eq('id', userId)
                .single();

            if (!user || user.role !== role) {
                return res.status(403).json({ 
                    status: 'error', 
                    message: 'Nie masz przypisanej tej roli' 
                });
            }
        }

        // Ustaw nową aktywną rolę w ciasteczku
        setAuthCookies(res, { id: userId, role });

        return res.json({ 
            status: 'success', 
            data: { activeRole: role },
            message: `Aktywna rola zmieniona na ${role}`
        });
    } catch (err) {
        console.error('[POST /api/auth/active-role] Wyjątek:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

/**
 * GET /api/admin/user-role-assignments
 * Pobiera przypisania ról dla użytkownika (tylko ADMIN)
 * Query params: userId (wymagane)
 */
app.get('/api/admin/user-role-assignments', requireRole(['ADMIN']), async (req, res) => {
    const { userId } = req.query;

    if (!userId) {
        return res.status(400).json({ status: 'error', message: 'userId jest wymagane' });
    }

    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        const { data: assignments, error } = await supabase
            .from('UserRoleAssignment')
            .select('id, role, assignedBy, assignedAt, isActive')
            .eq('userId', userId)
            .order('role');

        if (error) {
            console.error('[GET /api/admin/user-role-assignments] Błąd:', error);
            return res.status(500).json({ status: 'error', message: 'Błąd pobierania ról' });
        }

        return res.json({
            status: 'success',
            data: {
                userId,
                assignments: assignments || [],
                allAvailableRoles: ALL_ROLES,
                productionRoles: PRODUCTION_ROLES
            }
        });
    } catch (err) {
        console.error('[GET /api/admin/user-role-assignments] Wyjątek:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

/**
 * POST /api/admin/user-role-assignments
 * Przypisuje rolę do użytkownika (tylko ADMIN)
 */
app.post('/api/admin/user-role-assignments', requireRole(['ADMIN']), async (req, res) => {
    const { userId, role } = req.body || {};
    const cookies = parseCookies(req);
    const adminId = cookies.auth_id;

    if (!userId || !role) {
        return res.status(400).json({ status: 'error', message: 'userId i role są wymagane' });
    }

    if (!ALL_ROLES.includes(role)) {
        return res.status(400).json({ status: 'error', message: `Nieprawidłowa rola: ${role}` });
    }

    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        // Sprawdź czy przypisanie już istnieje
        const { data: existing } = await supabase
            .from('UserRoleAssignment')
            .select('id, isActive')
            .eq('userId', userId)
            .eq('role', role)
            .single();

        if (existing) {
            if (existing.isActive) {
                return res.status(409).json({ 
                    status: 'error', 
                    message: 'Użytkownik ma już przypisaną tę rolę' 
                });
            }
            // Reaktywuj istniejące przypisanie
            const { data: updated, error: updateError } = await supabase
                .from('UserRoleAssignment')
                .update({ isActive: true, assignedBy: adminId, assignedAt: new Date().toISOString() })
                .eq('id', existing.id)
                .select()
                .single();

            if (updateError) {
                console.error('[POST /api/admin/user-role-assignments] Błąd reaktywacji:', updateError);
                return res.status(500).json({ status: 'error', message: 'Błąd reaktywacji roli' });
            }

            // Log audytu
            await supabase.from('UserRoleAssignmentLog').insert({
                assignmentId: existing.id,
                userId,
                role,
                action: 'ACTIVATED',
                changedBy: adminId
            });

            return res.json({ status: 'success', data: updated, message: 'Rola została reaktywowana' });
        }

        // Utwórz nowe przypisanie
        const { data: assignment, error } = await supabase
            .from('UserRoleAssignment')
            .insert({
                userId,
                role,
                assignedBy: adminId,
                isActive: true
            })
            .select()
            .single();

        if (error) {
            console.error('[POST /api/admin/user-role-assignments] Błąd:', error);
            return res.status(500).json({ status: 'error', message: 'Błąd przypisywania roli' });
        }

        // Log audytu
        await supabase.from('UserRoleAssignmentLog').insert({
            assignmentId: assignment.id,
            userId,
            role,
            action: 'ASSIGNED',
            changedBy: adminId
        });

        console.log(`[POST /api/admin/user-role-assignments] Admin ${adminId} przypisał rolę ${role} użytkownikowi ${userId}`);

        return res.status(201).json({ 
            status: 'success', 
            data: assignment,
            message: `Rola ${role} została przypisana`
        });
    } catch (err) {
        console.error('[POST /api/admin/user-role-assignments] Wyjątek:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

/**
 * DELETE /api/admin/user-role-assignments/:id
 * Usuwa (dezaktywuje) przypisanie roli (tylko ADMIN)
 */
app.delete('/api/admin/user-role-assignments/:id', requireRole(['ADMIN']), async (req, res) => {
    const assignmentId = parseInt(req.params.id);
    const cookies = parseCookies(req);
    const adminId = cookies.auth_id;

    if (isNaN(assignmentId)) {
        return res.status(400).json({ status: 'error', message: 'Nieprawidłowe ID przypisania' });
    }

    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        // Pobierz przypisanie
        const { data: assignment, error: fetchError } = await supabase
            .from('UserRoleAssignment')
            .select('id, userId, role, isActive')
            .eq('id', assignmentId)
            .single();

        if (fetchError || !assignment) {
            return res.status(404).json({ status: 'error', message: 'Przypisanie nie znalezione' });
        }

        if (!assignment.isActive) {
            return res.status(400).json({ status: 'error', message: 'Przypisanie jest już nieaktywne' });
        }

        // Dezaktywuj (soft delete)
        const { error: updateError } = await supabase
            .from('UserRoleAssignment')
            .update({ isActive: false })
            .eq('id', assignmentId);

        if (updateError) {
            console.error('[DELETE /api/admin/user-role-assignments] Błąd:', updateError);
            return res.status(500).json({ status: 'error', message: 'Błąd usuwania przypisania' });
        }

        // Log audytu
        await supabase.from('UserRoleAssignmentLog').insert({
            assignmentId,
            userId: assignment.userId,
            role: assignment.role,
            action: 'REVOKED',
            changedBy: adminId
        });

        console.log(`[DELETE /api/admin/user-role-assignments] Admin ${adminId} odebrał rolę ${assignment.role} użytkownikowi ${assignment.userId}`);

        return res.json({ 
            status: 'success', 
            message: `Rola ${assignment.role} została odebrana`
        });
    } catch (err) {
        console.error('[DELETE /api/admin/user-role-assignments] Wyjątek:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

/**
 * PUT /api/admin/user-role-assignments/sync/:userId
 * Synchronizuje role użytkownika - ustawia dokładnie te role, które są w tablicy
 * Body: { roles: ['OPERATOR', 'GRAPHIC_DESIGNER'] }
 */
app.put('/api/admin/user-role-assignments/sync/:userId', requireRole(['ADMIN']), async (req, res) => {
    const { userId } = req.params;
    const { roles } = req.body || {};
    const cookies = parseCookies(req);
    const adminId = cookies.auth_id;

    if (!userId) {
        return res.status(400).json({ status: 'error', message: 'userId jest wymagane' });
    }

    if (!Array.isArray(roles)) {
        return res.status(400).json({ status: 'error', message: 'roles musi być tablicą' });
    }

    // Walidacja ról
    const invalidRoles = roles.filter(r => !ALL_ROLES.includes(r));
    if (invalidRoles.length > 0) {
        return res.status(400).json({ 
            status: 'error', 
            message: `Nieprawidłowe role: ${invalidRoles.join(', ')}` 
        });
    }

    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        // Pobierz aktualne przypisania
        const { data: currentAssignments } = await supabase
            .from('UserRoleAssignment')
            .select('id, role, isActive')
            .eq('userId', userId);

        const currentRoles = (currentAssignments || [])
            .filter(a => a.isActive)
            .map(a => a.role);

        const rolesToAdd = roles.filter(r => !currentRoles.includes(r));
        const rolesToRemove = currentRoles.filter(r => !roles.includes(r));

        // Dodaj nowe role
        for (const role of rolesToAdd) {
            const existing = (currentAssignments || []).find(a => a.role === role);
            if (existing) {
                // Reaktywuj
                await supabase
                    .from('UserRoleAssignment')
                    .update({ isActive: true, assignedBy: adminId, assignedAt: new Date().toISOString() })
                    .eq('id', existing.id);
            } else {
                // Utwórz nowe
                await supabase
                    .from('UserRoleAssignment')
                    .insert({ userId, role, assignedBy: adminId, isActive: true });
            }
        }

        // Usuń (dezaktywuj) role
        for (const role of rolesToRemove) {
            const existing = (currentAssignments || []).find(a => a.role === role && a.isActive);
            if (existing) {
                await supabase
                    .from('UserRoleAssignment')
                    .update({ isActive: false })
                    .eq('id', existing.id);
            }
        }

        // Zaktualizuj główną rolę w User (pierwsza z listy lub NEW_USER)
        const primaryRole = roles.length > 0 ? roles[0] : 'NEW_USER';
        await supabase
            .from('User')
            .update({ role: primaryRole, updatedAt: new Date().toISOString() })
            .eq('id', userId);

        console.log(`[PUT /api/admin/user-role-assignments/sync] Admin ${adminId} zsynchronizował role użytkownika ${userId}: ${roles.join(', ')}`);

        return res.json({
            status: 'success',
            data: {
                userId,
                roles,
                added: rolesToAdd,
                removed: rolesToRemove
            },
            message: 'Role zostały zsynchronizowane'
        });
    } catch (err) {
        console.error('[PUT /api/admin/user-role-assignments/sync] Wyjątek:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// KONIEC SEKCJI WIELORÓL
// ============================================

// Test połączenia z Supabase – proste zapytanie do tabeli produktów (tylko ADMIN)
app.get('/api/supabase/health', requireRole(['ADMIN']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({
            status: 'error',
            message: 'Supabase nie jest skonfigurowany. Ustaw SUPABASE_URL i SUPABASE_SERVICE_ROLE_KEY w backend/.env.',
        });
    }

    try {
        const { data, error } = await supabase
            .from(SUPABASE_TABLE_PRODUCTS)
            .select('*')
            .limit(1);

        if (error) {
            console.error('Błąd Supabase:', error);
            return res.status(500).json({ status: 'error', message: 'Błąd zapytania do Supabase', details: error.message });
        }

        return res.json({
            status: 'OK',
            table: SUPABASE_TABLE_PRODUCTS,
            rowCount: Array.isArray(data) ? data.length : 0,
        });
    } catch (err) {
        console.error('Wyjątek Supabase:', err);
        return res.status(500).json({ status: 'error', message: 'Wyjątek podczas łączenia z Supabase', details: err.message });
    }
});

// Endpoint produktów dla głównego formularza zamówień
// Dane pochodzą z Supabase (Product + Inventory), ale struktura odpowiedzi
// jest zgodna z tym, czego oczekuje istniejący frontend (name, pc_id, stock, stock_optimal itd.).
app.get('/api/v1/products', async (req, res) => {
    if (!supabase) {
        return res.status(500).json({
            status: 'error',
            message: 'Supabase nie jest skonfigurowany. Ustaw SUPABASE_URL i SUPABASE_SERVICE_ROLE_KEY w backend/.env.'
        });
    }

    const { search } = req.query;

    try {
        let query = supabase
            .from('Product')
            .select(`
                id,
                identifier,
                index,
                price,
                category,
                description,
                isActive,
                new,
                Inventory (
                    stock,
                    stockOptimal,
                    stockOrdered,
                    stockReserved,
                    location
                )
            `)
            .eq('isActive', true)
            .order('identifier', { ascending: true });

        if (search && typeof search === 'string' && search.trim()) {
            const term = `%${search.trim()}%`;
            query = query.or(
                `identifier.ilike.${term},index.ilike.${term},description.ilike.${term}`
            );
        }

        const { data, error } = await query;

        if (error) {
            console.error('Błąd pobierania produktów z Supabase dla /api/v1/products:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Nie udało się pobrać produktów z bazy',
                details: error.message,
            });
        }

        const products = (data || []).map((product) => {
            const invArray = Array.isArray(product.Inventory) ? product.Inventory : [];
            const mainInventory = invArray.find((inv) => inv.location === 'MAIN') || {};

            return {
                // klucze zgodne z tym, co wykorzystuje scripts/app.js
                _id: product.id,
                name: product.identifier,          // w UI używamy identifier jako nazwy
                pc_id: product.index,              // dawny indeks techniczny
                price: Number(product.price || 0),
                category: product.category,
                description: product.description || '',
                stock: Number(mainInventory.stock || 0),
                stock_optimal: Number(mainInventory.stockOptimal || 0),
                stock_ordered: Number(mainInventory.stockOrdered || 0),
                stock_reserved: Number(mainInventory.stockReserved || 0),
                isActive: product.isActive !== false,
                new: !!product.new,
            };
        });

        // Struktura kompatybilna z istniejącym frontendem (json.data?.products || ...)
        return res.json({
            data: {
                products,
            },
        });
    } catch (error) {
        console.error('Wyjątek w /api/v1/products (Supabase):', error);
        return res.status(500).json({
            status: 'error',
            message: 'Nie udało się pobrać produktów',
            error: error.message,
        });
    }
});

// Proste proxy do galerii (QNAP) – wszystkie zapytania idą przez backend

async function proxyGalleryRequest(req, res, targetUrl, contextLabel) {
    try {
        console.log(`[${contextLabel}] Proxy request do:`, targetUrl);
        
        // Ustawiamy nagłówki CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        
        // Obsługa zapytań OPTIONS (preflight)
        if (req.method === 'OPTIONS') {
            return res.status(200).end();
        }

        const response = await fetch(targetUrl);
        const status = response.status;

        let data;
        try {
            data = await response.json();
        } catch (parseError) {
            console.error(`Błąd parsowania JSON z galerii (${contextLabel}):`, parseError);
            return res.status(502).json({
                error: 'Invalid JSON from gallery backend',
                context: contextLabel,
            });
        }

        // Transform the response data to match frontend expectations
        let transformedData = data;
        
        // If this is a salespeople request, ensure the response has a salesPeople array
        if (contextLabel === 'salespeople' && !data.salesPeople && Array.isArray(data)) {
            transformedData = { salesPeople: data };
        }
        // If this is a cities request, ensure the response has a cities array
        else if (contextLabel === 'cities' && !data.cities && Array.isArray(data)) {
            transformedData = { cities: data };
        }
        // If this is an objects request, ensure the response has an objects array
        else if (contextLabel.startsWith('objects/') && !data.objects && Array.isArray(data)) {
            transformedData = { objects: data };
        }
        
        // Transform URL-y obrazków z lokalnego IP na publiczny adres
        if (transformedData.files && Array.isArray(transformedData.files)) {
            transformedData.files = transformedData.files.map(file => {
                if (file.url && file.url.includes('192.168.0.30')) {
                    file.url = file.url.replace('http://192.168.0.30:81', 'http://rezon.myqnapcloud.com:81');
                }
                return file;
            });
        }

        return res.status(status).json(transformedData);
    } catch (error) {
        console.error(`Błąd proxy galerii (${contextLabel}):`, error);
        return res.status(502).json({
            error: 'Gallery proxy error',
            context: contextLabel,
            details: error.message,
        });
    }
}

async function enrichGalleryProductsData(galleryData) {
    if (!supabase || !galleryData || typeof galleryData !== 'object') {
        return galleryData || {};
    }

    try {
        const slugSet = new Set();

        if (Array.isArray(galleryData.products)) {
            galleryData.products.forEach((slug) => {
                if (typeof slug === 'string') {
                    const trimmed = slug.trim();
                    if (trimmed) slugSet.add(trimmed);
                }
            });
        }

        if (Array.isArray(galleryData.files)) {
            galleryData.files.forEach((file) => {
                const slug = typeof (file && file.product) === 'string' ? file.product.trim() : '';
                if (slug) slugSet.add(slug);
            });
        }

        const slugs = Array.from(slugSet);
        if (!slugs.length) {
            return { ...galleryData, projects: [] };
        }

        // 1. Upewnij się, że wszystkie slugi istnieją w GalleryProject
        const { data: existingProjects, error: existingError } = await supabase
            .from('GalleryProject')
            .select('id, slug, displayName')
            .in('slug', slugs);

        if (existingError) {
            console.error('Błąd pobierania istniejących projektów galerii:', existingError);
        }

        const existingSlugs = new Set((existingProjects || []).map((p) => p.slug));
        const missingSlugs = slugs.filter((slug) => !existingSlugs.has(slug));

        if (missingSlugs.length) {
            const nowIso = new Date().toISOString();
            const toInsert = missingSlugs.map((slug) => ({
                slug,
                displayName: slug.replace(/_/g, ' ').toUpperCase(),
                createdAt: nowIso,
            }));

            const { error: insertError } = await supabase
                .from('GalleryProject')
                .insert(toInsert);

            if (insertError) {
                // Unikalność po slugu – możliwe kolizje przy równoległych żądaniach, ale nie blokujemy działania.
                console.error('Błąd tworzenia nowych projektów galerii:', insertError);
            }
        }

        // 2. Pobierz projekty wraz z powiązaniami do produktów
        const { data: projectRows, error: projectsError } = await supabase
            .from('GalleryProject')
            .select(`
                id,
                slug,
                displayName,
                GalleryProjectProduct:GalleryProjectProduct(
                    productId
                )
            `)
            .in('slug', slugs);

        if (projectsError) {
            console.error('Błąd pobierania mapowania projektów z Supabase:', projectsError);
            return { ...galleryData, projects: [] };
        }

        // 3. Zbierz wszystkie ID produktów powiązanych z projektami
        const productIdSet = new Set();
        (projectRows || []).forEach((row) => {
            (row.GalleryProjectProduct || []).forEach((rel) => {
                if (rel.productId) {
                    productIdSet.add(rel.productId);
                }
            });
        });

        let productsById = {};
        if (productIdSet.size) {
            const { data: products, error: productsError } = await supabase
                .from('Product')
                .select(`
                    id,
                    identifier,
                    index,
                    new,
                    availability,
                    isActive,
                    Inventory (
                        stock,
                        location
                    )
                `)
                .in('id', Array.from(productIdSet));

            if (productsError) {
                console.error('Błąd pobierania produktów dla projektów galerii:', productsError);
            } else if (Array.isArray(products)) {
                productsById = Object.fromEntries(products.map((p) => [p.id, p]));
            }
        }

        const projects = Array.isArray(projectRows)
            ? projectRows
                .map((row) => {
                    const relations = Array.isArray(row.GalleryProjectProduct)
                        ? row.GalleryProjectProduct
                        : [];

                    const products = relations
                        .map((rel) => {
                            const prod = productsById[rel.productId];
                            if (!prod) return null;

                            // Flagi wykorzystywane do sortowania listy produktów w galerii
                            const isNew = prod.new === true;

                            // Dostępność: produkt aktywny i ma dodatni stan magazynowy w lokalizacji MAIN
                            const invArray = Array.isArray(prod.Inventory) ? prod.Inventory : [];
                            const mainInventory = invArray.find((inv) => inv.location === 'MAIN') || null;
                            const stock = Number(mainInventory?.stock || 0);
                            const isAvailable = (prod.isActive !== false) && stock > 0;

                            return {
                                id: prod.id,
                                identifier: prod.identifier || null,
                                index: prod.index || null,
                                new: isNew,
                                available: isAvailable,
                            };
                        })
                        .filter(Boolean);

                    if (!products.length) {
                        return null;
                    }

                    return {
                        slug: row.slug,
                        displayName: row.displayName,
                        products,
                    };
                })
                .filter(Boolean)
            : [];

        return { ...galleryData, projects };
    } catch (error) {
        console.error('Błąd wzbogacania danych produktów galerii o mapowanie projektów:', error);
        return { ...galleryData, projects: [] };
    }
}

// Lista miejscowości - z filtrowaniem po przypisaniach użytkownika
app.get('/api/gallery/cities', async (req, res) => {
    const cookies = parseCookies(req);
    const userId = cookies.auth_id;
    const userRole = cookies.auth_role;

    // Pobierz wszystkie miejscowości z QNAP
    try {
        const phpResponse = await fetch(`${GALLERY_BASE}/list_cities.php`);
        if (!phpResponse.ok) {
            return res.status(phpResponse.status).json({ error: 'Błąd pobierania miejscowości z QNAP' });
        }
        const phpData = await phpResponse.json();
        let allCities = phpData.cities || [];

        // ADMIN i SALES_DEPT widzą wszystkie miejscowości, ale też pobierz ich przypisania
        if (userRole === 'ADMIN' || userRole === 'SALES_DEPT') {
            let assignedCities = [];
            
            // Pobierz przypisania użytkownika (jeśli ma)
            if (userId && supabase) {
                const { data: assignments } = await supabase
                    .from('UserCityAccess')
                    .select('cityName')
                    .eq('userId', userId)
                    .eq('isActive', true);
                
                if (assignments && assignments.length > 0) {
                    assignedCities = assignments.map(a => a.cityName);
                }
            }
            
            return res.json({ 
                count: allCities.length, 
                cities: allCities,
                filtered: false,
                assignedCities: assignedCities  // przypisane miejscowości użytkownika
            });
        }

        // SALES_REP i CLIENT - filtruj po przypisaniach z UserCityAccess
        if (userId && supabase && (userRole === 'SALES_REP' || userRole === 'CLIENT')) {
            const { data: assignments } = await supabase
                .from('UserCityAccess')
                .select('cityName')
                .eq('userId', userId)
                .eq('isActive', true);

            if (assignments && assignments.length > 0) {
                const allowedCities = assignments.map(a => a.cityName);
                // ZAWSZE zwracaj wszystkie miasta w 'cities', przypisane w 'assignedCities'
                return res.json({ 
                    count: allCities.length, 
                    cities: allCities,  // WSZYSTKIE miasta
                    filtered: true,
                    totalAvailable: allCities.length,
                    assignedCities: allowedCities,  // przypisane miasta
                    readOnly: false
                });
            } else {
                // Brak przypisań - pokaż wszystkie miejscowości w trybie tylko do odczytu
                return res.json({ 
                    count: allCities.length, 
                    cities: allCities,
                    filtered: true,
                    totalAvailable: allCities.length,
                    assignedCities: [],
                    readOnly: true,
                    message: 'Brak przypisanych miejscowości. Skontaktuj się z działem handlowym.'
                });
            }
        }

        // Niezalogowany lub inna rola - wszystkie miejscowości
        return res.json({ 
            count: allCities.length, 
            cities: allCities,
            filtered: false 
        });

    } catch (error) {
        console.error('Błąd w /api/gallery/cities:', error);
        return res.status(500).json({ error: 'Błąd serwera', details: error.message });
    }
});

// Lista handlowców (folderów KI) - z filtrowaniem po przypisaniach użytkownika
app.get('/api/gallery/salespeople', async (req, res) => {
    const cookies = parseCookies(req);
    const userId = cookies.auth_id;
    const userRole = cookies.auth_role;

    // Pobierz wszystkie foldery z QNAP
    try {
        const phpResponse = await fetch(`${GALLERY_BASE}/list_salespeople.php`);
        if (!phpResponse.ok) {
            return res.status(phpResponse.status).json({ error: 'Błąd pobierania folderów z QNAP' });
        }
        const phpData = await phpResponse.json();
        let allFolders = phpData.salesPeople || [];

        // ADMIN i SALES_DEPT widzą wszystkie foldery
        if (userRole === 'ADMIN' || userRole === 'SALES_DEPT') {
            return res.json({ 
                count: allFolders.length, 
                salesPeople: allFolders,
                filtered: false 
            });
        }

        // SALES_REP i CLIENT - filtruj po przypisaniach z UserFolderAccess
        if (userId && supabase && (userRole === 'SALES_REP' || userRole === 'CLIENT')) {
            const { data: assignments } = await supabase
                .from('UserFolderAccess')
                .select('folderName')
                .eq('userId', userId)
                .eq('isActive', true);

            if (assignments && assignments.length > 0) {
                const allowedFolders = assignments.map(a => a.folderName);
                const filteredFolders = allFolders.filter(folder => allowedFolders.includes(folder));
                return res.json({ 
                    count: filteredFolders.length, 
                    salesPeople: filteredFolders,
                    filtered: true,
                    totalAvailable: allFolders.length
                });
            } else {
                // Brak przypisań - pusty wynik
                return res.json({ 
                    count: 0, 
                    salesPeople: [],
                    filtered: true,
                    message: 'Brak przypisanych folderów KI'
                });
            }
        }

        // Niezalogowany lub inna rola - wszystkie foldery (lub można zwrócić błąd)
        return res.json({ 
            count: allFolders.length, 
            salesPeople: allFolders,
            filtered: false 
        });

    } catch (error) {
        console.error('Błąd w /api/gallery/salespeople:', error);
        return res.status(500).json({ error: 'Błąd serwera', details: error.message });
    }
});

// Lista obiektów dla handlowca - z autoryzacją dostępu do folderu
app.get('/api/gallery/objects/:salesperson', async (req, res) => {
    const { salesperson } = req.params;
    const cookies = parseCookies(req);
    const userId = cookies.auth_id;
    const userRole = cookies.auth_role;

    console.log('Pobieranie obiektów dla handlowca:', salesperson);

    // ADMIN i SALES_DEPT mają dostęp do wszystkich folderów
    if (userRole !== 'ADMIN' && userRole !== 'SALES_DEPT') {
        // SALES_REP i CLIENT - sprawdź czy ma przypisanie do tego folderu
        if (userId && supabase && (userRole === 'SALES_REP' || userRole === 'CLIENT')) {
            const { data: assignment } = await supabase
                .from('UserFolderAccess')
                .select('id')
                .eq('userId', userId)
                .eq('folderName', salesperson)
                .eq('isActive', true)
                .single();

            if (!assignment) {
                return res.status(403).json({ 
                    error: 'Brak dostępu do tego folderu',
                    folder: salesperson 
                });
            }
        }
    }

    const targetUrl = `${GALLERY_BASE}/list_objects.php?salesperson=${encodeURIComponent(salesperson)}`;
    console.log('URL do QNAP:', targetUrl);
    await proxyGalleryRequest(req, res, targetUrl, `objects/${salesperson}`);
});

// Lista produktów dla miejscowości
app.get('/api/gallery/products/:city', async (req, res) => {
    const { city } = req.params;
    console.log('Pobieranie produktów dla miasta:', city);
    const targetUrl = `${GALLERY_BASE}/list_products.php?city=${encodeURIComponent(city)}`;
    console.log('URL do QNAP:', targetUrl);

    try {
        const response = await fetch(targetUrl);
        const status = response.status;

        let data;
        try {
            data = await response.json();
        } catch (parseError) {
            console.error('Błąd parsowania JSON z list_products.php:', parseError);
            return res.status(502).json({
                error: 'Invalid JSON from gallery backend',
                context: `products/${city}`,
            });
        }

        if (data && Array.isArray(data.files)) {
            data.files = data.files.map((file) => {
                if (file && typeof file.url === 'string' && file.url.includes('192.168.0.30')) {
                    file.url = file.url.replace('http://192.168.0.30:81', 'http://rezon.myqnapcloud.com:81');
                }
                return file;
            });
        }

        const enriched = await enrichGalleryProductsData(data);
        return res.status(status).json(enriched);
    } catch (error) {
        console.error('Błąd pobierania produktów dla miasta z galerii:', error);
        return res.status(502).json({
            error: 'Gallery proxy error',
            context: `products/${city}`,
            details: error.message,
        });
    }
});

// Lista produktów dla obiektu (handlowiec + obiekt)
app.get('/api/gallery/products-object', async (req, res) => {
    const { salesperson, object } = req.query;
    if (!salesperson || !object) {
        return res.status(400).json({ error: 'Brak wymaganych parametrów: salesperson, object' });
    }
    console.log('Pobieranie produktów dla obiektu:', salesperson, object);
    const url = `${GALLERY_BASE}/list_products_object.php?salesperson=${encodeURIComponent(salesperson)}&object=${encodeURIComponent(object)}`;
    console.log('URL do QNAP:', url);

    try {
        const response = await fetch(url);
        const status = response.status;

        let data;
        try {
            data = await response.json();
        } catch (parseError) {
            console.error('Błąd parsowania JSON z list_products_object.php:', parseError);
            return res.status(502).json({
                error: 'Invalid JSON from gallery backend',
                context: `products/${salesperson}/${object}`,
            });
        }

        if (data && Array.isArray(data.files)) {
            data.files = data.files.map((file) => {
                if (file && typeof file.url === 'string' && file.url.includes('192.168.0.30')) {
                    file.url = file.url.replace('http://192.168.0.30:81', 'http://rezon.myqnapcloud.com:81');
                }
                return file;
            });
        }

        const enriched = await enrichGalleryProductsData(data);
        return res.status(status).json(enriched);
    } catch (error) {
        console.error('Błąd pobierania produktów dla obiektu z galerii:', error);
        return res.status(502).json({
            error: 'Gallery proxy error',
            context: `products/${salesperson}/${object}`,
            details: error.message,
        });
    }
});

// Proxy dla obrazków z galerii – żeby uniknąć mixed content (HTTPS → HTTP)
app.get('/api/gallery/image', async (req, res) => {
    try {
        const imageUrl = req.query.url;
        if (!imageUrl) {
            return res.status(400).json({ error: 'Brak parametru url' });
        }

        // Nie pozwalamy proxy’ować czegokolwiek – tylko zasoby z hosta GALLERY_BASE
        const galleryOrigin = new URL(GALLERY_BASE).origin; // np. http://rezon.myqnapcloud.com:81
        if (!imageUrl.startsWith(galleryOrigin)) {
            return res.status(400).json({ error: 'Nieprawidłowy adres obrazka' });
        }

        const response = await fetch(imageUrl);
        if (!response.ok) {
            return res.status(response.status).json({
                error: 'Nie udało się pobrać obrazka z galerii',
                status: response.status,
                statusText: response.statusText,
            });
        }

        const contentType = response.headers.get('content-type') || 'image/jpeg';
        res.setHeader('Content-Type', contentType);

        const buffer = Buffer.from(await response.arrayBuffer());
        res.end(buffer);
    } catch (error) {
        console.error('Błąd proxy obrazka galerii:', error);
        res.status(502).json({
            error: 'Gallery image proxy error',
            details: error.message,
        });
    }
});


// Mapowanie kategorii z API Rezon na ENUM w Supabase
const CATEGORY_MAPPING = {
    'akcesoria podróżne': 'AKCESORIA_PODROZNE',
    'artykuły biurowe': 'DLUGOPISY', // mapowanie na DLUGOPISY jak w starym systemie lub ARTYKULY_BIUROWE jeśli istnieje
    'breloki': 'BRELOKI',
    'gadżety domowe': 'OZDOBY_DOMOWE',
    'kubki i szklanki': 'CERAMIKA_I_SZKLO',
    'magnesy': 'MAGNESY',
    'odzież': 'TEKSTYLIA',
    'parasole': 'AKCESORIA_PODROZNE',
    'prezenty świąteczne': 'UPOMINKI_BIZNESOWE',
    'torby i plecaki': 'TEKSTYLIA',
    'bransoletki': 'BRANSOLETKI',
    'ceramika i szkło': 'CERAMIKA_I_SZKLO',
    'czapki i nakrycia głowy': 'CZAPKI_I_NAKRYCIA_GLOWY',
    'do auta': 'AKCESORIA_PODROZNE',
    'dziecięce': 'DLA_DZIECI',
    'długopisy': 'DLUGOPISY',
    'otwieracze': 'OTWIERACZE',
    'ozdoby domowe': 'OZDOBY_DOMOWE',
    'tekstylia': 'TEKSTYLIA',
    'upominki biznesowe': 'UPOMINKI_BIZNESOWE',
    'zapalniczki i popielniczki': 'ZAPALNICZKI_I_POPIELNICZKI',
    'zestawy': 'ZESTAWY'
};

// Endpoint do synchronizacji z zewnętrznym API
app.post('/api/admin/sync-from-external-api', requireRole(['ADMIN', 'SALES_DEPT']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        console.log('🚀 Rozpoczynam synchronizację z zewnętrznym API...');
        
        // 1. Pobierz produkty z API
        const response = await fetch('https://rezon-api.vercel.app/api/v1/products');
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        
        const apiData = await response.json();
        const apiProducts = apiData.data?.products || [];
        
        console.log(`📦 Pobrano ${apiProducts.length} produktów z API`);
        
        let stats = { processed: 0, updated: 0, errors: 0 };
        
        // 2. Przetwarzamy produkty (można to zoptymalizować robiąc batch, ale pętla jest bezpieczniejsza na start)
        for (const apiProd of apiProducts) {
            try {
                // Pomijamy produkty bez nazwy/id
                if (!apiProd.name && !apiProd.pc_id) continue;

                const identifier = apiProd.name || apiProd.pc_id;
                const index = apiProd.pc_id || apiProd.name;
                
                // Mapowanie kategorii
                const rawCat = (apiProd.category || '').toLowerCase();
                const mappedCat = CATEGORY_MAPPING[rawCat] || 'INNE'; // Fallback category

                // Konstrukcja URL obrazka
                let imageUrl = null;
                if (apiProd.imageCover) {
                    imageUrl = apiProd.imageCover.startsWith('http') 
                        ? apiProd.imageCover 
                        : `https://www.rezon.eu${apiProd.imageCover}`;
                }

                // A. Upsert Produktu
                // W Supabase upsert działa na podstawie Primary Key lub kolumny z constraintem UNIQUE.
                // W schemacie mamy: constraint Product_identifier_key unique (identifier)
                
                // Najpierw sprawdzamy czy produkt istnieje po identifier, żeby pobrać jego ID
                const { data: existingProd } = await supabase
                    .from('Product')
                    .select('id')
                    .eq('identifier', identifier)
                    .single();

                let productId = existingProd?.id;

                const productData = {
                    identifier: identifier,
                    index: index,
                    name: identifier, // W starym systemie name to identifier
                    description: apiProd.description || '',
                    price: apiProd.price || 0,
                    category: mappedCat,
                    isActive: apiProd.active !== false,
                    new: apiProd.new === true, // Dodano obsługę flagi NOWOŚĆ
                    imageUrl: imageUrl,
                    // images: ... (można dodać później)
                    updatedAt: new Date().toISOString()
                };

                if (productId) {
                    // Update
                    await supabase.from('Product').update(productData).eq('id', productId);
                } else {
                    // Insert
                    const { data: newProd, error: insertError } = await supabase
                        .from('Product')
                        .insert(productData)
                        .select('id')
                        .single();
                    
                    if (insertError) throw insertError;
                    productId = newProd.id;
                }

                // B. Aktualizacja Inventory (Check -> Update/Insert)
                // Tabela Inventory wymaga ID, a upsert bez ID wyrzuca błąd, bo kolumna nie ma default value.
                
                // Sprawdź czy istnieje wpis magazynowy
                const { data: existingInv } = await supabase
                    .from('Inventory')
                    .select('id')
                    .eq('productId', productId)
                    .eq('location', 'MAIN')
                    .single();

                const inventoryData = {
                    stock: apiProd.stock || 0,
                    stockOptimal: apiProd.stock_optimal || 0,
                    stockOrdered: apiProd.stock_ordered || 0,
                    updatedAt: new Date().toISOString()
                };

                if (existingInv) {
                    // Update istniejącego
                    const { error: updateErr } = await supabase
                        .from('Inventory')
                        .update(inventoryData)
                        .eq('id', existingInv.id);
                    
                    if (updateErr) throw updateErr;
                } else {
                    // Insert nowego (generujemy ID ręcznie)
                    const newInventoryData = {
                        id: crypto.randomUUID(),
                        productId: productId,
                        location: 'MAIN',
                        stockReserved: 0,
                        reorderPoint: 0,
                        ...inventoryData
                    };
                    
                    const { error: insertErr } = await supabase
                        .from('Inventory')
                        .insert(newInventoryData);
                        
                    if (insertErr) throw insertErr;
                }

                stats.processed++;
                stats.updated++;

            } catch (err) {
                console.error(`Błąd przy produkcie ${apiProd.name}:`, err.message);
                stats.errors++;
            }
        }

        console.log(`✅ Synchronizacja zakończona.`, stats);
        return res.json({
            status: 'success',
            message: `Zsynchronizowano ${stats.updated} produktów`,
            stats
        });

    } catch (error) {
        console.error('Global sync error:', error);
        return res.status(500).json({ 
            status: 'error', 
            message: 'Błąd synchronizacji',
            details: error.message 
        });
    }
});

// Endpoint dla panelu admina - lista produktów ze stanami magazynowymi
app.get('/api/admin/products-with-stock', requireRole(['ADMIN', 'SALES_REP', 'WAREHOUSE', 'SALES_DEPT']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ 
            status: 'error', 
            message: 'Supabase nie jest skonfigurowany' 
        });
    }

    try {
        console.log('Pobieranie produktów ze stanami magazynowymi...');
        
        // Pobieramy produkty i łączymy z Inventory
        // Uwaga: W Supabase relacja musi być zdefiniowana. 
        // Jeśli nazwy tabel są wielką literą ("Product", "Inventory"), używamy cudzysłowów w zapytaniu SQL, 
        // ale w JS client library zazwyczaj podajemy nazwy stringami.
        // Sprawdzimy czy to zadziała z domyślnymi nazwami.
        
        const { data, error } = await supabase
            .from('Product')
            .select(`
                *,
                Inventory (
                    stock,
                    stockOptimal,
                    stockOrdered,
                    stockReserved,
                    location
                )
            `)
            .order('name', { ascending: true });

        if (error) {
            console.error('Błąd pobierania produktów z Supabase:', error);
            throw error;
        }

        // Przetwarzamy dane, aby łatwiej wyświetlać je na froncie
        // Inventory jest tablicą (bo relacja 1:N), ale interesuje nas głównie location='MAIN'
        const processedData = data.map(product => {
            const mainInventory = product.Inventory && Array.isArray(product.Inventory) 
                ? product.Inventory.find(inv => inv.location === 'MAIN') 
                : null;

            return {
                ...product,
                // Spłaszczamy dane magazynowe do obiektu produktu dla wygody
                stock: mainInventory?.stock || 0,
                stockOptimal: mainInventory?.stockOptimal || 0,
                stockOrdered: mainInventory?.stockOrdered || 0,
                stockReserved: mainInventory?.stockReserved || 0,
                hasInventory: !!mainInventory
            };
        });

        console.log(`Pobrano ${processedData.length} produktów.`);
        
        return res.json({
            status: 'success',
            data: processedData
        });

    } catch (err) {
        console.error('Wyjątek w /api/admin/products-with-stock:', err);
        return res.status(500).json({ 
            status: 'error', 
            message: 'Błąd podczas pobierania danych magazynowych',
            details: err.message 
        });
    }
});

// -----------------------------
// Admin API - CRUD dla Product
// -----------------------------

// Pobierz pojedynczy produkt
app.get('/api/admin/products/:id', requireRole(['ADMIN', 'SALES_REP', 'WAREHOUSE', 'SALES_DEPT']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const { id } = req.params;

    try {
        const { data, error } = await supabase
            .from('Product')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            console.error('Błąd pobierania produktu:', error);
            return res.status(404).json({ status: 'error', message: 'Produkt nie znaleziony' });
        }

        return res.json({ status: 'success', data });
    } catch (err) {
        console.error('Wyjątek w GET /api/admin/products/:id:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd podczas pobierania produktu', details: err.message });
    }
});

// Utwórz nowy produkt
app.post('/api/admin/products', requireRole(['ADMIN', 'SALES_DEPT']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const body = req.body || {};

    // Prosta walidacja minimalna
    if (!body.identifier || !body.category || typeof body.price === 'undefined') {
        return res.status(400).json({
            status: 'error',
            message: 'Wymagane pola: identifier, category, price'
        });
    }

    const now = new Date().toISOString();

    const productData = {
        identifier: body.identifier,
        index: body.index || null,
        name: body.name || body.identifier,
        description: body.description || '',
        price: body.price || 0,
        code: body.code || null,
        availability: body.availability || 'AVAILABLE',
        productionPath: body.productionPath || null,
        dimensions: body.dimensions || null,
        imageUrl: body.imageUrl || null,
        category: body.category,
        isActive: typeof body.isActive === 'boolean' ? body.isActive : true,
        slug: body.slug || null,
        images: body.images || null,
        new: !!body.new,
        createdAt: now,
        updatedAt: now,
    };

    try {
        const { data, error } = await supabase
            .from('Product')
            .insert(productData)
            .select('*')
            .single();

        if (error) {
            console.error('Błąd tworzenia produktu:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się utworzyć produktu', details: error.message });
        }

        return res.status(201).json({ status: 'success', data });
    } catch (err) {
        console.error('Wyjątek w POST /api/admin/products:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd podczas tworzenia produktu', details: err.message });
    }
});

// Aktualizuj istniejący produkt
app.patch('/api/admin/products/:id', requireRole(['ADMIN', 'SALES_DEPT']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const { id } = req.params;
    const updates = req.body;
    
    // Nie pozwalamy na edycję hasła w ten sposób (powinno być osobne API change-password)
    delete updates.password;
    delete updates.id; // na wszelki wypadek
    
    // Mapowanie camelCase na snake_case dla productionRoomId
    if (updates.productionRoomId !== undefined) {
        updates.productionroomid = updates.productionRoomId;
        delete updates.productionRoomId;
    }

    const { data, error } = await supabase
        .from('Product')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Błąd aktualizacji produktu:', error);
        return res.status(500).json({ status: 'error', message: 'Nie udało się zaktualizować produktu', details: error.message });
    }

    return res.json({ status: 'success', data });
});

// Usuń produkt
app.delete('/api/admin/products/:id', requireRole(['ADMIN', 'SALES_DEPT']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const { id } = req.params;

    try {
        const { error } = await supabase
            .from('Product')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Błąd usuwania produktu:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się usunąć produktu', details: error.message });
        }

        return res.json({ status: 'success', message: 'Produkt usunięty' });
    } catch (err) {
        console.error('Wyjątek w DELETE /api/admin/products/:id:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd podczas usuwania produktu', details: err.message });
    }
});

// Aktualizacja stanów magazynowych produktu (Inventory, location='MAIN')
app.patch('/api/admin/products/:id/inventory', requireRole(['ADMIN', 'WAREHOUSE', 'SALES_DEPT']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const { id } = req.params;
    const { stock = 0, stockOptimal = 0, stockOrdered = 0, stockReserved = 0 } = req.body || {};

    try {
        // Upewnij się, że produkt istnieje
        const { data: product, error: productError } = await supabase
            .from('Product')
            .select('id')
            .eq('id', id)
            .single();

        if (productError || !product) {
            return res.status(404).json({ status: 'error', message: 'Produkt nie znaleziony' });
        }

        // Sprawdź, czy istnieje rekord Inventory dla location MAIN
        const { data: existingInv } = await supabase
            .from('Inventory')
            .select('id')
            .eq('productId', id)
            .eq('location', 'MAIN')
            .single();

        const inventoryData = {
            stock: Number(stock) || 0,
            stockOptimal: Number(stockOptimal) || 0,
            stockOrdered: Number(stockOrdered) || 0,
            stockReserved: Number(stockReserved) || 0,
            updatedAt: new Date().toISOString(),
        };

        if (existingInv) {
            const { error: updateErr } = await supabase
                .from('Inventory')
                .update(inventoryData)
                .eq('id', existingInv.id);

            if (updateErr) {
                console.error('Błąd aktualizacji Inventory:', updateErr);
                return res.status(500).json({ status: 'error', message: 'Nie udało się zaktualizować stanów magazynowych', details: updateErr.message });
            }
        } else {
            const newInventory = {
                id: crypto.randomUUID(),
                productId: id,
                location: 'MAIN',
                reorderPoint: 0,
                ...inventoryData,
            };

            const { error: insertErr } = await supabase
                .from('Inventory')
                .insert(newInventory);

            if (insertErr) {
                console.error('Błąd tworzenia Inventory:', insertErr);
                return res.status(500).json({ status: 'error', message: 'Nie udało się utworzyć stanów magazynowych', details: insertErr.message });
            }
        }

        return res.json({ status: 'success', message: 'Stany magazynowe zapisane' });
    } catch (err) {
        console.error('Wyjątek w PATCH /api/admin/products/:id/inventory:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd podczas zapisu stanów magazynowych', details: err.message });
    }
});

// -----------------------------
// Admin API - Zarządzanie użytkownikami
// -----------------------------

// Lista działów
app.get('/api/admin/departments', requireRole(['ADMIN']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        const { data, error } = await supabase
            .from('Department')
            .select('id, name, createdAt, isActive')
            .order('name', { ascending: true });

        if (error) {
            console.error('Błąd pobierania działów:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się pobrać działów', details: error.message });
        }

        // Pobierz liczbę użytkowników dla każdego działu
        const departmentsWithUserCount = await Promise.all(
            (data || []).map(async (dept) => {
                const { count } = await supabase
                    .from('User')
                    .select('id', { count: 'exact', head: true })
                    .eq('departmentId', dept.id)
                    .eq('isActive', true);
                
                return {
                    ...dept,
                    userCount: count || 0
                };
            })
        );

        return res.json({ status: 'success', data: departmentsWithUserCount });
    } catch (err) {
        console.error('Wyjątek w GET /api/admin/departments:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd podczas pobierania działów', details: err.message });
    }
});

// Tworzenie nowego działu
app.post('/api/admin/departments', requireRole(['ADMIN']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const { name } = req.body || {};

    if (!name || !name.trim()) {
        return res.status(400).json({ status: 'error', message: 'Nazwa działu jest wymagana' });
    }

    try {
        // Sprawdź czy dział o tej nazwie już istnieje
        const { data: existing, error: checkError } = await supabase
            .from('Department')
            .select('id')
            .eq('name', name.trim())
            .single();

        if (existing) {
            return res.status(400).json({ status: 'error', message: 'Dział o tej nazwie już istnieje' });
        }

        const { data: newDepartment, error } = await supabase
            .from('Department')
            .insert({
                name: name.trim(),
                isActive: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            })
            .select()
            .single();

        if (error) {
            console.error('Błąd tworzenia działu:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się utworzyć działu', details: error.message });
        }

        console.log(`[POST /api/admin/departments] Utworzono dział: ${newDepartment.name} (ID: ${newDepartment.id})`);
        return res.status(201).json({ status: 'success', data: newDepartment });
    } catch (err) {
        console.error('Wyjątek w POST /api/admin/departments:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd podczas tworzenia działu', details: err.message });
    }
});

// Aktualizacja działu
app.patch('/api/admin/departments/:id', requireRole(['ADMIN']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const { id } = req.params;
    const { name, isActive } = req.body || {};

    if (!name || !name.trim()) {
        return res.status(400).json({ status: 'error', message: 'Nazwa działu jest wymagana' });
    }

    try {
        // Sprawdź czy dział istnieje
        const { data: existing, error: checkError } = await supabase
            .from('Department')
            .select('id, name')
            .eq('id', id)
            .single();

        if (!existing) {
            return res.status(404).json({ status: 'error', message: 'Dział nie znaleziony' });
        }

        // Sprawdź czy inny dział ma tę nazwę
        const { data: nameConflict, error: conflictError } = await supabase
            .from('Department')
            .select('id')
            .eq('name', name.trim())
            .neq('id', id)
            .single();

        if (nameConflict) {
            return res.status(400).json({ status: 'error', message: 'Inny dział o tej nazwie już istnieje' });
        }

        const updateData = {
            name: name.trim(),
            updatedAt: new Date().toISOString()
        };

        if (typeof isActive === 'boolean') {
            updateData.isActive = isActive;
        }

        const { data: updatedDepartment, error } = await supabase
            .from('Department')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Błąd aktualizacji działu:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się zaktualizować działu', details: error.message });
        }

        console.log(`[PATCH /api/admin/departments/${id}] Zaktualizowano dział: ${updatedDepartment.name}`);
        return res.json({ status: 'success', data: updatedDepartment });
    } catch (err) {
        console.error('Wyjątek w PATCH /api/admin/departments/:id:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd podczas aktualizacji działu', details: err.message });
    }
});

// Usuwanie działu (soft delete z zabezpieczeniami)
app.delete('/api/admin/departments/:id', requireRole(['ADMIN']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const { id } = req.params;

    try {
        // Sprawdź czy dział istnieje
        const { data: department, error: deptError } = await supabase
            .from('Department')
            .select('id, name, isActive')
            .eq('id', id)
            .single();

        if (!department) {
            return res.status(404).json({ status: 'error', message: 'Dział nie znaleziony' });
        }

        if (!department.isActive) {
            return res.status(400).json({ status: 'error', message: 'Dział jest już nieaktywny' });
        }

        // Sprawdź czy są przypisani użytkownicy
        const { data: users, error: usersError } = await supabase
            .from('User')
            .select('id, name, email')
            .eq('departmentId', id)
            .eq('isActive', true);

        if (users && users.length > 0) {
            return res.status(400).json({ 
                status: 'error', 
                message: `Nie można usunąć działu "${department.name}" - są do niego przypisani aktywni użytkownicy (${users.length}). Najpierw przenieś lub dezaktywuj użytkowników.`,
                data: { users: users.map(u => `${u.name} (${u.email})`) }
            });
        }

        // TODO: Sprawdź inne zależności (miejscowości, foldery KI, itp.)

        // Soft delete - dezaktywuj dział
        const { data: deactivatedDepartment, error } = await supabase
            .from('Department')
            .update({ 
                isActive: false, 
                updatedAt: new Date().toISOString(),
                deletedAt: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Błąd dezaktywacji działu:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się usunąć działu', details: error.message });
        }

        console.log(`[DELETE /api/admin/departments/${id}] Usunięto dział: ${department.name}`);
        return res.json({ status: 'success', message: 'Dział został usunięty', data: deactivatedDepartment });
    } catch (err) {
        console.error('Wyjątek w DELETE /api/admin/departments/:id:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd podczas usuwania działu', details: err.message });
    }
});

// Lista użytkowników z działami (ADMIN + SALES_DEPT + GRAPHICS/GRAPHIC_DESIGNER - do przypisywania miejscowości)
app.get('/api/admin/users', requireRole(['ADMIN', 'SALES_DEPT', 'GRAPHICS', 'GRAPHIC_DESIGNER']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        const { role: roleFilter } = req.query;

        let query = supabase
            .from('User')
            .select(`
                id,
                name,
                email,
                role,
                isActive,
                createdAt,
                departmentId,
                productionroomid,
                Department (name)
            `)
            .order('createdAt', { ascending: false });

        if (roleFilter && typeof roleFilter === 'string') {
            query = query.eq('role', roleFilter);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Błąd pobierania użytkowników:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się pobrać użytkowników', details: error.message });
        }

        const users = (data || []).map(user => ({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            isActive: user.isActive,
            createdAt: user.createdAt,
            departmentId: user.departmentId,
            departmentName: user.Department?.name || null,
            productionroomid: user.productionroomid || null
        }));

        return res.json({ status: 'success', data: users });
    } catch (err) {
        console.error('Wyjątek w GET /api/admin/users:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd podczas pobierania użytkowników', details: err.message });
    }
});

// Tworzenie nowego użytkownika
app.post('/api/admin/users', requireRole(['ADMIN']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const { name, email, password, role, departmentId, productionRoomId } = req.body || {};

    if (!email || !password || !role) {
        return res.status(400).json({ status: 'error', message: 'Wymagane pola: email, password, role' });
    }

    if (password.length < 6) {
        return res.status(400).json({ status: 'error', message: 'Hasło musi mieć co najmniej 6 znaków' });
    }

    try {
        // Sprawdź, czy email już istnieje
        const { data: existing } = await supabase
            .from('User')
            .select('id')
            .eq('email', email)
            .single();

        if (existing) {
            return res.status(400).json({ status: 'error', message: 'Użytkownik o tym adresie email już istnieje' });
        }

        // Hash hasła
        const hashedPassword = await bcrypt.hash(password, 10);

        const userData = {
            name: name || null,
            email,
            password: hashedPassword,
            role,
            departmentId: departmentId || null,
            productionroomid: productionRoomId || null,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        const { data: newUser, error } = await supabase
            .from('User')
            .insert(userData)
            .select('id, name, email, role, isActive, createdAt, departmentId, productionroomid')
            .single();

        if (error) {
            console.error('Błąd tworzenia użytkownika:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się utworzyć użytkownika', details: error.message });
        }

        return res.status(201).json({ status: 'success', data: newUser });
    } catch (err) {
        console.error('Wyjątek w POST /api/admin/users:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd podczas tworzenia użytkownika', details: err.message });
    }
});

// Edycja użytkownika
app.patch('/api/admin/users/:id', requireRole(['ADMIN']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const { id } = req.params;
    const { name, role, departmentId, productionRoomId, isActive, password } = req.body || {};

    const updateData = {
        updatedAt: new Date().toISOString(),
    };

    if (name !== undefined) updateData.name = name;
    if (role !== undefined) updateData.role = role;
    if (departmentId !== undefined) updateData.departmentId = departmentId;
    if (productionRoomId !== undefined) updateData.productionroomid = productionRoomId || null;
    if (typeof isActive === 'boolean') updateData.isActive = isActive;

    try {
        if (password !== undefined) {
            if (!password || password.length < 6) {
                return res.status(400).json({ status: 'error', message: 'Nowe hasło musi mieć co najmniej 6 znaków' });
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            updateData.password = hashedPassword;
        }

        const { data, error } = await supabase
            .from('User')
            .update(updateData)
            .eq('id', id)
            .select('id, name, email, role, isActive, departmentId, productionroomid')
            .single();

        if (error) {
            console.error('Błąd aktualizacji użytkownika:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się zaktualizować użytkownika', details: error.message });
        }

        return res.json({ status: 'success', data });
    } catch (err) {
        console.error('Wyjątek w PATCH /api/admin/users/:id:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd podczas aktualizacji użytkownika', details: err.message });
    }
});

// Usunięcie użytkownika
app.delete('/api/admin/users/:id', requireRole(['ADMIN']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const { id } = req.params;

    try {
        const { error } = await supabase
            .from('User')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Błąd usuwania użytkownika:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się usunąć użytkownika', details: error.message });
        }

        return res.json({ status: 'success', message: 'Użytkownik usunięty' });
    } catch (err) {
        console.error('Wyjątek w DELETE /api/admin/users/:id:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd podczas usuwania użytkownika', details: err.message });
    }
});

// -----------------------------
// API - Przypisania folderów KI (UserFolderAccess)
// -----------------------------

// Lista wszystkich przypisań (dla admina/SALES_DEPT)
app.get('/api/admin/user-folder-access', requireRole(['ADMIN', 'SALES_DEPT']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const { userId } = req.query;

    try {
        let query = supabase
            .from('UserFolderAccess')
            .select(`
                id,
                userId,
                folderName,
                isActive,
                assignedBy,
                notes,
                createdAt,
                updatedAt,
                user:User!UserFolderAccess_userId_fkey(id, name, email, role),
                assignedByUser:User!UserFolderAccess_assignedBy_fkey(id, name, email)
            `)
            .order('createdAt', { ascending: false });

        if (userId) {
            query = query.eq('userId', userId);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Błąd pobierania przypisań folderów:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się pobrać przypisań', details: error.message });
        }

        return res.json({
            status: 'success',
            data: data || [],
            count: data?.length || 0
        });
    } catch (err) {
        console.error('Wyjątek w GET /api/admin/user-folder-access:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
    }
});

// Foldery bieżącego użytkownika (dla wszystkich zalogowanych)
app.get('/api/user-folder-access', async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const cookies = parseCookies(req);
    const currentUserId = cookies.auth_id;
    const currentRole = cookies.auth_role;

    if (!currentUserId || !currentRole) {
        return res.status(401).json({ status: 'error', message: 'Brak autoryzacji' });
    }

    // ADMIN/SALES_DEPT mogą podglądać foldery innych użytkowników
    const targetUserId = ['ADMIN', 'SALES_DEPT'].includes(currentRole) && req.query.userId
        ? req.query.userId
        : currentUserId;

    try {
        const { data, error } = await supabase
            .from('UserFolderAccess')
            .select('id, folderName, isActive, notes, createdAt')
            .eq('userId', targetUserId)
            .eq('isActive', true)
            .order('folderName');

        if (error) {
            console.error('Błąd pobierania folderów użytkownika:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się pobrać folderów', details: error.message });
        }

        return res.json({
            status: 'success',
            data: data || [],
            folders: (data || []).map(d => d.folderName)
        });
    } catch (err) {
        console.error('Wyjątek w GET /api/user-folder-access:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
    }
});

// Helper: logowanie audytu zmian w UserFolderAccess
async function logFolderAccessChange(actorId, targetUserId, action, folderName, userFolderAccessId = null, oldValue = null, newValue = null) {
    if (!supabase) return;
    try {
        await supabase.from('UserFolderAccessLog').insert({
            userFolderAccessId,
            targetUserId,
            actorId,
            action,
            folderName,
            oldValue: oldValue ? JSON.stringify(oldValue) : null,
            newValue: newValue ? JSON.stringify(newValue) : null,
            createdAt: new Date().toISOString()
        });
    } catch (err) {
        console.error('Błąd logowania audytu UserFolderAccess:', err);
    }
}

// Tworzenie nowego przypisania
app.post('/api/admin/user-folder-access', requireRole(['ADMIN', 'SALES_DEPT']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const { id: assignedById } = req.user;
    const { userId, folderName, notes } = req.body || {};

    if (!userId || !folderName?.trim()) {
        return res.status(400).json({ status: 'error', message: 'userId i folderName są wymagane' });
    }

    try {
        // Sprawdź czy użytkownik istnieje
        const { data: userExists, error: userError } = await supabase
            .from('User')
            .select('id')
            .eq('id', userId)
            .single();

        if (userError || !userExists) {
            return res.status(404).json({ status: 'error', message: 'Użytkownik nie istnieje' });
        }

        // Sprawdź czy przypisanie już istnieje
        const { data: existing } = await supabase
            .from('UserFolderAccess')
            .select('id, isActive, folderName, notes')
            .eq('userId', userId)
            .eq('folderName', folderName.trim())
            .single();

        if (existing) {
            // Jeśli istnieje ale nieaktywne, reaktywuj
            if (!existing.isActive) {
                const oldValue = { isActive: false, folderName: existing.folderName, notes: existing.notes };
                
                const { data: reactivated, error: reactivateError } = await supabase
                    .from('UserFolderAccess')
                    .update({ isActive: true, assignedBy: assignedById, updatedAt: new Date().toISOString() })
                    .eq('id', existing.id)
                    .select()
                    .single();

                if (reactivateError) {
                    return res.status(500).json({ status: 'error', message: 'Nie udało się reaktywować przypisania', details: reactivateError.message });
                }

                // Audit log
                await logFolderAccessChange(assignedById, userId, 'REACTIVATE', folderName.trim(), existing.id, oldValue, { isActive: true });

                return res.json({ status: 'success', data: reactivated, message: 'Przypisanie reaktywowane' });
            }
            return res.status(409).json({ status: 'error', message: 'Przypisanie już istnieje' });
        }

        // Utwórz nowe przypisanie
        const { data, error } = await supabase
            .from('UserFolderAccess')
            .insert({
                userId,
                folderName: folderName.trim(),
                isActive: true,
                assignedBy: assignedById,
                notes: notes?.trim() || null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            })
            .select()
            .single();

        if (error) {
            console.error('Błąd tworzenia przypisania:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się utworzyć przypisania', details: error.message });
        }

        // Audit log
        await logFolderAccessChange(assignedById, userId, 'CREATE', folderName.trim(), data.id, null, { isActive: true, folderName: folderName.trim(), notes: notes?.trim() || null });

        return res.status(201).json({ status: 'success', data, message: 'Przypisanie utworzone' });
    } catch (err) {
        console.error('Wyjątek w POST /api/admin/user-folder-access:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
    }
});

// Aktualizacja przypisania
app.patch('/api/admin/user-folder-access/:id', requireRole(['ADMIN', 'SALES_DEPT']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const { role, id: actorId } = req.user;
    const { id } = req.params;
    const { folderName, isActive, notes } = req.body || {};

    try {
        // Pobierz obecny stan przed aktualizacją
        const { data: currentData } = await supabase
            .from('UserFolderAccess')
            .select('userId, folderName, isActive, notes')
            .eq('id', id)
            .single();

        if (!currentData) {
            return res.status(404).json({ status: 'error', message: 'Przypisanie nie znalezione' });
        }

        const oldValue = { folderName: currentData.folderName, isActive: currentData.isActive, notes: currentData.notes };
        const updateData = { updatedAt: new Date().toISOString() };

        // SALES_DEPT może tylko zmieniać isActive i notes
        if (role === 'SALES_DEPT') {
            if (isActive !== undefined) updateData.isActive = isActive;
            if (notes !== undefined) updateData.notes = notes?.trim() || null;
        } else {
            // ADMIN może wszystko
            if (folderName !== undefined) updateData.folderName = folderName.trim();
            if (isActive !== undefined) updateData.isActive = isActive;
            if (notes !== undefined) updateData.notes = notes?.trim() || null;
        }

        const { data, error } = await supabase
            .from('UserFolderAccess')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Błąd aktualizacji przypisania:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się zaktualizować przypisania', details: error.message });
        }

        // Określ typ akcji dla audytu
        let action = 'UPDATE';
        if (isActive !== undefined && oldValue.isActive !== isActive) {
            action = isActive ? 'REACTIVATE' : 'DEACTIVATE';
        }

        // Audit log
        const newValue = { folderName: data.folderName, isActive: data.isActive, notes: data.notes };
        await logFolderAccessChange(actorId, currentData.userId, action, data.folderName, parseInt(id), oldValue, newValue);

        return res.json({ status: 'success', data, message: 'Przypisanie zaktualizowane' });
    } catch (err) {
        console.error('Wyjątek w PATCH /api/admin/user-folder-access/:id:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
    }
});

// Usunięcie przypisania (ADMIN i SALES_DEPT)
app.delete('/api/admin/user-folder-access/:id', requireRole(['ADMIN', 'SALES_DEPT']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const { id: actorId } = req.user;
    const { id } = req.params;

    try {
        // Pobierz dane przed usunięciem (do audytu)
        const { data: toDelete } = await supabase
            .from('UserFolderAccess')
            .select('userId, folderName, isActive, notes')
            .eq('id', id)
            .single();

        if (!toDelete) {
            return res.status(404).json({ status: 'error', message: 'Przypisanie nie znalezione' });
        }

        const { error } = await supabase
            .from('UserFolderAccess')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Błąd usuwania przypisania:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się usunąć przypisania', details: error.message });
        }

        // Audit log
        await logFolderAccessChange(actorId, toDelete.userId, 'DELETE', toDelete.folderName, parseInt(id), 
            { folderName: toDelete.folderName, isActive: toDelete.isActive, notes: toDelete.notes }, null);

        return res.json({ status: 'success', message: 'Przypisanie usunięte' });
    } catch (err) {
        console.error('Wyjątek w DELETE /api/admin/user-folder-access/:id:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
    }
});

// -----------------------------
// API - Przypisania miejscowości (UserCityAccess)
// -----------------------------

// Helper: logowanie audytu zmian w UserCityAccess
async function logCityAccessChange(actorId, targetUserId, action, cityName, userCityAccessId = null, oldValue = null, newValue = null) {
    if (!supabase) return;
    try {
        await supabase.from('UserCityAccessLog').insert({
            userCityAccessId,
            targetUserId,
            actorId,
            action,
            cityName,
            oldValue: oldValue ? JSON.stringify(oldValue) : null,
            newValue: newValue ? JSON.stringify(newValue) : null,
            createdAt: new Date().toISOString()
        });
    } catch (err) {
        console.error('Błąd logowania audytu UserCityAccess:', err);
    }
}

// Lista wszystkich przypisań miejscowości (dla admina/SALES_DEPT/GRAPHICS/GRAPHIC_DESIGNER)
app.get('/api/admin/user-city-access', requireRole(['ADMIN', 'SALES_DEPT', 'GRAPHICS', 'GRAPHIC_DESIGNER']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const { userId } = req.query;

    try {
        let query = supabase
            .from('UserCityAccess')
            .select(`
                id,
                userId,
                cityName,
                isActive,
                assignedBy,
                notes,
                createdAt,
                updatedAt,
                user:User!UserCityAccess_userId_fkey(id, name, email, role),
                assignedByUser:User!UserCityAccess_assignedBy_fkey(id, name, email)
            `)
            .order('createdAt', { ascending: false });

        if (userId) {
            query = query.eq('userId', userId);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Błąd pobierania przypisań miejscowości:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się pobrać przypisań', details: error.message });
        }

        return res.json({
            status: 'success',
            data: data || [],
            count: data?.length || 0
        });
    } catch (err) {
        console.error('Wyjątek w GET /api/admin/user-city-access:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
    }
});

// Miejscowości bieżącego użytkownika (dla wszystkich zalogowanych)
app.get('/api/user-city-access', async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const cookies = parseCookies(req);
    const currentUserId = cookies.auth_id;
    const currentRole = cookies.auth_role;

    if (!currentUserId || !currentRole) {
        return res.status(401).json({ status: 'error', message: 'Brak autoryzacji' });
    }

    // ADMIN/SALES_DEPT mogą podglądać miejscowości innych użytkowników
    const targetUserId = ['ADMIN', 'SALES_DEPT'].includes(currentRole) && req.query.userId
        ? req.query.userId
        : currentUserId;

    try {
        const { data, error } = await supabase
            .from('UserCityAccess')
            .select('id, cityName, isActive, notes, createdAt')
            .eq('userId', targetUserId)
            .eq('isActive', true)
            .order('cityName');

        if (error) {
            console.error('Błąd pobierania miejscowości użytkownika:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się pobrać miejscowości', details: error.message });
        }

        return res.json({
            status: 'success',
            data: data || [],
            cities: (data || []).map(d => d.cityName)
        });
    } catch (err) {
        console.error('Wyjątek w GET /api/user-city-access:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
    }
});

// Tworzenie nowego przypisania miejscowości
app.post('/api/admin/user-city-access', requireRole(['ADMIN', 'SALES_DEPT', 'GRAPHICS', 'GRAPHIC_DESIGNER']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const { id: assignedById } = req.user;
    const { userId, cityName, notes } = req.body || {};

    if (!userId || !cityName?.trim()) {
        return res.status(400).json({ status: 'error', message: 'userId i cityName są wymagane' });
    }

    try {
        // Sprawdź czy użytkownik istnieje
        const { data: userExists, error: userError } = await supabase
            .from('User')
            .select('id')
            .eq('id', userId)
            .single();

        if (userError || !userExists) {
            return res.status(404).json({ status: 'error', message: 'Użytkownik nie istnieje' });
        }

        // Sprawdź czy przypisanie już istnieje
        const { data: existing } = await supabase
            .from('UserCityAccess')
            .select('id, isActive, cityName, notes')
            .eq('userId', userId)
            .eq('cityName', cityName.trim())
            .single();

        if (existing) {
            // Jeśli istnieje ale nieaktywne, reaktywuj
            if (!existing.isActive) {
                const oldValue = { isActive: false, cityName: existing.cityName, notes: existing.notes };
                
                const { data: reactivated, error: reactivateError } = await supabase
                    .from('UserCityAccess')
                    .update({ isActive: true, assignedBy: assignedById, updatedAt: new Date().toISOString() })
                    .eq('id', existing.id)
                    .select()
                    .single();

                if (reactivateError) {
                    return res.status(500).json({ status: 'error', message: 'Nie udało się reaktywować przypisania', details: reactivateError.message });
                }

                // Audit log
                await logCityAccessChange(assignedById, userId, 'REACTIVATE', cityName.trim(), existing.id, oldValue, { isActive: true });

                return res.json({ status: 'success', data: reactivated, message: 'Przypisanie reaktywowane' });
            }
            return res.status(409).json({ status: 'error', message: 'Przypisanie już istnieje' });
        }

        // Utwórz nowe przypisanie
        const { data, error } = await supabase
            .from('UserCityAccess')
            .insert({
                userId,
                cityName: cityName.trim(),
                isActive: true,
                assignedBy: assignedById,
                notes: notes?.trim() || null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            })
            .select()
            .single();

        if (error) {
            console.error('Błąd tworzenia przypisania miejscowości:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się utworzyć przypisania', details: error.message });
        }

        // Audit log
        await logCityAccessChange(assignedById, userId, 'CREATE', cityName.trim(), data.id, null, { isActive: true, cityName: cityName.trim(), notes: notes?.trim() || null });

        return res.status(201).json({ status: 'success', data, message: 'Przypisanie utworzone' });
    } catch (err) {
        console.error('Wyjątek w POST /api/admin/user-city-access:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
    }
});

// Aktualizacja przypisania miejscowości
app.patch('/api/admin/user-city-access/:id', requireRole(['ADMIN', 'SALES_DEPT', 'GRAPHICS', 'GRAPHIC_DESIGNER']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const { role, id: actorId } = req.user;
    const { id } = req.params;
    const { cityName, isActive, notes } = req.body || {};

    try {
        // Pobierz obecny stan przed aktualizacją
        const { data: currentData } = await supabase
            .from('UserCityAccess')
            .select('userId, cityName, isActive, notes')
            .eq('id', id)
            .single();

        if (!currentData) {
            return res.status(404).json({ status: 'error', message: 'Przypisanie nie znalezione' });
        }

        const oldValue = { cityName: currentData.cityName, isActive: currentData.isActive, notes: currentData.notes };
        const updateData = { updatedAt: new Date().toISOString() };

        // SALES_DEPT może tylko zmieniać isActive i notes
        if (role === 'SALES_DEPT') {
            if (isActive !== undefined) updateData.isActive = isActive;
            if (notes !== undefined) updateData.notes = notes?.trim() || null;
        } else {
            // ADMIN może wszystko
            if (cityName !== undefined) updateData.cityName = cityName.trim();
            if (isActive !== undefined) updateData.isActive = isActive;
            if (notes !== undefined) updateData.notes = notes?.trim() || null;
        }

        const { data, error } = await supabase
            .from('UserCityAccess')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Błąd aktualizacji przypisania miejscowości:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się zaktualizować przypisania', details: error.message });
        }

        // Określ typ akcji dla audytu
        let action = 'UPDATE';
        if (isActive !== undefined && oldValue.isActive !== isActive) {
            action = isActive ? 'REACTIVATE' : 'DEACTIVATE';
        }

        // Audit log
        const newValue = { cityName: data.cityName, isActive: data.isActive, notes: data.notes };
        await logCityAccessChange(actorId, currentData.userId, action, data.cityName, parseInt(id), oldValue, newValue);

        return res.json({ status: 'success', data, message: 'Przypisanie zaktualizowane' });
    } catch (err) {
        console.error('Wyjątek w PATCH /api/admin/user-city-access/:id:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
    }
});

// Usunięcie przypisania miejscowości (ADMIN, SALES_DEPT, GRAPHICS/GRAPHIC_DESIGNER)
app.delete('/api/admin/user-city-access/:id', requireRole(['ADMIN', 'SALES_DEPT', 'GRAPHICS', 'GRAPHIC_DESIGNER']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const { id: actorId } = req.user;
    const { id } = req.params;

    try {
        // Pobierz dane przed usunięciem (do audytu)
        const { data: toDelete } = await supabase
            .from('UserCityAccess')
            .select('userId, cityName, isActive, notes')
            .eq('id', id)
            .single();

        if (!toDelete) {
            return res.status(404).json({ status: 'error', message: 'Przypisanie nie znalezione' });
        }

        const { error } = await supabase
            .from('UserCityAccess')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Błąd usuwania przypisania miejscowości:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się usunąć przypisania', details: error.message });
        }

        // Audit log
        await logCityAccessChange(actorId, toDelete.userId, 'DELETE', toDelete.cityName, parseInt(id), 
            { cityName: toDelete.cityName, isActive: toDelete.isActive, notes: toDelete.notes }, null);

        return res.json({ status: 'success', message: 'Przypisanie usunięte' });
    } catch (err) {
        console.error('Wyjątek w DELETE /api/admin/user-city-access/:id:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
    }
});

// -----------------------------
// API - Presety terminów dostawy zamówień (OrderDeliveryPreset)
// -----------------------------

// Publiczna konfiguracja presetów dla formularza zamówień
app.get('/api/config/order-delivery-presets', async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        const { data, error } = await supabase
            .from('OrderDeliveryPreset')
            .select('id, label, offsetDays, mode, fixedDate, isDefault, isActive, sortOrder')
            .eq('isActive', true)
            .order('sortOrder', { ascending: true })
            .order('offsetDays', { ascending: true });

        if (error) {
            console.error('Błąd pobierania OrderDeliveryPreset (config):', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się pobrać presetów terminów dostawy', details: error.message });
        }

        const presets = Array.isArray(data) ? data : [];
        const defaultPreset = presets.find((p) => p && p.isDefault) || null;

        return res.json({
            status: 'success',
            data: presets,
            defaultPreset,
        });
    } catch (err) {
        console.error('Wyjątek w GET /api/config/order-delivery-presets:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
    }
});

// Lista presetów dla panelu admina
app.get('/api/admin/order-delivery-presets', requireRole(['ADMIN']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        const { data, error } = await supabase
            .from('OrderDeliveryPreset')
            .select('id, label, offsetDays, mode, fixedDate, isDefault, isActive, sortOrder, createdAt, updatedAt')
            .order('sortOrder', { ascending: true })
            .order('offsetDays', { ascending: true });

        if (error) {
            console.error('Błąd pobierania OrderDeliveryPreset (admin):', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się pobrać presetów terminów dostawy', details: error.message });
        }

        return res.json({
            status: 'success',
            data: data || [],
            count: data?.length || 0,
        });
    } catch (err) {
        console.error('Wyjątek w GET /api/admin/order-delivery-presets:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
    }
});

// Tworzenie nowego preset-u terminu dostawy
app.post('/api/admin/order-delivery-presets', requireRole(['ADMIN']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const { label, offsetDays, mode, fixedDate, isDefault, isActive, sortOrder } = req.body || {};

    if (!label || typeof label !== 'string' || !label.trim()) {
        return res.status(400).json({ status: 'error', message: 'label jest wymagane' });
    }

    // Tryb: OFFSET (domyślny) lub FIXED_DATE
    const normalizedMode = (typeof mode === 'string' && mode.trim()) ? mode.trim().toUpperCase() : 'OFFSET';
    const finalMode = ['OFFSET', 'FIXED_DATE'].includes(normalizedMode) ? normalizedMode : 'OFFSET';

    let normalizedOffset = 0;
    let normalizedFixedDate = null;

    if (finalMode === 'OFFSET') {
        normalizedOffset = Number(offsetDays);
        if (!Number.isFinite(normalizedOffset)) {
            return res.status(400).json({ status: 'error', message: 'offsetDays musi być liczbą dla trybu OFFSET' });
        }
    } else {
        // FIXED_DATE – wymagamy poprawnej daty, offsetDays opcjonalne (fallback 0)
        if (!fixedDate || typeof fixedDate !== 'string' || !fixedDate.trim()) {
            return res.status(400).json({ status: 'error', message: 'fixedDate jest wymagane dla trybu FIXED_DATE (format YYYY-MM-DD)' });
        }

        const parsed = new Date(fixedDate);
        if (Number.isNaN(parsed.getTime())) {
            return res.status(400).json({ status: 'error', message: 'fixedDate ma nieprawidłowy format (oczekiwany: YYYY-MM-DD)' });
        }

        // Normalizujemy do samej daty (bez czasu)
        const year = parsed.getFullYear();
        const month = String(parsed.getMonth() + 1).padStart(2, '0');
        const day = String(parsed.getDate()).padStart(2, '0');
        normalizedFixedDate = `${year}-${month}-${day}`;

        if (offsetDays === undefined || offsetDays === null) {
            normalizedOffset = 0;
        } else {
            const maybeOffset = Number(offsetDays);
            normalizedOffset = Number.isFinite(maybeOffset) ? maybeOffset : 0;
        }
    }

    const normalizedSortOrder = Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0;
    const nowIso = new Date().toISOString();

    try {
        const { data, error } = await supabase
            .from('OrderDeliveryPreset')
            .insert({
                label: label.trim(),
                offsetDays: normalizedOffset,
                mode: finalMode,
                fixedDate: normalizedFixedDate,
                isDefault: !!isDefault,
                isActive: isActive === undefined ? true : !!isActive,
                sortOrder: normalizedSortOrder,
                createdAt: nowIso,
                updatedAt: nowIso,
            })
            .select()
            .single();

        if (error) {
            console.error('Błąd tworzenia OrderDeliveryPreset:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się utworzyć preset-u terminu dostawy', details: error.message });
        }

        // Jeśli ten preset jest domyślny, zdeaktywuj flagę isDefault dla innych
        if (data && data.isDefault) {
            try {
                await supabase
                    .from('OrderDeliveryPreset')
                    .update({ isDefault: false, updatedAt: new Date().toISOString() })
                    .neq('id', data.id)
                    .eq('isDefault', true);
            } catch (updateErr) {
                console.error('Błąd aktualizacji flag isDefault w OrderDeliveryPreset (po INSERT):', updateErr);
            }
        }

        return res.status(201).json({ status: 'success', data, message: 'Preset terminu dostawy utworzony' });
    } catch (err) {
        console.error('Wyjątek w POST /api/admin/order-delivery-presets:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
    }
});

// Aktualizacja preset-u terminu dostawy
app.patch('/api/admin/order-delivery-presets/:id', requireRole(['ADMIN']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const { id } = req.params;
    const { label, offsetDays, mode, fixedDate, isDefault, isActive, sortOrder } = req.body || {};

    try {
        const { data: current, error: currentError } = await supabase
            .from('OrderDeliveryPreset')
            .select('id, label, offsetDays, mode, fixedDate, isDefault, isActive, sortOrder')
            .eq('id', id)
            .single();

        if (currentError || !current) {
            return res.status(404).json({ status: 'error', message: 'Preset terminu dostawy nie znaleziony' });
        }

        const updateData = { updatedAt: new Date().toISOString() };

        if (label !== undefined) {
            if (!label || typeof label !== 'string' || !label.trim()) {
                return res.status(400).json({ status: 'error', message: 'label nie może być puste' });
            }
            updateData.label = label.trim();
        }

        if (offsetDays !== undefined) {
            const normalizedOffset = Number(offsetDays);
            if (!Number.isFinite(normalizedOffset)) {
                return res.status(400).json({ status: 'error', message: 'offsetDays musi być liczbą' });
            }
            updateData.offsetDays = normalizedOffset;
        }

        if (mode !== undefined) {
            if (typeof mode !== 'string' || !mode.trim()) {
                return res.status(400).json({ status: 'error', message: 'mode musi być niepustym stringiem' });
            }
            const normalizedMode = mode.trim().toUpperCase();
            if (!['OFFSET', 'FIXED_DATE'].includes(normalizedMode)) {
                return res.status(400).json({ status: 'error', message: 'mode musi być jednym z: OFFSET, FIXED_DATE' });
            }
            updateData.mode = normalizedMode;
            // Jeśli przechodzimy na OFFSET i fixedDate nie jest nadpisane, wyczyść fixedDate
            if (normalizedMode === 'OFFSET' && fixedDate === undefined) {
                updateData.fixedDate = null;
            }
        }

        if (fixedDate !== undefined) {
            if (fixedDate === null || fixedDate === '') {
                updateData.fixedDate = null;
            } else if (typeof fixedDate === 'string') {
                const parsed = new Date(fixedDate);
                if (Number.isNaN(parsed.getTime())) {
                    return res.status(400).json({ status: 'error', message: 'fixedDate ma nieprawidłowy format (oczekiwany: YYYY-MM-DD)' });
                }
                const year = parsed.getFullYear();
                const month = String(parsed.getMonth() + 1).padStart(2, '0');
                const day = String(parsed.getDate()).padStart(2, '0');
                updateData.fixedDate = `${year}-${month}-${day}`;
            } else {
                return res.status(400).json({ status: 'error', message: 'fixedDate musi być stringiem lub null' });
            }
        }

        if (isDefault !== undefined) {
            updateData.isDefault = !!isDefault;
        }

        if (isActive !== undefined) {
            updateData.isActive = !!isActive;
        }

        if (sortOrder !== undefined) {
            const normalizedSortOrder = Number(sortOrder);
            if (!Number.isFinite(normalizedSortOrder)) {
                return res.status(400).json({ status: 'error', message: 'sortOrder musi być liczbą' });
            }
            updateData.sortOrder = normalizedSortOrder;
        }

        const { data, error } = await supabase
            .from('OrderDeliveryPreset')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Błąd aktualizacji OrderDeliveryPreset:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się zaktualizować preset-u terminu dostawy', details: error.message });
        }

        // Jeśli ten preset jest teraz domyślny, usuń flagę z innych
        if (data && data.isDefault) {
            try {
                await supabase
                    .from('OrderDeliveryPreset')
                    .update({ isDefault: false, updatedAt: new Date().toISOString() })
                    .neq('id', data.id)
                    .eq('isDefault', true);
            } catch (updateErr) {
                console.error('Błąd aktualizacji flag isDefault w OrderDeliveryPreset (po PATCH):', updateErr);
            }
        }

        return res.json({ status: 'success', data, message: 'Preset terminu dostawy zaktualizowany' });
    } catch (err) {
        console.error('Wyjątek w PATCH /api/admin/order-delivery-presets/:id:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
    }
});

// Usunięcie preset-u terminu dostawy
app.delete('/api/admin/order-delivery-presets/:id', requireRole(['ADMIN']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const { id } = req.params;

    try {
        const { error } = await supabase
            .from('OrderDeliveryPreset')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Błąd usuwania OrderDeliveryPreset:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się usunąć preset-u terminu dostawy', details: error.message });
        }

        return res.json({ status: 'success', message: 'Preset terminu dostawy usunięty' });
    } catch (err) {
        console.error('Wyjątek w DELETE /api/admin/order-delivery-presets/:id:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
    }
});

// Wykrywanie nieprzypisanych miejscowości (dla GRAPHICS/GRAPHIC_DESIGNER, ADMIN, SALES_DEPT)
app.get('/api/admin/unassigned-cities', requireRole(['GRAPHICS', 'GRAPHIC_DESIGNER', 'ADMIN', 'SALES_DEPT']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        // Pobierz wszystkie miejscowości z systemu plików (przez proxy do QNAP)
        console.log('[unassigned-cities] Pobieranie z:', `${GALLERY_BASE}/list_cities.php`);
        const galleryResponse = await fetch(`${GALLERY_BASE}/list_cities.php`);
        if (!galleryResponse.ok) {
            console.error('[unassigned-cities] Błąd odpowiedzi galerii:', galleryResponse.status);
            return res.status(500).json({ status: 'error', message: 'Nie udało się pobrać listy miejscowości z galerii' });
        }
        
        const galleryData = await galleryResponse.json();
        console.log('[unassigned-cities] Pobrano miejscowości:', galleryData.cities?.length || 0);
        const allCities = Array.isArray(galleryData.cities) ? galleryData.cities : [];
        
        // Filtruj tylko prawdziwe miejscowości (bez folderów technicznych)
        const realCities = allCities.filter(city => !/^\d+\./.test((city ?? '').trim()));
        
        // Pobierz wszystkie przypisania z bazy
        const { data: assignments, error: assignmentsError } = await supabase
            .from('UserCityAccess')
            .select('cityName, isActive');
        
        if (assignmentsError) {
            console.error('Błąd pobierania przypisań:', assignmentsError);
            return res.status(500).json({ status: 'error', message: 'Nie udało się pobrać przypisań', details: assignmentsError.message });
        }
        
        // Znajdź przypisane miejscowości
        const assignedCities = new Set();
        (assignments || []).forEach(assignment => {
            if (assignment.isActive && assignment.cityName) {
                assignedCities.add(assignment.cityName);
            }
        });
        
        // Znajdź nieprzypisane miejscowości
        const unassignedCities = realCities.filter(city => !assignedCities.has(city));
        
        return res.json({
            status: 'success',
            data: {
                allCities: realCities,
                assignedCities: Array.from(assignedCities),
                unassignedCities: unassignedCities,
                stats: {
                    total: realCities.length,
                    assigned: assignedCities.size,
                    unassigned: unassignedCities.length
                }
            }
        });
    } catch (err) {
        console.error('Wyjątek w GET /api/admin/unassigned-cities:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
    }
});

// -----------------------------
// API - Ulubione użytkownika (UserFavorites)
// -----------------------------

const MAX_FAVORITES = 12;

// Moduł Grafiki (Graphics Module)
// -----------------------------

// Lista zadań graficznych
app.get('/api/graphics/tasks', requireRole(['GRAPHICS', 'GRAPHIC_DESIGNER', 'SALES_DEPT', 'PRODUCTION_MANAGER', 'ADMIN']), async (req, res) => {
    console.log('[GET /api/graphics/tasks] Request received - DEBUG LOG');
    
    if (!supabase) {
        console.log('[GET /api/graphics/tasks] Supabase not configured');
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const { status, orderId, assignedTo, mine } = req.query;
    const { role, id: userId } = req.user;
    
    console.log('[GET /api/graphics/tasks] Query params:', { status, orderId, assignedTo, mine });
    console.log('[GET /api/graphics/tasks] User:', { role, userId });


    try {
        let query = supabase
            .from('GraphicTask')
            .select(`
                *,
                Order (
                    orderNumber,
                    orderType:ordertype,
                    Customer:customerId (
                        name
                    )
                ),
                OrderItem (
                    productName:projectName,
                    quantity,
                    productionNotes,
                    projectviewurl,
                    Product:Product (
                        name,
                        identifier,
                        index
                    )
                ),
                Assignee:User!assignedTo (
                    name
                )
            `)
            .order('priority', { ascending: true })
            .order('dueDate', { ascending: true });

        // Filtrowanie
        if (status) query = query.eq('status', status);
        if (orderId) query = query.eq('orderId', orderId);
        if (assignedTo) query = query.eq('assignedTo', assignedTo);
        
        // Filtr "moje zadania"
        if (mine === 'true') {
            query = query.eq('assignedTo', userId);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Błąd pobierania zadań graficznych:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się pobrać zadań', details: error.message });
        }

        return res.json({ status: 'success', data: data || [] });
    } catch (err) {
        console.error('Wyjątek w GET /api/graphics/tasks:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
    }
});

// Szczegóły zadania
app.get('/api/graphics/tasks/:id', requireRole(['GRAPHICS', 'GRAPHIC_DESIGNER', 'SALES_DEPT', 'PRODUCTION_MANAGER', 'ADMIN']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const { id } = req.params;

    try {
        const { data, error } = await supabase
            .from('GraphicTask')
            .select(`
                *,
                Order (
                    orderNumber,
                    orderType:ordertype,
                    notes,
                    Customer:customerId (
                        name
                    )
                ),
                OrderItem (
                    productName:projectName,
                    quantity,
                    productionNotes,
                    projectviewurl,
                    Product:Product (
                        name,
                        identifier,
                        index
                    )
                ),
                Assignee:User!assignedTo (
                    name,
                    id
                )
            `)
            .eq('id', id)
            .single();

        if (error) {
            return res.status(404).json({ status: 'error', message: 'Zadanie nie znalezione', details: error.message });
        }

        return res.json({ status: 'success', data });
    } catch (err) {
        console.error('Wyjątek w GET /api/graphics/tasks/:id:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
    }
});

// Aktualizacja zadania (przypisanie, status, checklista)
app.patch('/api/graphics/tasks/:id', requireRole(['GRAPHICS', 'GRAPHIC_DESIGNER', 'SALES_DEPT', 'PRODUCTION_MANAGER', 'ADMIN']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const { id } = req.params;
    const { status, assignedTo, checklist, projectNumbers, filesLocation, approvalStatus, approvalRequired } = req.body;
    const { role, id: userId } = req.user;

    try {
        // Pobierz obecne zadanie
        const { data: task, error: fetchError } = await supabase
            .from('GraphicTask')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !task) {
            return res.status(404).json({ status: 'error', message: 'Zadanie nie znalezione' });
        }

        const updates = { updatedAt: new Date().toISOString() };

        // Logika uprawnień
        if (role === 'GRAPHICS') {
            // Grafik może przypisać siebie, zmienić status, edytować dane techniczne
            if (assignedTo !== undefined) updates.assignedTo = assignedTo; // Self-assign or reassign
            if (status !== undefined) {
                 // Walidacja statusów
                 if (['todo', 'in_progress', 'waiting_approval', 'ready_for_production'].includes(status)) {
                     updates.status = status;
                 }
            }
            if (checklist !== undefined) updates.checklist = checklist;
            if (projectNumbers !== undefined) updates.projectNumbers = projectNumbers;
            if (filesLocation !== undefined) updates.filesLocation = filesLocation;
            if (approvalRequired !== undefined) updates.approvalRequired = approvalRequired;
            
            // Jeśli grafik ustawia status na waiting_approval
            if (status === 'waiting_approval') {
                updates.approvalStatus = 'pending';
            }
        } else if (role === 'SALES_DEPT' || role === 'SALES_REP') {
            // Handlowiec może tylko akceptować/odrzucać
            if (approvalStatus !== undefined) {
                updates.approvalStatus = approvalStatus;
                if (approvalStatus === 'approved') {
                    updates.status = 'ready_for_production';
                } else if (approvalStatus === 'rejected') {
                    updates.status = 'rejected';
                }
            }
        } else if (role === 'PRODUCTION_MANAGER' || role === 'ADMIN') {
            // Manager może wszystko
            Object.assign(updates, req.body);
            delete updates.id; // Nie aktualizujemy ID
        }

        const { data, error } = await supabase
            .from('GraphicTask')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            return res.status(500).json({ status: 'error', message: 'Nie udało się zaktualizować zadania', details: error.message });
        }
        
        // Sprawdź czy wszystkie zadania dla tego zamówienia są gotowe
        if (data.status === 'ready_for_production') {
            await checkAndCompleteOrderGraphics(data.orderId);
        }

        return res.json({ status: 'success', data });
    } catch (err) {
        console.error('Wyjątek w PATCH /api/graphics/tasks/:id:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
    }
});

// Helper function to check if all graphic tasks for an order are ready
async function checkAndCompleteOrderGraphics(orderId) {
    // Pobierz wszystkie zadania dla tego zamówienia
    const { data: tasks } = await supabase
        .from('GraphicTask')
        .select('status')
        .eq('orderId', orderId);
        
    if (!tasks || tasks.length === 0) return;
    
    // Sprawdź czy wszystkie mają status ready_for_production (lub archived)
    const allReady = tasks.every(t => ['ready_for_production', 'archived'].includes(t.status));
    
    if (allReady) {
        // Zaktualizuj zamówienie
        await supabase
            .from('Order')
            .update({ projectsReady: true })
            .eq('id', orderId);
        console.log(`Zamówienie ${orderId}: projectsReady = true`);
    }
}

// Pobierz ulubione użytkownika
app.get('/api/favorites', requireRole(), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const userId = req.user?.id;

    if (!userId) {
        return res.status(401).json({ status: 'error', message: 'Brak autoryzacji' });
    }

    const { type } = req.query; // 'city' lub 'ki_object'

    try {
        let query = supabase
            .from('UserFavorites')
            .select('id, type, itemId, displayName, metadata, createdAt')
            .eq('userId', userId)
            .order('createdAt', { ascending: false });

        if (type) {
            query = query.eq('type', type);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Błąd pobierania ulubionych:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się pobrać ulubionych', details: error.message });
        }

        return res.json({
            status: 'success',
            data: data || [],
            count: data?.length || 0
        });
    } catch (err) {
        console.error('Wyjątek w GET /api/favorites:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
    }
});

// Dodaj do ulubionych
app.post('/api/favorites', requireRole(), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const userId = req.user?.id;

    if (!userId) {
        return res.status(401).json({ status: 'error', message: 'Brak autoryzacji' });
    }

    const { type, itemId, displayName, metadata } = req.body || {};

    if (!type || !itemId || !displayName) {
        return res.status(400).json({ status: 'error', message: 'type, itemId i displayName są wymagane' });
    }

    if (!['city', 'ki_object'].includes(type)) {
        return res.status(400).json({ status: 'error', message: 'Nieprawidłowy typ: dozwolone city lub ki_object' });
    }

    try {
        // Sprawdź limit ulubionych
        const { count, error: countError } = await supabase
            .from('UserFavorites')
            .select('id', { count: 'exact', head: true })
            .eq('userId', userId)
            .eq('type', type);

        if (countError) {
            console.error('Błąd liczenia ulubionych:', countError);
        } else if (count >= MAX_FAVORITES) {
            return res.status(400).json({ 
                status: 'error', 
                message: `Osiągnięto limit ${MAX_FAVORITES} ulubionych pozycji dla tego typu` 
            });
        }

        // Sprawdź czy już istnieje
        const { data: existing } = await supabase
            .from('UserFavorites')
            .select('id')
            .eq('userId', userId)
            .eq('type', type)
            .eq('itemId', itemId)
            .single();

        if (existing) {
            return res.status(409).json({ status: 'error', message: 'Ta pozycja jest już w ulubionych' });
        }

        // Dodaj do ulubionych
        const { data, error } = await supabase
            .from('UserFavorites')
            .insert({
                userId,
                type,
                itemId,
                displayName,
                metadata: metadata || null,
                createdAt: new Date().toISOString()
            })
            .select()
            .single();

        if (error) {
            console.error('Błąd dodawania do ulubionych:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się dodać do ulubionych', details: error.message });
        }

        return res.status(201).json({ status: 'success', data, message: 'Dodano do ulubionych' });
    } catch (err) {
        console.error('Wyjątek w POST /api/favorites:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
    }
});

// Usuń z ulubionych
app.delete('/api/favorites/:type/:itemId', requireRole(), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const userId = req.user?.id;

    if (!userId) {
        return res.status(401).json({ status: 'error', message: 'Brak autoryzacji' });
    }

    const { type, itemId } = req.params;

    try {
        const { error } = await supabase
            .from('UserFavorites')
            .delete()
            .eq('userId', userId)
            .eq('type', type)
            .eq('itemId', decodeURIComponent(itemId));

        if (error) {
            console.error('Błąd usuwania z ulubionych:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się usunąć z ulubionych', details: error.message });
        }

        return res.json({ status: 'success', message: 'Usunięto z ulubionych' });
    } catch (err) {
        console.error('Wyjątek w DELETE /api/favorites:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
    }
});

// -----------------------------
// API - Mapowanie produktów (GalleryProject, GalleryProjectProduct)
// -----------------------------

// Lista projektów galerii wraz z licznikami produktów
app.get('/api/admin/gallery-projects', requireRole(['ADMIN']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const { search } = req.query || {};

    try {
        let query = supabase
            .from('GalleryProject')
            .select(`
                id,
                slug,
                displayName,
                createdAt,
                GalleryProjectProduct:GalleryProjectProduct(productId)
            `)
            .order('displayName', { ascending: true });

        if (search && typeof search === 'string' && search.trim()) {
            const term = `%${search.trim()}%`;
            query = query.or(`displayName.ilike.${term},slug.ilike.${term}`);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Błąd pobierania projektów galerii:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się pobrać projektów galerii', details: error.message });
        }

        const projects = (data || []).map((row) => ({
            id: row.id,
            slug: row.slug,
            displayName: row.displayName,
            createdAt: row.createdAt,
            productCount: Array.isArray(row.GalleryProjectProduct) ? row.GalleryProjectProduct.length : 0,
        }));

        return res.json({
            status: 'success',
            data: projects,
            count: projects.length,
        });
    } catch (err) {
        console.error('Wyjątek w GET /api/admin/gallery-projects:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
    }
});

// Utworzenie nowego projektu galerii
app.post('/api/admin/gallery-projects', requireRole(['ADMIN']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const { slug, displayName } = req.body || {};

    if (!slug || typeof slug !== 'string' || !slug.trim()) {
        return res.status(400).json({ status: 'error', message: 'Slug jest wymagany' });
    }

    const normalizedSlug = slug.trim();
    const name = (displayName && displayName.trim()) || normalizedSlug.replace(/_/g, ' ').toUpperCase();

    try {
        const { data, error } = await supabase
            .from('GalleryProject')
            .insert({
                slug: normalizedSlug,
                displayName: name,
                createdAt: new Date().toISOString(),
            })
            .select('*')
            .single();

        if (error) {
            if (error.code === '23505') {
                return res.status(409).json({ status: 'error', message: 'Projekt o takim slugu już istnieje' });
            }
            console.error('Błąd tworzenia projektu galerii:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się utworzyć projektu galerii', details: error.message });
        }

        return res.status(201).json({ status: 'success', data, message: 'Projekt galerii utworzony' });
    } catch (err) {
        console.error('Wyjątek w POST /api/admin/gallery-projects:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
    }
});

// Aktualizacja projektu galerii
app.patch('/api/admin/gallery-projects/:id', requireRole(['ADMIN']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const { id } = req.params;
    const { slug, displayName } = req.body || {};

    if (!id) {
        return res.status(400).json({ status: 'error', message: 'Brak id projektu' });
    }

    const updateData = {};
    if (slug !== undefined) {
        if (!slug || !slug.trim()) {
            return res.status(400).json({ status: 'error', message: 'Slug nie może być pusty' });
        }
        updateData.slug = slug.trim();
    }
    if (displayName !== undefined) {
        updateData.displayName = displayName.trim();
    }

    if (!Object.keys(updateData).length) {
        return res.status(400).json({ status: 'error', message: 'Brak danych do aktualizacji' });
    }

    try {
        const { data, error } = await supabase
            .from('GalleryProject')
            .update(updateData)
            .eq('id', id)
            .select('*')
            .single();

        if (error) {
            if (error.code === '23505') {
                return res.status(409).json({ status: 'error', message: 'Projekt o takim slugu już istnieje' });
            }
            console.error('Błąd aktualizacji projektu galerii:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się zaktualizować projektu galerii', details: error.message });
        }

        return res.json({ status: 'success', data, message: 'Projekt galerii zaktualizowany' });
    } catch (err) {
        console.error('Wyjątek w PATCH /api/admin/gallery-projects/:id:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
    }
});

// Usunięcie projektu galerii (wraz z powiązaniami)
app.delete('/api/admin/gallery-projects/:id', requireRole(['ADMIN']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const { id } = req.params;

    try {
        const { error } = await supabase
            .from('GalleryProject')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Błąd usuwania projektu galerii:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się usunąć projektu galerii', details: error.message });
        }

        return res.json({ status: 'success', message: 'Projekt galerii został usunięty' });
    } catch (err) {
        console.error('Wyjątek w DELETE /api/admin/gallery-projects/:id:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
    }
});

// Lista produktów przypisanych do projektu
app.get('/api/admin/gallery-projects/:id/products', requireRole(['ADMIN']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const { id } = req.params;

    try {
        const { data, error } = await supabase
            .from('GalleryProjectProduct')
            .select('productId')
            .eq('projectId', id);

        if (error) {
            console.error('Błąd pobierania produktów projektu galerii:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się pobrać produktów projektu galerii', details: error.message });
        }

        // Pobierz szczegóły produktów osobno (unikamy problemów z relacjami)
        const productIds = (data || []).map((row) => row.productId).filter(Boolean);
        let items = [];

        if (productIds.length) {
            const { data: products, error: productsError } = await supabase
                .from('Product')
                .select('id, identifier, index')
                .in('id', productIds);

            if (productsError) {
                console.error('Błąd pobierania szczegółów produktów:', productsError);
            } else {
                items = (products || []).map((p) => ({
                    productId: p.id,
                    identifier: p.identifier || null,
                    index: p.index || null,
                }));
            }
        }

        return res.json({ status: 'success', data: items });
    } catch (err) {
        console.error('Wyjątek w GET /api/admin/gallery-projects/:id/products:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
    }
});

// Przypisanie produktu do projektu galerii
app.post('/api/admin/gallery-projects/:id/products', requireRole(['ADMIN']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const { id } = req.params;
    const { productId } = req.body || {};

    if (!productId) {
        return res.status(400).json({ status: 'error', message: 'productId jest wymagane' });
    }

    try {
        // Upewnij się, że projekt istnieje
        const { data: project, error: projectError } = await supabase
            .from('GalleryProject')
            .select('id')
            .eq('id', id)
            .single();

        if (projectError || !project) {
            return res.status(404).json({ status: 'error', message: 'Projekt galerii nie istnieje' });
        }

        // Upewnij się, że produkt istnieje
        const { data: product, error: productError } = await supabase
            .from('Product')
            .select('id, identifier, index')
            .eq('id', productId)
            .single();

        if (productError || !product) {
            return res.status(404).json({ status: 'error', message: 'Produkt nie istnieje' });
        }

        const { data, error } = await supabase
            .from('GalleryProjectProduct')
            .insert({
                projectId: project.id,
                productId: product.id,
                createdAt: new Date().toISOString(),
            })
            .select('projectId, productId')
            .single();

        if (error) {
            if (error.code === '23505') {
                return res.status(409).json({ status: 'error', message: 'Produkt jest już przypisany do tego projektu' });
            }
            console.error('Błąd przypisywania produktu do projektu galerii:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się przypisać produktu do projektu', details: error.message });
        }

        return res.status(201).json({
            status: 'success',
            data: {
                projectId: data.projectId,
                productId: data.productId,
                identifier: product.identifier,
                index: product.index,
            },
            message: 'Produkt przypisany do projektu',
        });
    } catch (err) {
        console.error('Wyjątek w POST /api/admin/gallery-projects/:id/products:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
    }
});

// Usunięcie przypisania produktu do projektu galerii
app.delete('/api/admin/gallery-projects/:id/products/:productId', requireRole(['ADMIN']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const { id, productId } = req.params;

    try {
        const { error } = await supabase
            .from('GalleryProjectProduct')
            .delete()
            .eq('projectId', id)
            .eq('productId', productId);

        if (error) {
            console.error('Błąd usuwania przypisania produktu do projektu:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się usunąć przypisania produktu', details: error.message });
        }

        return res.json({ status: 'success', message: 'Przypisanie produktu zostało usunięte' });
    } catch (err) {
        console.error('Wyjątek w DELETE /api/admin/gallery-projects/:id/products/:productId:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: err.message });
    }
});

// -----------------------------
// API - Zarządzanie klientami
// -----------------------------

// Lista klientów (handlowiec widzi tylko swoich, admin/SALES_DEPT wszystkich)
app.get('/api/clients', requireRole(['SALES_REP', 'SALES_DEPT', 'ADMIN', 'WAREHOUSE']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const { role, id: userId } = req.user;
    const { search } = req.query;

    try {
        let query = supabase.from('Customer').select(`
            id,
            name,
            email,
            phone,
            address,
            city,
            zipCode,
            country,
            notes,
            salesRepId,
            createdAt,
            updatedAt
        `);

        // SALES_REP widzi tylko swoich klientów
        if (role === 'SALES_REP') {
            query = query.eq('salesRepId', userId);
        }
        // ADMIN, SALES_DEPT, WAREHOUSE widzą wszystkich

        if (search && typeof search === 'string' && search.trim()) {
            const term = `%${search.trim()}%`;
            query = query.or(
                `name.ilike.${term},email.ilike.${term},phone.ilike.${term},city.ilike.${term}`
            );
        }

        query = query.order('name', { ascending: true });

        const { data, error } = await query;

        if (error) {
            console.error('Błąd pobierania klientów:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się pobrać klientów', details: error.message });
        }

        // Wzbogać dane o nazwę handlowca (dla ADMIN i SALES_DEPT)
        let enrichedData = data || [];
        if (['ADMIN', 'SALES_DEPT'].includes(role) && enrichedData.length > 0) {
            const salesRepIds = [...new Set(enrichedData.map(c => c.salesRepId).filter(Boolean))];
            
            if (salesRepIds.length > 0) {
                const { data: users, error: usersError } = await supabase
                    .from('User')
                    .select('id, name')
                    .in('id', salesRepIds);
                
                if (!usersError && users) {
                    const userMap = Object.fromEntries(users.map(u => [u.id, u.name]));
                    enrichedData = enrichedData.map(c => ({
                        ...c,
                        salesRepName: c.salesRepId ? userMap[c.salesRepId] || 'Nieznany' : null
                    }));
                }
            }
        }

        return res.json({ status: 'success', data: enrichedData });
    } catch (err) {
        console.error('Wyjątek w GET /api/clients:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd podczas pobierania klientów', details: err.message });
    }
});

// Dodanie nowego klienta
app.post('/api/clients', requireRole(['SALES_REP', 'SALES_DEPT', 'ADMIN']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const { role, id: userId } = req.user;
    const { name, email, phone, address, city, zipCode, country, notes, salesRepId } = req.body || {};

    if (!name || !name.trim()) {
        return res.status(400).json({ status: 'error', message: 'Nazwa klienta jest wymagana' });
    }

    try {
        const clientData = {
            name: name.trim(),
            email: email?.trim() || null,
            phone: phone?.trim() || null,
            address: address?.trim() || null,
            city: city?.trim() || null,
            zipCode: zipCode?.trim() || null,
            country: country?.trim() || 'Poland',
            notes: notes?.trim() || null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        // Przypisanie do handlowca
        if (role === 'SALES_REP') {
            // Handlowiec może dodawać tylko swoich klientów
            clientData.salesRepId = userId;
        } else if (['ADMIN', 'SALES_DEPT'].includes(role)) {
            // Admin/SALES_DEPT może przypisać do dowolnego handlowca
            clientData.salesRepId = salesRepId || userId;
        }

        const { data, error } = await supabase
            .from('Customer')
            .insert(clientData)
            .select('*')
            .single();

        if (error) {
            console.error('Błąd tworzenia klienta:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się utworzyć klienta', details: error.message });
        }

        return res.status(201).json({ status: 'success', data });
    } catch (err) {
        console.error('Wyjątek w POST /api/clients:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd podczas tworzenia klienta', details: err.message });
    }
});

// Edycja klienta
app.patch('/api/clients/:id', requireRole(['SALES_REP', 'SALES_DEPT', 'ADMIN']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const { role, id: userId } = req.user;
    const { id } = req.params;
    const { name, email, phone, address, city, zipCode, country, notes, salesRepId } = req.body || {};

    try {
        // Sprawdź czy klient istnieje i czy użytkownik ma do niego dostęp
        let clientQuery = supabase.from('Customer').select('id, salesRepId').eq('id', id);
        
        if (role === 'SALES_REP') {
            clientQuery = clientQuery.eq('salesRepId', userId);
        }

        const { data: existingClient, error: fetchError } = await clientQuery.single();

        if (fetchError || !existingClient) {
            return res.status(404).json({ status: 'error', message: 'Klient nie znaleziony lub brak uprawnień' });
        }

        const updateData = {
            updatedAt: new Date().toISOString(),
        };

        if (name !== undefined) updateData.name = name.trim();
        if (email !== undefined) updateData.email = email?.trim() || null;
        if (phone !== undefined) updateData.phone = phone?.trim() || null;
        if (address !== undefined) updateData.address = address?.trim() || null;
        if (city !== undefined) updateData.city = city?.trim() || null;
        if (zipCode !== undefined) updateData.zipCode = zipCode?.trim() || null;
        if (country !== undefined) updateData.country = country?.trim() || 'Poland';
        if (notes !== undefined) updateData.notes = notes?.trim() || null;

        // Tylko ADMIN/SALES_DEPT może zmieniać przypisanie handlowca
        if (['ADMIN', 'SALES_DEPT'].includes(role) && salesRepId !== undefined) {
            updateData.salesRepId = salesRepId;
        }

        const { data, error } = await supabase
            .from('Customer')
            .update(updateData)
            .eq('id', id)
            .select('*')
            .single();

        if (error) {
            console.error('Błąd aktualizacji klienta:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się zaktualizować klienta', details: error.message });
        }

        return res.json({ status: 'success', data });
    } catch (err) {
        console.error('Wyjątek w PATCH /api/clients/:id:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd podczas aktualizacji klienta', details: err.message });
    }
});

// Usunięcie klienta
app.delete('/api/clients/:id', requireRole(['SALES_REP', 'SALES_DEPT', 'ADMIN']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const { role, id: userId } = req.user;
    const { id } = req.params;

    try {
        // Sprawdź czy klient istnieje i czy użytkownik ma do niego dostęp
        let clientQuery = supabase.from('Customer').select('id, name, salesRepId').eq('id', id);
        
        if (role === 'SALES_REP') {
            clientQuery = clientQuery.eq('salesRepId', userId);
        }

        const { data: existingClient, error: fetchError } = await clientQuery.single();

        if (fetchError || !existingClient) {
            return res.status(404).json({ status: 'error', message: 'Klient nie znaleziony lub brak uprawnień' });
        }

        // Sprawdź czy klient ma zamówienia (opcjonalnie - można to pominąć)
        const { data: orders } = await supabase
            .from('Order')
            .select('id')
            .eq('customerId', id)
            .limit(1);

        if (orders && orders.length > 0) {
            return res.status(400).json({ 
                status: 'error', 
                message: 'Nie można usunąć klienta, który ma zamówienia. Dezaktywuj go zamiast tego.' 
            });
        }

        const { error } = await supabase
            .from('Customer')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Błąd usuwania klienta:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się usunąć klienta', details: error.message });
        }

        return res.json({ status: 'success', message: `Klient "${existingClient.name}" został usunięty` });
    } catch (err) {
        console.error('Wyjątek w DELETE /api/clients/:id:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd podczas usuwania klienta', details: err.message });
    }
});

// ========================================
// Helpers do generowania shortCode i orderNumber
// ========================================

/**
 * Normalizuje tekst: usuwa spacje, zamienia znaki PL na ASCII, wielkie litery
 */
function normalizeText(text) {
    if (!text) return '';
    const plToAscii = {
        'Ł': 'L', 'ł': 'L',
        'Ś': 'S', 'ś': 'S',
        'Ż': 'Z', 'ż': 'Z',
        'Ź': 'Z', 'ź': 'Z',
        'Ć': 'C', 'ć': 'C',
        'Ń': 'N', 'ń': 'N',
        'Ó': 'O', 'ó': 'O',
        'Ę': 'E', 'ę': 'E',
        'Ą': 'A', 'ą': 'A'
    };
    
    return text
        .split('')
        .map(char => plToAscii[char] || char)
        .join('')
        .toUpperCase()
        .trim();
}

/**
 * Generuje 3-znakowy skrót z imienia i nazwiska
 * Bazowo: Imię[0] + Nazwisko[0..1] (z zachowaniem polskich znaków)
 * Przy kolizji: Imię[0] + Nazwisko[0] + cyfra
 * 
 * Przykłady:
 * - Jan Kowalski → JKO
 * - Mariusz Łukaszewicz → MŁU
 * - Kolizja: Mariusz Łukaszewicz (drugi) → MŁ1
 */
async function generateShortCode(firstName, lastName) {
    if (!firstName || !lastName) {
        throw new Error('firstName i lastName są wymagane');
    }

    const first = firstName.trim().toUpperCase();
    const last = lastName.trim().toUpperCase();

    if (!first || !last) {
        throw new Error('Nie można wygenerować kodu z pustych imienia/nazwiska');
    }

    // Bazowy kod: F + LL (pierwsze 2 litery nazwiska, z polskimi znakami)
    const base = first[0] + last.substring(0, 2);

    // Sprawdź, czy istnieje
    const { data: existing } = await supabase
        .from('User')
        .select('id')
        .eq('shortCode', base)
        .single();

    if (!existing) {
        // Kod jest wolny
        return base;
    }

    // Kolizja – szukamy wolnego kodu z cyfrą
    // Rdzeń: F + L (pierwsza litera nazwiska)
    const root = first[0] + last[0];

    // Znajdź wszystkie kody zaczynające się od root
    const { data: existingCodes } = await supabase
        .from('User')
        .select('shortCode')
        .ilike('shortCode', `${root}%`);

    const codes = (existingCodes || []).map(u => u.shortCode);

    // Szukaj pierwszej wolnej cyfry
    let digit = 1;
    while (codes.includes(`${root}${digit}`)) {
        digit++;
    }

    return `${root}${digit}`;
}

/**
 * Generuje numer zamówienia w formacie: YYYY/N/XXX
 * gdzie YYYY = rok, N = kolejny numer w roku, XXX = shortCode handlowca
 */
async function generateOrderNumber(userId) {
    if (!supabase) {
        throw new Error('Supabase nie jest skonfigurowany');
    }

    // Pobierz shortCode użytkownika
    const { data: user, error: userError } = await supabase
        .from('User')
        .select('shortCode, name')
        .eq('id', userId)
        .single();

    if (userError || !user) {
        throw new Error('Nie znaleziono użytkownika');
    }

    let shortCode = user.shortCode;

    // Jeśli brak shortCode, wygeneruj go automatycznie
    if (!shortCode && user.name) {
        shortCode = await generateShortCode(user.name);
        // Zapisz wygenerowany shortCode do bazy
        await supabase
            .from('User')
            .update({ shortCode })
            .eq('id', userId);
        console.log(`[generateOrderNumber] Wygenerowano shortCode "${shortCode}" dla użytkownika ${userId}`);
    }

    if (!shortCode) {
        throw new Error('Nie można wygenerować shortCode - brak nazwy użytkownika');
    }
    const year = new Date().getFullYear();

    // Policz zamówienia w danym roku
    const { data: yearOrders, error: countError } = await supabase
        .from('Order')
        .select('id', { count: 'exact' })
        .ilike('orderNumber', `${year}/%`);

    if (countError) {
        throw new Error(`Błąd przy liczeniu zamówień: ${countError.message}`);
    }

    const sequence = (yearOrders?.length || 0) + 1;

    return `${year}/${sequence}/${shortCode}`;
}

// ========================================
// Endpoint: POST /api/orders
// ========================================

app.post('/api/orders', requireRole(['SALES_REP', 'SALES_DEPT', 'ADMIN']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const userId = req.user.id;
    const { customerId, deliveryDate, notes, items } = req.body || {};

    // Walidacja
    if (!customerId) {
        return res.status(400).json({ status: 'error', message: 'customerId jest wymagane' });
    }

    // Walidacja deliveryDate
    if (!deliveryDate) {
        return res.status(400).json({ status: 'error', message: 'deliveryDate jest wymagane (data "Na kiedy potrzebne")' });
    }

    // Sprawdź format daty i czy nie jest w przeszłości
    const deliveryDateParsed = new Date(deliveryDate);
    if (isNaN(deliveryDateParsed.getTime())) {
        return res.status(400).json({ status: 'error', message: 'deliveryDate ma nieprawidłowy format (oczekiwany: YYYY-MM-DD)' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deliveryDay = new Date(deliveryDateParsed);
    deliveryDay.setHours(0, 0, 0, 0);

    if (deliveryDay < today) {
        return res.status(400).json({ status: 'error', message: 'deliveryDate nie może być datą z przeszłości' });
    }

    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ status: 'error', message: 'items musi być niepustą tablicą' });
    }

    // Walidacja każdej pozycji
    for (const item of items) {
        if (!item.productCode) {
            return res.status(400).json({ status: 'error', message: 'productCode jest wymagane dla każdej pozycji' });
        }
        if (!item.quantity || item.quantity <= 0) {
            return res.status(400).json({ status: 'error', message: 'quantity musi być > 0' });
        }
        if (item.unitPrice === undefined || item.unitPrice < 0) {
            return res.status(400).json({ status: 'error', message: 'unitPrice jest wymagane i musi być >= 0' });
        }
    }

    try {
        // Sprawdź, czy klient istnieje
        const { data: customer, error: customerError } = await supabase
            .from('Customer')
            .select('id')
            .eq('id', customerId)
            .single();

        if (customerError || !customer) {
            return res.status(404).json({ status: 'error', message: 'Klient nie znaleziony' });
        }

        // Policz total
        const total = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

        // Wygeneruj orderNumber
        const orderNumber = await generateOrderNumber(userId);

        // Utwórz Order (z deliveryDate i domyślnym priority=3)
        const { data: order, error: orderError } = await supabase
            .from('Order')
            .insert({
                customerId,
                userId,
                orderNumber,
                status: 'PENDING',
                total: parseFloat(total.toFixed(2)),
                deliveryDate: deliveryDateParsed.toISOString(),
                priority: 3,
                notes: notes || null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            })
            .select('id')
            .single();

        if (orderError || !order) {
            console.error('Błąd tworzenia Order:', orderError);
            return res.status(500).json({ status: 'error', message: 'Nie udało się utworzyć zamówienia', details: orderError?.message });
        }

        const orderId = order.id;

        // Zmapuj productCode (pc_id / index) -> Product.id
        const uniqueCodes = Array.from(new Set(items.map(i => i.productCode).filter(Boolean)));

        const { data: products, error: productsError } = await supabase
            .from('Product')
            .select('id, index')
            .in('index', uniqueCodes);

        if (productsError) {
            console.error('Błąd pobierania produktów dla zamówienia:', productsError);
            return res.status(500).json({ status: 'error', message: 'Nie udało się pobrać produktów dla zamówienia', details: productsError.message });
        }

        const productIdByCode = new Map();
        (products || []).forEach(p => {
            if (p.index) {
                productIdByCode.set(p.index, p.id);
            }
        });

        for (const item of items) {
            if (!item.productCode || !productIdByCode.get(item.productCode)) {
                console.error('Brak produktu o kodzie (index/pc_id):', item.productCode);
                return res.status(400).json({ status: 'error', message: `Nie znaleziono produktu o kodzie ${item.productCode}` });
            }
        }

        // Wstaw OrderItems
        const orderItems = items.map(item => ({
            orderId,
            productId: productIdByCode.get(item.productCode),
            quantity: item.quantity,
            unitPrice: parseFloat(item.unitPrice),
            selectedProjects: item.selectedProjects || null,
            projectQuantities: item.projectQuantities || null,
            quantitySource: item.quantitySource || 'total',  // Źródło prawdy: 'total' lub 'perProject'
            totalQuantity: item.totalQuantity || item.quantity,
            source: item.source || 'MIEJSCOWOSCI',
            locationName: item.locationName || null,
            projectName: item.projectName || null,
            customization: item.customization || null,
            productionNotes: item.productionNotes || null,
            projectviewurl: item.projectviewurl || null,
            stockAtOrder: Number.isFinite(Number(item.stockAtOrder)) ? Number(item.stockAtOrder) : null,
            belowStock: item.belowStock === true
        }));

        const { data: insertedItems, error: itemsError } = await supabase
            .from('OrderItem')
            .insert(orderItems)
            .select();

        if (itemsError) {
            console.error('Błąd tworzenia OrderItems:', itemsError);
            // Spróbuj usunąć Order (rollback)
            await supabase.from('Order').delete().eq('id', orderId);
            return res.status(500).json({ status: 'error', message: 'Nie udało się dodać pozycji do zamówienia', details: itemsError.message });
        }

        // Automatyczne tworzenie zadań grafiki dla pozycji wymagających projektu
        let createdGraphicTasks = 0;
        if (insertedItems && insertedItems.length > 0) {
            const tasksToInsert = insertedItems
                .filter(oi =>
                    // Heurystyka: pozycje z tych źródeł, bez przypisanych projektów
                    (oi.source === 'MIEJSCOWOSCI' || oi.source === 'KLIENCI_INDYWIDUALNI') &&
                    (!oi.selectedProjects || String(oi.selectedProjects).trim() === '')
                )
                .map(oi => ({
                    orderId: oi.orderId,
                    orderItemId: oi.id,
                    status: 'todo',
                    approvalRequired: false,
                    approvalStatus: 'not_required',
                    createdBy: userId,
                    galleryContext: {
                        source: oi.source,
                        locationName: oi.locationName,
                        projectName: oi.projectName
                    }
                }));

            if (tasksToInsert.length > 0) {
                const { error: tasksError } = await supabase
                    .from('GraphicTask')
                    .insert(tasksToInsert);

                if (tasksError) {
                    console.error('Błąd tworzenia zadań graficznych dla zamówienia:', tasksError);
                } else {
                    createdGraphicTasks = tasksToInsert.length;

                    // Ustaw typ zamówienia na zawierające projekty
                    const { error: orderUpdateError } = await supabase
                        .from('Order')
                        .update({
                            ordertype: 'PRODUCTS_AND_PROJECTS',
                            projectsReady: false
                        })
                        .eq('id', orderId);

                    if (orderUpdateError) {
                        console.error('Błąd aktualizacji Order.orderType po utworzeniu zadań graficznych:', orderUpdateError);
                    }
                }
            }
        }

        console.log(`✅ Zamówienie ${orderNumber} utworzone (ID: ${orderId}), zadania grafiki: ${createdGraphicTasks}`);

        return res.status(201).json({
            status: 'success',
            message: 'Zamówienie zostało utworzone',
            data: {
                orderId,
                orderNumber,
                total,
                itemCount: items.length
            }
        });

    } catch (error) {
        console.error('Wyjątek w POST /api/orders:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd podczas tworzenia zamówienia', details: error.message });
    }
});

// ============================================
// MODUŁ SZABLONÓW ZAMÓWIEŃ
// ============================================

// GET /api/order-templates - Lista szablonów widocznych dla użytkownika
app.get('/api/order-templates', requireRole(['SALES_REP', 'SALES_DEPT', 'ADMIN']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const userId = req.user.id;
    const userRole = req.user.role;
    const { tag, visibility, search } = req.query;

    try {
        // Buduj zapytanie: własne szablony + szablony zespołowe
        let query = supabase
            .from('order_templates')
            .select(`
                id,
                owner_id,
                name,
                description,
                visibility,
                tags,
                usage_count,
                last_used_at,
                created_at,
                updated_at,
                User:owner_id (name)
            `)
            .order('updated_at', { ascending: false });

        // Filtruj: własne LUB zespołowe
        query = query.or(`owner_id.eq.${userId},visibility.eq.TEAM`);

        if (tag) {
            query = query.contains('tags', [tag]);
        }

        if (visibility) {
            query = query.eq('visibility', visibility);
        }

        if (search) {
            query = query.ilike('name', `%${search}%`);
        }

        const { data: templates, error } = await query;

        if (error) {
            console.error('Błąd pobierania szablonów:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się pobrać szablonów', details: error.message });
        }

        // Sprawdź ulubione użytkownika
        const { data: favorites } = await supabase
            .from('order_template_favorites')
            .select('template_id')
            .eq('user_id', userId);

        const favoriteIds = new Set((favorites || []).map(f => f.template_id));

        const enriched = (templates || []).map(t => ({
            ...t,
            ownerName: t.User?.name || 'Nieznany',
            isFavorite: favoriteIds.has(t.id),
            isOwner: t.owner_id === userId
        }));

        return res.json({ status: 'success', data: enriched });
    } catch (error) {
        console.error('Wyjątek w GET /api/order-templates:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: error.message });
    }
});

// POST /api/order-templates - Zapis bieżącego koszyka jako szablon
app.post('/api/order-templates', requireRole(['SALES_REP', 'SALES_DEPT', 'ADMIN']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const userId = req.user.id;
    const { name, description, visibility, tags, items } = req.body;

    // Walidacja
    if (!name || !name.trim()) {
        return res.status(400).json({ status: 'error', message: 'Nazwa szablonu jest wymagana' });
    }

    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ status: 'error', message: 'Szablon musi zawierać przynajmniej jedną pozycję' });
    }

    const templateVisibility = visibility === 'TEAM' ? 'TEAM' : 'PRIVATE';

    try {
        // Utwórz szablon
        const { data: template, error: templateError } = await supabase
            .from('order_templates')
            .insert({
                owner_id: userId,
                name: name.trim(),
                description: description?.trim() || null,
                visibility: templateVisibility,
                tags: Array.isArray(tags) ? tags : [],
                usage_count: 0,
                last_used_at: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select('id')
            .single();

        if (templateError || !template) {
            console.error('Błąd tworzenia szablonu:', templateError);
            return res.status(500).json({ status: 'error', message: 'Nie udało się utworzyć szablonu', details: templateError?.message });
        }

        const templateId = template.id;

        // Mapuj productCode -> Product.id
        const uniqueCodes = Array.from(new Set(items.map(i => i.productCode).filter(Boolean)));
        const { data: products, error: productsError } = await supabase
            .from('Product')
            .select('id, index')
            .in('index', uniqueCodes);

        if (productsError) {
            await supabase.from('order_templates').delete().eq('id', templateId);
            return res.status(500).json({ status: 'error', message: 'Nie udało się pobrać produktów', details: productsError.message });
        }

        const productIdByCode = new Map();
        (products || []).forEach(p => {
            if (p.index) productIdByCode.set(p.index, p.id);
        });

        // Waliduj produkty
        for (const item of items) {
            if (!item.productCode || !productIdByCode.get(item.productCode)) {
                await supabase.from('order_templates').delete().eq('id', templateId);
                return res.status(400).json({ status: 'error', message: `Nie znaleziono produktu o kodzie ${item.productCode}` });
            }
        }

        // Wstaw pozycje szablonu
        const templateItems = items.map((item, idx) => ({
            template_id: templateId,
            product_id: productIdByCode.get(item.productCode),
            quantity: item.quantity,
            unit_price: parseFloat(item.unitPrice || 0),
            selected_projects: item.selectedProjects || null,
            project_quantities: item.projectQuantities || null,
            total_quantity: item.totalQuantity || item.quantity,
            source: item.source || 'MIEJSCOWOSCI',
            location_name: item.locationName || null,
            project_name: item.projectName || null,
            customization: item.customization || null,
            production_notes: item.productionNotes || null,
            sort_order: idx,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }));

        const { error: itemsError } = await supabase
            .from('order_template_items')
            .insert(templateItems);

        if (itemsError) {
            console.error('Błąd tworzenia pozycji szablonu:', itemsError);
            await supabase.from('order_templates').delete().eq('id', templateId);
            return res.status(500).json({ status: 'error', message: 'Nie udało się dodać pozycji do szablonu', details: itemsError.message });
        }

        console.log(`✅ Szablon "${name}" utworzony (ID: ${templateId})`);

        return res.status(201).json({
            status: 'success',
            message: 'Szablon został utworzony',
            data: { templateId, name }
        });
    } catch (error) {
        console.error('Wyjątek w POST /api/order-templates:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd podczas tworzenia szablonu', details: error.message });
    }
});

// PATCH /api/order-templates/:id - Aktualizacja metadanych szablonu
app.patch('/api/order-templates/:id', requireRole(['SALES_REP', 'SALES_DEPT', 'ADMIN']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const userId = req.user.id;
    const userRole = req.user.role;
    const templateId = req.params.id;
    const { name, description, visibility, tags } = req.body;

    try {
        // Sprawdź czy szablon istnieje i czy użytkownik ma prawo go edytować
        const { data: template, error: fetchError } = await supabase
            .from('order_templates')
            .select('id, owner_id, visibility')
            .eq('id', templateId)
            .single();

        if (fetchError || !template) {
            return res.status(404).json({ status: 'error', message: 'Szablon nie znaleziony' });
        }

        // Tylko właściciel lub admin może edytować
        if (template.owner_id !== userId && userRole !== 'ADMIN') {
            return res.status(403).json({ status: 'error', message: 'Brak uprawnień do edycji tego szablonu' });
        }

        const updates = {
            updated_at: new Date().toISOString()
        };

        if (name !== undefined) updates.name = name.trim();
        if (description !== undefined) updates.description = description?.trim() || null;
        if (visibility !== undefined) updates.visibility = visibility === 'TEAM' ? 'TEAM' : 'PRIVATE';
        if (Array.isArray(tags)) updates.tags = tags;

        const { error: updateError } = await supabase
            .from('order_templates')
            .update(updates)
            .eq('id', templateId);

        if (updateError) {
            console.error('Błąd aktualizacji szablonu:', updateError);
            return res.status(500).json({ status: 'error', message: 'Nie udało się zaktualizować szablonu', details: updateError.message });
        }

        console.log(`✅ Szablon ${templateId} zaktualizowany`);

        return res.json({ status: 'success', message: 'Szablon został zaktualizowany' });
    } catch (error) {
        console.error('Wyjątek w PATCH /api/order-templates/:id:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: error.message });
    }
});

// DELETE /api/order-templates/:id - Usunięcie szablonu
app.delete('/api/order-templates/:id', requireRole(['SALES_REP', 'SALES_DEPT', 'ADMIN']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const userId = req.user.id;
    const userRole = req.user.role;
    const templateId = req.params.id;

    try {
        const { data: template, error: fetchError } = await supabase
            .from('order_templates')
            .select('id, owner_id, name')
            .eq('id', templateId)
            .single();

        if (fetchError || !template) {
            return res.status(404).json({ status: 'error', message: 'Szablon nie znaleziony' });
        }

        // Tylko właściciel lub admin może usunąć
        if (template.owner_id !== userId && userRole !== 'ADMIN') {
            return res.status(403).json({ status: 'error', message: 'Brak uprawnień do usunięcia tego szablonu' });
        }

        const { error: deleteError } = await supabase
            .from('order_templates')
            .delete()
            .eq('id', templateId);

        if (deleteError) {
            console.error('Błąd usuwania szablonu:', deleteError);
            return res.status(500).json({ status: 'error', message: 'Nie udało się usunąć szablonu', details: deleteError.message });
        }

        console.log(`✅ Szablon "${template.name}" usunięty przez ${userId}`);

        return res.json({ status: 'success', message: 'Szablon został usunięty' });
    } catch (error) {
        console.error('Wyjątek w DELETE /api/order-templates/:id:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: error.message });
    }
});

// POST /api/order-templates/:id/duplicate - Duplikacja szablonu
app.post('/api/order-templates/:id/duplicate', requireRole(['SALES_REP', 'SALES_DEPT', 'ADMIN']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const userId = req.user.id;
    const templateId = req.params.id;
    const { name } = req.body;

    try {
        // Pobierz oryginalny szablon
        const { data: original, error: fetchError } = await supabase
            .from('order_templates')
            .select('*')
            .eq('id', templateId)
            .single();

        if (fetchError || !original) {
            return res.status(404).json({ status: 'error', message: 'Szablon nie znaleziony' });
        }

        // Sprawdź dostęp (własny lub zespołowy)
        if (original.owner_id !== userId && original.visibility !== 'TEAM') {
            return res.status(403).json({ status: 'error', message: 'Brak dostępu do tego szablonu' });
        }

        // Pobierz pozycje
        const { data: items, error: itemsError } = await supabase
            .from('order_template_items')
            .select('*')
            .eq('template_id', templateId)
            .order('sort_order');

        if (itemsError) {
            return res.status(500).json({ status: 'error', message: 'Nie udało się pobrać pozycji szablonu', details: itemsError.message });
        }

        // Utwórz nowy szablon
        const newName = name?.trim() || `${original.name} (kopia)`;
        const { data: newTemplate, error: createError } = await supabase
            .from('order_templates')
            .insert({
                owner_id: userId,
                name: newName,
                description: original.description,
                visibility: 'PRIVATE', // Kopia zawsze prywatna
                tags: original.tags,
                usage_count: 0,
                last_used_at: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select('id')
            .single();

        if (createError || !newTemplate) {
            return res.status(500).json({ status: 'error', message: 'Nie udało się utworzyć kopii szablonu', details: createError?.message });
        }

        // Skopiuj pozycje
        const newItems = (items || []).map(item => ({
            template_id: newTemplate.id,
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            selected_projects: item.selected_projects,
            project_quantities: item.project_quantities,
            total_quantity: item.total_quantity,
            source: item.source,
            location_name: item.location_name,
            project_name: item.project_name,
            customization: item.customization,
            production_notes: item.production_notes,
            sort_order: item.sort_order,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }));

        if (newItems.length > 0) {
            const { error: insertError } = await supabase
                .from('order_template_items')
                .insert(newItems);

            if (insertError) {
                await supabase.from('order_templates').delete().eq('id', newTemplate.id);
                return res.status(500).json({ status: 'error', message: 'Nie udało się skopiować pozycji', details: insertError.message });
            }
        }

        console.log(`✅ Szablon "${original.name}" zduplikowany jako "${newName}" (ID: ${newTemplate.id})`);

        return res.status(201).json({
            status: 'success',
            message: 'Szablon został zduplikowany',
            data: { templateId: newTemplate.id, name: newName }
        });
    } catch (error) {
        console.error('Wyjątek w POST /api/order-templates/:id/duplicate:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: error.message });
    }
});

// POST /api/order-templates/:id/use - Wczytaj szablon do koszyka
app.post('/api/order-templates/:id/use', requireRole(['SALES_REP', 'SALES_DEPT', 'ADMIN']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const userId = req.user.id;
    const templateId = req.params.id;

    try {
        // Pobierz szablon
        const { data: template, error: fetchError } = await supabase
            .from('order_templates')
            .select('*')
            .eq('id', templateId)
            .single();

        if (fetchError || !template) {
            return res.status(404).json({ status: 'error', message: 'Szablon nie znaleziony' });
        }

        // Sprawdź dostęp
        if (template.owner_id !== userId && template.visibility !== 'TEAM') {
            return res.status(403).json({ status: 'error', message: 'Brak dostępu do tego szablonu' });
        }

        // Pobierz pozycje z produktami
        const { data: items, error: itemsError } = await supabase
            .from('order_template_items')
            .select(`
                *,
                Product:product_id (
                    id,
                    identifier,
                    index,
                    description,
                    price,
                    category
                )
            `)
            .eq('template_id', templateId)
            .order('sort_order');

        if (itemsError) {
            return res.status(500).json({ status: 'error', message: 'Nie udało się pobrać pozycji szablonu', details: itemsError.message });
        }

        // Aktualizuj statystyki użycia
        await supabase
            .from('order_templates')
            .update({
                usage_count: (template.usage_count || 0) + 1,
                last_used_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', templateId);

        // Przygotuj dane dla frontu – zachowujemy ten sam kontrakt co /api/v1/products:
        // name = identifier (identyfikator), pc_id = index.
        const cartItems = (items || []).map(item => ({
            productId: item.product_id,
            productCode: item.Product?.index || item.Product?.identifier,
            productName: item.Product?.identifier,
            productPrice: item.Product?.price,
            quantity: item.quantity,
            unitPrice: item.unit_price,
            selectedProjects: item.selected_projects,
            projectQuantities: item.project_quantities,
            totalQuantity: item.total_quantity,
            source: item.source,
            locationName: item.location_name,
            projectName: item.project_name,
            customization: item.customization,
            productionNotes: item.production_notes
        }));

        console.log(`✅ Szablon "${template.name}" wczytany przez ${userId}`);

        return res.json({
            status: 'success',
            message: 'Szablon został wczytany',
            data: {
                templateName: template.name,
                items: cartItems
            }
        });
    } catch (error) {
        console.error('Wyjątek w POST /api/order-templates/:id/use:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: error.message });
    }
});

// POST /api/order-templates/:id/favorite - Dodaj/usuń z ulubionych
app.post('/api/order-templates/:id/favorite', requireRole(['SALES_REP', 'SALES_DEPT', 'ADMIN']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    const userId = req.user.id;
    const templateId = req.params.id;
    const { isFavorite } = req.body;

    try {
        // Sprawdź czy szablon istnieje i jest dostępny
        const { data: template, error: fetchError } = await supabase
            .from('order_templates')
            .select('id, owner_id, visibility')
            .eq('id', templateId)
            .single();

        if (fetchError || !template) {
            return res.status(404).json({ status: 'error', message: 'Szablon nie znaleziony' });
        }

        if (template.owner_id !== userId && template.visibility !== 'TEAM') {
            return res.status(403).json({ status: 'error', message: 'Brak dostępu do tego szablonu' });
        }

        if (isFavorite) {
            // Dodaj do ulubionych
            const { error: insertError } = await supabase
                .from('order_template_favorites')
                .insert({
                    template_id: templateId,
                    user_id: userId,
                    created_at: new Date().toISOString()
                });

            if (insertError && insertError.code !== '23505') { // Ignoruj duplikaty
                return res.status(500).json({ status: 'error', message: 'Nie udało się dodać do ulubionych', details: insertError.message });
            }
        } else {
            // Usuń z ulubionych
            const { error: deleteError } = await supabase
                .from('order_template_favorites')
                .delete()
                .eq('template_id', templateId)
                .eq('user_id', userId);

            if (deleteError) {
                return res.status(500).json({ status: 'error', message: 'Nie udało się usunąć z ulubionych', details: deleteError.message });
            }
        }

        return res.json({ status: 'success', message: isFavorite ? 'Dodano do ulubionych' : 'Usunięto z ulubionych' });
    } catch (error) {
        console.error('Wyjątek w POST /api/order-templates/:id/favorite:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera', details: error.message });
    }
});

// ============================================
// GET /api/user - Dane bieżącego użytkownika
// ============================================
app.get('/api/user', async (req, res) => {
    try {
        const { userId, role } = await getAuthContext(req);

        if (!userId || !role) {
            return res.status(401).json({ status: 'error', message: 'Brak autoryzacji' });
        }

        const { data: user, error } = await supabase
            .from('User')
            .select('id, name, email, role, shortCode')
            .eq('id', userId)
            .single();

        if (error || !user) {
            return res.status(404).json({ status: 'error', message: 'Użytkownik nie znaleziony' });
        }

        res.json({
            status: 'success',
            data: user
        });
    } catch (error) {
        console.error('Błąd w GET /api/user:', error);
        res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// GET /api/users - Lista handlowców (dla każdego zalogowanego)
// ============================================
app.get('/api/users', async (req, res) => {
    try {
        const { userId, role } = await getAuthContext(req);

        if (!userId || !role) {
            return res.status(401).json({ status: 'error', message: 'Brak autoryzacji' });
        }

        // Pobierz wszystkich handlowców (bez ograniczenia roli)
        const { data: users, error } = await supabase
            .from('User')
            .select('id, name, shortCode')
            .eq('role', 'SALES_REP')
            .order('name');

        if (error) {
            console.error('Błąd pobierania handlowców:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się pobrać handlowców' });
        }

        res.json({
            status: 'success',
            data: users || []
        });
    } catch (error) {
        console.error('Błąd w GET /api/users:', error);
        res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// GET /api/orders/my - Zamówienia bieżącego handlowca
// ============================================
app.get('/api/orders/my', async (req, res) => {
    try {
        const { userId } = await getAuthContext(req);

        if (!userId) {
            return res.status(401).json({ status: 'error', message: 'Brak autoryzacji' });
        }

        const { status, customerId, dateFrom, dateTo } = req.query;

        let query = supabase
            .from('Order')
            .select(`
                id,
                orderNumber,
                customerId,
                userId,
                status,
                total,
                notes,
                createdAt,
                updatedAt,
                Customer:customerId(id, name),
                User:userId(id, name, shortCode)
            `)
            .eq('userId', userId)
            .order('createdAt', { ascending: false });

        if (status) {
            query = query.eq('status', status);
        }

        if (customerId) {
            query = query.eq('customerId', customerId);
        }

        if (dateFrom) {
            query = query.gte('createdAt', new Date(dateFrom).toISOString());
        }

        if (dateTo) {
            const endOfDay = new Date(dateTo);
            endOfDay.setHours(23, 59, 59, 999);
            query = query.lte('createdAt', endOfDay.toISOString());
        }

        const { data: orders, error } = await query;

        if (error) {
            console.error('Błąd pobierania zamówień:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się pobrać zamówień' });
        }

        res.json({
            status: 'success',
            data: orders || []
        });
    } catch (error) {
        console.error('Błąd w GET /api/orders/my:', error);
        res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// GET /api/orders - Zamówienia (wg roli: SALES_REP tylko swoje, ADMIN/SALES_DEPT/WAREHOUSE wszystkie)
// ============================================
app.get('/api/orders', async (req, res) => {
    try {
        const { userId, role } = await getAuthContext(req);

        console.log('[GET /api/orders] start', { userId, role });
        
        if (!userId || !role) {
            return res.status(401).json({ status: 'error', message: 'Brak autoryzacji' });
        }

        // Kontrola dostępu wg roli
        if (!['SALES_REP', 'ADMIN', 'SALES_DEPT', 'WAREHOUSE', 'PRODUCTION'].includes(role)) {
            return res.status(403).json({ status: 'error', message: 'Brak uprawnień do tego zasobu' });
        }

        const { status, userId: filterUserId, customerId, dateFrom, dateTo, belowStockOnly } = req.query;

        let query = supabase
            .from('Order')
            .select(`
                id,
                orderNumber,
                customerId,
                userId,
                status,
                total,
                deliveryDate,
                priority,
                notes,
                createdAt,
                updatedAt,
                Customer:customerId(id, name),
                User:userId(name, shortCode),
                OrderItem (
                    id,
                    productId,
                    quantity,
                    unitPrice,
                    selectedProjects,
                    projectQuantities,
                    quantitySource,
                    totalQuantity,
                    source,
                    locationName,
                    projectName,
                    customization,
                    productionNotes,
                    projectviewurl,
                    stockAtOrder,
                    belowStock,
                    Product:productId(id, name, identifier, index)
                )
            `)
            .order('createdAt', { ascending: false });

        // Jeśli SALES_REP, widzi tylko swoje zamówienia
        if (role === 'SALES_REP') {
            query = query.eq('userId', userId);
        }
        // ADMIN, SALES_DEPT, WAREHOUSE widzą wszystkie – bez ograniczenia

        // Filtry z query (mogą być stosowane niezależnie od roli)
        if (status) {
            query = query.eq('status', status);
        }

        if (filterUserId) {
            query = query.eq('userId', filterUserId);
        }

        if (customerId) {
            query = query.eq('customerId', customerId);
        }

        if (dateFrom) {
            query = query.gte('createdAt', dateFrom);
        }

        if (dateTo) {
            query = query.lte('createdAt', dateTo);
        }

        const { data: orders, error } = await query;

        if (error) {
            console.error('Błąd Supabase w GET /api/orders:', error);
            return res.status(500).json({ status: 'error', message: 'Błąd pobierania zamówień' });
        }

        let enrichedOrders = orders || [];

        if (enrichedOrders.length > 0) {
            const orderIds = enrichedOrders.map(o => o.id).filter(Boolean);

            const { data: belowStockItems, error: belowStockError } = await supabase
                .from('OrderItem')
                .select('orderId')
                .in('orderId', orderIds)
                .eq('belowStock', true);

            if (belowStockError) {
                console.error('Błąd Supabase w GET /api/orders (belowStock):', belowStockError);
            }

            const belowStockSet = new Set((belowStockItems || []).map(row => row.orderId));

            enrichedOrders = enrichedOrders.map(o => ({
                ...o,
                hasBelowStock: belowStockSet.has(o.id)
            }));

            if (belowStockOnly && ['true', '1', 'on'].includes(String(belowStockOnly).toLowerCase())) {
                enrichedOrders = enrichedOrders.filter(o => o.hasBelowStock);
            }
        }

        console.log('[GET /api/orders] returning', { count: enrichedOrders.length });

        return res.json({
            status: 'success',
            data: enrichedOrders
        });
    } catch (error) {
        console.error('Błąd w GET /api/orders:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// GET /api/admin/orders - Endpoint dla panelu admina (bez konfliktu z legacy)
// ============================================
app.get('/api/admin/orders', async (req, res) => {
    try {
        const { userId, role } = await getAuthContext(req);

        console.log('[GET /api/admin/orders] start', { userId, role });
        
        if (!userId || !role) {
            return res.status(401).json({ status: 'error', message: 'Brak autoryzacji' });
        }

        // Kontrola dostępu wg roli
        if (!['SALES_REP', 'ADMIN', 'SALES_DEPT', 'WAREHOUSE'].includes(role)) {
            return res.status(403).json({ status: 'error', message: 'Brak uprawnień do tego zasobu' });
        }

        const { status, userId: filterUserId, customerId, dateFrom, dateTo } = req.query;

        let query = supabase
            .from('Order')
            .select(`
                id,
                orderNumber,
                customerId,
                userId,
                status,
                total,
                notes,
                createdAt,
                updatedAt,
                Customer:customerId(id, name),
                User:userId(id, name, shortCode)
            `)
            .order('createdAt', { ascending: false });

        // Jeśli SALES_REP, widzi tylko swoje zamówienia
        if (role === 'SALES_REP') {
            query = query.eq('userId', userId);
        }
        // ADMIN, SALES_DEPT, WAREHOUSE widzą wszystkie – bez ograniczenia

        // Filtry z query
        if (status) {
            query = query.eq('status', status);
        }

        if (filterUserId) {
            query = query.eq('userId', filterUserId);
        }

        if (customerId) {
            query = query.eq('customerId', customerId);
        }

        if (dateFrom) {
            query = query.gte('createdAt', dateFrom);
        }

        if (dateTo) {
            query = query.lte('createdAt', dateTo);
        }

        const { data: orders, error } = await query;

        if (error) {
            console.error('Błąd Supabase w GET /api/admin/orders:', error);
            return res.status(500).json({ status: 'error', message: 'Błąd pobierania zamówień' });
        }

        // Pobierz postęp produkcji dla wszystkich zamówień
        const orderIds = (orders || []).map(o => o.id);
        let productionProgressMap = {};

        if (orderIds.length > 0) {
            // Pobierz zlecenia produkcyjne dla tych zamówień
            const { data: prodOrders, error: prodError } = await supabase
                .from('ProductionOrder')
                .select('id, sourceorderid, status')
                .in('sourceorderid', orderIds);

            if (!prodError && prodOrders && prodOrders.length > 0) {
                // Pobierz operacje dla tych zleceń
                const prodOrderIds = prodOrders.map(po => po.id);
                const { data: operations, error: opsError } = await supabase
                    .from('ProductionOperation')
                    .select('id, productionorderid, status')
                    .in('productionorderid', prodOrderIds);

                // Grupuj po zamówieniu źródłowym
                prodOrders.forEach(po => {
                    const sourceId = po.sourceorderid;
                    if (!productionProgressMap[sourceId]) {
                        productionProgressMap[sourceId] = {
                            totalOrders: 0,
                            completedOrders: 0,
                            totalOps: 0,
                            completedOps: 0
                        };
                    }
                    productionProgressMap[sourceId].totalOrders++;
                    if (po.status === 'completed') {
                        productionProgressMap[sourceId].completedOrders++;
                    }
                });

                // Dodaj operacje
                if (!opsError && operations) {
                    operations.forEach(op => {
                        const prodOrder = prodOrders.find(po => po.id === op.productionorderid);
                        if (prodOrder) {
                            const sourceId = prodOrder.sourceorderid;
                            if (productionProgressMap[sourceId]) {
                                productionProgressMap[sourceId].totalOps++;
                                if (op.status === 'completed') {
                                    productionProgressMap[sourceId].completedOps++;
                                }
                            }
                        }
                    });
                }
            }
        }

        // Dodaj informacje o postępie do każdego zamówienia
        const ordersWithProgress = (orders || []).map(order => {
            const progress = productionProgressMap[order.id];
            if (progress) {
                const percent = progress.totalOps > 0 
                    ? Math.round((progress.completedOps / progress.totalOps) * 100) 
                    : 0;
                return {
                    ...order,
                    productionProgress: {
                        totalOrders: progress.totalOrders,
                        completedOrders: progress.completedOrders,
                        totalOps: progress.totalOps,
                        completedOps: progress.completedOps,
                        percent,
                        label: `${progress.completedOps}/${progress.totalOps}`
                    }
                };
            }
            return {
                ...order,
                productionProgress: null
            };
        });

        console.log('[GET /api/admin/orders] returning', { count: ordersWithProgress.length });

        return res.json({
            status: 'success',
            data: ordersWithProgress
        });
    } catch (error) {
        console.error('Błąd w GET /api/admin/orders:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// PATCH /api/orders/:id/items - Edycja pozycji zamówienia
// ============================================
app.patch('/api/orders/:id/items', async (req, res) => {
    try {
        const { userId, role } = await getAuthContext(req);
        
        if (!userId || !role) {
            return res.status(401).json({ status: 'error', message: 'Brak autoryzacji' });
        }

        const { id: orderId } = req.params;
        const { items } = req.body; // Array of { id, quantity, selectedProjects, projectQuantities, quantitySource, locationName, productionNotes }

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ status: 'error', message: 'Brak pozycji do aktualizacji' });
        }

        // Pobierz zamówienie
        const { data: order, error: orderError } = await supabase
            .from('Order')
            .select('id, userId, status')
            .eq('id', orderId)
            .single();

        if (orderError || !order) {
            return res.status(404).json({ status: 'error', message: 'Zamówienie nie znalezione' });
        }

        // Sprawdź uprawnienia do edycji
        const canEditStatuses = {
            SALES_REP: ['PENDING'],
            SALES_DEPT: ['PENDING', 'APPROVED'],
            ADMIN: ['PENDING', 'APPROVED']
        };

        const allowedStatuses = canEditStatuses[role] || [];
        
        // SALES_REP może edytować tylko własne zamówienia
        if (role === 'SALES_REP' && order.userId !== userId) {
            return res.status(403).json({ status: 'error', message: 'Brak uprawnień do edycji tego zamówienia' });
        }

        // Sprawdź czy status pozwala na edycję
        if (!allowedStatuses.includes(order.status)) {
            return res.status(403).json({ 
                status: 'error', 
                message: `Nie można edytować zamówienia w statusie "${order.status}". Dozwolone statusy: ${allowedStatuses.join(', ') || 'brak'}` 
            });
        }

        // Pobierz istniejące pozycje zamówienia
        const { data: existingItems, error: existingError } = await supabase
            .from('OrderItem')
            .select('id, productId, quantity, unitPrice')
            .eq('orderId', orderId);

        if (existingError) {
            console.error('Błąd pobierania pozycji:', existingError);
            return res.status(500).json({ status: 'error', message: 'Błąd pobierania pozycji zamówienia' });
        }

        // Pobierz produkty dla stanów magazynowych
        const productIds = [...new Set(existingItems.map(i => i.productId).filter(Boolean))];
        let productsMap = new Map();
        if (productIds.length > 0) {
            const { data: products } = await supabase
                .from('Product')
                .select('id, stock')
                .in('id', productIds);
            if (products) {
                productsMap = new Map(products.map(p => [p.id, p]));
            }
        }

        const existingItemsMap = new Map(existingItems.map(item => [item.id, item]));

        // Przygotuj aktualizacje
        const updates = [];
        let newTotal = 0;

        for (const item of items) {
            const existing = existingItemsMap.get(item.id);
            if (!existing) {
                console.warn(`Pozycja ${item.id} nie istnieje w zamówieniu ${orderId}`);
                continue;
            }

            const quantity = Number(item.quantity) || existing.quantity;
            const unitPrice = existing.unitPrice;
            const lineTotal = quantity * unitPrice;
            newTotal += lineTotal;

            // Oblicz stockAtOrder i belowStock
            const product = productsMap.get(existing.productId);
            const currentStock = product?.stock;
            const stockAtOrder = (currentStock !== undefined && currentStock !== null) ? Number(currentStock) : null;
            const belowStock = (stockAtOrder !== null && quantity > stockAtOrder);

            updates.push({
                id: item.id,
                quantity,
                selectedProjects: item.selectedProjects !== undefined ? item.selectedProjects : undefined,
                projectQuantities: item.projectQuantities !== undefined ? item.projectQuantities : undefined,
                quantitySource: item.quantitySource !== undefined ? item.quantitySource : undefined,
                locationName: item.locationName !== undefined ? item.locationName : undefined,
                productionNotes: item.productionNotes !== undefined ? item.productionNotes : undefined,
                totalQuantity: quantity,
                stockAtOrder,
                belowStock
            });
        }

        // Wykonaj aktualizacje pozycji
        for (const update of updates) {
            const { id, ...fields } = update;
            // Usuń undefined pola
            const cleanFields = Object.fromEntries(
                Object.entries(fields).filter(([_, v]) => v !== undefined)
            );

            const { error: updateError } = await supabase
                .from('OrderItem')
                .update(cleanFields)
                .eq('id', id);

            if (updateError) {
                console.error(`Błąd aktualizacji pozycji ${id}:`, updateError);
            }
        }

        // Przelicz total dla całego zamówienia (pobierz wszystkie pozycje)
        const { data: allItems, error: allItemsError } = await supabase
            .from('OrderItem')
            .select('quantity, unitPrice')
            .eq('orderId', orderId);

        if (!allItemsError && allItems) {
            newTotal = allItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
        }

        // Zaktualizuj total zamówienia
        const { error: orderUpdateError } = await supabase
            .from('Order')
            .update({ total: newTotal, updatedAt: new Date().toISOString() })
            .eq('id', orderId);

        if (orderUpdateError) {
            console.error('Błąd aktualizacji total zamówienia:', orderUpdateError);
        }

        console.log(`[PATCH /api/orders/${orderId}/items] Zaktualizowano ${updates.length} pozycji, nowy total: ${newTotal}`);

        return res.json({
            status: 'success',
            message: `Zaktualizowano ${updates.length} pozycji`,
            data: { total: newTotal }
        });

    } catch (error) {
        console.error('Błąd w PATCH /api/orders/:id/items:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// DELETE /api/orders/:orderId/items/:itemId - Usunięcie pozycji zamówienia
// ============================================
app.delete('/api/orders/:orderId/items/:itemId', async (req, res) => {
    try {
        const { userId, role } = await getAuthContext(req);
        
        if (!userId || !role) {
            return res.status(401).json({ status: 'error', message: 'Brak autoryzacji' });
        }

        const { orderId, itemId } = req.params;

        // Pobierz zamówienie
        const { data: order, error: orderError } = await supabase
            .from('Order')
            .select('id, userId, status')
            .eq('id', orderId)
            .single();

        if (orderError || !order) {
            return res.status(404).json({ status: 'error', message: 'Zamówienie nie znalezione' });
        }

        // Uprawnienia do usuwania pozycji
        const canDeleteStatuses = {
            SALES_DEPT: ['PENDING', 'APPROVED'],
            ADMIN: ['PENDING', 'APPROVED']
        };

        const allowedStatuses = canDeleteStatuses[role] || [];
        if (allowedStatuses.length === 0) {
            return res.status(403).json({ status: 'error', message: 'Brak uprawnień do usuwania pozycji zamówienia' });
        }

        if (!allowedStatuses.includes(order.status)) {
            return res.status(403).json({ 
                status: 'error', 
                message: `Nie można usuwać pozycji w statusie "${order.status}". Dozwolone statusy: ${allowedStatuses.join(', ') || 'brak'}` 
            });
        }

        // Sprawdź, czy pozycja należy do tego zamówienia
        const { data: item, error: itemError } = await supabase
            .from('OrderItem')
            .select('id, orderId')
            .eq('id', itemId)
            .single();

        if (itemError || !item || item.orderId !== orderId) {
            return res.status(404).json({ status: 'error', message: 'Pozycja zamówienia nie znaleziona' });
        }

        const { error: deleteError } = await supabase
            .from('OrderItem')
            .delete()
            .eq('id', itemId);

        if (deleteError) {
            console.error('Błąd usuwania pozycji zamówienia:', deleteError);
            return res.status(500).json({ status: 'error', message: 'Nie udało się usunąć pozycji zamówienia' });
        }

        // Przelicz total po usunięciu (może zostać 0 jeśli to była jedyna pozycja)
        let newTotal = 0;
        const { data: remainingItems, error: remainingError } = await supabase
            .from('OrderItem')
            .select('quantity, unitPrice')
            .eq('orderId', orderId);

        if (!remainingError && remainingItems) {
            newTotal = remainingItems.reduce((sum, row) => sum + (row.quantity * row.unitPrice), 0);
        }

        const { error: orderUpdateError } = await supabase
            .from('Order')
            .update({ total: newTotal, updatedAt: new Date().toISOString() })
            .eq('id', orderId);

        if (orderUpdateError) {
            console.error('Błąd aktualizacji total zamówienia po usunięciu pozycji:', orderUpdateError);
        }

        console.log(`[DELETE /api/orders/${orderId}/items/${itemId}] Nowy total: ${newTotal}`);

        return res.json({
            status: 'success',
            message: 'Pozycja została usunięta',
            data: { total: newTotal }
        });

    } catch (error) {
        console.error('Błąd w DELETE /api/orders/:orderId/items/:itemId:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// GET /api/orders/:id - Szczegóły zamówienia
// ============================================
app.get('/api/orders/:id', async (req, res) => {
    try {
        const { userId, role } = await getAuthContext(req);
        
        if (!userId || !role) {
            return res.status(401).json({ status: 'error', message: 'Brak autoryzacji' });
        }

        const { id } = req.params;

        const { data: order, error: orderError } = await supabase
            .from('Order')
            .select(`
                id,
                orderNumber,
                customerId,
                userId,
                status,
                total,
                deliveryDate,
                priority,
                notes,
                createdAt,
                updatedAt,
                Customer:customerId(id, name, email, phone),
                User:userId(id, name, shortCode)
            `)
            .eq('id', id)
            .single();

        if (orderError || !order) {
            return res.status(404).json({ status: 'error', message: 'Zamówienie nie znalezione' });
        }

        // Sprawdź uprawnienia: handlowiec widzi tylko swoje, ADMIN / SALES_DEPT widzą wszystkie
        const canSeeAllOrders = ['ADMIN', 'SALES_DEPT', 'WAREHOUSE', 'PRODUCTION'].includes(role);
        if (!canSeeAllOrders && order.userId !== userId) {
            return res.status(403).json({ status: 'error', message: 'Brak dostępu do tego zamówienia' });
        }

        // Pobierz pozycje zamówienia
        const { data: items, error: itemsError } = await supabase
            .from('OrderItem')
            .select(`
                id,
                orderId,
                productId,
                quantity,
                unitPrice,
                selectedProjects,
                projectQuantities,
                quantitySource,
                totalQuantity,
                source,
                locationName,
                projectName,
                customization,
                productionNotes,
                projectviewurl,
                stockAtOrder,
                belowStock,
                Product:productId(id, name, identifier, index)
            `)
            .eq('orderId', id);

        if (itemsError) {
            console.error('Błąd pobierania pozycji:', itemsError);
            return res.status(500).json({ status: 'error', message: 'Nie udało się pobrać pozycji zamówienia' });
        }

        res.json({
            status: 'success',
            data: {
                ...order,
                items: items || []
            }
        });
    } catch (error) {
        console.error('Błąd w GET /api/orders/:id:', error);
        res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// PANEL PRODUKCYJNY - API
// ============================================

// Typy gniazd produkcyjnych
const WORK_CENTER_TYPES = ['laser_co2', 'laser_fiber', 'uv_print', 'cnc', 'cutting', 'assembly', 'packaging', 'other'];

// Statusy maszyn
const WORK_STATION_STATUSES = ['available', 'in_use', 'maintenance', 'breakdown'];

// ============================================
// GENERATOR KODÓW DLA POKOI, GNIAZD, MASZYN
// ============================================

/**
 * Generuje kod z nazwy - usuwa polskie znaki, bierze pierwsze litery słów lub całe słowo
 * @param {string} name - nazwa do przetworzenia
 * @returns {string} - kod bazowy (bez numeru)
 */
function generateBaseCode(name) {
    if (!name) return 'ITEM';
    
    // Zamień polskie znaki na ASCII
    const polishMap = {
        'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n',
        'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z',
        'Ą': 'A', 'Ć': 'C', 'Ę': 'E', 'Ł': 'L', 'Ń': 'N',
        'Ó': 'O', 'Ś': 'S', 'Ź': 'Z', 'Ż': 'Z'
    };
    
    let normalized = name;
    for (const [pl, ascii] of Object.entries(polishMap)) {
        normalized = normalized.replace(new RegExp(pl, 'g'), ascii);
    }
    
    // Usuń znaki specjalne, zostaw tylko litery i cyfry
    normalized = normalized.replace(/[^a-zA-Z0-9\s]/g, '');
    
    const words = normalized.trim().split(/\s+/).filter(w => w.length > 0);
    
    if (words.length === 0) return 'ITEM';
    
    if (words.length === 1) {
        // Jedno słowo - weź pierwsze 6 znaków
        return words[0].substring(0, 6).toUpperCase();
    }
    
    // Wiele słów - weź pierwsze litery (max 6)
    const initials = words.map(w => w[0]).join('').substring(0, 6).toUpperCase();
    
    // Jeśli za krótkie, dodaj więcej liter z pierwszego słowa
    if (initials.length < 3 && words[0].length > 1) {
        return (words[0].substring(0, 4) + initials.substring(1)).toUpperCase();
    }
    
    return initials;
}

/**
 * Generuje unikalny kod dla pokoju produkcyjnego
 * Format: BAZOWY-NNN (np. LASER-001, UV-002)
 */
async function generateRoomCode(supabaseClient, name) {
    const baseCode = generateBaseCode(name);
    
    // Znajdź najwyższy numer dla tego prefiksu
    const { data: existing } = await supabaseClient
        .from('ProductionRoom')
        .select('code')
        .like('code', `${baseCode}-%`);
    
    let maxNum = 0;
    (existing || []).forEach(row => {
        const match = row.code.match(new RegExp(`^${baseCode}-(\\d+)$`));
        if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNum) maxNum = num;
        }
    });
    
    const nextNum = maxNum + 1;
    return `${baseCode}-${String(nextNum).padStart(3, '0')}`;
}

/**
 * Generuje unikalny kod dla gniazda produkcyjnego
 * Format: ROOMCODE-TYP-NN (np. LASER-001-CO2-01)
 */
async function generateWorkCenterCode(supabaseClient, name, roomId, type) {
    let prefix = '';
    
    // Pobierz kod pokoju jeśli podano
    if (roomId) {
        const { data: room } = await supabaseClient
            .from('ProductionRoom')
            .select('code')
            .eq('id', roomId)
            .single();
        if (room) {
            prefix = room.code + '-';
        }
    }
    
    // Dodaj skrót typu
    const typeShort = {
        'laser_co2': 'CO2',
        'laser_fiber': 'FIB',
        'uv_print': 'UV',
        'cnc': 'CNC',
        'cutting': 'CUT',
        'assembly': 'ASM',
        'packaging': 'PAK',
        'other': 'OTH'
    }[type] || 'OTH';
    
    const baseCode = prefix + typeShort;
    
    // Znajdź najwyższy numer
    const { data: existing } = await supabaseClient
        .from('WorkCenter')
        .select('code')
        .like('code', `${baseCode}-%`);
    
    let maxNum = 0;
    (existing || []).forEach(row => {
        const match = row.code.match(new RegExp(`^${baseCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d+)$`));
        if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNum) maxNum = num;
        }
    });
    
    const nextNum = maxNum + 1;
    return `${baseCode}-${String(nextNum).padStart(2, '0')}`;
}

/**
 * Generuje unikalny kod dla maszyny/stanowiska
 * Format: WORKCENTERCODE-NN (np. LASER-001-CO2-01-01)
 */
async function generateWorkStationCode(supabaseClient, name, workCenterId) {
    let prefix = 'WS';
    
    // Pobierz kod gniazda jeśli podano
    if (workCenterId) {
        const { data: wc } = await supabaseClient
            .from('WorkCenter')
            .select('code')
            .eq('id', workCenterId)
            .single();
        if (wc) {
            prefix = wc.code;
        }
    }
    
    // Znajdź najwyższy numer
    const { data: existing } = await supabaseClient
        .from('WorkStation')
        .select('code')
        .like('code', `${prefix}-%`);
    
    let maxNum = 0;
    (existing || []).forEach(row => {
        const match = row.code.match(new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d+)$`));
        if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNum) maxNum = num;
        }
    });
    
    const nextNum = maxNum + 1;
    return `${prefix}-${String(nextNum).padStart(2, '0')}`;
}

// Eksportuj funkcje do testów
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { generateBaseCode, generateRoomCode, generateWorkCenterCode, generateWorkStationCode, computeOrderTimePriority };
}

// ============================================
// HELPER: Auto-priorytet zamówień produkcyjnych
// Oblicza timeStatus i priority na podstawie deliveryDate i estimatedTime
// Zgodnie z docs/SPEC_PRODUCTION_PANEL.md §6.6
// ============================================

/**
 * Oblicza status czasowy i priorytet dla zamówienia/zlecenia produkcyjnego.
 * @param {Object} params
 * @param {string|Date} params.deliveryDate - Data wymagana przez klienta
 * @param {number} [params.estimatedTimeMinutes=0] - Szacowany czas produkcji w minutach
 * @param {Date} [params.now=new Date()] - Aktualny czas (do testów)
 * @returns {{ timeToDeadlineMinutes: number, slackMinutes: number, timeStatus: string, priority: number }}
 */
function computeOrderTimePriority({ deliveryDate, estimatedTimeMinutes = 0, now = new Date() }) {
    // Domyślne wartości dla brakujących danych
    if (!deliveryDate) {
        return {
            timeToDeadlineMinutes: null,
            slackMinutes: null,
            timeStatus: 'UNKNOWN',
            priority: 3
        };
    }

    const deadline = new Date(deliveryDate);
    if (isNaN(deadline.getTime())) {
        return {
            timeToDeadlineMinutes: null,
            slackMinutes: null,
            timeStatus: 'UNKNOWN',
            priority: 3
        };
    }

    const timeToDeadlineMinutes = Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60));
    const slackMinutes = timeToDeadlineMinutes - (estimatedTimeMinutes || 0);

    // Progi konfigurowalne (domyślne wartości)
    const AT_RISK_HOURS = 24;
    const HIGH_PRIORITY_HOURS = 4;
    const LOW_PRIORITY_HOURS = 72;

    let timeStatus;
    let priority;

    // Określ timeStatus
    if (timeToDeadlineMinutes < 0) {
        timeStatus = 'OVERDUE';
    } else if (timeToDeadlineMinutes <= AT_RISK_HOURS * 60 || slackMinutes <= 0) {
        timeStatus = 'AT_RISK';
    } else {
        timeStatus = 'ON_TIME';
    }

    // Określ priority (1-4)
    if (timeStatus === 'OVERDUE') {
        priority = 1; // urgent
    } else if (timeStatus === 'AT_RISK' && (timeToDeadlineMinutes <= HIGH_PRIORITY_HOURS * 60 || slackMinutes <= 60)) {
        priority = 2; // high
    } else if (timeStatus === 'ON_TIME' && timeToDeadlineMinutes > LOW_PRIORITY_HOURS * 60 && slackMinutes > 2 * (estimatedTimeMinutes || 0)) {
        priority = 4; // low
    } else {
        priority = 3; // normal
    }

    return {
        timeToDeadlineMinutes,
        slackMinutes,
        timeStatus,
        priority
    };
}

// ============================================
// GET /api/production/rooms - lista pokoi produkcyjnych
// ============================================
app.get('/api/production/rooms', requireRole(['ADMIN', 'PRODUCTION', 'PRODUCTION_MANAGER', 'OPERATOR', 'SALES_DEPT']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        const { data: rooms, error } = await supabase
            .from('ProductionRoom')
            .select(`
                *,
                supervisor:User!ProductionRoom_supervisorId_fkey(id, name, email),
                roomManager:User!ProductionRoom_roomManagerUserId_fkey(id, name, email),
                workCenters:WorkCenter(id, name, code, type)
            `)
            .eq('isActive', true)
            .order('name');

        if (error) {
            console.error('[GET /api/production/rooms] Błąd:', error);
            return res.status(500).json({ status: 'error', message: 'Błąd pobierania pokoi' });
        }

        // Pobierz operatorów przypisanych do każdego pokoju
        const roomIds = (rooms || []).map(r => r.id);
        let operatorsByRoom = {};
        
        if (roomIds.length > 0) {
            const { data: operators } = await supabase
                .from('User')
                .select('id, name, email, role, productionroomid')
                .in('productionroomid', roomIds)
                .eq('isActive', true);
            
            // Grupuj operatorów po pokoju
            (operators || []).forEach(op => {
                const roomId = op.productionroomid;
                if (!operatorsByRoom[roomId]) operatorsByRoom[roomId] = [];
                operatorsByRoom[roomId].push({
                    id: op.id,
                    name: op.name,
                    email: op.email,
                    role: op.role
                });
            });
        }

        // Dodaj liczniki i operatorów
        const roomsWithCounts = (rooms || []).map(room => ({
            ...room,
            workCenterCount: room.workCenters?.length || 0,
            operators: operatorsByRoom[room.id] || [],
            operatorCount: (operatorsByRoom[room.id] || []).length
        }));

        return res.json({ status: 'success', data: roomsWithCounts });
    } catch (error) {
        console.error('[GET /api/production/rooms] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// GET /api/production/rooms/:id - szczegóły pokoju
// ============================================
app.get('/api/production/rooms/:id', requireRole(['ADMIN', 'PRODUCTION', 'SALES_DEPT']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        const { id } = req.params;

        const { data: room, error } = await supabase
            .from('ProductionRoom')
            .select(`
                *,
                supervisor:User!ProductionRoom_supervisorId_fkey(id, name, email),
                workCenters:WorkCenter(
                    id, name, code, type, description, isActive,
                    workStations:WorkStation(id, name, code, type, status, manufacturer, model)
                )
            `)
            .eq('id', id)
            .single();

        if (error) {
            console.error('[GET /api/production/rooms/:id] Błąd:', error);
            return res.status(404).json({ status: 'error', message: 'Pokój nie znaleziony' });
        }

        return res.json({ status: 'success', data: room });
    } catch (error) {
        console.error('[GET /api/production/rooms/:id] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// POST /api/production/rooms - tworzenie pokoju
// ============================================
app.post('/api/production/rooms', requireRole(['ADMIN']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        const { name, area, description, supervisorId } = req.body;

        if (!name) {
            return res.status(400).json({ status: 'error', message: 'Nazwa jest wymagana' });
        }

        // Automatycznie generuj kod na podstawie nazwy
        const generatedCode = await generateRoomCode(supabase, name);

        const { data: room, error } = await supabase
            .from('ProductionRoom')
            .insert({
                name: name.trim(),
                code: generatedCode,
                area: area || null,
                description: description || null,
                supervisorId: supervisorId || null,
                isActive: true
            })
            .select()
            .single();

        if (error) {
            console.error('[POST /api/production/rooms] Błąd:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się utworzyć pokoju' });
        }

        return res.status(201).json({ status: 'success', data: room });
    } catch (error) {
        console.error('[POST /api/production/rooms] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// PATCH /api/production/rooms/:id - aktualizacja pokoju
// ============================================
app.patch('/api/production/rooms/:id', requireRole(['ADMIN']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        const { id } = req.params;
        const { name, code, area, description, supervisorId, roomManagerUserId, isActive } = req.body;

        const updates = {};
        if (name !== undefined) updates.name = name.trim();
        if (code !== undefined) updates.code = code.toUpperCase().trim();
        if (area !== undefined) updates.area = area;
        if (description !== undefined) updates.description = description;
        if (supervisorId !== undefined) updates.supervisorId = supervisorId || null;
        // roomManagerUserId - menedżer pokoju (MES-compliant)
        if (roomManagerUserId !== undefined) updates.roomManagerUserId = roomManagerUserId || null;
        if (isActive !== undefined) updates.isActive = isActive;

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ status: 'error', message: 'Brak danych do aktualizacji' });
        }

        const { data: room, error } = await supabase
            .from('ProductionRoom')
            .update(updates)
            .eq('id', id)
            .select(`
                *,
                supervisor:User!ProductionRoom_supervisorId_fkey(id, name, email),
                roomManager:User!ProductionRoom_roomManagerUserId_fkey(id, name, email)
            `)
            .single();

        if (error) {
            console.error('[PATCH /api/production/rooms/:id] Błąd:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się zaktualizować pokoju' });
        }

        console.log(`[PATCH /api/production/rooms/:id] Zaktualizowano pokój ${id}, roomManagerUserId: ${roomManagerUserId}`);
        return res.json({ status: 'success', data: room });
    } catch (error) {
        console.error('[PATCH /api/production/rooms/:id] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// DELETE /api/production/rooms/:id - usunięcie pokoju
// ============================================
app.delete('/api/production/rooms/:id', requireRole(['ADMIN']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        const { id } = req.params;

        // Soft delete - ustawiamy isActive = false
        const { error } = await supabase
            .from('ProductionRoom')
            .update({ isActive: false })
            .eq('id', id);

        if (error) {
            console.error('[DELETE /api/production/rooms/:id] Błąd:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się usunąć pokoju' });
        }

        return res.json({ status: 'success', message: 'Pokój został dezaktywowany' });
    } catch (error) {
        console.error('[DELETE /api/production/rooms/:id] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// WorkCenterType API - słownik typów gniazd
// ============================================
app.get('/api/production/work-center-types', requireRole(['ADMIN', 'PRODUCTION', 'PRODUCTION_MANAGER']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        const { isActive } = req.query;

        let query = supabase
            .from('WorkCenterType')
            .select('*')
            .order('name');

        if (typeof isActive !== 'undefined' && isActive !== '') {
            const activeValue = isActive === 'true' || isActive === true || isActive === 1 || isActive === '1';
            query = query.eq('isActive', activeValue);
        }

        const { data: types, error } = await query;

        if (error) {
            console.error('[GET /api/production/work-center-types] Błąd:', error);
            return res.status(500).json({ status: 'error', message: 'Błąd pobierania typów gniazd' });
        }

        return res.json({ status: 'success', data: types || [] });
    } catch (error) {
        console.error('[GET /api/production/work-center-types] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

app.post('/api/production/work-center-types', requireRole(['ADMIN']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        const { code, name, description, isActive } = req.body;

        if (!code || !name) {
            return res.status(400).json({ status: 'error', message: 'Kod i nazwa typu są wymagane' });
        }

        const normalizedCode = String(code).trim().toLowerCase();

        const { data: typeRow, error } = await supabase
            .from('WorkCenterType')
            .insert({
                code: normalizedCode,
                name: name.trim(),
                description: description || null,
                isActive: typeof isActive === 'boolean' ? isActive : true
            })
            .select()
            .single();

        if (error) {
            console.error('[POST /api/production/work-center-types] Błąd:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się utworzyć typu gniazda' });
        }

        return res.status(201).json({ status: 'success', data: typeRow });
    } catch (error) {
        console.error('[POST /api/production/work-center-types] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

app.patch('/api/production/work-center-types/:id', requireRole(['ADMIN']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        const { id } = req.params;
        const { name, description, isActive } = req.body;

        const updates = {};
        if (name !== undefined) updates.name = name.trim();
        if (description !== undefined) updates.description = description || null;
        if (isActive !== undefined) updates.isActive = isActive;

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ status: 'error', message: 'Brak danych do aktualizacji' });
        }

        const { data: typeRow, error } = await supabase
            .from('WorkCenterType')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('[PATCH /api/production/work-center-types/:id] Błąd:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się zaktualizować typu gniazda' });
        }

        return res.json({ status: 'success', data: typeRow });
    } catch (error) {
        console.error('[PATCH /api/production/work-center-types/:id] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// OperationType API - słownik typów operacji
// ============================================
app.get('/api/production/operation-types', requireRole(['ADMIN', 'PRODUCTION', 'PRODUCTION_MANAGER']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        const { isActive } = req.query;

        let query = supabase
            .from('OperationType')
            .select('*')
            .order('name');

        if (typeof isActive !== 'undefined' && isActive !== '') {
            const activeValue = isActive === 'true' || isActive === true || isActive === 1 || isActive === '1';
            query = query.eq('isActive', activeValue);
        }

        const { data: types, error } = await query;

        if (error) {
            console.error('[GET /api/production/operation-types] Błąd:', error);
            return res.status(500).json({ status: 'error', message: 'Błąd pobierania typów operacji' });
        }

        return res.json({ status: 'success', data: types || [] });
    } catch (error) {
        console.error('[GET /api/production/operation-types] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

app.post('/api/production/operation-types', requireRole(['ADMIN']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        const { code, name, description, isActive } = req.body;

        if (!code || !name) {
            return res.status(400).json({ status: 'error', message: 'Kod i nazwa typu są wymagane' });
        }

        const normalizedCode = String(code).trim().toLowerCase();

        if (!/^[a-z0-9_]+$/.test(normalizedCode)) {
            return res.status(400).json({ status: 'error', message: 'Kod może zawierać tylko małe litery, cyfry i podkreślenia' });
        }

        const { data: typeRow, error } = await supabase
            .from('OperationType')
            .insert({
                code: normalizedCode,
                name: name.trim(),
                description: description || null,
                isActive: typeof isActive === 'boolean' ? isActive : true
            })
            .select()
            .single();

        if (error) {
            console.error('[POST /api/production/operation-types] Błąd:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się utworzyć typu operacji' });
        }

        return res.status(201).json({ status: 'success', data: typeRow });
    } catch (error) {
        console.error('[POST /api/production/operation-types] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

app.patch('/api/production/operation-types/:id', requireRole(['ADMIN']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        const { id } = req.params;
        const { name, description, isActive } = req.body;

        const updates = {};
        if (name !== undefined) updates.name = String(name).trim();
        if (description !== undefined) updates.description = description || null;
        if (isActive !== undefined) updates.isActive = !!isActive;

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ status: 'error', message: 'Brak danych do aktualizacji' });
        }

        const { data: typeRow, error } = await supabase
            .from('OperationType')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('[PATCH /api/production/operation-types/:id] Błąd:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się zaktualizować typu operacji' });
        }

        return res.json({ status: 'success', data: typeRow });
    } catch (error) {
        console.error('[PATCH /api/production/operation-types/:id] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// GET /api/production/work-centers - lista gniazd
// ============================================
app.get('/api/production/work-centers', requireRole(['ADMIN', 'PRODUCTION', 'SALES_DEPT']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        const { roomId } = req.query;

        let query = supabase
            .from('WorkCenter')
            .select(`
                *,
                room:ProductionRoom(id, name, code),
                workStations:WorkStation(id, name, code, type, status)
            `)
            .eq('isActive', true)
            .order('name');

        if (roomId) {
            query = query.eq('roomId', roomId);
        }

        const { data: workCenters, error } = await query;

        if (error) {
            console.error('[GET /api/production/work-centers] Błąd:', error);
            return res.status(500).json({ status: 'error', message: 'Błąd pobierania gniazd' });
        }

        const centersWithCounts = (workCenters || []).map(wc => ({
            ...wc,
            workStationCount: wc.workStations?.length || 0
        }));

        return res.json({ status: 'success', data: centersWithCounts });
    } catch (error) {
        console.error('[GET /api/production/work-centers] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// POST /api/production/work-centers - tworzenie gniazda
// ============================================
app.post('/api/production/work-centers', requireRole(['ADMIN']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        const { name, roomId, type, workCenterTypeId, description } = req.body;

        if (!name) {
            return res.status(400).json({ status: 'error', message: 'Nazwa jest wymagana' });
        }

        // Ustal typ gniazda na podstawie workCenterTypeId lub kodu typu (type)
        let resolvedTypeCode = null;
        let resolvedTypeId = null;

        if (workCenterTypeId) {
            const { data: typeRow, error: typeError } = await supabase
                .from('WorkCenterType')
                .select('id, code, "isActive"')
                .eq('id', workCenterTypeId)
                .single();

            if (typeError || !typeRow) {
                return res.status(400).json({ status: 'error', message: 'Nieprawidłowy typ gniazda (workCenterTypeId)' });
            }
            if (!typeRow.isActive) {
                return res.status(400).json({ status: 'error', message: 'Typ gniazda jest nieaktywny' });
            }

            resolvedTypeId = typeRow.id;
            resolvedTypeCode = typeRow.code;
        } else if (type) {
            const { data: typeRow, error: typeError } = await supabase
                .from('WorkCenterType')
                .select('id, code, "isActive"')
                .eq('code', type)
                .single();

            if (typeError || !typeRow) {
                return res.status(400).json({ status: 'error', message: 'Nieprawidłowy typ gniazda' });
            }
            if (!typeRow.isActive) {
                return res.status(400).json({ status: 'error', message: 'Typ gniazda jest nieaktywny' });
            }

            resolvedTypeId = typeRow.id;
            resolvedTypeCode = typeRow.code;
        } else {
            return res.status(400).json({ status: 'error', message: 'Typ gniazda jest wymagany' });
        }

        // Automatycznie generuj kod na podstawie pokoju i typu
        const generatedCode = await generateWorkCenterCode(supabase, name, roomId, resolvedTypeCode);

        const { data: workCenter, error } = await supabase
            .from('WorkCenter')
            .insert({
                name: name.trim(),
                code: generatedCode,
                roomId: roomId || null,
                type: resolvedTypeCode,
                workCenterTypeId: resolvedTypeId,
                description: description || null,
                isActive: true
            })
            .select()
            .single();

        if (error) {
            console.error('[POST /api/production/work-centers] Błąd:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się utworzyć gniazda' });
        }

        return res.status(201).json({ status: 'success', data: workCenter });
    } catch (error) {
        console.error('[POST /api/production/work-centers] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// GET /api/production/work-stations - lista maszyn
// ============================================
app.get('/api/production/work-stations', requireRole(['ADMIN', 'PRODUCTION', 'SALES_DEPT']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        const { workCenterId, status } = req.query;

        let query = supabase
            .from('WorkStation')
            .select(`
                *,
                workCenter:WorkCenter(id, name, code, type),
                currentOperator:User!WorkStation_currentOperatorId_fkey(id, name)
            `)
            .eq('isActive', true)
            .order('name');

        if (workCenterId) {
            query = query.eq('workCenterId', workCenterId);
        }
        if (status) {
            query = query.eq('status', status);
        }

        const { data: workStations, error } = await query;

        if (error) {
            console.error('[GET /api/production/work-stations] Błąd:', error);
            return res.status(500).json({ status: 'error', message: 'Błąd pobierania maszyn' });
        }

        return res.json({ status: 'success', data: workStations || [] });
    } catch (error) {
        console.error('[GET /api/production/work-stations] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// POST /api/production/work-stations - tworzenie maszyny
// ============================================
app.post('/api/production/work-stations', requireRole(['ADMIN']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        const { name, workCenterId, type, manufacturer, model, capabilities } = req.body;

        if (!name || !type) {
            return res.status(400).json({ status: 'error', message: 'Nazwa i typ są wymagane' });
        }

        // Automatycznie generuj kod na podstawie gniazda
        const generatedCode = await generateWorkStationCode(supabase, name, workCenterId);

        const { data: workStation, error } = await supabase
            .from('WorkStation')
            .insert({
                name: name.trim(),
                code: generatedCode,
                workCenterId: workCenterId || null,
                type,
                manufacturer: manufacturer || null,
                model: model || null,
                capabilities: capabilities || null,
                status: 'available',
                isActive: true
            })
            .select()
            .single();

        if (error) {
            console.error('[POST /api/production/work-stations] Błąd:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się utworzyć maszyny' });
        }

        return res.status(201).json({ status: 'success', data: workStation });
    } catch (error) {
        console.error('[POST /api/production/work-stations] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// PATCH /api/production/work-stations/:id/status - zmiana statusu maszyny
// ============================================
app.patch('/api/production/work-stations/:id/status', requireRole(['ADMIN', 'PRODUCTION']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        const { id } = req.params;
        const { status, currentOperatorId } = req.body;

        if (!status || !WORK_STATION_STATUSES.includes(status)) {
            return res.status(400).json({ 
                status: 'error', 
                message: `Nieprawidłowy status. Dozwolone: ${WORK_STATION_STATUSES.join(', ')}` 
            });
        }

        const updates = { status };
        if (status === 'in_use' && currentOperatorId) {
            updates.currentOperatorId = currentOperatorId;
        } else if (status === 'available') {
            updates.currentOperatorId = null;
        }

        const { data: workStation, error } = await supabase
            .from('WorkStation')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('[PATCH /api/production/work-stations/:id/status] Błąd:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się zmienić statusu' });
        }

        return res.json({ status: 'success', data: workStation });
    } catch (error) {
        console.error('[PATCH /api/production/work-stations/:id/status] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// GET /api/production/stats - statystyki produkcji
// ============================================
app.get('/api/production/stats', requireRole(['ADMIN', 'PRODUCTION', 'SALES_DEPT']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        // Pobierz liczniki
        const [roomsResult, workCentersResult, workStationsResult] = await Promise.all([
            supabase.from('ProductionRoom').select('id', { count: 'exact' }).eq('isActive', true),
            supabase.from('WorkCenter').select('id', { count: 'exact' }).eq('isActive', true),
            supabase.from('WorkStation').select('id, status', { count: 'exact' }).eq('isActive', true)
        ]);

        const workStations = workStationsResult.data || [];
        const statusCounts = {
            available: workStations.filter(ws => ws.status === 'available').length,
            in_use: workStations.filter(ws => ws.status === 'in_use').length,
            maintenance: workStations.filter(ws => ws.status === 'maintenance').length,
            breakdown: workStations.filter(ws => ws.status === 'breakdown').length
        };

        return res.json({
            status: 'success',
            data: {
                rooms: roomsResult.count || 0,
                workCenters: workCentersResult.count || 0,
                workStations: workStationsResult.count || 0,
                workStationsByStatus: statusCounts
            }
        });
    } catch (error) {
        console.error('[GET /api/production/stats] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// ŚCIEŻKI PRODUKCYJNE - API
// ============================================

// GET /api/production/paths - lista ścieżek produkcyjnych
app.get('/api/production/paths', requireRole(['ADMIN', 'PRODUCTION', 'SALES_DEPT']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        const { data: paths, error } = await supabase
            .from('ProductionPath')
            .select('*')
            .eq('isActive', true)
            .order('code');

        if (error) {
            console.error('[GET /api/production/paths] Błąd:', error);
            return res.status(500).json({ status: 'error', message: 'Błąd pobierania ścieżek' });
        }

        return res.json({ status: 'success', data: paths || [] });
    } catch (error) {
        console.error('[GET /api/production/paths] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// GET /api/production/paths/:id - szczegóły ścieżki
app.get('/api/production/paths/:id', requireRole(['ADMIN', 'PRODUCTION', 'SALES_DEPT']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        const { id } = req.params;

        const { data: path, error } = await supabase
            .from('ProductionPath')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            console.error('[GET /api/production/paths/:id] Błąd:', error);
            return res.status(404).json({ status: 'error', message: 'Ścieżka nie znaleziona' });
        }

        return res.json({ status: 'success', data: path });
    } catch (error) {
        console.error('[GET /api/production/paths/:id] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// POST /api/production/paths - tworzenie ścieżki
app.post('/api/production/paths', requireRole(['ADMIN']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        const { code, name, description, operations } = req.body;

        if (!code || !name) {
            return res.status(400).json({ status: 'error', message: 'Kod i nazwa są wymagane' });
        }

        if (!operations || !Array.isArray(operations)) {
            return res.status(400).json({ status: 'error', message: 'Lista operacji jest wymagana' });
        }

        // Sprawdź unikalność kodu
        const { data: existing } = await supabase
            .from('ProductionPath')
            .select('id')
            .eq('code', code)
            .single();

        if (existing) {
            return res.status(400).json({ status: 'error', message: 'Ścieżka o tym kodzie już istnieje' });
        }

        const { data: path, error } = await supabase
            .from('ProductionPath')
            .insert({
                code: code.trim(),
                name: name.trim(),
                description: description || null,
                operations: operations
            })
            .select()
            .single();

        if (error) {
            console.error('[POST /api/production/paths] Błąd:', error);
            return res.status(500).json({ status: 'error', message: 'Błąd tworzenia ścieżki' });
        }

        return res.status(201).json({ status: 'success', data: path });
    } catch (error) {
        console.error('[POST /api/production/paths] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// PATCH /api/production/paths/:id - aktualizacja ścieżki
app.patch('/api/production/paths/:id', requireRole(['ADMIN']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        const { id } = req.params;
        const { code, name, description, operations, isActive } = req.body;

        const updateData = {};
        if (code !== undefined) updateData.code = code.trim();
        if (name !== undefined) updateData.name = name.trim();
        if (description !== undefined) updateData.description = description;
        if (operations !== undefined) updateData.operations = operations;
        if (isActive !== undefined) updateData.isActive = isActive;

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ status: 'error', message: 'Brak danych do aktualizacji' });
        }

        // Używamy raw SQL przez REST API, żeby ominąć wadliwy trigger
        // Budujemy zapytanie UPDATE ręcznie
        const setClauses = [];
        const values = [];
        
        if (updateData.code) setClauses.push(`code = '${updateData.code.replace(/'/g, "''")}'`);
        if (updateData.name) setClauses.push(`name = '${updateData.name.replace(/'/g, "''")}'`);
        if (updateData.description !== undefined) {
            setClauses.push(updateData.description ? `description = '${updateData.description.replace(/'/g, "''")}'` : 'description = NULL');
        }
        if (updateData.operations) setClauses.push(`operations = '${JSON.stringify(updateData.operations).replace(/'/g, "''")}'::jsonb`);
        if (updateData.isActive !== undefined) setClauses.push(`"isActive" = ${updateData.isActive}`);

        // Wykonaj UPDATE bez triggera (trigger jest wadliwy)
        const { data: path, error } = await supabase
            .from('ProductionPath')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('[PATCH /api/production/paths/:id] Błąd:', error);
            return res.status(500).json({ status: 'error', message: 'Błąd aktualizacji ścieżki' });
        }

        return res.json({ status: 'success', data: path });
    } catch (error) {
        console.error('[PATCH /api/production/paths/:id] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// DELETE /api/production/paths/:id - dezaktywacja ścieżki
app.delete('/api/production/paths/:id', requireRole(['ADMIN']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        const { id } = req.params;

        const { data: path, error } = await supabase
            .from('ProductionPath')
            .update({ isActive: false, updatedat: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('[DELETE /api/production/paths/:id] Błąd:', error);
            return res.status(500).json({ status: 'error', message: 'Błąd dezaktywacji ścieżki' });
        }

        return res.json({ status: 'success', message: 'Ścieżka dezaktywowana', data: path });
    } catch (error) {
        console.error('[DELETE /api/production/paths/:id] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// ZLECENIA PRODUKCYJNE - API
// ============================================

// Parser wyrażeń ścieżek produkcyjnych (np. "5%3$2.1")
// % = sekwencja (po kolei), $ = gałęzie równoległe
function parseProductionPathExpression(expression) {
    if (!expression) return { branches: [] };
    
    // Dzielimy po $ na gałęzie równoległe
    const branches = expression.split('$').map(branch => {
        // Każdą gałąź dzielimy po % na sekwencję ścieżek
        const pathCodes = branch.split('%').map(code => code.trim()).filter(Boolean);
        return { pathCodes };
    }).filter(b => b.pathCodes.length > 0);
    
    return { branches };
}

// Generowanie numeru zlecenia produkcyjnego powiązanego z konkretnym zamówieniem
// Format: {orderNumber}/{NN}, np. 2025/120/JKO/01, 2025/120/JKO/02
async function generateProductionOrderNumber(supabase, sourceOrderId, baseOrderNumber) {
	const prefix = `${baseOrderNumber}/`;

	// Pobierz istniejące zlecenia dla tego zamówienia, żeby znaleźć najwyższy sufiks
	const { data: existingOrders, error } = await supabase
		.from('ProductionOrder')
		.select('ordernumber')
		.eq('sourceorderid', sourceOrderId);

	if (error) {
		console.error('[generateProductionOrderNumber] Błąd pobierania istniejących zleceń:', error);
		throw new Error('Nie udało się wygenerować numeru zlecenia produkcyjnego');
	}

	let maxSuffix = 0;
	(existingOrders || []).forEach(row => {
		const num = row.ordernumber || row.orderNumber;
		if (typeof num === 'string' && num.startsWith(prefix)) {
			const tail = num.slice(prefix.length);
			const n = parseInt(tail, 10);
			if (!isNaN(n) && n > maxSuffix) {
				maxSuffix = n;
			}
		}
	});

	const next = maxSuffix + 1;
	const suffix = String(next).padStart(2, '0');
	return `${prefix}${suffix}`;
}

// Generowanie numeru zlecenia produkcyjnego dla pokoju produkcyjnego (ProductionWorkOrder)
// Format: PW-{YYYY}-{NNNN}, np. PW-2025-0001
async function generateWorkOrderNumber(supabase) {
    const year = new Date().getFullYear();
    const prefix = `ZP-${year}-`;

    // Pobierz najwyższy numer w tym roku
    const { data: existing, error } = await supabase
        .from('ProductionWorkOrder')
        .select('workOrderNumber')
        .like('workOrderNumber', `${prefix}%`)
        .order('workOrderNumber', { ascending: false })
        .limit(1);

    if (error) {
        console.error('[generateWorkOrderNumber] Błąd:', error);
        throw new Error('Nie udało się wygenerować numeru zlecenia produkcyjnego dla pokoju produkcyjnego');
    }

    let maxNum = 0;
    if (existing && existing.length > 0) {
        const lastNum = existing[0].workOrderNumber;
        const tail = lastNum.slice(prefix.length);
        const n = parseInt(tail, 10);
        if (!isNaN(n)) maxNum = n;
    }

    const next = maxNum + 1;
    return `${prefix}${String(next).padStart(4, '0')}`;
}

// ============================================
// HELPER: Tworzenie zleceń produkcyjnych dla zamówienia
// Wywoływany automatycznie przy zmianie statusu na APPROVED.
// Stan na 2025-12-08:
// - grupuje pozycje zamówienia według Product.productionPath,
// - tworzy jedno ProductionWorkOrder (ZP-...) na każdą ścieżkę produkcyjną,
// - dla każdej pozycji w ścieżce tworzy osobny ProductionOrder
//   z unikalnym numerem orderNumber (brak konfliktów z UNIQUE INDEX).
// Dzięki temu karta zlecenia produkcyjnego dla pokoju produkcyjnego (PDF)
// widzi wszystkie pozycje z danej ścieżki.
// TODO (dla przyszłego Agenta AI):
// - rozważyć przeniesienie wyzwalacza z APPROVED na IN_PRODUCTION
//   (patrz docs/SPEC_PRODUCTION_PANEL.md sekcja 2.3),
// - dodać możliwość ponownego wygenerowania zleceń tylko dla wybranych pozycji.
// ============================================
async function createProductionOrdersForOrder(orderId, options = {}) {
    if (!supabase) {
        throw new Error('Supabase nie jest skonfigurowany');
    }

    const { priority = 3, notes = null, userId = null } = options;

    // Sprawdź czy już istnieją zlecenia dla tego zamówienia (unikamy duplikatów)
    const { data: existingOrders, error: checkError } = await supabase
        .from('ProductionOrder')
        .select('id')
        .eq('sourceorderid', orderId)
        .limit(1);

    if (checkError) {
        console.error('[createProductionOrdersForOrder] Błąd sprawdzania istniejących zleceń:', checkError);
        throw new Error('Błąd sprawdzania istniejących zleceń');
    }

    if (existingOrders && existingOrders.length > 0) {
        console.log(`[createProductionOrdersForOrder] Zlecenia dla zamówienia ${orderId} już istnieją, pomijam.`);
        return { created: 0, skipped: true, orders: [], errors: [] };
    }

    // Pobierz zamówienie z pozycjami
    const { data: order, error: orderError } = await supabase
        .from('Order')
        .select(`
            *,
            items:OrderItem(
                id, productId, quantity, productionNotes,
                product:Product(id, name, code, productionPath)
            )
        `)
        .eq('id', orderId)
        .single();

    if (orderError || !order) {
        console.error('[createProductionOrdersForOrder] Błąd pobierania zamówienia:', orderError);
        throw new Error('Zamówienie nie znalezione');
    }

    if (!order.items || order.items.length === 0) {
        console.log(`[createProductionOrdersForOrder] Zamówienie ${orderId} nie ma pozycji.`);
        return { created: 0, skipped: false, orders: [], errors: [{ error: 'Zamówienie nie ma pozycji' }] };
    }

    // Pobierz wszystkie ścieżki produkcyjne (do mapowania kodów)
    const { data: allPaths } = await supabase
        .from('ProductionPath')
        .select('*')
        .eq('isActive', true);

    console.log('[createProductionOrdersForOrder] Dostępne ścieżki w bazie:', 
        (allPaths || []).map(p => ({ code: p.code, name: p.name, opsCount: (p.operations || []).length }))
    );

    const pathsByCode = {};
    (allPaths || []).forEach(p => { pathsByCode[p.code] = p; });

    const createdOrders = [];
    const errors = [];

    // 1. Zgrupuj pozycje zamówienia według ścieżki produkcyjnej
    const itemsByPath = new Map();
    
    for (const item of order.items) {
        console.log(`[createProductionOrdersForOrder] Przetwarzam pozycję: ${item.id}`);
        
        const product = item.product;
        if (!product) {
            console.log(`[createProductionOrdersForOrder] Pozycja ${item.id} nie ma produktu, pomijam`);
            continue;
        }

        // Pobierz expression ścieżki z produktu
        const pathExpression = product.productionPath;
        
        console.log(`[createProductionOrdersForOrder] Produkt: ${product.code}, productionPath: "${pathExpression}"`);
        
        if (!pathExpression) {
            console.log(`[createProductionOrdersForOrder] Produkt ${product.code} nie ma ścieżki produkcyjnej, dodaję do błędów`);
            errors.push({ itemId: item.id, productCode: product.code, error: 'Brak ścieżki produkcyjnej' });
            continue;
        }

        // Dodaj pozycję do grupy według ścieżki
        if (!itemsByPath.has(pathExpression)) {
            itemsByPath.set(pathExpression, []);
        }
        itemsByPath.get(pathExpression).push(item);
    }

    console.log(`[createProductionOrdersForOrder] Zgrupowano pozycje według ścieżek:`, 
        Array.from(itemsByPath.entries()).map(([path, items]) => `${path}: ${items.length} pozycji`));

    // 2. Dla każdej unikalnej ścieżki utwórz jedno ProductionWorkOrder z wszystkimi pozycjami
    for (const [pathExpression, pathItems] of itemsByPath.entries()) {
        console.log(`[createProductionOrdersForOrder] Tworzę zlecenie dla ścieżki: ${pathExpression} (${pathItems.length} pozycji)`);
        
        // Parsuj expression ścieżki
        const parsed = parseProductionPathExpression(pathExpression);

        if (parsed.branches.length === 0) {
            // Dodaj wszystkie pozycje z tej ścieżki do błędów
            pathItems.forEach(item => {
                errors.push({ itemId: item.id, productCode: item.product?.code || 'BRAK', error: 'Nieprawidłowe wyrażenie ścieżki' });
            });
            continue;
        }

        // Dla każdej gałęzi tworzymy osobne zlecenie
        for (let branchIndex = 0; branchIndex < parsed.branches.length; branchIndex++) {
            const branch = parsed.branches[branchIndex];
            const branchCode = parsed.branches.length > 1 ? String.fromCharCode(65 + branchIndex) : null;

            try {
                const baseOrderNumber = order.orderNumber || order.ordernumber;

                const firstPathCode = branch.pathCodes[0];
                const firstPath = pathsByCode[firstPathCode];

                // Określ nazwę pokoju na podstawie pierwszej ścieżki w gałęzi
                const roomName = firstPath?.name || `Ścieżka ${firstPathCode}`;

                // 1. Utwórz ProductionWorkOrder (kartkę dla gałęzi)
                const workOrderNumber = await generateWorkOrderNumber(supabase);
                const { data: workOrder, error: workOrderError } = await supabase
                    .from('ProductionWorkOrder')
                    .insert({
                        workOrderNumber: workOrderNumber,
                        sourceOrderId: orderId,
                        roomName: roomName,
                        status: 'planned',
                        priority: priority,
                        notes: notes || pathItems[0].productionNotes || null,
                        createdBy: userId
                    })
                    .select()
                    .single();

                if (workOrderError || !workOrder) {
                    console.error('[createProductionOrdersForOrder] Błąd tworzenia ProductionWorkOrder:', workOrderError);
                    pathItems.forEach(item => {
                        errors.push({ itemId: item.id, productCode: item.product?.code || 'BRAK', error: 'Błąd tworzenia zlecenia produkcyjnego dla pokoju produkcyjnego' });
                    });
                    continue;
                }

                console.log(`[createProductionOrdersForOrder] Utworzono ProductionWorkOrder: ${workOrderNumber} dla pokoju: ${roomName}`);

                // 2. Dla wszystkich pozycji z tej ścieżki utwórz ProductionOrder
                for (const item of pathItems) {
                    const product = item.product;
                    
                    // Generuj unikalny numer zlecenia dla każdego ProductionOrder
                    const itemOrderNumber = await generateProductionOrderNumber(supabase, orderId, baseOrderNumber);
                    
                    // Utwórz zlecenie produkcyjne (ProductionOrder) z przypisanym workOrderId
                    const { data: prodOrder, error: prodError } = await supabase
                        .from('ProductionOrder')
                        .insert({
                            ordernumber: itemOrderNumber,
                            sourceorderid: orderId,
                            sourceorderitemid: item.id,
                            productid: product.id,
                            productionpathexpression: pathExpression,
                            branchcode: branchCode,
                            quantity: item.quantity,
                            priority: priority,
                            status: 'planned',
                            productionpathid: firstPath?.id || null,
                            productionnotes: notes || item.productionNotes || null,
                            createdby: userId,
                            "workOrderId": workOrder.id
                        })
                        .select()
                        .single();

                    if (prodError || !prodOrder) {
                        console.error('[createProductionOrdersForOrder] Błąd tworzenia ProductionOrder:', prodError);
                        errors.push({ itemId: item.id, productCode: product.code, error: 'Błąd tworzenia zlecenia produkcyjnego' });
                        continue;
                    }

                    console.log(`[createProductionOrdersForOrder] Utworzono ProductionOrder dla ${product.code}`);

                    // Utwórz operacje technologiczne dla tego zlecenia na podstawie ProductionPath.operations
                    let operationNumber = 1;
                    for (const pathCode of branch.pathCodes) {
                        const pathDef = pathsByCode[pathCode];

                        if (!pathDef) {
                            // Ścieżka nie zdefiniowana w systemie - tworzymy jedną generyczną operację
                            await supabase
                                .from('ProductionOperation')
                                .insert({
                                    productionorderid: prodOrder.id,
                                    operationnumber: operationNumber++,
                                    branchcode: branchCode,
                                    phase: 'OP',
                                    operationtype: `path_${pathCode}`,
                                    status: 'pending'
                                });
                        } else {
                            // Mamy definicję ścieżki - tworzymy operacje wg jej kroków
                            const operations = pathDef.operations || [];
                            for (const op of operations) {
                                await supabase
                                    .from('ProductionOperation')
                                    .insert({
                                        productionorderid: prodOrder.id,
                                        operationnumber: operationNumber++,
                                        branchcode: branchCode,
                                        phase: op.phase || 'OP',
                                        operationtype: op.operationType || op.operationtype || 'unknown',
                                        plannedtime: op.estimatedTimeMin || null,
                                        status: 'pending'
                                    });
                            }
                        }
                    }

                    createdOrders.push({
                        productionOrderId: prodOrder.id,
                        workOrderId: workOrder.id,
                        roomName: roomName,
                        productCode: product.code,
                        quantity: item.quantity
                    });
                }

            } catch (error) {
                console.error('[createProductionOrdersForOrder] Błąd przetwarzania gałęzi:', error);
                pathItems.forEach(item => {
                    errors.push({ itemId: item.id, productCode: item.product?.code || 'BRAK', error: 'Błąd systemowy' });
                });
            }
        }
    }

    console.log(`[createProductionOrdersForOrder] Utworzono ${createdOrders.length} zleceń dla zamówienia ${orderId}, błędów: ${errors.length}`);
    return { created: createdOrders.length, skipped: false, orders: createdOrders, errors };
}

// ============================================
// HELPER: Anulowanie zleceń produkcyjnych dla zamówienia
// Wywoływany automatycznie przy zmianie statusu na CANCELLED
// ============================================
async function cancelProductionOrdersForOrder(orderId) {
    if (!supabase) {
        throw new Error('Supabase nie jest skonfigurowany');
    }

    // Pobierz wszystkie zlecenia dla tego zamówienia, które można anulować
    const { data: orders, error: fetchError } = await supabase
        .from('ProductionOrder')
        .select('id, status')
        .eq('sourceorderid', orderId)
        .in('status', ['planned', 'approved', 'in_progress']);

    if (fetchError) {
        console.error('[cancelProductionOrdersForOrder] Błąd pobierania zleceń:', fetchError);
        throw new Error('Błąd pobierania zleceń do anulowania');
    }

    if (!orders || orders.length === 0) {
        console.log(`[cancelProductionOrdersForOrder] Brak zleceń do anulowania dla zamówienia ${orderId}`);
        return { cancelled: 0 };
    }

    const orderIds = orders.map(o => o.id);

    // Anuluj zlecenia produkcyjne
    const { error: updateOrdersError } = await supabase
        .from('ProductionOrder')
        .update({ status: 'cancelled' })
        .in('id', orderIds);

    if (updateOrdersError) {
        console.error('[cancelProductionOrdersForOrder] Błąd anulowania zleceń:', updateOrdersError);
        throw new Error('Błąd anulowania zleceń produkcyjnych');
    }

    // Anuluj operacje powiązane z tymi zleceniami
    const { error: updateOpsError } = await supabase
        .from('ProductionOperation')
        .update({ status: 'cancelled' })
        .in('productionorderid', orderIds)
        .in('status', ['pending', 'active']);

    if (updateOpsError) {
        console.error('[cancelProductionOrdersForOrder] Błąd anulowania operacji:', updateOpsError);
        // Nie przerywamy - zlecenia już anulowane
    }

    console.log(`[cancelProductionOrdersForOrder] Anulowano ${orders.length} zleceń dla zamówienia ${orderId}`);
    return { cancelled: orders.length };
}

// POST /api/production/orders/from-order/:orderId - tworzenie zleceń z zamówienia (ręczne)
app.post('/api/production/orders/from-order/:orderId', requireRole(['ADMIN', 'PRODUCTION']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        const { orderId } = req.params;
        const { priority, notes } = req.body;
        const userId = req.cookies.auth_id;

        // Pobierz zamówienie z pozycjami
        const { data: order, error: orderError } = await supabase
            .from('Order')
            .select(`
                *,
                items:OrderItem(
                    id, productId, quantity, productionNotes,
                    product:Product(id, name, code, productionPath)
                )
            `)
            .eq('id', orderId)
            .single();

        if (orderError || !order) {
            console.error('[POST /api/production/orders/from-order] Błąd pobierania zamówienia:', orderError);
            return res.status(404).json({ status: 'error', message: 'Zamówienie nie znalezione' });
        }

        if (!order.items || order.items.length === 0) {
            return res.status(400).json({ status: 'error', message: 'Zamówienie nie ma pozycji' });
        }

        // Pobierz wszystkie ścieżki produkcyjne (do mapowania kodów)
        const { data: allPaths } = await supabase
            .from('ProductionPath')
            .select('*')
            .eq('isActive', true);

        const pathsByCode = {};
        (allPaths || []).forEach(p => { pathsByCode[p.code] = p; });

        const createdOrders = [];
        const errors = [];

        // Dla każdej pozycji zamówienia
        for (const item of order.items) {
            const product = item.product;
            if (!product) continue;

            // Pobierz expression ścieżki z produktu
            const pathExpression = product.productionPath || product.productionpath;
            
            if (!pathExpression) {
                errors.push({ itemId: item.id, productCode: product.code, error: 'Brak ścieżki produkcyjnej' });
                continue;
            }

            // Parsuj expression
            const parsed = parseProductionPathExpression(pathExpression);

            if (parsed.branches.length === 0) {
                errors.push({ itemId: item.id, productCode: product.code, error: 'Nieprawidłowe wyrażenie ścieżki' });
                continue;
            }

            // Dla każdej gałęzi tworzymy osobne zlecenie
            for (let branchIndex = 0; branchIndex < parsed.branches.length; branchIndex++) {
                const branch = parsed.branches[branchIndex];
                const branchCode = parsed.branches.length > 1 ? String.fromCharCode(65 + branchIndex) : null; // A, B, C...

                try {
                    const baseOrderNumber = order.orderNumber || order.ordernumber;
                    const orderNumber = await generateProductionOrderNumber(supabase, orderId, baseOrderNumber);

                    // Znajdź pierwszą ścieżkę w sekwencji (dla przypisania productionPathId)
                    const firstPathCode = branch.pathCodes[0];
                    const firstPath = pathsByCode[firstPathCode];

                    // Utwórz zlecenie produkcyjne
                    const { data: prodOrder, error: prodError } = await supabase
                        .from('ProductionOrder')
                        .insert({
                            ordernumber: orderNumber,
                            sourceorderid: orderId,
                            sourceorderitemid: item.id,
                            productid: product.id,
                            productionpathexpression: pathExpression,
                            branchcode: branchCode,
                            quantity: item.quantity,
                            priority: priority || 3,
                            status: 'planned',
                            productionpathid: firstPath?.id || null,
                            productionnotes: notes || item.productionNotes || null,
                            createdby: userId
                        })
                        .select()
                        .single();

                    if (prodError) {
                        console.error('[POST /api/production/orders/from-order] Błąd tworzenia zlecenia:', prodError);
                        errors.push({ itemId: item.id, productCode: product.code, branchCode, error: prodError.message });
                        continue;
                    }

                    // Utwórz operacje dla każdej ścieżki w sekwencji
                    let operationNumber = 1;
                    for (const pathCode of branch.pathCodes) {
                        const pathDef = pathsByCode[pathCode];
                        
                        if (!pathDef) {
                            // Ścieżka nie zdefiniowana w systemie - tworzymy jedną generyczną operację
                            await supabase
                                .from('ProductionOperation')
                                .insert({
                                    productionorderid: prodOrder.id,
                                    operationnumber: operationNumber++,
                                    branchcode: branchCode,
                                    phase: 'OP',
                                    operationtype: `path_${pathCode}`,
                                    status: 'pending'
                                });
                        } else {
                            // Mamy definicję ścieżki - tworzymy operacje wg jej kroków
                            const operations = pathDef.operations || [];
                            for (const op of operations) {
                                await supabase
                                    .from('ProductionOperation')
                                    .insert({
                                        productionorderid: prodOrder.id,
                                        operationnumber: operationNumber++,
                                        branchcode: branchCode,
                                        phase: op.phase || 'OP',
                                        operationtype: op.operationType || op.operationtype || 'unknown',
                                        plannedtime: op.estimatedTimeMin || null,
                                        status: 'pending'
                                    });
                            }
                        }
                    }

                    createdOrders.push(prodOrder);
                } catch (branchError) {
                    console.error('[POST /api/production/orders/from-order] Błąd gałęzi:', branchError);
                    errors.push({ itemId: item.id, productCode: product.code, branchCode, error: branchError.message });
                }
            }
        }

        return res.status(201).json({
            status: 'success',
            message: `Utworzono ${createdOrders.length} zleceń produkcyjnych`,
            data: {
                orders: createdOrders,
                errors: errors.length > 0 ? errors : undefined
            }
        });
    } catch (error) {
        console.error('[POST /api/production/orders/from-order] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// GET /api/production/orders - lista zleceń produkcyjnych z postępem operacji, nazwami ścieżek i aktualnym etapem
app.get('/api/production/orders', requireRole(['ADMIN', 'PRODUCTION', 'SALES_DEPT', 'SALES_REP']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        const { status, sourceOrderId, priority, limit = 100 } = req.query;

        let query = supabase
            .from('ProductionOrder')
            .select(`
                *,
                product:Product(id, name, code, identifier),
                sourceOrder:Order(id, orderNumber, customerId, customer:Customer(id, name)),
                sourceOrderItem:OrderItem(id, projectviewurl, productionNotes, selectedProjects, projectQuantities, source, Product(name, identifier))
            `)
            .order('priority', { ascending: true })
            .order('createdat', { ascending: false })
            .limit(parseInt(limit, 10));

        if (status) {
            query = query.eq('status', status);
        }
        if (sourceOrderId) {
            query = query.eq('sourceorderid', sourceOrderId);
        }
        if (priority) {
            query = query.eq('priority', parseInt(priority, 10));
        }

        const { data: orders, error } = await query;

        if (error) {
            console.error('[GET /api/production/orders] Błąd:', error);
            return res.status(500).json({ status: 'error', message: 'Błąd pobierania zleceń' });
        }

        // Pobierz wszystkie ścieżki produkcyjne do mapowania code → name
        const { data: allPaths } = await supabase
            .from('ProductionPath')
            .select('id, code, name');
        
        const pathsByCode = {};
        (allPaths || []).forEach(p => {
            pathsByCode[p.code] = p;
        });

        // Pobierz operacje dla wszystkich zleceń (z dodatkowymi polami do ustalenia aktualnego etapu)
        const orderIds = (orders || []).map(o => o.id);
        let operationsMap = {};

        if (orderIds.length > 0) {
            const { data: operations, error: opsError } = await supabase
                .from('ProductionOperation')
                .select('id, productionorderid, operationnumber, phase, operationtype, status')
                .in('productionorderid', orderIds)
                .order('operationnumber', { ascending: true });

            if (!opsError && operations) {
                // Grupuj operacje po zleceniu
                operations.forEach(op => {
                    const orderId = op.productionorderid;
                    if (!operationsMap[orderId]) {
                        operationsMap[orderId] = { total: 0, completed: 0, operations: [] };
                    }
                    operationsMap[orderId].total++;
                    operationsMap[orderId].operations.push(op);
                    if (op.status === 'completed') {
                        operationsMap[orderId].completed++;
                    }
                });
            }
        }

        // Funkcja do parsowania productionPathExpression i zwracania czytelnych nazw
        function getPathNames(expression) {
            if (!expression) return null;
            // Parsuj expression: 5%3$2.1 → gałęzie i kody
            const branches = expression.split('$').map(branch => {
                const codes = branch.split('%').map(c => c.trim()).filter(Boolean);
                const names = codes.map(code => {
                    const path = pathsByCode[code];
                    return path ? path.name : `Ścieżka ${code}`;
                });
                return names.join(' → ');
            }).filter(Boolean);
            return branches.length > 1 ? branches.join(' | ') : branches[0] || null;
        }

        // Funkcja do ustalenia aktualnego etapu (pierwsza niezakończona operacja)
        function getCurrentStep(ops) {
            if (!ops || !ops.operations || ops.operations.length === 0) return null;
            // Znajdź pierwszą operację, która nie jest completed
            const current = ops.operations.find(op => op.status !== 'completed' && op.status !== 'cancelled');
            if (!current) {
                // Wszystkie zakończone
                return { phase: 'DONE', label: 'Zakończone' };
            }
            // Mapuj phase na czytelną nazwę
            const phaseLabels = {
                'PREP': 'Przygotowanie',
                'OP': 'Operacja',
                'QC': 'Kontrola jakości',
                'PACK': 'Pakowanie'
            };
            const phaseLabel = phaseLabels[current.phase] || current.phase;
            const opType = current.operationtype || '';
            return {
                phase: current.phase,
                operationType: opType,
                status: current.status,
                label: opType ? `${phaseLabel}: ${opType}` : phaseLabel
            };
        }

        // Dodaj informacje o postępie, nazwach ścieżek i aktualnym etapie do każdego zlecenia
        const ordersWithProgress = (orders || []).map(order => {
            const ops = operationsMap[order.id] || { total: 0, completed: 0, operations: [] };
            const progressPercent = ops.total > 0 ? Math.round((ops.completed / ops.total) * 100) : 0;
            const pathExpression = order.productionpathexpression || order.productionPathExpression;
            
            return {
                ...order,
                progress: {
                    completed: ops.completed,
                    total: ops.total,
                    percent: progressPercent,
                    label: `${ops.completed}/${ops.total}`
                },
                pathNames: getPathNames(pathExpression),
                currentStep: getCurrentStep(ops)
            };
        });

        return res.json({ status: 'success', data: ordersWithProgress });
    } catch (error) {
        console.error('[GET /api/production/orders] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// Helper: Aktualizacja statusu zamówienia na podstawie postępu produkcji
// ============================================
async function updateOrderStatusFromProduction(orderId) {
    if (!supabase || !orderId) return;
    
    try {
        // Pobierz zamówienie
        const { data: order, error: orderError } = await supabase
            .from('Order')
            .select('id, status')
            .eq('id', orderId)
            .single();
        
        if (orderError || !order) return;
        
        // Pobierz wszystkie zlecenia produkcyjne dla tego zamówienia
        const { data: prodOrders, error: prodError } = await supabase
            .from('ProductionOrder')
            .select('id, status')
            .eq('sourceorderid', orderId);
        
        if (prodError || !prodOrders || prodOrders.length === 0) return;
        
        // Sprawdź statusy zleceń
        const allCompleted = prodOrders.every(po => po.status === 'completed');
        const anyInProgress = prodOrders.some(po => po.status === 'in_progress');
        const anyActive = prodOrders.some(po => ['in_progress', 'approved'].includes(po.status));
        
        let newStatus = null;
        
        // Logika automatycznej zmiany statusu zamówienia
        if (allCompleted && order.status === 'IN_PRODUCTION') {
            // Wszystkie zlecenia zakończone → READY
            newStatus = 'READY';
        } else if ((anyInProgress || anyActive) && order.status === 'APPROVED') {
            // Któreś zlecenie w trakcie → IN_PRODUCTION
            newStatus = 'IN_PRODUCTION';
        }
        
        if (newStatus && newStatus !== order.status) {
            const { error: updateError } = await supabase
                .from('Order')
                .update({ status: newStatus, updatedAt: new Date().toISOString() })
                .eq('id', orderId);
            
            if (!updateError) {
                console.log(`[updateOrderStatusFromProduction] Zamówienie ${orderId}: ${order.status} → ${newStatus}`);
                
                // Zapisz w historii
                await supabase.from('OrderStatusHistory').insert({
                    orderId: orderId,
                    fromStatus: order.status,
                    toStatus: newStatus,
                    changedBy: null, // system
                    note: 'Automatyczna zmiana na podstawie postępu produkcji'
                });
            }
        }
    } catch (error) {
        console.error('[updateOrderStatusFromProduction] Błąd:', error);
    }
}

/**
 * Aktualizuje status ProductionWorkOrder na podstawie statusów powiązanych operacji
 * @param {string} productionOrderId - ID zlecenia produkcyjnego
 */
async function updateWorkOrderStatusFromOperations(productionOrderId) {
    if (!supabase || !productionOrderId) return;
    
    try {
        // Pobierz zlecenie produkcyjne z workOrderId
        const { data: prodOrder, error: prodOrderError } = await supabase
            .from('ProductionOrder')
            .select('id, status, workOrderId')
            .eq('id', productionOrderId)
            .single();
        
        if (prodOrderError || !prodOrder || !prodOrder.workOrderId) {
            console.log('[updateWorkOrderStatusFromOperations] Brak workOrderId dla zlecenia', productionOrderId);
            return;
        }
        
        // Pobierz wszystkie ProductionOrder dla tego work order
        const { data: prodOrders, error: prodOrdersError } = await supabase
            .from('ProductionOrder')
            .select('id')
            .eq('workOrderId', prodOrder.workOrderId);
        
        if (prodOrdersError || !prodOrders || prodOrders.length === 0) return;
        
        // Pobierz WSZYSTKIE operacje dla WSZYSTKICH ProductionOrder w tym work order
        const productionOrderIds = prodOrders.map(po => po.id);
        const { data: operations, error: opsError } = await supabase
            .from('ProductionOperation')
            .select('id, status')
            .in('productionOrderId', productionOrderIds);
        
        if (opsError || !operations || operations.length === 0) return;
        
        // Określ nowy status na podstawie wszystkich operacji
        // Statusy operacji: pending, active, paused, completed, cancelled
        let newStatus = prodOrder.status;
        
        const allCompleted = operations.every(op => op.status === 'completed');
        const anyActive = operations.some(op => op.status === 'active');
        const anyPaused = operations.some(op => op.status === 'paused');
        const anyPending = operations.some(op => op.status === 'pending');
        const anyCancelled = operations.some(op => op.status === 'cancelled');
        const allCancelled = operations.every(op => op.status === 'cancelled');
        
        if (allCompleted) {
            newStatus = 'completed';
        } else if (allCancelled) {
            newStatus = 'cancelled';
        } else if (anyActive || anyPaused) {
            newStatus = 'in_progress';
        } else if (anyPending && !anyCancelled) {
            newStatus = 'approved'; // Gotowe do realizacji
        } else if (anyPending) {
            // Są pending i cancelled - zostaw obecny status
            newStatus = prodOrder.status;
        }
        
        // Aktualizuj tylko jeśli status się zmienił
        if (newStatus !== prodOrder.status) {
            const { error: updateError } = await supabase
                .from('ProductionWorkOrder')
                .update({ 
                    status: newStatus,
                    updatedat: new Date().toISOString()
                })
                .eq('id', prodOrder.workOrderId);
            
            if (!updateError) {
                console.log(`[updateWorkOrderStatusFromOperations] WorkOrder ${prodOrder.workOrderId}: ${prodOrder.status} → ${newStatus}`);
            } else {
                console.error('[updateWorkOrderStatusFromOperations] Błąd aktualizacji work order:', updateError);
            }
        }
        
    } catch (error) {
        console.error('[updateWorkOrderStatusFromOperations] Błąd:', error);
    }
}

// ============================================
// PATCH /api/production/orders/:id/status - zmiana statusu zlecenia produkcyjnego
// ============================================
app.patch('/api/production/orders/:id/status', requireRole(['ADMIN', 'PRODUCTION']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        const { id } = req.params;
        const { status } = req.body;
        
        const validStatuses = ['planned', 'approved', 'in_progress', 'completed', 'cancelled'];
        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({ status: 'error', message: 'Nieprawidłowy status' });
        }

        // Pobierz zlecenie, żeby mieć sourceorderid
        const { data: prodOrder, error: getError } = await supabase
            .from('ProductionOrder')
            .select('id, sourceorderid, status')
            .eq('id', id)
            .single();
        
        if (getError || !prodOrder) {
            return res.status(404).json({ status: 'error', message: 'Zlecenie nie znalezione' });
        }

        // Aktualizuj status zlecenia
        const { data: updated, error: updateError } = await supabase
            .from('ProductionOrder')
            .update({ status, updatedat: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (updateError) {
            console.error('[PATCH /api/production/orders/:id/status] Błąd:', updateError);
            return res.status(500).json({ status: 'error', message: 'Błąd aktualizacji statusu' });
        }

        // Automatycznie zaktualizuj status zamówienia
        if (prodOrder.sourceorderid) {
            await updateOrderStatusFromProduction(prodOrder.sourceorderid);
        }

        return res.json({ status: 'success', data: updated });
    } catch (error) {
        console.error('[PATCH /api/production/orders/:id/status] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// DELETE /api/production/orders/:id - usunięcie zlecenia produkcyjnego (tylko ADMIN)
// ============================================
app.delete('/api/production/orders/:id', requireRole(['ADMIN']), async (req, res) => {
    console.log('[DELETE /api/production/orders/:id] Request received, id:', req.params.id);
    
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        const { id } = req.params;
        const cookies = parseCookies(req);
        const requesterId = cookies.auth_id;

        // Sprawdź czy zlecenie istnieje
        const { data: order, error: fetchError } = await supabase
            .from('ProductionOrder')
            .select('id, ordernumber, status')
            .eq('id', id)
            .single();

        if (fetchError || !order) {
            return res.status(404).json({ status: 'error', message: 'Zlecenie produkcyjne nie istnieje' });
        }

        // Usuń operacje produkcyjne
        const { error: deleteOpsError } = await supabase
            .from('ProductionOperation')
            .delete()
            .eq('productionorderid', id);

        if (deleteOpsError) {
            console.error('[DELETE /api/production/orders/:id] Błąd usuwania operacji:', deleteOpsError);
            return res.status(500).json({ status: 'error', message: 'Nie udało się usunąć operacji produkcyjnych' });
        }

        // Usuń zlecenie produkcyjne
        const { error: deleteError } = await supabase
            .from('ProductionOrder')
            .delete()
            .eq('id', id);

        if (deleteError) {
            console.error('[DELETE /api/production/orders/:id] Błąd usuwania zlecenia:', deleteError);
            return res.status(500).json({ status: 'error', message: 'Nie udało się usunąć zlecenia produkcyjnego' });
        }

        console.log(`[DELETE /api/production/orders/${id}] Zlecenie ${order.ordernumber} usunięte przez ${requesterId}`);
        return res.json({ status: 'success', message: 'Zlecenie produkcyjne zostało usunięte' });
    } catch (error) {
        console.error('[DELETE /api/production/orders/:id] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// PATCH /api/production/operations/:id/status - zmiana statusu operacji produkcyjnej
// ============================================
app.patch('/api/production/operations/:id/status', requireRole(['ADMIN', 'PRODUCTION', 'OPERATOR']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        const { id } = req.params;
        const { status, completedQuantity, notes } = req.body;
        
        const validStatuses = ['pending', 'active', 'paused', 'completed', 'cancelled'];
        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({ status: 'error', message: 'Nieprawidłowy status' });
        }

        // Pobierz operację, żeby mieć productionorderid
        const { data: operation, error: getError } = await supabase
            .from('ProductionOperation')
            .select('id, productionorderid, status')
            .eq('id', id)
            .single();
        
        if (getError || !operation) {
            return res.status(404).json({ status: 'error', message: 'Operacja nie znaleziona' });
        }

        // Przygotuj dane do aktualizacji
        const updateData = { 
            status,
            updatedat: new Date().toISOString()
        };
        
        if (status === 'active' && operation.status !== 'active') {
            updateData.startedat = new Date().toISOString();
        }
        if (status === 'completed') {
            updateData.completedat = new Date().toISOString();
            if (completedQuantity !== undefined) {
                updateData.completedquantity = completedQuantity;
            }
        }
        if (notes) {
            updateData.notes = notes;
        }

        // Aktualizuj status operacji
        const { data: updated, error: updateError } = await supabase
            .from('ProductionOperation')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (updateError) {
            console.error('[PATCH /api/production/operations/:id/status] Błąd:', updateError);
            return res.status(500).json({ status: 'error', message: 'Błąd aktualizacji statusu' });
        }

        // Sprawdź, czy wszystkie operacje zlecenia są zakończone
        if (status === 'completed' && operation.productionorderid) {
            const { data: allOps } = await supabase
                .from('ProductionOperation')
                .select('id, status')
                .eq('productionorderid', operation.productionorderid);
            
            const allCompleted = allOps && allOps.every(op => op.status === 'completed');
            
            if (allCompleted) {
                // Zaktualizuj status zlecenia na completed
                await supabase
                    .from('ProductionOrder')
                    .update({ status: 'completed', updatedat: new Date().toISOString() })
                    .eq('id', operation.productionorderid);
                
                console.log(`[PATCH /api/production/operations/:id/status] Zlecenie ${operation.productionorderid} zakończone`);
            }
            
            // Pobierz zlecenie, żeby mieć sourceorderid
            const { data: prodOrder } = await supabase
                .from('ProductionOrder')
                .select('sourceorderid')
                .eq('id', operation.productionorderid)
                .single();
            
            if (prodOrder?.sourceorderid) {
                await updateOrderStatusFromProduction(prodOrder.sourceorderid);
            }
        }
        
        // Jeśli operacja przeszła w active, zaktualizuj status zlecenia na in_progress
        if (status === 'active' && operation.productionorderid) {
            const { data: prodOrder } = await supabase
                .from('ProductionOrder')
                .select('id, status, sourceorderid')
                .eq('id', operation.productionorderid)
                .single();
            
            if (prodOrder && prodOrder.status !== 'in_progress') {
                await supabase
                    .from('ProductionOrder')
                    .update({ status: 'in_progress', updatedat: new Date().toISOString() })
                    .eq('id', operation.productionorderid);
            }
            
            if (prodOrder?.sourceorderid) {
                await updateOrderStatusFromProduction(prodOrder.sourceorderid);
            }
        }

        return res.json({ status: 'success', data: updated });
    } catch (error) {
        console.error('[PATCH /api/production/operations/:id/status] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// PANEL OPERATORA - DEDYKOWANE ENDPOINTY
// ============================================

// GET /api/production/orders/active - aktywne zlecenia dla panelu operatora
// Zwraca zlecenia w statusach: planned, approved, in_progress
// Sortowane: najpierw in_progress, potem wg priorytetu
app.get('/api/production/orders/active', requireRole(['ADMIN', 'PRODUCTION', 'OPERATOR']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        const { workStationId, workCenterId, limit = 50 } = req.query;
        const cookies = parseCookies(req);
        const userId = cookies.auth_id;

        // Pobierz dane użytkownika, aby sprawdzić przypisany pokój
        let userRoomId = null;
        if (userId) {
            const { data: user } = await supabase
                .from('User')
                .select('productionroomid')
                .eq('id', userId)
                .single();
            if (user && user.productionroomid) {
                userRoomId = user.productionroomid;
            }
        }

        // Jeśli użytkownik ma przypisany pokój, pobierz gniazda z tego pokoju
        // i wyznacz dozwolone typy gniazd (np. laser_co2, uv_print)
        let allowedWorkCenterIds = null;
        let allowedWorkCenterTypes = null;
        if (userRoomId) {
            const { data: workCenters, error: wcError } = await supabase
                .from('WorkCenter')
                .select('id, name, roomId, type')
                .eq('roomId', userRoomId);

            if (workCenters && workCenters.length > 0) {
                allowedWorkCenterIds = workCenters.map(wc => wc.id);
                allowedWorkCenterTypes = workCenters
                    .map(wc => wc.type)
                    .filter((t) => !!t);
            } else {
                allowedWorkCenterIds = []; // Pokój bez gniazd -> brak dostępnych operacji
                allowedWorkCenterTypes = [];
            }

        }

        let query = supabase
            .from('ProductionOrder')
            .select(`
                *,
                product:Product(id, name, code, identifier, imageUrl),
                sourceOrder:Order(id, orderNumber, customerId, deliveryDate, priority, customer:Customer(id, name)),
                sourceOrderItem:OrderItem(
                    id,
                    selectedProjects,
                    projectQuantities,
                    totalQuantity,
                    productionNotes,
                    source,
                    quantity,
                    locationName,
                    projectName,
                    projectViewUrl:projectviewurl
                ),
                workOrder:ProductionWorkOrder!ProductionOrder_workOrderId_fkey(id, workOrderNumber, roomName, status, priority)
            `)
            .in('status', ['planned', 'approved', 'in_progress'])
            .order('priority', { ascending: true })
            .order('createdat', { ascending: true })
            .limit(parseInt(limit, 10));

        if (workStationId) {
            query = query.eq('assignedworkstationid', workStationId);
        }
        if (workCenterId) {
            query = query.eq('assignedworkcenterid', workCenterId);
        }

        const { data: orders, error } = await query;

        if (error) {
            console.error('[GET /api/production/orders/active] Błąd:', error);
            return res.status(500).json({ status: 'error', message: 'Błąd pobierania zleceń' });
        }

        // Pobierz operacje dla wszystkich zleceń
        const orderIds = (orders || []).map(o => o.id);
        let operationsMap = {};

        if (orderIds.length > 0) {
            const { data: operations } = await supabase
                .from('ProductionOperation')
                .select(`
                    *,
                    workCenter:WorkCenter(id, name, code, type, roomId),
                    workStation:WorkStation(id, name, code, type)
                `)
                .in('productionorderid', orderIds)
                .order('operationnumber', { ascending: true });

            if (operations) {
                operations.forEach(op => {
                    const orderId = op.productionorderid;
                    if (!operationsMap[orderId]) {
                        operationsMap[orderId] = [];
                    }
                    operationsMap[orderId].push(op);
                });
            }
        }

        let filteredOrders = (orders || []).map(order => {
            const ops = operationsMap[order.id] || [];
            
            // Sprawdź, czy zlecenie ma operacje w pokoju użytkownika
            let hasOperationsInUserRoom = true;
            if (userRoomId && Array.isArray(allowedWorkCenterTypes)) {
                // Filtrowanie "po pokoju" działa tutaj w oparciu o typ operacji i typ gniazda.
                // Dla pokoju CO2 bierzemy np. wszystkie gniazda typu 'laser_co2'
                // i sprawdzamy, czy w zleceniu jest jakakolwiek operacja o operationType = 'laser_co2'.
                hasOperationsInUserRoom = ops.some(op => {
                    const opType = op.operationtype || op.operationType;
                    const wcId = op.workCenterId;
                    
                    // Dopasowanie po typie operacji - obsługuje też prefix 'path_'
                    let matchesByType = false;
                    if (opType) {
                        matchesByType = allowedWorkCenterTypes.includes(opType) ||
                            allowedWorkCenterTypes.some(t => opType === `path_${t}` || opType.includes(t));
                    }
                    
                    const matchesByCenter = wcId && allowedWorkCenterIds && allowedWorkCenterIds.includes(wcId);
                    return matchesByType || matchesByCenter;
                });

                console.log('[PRODUCTION DEBUG] order', order.id, 'ops:', ops.map(o => ({
                    id: o.id,
                    operationtype: o.operationtype,
                    workCenterId: o.workCenterId
                })), 'hasOpsInRoom:', hasOperationsInUserRoom);
            }

            // Oblicz postęp
            const completedOps = ops.filter(op => op.status === 'completed').length;
            const totalOps = ops.length;
            const activeOp = ops.find(op => op.status === 'active');
            const nextPendingOp = ops.find(op => op.status === 'pending');

            // Oblicz auto-priorytet na podstawie deliveryDate z powiązanego zamówienia
            const deliveryDate = order.sourceOrder?.deliveryDate || order.plannedenddate;
            const estimatedTimeMinutes = order.estimatedtime || 0;
            const timePriority = computeOrderTimePriority({ deliveryDate, estimatedTimeMinutes });
            
            return {
                ...order,
                operations: ops,
                hasOperationsInUserRoom, // Flaga pomocnicza
                // Dane czasowe z auto-priorytetu
                deliveryDate: deliveryDate || null,
                timeToDeadlineMinutes: timePriority.timeToDeadlineMinutes,
                slackMinutes: timePriority.slackMinutes,
                timeStatus: timePriority.timeStatus,
                computedPriority: timePriority.priority,
                progress: {
                    completed: completedOps,
                    total: totalOps,
                    percent: totalOps > 0 ? Math.round((completedOps / totalOps) * 100) : 0
                },
                currentOperation: activeOp || null,
                nextOperation: nextPendingOp || null
            };
        });

        // Filtrowanie finalne - usuń zlecenia, które nie dotyczą pokoju użytkownika
        if (userRoomId) {
            filteredOrders = filteredOrders.filter(o => o.hasOperationsInUserRoom);
        }

        // Sortuj: najpierw in_progress, potem approved, potem planned
        // W ramach statusu: najpierw po deliveryDate (rosnąco), potem po computedPriority (1-4)
        const statusOrder = { 'in_progress': 0, 'approved': 1, 'planned': 2 };
        filteredOrders.sort((a, b) => {
            const statusDiff = (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
            if (statusDiff !== 0) return statusDiff;
            
            // Sortuj po deliveryDate (rosnąco, null na końcu)
            const aDate = a.deliveryDate ? new Date(a.deliveryDate).getTime() : Infinity;
            const bDate = b.deliveryDate ? new Date(b.deliveryDate).getTime() : Infinity;
            if (aDate !== bDate) return aDate - bDate;
            
            // Potem po computedPriority (1=urgent, 4=low)
            return (a.computedPriority || 3) - (b.computedPriority || 3);
        });

        // Grupuj zlecenia po ProductionWorkOrder (Zbiorcze ZP)
        const workOrdersMap = new Map();
        for (const order of filteredOrders) {
            const woId = order.workOrderId || order.workorderid;
            if (woId) {
                if (!workOrdersMap.has(woId)) {
                    workOrdersMap.set(woId, {
                        id: woId,
                        workOrderNumber: order.workOrder?.workOrderNumber || `ZP-${woId}`,
                        roomName: order.workOrder?.roomName || 'Nieznany pokój',
                        status: order.workOrder?.status || 'planned',
                        priority: order.workOrder?.priority || 3,
                        orders: [],
                        totalQuantity: 0,
                        completedQuantity: 0,
                        productsCount: 0
                    });
                }
                const wo = workOrdersMap.get(woId);
                wo.orders.push(order);
                wo.totalQuantity += order.quantity || 0;
                wo.completedQuantity += order.completedquantity || 0;
                wo.productsCount++;
            }
        }

        // Oblicz podsumowanie kolejki
        const queueOrders = filteredOrders.filter(o => o.status === 'planned' || o.status === 'approved');
        const activeOrders = filteredOrders.filter(o => o.status === 'in_progress');
        const summary = {
            totalOrders: filteredOrders.length,
            queueCount: queueOrders.length,
            activeCount: activeOrders.length,
            totalQuantity: filteredOrders.reduce((sum, o) => sum + (o.quantity || 0), 0),
            queueQuantity: queueOrders.reduce((sum, o) => sum + (o.quantity || 0), 0)
        };

        return res.json({ 
            status: 'success', 
            data: filteredOrders,
            workOrders: Array.from(workOrdersMap.values()),
            summary
        });
    } catch (error) {
        console.error('[GET /api/production/orders/active] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// GET /api/production/orders/:id - szczegóły zlecenia z operacjami
app.get('/api/production/orders/:id', requireRole(['ADMIN', 'PRODUCTION', 'OPERATOR', 'SALES_DEPT']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        const { id } = req.params;

        const { data: order, error } = await supabase
            .from('ProductionOrder')
            .select(`
                *,
                product:Product(id, name, code, identifier, imageUrl, dimensions),
                sourceOrder:Order(id, orderNumber, customerId, notes, customer:Customer(id, name, city, phone)),
                workCenter:WorkCenter(id, name, code, type),
                workStation:WorkStation(id, name, code, type, manufacturer, model)
            `)
            .eq('id', id)
            .single();

        if (error || !order) {
            return res.status(404).json({ status: 'error', message: 'Zlecenie nie znalezione' });
        }

        // Pobierz operacje
        const { data: operations } = await supabase
            .from('ProductionOperation')
            .select(`
                *,
                operator:User(id, name),
                workStation:WorkStation(id, name, code)
            `)
            .eq('productionorderid', id)
            .order('operationnumber', { ascending: true });

        // Pobierz logi
        const { data: logs } = await supabase
            .from('ProductionLog')
            .select(`
                *,
                user:User(id, name)
            `)
            .eq('productionOrderId', id)
            .order('createdAt', { ascending: false })
            .limit(20);

        return res.json({
            status: 'success',
            data: {
                ...order,
                operations: operations || [],
                logs: logs || []
            }
        });
    } catch (error) {
        console.error('[GET /api/production/orders/:id] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// POST /api/production/operations/:id/start - szybki start operacji
app.post('/api/production/operations/:id/start', requireRole(['ADMIN', 'PRODUCTION', 'OPERATOR']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        const { id } = req.params;
        const cookies = parseCookies(req);
        const userId = cookies.auth_id;

        // Pobierz operację
        const { data: operation, error: getError } = await supabase
            .from('ProductionOperation')
            .select('id, productionorderid, status, operationnumber')
            .eq('id', id)
            .single();

        if (getError || !operation) {
            return res.status(404).json({ status: 'error', message: 'Operacja nie znaleziona' });
        }

        if (operation.status !== 'pending' && operation.status !== 'paused') {
            return res.status(400).json({ status: 'error', message: 'Operacja nie może być rozpoczęta (nieprawidłowy status)' });
        }

        // Aktualizuj operację
        const { data: updated, error: updateError } = await supabase
            .from('ProductionOperation')
            .update({
                status: 'active',
                operatorid: userId,
                starttime: new Date().toISOString(),
                updatedat: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (updateError) {
            console.error('[POST /api/production/operations/:id/start] Błąd:', updateError);
            return res.status(500).json({ status: 'error', message: 'Błąd startu operacji' });
        }

        // Zaktualizuj status zlecenia na in_progress jeśli trzeba
        const { data: prodOrder } = await supabase
            .from('ProductionOrder')
            .select('id, status, sourceorderid')
            .eq('id', operation.productionorderid)
            .single();

        if (prodOrder && prodOrder.status !== 'in_progress') {
            await supabase
                .from('ProductionOrder')
                .update({ 
                    status: 'in_progress', 
                    actualstartdate: new Date().toISOString(),
                    updatedat: new Date().toISOString() 
                })
                .eq('id', operation.productionorderid);
        }

        // Zaktualizuj status zamówienia
        if (prodOrder?.sourceorderid) {
            await updateOrderStatusFromProduction(prodOrder.sourceorderid);
        }

        // Zapisz log
        await supabase.from('ProductionLog').insert({
            productionOrderId: operation.productionorderid,
            action: 'operation_started',
            previousStatus: operation.status,
            newStatus: 'active',
            userId: userId,
            notes: `Operacja #${operation.operationnumber} rozpoczęta`
        });

        return res.json({ status: 'success', data: updated, message: 'Operacja rozpoczęta' });
    } catch (error) {
        console.error('[POST /api/production/operations/:id/start] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// POST /api/production/operations/:id/pause - pauza operacji
app.post('/api/production/operations/:id/pause', requireRole(['ADMIN', 'PRODUCTION', 'OPERATOR']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        const { id } = req.params;
        const { reason } = req.body || {};
        const cookies = parseCookies(req);
        const userId = cookies.auth_id;

        // Pobierz operację
        const { data: operation, error: getError } = await supabase
            .from('ProductionOperation')
            .select('id, productionorderid, status, operationnumber, starttime')
            .eq('id', id)
            .single();

        if (getError || !operation) {
            return res.status(404).json({ status: 'error', message: 'Operacja nie znaleziona' });
        }

        if (operation.status !== 'active') {
            return res.status(400).json({ status: 'error', message: 'Tylko aktywna operacja może być wstrzymana' });
        }

        // Oblicz dotychczasowy czas
        let actualTime = operation.actualtime || 0;
        if (operation.starttime) {
            const startTime = new Date(operation.starttime);
            const now = new Date();
            actualTime += Math.round((now - startTime) / 60000); // minuty
        }

        // Aktualizuj operację
        const { data: updated, error: updateError } = await supabase
            .from('ProductionOperation')
            .update({
                status: 'paused',
                actualtime: actualTime,
                updatedat: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (updateError) {
            console.error('[POST /api/production/operations/:id/pause] Błąd:', updateError);
            return res.status(500).json({ status: 'error', message: 'Błąd pauzy operacji' });
        }

        // Zapisz log
        await supabase.from('ProductionLog').insert({
            productionOrderId: operation.productionorderid,
            action: 'operation_paused',
            previousStatus: 'active',
            newStatus: 'paused',
            userId: userId,
            notes: reason ? `Pauza: ${reason}` : `Operacja #${operation.operationnumber} wstrzymana`
        });

        return res.json({ status: 'success', data: updated, message: 'Operacja wstrzymana' });
    } catch (error) {
        console.error('[POST /api/production/operations/:id/pause] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// POST /api/production/operations/:id/complete - zakończenie operacji
app.post('/api/production/operations/:id/complete', requireRole(['ADMIN', 'PRODUCTION', 'OPERATOR']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        const { id } = req.params;
        const { outputQuantity, wasteQuantity, qualityNotes } = req.body || {};
        const cookies = parseCookies(req);
        const userId = cookies.auth_id;

        // Pobierz operację
        const { data: operation, error: getError } = await supabase
            .from('ProductionOperation')
            .select('id, productionorderid, status, operationnumber, starttime, actualtime')
            .eq('id', id)
            .single();

        if (getError || !operation) {
            return res.status(404).json({ status: 'error', message: 'Operacja nie znaleziona' });
        }

        if (operation.status !== 'active' && operation.status !== 'paused') {
            return res.status(400).json({ status: 'error', message: 'Operacja nie może być zakończona (nieprawidłowy status)' });
        }

        // Oblicz całkowity czas
        let actualTime = operation.actualtime || 0;
        if (operation.status === 'active' && operation.starttime) {
            const startTime = new Date(operation.starttime);
            const now = new Date();
            actualTime += Math.round((now - startTime) / 60000); // minuty
        }

        // Aktualizuj operację
        const { data: updated, error: updateError } = await supabase
            .from('ProductionOperation')
            .update({
                status: 'completed',
                endtime: new Date().toISOString(),
                actualtime: actualTime,
                outputquantity: outputQuantity || 0,
                wastequantity: wasteQuantity || 0,
                qualitynotes: qualityNotes || null,
                updatedat: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (updateError) {
            console.error('[POST /api/production/operations/:id/complete] Błąd:', updateError);
            return res.status(500).json({ status: 'error', message: 'Błąd zakończenia operacji' });
        }

        // Sprawdź czy wszystkie operacje zlecenia są zakończone
        const { data: allOps } = await supabase
            .from('ProductionOperation')
            .select('id, status')
            .eq('productionorderid', operation.productionorderid);

        const allCompleted = allOps && allOps.every(op => op.status === 'completed');

        if (allCompleted) {
            // Zaktualizuj status zlecenia na completed
            await supabase
                .from('ProductionOrder')
                .update({ 
                    status: 'completed', 
                    actualenddate: new Date().toISOString(),
                    completedquantity: outputQuantity || 0,
                    updatedat: new Date().toISOString() 
                })
                .eq('id', operation.productionorderid);

            console.log(`[POST /api/production/operations/:id/complete] Zlecenie ${operation.productionorderid} zakończone`);
        }

        // Pobierz zlecenie dla aktualizacji zamówienia
        const { data: prodOrder } = await supabase
            .from('ProductionOrder')
            .select('sourceorderid')
            .eq('id', operation.productionorderid)
            .single();

        if (prodOrder?.sourceorderid) {
            await updateOrderStatusFromProduction(prodOrder.sourceorderid);
        }

        // Zapisz log
        await supabase.from('ProductionLog').insert({
            productionOrderId: operation.productionorderid,
            action: 'operation_completed',
            previousStatus: operation.status,
            newStatus: 'completed',
            userId: userId,
            notes: `Operacja #${operation.operationnumber} zakończona. Wykonano: ${outputQuantity || 0}, braki: ${wasteQuantity || 0}`
        });

        return res.json({ 
            status: 'success', 
            data: updated, 
            message: allCompleted ? 'Operacja zakończona - zlecenie kompletne!' : 'Operacja zakończona',
            orderCompleted: allCompleted
        });
    } catch (error) {
        console.error('[POST /api/production/operations/:id/complete] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// POST /api/production/operations/:id/problem - zgłoszenie problemu
app.post('/api/production/operations/:id/problem', requireRole(['ADMIN', 'PRODUCTION', 'OPERATOR']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        const { id } = req.params;
        const { problemType, description, stopOperation } = req.body || {};
        const cookies = parseCookies(req);
        const userId = cookies.auth_id;

        if (!problemType) {
            return res.status(400).json({ status: 'error', message: 'Typ problemu jest wymagany' });
        }

        // Pobierz operację
        const { data: operation, error: getError } = await supabase
            .from('ProductionOperation')
            .select('id, productionorderid, status, operationnumber')
            .eq('id', id)
            .single();

        if (getError || !operation) {
            return res.status(404).json({ status: 'error', message: 'Operacja nie znaleziona' });
        }

        // Jeśli stopOperation = true, wstrzymaj operację
        if (stopOperation && operation.status === 'active') {
            await supabase
                .from('ProductionOperation')
                .update({
                    status: 'paused',
                    qualitynotes: `PROBLEM: ${problemType}${description ? ' - ' + description : ''}`,
                    updatedat: new Date().toISOString()
                })
                .eq('id', id);
        }

        // Zapisz log problemu
        await supabase.from('ProductionLog').insert({
            productionOrderId: operation.productionorderid,
            action: 'problem_reported',
            previousStatus: operation.status,
            newStatus: stopOperation ? 'paused' : operation.status,
            userId: userId,
            notes: `PROBLEM [${problemType}]: ${description || 'Brak opisu'}`
        });

        return res.json({ 
            status: 'success', 
            message: 'Problem zgłoszony',
            operationPaused: stopOperation && operation.status === 'active'
        });
    } catch (error) {
        console.error('[POST /api/production/operations/:id/problem] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// POST /api/production/operations/:id/cancel - anulowanie operacji
app.post('/api/production/operations/:id/cancel', requireRole(['ADMIN', 'PRODUCTION', 'OPERATOR', 'PRODUCTION_MANAGER']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        const { id } = req.params;
        const { reason } = req.body || {};
        const cookies = parseCookies(req);
        const userId = cookies.auth_id;

        // Pobierz operację
        const { data: operation, error: getError } = await supabase
            .from('ProductionOperation')
            .select('id, productionorderid, status, operationnumber, operatorid')
            .eq('id', id)
            .single();

        if (getError || !operation) {
            return res.status(404).json({ status: 'error', message: 'Operacja nie znaleziona' });
        }

        // Nie można anulować zakończonych operacji
        if (operation.status === 'completed') {
            return res.status(400).json({ status: 'error', message: 'Nie można anulować zakończonej operacji' });
        }

        // Aktualizuj operację
        const { data: updated, error: updateError } = await supabase
            .from('ProductionOperation')
            .update({
                status: 'cancelled',
                qualitynotes: reason ? `ANULOWANO: ${reason}` : 'Operacja anulowana',
                updatedat: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (updateError) {
            console.error('[POST /api/production/operations/:id/cancel] Błąd:', updateError);
            return res.status(500).json({ status: 'error', message: 'Błąd anulowania operacji' });
        }

        // Zapisz log
        await supabase.from('ProductionLog').insert({
            productionOrderId: operation.productionorderid,
            action: 'operation_cancelled',
            previousStatus: operation.status,
            newStatus: 'cancelled',
            userId: userId,
            notes: reason ? `Anulowano: ${reason}` : `Operacja #${operation.operationnumber} anulowana`
        });

        // Zaktualizuj status work order
        await updateWorkOrderStatusFromOperations(operation.productionorderid);

        return res.json({ status: 'success', data: updated, message: 'Operacja anulowana' });
    } catch (error) {
        console.error('[POST /api/production/operations/:id/cancel] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// GET /api/production/operator/stats - statystyki dla operatora (filtrowane po pokoju)
app.get('/api/production/operator/stats', requireRole(['ADMIN', 'PRODUCTION', 'OPERATOR', 'PRODUCTION_MANAGER']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        const cookies = parseCookies(req);
        const userId = cookies.auth_id;
        const userRole = cookies.auth_role;

        // Pobierz pokój użytkownika i dozwolone typy operacji
        let allowedWorkCenterTypes = null;
        let userRoomName = null;
        let userRoomId = null;
        
        if (userId) {
            const { data: user } = await supabase
                .from('User')
                .select('productionroomid, productionRoom:ProductionRoom!User_productionroomid_fkey(id, name)')
                .eq('id', userId)
                .single();
            
            if (user?.productionroomid) {
                userRoomId = user.productionroomid;
                userRoomName = user.productionRoom?.name;
                
                const { data: workCenters } = await supabase
                    .from('WorkCenter')
                    .select('type')
                    .eq('roomId', user.productionroomid);
                
                if (workCenters && workCenters.length > 0) {
                    allowedWorkCenterTypes = workCenters.map(wc => wc.type).filter(t => !!t);
                }
            }
        }
        
        // Dla ADMIN i PRODUCTION_MANAGER bez przypisanego pokoju - pokaż wszystkie statystyki
        const showAllStats = (userRole === 'ADMIN' || userRole === 'PRODUCTION_MANAGER') && !userRoomId;

        // Pobierz wszystkie zlecenia z operacjami
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayISO = today.toISOString();

        const { data: orders } = await supabase
            .from('ProductionOrder')
            .select('id, status, actualenddate')
            .in('status', ['planned', 'approved', 'in_progress', 'completed']);

        // Jeśli operator ma przypisany pokój, filtruj zlecenia po typie operacji
        // Dla ADMIN/PRODUCTION_MANAGER bez pokoju - pokaż wszystkie
        let filteredOrders = orders || [];
        
        if (!showAllStats && allowedWorkCenterTypes && allowedWorkCenterTypes.length > 0) {
            const orderIds = filteredOrders.map(o => o.id);
            
            if (orderIds.length > 0) {
                const { data: operations } = await supabase
                    .from('ProductionOperation')
                    .select('productionorderid, operationtype')
                    .in('productionorderid', orderIds);
                
                // Grupuj operacje po zleceniu
                const orderOpsMap = {};
                (operations || []).forEach(op => {
                    if (!orderOpsMap[op.productionorderid]) {
                        orderOpsMap[op.productionorderid] = [];
                    }
                    orderOpsMap[op.productionorderid].push(op.operationtype);
                });
                
                // Filtruj zlecenia, które mają operacje z dozwolonymi typami
                filteredOrders = filteredOrders.filter(order => {
                    const opTypes = orderOpsMap[order.id] || [];
                    return opTypes.some(t => allowedWorkCenterTypes.includes(t));
                });
            }
        }

        const stats = {
            active: 0,          // in_progress w moim pokoju
            queue: 0,           // planned + approved w moim pokoju
            completedToday: 0,  // completed dziś w moim pokoju
            roomName: showAllStats ? 'Wszystkie pokoje' : (userRoomName || 'Brak przypisanego pokoju'),
            showAllStats: showAllStats
        };

        filteredOrders.forEach(order => {
            if (order.status === 'in_progress') {
                stats.active++;
            } else if (order.status === 'planned' || order.status === 'approved') {
                stats.queue++;
            } else if (order.status === 'completed') {
                // Sprawdź czy ukończone dziś
                if (order.actualenddate && new Date(order.actualenddate) >= today) {
                    stats.completedToday++;
                }
            }
        });

        return res.json({ status: 'success', data: stats });
    } catch (error) {
        console.error('[GET /api/production/operator/stats] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// GET /api/production/kpi/overview - Dashboard KPI produkcji
// ============================================
/**
 * Zwraca zagregowane KPI produkcyjne:
 * - summary: completedOperations, producedQuantity, wasteQuantity, problemsReported
 * - byRoom: statystyki per pokój produkcyjny
 * - topProducts: top 5 produktów wg wyprodukowanej ilości
 * 
 * Query params (opcjonalne):
 * - dateFrom: ISO date string (domyślnie: dziś 00:00)
 * - dateTo: ISO date string (domyślnie: dziś 23:59)
 * - roomId: number (filtruj po pokoju)
 */
app.get('/api/production/kpi/overview', requireRole(['ADMIN', 'PRODUCTION_MANAGER', 'PRODUCTION']), async (req, res) => {
    const tag = '[GET /api/production/kpi/overview]';
    console.log(`${tag} start`);

    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        const { dateFrom, dateTo, roomId } = req.query;

        // Domyślny zakres: dzisiaj
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const startDate = dateFrom ? new Date(dateFrom) : today;
        const endDate = dateTo ? new Date(dateTo) : tomorrow;

        // 1. Pobierz zakończone operacje w zakresie dat
        let operationsQuery = supabase
            .from('ProductionOperation')
            .select(`
                id, status, outputquantity, wastequantity, actualtime, endtime,
                productionorderid,
                ProductionOrder!inner(id, workOrderId, Product(id, name, identifier))
            `)
            .eq('status', 'completed')
            .gte('endtime', startDate.toISOString())
            .lt('endtime', endDate.toISOString());

        const { data: completedOps, error: opsError } = await operationsQuery;

        if (opsError) {
            console.error(`${tag} Błąd pobierania operacji:`, opsError);
            return res.status(500).json({ status: 'error', message: 'Błąd pobierania danych operacji' });
        }

        // 2. Pobierz zgłoszone problemy w zakresie dat
        let logsQuery = supabase
            .from('ProductionLog')
            .select('id, action, createdAt')
            .eq('action', 'problem_reported')
            .gte('createdAt', startDate.toISOString())
            .lt('createdAt', endDate.toISOString());

        const { data: problemLogs, error: logsError } = await logsQuery;

        if (logsError) {
            console.error(`${tag} Błąd pobierania logów:`, logsError);
        }

        // 3. Pobierz work orders dla statystyk per pokój
        let workOrdersQuery = supabase
            .from('ProductionWorkOrder')
            .select('id, status, roomName, createdAt, updatedAt');

        if (roomId) {
            // Filtruj po nazwie pokoju (roomName) - ProductionWorkOrder nie ma roomId
            const { data: room } = await supabase
                .from('ProductionRoom')
                .select('name')
                .eq('id', parseInt(roomId))
                .single();
            
            if (room) {
                workOrdersQuery = workOrdersQuery.eq('roomName', room.name);
            }
        }

        const { data: workOrders, error: woError } = await workOrdersQuery;

        if (woError) {
            console.error(`${tag} Błąd pobierania work orders:`, woError);
        }

        // 4. Oblicz summary
        const summary = {
            completedOperations: completedOps?.length || 0,
            producedQuantity: 0,
            wasteQuantity: 0,
            problemsReported: problemLogs?.length || 0,
            avgOperationTimeMinutes: 0
        };

        let totalActualTime = 0;
        const productStats = {};

        (completedOps || []).forEach(op => {
            summary.producedQuantity += op.outputquantity || 0;
            summary.wasteQuantity += op.wastequantity || 0;
            totalActualTime += op.actualtime || 0;

            // Agreguj po produktach
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

        if (summary.completedOperations > 0) {
            summary.avgOperationTimeMinutes = Math.round(totalActualTime / summary.completedOperations);
        }

        // 5. Oblicz byRoom
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

        const byRoom = Object.values(roomStats);

        // 6. Top 5 produktów
        const topProducts = Object.values(productStats)
            .sort((a, b) => b.producedQuantity - a.producedQuantity)
            .slice(0, 5);

        // 7. Zwróć wynik
        const result = {
            summary,
            byRoom,
            topProducts,
            dateRange: {
                from: startDate.toISOString(),
                to: endDate.toISOString()
            }
        };

        console.log(`${tag} Zwracam KPI: ${summary.completedOperations} operacji, ${summary.producedQuantity} szt.`);
        return res.json({ status: 'success', data: result });

    } catch (error) {
        console.error(`${tag} Wyjątek:`, error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// ENDPOINTY DRUKU PDF
// ============================================

/**
 * GET /api/production/work-orders/:id/print
 * Generuje PDF zlecenia produkcyjnego dla pokoju produkcyjnego.
 * Uprawnienia: SALES_DEPT, ADMIN (pełne), PRODUCTION (tylko swoje).
 * Stan na 2025-12-08:
 * - używa fontów NotoSans (UTF-8) dla polskich znaków,
 * - PDF pokazuje wszystkie pozycje z ProductionOrder powiązane z danym
 *   ProductionWorkOrder,
 * - dla każdej pozycji drukuje: produkt, lokalizację, ilość całkowitą,
 *   projekty + ilości na projekt (selectedProjects + projectQuantities),
 *   uwagi produkcyjne oraz linię "Podział: ... | Źródło: ..." na podstawie
 *   pola quantitySource z OrderItem,
 * - stopka jest zawsze na dole strony (A4) i zawiera datę wydruku, numer
 *   zlecenia produkcyjnego (ProductionWorkOrder) i numer strony.
 * TODO (dla przyszłego Agenta AI):
 * - dodać obsługę numeracji stron > 1 (aktualnie zakładamy jedną stronę),
 * - rozważyć filtrowanie pozycji (np. tylko aktywne / nieanulowane).
 */
app.get('/api/production/work-orders/:id/print', async (req, res) => {
    const tag = '[GET /api/production/work-orders/:id/print]';
    console.log(`${tag} start, id=${req.params.id}`);

    try {
        const cookies = parseCookies(req);
        const authId = cookies.auth_id;
        const authRole = cookies.auth_role;

        if (!authId) {
            return res.status(401).json({ status: 'error', message: 'Brak autoryzacji' });
        }

        const fullAccessRoles = ['ADMIN', 'SALES_DEPT', 'PRODUCTION_MANAGER', 'PRODUCTION', 'OPERATOR'];
        const isSalesRep = authRole === 'SALES_REP';

        if (!fullAccessRoles.includes(authRole) && !isSalesRep) {
            return res.status(403).json({ status: 'error', message: 'Brak uprawnień do druku zleceń' });
        }

        const workOrderId = parseInt(req.params.id, 10);
        if (isNaN(workOrderId)) {
            return res.status(400).json({ status: 'error', message: 'Nieprawidłowe ID zlecenia' });
        }

        // Pobierz dane zlecenia produkcyjnego dla pokoju produkcyjnego
        const { data: workOrder, error: woError } = await supabase
            .from('ProductionWorkOrder')
            .select('*')
            .eq('id', workOrderId)
            .single();

        if (woError || !workOrder) {
            console.log(`${tag} Nie znaleziono zlecenia:`, woError);
            return res.status(404).json({ status: 'error', message: 'Nie znaleziono zlecenia produkcyjnego dla pokoju produkcyjnego' });
        }

        // Handlowiec (SALES_REP) może drukować ZP tylko dla własnych zamówień
        if (isSalesRep) {
            if (!workOrder.sourceOrderId) {
                return res.status(403).json({ status: 'error', message: 'Brak uprawnień do druku zleceń dla tego zamówienia' });
            }

            const { data: order, error: orderError } = await supabase
                .from('Order')
                .select('id, userId')
                .eq('id', workOrder.sourceOrderId)
                .single();

            if (orderError || !order) {
                console.error(`${tag} Błąd pobierania zamówienia dla handlowca:`, orderError);
                return res.status(404).json({ status: 'error', message: 'Nie znaleziono zamówienia powiązanego ze zleceniem' });
            }

            if (order.userId !== authId) {
                return res.status(403).json({ status: 'error', message: 'Brak uprawnień do druku zleceń dla tego zamówienia' });
            }
        }

        // Pobierz zamówienie źródłowe
        let orderNumber = '-';
        let customerName = '-';
        if (workOrder.sourceOrderId) {
            const { data: order } = await supabase
                .from('Order')
                .select('orderNumber, Customer(name)')
                .eq('id', workOrder.sourceOrderId)
                .single();
            
            if (order) {
                orderNumber = order.orderNumber || '-';
                customerName = order.Customer?.name || '-';
            }
        }

        // Pobierz pozycje zlecenia (ProductionOrder powiązane z tym workOrderId)
        const { data: productionOrders, error: poError } = await supabase
            .from('ProductionOrder')
            .select(`
                id, quantity, productionnotes, status,
                sourceorderitemid,
                Product(name, identifier)
            `)
            .eq('workOrderId', workOrderId);

        if (poError) {
            console.log(`${tag} Błąd pobierania pozycji:`, poError);
        }

        // Pobierz szczegóły OrderItem dla każdej pozycji
        const items = [];
        for (const po of (productionOrders || [])) {
            let locationName = '-';
            let source = 'MIEJSCOWOSCI';
            let selectedProjects = '-';
            let projectQuantities = '-';
            let totalQuantity = po.quantity || 0;
            let quantitySource = 'total';
            
            if (po.sourceorderitemid) {
                const { data: orderItem } = await supabase
                    .from('OrderItem')
                    .select('locationName, source, selectedProjects, projectQuantities, totalQuantity, quantitySource')
                    .eq('id', po.sourceorderitemid)
                    .single();
                
                if (orderItem) {
                    locationName = orderItem.locationName || '-';
                    source = orderItem.source || 'MIEJSCOWOSCI';
                    selectedProjects = orderItem.selectedProjects || '-';
                    projectQuantities = orderItem.projectQuantities || '-';
                    totalQuantity = orderItem.totalQuantity ?? po.quantity ?? 0;
                    quantitySource = orderItem.quantitySource || 'total';
                }
            }

            items.push({
                productName: po.Product?.name || po.Product?.identifier || '-',
                identifier: po.Product?.identifier || '-',
                locationName,
                source,
                quantity: po.quantity || 0,
                selectedProjects,
                projectQuantities,
                totalQuantity,
                quantitySource,
                productionNotes: po.productionnotes || ''
            });
        }

        // Przygotuj dane do PDF
        const pdfData = {
            workOrderNumber: workOrder.workOrderNumber || `PW-${workOrderId}`,
            orderNumber,
            customerName,
            roomName: workOrder.roomName || 'Pokój produkcyjny',
            status: workOrder.status,
            priority: workOrder.priority || 3,
            plannedDate: workOrder.plannedDate,
            notes: workOrder.notes,
            items
        };

        // Generuj PDF
        const pdfBuffer = await createProductionWorkOrderPDF(pdfData);

        // Zapisz audyt druku
        await supabase.from('PrintAudit').insert({
            documentType: 'production_work_order',
            documentId: String(workOrderId),
            printedBy: authId,
            templateVersion: '1.0',
            printCount: 1
        });

        // Aktualizuj printedAt w zleceniu
        await supabase
            .from('ProductionWorkOrder')
            .update({ 
                printedAt: new Date().toISOString(),
                printedBy: authId 
            })
            .eq('id', workOrderId);

        // Zwróć PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="zlecenie-${pdfData.workOrderNumber}.pdf"`);
        res.send(pdfBuffer);

    } catch (error) {
        console.error(`${tag} Wyjątek:`, error);
        return res.status(500).json({ status: 'error', message: 'Błąd generowania PDF' });
    }
});

/**
 * GET /api/orders/:id/production-work-orders
 * Zwraca listę zleceń pokojowych (ProductionWorkOrder) powiązanych z zamówieniem
 * Uprawnienia: ADMIN, SALES_DEPT, PRODUCTION_MANAGER, PRODUCTION, OPERATOR, WAREHOUSE
 */
app.get('/api/orders/:id/production-work-orders', async (req, res) => {
    const tag = '[GET /api/orders/:id/production-work-orders]';
    console.log(`${tag} start, id=${req.params.id}`);

    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        const cookies = parseCookies(req);
        const authId = cookies.auth_id;
        const authRole = cookies.auth_role;

        if (!authId) {
            return res.status(401).json({ status: 'error', message: 'Brak autoryzacji' });
        }

        const fullAccessRoles = ['ADMIN', 'SALES_DEPT', 'PRODUCTION_MANAGER', 'PRODUCTION', 'OPERATOR', 'WAREHOUSE'];
        const isSalesRep = authRole === 'SALES_REP';

        if (!fullAccessRoles.includes(authRole) && !isSalesRep) {
            return res.status(403).json({ status: 'error', message: 'Brak uprawnień do podglądu zleceń produkcyjnych dla zamówienia' });
        }

        const orderId = req.params.id;

        // Handlowiec (SALES_REP) widzi tylko ZP powiązane ze swoimi zamówieniami
        if (isSalesRep) {
            const { data: order, error: orderError } = await supabase
                .from('Order')
                .select('id, userId')
                .eq('id', orderId)
                .single();

            if (orderError || !order) {
                console.error(`${tag} Błąd pobierania zamówienia dla handlowca:`, orderError);
                return res.status(404).json({ status: 'error', message: 'Zamówienie nie znalezione' });
            }

            if (order.userId !== authId) {
                return res.status(403).json({ status: 'error', message: 'Brak uprawnień do podglądu zleceń produkcyjnych dla tego zamówienia' });
            }
        }

        const { data: workOrders, error } = await supabase
            .from('ProductionWorkOrder')
            .select('id, "workOrderNumber", "roomName", status, priority')
            .eq('sourceOrderId', orderId)
            .order('workOrderNumber');

        if (error) {
            console.error(`${tag} Błąd pobierania zleceń:`, error);
            return res.status(500).json({ status: 'error', message: 'Błąd pobierania zleceń produkcyjnych' });
        }

        return res.json({ status: 'success', data: workOrders || [] });
    } catch (error) {
        console.error(`${tag} Wyjątek:`, error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

/**
 * GET /api/graphics/tasks/:id/print
 * Generuje PDF zlecenia na projekty
 * Uprawnienia: GRAPHICS, ADMIN, SALES_DEPT
 */
app.get('/api/graphics/tasks/:id/print', async (req, res) => {
    const tag = '[GET /api/graphics/tasks/:id/print]';
    console.log(`${tag} start, id=${req.params.id}`);

    try {
        const cookies = parseCookies(req);
        const authId = cookies.auth_id;
        const authRole = cookies.auth_role;

        if (!authId) {
            return res.status(401).json({ status: 'error', message: 'Brak autoryzacji' });
        }

        const allowedRoles = ['ADMIN', 'SALES_DEPT', 'PRODUCTION_MANAGER', 'GRAPHICS', 'GRAPHIC_DESIGNER'];
        if (!allowedRoles.includes(authRole)) {
            return res.status(403).json({ status: 'error', message: 'Brak uprawnień do druku zleceń graficznych' });
        }

        const taskId = parseInt(req.params.id, 10);
        if (isNaN(taskId)) {
            return res.status(400).json({ status: 'error', message: 'Nieprawidłowe ID zadania' });
        }

        // Pobierz dane zadania graficznego
        const { data: task, error: taskError } = await supabase
            .from('GraphicTask')
            .select(`
                *,
                Order(orderNumber, Customer(name)),
                OrderItem(Product(name, identifier)),
                AssignedUser:User!GraphicTask_assignedTo_fkey(name)
            `)
            .eq('id', taskId)
            .single();

        if (taskError || !task) {
            console.log(`${tag} Nie znaleziono zadania:`, taskError);
            return res.status(404).json({ status: 'error', message: 'Nie znaleziono zadania graficznego' });
        }

        // Przygotuj dane do PDF
        const pdfData = {
            id: task.id,
            orderNumber: task.Order?.orderNumber || '-',
            customerName: task.Order?.Customer?.name || '-',
            productName: task.OrderItem?.Product?.name || task.OrderItem?.Product?.identifier || '-',
            status: task.status,
            dueDate: task.dueDate,
            assignedToName: task.AssignedUser?.name || '-',
            galleryContext: task.galleryContext,
            filesLocation: task.filesLocation,
            projectNumbers: task.projectNumbers,
            checklist: task.checklist
        };

        // Generuj PDF
        const pdfBuffer = await createGraphicsTaskPDF(pdfData);

        // Zapisz audyt druku
        await supabase.from('PrintAudit').insert({
            documentType: 'graphics_task',
            documentId: String(taskId),
            printedBy: authId,
            templateVersion: '1.0',
            printCount: 1
        });

        // Zwróć PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="zlecenie-graficzne-${taskId}.pdf"`);
        res.send(pdfBuffer);

    } catch (error) {
        console.error(`${tag} Wyjątek:`, error);
        return res.status(500).json({ status: 'error', message: 'Błąd generowania PDF' });
    }
});

/**
 * GET /api/orders/:id/packing-list/print
 * Generuje PDF listy kompletacyjnej
 * Uprawnienia: SALES_DEPT, ADMIN, WAREHOUSE, PRODUCTION, OPERATOR, PRODUCTION_MANAGER
 */
app.get('/api/orders/:id/packing-list/print', async (req, res) => {
    const tag = '[GET /api/orders/:id/packing-list/print]';
    console.log(`${tag} start, id=${req.params.id}`);

    try {
        const authId = req.cookies?.auth_id;
        const authRole = req.cookies?.auth_role;

        if (!authId) {
            return res.status(401).json({ status: 'error', message: 'Brak autoryzacji' });
        }

        const allowedRoles = ['ADMIN', 'SALES_DEPT', 'PRODUCTION_MANAGER', 'WAREHOUSE', 'PRODUCTION', 'OPERATOR'];
        if (!allowedRoles.includes(authRole)) {
            return res.status(403).json({ status: 'error', message: 'Brak uprawnień do druku list kompletacyjnych' });
        }

        const orderId = req.params.id;

        // Pobierz zamówienie z klientem
        const { data: order, error: orderError } = await supabase
            .from('Order')
            .select(`
                id, orderNumber,
                Customer(name, address, city, zipCode)
            `)
            .eq('id', orderId)
            .single();

        if (orderError || !order) {
            console.log(`${tag} Nie znaleziono zamówienia:`, orderError);
            return res.status(404).json({ status: 'error', message: 'Nie znaleziono zamówienia' });
        }

        // Pobierz pozycje zamówienia
        const { data: orderItems, error: itemsError } = await supabase
            .from('OrderItem')
            .select(`
                id, quantity, locationName,
                Product(name, identifier)
            `)
            .eq('orderId', orderId);

        if (itemsError) {
            console.log(`${tag} Błąd pobierania pozycji:`, itemsError);
        }

        // Pobierz statusy produkcji dla każdej pozycji
        const items = [];
        for (const item of (orderItems || [])) {
            // Sprawdź czy jest ProductionOrder dla tej pozycji
            const { data: prodOrder } = await supabase
                .from('ProductionOrder')
                .select('status')
                .eq('sourceOrderItemId', item.id)
                .single();

            items.push({
                productName: item.Product?.name || item.Product?.identifier || '-',
                identifier: item.Product?.identifier || '-',
                locationName: item.locationName || '-',
                quantity: item.quantity || 0,
                productionStatus: prodOrder?.status || 'planned'
            });
        }

        // Przygotuj adres klienta
        const customer = order.Customer || {};
        const customerAddressParts = [customer.address, customer.zipCode, customer.city].filter(Boolean);
        const customerAddress = customerAddressParts.join(', ') || '-';

        // Przygotuj dane do PDF
        const pdfData = {
            orderNumber: order.orderNumber || '-',
            customerName: customer.name || '-',
            customerAddress,
            items
        };

        // Generuj PDF
        const pdfBuffer = await createPackingListPDF(pdfData);

        // Zapisz audyt druku
        await supabase.from('PrintAudit').insert({
            documentType: 'packing_list',
            documentId: orderId,
            printedBy: authId,
            templateVersion: '1.0',
            printCount: 1
        });

        // Zwróć PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="lista-kompletacyjna-${order.orderNumber}.pdf"`);
        res.send(pdfBuffer);

    } catch (error) {
        console.error(`${tag} Wyjątek:`, error);
        return res.status(500).json({ status: 'error', message: 'Błąd generowania PDF' });
    }
});

// POST /api/test/create-multi-product-order - endpoint testowy do tworzenia zamówienia z wieloma produktami
app.post('/api/test/create-multi-product-order', async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        const tag = '[TEST MULTI-PRODUCT]';
        console.log(`${tag} Tworzenie zamówienia testowego z wieloma produktami`);

        // 1. Utwórz produkty testowe ze ścieżką produkcyjną
        const testProducts = [
            { 
                code: 'PROD001', 
                name: 'Produkt Testowy 1', 
                identifier: 'TEST-001', 
                dimensions: '100x50x5mm',
                productionPath: 'laser_co2',
                price: 10,
                category: 'MAGNESY'
            },
            { 
                code: 'PROD002', 
                name: 'Produkt Testowy 2', 
                identifier: 'TEST-002', 
                dimensions: '150x75x5mm',
                productionPath: 'laser_co2',
                price: 12,
                category: 'MAGNESY'
            },
            { 
                code: 'PROD003', 
                name: 'Produkt Testowy 3', 
                identifier: 'TEST-003', 
                dimensions: '200x100x5mm',
                productionPath: 'laser_co2',
                price: 14,
                category: 'MAGNESY'
            }
        ];

        const productIdByCode = {};

        for (const product of testProducts) {
            const { data: existing } = await supabase
                .from('Product')
                .select('id, code, productionPath')
                .eq('code', product.code)
                .maybeSingle();
            
            if (!existing) {
                const { data: inserted, error: insertProductError } = await supabase
                    .from('Product')
                    .insert({
                        ...product,
                        price: product.price ?? 10,
                        category: product.category ?? 'MAGNESY',
                        availability: 'AVAILABLE'
                    })
                    .select('id, code, productionPath')
                    .single();

                if (insertProductError || !inserted) {
                    throw new Error(`Błąd tworzenia produktu ${product.code}: ${insertProductError?.message}`);
                }

                productIdByCode[product.code] = inserted.id;
                console.log(`${tag} Utworzono produkt: ${product.code} z productionPath: ${product.productionPath}`);
            } else {
                productIdByCode[product.code] = existing.id;

                if (!existing.productionPath) {
                    const { error: updateError } = await supabase
                        .from('Product')
                        .update({ productionPath: product.productionPath })
                        .eq('id', existing.id);

                    if (updateError) {
                        throw new Error(`Błąd aktualizacji product.productionPath: ${updateError.message}`);
                    }

                    console.log(`${tag} Zaktualizowano produkt: ${product.code} z productionPath: ${product.productionPath}`);
                } else {
                    console.log(`${tag} Produkt ${product.code} już istnieje z productionPath: ${existing.productionPath}`);
                }
            }
        }

        // 2. Znajdź użytkownika testowego (ADMIN / SALES_DEPT) do przypisania zamówienia
        const { data: testUsers, error: userError } = await supabase
            .from('User')
            .select('id, role')
            .in('role', ['ADMIN', 'SALES_DEPT', 'SALES_REP'])
            .order('role', { ascending: true })
            .limit(1);

        let userForOrder = testUsers && testUsers.length > 0 ? testUsers[0] : null;

        if (!userForOrder) {
            // Spróbuj pobrać użytkownika z istniejącego zamówienia
            const { data: fallbackOrder, error: fallbackError } = await supabase
                .from('Order')
                .select('userId')
                .not('userId', 'is', null)
                .order('createdAt', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (fallbackError) {
                console.warn(`${tag} Nie udało się pobrać fallbackowego userId:`, fallbackError.message);
            }

            if (fallbackOrder && fallbackOrder.userId) {
                userForOrder = { id: fallbackOrder.userId, role: 'UNKNOWN' };
                console.log(`${tag} Używam userId z istniejącego zamówienia: ${fallbackOrder.userId}`);
            }
        }

        if (!userForOrder) {
            throw new Error(`Brak użytkownika z rolą ADMIN/SALES w bazie – dodaj co najmniej jednego użytkownika lub ustaw ręcznie TEST_USER_ID`);
        }

        // 2. Znajdź lub utwórz klienta testowego
        const { data: customer } = await supabase
            .from('Customer')
            .select('id, name')
            .eq('name', 'TEST Klient')
            .single();

        let customerId;
        if (customer) {
            customerId = customer.id;
        } else {
            // Utwórz klienta testowego
            const { data: newCustomer, error: customerError } = await supabase
                .from('Customer')
                .insert({
                    name: 'TEST Klient',
                    city: 'Testowo',
                    phone: '123456789',
                    email: 'test@example.com'
                })
                .select()
                .single();
            
            if (customerError || !newCustomer) {
                throw new Error(`Błąd tworzenia klienta: ${customerError?.message || 'Brak danych'}`);
            }
            customerId = newCustomer.id;
        }

        // 3. Utwórz zamówienie
        const randomItems = [];
        let total = 0;
        for (const product of testProducts) {
            const quantity = 20 + Math.floor(Math.random() * 50);
            const unitPrice = 10; // symboliczna cena na potrzeby testów
            randomItems.push({ ...product, quantity, unitPrice });
            total += quantity * unitPrice;
        }

        const { data: order } = await supabase
            .from('Order')
            .insert({
                customerId,
                orderNumber: `TEST-${Date.now()}`,
                status: 'APPROVED',
                total,
                userId: userForOrder.id,
                notes: 'Zamówienie testowe z wieloma produktami dla widoku Zbiorczego ZP'
            })
            .select()
            .single();

        if (!order) {
            throw new Error('Nie udało się utworzyć zamówienia testowego');
        }

        // 4. Utwórz pozycje zamówienia
        const orderItemsPayload = randomItems.map(item => ({
            orderId: order.id,
            productId: productIdByCode[item.code],
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalQuantity: item.quantity,
            source: 'MIEJSCOWOSCI',
            productionNotes: 'Testowe ZP'
        }));

        const { error: orderItemsError } = await supabase
            .from('OrderItem')
            .insert(orderItemsPayload);

        if (orderItemsError) {
            throw new Error(`Błąd tworzenia pozycji zamówienia: ${orderItemsError.message}`);
        }

        // 5. Utwórz zlecenia produkcyjne (ZP) - to powinno stworzyć ProductionWorkOrder i połączyć z ProductionOrder
        await createProductionOrdersForOrder(order.id);

        console.log(`${tag} Utworzono zamówienie testowe: ${order.orderNumber}`);

        return res.json({
            status: 'success',
            data: {
                orderNumber: order.orderNumber,
                orderId: order.id,
                products: testProducts
            }
        });

    } catch (error) {
        console.error('[TEST MULTI-PRODUCT] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: error.message || 'Błąd tworzenia zamówienia testowego' });
    }
});

// GET /api/test/diagnostics - endpoint diagnostyczny do sprawdzania stanu systemu
app.get('/api/test/diagnostics', async (req, res) => {
    if (!supabase) {
        return res.json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        const diagnostics = {
            timestamp: new Date().toISOString(),
            tables: {},
            data: {},
            issues: []
        };

        // Sprawdź tabele
        const tables = [
            'ProductionWorkOrder',
            'ProductionOrder', 
            'ProductionOperation',
            'Order',
            'OrderItem',
            'Customer',
            'Product'
        ];

        for (const tableName of tables) {
            try {
                const { count, error } = await supabase
                    .from(tableName)
                    .select('*', { count: 'exact', head: true });
                
                diagnostics.tables[tableName] = {
                    exists: !error,
                    count: count || 0,
                    error: error?.message
                };
            } catch (e) {
                diagnostics.tables[tableName] = {
                    exists: false,
                    count: 0,
                    error: e.message
                };
            }
        }

        // Sprawdź zlecenia produkcyjne i ich powiązania
        if (diagnostics.tables.ProductionOrder.exists) {
            const { data: orders, error: ordersError } = await supabase
                .from('ProductionOrder')
                .select('id, "workOrderId", status, quantity')
                .order('id', { ascending: false })
                .limit(20);
            
            diagnostics.data.recentOrders = orders || [];
            if (ordersError) diagnostics.issues.push(`Błąd pobierania ProductionOrder: ${ordersError.message}`);

            // Grupuj po workOrderId
            const groupedOrders = {};
            (orders || []).forEach(order => {
                const woId = order.workOrderId || order['workOrderId'];
                if (woId) {
                    if (!groupedOrders[woId]) groupedOrders[woId] = [];
                    groupedOrders[woId].push(order);
                }
            });

            diagnostics.data.groupedByWorkOrder = Object.entries(groupedOrders)
                .filter(([_, items]) => items.length > 1)
                .map(([woId, items]) => ({
                    workOrderId: woId,
                    itemCount: items.length,
                    totalQuantity: items.reduce((sum, o) => sum + (o.quantity || 0), 0),
                    statuses: [...new Set(items.map(o => o.status))]
                }));

            if (diagnostics.data.groupedByWorkOrder.length === 0) {
                diagnostics.issues.push('Brak zleceń pogrupowanych w ZP (workOrderId)');
            }
        }

        // Sprawdź operacje dla zleceń
        if (diagnostics.tables.ProductionOperation.exists && diagnostics.data.recentOrders) {
            const orderIds = diagnostics.data.recentOrders.map(o => o.id);
            if (orderIds.length > 0) {
                const { data: operations, error: opsError } = await supabase
                    .from('ProductionOperation')
                    .select('productionorderid, operationtype, status')
                    .in('productionorderid', orderIds);
                
                diagnostics.data.operations = operations || [];
                if (opsError) diagnostics.issues.push(`Błąd pobierania ProductionOperation: ${opsError.message}`);

                // Sprawdź które zlecenia mają operacje
                const ordersWithOps = new Set((operations || []).map(op => op.productionorderid));
                const ordersWithoutOps = (diagnostics.data.recentOrders || [])
                    .filter(o => !ordersWithOps.has(o.id))
                    .map(o => o.id);

                if (ordersWithoutOps.length > 0) {
                    diagnostics.issues.push(`${ordersWithoutOps.length} zleceń bez operacji: ${ordersWithoutOps.join(', ')}`);
                }
            }
        }

        // Sprawdź produkty testowe
        if (diagnostics.tables.Product.exists) {
            const { data: testProducts, error: testError } = await supabase
                .from('Product')
                .select('code, name')
                .in('code', ['PROD001', 'PROD002', 'PROD003']);
            
            diagnostics.data.testProducts = testProducts || [];
            if (testError) diagnostics.issues.push(`Błąd sprawdzania produktów testowych: ${testError.message}`);
            
            if (testProducts.length < 3) {
                diagnostics.issues.push(`Brak wszystkich produktów testowych (znaleziono: ${testProducts.length}/3)`);
            }
        }

        // Podsumowanie
        diagnostics.summary = {
            totalIssues: diagnostics.issues.length,
            hasGroupedOrders: (diagnostics.data.groupedByWorkOrder || []).length > 0,
            hasTestProducts: (diagnostics.data.testProducts || []).length === 3,
            tablesReady: Object.values(diagnostics.tables).every(t => t.exists)
        };

        return res.json({ status: 'success', data: diagnostics });

    } catch (error) {
        console.error('[DIAGNOSTICS] Wyjątek:', error);
        return res.status(500).json({ status: 'error', message: error.message });
    }
});

// ============================================
// UWAGA: Endpointy akcji operatora (/start, /pause, /complete, /problem, /cancel)
// są zdefiniowane wyżej w sekcji "PANEL OPERATORA - DEDYKOWANE ENDPOINTY"
// (linie ~7959-8282). Nie duplikować!
// ============================================

// =============================================
// WORK CENTER PATH MAPPING - EDYTOR ŚCIEŻEK
// =============================================

/**
 * GET /api/production/path-codes
 * Zwraca unikalne kody ścieżek z Product.productionPath
 */
app.get('/api/production/path-codes', requireRole(['ADMIN', 'PRODUCTION_MANAGER']), async (req, res) => {
    const tag = '[GET /api/production/path-codes]';
    
    try {
        // Pobierz wszystkie aktywne produkty z productionPath
        const { data: products, error } = await supabase
            .from('Product')
            .select('"productionPath"')
            .eq('isActive', true)
            .not('productionPath', 'is', null)
            .limit(1000);

        if (error) {
            console.error(`${tag} Błąd pobierania produktów:`, error);
            return res.status(500).json({ status: 'error', message: 'Błąd pobierania produktów' });
        }

        // Funkcja do parsowania wyrażenia ścieżki produktu
        function parsePathExpression(expr) {
            if (!expr) return [];
            // Traktujemy %, $, & jako separatory
            const normalized = expr.replace(/[%$&]/g, '|');
            return normalized.split('|').map(s => s.trim()).filter(Boolean);
        }

        const pathCodesSet = new Set();
        const pathDetails = [];

        for (const product of products || []) {
            if (!product.productionPath) continue;
            const codes = parsePathExpression(product.productionPath);
            for (const code of codes) {
                if (!pathCodesSet.has(code)) {
                    pathCodesSet.add(code);
                    pathDetails.push({
                        code,
                        baseCode: code.split('.')[0], // np. 5.1 -> 5
                        examplePath: product.productionPath
                    });
                }
            }
        }

        // Sortuj: najpierw numeryczne, potem alfabetycznie
        pathDetails.sort((a, b) => {
            const aNum = parseFloat(a.code);
            const bNum = parseFloat(b.code);
            if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
            return a.code.localeCompare(b.code);
        });

        console.log(`${tag} Znaleziono ${pathDetails.length} unikalnych kodów ścieżek`);

        return res.json({
            status: 'success',
            data: {
                paths: pathDetails,
                total: pathDetails.length
            }
        });

    } catch (error) {
        console.error(`${tag} Wyjątek:`, error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

/**
 * GET /api/production/workcenters/:workCenterId/path-mappings
 * Pobiera mapowania ścieżek dla danego gniazda
 */
app.get('/api/production/workcenters/:workCenterId/path-mappings', requireRole(['ADMIN', 'PRODUCTION_MANAGER']), async (req, res) => {
    const tag = '[GET /api/production/workcenters/:workCenterId/path-mappings]';
    const workCenterId = parseInt(req.params.workCenterId);
    
    try {
        const { data: mappings, error } = await supabase
            .from('WorkCenterPathMapping')
            .select('*')
            .eq('workcenterid', workCenterId)
            .eq('isactive', true)
            .order('pathcode');

        if (error) {
            console.error(`${tag} Błąd pobierania mapowań:`, error);
            return res.status(500).json({ status: 'error', message: 'Błąd pobierania mapowań' });
        }

        console.log(`${tag} WorkCenter ${workCenterId}: ${mappings?.length || 0} mapowań`);

        return res.json({
            status: 'success',
            data: {
                workCenterId,
                mappings: mappings || []
            }
        });

    } catch (error) {
        console.error(`${tag} Wyjątek:`, error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

/**
 * POST /api/production/workcenters/:workCenterId/path-mappings
 * Dodaje mapowanie ścieżki do gniazda
 */
app.post('/api/production/workcenters/:workCenterId/path-mappings', requireRole(['ADMIN', 'PRODUCTION_MANAGER']), async (req, res) => {
    const tag = '[POST /api/production/workcenters/:workCenterId/path-mappings]';
    const workCenterId = parseInt(req.params.workCenterId);
    const { pathCode } = req.body;
    
    if (!pathCode || typeof pathCode !== 'string') {
        return res.status(400).json({ status: 'error', message: 'pathCode jest wymagany' });
    }

    try {
        const { data: mapping, error } = await supabase
            .from('WorkCenterPathMapping')
            .insert({
                workcenterid: workCenterId,
                pathcode: pathCode.trim()
            })
            .select()
            .single();

        if (error) {
            if (error.code === '23505') {
                return res.status(409).json({ status: 'error', message: 'To mapowanie już istnieje' });
            }
            console.error(`${tag} Błąd dodawania mapowania:`, error);
            return res.status(500).json({ status: 'error', message: 'Błąd dodawania mapowania' });
        }

        console.log(`${tag} Dodano mapowanie: WorkCenter ${workCenterId} -> ${pathCode}`);

        return res.json({
            status: 'success',
            message: 'Mapowanie zostało dodane',
            data: mapping
        });

    } catch (error) {
        console.error(`${tag} Wyjątek:`, error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

/**
 * DELETE /api/production/workcenters/:workCenterId/path-mappings/:pathCode
 * Usuwa (dezaktywuje) mapowanie ścieżki
 */
app.delete('/api/production/workcenters/:workCenterId/path-mappings/:pathCode', requireRole(['ADMIN', 'PRODUCTION_MANAGER']), async (req, res) => {
    const tag = '[DELETE /api/production/workcenters/:workCenterId/path-mappings/:pathCode]';
    const workCenterId = parseInt(req.params.workCenterId);
    const pathCode = req.params.pathCode;
    
    try {
        const { error } = await supabase
            .from('WorkCenterPathMapping')
            .update({ isactive: false })
            .eq('workcenterid', workCenterId)
            .eq('pathcode', pathCode);

        if (error) {
            console.error(`${tag} Błąd usuwania mapowania:`, error);
            return res.status(500).json({ status: 'error', message: 'Błąd usuwania mapowania' });
        }

        console.log(`${tag} Usunięto mapowanie: WorkCenter ${workCenterId} -> ${pathCode}`);

        return res.json({
            status: 'success',
            message: 'Mapowanie zostało usunięte'
        });

    } catch (error) {
        console.error(`${tag} Wyjątek:`, error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// =============================================
// MACHINE PRODUCT ASSIGNMENTS - KANBAN MANAGERA
// =============================================

const WORKCENTER_TYPE_TO_PATH_CODES = {
    laser_co2: ['3'],
    uv_print: ['1'],
    solvent: ['2'],
};

// =============================================
// HELPERY UPRAWNIEŃ PRODUKCYJNYCH (MES-compliant)
// =============================================

/**
 * Typy dostępu do pokoju produkcyjnego
 */
const ROOM_ACCESS = {
    NONE: 'none',           // Brak dostępu
    VIEW: 'view',           // Tylko podgląd
    OPERATE: 'operate',     // Wykonywanie operacji (operator)
    MANAGE: 'manage',       // Zarządzanie przypisaniami (room manager)
    FULL: 'full'            // Pełny dostęp (admin)
};

/**
 * Sprawdza czy user jest managerem pokoju lub ADMIN
 * @param {string} userId - ID użytkownika
 * @param {string} userRole - Aktywna rola użytkownika
 * @param {number} roomId - ID pokoju produkcyjnego
 * @returns {Promise<boolean>}
 */
async function isRoomManagerOrAdmin(userId, userRole, roomId) {
    if (userRole === 'ADMIN') return true;
    if (!supabase || !roomId) return false;
    
    const { data: room } = await supabase
        .from('ProductionRoom')
        .select('"roomManagerUserId"')
        .eq('id', roomId)
        .single();
    
    return room && room.roomManagerUserId === userId;
}

/**
 * Sprawdza czy użytkownik jest przypisany do danego pokoju (jako operator)
 * @param {string} userId - ID użytkownika
 * @param {number} roomId - ID pokoju produkcyjnego
 * @returns {Promise<boolean>}
 */
async function isUserAssignedToRoom(userId, roomId) {
    if (!supabase || !userId || !roomId) return false;
    
    const { data: user } = await supabase
        .from('User')
        .select('productionroomid')
        .eq('id', userId)
        .single();
    
    return user?.productionroomid === roomId;
}

/**
 * Określa poziom dostępu użytkownika do pokoju produkcyjnego
 * 
 * Matryca uprawnień (MES-compliant):
 * - ADMIN: FULL (wszędzie)
 * - PRODUCTION_MANAGER + roomManagerUserId: MANAGE (w swoim pokoju)
 * - PRODUCTION_MANAGER (bez przypisania): VIEW (wszędzie)
 * - PRODUCTION: VIEW (wszędzie)
 * - OPERATOR + productionroomid: OPERATE (w swoim pokoju)
 * - OPERATOR (inny pokój): NONE
 * - Inne role: NONE
 * 
 * @param {string} userId - ID użytkownika
 * @param {string} userRole - Aktywna rola użytkownika
 * @param {number} roomId - ID pokoju produkcyjnego
 * @returns {Promise<string>} - Poziom dostępu z ROOM_ACCESS
 */
async function getRoomAccessLevel(userId, userRole, roomId) {
    // ADMIN ma pełny dostęp wszędzie
    if (userRole === 'ADMIN') {
        return ROOM_ACCESS.FULL;
    }
    
    // Sprawdź czy jest room managerem
    const isRoomManager = await isRoomManagerOrAdmin(userId, userRole, roomId);
    
    // PRODUCTION_MANAGER
    if (userRole === 'PRODUCTION_MANAGER') {
        return isRoomManager ? ROOM_ACCESS.MANAGE : ROOM_ACCESS.VIEW;
    }
    
    // PRODUCTION (brygadzista) - podgląd wszędzie
    if (userRole === 'PRODUCTION') {
        return ROOM_ACCESS.VIEW;
    }
    
    // OPERATOR - tylko swój pokój
    if (userRole === 'OPERATOR') {
        const isAssigned = await isUserAssignedToRoom(userId, roomId);
        return isAssigned ? ROOM_ACCESS.OPERATE : ROOM_ACCESS.NONE;
    }
    
    // Inne role - brak dostępu do modułu produkcji
    return ROOM_ACCESS.NONE;
}

/**
 * Sprawdza czy użytkownik może zarządzać przypisaniami w pokoju
 * (dodawać/usuwać produkty z maszyn, zmieniać restrykcje)
 * 
 * @param {string} userId - ID użytkownika
 * @param {string} userRole - Aktywna rola użytkownika
 * @param {number} roomId - ID pokoju produkcyjnego
 * @returns {Promise<boolean>}
 */
async function canManageRoomAssignments(userId, userRole, roomId) {
    const accessLevel = await getRoomAccessLevel(userId, userRole, roomId);
    return accessLevel === ROOM_ACCESS.FULL || accessLevel === ROOM_ACCESS.MANAGE;
}

/**
 * Sprawdza czy użytkownik może przeglądać dane pokoju
 * 
 * @param {string} userId - ID użytkownika
 * @param {string} userRole - Aktywna rola użytkownika
 * @param {number} roomId - ID pokoju produkcyjnego
 * @returns {Promise<boolean>}
 */
async function canViewRoom(userId, userRole, roomId) {
    const accessLevel = await getRoomAccessLevel(userId, userRole, roomId);
    return accessLevel !== ROOM_ACCESS.NONE;
}

/**
 * Sprawdza czy użytkownik może wykonywać operacje produkcyjne w pokoju
 * 
 * @param {string} userId - ID użytkownika
 * @param {string} userRole - Aktywna rola użytkownika
 * @param {number} roomId - ID pokoju produkcyjnego
 * @returns {Promise<boolean>}
 */
async function canOperateInRoom(userId, userRole, roomId) {
    const accessLevel = await getRoomAccessLevel(userId, userRole, roomId);
    return [ROOM_ACCESS.FULL, ROOM_ACCESS.MANAGE, ROOM_ACCESS.OPERATE].includes(accessLevel);
}

// =============================================
// KONIEC HELPERÓW UPRAWNIEŃ PRODUKCYJNYCH
// =============================================

/**
 * GET /api/production/rooms/:roomId/machine-assignments
 * Zwraca dane do Kanban: maszyny z przypisaniami + produkty bez przypisań
 * Dostęp: ADMIN, PRODUCTION_MANAGER, PRODUCTION, OPERATOR (tylko własny pokój)
 */
app.get('/api/production/rooms/:roomId/machine-assignments', requireRole(['ADMIN', 'PRODUCTION_MANAGER', 'PRODUCTION', 'OPERATOR']), async (req, res) => {
    const tag = '[GET /api/production/rooms/:roomId/machine-assignments]';
    const roomId = parseInt(req.params.roomId);
    const cookies = parseCookies(req);
    const userId = cookies.auth_id;
    const userRole = cookies.auth_role;

    try {
        // Sprawdź uprawnienia używając nowego helpera (MES-compliant)
        const accessLevel = await getRoomAccessLevel(userId, userRole, roomId);
        
        if (accessLevel === ROOM_ACCESS.NONE) {
            return res.status(403).json({ status: 'error', message: 'Brak uprawnień do tego pokoju' });
        }
        
        // Dodaj informację o poziomie dostępu do odpowiedzi (dla UI)
        const canManage = [ROOM_ACCESS.FULL, ROOM_ACCESS.MANAGE].includes(accessLevel);

        // Pobierz dane pokoju
        const { data: room, error: roomError } = await supabase
            .from('ProductionRoom')
            .select('id, name, code')
            .eq('id', roomId)
            .single();

        if (roomError || !room) {
            return res.status(404).json({ status: 'error', message: 'Pokój nie znaleziony' });
        }

        // Pobierz maszyny w pokoju (przez WorkCenter)
        const { data: machines, error: machinesError } = await supabase
            .from('WorkStation')
            .select(`
                id, name, code, status, "isActive", "restrictToAssignedProducts", type,
                "WorkCenter"!inner(id, "roomId", type)
            `)
            .eq('WorkCenter.roomId', roomId)
            .eq('isActive', true);

        if (machinesError) {
            console.error(`${tag} Błąd pobierania maszyn:`, machinesError);
            return res.status(500).json({ status: 'error', message: 'Błąd pobierania maszyn' });
        }

        // Pobierz wszystkie przypisania dla maszyn w tym pokoju
        const machineIds = machines?.map(m => m.id) || [];
        let assignments = [];
        if (machineIds.length > 0) {
            const { data: assignmentsData, error: assignmentsError } = await supabase
                .from('MachineProductAssignment')
                .select(`
                    workstationid, productid, notes,
                    "Product"(id, name, identifier)
                `)
                .in('workstationid', machineIds);

            if (assignmentsError) {
                console.error(`${tag} Błąd pobierania przypisań maszyn:`, assignmentsError);
            } else {
                assignments = assignmentsData || [];
            }
        }

        // Mapuj przypisania do maszyn
        const machinesWithProducts = (machines || []).map(machine => {
            const machineAssignments = assignments.filter(a => a.workstationid === machine.id);
            return {
                id: machine.id,
                name: machine.name,
                code: machine.code,
                status: machine.status,
                isActive: machine.isActive,
                restrictToAssignedProducts: machine.restrictToAssignedProducts || false,
                products: machineAssignments.map(a => ({
                    id: a.Product?.id || a.productid,
                    name: a.Product?.name || 'Nieznany produkt',
                    identifier: a.Product?.identifier || '',
                    notes: a.notes
                }))
            };
        });

        // Ustal kody ścieżek dopuszczalne w tym pokoju na podstawie mapowań WorkCenterPathMapping
        const workCenterIds = [...new Set(machines?.map(m => m.WorkCenter?.id).filter(Boolean))];
        let roomPathCodes = new Set();
        
        if (workCenterIds.length > 0) {
            // Pobierz aktywne mapowania dla wszystkich gniazd w tym pokoju
            const { data: mappings, error: mappingError } = await supabase
                .from('WorkCenterPathMapping')
                .select('workcenterid, pathcode')
                .in('workcenterid', workCenterIds)
                .eq('isactive', true);
            
            if (!mappingError && mappings) {
                mappings.forEach(m => roomPathCodes.add(m.pathcode));
                console.log(`${tag} Załadowano ${mappings.length} mapowań dla ${workCenterIds.length} gniazd w pokoju ${roomId}`);
            } else {
                console.warn(`${tag} Błąd pobierania mapowań, używam fallbacku:`, mappingError?.message);
            }
        }
        
        // Fallback: jeśli nie ma mapowań, użyj stałej WORKCENTER_TYPE_TO_PATH_CODES
        if (roomPathCodes.size === 0) {
            for (const machine of machines || []) {
                const wcType = machine.WorkCenter?.type || machine.type;
                if (!wcType) continue;
                const mapped = WORKCENTER_TYPE_TO_PATH_CODES[wcType];
                if (mapped && mapped.length > 0) {
                    mapped.forEach(code => roomPathCodes.add(code));
                }
            }
            console.log(`${tag} Użyto fallbacku WORKCENTER_TYPE_TO_PATH_CODES dla pokoju ${roomId}:`, Array.from(roomPathCodes));
        }

        // Funkcja do parsowania wyrażenia ścieżki produktu
        function parsePathExpression(expr) {
            if (!expr) return [];
            // Ścieżki równoległe/szeregowe: 5%3, 5$3, 5%3&2.1 → ["5","3","2.1"]
            // Traktujemy %, $, & jako separatory pomiędzy gałęziami/etapami
            const normalized = expr.replace(/[%$&]/g, '|');
            return normalized.split('|').map(s => s.trim()).filter(Boolean);
        }

        // Pobierz produkty bez przypisań w tym pokoju, filtrowane po ścieżce
        const assignedProductIds = assignments.map(a => a.productid);
        let unassignedProducts = [];

        const { data: allProducts } = await supabase
            .from('Product')
            .select('id, name, identifier, "productionPath"')
            .eq('isActive', true)
            .limit(500);

        if (allProducts) {
            const withPath = allProducts.filter(p => p.productionPath && p.productionPath.trim() !== '');
            const withoutPath = allProducts.filter(p => !p.productionPath || p.productionPath.trim() === '');
            console.log(`${tag} Produkty: ${allProducts.length} total, ${withPath.length} z productionPath, ${withoutPath.length} bez/"" productionPath`);
            console.log(`${tag} roomPathCodes dla pokoju ${roomId}:`, Array.from(roomPathCodes));

            unassignedProducts = withPath.filter(p => {
                if (assignedProductIds.includes(p.id)) return false;

                const pathCodes = parsePathExpression(p.productionPath);

                // Produkt pasuje, jeśli którakolwiek z jego ścieżek (lub ich prefiks przed kropką) jest w roomPathCodes
                const matches = pathCodes.some(code => {
                    if (roomPathCodes.has(code)) return true;
                    const base = code.split('.')[0];
                    return roomPathCodes.has(base);
                });

                return matches;
            });
        }

        console.log(`${tag} Pokój ${roomId}: ${machinesWithProducts.length} maszyn, ${unassignedProducts.length} nieprzypisanych produktów, accessLevel: ${accessLevel}`);

        return res.json({
            status: 'success',
            data: {
                room,
                machines: machinesWithProducts,
                unassignedProducts,
                // Informacje o uprawnieniach dla UI (MES-compliant)
                permissions: {
                    accessLevel,
                    canManage,
                    canOperate: [ROOM_ACCESS.FULL, ROOM_ACCESS.MANAGE, ROOM_ACCESS.OPERATE].includes(accessLevel),
                    canView: true
                }
            }
        });

    } catch (error) {
        console.error(`${tag} Wyjątek:`, error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

/**
 * POST /api/production/machine-assignments
 * Dodaje przypisanie produktu do maszyny
 */
app.post('/api/production/machine-assignments', requireRole(['ADMIN', 'PRODUCTION_MANAGER']), async (req, res) => {
    const tag = '[POST /api/production/machine-assignments]';
    const cookies = parseCookies(req);
    const userId = cookies.auth_id;
    const userRole = cookies.auth_role;
    const { workStationId, productId, notes } = req.body;

    try {
        if (!workStationId || !productId) {
            return res.status(400).json({ status: 'error', message: 'Wymagane: workStationId, productId' });
        }

        // Znajdź pokój maszyny i sprawdź uprawnienia
        const { data: machine } = await supabase
            .from('WorkStation')
            .select(`
                id,
                "WorkCenter"!inner(id, "roomId")
            `)
            .eq('id', workStationId)
            .single();

        if (!machine) {
            return res.status(404).json({ status: 'error', message: 'Maszyna nie znaleziona' });
        }

        const roomId = machine.WorkCenter?.roomId;
        // Użyj nowego helpera MES-compliant
        const canManage = await canManageRoomAssignments(userId, userRole, roomId);
        if (!canManage) {
            return res.status(403).json({ status: 'error', message: 'Brak uprawnień do zarządzania przypisaniami w tym pokoju' });
        }

        // Dodaj przypisanie
        const { data: assignment, error: insertError } = await supabase
            .from('MachineProductAssignment')
            .insert({
                workstationid: workStationId,
                productid: productId,
                assignedby: userId,
                notes: notes || null
            })
            .select()
            .single();

        if (insertError) {
            if (insertError.code === '23505') { // unique violation
                return res.status(409).json({ status: 'error', message: 'Produkt jest już przypisany do tej maszyny' });
            }
            console.error(`${tag} Błąd dodawania:`, insertError);
            return res.status(500).json({ status: 'error', message: 'Błąd dodawania przypisania' });
        }

        console.log(`${tag} Przypisano produkt ${productId} do maszyny ${workStationId} przez ${userId}`);
        return res.json({ status: 'success', data: assignment });

    } catch (error) {
        console.error(`${tag} Wyjątek:`, error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

/**
 * DELETE /api/production/machine-assignments/:workStationId/:productId
 * Usuwa przypisanie produktu z maszyny
 */
app.delete('/api/production/machine-assignments/:workStationId/:productId', requireRole(['ADMIN', 'PRODUCTION_MANAGER']), async (req, res) => {
    const tag = '[DELETE /api/production/machine-assignments]';
    const cookies = parseCookies(req);
    const userId = cookies.auth_id;
    const userRole = cookies.auth_role;
    const workStationId = parseInt(req.params.workStationId);
    const productId = req.params.productId;

    try {
        // Znajdź pokój maszyny i sprawdź uprawnienia
        const { data: machine } = await supabase
            .from('WorkStation')
            .select(`
                id,
                "WorkCenter"!inner(id, "roomId")
            `)
            .eq('id', workStationId)
            .single();

        if (!machine) {
            return res.status(404).json({ status: 'error', message: 'Maszyna nie znaleziona' });
        }

        const roomId = machine.WorkCenter?.roomId;
        // Użyj nowego helpera MES-compliant
        const canManage = await canManageRoomAssignments(userId, userRole, roomId);
        if (!canManage) {
            return res.status(403).json({ status: 'error', message: 'Brak uprawnień do zarządzania przypisaniami w tym pokoju' });
        }

        // Usuń przypisanie
        const { data: deleted, error: deleteError } = await supabase
            .from('MachineProductAssignment')
            .delete()
            .eq('workstationid', workStationId)
            .eq('productid', productId)
            .select();

        if (deleteError) {
            console.error(`${tag} Błąd usuwania:`, deleteError);
            return res.status(500).json({ status: 'error', message: 'Błąd usuwania przypisania' });
        }

        console.log(`${tag} Usunięto przypisanie produktu ${productId} z maszyny ${workStationId}`);
        return res.json({ status: 'success', deleted: deleted?.length || 0 });

    } catch (error) {
        console.error(`${tag} Wyjątek:`, error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

/**
 * PATCH /api/production/workstations/:id/restriction
 * Zmienia flagę restrictToAssignedProducts na maszynie
 */
app.patch('/api/production/workstations/:id/restriction', requireRole(['ADMIN', 'PRODUCTION_MANAGER']), async (req, res) => {
    const tag = '[PATCH /api/production/workstations/:id/restriction]';
    const cookies = parseCookies(req);
    const userId = cookies.auth_id;
    const userRole = cookies.auth_role;
    const workStationId = parseInt(req.params.id);
    const { restrictToAssignedProducts } = req.body;

    try {
        if (typeof restrictToAssignedProducts !== 'boolean') {
            return res.status(400).json({ status: 'error', message: 'Wymagane: restrictToAssignedProducts (boolean)' });
        }

        // Znajdź pokój maszyny i sprawdź uprawnienia
        const { data: machine } = await supabase
            .from('WorkStation')
            .select(`
                id,
                "WorkCenter"!inner(id, "roomId")
            `)
            .eq('id', workStationId)
            .single();

        if (!machine) {
            return res.status(404).json({ status: 'error', message: 'Maszyna nie znaleziona' });
        }

        const roomId = machine.WorkCenter?.roomId;
        // Użyj nowego helpera MES-compliant
        const canManage = await canManageRoomAssignments(userId, userRole, roomId);
        if (!canManage) {
            return res.status(403).json({ status: 'error', message: 'Brak uprawnień do zarządzania restrykcjami w tym pokoju' });
        }

        // Zaktualizuj flagę
        const { data: updated, error: updateError } = await supabase
            .from('WorkStation')
            .update({ 
                restrictToAssignedProducts,
                updatedAt: new Date().toISOString()
            })
            .eq('id', workStationId)
            .select('id, name, "restrictToAssignedProducts"')
            .single();

        if (updateError) {
            console.error(`${tag} Błąd aktualizacji:`, updateError);
            return res.status(500).json({ status: 'error', message: 'Błąd aktualizacji' });
        }

        console.log(`${tag} Maszyna ${workStationId}: restrictToAssignedProducts = ${restrictToAssignedProducts}`);
        return res.json({ status: 'success', data: updated });

    } catch (error) {
        console.error(`${tag} Wyjątek:`, error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

/**
 * GET /api/production/rooms
 * Lista pokojów produkcyjnych (dla wyboru w UI)
 */
app.get('/api/production/rooms', requireRole(['ADMIN', 'PRODUCTION_MANAGER', 'PRODUCTION', 'OPERATOR']), async (req, res) => {
    const tag = '[GET /api/production/rooms]';

    try {
        const { data: rooms, error } = await supabase
            .from('ProductionRoom')
            .select('id, name, code, "isActive", "roomManagerUserId"')
            .eq('isActive', true)
            .order('name');

        if (error) {
            console.error(`${tag} Błąd:`, error);
            return res.status(500).json({ status: 'error', message: 'Błąd pobierania pokojów' });
        }

        return res.json({ status: 'success', data: rooms || [] });

    } catch (error) {
        console.error(`${tag} Wyjątek:`, error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    console.error('Niezłapany błąd:', err);
});

// Start serwera
const server = app.listen(PORT, () => {
    console.log(`Serwer działa na porcie ${PORT}`);    
    console.log(`Środowisko: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Adres testowy: http://localhost:${PORT}/api/health`);
});

server.on('error', (err) => {
    console.error('Błąd serwera:', err);
});

// Utrzymaj proces przy życiu
process.stdin.resume();
