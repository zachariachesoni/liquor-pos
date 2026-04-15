import express from 'express';
const router = express.Router();
import { createSale, getSales, getSaleDetails } from '../controllers/sales.controller.js';
import { verifyToken, checkRole } from '../middleware/auth.middleware.js';

// All routes are protected
router.use(verifyToken);

router.post('/', createSale); // Any authenticated user can create sales
router.get('/today', getSales);
router.get('/', getSales);
router.get('/:id', getSaleDetails);

export default router;
