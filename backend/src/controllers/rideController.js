// backend/src/controllers/rideController.js
const rideService = require('../services/rideService');

// --- Controller Methods ---

// Rider requests a new ride
exports.requestRide = async (req, res) => {
    const riderId = req.user.userId;
    const rideData = req.body;

    try {
        const { ride, message } = await rideService.createRideRequest(riderId, rideData, req.app);
        res.status(201).json({ message, ride });
    } catch (error) {
        console.error('Error requesting ride (controller):', error);
        if (error.message === 'Failed to create ride request in database.') {
            return res.status(500).json({ message: error.message });
        }
        res.status(500).json({ message: 'Server error while requesting ride. Please try again later.' });
    }
};

// Driver accepts a ride request
exports.acceptRide = async (req, res) => {
    const driverId = req.user.userId;
    const { rideId } = req.params;

    try {
        const acceptedRide = await rideService.acceptRideByDriver(rideId, driverId);

        // Notify Rider
        const io = req.app.get('socketio');
        const riderSockets = req.app.get('riderSockets');
        const riderSocketId = riderSockets.get(acceptedRide.rider_id);
        if (riderSocketId && io) {
            io.to(riderSocketId).emit('ride_accepted', acceptedRide);
            console.log(`Event 'ride_accepted' for ride ${acceptedRide.ride_id} sent to rider ${acceptedRide.rider_id} via socket ${riderSocketId}`);
        } else {
            console.log(`Rider ${acceptedRide.rider_id} for event 'ride_accepted' not connected via WebSocket.`);
        }

        res.status(200).json({
            message: "Ride accepted successfully.",
            ride: acceptedRide
        });
    } catch (error) {
        console.error(`Error accepting ride ${rideId} (controller):`, error);
        if (error.statusCode) {
            return res.status(error.statusCode).json({ message: error.message });
        }
        res.status(500).json({ message: "Server error while accepting ride." });
    }
};

// Driver rejects a ride request
exports.rejectRide = async (req, res) => {
    const driverId = req.user.userId;
    const { rideId } = req.params;

    try {
        const rejectedRideInfo = await rideService.rejectRideByDriver(rideId, driverId);
        // TODO: Trigger re-matching (from service or here)
        console.log(`Driver ${driverId} rejected ride ${rideId}. Ride ${rideId} is now unassigned. Needs rematching.`);
        res.status(200).json({
            message: "Ride rejected. The ride will be offered to other drivers if available.",
            ride: rejectedRideInfo // Contains ride_id and new status
        });
    } catch (error) {
        console.error(`Error rejecting ride ${rideId} (controller):`, error);
         if (error.statusCode) {
            return res.status(error.statusCode).json({ message: error.message });
        }
        res.status(500).json({ message: "Server error while rejecting ride." });
    }
};

// Driver updates ride status (arrived, started, completed)
exports.updateRideStatusByDriver = async (req, res) => {
    const driverId = req.user.userId;
    const { rideId } = req.params;
    const { action } = req.body;

    try {
        const updatedRide = await rideService.updateRideStatus(rideId, driverId, action);

        // Notify Rider
        const io = req.app.get('socketio');
        const riderSockets = req.app.get('riderSockets');
        const riderSocketId = riderSockets.get(updatedRide.rider_id);
        if (riderSocketId && io) {
            io.to(riderSocketId).emit('ride_status_updated', updatedRide); // Generic event, client can check status
            console.log(`Event 'ride_status_updated' (to ${updatedRide.status}) for ride ${updatedRide.ride_id} sent to rider ${updatedRide.rider_id}`);
        } else {
            console.log(`Rider ${updatedRide.rider_id} for event 'ride_status_updated' (to ${updatedRide.status}) not connected.`);
        }

        res.status(200).json({
            message: `Ride status successfully updated to '${updatedRide.status}'.`,
            ride: updatedRide
        });
    } catch (error) {
        console.error(`Error updating ride ${rideId} status to ${action} (controller):`, error);
        if (error.statusCode) {
            return res.status(error.statusCode).json({ message: error.message });
        }
        res.status(500).json({ message: "Server error while updating ride status." });
    }
};

// Rider cancels a ride
exports.cancelRideByRider = async (req, res) => {
    const riderId = req.user.userId;
    const { rideId } = req.params;
    const { reason } = req.body;

    try {
        const cancelledRide = await rideService.cancelRideAsRider(rideId, riderId);
        // TODO: Notify Driver if assigned (from service or here)
        if (cancelledRide.driver_id) {
            console.log(`Ride ${rideId} cancelled by rider. Driver ${cancelledRide.driver_id} needs notification.`);
        }
        res.status(200).json({
            message: "Ride cancelled successfully by rider.",
            ride: cancelledRide,
            reason // Echo reason
        });
    } catch (error) {
        console.error(`Error cancelling ride ${rideId} by rider (controller):`, error);
        if (error.statusCode) {
            return res.status(error.statusCode).json({ message: error.message });
        }
        res.status(500).json({ message: "Server error while cancelling ride." });
    }
};

// Driver cancels a ride
exports.cancelRideByDriver = async (req, res) => {
    const driverId = req.user.userId;
    const { rideId } = req.params;
    // const { reason } = req.body; // Optional reason

    try {
        const cancelledRide = await rideService.cancelRideAsDriver(rideId, driverId);

        // Notify Rider
        const io = req.app.get('socketio');
        const riderSockets = req.app.get('riderSockets');
        const riderSocketId = riderSockets.get(cancelledRide.rider_id);
        if (riderSocketId && io) {
            io.to(riderSocketId).emit('ride_cancelled_by_driver', { rideId: cancelledRide.ride_id, message: "Your ride was cancelled by the driver." });
            console.log(`Event 'ride_cancelled_by_driver' for ride ${cancelledRide.ride_id} sent to rider ${cancelledRide.rider_id}`);
        } else {
            console.log(`Rider ${cancelledRide.rider_id} for event 'ride_cancelled_by_driver' not connected.`);
        }

        res.status(200).json({
            message: "Ride cancelled successfully by driver.",
            ride: cancelledRide
        });
    } catch (error) {
        console.error(`Error cancelling ride ${rideId} by driver (controller):`, error);
        if (error.statusCode) {
            return res.status(error.statusCode).json({ message: error.message });
        }
        res.status(500).json({ message: "Server error while cancelling ride by driver." });
    }
};


// exports.getActiveRideForUser = async (req, res) => { ... };
// exports.getRideHistoryForUser = async (req, res) => { ... };
