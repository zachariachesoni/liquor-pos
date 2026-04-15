import express from 'express';
const router = express.Router();
import { register, login, getMe, logout, changePassword } from '../controllers/auth.controller.js';
import { verifyToken } from '../middleware/auth.middleware.js';

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected routes
router.get('/me', verifyToken, getMe);
router.post('/logout', verifyToken, logout);
router.post('/change-password', verifyToken, changePassword);

export default router;
