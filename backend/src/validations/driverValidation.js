// backend/src/validations/driverValidation.js
const Joi = require('joi');

const updateAvailabilitySchema = Joi.object({
    is_available: Joi.boolean().required().messages({
        'boolean.base': 'Availability status must be a boolean (true or false).',
        'any.required': 'Availability status (is_available) is required.'
    })
});

module.exports = {
    updateAvailabilitySchema
};

const nearbyDriversQuerySchema = Joi.object({
    latitude: Joi.number().min(-90).max(90).required().messages({
        'number.base': 'Latitude must be a number.',
        'number.min': 'Latitude must be at least -90.',
        'number.max': 'Latitude must be at most 90.',
        'any.required': 'Latitude is required.'
    }),
    longitude: Joi.number().min(-180).max(180).required().messages({
        'number.base': 'Longitude must be a number.',
        'number.min': 'Longitude must be at least -180.',
        'number.max': 'Longitude must be at most 180.',
        'any.required': 'Longitude is required.'
    }),
    radius: Joi.number().min(1).max(50).optional().default(5).messages({ // Radius in km, default 5km, max 50km
        'number.base': 'Radius must be a number.',
        'number.min': 'Radius must be at least 1 km.',
        'number.max': 'Radius cannot exceed 50 km.'
    })
});

module.exports = {
    updateAvailabilitySchema,
    nearbyDriversQuerySchema
};
