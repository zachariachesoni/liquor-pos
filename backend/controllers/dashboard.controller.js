import Sale from '../models/Sale.js';
import ProductVariant from '../models/ProductVariant.js';
import SaleItem from '../models/SaleItem.js';
import { getVariantProductSnapshot } from '../utils/productSnapshot.js';
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

const getProductSnapshot = (variant, fallbackVariantId = null) => getVariantProductSnapshot(variant, {
  fallbackVariantId,
  stringifyIds: true
});

const redactProductCostFields = (row) => {
  if (!row) return null;
  const { buying_price, current_profit, profit_margin_pct, ...visibleRow } = row;
  return visibleRow;
};

export const getStats = async (req, res) => {
  try {
    const settingsDoc = await getSystemSettings();
    const settings = serializeSystemSettings(settingsDoc);
    const canViewCostDetails = MANAGEMENT_ROLES.includes(req.user?.role);
    const trendDays = Math.min(90, Math.max(1, Number(req.query.trend_days || 7)));
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
    const trendWindowStart = new Date(today);
    trendWindowStart.setDate(today.getDate() - (trendDays - 1));

    const pipe = (startDate) => [
      { $match: { ...salesScope, createdAt: { $gte: startDate } } },
      { $group: { _id: null, totalSales: { $sum: '$total_amount' }, count: { $sum: 1 } } }
    ];

    const [todaySales] = await Sale.aggregate(pipe(today));
    const [weekSales] = await Sale.aggregate(pipe(weekStart));
    const [monthSales] = await Sale.aggregate(pipe(monthStart));
    const totalProducts = await ProductVariant.countDocuments({ is_active: { $ne: false } });
    const variants = await ProductVariant.find({ is_active: { $ne: false } }, 'current_stock min_stock_level retail_price buying_price');
    const lowStockItems = variants.filter((variant) =>
      variant.current_stock <= calculateEffectiveLowStockLevel(variant, settings)
    ).length;

    const currentTrendStart = new Date(trendWindowStart);
    const previousTrendStart = new Date(currentTrendStart);
    previousTrendStart.setDate(currentTrendStart.getDate() - trendDays);

    const [currentPeriodSales, previousPeriodSales] = await Promise.all([
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
        trendWindow: {
          days: trendDays,
          label: `Last ${trendDays} day${trendDays === 1 ? '' : 's'}`
        },
        trendingProduct: visibleTrendingProduct,
        trendingProducts: visibleTrendingProducts
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
