import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { getAuthTokenFromRequest } from '../utils/authCookies.js';
import { ensureLegacyBusinessForUser } from '../utils/tenant.js';

// Verify JWT token
export const verifyToken = async (req, res, next) => {
  try {
    const token = getAuthTokenFromRequest(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided, authorization denied'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find user in database using Mongoose
    const user = await User.findById(decoded.id);

    if (!user || user.is_active === false) {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive'
      });
    }

    const business = await ensureLegacyBusinessForUser(user);
    if (!business || business.is_active === false) {
      return res.status(401).json({
        success: false,
        message: 'Business account is inactive'
      });
    }

    req.user = user;
    req.business = business;
    req.businessId = business._id;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }
    next(error);
  }
};

// Check user role
export const checkRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Insufficient permissions'
      });
    }

    next();
  };
};
