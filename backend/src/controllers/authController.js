// backend/src/controllers/authController.js
const authService = require('../services/authService');

// --- Controller Methods ---

// Register a new Rider
exports.registerRider = async (req, res) => {
    const { phone_number, password, first_name, last_name, profile_picture_url } = req.body;

    try {
        const existingUser = await authService.findUserByPhoneNumber(phone_number);
        if (existingUser) {
            return res.status(409).json({ message: 'User with this phone number already exists.' });
        }

        const user = await authService.createUser({
            phone_number, password, first_name, last_name,
            role: 'rider', profile_picture_url
        });

        const token = authService.generateToken(user.user_id, user.role);

        // Sanitize user object before sending (remove password_hash if it was on user object)
        const { password_hash, ...userResponse } = user;


        res.status(201).json({
            message: 'Rider registered successfully!',
            token,
            user: userResponse
        });

    } catch (error) {
        console.error('Error registering rider (controller):', error);
        if (error.code === '23505' || error.code === 'DB_UNIQUE_CONSTRAINT' || error.statusCode === 409) {
             return res.status(409).json({ message: error.message || 'A unique detail (e.g., phone number) already exists.', detail: error.detail });
        }
        if (error.message === 'User creation failed or did not return data.') {
            return res.status(500).json({ message: 'Rider registration failed, please try again.' });
        }
        res.status(500).json({ message: 'Server error during rider registration. Please try again later.' });
    }
};

// Register a new Driver
exports.registerDriver = async (req, res) => {
    const driverData = req.body; // Contains all fields for user and driver

    try {
        const existingUser = await authService.findUserByPhoneNumber(driverData.phone_number);
        if (existingUser) {
            return res.status(409).json({ message: 'User with this phone number already exists.' });
        }

        const user = await authService.createDriver(driverData); // createDriver handles transaction and specific checks
        const token = authService.generateToken(user.user_id, user.role);

        // Sanitize user object
        const { password_hash, ...userResponse } = user;


        res.status(201).json({
            message: 'Driver registered successfully! Awaiting verification.',
            token,
            user: { // Return only essential user info, driver specific details can be fetched via /me
                userId: userResponse.user_id,
                phoneNumber: userResponse.phone_number,
                role: userResponse.role,
                createdAt: userResponse.created_at,
                firstName: userResponse.first_name, // if needed by client immediately
                lastName: userResponse.last_name   // if needed
            }
        });

    } catch (error) {
        console.error('Error registering driver (controller):', error);
        if (error.statusCode === 409) { // Custom error from service for license/plate
             return res.status(409).json({ message: error.message, code: error.code });
        }
        if (error.code === '23505' || error.code === 'DB_UNIQUE_CONSTRAINT') { // Phone number unique constraint from DB
             return res.status(409).json({ message: 'A user with this phone number already exists.', detail: error.detail });
        }
        res.status(500).json({ message: error.message || 'Server error during driver registration. Please try again later.' });
    }
};

// Login User (Rider or Driver)
exports.loginUser = async (req, res) => {
    const { phone_number, password } = req.body;

    try {
        const user = await authService.findUserByPhoneNumber(phone_number);
        if (!user) {
            return res.status(401).json({ message: 'Invalid phone number or password.' });
        }

        if (!user.is_active) {
            return res.status(403).json({ message: 'Your account has been deactivated. Please contact support.' });
        }

        const isMatch = await authService.verifyPassword(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid phone number or password.' });
        }

        let isDriverVerified = true;
        let driverDetails = null;

        if (user.role === 'driver') {
            // Fetch full profile which includes driver verification status
            const fullProfile = await authService.getUserProfile(user.user_id);
            if (!fullProfile || fullProfile.driver_details_missing) {
                 console.warn(`Login: Driver ${user.user_id} missing driver-specific details.`);
                 return res.status(403).json({ message: 'Driver account incomplete. Please contact support.' });
            }
            isDriverVerified = fullProfile.is_verified;
            driverDetails = fullProfile; // Contains all merged details

            if (!isDriverVerified) {
                 const token = authService.generateToken(user.user_id, user.role);
                 return res.status(200).json({
                    message: 'Login successful, but your driver account is not yet verified by an administrator.',
                    token,
                    user: { // Send back sanitized basic user info
                        userId: user.user_id,
                        phoneNumber: user.phone_number,
                        role: user.role,
                        isVerified: isDriverVerified
                    }
                });
            }
        }

        const token = authService.generateToken(user.user_id, user.role);

        // Prepare user response object
        const userResponse = {
            userId: user.user_id,
            phoneNumber: user.phone_number,
            role: user.role,
            isVerified: isDriverVerified,
            // Include other details if needed, from 'user' or 'driverDetails'
            firstName: driverDetails ? driverDetails.first_name : user.first_name,
            lastName: driverDetails ? driverDetails.last_name : user.last_name,
            profilePictureUrl: driverDetails ? driverDetails.profile_picture_url : user.profile_picture_url
        };


        res.status(200).json({
            message: 'Login successful!',
            token,
            user: userResponse
        });

    } catch (error) {
        console.error('Error logging in user (controller):', error);
        res.status(500).json({ message: 'Server error during login. Please try again later.' });
    }
};

// Get current user profile (Protected Route - needs auth middleware)
exports.getMe = async (req, res) => {
    if (!req.user) { // Should be caught by protect middleware, but defensive check
        return res.status(401).json({ message: 'Not authorized' });
    }

    try {
        const userId = req.user.userId;
        const userProfile = await authService.getUserProfile(userId);

        if (!userProfile) {
            return res.status(404).json({ message: 'User profile not found.' });
        }

        if (!userProfile.is_active) { // Check again, even if middleware might check
             return res.status(403).json({ message: 'User account is deactivated.' });
        }

        // Sanitize if any sensitive fields were on userProfile (authService.getUserProfile should already do this)
        const { password_hash, ...responseProfile } = userProfile;

        res.status(200).json(responseProfile);
    } catch (error) {
        console.error('Error fetching user profile (controller):', error);
        if(error.statusCode) { // Propagate custom errors from service
            return res.status(error.statusCode).json({ message: error.message });
        }
        res.status(500).json({ message: 'Server error fetching user profile. Please try again later.' });
    }
};
