import express from 'express';
const router = express.Router();
import { getUsers, getUser, createUser, updateUser, deleteUser } from '../controllers/user.controller.js';
import { verifyToken, checkRole } from '../middleware/auth.middleware.js';

router.use(verifyToken);

router.get('/', checkRole('admin', 'manager'), getUsers);
router.get('/:id', checkRole('admin', 'manager'), getUser);
router.post('/', checkRole('admin', 'manager'), createUser);
router.put('/:id', checkRole('admin', 'manager'), updateUser);
router.delete('/:id', checkRole('admin'), deleteUser);

export default router;
