import { mongoose } from '../config/database.js';
import Supplier from '../models/Supplier.js';
import SupplierProduct from '../models/SupplierProduct.js';
import SupplierProductPriceHistory from '../models/SupplierProductPriceHistory.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import PurchaseOrderItem from '../models/PurchaseOrderItem.js';
import SupplierPayment from '../models/SupplierPayment.js';
import ProductVariant from '../models/ProductVariant.js';
import logger from '../utils/logger.js';
import { getPaymentTermsLabel, getDaysPastDue } from '../utils/purchasing.js';
import { syncSupplierProductPricing } from '../utils/supplierProducts.js';

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeSupplierPayload = (payload = {}, options = {}) => ({
  name: payload.name,
  contact_name: payload.contact_name || payload.contactName || '',
  phone: payload.phone || '',
  email: payload.email || '',
  address: payload.address || '',
  payment_terms_days: Number(payload.payment_terms_days ?? payload.paymentTermsDays ?? 0),
  credit_limit: Number(payload.credit_limit ?? payload.creditLimit ?? 0),
  account_number: payload.account_number || payload.accountNumber || '',
  notes: payload.notes || '',
  active: payload.active !== undefined ? Boolean(payload.active) : (options.defaultActive ?? true)
});

const createSupplierMetricsMap = (supplierIds = [], purchaseOrders = [], linkedCounts = []) => {
  const metricsMap = new Map(
    supplierIds.map((supplierId) => [String(supplierId), {
      linked_products: 0,
      total_orders: 0,
      total_purchase_volume: 0,
      total_paid: 0,
      total_owed: 0,
      overdue_balance: 0,
      overdue_count: 0,
      last_ordered_at: null
    }])
  );

  linkedCounts.forEach((entry) => {
    const metric = metricsMap.get(String(entry._id));
    if (metric) {
      metric.linked_products = entry.count;
    }
  });

  purchaseOrders.forEach((purchaseOrder) => {
    const metric = metricsMap.get(String(purchaseOrder.supplier_id));
    if (!metric) {
      return;
    }

    metric.total_orders += 1;

    if (['received', 'partially_received'].includes(purchaseOrder.status)) {
      metric.total_purchase_volume += Number(purchaseOrder.total_amount || 0);
      metric.total_paid += Number(purchaseOrder.amount_paid || 0);
      metric.total_owed += Number(purchaseOrder.balance_outstanding || 0);

      if (Number(purchaseOrder.balance_outstanding || 0) > 0 && purchaseOrder.payment_due_date) {
        const daysPastDue = getDaysPastDue(purchaseOrder.payment_due_date);
        if (daysPastDue > 0) {
          metric.overdue_balance += Number(purchaseOrder.balance_outstanding || 0);
          metric.overdue_count += 1;
        }
      }
    }

    if (!metric.last_ordered_at || new Date(purchaseOrder.ordered_at) > new Date(metric.last_ordered_at)) {
      metric.last_ordered_at = purchaseOrder.ordered_at;
    }
  });

  return metricsMap;
};

const enrichSupplierRecord = (supplier, metrics = {}) => ({
  ...supplier,
  payment_terms_label: getPaymentTermsLabel(supplier.payment_terms_days),
  stats: {
    linked_products: metrics.linked_products || 0,
    total_orders: metrics.total_orders || 0,
    total_purchase_volume: metrics.total_purchase_volume || 0,
    total_paid: metrics.total_paid || 0,
    total_owed: metrics.total_owed || 0,
    overdue_balance: metrics.overdue_balance || 0,
    overdue_count: metrics.overdue_count || 0,
    last_ordered_at: metrics.last_ordered_at || null
  }
});

const attachPurchaseOrderItems = (purchaseOrders = [], purchaseOrderItems = []) => {
  const itemsByPurchaseOrder = purchaseOrderItems.reduce((map, item) => {
    const key = String(item.po_id);
    if (!map.has(key)) {
      map.set(key, []);
    }

    map.get(key).push({
      ...item,
      variant: item.variant_id ? {
        _id: item.variant_id._id,
        size: item.variant_id.size,
        current_stock: item.variant_id.current_stock,
        retail_price: item.variant_id.retail_price,
        wholesale_price: item.variant_id.wholesale_price,
        buying_price: item.variant_id.buying_price,
        product: item.variant_id.product_id ? {
          _id: item.variant_id.product_id._id,
          name: item.variant_id.product_id.name,
          brand: item.variant_id.product_id.brand,
          category: item.variant_id.product_id.category
        } : null
      } : null
    });

    return map;
  }, new Map());

  return purchaseOrders.map((purchaseOrder) => ({
    ...purchaseOrder,
    items: itemsByPurchaseOrder.get(String(purchaseOrder._id)) || []
  }));
};

const sortSuppliers = (suppliers = [], sort = 'name_asc') => {
  const rows = [...suppliers];

  rows.sort((left, right) => {
    switch (sort) {
      case 'name_desc':
        return right.name.localeCompare(left.name);
      case 'owed_desc':
        return (right.stats?.total_owed || 0) - (left.stats?.total_owed || 0);
      case 'owed_asc':
        return (left.stats?.total_owed || 0) - (right.stats?.total_owed || 0);
      case 'recent_activity':
        return new Date(right.stats?.last_ordered_at || 0) - new Date(left.stats?.last_ordered_at || 0);
      case 'name_asc':
      default:
        return left.name.localeCompare(right.name);
    }
  });

  return rows;
};

// @desc    Get supplier list with payables summary
// @route   GET /api/suppliers
export const getSuppliers = async (req, res) => {
  try {
    const filters = {};
    const query = req.query.q?.trim();
    const status = req.query.status || 'all';

    if (query) {
      const pattern = escapeRegex(query);
      filters.$or = [
        { name: { $regex: pattern, $options: 'i' } },
        { contact_name: { $regex: pattern, $options: 'i' } },
        { phone: { $regex: pattern, $options: 'i' } },
        { email: { $regex: pattern, $options: 'i' } }
      ];
    }

    if (status === 'active') {
      filters.active = true;
    } else if (status === 'inactive') {
      filters.active = false;
    }

    const suppliers = await Supplier.find(filters).sort({ name: 1 }).lean();
    const supplierIds = suppliers.map((supplier) => supplier._id);

    const [linkedCounts, purchaseOrders] = supplierIds.length ? await Promise.all([
      SupplierProduct.aggregate([
        { $match: { supplier_id: { $in: supplierIds } } },
        { $group: { _id: '$supplier_id', count: { $sum: 1 } } }
      ]),
      PurchaseOrder.find({ supplier_id: { $in: supplierIds } }, 'supplier_id status total_amount amount_paid balance_outstanding payment_due_date ordered_at').lean()
    ]) : [[], []];

    const metricsMap = createSupplierMetricsMap(supplierIds, purchaseOrders, linkedCounts);
    const data = sortSuppliers(
      suppliers.map((supplier) => enrichSupplierRecord(supplier, metricsMap.get(String(supplier._id)))),
      req.query.sort || 'name_asc'
    );

    res.json({ success: true, count: data.length, data });
  } catch (error) {
    logger.error('Get suppliers error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get supplier detail
// @route   GET /api/suppliers/:id
export const getSupplier = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid supplier id' });
    }

    const supplier = await Supplier.findById(req.params.id).lean();
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    const [linkedProducts, purchaseOrdersRaw, payments, priceHistory, linkedCounts] = await Promise.all([
      SupplierProduct.find({ supplier_id: supplier._id })
        .populate({
          path: 'variant_id',
          populate: {
            path: 'product_id',
            select: 'name brand category'
          }
        })
        .sort({ is_preferred: -1, updatedAt: -1 })
        .lean(),
      PurchaseOrder.find({ supplier_id: supplier._id })
        .populate('created_by', 'username')
        .sort({ ordered_at: -1 })
        .lean(),
      SupplierPayment.find({ supplier_id: supplier._id })
        .populate('po_id', 'po_number invoice_reference payment_due_date')
        .populate('recorded_by', 'username')
        .sort({ paid_at: -1 })
        .lean(),
      SupplierProductPriceHistory.find({ supplier_id: supplier._id })
        .sort({ changed_at: -1 })
        .limit(200)
        .lean(),
      SupplierProduct.aggregate([
        { $match: { supplier_id: supplier._id } },
        { $group: { _id: '$supplier_id', count: { $sum: 1 } } }
      ])
    ]);

    const purchaseOrderIds = purchaseOrdersRaw.map((purchaseOrder) => purchaseOrder._id);
    const purchaseOrderItems = purchaseOrderIds.length
      ? await PurchaseOrderItem.find({ po_id: { $in: purchaseOrderIds } })
          .populate({
            path: 'variant_id',
            populate: {
              path: 'product_id',
              select: 'name brand category'
            }
          })
          .lean()
      : [];

    const purchaseOrders = attachPurchaseOrderItems(purchaseOrdersRaw, purchaseOrderItems);
    const metricsMap = createSupplierMetricsMap([supplier._id], purchaseOrdersRaw, linkedCounts);

    const priceHistoryByVariant = priceHistory.reduce((map, entry) => {
      const key = String(entry.variant_id);
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key).push(entry);
      return map;
    }, new Map());

    const linkedProductsData = linkedProducts.map((link) => ({
      ...link,
      price_history: priceHistoryByVariant.get(String(link.variant_id?._id || link.variant_id)) || [],
      variant: link.variant_id ? {
        _id: link.variant_id._id,
        size: link.variant_id.size,
        current_stock: link.variant_id.current_stock,
        retail_price: link.variant_id.retail_price,
        wholesale_price: link.variant_id.wholesale_price,
        buying_price: link.variant_id.buying_price,
        min_stock_level: link.variant_id.min_stock_level,
        product: link.variant_id.product_id ? {
          _id: link.variant_id.product_id._id,
          name: link.variant_id.product_id.name,
          brand: link.variant_id.product_id.brand,
          category: link.variant_id.product_id.category
        } : null
      } : null
    }));

    res.json({
      success: true,
      data: {
        supplier: enrichSupplierRecord(supplier, metricsMap.get(String(supplier._id))),
        linked_products: linkedProductsData,
        purchase_orders: purchaseOrders,
        payments,
        summary: metricsMap.get(String(supplier._id))
      }
    });
  } catch (error) {
    logger.error('Get supplier detail error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Create supplier
// @route   POST /api/suppliers
export const createSupplier = async (req, res) => {
  try {
    const payload = normalizeSupplierPayload(req.body);
    if (!payload.name?.trim()) {
      return res.status(400).json({ success: false, message: 'Supplier name is required' });
    }

    const supplier = await Supplier.create(payload);
    res.status(201).json({ success: true, data: enrichSupplierRecord(supplier.toObject()) });
  } catch (error) {
    logger.error('Create supplier error:', error);
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Supplier name already exists' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update supplier
// @route   PUT /api/suppliers/:id
export const updateSupplier = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid supplier id' });
    }

    const existingSupplier = await Supplier.findById(req.params.id);
    if (!existingSupplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    const payload = normalizeSupplierPayload(req.body, { defaultActive: existingSupplier.active });
    if (!payload.name?.trim()) {
      return res.status(400).json({ success: false, message: 'Supplier name is required' });
    }

    const supplier = await Supplier.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true
    });

    res.json({ success: true, data: enrichSupplierRecord(supplier.toObject()) });
  } catch (error) {
    logger.error('Update supplier error:', error);
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Supplier name already exists' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Delete supplier
// @route   DELETE /api/suppliers/:id
export const deleteSupplier = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid supplier id' });
    }

    const [purchaseOrdersCount, linksCount] = await Promise.all([
      PurchaseOrder.countDocuments({ supplier_id: req.params.id }),
      SupplierProduct.countDocuments({ supplier_id: req.params.id })
    ]);

    if (purchaseOrdersCount > 0 || linksCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Supplier has linked products or purchase history. Mark it inactive instead of deleting it.'
      });
    }

    const supplier = await Supplier.findByIdAndDelete(req.params.id);
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    res.json({ success: true, data: {} });
  } catch (error) {
    logger.error('Delete supplier error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Create or update supplier product link
// @route   POST /api/suppliers/:id/links
export const upsertSupplierProductLink = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid supplier id' });
    }

    const variantId = req.body.variant_id || req.body.variantId;
    if (!isValidObjectId(variantId)) {
      return res.status(400).json({ success: false, message: 'A valid inventory variant is required' });
    }

    const [supplier, variant] = await Promise.all([
      Supplier.findById(req.params.id),
      ProductVariant.findById(variantId)
    ]);

    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    if (!variant) {
      return res.status(404).json({ success: false, message: 'Inventory variant not found' });
    }

    const link = await syncSupplierProductPricing({
      supplierId: supplier._id,
      variantId: variant._id,
      unitCost: req.body.unit_cost ?? req.body.unitCost,
      minOrderQty: req.body.min_order_qty ?? req.body.minOrderQty,
      leadTimeDays: req.body.lead_time_days ?? req.body.leadTimeDays,
      isPreferred: req.body.is_preferred ?? req.body.isPreferred,
      userId: req.user._id || req.user.id
    });

    const populatedLink = await SupplierProduct.findById(link._id)
      .populate({
        path: 'variant_id',
        populate: {
          path: 'product_id',
          select: 'name brand category'
        }
      })
      .lean();

    res.status(201).json({ success: true, data: populatedLink });
  } catch (error) {
    logger.error('Upsert supplier product link error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Delete supplier product link
// @route   DELETE /api/suppliers/links/:linkId
export const deleteSupplierProductLink = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.linkId)) {
      return res.status(400).json({ success: false, message: 'Invalid supplier product link id' });
    }

    const link = await SupplierProduct.findById(req.params.linkId);
    if (!link) {
      return res.status(404).json({ success: false, message: 'Supplier product link not found' });
    }

    const variantId = link.variant_id;
    const wasPreferred = link.is_preferred;
    await link.deleteOne();

    if (wasPreferred) {
      const nextPreferred = await SupplierProduct.findOne({ variant_id: variantId }).sort({ unit_cost: 1, updatedAt: -1 });
      if (nextPreferred) {
        nextPreferred.is_preferred = true;
        await nextPreferred.save();
      }
    }

    res.json({ success: true, data: {} });
  } catch (error) {
    logger.error('Delete supplier product link error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get supplier comparison for a variant
// @route   GET /api/suppliers/price-comparison/:variantId
export const getSupplierPriceComparison = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.variantId)) {
      return res.status(400).json({ success: false, message: 'Invalid variant id' });
    }

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const [variant, links, priceHistory] = await Promise.all([
      ProductVariant.findById(req.params.variantId).populate('product_id', 'name brand category').lean(),
      SupplierProduct.find({ variant_id: req.params.variantId })
        .populate('supplier_id', 'name contact_name phone payment_terms_days active')
        .sort({ unit_cost: 1, is_preferred: -1 })
        .lean(),
      SupplierProductPriceHistory.find({
        variant_id: req.params.variantId,
        changed_at: { $gte: sixMonthsAgo }
      }).sort({ changed_at: -1 }).lean()
    ]);

    if (!variant) {
      return res.status(404).json({ success: false, message: 'Inventory variant not found' });
    }

    const cheapestCost = links.reduce((lowest, link) => {
      const currentCost = Number(link.unit_cost || 0);
      return lowest === null || currentCost < lowest ? currentCost : lowest;
    }, null);

    const historyBySupplier = priceHistory.reduce((map, entry) => {
      const key = String(entry.supplier_id);
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key).push(entry);
      return map;
    }, new Map());

    const data = links.map((link) => ({
      ...link,
      supplier: link.supplier_id ? {
        _id: link.supplier_id._id,
        name: link.supplier_id.name,
        contact_name: link.supplier_id.contact_name,
        phone: link.supplier_id.phone,
        active: link.supplier_id.active,
        payment_terms_days: link.supplier_id.payment_terms_days,
        payment_terms_label: getPaymentTermsLabel(link.supplier_id.payment_terms_days)
      } : null,
      is_cheapest: cheapestCost !== null && Number(link.unit_cost || 0) === cheapestCost,
      trend: historyBySupplier.get(String(link.supplier_id?._id || link.supplier_id)) || []
    }));

    res.json({
      success: true,
      data: {
        variant: {
          _id: variant._id,
          size: variant.size,
          buying_price: variant.buying_price,
          retail_price: variant.retail_price,
          wholesale_price: variant.wholesale_price,
          product: variant.product_id ? {
            _id: variant.product_id._id,
            name: variant.product_id.name,
            brand: variant.product_id.brand,
            category: variant.product_id.category
          } : null
        },
        suppliers: data
      }
    });
  } catch (error) {
    logger.error('Get supplier price comparison error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
