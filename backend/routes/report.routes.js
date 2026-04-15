import express from 'express';
import {
  getPnLReport,
  getCustomerSalesReport,
  getProductSalesReport
} from '../controllers/report.controller.js';
import { verifyToken, checkRole } from '../middleware/auth.middleware.js';

const router = express.Router();

// Require admin or manager to view reports
router.use(verifyToken);
router.use(checkRole('admin', 'manager'));

router.get('/pnl', getPnLReport);
router.get('/customer-sales', getCustomerSalesReport);
router.get('/product-sales', getProductSalesReport);

export default router;
