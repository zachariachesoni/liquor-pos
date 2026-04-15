import express from 'express';
const router = express.Router();
import { getExpenses, getExpenseCategories, createExpense, updateExpense, deleteExpense } from '../controllers/expense.controller.js';
import { verifyToken, checkRole } from '../middleware/auth.middleware.js';

// All routes are protected
router.use(verifyToken);

router.get('/categories', getExpenseCategories);
router.get('/', getExpenses);
router.post('/', checkRole('admin', 'manager'), createExpense);
router.put('/:id', checkRole('admin', 'manager'), updateExpense);
router.delete('/:id', checkRole('admin'), deleteExpense);

export default router;
