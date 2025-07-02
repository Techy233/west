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

/**
 * Updates the current GPS location of a driver.
 * @param {string} driverId - The ID of the driver.
 * @param {number} latitude - The new latitude.
 * @param {number} longitude - The new longitude.
 * @returns {Promise<void>}
 * @throws {Error} If the update fails or driver not found.
 */
async function updateDriverLocation(driverId, latitude, longitude) {
    try {
        // Validate latitude and longitude basic range if needed, though DB constraints might also exist.
        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            console.warn(`Invalid coordinates for driver ${driverId}: Lat ${latitude}, Lon ${longitude}`);
            // Decide if to throw or just log. For now, let DB handle constraints if any.
        }

        const query = `
            UPDATE Drivers
            SET current_latitude = $1, current_longitude = $2, last_location_update = NOW()
            WHERE driver_id = $3;
        `;
        const result = await db.query(query, [latitude, longitude, driverId]);

        if (result.rowCount === 0) {
            // This might happen if driverId is invalid, or if driver record was deleted.
            // For frequent location updates, throwing an error might be noisy.
            // Consider logging it as a warning. If this implies an issue (e.g. driver should exist),
            // then an error or specific handling might be needed.
            console.warn(`updateDriverLocation: Driver not found or location not updated for driver_id ${driverId}.`);
            // For now, not throwing an error to prevent breaking socket connection for a single failed update.
            // throw { statusCode: 404, message: "Driver not found, cannot update location." };
        } else {
            // console.log(`Driver ${driverId} location updated to Lat: ${latitude}, Lon: ${longitude}`);
        }
    } catch (error) {
        console.error(`Error updating location for driver ${driverId} in service:`, error);
        // Avoid throwing errors that might break a persistent socket connection for location updates.
        // Log and potentially have a mechanism to flag drivers with consistent update failures.
    }
}


module.exports = {
    updateDriverAvailability,
    updateDriverLocation
};

// Helper function (can be in a shared util file)
function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Finds nearby available and verified drivers.
 * @param {number} latitude - Rider's current latitude.
 * @param {number} longitude - Rider's current longitude.
 * @param {number} radiusKm - Search radius in kilometers.
 * @returns {Promise<Array<object>>} Array of driver objects with id, lat, lon.
 */
async function findNearbyAvailableDrivers(latitude, longitude, radiusKm) {
    try {
        // Fetch all available, verified drivers with location.
        // In a production system with many drivers, this initial fetch might need optimization
        // (e.g., query by broader geographic region first, or use PostGIS spatial indexing).
        const allDriversResult = await db.query(
            `SELECT driver_id, current_latitude, current_longitude
             FROM Drivers
             WHERE is_available = TRUE AND is_verified = TRUE
             AND current_latitude IS NOT NULL AND current_longitude IS NOT NULL`
        );

        if (allDriversResult.rows.length === 0) {
            return [];
        }

        const nearbyDrivers = allDriversResult.rows
            .map(driver => {
                const distance = haversineDistance(
                    latitude, longitude,
                    driver.current_latitude, driver.current_longitude
                );
                return { ...driver, distance };
            })
            .filter(driver => driver.distance <= radiusKm)
            .map(driver => ({ // Return only necessary info
                driver_id: driver.driver_id,
                latitude: driver.current_latitude,
                longitude: driver.current_longitude,
                distance: parseFloat(driver.distance.toFixed(2)) // Optional: send distance
            }))
            .sort((a,b) => a.distance - b.distance); // Optional: sort by distance

        return nearbyDrivers;

    } catch (error) {
        console.error('Error finding nearby drivers in service:', error);
        throw new Error('Failed to find nearby drivers.');
    }
}


module.exports = {
    updateDriverAvailability,
    updateDriverLocation,
    findNearbyAvailableDrivers
};
