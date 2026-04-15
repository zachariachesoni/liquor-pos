import express from 'express';
const router = express.Router();
import { getCustomers, getCustomer, createCustomer, updateCustomer, deleteCustomer, getCustomerPurchaseHistory } from '../controllers/customer.controller.js';
import { verifyToken, checkRole } from '../middleware/auth.middleware.js';

// All routes are protected
router.use(verifyToken);

router.get('/', getCustomers);
router.get('/:id', getCustomer);
router.post('/', checkRole('admin', 'manager'), createCustomer);
router.put('/:id', checkRole('admin', 'manager'), updateCustomer);
router.delete('/:id', checkRole('admin'), deleteCustomer);
router.get('/:id/purchase-history', getCustomerPurchaseHistory);

export default router;
