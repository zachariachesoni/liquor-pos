import Notification from '../models/Notification.js';
import ProductVariant from '../models/ProductVariant.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import StockAdjustment from '../models/StockAdjustment.js';
import SupplierProductPriceHistory from '../models/SupplierProductPriceHistory.js';
import logger from '../utils/logger.js';
import { calculateEffectiveLowStockLevel, getSystemSettings, serializeSystemSettings } from '../utils/systemSettings.js';
import { buildPaginationMeta, getPagination } from '../utils/pagination.js';

const formatCurrency = (value) => `KES ${Number(value || 0).toLocaleString()}`;

const isPersistentGeneratedConcern = (sourceKey = '') => (
  sourceKey.startsWith('out-of-stock:')
  || sourceKey.startsWith('low-stock:')
  || sourceKey.startsWith('overdue-payable:')
);

const parseAverageCostFromNotes = (notes = '') => {
  const match = String(notes).match(/Average cost\s+([\d,.]+)\s+from\s+([\d,.]+)/i);
  if (!match) {
    return { before: null, after: null, change: null };
  }

  const after = Number(match[1].replace(/,/g, ''));
  const before = Number(match[2].replace(/,/g, ''));
  const hasValidCosts = Number.isFinite(before) && Number.isFinite(after);

  return {
    before: Number.isFinite(before) ? before : null,
    after: Number.isFinite(after) ? after : null,
    change: hasValidCosts ? after - before : null
  };
};

const getAverageCostSnapshot = (adjustment) => {
  const before = Number(adjustment.average_cost_before);
  const after = Number(adjustment.average_cost_after);

  if (Number.isFinite(before) && Number.isFinite(after)) {
    return {
      before,
      after,
      change: Number.isFinite(Number(adjustment.average_cost_change))
        ? Number(adjustment.average_cost_change)
        : after - before
    };
  }

  return parseAverageCostFromNotes(adjustment.notes);
};

const buildLowStockConcerns = async () => {
  const settingsDoc = await getSystemSettings();
  const settings = serializeSystemSettings(settingsDoc);
  const variants = await ProductVariant.find({ is_active: { $ne: false } })
    .populate('product_id', 'name brand category is_active')
    .lean();

  return variants
    .filter((variant) => variant.product_id?.is_active !== false)
    .map((variant) => ({
      variant,
      effectiveLowStockLevel: calculateEffectiveLowStockLevel(variant, settings)
    }))
    .filter(({ variant, effectiveLowStockLevel }) => Number(variant.current_stock || 0) <= effectiveLowStockLevel)
    .map(({ variant, effectiveLowStockLevel }) => {
      const productName = variant.product_id?.name || 'Unknown product';
      const size = variant.size || '';
      const stock = Number(variant.current_stock || 0);
      const isOutOfStock = stock <= 0;

      return {
        source_key: `${isOutOfStock ? 'out-of-stock' : 'low-stock'}:${variant._id}`,
        type: 'inventory',
        severity: isOutOfStock ? 'critical' : 'warning',
        title: isOutOfStock ? 'Out of stock' : 'Low stock',
        message: isOutOfStock
          ? `${productName} ${size} is out of stock. Reorder through Suppliers.`
          : `${productName} ${size} has ${stock} unit${stock === 1 ? '' : 's'} left. Reorder through Suppliers.`,
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

const buildAverageCostChangeConcerns = async () => {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const adjustments = await StockAdjustment.find({
    adjustment_type: 'in',
    reason: 'restocking',
    createdAt: { $gte: since }
  })
    .populate({
      path: 'variant_id',
      populate: {
        path: 'product_id',
        select: 'name brand category'
      }
    })
    .populate('purchase_order_id', 'po_number supplier_id')
    .populate('user_id', 'username')
    .sort({ createdAt: -1 })
    .lean();

  return adjustments.map((adjustment) => {
    const productName = adjustment.variant_id?.product_id?.name || 'Unknown product';
    const size = adjustment.variant_id?.size || '';
    const quantity = Number(adjustment.quantity || 0);
    const receivedUnitCost = Number(adjustment.unit_cost || 0);
    const averageCost = getAverageCostSnapshot(adjustment);
    const movedLabel = averageCost.before !== null && averageCost.after !== null
      ? `Average cost moved from ${formatCurrency(averageCost.before)} to ${formatCurrency(averageCost.after)}.`
      : `Incoming unit cost was ${formatCurrency(receivedUnitCost)}.`;
    const stockLabel = adjustment.stock_before !== null && adjustment.stock_after !== null
      ? ` Stock changed from ${Number(adjustment.stock_before || 0).toLocaleString()} to ${Number(adjustment.stock_after || 0).toLocaleString()} units.`
      : '';

    return {
      source_key: `average-cost:${adjustment._id}`,
      type: 'system',
      severity: averageCost.change > 0 ? 'warning' : 'info',
      title: 'Average cost applied',
      message: `${productName} ${size} received ${quantity.toLocaleString()} unit${quantity === 1 ? '' : 's'}. ${movedLabel}${stockLabel}`,
      metadata: {
        stock_adjustment_id: adjustment._id,
        purchase_order_id: adjustment.purchase_order_id?._id || null,
        po_number: adjustment.purchase_order_id?.po_number || null,
        variant_id: adjustment.variant_id?._id || null,
        product_id: adjustment.variant_id?.product_id?._id || null,
        product_name: productName,
        size,
        quantity_received: quantity,
        received_unit_cost: receivedUnitCost,
        stock_before: adjustment.stock_before,
        stock_after: adjustment.stock_after,
        average_cost_before: averageCost.before,
        average_cost_after: averageCost.after,
        average_cost_change: averageCost.change,
        changed_at: adjustment.createdAt,
        changed_by: adjustment.user_id ? {
          _id: adjustment.user_id._id,
          username: adjustment.user_id.username
        } : null
      }
    };
  });
};

const buildPriceChangeConcerns = async () => {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const priceChanges = await SupplierProductPriceHistory.find({
    changed_at: { $gte: since }
  })
    .populate('supplier_id', 'name phone')
    .populate({
      path: 'variant_id',
      populate: {
        path: 'product_id',
        select: 'name brand category'
      }
    })
    .populate('changed_by', 'username')
    .sort({ changed_at: -1 })
    .lean();

  return priceChanges.map((change) => {
    const oldCost = Number(change.old_cost || 0);
    const newCost = Number(change.new_cost || 0);
    const delta = newCost - oldCost;
    const percentChange = oldCost > 0 ? (delta / oldCost) * 100 : null;
    const direction = delta >= 0 ? 'increased' : 'decreased';
    const productName = change.variant_id?.product_id?.name || 'Unknown product';
    const size = change.variant_id?.size || '';
    const supplierName = change.supplier_id?.name || 'Unknown supplier';
    const formattedDelta = `${delta >= 0 ? '+' : '-'}KES ${Math.abs(delta).toLocaleString()}`;
    const percentLabel = percentChange === null ? '' : ` (${percentChange >= 0 ? '+' : ''}${percentChange.toFixed(1)}%)`;

    return {
      source_key: `price-change:${change._id}`,
      type: 'supplier',
      severity: delta > 0 ? 'warning' : 'info',
      title: `Supplier cost ${direction}`,
      message: `${productName} ${size} from ${supplierName} changed from KES ${oldCost.toLocaleString()} to KES ${newCost.toLocaleString()} (${formattedDelta}${percentLabel}).`,
      metadata: {
        price_history_id: change._id,
        supplier_id: change.supplier_id?._id || null,
        supplier_name: supplierName,
        variant_id: change.variant_id?._id || null,
        product_id: change.variant_id?.product_id?._id || null,
        product_name: productName,
        size,
        old_cost: oldCost,
        new_cost: newCost,
        cost_change: delta,
        cost_change_pct: percentChange,
        changed_at: change.changed_at,
        changed_by: change.changed_by ? {
          _id: change.changed_by._id,
          username: change.changed_by.username
        } : null
      }
    };
  });
};

const syncGeneratedConcerns = async () => {
  const concerns = [
    ...await buildLowStockConcerns(),
    ...await buildOverduePayableConcerns(),
    ...await buildAverageCostChangeConcerns(),
    ...await buildPriceChangeConcerns()
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

    const shouldReopen = existing.generated && isPersistentGeneratedConcern(concern.source_key);
    const wasResolved = existing.status !== 'open';

    if (existing.status === 'open' || shouldReopen) {
      existing.type = concern.type;
      existing.severity = concern.severity;
      existing.title = concern.title;
      existing.message = concern.message;
      existing.metadata = concern.metadata;
      if (shouldReopen) {
        existing.status = 'open';
        existing.addressed_by = null;
        existing.addressed_at = null;
        existing.resolution_note = '';
        if (wasResolved) {
          existing.read_by = null;
          existing.read_at = null;
        }
      }
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

    if (req.query.unread === 'true') {
      filters.read_at = null;
    }

    const pagination = getPagination(req.query, 25, 100);
    let notificationsQuery = Notification.find(filters)
      .populate('addressed_by', 'username')
      .populate('read_by', 'username')
      .sort({ status: 1, severity: 1, updatedAt: -1 });

    const total = pagination.enabled ? await Notification.countDocuments(filters) : null;
    if (pagination.enabled) {
      notificationsQuery = notificationsQuery.skip(pagination.skip).limit(pagination.limit);
    }

    const notifications = await notificationsQuery.lean();

    res.json({
      success: true,
      count: pagination.enabled ? total : notifications.length,
      data: notifications,
      ...(pagination.enabled ? { pagination: buildPaginationMeta({ ...pagination, total }) } : {})
    });
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
    notification.read_by = req.user._id || req.user.id;
    notification.read_at = new Date();
    notification.resolution_note = req.body.resolution_note || 'Addressed by admin.';
    await notification.save();

    const populatedNotification = await Notification.findById(notification._id)
      .populate('addressed_by', 'username')
      .populate('read_by', 'username')
      .lean();

    res.json({ success: true, data: populatedNotification });
  } catch (error) {
    logger.error('Address notification error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const addressAllNotifications = async (req, res) => {
  try {
    await syncGeneratedConcerns();

    const result = await Notification.updateMany(
      { status: 'open' },
      {
        $set: {
          read_by: req.user._id || req.user.id,
          read_at: new Date(),
          resolution_note: req.body.resolution_note || 'Marked as read by admin.'
        }
      }
    );

    res.json({
      success: true,
      modified_count: result.modifiedCount || 0
    });
  } catch (error) {
    logger.error('Address all notifications error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
