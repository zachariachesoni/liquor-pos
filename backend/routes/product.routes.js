import express from 'express';
const router = express.Router();
import { getProducts, getProduct, createProduct, updateProduct, deleteProduct, createVariant, updateVariant, deleteVariant } from '../controllers/product.controller.js';
import { verifyToken, checkRole } from '../middleware/auth.middleware.js';

// All routes are protected
router.use(verifyToken);

router.get('/', getProducts);
router.get('/:id', getProduct);
router.post('/', checkRole('admin', 'manager'), createProduct);
router.put('/:id', checkRole('admin', 'manager'), updateProduct);
router.delete('/:id', checkRole('admin'), deleteProduct);
router.post('/:productId/variants', checkRole('admin', 'manager'), createVariant);
router.put('/variants/:id', checkRole('admin', 'manager'), updateVariant);
router.delete('/variants/:id', checkRole('admin'), deleteVariant);

export default router;
