// backend/src/services/authService.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

/**
 * Hashes a password using bcrypt.
 * @param {string} password - The plain text password.
 * @returns {Promise<string>} The hashed password.
 */
async function hashPassword(password) {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
}

/**
 * Generates a JWT for a user.
 * @param {string} userId - The user's ID.
 * @param {string} role - The user's role.
 * @returns {string} The generated JWT.
 */
function generateToken(userId, role) {
    return jwt.sign(
        { userId, role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    );
}

/**
 * Finds a user by their phone number.
 * @param {string} phoneNumber - The user's phone number.
 * @returns {Promise<Object|null>} The user object or null if not found.
 */
async function findUserByPhoneNumber(phoneNumber) {
    const result = await db.query('SELECT * FROM Users WHERE phone_number = $1', [phoneNumber]);
    return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Creates a new user (rider or general user part of driver).
 * @param {Object} userData - User details { phone_number, password, first_name, last_name, role, profile_picture_url }
 * @returns {Promise<Object>} The created user object (excluding password_hash).
 */
async function createUser({ phone_number, password, first_name, last_name, role, profile_picture_url }) {
    const hashedPassword = await hashPassword(password);
    const newUserResult = await db.query(
        'INSERT INTO Users (phone_number, password_hash, first_name, last_name, role, profile_picture_url) VALUES ($1, $2, $3, $4, $5, $6) RETURNING user_id, phone_number, first_name, last_name, role, profile_picture_url, created_at',
        [phone_number, hashedPassword, first_name, last_name, role, profile_picture_url]
    );
    if (newUserResult.rows.length === 0) {
        throw new Error('User creation failed or did not return data.');
    }
    return newUserResult.rows[0];
}

/**
 * Creates a new driver (User record + Driver record).
 * @param {Object} driverData - Full driver details including user and driver specific fields.
 * @returns {Promise<Object>} The created user part of the driver object.
 */
async function createDriver(driverData) {
    const {
        phone_number, password, first_name, last_name, profile_picture_url,
        license_number, vehicle_plate_number, vehicle_model, vehicle_color, vehicle_year
    } = driverData;

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        // Check for existing license or plate number if they must be unique
        // This check can also be done in controller before calling service, or rely on DB constraints
        const existingLicense = await client.query('SELECT driver_id FROM Drivers WHERE license_number = $1', [license_number]);
        if (existingLicense.rows.length > 0) {
            throw { statusCode: 409, message: 'This license number is already registered.', code: 'DUPLICATE_LICENSE' };
        }
        const existingPlate = await client.query('SELECT driver_id FROM Drivers WHERE vehicle_plate_number = $1', [vehicle_plate_number]);
        if (existingPlate.rows.length > 0) {
            throw { statusCode: 409, message: 'This vehicle plate number is already registered.', code: 'DUPLICATE_PLATE' };
        }

        const hashedPassword = await hashPassword(password);
        const userResult = await client.query(
            'INSERT INTO Users (phone_number, password_hash, first_name, last_name, role, profile_picture_url) VALUES ($1, $2, $3, $4, $5, $6) RETURNING user_id, phone_number, role, created_at',
            [phone_number, hashedPassword, first_name, last_name, 'driver', profile_picture_url]
        );

        if (userResult.rows.length === 0) {
            throw new Error('Driver user creation failed.');
        }
        const user = userResult.rows[0];

        await client.query(
            'INSERT INTO Drivers (driver_id, license_number, vehicle_plate_number, vehicle_model, vehicle_color, vehicle_year) VALUES ($1, $2, $3, $4, $5, $6)',
            [user.user_id, license_number, vehicle_plate_number, vehicle_model, vehicle_color, vehicle_year]
        );

        await client.query('COMMIT');
        return user; // Return the user part, driver specific details can be fetched via /me or driver profile endpoint
    } catch (error) {
        await client.query('ROLLBACK');
        // If it's one of our custom errors, rethrow it
        if (error.statusCode) throw error;
        // For other DB errors, wrap them or rethrow
        if (error.code === '23505') { // PostgreSQL unique violation (e.g. phone_number)
             throw { statusCode: 409, message: 'A unique detail (e.g., phone number) already exists.', detail: error.detail, code: 'DB_UNIQUE_CONSTRAINT' };
        }
        console.error("Error in createDriver service:", error);
        throw new Error('Driver registration failed at service level.');
    } finally {
        client.release();
    }
}

/**
 * Verifies user password.
 * @param {string} plainPassword - The plain text password from login attempt.
 * @param {string} hashedPassword - The stored hashed password.
 * @returns {Promise<boolean>} True if password matches, false otherwise.
 */
async function verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
}

/**
 * Fetches full user profile, including driver details if applicable.
 * @param {string} userId - The ID of the user.
 * @returns {Promise<Object|null>} The full user profile or null.
 */
async function getUserProfile(userId) {
    const userResult = await db.query(
        'SELECT user_id, phone_number, first_name, last_name, role, profile_picture_url, is_active, created_at FROM Users WHERE user_id = $1',
        [userId]
    );

    if (userResult.rows.length === 0) {
        return null;
    }
    let userDetails = userResult.rows[0];

    if (!userDetails.is_active) {
        // Or throw an error to be handled by controller
        // throw { statusCode: 403, message: 'User account is deactivated.'};
        return userDetails; // Controller can decide to show partial info or error based on is_active
    }

    if (userDetails.role === 'driver') {
        const driverResult = await db.query(
            'SELECT license_number, vehicle_plate_number, vehicle_model, vehicle_color, vehicle_year, is_verified, is_available FROM Drivers WHERE driver_id = $1',
            [userId]
        );
        if (driverResult.rows.length > 0) {
            const { driver_id, ...driverSpecificDetails } = driverResult.rows[0];
            userDetails = { ...userDetails, ...driverSpecificDetails };
        } else {
            userDetails.driver_details_missing = true; // Flag inconsistency
        }
    }
    return userDetails;
}


module.exports = {
    hashPassword,
    generateToken,
    findUserByPhoneNumber,
    createUser,
    createDriver,
    verifyPassword,
    getUserProfile
};
