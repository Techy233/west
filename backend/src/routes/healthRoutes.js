const express = require('express');
const router = express.Router();

// Health check endpoint
router.get('/', (req, res) => {
    res.status(200).json({
        status: 'UP',
        message: 'API is healthy',
        timestamp: new Date().toISOString()
    });
});

// Extended health check (can be used to check DB connection, etc.)
router.get('/details', async (req, res) => {
    try {
        // Example: Check database connection
        // const db = require('../config/db'); // Assuming db.js exports a query function or pool
        // await db.query('SELECT 1'); // Simple query to check connection
        // const dbStatus = 'connected';

        res.status(200).json({
            status: 'UP',
            message: 'API is healthy and connected to services.',
            timestamp: new Date().toISOString(),
            dependencies: {
                database: 'connected' // Replace with actual status
                // Add other dependencies like payment gateways, etc.
            }
        });
    } catch (error) {
        res.status(503).json({ // 503 Service Unavailable
            status: 'DOWN',
            message: 'API is unhealthy or a dependency is down.',
            timestamp: new Date().toISOString(),
            error: error.message,
            dependencies: {
                database: 'disconnected'
            }
        });
    }
});

module.exports = router;
