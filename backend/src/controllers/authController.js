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

        const newUserResult = await db.query(
            'INSERT INTO Users (phone_number, password_hash, first_name, last_name, role, profile_picture_url) VALUES ($1, $2, $3, $4, $5, $6) RETURNING user_id, phone_number, role, created_at',
            [phone_number, hashedPassword, first_name, last_name, 'rider', profile_picture_url]
        );

        if (newUserResult.rows.length === 0) {
            // This case should ideally not happen if INSERT RETURNING is successful, but good to be defensive
            console.error('Rider registration: User insert failed or did not return data.');
            return res.status(500).json({ message: 'Rider registration failed, please try again.' });
        }

        const user = newUserResult.rows[0];
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
        if (error.code === '23505') { // Unique constraint violation (e.g. phone_number if somehow missed by initial check, or other unique fields)
             return res.status(409).json({ message: 'A unique detail (e.g., phone number) already exists.', detail: error.detail });
        }
        // Log the detailed error for server-side inspection
        // For the client, send a more generic error unless it's a specific, safe-to-share issue
        res.status(500).json({ message: 'Server error during rider registration. Please try again later.' });
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

        } catch (transactionError) {
            await client.query('ROLLBACK');
            console.error('Transaction error during driver registration:', transactionError);
            // Check for unique constraint violation within transaction
            if (transactionError.code === '23505') {
                return res.status(409).json({ message: 'A unique detail (e.g., phone, license, plate) already exists.', detail: transactionError.detail });
            }
            // For other transaction errors, send a generic server error
            return res.status(500).json({ message: 'Server error during driver registration. Transaction failed.' });
        } finally {
            client.release();
        }

    } catch (initialError) { // Errors before starting transaction or after client.release() if any
        console.error('Error registering driver (outside transaction):', initialError);
        // Specific error for unique constraint violations if somehow caught here (less likely)
        if (initialError.code === '23505') {
             return res.status(409).json({ message: 'A unique detail (e.g., phone, license, plate) already exists.', detail: initialError.detail });
        }
        res.status(500).json({ message: 'Server error during driver registration. Please try again later.' });
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
            return res.status(401).json({ message: 'Invalid phone number or password.' }); // More generic for security
        }

        const user = userResult.rows[0];

        if (!user.is_active) {
            return res.status(403).json({ message: 'Your account has been deactivated. Please contact support.' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid phone number or password.' }); // More generic for security
        }

        let isDriverVerified = true; // Assume true for riders or if not a driver
        if (user.role === 'driver') {
            const driverResult = await db.query('SELECT is_verified FROM Drivers WHERE driver_id = $1', [user.user_id]);
            // It's possible a User record exists with role 'driver' but no matching Drivers record if registration was interrupted
            // or data is inconsistent. Handle this gracefully.
            if (driverResult.rows.length === 0) {
                console.warn(`Login attempt for user ${user.user_id} with role 'driver' but no matching record in Drivers table.`);
                // Decide policy: block login, or allow but mark as unverified?
                // For now, treat as unverified or potentially an error state.
                // This could indicate data inconsistency that needs admin attention.
                return res.status(403).json({ message: 'Driver account incomplete or not found. Please contact support.' });
            }
            isDriverVerified = driverResult.rows[0].is_verified;

            if (!isDriverVerified) {
                 const token = generateToken(user.user_id, user.role);
                 return res.status(200).json({ // Use 200 but with a specific message
                    message: 'Login successful, but your driver account is not yet verified by an administrator.',
                    token,
                    user: {
                        userId: user.user_id,
                        phoneNumber: user.phone_number,
                        role: user.role,
                        isVerified: isDriverVerified
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
                isVerified: isDriverVerified
            }
        });

    } catch (error) {
        console.error('Error logging in user:', error);
        // Avoid sending detailed db error messages to client in production
        res.status(500).json({ message: 'Server error during login. Please try again later.' });
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
        const userResult = await db.query(
            'SELECT user_id, phone_number, first_name, last_name, role, profile_picture_url, is_active, created_at FROM Users WHERE user_id = $1',
            [userId]
        );

        if (userResult.rows.length === 0) {
            // This should ideally not happen if JWT is valid and user was fetched during auth middleware
            return res.status(404).json({ message: 'User profile not found.' });
        }

        let userDetails = userResult.rows[0];

        // If the user is not active, perhaps middleware should have caught this,
        // but double-check here or ensure middleware is always run before this.
        if (!userDetails.is_active) {
             return res.status(403).json({ message: 'User account is deactivated.' });
        }

        // If driver, fetch additional driver-specific details
        if (userDetails.role === 'driver') {
            const driverResult = await db.query(
                'SELECT license_number, vehicle_plate_number, vehicle_model, vehicle_color, vehicle_year, is_verified, is_available FROM Drivers WHERE driver_id = $1',
                [userId]
            );
            if (driverResult.rows.length > 0) {
                // Combine user and driver details
                // Exclude driver_id from driverSpecificDetails if it's redundant with userDetails.user_id
                const { driver_id, ...driverSpecificDetails } = driverResult.rows[0];
                userDetails = { ...userDetails, ...driverSpecificDetails };
            } else {
                // This state (User role is 'driver' but no Drivers record) indicates an inconsistency.
                console.warn(`User ${userId} has role 'driver' but no corresponding entry in Drivers table.`);
                // You might want to return a specific error or limited profile here.
                // For now, we'll return the base user details but flag this potential issue.
                userDetails.driver_details_missing = true;
            }
        }
        // Remove sensitive data like password hash if it were ever fetched (it's not in this query)
        // delete userDetails.password_hash;

        res.status(200).json(userDetails);
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ message: 'Server error fetching user profile. Please try again later.' });
    }
};
