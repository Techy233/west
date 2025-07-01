// backend/src/controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db'); // Assuming db.js exports a query function or pool

// --- Helper Functions (Consider moving to a service layer later) ---

// Function to hash password
async function hashPassword(password) {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
}

// Function to generate JWT
function generateToken(userId, role) {
    return jwt.sign(
        { userId, role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    );
}

// --- Controller Methods ---

// Register a new Rider
exports.registerRider = async (req, res) => {
    const { phone_number, password, first_name, last_name, profile_picture_url } = req.body;

    // Basic Validation (use Joi/Yup for robust validation in a real app)
    if (!phone_number || !password) {
        return res.status(400).json({ message: 'Phone number and password are required.' });
    }

    try {
        // Check if user already exists
        const existingUser = await db.query('SELECT * FROM Users WHERE phone_number = $1', [phone_number]);
        if (existingUser.rows.length > 0) {
            return res.status(409).json({ message: 'User with this phone number already exists.' });
        }

        const hashedPassword = await hashPassword(password);

        const newUser = await db.query(
            'INSERT INTO Users (phone_number, password_hash, first_name, last_name, role, profile_picture_url) VALUES ($1, $2, $3, $4, $5, $6) RETURNING user_id, phone_number, role, created_at',
            [phone_number, hashedPassword, first_name, last_name, 'rider', profile_picture_url]
        );

        const user = newUser.rows[0];
        const token = generateToken(user.user_id, user.role);

        res.status(201).json({
            message: 'Rider registered successfully!',
            token,
            user: {
                userId: user.user_id,
                phoneNumber: user.phone_number,
                role: user.role,
                createdAt: user.created_at
            }
        });

    } catch (error) {
        console.error('Error registering rider:', error);
        res.status(500).json({ message: 'Server error during rider registration.', error: error.message });
    }
};

// Register a new Driver
exports.registerDriver = async (req, res) => {
    const {
        phone_number, password, first_name, last_name, profile_picture_url,
        license_number, vehicle_plate_number, vehicle_model, vehicle_color, vehicle_year
    } = req.body;

    if (!phone_number || !password || !license_number || !vehicle_plate_number) {
        return res.status(400).json({ message: 'Phone number, password, license number, and vehicle plate number are required.' });
    }

    try {
        // Check if user already exists
        const existingUser = await db.query('SELECT * FROM Users WHERE phone_number = $1', [phone_number]);
        if (existingUser.rows.length > 0) {
            return res.status(409).json({ message: 'User with this phone number already exists.' });
        }

        // Check for existing license or plate number if they must be unique across all drivers
        const existingLicense = await db.query('SELECT * FROM Drivers WHERE license_number = $1', [license_number]);
        if (existingLicense.rows.length > 0) {
            return res.status(409).json({ message: 'This license number is already registered.' });
        }
        const existingPlate = await db.query('SELECT * FROM Drivers WHERE vehicle_plate_number = $1', [vehicle_plate_number]);
        if (existingPlate.rows.length > 0) {
            return res.status(409).json({ message: 'This vehicle plate number is already registered.' });
        }


        const hashedPassword = await hashPassword(password);

        // Use a transaction to ensure both User and Driver records are created or none
        const client = await db.pool.connect(); // Get a client from the pool for transaction
        try {
            await client.query('BEGIN');

            const newUserResult = await client.query(
                'INSERT INTO Users (phone_number, password_hash, first_name, last_name, role, profile_picture_url) VALUES ($1, $2, $3, $4, $5, $6) RETURNING user_id, phone_number, role, created_at',
                [phone_number, hashedPassword, first_name, last_name, 'driver', profile_picture_url]
            );
            const user = newUserResult.rows[0];

            await client.query(
                'INSERT INTO Drivers (driver_id, license_number, vehicle_plate_number, vehicle_model, vehicle_color, vehicle_year) VALUES ($1, $2, $3, $4, $5, $6)',
                [user.user_id, license_number, vehicle_plate_number, vehicle_model, vehicle_color, vehicle_year]
            );

            await client.query('COMMIT');

            const token = generateToken(user.user_id, user.role);

            res.status(201).json({
                message: 'Driver registered successfully! Awaiting verification.',
                token,
                user: {
                    userId: user.user_id,
                    phoneNumber: user.phone_number,
                    role: user.role,
                    createdAt: user.created_at,
                    licenseNumber: license_number // include some driver specific info
                }
            });

        } catch (error) {
            await client.query('ROLLBACK');
            throw error; // Rethrow to be caught by outer catch
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('Error registering driver:', error);
        // Specific error for unique constraint violations if not handled above
        if (error.code === '23505') { // PostgreSQL unique violation
             return res.status(409).json({ message: 'A unique detail (e.g., phone, license, plate) already exists.', detail: error.detail });
        }
        res.status(500).json({ message: 'Server error during driver registration.', error: error.message });
    }
};

// Login User (Rider or Driver)
exports.loginUser = async (req, res) => {
    const { phone_number, password } = req.body;

    if (!phone_number || !password) {
        return res.status(400).json({ message: 'Phone number and password are required.' });
    }

    try {
        const userResult = await db.query('SELECT user_id, phone_number, password_hash, role, is_active FROM Users WHERE phone_number = $1', [phone_number]);

        if (userResult.rows.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials. User not found.' });
        }

        const user = userResult.rows[0];

        if (!user.is_active) {
            return res.status(403).json({ message: 'Account is deactivated. Please contact support.' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials. Password incorrect.' });
        }

        // If driver, check if verified (optional: can allow login but restrict actions)
        if (user.role === 'driver') {
            const driverResult = await db.query('SELECT is_verified FROM Drivers WHERE driver_id = $1', [user.user_id]);
            if (driverResult.rows.length > 0 && !driverResult.rows[0].is_verified) {
                // return res.status(403).json({ message: 'Driver account not yet verified. Please wait for admin approval.' });
                // Or, allow login but send a status
                 const token = generateToken(user.user_id, user.role);
                 return res.status(200).json({
                    message: 'Login successful, but driver account is not yet verified.',
                    token,
                    user: {
                        userId: user.user_id,
                        phoneNumber: user.phone_number,
                        role: user.role,
                        isVerified: false
                    }
                });
            }
        }


        const token = generateToken(user.user_id, user.role);

        res.status(200).json({
            message: 'Login successful!',
            token,
            user: {
                userId: user.user_id,
                phoneNumber: user.phone_number,
                role: user.role,
                isVerified: user.role === 'driver' ? (await db.query('SELECT is_verified FROM Drivers WHERE driver_id = $1', [user.user_id])).rows[0].is_verified : true
            }
        });

    } catch (error) {
        console.error('Error logging in user:', error);
        res.status(500).json({ message: 'Server error during login.', error: error.message });
    }
};

// Example: Get current user profile (Protected Route - needs auth middleware)
exports.getMe = async (req, res) => {
    // req.user will be populated by authentication middleware
    if (!req.user) {
        return res.status(401).json({ message: 'Not authorized' });
    }

    try {
        const userId = req.user.userId;
        const userResult = await db.query('SELECT user_id, phone_number, first_name, last_name, role, profile_picture_url, created_at FROM Users WHERE user_id = $1', [userId]);

        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }

        let userDetails = userResult.rows[0];

        // If driver, fetch additional driver details
        if (userDetails.role === 'driver') {
            const driverResult = await db.query('SELECT * FROM Drivers WHERE driver_id = $1', [userId]);
            if (driverResult.rows.length > 0) {
                // Combine user and driver details, be careful not to overwrite user_id from Users table
                const { driver_id, ...driverSpecificDetails } = driverResult.rows[0];
                userDetails = { ...userDetails, ...driverSpecificDetails };
            }
        }

        res.status(200).json(userDetails);
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ message: 'Server error fetching profile.', error: error.message });
    }
};
