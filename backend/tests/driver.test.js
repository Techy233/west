// backend/tests/driver.test.js
const request = require('supertest');
const { app, server } = require('../src/server');
const db = require('../src/config/db');
const jwt = require('jsonwebtoken');

// Mock DB
jest.mock('../src/config/db', () => ({
    query: jest.fn(),
    pool: { connect: jest.fn(() => ({ query: jest.fn(), release: jest.fn() })) },
}));

// Helper to generate mock JWT
const generateMockToken = (userId, role) => {
    return jwt.sign({ userId, role }, process.env.JWT_SECRET || 'test_secret_driver', { expiresIn: '1h' });
};

describe('Driver API Endpoints (/api/v1/drivers)', () => {
    let mockDriverToken;
    let mockRiderToken; // For testing role authorization
    const mockDriverId = 'driver-availability-uuid-789';
    const mockRiderId = 'rider-non-driver-uuid-000';


    beforeAll(async () => {
        mockDriverToken = generateMockToken(mockDriverId, 'driver');
        mockRiderToken = generateMockToken(mockRiderId, 'rider');
        if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'test_secret_driver';
    });

    afterAll(async () => {
        if (server && server.close) {
            await new Promise(resolve => server.close(resolve));
        }
    });

    beforeEach(() => {
        db.query.mockReset();
    });

    describe('POST /api/v1/drivers/me/availability', () => {
        it('should allow an authenticated driver to set their availability to true', async () => {
            db.query.mockResolvedValueOnce({ // Mock the UPDATE Drivers ... RETURNING *
                rows: [{
                    driver_id: mockDriverId,
                    is_available: true,
                    updated_at: new Date().toISOString()
                }]
            });

            const res = await request(app)
                .post('/api/v1/drivers/me/availability')
                .set('Authorization', `Bearer ${mockDriverToken}`)
                .send({ is_available: true });

            expect(res.statusCode).toEqual(200);
            expect(res.body.message).toContain('Driver availability successfully set to true');
            expect(res.body.driver).toHaveProperty('is_available', true);
            expect(res.body.driver).toHaveProperty('driver_id', mockDriverId);
        });

        it('should allow an authenticated driver to set their availability to false', async () => {
            db.query.mockResolvedValueOnce({
                rows: [{
                    driver_id: mockDriverId,
                    is_available: false,
                    updated_at: new Date().toISOString()
                }]
            });

            const res = await request(app)
                .post('/api/v1/drivers/me/availability')
                .set('Authorization', `Bearer ${mockDriverToken}`)
                .send({ is_available: false });

            expect(res.statusCode).toEqual(200);
            expect(res.body.message).toContain('Driver availability successfully set to false');
            expect(res.body.driver).toHaveProperty('is_available', false);
        });

        it('should return 400 if is_available is missing in request body', async () => {
            const res = await request(app)
                .post('/api/v1/drivers/me/availability')
                .set('Authorization', `Bearer ${mockDriverToken}`)
                .send({}); // Empty body

            expect(res.statusCode).toEqual(400);
            expect(res.body.message).toContain('Validation failed');
            expect(res.body.errors[0].message).toContain('Availability status (is_available) is required');
        });

        it('should return 400 if is_available is not a boolean', async () => {
            const res = await request(app)
                .post('/api/v1/drivers/me/availability')
                .set('Authorization', `Bearer ${mockDriverToken}`)
                .send({ is_available: "not_a_boolean" });

            expect(res.statusCode).toEqual(400);
            expect(res.body.message).toContain('Validation failed');
            expect(res.body.errors[0].message).toContain('Availability status must be a boolean');
        });

        it('should return 401 if no token is provided', async () => {
            const res = await request(app)
                .post('/api/v1/drivers/me/availability')
                .send({ is_available: true });
            expect(res.statusCode).toEqual(401);
        });

        it('should return 403 if a non-driver (e.g., rider) tries to set availability', async () => {
            const res = await request(app)
                .post('/api/v1/drivers/me/availability')
                .set('Authorization', `Bearer ${mockRiderToken}`) // Rider token
                .send({ is_available: true });
            expect(res.statusCode).toEqual(403);
            expect(res.body.message).toContain("User role 'rider' is not authorized");
        });

        it('should return 404 if driver record not found during update (e.g., bad driverId from token)', async () => {
            db.query.mockResolvedValueOnce({ rows: [] }); // Simulate driver not found by service

            const res = await request(app)
                .post('/api/v1/drivers/me/availability')
                .set('Authorization', `Bearer ${mockDriverToken}`)
                .send({ is_available: true });

            expect(res.statusCode).toEqual(404);
            expect(res.body.message).toContain("Driver not found or update failed");
        });
    });
});
