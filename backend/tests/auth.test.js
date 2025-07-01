// backend/tests/auth.test.js
const request = require('supertest');
const { app, server } = require('../src/server'); // Assuming server.js exports app and server
const db = require('../src/config/db'); // We'll need to mock or manage DB interactions

// --- Mocking DB ---
// This is a simple mock. For more complex scenarios, you might use a test database
// or more sophisticated mocking libraries like pg-mem or jest-mock-extended.
jest.mock('../src/config/db', () => ({
    query: jest.fn(),
    pool: { // Mock pool for transaction tests if needed
        connect: jest.fn(() => ({
            query: jest.fn(),
            release: jest.fn(),
        })),
    },
}));

describe('Auth API Endpoints', () => {
    // Make sure to close the server after all tests are done to prevent Jest hanging
    afterAll(async () => {
        if (server && server.close) {
            await new Promise(resolve => server.close(resolve));
        }
        // If your db module has a close/end function, call it here
        // if (db.pool && db.pool.end) {
        // await db.pool.end();
        // }
    });

    beforeEach(() => {
        // Reset mocks before each test
        db.query.mockReset();
        if (db.pool.connect().query) db.pool.connect().query.mockReset();
        if (db.pool.connect().release) db.pool.connect().release.mockReset();
    });

    describe('POST /api/v1/auth/register/rider', () => {
        it('should register a new rider successfully with valid data', async () => {
            // Mock DB responses
            db.query
                .mockResolvedValueOnce({ rows: [] }) // For checking existing user
                .mockResolvedValueOnce({ // For inserting new user
                    rows: [{
                        user_id: 'some-uuid-rider',
                        phone_number: '0244000001',
                        role: 'rider',
                        created_at: new Date().toISOString()
                    }]
                });

            const res = await request(app)
                .post('/api/v1/auth/register/rider')
                .send({
                    phone_number: '0244000001',
                    password: 'Password123!',
                    first_name: 'Test',
                    last_name: 'Rider'
                });

            expect(res.statusCode).toEqual(201);
            expect(res.body).toHaveProperty('message', 'Rider registered successfully!');
            expect(res.body).toHaveProperty('token');
            expect(res.body.user).toHaveProperty('userId', 'some-uuid-rider');
            expect(res.body.user).toHaveProperty('role', 'rider');
        });

        it('should return 400 for missing phone_number or password', async () => {
            const res = await request(app)
                .post('/api/v1/auth/register/rider')
                .send({
                    // phone_number: '0244000002', // Missing phone
                    password: 'Password123!',
                });
            expect(res.statusCode).toEqual(400);
            expect(res.body).toHaveProperty('message', 'Validation failed');
            expect(res.body.errors[0]).toHaveProperty('field', 'phone_number');
        });

        it('should return 409 if phone number already exists', async () => {
            db.query.mockResolvedValueOnce({ rows: [{ user_id: 'existing-user-id' }] }); // Simulate user exists

            const res = await request(app)
                .post('/api/v1/auth/register/rider')
                .send({
                    phone_number: '0244000003',
                    password: 'Password123!',
                });

            expect(res.statusCode).toEqual(409);
            expect(res.body).toHaveProperty('message', 'User with this phone number already exists.');
        });

        it('should return 400 for invalid password format', async () => {
            const res = await request(app)
                .post('/api/v1/auth/register/rider')
                .send({
                    phone_number: '0244000004',
                    password: 'weak',
                });
            expect(res.statusCode).toEqual(400);
            expect(res.body.errors[0]).toHaveProperty('field', 'password');
            expect(res.body.errors[0].message).toContain('Password must be at least 8 characters long.');
        });
    });

    describe('POST /api/v1/auth/login', () => {
        it('should login an existing rider successfully with correct credentials', async () => {
            const mockUser = {
                user_id: 'rider-login-uuid',
                phone_number: '0244000005',
                password_hash: await require('bcryptjs').hash('Password123!', 10), // Hash the password
                role: 'rider',
                is_active: true
            };
            db.query.mockResolvedValueOnce({ rows: [mockUser] }); // User found

            const res = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    phone_number: '0244000005',
                    password: 'Password123!'
                });

            expect(res.statusCode).toEqual(200);
            expect(res.body).toHaveProperty('message', 'Login successful!');
            expect(res.body).toHaveProperty('token');
            expect(res.body.user).toHaveProperty('userId', mockUser.user_id);
            expect(res.body.user).toHaveProperty('role', 'rider');
        });

        it('should return 401 for non-existent user', async () => {
            db.query.mockResolvedValueOnce({ rows: [] }); // User not found

            const res = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    phone_number: '0244000006',
                    password: 'Password123!'
                });

            expect(res.statusCode).toEqual(401);
            expect(res.body).toHaveProperty('message', 'Invalid phone number or password.');
        });

        it('should return 401 for incorrect password', async () => {
            const mockUser = {
                user_id: 'rider-login-uuid-wrongpass',
                phone_number: '0244000007',
                password_hash: await require('bcryptjs').hash('CorrectPassword123!', 10),
                role: 'rider',
                is_active: true
            };
            db.query.mockResolvedValueOnce({ rows: [mockUser] }); // User found

            const res = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    phone_number: '0244000007',
                    password: 'WrongPassword123!'
                });

            expect(res.statusCode).toEqual(401);
            expect(res.body).toHaveProperty('message', 'Invalid phone number or password.');
        });

        it('should return 403 for deactivated user', async () => {
            const mockUser = {
                user_id: 'rider-login-uuid-deactivated',
                phone_number: '0244000008',
                password_hash: await require('bcryptjs').hash('Password123!', 10),
                role: 'rider',
                is_active: false // Deactivated
            };
            db.query.mockResolvedValueOnce({ rows: [mockUser] });

            const res = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    phone_number: '0244000008',
                    password: 'Password123!'
                });

            expect(res.statusCode).toEqual(403);
            expect(res.body).toHaveProperty('message', 'Your account has been deactivated. Please contact support.');
        });
    });

    // TODO: Add tests for driver registration
    // describe('POST /api/v1/auth/register/driver', () => { ... });

    // TODO: Add tests for /api/v1/auth/me (requires mocking auth middleware or token generation)
    // describe('GET /api/v1/auth/me', () => { ... });
});
