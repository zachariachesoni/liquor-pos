import User from '../models/User.js';
import logger from '../utils/logger.js';
import bcrypt from 'bcryptjs';
import { sendInviteEmail } from '../utils/email.js';
import { generateTemporaryPassword } from '../utils/helpers.js';

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin
export const getUsers = async (req, res) => {
  try {
    const filters = {};
    if (req.query.role) filters.role = req.query.role;
    if (req.query.is_active !== undefined) filters.is_active = req.query.is_active === 'true';

    const users = await User.find(filters).select('-password');
    res.json({ success: true, count: users.length, data: users });
  } catch (error) {
    logger.error('Get users error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private/Admin
export const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: user });
  } catch (error) {
    logger.error('Get user error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Create user
// @route   POST /api/users
// @access  Private/Admin
export const createUser = async (req, res) => {
  try {
    const { username, email, role } = req.body;
    const temporaryPassword = generateTemporaryPassword();
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(temporaryPassword, salt);

    const user = await User.create({
      username,
      email,
      password: hashedPassword,
      role,
      permissions: req.body.permissions || {},
      is_active: true
    });
    
    // Remove password from response
    user.password = undefined;
    
    // Dispatch SMTP Welcome Email Link
    const inviteLink = `${process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`}/login`;
    const emailRes = await sendInviteEmail(email, username, role, inviteLink, temporaryPassword);

    res.status(201).json({ 
      success: true, 
      data: user, 
      temporaryPassword,
      emailSent: emailRes.success,
      emailResponse: emailRes.mocked ? emailRes.message : (emailRes.error || 'Sent successfully')
    });
  } catch (error) {
    logger.error('Create user error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Username or email already exists' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private/Admin
export const updateUser = async (req, res) => {
  try {
    const { username, email, role, isActive, permissions } = req.body;
    let user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.username = username || user.username;
    user.email = email || user.email;
    user.role = role || user.role;
    if (isActive !== undefined) user.is_active = isActive;
    if (permissions) user.permissions = permissions;

    await user.save();
    user.password = undefined;
    res.json({ success: true, data: user });
  } catch (error) {
    logger.error('Update user error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Delete user (soft delete)
// @route   DELETE /api/users/:id
// @access  Private/Admin
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    
    user.is_active = false;
    await user.save();
    res.json({ success: true, data: {} });
  } catch (error) {
    logger.error('Delete user error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
