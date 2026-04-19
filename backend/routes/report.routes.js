import express from 'express';
import {
  getPnLReport,
  getCustomerSalesReport,
  getProductSalesReport,
  getSupplierStatementReport,
  getAccountsPayableAgingReport,
  getPurchaseHistoryReport,
  getMarginErosionReport,
  getTopSuppliersReport
} from '../controllers/report.controller.js';
import { verifyToken, checkRole } from '../middleware/auth.middleware.js';

const router = express.Router();

// Require admin or manager to view reports
router.use(verifyToken);
router.use(checkRole('admin', 'manager'));

router.get('/pnl', getPnLReport);
router.get('/customer-sales', getCustomerSalesReport);
router.get('/product-sales', getProductSalesReport);
router.get('/supplier-statement', getSupplierStatementReport);
router.get('/accounts-payable-aging', getAccountsPayableAgingReport);
router.get('/purchase-history', getPurchaseHistoryReport);
router.get('/margin-erosion', getMarginErosionReport);
router.get('/top-suppliers', getTopSuppliersReport);

export default router;
