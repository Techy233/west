// backend/src/services/userService.js
const db = require('../config/db');

/**
 * Updates a user's basic profile information.
 * @param {string} userId - The ID of the user to update.
 * @param {object} profileData - Data to update (e.g., { first_name, last_name }).
 * @returns {Promise<object>} The updated user object.
 * @throws {Error} If update fails or user not found.
 */
async function updateUserProfile(userId, profileData) {
    const { first_name, last_name } = profileData;
    const fieldsToUpdate = {};
    if (first_name !== undefined) fieldsToUpdate.first_name = first_name;
    if (last_name !== undefined) fieldsToUpdate.last_name = last_name;

    if (Object.keys(fieldsToUpdate).length === 0) {
        // This should ideally be caught by Joi validation (.min(1)) before service call
        throw { statusCode: 400, message: "No valid fields provided for profile update." };
    }

    const setClauses = Object.keys(fieldsToUpdate).map((key, index) => `${key} = $${index + 1}`).join(', ');
    const values = Object.values(fieldsToUpdate);

    const queryText = `
        UPDATE Users
        SET ${setClauses}, updated_at = NOW()
        WHERE user_id = $${values.length + 1}
        RETURNING user_id, phone_number, first_name, last_name, role, profile_picture_url, updated_at;
    `;
    values.push(userId);

    try {
        const result = await db.query(queryText, values);
        if (result.rows.length === 0) {
            throw { statusCode: 404, message: "User not found or profile update failed." };
        }
        return result.rows[0];
    } catch (error) {
        console.error('Error updating user profile in service:', error);
        throw new Error('Server error during profile update.'); // Generic error
    }
}


/**
 * Updates a user's profile picture URL.
 * @param {string} userId - The ID of the user.
 * @param {string} profilePictureUrl - The new URL of the profile picture.
 * @returns {Promise<object>} Object containing user_id and new profile_picture_url.
 */
async function updateUserProfilePictureUrl(userId, profilePictureUrl) {
    try {
        const result = await db.query(
            'UPDATE Users SET profile_picture_url = $1, updated_at = NOW() WHERE user_id = $2 RETURNING user_id, profile_picture_url',
            [profilePictureUrl, userId]
        );
        if (result.rows.length === 0) {
            throw { statusCode: 404, message: "User not found, cannot update profile picture." };
        }
        return result.rows[0];
    } catch (dbError) {
        console.error("DB error updating profile picture URL in service:", dbError);
        throw new Error("Failed to save profile picture information to database.");
    }
}

/**
 * Adds or updates a device token for a user (Upsert).
 * @param {string} userId - The ID of the user.
 * @param {string} deviceToken - The FCM/APNS device token.
 * @param {string} deviceType - Type of device ('android', 'ios', 'web').
 * @returns {Promise<object>} The created or updated device token record.
 */
async function addOrUpdateUserDeviceToken(userId, deviceToken, deviceType) {
    const query = `
        INSERT INTO UserDeviceTokens (user_id, device_token, device_type, last_used_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (user_id, device_token)
        DO UPDATE SET last_used_at = NOW(), device_type = EXCLUDED.device_type
        RETURNING token_id, user_id, device_token, device_type, last_used_at;
    `;
    // ON CONFLICT on (user_id, device_token) ensures that if that pair exists,
    // we just update its last_used_at and device_type (in case it changed, e.g. user logged in on a new phone type with same old token somehow)
    // If the token is truly new for this user, it inserts.
    // If the token already exists for this user, it updates last_used_at.

    try {
        const result = await db.query(query, [userId, deviceToken, deviceType]);
        if (result.rows.length === 0) {
            // This should not happen with INSERT ... RETURNING unless something is very wrong.
            throw new Error('Failed to save device token.');
        }
        console.log(`Device token for user ${userId} (${deviceType}) processed: ${deviceToken.substring(0,15)}...`);
        return result.rows[0];
    } catch (error) {
        console.error(`Error saving device token for user ${userId}:`, error);
        throw new Error('Server error while saving device token.');
    }
}


module.exports = {
    updateUserProfile,
    updateUserProfilePictureUrl,
    addOrUpdateUserDeviceToken
};

/**
 * Fetches all valid device tokens for a given user.
 * @param {string} userId - The ID of the user.
 * @returns {Promise<string[]>} An array of device token strings.
 */
async function getUserDeviceTokens(userId) {
    if (!userId) return [];
    try {
        const result = await db.query(
            "SELECT device_token FROM UserDeviceTokens WHERE user_id = $1 AND device_token IS NOT NULL",
            [userId]
        );
        return result.rows.map(row => row.device_token);
    } catch (error) {
        console.error(`Error fetching device tokens for user ${userId}:`, error);
        return []; // Return empty array on error, so notification sending doesn't break catastrophically
    }
}

module.exports = {
    updateUserProfile,
    updateUserProfilePictureUrl,
    addOrUpdateUserDeviceToken,
    getUserDeviceTokens
};
