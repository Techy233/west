// backend/src/controllers/userController.js
const userService = require('../services/userService');
const driverService = require('../services/driverService'); // For vehicle updates, can be merged or kept separate
// Joi validation schemas are now typically used in routes with a validation middleware
// However, for a simple schema like userProfileUpdateSchema, it can be kept here or moved to userValidation.js

// Update current user's basic profile information (name, etc.)
exports.updateMyProfile = async (req, res) => {
    const { userId } = req.user;
    const profileData = req.body; // Joi validation middleware should have already run

    try {
        const updatedUser = await userService.updateUserProfile(userId, profileData);
        res.status(200).json({
            message: "Profile updated successfully.",
            user: updatedUser // Service returns the updated user
        });
    } catch (error) {
        console.error('Error updating user profile (controller):', error);
        if (error.statusCode) { // Handle custom errors from service
            return res.status(error.statusCode).json({ message: error.message });
        }
        res.status(500).json({ message: "Server error updating profile. Please try again later." });
    }
};

// Placeholder for profile picture upload
exports.updateMyProfilePicture = async (req, res) => {
    const { userId } = req.user;

    if (req.file) {
        // In a real app, the file path/URL would come from a file storage service (S3, etc.)
        // For local 'uploads', multer provides req.file.path or req.file.filename
        // The path stored in DB should be relative to how files are served, or an absolute URL.
        // Example: '/uploads/profile_pictures/actual-generated-filename.jpg'
        const profilePictureUrl = `/uploads/profile_pictures/${req.file.filename}`;

        try {
            const updatedUser = await userService.updateUserProfilePictureUrl(userId, profilePictureUrl);
            return res.status(200).json({
                message: "Profile picture updated successfully.",
                profile_picture_url: updatedUser.profile_picture_url
            });
        } catch (dbError) {
            console.error("Error saving profile picture URL (controller):", dbError);
            // If file was uploaded but DB update failed, consider deleting uploaded file to prevent orphans
            // require('fs').unlink(req.file.path, (err) => { if(err) console.error("Error deleting orphaned file:", err);});
            if (dbError.statusCode) {
                 return res.status(dbError.statusCode).json({ message: dbError.message });
            }
            return res.status(500).json({ message: "Failed to save profile picture information." });
        }
    } else {
        return res.status(400).json({
            message: "No profile picture file was uploaded. Please include a file named 'profileImage'."
        });
    }
};


// --- Driver Specific Profile/Vehicle Updates ---
// This could also be in driverController.js if preferred for separation
exports.updateMyVehicleInfo = async (req, res) => {
    const { userId } = req.user; // driver_id is same as user_id for drivers
    const vehicleData = req.body; // Joi validation middleware should have run

    try {
        // Assuming vehicle update logic is in driverService or a vehicleService
        // For now, let's imagine a function in driverService
        // This function doesn't exist yet in the provided driverService.js. It needs to be added.
        // const updatedVehicle = await driverService.updateVehicleDetails(userId, vehicleData);

        // Placeholder for direct DB update if not using a service function yet for this
        // This is just to make the controller testable without creating the service function immediately.
        // In a real scenario, this logic would be in driverService.js
        const db = require('../config/db'); // Temporary direct db access
        const fieldsToUpdate = {};
        if (vehicleData.vehicle_model !== undefined) fieldsToUpdate.vehicle_model = vehicleData.vehicle_model;
        if (vehicleData.vehicle_color !== undefined) fieldsToUpdate.vehicle_color = vehicleData.vehicle_color;
        if (vehicleData.vehicle_year !== undefined) fieldsToUpdate.vehicle_year = vehicleData.vehicle_year;

        if (Object.keys(fieldsToUpdate).length === 0) {
            return res.status(400).json({ message: "No valid vehicle fields provided for update." });
        }
        const setClauses = Object.keys(fieldsToUpdate).map((key, index) => `${key} = $${index + 1}`).join(', ');
        const values = Object.values(fieldsToUpdate);
        const queryText = `UPDATE Drivers SET ${setClauses}, updated_at = NOW() WHERE driver_id = $${values.length + 1} RETURNING *`;
        values.push(userId);
        const result = await db.query(queryText, values);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Driver not found or vehicle update failed." });
        }
        const { current_latitude, current_longitude, last_location_update, ...updatedVehicle } = result.rows[0];
        // End of placeholder DB logic

        res.status(200).json({
            message: "Vehicle information updated successfully.",
            vehicle: updatedVehicle
        });

    } catch (error) {
        console.error('Error updating vehicle info (controller):', error);
        if (error.statusCode) {
            return res.status(error.statusCode).json({ message: error.message });
        }
        res.status(500).json({ message: "Server error updating vehicle information. Please try again later." });
    }
};

// Controller for adding/updating device token
exports.addOrUpdateDeviceToken = async (req, res) => {
    const { userId } = req.user;
    const { device_token, device_type } = req.body; // Validated by Joi middleware

    try {
        const result = await userService.addOrUpdateUserDeviceToken(userId, device_token, device_type);
        res.status(200).json({
            message: "Device token processed successfully.",
            data: result
        });
    } catch (error) {
        console.error('Error processing device token (controller):', error);
        res.status(500).json({ message: error.message || "Server error processing device token." });
    }
};
