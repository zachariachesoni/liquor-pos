import Customer from '../models/Customer.js';
import Sale from '../models/Sale.js';
import SaleItem from '../models/SaleItem.js';
import logger from '../utils/logger.js';

// @desc    Get all customers
// @route   GET /api/customers
export const getCustomers = async (req, res) => {
  try {
    const filters = {};
    if (req.query.q) {
      filters.$or = [
        { name: { $regex: req.query.q, $options: 'i' } },
        { phone: { $regex: req.query.q, $options: 'i' } },
        { email: { $regex: req.query.q, $options: 'i' } }
      ];
    }
    const customers = await Customer.find(filters).sort({ createdAt: -1 }).lean();
    const customerIds = customers.map((customer) => customer._id);

    const purchaseStats = await Sale.aggregate([
      { $match: { customer_id: { $in: customerIds } } },
      {
        $group: {
          _id: '$customer_id',
          totalPurchases: { $sum: 1 },
          totalSpent: { $sum: '$total_amount' },
          lastPurchaseAt: { $max: '$createdAt' }
        }
      }
    ]);

    const statsMap = new Map(purchaseStats.map((entry) => [String(entry._id), entry]));
    const enrichedCustomers = customers.map((customer) => {
      const stats = statsMap.get(String(customer._id));

      return {
        ...customer,
        totalPurchases: stats?.totalPurchases || 0,
        totalSpent: stats?.totalSpent || 0,
        lastPurchaseAt: stats?.lastPurchaseAt || null,
      };
    });

    res.json({ success: true, count: enrichedCustomers.length, data: enrichedCustomers });
  } catch (error) {
    logger.error('Get customers error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get single customer
// @route   GET /api/customers/:id
export const getCustomer = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
    res.json({ success: true, data: customer });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Create customer
// @route   POST /api/customers
export const createCustomer = async (req, res) => {
  try {
    const customer = await Customer.create({
      ...req.body,
      loyaltyPoints: req.body.loyalty_points || 0
    });
    res.status(201).json({ success: true, data: customer });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Customer phone or email already exists' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update customer
// @route   PUT /api/customers/:id
export const updateCustomer = async (req, res) => {
  try {
    const customer = await Customer.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
    res.json({ success: true, data: customer });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Delete customer
// @route   DELETE /api/customers/:id
export const deleteCustomer = async (req, res) => {
  try {
    const customer = await Customer.findByIdAndDelete(req.params.id);
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
    res.json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get customer purchase history
// @route   GET /api/customers/:id/purchase-history
export const getCustomerPurchaseHistory = async (req, res) => {
  try {
    const query = req.query.q?.trim().toLowerCase();
    const history = await Sale.find({ customer_id: req.params.id })
      .populate('user_id', 'username')
      .sort({ createdAt: -1 });

    const historyWithItems = await Promise.all(
      history.map(async (sale) => {
        const items = await SaleItem.find({ sale_id: sale._id })
          .populate({
            path: 'variant_id',
            populate: {
              path: 'product_id',
              select: 'name category'
            }
          });

        const formattedItems = items.map((item) => ({
          id: item._id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: item.subtotal,
          wholesale_applied: item.wholesale_applied,
          productName: item.variant_id?.product_id?.name || 'Unknown Product',
          category: item.variant_id?.product_id?.category || 'other',
          size: item.variant_id?.size || '',
        }));

        return {
          ...sale.toObject(),
          items: formattedItems,
        };
      })
    );

    const filteredHistory = query
      ? historyWithItems.filter((sale) => {
          const itemMatch = (sale.items || []).some((item) =>
            [item.productName, item.category, item.size]
              .filter(Boolean)
              .some((value) => value.toLowerCase().includes(query))
          );

          return (
            sale.invoice_number?.toLowerCase().includes(query) ||
            sale.payment_method?.toLowerCase().includes(query) ||
            itemMatch
          );
        })
      : historyWithItems;

    res.json({ success: true, count: filteredHistory.length, data: filteredHistory });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
