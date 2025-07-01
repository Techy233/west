// Placeholder for database connection setup (e.g., using pg Pool)
// This file would typically initialize and export the database connection pool.

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  // Optional: SSL configuration for production databases
  // ssl: {
  //   rejectUnauthorized: false // Adjust based on your SSL certificate setup
  // }
});

pool.on('connect', () => {
  console.log('Connected to the PostgreSQL database!');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1); // Exit if cannot connect to DB
});

// Function to test the connection (optional, can be called at startup)
async function testConnection() {
  try {
    const client = await pool.connect();
    console.log("Successfully connected to PostgreSQL and acquired client.");
    const res = await client.query('SELECT NOW()');
    console.log("Current time from DB:", res.rows[0].now);
    client.release();
  } catch (error) {
    console.error("Error connecting to PostgreSQL:", error.stack);
    // Consider exiting if DB connection is critical for startup
    // process.exit(1);
  }
}

// You can export the pool or a query function
// module.exports = pool;
// OR
module.exports = {
  query: (text, params) => pool.query(text, params),
  pool, // Also export pool if direct access is needed
  testConnection // Export testConnection to be called in server.js if desired
};

// Example of how to call testConnection in server.js (add this in server.js if you want to test on startup):
// const db = require('./config/db');
// db.testConnection();
