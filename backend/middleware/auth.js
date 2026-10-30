const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'carbon_tracker_super_secret_jwt_key_2026';

// Middleware to verify JWT Bearer token
function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({
      error: 'Access denied. No token provided.',
      code: 'AUTH_TOKEN_MISSING'
    });
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      error: 'Invalid or expired token.',
      code: 'AUTH_TOKEN_INVALID'
    });
  }
}

// Middleware to enforce Role-Based Access Control (RBAC)
function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Requires one of [${allowedRoles.join(', ')}] role. Current role: '${req.user.role}'.`,
        code: 'FORBIDDEN_INSUFFICIENT_ROLE'
      });
    }

    next();
  };
}

module.exports = {
  verifyToken,
  requireRole,
  JWT_SECRET
};
