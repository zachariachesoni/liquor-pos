import jwt from 'jsonwebtoken';
import { mongoose } from '../config/database.js';
import User from '../models/User.js';

// Verify JWT token
export const verifyToken = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided, authorization denied'
      });
    }

    const token = authHeader.split(' ')[1];

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

    // Attach user to request
    req.user = user;
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

// Check specific permission
export const checkPermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    // Admin has all permissions
    if (req.user.role === 'admin') {
      return next();
    }

    // Check if user has the specific permission
    const permissions = req.user.permissions || {};
    if (!permissions[permission]) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Missing ${permission} permission`
      });
    }

    next();
  };
};
