require('dotenv').config(); // For loading environment variables from .env file

const express = require('express');
const cors = new require('cors');
const http = require('http');
// const { Server } = require("socket.io"); // Uncomment when Socket.IO is implemented

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
// app.use('/api/v1/rides', rideRoutes);
// app.use('/api/v1/drivers', driverRoutes);


// Error Handling Middleware (Simple example, can be more sophisticated)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

// Create HTTP server for Express and Socket.IO
const server = http.createServer(app);

// Initialize Socket.IO (Uncomment and configure when ready)
/*
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "*", // Configure allowed origins
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log('A user connected via WebSocket:', socket.id);

  // Example: socket.on('locationUpdate', (data) => { /* ... * / });
  // Example: socket.on('rideRequest', (data) => { /* ... * / });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});
*/

server.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

module.exports = { app, server }; // Export for potential testing
