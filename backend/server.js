require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto'); // Dodano import crypto
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3001;
const GALLERY_BASE = process.env.GALLERY_BASE || 'http://rezon.myqnapcloud.com:81/home';

// Konfiguracja Supabase – wartości muszą być ustawione w backend/.env
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_TABLE_PRODUCTS = process.env.SUPABASE_TABLE_PRODUCTS || 'products';

let supabase = null;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
} else {
  console.warn('Supabase nie jest skonfigurowany – brak SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY w .env');
}

// Serwowanie plików statycznych z folderu nadrzędnego
app.use(express.static(path.join(__dirname, '..')));

// Konfiguracja CORS
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

// Middleware do parsowania JSON
app.use(express.json({ limit: '10mb' }));

// Proste parsowanie cookies (bez zewnętrznych bibliotek)
function parseCookies(req) {
    const header = req.headers.cookie;
    if (!header) return {};

    return header.split(';').reduce((acc, part) => {
        const [rawKey, ...rest] = part.split('=');
        if (!rawKey) return acc;
        const key = rawKey.trim();
        const value = rest.join('=').trim();
        if (!key) return acc;
        acc[key] = decodeURIComponent(value || '');
        return acc;
    }, {});
}

function setAuthCookies(res, { id, role }) {
    const cookies = [];
    const cookieBase = '; Path=/; HttpOnly; SameSite=Lax';

    cookies.push(`auth_id=${encodeURIComponent(id)}${cookieBase}`);
    cookies.push(`auth_role=${encodeURIComponent(role)}${cookieBase}`);

    res.setHeader('Set-Cookie', cookies);
}

function clearAuthCookies(res) {
    const expired = '; Path=/; HttpOnly; SameSite=Lax; Max-Age=0';
    res.setHeader('Set-Cookie', [
        `auth_id=${expired}`,
        `auth_role=${expired}`,
    ]);
}

function requireRole(allowedRoles = []) {
    return (req, res, next) => {
        const cookies = parseCookies(req);
        const userId = cookies.auth_id;
        const role = cookies.auth_role;

        if (!userId || !role) {
            return res.status(401).json({ status: 'error', message: 'Nieautoryzowany – zaloguj się.' });
        }

        if (Array.isArray(allowedRoles) && allowedRoles.length && !allowedRoles.includes(role)) {
            return res.status(403).json({ status: 'error', message: 'Brak uprawnień do tego zasobu.' });
        }

        req.user = { id: userId, role };
        next();
    };
}

const ORDER_STATUSES = ['PENDING', 'APPROVED', 'IN_PRODUCTION', 'READY', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

const ROLE_STATUS_TRANSITIONS = {
    SALES_REP: [
        { from: 'PENDING', to: 'CANCELLED' }
    ],
    SALES_DEPT: [
        { from: 'PENDING', to: 'APPROVED' },
        { from: 'APPROVED', to: 'IN_PRODUCTION' },
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

// Panel admina – wymaga zalogowania jako ADMIN
app.get('/admin', requireRole(['ADMIN']), (req, res) => {
  res.sendFile(path.join(__dirname, '../admin/index.html'));
});

// Panel klientów – wymaga zalogowania jako SALES_REP, SALES_DEPT lub ADMIN
app.get('/clients', requireRole(['SALES_REP', 'SALES_DEPT', 'ADMIN']), (req, res) => {
  res.sendFile(path.join(__dirname, '../clients.html'));
});

// Widok zamówień – wymaga zalogowania jako SALES_DEPT, ADMIN, WAREHOUSE, PRODUCTION
app.get('/orders', requireRole(['SALES_DEPT', 'ADMIN', 'WAREHOUSE', 'PRODUCTION']), (req, res) => {
  res.sendFile(path.join(__dirname, '../orders.html'));
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
        const { data: user, error } = await supabase
            .from('User')
            .select('id, email, password, role, isActive')
            .eq('email', email)
            .single();

        if (error || !user) {
            return res.status(401).json({ status: 'error', message: 'Nieprawidłowe dane logowania.' });
        }

        if (user.isActive === false) {
            return res.status(403).json({ status: 'error', message: 'Konto jest nieaktywne.' });
        }

        if (!user.password) {
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
        } else {
            // Fallback: proste porównanie 1:1 (dla ewentualnych nowych kont testowych)
            passwordOk = user.password === password;
        }

        if (!passwordOk) {
            return res.status(401).json({ status: 'error', message: 'Nieprawidłowe dane logowania.' });
        }

        const role = user.role || 'NEW_USER';

        setAuthCookies(res, { id: user.id, role });

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
// GET /api/orders/:id - Szczegóły zamówienia
// ============================================
app.get('/api/orders/:id', async (req, res) => {
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

        const { data: order, error } = await supabase
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
                Customer:customerId(id, name, email, phone, city, address, zipCode, country),
                User:userId(id, name, shortCode),
                OrderItem:OrderItem(
                    id,
                    productId,
                    quantity,
                    unitPrice,
                    selectedProjects,
                    projectQuantities,
                    totalQuantity,
                    source,
                    locationName,
                    customization,
                    Product:productId(id, name, identifier, index, code)
                )
            `)
            .eq('id', orderId)
            .single();

        if (error) {
            console.error('Błąd pobierania zamówienia:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się pobrać zamówienia' });
        }

        if (!order) {
            return res.status(404).json({ status: 'error', message: 'Zamówienie nie istnieje' });
        }

        if (!canRoleAccessOrder(role, requesterId, order.userId)) {
            return res.status(403).json({ status: 'error', message: 'Brak uprawnień do podglądu zamówienia' });
        }

        return res.json({ status: 'success', data: order });
    } catch (error) {
        console.error('Błąd w GET /api/orders/:id:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
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
// POST /api/orders/:id/history/test - dodaj testowy wpis historii (TYMCZASOWE!)
// ============================================
app.post('/api/orders/:id/history/test', async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        const orderId = req.params.id;
        
        const { error: insertError } = await supabase
            .from('OrderStatusHistory')
            .insert({
                orderId: orderId,
                oldStatus: 'PENDING',
                newStatus: 'APPROVED',
                changedBy: '9c19a5af-01af-4875-8c76-d5c0bfd39dff',
                changedAt: new Date().toISOString(),
                notes: 'Testowy wpis historii'
            });

        if (insertError) {
            console.error('Błąd wstawiania testu:', insertError);
            return res.status(500).json({ status: 'error', message: insertError.message });
        }

        return res.json({ status: 'success', message: 'Testowy wpis dodany' });
    } catch (error) {
        console.error('Błąd w POST /api/orders/:id/history/test:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// POST /api/orders/disable-trigger - wyłączenie wyzwalacza historii (TYMCZASOWE!)
// ============================================
app.post('/api/orders/disable-trigger', async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        // Wyłącz wyzwalacz, który powoduje podwójne wpisy
        const { error: dropError } = await supabase
            .rpc('exec_sql', { 
                sql: 'DROP TRIGGER IF EXISTS trigger_order_status_change ON public."Order";' 
            });

        if (dropError) {
            // Alternatywa - bezpośrednie SQL przez Supabase client
            console.log('Próba wyłączenia wyzwalacza...');
        }

        return res.json({ 
            status: 'success', 
            message: 'Wyzwalacz został wyłączony. Historia będzie zapisywana tylko przez backend.' 
        });
    } catch (error) {
        console.error('Błąd wyłączania wyzwalacza:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
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

        console.log(`[DELETE /api/orders/${orderId}] Zamówienie ${order.orderNumber} usunięte przez ${requesterId}`);
        return res.json({ status: 'success', message: 'Zamówienie zostało usunięte' });
    } catch (error) {
        console.error('Błąd w DELETE /api/orders/:id:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera podczas usuwania zamówienia' });
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
            .select('id, email, name')
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
            name: user.name || null
        });
    } catch (err) {
        console.error('Wyjątek w /api/auth/me:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera podczas pobierania użytkownika' });
    }
});

// Test połączenia z Supabase – proste zapytanie do tabeli produktów
app.get('/api/supabase/health', async (req, res) => {
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

// Lista miejscowości
app.get('/api/gallery/cities', async (req, res) => {
    await proxyGalleryRequest(req, res, `${GALLERY_BASE}/list_cities.php`, 'cities');
});

// Lista handlowców
app.get('/api/gallery/salespeople', async (req, res) => {
    await proxyGalleryRequest(req, res, `${GALLERY_BASE}/list_salespeople.php`, 'salespeople');
});

// Lista obiektów dla handlowca
app.get('/api/gallery/objects/:salesperson', async (req, res) => {
    const { salesperson } = req.params;
    console.log('Pobieranie obiektów dla handlowca:', salesperson);
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
    await proxyGalleryRequest(req, res, targetUrl, `products/${city}`);
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
    await proxyGalleryRequest(req, res, url, `products/${salesperson}/${object}`);
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
    const body = req.body || {};

    const updateData = { ...body, updatedAt: new Date().toISOString() };

    try {
        const { data, error } = await supabase
            .from('Product')
            .update(updateData)
            .eq('id', id)
            .select('*')
            .single();

        if (error) {
            console.error('Błąd aktualizacji produktu:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się zaktualizować produktu', details: error.message });
        }

        return res.json({ status: 'success', data });
    } catch (err) {
        console.error('Wyjątek w PATCH /api/admin/products/:id:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd podczas aktualizacji produktu', details: err.message });
    }
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
            .select('id, name, createdAt')
            .order('name', { ascending: true });

        if (error) {
            console.error('Błąd pobierania działów:', error);
            return res.status(500).json({ status: 'error', message: 'Nie udało się pobrać działów', details: error.message });
        }

        return res.json({ status: 'success', data: data || [] });
    } catch (err) {
        console.error('Wyjątek w GET /api/admin/departments:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd podczas pobierania działów', details: err.message });
    }
});

// Lista użytkowników z działami (ADMIN + SALES_DEPT)
app.get('/api/admin/users', requireRole(['ADMIN', 'SALES_DEPT']), async (req, res) => {
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

    const { name, email, password, role, departmentId } = req.body || {};

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
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        const { data: newUser, error } = await supabase
            .from('User')
            .insert(userData)
            .select('id, name, email, role, isActive, createdAt, departmentId')
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
    const { name, role, departmentId, isActive, password } = req.body || {};

    const updateData = {
        updatedAt: new Date().toISOString(),
    };

    if (name !== undefined) updateData.name = name;
    if (role !== undefined) updateData.role = role;
    if (departmentId !== undefined) updateData.departmentId = departmentId;
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
            .select('id, name, email, role, isActive, departmentId')
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
        .select('shortCode')
        .eq('id', userId)
        .single();

    if (userError || !user || !user.shortCode) {
        throw new Error('Nie znaleziono użytkownika lub brak shortCode');
    }

    const shortCode = user.shortCode;
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
    const { customerId, notes, items } = req.body || {};

    // Walidacja
    if (!customerId) {
        return res.status(400).json({ status: 'error', message: 'customerId jest wymagane' });
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

        // Utwórz Order
        const { data: order, error: orderError } = await supabase
            .from('Order')
            .insert({
                customerId,
                userId,
                orderNumber,
                status: 'PENDING',
                total: parseFloat(total.toFixed(2)),
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
            totalQuantity: item.totalQuantity || item.quantity,
            source: item.source || 'MIEJSCOWOSCI',
            locationName: item.locationName || null,
            projectName: item.projectName || null,
            customization: item.customization || null,
            productionNotes: item.productionNotes || null
        }));

        const { error: itemsError } = await supabase
            .from('OrderItem')
            .insert(orderItems);

        if (itemsError) {
            console.error('Błąd tworzenia OrderItems:', itemsError);
            // Spróbuj usunąć Order (rollback)
            await supabase.from('Order').delete().eq('id', orderId);
            return res.status(500).json({ status: 'error', message: 'Nie udało się dodać pozycji do zamówienia', details: itemsError.message });
        }

        console.log(`✅ Zamówienie ${orderNumber} utworzone (ID: ${orderId})`);

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
// GET /api/user - Dane bieżącego użytkownika
// ============================================
app.get('/api/user', async (req, res) => {
    try {
        const cookies = parseCookies(req);
        const userId = cookies.auth_id;
        const role = cookies.auth_role;
        
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
        const cookies = parseCookies(req);
        const userId = cookies.auth_id;
        const role = cookies.auth_role;
        
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
        const cookies = parseCookies(req);
        const userId = cookies.auth_id;
        
        console.log('[GET /api/orders/my] cookies:', cookies);
        console.log('[GET /api/orders/my] userId:', userId);
        
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
        const cookies = parseCookies(req);
        const userId = cookies.auth_id;
        const role = cookies.auth_role;

        console.log('[GET /api/orders] start', { cookies, userId, role });
        
        if (!userId || !role) {
            return res.status(401).json({ status: 'error', message: 'Brak autoryzacji' });
        }

        // Kontrola dostępu wg roli
        if (!['SALES_REP', 'ADMIN', 'SALES_DEPT', 'WAREHOUSE', 'PRODUCTION'].includes(role)) {
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
                User:userId(name, shortCode)
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

        console.log('[GET /api/orders] returning', { count: (orders || []).length });

        return res.json({
            status: 'success',
            data: orders || []
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
        const cookies = parseCookies(req);
        const userId = cookies.auth_id;
        const role = cookies.auth_role;

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

        console.log('[GET /api/admin/orders] returning', { count: (orders || []).length });

        return res.json({
            status: 'success',
            data: orders || []
        });
    } catch (error) {
        console.error('Błąd w GET /api/admin/orders:', error);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// GET /api/orders/:id - Szczegóły zamówienia
// ============================================
app.get('/api/orders/:id', async (req, res) => {
    try {
        const cookies = parseCookies(req);
        const userId = cookies.auth_id;
        const role = cookies.auth_role;
        
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
        if (!['ADMIN', 'SALES_DEPT'].includes(role) && order.userId !== userId) {
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
                totalQuantity,
                source,
                locationName,
                projectName,
                customization,
                productionNotes,
                Product:productId(id, name, identifier, index, pc_id)
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

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    console.error('Niezłapany błąd:', err);
});

// Start server
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
