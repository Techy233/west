// backend/src/services/driverService.js
const db = require('../config/db');

/**
 * Updates the availability status of a driver.
 * @param {string} driverId - The ID of the driver.
 * @param {boolean} isAvailable - The new availability status.
 * @returns {Promise<object>} The updated driver status object { driver_id, is_available, updated_at }.
 * @throws {Error} If the update fails or driver not found.
 */
async function updateDriverAvailability(driverId, isAvailable) {
    try {
        // Also update last_location_update when toggling availability,
        // as this often implies they are starting or ending a "shift".
        // Or, this could be a separate field like 'last_active_at'.
        // For now, just updating is_available and updated_at for the Drivers table.
        const query = `
            UPDATE Drivers
            SET is_available = $1, updated_at = NOW()
            WHERE driver_id = $2
            RETURNING driver_id, is_available, updated_at;
        `;
        const result = await db.query(query, [isAvailable, driverId]);

        if (result.rows.length === 0) {
            throw { statusCode: 404, message: "Driver not found or update failed." };
        }

        // TODO: Optionally, if going offline, check for active rides and handle appropriately
        // (e.g., prevent going offline, or notify admin/rider). For MVP, this check is omitted.

        console.log(`Driver ${driverId} availability set to ${isAvailable}`);
        return result.rows[0];

    } catch (error) {
        console.error(`Error updating availability for driver ${driverId} in service:`, error);
        if(error.statusCode) throw error; // Re-throw custom errors
        throw new Error('Failed to update driver availability status.'); // Generic error for others
    }
}

module.exports = {
    updateDriverAvailability
};
