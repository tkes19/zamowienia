/**
 * Router dla endpointów kiosku
 * Endpointy dla logowania kiosku i pobierania danych o pokojach/operatorach
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const { 
    parseCookies, 
    checkLoginAttempts, 
    recordLoginAttempt 
} = require('../modules/auth');

const router = express.Router();

// Middleware do sprawdzania ograniczeń sieciowych kiosku
function kioskNetworkGuard(req, res, next) {
    const config = require('../config/env');
    
    console.log('[kioskNetworkGuard] Checking access from IP:', req.ip);
    
    if (!config.KIOSK_NETWORK_RESTRICTION_ENABLED) {
        console.log('[kioskNetworkGuard] Network restriction disabled, allowing access');
        return next();
    }

    const clientIP = req.ip || req.connection.remoteAddress;
    
    if (!config.KIOSK_ALLOWED_CIDRS || config.KIOSK_ALLOWED_CIDRS.length === 0) {
        console.log('[kioskNetworkGuard] No CIDRs configured, allowing access');
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
        console.log('[kioskNetworkGuard] Access denied for IP:', clientIP);
        return res.status(403).json({
            status: 'error',
            message: 'Dostęp do kiosku ograniczony dla tego adresu IP'
        });
    }

    console.log('[kioskNetworkGuard] Access allowed for IP:', clientIP);
    next();
}

// Middleware do sprawdzania konfiguracji Supabase
router.use((req, res, next) => {
    if (!req.app.locals.supabase) {
        return res.status(500).json({ 
            status: 'error', 
            message: 'Supabase nie jest skonfigurowany' 
        });
    }
    next();
});

// ============================================
// GET /api/kiosk/rooms - lista pokojów produkcyjnych
// ============================================

router.get('/rooms', kioskNetworkGuard, async (req, res) => {
    const supabase = req.app.locals.supabase;

    try {
        const { data: rooms, error } = await supabase
            .from('ProductionRoom')
            .select('*')
            .eq('isActive', true)
            .order('name', { ascending: true });

        if (error) throw error;

        return res.json({ status: 'success', data: rooms || [] });
    } catch (err) {
        console.error('Wyjątek w GET /api/kiosk/rooms:', err);
        return res.status(500).json({ 
            status: 'error', 
            message: 'Błąd serwera podczas pobierania pokojów' 
        });
    }
});

// ============================================
// GET /api/kiosk/operators?roomId=... - operatorzy z pokoju (multiroom)
// ============================================

router.get('/operators', kioskNetworkGuard, async (req, res) => {
    const supabase = req.app.locals.supabase;
    const { roomId } = req.query;

    if (!roomId) {
        return res.status(400).json({ status: 'error', message: 'roomId jest wymagane' });
    }

    try {
        const allowedRoles = ['OPERATOR', 'PRODUCTION', 'PRODUCTION_MANAGER'];
        let userIds = [];

        if (roomId) {
            const parsedRoomId = parseInt(roomId, 10);
            
            // Pobierz użytkowników przypisanych do pokoju przez UserProductionRoom (multiroom)
            const { data: roomAssignments, error: assignError } = await supabase
                .from('UserProductionRoom')
                .select('userId')
                .eq('roomId', parsedRoomId);

            if (assignError) throw assignError;
            userIds = (roomAssignments || []).map(a => a.userId);
        }

        // Pobierz szczegóły użytkowników
        let query = supabase
            .from('User')
            .select('id, name, role')
            .in('role', allowedRoles)
            .eq('isActive', true);

        if (userIds.length > 0) {
            query = query.in('id', userIds);
        }

        const { data: users, error } = await query.order('name', { ascending: true });

        if (error) throw error;

        return res.json({ status: 'success', data: users || [] });
    } catch (err) {
        console.error('Wyjątek w GET /api/kiosk/operators:', err);
        return res.status(500).json({ 
            status: 'error', 
            message: 'Błąd serwera podczas pobierania operatorów' 
        });
    }
});

// ============================================
// POST /api/kiosk/login - logowanie PIN
// ============================================

router.post('/login', kioskNetworkGuard, async (req, res) => {
    const supabase = req.app.locals.supabase;
    const bcrypt = require('bcryptjs');
    const { 
        parseCookies, 
        checkLoginAttempts, 
        recordLoginAttempt,
        getLoginAttemptKey,
        isLoginBlocked,
        registerFailedLogin,
        resetLoginAttempts,
        buildKioskFailedPinMessage,
        setAuthCookies
    } = require('../modules/auth');

    try {
        if (!supabase) {
            return res.status(500).json({ status: 'error', message: 'Supabase nie jest skonfigurowany' });
        }

        const { userId, pin } = req.body || {};
        const pinStr = (pin || '').toString().trim();

        if (!userId || !pinStr) {
            return res.status(400).json({ status: 'error', message: 'Wymagane pola: userId, pin' });
        }

        if (!/^\d{6}$/.test(pinStr)) {
            return res.status(400).json({ status: 'error', message: 'PIN musi mieć 6 cyfr' });
        }

        const attemptKey = getLoginAttemptKey(req, `kiosk:${userId}`);
        if (isLoginBlocked(attemptKey)) {
            return res.status(429).json({ status: 'error', message: 'Zbyt wiele nieudanych prób logowania. Spróbuj ponownie później.' });
        }

        const { data: user, error } = await supabase
            .from('User')
            .select('id, role, isActive, pinHash')
            .eq('id', userId)
            .single();

        console.log('[kiosk login] User data:', { error, user });

        if (error || !user) {
            console.log('[kiosk login] User not found or error:', error);
            registerFailedLogin(attemptKey);
            return res.status(401).json({ status: 'error', message: buildKioskFailedPinMessage(attemptKey) });
        }

        if (user.isActive === false) {
            console.log('[kiosk login] User is inactive');
            registerFailedLogin(attemptKey);
            return res.status(403).json({ status: 'error', message: 'Konto jest nieaktywne.' });
        }

        const allowedRoles = ['OPERATOR', 'PRODUCTION', 'PRODUCTION_MANAGER'];
        console.log('[kiosk login] User role:', user.role, 'Allowed roles:', allowedRoles);
        if (!allowedRoles.includes(user.role)) {
            console.log('[kiosk login] Role not allowed');
            registerFailedLogin(attemptKey);
            return res.status(403).json({ status: 'error', message: 'Brak uprawnień do tego zasobu' });
        }

        if (!user.pinHash) {
            registerFailedLogin(attemptKey);
            return res.status(403).json({ status: 'error', message: 'Konto nie ma ustawionego PIN.' });
        }

        let ok = false;
        try {
            ok = await bcrypt.compare(pinStr, user.pinHash);
        } catch (compareErr) {
            console.warn('Błąd porównania PIN:', compareErr);
            ok = false;
        }

        if (!ok) {
            registerFailedLogin(attemptKey);
            return res.status(401).json({ status: 'error', message: buildKioskFailedPinMessage(attemptKey) });
        }

        setAuthCookies(res, user.id, user.role);
        resetLoginAttempts(attemptKey);

        return res.json({ status: 'success', data: { id: user.id, role: user.role } });
    } catch (err) {
        console.error('Błąd logowania kiosku:', err);
        return res.status(500).json({ status: 'error', message: 'Błąd serwera podczas logowania.' });
    }
});

module.exports = router;
