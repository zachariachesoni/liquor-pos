import express from 'express';
import {
  getPurchaseOrders,
  getOpenPurchaseOrders,
  getPurchaseOrder,
  createPurchaseOrder,
  receivePurchaseOrder,
  recordSupplierPayment,
  getPayablesDashboard
} from '../controllers/purchase.controller.js';
import { verifyToken, checkRole } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(verifyToken);
router.use(checkRole('admin', 'manager'));

router.get('/open', getOpenPurchaseOrders);
router.get('/payables/dashboard', getPayablesDashboard);
router.get('/', getPurchaseOrders);
router.post('/', createPurchaseOrder);
router.get('/:id', getPurchaseOrder);
router.post('/:id/receive', receivePurchaseOrder);
router.post('/:id/payments', recordSupplierPayment);

export default router;
