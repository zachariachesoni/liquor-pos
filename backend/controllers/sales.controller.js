import Sale from '../models/Sale.js';
import SaleItem from '../models/SaleItem.js';
import ProductVariant from '../models/ProductVariant.js';
import logger from '../utils/logger.js';
import { generateInvoiceNumber } from '../utils/helpers.js';
import { mongoose } from '../config/database.js';

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
      variant.current_stock -= quantity;
      await variant.save({ session });
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
    }], { session });

    // Link sale id to sale items
    const saleItemsToCreate = saleItemsData.map(si => ({ ...si, sale_id: sale[0]._id }));
    await SaleItem.create(saleItemsToCreate, { session });

    await session.commitTransaction();
    res.status(201).json({ success: true, data: sale[0] });

  } catch (error) {
    await session.abortTransaction();
    if (error.message.includes('Transaction') || error.message.includes('transaction')) {
      logger.warn('Transactions not supported. Falling back to non-transactional sale.');
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
          variant.current_stock -= quantity;
          await variant.save();
        }

        const appliedAmountPaid = normalizedFallbackAmountPaid > 0 ? normalizedFallbackAmountPaid : totalAmount;
        if (appliedAmountPaid < totalAmount) {
          return res.status(400).json({ success: false, message: 'Amount paid cannot be less than the sale total' });
        }

        const sale = await Sale.create({
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

        const saleItemsToCreate = saleItemsData.map(si => ({ ...si, sale_id: sale._id }));
        await SaleItem.create(saleItemsToCreate);
        return res.status(201).json({ success: true, data: sale });
      } catch (fallbackErr) {
        logger.error('Fallback sale creation failed:', fallbackErr);
        return res.status(500).json({ success: false, message: 'Fallback failed.' });
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
    const filters = {};
    if (req.query.start_date) filters.createdAt = { $gte: new Date(req.query.start_date) };
    if (req.query.end_date) {
      filters.createdAt = filters.createdAt || {};
      filters.createdAt.$lte = new Date(req.query.end_date);
    }
    const sales = await Sale.find(filters).populate('user_id', 'username').sort({ createdAt: -1 });
    res.json({ success: true, count: sales.length, data: sales });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get single sale details
// @route   GET /api/sales/:id
export const getSaleDetails = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id)
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
