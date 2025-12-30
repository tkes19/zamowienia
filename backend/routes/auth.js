/**
 * Router autentykacji - endpointy logowania, autoryzacji i kiosku
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const { 
    parseCookies, 
    getAuthContext, 
    requireRole, 
    checkLoginAttempts, 
    recordLoginAttempt,
    setAuthCookies,
    clearAuthCookies 
} = require('../modules/auth');
const config = require('../config/env');

const router = express.Router();

// Middleware do sprawdzania ograniczeń sieciowych kiosku
function kioskNetworkGuard(req, res, next) {
    if (!config.KIOSK_NETWORK_RESTRICTION_ENABLED) {
        return next();
    }

    const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    
    if (!config.KIOSK_ALLOWED_CIDRS || config.KIOSK_ALLOWED_CIDRS.length === 0) {
        return next();
    }

    // Prosta implementacja - w produkcji użyj biblioteki do CIDR
    const isAllowed = config.KIOSK_ALLOWED_CIDRS.some(cidr => {
        if (cidr === clientIP) return true;
        if (cidr.includes('/')) {
            // Uproszczona obsługa CIDR - w produkcji użyj ip-range-check
            const [network] = cidr.split('/');
            return clientIP.startsWith(network.substring(0, network.lastIndexOf('.')));
        }
        return false;
    });

    if (!isAllowed) {
        return res.status(403).json({
            status: 'error',
            message: 'Dostęp do kiosku ograniczony dla tego adresu IP'
        });
    }

    next();
}

// ============================================
// ENDPOINTY AUTENTYKACJI
// ============================================

/**
 * POST /api/auth/login
 * Logowanie użytkownika (email + hasło)
 */
router.post('/login', async (req, res) => {
    const supabase = req.app.locals.supabase;
    
    if (!supabase) {
        return res.status(500).json({ 
            status: 'error', 
            message: 'Supabase nie jest skonfigurowany' 
        });
    }

    const { email, password } = req.body || {};

    if (!email || !password) {
        return res.status(400).json({
            status: 'error',
            message: 'Email i hasło są wymagane'
        });
    }

    // Sprawdź rate limiting
    const clientIP = req.ip || req.connection.remoteAddress;
    const rateLimitCheck = checkLoginAttempts(`${email}:${clientIP}`);
    
    if (!rateLimitCheck.allowed) {
        return res.status(429).json({
            status: 'error',
            message: `Zbyt wiele prób logowania. Spróbuj ponownie za ${rateLimitCheck.remainingTime} sekund.`
        });
    }

    try {
        // Znajdź użytkownika po emailu
        const { data: users, error: userError } = await supabase
            .from('User')
            .select('id, email, password, role, isActive, name')
            .eq('email', email.toLowerCase().trim())
            .eq('isActive', true);

        if (userError || !users || users.length === 0) {
            recordLoginAttempt(`${email}:${clientIP}`);
            return res.status(401).json({
                status: 'error',
                message: 'Nieprawidłowy email lub hasło'
            });
        }

        const user = users[0];

        // Sprawdź hasło
        const isPasswordValid = await bcrypt.compare(password, user.password);
        
        if (!isPasswordValid) {
            recordLoginAttempt(`${email}:${clientIP}`);
            return res.status(401).json({
                status: 'error',
                message: 'Nieprawidłowy email lub hasło'
            });
        }

        // Ustaw cookies
        setAuthCookies(res, user.id, user.role);

        res.json({
            status: 'success',
            message: 'Zalogowano pomyślnie',
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                name: user.name
            }
        });

    } catch (error) {
        console.error('[POST /api/auth/login] Error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Błąd serwera podczas logowania'
        });
    }
});

/**
 * POST /api/auth/logout
 * Wylogowanie użytkownika
 */
router.post('/logout', (req, res) => {
    clearAuthCookies(res);
    res.json({ 
        status: 'success', 
        message: 'Wylogowano pomyślnie' 
    });
});

/**
 * GET /api/auth/me
 * Informacje o aktualnie zalogowanym użytkowniku
 */
router.get('/me', async (req, res) => {
    const supabase = req.app.locals.supabase;
    
    if (!supabase) {
        return res.status(500).json({ 
            status: 'error', 
            message: 'Supabase nie jest skonfigurowany' 
        });
    }

    try {
        const { userId, role } = await getAuthContext(req);

        if (!userId || !role) {
            return res.status(401).json({
                status: 'error',
                message: 'Brak autoryzacji'
            });
        }

        // Pobierz szczegóły użytkownika
        const { data: user, error } = await supabase
            .from('User')
            .select('id, email, role, name, isActive')
            .eq('id', userId)
            .eq('isActive', true)
            .single();

        if (error || !user) {
            clearAuthCookies(res);
            return res.status(401).json({
                status: 'error',
                message: 'Użytkownik nie istnieje lub jest nieaktywny'
            });
        }

        // Pobierz wszystkie role użytkownika z UserRoleAssignment
        const { data: roleAssignments } = await supabase
            .from('UserRoleAssignment')
            .select('role, isActive')
            .eq('userId', userId)
            .eq('isActive', true);

        const allRoles = roleAssignments ? roleAssignments.map(ra => ra.role) : [];
        const activeRole = role; // z ciasteczka

        // Stałe wszystkich dostępnych ról (jak w starym systemie)
        const ALL_ROLES = [
            'NEW_USER',
            'ADMIN',
            'SALES_DEPT',
            'SALES_REP',
            'WAREHOUSE',
            'PRODUCTION',
            'PRODUCTION_MANAGER',
            'OPERATOR',
            'GRAPHICS',
            'GRAPHIC_DESIGNER',
            'CLIENT'
        ];

        res.json({
            status: 'success',
            userId: user.id,
            activeRole: activeRole,
            role: activeRole, // Dodane dla kompatybilności z frontendem
            roles: allRoles,
            allAvailableRoles: ALL_ROLES,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                name: user.name
            }
        });

    } catch (error) {
        console.error('[GET /api/auth/me] Error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Błąd serwera'
        });
    }
});

// ============================================
// ENDPOINTY KIOSKU
// ============================================

/**
 * GET /api/auth/kiosk/rooms
 * Lista pokojów produkcyjnych dla kiosku
 */
router.get('/kiosk/rooms', kioskNetworkGuard, async (req, res) => {
    const supabase = req.app.locals.supabase;
    
    if (!supabase) {
        return res.status(500).json({ 
            status: 'error', 
            message: 'Supabase nie jest skonfigurowany' 
        });
    }

    try {
        const { data: rooms, error } = await supabase
            .from('ProductionRoom')
            .select('id, name, code')
            .eq('isActive', true)
            .order('name');

        if (error) {
            console.error('[GET /api/auth/kiosk/rooms] Error:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Błąd pobierania pokojów'
            });
        }

        res.json({
            status: 'success',
            data: rooms || []
        });

    } catch (error) {
        console.error('[GET /api/auth/kiosk/rooms] Exception:', error);
        res.status(500).json({
            status: 'error',
            message: 'Błąd serwera'
        });
    }
});

/**
 * GET /api/auth/kiosk/operators
 * Lista operatorów dla wybranego pokoju
 */
router.get('/kiosk/operators', kioskNetworkGuard, async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { roomId } = req.query;
    
    if (!supabase) {
        return res.status(500).json({ 
            status: 'error', 
            message: 'Supabase nie jest skonfigurowany' 
        });
    }

    if (!roomId) {
        return res.status(400).json({
            status: 'error',
            message: 'roomId jest wymagane'
        });
    }

    try {
        // Pobierz operatorów przypisanych do pokoju
        const { data: assignments, error } = await supabase
            .from('UserProductionRoom')
            .select(`
                User!inner(
                    id,
                    name,
                    pin
                )
            `)
            .eq('productionRoomId', roomId)
            .eq('isActive', true);

        if (error) {
            console.error('[GET /api/auth/kiosk/operators] Error:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Błąd pobierania operatorów'
            });
        }

        const operators = (assignments || []).map(a => ({
            id: a.User.id,
            name: a.User.name,
            hasPin: !!a.User.pin
        }));

        res.json({
            status: 'success',
            data: operators
        });

    } catch (error) {
        console.error('[GET /api/auth/kiosk/operators] Exception:', error);
        res.status(500).json({
            status: 'error',
            message: 'Błąd serwera'
        });
    }
});

/**
 * POST /api/auth/kiosk/login
 * Logowanie PIN w kiosku
 */
router.post('/kiosk/login', kioskNetworkGuard, async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { userId, pin, roomId } = req.body || {};
    
    if (!supabase) {
        return res.status(500).json({ 
            status: 'error', 
            message: 'Supabase nie jest skonfigurowany' 
        });
    }

    if (!userId || !pin || !roomId) {
        return res.status(400).json({
            status: 'error',
            message: 'userId, pin i roomId są wymagane'
        });
    }

    // Rate limiting dla kiosku
    const clientIP = req.ip || req.connection.remoteAddress;
    const rateLimitCheck = checkLoginAttempts(`kiosk:${userId}:${clientIP}`);
    
    if (!rateLimitCheck.allowed) {
        return res.status(429).json({
            status: 'error',
            message: `Zbyt wiele prób. Spróbuj ponownie za ${rateLimitCheck.remainingTime} sekund.`
        });
    }

    try {
        // Sprawdź użytkownika i PIN
        const { data: user, error: userError } = await supabase
            .from('User')
            .select('id, name, role, pin, isActive')
            .eq('id', userId)
            .eq('isActive', true)
            .single();

        if (userError || !user || !user.pin) {
            recordLoginAttempt(`kiosk:${userId}:${clientIP}`);
            return res.status(401).json({
                status: 'error',
                message: 'Nieprawidłowy PIN lub użytkownik nieaktywny'
            });
        }

        // Sprawdź PIN (plain text comparison - w produkcji użyj bcrypt)
        if (user.pin !== pin) {
            recordLoginAttempt(`kiosk:${userId}:${clientIP}`);
            return res.status(401).json({
                status: 'error',
                message: 'Nieprawidłowy PIN'
            });
        }

        // Sprawdź czy użytkownik ma dostęp do pokoju
        const { data: roomAccess, error: roomError } = await supabase
            .from('UserProductionRoom')
            .select('id')
            .eq('userId', userId)
            .eq('productionRoomId', roomId)
            .eq('isActive', true)
            .single();

        if (roomError || !roomAccess) {
            return res.status(403).json({
                status: 'error',
                message: 'Brak dostępu do tego pokoju produkcyjnego'
            });
        }

        // Ustaw cookies
        setAuthCookies(res, user.id, user.role);

        res.json({
            status: 'success',
            message: 'Zalogowano do kiosku',
            user: {
                id: user.id,
                name: user.name,
                role: user.role
            }
        });

    } catch (error) {
        console.error('[POST /api/auth/kiosk/login] Exception:', error);
        res.status(500).json({
            status: 'error',
            message: 'Błąd serwera'
        });
    }
});

// ============================================
// Role użytkownika
// ============================================

router.get('/roles', async (req, res) => {
    const supabase = req.app.locals.supabase;
    
    try {
        const { userId } = await getAuthContext(req);
        
        if (!userId) {
            return res.status(401).json({ status: 'error', message: 'Brak autoryzacji' });
        }

        const { data, error } = await supabase
            .from('UserRoleAssignment')
            .select('role')
            .eq('userId', userId);

        if (error) throw error;

        const roles = (data || []).map(item => item.role);
        return res.json({ status: 'success', data: roles });
    } catch (err) {
        console.error('Błąd pobierania ról:', err);
        return res.status(500).json({ 
            status: 'error', 
            message: 'Nie udało się pobrać ról', 
            details: err.message 
        });
    }
});

// Ustaw aktywną rolę
router.post('/active-role', async (req, res) => {
    const supabase = req.app.locals.supabase;
    
    try {
        const { userId } = await getAuthContext(req);
        
        if (!userId) {
            return res.status(401).json({ status: 'error', message: 'Brak autoryzacji' });
        }
        const { role } = req.body;

        if (!role) {
            return res.status(400).json({ status: 'error', message: 'Rola jest wymagana' });
        }

        // Sprawdź czy użytkownik ma tę rolę
        const { data: userRole, error: roleError } = await supabase
            .from('UserRoleAssignment')
            .select('role')
            .eq('userId', userId)
            .eq('role', role)
            .eq('isActive', true)
            .maybeSingle();

        if (roleError || !userRole) {
            return res.status(403).json({ 
                status: 'error', 
                message: 'Nie masz przypisanej tej roli' 
            });
        }

        // Zapisz aktywną rolę w sesji lub ciasteczku
        res.cookie('activeRole', role, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000 // 24h
        });

        return res.json({ 
            status: 'success', 
            message: 'Aktywna rola została ustawiona',
            data: { activeRole: role }
        });
    } catch (err) {
        console.error('Błąd ustawiania aktywnej roli:', err);
        return res.status(500).json({ 
            status: 'error', 
            message: 'Nie udało się ustawić aktywnej roli', 
            details: err.message 
        });
    }
});

// Synchronizuj role z zewnętrznego źródła
router.post('/sync-role', async (req, res) => {
    const supabase = req.app.locals.supabase;
    
    try {
        const { userId } = await getAuthContext(req);
        
        if (!userId) {
            return res.status(401).json({ status: 'error', message: 'Brak autoryzacji' });
        }
        const { roles } = req.body;

        if (!Array.isArray(roles)) {
            return res.status(400).json({ status: 'error', message: 'Roles musi być tablicą' });
        }

        // Usuń istniejące role
        await supabase
            .from('UserRoleAssignment')
            .delete()
            .eq('userId', userId);

        // Dodaj nowe role
        if (roles.length > 0) {
            const newRoles = roles.map(role => ({
                userId,
                role,
                assignedAt: new Date().toISOString(),
                isActive: true
            }));

            const { error } = await supabase
                .from('UserRoleAssignment')
                .insert(newRoles);

            if (error) throw error;
        }

        return res.json({ 
            status: 'success', 
            message: 'Role zostały zsynchronizowane' 
        });
    } catch (err) {
        console.error('Błąd synchronizacji ról:', err);
        return res.status(500).json({ 
            status: 'error', 
            message: 'Nie udało się zsynchronizować ról', 
            details: err.message 
        });
    }
});

/**
 * POST /api/auth/active-role
 * Zmienia aktywną rolę użytkownika (musi mieć tę rolę przypisaną)
 */
router.post('/active-role', async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { role } = req.body || {};
    
    const { userId } = await getAuthContext(req);

    if (!userId) {
        return res.status(401).json({ status: 'error', message: 'Nieautoryzowany' });
    }

    if (!role || !['ADMIN', 'SALES_REP', 'SALES_DEPT', 'WAREHOUSE', 'PRODUCTION', 'OPERATOR', 'PRODUCTION_MANAGER', 'GRAPHICS', 'GRAPHIC_DESIGNER'].includes(role)) {
        return res.status(400).json({ status: 'error', message: 'Nieprawidłowa rola' });
    }

    if (!supabase) {
        // Bez Supabase - po prostu ustaw ciasteczko
        setAuthCookies(res, userId, role);
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
            return res.status(403).json({ 
                status: 'error', 
                message: 'Nie masz przypisanej tej roli' 
            });
        }

        // Ustaw nową rolę w ciasteczku
        setAuthCookies(res, userId, role);

        res.json({ 
            status: 'success', 
            data: { activeRole: role } 
        });
    } catch (err) {
        console.error('[POST /api/auth/active-role] Wyjątek:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera' });
    }
});

// ============================================
// ENDPOINTY SYNCHRONIZACJI RÓL
// ============================================

/**
 * GET /api/auth/roles
 * Pobiera wszystkie role użytkownika (w tym allAvailableRoles)
 */
router.get('/roles', async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { getAuthContext } = require('../modules/auth');
    
    try {
        const { userId, role } = await getAuthContext(req);

        if (!userId) {
            return res.status(401).json({ status: 'error', message: 'Nieautoryzowany' });
        }

        if (!supabase) {
            // Fallback: zwróć rolę z ciasteczka
            return res.json({
                status: 'success',
                data: {
                    userId,
                    activeRole: role,
                    roles: role ? [role] : []
                }
            });
        }

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
                    activeRole: role,
                    roles: user?.role ? [user.role] : []
                }
            });
        }

        const roles = (assignments || []).map(a => a.role);

        // Stałe wszystkich dostępnych ról
        const ALL_ROLES = [
            'NEW_USER',
            'ADMIN',
            'SALES_DEPT',
            'SALES_REP',
            'WAREHOUSE',
            'PRODUCTION',
            'PRODUCTION_MANAGER',
            'OPERATOR',
            'GRAPHICS',
            'GRAPHIC_DESIGNER',
            'CLIENT'
        ];

        return res.json({
            status: 'success',
            data: {
                userId,
                activeRole: role,
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
 * POST /api/auth/sync-role
 * Synchronizuje rolę użytkownika z bazą
 */
router.post('/sync-role', async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { getAuthContext } = require('../modules/auth');
    
    if (!supabase) {
        return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
    }

    try {
        const { userId } = await getAuthContext(req);

        if (!userId) {
            return res.status(401).json({ status: 'error', message: 'Brak autoryzacji' });
        }

        const { data: user, error } = await supabase
            .from('User')
            .select('id, role')
            .eq('id', userId)
            .single();

        if (error || !user) {
            return res.status(404).json({ status: 'error', message: 'Użytkownik nie znaleziony' });
        }

        const role = user.role || 'NEW_USER';
        
        // Ustaw ciasteczka z rolą
        const cookieBase = '; Path=/; HttpOnly; SameSite=Lax';
        const cookies = [
            `auth_id=${encodeURIComponent(user.id)}${cookieBase}`,
            `auth_role=${encodeURIComponent(role)}${cookieBase}`
        ];
        
        res.setHeader('Set-Cookie', cookies);

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

module.exports = router;
