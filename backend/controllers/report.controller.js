import mongoose from 'mongoose';
import SaleItem from '../models/SaleItem.js';
import Sale from '../models/Sale.js';
import Expense from '../models/Expense.js';

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
