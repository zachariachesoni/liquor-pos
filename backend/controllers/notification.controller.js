import Notification from '../models/Notification.js';
import ProductVariant from '../models/ProductVariant.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import logger from '../utils/logger.js';
import { calculateEffectiveLowStockLevel, getSystemSettings, serializeSystemSettings } from '../utils/systemSettings.js';

const buildLowStockConcerns = async () => {
  const settingsDoc = await getSystemSettings();
  const settings = serializeSystemSettings(settingsDoc);
  const variants = await ProductVariant.find()
    .populate('product_id', 'name brand category')
    .lean();

  return variants
    .map((variant) => ({
      variant,
      effectiveLowStockLevel: calculateEffectiveLowStockLevel(variant, settings)
    }))
    .filter(({ variant, effectiveLowStockLevel }) => Number(variant.current_stock || 0) <= effectiveLowStockLevel)
    .map(({ variant, effectiveLowStockLevel }) => {
      const productName = variant.product_id?.name || 'Unknown product';
      const size = variant.size || '';
      const stock = Number(variant.current_stock || 0);

      return {
        source_key: `low-stock:${variant._id}`,
        type: 'inventory',
        severity: stock <= 0 ? 'critical' : 'warning',
        title: stock <= 0 ? 'Out of stock' : 'Low stock',
        message: `${productName} ${size} has ${stock} unit${stock === 1 ? '' : 's'} left. Reorder through Suppliers.`,
        metadata: {
          variant_id: variant._id,
          product_id: variant.product_id?._id || null,
          product_name: productName,
          size,
          current_stock: stock,
          effective_low_stock_level: effectiveLowStockLevel
        }
      };
    });
};

const buildOverduePayableConcerns = async () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const overdueOrders = await PurchaseOrder.find({
    status: { $in: ['received', 'partially_received'] },
    balance_outstanding: { $gt: 0 },
    payment_due_date: { $lt: today }
  })
    .populate('supplier_id', 'name phone')
    .lean();

  return overdueOrders.map((purchaseOrder) => {
    const supplierName = purchaseOrder.supplier_id?.name || 'Unknown supplier';
    const balance = Number(purchaseOrder.balance_outstanding || 0);

    return {
      source_key: `overdue-payable:${purchaseOrder._id}`,
      type: 'supplier',
      severity: 'critical',
      title: 'Supplier payment overdue',
      message: `${purchaseOrder.po_number} for ${supplierName} has an outstanding balance of KES ${balance.toLocaleString()}.`,
      metadata: {
        purchase_order_id: purchaseOrder._id,
        po_number: purchaseOrder.po_number,
        supplier_id: purchaseOrder.supplier_id?._id || null,
        supplier_name: supplierName,
        balance_outstanding: balance,
        payment_due_date: purchaseOrder.payment_due_date
      }
    };
  });
};

const syncGeneratedConcerns = async () => {
  const concerns = [
    ...await buildLowStockConcerns(),
    ...await buildOverduePayableConcerns()
  ];
  const activeSourceKeys = concerns.map((concern) => concern.source_key);

  await Notification.updateMany(
    {
      generated: true,
      status: 'open',
      source_key: { $nin: activeSourceKeys }
    },
    {
      $set: {
        status: 'addressed',
        addressed_at: new Date(),
        resolution_note: 'System auto-cleared after the concern was resolved.'
      }
    }
  );

  await Promise.all(concerns.map(async (concern) => {
    const existing = await Notification.findOne({ source_key: concern.source_key });

    if (!existing) {
      await Notification.create({
        ...concern,
        generated: true,
        status: 'open'
      });
      return;
    }

    if (existing.status === 'open') {
      existing.type = concern.type;
      existing.severity = concern.severity;
      existing.title = concern.title;
      existing.message = concern.message;
      existing.metadata = concern.metadata;
      await existing.save();
    }
  }));
};

export const getNotifications = async (req, res) => {
  try {
    await syncGeneratedConcerns();

    const filters = {};
    if (req.query.status && req.query.status !== 'all') {
      filters.status = req.query.status;
    }

    const notifications = await Notification.find(filters)
      .populate('addressed_by', 'username')
      .sort({ status: 1, severity: 1, updatedAt: -1 })
      .lean();

    res.json({ success: true, count: notifications.length, data: notifications });
  } catch (error) {
    logger.error('Get notifications error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const addressNotification = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    notification.status = 'addressed';
    notification.addressed_by = req.user._id || req.user.id;
    notification.addressed_at = new Date();
    notification.resolution_note = req.body.resolution_note || 'Addressed by admin.';
    await notification.save();

    const populatedNotification = await Notification.findById(notification._id)
      .populate('addressed_by', 'username')
      .lean();

    res.json({ success: true, data: populatedNotification });
  } catch (error) {
    logger.error('Address notification error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
