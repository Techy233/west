// backend/src/validations/authValidation.js
const Joi = require('joi');

// Schema for Rider Registration
const riderRegistrationSchema = Joi.object({
    phone_number: Joi.string()
        .pattern(/^[0-9]{10,15}$/) // Simple pattern: 10-15 digits. Adjust as per Ghana phone number formats.
        .required()
        .messages({
            'string.pattern.base': 'Phone number must be between 10 and 15 digits.',
            'string.empty': 'Phone number is required.',
            'any.required': 'Phone number is required.'
        }),
    password: Joi.string()
        .min(8) // Minimum 8 characters
        .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])')) // Requires lowercase, uppercase, digit, special char
        .required()
        .messages({
            'string.min': 'Password must be at least 8 characters long.',
            'string.pattern.base': 'Password must include uppercase, lowercase, a digit, and a special character.',
            'string.empty': 'Password is required.',
            'any.required': 'Password is required.'
        }),
    first_name: Joi.string().trim().min(2).max(100).optional().allow(null, ''),
    last_name: Joi.string().trim().min(2).max(100).optional().allow(null, ''),
    profile_picture_url: Joi.string().uri().optional().allow(null, '') // Optional, must be a valid URI
});

// Schema for Driver Registration
const driverRegistrationSchema = Joi.object({
    phone_number: Joi.string()
        .pattern(/^[0-9]{10,15}$/)
        .required()
        .messages({
            'string.pattern.base': 'Phone number must be between 10 and 15 digits.',
            'string.empty': 'Phone number is required.',
            'any.required': 'Phone number is required.'
        }),
    password: Joi.string()
        .min(8)
        .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])'))
        .required()
        .messages({
            'string.min': 'Password must be at least 8 characters long.',
            'string.pattern.base': 'Password must include uppercase, lowercase, a digit, and a special character.',
            'string.empty': 'Password is required.',
            'any.required': 'Password is required.'
        }),
    first_name: Joi.string().trim().min(2).max(100).required().messages({'any.required': 'First name is required.'}),
    last_name: Joi.string().trim().min(2).max(100).required().messages({'any.required': 'Last name is required.'}),
    profile_picture_url: Joi.string().uri().optional().allow(null, ''),
    license_number: Joi.string().trim().min(5).max(100).required().messages({'any.required': 'License number is required.'}),
    vehicle_plate_number: Joi.string().trim().min(3).max(20).required().messages({'any.required': 'Vehicle plate number is required.'}),
    vehicle_model: Joi.string().trim().min(2).max(100).optional().allow(null, ''),
    vehicle_color: Joi.string().trim().min(2).max(50).optional().allow(null, ''),
    vehicle_year: Joi.number().integer().min(1990).max(new Date().getFullYear() + 1).optional().allow(null) // Year between 1990 and next year
});

// Schema for User Login
const loginSchema = Joi.object({
    phone_number: Joi.string()
        .pattern(/^[0-9]{10,15}$/)
        .required()
        .messages({
            'string.pattern.base': 'Phone number must be between 10 and 15 digits.',
            'string.empty': 'Phone number is required.',
            'any.required': 'Phone number is required.'
        }),
    password: Joi.string()
        .required()
        .messages({
            'string.empty': 'Password is required.',
            'any.required': 'Password is required.'
        }),
});

// Middleware function to validate request body against a Joi schema
const validateRequest = (schema) => {
    return (req, res, next) => {
        const { error } = schema.validate(req.body, { abortEarly: false }); // abortEarly: false to get all errors
        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message.replace(/['"]/g, '') // Clean up quotes from Joi messages
            }));
            return res.status(400).json({ message: "Validation failed", errors });
        }
        next();
    };
};

module.exports = {
    riderRegistrationSchema,
    driverRegistrationSchema,
    loginSchema,
    validateRequest
};
