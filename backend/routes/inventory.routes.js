import express from 'express';
const router = express.Router();
import { getStockLevels, getLowStock, getHistory, adjustStock, getReorderSuggestions } from '../controllers/inventory.controller.js';
import { verifyToken, checkRole } from '../middleware/auth.middleware.js';

// All routes are protected
router.use(verifyToken);

router.get('/stock-levels', getStockLevels);
router.get('/low-stock', getLowStock);
router.get('/reorder-suggestions', getReorderSuggestions);
router.get('/history', getHistory);
router.post('/adjustments', checkRole('admin', 'manager'), adjustStock);

export default router;
