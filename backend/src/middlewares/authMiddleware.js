// backend/src/middlewares/authMiddleware.js
const jwt = require('jsonwebtoken');
const db = require('../config/db'); // Or your user service

exports.protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Get token from header
            token = req.headers.authorization.split(' ')[1];

            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Get user from the token (payload typically has userId and role)
            // You might want to fetch fresh user data from DB to ensure user still exists and is active
            const userResult = await db.query(
                'SELECT user_id, role, is_active FROM Users WHERE user_id = $1',
                [decoded.userId]
            );

            if (userResult.rows.length === 0) {
                return res.status(401).json({ message: 'Not authorized, user not found' });
            }

            const currentUser = userResult.rows[0];

            if (!currentUser.is_active) {
                return res.status(401).json({ message: 'Not authorized, user account is deactivated' });
            }

            // Attach user to the request object
            req.user = {
                userId: currentUser.user_id,
                role: currentUser.role
                // Add any other user properties you might need in subsequent handlers
            };

            next();
        } catch (error) {
            console.error('Token verification error:', error);
            if (error.name === 'JsonWebTokenError') {
                return res.status(401).json({ message: 'Not authorized, token failed (invalid)' });
            }
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({ message: 'Not authorized, token expired' });
            }
            res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        res.status(401).json({ message: 'Not authorized, no token provided' });
    }
};

// Middleware to authorize based on roles
exports.authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            return res.status(401).json({ message: 'Not authorized (user role not found on request)' });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                message: `User role '${req.user.role}' is not authorized to access this route. Allowed roles: ${roles.join(', ')}.`
            });
        }
        next();
    };
};

// Example usage in a route file:
// const { protect, authorize } = require('../middlewares/authMiddleware');
// router.get('/admin-only', protect, authorize('admin'), adminController.getAdminData);
// router.get('/driver-data', protect, authorize('driver'), driverController.getDriverData);
// router.get('/rider-info', protect, authorize('rider', 'admin'), riderController.getRiderInfo); // Rider or Admin
// router.get('/any-logged-in-user', protect, someController.getData); // Any authenticated user
