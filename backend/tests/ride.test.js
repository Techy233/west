// backend/tests/ride.test.js
const request = require('supertest');
const { app, server } = require('../src/server');
const db = require('../src/config/db');
const jwt = require('jsonwebtoken'); // To generate mock tokens

// --- Mocking DB ---
jest.mock('../src/config/db', () => ({
    query: jest.fn(),
    pool: {
        connect: jest.fn(() => ({
            query: jest.fn(),
            release: jest.fn(),
        })),
    },
}));

// --- Helper to generate mock JWT ---
const generateMockToken = (userId, role) => {
    return jwt.sign({ userId, role }, process.env.JWT_SECRET || 'test_secret', { expiresIn: '1h' });
};

describe('Ride API Endpoints', () => {
    let mockRiderToken;
    let mockDriverToken;
    const mockRiderId = 'rider-uuid-123';
    const mockDriverId = 'driver-uuid-456';

    beforeAll(() => {
        mockRiderToken = generateMockToken(mockRiderId, 'rider');
        mockDriverToken = generateMockToken(mockDriverId, 'driver');
        // Ensure .env is loaded for JWT_SECRET or provide a default for tests
        if (!process.env.JWT_SECRET) {
            process.env.JWT_SECRET = 'test_secret';
        }
    });

    afterAll(async () => {
        if (server && server.close) {
            await new Promise(resolve => server.close(resolve));
        }
    });

    beforeEach(() => {
        db.query.mockReset();
        const mockClient = db.pool.connect();
        if(mockClient.query) mockClient.query.mockReset();
        if(mockClient.release) mockClient.release.mockReset();
    });

    describe('POST /api/v1/rides (Request Ride by Rider)', () => {
        const rideRequestPayload = {
            pickup_latitude: 6.68849, pickup_longitude: -1.62442, // Kumasi
            dropoff_latitude: 5.60372, dropoff_longitude: -0.186964, // Accra
            pickup_address_text: "Kumasi City",
            dropoff_address_text: "Accra Central"
        };

        it('should allow an authenticated rider to request a ride', async () => {
            // Mock DB response for creating the ride
            const mockRideId = 'ride-uuid-789';
            db.query
                .mockResolvedValueOnce({ // INSERT into Rides
                    rows: [{
                        ride_id: mockRideId,
                        rider_id: mockRiderId,
                        status: 'requested',
                        ...rideRequestPayload
                    }]
                })
                .mockResolvedValueOnce({ rows: [] }); // No available drivers for simplicity in this test

            const res = await request(app)
                .post('/api/v1/rides')
                .set('Authorization', `Bearer ${mockRiderToken}`)
                .send(rideRequestPayload);

            expect(res.statusCode).toEqual(201);
            expect(res.body).toHaveProperty('message', 'Ride requested successfully. No drivers currently available. Please wait or try again later.');
            expect(res.body.ride).toHaveProperty('ride_id', mockRideId);
            expect(res.body.ride).toHaveProperty('rider_id', mockRiderId);
            expect(db.query).toHaveBeenCalledTimes(2); // 1 for insert, 1 for finding drivers
        });

        it('should return 401 if no token is provided', async () => {
            const res = await request(app)
                .post('/api/v1/rides')
                .send(rideRequestPayload);
            expect(res.statusCode).toEqual(401);
        });

        it('should return 403 if a driver attempts to request a ride', async () => {
            const res = await request(app)
                .post('/api/v1/rides')
                .set('Authorization', `Bearer ${mockDriverToken}`) // Driver token
                .send(rideRequestPayload);
            expect(res.statusCode).toEqual(403); // Forbidden due to role
        });

        it('should return 400 for invalid coordinates', async () => {
            const res = await request(app)
                .post('/api/v1/rides')
                .set('Authorization', `Bearer ${mockRiderToken}`)
                .send({ ...rideRequestPayload, pickup_latitude: 200 }); // Invalid latitude
            expect(res.statusCode).toEqual(400);
            expect(res.body).toHaveProperty('message', 'Validation failed');
        });
    });

    describe('Driver Ride Actions (Accept/Reject/Update Status)', () => {
        const mockRideId = 'ride-uuid-for-driver-action';

        beforeEach(() => {
            // Common mock for fetching the ride for most driver actions
            db.query.mockImplementation((queryText, values) => {
                if (queryText.includes("SELECT * FROM Rides WHERE ride_id = $1")) {
                    // Check if it's specifically checking driver_id too for some queries
                    if (queryText.includes("AND driver_id = $2") && values[1] === mockDriverId) {
                         return Promise.resolve({ rows: [{ ride_id: mockRideId, driver_id: mockDriverId, rider_id: mockRiderId, status: 'requested' }] });
                    } else if (!queryText.includes("AND driver_id = $2") && values[0] === mockRideId) {
                         return Promise.resolve({ rows: [{ ride_id: mockRideId, driver_id: mockDriverId, rider_id: mockRiderId, status: 'requested' }] });
                    }
                }
                if (queryText.startsWith("UPDATE Rides SET status = 'accepted'")) {
                    return Promise.resolve({ rows: [{ ride_id: mockRideId, driver_id: mockDriverId, status: 'accepted' }] });
                }
                if (queryText.startsWith("UPDATE Rides SET driver_id = NULL")) { // For reject
                    return Promise.resolve({ rows: [{ ride_id: mockRideId, status: 'requested' }] });
                }
                if (queryText.startsWith("UPDATE Rides SET status = 'driver_arrived'")) {
                    return Promise.resolve({ rows: [{ ride_id: mockRideId, driver_id: mockDriverId, status: 'driver_arrived' }] });
                }
                 // Fallback for other unhandled queries in this specific test suite
                return Promise.resolve({ rows: [] });
            });
        });

        it('POST /api/v1/rides/:rideId/accept - should allow driver to accept an assigned ride', async () => {
            // Override mock for this specific sequence: fetch (status 'requested'), then update
            db.query.mockReset(); // Clear generic mocks
            db.query
                .mockResolvedValueOnce({ // Fetch ride
                    rows: [{ ride_id: mockRideId, driver_id: mockDriverId, rider_id: mockRiderId, status: 'requested' }]
                })
                .mockResolvedValueOnce({ // Update ride to accepted
                    rows: [{ ride_id: mockRideId, driver_id: mockDriverId, status: 'accepted' }]
                });

            const res = await request(app)
                .post(`/api/v1/rides/${mockRideId}/accept`)
                .set('Authorization', `Bearer ${mockDriverToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.ride).toHaveProperty('status', 'accepted');
        });

        it('POST /api/v1/rides/:rideId/reject - should allow driver to reject an assigned ride', async () => {
            db.query.mockReset();
             db.query
                .mockResolvedValueOnce({ // Fetch ride
                    rows: [{ ride_id: mockRideId, driver_id: mockDriverId, rider_id: mockRiderId, status: 'requested' }]
                })
                .mockResolvedValueOnce({ // Update ride (driver_id = NULL)
                    rows: [{ ride_id: mockRideId, driver_id: null, status: 'requested' }]
                });

            const res = await request(app)
                .post(`/api/v1/rides/${mockRideId}/reject`)
                .set('Authorization', `Bearer ${mockDriverToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.message).toContain('Ride rejected');
        });

        it('PUT /api/v1/rides/:rideId/status - should allow driver to update status to driver_arrived', async () => {
            db.query.mockReset();
            db.query
                .mockResolvedValueOnce({ // Fetch ride (status should be 'accepted' for this action)
                    rows: [{ ride_id: mockRideId, driver_id: mockDriverId, status: 'accepted' }]
                })
                .mockResolvedValueOnce({ // Update ride to driver_arrived
                    rows: [{ ride_id: mockRideId, driver_id: mockDriverId, status: 'driver_arrived' }]
                });

            const res = await request(app)
                .put(`/api/v1/rides/${mockRideId}/status`)
                .set('Authorization', `Bearer ${mockDriverToken}`)
                .send({ action: 'driver_arrived' });

            expect(res.statusCode).toEqual(200);
            expect(res.body.ride).toHaveProperty('status', 'driver_arrived');
        });
    });

    // --- Ride Cancellation Tests ---
    describe('POST /api/v1/rides/:rideId/cancel-rider', () => {
        const rideToCancel = 'ride-to-cancel-by-rider-uuid';

        it('should allow a rider to cancel their own ride in a cancellable state (e.g. requested)', async () => {
            db.query.mockReset();
            db.query
                .mockResolvedValueOnce({ // Mock service.getRide (or controller's direct DB call)
                    rows: [{ ride_id: rideToCancel, rider_id: mockRiderId, driver_id: null, status: 'requested' }]
                })
                .mockResolvedValueOnce({ // Mock service.cancelRideAsRider's DB update
                    rows: [{ ride_id: rideToCancel, status: 'cancelled_rider', rider_id: mockRiderId }]
                });

            const res = await request(app)
                .post(`/api/v1/rides/${rideToCancel}/cancel-rider`)
                .set('Authorization', `Bearer ${mockRiderToken}`)
                .send({ reason: "Changed my mind" });

            expect(res.statusCode).toEqual(200);
            expect(res.body.ride).toHaveProperty('status', 'cancelled_rider');
            expect(res.body.message).toContain('Ride cancelled successfully by rider');
        });

        it('should return 403 if another user (not the rider of the ride) tries to cancel', async () => {
            const anotherRiderToken = generateMockToken('another-rider-uuid', 'rider');
            db.query.mockReset();
            db.query.mockResolvedValueOnce({ // service.getRide would not find a ride for this user + rideId combination
                 // OR if it found the ride, the service/controller auth check would fail.
                 // Simulating the service throwing a 403/404 like error.
                 // The actual DB mock depends on how deep the test goes. Here, we assume service handles auth.
                rows: [{ ride_id: rideToCancel, rider_id: 'original-rider-id', status: 'requested' }]
            });
            // No update mock needed as it shouldn't reach that point if auth fails

            const res = await request(app)
                .post(`/api/v1/rides/${rideToCancel}/cancel-rider`)
                .set('Authorization', `Bearer ${anotherRiderToken}`)
                .send({ reason: "Test" });

            // Expecting 403/404 because the service layer should prevent this.
            // If the service's initial fetch is `WHERE ride_id = $1 AND rider_id = $2`, it would be 404.
            expect(res.statusCode).toBeOneOf([403, 404]);
        });


        it('should return 409 if ride is not in a cancellable state by rider (e.g., ongoing)', async () => {
            db.query.mockReset();
            db.query.mockResolvedValueOnce({
                rows: [{ ride_id: rideToCancel, rider_id: mockRiderId, status: 'ongoing' }]
            });
            const res = await request(app)
                .post(`/api/v1/rides/${rideToCancel}/cancel-rider`)
                .set('Authorization', `Bearer ${mockRiderToken}`)
                .send({ reason: "Too late" });

            expect(res.statusCode).toEqual(409);
            expect(res.body.message).toContain("Ride cannot be cancelled. Current status: 'ongoing'");
        });
    });

    describe('POST /api/v1/rides/:rideId/cancel-driver', () => {
        const rideToCancelByDriver = 'ride-to-cancel-by-driver-uuid';

        it('should allow an assigned driver to cancel a ride in an accepted state', async () => {
            db.query.mockReset();
            db.query
                .mockResolvedValueOnce({
                    rows: [{ ride_id: rideToCancelByDriver, driver_id: mockDriverId, rider_id: mockRiderId, status: 'accepted' }]
                })
                .mockResolvedValueOnce({
                    rows: [{ ride_id: rideToCancelByDriver, status: 'cancelled_driver', driver_id: mockDriverId }]
                });

            const res = await request(app)
                .post(`/api/v1/rides/${rideToCancelByDriver}/cancel-driver`)
                .set('Authorization', `Bearer ${mockDriverToken}`);
                // .send({ reason: "Emergency" }); // Reason is optional for driver

            expect(res.statusCode).toEqual(200);
            expect(res.body.ride).toHaveProperty('status', 'cancelled_driver');
        });

        it('should return 409 if driver tries to cancel a ride not in cancellable state (e.g. requested but not accepted)', async () => {
            db.query.mockReset();
            db.query.mockResolvedValueOnce({
                rows: [{ ride_id: rideToCancelByDriver, driver_id: mockDriverId, status: 'requested' }]
            });
             const res = await request(app)
                .post(`/api/v1/rides/${rideToCancelByDriver}/cancel-driver`)
                .set('Authorization', `Bearer ${mockDriverToken}`);

            expect(res.statusCode).toEqual(409);
            expect(res.body.message).toContain("Ride cannot be cancelled by driver. Current status: 'requested'");
        });
    });

    // --- Ride Status Update Edge Cases ---
    describe('PUT /api/v1/rides/:rideId/status (Edge Cases)', () => {
        const rideForStatusUpdate = 'ride-status-edge-uuid';

        it('should not allow completing a ride that is not ongoing', async () => {
            db.query.mockReset();
            db.query.mockResolvedValueOnce({
                rows: [{ ride_id: rideForStatusUpdate, driver_id: mockDriverId, status: 'accepted' }]
            });
            const res = await request(app)
                .put(`/api/v1/rides/${rideForStatusUpdate}/status`)
                .set('Authorization', `Bearer ${mockDriverToken}`)
                .send({ action: 'complete_trip' });

            expect(res.statusCode).toEqual(409);
            expect(res.body.message).toContain("Cannot complete trip. Ride status is 'accepted', expected 'ongoing'");
        });

        it('should not allow starting a ride that is already completed', async () => {
            db.query.mockReset();
            db.query.mockResolvedValueOnce({
                rows: [{ ride_id: rideForStatusUpdate, driver_id: mockDriverId, status: 'completed' }]
            });
            const res = await request(app)
                .put(`/api/v1/rides/${rideForStatusUpdate}/status`)
                .set('Authorization', `Bearer ${mockDriverToken}`)
                .send({ action: 'start_trip' });

            expect(res.statusCode).toEqual(409); // Based on service logic for 'start_trip'
        });

        it('should return 400 for an invalid action in status update', async () => {
            // No DB mock needed if Joi validation catches this first in the route.
            const res = await request(app)
                .put(`/api/v1/rides/${rideForStatusUpdate}/status`)
                .set('Authorization', `Bearer ${mockDriverToken}`)
                .send({ action: 'invalid_action_123' });

            expect(res.statusCode).toEqual(400);
            expect(res.body).toHaveProperty('message', 'Validation failed');
            expect(res.body.errors[0].message).toContain('Invalid action. Allowed actions are: driver_arrived, start_trip, complete_trip.');
        });
    });
});
