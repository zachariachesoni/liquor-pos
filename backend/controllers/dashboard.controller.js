import Sale from '../models/Sale.js';
import ProductVariant from '../models/ProductVariant.js';
import SaleItem from '../models/SaleItem.js';
import StockAdjustment from '../models/StockAdjustment.js';
import { calculateEffectiveLowStockLevel, getSystemSettings, serializeSystemSettings } from '../utils/systemSettings.js';

const MANAGEMENT_ROLES = ['admin', 'manager'];

const toNumber = (value) => {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric : 0;
};

const getSaleItemScopeStages = (req, createdAtMatch = null) => {
  const stages = [];

  if (createdAtMatch) {
    stages.push({ $match: { createdAt: createdAtMatch } });
  }

  if (req.user?.role === 'cashier') {
    stages.push(
      {
        $lookup: {
          from: 'sales',
          localField: 'sale_id',
          foreignField: '_id',
          as: 'sale'
        }
      },
      { $unwind: '$sale' },
      { $match: { 'sale.user_id': req.user._id || req.user.id } }
    );
  }

  return stages;
};

const getProductSnapshot = (variant, fallbackVariantId = null) => {
  const product = variant?.product_id || {};

  return {
    variant_id: String(variant?._id || fallbackVariantId || ''),
    product_id: product?._id ? String(product._id) : null,
    product_name: product?.name || 'Unknown product',
    brand: product?.brand || '',
    category: product?.category || 'other',
    size: variant?.size || '',
    current_stock: toNumber(variant?.current_stock),
    buying_price: toNumber(variant?.buying_price),
    retail_price: toNumber(variant?.retail_price),
    wholesale_price: toNumber(variant?.wholesale_price)
  };
};

const redactProductCostFields = (row) => {
  if (!row) return null;
  const { buying_price, current_profit, profit_margin_pct, ...visibleRow } = row;
  return visibleRow;
};

const redactSalesCostFields = (metrics) => {
  const { cogs, gross_profit, margin_pct, ...visibleMetrics } = metrics || {};
  return visibleMetrics;
};

const normalizeSalesMetrics = ({ lineMetrics, salesMetrics, paymentBreakdown }) => {
  const lineRevenue = toNumber(lineMetrics?.revenue);
  const salesRevenue = toNumber(salesMetrics?.totalSales || lineRevenue);
  const transactions = toNumber(salesMetrics?.count);
  const unitsSold = toNumber(lineMetrics?.units_sold);
  const grossProfit = toNumber(lineMetrics?.gross_profit);
  const wholesaleUnits = toNumber(lineMetrics?.wholesale_units);

  return {
    window_label: 'Last 7 days',
    revenue: salesRevenue,
    transactions,
    units_sold: unitsSold,
    average_sale_value: transactions > 0 ? salesRevenue / transactions : 0,
    average_unit_price: unitsSold > 0 ? lineRevenue / unitsSold : 0,
    gross_profit: grossProfit,
    cogs: toNumber(lineMetrics?.cogs),
    margin_pct: lineRevenue > 0 ? (grossProfit / lineRevenue) * 100 : 0,
    wholesale_units: wholesaleUnits,
    retail_units: Math.max(0, unitsSold - wholesaleUnits),
    wholesale_share_pct: unitsSold > 0 ? (wholesaleUnits / unitsSold) * 100 : 0,
    top_payment_method: paymentBreakdown?.[0] ? {
      method: paymentBreakdown[0]._id || 'unknown',
      transactions: toNumber(paymentBreakdown[0].transactions),
      revenue: toNumber(paymentBreakdown[0].revenue)
    } : null
  };
};

const buildAverageCostUsage = async ({ req, variant, windowStart }) => {
  if (!variant) return null;

  const saleScopeMatch = req.user?.role === 'cashier'
    ? [{ $match: { 'sale.user_id': req.user._id || req.user.id } }]
    : [];

  const [recentSales, recentMovements] = await Promise.all([
    SaleItem.aggregate([
      {
        $match: {
          variant_id: variant._id,
          createdAt: { $gte: windowStart }
        }
      },
      {
        $lookup: {
          from: 'sales',
          localField: 'sale_id',
          foreignField: '_id',
          as: 'sale'
        }
      },
      { $unwind: '$sale' },
      ...saleScopeMatch,
      { $sort: { createdAt: -1 } },
      { $limit: 6 },
      {
        $project: {
          _id: 1,
          invoice_number: '$sale.invoice_number',
          date: '$sale.createdAt',
          quantity: 1,
          unit_price: 1,
          average_cost_used: '$buying_price',
          subtotal: 1,
          cogs: { $multiply: ['$buying_price', '$quantity'] },
          profit_margin: 1,
          wholesale_applied: 1
        }
      }
    ]),
    StockAdjustment.find({ variant_id: variant._id })
      .populate('user_id', 'username')
      .populate('purchase_order_id', 'po_number invoice_reference')
      .sort({ createdAt: -1 })
      .limit(6)
      .lean()
  ]);

  const saleSummary = recentSales.reduce((acc, sale) => {
    acc.units += toNumber(sale.quantity);
    acc.cogs += toNumber(sale.cogs);
    acc.profit += toNumber(sale.profit_margin);
    return acc;
  }, { units: 0, cogs: 0, profit: 0 });

  return {
    ...getProductSnapshot(variant),
    average_buying_price: toNumber(variant.buying_price),
    recent_sales: recentSales.map((sale) => ({
      _id: sale._id,
      invoice_number: sale.invoice_number || 'Invoice',
      date: sale.date,
      quantity: toNumber(sale.quantity),
      unit_price: toNumber(sale.unit_price),
      average_cost_used: toNumber(sale.average_cost_used),
      cogs: toNumber(sale.cogs),
      subtotal: toNumber(sale.subtotal),
      profit_margin: toNumber(sale.profit_margin),
      wholesale_applied: Boolean(sale.wholesale_applied)
    })),
    stock_movements: recentMovements.map((movement) => ({
      _id: movement._id,
      date: movement.createdAt,
      movement_type: movement.adjustment_type === 'in'
        ? 'average_cost_update'
        : movement.reason === 'sale'
          ? 'average_cost_cogs'
          : 'stock_cost_reference',
      adjustment_type: movement.adjustment_type,
      reason: movement.reason,
      quantity: toNumber(movement.quantity),
      unit_cost: toNumber(movement.unit_cost),
      stock_before: toNumber(movement.stock_before),
      stock_after: toNumber(movement.stock_after),
      notes: movement.notes || '',
      user: movement.user_id ? {
        _id: movement.user_id._id,
        username: movement.user_id.username
      } : null,
      purchase_order: movement.purchase_order_id ? {
        _id: movement.purchase_order_id._id,
        po_number: movement.purchase_order_id.po_number,
        invoice_reference: movement.purchase_order_id.invoice_reference
      } : null
    })),
    summary: {
      sale_rows: recentSales.length,
      movement_rows: recentMovements.length,
      units_costed: saleSummary.units,
      cogs_from_average: saleSummary.cogs,
      profit_from_average: saleSummary.profit
    }
  };
};

export const getStats = async (req, res) => {
  try {
    const settingsDoc = await getSystemSettings();
    const settings = serializeSystemSettings(settingsDoc);
    const canViewCostDetails = MANAGEMENT_ROLES.includes(req.user?.role);
    const salesScope = req.user?.role === 'cashier'
      ? { user_id: req.user._id || req.user.id }
      : {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const revenueWindowStart = new Date(today);
    revenueWindowStart.setDate(today.getDate() - 6);

    const pipe = (startDate) => [
      { $match: { ...salesScope, createdAt: { $gte: startDate } } },
      { $group: { _id: null, totalSales: { $sum: '$total_amount' }, count: { $sum: 1 } } }
    ];

    const [todaySales] = await Sale.aggregate(pipe(today));
    const [weekSales] = await Sale.aggregate(pipe(weekStart));
    const [monthSales] = await Sale.aggregate(pipe(monthStart));
    const [last7Sales] = await Sale.aggregate(pipe(revenueWindowStart));

    const totalProducts = await ProductVariant.countDocuments();
    const variants = await ProductVariant.find({}, 'current_stock min_stock_level retail_price buying_price');
    const lowStockItems = variants.filter((variant) =>
      variant.current_stock <= calculateEffectiveLowStockLevel(variant, settings)
    ).length;

    const salesLineMetricsPipeline = [
      ...getSaleItemScopeStages(req, { $gte: revenueWindowStart }),
      {
        $group: {
          _id: null,
          units_sold: { $sum: '$quantity' },
          revenue: { $sum: '$subtotal' },
          cogs: { $sum: { $multiply: ['$buying_price', '$quantity'] } },
          gross_profit: { $sum: '$profit_margin' },
          wholesale_units: {
            $sum: {
              $cond: [{ $eq: ['$wholesale_applied', true] }, '$quantity', 0]
            }
          }
        }
      }
    ];

    const currentTrendStart = new Date(revenueWindowStart);
    const previousTrendStart = new Date(currentTrendStart);
    previousTrendStart.setDate(currentTrendStart.getDate() - 7);

    const [salesLineMetrics = null, paymentBreakdown, currentPeriodSales, previousPeriodSales] = await Promise.all([
      SaleItem.aggregate(salesLineMetricsPipeline).then((rows) => rows[0] || null),
      Sale.aggregate([
        { $match: { ...salesScope, createdAt: { $gte: revenueWindowStart } } },
        {
          $group: {
            _id: '$payment_method',
            revenue: { $sum: '$total_amount' },
            transactions: { $sum: 1 }
          }
        },
        { $sort: { transactions: -1, revenue: -1 } }
      ]),
      SaleItem.aggregate([
        ...getSaleItemScopeStages(req, { $gte: currentTrendStart }),
        {
          $group: {
            _id: '$variant_id',
            quantity_sold: { $sum: '$quantity' },
            revenue: { $sum: '$subtotal' },
            profit: { $sum: '$profit_margin' },
            transactions: { $sum: 1 },
            last_sold_at: { $max: '$createdAt' }
          }
        }
      ]),
      SaleItem.aggregate([
        ...getSaleItemScopeStages(req, { $gte: previousTrendStart, $lt: currentTrendStart }),
        {
          $group: {
            _id: '$variant_id',
            quantity_sold: { $sum: '$quantity' },
            revenue: { $sum: '$subtotal' },
            profit: { $sum: '$profit_margin' },
            transactions: { $sum: 1 }
          }
        }
      ])
    ]);

    const revenueOverview = await Sale.aggregate([
      { $match: { ...salesScope, createdAt: { $gte: revenueWindowStart } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          sales: { $sum: '$total_amount' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    const salesData = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(revenueWindowStart);
      date.setDate(revenueWindowStart.getDate() + index);

      const entry = revenueOverview.find((item) =>
        item._id.year === date.getFullYear() &&
        item._id.month === date.getMonth() + 1 &&
        item._id.day === date.getDate()
      );

      return {
        name: date.toLocaleDateString('en-US', { weekday: 'short' }),
        sales: entry?.sales || 0,
      };
    });

    const categoryBreakdownPipeline = [];

    if (req.user?.role === 'cashier') {
      categoryBreakdownPipeline.push(
        {
          $lookup: {
            from: 'sales',
            localField: 'sale_id',
            foreignField: '_id',
            as: 'sale'
          }
        },
        { $unwind: '$sale' },
        { $match: { 'sale.user_id': req.user._id || req.user.id } }
      );
    }

    categoryBreakdownPipeline.push(
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
        $lookup: {
          from: 'products',
          localField: 'variant.product_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $group: {
          _id: '$product.category',
          value: { $sum: '$subtotal' }
        }
      },
      { $sort: { value: -1 } }
    );

    const categoryBreakdown = await SaleItem.aggregate(categoryBreakdownPipeline);

    const categoryData = categoryBreakdown.map((entry) => ({
      name: entry._id ? entry._id.charAt(0).toUpperCase() + entry._id.slice(1) : 'Other',
      value: entry.value,
    }));

    const currentSalesByVariant = new Map(currentPeriodSales.map((row) => [String(row._id), row]));
    const previousSalesByVariant = new Map(previousPeriodSales.map((row) => [String(row._id), row]));
    const trendVariantIds = [
      ...new Set([
        ...currentPeriodSales.map((row) => String(row._id)),
        ...previousPeriodSales.map((row) => String(row._id))
      ])
    ].filter(Boolean);
    const trendVariants = trendVariantIds.length
      ? await ProductVariant.find({ _id: { $in: trendVariantIds } })
        .populate('product_id', 'name brand category')
        .lean()
      : [];
    const trendVariantsById = new Map(trendVariants.map((variant) => [String(variant._id), variant]));

    const trendingProducts = trendVariantIds
      .map((variantId) => {
        const current = currentSalesByVariant.get(variantId) || {};
        const previous = previousSalesByVariant.get(variantId) || {};
        const currentQty = toNumber(current.quantity_sold);
        const previousQty = toNumber(previous.quantity_sold);
        const delta = currentQty - previousQty;
        const growthPct = previousQty > 0 ? (delta / previousQty) * 100 : (currentQty > 0 ? 100 : 0);
        const currentRevenue = toNumber(current.revenue);
        const currentProfit = toNumber(current.profit);

        return {
          ...getProductSnapshot(trendVariantsById.get(variantId), variantId),
          current_quantity_sold: currentQty,
          previous_quantity_sold: previousQty,
          quantity_delta: delta,
          growth_pct: growthPct,
          current_revenue: currentRevenue,
          previous_revenue: toNumber(previous.revenue),
          current_profit: currentProfit,
          current_transactions: toNumber(current.transactions),
          average_unit_price: currentQty > 0 ? currentRevenue / currentQty : 0,
          profit_margin_pct: currentRevenue > 0 ? (currentProfit / currentRevenue) * 100 : 0,
          last_sold_at: current.last_sold_at || null
        };
      })
      .filter((row) => row.current_quantity_sold > 0 || row.previous_quantity_sold > 0)
      .sort((left, right) =>
        right.quantity_delta - left.quantity_delta ||
        right.growth_pct - left.growth_pct ||
        right.current_quantity_sold - left.current_quantity_sold ||
        right.current_revenue - left.current_revenue
      )
      .slice(0, 5);

    const trendingProduct = trendingProducts[0] || null;
    const trendingVariant = trendingProduct
      ? trendVariantsById.get(String(trendingProduct.variant_id))
      : null;
    const averageCostUsage = canViewCostDetails
      ? await buildAverageCostUsage({ req, variant: trendingVariant, windowStart: revenueWindowStart })
      : null;
    const salesMetrics = normalizeSalesMetrics({
      lineMetrics: salesLineMetrics,
      salesMetrics: last7Sales,
      paymentBreakdown
    });
    const visibleSalesMetrics = canViewCostDetails ? salesMetrics : redactSalesCostFields(salesMetrics);
    const visibleTrendingProducts = canViewCostDetails
      ? trendingProducts
      : trendingProducts.map(redactProductCostFields);
    const visibleTrendingProduct = visibleTrendingProducts[0] || null;

    res.json({
      success: true,
      data: {
        today: {
          revenue: todaySales?.totalSales || 0,
          transactions: todaySales?.count || 0,
          growth: 0
        },
        week: {
          revenue: weekSales?.totalSales || 0,
          transactions: weekSales?.count || 0
        },
        month: {
          revenue: monthSales?.totalSales || 0,
          transactions: monthSales?.count || 0
        },
        inventory: {
          total_products: totalProducts,
          low_stock_items: lowStockItems
        },
        salesData,
        categoryData,
        salesMetrics: visibleSalesMetrics,
        trendingProduct: visibleTrendingProduct,
        trendingProducts: visibleTrendingProducts,
        averageCostUsage
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
