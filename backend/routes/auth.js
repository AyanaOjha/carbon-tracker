const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { authenticator } = require('otplib');
const qrcode = require('qrcode');
const User = require('../models/User');
const { verifyToken, JWT_SECRET } = require('../middleware/auth');

authenticator.options = { window: 1 }; // Allow 1 step tolerance (+/- 30s)

// In-memory user fallback store (active only when MongoDB is offline / not connected)
const memoryUsers = new Map();

// Helper to check if DB is connected
const isDbConnected = () => mongoose.connection.readyState === 1;

// ==========================================
// 1. REGISTER (Stores salted bcrypt hash)
// POST /api/auth/register
// ==========================================
router.post('/register', async (req, res) => {
  try {
    const { userName, email, password, role } = req.body;

    if (!userName || !email || !password) {
      return res.status(400).json({ error: 'userName, email, and password are required.' });
    }

    const assignedRole = role && ['commuter', 'supervisor', 'admin'].includes(role) ? role : 'commuter';

    if (isDbConnected()) {
      const existing = await User.findOne({ $or: [{ userName }, { email }] });
      if (existing) {
        return res.status(400).json({ error: 'Username or email already exists.' });
      }

      const newUser = new User({
        userName,
        email,
        password, // Hashed by pre-save hook in User model
        role: assignedRole
      });

      await newUser.save();

      return res.status(201).json({
        message: 'User registered successfully with salted password hash.',
        user: {
          id: newUser._id,
          userName: newUser.userName,
          email: newUser.email,
          role: newUser.role,
          mfaEnabled: newUser.mfaEnabled,
          passwordHashPreview: newUser.password.substring(0, 20) + '...'
        }
      });
    } else {
      // Memory Fallback Mode
      if (memoryUsers.has(userName)) {
        return res.status(400).json({ error: 'Username already exists.' });
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const userObj = {
        _id: 'mem_' + Date.now() + Math.random().toString(36).substring(2, 6),
        userName,
        email,
        password: hashedPassword,
        role: assignedRole,
        mfaEnabled: false,
        mfaSecret: null
      };

      memoryUsers.set(userName, userObj);

      return res.status(201).json({
        message: 'User registered successfully with salted password hash (Memory Mode).',
        user: {
          id: userObj._id,
          userName: userObj.userName,
          email: userObj.email,
          role: userObj.role,
          mfaEnabled: false,
          passwordHashPreview: userObj.password.substring(0, 20) + '...'
        }
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 2. LOGIN (Step 1: Password Check)
// POST /api/auth/login
// ==========================================
router.post('/login', async (req, res) => {
  try {
    const { userName, password } = req.body;

    if (!userName || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    let user;
    let isMatch = false;

    if (isDbConnected()) {
      user = await User.findOne({ userName });
      if (user) {
        isMatch = await user.comparePassword(password);
      }
    } else {
      user = memoryUsers.get(userName);
      if (user) {
        isMatch = await bcrypt.compare(password, user.password);
      }
    }

    if (!user || !isMatch) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // If MFA is enabled, require TOTP 2nd factor
    if (user.mfaEnabled) {
      const tempToken = jwt.sign(
        { id: user._id, userName: user.userName, mfaPending: true },
        JWT_SECRET,
        { expiresIn: '5m' }
      );
      return res.json({
        mfaRequired: true,
        message: 'Password verified. Please enter 6-digit TOTP code from your authenticator app.',
        tempToken,
        userName: user.userName
      });
    }

    // Issue standard session JWT
    const token = jwt.sign(
      { id: user._id, userName: user.userName, role: user.role, email: user.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      mfaRequired: false,
      message: 'Login successful.',
      token,
      user: {
        id: user._id,
        userName: user.userName,
        email: user.email,
        role: user.role,
        mfaEnabled: false
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 3. MFA SETUP (Generate TOTP secret & QR code)
// POST /api/auth/mfa/setup
// ==========================================
router.post('/mfa/setup', verifyToken, async (req, res) => {
  try {
    const secret = authenticator.generateSecret();
    const serviceName = 'CarbonTracker';
    const email = req.user.email || `${req.user.userName}@carbontracker.local`;
    const otpAuthUrl = authenticator.keyuri(email, serviceName, secret);

    const qrCodeDataUrl = await qrcode.toDataURL(otpAuthUrl);

    if (isDbConnected()) {
      const user = await User.findById(req.user.id);
      if (user) {
        user.mfaSecret = secret;
        await user.save();
      }
    } else {
      const user = memoryUsers.get(req.user.userName);
      if (user) {
        user.mfaSecret = secret;
      }
    }

    res.json({
      message: 'MFA setup initialized. Scan the QR code with Google/Microsoft Authenticator.',
      secret,
      qrCodeDataUrl,
      otpAuthUrl
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 4. MFA VERIFY & ACTIVATE
// POST /api/auth/mfa/verify
// ==========================================
router.post('/mfa/verify', verifyToken, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: '6-digit TOTP token is required.' });
    }

    let user;
    if (isDbConnected()) {
      user = await User.findById(req.user.id);
    } else {
      user = memoryUsers.get(req.user.userName);
    }

    if (!user || !user.mfaSecret) {
      return res.status(400).json({ error: 'MFA setup has not been initiated for this user.' });
    }

    const isValid = authenticator.check(token, user.mfaSecret);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid TOTP code. Please try again.' });
    }

    user.mfaEnabled = true;
    if (isDbConnected()) {
      await user.save();
    }

    res.json({
      message: 'MFA enabled successfully! Future logins will require Google Authenticator TOTP.',
      mfaEnabled: true
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 5. MFA LOGIN STEP 2 (Verify TOTP after password)
// POST /api/auth/mfa/login-step2
// ==========================================
router.post('/mfa/login-step2', async (req, res) => {
  try {
    const { tempToken, token } = req.body;
    if (!tempToken || !token) {
      return res.status(400).json({ error: 'tempToken and 6-digit TOTP code are required.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(tempToken, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Temporary login session expired. Please log in again.' });
    }

    let user;
    if (isDbConnected()) {
      user = await User.findById(decoded.id);
    } else {
      user = memoryUsers.get(decoded.userName);
    }

    if (!user || !user.mfaSecret) {
      return res.status(400).json({ error: 'User does not have active MFA.' });
    }

    const isValid = authenticator.check(token, user.mfaSecret);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid 6-digit TOTP code.' });
    }

    // Issue full access JWT
    const fullToken = jwt.sign(
      { id: user._id, userName: user.userName, role: user.role, email: user.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'MFA verification successful. Logged in.',
      token: fullToken,
      user: {
        id: user._id,
        userName: user.userName,
        email: user.email,
        role: user.role,
        mfaEnabled: true
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
