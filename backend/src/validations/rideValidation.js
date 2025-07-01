// backend/src/validations/rideValidation.js
const Joi = require('joi');

const coordinateSchema = Joi.number().min(-90).max(90).required().messages({
    'number.base': 'Latitude must be a number.',
    'number.min': 'Latitude must be at least -90.',
    'number.max': 'Latitude must be at most 90.',
    'any.required': 'Latitude is required.'
});
const longitudeSchema = Joi.number().min(-180).max(180).required().messages({
    'number.base': 'Longitude must be a number.',
    'number.min': 'Longitude must be at least -180.',
    'number.max': 'Longitude must be at most 180.',
    'any.required': 'Longitude is required.'
});

const requestRideSchema = Joi.object({
    pickup_latitude: coordinateSchema.label("Pickup Latitude"),
    pickup_longitude: longitudeSchema.label("Pickup Longitude"),
    dropoff_latitude: coordinateSchema.label("Dropoff Latitude"),
    dropoff_longitude: longitudeSchema.label("Dropoff Longitude"),
    pickup_address_text: Joi.string().trim().max(255).optional().allow(null, ''),
    dropoff_address_text: Joi.string().trim().max(255).optional().allow(null, '')
});


// Schema for driver updating ride status (e.g., arrived, started, completed)
const driverUpdateRideStatusSchema = Joi.object({
    action: Joi.string().valid(
        'driver_arrived', // driver marks arrival at pickup
        'start_trip',     // driver starts the trip
        'complete_trip'   // driver completes the trip
        // 'accept' and 'reject' are handled by specific POST endpoints
        // 'cancel_driver' will be a specific POST endpoint too for clarity
    ).required().messages({
        'any.only': 'Invalid action. Allowed actions are: driver_arrived, start_trip, complete_trip.',
        'any.required': 'Action is required.'
    })
});

// Schema for rider cancelling a ride
const cancelRideRiderSchema = Joi.object({
    reason: Joi.string().trim().max(255).optional().allow(null, '') // Optional reason
});


module.exports = {
    requestRideSchema,
    driverUpdateRideStatusSchema, // Renamed from updateRideStatusSchema
    cancelRideRiderSchema
};
