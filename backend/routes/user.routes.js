import express from 'express';
const router = express.Router();
import { getUsers, getUser, createUser, updateUser, deleteUser } from '../controllers/user.controller.js';
import { verifyToken, checkRole } from '../middleware/auth.middleware.js';

router.use(verifyToken);

router.get('/', checkRole('admin'), getUsers);
router.get('/:id', checkRole('admin'), getUser);
router.post('/', checkRole('admin'), createUser);
router.put('/:id', checkRole('admin'), updateUser);
router.delete('/:id', checkRole('admin'), deleteUser);

export default router;
