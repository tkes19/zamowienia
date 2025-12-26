// Setup dla testów Vitest
import { beforeAll, afterAll, afterEach } from 'vitest';

// Mockowanie zmiennych środowiskowych dla testów
process.env.NODE_ENV = 'test';
process.env.PORT = '3002';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-key';
process.env.AUTH_COOKIE_SECRET = 'test-secret-for-cookies';
process.env.GALLERY_BASE = 'http://test-gallery.local';

beforeAll(() => {
  // Globalne setup przed wszystkimi testami
});

afterEach(() => {
  // Cleanup po każdym teście
});

afterAll(() => {
  // Cleanup po wszystkich testach
});
