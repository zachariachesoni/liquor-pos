import User from '../models/User.js';
import logger from '../utils/logger.js';
import { hashPassword } from '../utils/helpers.js';

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
    const { username, email, password, role } = req.body;

    if (!['manager', 'cashier'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Only manager and cashier accounts can be created here' });
    }

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required' });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long' });
    }

    const employeeCount = await User.countDocuments({ role: { $ne: 'admin' }, is_active: true });
    if (employeeCount >= 3) {
      return res.status(400).json({
        success: false,
        message: 'Employee account limit reached (maximum 3 active employees allowed)'
      });
    }

    const hashedPassword = await hashPassword(password);

    const user = await User.create({
      username,
      email: email || undefined,
      password: hashedPassword,
      role,
      permissions: req.body.permissions || {},
      is_active: true
    });
    
    // Remove password from response
    user.password = undefined;

    res.status(201).json({ 
      success: true, 
      data: user
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

    if (role && !['manager', 'cashier'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Only manager and cashier roles can be assigned here' });
    }

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

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private/Admin
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, data: {} });
  } catch (error) {
    logger.error('Delete user error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
