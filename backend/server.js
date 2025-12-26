/**
 * Nowy server.js - bootstrap używający zrefaktoryzowanej aplikacji
 */

const config = require('./config/env');
const app = require('./app');

// Start serwera
if (require.main === module) {
    const server = app.listen(config.PORT, () => {
        console.log(`🚀 Serwer działa na porcie ${config.PORT}`);    
        console.log(`📦 Środowisko: ${config.NODE_ENV}`);
        console.log(`🔗 Adres testowy: http://localhost:${config.PORT}/api/health`);
        console.log(`📊 SSE endpoint: http://localhost:${config.PORT}/api/events`);
    });

    server.on('error', (err) => {
        console.error('❌ Błąd serwera:', err);
        process.exit(1);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
        console.log('📴 Otrzymano SIGTERM, zamykanie serwera...');
        server.close(() => {
            console.log('✅ Serwer zamknięty');
            process.exit(0);
        });
    });

    process.on('SIGINT', () => {
        console.log('📴 Otrzymano SIGINT, zamykanie serwera...');
        server.close(() => {
            console.log('✅ Serwer zamknięty');
            process.exit(0);
        });
    });

    // Utrzymaj proces przy życiu
    process.stdin.resume();
}

module.exports = app;
