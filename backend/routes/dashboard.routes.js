import express from 'express';
const router = express.Router();
import { getStats } from '../controllers/dashboard.controller.js';
import { verifyToken } from '../middleware/auth.middleware.js';

// All routes are protected
router.use(verifyToken);

router.get('/stats', getStats);

export default router;
