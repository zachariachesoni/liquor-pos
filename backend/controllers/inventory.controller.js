import ProductVariant from '../models/ProductVariant.js';
import StockAdjustment from '../models/StockAdjustment.js';
import SupplierProduct from '../models/SupplierProduct.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import PurchaseOrderItem from '../models/PurchaseOrderItem.js';
import logger from '../utils/logger.js';
import { mongoose } from '../config/database.js';
import { calculateWeightedAverageCost } from '../utils/inventoryCost.js';
import { calculateEffectiveLowStockLevel, getSystemSettings, serializeSystemSettings } from '../utils/systemSettings.js';

const createInventoryError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const isTransactionError = (error) => error.message?.toLowerCase().includes('transaction');

const getRequestUserId = (req) => req.user?._id || req.user?.id;

const normalizePositiveQuantity = (quantity, message = 'A valid inventory item and quantity are required') => {
  const normalizedQuantity = Number(quantity);
  if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
    throw createInventoryError(message);
  }

  return normalizedQuantity;
};

const normalizeOptionalUnitCost = (unitCost) => {
  if (unitCost === undefined || unitCost === '') {
    return null;
  }

  const normalizedUnitCost = Number(unitCost);
  if (!Number.isFinite(normalizedUnitCost) || normalizedUnitCost < 0) {
    throw createInventoryError('Unit cost must be zero or a positive number');
  }

  return normalizedUnitCost;
};

const sendInventoryError = (res, error, logLabel) => {
  const statusCode = error.statusCode || 500;
  if (statusCode >= 500) {
    logger.error(logLabel, error);
  }

  return res.status(statusCode).json({
    success: false,
    message: statusCode >= 500 ? 'Server error' : error.message
  });
};

const applyStockChange = async ({
  variantId,
  quantity,
  type,
  reason,
  notes,
  unitCost,
  userId,
  session = null
}) => {
  const normalizedQuantity = normalizePositiveQuantity(quantity);

  if (!variantId) {
    throw createInventoryError('A valid inventory item and quantity are required');
  }

  if (!['in', 'out'].includes(type)) {
    throw createInventoryError('Adjustment type must be either "in" or "out"');
  }

  const normalizedUnitCost = normalizeOptionalUnitCost(unitCost);
  const query = ProductVariant.findById(variantId);
  const variant = session ? await query.session(session) : await query;

  if (!variant) {
    throw createInventoryError('Inventory item not found', 404);
  }

  if (type === 'out' && variant.current_stock < normalizedQuantity) {
    throw createInventoryError('Cannot remove more stock than is currently available');
  }

  const stockBefore = Number(variant.current_stock || 0);
  const qtyChange = type === 'in' ? normalizedQuantity : -normalizedQuantity;
  const appliedUnitCost = type === 'in'
    ? (normalizedUnitCost ?? Number(variant.buying_price || 0))
    : Number(variant.buying_price || 0);

  if (type === 'in') {
    variant.buying_price = calculateWeightedAverageCost(stockBefore, variant.buying_price, normalizedQuantity, appliedUnitCost);
  }

  variant.current_stock = stockBefore + qtyChange;
  await variant.save(session ? { session } : undefined);

  const stockAdjustment = {
    variant_id: variantId,
    adjustment_type: type,
    quantity: normalizedQuantity,
    unit_cost: appliedUnitCost,
    stock_before: stockBefore,
    stock_after: variant.current_stock,
    reason,
    notes,
    user_id: userId
  };

  if (session) {
    await StockAdjustment.create([stockAdjustment], { session, ordered: true });
  } else {
    await StockAdjustment.create(stockAdjustment);
  }

  return { variant, stockAdjustment };
};

// @desc    Get stock levels
// @route   GET /api/inventory/stock-levels
export const getStockLevels = async (req, res) => {
  try {
    const settingsDoc = await getSystemSettings();
    const settings = serializeSystemSettings(settingsDoc);
    const variants = await ProductVariant.find().populate('product_id', 'name category');

    const enrichedVariants = variants.map((variant) => {
      const doc = variant.toObject();
      const effectiveLowStockLevel = calculateEffectiveLowStockLevel(doc, settings);

      return {
        ...doc,
        effective_low_stock_level: effectiveLowStockLevel,
        is_low_stock: doc.current_stock <= effectiveLowStockLevel,
      };
    });

    res.json({ success: true, count: enrichedVariants.length, data: enrichedVariants, meta: { settings } });
  } catch (error) {
    logger.error('Get stock levels error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get low stock items
// @route   GET /api/inventory/low-stock
export const getLowStock = async (req, res) => {
  try {
    const settingsDoc = await getSystemSettings();
    const settings = serializeSystemSettings(settingsDoc);
    const variants = await ProductVariant.find().populate('product_id', 'name');
    const lowStock = variants
      .map((variant) => {
        const doc = variant.toObject();
        return {
          ...doc,
          effective_low_stock_level: calculateEffectiveLowStockLevel(doc, settings),
        };
      })
      .filter((variant) => variant.current_stock <= variant.effective_low_stock_level);

    res.json({ success: true, count: lowStock.length, data: lowStock });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get reorder suggestions
// @route   GET /api/inventory/reorder-suggestions
export const getReorderSuggestions = async (req, res) => {
  try {
    const settingsDoc = await getSystemSettings();
    const settings = serializeSystemSettings(settingsDoc);
    const variants = await ProductVariant.find().populate('product_id', 'name brand category');

    const lowStockVariants = variants
      .map((variant) => {
        const doc = variant.toObject();
        const effectiveLowStockLevel = calculateEffectiveLowStockLevel(doc, settings);
        return {
          ...doc,
          effective_low_stock_level: effectiveLowStockLevel
        };
      })
      .filter((variant) => variant.current_stock <= variant.effective_low_stock_level);

    const variantIds = lowStockVariants.map((variant) => variant._id);
    const [supplierLinks, purchaseOrderItems, openPurchaseOrders] = variantIds.length ? await Promise.all([
      SupplierProduct.find({
        variant_id: { $in: variantIds }
      }).populate('supplier_id', 'name phone payment_terms_days active').lean(),
      PurchaseOrderItem.aggregate([
        { $match: { variant_id: { $in: variantIds.map((variantId) => new mongoose.Types.ObjectId(variantId)) } } },
        {
          $lookup: {
            from: 'purchaseorders',
            localField: 'po_id',
            foreignField: '_id',
            as: 'purchase_order'
          }
        },
        { $unwind: '$purchase_order' },
        { $sort: { 'purchase_order.received_at': -1, createdAt: -1 } },
        {
          $group: {
            _id: '$variant_id',
            last_order_qty: { $first: '$qty_ordered' },
            last_unit_cost: { $first: '$unit_cost' },
            last_received_qty: { $first: '$qty_received' },
            last_po_number: { $first: '$purchase_order.po_number' }
          }
        }
      ]),
      PurchaseOrder.find({
        status: { $in: ['draft', 'ordered', 'partially_received'] }
      }, '_id po_number status').lean()
    ]) : [[], [], []];

    const openPurchaseOrderIds = openPurchaseOrders.map((purchaseOrder) => purchaseOrder._id);
    const openPurchaseOrderItems = openPurchaseOrderIds.length
      ? await PurchaseOrderItem.find({ po_id: { $in: openPurchaseOrderIds }, variant_id: { $in: variantIds } }, 'po_id variant_id qty_ordered qty_received').lean()
      : [];

    const preferredSupplierByVariant = supplierLinks.reduce((map, link) => {
      const key = String(link.variant_id);
      const current = map.get(key);
      if (!current || link.is_preferred) {
        map.set(key, link);
      }
      return map;
    }, new Map());

    const purchaseHistoryByVariant = purchaseOrderItems.reduce((map, item) => {
      map.set(String(item._id), item);
      return map;
    }, new Map());

    const openPurchaseOrdersByVariant = openPurchaseOrderItems.reduce((map, item) => {
      const key = String(item.variant_id);
      if (!map.has(key)) {
        map.set(key, []);
      }

      const purchaseOrder = openPurchaseOrders.find((entry) => String(entry._id) === String(item.po_id));
      map.get(key).push({
        po_id: item.po_id,
        po_number: purchaseOrder?.po_number || 'Open PO',
        status: purchaseOrder?.status || 'ordered',
        qty_ordered: item.qty_ordered,
        qty_received: item.qty_received,
        qty_remaining: Math.max(0, Number(item.qty_ordered || 0) - Number(item.qty_received || 0))
      });
      return map;
    }, new Map());

    const data = lowStockVariants.map((variant) => {
      const preferredSupplier = preferredSupplierByVariant.get(String(variant._id)) || null;
      const purchaseHistory = purchaseHistoryByVariant.get(String(variant._id)) || null;
      const suggestedQty = Math.max(
        Number(preferredSupplier?.min_order_qty || 1),
        Math.max(1, (variant.effective_low_stock_level * 2) - Number(variant.current_stock || 0))
      );

      return {
        variant_id: variant._id,
        product_id: variant.product_id?._id || null,
        product_name: variant.product_id?.name || 'Unknown product',
        product_brand: variant.product_id?.brand || '',
        category: variant.product_id?.category || 'other',
        size: variant.size,
        current_stock: variant.current_stock,
        effective_low_stock_level: variant.effective_low_stock_level,
        suggested_qty: suggestedQty,
        preferred_supplier: preferredSupplier ? {
          _id: preferredSupplier.supplier_id?._id || null,
          name: preferredSupplier.supplier_id?.name || 'Unassigned supplier',
          phone: preferredSupplier.supplier_id?.phone || '',
          payment_terms_days: preferredSupplier.supplier_id?.payment_terms_days || 0,
          unit_cost: preferredSupplier.unit_cost,
          min_order_qty: preferredSupplier.min_order_qty,
          lead_time_days: preferredSupplier.lead_time_days
        } : null,
        last_purchase: purchaseHistory ? {
          last_order_qty: purchaseHistory.last_order_qty,
          last_received_qty: purchaseHistory.last_received_qty,
          last_unit_cost: purchaseHistory.last_unit_cost,
          last_po_number: purchaseHistory.last_po_number
        } : null,
        open_purchase_orders: openPurchaseOrdersByVariant.get(String(variant._id)) || []
      };
    }).sort((left, right) => left.current_stock - right.current_stock);

    res.json({ success: true, count: data.length, data });
  } catch (error) {
    logger.error('Get reorder suggestions error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get stock history
// @route   GET /api/inventory/history
export const getHistory = async (req, res) => {
  try {
    const history = await StockAdjustment.find().sort({ createdAt: -1 }).populate('variant_id');
    res.json({ success: true, count: history.length, data: history });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const runStockWrite = async ({ action, successMessage, fallbackMessage, logLabel, res }) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    await action(session);
    await session.commitTransaction();
    return res.json({ success: true, message: successMessage });
  } catch (error) {
    try {
      await session.abortTransaction();
    } catch (abortError) {
      logger.warn(`${logLabel} abort warning:`, abortError);
    }

    if (isTransactionError(error)) {
      logger.warn(`${logLabel} transaction fallback:`, error);
      try {
        await action(null);
        return res.json({ success: true, message: fallbackMessage });
      } catch (fallbackError) {
        return sendInventoryError(res, fallbackError, logLabel);
      }
    }

    return sendInventoryError(res, error, logLabel);
  } finally {
    session.endSession();
  }
};

const processStockIn = async (req, session = null) => {
  const { items, supplier, notes } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    throw createInventoryError('At least one stock item is required');
  }

  for (const item of items) {
    const variantId = item.variantId || item.variant_id;
    const quantity = normalizePositiveQuantity(
      item.quantity,
      'Each stock item must include a valid variant and quantity'
    );

    if (!variantId) {
      throw createInventoryError('Each stock item must include a valid variant and quantity');
    }

    await applyStockChange({
      variantId,
      quantity,
      type: 'in',
      reason: 'restocking',
      notes: item.notes || notes || (supplier ? `From supplier: ${supplier}` : 'Manual stock-in'),
      unitCost: item.unit_cost !== undefined ? item.unit_cost : item.unitCost,
      userId: getRequestUserId(req),
      session
    });
  }
};

const processManualAdjustment = async (req, session = null) => {
  const {
    variantId,
    variant_id: variantIdSnake,
    quantity,
    type,
    reason,
    notes,
    unitCost,
    unit_cost: unitCostSnake
  } = req.body;

  await applyStockChange({
    variantId: variantId || variantIdSnake,
    quantity,
    type,
    reason,
    notes,
    unitCost: unitCost !== undefined ? unitCost : unitCostSnake,
    userId: getRequestUserId(req),
    session
  });
};

// @desc    Stock In (Restock)
// @route   POST /api/inventory/stock-in
export const addStock = async (req, res) => runStockWrite({
  action: (session) => processStockIn(req, session),
  successMessage: 'Stock updated successfully',
  fallbackMessage: 'Stock updated via fallback',
  logLabel: 'Stock in error:',
  res
});

// @desc    Stock Adjustment
// @route   POST /api/inventory/adjustments
export const adjustStock = async (req, res) => runStockWrite({
  action: (session) => processManualAdjustment(req, session),
  successMessage: 'Stock adjusted successfully',
  fallbackMessage: 'Stock adjusted via fallback',
  logLabel: 'Stock adjustment error:',
  res
});
