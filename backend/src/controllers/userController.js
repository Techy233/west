// backend/src/controllers/userController.js
const db = require('../config/db');
const Joi = require('joi'); // For potential validation within controller if not using separate validation file for this

// --- Helper: Joi Schema for Profile Update ---
// (Can also be in a separate userValidation.js file)
const userProfileUpdateSchema = Joi.object({
    first_name: Joi.string().trim().min(2).max(100).optional(),
    last_name: Joi.string().trim().min(2).max(100).optional(),
    // phone_number: Joi.string().pattern(/^[0-9]{10,15}$/).optional(), // Phone number update is usually a separate, more secure process
    // profile_picture_url: Joi.string().uri().optional().allow(null, ''), // Handled by separate endpoint
}).min(1); // Requires at least one field to be updated

// Update current user's basic profile information (name, etc.)
exports.updateMyProfile = async (req, res) => {
    const { userId } = req.user; // From authMiddleware.protect
    const { first_name, last_name } = req.body;

    // Validate request body
    const { error } = userProfileUpdateSchema.validate(req.body);
    if (error) {
        return res.status(400).json({
            message: "Validation failed",
            errors: error.details.map(d => ({ field: d.path.join('.'), message: d.message.replace(/['"]/g, '') }))
        });
    }

    try {
        const fieldsToUpdate = {};
        if (first_name !== undefined) fieldsToUpdate.first_name = first_name;
        if (last_name !== undefined) fieldsToUpdate.last_name = last_name;
        // Add other updatable fields here if necessary, e.g., email if you add it later

        if (Object.keys(fieldsToUpdate).length === 0) {
            return res.status(400).json({ message: "No valid fields provided for update." });
        }

        // Build the SET clause dynamically
        const setClauses = Object.keys(fieldsToUpdate).map((key, index) => `${key} = $${index + 1}`).join(', ');
        const values = Object.values(fieldsToUpdate);

        const queryText = `UPDATE Users SET ${setClauses}, updated_at = NOW() WHERE user_id = $${values.length + 1} RETURNING user_id, phone_number, first_name, last_name, role, profile_picture_url, updated_at`;
        values.push(userId);

        const result = await db.query(queryText, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "User not found or update failed." });
        }

        res.status(200).json({
            message: "Profile updated successfully.",
            user: result.rows[0]
        });

    } catch (error) {
        console.error('Error updating user profile:', error);
        res.status(500).json({ message: "Server error updating profile. Please try again later." });
    }
};

// Placeholder for profile picture upload
exports.updateMyProfilePicture = async (req, res) => {
    const { userId } = req.user;

    // --- Actual file upload logic (e.g., with multer) would go here ---
    // 1. Receive the file (req.file if using multer)
    // 2. Upload to a cloud storage (S3, Cloudinary, etc.) or save to a local dir (not recommended for prod)
    // 3. Get the URL of the uploaded image
    // 4. Update the profile_picture_url in the Users table for the userId

    if (req.file) { // Assuming multer or similar middleware adds `file` to `req`
        const profilePictureUrl = `/uploads/profile_pictures/${req.file.filename}`; // Example local URL

        try {
            const result = await db.query(
                'UPDATE Users SET profile_picture_url = $1, updated_at = NOW() WHERE user_id = $2 RETURNING user_id, profile_picture_url',
                [profilePictureUrl, userId]
            );
            if (result.rows.length === 0) {
                return res.status(404).json({ message: "User not found." });
            }
             return res.status(200).json({
                message: "Profile picture updated successfully (simulated).",
                profile_picture_url: result.rows[0].profile_picture_url
            });
        } catch (dbError) {
            console.error("DB error updating profile picture URL:", dbError);
            return res.status(500).json({ message: "Failed to save profile picture information." });
        }
    } else {
         // This is a placeholder response.
        // In a real scenario, you'd handle the file upload first.
        console.log(`Placeholder: User ${userId} attempting to update profile picture.`);
        console.log("Request body:", req.body); // Log to see what's coming if not a file
        console.log("Request file:", req.file); // Check if multer is configured and working

        return res.status(202).json({
            message: "Profile picture upload endpoint hit. Actual upload logic to be implemented.",
            note: "This endpoint expects a multipart/form-data request with a file."
            // If you send a file, req.file should be populated by a middleware like multer
        });
    }
};


// --- Driver Specific Profile/Vehicle Updates ---

const vehicleUpdateSchema = Joi.object({
    vehicle_model: Joi.string().trim().min(2).max(100).optional(),
    vehicle_color: Joi.string().trim().min(2).max(50).optional(),
    vehicle_year: Joi.number().integer().min(1990).max(new Date().getFullYear() + 1).optional().allow(null),
    // vehicle_plate_number: Joi.string().trim().min(3).max(20).optional(), // Plate number changes might need re-verification
}).min(1);

exports.updateMyVehicleInfo = async (req, res) => {
    const { userId } = req.user; // driver_id is same as user_id for drivers

    const { error } = vehicleUpdateSchema.validate(req.body);
    if (error) {
         return res.status(400).json({
            message: "Validation failed for vehicle info",
            errors: error.details.map(d => ({ field: d.path.join('.'), message: d.message.replace(/['"]/g, '') }))
        });
    }

    try {
        const fieldsToUpdate = {};
        if (req.body.vehicle_model !== undefined) fieldsToUpdate.vehicle_model = req.body.vehicle_model;
        if (req.body.vehicle_color !== undefined) fieldsToUpdate.vehicle_color = req.body.vehicle_color;
        if (req.body.vehicle_year !== undefined) fieldsToUpdate.vehicle_year = req.body.vehicle_year;

        if (Object.keys(fieldsToUpdate).length === 0) {
            return res.status(400).json({ message: "No valid vehicle fields provided for update." });
        }

        const setClauses = Object.keys(fieldsToUpdate).map((key, index) => `${key} = $${index + 1}`).join(', ');
        const values = Object.values(fieldsToUpdate);

        const queryText = `UPDATE Drivers SET ${setClauses}, updated_at = NOW() WHERE driver_id = $${values.length + 1} RETURNING *`;
        values.push(userId);

        const result = await db.query(queryText, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Driver not found or vehicle update failed. Ensure you are registered as a driver." });
        }

        // Exclude sensitive or internal fields before sending back
        const { current_latitude, current_longitude, last_location_update, ...vehicleDetails } = result.rows[0];

        res.status(200).json({
            message: "Vehicle information updated successfully.",
            vehicle: vehicleDetails
        });

    } catch (error) {
        console.error('Error updating vehicle info:', error);
        res.status(500).json({ message: "Server error updating vehicle information. Please try again later." });
    }
};
