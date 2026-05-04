import express from 'express';
import { addressAllNotifications, addressNotification, getNotifications } from '../controllers/notification.controller.js';
import { verifyToken, checkRole } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(verifyToken);
router.use(checkRole('admin'));

router.get('/', getNotifications);
router.patch('/address-all', addressAllNotifications);
router.patch('/:id/address', addressNotification);

export default router;
