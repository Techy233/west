// backend/src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
// const authMiddleware = require('../middlewares/authMiddleware'); // To be created

// @route   POST api/v1/auth/register/rider
// @desc    Register a new rider
// @access  Public
router.post('/register/rider', authController.registerRider);

// @route   POST api/v1/auth/register/driver
// @desc    Register a new driver
// @access  Public
router.post('/register/driver', authController.registerDriver);

// @route   POST api/v1/auth/login
// @desc    Login user (rider or driver)
// @access  Public
router.post('/login', authController.loginUser);

// @route   GET api/v1/auth/me
// @desc    Get current logged-in user's profile
// @access  Private (requires token)
const { protect } = require('../middlewares/authMiddleware'); // Import protect middleware

router.get('/me', protect, authController.getMe); // Protected route


// Placeholder for /me route without middleware for now, for testing controller logic
// IMPORTANT: In a real app, /me MUST be protected by an authentication middleware
// router.get('/me_unprotected', (req, res, next) => {
    // This is a temporary setup to test getMe without full middleware.
    // Manually set req.user for testing if needed, or adapt getMe to take ID from params.
    // For a quick test, you might pass userId as a query param, though not secure for real use.
    // Example: req.user = { userId: 'some-uuid-from-db-for-testing' };
    // For now, we'll let getMe handle the case where req.user is not set.
//     if(req.query.testUserId) { // purely for temporary testing if you don't have middleware yet
//         req.user = { userId: req.query.testUserId };
//     }
//     next();
// } , authController.getMe);


// @route   POST api/v1/auth/logout
// @desc    Logout user (typically involves client-side token removal)
// @access  Private
// router.post('/logout', authMiddleware.protect, authController.logoutUser); // logoutUser controller to be created

module.exports = router;
