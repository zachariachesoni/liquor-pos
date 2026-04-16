import Sale from '../models/Sale.js';
import ProductVariant from '../models/ProductVariant.js';
import SaleItem from '../models/SaleItem.js';
import { calculateEffectiveLowStockLevel, getSystemSettings, serializeSystemSettings } from '../utils/systemSettings.js';

export const getStats = async (req, res) => {
  try {
    const settingsDoc = await getSystemSettings();
    const settings = serializeSystemSettings(settingsDoc);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const revenueWindowStart = new Date(today);
    revenueWindowStart.setDate(today.getDate() - 6);

    const pipe = (startDate) => [
      { $match: { createdAt: { $gte: startDate } } },
      { $group: { _id: null, totalSales: { $sum: '$total_amount' }, count: { $sum: 1 } } }
    ];

    const [todaySales] = await Sale.aggregate(pipe(today));
    const [weekSales] = await Sale.aggregate(pipe(weekStart));
    const [monthSales] = await Sale.aggregate(pipe(monthStart));

    const totalProducts = await ProductVariant.countDocuments();
    const variants = await ProductVariant.find({}, 'current_stock min_stock_level retail_price buying_price');
    const lowStockItems = variants.filter((variant) =>
      variant.current_stock <= calculateEffectiveLowStockLevel(variant, settings)
    ).length;

    const revenueOverview = await Sale.aggregate([
      { $match: { createdAt: { $gte: revenueWindowStart } } },
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

    const categoryBreakdown = await SaleItem.aggregate([
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
    ]);

    const categoryData = categoryBreakdown.map((entry) => ({
      name: entry._id ? entry._id.charAt(0).toUpperCase() + entry._id.slice(1) : 'Other',
      value: entry.value,
    }));

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
        categoryData
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
