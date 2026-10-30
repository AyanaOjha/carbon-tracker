require('dotenv').config(); // reads values from the .env file
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const os = require('os');

const logsRouter = require('./routes/logs');
const authRouter = require('./routes/auth');

const app = express();

// Server Instance Identifier for Load Balancer distribution demonstration
const INSTANCE_ID = process.env.INSTANCE_ID || `${os.hostname()}-pid${process.pid}`;

// ---- Middleware (things that run on every request) ----
app.use(cors({
  origin: '*',
  exposedHeaders: ['X-Served-By']
})); // allow frontend to call this backend & inspect load balancing header
app.use(express.json()); // let the server understand JSON sent from the frontend

// Attach container / instance ID to every HTTP response header
app.use((req, res, next) => {
  res.setHeader('X-Served-By', INSTANCE_ID);
  next();
});

// ---- Connect to MongoDB ----
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/carbon-tracker';
mongoose.connect(MONGO_URI, {
  serverSelectionTimeoutMS: 5000 // Fails fast in 5s instead of hanging for 30s
})
  .then(() => console.log(`[${INSTANCE_ID}] Connected to MongoDB Atlas`))
  .catch((err) => {
    console.error(`[${INSTANCE_ID}] MongoDB Atlas connection error:`, err.message);
    console.log(`[${INSTANCE_ID}] Tip: If using Atlas, whitelist your IP (0.0.0.0/0) in MongoDB Atlas > Network Access.`);
    console.log(`[${INSTANCE_ID}] Running in-memory fallback mode: all APIs (Auth, MFA, Commute Logs) remain fully functional!`);
  });

// ---- Routes ----
// Anything starting with /api/auth goes to our auth.js file (Register, Login, MFA)
app.use('/api/auth', authRouter);

// Anything starting with /api/logs goes to our logs.js file (CRUD + Leaderboard)
app.use('/api/logs', logsRouter);

// Simple health check route - shows server is alive and which instance handled request
app.get('/', (req, res) => {
  res.json({
    message: 'Carbon Tracker API is running',
    instance: INSTANCE_ID,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// ---- Start the server ----
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => console.log(`[${INSTANCE_ID}] Server running on port ${PORT}`));
