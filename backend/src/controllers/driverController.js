// backend/src/controllers/driverController.js
const driverService = require('../services/driverService');

/**
 * Controller to update the authenticated driver's availability status.
 */
exports.setAvailability = async (req, res) => {
    const driverId = req.user.userId; // From authMiddleware.protect
    const { is_available } = req.body;

    try {
        const updatedDriverStatus = await driverService.updateDriverAvailability(driverId, is_available);
        res.status(200).json({
            message: `Driver availability successfully set to ${updatedDriverStatus.is_available}.`,
            driver: updatedDriverStatus
        });
    } catch (error) {
        console.error(`Error setting availability for driver ${driverId} (controller):`, error);
        if (error.statusCode) { // Handle custom errors from service
            return res.status(error.statusCode).json({ message: error.message });
        }
        res.status(500).json({ message: "Server error while updating driver availability." });
    }
};

// Other driver-specific controllers can be added here later
// e.g., getDriverStats, getDriverEarnings, etc.

/**
 * Controller to get nearby available drivers.
 * Expects latitude, longitude, and optional radius in query params.
 */
exports.getNearbyDrivers = async (req, res) => {
    const { latitude, longitude, radius } = req.query; // Joi validation handles parsing to number

    try {
        const nearbyDrivers = await driverService.findNearbyAvailableDrivers(
            parseFloat(latitude),
            parseFloat(longitude),
            radius ? parseFloat(radius) : 5 // Default radius if not provided by Joi default
        );
        res.status(200).json(nearbyDrivers);
    } catch (error) {
        console.error('Error getting nearby drivers (controller):', error);
        res.status(500).json({ message: error.message || "Server error while fetching nearby drivers." });
    }
};
