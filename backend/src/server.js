require('dotenv').config(); // For loading environment variables from .env file

const express = require('express');
const cors = new require('cors');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Enable All CORS Requests for now, configure properly for production
app.use(express.json()); // To parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // To parse URL-encoded request bodies

// Basic Health Check Route
app.get('/', (req, res) => {
  res.status(200).json({ message: 'Welcome to the Ghana Cabs API!' });
});

// API Routes
const healthRoutes = require('./routes/healthRoutes');
const authRoutes = require('./routes/authRoutes');
// const rideRoutes = require('./routes/rideRoutes');
// const driverRoutes = require('./routes/driverRoutes');
const userRoutes = require('./routes/userRoutes');

app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
const rideRoutes = require('./routes/rideRoutes');
app.use('/api/v1/rides', rideRoutes);
const driverRoutes = require('./routes/driverRoutes');
app.use('/api/v1/drivers', driverRoutes);


// Error Handling Middleware (Simple example, can be more sophisticated)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

// Create HTTP server for Express and Socket.IO
const server = http.createServer(app);

// In-memory stores for user_id/driver_id to socket_id mapping
// In production, use Redis or a similar store for scalability
const driverSockets = new Map(); // Map<driver_id, socket_id>
const riderSockets = new Map();  // Map<rider_id, socket_id>

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "*", // Configure allowed origins (e.g., your mobile app's dev server)
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log('A user connected via WebSocket:', socket.id);

  // Event for drivers to register their socket
  socket.on('register_driver_socket', (driverId) => {
    if (driverId) {
      driverSockets.set(driverId, socket.id);
      console.log(`Driver ${driverId} registered socket ${socket.id}`);
      // Optionally, acknowledge registration to the driver client
      socket.emit('driver_socket_registered', { driverId, socketId: socket.id, status: 'success' });
    } else {
        console.warn(`Attempt to register socket ${socket.id} without a driverId.`);
        socket.emit('driver_socket_registration_failed', { message: 'driverId is required.' });
    }
  });

  // Event for riders to register their socket
  socket.on('register_rider_socket', (riderId) => {
    if (riderId) {
      riderSockets.set(riderId, socket.id);
      console.log(`Rider ${riderId} registered socket ${socket.id}`);
      socket.emit('rider_socket_registered', { riderId, socketId: socket.id, status: 'success' });
    } else {
      console.warn(`Attempt to register rider socket ${socket.id} without a riderId.`);
      socket.emit('rider_socket_registration_failed', { message: 'riderId is required.' });
    }
  });

  // Listen for location updates from drivers
  socket.on('driver_location_update', async (data) => {
    // data = { driverId, latitude, longitude }
    if (data && data.driverId && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
        // It's good practice to ensure driverId from socket message matches authenticated user if socket is auth'd
        // For now, we trust the driverId sent if the socket is generally for a driver.
        // Or, get driverId from a map of socket.id -> driverId established during 'register_driver_socket'
        let driverIdToUpdate = data.driverId;

        // Find driverId associated with this socket.id from our driverSockets map
        // This is more secure than trusting driverId from the payload if not separately authenticated.
        let foundDriverIdForSocket = null;
        for (let [id, sId] of driverSockets.entries()) {
            if (sId === socket.id) {
                foundDriverIdForSocket = id;
                break;
            }
        }

        if (foundDriverIdForSocket) {
            if (driverIdToUpdate !== foundDriverIdForSocket) {
                console.warn(`Driver location update: Mismatch! Socket ${socket.id} (for driver ${foundDriverIdForSocket}) sent data for ${driverIdToUpdate}. Using authenticated ID.`);
                driverIdToUpdate = foundDriverIdForSocket; // Prioritize ID known from registration
            }

            const driverService = require('./services/driverService'); // Lazy require or pass via app.set
            const db = require('./config/db'); // For querying active ride

            await driverService.updateDriverLocation(driverIdToUpdate, data.latitude, data.longitude);

            // Relay this location to relevant riders if this driver is on an active ride
            try {
                const activeRideResult = await db.query(
                    "SELECT ride_id, rider_id FROM Rides WHERE driver_id = $1 AND status IN ('accepted', 'driver_arrived', 'ongoing')",
                    [driverIdToUpdate]
                );

                if (activeRideResult.rows.length > 0) {
                    const activeRide = activeRideResult.rows[0];
                    const riderSocketId = riderSockets.get(activeRide.rider_id);
                    if (riderSocketId && io) {
                        io.to(riderSocketId).emit('active_ride_driver_location', {
                            rideId: activeRide.ride_id,
                            driverId: driverIdToUpdate,
                            latitude: data.latitude,
                            longitude: data.longitude
                        });
                        // console.log(`Relayed driver ${driverIdToUpdate} location to rider ${activeRide.rider_id} for ride ${activeRide.ride_id}`);
                    }
                }
            } catch (dbError) {
                console.error("Error checking for active ride or relaying location:", dbError);
            }

        } else {
            console.warn(`Received driver_location_update from un-registered or unknown socket: ${socket.id}, data:`, data);
        }
    } else {
        console.warn('Invalid driver_location_update data received:', data);
    }
  });


  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Remove driver from mapping on disconnect
    for (let [driverId, socketId] of driverSockets.entries()) {
      if (socketId === socket.id) {
        driverSockets.delete(driverId);
        console.log(`Driver ${driverId} (socket ${socket.id}) unregistered due to disconnect.`);
        break;
      }
    }
    // Remove rider from mapping on disconnect
    for (let [riderId, socketId] of riderSockets.entries()) {
        if (socketId === socket.id) {
            riderSockets.delete(riderId);
            console.log(`Rider ${riderId} (socket ${socket.id}) unregistered due to disconnect.`);
            break;
        }
    }
  });
});


// Make io instance and socket maps available to other modules
app.set('socketio', io);
app.set('driverSockets', driverSockets);
app.set('riderSockets', riderSockets);


server.listen(port, () => {
  console.log(`Server running on http://localhost:${port}. WebSocket server initialized.`);
});

module.exports = { app, server, io, driverSockets, riderSockets }; // Export for testing & direct use
