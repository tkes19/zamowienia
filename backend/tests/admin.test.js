/**
 * Testy dla endpointów admin
 */

const request = require('supertest');
const app = require('../app');

describe('Admin Module - User Management', () => {
    test('GET /api/admin/users powinien zwrócić 401 gdy brak autoryzacji', async () => {
        const response = await request(app)
            .get('/api/admin/users')
            .expect(401);
        
        expect(response.body.status).toBe('error');
    });

    test('POST /api/admin/users powinien zwrócić 401 gdy brak autoryzacji', async () => {
        const response = await request(app)
            .post('/api/admin/users')
            .send({ name: 'Test User', email: 'test@test.com', role: 'SALES_REP' })
            .expect(401);
        
        expect(response.body.status).toBe('error');
    });

    test('GET /api/admin/user-role-assignments powinien zwrócić 401 gdy brak autoryzacji', async () => {
        const response = await request(app)
            .get('/api/admin/user-role-assignments?userId=test-id')
            .expect(401);
        
        expect(response.body.status).toBe('error');
    });
});

describe('Admin Module - Folder Access', () => {
    test('GET /api/admin/user-folder-access powinien zwrócić 401 gdy brak autoryzacji', async () => {
        const response = await request(app)
            .get('/api/admin/user-folder-access')
            .expect(401);
        
        expect(response.body.status).toBe('error');
    });

    test('POST /api/admin/user-folder-access powinien zwrócić 401 gdy brak autoryzacji', async () => {
        const response = await request(app)
            .post('/api/admin/user-folder-access')
            .send({ userId: 'test-id', folderName: 'Test Folder' })
            .expect(401);
        
        expect(response.body.status).toBe('error');
    });
});

describe('Admin Module - Production Rooms', () => {
    test('GET /api/admin/user-production-rooms powinien zwrócić 401 gdy brak autoryzacji', async () => {
        const response = await request(app)
            .get('/api/admin/user-production-rooms')
            .expect(401);
        
        expect(response.body.status).toBe('error');
    });

    test('POST /api/admin/user-production-rooms powinien zwrócić 401 gdy brak autoryzacji', async () => {
        const response = await request(app)
            .post('/api/admin/user-production-rooms')
            .send({ userId: 'test-id', roomId: 1 })
            .expect(401);
        
        expect(response.body.status).toBe('error');
    });
});

describe('Admin Module - City Access', () => {
    test('GET /api/admin/user-city-access powinien zwrócić 401 gdy brak autoryzacji', async () => {
        const response = await request(app)
            .get('/api/admin/user-city-access')
            .expect(401);
        
        expect(response.body.status).toBe('error');
    });

    test('POST /api/admin/user-city-access powinien zwrócić 401 gdy brak autoryzacji', async () => {
        const response = await request(app)
            .post('/api/admin/user-city-access')
            .send({ userId: 'test-id', cityName: 'Warszawa' })
            .expect(401);
        
        expect(response.body.status).toBe('error');
    });
});
