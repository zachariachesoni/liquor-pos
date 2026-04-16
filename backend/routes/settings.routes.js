import express from 'express';
import { getPublicSettings, getSettings, updateSettings } from '../controllers/settings.controller.js';
import { verifyToken, checkRole } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/public', getPublicSettings);
router.get('/', verifyToken, checkRole('admin'), getSettings);
router.put('/', verifyToken, checkRole('admin'), updateSettings);

export default router;
