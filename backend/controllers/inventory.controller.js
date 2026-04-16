import ProductVariant from '../models/ProductVariant.js';
import StockAdjustment from '../models/StockAdjustment.js';
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
