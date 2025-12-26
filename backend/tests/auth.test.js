import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

// Testy dla modułu autentykacji
describe('Auth Module - Critical Endpoints', () => {
  let app;

  beforeAll(async () => {
    // Import nowej aplikacji
    app = require('../app.js');
  });

  describe('POST /api/auth/login', () => {
    it('powinien zwrócić 400 gdy brak email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ password: 'test123' });

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
    });

    it('powinien zwrócić 400 gdy brak password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
    });

    it('powinien zwrócić 401 dla nieprawidłowych danych', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ 
          email: 'nonexistent@example.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.status).toBe('error');
    });
  });

  describe('GET /api/auth/me', () => {
    it('powinien zwrócić 401 gdy brak autoryzacji', async () => {
      const response = await request(app)
        .get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.status).toBe('error');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('powinien wyczyścić cookies i zwrócić sukces', async () => {
      const response = await request(app)
        .post('/api/auth/logout');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      
      // Sprawdź czy cookies zostały wyczyszczone
      const cookies = response.headers['set-cookie'];
      if (cookies) {
        expect(cookies.some(c => c.includes('auth_id=;'))).toBe(true);
        expect(cookies.some(c => c.includes('auth_role=;'))).toBe(true);
      }
    });
  });
});
