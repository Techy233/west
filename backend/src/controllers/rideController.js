// backend/src/controllers/rideController.js
const db = require('../config/db');

// --- Helper Functions ---

// Simple Haversine distance calculation (in kilometers)
function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in kilometers
}

// Simple fare estimation function
function estimateFare(distanceKm) {
    const baseFare = 5.00; // GHS
    const ratePerKm = 1.50; // GHS
    const estimated = baseFare + (distanceKm * ratePerKm);
    return parseFloat(estimated.toFixed(2)); // Return as a number with 2 decimal places
}


// --- Controller Methods ---

// Rider requests a new ride
exports.requestRide = async (req, res) => {
    const riderId = req.user.userId; // From authMiddleware
    const {
        pickup_latitude, pickup_longitude,
        dropoff_latitude, dropoff_longitude,
        pickup_address_text, dropoff_address_text
    } = req.body;

    try {
        // 1. Calculate distance (simplified)
        const distance = haversineDistance(pickup_latitude, pickup_longitude, dropoff_latitude, dropoff_longitude);

        // 2. Estimate fare
        const fare = estimateFare(distance);

        // 3. Save the ride request to the database
        const rideQuery = `
            INSERT INTO Rides (
                rider_id,
                pickup_latitude, pickup_longitude, pickup_address_text,
                dropoff_latitude, dropoff_longitude, dropoff_address_text,
                status, estimated_fare, distance_km
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *;
        `;
        // status 'requested' is default by DB schema, but explicit here for clarity
        const values = [
            riderId,
            pickup_latitude, pickup_longitude, pickup_address_text,
            dropoff_latitude, dropoff_longitude, dropoff_address_text,
            'requested', fare, parseFloat(distance.toFixed(2))
        ];

        const result = await db.query(rideQuery, values);

        if (result.rows.length === 0) {
            console.error("Ride request: Ride insert failed or did not return data.");
            return res.status(500).json({ message: 'Failed to create ride request. Please try again.' });
        }

        const newRide = result.rows[0];
        let rideDetailsForResponse = { ...newRide };
        let message = "Ride requested successfully. Searching for available drivers...";

        // 4. Basic Driver Matching Logic
        try {
            const availableDrivers = await db.query(
                "SELECT driver_id FROM Drivers WHERE is_available = TRUE AND is_verified = TRUE ORDER BY last_location_update DESC LIMIT 10" // Pick from recently active ones
            );

            if (availableDrivers.rows.length > 0) {
                // For MVP, pick the first available driver.
                // No complex proximity logic or broadcasting to multiple drivers yet.
                const assignedDriver = availableDrivers.rows[0]; // Simplistic: pick the first one.

                // Assign driver_id to the ride
                const updateRideWithDriver = await db.query(
                    "UPDATE Rides SET driver_id = $1, updated_at = NOW() WHERE ride_id = $2 RETURNING *",
                    [assignedDriver.driver_id, newRide.ride_id]
                );

                if (updateRideWithDriver.rows.length > 0) {
                    rideDetailsForResponse = updateRideWithDriver.rows[0];
                    message = `Ride requested successfully! Driver ${assignedDriver.driver_id.substring(0,8)}... has been notified. Awaiting driver acceptance.`;

                    // Notify this specific driver via WebSocket
                    const io = req.app.get('socketio');
                    const driverSockets = req.app.get('driverSockets');
                    const driverSocketId = driverSockets.get(assignedDriver.driver_id);

                    if (driverSocketId) {
                        io.to(driverSocketId).emit('new_ride_request', rideDetailsForResponse);
                        console.log(`Ride request ${newRide.ride_id} sent to driver ${assignedDriver.driver_id} via socket ${driverSocketId}`);
                    } else {
                        console.log(`Driver ${assignedDriver.driver_id} is not connected via WebSocket. Ride ${newRide.ride_id} assigned but not sent in real-time.`);
                        // TODO: Implement a fallback notification (e.g., SMS or Push Notification for offline drivers)
                        // Or add to a queue for the driver to pick up when they next connect.
                    }
                } else {
                    console.warn(`Failed to assign driver ${assignedDriver.driver_id} to ride ${newRide.ride_id}. Ride remains unassigned.`);
                    message = "Ride requested. Could not immediately assign a driver, still searching...";
                }
            } else {
                message = "Ride requested successfully. No drivers currently available. Please wait or try again later.";
                // TODO: Potentially queue this ride or implement a retry mechanism.
                // For now, the ride is created but unassigned.
                console.log(`No available drivers found for ride ${newRide.ride_id}`);
            }
        } catch (matchError) {
            console.error('Error during driver matching or assignment:', matchError);
            // Don't fail the whole request if matching fails, ride is already created.
            // The message will indicate it's searching.
        }


        res.status(201).json({
            message: message,
            ride: rideDetailsForResponse
        });

    } catch (error) {
        console.error('Error requesting ride:', error);
        res.status(500).json({ message: 'Server error while requesting ride. Please try again later.' });
    }
};

// Get details of a specific ride
exports.getRideDetails = async (req, res) => {
    const { rideId } = req.params;
    const { userId, role } = req.user; // from authMiddleware

    try {
        const query = `
            SELECT
                r.*,
                rider.first_name as rider_first_name, rider.last_name as rider_last_name, rider.phone_number as rider_phone,
                driver.first_name as driver_first_name, driver.last_name as driver_last_name, driver.phone_number as driver_phone,
                d_veh.vehicle_model, d_veh.vehicle_plate_number, d_veh.vehicle_color
            FROM Rides r
            JOIN Users rider ON r.rider_id = rider.user_id
            LEFT JOIN Users driver ON r.driver_id = driver.user_id
            LEFT JOIN Drivers d_veh ON r.driver_id = d_veh.driver_id
            WHERE r.ride_id = $1
        `;
        const result = await db.query(query, [rideId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Ride not found." });
        }

        const ride = result.rows[0];

        // Authorization: Only rider, assigned driver, or an admin (future role) can view.
        if (role !== 'admin' && ride.rider_id !== userId && ride.driver_id !== userId) {
            return res.status(403).json({ message: "You are not authorized to view this ride." });
        }

        // Structure the response
        const rideResponse = {
            ride_id: ride.ride_id,
            status: ride.status,
            pickup_address_text: ride.pickup_address_text,
            dropoff_address_text: ride.dropoff_address_text,
            pickup_latitude: ride.pickup_latitude,
            pickup_longitude: ride.pickup_longitude,
            dropoff_latitude: ride.dropoff_latitude,
            dropoff_longitude: ride.dropoff_longitude,
            estimated_fare: ride.estimated_fare,
            actual_fare: ride.actual_fare,
            distance_km: ride.distance_km,
            requested_at: ride.requested_at,
            accepted_at: ride.accepted_at,
            driver_arrived_at: ride.driver_arrived_at,
            started_at: ride.started_at,
            completed_at: ride.completed_at,
            cancelled_at: ride.cancelled_at,
            rider: {
                user_id: ride.rider_id,
                first_name: ride.rider_first_name,
                last_name: ride.rider_last_name,
                // phone_number: ride.rider_phone // Maybe only show to driver if ride is active
            },
            driver: ride.driver_id ? {
                user_id: ride.driver_id,
                first_name: ride.driver_first_name,
                last_name: ride.driver_last_name,
                // phone_number: ride.driver_phone, // Maybe only show to rider if ride is active
                vehicle_model: ride.vehicle_model,
                vehicle_plate_number: ride.vehicle_plate_number,
                vehicle_color: ride.vehicle_color
            } : null
        };


        res.status(200).json(rideResponse);

    } catch (error) {
        console.error(`Error fetching ride details for ride ${rideId}:`, error);
        res.status(500).json({ message: "Server error while fetching ride details." });
    }
};


// Placeholder for other ride controller methods
// exports.getRideDetails = async (req, res) => { ... };


// Driver accepts a ride request
exports.acceptRide = async (req, res) => {
    const driverId = req.user.userId; // Driver who is accepting
    const { rideId } = req.params;

    try {
        // 1. Fetch the ride to ensure it's still available and assigned to this driver
        const rideResult = await db.query("SELECT * FROM Rides WHERE ride_id = $1", [rideId]);
        if (rideResult.rows.length === 0) {
            return res.status(404).json({ message: "Ride not found." });
        }

        const ride = rideResult.rows[0];

        if (ride.driver_id !== driverId) {
            return res.status(403).json({ message: "This ride is not assigned to you or has been reassigned." });
        }

        if (ride.status !== 'requested') { // Assuming 'requested' means driver assigned, pending acceptance
            return res.status(409).json({ message: `Ride cannot be accepted. Current status: ${ride.status}.` });
        }

        // 2. Update ride status to 'accepted'
        const updateQuery = "UPDATE Rides SET status = 'accepted', accepted_at = NOW(), updated_at = NOW() WHERE ride_id = $1 AND driver_id = $2 RETURNING *";
        const updatedRideResult = await db.query(updateQuery, [rideId, driverId]);

        if (updatedRideResult.rows.length === 0) {
            // Should not happen if previous checks passed, but good to be defensive
            return res.status(500).json({ message: "Failed to accept ride. Please try again." });
        }

        const acceptedRide = updatedRideResult.rows[0];

        // TODO: Notify Rider that driver has accepted and is on the way
        // const io = req.app.get('socketio');
        // Find rider's socket if they are connected and notify.
        // io.to(riderSocketId).emit('ride_accepted', acceptedRide);
        console.log(`Driver ${driverId} accepted ride ${rideId}. Rider ${acceptedRide.rider_id} needs notification.`);


        res.status(200).json({
            message: "Ride accepted successfully.",
            ride: acceptedRide
        });

    } catch (error) {
        console.error(`Error accepting ride ${rideId} by driver ${driverId}:`, error);
        res.status(500).json({ message: "Server error while accepting ride." });
    }
};

// Driver rejects a ride request
exports.rejectRide = async (req, res) => {
    const driverId = req.user.userId; // Driver who is rejecting
    const { rideId } = req.params;

    try {
        const rideResult = await db.query("SELECT * FROM Rides WHERE ride_id = $1", [rideId]);
        if (rideResult.rows.length === 0) {
            return res.status(404).json({ message: "Ride not found." });
        }
        const ride = rideResult.rows[0];

        if (ride.driver_id !== driverId) {
            return res.status(403).json({ message: "This ride is not assigned to you." });
        }
        // Can only reject if it's in 'requested' (assigned but not yet accepted)
        if (ride.status !== 'requested') {
             return res.status(409).json({ message: `Ride cannot be rejected. Current status: ${ride.status}.` });
        }

        // Option 1: Mark as 'rejected_by_driver_X' and re-assign or notify rider.
        // Option 2: Simpler for MVP - set driver_id to NULL, status back to 'requested' (or a new 'pending_reassignment')
        // For now, let's use Option 2: effectively unassigning it.
        // The ride becomes 'requested' again, but without this driver.
        // A more robust system would prevent this driver from being matched again immediately.
        const updateQuery = "UPDATE Rides SET driver_id = NULL, status = 'requested', updated_at = NOW() WHERE ride_id = $1 AND driver_id = $2 RETURNING ride_id, status";
        // Note: We might want a new status like 'pending_reassignment' or 'driver_rejected'
        // For MVP, setting driver_id to NULL makes it available for matching again by the simple logic.

        const updatedRideResult = await db.query(updateQuery, [rideId, driverId]);

        if (updatedRideResult.rows.length === 0) {
            return res.status(500).json({ message: "Failed to reject ride." });
        }

        console.log(`Driver ${driverId} rejected ride ${rideId}. Ride ${rideId} is now unassigned and status is 'requested'. Needs rematching.`);
        // TODO: Trigger re-matching logic for the ride service.
        // This could involve putting the ride back into a queue for available drivers.
        // For now, the next requestRide call might pick it up if another driver is available.

        res.status(200).json({
            message: "Ride rejected. The ride will be offered to other drivers if available.",
            ride: updatedRideResult.rows[0]
        });

    } catch (error) {
        console.error(`Error rejecting ride ${rideId} by driver ${driverId}:`, error);
        res.status(500).json({ message: "Server error while rejecting ride." });
    }
};

// Driver updates ride status (arrived, started, completed)
exports.updateRideStatusByDriver = async (req, res) => {
    const driverId = req.user.userId;
    const { rideId } = req.params;
    const { action } = req.body; // 'driver_arrived', 'start_trip', 'complete_trip'

    try {
        // 1. Fetch the ride
        const rideResult = await db.query("SELECT * FROM Rides WHERE ride_id = $1 AND driver_id = $2", [rideId, driverId]);
        if (rideResult.rows.length === 0) {
            return res.status(404).json({ message: "Active ride not found for you or ride ID is invalid." });
        }
        const ride = rideResult.rows[0];

        // 2. Validate action based on current ride status
        let newStatus = '';
        let timestampField = ''; // To update the correct timestamp field like driver_arrived_at, started_at, completed_at

        switch (action) {
            case 'driver_arrived':
                if (ride.status !== 'accepted') {
                    return res.status(409).json({ message: `Cannot mark as arrived. Ride status is '${ride.status}', expected 'accepted'.` });
                }
                newStatus = 'driver_arrived';
                timestampField = 'driver_arrived_at';
                break;
            case 'start_trip':
                // Can start if status is 'accepted' (driver forgot to mark arrival) or 'driver_arrived'
                if (ride.status !== 'driver_arrived' && ride.status !== 'accepted') {
                    return res.status(409).json({ message: `Cannot start trip. Ride status is '${ride.status}', expected 'driver_arrived' or 'accepted'.` });
                }
                newStatus = 'ongoing';
                timestampField = 'started_at';
                break;
            case 'complete_trip':
                if (ride.status !== 'ongoing') {
                    return res.status(409).json({ message: `Cannot complete trip. Ride status is '${ride.status}', expected 'ongoing'.` });
                }
                newStatus = 'completed';
                timestampField = 'completed_at';
                // TODO: Here you might calculate final fare if it differs from estimate, process payment, etc.
                // For now, we assume estimated_fare is the actual_fare or this is handled by another process.
                // If actual_fare needs setting:
                // const finalFare = calculateFinalFare(ride.distance_km, ride.duration_minutes_actual);
                // await db.query("UPDATE Rides SET actual_fare = $1 WHERE ride_id = $2", [finalFare, rideId]);
                break;
            default:
                return res.status(400).json({ message: "Invalid action provided." }); // Should be caught by Joi validation too
        }

        // 3. Update ride status and corresponding timestamp
        const updateQuery = `UPDATE Rides SET status = $1, ${timestampField} = NOW(), updated_at = NOW() WHERE ride_id = $2 RETURNING *`;
        const updatedRideResult = await db.query(updateQuery, [newStatus, rideId]);

        if (updatedRideResult.rows.length === 0) {
            return res.status(500).json({ message: "Failed to update ride status." });
        }
        const updatedRide = updatedRideResult.rows[0];

        // TODO: Notify Rider about the status update via WebSocket/Push
        // const io = req.app.get('socketio');
        // io.to(riderSocketId).emit('ride_status_updated', updatedRide);
        console.log(`Ride ${rideId} status updated to ${newStatus} by driver ${driverId}. Rider ${updatedRide.rider_id} needs notification.`);


        res.status(200).json({
            message: `Ride status successfully updated to '${newStatus}'.`,
            ride: updatedRide
        });

    } catch (error) {
        console.error(`Error updating ride ${rideId} status to ${action} by driver ${driverId}:`, error);
        res.status(500).json({ message: "Server error while updating ride status." });
    }
};

// Rider cancels a ride
exports.cancelRideByRider = async (req, res) => {
    const riderId = req.user.userId;
    const { rideId } = req.params;
    const { reason } = req.body; // Optional reason from rider

    try {
        const rideResult = await db.query("SELECT * FROM Rides WHERE ride_id = $1 AND rider_id = $2", [rideId, riderId]);
        if (rideResult.rows.length === 0) {
            return res.status(404).json({ message: "Ride not found or you are not authorized to cancel this ride." });
        }
        const ride = rideResult.rows[0];

        // Define statuses during which a rider can cancel
        // E.g., 'requested', 'accepted'. Maybe 'driver_arrived' incurs a fee (future).
        // Cannot cancel if 'ongoing' or 'completed'.
        const cancellableStatuses = ['requested', 'accepted', 'driver_assigned']; // 'driver_assigned' if we add that status
        if (!cancellableStatuses.includes(ride.status)) {
            return res.status(409).json({ message: `Ride cannot be cancelled. Current status: '${ride.status}'.` });
        }

        const updateQuery = "UPDATE Rides SET status = 'cancelled_rider', cancelled_at = NOW(), updated_at = NOW() WHERE ride_id = $1 RETURNING *";
        const updatedRideResult = await db.query(updateQuery, [rideId]);

        if (updatedRideResult.rows.length === 0) {
            return res.status(500).json({ message: "Failed to cancel ride." });
        }

        const cancelledRide = updatedRideResult.rows[0];

        // TODO: Notify assigned driver (if any) that rider cancelled
        if (cancelledRide.driver_id) {
            // const io = req.app.get('socketio');
            // const driverSockets = req.app.get('driverSockets');
            // const driverSocketId = driverSockets.get(cancelledRide.driver_id);
            // if (driverSocketId) {
            //    io.to(driverSocketId).emit('ride_cancelled_by_rider', { rideId: cancelledRide.ride_id });
            // }
            console.log(`Ride ${rideId} cancelled by rider. Driver ${cancelledRide.driver_id} needs notification.`);
        }

        res.status(200).json({
            message: "Ride cancelled successfully by rider.",
            ride: cancelledRide,
            reason: reason // Echo back reason if provided
        });

    } catch (error) {
        console.error(`Error cancelling ride ${rideId} by rider ${riderId}:`, error);
        res.status(500).json({ message: "Server error while cancelling ride." });
    }
};

// Driver cancels a ride
// This might have different rules or implications (e.g., impact on driver rating)
exports.cancelRideByDriver = async (req, res) => {
    const driverId = req.user.userId;
    const { rideId } = req.params;
    // const { reason } = req.body; // Driver might also provide a reason

    try {
        const rideResult = await db.query("SELECT * FROM Rides WHERE ride_id = $1 AND driver_id = $2", [rideId, driverId]);
        if (rideResult.rows.length === 0) {
            return res.status(404).json({ message: "Ride not found or not assigned to you." });
        }
        const ride = rideResult.rows[0];

        // Define statuses during which a driver can cancel
        // E.g., 'accepted', 'driver_arrived'. Can't cancel if 'ongoing' without support.
        const cancellableStatuses = ['accepted', 'driver_arrived'];
        if (!cancellableStatuses.includes(ride.status)) {
            return res.status(409).json({ message: `Ride cannot be cancelled by driver. Current status: '${ride.status}'.` });
        }

        // When driver cancels, the ride might need to be re-assigned or rider notified to book again.
        // For MVP, we'll mark it 'cancelled_driver' and notify rider.
        const updateQuery = "UPDATE Rides SET status = 'cancelled_driver', cancelled_at = NOW(), updated_at = NOW() WHERE ride_id = $1 RETURNING *";
        const updatedRideResult = await db.query(updateQuery, [rideId]);

        if (updatedRideResult.rows.length === 0) {
            return res.status(500).json({ message: "Failed to cancel ride." });
        }
        const cancelledRide = updatedRideResult.rows[0];

        // TODO: Notify Rider that driver cancelled
        // const io = req.app.get('socketio');
        // Find rider's socket and notify.
        // io.to(riderSocketId).emit('ride_cancelled_by_driver', { rideId: cancelledRide.ride_id, reason: "Driver cancelled" });
        console.log(`Ride ${rideId} cancelled by driver ${driverId}. Rider ${cancelledRide.rider_id} needs notification.`);

        // TODO: Potentially trigger re-matching for the rider or other logic.

        res.status(200).json({
            message: "Ride cancelled successfully by driver.",
            ride: cancelledRide
        });

    } catch (error) {
        console.error(`Error cancelling ride ${rideId} by driver ${driverId}:`, error);
        res.status(500).json({ message: "Server error while cancelling ride by driver." });
    }
};


// exports.getActiveRideForUser = async (req, res) => { ... };
// exports.getRideHistoryForUser = async (req, res) => { ... };
