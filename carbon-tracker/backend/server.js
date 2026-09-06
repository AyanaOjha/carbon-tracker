require('dotenv').config(); // reads values from the .env file
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const logsRouter = require('./routes/logs');

const app = express();

// ---- Middleware (things that run on every request) ----
app.use(cors()); // allow frontend (different address) to call this backend
app.use(express.json()); // let the server understand JSON sent from the frontend

// ---- Connect to MongoDB Atlas ----
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch((err) => console.error('MongoDB connection error:', err));

// ---- Routes ----
// Anything starting with /api/logs goes to our logs.js file
app.use('/api/logs', logsRouter);

// Simple health check route - visit this to confirm the server is alive
app.get('/', (req, res) => {
  res.send('Carbon Tracker API is running');
});

// ---- Start the server ----
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
