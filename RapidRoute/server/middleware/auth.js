/**
 * JWT authentication middleware.
 * Verifies the JWT token from the Authorization header and attaches the user to req.user.
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_here';

/**
 * Verify JWT token middleware.
 * Expects Bearer token in Authorization header.
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Please provide a valid JWT token in the Authorization header.',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired',
        message: 'Your session has expired. Please login again.',
      });
    }
    return res.status(401).json({
      error: 'Invalid token',
      message: 'The provided token is invalid.',
    });
  }
}

module.exports = authMiddleware;
