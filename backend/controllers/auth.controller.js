import { hashPassword, comparePassword, generateToken } from '../utils/helpers.js';
import logger from '../utils/logger.js';
import { getAuthCookieOptions } from '../utils/authCookies.js';
import Business from '../models/Business.js';
import SystemSettings from '../models/SystemSettings.js';
import {
  createBusiness,
  dropLegacyGlobalTenantIndexes,
  ensureLegacyBusinessForUser,
  normalizeBusinessSlug
} from '../utils/tenant.js';

// Import User model directly to ensure schema is registered
import User from '../models/User.js';

const attachAuthCookie = (res, token) => {
  res.cookie('auth_token', token, getAuthCookieOptions());
};

const clearAuthCookie = (res) => {
  res.clearCookie('auth_token', {
    ...getAuthCookieOptions(),
    maxAge: undefined,
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public (should be restricted in production)
export const register = async (req, res) => {
  const { username, password } = req.body;
  const businessName = req.body.business_name || req.body.businessName;
  const businessSlug = req.body.business_slug || req.body.businessSlug || req.body.businessCode;

  try {
    await dropLegacyGlobalTenantIndexes();

    // Validate required fields
    if (!businessName || !username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Business name, username, and password are required'
      });
    }

    const business = await createBusiness({ name: businessName, slug: businessSlug });
    const existingUser = await User.findOne({ business_id: business._id, username });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Username already exists'
      });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const user = await User.create({
      business_id: business._id,
      username,
      password: hashedPassword,
      role: 'admin',
      permissions: {}
    });

    await SystemSettings.create({
      business_id: business._id,
      business_name: business.name
    });

    // Generate token
    const token = generateToken(user);
    attachAuthCookie(res, token);

    logger.info(`Initial admin registered: ${username}`);

    res.status(201).json({
      success: true,
      message: 'Initial admin account created successfully',
      data: {
        user: {
          id: user._id,
          business_id: business._id,
          username: user.username,
          role: user.role,
          business: {
            id: business._id,
            name: business.name,
            slug: business.slug
          }
        },
        token
      }
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : 'Server error during registration',
      error: error.message
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res) => {
  const { username, password } = req.body;
  const businessCode = normalizeBusinessSlug(req.body.businessCode || req.body.business_code || req.body.businessSlug || req.body.business_slug);

  try {
    const identifier = typeof username === 'string' ? username.trim() : '';

    // Validate input
    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    const escapedIdentifier = identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const identifierRegex = new RegExp(`^${escapedIdentifier}$`, 'i');

    const userFilters = { username: identifierRegex };
    let business = null;

    if (businessCode) {
      business = await Business.findOne({ slug: businessCode, is_active: true });
      if (!business) {
        return res.status(401).json({
          success: false,
          message: 'Invalid business code or credentials'
        });
      }
      userFilters.business_id = business._id;
    }

    const users = await User.find(userFilters).select('+password').populate('business_id', 'name slug is_active');
    if (!businessCode && users.length > 1) {
      return res.status(400).json({
        success: false,
        message: 'Enter your business code to continue'
      });
    }

    const user = users[0] || null;

    if (!user || !user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Verify password
    const isMatch = await comparePassword(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    business = business || await ensureLegacyBusinessForUser(user);
    if (!business || business.is_active === false) {
      return res.status(401).json({
        success: false,
        message: 'Business account is inactive'
      });
    }

    // Generate token
    const token = generateToken(user);
    attachAuthCookie(res, token);

    logger.info(`User logged in: ${user.username}`);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          business_id: business._id,
          username: user.username,
          role: user.role,
          permissions: user.permissions,
          business: {
            id: business._id,
            name: business.name,
            slug: business.slug
          }
        },
        token
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login',
      error: error.message
    });
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res) => {
  try {
    const user = req.user;
    const business = req.business;
    
    res.json({
      success: true,
      data: {
        id: user._id,
        business_id: business?._id || user.business_id,
        username: user.username,
        role: user.role,
        permissions: user.permissions,
        business: business ? {
          id: business._id,
          name: business.name,
          slug: business.slug
        } : null
      }
    });
  } catch (error) {
    logger.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Logout user (client-side should remove token)
// @route   POST /api/auth/logout
// @access  Private
export const logout = async (req, res) => {
  try {
    logger.info(`User logged out: ${req.user.username}`);
    clearAuthCookie(res);
    
    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Change current user's password
// @route   POST /api/auth/change-password
// @access  Private
export const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  try {
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long'
      });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const isMatch = await comparePassword(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    user.password = await hashPassword(newPassword);
    await user.save();

    logger.info(`Password changed for user: ${user.username}`);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    logger.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while changing password',
      error: error.message
    });
  }
};
