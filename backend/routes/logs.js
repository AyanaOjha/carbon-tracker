const express = require('express');
const router = express.Router();
const CommuteLog = require('../models/CommuteLog');

// CO2 emission factors in kg per km (rough real-world averages)
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
  const actualEmission = EMISSION_FACTORS[mode] * distanceKm;
  return Math.max(carEmission - actualEmission, 0); // never negative
}

// ---------- CREATE ----------
// POST /api/logs
// User submits the form -> we save a new commute log
router.post('/', async (req, res) => {
  try {
    const { userName, date, mode, distanceKm } = req.body;

    const savedCo2 = co2Saved(mode, distanceKm);

    const newLog = new CommuteLog({
      userName,
      date,
      mode,
      distanceKm,
      co2SavedKg: savedCo2
    });

    await newLog.save();
    res.status(201).json(newLog);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------- READ (all logs for one user) ----------
// GET /api/logs/:userName
router.get('/:userName', async (req, res) => {
  try {
    const logs = await CommuteLog.find({ userName: req.params.userName })
      .sort({ date: -1 }); // most recent first
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- UPDATE ----------
// PUT /api/logs/:id
router.put('/:id', async (req, res) => {
  try {
    const { mode, distanceKm, date } = req.body;
    const savedCo2 = co2Saved(mode, distanceKm);

    const updatedLog = await CommuteLog.findByIdAndUpdate(
      req.params.id,
      { mode, distanceKm, date, co2SavedKg: savedCo2 },
      { new: true } // return the updated version, not the old one
    );

    if (!updatedLog) return res.status(404).json({ error: 'Log not found' });
    res.json(updatedLog);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------- DELETE ----------
// DELETE /api/logs/:id
router.delete('/:id', async (req, res) => {
  try {
    const deletedLog = await CommuteLog.findByIdAndDelete(req.params.id);
    if (!deletedLog) return res.status(404).json({ error: 'Log not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- BONUS: Leaderboard ----------
// GET /api/logs/leaderboard/all
// Groups all logs by user and sums up their total CO2 saved
router.get('/leaderboard/all', async (req, res) => {
  try {
    const leaderboard = await CommuteLog.aggregate([
      {
        $group: {
          _id: '$userName',
          totalCo2Saved: { $sum: '$co2SavedKg' }
        }
      },
      { $sort: { totalCo2Saved: -1 } }
    ]);
    res.json(leaderboard);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
