import Expense from '../models/Expense.js';
import logger from '../utils/logger.js';

const expenseCategoryAliases = {
  operations: 'other',
  salary: 'salaries',
};

const allowedExpenseCategories = ['rent', 'salaries', 'transport', 'restocking', 'utilities', 'maintenance', 'other'];

const normalizeExpenseCategory = (category) => {
  if (!category) return category;
  return expenseCategoryAliases[category] || category;
};

const normalizeExpensePayload = (payload, userId) => {
  const normalizedPayload = {
    user_id: userId,
  };

  if (payload.description !== undefined) normalizedPayload.description = payload.description;
  if (payload.amount !== undefined) normalizedPayload.amount = Number(payload.amount);
  if (payload.category !== undefined) normalizedPayload.category = normalizeExpenseCategory(payload.category);
  if (payload.expense_date !== undefined || payload.expenseDate !== undefined) {
    normalizedPayload.expense_date = payload.expense_date || payload.expenseDate;
  }
  if (payload.payment_method !== undefined || payload.paymentMethod !== undefined) {
    normalizedPayload.payment_method = payload.payment_method || payload.paymentMethod;
  }
  if (payload.reference_number !== undefined || payload.referenceNumber !== undefined) {
    normalizedPayload.reference_number = payload.reference_number || payload.referenceNumber;
  }
  if (payload.receipt_image !== undefined || payload.receiptImage !== undefined) {
    normalizedPayload.receipt_image = payload.receipt_image || payload.receiptImage;
  }

  return normalizedPayload;
};

const serializeExpense = (expense) => {
  const doc = typeof expense.toObject === 'function' ? expense.toObject() : expense;

  return {
    ...doc,
    expenseDate: doc.expense_date,
    recordedBy: doc.user_id,
  };
};

const validateExpensePayload = (payload) => {
  if (!payload.description?.trim()) {
    return 'Description is required';
  }

  if (payload.amount === undefined || Number.isNaN(Number(payload.amount)) || Number(payload.amount) <= 0) {
    return 'Amount must be a number greater than 0';
  }

  const normalizedCategory = normalizeExpenseCategory(payload.category);
  if (!normalizedCategory || !allowedExpenseCategories.includes(normalizedCategory)) {
    return 'Please choose a valid expense category';
  }

  const dateValue = payload.expense_date || payload.expenseDate;
  if (dateValue && Number.isNaN(new Date(dateValue).getTime())) {
    return 'Expense date is invalid';
  }

  return null;
};

// @desc    Get all expenses
// @route   GET /api/expenses
export const getExpenses = async (req, res) => {
  try {
    const filters = {};
    if (req.query.start_date) filters.expense_date = { $gte: new Date(req.query.start_date) };
    if (req.query.end_date) {
      filters.expense_date = filters.expense_date || {};
      filters.expense_date.$lte = new Date(req.query.end_date);
    }
    if (req.query.category) filters.category = normalizeExpenseCategory(req.query.category);

    const expenses = await Expense.find(filters)
      .populate('user_id', 'username')
      .sort({ expense_date: -1 });

    res.json({
      success: true,
      count: expenses.length,
      data: expenses.map(serializeExpense),
    });
  } catch (error) {
    logger.error('Get expenses error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get expense categories
// @route   GET /api/expenses/categories
export const getExpenseCategories = async (req, res) => {
  try {
    const categories = await Expense.distinct('category');
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Create expense
// @route   POST /api/expenses
export const createExpense = async (req, res) => {
  try {
    const validationError = validateExpensePayload(req.body);
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    const expense = await Expense.create({
      ...normalizeExpensePayload(req.body, req.user._id || req.user.id),
      expense_date: req.body.expense_date || req.body.expenseDate || new Date(),
    });
    const populatedExpense = await Expense.findById(expense._id).populate('user_id', 'username');

    res.status(201).json({ success: true, data: serializeExpense(populatedExpense) });
  } catch (error) {
    logger.error('Create expense error:', error);
    const statusCode = error.name === 'ValidationError' ? 400 : 500;
    const message = error.name === 'ValidationError'
      ? Object.values(error.errors).map((entry) => entry.message).join(', ')
      : error.message || 'Server error';
    res.status(statusCode).json({ success: false, message });
  }
};

// @desc    Update expense
// @route   PUT /api/expenses/:id
export const updateExpense = async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ success: false, message: 'Expense not found' });

    const validationError = validateExpensePayload({
      ...expense.toObject(),
      ...req.body,
    });
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    const normalizedPayload = normalizeExpensePayload(req.body, expense.user_id);
    Object.entries(normalizedPayload).forEach(([key, value]) => {
      if (value !== undefined) expense[key] = value;
    });

    await expense.save();
    await expense.populate('user_id', 'username');

    res.json({ success: true, data: serializeExpense(expense) });
  } catch (error) {
    logger.error('Update expense error:', error);
    const statusCode = error.name === 'ValidationError' ? 400 : 500;
    const message = error.name === 'ValidationError'
      ? Object.values(error.errors).map((entry) => entry.message).join(', ')
      : error.message || 'Server error';
    res.status(statusCode).json({ success: false, message });
  }
};

// @desc    Delete expense
// @route   DELETE /api/expenses/:id
export const deleteExpense = async (req, res) => {
  try {
    const expense = await Expense.findByIdAndDelete(req.params.id);
    if (!expense) return res.status(404).json({ success: false, message: 'Expense not found' });
    res.json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
