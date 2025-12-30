/**
 * Główna aplikacja Express - zrefaktoryzowana z server.js
 * Centralizuje konfigurację middlewarów i montuje routery
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Import konfiguracji i modułów
const config = require('./config/env');
const { requireRole, kioskNetworkGuard } = require('./modules/auth');
const sseModule = require('./modules/sse');
const { createSSEHandler } = sseModule;

// Import routerów
const authRoutes = require('./routes/auth');
const orderRoutes = require('./routes/orders');
const productionRoutes = require('./routes/production');
const productionExtendedRoutes = require('./routes/production-extended.js');
const configRoutes = require('./routes/config');
const clientsRoutes = require('./routes/clients');
const favoritesRoutes = require('./routes/favorites');
const galleryRoutes = require('./routes/gallery');
const productsRoutes = require('./routes/products');
const adminRoutes = require('./routes/admin');
const adminExtensionsRoutes = require('./routes/admin-extensions');
const graphicsRoutes = require('./routes/graphics');
const userRoutes = require('./routes/user');
const kioskRoutes = require('./routes/kiosk');
const settingsRoutes = require('./routes/settings');
const orderTemplatesRoutes = require('./routes/order-templates');
const productionKpiRoutes = require('./routes/production/kpi');
const productionStatsRoutes = require('./routes/production/stats');
const productionPathsRoutes = require('./routes/production/paths');
const productionOperationsRoutes = require('./routes/production/operations');
const productionResourcesRoutes = require('./routes/production/resources');
const productionMachinesRoutes = require('./routes/production/machines');
const productionMaterialsRoutes = require('./routes/production/materials');
const productionOperatorsRoutes = require('./routes/production/operators');
const productionDashboardRoutes = require('./routes/production/dashboard');

// Inicjalizacja aplikacji
const app = express();

// Konfiguracja Supabase
let supabase = null;
if (config.SUPABASE_URL && config.SUPABASE_SERVICE_ROLE_KEY) {
    supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY);
    console.log('✅ Supabase połączony');
} else {
    console.warn('⚠️ Supabase nie jest skonfigurowany - sprawdź zmienne środowiskowe');
}

// Udostępnienie supabase i SSE dla routerów
app.locals.supabase = supabase;
app.locals.sse = sseModule;

// ============================================
// MIDDLEWARE
// ============================================

// CORS
const corsOptions = {
    origin: function (origin, callback) {
        // Pozwól na brak origin (np. aplikacje mobilne, Postman)
        if (!origin) return callback(null, true);
        
        // W produkcji sprawdź origin
        if (config.isProduction() && config.FRONTEND_ORIGIN) {
            if (origin !== config.FRONTEND_ORIGIN) {
                return callback(new Error('Niedozwolony przez CORS'), false);
            }
        }
        
        callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
};

app.use(cors(corsOptions));

// Parsowanie JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Nagłówki bezpieczeństwa
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    if (config.isProduction()) {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    
    next();
});

// Logowanie requestów (tylko w development)
if (config.isDevelopment()) {
    app.use((req, res, next) => {
        console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
        next();
    });
}

// Blokada bezpośredniego dostępu do katalogów SOURCE i SOURCE 2 (legacy/reference)
app.use((req, res, next) => {
  const p = req.path || '';
  if (p.startsWith('/SOURCE') || p.startsWith('/SOURCE 2')) {
    return res.status(404).end();
  }
  next();
});

// ============================================
// ROUTERY API
// ============================================

// SSE endpoint (przed routerami, żeby nie był przechwytywany)
app.get('/api/events', requireRole(['ADMIN', 'SALES_REP', 'SALES_DEPT', 'WAREHOUSE', 'PRODUCTION', 'PRODUCTION_MANAGER', 'OPERATOR', 'GRAPHICS', 'GRAPHIC_DESIGNER']), createSSEHandler());

// Montowanie routerów
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/production/kpi', productionKpiRoutes);
app.use('/api/production/stats', productionStatsRoutes);
app.use('/api/production', productionPathsRoutes);
app.use('/api/production/operations', productionOperationsRoutes);
app.use('/api/production/resources', productionResourcesRoutes);
app.use('/api/production', productionRoutes);
app.use('/api/production', productionExtendedRoutes);
app.use('/api/production/machines', productionMachinesRoutes);
app.use('/api/production/materials', productionMaterialsRoutes);
app.use('/api/production/operators', productionOperatorsRoutes);
app.use('/api/production/dashboard', productionDashboardRoutes);
app.use('/api/production', productionDashboardRoutes);
app.use('/api/config', configRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/gallery', galleryRoutes);
app.use('/api/v1/products', productsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin', adminExtensionsRoutes);
app.use('/api/graphics', graphicsRoutes);
app.use('/api', userRoutes);
app.use('/api/kiosk', kioskRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/order-templates', orderTemplatesRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Serwer działa poprawnie',
        environment: config.NODE_ENV,
        timestamp: new Date().toISOString()
    });
});

// Test Supabase (tylko ADMIN)
app.get('/api/supabase/health', requireRole(['ADMIN']), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({
            status: 'error',
            message: 'Supabase nie jest skonfigurowany'
        });
    }

    try {
        const { data, error } = await supabase
            .from('User')
            .select('id')
            .limit(1);

        if (error) {
            return res.status(500).json({
                status: 'error',
                message: 'Błąd połączenia z Supabase',
                error: error.message
            });
        }

        res.json({
            status: 'success',
            message: 'Połączenie z Supabase działa',
            recordCount: data ? data.length : 0
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Wyjątek podczas testowania Supabase',
            error: error.message
        });
    }
});

// ============================================
// PLIKI STATYCZNE (CSS, JS, obrazy)
// ============================================

// Obsługa plików statycznych z poprawnym kodowaniem
app.use('/styles', express.static(path.join(__dirname, '../styles'), {
    setHeaders: (res, path) => {
        if (path.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css; charset=utf-8');
        }
    }
}));

app.use('/scripts', express.static(path.join(__dirname, '../scripts'), {
    setHeaders: (res, path) => {
        if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        }
    }
}));

app.use('/assets', express.static(path.join(__dirname, '../assets')));
app.use('/images', express.static(path.join(__dirname, '../images')));
app.use('/produkty', express.static(path.join(__dirname, '../produkty')));
app.use('/admin', express.static(path.join(__dirname, '../admin'), {
    setHeaders: (res, path) => {
        if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        }
        if (path.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css; charset=utf-8');
        }
    }
}));

// ============================================
// ROUTY STATYCZNE (HTML)
// ============================================

// Strona główna
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
});

// Strona logowania (publiczna)
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../login.html'));
});

// Panel admina (dokładna ścieżka, nie koliduje ze statycznymi plikami)
app.get('/admin/', requireRole(['ADMIN', 'SALES_DEPT', 'GRAPHICS', 'GRAPHIC_DESIGNER', 'WAREHOUSE', 'PRODUCTION']), (req, res) => {
    res.sendFile(path.join(__dirname, '../admin/index.html'));
});

// Panel admina (bez slash na końcu)
app.get('/admin', requireRole(['ADMIN', 'SALES_DEPT', 'GRAPHICS', 'GRAPHIC_DESIGNER', 'WAREHOUSE', 'PRODUCTION']), (req, res) => {
    res.sendFile(path.join(__dirname, '../admin/index.html'));
});

// Panel klientów
app.get('/clients', requireRole(['SALES_REP', 'SALES_DEPT', 'ADMIN']), (req, res) => {
    res.sendFile(path.join(__dirname, '../clients.html'));
});

// Panel zamówień
app.get('/orders', requireRole(['SALES_REP', 'SALES_DEPT', 'ADMIN', 'WAREHOUSE', 'PRODUCTION']), (req, res) => {
    res.sendFile(path.join(__dirname, '../orders.html'));
});

// Panel produkcji
app.get('/production', requireRole(['PRODUCTION', 'PRODUCTION_MANAGER', 'OPERATOR', 'ADMIN']), (req, res) => {
    res.sendFile(path.join(__dirname, '../production.html'));
});

// Panel przypisań maszyn
app.get('/machine-assignments.html', requireRole(['ADMIN', 'PRODUCTION_MANAGER']), (req, res) => {
    res.sendFile(path.join(__dirname, '../machine-assignments.html'));
});

// Dashboard Executive - Mission Control
app.get('/dashboard-executive.html', requireRole(['ADMIN', 'PRODUCTION_MANAGER']), (req, res) => {
    res.sendFile(path.join(__dirname, '../dashboard-executive.html'));
});

// Kiosk - logowanie PIN
app.get('/kiosk', kioskNetworkGuard, (req, res) => {
    res.sendFile(path.join(__dirname, '../login.html'));
});

// ============================================
// OBSŁUGA BŁĘDÓW
// ============================================

// 404 dla nieistniejących endpointów
app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({
            status: 'error',
            message: `Endpoint ${req.method} ${req.path} nie istnieje`
        });
    }
    
    // Dla pozostałych ścieżek - strona 404 lub przekierowanie na główną
    res.status(404).sendFile(path.join(__dirname, '../index.html'));
});

// Globalny handler błędów
app.use((error, req, res, next) => {
    console.error('Nieobsłużony błąd:', error);
    
    if (res.headersSent) {
        return next(error);
    }
    
    res.status(500).json({
        status: 'error',
        message: config.isProduction() ? 'Błąd serwera' : error.message
    });
});

// Obsługa nieobsłużonych promise rejections
process.on('unhandledRejection', (err) => {
    console.error('Niezłapany błąd promise:', err);
});

module.exports = app;
