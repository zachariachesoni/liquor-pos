import ProductVariant from '../models/ProductVariant.js';
import StockAdjustment from '../models/StockAdjustment.js';
import logger from '../utils/logger.js';
import { mongoose } from '../config/database.js';

// @desc    Get stock levels
// @route   GET /api/inventory/stock-levels
export const getStockLevels = async (req, res) => {
  try {
    const variants = await ProductVariant.find().populate('product_id', 'name category');
    res.json({ success: true, count: variants.length, data: variants });
  } catch (error) {
    logger.error('Get stock levels error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get low stock items
// @route   GET /api/inventory/low-stock
export const getLowStock = async (req, res) => {
  try {
    const lowStock = await ProductVariant.find({
      current_stock: { $lte: 3 }
    }).populate('product_id', 'name');
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
    
    for (const item of items) {
      await ProductVariant.findByIdAndUpdate(item.variantId, {
        $inc: { current_stock: item.quantity }
      }, { session });

      await StockAdjustment.create([{
        variant_id: item.variantId,
        adjustment_type: 'in',
        quantity: item.quantity,
        reason: 'restocking',
        notes: notes || `From supplier: ${supplier}`,
        user_id: req.user._id || req.user.id
      }], { session });
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
        await ProductVariant.findByIdAndUpdate(item.variantId, { $inc: { current_stock: item.quantity } });
        await StockAdjustment.create({
          variant_id: item.variantId,
          adjustment_type: 'in',
          quantity: item.quantity,
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
    
    const qtyChange = type === 'in' ? quantity : -quantity;
    
    await ProductVariant.findByIdAndUpdate(variantId, {
      $inc: { current_stock: qtyChange }
    }, { session });

    await StockAdjustment.create([{
      variant_id: variantId,
      adjustment_type: type,
      quantity: Math.abs(quantity),
      reason,
      notes,
      user_id: req.user._id || req.user.id
    }], { session });

    await session.commitTransaction();
    res.json({ success: true, message: 'Stock adjusted successfully' });
  } catch (error) {
    await session.abortTransaction();
    if (error.message.includes('Transaction') || error.message.includes('transaction')) {
      const { variantId, quantity, type, reason, notes } = req.body;
      const qtyChange = type === 'in' ? quantity : -quantity;
      await ProductVariant.findByIdAndUpdate(variantId, { $inc: { current_stock: qtyChange } });
      await StockAdjustment.create({
        variant_id: variantId,
        adjustment_type: type,
        quantity: Math.abs(quantity),
        reason,
        notes,
        user_id: req.user._id || req.user.id
      });
      return res.json({ success: true, message: 'Stock adjusted via fallback' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    session.endSession();
  }
};
