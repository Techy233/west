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
