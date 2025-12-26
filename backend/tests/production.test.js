import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

// Testy dla modułu produkcji
describe('Production Module - Critical Endpoints', () => {
  let app;

  beforeAll(async () => {
    app = require('../app.js');
  });

  describe('GET /api/production/orders/active', () => {
    it('powinien zwrócić 401 gdy brak autoryzacji', async () => {
      const response = await request(app)
        .get('/api/production/orders/active');

      expect(response.status).toBe(401);
      expect(response.body.status).toBe('error');
    });
  });

  describe('GET /api/production/rooms', () => {
    it('powinien zwrócić 401 gdy brak autoryzacji', async () => {
      const response = await request(app)
        .get('/api/production/rooms');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/production/operations/:id/start', () => {
    it('powinien zwrócić 401 gdy brak autoryzacji', async () => {
      const response = await request(app)
        .post('/api/production/operations/123/start');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/production/operations/:id/complete', () => {
    it('powinien zwrócić 401 gdy brak autoryzacji', async () => {
      const response = await request(app)
        .post('/api/production/operations/123/complete')
        .send({ quantity: 100 });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/events (SSE)', () => {
    it('powinien zwrócić 401 gdy brak autoryzacji', async () => {
      const response = await request(app)
        .get('/api/events');

      expect(response.status).toBe(401);
      expect(response.body.status).toBe('error');
    });
  });
});
