import Sale from '../models/Sale.js';
import SaleItem from '../models/SaleItem.js';
import ProductVariant from '../models/ProductVariant.js';
import StockAdjustment from '../models/StockAdjustment.js';
import logger from '../utils/logger.js';
import { generateInvoiceNumber } from '../utils/helpers.js';
import { mongoose } from '../config/database.js';

const getSalesAccessFilter = (req) => (
  req.user?.role === 'cashier'
    ? { user_id: req.user._id || req.user.id }
    : {}
);

// @desc    Process a sale (checkout)
// @route   POST /api/sales
export const createSale = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const { items, customerId, paymentMethod, amountPaid, priceList } = req.body;
    const normalizedAmountPaid = Number(amountPaid ?? 0);
    const allowedPaymentMethods = ['cash', 'mpesa', 'bank', 'split'];
    let totalAmount = 0;

    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('At least one sale item is required');
    }

    if (!allowedPaymentMethods.includes(paymentMethod || 'cash')) {
      throw new Error('Invalid payment method');
    }

    // We calculate real total dynamically based on explicit priceList or threshold
    const saleItemsData = [];
    for (const item of items) {
      const quantity = Number(item.quantity);
      if (!item.variantId || !Number.isFinite(quantity) || quantity <= 0) {
        throw new Error('Each sale item must include a valid variant and quantity');
      }

      const variant = await ProductVariant.findById(item.variantId).session(session);
      if (!variant || variant.current_stock < quantity) {
        throw new Error(`Insufficient stock for ${variant ? variant._id : 'Unknown item'}`);
      }
      
      // Determine if wholesale manually selected via priceList OR threshold reached
      const appliesWholesale = priceList === 'wholesale' || quantity >= variant.wholesale_threshold;
      const unitPrice = appliesWholesale ? variant.wholesale_price : variant.retail_price;
      const subtotal = unitPrice * quantity;
      totalAmount += subtotal;
      
      // Calculate profit margin at time of sale
      const itemProfitMargin = subtotal - (variant.buying_price * quantity);

      saleItemsData.push({
        variant_id: variant._id,
        quantity,
        unit_price: unitPrice,
        wholesale_applied: appliesWholesale,
        buying_price: variant.buying_price,
        profit_margin: itemProfitMargin,
        subtotal
      });

      // Deduct stock
      const stockBefore = Number(variant.current_stock || 0);
      variant.current_stock -= quantity;
      await variant.save({ session });

      await StockAdjustment.create([{
        variant_id: variant._id,
        adjustment_type: 'out',
        quantity,
        unit_cost: Number(variant.buying_price || 0),
        stock_before: stockBefore,
        stock_after: Number(variant.current_stock || 0),
        reason: 'sale',
        notes: 'Stock deducted during checkout',
        user_id: req.user._id || req.user.id
      }], { session, ordered: true });
    }

    const appliedAmountPaid = normalizedAmountPaid > 0 ? normalizedAmountPaid : totalAmount;
    if (appliedAmountPaid < totalAmount) {
      throw new Error('Amount paid cannot be less than the sale total');
    }

    const changeDue = appliedAmountPaid - totalAmount;

    const sale = await Sale.create([{
      invoice_number: generateInvoiceNumber(),
      customer_id: customerId || null,
      total_amount: totalAmount,
      subtotal: totalAmount, // Assuming no tax/discount applied for now
      payment_method: paymentMethod || 'cash',
      amount_paid: appliedAmountPaid,
      change_due: changeDue,
      sale_type: priceList || 'retail',
      user_id: req.user._id || req.user.id
    }], { session, ordered: true });

    // Link sale id to sale items
    const saleItemsToCreate = saleItemsData.map(si => ({ ...si, sale_id: sale[0]._id }));
    await SaleItem.create(saleItemsToCreate, { session, ordered: true });

    await session.commitTransaction();
    res.status(201).json({ success: true, data: sale[0] });

  } catch (error) {
    await session.abortTransaction();
    if (error.message.includes('Transaction') || error.message.includes('transaction')) {
      logger.warn('Transactions not supported. Falling back to non-transactional sale.');
      let variantSnapshots = [];
      let createdSale = null;
      let saleItemsCreated = false;
      const createdStockAdjustmentIds = [];

      try {
        const { items, customerId, paymentMethod, amountPaid, priceList } = req.body;
        const normalizedFallbackAmountPaid = Number(amountPaid ?? 0);
        let totalAmount = 0;
        const saleItemsData = [];
        
        for (const item of items) {
          const quantity = Number(item.quantity);
          if (!item.variantId || !Number.isFinite(quantity) || quantity <= 0) {
            return res.status(400).json({ success: false, message: 'Each sale item must include a valid variant and quantity' });
          }

          const variant = await ProductVariant.findById(item.variantId);
          if (!variant || variant.current_stock < quantity) {
             return res.status(400).json({ success: false, message: `Insufficient stock` });
          }

          variantSnapshots.push({
            id: variant._id,
            quantity,
            originalStock: variant.current_stock,
            unitCost: Number(variant.buying_price || 0)
          });

          const appliesWholesale = priceList === 'wholesale' || quantity >= variant.wholesale_threshold;
          const unitPrice = appliesWholesale ? variant.wholesale_price : variant.retail_price;
          const subtotal = unitPrice * quantity;
          totalAmount += subtotal;
          
          const itemProfitMargin = subtotal - (variant.buying_price * quantity);

          saleItemsData.push({ 
            variant_id: variant._id, 
            quantity, 
            unit_price: unitPrice, 
            wholesale_applied: appliesWholesale,
            buying_price: variant.buying_price,
            profit_margin: itemProfitMargin,
            subtotal 
          });
        }

        const appliedAmountPaid = normalizedFallbackAmountPaid > 0 ? normalizedFallbackAmountPaid : totalAmount;
        if (appliedAmountPaid < totalAmount) {
          return res.status(400).json({ success: false, message: 'Amount paid cannot be less than the sale total' });
        }

        createdSale = await Sale.create({
          invoice_number: generateInvoiceNumber(), 
          customer_id: customerId || null,
          total_amount: totalAmount, 
          subtotal: totalAmount,
          payment_method: paymentMethod || 'cash',
          amount_paid: appliedAmountPaid,
          change_due: appliedAmountPaid - totalAmount,
          sale_type: priceList || 'retail',
          user_id: req.user._id || req.user.id
        });

        const saleItemsToCreate = saleItemsData.map(si => ({ ...si, sale_id: createdSale._id }));
        await SaleItem.create(saleItemsToCreate);
        saleItemsCreated = true;

        for (const snapshot of variantSnapshots) {
          const updatedVariant = await ProductVariant.findOneAndUpdate(
            { _id: snapshot.id, current_stock: { $gte: snapshot.quantity } },
            { $inc: { current_stock: -snapshot.quantity } },
            { new: true }
          );

          if (!updatedVariant) {
            throw new Error('Stock changed before fallback checkout could finish');
          }

          const adjustment = await StockAdjustment.create({
            variant_id: snapshot.id,
            adjustment_type: 'out',
            quantity: snapshot.quantity,
            unit_cost: snapshot.unitCost,
            stock_before: snapshot.originalStock,
            stock_after: updatedVariant.current_stock,
            reason: 'sale',
            notes: 'Stock deducted during checkout',
            user_id: req.user._id || req.user.id
          });
          createdStockAdjustmentIds.push(adjustment._id);
        }

        return res.status(201).json({ success: true, data: createdSale });
      } catch (fallbackErr) {
        logger.error('Fallback sale creation failed:', fallbackErr);

        try {
          if (saleItemsCreated && createdSale?._id) {
            await SaleItem.deleteMany({ sale_id: createdSale._id });
          }

          if (createdSale?._id) {
            await Sale.findByIdAndDelete(createdSale._id);
          }

          if (createdStockAdjustmentIds.length) {
            await StockAdjustment.deleteMany({ _id: { $in: createdStockAdjustmentIds } });
          }

          for (const snapshot of variantSnapshots) {
            await ProductVariant.findByIdAndUpdate(snapshot.id, {
              $max: { current_stock: snapshot.originalStock }
            });
          }
        } catch (rollbackError) {
          logger.error('Fallback rollback failed:', rollbackError);
        }

        const message = fallbackErr.message === 'Stock changed before fallback checkout could finish'
          ? 'Stock changed during checkout. Please review the cart and try again.'
          : 'Fallback failed.';
        return res.status(500).json({ success: false, message });
      }
    }
    res.status(400).json({ success: false, message: error.message || 'Server error' });
  } finally {
    session.endSession();
  }
};

// @desc    Get all sales
// @route   GET /api/sales
export const getSales = async (req, res) => {
  try {
    const filters = { ...getSalesAccessFilter(req) };
    if (req.query.q) {
      filters.invoice_number = { $regex: req.query.q.trim(), $options: 'i' };
    }
    if (req.query.start_date) filters.createdAt = { $gte: new Date(req.query.start_date) };
    if (req.query.end_date) {
      filters.createdAt = filters.createdAt || {};
      filters.createdAt.$lte = new Date(req.query.end_date);
    }
    const sales = await Sale.find(filters).populate('user_id', 'username').sort({ createdAt: -1 }).lean();
    const saleIds = sales.map((sale) => sale._id);
    const saleItemSummaries = saleIds.length
      ? await SaleItem.aggregate([
          { $match: { sale_id: { $in: saleIds } } },
          {
            $group: {
              _id: '$sale_id',
              item_count: { $sum: '$quantity' },
              line_count: { $sum: 1 },
              cogs: { $sum: { $multiply: ['$buying_price', '$quantity'] } },
              profit: { $sum: '$profit_margin' }
            }
          }
        ])
      : [];

    const summariesBySale = new Map(saleItemSummaries.map((summary) => [String(summary._id), summary]));
    const enrichedSales = sales.map((sale) => {
      const summary = summariesBySale.get(String(sale._id)) || {};
      return {
        ...sale,
        item_count: Number(summary.item_count || 0),
        line_count: Number(summary.line_count || 0),
        cogs: Number(summary.cogs || 0),
        profit: Number(summary.profit || 0)
      };
    });

    res.json({ success: true, count: enrichedSales.length, data: enrichedSales });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get today's sales
// @route   GET /api/sales/today
export const getTodaySales = async (req, res) => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  req.query = {
    ...req.query,
    start_date: startOfToday.toISOString(),
    end_date: startOfTomorrow.toISOString()
  };

  return getSales(req, res);
};

// @desc    Get single sale details
// @route   GET /api/sales/:id
export const getSaleDetails = async (req, res) => {
  try {
    const sale = await Sale.findOne({
      _id: req.params.id,
      ...getSalesAccessFilter(req)
    })
      .populate('user_id', 'username')
      .populate('customer_id', 'name phone email');
    if (!sale) return res.status(404).json({ success: false, message: 'Sale not found' });
    const items = await SaleItem.find({ sale_id: sale._id }).populate({
      path: 'variant_id',
      populate: {
        path: 'product_id',
        select: 'name category brand'
      }
    });

    const formattedItems = items.map((item) => ({
      ...item.toObject(),
      productName: item.variant_id?.product_id?.name || 'Unknown Product',
      productCategory: item.variant_id?.product_id?.category || 'other',
      productBrand: item.variant_id?.product_id?.brand || '',
      variantSize: item.variant_id?.size || '',
    }));

    res.json({ success: true, data: { ...sale.toObject(), items: formattedItems } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
