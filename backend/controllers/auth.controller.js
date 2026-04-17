import { hashPassword, comparePassword, generateToken } from '../utils/helpers.js';
import logger from '../utils/logger.js';
import { sendRegistrationEmail } from '../utils/email.js';

// Import User model directly to ensure schema is registered
import User from '../models/User.js';

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public (should be restricted in production)
export const register = async (req, res) => {
  const { username, password, email } = req.body;

  try {
    const existingUserCount = await User.countDocuments();

    if (existingUserCount > 0) {
      return res.status(403).json({
        success: false,
        message: 'Public registration is disabled. Ask an admin to create your account.'
      });
    }

    // Validate required fields
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ username }, { email }] 
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Username or email already exists'
      });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const user = await User.create({
      username,
      password: hashedPassword,
      email,
      role: 'admin',
      permissions: {}
    });

    let emailResult = null;
    if (email) {
      const loginLink = `${process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`}/login?username=${encodeURIComponent(username)}`;
      emailResult = await sendRegistrationEmail(email, username, user.role, loginLink);
    }

    // Generate token
    const token = generateToken(user);

    logger.info(`Initial admin registered: ${username}`);

    res.status(201).json({
      success: true,
      message: 'Initial admin account created successfully',
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role
        },
        token,
        emailSent: emailResult ? emailResult.success : false,
        emailResponse: emailResult?.mocked
          ? emailResult.message
          : emailResult?.error || (emailResult ? 'Sent successfully' : 'No email provided')
      }
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration',
      error: error.message
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res) => {
  const { username, password } = req.body;

  try {
    const identifier = typeof username === 'string' ? username.trim() : '';

    // Validate input
    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username or email and password are required'
      });
    }

    const escapedIdentifier = identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const identifierRegex = new RegExp(`^${escapedIdentifier}$`, 'i');

    // Find user by username or email
    const user = await User.findOne({
      $or: [
        { username: identifierRegex },
        { email: identifierRegex }
      ]
    }).select('+password');

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

    // Generate token
    const token = generateToken(user);

    logger.info(`User logged in: ${user.username}`);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          permissions: user.permissions
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
    
    res.json({
      success: true,
      data: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        permissions: user.permissions
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
