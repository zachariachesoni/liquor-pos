import mongoose from 'mongoose';
import SaleItem from '../models/SaleItem.js';
import Sale from '../models/Sale.js';
import Expense from '../models/Expense.js';
import Supplier from '../models/Supplier.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import PurchaseOrderItem from '../models/PurchaseOrderItem.js';
import SupplierPayment from '../models/SupplierPayment.js';
import ProductVariant from '../models/ProductVariant.js';
import SupplierProductPriceHistory from '../models/SupplierProductPriceHistory.js';
import StockAdjustment from '../models/StockAdjustment.js';
import { getSystemSettings, serializeSystemSettings } from '../utils/systemSettings.js';
import { getDaysPastDue, getPaymentTermsLabel } from '../utils/purchasing.js';

const buildDateFilters = (start_date, end_date) => {
  const saleItemMatch = {};
  const saleMatch = {};
  const expenseMatch = {};

  if (start_date || end_date) {
    saleItemMatch.createdAt = {};
    saleMatch.createdAt = {};
    expenseMatch.expense_date = {};

    if (start_date) {
      const start = new Date(start_date);
      saleItemMatch.createdAt.$gte = start;
      saleMatch.createdAt.$gte = start;
      expenseMatch.expense_date.$gte = start;
    }

    if (end_date) {
      const end = new Date(end_date);
      saleItemMatch.createdAt.$lte = end;
      saleMatch.createdAt.$lte = end;
      expenseMatch.expense_date.$lte = end;
    }
  }

  return { saleItemMatch, saleMatch, expenseMatch };
};

const getDateRange = (startDate, endDate) => {
  const range = {};

  if (startDate) {
    range.start = new Date(startDate);
  }

  if (endDate) {
    range.end = new Date(endDate);
  }

  return range;
};

const isWithinDateRange = (value, range = {}) => {
  if (!range.start && !range.end) {
    return true;
  }

  if (!value) {
    return false;
  }

  const date = new Date(value);
  if (range.start && date < range.start) {
    return false;
  }

  if (range.end && date > range.end) {
    return false;
  }

  return true;
};

const getClosedDateRange = (startDate, endDate) => {
  const end = endDate ? new Date(endDate) : new Date();
  const start = startDate ? new Date(startDate) : new Date(end);

  if (!startDate) {
    start.setDate(start.getDate() - 29);
  }

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

const getPreviousDateRange = (range) => {
  const duration = range.end.getTime() - range.start.getTime();
  const previousEnd = new Date(range.start.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - duration);
  return { start: previousStart, end: previousEnd };
};

const getProductSnapshot = (variant) => ({
  variant_id: variant?._id || null,
  product_name: variant?.product_id?.name || 'Unknown item',
  brand: variant?.product_id?.brand || '',
  category: variant?.product_id?.category || 'other',
  size: variant?.size || '',
  current_stock: Number(variant?.current_stock || 0),
  buying_price: Number(variant?.buying_price || 0),
  retail_price: Number(variant?.retail_price || 0),
  wholesale_price: Number(variant?.wholesale_price || 0)
});

const attachPurchaseOrderItems = (purchaseOrders = [], purchaseOrderItems = []) => {
  const itemsByPurchaseOrder = purchaseOrderItems.reduce((map, item) => {
    const key = String(item.po_id?._id || item.po_id);
    if (!map.has(key)) {
      map.set(key, []);
    }

    map.get(key).push({
      _id: item._id,
      qty_ordered: item.qty_ordered,
      qty_received: item.qty_received,
      unit_cost: item.unit_cost,
      line_total: item.line_total,
      variant: item.variant_id ? {
        _id: item.variant_id._id,
        size: item.variant_id.size,
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

// @desc    Get P&L Report
// @route   GET /api/reports/pnl
export const getPnLReport = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const { saleItemMatch, expenseMatch } = buildDateFilters(start_date, end_date);

    // 1. Calculate Gross Revenue, COGS, and Gross Profit from SaleItems
    const salesReport = await SaleItem.aggregate([
      { $match: saleItemMatch },
      {
        $group: {
          _id: null,
          grossRevenue: { $sum: '$subtotal' },
          cogs: { $sum: { $multiply: ['$buying_price', '$quantity'] } },
          grossProfit: { $sum: '$profit_margin' }
        }
      }
    ]);

    const stats = salesReport[0] || { grossRevenue: 0, cogs: 0, grossProfit: 0 };

    // 2. Calculate Total Expenses
    const expenseReport = await Expense.aggregate([
      { $match: Object.keys(expenseMatch).length ? expenseMatch : {} },
      {
        $group: {
          _id: null,
          totalExpenses: { $sum: '$amount' }
        }
      }
    ]);

    const totalExpenses = expenseReport[0]?.totalExpenses || 0;
    const expenses = await Expense.find(Object.keys(expenseMatch).length ? expenseMatch : {})
      .populate('user_id', 'username')
      .sort({ expense_date: -1 })
      .lean();

    // 3. Net Profit
    const netProfit = stats.grossProfit - totalExpenses;

    res.json({
      success: true,
      data: {
        gross_revenue: stats.grossRevenue,
        cogs: stats.cogs,
        gross_profit: stats.grossProfit,
        total_expenses: totalExpenses,
        net_profit: netProfit,
        expenses: expenses.map((expense) => ({
          ...expense,
          expenseDate: expense.expense_date,
          recordedBy: expense.user_id
        }))
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get customer sales report
// @route   GET /api/reports/customer-sales
export const getCustomerSalesReport = async (req, res) => {
  try {
    const { customer_id, start_date, end_date } = req.query;

    if (!customer_id || !mongoose.Types.ObjectId.isValid(customer_id)) {
      return res.status(400).json({ success: false, message: 'Valid customer_id is required' });
    }

    const { saleMatch } = buildDateFilters(start_date, end_date);
    saleMatch.customer_id = new mongoose.Types.ObjectId(customer_id);

    const sales = await Sale.find(saleMatch)
      .populate('customer_id', 'name phone email customer_type')
      .populate('user_id', 'username')
      .sort({ createdAt: -1 })
      .lean();

    const saleIds = sales.map((sale) => sale._id);

    const saleItems = saleIds.length
      ? await SaleItem.find({ sale_id: { $in: saleIds } })
          .populate({
            path: 'variant_id',
            populate: {
              path: 'product_id',
              select: 'name category brand'
            }
          })
          .lean()
      : [];

    const itemsBySaleId = saleItems.reduce((map, item) => {
      const key = String(item.sale_id);
      if (!map.has(key)) {
        map.set(key, []);
      }

      map.get(key).push({
        id: item._id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
        wholesale_applied: item.wholesale_applied,
        productName: item.variant_id?.product_id?.name || 'Unknown Product',
        category: item.variant_id?.product_id?.category || 'other',
        brand: item.variant_id?.product_id?.brand || '',
        size: item.variant_id?.size || '',
        profit: item.profit_margin || 0
      });

      return map;
    }, new Map());

    const enrichedSales = sales.map((sale) => ({
      ...sale,
      items: itemsBySaleId.get(String(sale._id)) || []
    }));

    const summary = enrichedSales.reduce((acc, sale) => {
      const saleProfit = (sale.items || []).reduce((sum, item) => sum + (item.profit || 0), 0);

      acc.totalSales += 1;
      acc.totalRevenue += sale.total_amount || 0;
      acc.totalItems += (sale.items || []).reduce((sum, item) => sum + (item.quantity || 0), 0);
      acc.totalProfit += saleProfit;

      return acc;
    }, {
      totalSales: 0,
      totalRevenue: 0,
      totalItems: 0,
      totalProfit: 0
    });

    const customer = sales[0]?.customer_id || null;

    res.json({
      success: true,
      data: {
        customer,
        summary: {
          total_sales: summary.totalSales,
          total_revenue: summary.totalRevenue,
          total_items: summary.totalItems,
          total_profit: summary.totalProfit
        },
        sales: enrichedSales
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get product sales report
// @route   GET /api/reports/product-sales
export const getProductSalesReport = async (req, res) => {
  try {
    const { product_id, variant_id, start_date, end_date } = req.query;

    if (!product_id || !mongoose.Types.ObjectId.isValid(product_id)) {
      return res.status(400).json({ success: false, message: 'Valid product_id is required' });
    }

    const { saleItemMatch } = buildDateFilters(start_date, end_date);

    const pipeline = [
      { $match: saleItemMatch },
      {
        $lookup: {
          from: 'productvariants',
          localField: 'variant_id',
          foreignField: '_id',
          as: 'variant'
        }
      },
      { $unwind: '$variant' },
      {
        $match: {
          'variant.product_id': new mongoose.Types.ObjectId(product_id),
          ...(variant_id && mongoose.Types.ObjectId.isValid(variant_id)
            ? { 'variant._id': new mongoose.Types.ObjectId(variant_id) }
            : {})
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: 'variant.product_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $lookup: {
          from: 'sales',
          localField: 'sale_id',
          foreignField: '_id',
          as: 'sale'
        }
      },
      { $unwind: '$sale' },
      {
        $lookup: {
          from: 'customers',
          localField: 'sale.customer_id',
          foreignField: '_id',
          as: 'customer'
        }
      },
      {
        $addFields: {
          customer: { $arrayElemAt: ['$customer', 0] }
        }
      },
      {
        $project: {
          _id: 1,
          quantity: 1,
          unit_price: 1,
          subtotal: 1,
          buying_price: 1,
          profit_margin: 1,
          wholesale_applied: 1,
          createdAt: 1,
          sale: {
            _id: '$sale._id',
            invoice_number: '$sale.invoice_number',
            payment_method: '$sale.payment_method',
            sale_type: '$sale.sale_type',
            createdAt: '$sale.createdAt'
          },
          customer: {
            _id: '$customer._id',
            name: '$customer.name',
            phone: '$customer.phone'
          },
          variant: {
            _id: '$variant._id',
            size: '$variant.size',
            current_stock: '$variant.current_stock'
          },
          product: {
            _id: '$product._id',
            name: '$product.name',
            brand: '$product.brand',
            category: '$product.category'
          }
        }
      },
      { $sort: { 'sale.createdAt': -1 } }
    ];

    const sales = await SaleItem.aggregate(pipeline);

    const summary = sales.reduce((acc, item) => {
      acc.totalQuantity += item.quantity || 0;
      acc.totalRevenue += item.subtotal || 0;
      acc.totalProfit += item.profit_margin || 0;
      acc.totalTransactions += 1;

      const key = item.variant?._id ? String(item.variant._id) : item.variant?.size;
      const variantSummary = acc.variantsMap.get(key) || {
        variant_id: item.variant?._id || null,
        size: item.variant?.size || 'Unknown',
        quantity_sold: 0,
        revenue: 0,
        profit: 0
      };

      variantSummary.quantity_sold += item.quantity || 0;
      variantSummary.revenue += item.subtotal || 0;
      variantSummary.profit += item.profit_margin || 0;
      acc.variantsMap.set(key, variantSummary);

      return acc;
    }, {
      totalQuantity: 0,
      totalRevenue: 0,
      totalProfit: 0,
      totalTransactions: 0,
      variantsMap: new Map()
    });

    res.json({
      success: true,
      data: {
        product: sales[0]?.product || null,
        summary: {
          total_quantity: summary.totalQuantity,
          total_revenue: summary.totalRevenue,
          total_profit: summary.totalProfit,
          total_transactions: summary.totalTransactions,
          variants: Array.from(summary.variantsMap.values())
        },
        sales
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get supplier statement report
// @route   GET /api/reports/supplier-statement
export const getSupplierStatementReport = async (req, res) => {
  try {
    const { supplier_id, start_date, end_date } = req.query;

    if (!supplier_id || !mongoose.Types.ObjectId.isValid(supplier_id)) {
      return res.status(400).json({ success: false, message: 'Valid supplier_id is required' });
    }

    const supplier = await Supplier.findById(supplier_id).lean();
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    const range = getDateRange(start_date, end_date);

    const purchaseOrdersRaw = await PurchaseOrder.find({ supplier_id })
      .populate('created_by', 'username')
      .sort({ ordered_at: -1, createdAt: -1 })
      .lean();

    const filteredOrders = purchaseOrdersRaw.filter((purchaseOrder) =>
      isWithinDateRange(purchaseOrder.received_at || purchaseOrder.ordered_at || purchaseOrder.createdAt, range)
    );

    const purchaseOrderItems = filteredOrders.length
      ? await PurchaseOrderItem.find({ po_id: { $in: filteredOrders.map((purchaseOrder) => purchaseOrder._id) } })
          .populate({
            path: 'variant_id',
            populate: {
              path: 'product_id',
              select: 'name brand category'
            }
          })
          .lean()
      : [];

    const payments = await SupplierPayment.find({ supplier_id })
      .populate('recorded_by', 'username')
      .populate('po_id', 'po_number invoice_reference')
      .sort({ paid_at: -1 })
      .lean();

    const filteredPayments = payments.filter((payment) => isWithinDateRange(payment.paid_at || payment.createdAt, range));
    const purchaseOrders = attachPurchaseOrderItems(filteredOrders, purchaseOrderItems);

    const summary = purchaseOrders.reduce((acc, purchaseOrder) => {
      acc.purchase_volume += Number(purchaseOrder.total_amount || 0);
      acc.outstanding_balance += Number(purchaseOrder.balance_outstanding || 0);
      acc.order_count += 1;
      return acc;
    }, {
      purchase_volume: 0,
      outstanding_balance: 0,
      order_count: 0
    });

    const paymentsTotal = filteredPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

    res.json({
      success: true,
      data: {
        supplier: {
          ...supplier,
          payment_terms_label: getPaymentTermsLabel(supplier.payment_terms_days)
        },
        summary: {
          purchase_volume: summary.purchase_volume,
          payments_total: paymentsTotal,
          outstanding_balance: summary.outstanding_balance,
          order_count: summary.order_count
        },
        purchase_orders: purchaseOrders,
        payments: filteredPayments
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get accounts payable aging report
// @route   GET /api/reports/accounts-payable-aging
export const getAccountsPayableAgingReport = async (req, res) => {
  try {
    const referenceDate = req.query.end_date ? new Date(req.query.end_date) : new Date();
    referenceDate.setHours(0, 0, 0, 0);

    const purchaseOrders = await PurchaseOrder.find({
      status: { $in: ['received', 'partially_received'] },
      balance_outstanding: { $gt: 0 }
    })
      .populate('supplier_id', 'name contact_name phone payment_terms_days')
      .sort({ payment_due_date: 1, ordered_at: -1 })
      .lean();

    const rows = purchaseOrders
      .filter((purchaseOrder) => {
        if (!purchaseOrder.payment_due_date) {
          return true;
        }

        if (req.query.start_date) {
          return new Date(purchaseOrder.received_at || purchaseOrder.ordered_at || purchaseOrder.createdAt) >= new Date(req.query.start_date);
        }

        return true;
      })
      .map((purchaseOrder) => {
        const balance = Number(purchaseOrder.balance_outstanding || 0);
        const daysPastDue = balance > 0 ? getDaysPastDue(purchaseOrder.payment_due_date, referenceDate) : 0;

        let bucket = 'current';
        if (daysPastDue >= 1 && daysPastDue <= 7) bucket = '0_7';
        else if (daysPastDue <= 14) bucket = '8_14';
        else if (daysPastDue <= 30) bucket = '15_30';
        else if (daysPastDue > 30) bucket = '30_plus';

        return {
          ...purchaseOrder,
          supplier: purchaseOrder.supplier_id ? {
            _id: purchaseOrder.supplier_id._id,
            name: purchaseOrder.supplier_id.name,
            phone: purchaseOrder.supplier_id.phone,
            payment_terms_label: getPaymentTermsLabel(purchaseOrder.supplier_id.payment_terms_days)
          } : null,
          days_past_due: daysPastDue,
          bucket
        };
      });

    const summary = rows.reduce((acc, row) => {
      const amount = Number(row.balance_outstanding || 0);
      acc.total_owed += amount;

      if (row.bucket === 'current') acc.current += amount;
      if (row.bucket === '0_7') acc.due_0_7 += amount;
      if (row.bucket === '8_14') acc.due_8_14 += amount;
      if (row.bucket === '15_30') acc.due_15_30 += amount;
      if (row.bucket === '30_plus') acc.due_30_plus += amount;

      return acc;
    }, {
      total_owed: 0,
      current: 0,
      due_0_7: 0,
      due_8_14: 0,
      due_15_30: 0,
      due_30_plus: 0
    });

    res.json({ success: true, data: { summary, rows } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get purchase history by SKU report
// @route   GET /api/reports/purchase-history
export const getPurchaseHistoryReport = async (req, res) => {
  try {
    const { product_id, variant_id, start_date, end_date } = req.query;
    const variantFilter = {};

    if (variant_id) {
      if (!mongoose.Types.ObjectId.isValid(variant_id)) {
        return res.status(400).json({ success: false, message: 'Valid variant_id is required' });
      }
      variantFilter._id = variant_id;
    } else if (product_id) {
      if (!mongoose.Types.ObjectId.isValid(product_id)) {
        return res.status(400).json({ success: false, message: 'Valid product_id is required' });
      }
      variantFilter.product_id = product_id;
    } else {
      return res.status(400).json({ success: false, message: 'A product_id or variant_id is required' });
    }

    const variants = await ProductVariant.find(variantFilter).populate('product_id', 'name brand category').lean();
    const variantIds = variants.map((variant) => variant._id);

    const purchaseHistory = variantIds.length
      ? await PurchaseOrderItem.find({ variant_id: { $in: variantIds } })
          .populate('po_id')
          .populate({
            path: 'variant_id',
            populate: {
              path: 'product_id',
              select: 'name brand category'
            }
          })
          .lean()
      : [];

    const supplierIds = purchaseHistory.map((item) => item.po_id?.supplier_id).filter(Boolean);
    const suppliers = supplierIds.length
      ? await Supplier.find({ _id: { $in: supplierIds } }, 'name contact_name phone').lean()
      : [];
    const suppliersById = new Map(suppliers.map((supplier) => [String(supplier._id), supplier]));
    const range = getDateRange(start_date, end_date);

    const rows = purchaseHistory
      .filter((item) => isWithinDateRange(item.po_id?.received_at || item.po_id?.ordered_at || item.createdAt, range))
      .map((item) => ({
        _id: item._id,
        po_number: item.po_id?.po_number,
        ordered_at: item.po_id?.ordered_at,
        received_at: item.po_id?.received_at,
        invoice_reference: item.po_id?.invoice_reference,
        qty_ordered: item.qty_ordered,
        qty_received: item.qty_received,
        unit_cost: item.unit_cost,
        line_total: item.line_total,
        supplier: suppliersById.get(String(item.po_id?.supplier_id)) || null,
        variant: item.variant_id ? {
          _id: item.variant_id._id,
          size: item.variant_id.size,
          product: item.variant_id.product_id ? {
            _id: item.variant_id.product_id._id,
            name: item.variant_id.product_id.name,
            brand: item.variant_id.product_id.brand,
            category: item.variant_id.product_id.category
          } : null
        } : null
      }))
      .sort((left, right) => new Date(right.received_at || right.ordered_at || 0) - new Date(left.received_at || left.ordered_at || 0));

    const summary = rows.reduce((acc, row) => {
      acc.total_qty_ordered += Number(row.qty_ordered || 0);
      acc.total_qty_received += Number(row.qty_received || 0);
      acc.total_spend += Number(row.line_total || 0);
      if (row.supplier?._id) {
        acc.suppliers.add(String(row.supplier._id));
      }
      return acc;
    }, {
      total_qty_ordered: 0,
      total_qty_received: 0,
      total_spend: 0,
      suppliers: new Set()
    });

    res.json({
      success: true,
      data: {
        variants,
        summary: {
          total_qty_ordered: summary.total_qty_ordered,
          total_qty_received: summary.total_qty_received,
          total_spend: summary.total_spend,
          supplier_count: summary.suppliers.size
        },
        rows
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get margin erosion report
// @route   GET /api/reports/margin-erosion
export const getMarginErosionReport = async (req, res) => {
  try {
    const settingsDoc = await getSystemSettings();
    const settings = serializeSystemSettings(settingsDoc);
    const threshold = Number(req.query.threshold ?? settings.minimum_margin_threshold ?? 15);

    const [variants, priceHistory] = await Promise.all([
      ProductVariant.find().populate('product_id', 'name brand category').lean(),
      SupplierProductPriceHistory.find().sort({ changed_at: -1 }).lean()
    ]);

    const latestHistoryByVariant = priceHistory.reduce((map, entry) => {
      const key = String(entry.variant_id);
      if (!map.has(key)) {
        map.set(key, entry);
      }
      return map;
    }, new Map());

    const rows = variants.map((variant) => {
      const currentCost = Number(variant.buying_price || 0);
      const previousPriceRecord = latestHistoryByVariant.get(String(variant._id)) || null;
      const previousCost = previousPriceRecord ? Number(previousPriceRecord.old_cost || 0) : currentCost;
      const retailMarginPct = variant.retail_price > 0 ? ((variant.retail_price - currentCost) / variant.retail_price) * 100 : 0;
      const wholesaleMarginPct = variant.wholesale_price > 0 ? ((variant.wholesale_price - currentCost) / variant.wholesale_price) * 100 : 0;
      const costIncrease = currentCost - previousCost;

      return {
        variant_id: variant._id,
        product: variant.product_id ? {
          _id: variant.product_id._id,
          name: variant.product_id.name,
          brand: variant.product_id.brand,
          category: variant.product_id.category
        } : null,
        size: variant.size,
        current_cost: currentCost,
        previous_cost: previousCost,
        cost_change: costIncrease,
        retail_price: Number(variant.retail_price || 0),
        wholesale_price: Number(variant.wholesale_price || 0),
        retail_margin_pct: retailMarginPct,
        wholesale_margin_pct: wholesaleMarginPct,
        below_threshold: retailMarginPct < threshold || wholesaleMarginPct < threshold,
        threshold,
        last_cost_change_at: previousPriceRecord?.changed_at || null
      };
    })
      .filter((row) => row.cost_change > 0 || row.below_threshold)
      .sort((left, right) => left.retail_margin_pct - right.retail_margin_pct);

    res.json({
      success: true,
      data: {
        threshold,
        rows
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get inventory movement, daily sales, best sellers, slow movers, and trending products
// @route   GET /api/reports/inventory-performance
export const getInventoryPerformanceReport = async (req, res) => {
  try {
    const range = getClosedDateRange(req.query.start_date, req.query.end_date);
    const previousRange = getPreviousDateRange(range);
    const saleDateMatch = { createdAt: { $gte: range.start, $lte: range.end } };
    const adjustmentDateMatch = { createdAt: { $gte: range.start, $lte: range.end } };

    const [
      dailySales,
      bestSellers,
      currentPeriodSales,
      previousPeriodSales,
      variants,
      stockAdjustments
    ] = await Promise.all([
      Sale.aggregate([
        { $match: saleDateMatch },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            sales_count: { $sum: 1 },
            revenue: { $sum: '$total_amount' },
            amount_paid: { $sum: '$amount_paid' }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      SaleItem.aggregate([
        { $match: { createdAt: saleDateMatch.createdAt } },
        {
          $group: {
            _id: '$variant_id',
            quantity_sold: { $sum: '$quantity' },
            revenue: { $sum: '$subtotal' },
            profit: { $sum: '$profit_margin' },
            transactions: { $sum: 1 },
            last_sold_at: { $max: '$createdAt' }
          }
        },
        { $sort: { quantity_sold: -1, revenue: -1 } },
        { $limit: 25 }
      ]),
      SaleItem.aggregate([
        { $match: { createdAt: saleDateMatch.createdAt } },
        {
          $group: {
            _id: '$variant_id',
            quantity_sold: { $sum: '$quantity' },
            revenue: { $sum: '$subtotal' },
            profit: { $sum: '$profit_margin' },
            last_sold_at: { $max: '$createdAt' }
          }
        }
      ]),
      SaleItem.aggregate([
        { $match: { createdAt: { $gte: previousRange.start, $lte: previousRange.end } } },
        {
          $group: {
            _id: '$variant_id',
            quantity_sold: { $sum: '$quantity' },
            revenue: { $sum: '$subtotal' }
          }
        }
      ]),
      ProductVariant.find().populate('product_id', 'name brand category').lean(),
      StockAdjustment.find(adjustmentDateMatch)
        .populate({
          path: 'variant_id',
          populate: {
            path: 'product_id',
            select: 'name brand category'
          }
        })
        .populate('user_id', 'username')
        .populate('purchase_order_id', 'po_number invoice_reference')
        .sort({ createdAt: -1 })
        .lean()
    ]);

    const variantsById = new Map(variants.map((variant) => [String(variant._id), variant]));
    const currentSalesByVariant = new Map(currentPeriodSales.map((row) => [String(row._id), row]));
    const previousSalesByVariant = new Map(previousPeriodSales.map((row) => [String(row._id), row]));

    const attachVariant = (row) => {
      const variant = variantsById.get(String(row._id));
      return {
        ...getProductSnapshot(variant),
        quantity_sold: Number(row.quantity_sold || 0),
        revenue: Number(row.revenue || 0),
        profit: Number(row.profit || 0),
        transactions: Number(row.transactions || 0),
        last_sold_at: row.last_sold_at || null
      };
    };

    const bestSellerRows = bestSellers.map(attachVariant);

    const slowMovingRows = variants
      .map((variant) => {
        const sales = currentSalesByVariant.get(String(variant._id)) || {};
        const lastSale = sales.last_sold_at ? new Date(sales.last_sold_at) : null;
        const daysSinceLastSale = lastSale
          ? Math.max(0, Math.floor((range.end.getTime() - lastSale.getTime()) / 86400000))
          : null;

        return {
          ...getProductSnapshot(variant),
          quantity_sold: Number(sales.quantity_sold || 0),
          revenue: Number(sales.revenue || 0),
          last_sold_at: sales.last_sold_at || null,
          days_since_last_sale: daysSinceLastSale
        };
      })
      .filter((row) => row.current_stock > 0)
      .sort((left, right) =>
        left.quantity_sold - right.quantity_sold ||
        right.current_stock - left.current_stock ||
        (right.days_since_last_sale ?? 9999) - (left.days_since_last_sale ?? 9999)
      )
      .slice(0, 25);

    const trendingRows = variants
      .map((variant) => {
        const current = currentSalesByVariant.get(String(variant._id)) || {};
        const previous = previousSalesByVariant.get(String(variant._id)) || {};
        const currentQty = Number(current.quantity_sold || 0);
        const previousQty = Number(previous.quantity_sold || 0);
        const delta = currentQty - previousQty;
        const growthPct = previousQty > 0 ? (delta / previousQty) * 100 : (currentQty > 0 ? 100 : 0);

        return {
          ...getProductSnapshot(variant),
          current_quantity_sold: currentQty,
          previous_quantity_sold: previousQty,
          quantity_delta: delta,
          growth_pct: growthPct,
          current_revenue: Number(current.revenue || 0),
          previous_revenue: Number(previous.revenue || 0)
        };
      })
      .filter((row) => row.current_quantity_sold > 0 || row.previous_quantity_sold > 0)
      .sort((left, right) =>
        right.quantity_delta - left.quantity_delta ||
        right.growth_pct - left.growth_pct ||
        right.current_quantity_sold - left.current_quantity_sold
      )
      .slice(0, 25);

    const movementRows = stockAdjustments.map((adjustment) => {
      const variant = adjustment.variant_id;
      const quantity = Number(adjustment.quantity || 0);
      const signedQuantity = adjustment.adjustment_type === 'out' ? -quantity : quantity;
      const unitCost = Number(adjustment.unit_cost ?? variant?.buying_price ?? 0);

      return {
        _id: adjustment._id,
        date: adjustment.createdAt,
        movement_type: adjustment.reason === 'sale' ? 'sale' : adjustment.adjustment_type === 'in' ? 'stock_in' : 'stock_out',
        adjustment_type: adjustment.adjustment_type,
        reason: adjustment.reason,
        quantity,
        signed_quantity: signedQuantity,
        unit_cost: unitCost,
        value: signedQuantity * unitCost,
        stock_before: adjustment.stock_before,
        stock_after: adjustment.stock_after,
        notes: adjustment.notes || '',
        user: adjustment.user_id ? {
          _id: adjustment.user_id._id,
          username: adjustment.user_id.username
        } : null,
        purchase_order: adjustment.purchase_order_id ? {
          _id: adjustment.purchase_order_id._id,
          po_number: adjustment.purchase_order_id.po_number,
          invoice_reference: adjustment.purchase_order_id.invoice_reference
        } : null,
        product: getProductSnapshot(variant)
      };
    });

    const movementSummary = movementRows.reduce((acc, row) => {
      if (row.signed_quantity > 0) acc.stock_in += row.quantity;
      if (row.signed_quantity < 0) acc.stock_out += row.quantity;
      acc.net_movement += row.signed_quantity;
      acc.inventory_value_change += row.value;
      return acc;
    }, {
      stock_in: 0,
      stock_out: 0,
      net_movement: 0,
      inventory_value_change: 0
    });

    const salesSummary = dailySales.reduce((acc, row) => {
      acc.sales_count += Number(row.sales_count || 0);
      acc.revenue += Number(row.revenue || 0);
      return acc;
    }, { sales_count: 0, revenue: 0 });

    res.json({
      success: true,
      data: {
        range: {
          start_date: range.start,
          end_date: range.end,
          previous_start_date: previousRange.start,
          previous_end_date: previousRange.end
        },
        summary: {
          ...salesSummary,
          ...movementSummary,
          skus_tracked: variants.length
        },
        daily_sales: dailySales.map((row) => ({
          date: row._id,
          sales_count: row.sales_count,
          revenue: row.revenue,
          amount_paid: row.amount_paid
        })),
        best_sellers: bestSellerRows,
        slow_movers: slowMovingRows,
        trending_products: trendingRows,
        stock_movements: movementRows
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get top suppliers by purchase volume
// @route   GET /api/reports/top-suppliers
export const getTopSuppliersReport = async (req, res) => {
  try {
    const range = getDateRange(req.query.start_date, req.query.end_date);

    const purchaseOrders = await PurchaseOrder.find({
      status: { $in: ['received', 'partially_received'] }
    })
      .populate('supplier_id', 'name contact_name phone payment_terms_days')
      .lean();

    const filteredOrders = purchaseOrders.filter((purchaseOrder) =>
      isWithinDateRange(purchaseOrder.received_at || purchaseOrder.ordered_at || purchaseOrder.createdAt, range)
    );

    const rows = Array.from(filteredOrders.reduce((map, purchaseOrder) => {
      if (!purchaseOrder.supplier_id) {
        return map;
      }

      const key = String(purchaseOrder.supplier_id._id);
      const current = map.get(key) || {
        supplier_id: purchaseOrder.supplier_id._id,
        supplier_name: purchaseOrder.supplier_id.name,
        contact_name: purchaseOrder.supplier_id.contact_name,
        phone: purchaseOrder.supplier_id.phone,
        payment_terms_label: getPaymentTermsLabel(purchaseOrder.supplier_id.payment_terms_days),
        purchase_volume: 0,
        amount_paid: 0,
        outstanding_balance: 0,
        orders_count: 0
      };

      current.purchase_volume += Number(purchaseOrder.total_amount || 0);
      current.amount_paid += Number(purchaseOrder.amount_paid || 0);
      current.outstanding_balance += Number(purchaseOrder.balance_outstanding || 0);
      current.orders_count += 1;
      map.set(key, current);
      return map;
    }, new Map()).values()).sort((left, right) => right.purchase_volume - left.purchase_volume);

    const summary = rows.reduce((acc, row) => {
      acc.purchase_volume += row.purchase_volume;
      acc.outstanding_balance += row.outstanding_balance;
      acc.orders_count += row.orders_count;
      return acc;
    }, {
      purchase_volume: 0,
      outstanding_balance: 0,
      orders_count: 0
    });

    res.json({ success: true, data: { summary, rows } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
