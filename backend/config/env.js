const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Konfiguracja środowiskowa
const config = {
  // Podstawowe
  PORT: process.env.PORT || 3001,
  NODE_ENV: process.env.NODE_ENV || 'development',
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  
  // Supabase
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_TABLE_PRODUCTS: process.env.SUPABASE_TABLE_PRODUCTS || 'products',
  
  // Galeria
  GALLERY_BASE: process.env.GALLERY_BASE || 'http://rezon.myqnapcloud.com:81/home',
  
  // Auth
  AUTH_COOKIE_SECRET: process.env.AUTH_COOKIE_SECRET || (
    process.env.SUPABASE_SERVICE_ROLE_KEY
      ? crypto.createHash('sha256').update(String(process.env.SUPABASE_SERVICE_ROLE_KEY)).digest('hex')
      : 'dev-insecure-auth-secret'
  ),
  LOGIN_MAX_ATTEMPTS: Number(process.env.LOGIN_MAX_ATTEMPTS || 5),
  LOGIN_WINDOW_MS: Number(process.env.LOGIN_WINDOW_MS || 15 * 60 * 1000),
  
  // Kiosk
  KIOSK_NETWORK_RESTRICTION_ENABLED: String(process.env.KIOSK_NETWORK_RESTRICTION_ENABLED || '').toLowerCase() === 'true',
  KIOSK_ALLOWED_CIDRS: String(process.env.KIOSK_ALLOWED_CIDRS || '')
    .split(',')
    .map(v => v.trim())
    .filter(Boolean),
  
  // CORS
  FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN || '',
  
  // Helper functions
  isProduction() {
    return this.IS_PRODUCTION;
  },
  
  isDevelopment() {
    return !this.IS_PRODUCTION;
  },
  
  isTest() {
    return this.NODE_ENV === 'test';
  }
};

module.exports = config;
