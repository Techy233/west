// backend/src/validations/userValidation.js
const Joi = require('joi');

// Schema for updating basic user profile (name, etc.)
const userProfileUpdateSchema = Joi.object({
    first_name: Joi.string().trim().min(2).max(100).optional(),
    last_name: Joi.string().trim().min(2).max(100).optional(),
    // Add other updatable fields here, e.g., email if you add it later
}).min(1).messages({ // Requires at least one field to be updated
    'object.min': 'At least one field (first_name or last_name) must be provided for update.'
});


// Schema for adding/updating a device token
const deviceTokenSchema = Joi.object({
    device_token: Joi.string().trim().required().messages({
        'string.empty': 'Device token cannot be empty.',
        'any.required': 'Device token is required.'
    }),
    device_type: Joi.string().valid('android', 'ios', 'web').required().messages({
        'any.only': 'Device type must be one of [android, ios, web].',
        'any.required': 'Device type is required.'
    })
});

module.exports = {
    userProfileUpdateSchema,
    deviceTokenSchema
};
