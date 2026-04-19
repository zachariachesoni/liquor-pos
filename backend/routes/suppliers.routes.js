import express from 'express';
import {
  getSuppliers,
  getSupplier,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  upsertSupplierProductLink,
  deleteSupplierProductLink,
  getSupplierPriceComparison
} from '../controllers/supplier.controller.js';
import { verifyToken, checkRole } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(verifyToken);
router.use(checkRole('admin', 'manager'));

router.get('/price-comparison/:variantId', getSupplierPriceComparison);
router.delete('/links/:linkId', deleteSupplierProductLink);
router.get('/', getSuppliers);
router.post('/', createSupplier);
router.get('/:id', getSupplier);
router.put('/:id', updateSupplier);
router.delete('/:id', checkRole('admin'), deleteSupplier);
router.post('/:id/links', upsertSupplierProductLink);

export default router;
