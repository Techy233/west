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
// app.use('/api/v1/drivers', driverRoutes);


// Error Handling Middleware (Simple example, can be more sophisticated)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

// Create HTTP server for Express and Socket.IO
const server = http.createServer(app);

// In-memory store for driver_id to socket_id mapping
// In production, use Redis or a similar store for scalability
const driverSockets = new Map(); // Map<driver_id, socket_id>

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

  // Example: Placeholder for location updates from drivers
  // socket.on('driver_location_update', (data) => {
  //   // data = { driverId, latitude, longitude }
  //   // TODO: Update driver's location in DB, broadcast to relevant riders/admin
  //   console.log('Driver location update:', data);
  // });


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
  });
});


// Make io instance available to other modules (e.g., controllers)
// This is a simple way; dependency injection or a service locator pattern might be better for larger apps.
app.set('socketio', io);
app.set('driverSockets', driverSockets);


server.listen(port, () => {
  console.log(`Server running on http://localhost:${port}. WebSocket server initialized.`);
});

module.exports = { app, server, io, driverSockets }; // Export for potential testing & direct use
