const mongoose = require('mongoose');

// This defines the "shape" of one commute log entry in the database.
// Think of it like a table with fixed columns.
const commuteLogSchema = new mongoose.Schema({
  userName: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  mode: {
    type: String,
    enum: ['walk', 'bike', 'bus', 'train', 'car'], // only these values allowed
    required: true
  },
  distanceKm: {
    type: Number,
    required: true,
    min: 0
  },
  co2SavedKg: {
    type: Number, // we calculate this ourselves before saving, see routes/logs.js
    required: true
  }
}, {
  timestamps: true // automatically adds "createdAt" and "updatedAt"
});

// "CommuteLog" here becomes a MongoDB collection called "commutelogs"
module.exports = mongoose.model('CommuteLog', commuteLogSchema);
