// backend/src/services/rideService.js
const db = require('../config/db');

// --- Helper Functions (can be moved to a utils/geo.js or similar) ---
function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
}

function estimateFare(distanceKm) {
    const baseFare = 5.00; // GHS
    const ratePerKm = 1.50; // GHS
    const estimated = baseFare + (distanceKm * ratePerKm);
    return parseFloat(estimated.toFixed(2));
}

// --- Ride Service Methods ---

/**
 * Creates a new ride request and attempts to match a driver.
 * @param {string} riderId - The ID of the rider requesting.
 * @param {object} rideData - Contains pickup/dropoff lat/lon and address text.
 * @param {object} reqApp - Express app object to access socketio and driverSockets.
 * @returns {Promise<{ride: object, message: string}>} The created/updated ride and a status message.
 */
async function createRideRequest(riderId, rideData, reqApp) {
    const {
        pickup_latitude, pickup_longitude, dropoff_latitude, dropoff_longitude,
        pickup_address_text, dropoff_address_text
    } = rideData;

    const distance = haversineDistance(pickup_latitude, pickup_longitude, dropoff_latitude, dropoff_longitude);
    const fare = estimateFare(distance);

    const rideQuery = `
        INSERT INTO Rides (
            rider_id, pickup_latitude, pickup_longitude, pickup_address_text,
            dropoff_latitude, dropoff_longitude, dropoff_address_text,
            status, estimated_fare, distance_km
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *;`;
    const values = [
        riderId, pickup_latitude, pickup_longitude, pickup_address_text,
        dropoff_latitude, dropoff_longitude, dropoff_address_text,
        'requested', fare, parseFloat(distance.toFixed(2))
    ];
    const result = await db.query(rideQuery, values);
    if (result.rows.length === 0) {
        throw new Error('Failed to create ride request in database.');
    }
    let newRide = result.rows[0];
    let message = "Ride requested successfully. Searching for available drivers...";

    // Location-Based Driver Matching Logic
    const MAX_SEARCH_RADIUS_KM = 10; // Define a search radius (e.g., 10 km)

    try {
        // Fetch all available and verified drivers with their locations
        // Note: In a very large system, fetching ALL available drivers might be too much.
        // You might pre-filter by region or use a geospatial index if DB supports it.
        const allAvailableDriversResult = await db.query(
            "SELECT driver_id, current_latitude, current_longitude FROM Drivers WHERE is_available = TRUE AND is_verified = TRUE AND current_latitude IS NOT NULL AND current_longitude IS NOT NULL"
        );

        if (allAvailableDriversResult.rows.length > 0) {
            const nearbyDrivers = allAvailableDriversResult.rows
                .map(driver => {
                    const dist = haversineDistance(
                        pickup_latitude, pickup_longitude,
                        driver.current_latitude, driver.current_longitude
                    );
                    return { ...driver, distance: dist };
                })
                .filter(driver => driver.distance <= MAX_SEARCH_RADIUS_KM)
                .sort((a, b) => a.distance - b.distance); // Sort by distance, closest first

            if (nearbyDrivers.length > 0) {
                const assignedDriver = nearbyDrivers[0]; // Assign the closest driver
                const updateRideWithDriver = await db.query(
                    "UPDATE Rides SET driver_id = $1, updated_at = NOW() WHERE ride_id = $2 RETURNING *",
                    [assignedDriver.driver_id, newRide.ride_id]
                );

                if (updateRideWithDriver.rows.length > 0) {
                    newRide = updateRideWithDriver.rows[0];
                    message = `Ride requested successfully! Driver ${assignedDriver.driver_id.substring(0,8)}... (approx. ${assignedDriver.distance.toFixed(1)}km away) has been notified. Awaiting acceptance.`;

                    const io = reqApp.get('socketio');
                    const driverSockets = reqApp.get('driverSockets');
                    const driverSocketId = driverSockets.get(assignedDriver.driver_id);
                    if (driverSocketId && io) {
                        io.to(driverSocketId).emit('new_ride_request', newRide);
                        console.log(`Ride request ${newRide.ride_id} sent to driver ${assignedDriver.driver_id} (socket ${driverSocketId})`);
                    } else {
                        console.log(`Driver ${assignedDriver.driver_id} not connected for ride ${newRide.ride_id}.`);
                    }
                } else {
                     message = "Ride requested. Found nearby drivers, but assignment failed. Still searching...";
                }
            } else {
                message = "Ride requested successfully. No drivers found within your immediate vicinity. Expanding search...";
                 console.log(`No drivers found within ${MAX_SEARCH_RADIUS_KM}km for ride ${newRide.ride_id}`);
            }
        } else {
            message = "Ride requested successfully. No drivers currently available. Please wait or try again later.";
            console.log(`No available/verified drivers found at all for ride ${newRide.ride_id}`);
        }
    } catch (matchError) {
        console.error('Error during location-based driver matching/assignment in service:', matchError);
    }
    return { ride: newRide, message };
}


/**
 * Allows a driver to accept a ride.
 * @param {string} rideId - The ID of the ride.
 * @param {string} driverId - The ID of the driver accepting.
 * @returns {Promise<object>} The updated ride object.
 */
async function acceptRideByDriver(rideId, driverId) {
    const rideResult = await db.query("SELECT * FROM Rides WHERE ride_id = $1", [rideId]);
    if (rideResult.rows.length === 0) {
        throw { statusCode: 404, message: "Ride not found." };
    }
    const ride = rideResult.rows[0];
    if (ride.driver_id !== driverId) {
        throw { statusCode: 403, message: "This ride is not assigned to you or has been reassigned." };
    }
    if (ride.status !== 'requested') {
        throw { statusCode: 409, message: `Ride cannot be accepted. Current status: ${ride.status}.` };
    }
    const updateQuery = "UPDATE Rides SET status = 'accepted', accepted_at = NOW(), updated_at = NOW() WHERE ride_id = $1 AND driver_id = $2 RETURNING *";
    const updatedRideResult = await db.query(updateQuery, [rideId, driverId]);
    if (updatedRideResult.rows.length === 0) {
        throw new Error("Failed to accept ride in database.");
    }
    const acceptedRide = updatedRideResult.rows[0];

    // Notify Rider
    const riderIdToNotify = acceptedRide.rider_id;
    // Assuming reqApp (Express app instance) is passed to service functions that need to emit.
    // This is a simplification; a dedicated notification service or event bus is better.
    // For now, we'll assume rideService functions that need to emit will receive 'reqApp' or similar.
    // This part needs to be called from where reqApp is available or io/riderSockets passed directly.
    // For now, this is a conceptual placement. The actual emission will be done in controller after service call.
    // emitRideEventToRider(reqApp, riderIdToNotify, 'ride_accepted', acceptedRide);
    console.log(`Driver ${driverId} accepted ride ${rideId}. Rider ${riderIdToNotify} needs notification (service).`);

    return acceptedRide;
}

// Helper function to emit events to rider (conceptual, needs reqApp or io/riderSockets passed)
// function emitRideEventToRider(reqApp, riderId, eventName, data) {
//     if (reqApp) {
//         const io = reqApp.get('socketio');
//         const riderSockets = reqApp.get('riderSockets');
//         const riderSocketId = riderSockets.get(riderId);
//         if (riderSocketId && io) {
//             io.to(riderSocketId).emit(eventName, data);
//             console.log(`Event '${eventName}' for ride ${data.ride_id || data.rideId} sent to rider ${riderId} via socket ${riderSocketId}`);
//         } else {
//             console.log(`Rider ${riderId} for event '${eventName}' not connected via WebSocket.`);
//         }
//     } else {
//         console.warn("reqApp not available in service to emit WebSocket event.");
//     }
// }


/**
 * Allows a driver to reject a ride.
 * @param {string} rideId - The ID of the ride.
 * @param {string} driverId - The ID of the driver rejecting.
 * @returns {Promise<object>} Minimal ride object with new status.
 */
async function rejectRideByDriver(rideId, driverId) {
    const rideResult = await db.query("SELECT * FROM Rides WHERE ride_id = $1", [rideId]);
    if (rideResult.rows.length === 0) {
        throw { statusCode: 404, message: "Ride not found." };
    }
    const ride = rideResult.rows[0];
    if (ride.driver_id !== driverId) {
        throw { statusCode: 403, message: "This ride is not assigned to you." };
    }
    if (ride.status !== 'requested') {
        throw { statusCode: 409, message: `Ride cannot be rejected. Current status: ${ride.status}.` };
    }
    const updateQuery = "UPDATE Rides SET driver_id = NULL, status = 'requested', updated_at = NOW() WHERE ride_id = $1 AND driver_id = $2 RETURNING ride_id, status";
    const updatedRideResult = await db.query(updateQuery, [rideId, driverId]);
    if (updatedRideResult.rows.length === 0) {
        throw new Error("Failed to reject ride in database.");
    }
    // TODO: Trigger re-matching logic (in controller or via event from service)
    console.log(`Driver ${driverId} rejected ride ${rideId}. Ride ${rideId} is now unassigned. Needs rematching.`);
    return updatedRideResult.rows[0];
}


/**
 * Updates the status of a ride by the driver.
 * @param {string} rideId - ID of the ride.
 * @param {string} driverId - ID of the driver.
 * @param {string} action - The action to perform ('driver_arrived', 'start_trip', 'complete_trip').
 * @returns {Promise<object>} The updated ride object.
 */
async function updateRideStatus(rideId, driverId, action) {
    const rideResult = await db.query("SELECT * FROM Rides WHERE ride_id = $1 AND driver_id = $2", [rideId, driverId]);
    if (rideResult.rows.length === 0) {
        throw { statusCode: 404, message: "Active ride not found for you or ride ID is invalid." };
    }
    const ride = rideResult.rows[0];
    let newStatus = '', timestampField = '';

    switch (action) {
        case 'driver_arrived':
            if (ride.status !== 'accepted') throw { statusCode: 409, message: `Cannot mark as arrived. Ride status is '${ride.status}', expected 'accepted'.` };
            newStatus = 'driver_arrived'; timestampField = 'driver_arrived_at';
            break;
        case 'start_trip':
            if (ride.status !== 'driver_arrived' && ride.status !== 'accepted') throw { statusCode: 409, message: `Cannot start trip. Ride status is '${ride.status}', expected 'driver_arrived' or 'accepted'.` };
            newStatus = 'ongoing'; timestampField = 'started_at';
            break;
        case 'complete_trip':
            if (ride.status !== 'ongoing') throw { statusCode: 409, message: `Cannot complete trip. Ride status is '${ride.status}', expected 'ongoing'.` };
            newStatus = 'completed'; timestampField = 'completed_at';
            // TODO: Add final fare calculation if needed
            break;
        default:
            throw { statusCode: 400, message: "Invalid action provided for ride status update." };
    }
    const updateQuery = `UPDATE Rides SET status = $1, ${timestampField} = NOW(), updated_at = NOW() WHERE ride_id = $2 RETURNING *`;
    const updatedRideResult = await db.query(updateQuery, [newStatus, rideId]);
    if (updatedRideResult.rows.length === 0) {
        throw new Error("Failed to update ride status in database.");
    }
    const updatedRideForNotification = updatedRideResult.rows[0];
    // TODO: Notify Rider (in controller or via event)
    console.log(`Ride ${rideId} status updated to ${newStatus} by driver ${driverId}. Rider ${updatedRideForNotification.rider_id} needs notification (service).`);
    // emitRideEventToRider(reqApp, updatedRideForNotification.rider_id, 'ride_status_updated', updatedRideForNotification);
    return updatedRideForNotification;
}

/**
 * Cancels a ride by the rider.
 * @param {string} rideId - ID of the ride.
 * @param {string} riderId - ID of the rider.
 * @returns {Promise<object>} The cancelled ride object.
 */
async function cancelRideAsRider(rideId, riderId) {
    const rideResult = await db.query("SELECT * FROM Rides WHERE ride_id = $1 AND rider_id = $2", [rideId, riderId]);
    if (rideResult.rows.length === 0) {
        throw { statusCode: 404, message: "Ride not found or you are not authorized to cancel this ride." };
    }
    const ride = rideResult.rows[0];
    const cancellableStatuses = ['requested', 'accepted', 'driver_assigned'];
    if (!cancellableStatuses.includes(ride.status)) {
        throw { statusCode: 409, message: `Ride cannot be cancelled. Current status: '${ride.status}'.` };
    }
    const updateQuery = "UPDATE Rides SET status = 'cancelled_rider', cancelled_at = NOW(), updated_at = NOW() WHERE ride_id = $1 RETURNING *";
    const updatedRideResult = await db.query(updateQuery, [rideId]);
    if (updatedRideResult.rows.length === 0) {
        throw new Error("Failed to cancel ride in database.");
    }
    // TODO: Notify assigned Driver if any (in controller or via event)
    if (updatedRideResult.rows[0].driver_id) {
        console.log(`Ride ${rideId} cancelled by rider. Driver ${updatedRideResult.rows[0].driver_id} needs notification.`);
    }
    return updatedRideResult.rows[0];
}

/**
 * Cancels a ride by the driver.
 * @param {string} rideId - ID of the ride.
 * @param {string} driverId - ID of the driver.
 * @returns {Promise<object>} The cancelled ride object.
 */
async function cancelRideAsDriver(rideId, driverId) {
    const rideResult = await db.query("SELECT * FROM Rides WHERE ride_id = $1 AND driver_id = $2", [rideId, driverId]);
    if (rideResult.rows.length === 0) {
        throw { statusCode: 404, message: "Ride not found or not assigned to you." };
    }
    const ride = rideResult.rows[0];
    const cancellableStatuses = ['accepted', 'driver_arrived'];
    if (!cancellableStatuses.includes(ride.status)) {
        throw { statusCode: 409, message: `Ride cannot be cancelled by driver. Current status: '${ride.status}'.` };
    }
    const updateQuery = "UPDATE Rides SET status = 'cancelled_driver', cancelled_at = NOW(), updated_at = NOW() WHERE ride_id = $1 RETURNING *";
    const updatedRideResult = await db.query(updateQuery, [rideId]);
    if (updatedRideResult.rows.length === 0) {
        throw new Error("Failed to cancel ride by driver in database.");
    }
    const cancelledRideByDriver = updatedRideResult.rows[0];
    // TODO: Notify Rider (in controller or via event)
    console.log(`Ride ${rideId} cancelled by driver ${driverId}. Rider ${cancelledRideByDriver.rider_id} needs notification (service).`);
    // emitRideEventToRider(reqApp, cancelledRideByDriver.rider_id, 'ride_cancelled_by_driver', cancelledRideByDriver);
    return cancelledRideByDriver;
}

/**
 * Gets details of a specific ride, ensuring authorization.
 * @param {string} rideId - ID of the ride.
 * @param {string} userId - ID of the user requesting (rider or driver).
 * @param {string} userRole - Role of the user.
 * @returns {Promise<object>} Formatted ride details.
 */
async function getRide(rideId, userId, userRole) {
    const query = `
        SELECT r.*,
               rider.first_name as rider_first_name, rider.last_name as rider_last_name,
               driver.first_name as driver_first_name, driver.last_name as driver_last_name,
               d_veh.vehicle_model, d_veh.vehicle_plate_number, d_veh.vehicle_color
        FROM Rides r
        JOIN Users rider ON r.rider_id = rider.user_id
        LEFT JOIN Users driver ON r.driver_id = driver.user_id
        LEFT JOIN Drivers d_veh ON r.driver_id = d_veh.driver_id
        WHERE r.ride_id = $1`;
    const result = await db.query(query, [rideId]);
    if (result.rows.length === 0) {
        throw { statusCode: 404, message: "Ride not found." };
    }
    const ride = result.rows[0];
    if (userRole !== 'admin' && ride.rider_id !== userId && ride.driver_id !== userId) {
        throw { statusCode: 403, message: "You are not authorized to view this ride." };
    }
    // Format response (omitting phone numbers for now as per controller)
    return {
        ride_id: ride.ride_id, status: ride.status,
        pickup_address_text: ride.pickup_address_text, dropoff_address_text: ride.dropoff_address_text,
        pickup_latitude: ride.pickup_latitude, pickup_longitude: ride.pickup_longitude,
        dropoff_latitude: ride.dropoff_latitude, dropoff_longitude: ride.dropoff_longitude,
        estimated_fare: ride.estimated_fare, actual_fare: ride.actual_fare, distance_km: ride.distance_km,
        requested_at: ride.requested_at, accepted_at: ride.accepted_at,
        driver_arrived_at: ride.driver_arrived_at, started_at: ride.started_at,
        completed_at: ride.completed_at, cancelled_at: ride.cancelled_at,
        rider: { user_id: ride.rider_id, first_name: ride.rider_first_name, last_name: ride.rider_last_name },
        driver: ride.driver_id ? {
            user_id: ride.driver_id, first_name: ride.driver_first_name, last_name: ride.driver_last_name,
            vehicle_model: ride.vehicle_model, vehicle_plate_number: ride.vehicle_plate_number, vehicle_color: ride.vehicle_color
        } : null
    };
}


module.exports = {
    createRideRequest,
    acceptRideByDriver,
    rejectRideByDriver,
    updateRideStatus,
    cancelRideAsRider,
    cancelRideAsDriver,
    getRide
};
