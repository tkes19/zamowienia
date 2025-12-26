/**
 * Testy dla endpointów graphics
 */

const request = require('supertest');
const app = require('../app');

describe('Graphics Module - Tasks', () => {
    test('GET /api/graphics/tasks powinien zwrócić 401 gdy brak autoryzacji', async () => {
        const response = await request(app)
            .get('/api/graphics/tasks')
            .expect(401);
        
        expect(response.body.status).toBe('error');
    });

    test('GET /api/graphics/tasks/:id powinien zwrócić 401 gdy brak autoryzacji', async () => {
        const response = await request(app)
            .get('/api/graphics/tasks/123')
            .expect(401);
        
        expect(response.body.status).toBe('error');
    });

    test('PATCH /api/graphics/tasks/:id powinien zwrócić 401 gdy brak autoryzacji', async () => {
        const response = await request(app)
            .patch('/api/graphics/tasks/123')
            .send({ status: 'in_progress' })
            .expect(401);
        
        expect(response.body.status).toBe('error');
    });
});
