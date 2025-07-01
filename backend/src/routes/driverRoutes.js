// backend/src/routes/driverRoutes.js
const express = require('express');
const router = express.Router();
const driverController = require('../controllers/driverController');
const { protect, authorize } = require('../middlewares/authMiddleware');
const { validateRequest } = require('../validations/authValidation'); // Generic validator
const { updateAvailabilitySchema } = require('../validations/driverValidation');

// @route   POST api/v1/drivers/me/availability
// @desc    Set the current driver's availability status
// @access  Private (Driver only)
router.post(
    '/me/availability',
    protect,
    authorize('driver'),
    validateRequest(updateAvailabilitySchema),
    driverController.setAvailability
);

// Add other driver-specific routes here
// Example: GET /me/earnings, GET /me/ride-history (driver specific version)

module.exports = router;
