const config = require('../../config/env');

// Rate limiting dla logowania
const loginAttempts = new Map();

// Stałe do limitowania prób logowania
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minut
const LOGIN_MAX_ATTEMPTS = 5; // maksymalnie 5 prób

/**
 * Parsowanie cookies z nagłówka Cookie
 */
function parseCookies(req) {
  const cookieHeader = req.headers.cookie || '';
  const cookies = {};
  
  cookieHeader.split(';').forEach(cookie => {
    const parts = cookie.trim().split('=');
    if (parts.length === 2) {
      cookies[parts[0]] = decodeURIComponent(parts[1]);
    }
  });
  
  return cookies;
}

/**
 * Pobieranie kontekstu autentykacji z cookies
 */
async function getAuthContext(req) {
  const cookies = parseCookies(req);
  return {
    userId: cookies.auth_id || null,
    role: cookies.auth_role || null
  };
}

/**
 * Middleware wymagający określonych ról
 */
function requireRole(allowedRoles) {
  return async (req, res, next) => {
    try {
      const { userId, role } = await getAuthContext(req);
      
      console.log(`[AUTH] requireRole: userId=${userId}, role=${role}, allowedRoles=${JSON.stringify(allowedRoles)}, path=${req.path}`);
      
      if (!userId || !role) {
        return res.status(401).json({ 
          status: 'error', 
          message: 'Brak autoryzacji' 
        });
      }
      
      // Wykryj żądanie z przeglądarki
      const accepts = (req.headers && req.headers.accept) ? String(req.headers.accept) : '';
      const isBrowserRequest = !String(req.path || '').startsWith('/api') && accepts.includes('text/html');
      
      // Funkcja do wyświetlania strony błędu
      const sendAccessPage = (statusCode, title, message) => {
        res.status(statusCode).send(`<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    body{margin:0;min-height:100vh;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#0b1220;color:#e5e7eb;display:flex;align-items:center;justify-content:center;padding:24px}
    .card{width:min(720px,92vw);background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:22px 20px;box-shadow:0 12px 30px rgba(0,0,0,.35)}
    h1{margin:0 0 10px;font-size:20px}
    p{margin:0 0 20px;line-height:1.6}
    .btn{display:inline-flex;align-items:center;gap:8px;padding:10px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-weight:500;transition:all .2s}
    .btn:hover{background:#1d4ed8;transform:translateY(-1px)}
    .icon{font-size:18px}
    .footer{margin-top:24px;padding-top:20px;border-top:1px solid rgba(255,255,255,.1);font-size:14px;opacity:.7}
  </style>
</head>
<body>
  <main class="card">
    <h1>${title}</h1>
    <p>${message}</p>
    <a href="/production" class="btn">
      <span class="icon">←</span>
      Powrót do panelu
    </a>
    <div class="footer">
      REZON System Produkcyjny v2.0
    </div>
  </main>
</body>
</html>`);
      };
      
      if (!allowedRoles.includes(role)) {
        if (isBrowserRequest) {
          return sendAccessPage(403, 'Brak dostępu do tej strony', 'To konto nie ma jeszcze skonfigurowanych uprawnień do panelu produkcji.');
        }
        return res.status(403).json({ 
          status: 'error', 
          message: 'Brak uprawnień do tego zasobu' 
        });
      }
      
      // Dodaj kontekst do req dla dalszych middleware
      req.user = { userId, role, id: userId };
      next();
    } catch (error) {
      console.error('[requireRole] Error:', error);
      return res.status(500).json({ 
        status: 'error', 
        message: 'Błąd serwera' 
      });
    }
  };
}

/**
 * Sprawdzenie limitu prób logowania
 */
function checkLoginAttempts(identifier) {
  const now = Date.now();
  const attempts = loginAttempts.get(identifier) || [];
  
  // Usuń stare próby spoza okna czasowego
  const recentAttempts = attempts.filter(
    timestamp => now - timestamp < config.LOGIN_WINDOW_MS
  );
  
  if (recentAttempts.length >= config.LOGIN_MAX_ATTEMPTS) {
    return {
      allowed: false,
      remainingTime: Math.ceil((recentAttempts[0] + config.LOGIN_WINDOW_MS - now) / 1000)
    };
  }
  
  return { allowed: true };
}

/**
 * Rejestracja próby logowania
 */
function recordLoginAttempt(identifier) {
  const attempts = loginAttempts.get(identifier) || [];
  attempts.push(Date.now());
  loginAttempts.set(identifier, attempts);
  
  // Cleanup starych wpisów co jakiś czas
  if (Math.random() < 0.01) {
    cleanupOldAttempts();
  }
}

/**
 * Czyszczenie starych prób logowania
 */
function cleanupOldAttempts() {
  const now = Date.now();
  for (const [key, attempts] of loginAttempts.entries()) {
    const recent = attempts.filter(
      timestamp => now - timestamp < config.LOGIN_WINDOW_MS
    );
    if (recent.length === 0) {
      loginAttempts.delete(key);
    } else {
      loginAttempts.set(key, recent);
    }
  }
}

/**
 * Ustawienie cookies autentykacji
 */
function setAuthCookies(res, userId, role) {
  const cookieOptions = {
    httpOnly: true,
    secure: config.isProduction(),
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 dni
  };
  
  res.cookie('auth_id', userId, cookieOptions);
  res.cookie('auth_role', role, cookieOptions);
}

/**
 * Wyczyszczenie cookies autentykacji
 */
function clearAuthCookies(res) {
  res.cookie('auth_id', '', { maxAge: 0 });
  res.cookie('auth_role', '', { maxAge: 0 });
}

/**
 * Pobranie klucza do śledzenia prób logowania
 */
function getLoginAttemptKey(req, email) {
    const ip = req.ip || (req.connection && req.connection.remoteAddress) || '';
    const normalizedEmail = (email || '').toString().toLowerCase();
    return `${ip}|${normalizedEmail}`;
}

/**
 * Sprawdzenie, czy logowanie jest zablokowane
 */
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

/**
 * Rejestracja nieudanej próby logowania
 */
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

/**
 * Resetowanie prób logowania po pomyślnym logowaniu
 */
function resetLoginAttempts(key) {
    loginAttempts.delete(key);
}

/**
 * Formatowanie pozostałych prób
 */
function formatRemainingAttempts(remaining) {
    const n = Number(remaining);
    if (!Number.isFinite(n)) return 'prób';
    if (n === 1) return 'próbę';
    if (n >= 2 && n <= 4) return 'próby';
    return 'prób';
}

/**
 * Budowanie wiadomości o nieprawidłowym PIN dla kiosku
 */
function buildKioskFailedPinMessage(attemptKey) {
    const state = loginAttempts.get(attemptKey);
    const count = state && Number.isFinite(state.count) ? state.count : 1;
    const remaining = Math.max(0, LOGIN_MAX_ATTEMPTS - count);

    if (count >= 2 && remaining > 0) {
        return `Nieprawidłowy PIN. Pozostało ${remaining} ${formatRemainingAttempts(remaining)}.`;
    }

    return 'Nieprawidłowy PIN.';
}

/**
 * Middleware do sprawdzania ograniczeń sieciowych kiosku
 */
function kioskNetworkGuard(req, res, next) {
    const config = require('../../config/env');
    
    if (!config.KIOSK_NETWORK_RESTRICTION_ENABLED) {
        return next();
    }

    const clientIP = req.ip || req.connection.remoteAddress;
    
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

module.exports = {
  parseCookies,
  getAuthContext,
  requireRole,
  checkLoginAttempts,
  recordLoginAttempt,
  setAuthCookies,
  clearAuthCookies,
  getLoginAttemptKey,
  isLoginBlocked,
  registerFailedLogin,
  resetLoginAttempts,
  buildKioskFailedPinMessage,
  kioskNetworkGuard
};
