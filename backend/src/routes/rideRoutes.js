// backend/src/routes/rideRoutes.js
const express = require('express');
const router = express.Router();
const rideController = require('../controllers/rideController');
const { protect, authorize } = require('../middlewares/authMiddleware');
const { validateRequest } = require('../validations/authValidation'); // Re-using generic validator
const { requestRideSchema } = require('../validations/rideValidation');


// @route   POST api/v1/rides
// @desc    Rider requests a new ride
// @access  Private (Rider only)
router.post(
    '/',
    protect,
    authorize('rider'),
    validateRequest(requestRideSchema),
    rideController.requestRide
);


// Placeholder for other ride routes:
// GET /api/v1/rides/:rideId - Get details of a specific ride (Rider or Driver involved, or Admin)
// router.get('/:rideId', protect, rideController.getRideDetails);

// @route   POST api/v1/rides/:rideId/accept
// @desc    Driver accepts a ride request
// @access  Private (Driver only)
router.post('/:rideId/accept', protect, authorize('driver'), rideController.acceptRide);

// @route   POST api/v1/rides/:rideId/reject
// @desc    Driver rejects a ride request
// @access  Private (Driver only)
router.post('/:rideId/reject', protect, authorize('driver'), rideController.rejectRide);


// PUT /api/v1/rides/:rideId/status - Driver updates ride status (e.g., arrived, started, completed)
const { driverUpdateRideStatusSchema, cancelRideRiderSchema } = require('../validations/rideValidation'); // Import more schemas
router.put(
    '/:rideId/status',
    protect,
    authorize('driver'),
    validateRequest(driverUpdateRideStatusSchema),
    rideController.updateRideStatusByDriver
);

// @route   POST api/v1/rides/:rideId/cancel-rider
// @desc    Rider cancels their ride request
// @access  Private (Rider only)
router.post(
    '/:rideId/cancel-rider',
    protect,
    authorize('rider'),
    validateRequest(cancelRideRiderSchema), // Validation for reason (optional)
    rideController.cancelRideByRider
);

// @route   POST api/v1/rides/:rideId/cancel-driver
// @desc    Driver cancels an accepted/assigned ride
// @access  Private (Driver only)
// No specific request body validation needed here beyond auth & ride state checks in controller for MVP
router.post(
    '/:rideId/cancel-driver',
    protect,
    authorize('driver'),
    rideController.cancelRideByDriver
);


// @route   GET api/v1/rides/:rideId
// @desc    Get details of a specific ride
// @access  Private (Rider or Driver involved, or Admin)
router.get('/:rideId', protect, rideController.getRideDetails);


// GET /api/v1/rides/me/active - Get current active ride for logged in user (Rider or Driver)
// router.get('/me/active', protect, rideController.getActiveRideForUser);

// GET /api/v1/rides/me/history - Get ride history for logged in user
// router.get('/me/history', protect, rideController.getRideHistoryForUser);


module.exports = router;
