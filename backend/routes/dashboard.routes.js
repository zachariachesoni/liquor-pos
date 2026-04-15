import express from 'express';
const router = express.Router();
import { getStats } from '../controllers/dashboard.controller.js';
import { verifyToken } from '../middleware/auth.middleware.js';

// All routes are protected
router.use(verifyToken);

router.get('/stats', getStats);
router.get('/sales-trend', getStats);
router.get('/top-products', getStats);
router.get('/profit-summary', getStats);
router.get('/category-performance', getStats);

export default router;
