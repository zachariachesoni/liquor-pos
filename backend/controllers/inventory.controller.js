import ProductVariant from '../models/ProductVariant.js';
import StockAdjustment from '../models/StockAdjustment.js';
import SupplierProduct from '../models/SupplierProduct.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import PurchaseOrderItem from '../models/PurchaseOrderItem.js';
import logger from '../utils/logger.js';
import { mongoose } from '../config/database.js';
import { calculateEffectiveLowStockLevel, getSystemSettings, serializeSystemSettings } from '../utils/systemSettings.js';

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

// @desc    Stock In (Restock)
// @route   POST /api/inventory/stock-in
export const addStock = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const { items, supplier, notes } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one stock item is required' });
    }
    
    for (const item of items) {
      const quantity = Number(item.quantity);
      if (!item.variantId || !Number.isFinite(quantity) || quantity <= 0) {
        return res.status(400).json({ success: false, message: 'Each stock item must include a valid variant and quantity' });
      }

      await ProductVariant.findByIdAndUpdate(item.variantId, {
        $inc: { current_stock: quantity }
      }, { session });

      await StockAdjustment.create([{
        variant_id: item.variantId,
        adjustment_type: 'in',
        quantity,
        reason: 'restocking',
        notes: notes || `From supplier: ${supplier}`,
        user_id: req.user._id || req.user.id
      }], { session, ordered: true });
    }

    await session.commitTransaction();
    res.json({ success: true, message: 'Stock updated successfully' });
  } catch (error) {
    await session.abortTransaction();
    logger.error('Stock in error:', error);
    if (error.message.includes('Transaction') || error.message.includes('transaction')) {
      // Fallback for standalone mongo
      const { items, supplier, notes } = req.body;
      for (const item of items) {
        const quantity = Number(item.quantity);
        if (!item.variantId || !Number.isFinite(quantity) || quantity <= 0) {
          return res.status(400).json({ success: false, message: 'Each stock item must include a valid variant and quantity' });
        }

        await ProductVariant.findByIdAndUpdate(item.variantId, { $inc: { current_stock: quantity } });
        await StockAdjustment.create({
          variant_id: item.variantId,
          adjustment_type: 'in',
          quantity,
          reason: 'restocking',
          notes: notes || `From supplier: ${supplier}`,
          user_id: req.user._id || req.user.id
        });
      }
      return res.json({ success: true, message: 'Stock updated via fallback' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    session.endSession();
  }
};

// @desc    Stock Adjustment
// @route   POST /api/inventory/adjustments
export const adjustStock = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const { variantId, quantity, type, reason, notes } = req.body; // type: 'in' or 'out'
    const normalizedQuantity = Number(quantity);

    if (!variantId || !Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
      return res.status(400).json({ success: false, message: 'A valid inventory item and quantity are required' });
    }

    if (!['in', 'out'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Adjustment type must be either "in" or "out"' });
    }
    
    const variant = await ProductVariant.findById(variantId).session(session);
    if (!variant) {
      return res.status(404).json({ success: false, message: 'Inventory item not found' });
    }

    if (type === 'out' && variant.current_stock < normalizedQuantity) {
      return res.status(400).json({ success: false, message: 'Cannot remove more stock than is currently available' });
    }

    const qtyChange = type === 'in' ? normalizedQuantity : -normalizedQuantity;
    
    variant.current_stock += qtyChange;
    await variant.save({ session });

    await StockAdjustment.create([{
      variant_id: variantId,
      adjustment_type: type,
      quantity: normalizedQuantity,
      reason,
      notes,
      user_id: req.user._id || req.user.id
    }], { session, ordered: true });

    await session.commitTransaction();
    res.json({ success: true, message: 'Stock adjusted successfully' });
  } catch (error) {
    await session.abortTransaction();
    if (error.message.includes('Transaction') || error.message.includes('transaction')) {
      const { variantId, quantity, type, reason, notes } = req.body;
      const normalizedQuantity = Number(quantity);
      const variant = await ProductVariant.findById(variantId);

      if (!variant) {
        return res.status(404).json({ success: false, message: 'Inventory item not found' });
      }

      if (type === 'out' && variant.current_stock < normalizedQuantity) {
        return res.status(400).json({ success: false, message: 'Cannot remove more stock than is currently available' });
      }

      variant.current_stock += type === 'in' ? normalizedQuantity : -normalizedQuantity;
      await variant.save();
      await StockAdjustment.create({
        variant_id: variantId,
        adjustment_type: type,
        quantity: normalizedQuantity,
        reason,
        notes,
        user_id: req.user._id || req.user.id
      });
      return res.json({ success: true, message: 'Stock adjusted via fallback' });
    }
    logger.error('Stock adjustment error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    session.endSession();
  }
};
