const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const CommuteLog = require('../models/CommuteLog');
const { verifyToken, requireRole } = require('../middleware/auth');

// CO2 emission factors in kg per km
const EMISSION_FACTORS = {
  car: 0.192,
  bus: 0.105,
  train: 0.041,
  bike: 0,
  walk: 0
};

// Helper: how much CO2 did this trip actually produce?
function co2Saved(mode, distanceKm) {
  const carEmission = EMISSION_FACTORS.car * distanceKm;
  const actualEmission = (EMISSION_FACTORS[mode] !== undefined ? EMISSION_FACTORS[mode] : EMISSION_FACTORS.car) * distanceKm;
  return Math.max(carEmission - actualEmission, 0); // never negative
}

// In-memory commute log fallback store (active only when MongoDB is offline / not connected)
const memoryLogs = [];

// Helper to check if DB is connected
const isDbConnected = () => mongoose.connection.readyState === 1;

// ---------- CREATE ----------
// POST /api/logs
router.post('/', async (req, res) => {
  try {
    const { userName, date, mode, distanceKm } = req.body;
    const savedCo2 = co2Saved(mode, distanceKm);

    if (isDbConnected()) {
      const newLog = new CommuteLog({
        userName,
        date,
        mode,
        distanceKm,
        co2SavedKg: savedCo2
      });

      await newLog.save();
      return res.status(201).json(newLog);
    } else {
      const newLog = {
        _id: 'log_' + Date.now() + Math.random().toString(36).substring(2, 6),
        userName,
        date: date || new Date().toISOString(),
        mode,
        distanceKm,
        co2SavedKg: savedCo2,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      memoryLogs.push(newLog);
      return res.status(201).json(newLog);
    }
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------- READ (all logs for one user) ----------
// GET /api/logs/:userName
router.get('/:userName', async (req, res) => {
  try {
    if (isDbConnected()) {
      const logs = await CommuteLog.find({ userName: req.params.userName })
        .sort({ date: -1 });
      return res.json(logs);
    } else {
      const logs = memoryLogs
        .filter(l => l.userName.toLowerCase() === req.params.userName.toLowerCase())
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      return res.json(logs);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- UPDATE (RESTRICTED BY RBAC) ----------
// PUT /api/logs/:id
// Restrict to logged-in users with role: 'supervisor' or 'admin'
router.put('/:id', verifyToken, requireRole(['supervisor', 'admin']), async (req, res) => {
  try {
    const { mode, distanceKm, date } = req.body;
    const savedCo2 = co2Saved(mode, distanceKm);

    if (isDbConnected()) {
      const updatedLog = await CommuteLog.findByIdAndUpdate(
        req.params.id,
        { mode, distanceKm, date, co2SavedKg: savedCo2 },
        { new: true }
      );

      if (!updatedLog) return res.status(404).json({ error: 'Log not found' });
      return res.json(updatedLog);
    } else {
      const log = memoryLogs.find(l => l._id === req.params.id);
      if (!log) return res.status(404).json({ error: 'Log not found' });

      if (mode) log.mode = mode;
      if (distanceKm !== undefined) log.distanceKm = distanceKm;
      if (date) log.date = date;
      log.co2SavedKg = savedCo2;
      log.updatedAt = new Date();

      return res.json(log);
    }
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------- DELETE (RESTRICTED BY RBAC) ----------
// DELETE /api/logs/:id
// Restrict to logged-in users with role: 'supervisor' or 'admin'
router.delete('/:id', verifyToken, requireRole(['supervisor', 'admin']), async (req, res) => {
  try {
    if (isDbConnected()) {
      const deletedLog = await CommuteLog.findByIdAndDelete(req.params.id);
      if (!deletedLog) return res.status(404).json({ error: 'Log not found' });
      return res.json({ message: 'Deleted successfully' });
    } else {
      const index = memoryLogs.findIndex(l => l._id === req.params.id);
      if (index === -1) return res.status(404).json({ error: 'Log not found' });
      memoryLogs.splice(index, 1);
      return res.json({ message: 'Deleted successfully' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- BONUS / ANALYTICS: Leaderboard ----------
// GET /api/logs/leaderboard/all
router.get('/leaderboard/all', async (req, res) => {
  try {
    if (isDbConnected()) {
      const leaderboard = await CommuteLog.aggregate([
        {
          $group: {
            _id: '$userName',
            totalCo2Saved: { $sum: '$co2SavedKg' }
          }
        },
        { $sort: { totalCo2Saved: -1 } }
      ]);
      return res.json(leaderboard);
    } else {
      // In-memory aggregation
      const group = {};
      memoryLogs.forEach(log => {
        group[log.userName] = (group[log.userName] || 0) + log.co2SavedKg;
      });

      const leaderboard = Object.keys(group).map(userName => ({
        _id: userName,
        totalCo2Saved: group[userName]
      })).sort((a, b) => b.totalCo2Saved - a.totalCo2Saved);

      return res.json(leaderboard);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
