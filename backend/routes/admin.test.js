// Testy jednostkowe dla endpointu sprawdzania powiązań użytkownika
const request = require('supertest');
const { describe, it, expect, beforeAll, afterAll } = require('@jest/globals');

describe('User Dependencies Endpoint', () => {
    let app;
    let testUserId;
    let testUserWithOrders;

    beforeAll(async () => {
        // Setup test app and test data
        // Note: This requires proper test setup with Supabase test instance
    });

    afterAll(async () => {
        // Cleanup test data
    });

    describe('GET /api/admin/users/:id/dependencies', () => {
        it('should return empty dependencies for user without relations', async () => {
            const response = await request(app)
                .get(`/api/admin/users/${testUserId}/dependencies`)
                .set('Cookie', 'auth-cookie-here')
                .expect(200);

            expect(response.body.status).toBe('success');
            expect(response.body.canDelete).toBe(true);
            expect(response.body.dependencies).toEqual({});
            expect(response.body.blockers).toEqual([]);
        });

        it('should return dependencies for user with orders', async () => {
            const response = await request(app)
                .get(`/api/admin/users/${testUserWithOrders}/dependencies`)
                .set('Cookie', 'auth-cookie-here')
                .expect(200);

            expect(response.body.status).toBe('success');
            expect(response.body.canDelete).toBe(false);
            expect(response.body.dependencies.orders).toBeGreaterThan(0);
            expect(response.body.blockers).toContain('orders');
        });

        it('should require ADMIN role', async () => {
            const response = await request(app)
                .get(`/api/admin/users/${testUserId}/dependencies`)
                .set('Cookie', 'non-admin-cookie')
                .expect(403);

            expect(response.body.status).toBe('error');
        });

        it('should handle non-existent user gracefully', async () => {
            const response = await request(app)
                .get('/api/admin/users/non-existent-id/dependencies')
                .set('Cookie', 'auth-cookie-here')
                .expect(200);

            expect(response.body.status).toBe('success');
            expect(response.body.dependencies).toEqual({});
        });
    });

    describe('DELETE /api/admin/users/:id with hard delete', () => {
        it('should block hard delete when user has orders', async () => {
            const response = await request(app)
                .delete(`/api/admin/users/${testUserWithOrders}?hard=true`)
                .set('Cookie', 'auth-cookie-here')
                .expect(400);

            expect(response.body.status).toBe('blocked');
            expect(response.body.message).toContain('zamówień');
            expect(response.body.dependencies.orders).toBeGreaterThan(0);
            expect(response.body.blockers).toContain('orders');
        });

        it('should allow hard delete when user has no blocking dependencies', async () => {
            const response = await request(app)
                .delete(`/api/admin/users/${testUserId}?hard=true`)
                .set('Cookie', 'auth-cookie-here')
                .expect(200);

            expect(response.body.status).toBe('success');
            expect(response.body.message).toContain('na stałe');
        });

        it('should perform soft delete by default', async () => {
            const response = await request(app)
                .delete(`/api/admin/users/${testUserId}`)
                .set('Cookie', 'auth-cookie-here')
                .expect(200);

            expect(response.body.status).toBe('success');
            expect(response.body.message).toContain('zdezaktywowany');
            expect(response.body.data.isActive).toBe(false);
        });
    });
});
