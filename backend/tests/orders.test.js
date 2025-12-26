import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

// Testy dla modułu zamówień
describe('Orders Module - Critical Endpoints', () => {
  let app;

  beforeAll(async () => {
    app = require('../app.js');
  });

  describe('GET /api/orders', () => {
    it('powinien zwrócić 401 gdy brak autoryzacji', async () => {
      const response = await request(app)
        .get('/api/orders');

      expect(response.status).toBe(401);
      expect(response.body.status).toBe('error');
    });
  });

  describe('GET /api/orders/:id', () => {
    it('powinien zwrócić 401 gdy brak autoryzacji', async () => {
      const response = await request(app)
        .get('/api/orders/test-id-123');

      expect(response.status).toBe(401);
      expect(response.body.status).toBe('error');
    });
  });

  describe('POST /api/orders', () => {
    it('powinien zwrócić 401 gdy brak autoryzacji', async () => {
      const response = await request(app)
        .post('/api/orders')
        .send({
          customerId: 'test-customer',
          items: []
        });

      expect(response.status).toBe(401);
    });

    it('powinien zwrócić 400 gdy brak wymaganych pól (walidacja)', async () => {
      // Mock autoryzacji
      const response = await request(app)
        .post('/api/orders')
        .set('Cookie', ['auth_id=test-user; auth_role=SALES_REP'])
        .send({
          items: []
        });

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
    });
  });

  describe('GET /api/orders/:id/production-status', () => {
    it('powinien zwrócić 401 gdy brak autoryzacji', async () => {
      const response = await request(app)
        .get('/api/orders/test-id/production-status');

      expect(response.status).toBe(401);
      expect(response.body.status).toBe('error');
    });
  });
});
