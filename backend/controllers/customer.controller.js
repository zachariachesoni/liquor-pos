import Customer from '../models/Customer.js';
import Sale from '../models/Sale.js';
import SaleItem from '../models/SaleItem.js';
import logger from '../utils/logger.js';
import { buildPaginationMeta, getPagination } from '../utils/pagination.js';
import { attachBusinessId, getBusinessId, scopeToBusiness } from '../utils/tenant.js';

const cleanText = (value = '') => (typeof value === 'string' ? value.trim() : value);

const buildCustomerPayload = (body = {}, { partial = false } = {}) => ({
  name: cleanText(body.name),
  phone: cleanText(body.phone) || undefined,
  email: cleanText(body.email) || undefined,
  customer_type: body.customer_type || (partial ? undefined : 'retail'),
  address: cleanText(body.address),
  notes: cleanText(body.notes),
  is_active: body.is_active !== undefined ? body.is_active : (partial ? undefined : true)
});

const stripUndefinedFields = (payload) => Object.fromEntries(
  Object.entries(payload).filter(([, value]) => value !== undefined)
);

const assertNoDuplicateCustomer = async ({ businessId, phone, email, excludeId = null }) => {
  const duplicateFilters = [];
  if (phone) duplicateFilters.push({ phone, is_active: { $ne: false } });
  if (email) duplicateFilters.push({ email, is_active: { $ne: false } });

  if (!duplicateFilters.length) {
    return;
  }

  const query = { business_id: businessId, $or: duplicateFilters };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  const duplicate = await Customer.findOne(query).lean();
  if (duplicate) {
    const error = new Error('A customer with that phone or email already exists');
    error.statusCode = 409;
    throw error;
  }
};

// @desc    Get all customers
// @route   GET /api/customers
export const getCustomers = async (req, res) => {
  try {
    const filters = scopeToBusiness(req, req.query.include_inactive === 'true' ? {} : { is_active: { $ne: false } });
    if (req.query.q) {
      filters.$or = [
        { name: { $regex: req.query.q, $options: 'i' } },
        { phone: { $regex: req.query.q, $options: 'i' } },
        { email: { $regex: req.query.q, $options: 'i' } }
      ];
    }
    const pagination = getPagination(req.query, 25, 100);
    let customerQuery = Customer.find(filters).sort({ createdAt: -1 });
    const total = pagination.enabled ? await Customer.countDocuments(filters) : null;

    if (pagination.enabled) {
      customerQuery = customerQuery.skip(pagination.skip).limit(pagination.limit);
    }

    const customers = await customerQuery.lean();
    const customerIds = customers.map((customer) => customer._id);

    const purchaseStats = await Sale.aggregate([
      { $match: scopeToBusiness(req, { customer_id: { $in: customerIds } }) },
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

    res.json({
      success: true,
      count: pagination.enabled ? total : enrichedCustomers.length,
      data: enrichedCustomers,
      ...(pagination.enabled ? { pagination: buildPaginationMeta({ ...pagination, total }) } : {})
    });
  } catch (error) {
    logger.error('Get customers error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get single customer
// @route   GET /api/customers/:id
export const getCustomer = async (req, res) => {
  try {
    const customer = await Customer.findOne(scopeToBusiness(req, { _id: req.params.id }));
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
    const payload = stripUndefinedFields(buildCustomerPayload(req.body, { partial: true }));
    await assertNoDuplicateCustomer({ ...payload, businessId: getBusinessId(req) });
    const customer = await Customer.create(attachBusinessId(req, payload));
    res.status(201).json({ success: true, data: customer });
  } catch (error) {
    if (error.statusCode || error.code === 11000) {
      return res.status(error.statusCode || 409).json({ success: false, message: error.message || 'Customer phone or email already exists' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update customer
// @route   PUT /api/customers/:id
export const updateCustomer = async (req, res) => {
  try {
    const payload = stripUndefinedFields(buildCustomerPayload(req.body, { partial: true }));
    await assertNoDuplicateCustomer({ ...payload, businessId: getBusinessId(req), excludeId: req.params.id });
    const customer = await Customer.findOneAndUpdate(scopeToBusiness(req, { _id: req.params.id }), payload, { new: true, runValidators: true });
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
    const customer = await Customer.findOneAndUpdate(scopeToBusiness(req, { _id: req.params.id }), { is_active: false }, { new: true });
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
    const pagination = getPagination(req.query, 25, 100);
    let historyQuery = Sale.find(scopeToBusiness(req, { customer_id: req.params.id }))
      .populate('user_id', 'username')
      .sort({ createdAt: -1 });

    const total = pagination.enabled ? await Sale.countDocuments(scopeToBusiness(req, { customer_id: req.params.id })) : null;
    if (pagination.enabled && !query) {
      historyQuery = historyQuery.skip(pagination.skip).limit(pagination.limit);
    }

    const history = await historyQuery;

    const historyWithItems = await Promise.all(
      history.map(async (sale) => {
        const items = await SaleItem.find(scopeToBusiness(req, { sale_id: sale._id }))
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

    const paginatedFilteredHistory = pagination.enabled && query
      ? filteredHistory.slice(pagination.skip, pagination.skip + pagination.limit)
      : filteredHistory;

    res.json({
      success: true,
      count: pagination.enabled ? (query ? filteredHistory.length : total) : filteredHistory.length,
      data: paginatedFilteredHistory,
      ...(pagination.enabled ? {
        pagination: buildPaginationMeta({
          ...pagination,
          total: query ? filteredHistory.length : total
        })
      } : {})
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
