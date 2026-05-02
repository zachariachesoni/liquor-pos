import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell, PieChart, Pie } from 'recharts';
import { TrendingUp, ShoppingBag, AlertTriangle, ArrowUpRight, ArrowDownRight, DollarSign, Package, Award } from 'lucide-react';
import api from '../utils/api';
import { canSeeProductCosts } from '../utils/accessControl';
import './Dashboard.css';

const formatCurrency = (value, digits = 0) => (
  `KES ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })}`
);

const formatNumber = (value) => Number(value || 0).toLocaleString();

const formatPercent = (value, digits = 1) => `${Number(value || 0).toFixed(digits)}%`;

const formatDate = (value) => (
  value ? new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'No date'
);

const getTrendLabel = (product) => {
  if (!product) return 'No movement';
  if (Number(product.previous_quantity_sold || 0) === 0 && Number(product.current_quantity_sold || 0) > 0) {
    return 'New demand';
  }
  return `${product.quantity_delta >= 0 ? '+' : ''}${formatPercent(product.growth_pct)}`;
};

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [trendDays, setTrendDays] = useState(7);
  const { user } = useAuth();
  const navigate = useNavigate();
  const isCashier = user?.role === 'cashier';
  const canViewCostDetails = canSeeProductCosts(user?.role);

  useEffect(() => {
    fetchDashboardStats();
  }, [trendDays]);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const response = await api.get('/dashboard/stats', { params: { trend_days: trendDays } });
      setStats(response.data.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
      // Removed mock fallback relying on live database
    } finally {
      setLoading(false);
    }
  };

  const salesData = stats?.salesData || [];
  const categoryData = stats?.categoryData || [];
  const trendWindow = stats?.trendWindow || { days: trendDays, label: `Last ${trendDays} days` };
  const trendingProduct = stats?.trendingProduct;
  const trendingProducts = stats?.trendingProducts || [];
  const averageCostUsage = stats?.averageCostUsage;

  const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981'];

  if (loading) return <div className="loading">Loading insights...</div>;

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1 className="page-title">Welcome back</h1>
          <p className="page-subtitle">
            {isCashier
              ? "Here is your sales and stock snapshot for today."
              : "Here is what's happening with your store today."}
          </p>
        </div>
        <button className="pos-quick-btn glass" onClick={() => navigate('/pos')}>
          <ShoppingBag size={18} />
          <span>Launch POS</span>
        </button>
      </div>
      
      <div className="stats-grid">
        <div className="stat-card glass">
          <div className="stat-card-header">
            <div className="stat-icon-wrapper primary-bg">
              <DollarSign size={20} className="primary-color" />
            </div>
            <span className="stat-badge positive">
              <ArrowUpRight size={14} /> {stats?.today?.growth || 0}%
            </span>
          </div>
          <div className="stat-card-body">
            <h3>KES {stats?.today?.revenue?.toLocaleString(undefined, {minimumFractionDigits: 2}) || '0.00'}</h3>
            <p>{isCashier ? 'Your Sales Today' : "Today's Revenue"}</p>
          </div>
          <div className="stat-card-footer">
            <span>{stats?.today?.transactions || 0} total transactions</span>
          </div>
        </div>

        <div className="stat-card glass">
          <div className="stat-card-header">
            <div className="stat-icon-wrapper secondary-bg">
              <TrendingUp size={20} className="secondary-color" />
            </div>
          </div>
          <div className="stat-card-body">
            <h3>KES {stats?.week?.revenue?.toLocaleString(undefined, {minimumFractionDigits: 2}) || '0.00'}</h3>
            <p>{isCashier ? 'Your Sales This Week' : 'This Week'}</p>
          </div>
          <div className="stat-card-footer">
            <span>{stats?.week?.transactions || 0} total transactions</span>
          </div>
        </div>

        <div className="stat-card glass">
          <div className="stat-card-header">
            <div className="stat-icon-wrapper primary-bg">
              <Package size={20} className="primary-color" />
            </div>
          </div>
          <div className="stat-card-body">
            <h3>{stats?.inventory?.total_products || 0}</h3>
            <p>Active Products</p>
          </div>
          <div className="stat-card-footer">
            <span>Inventory coverage</span>
          </div>
        </div>

        <div className="stat-card glass alert-card">
          <div className="stat-card-header">
            <div className="stat-icon-wrapper danger-bg">
              <AlertTriangle size={20} className="danger-color" />
            </div>
          </div>
          <div className="stat-card-body">
            <h3>{stats?.inventory?.low_stock_items || 0}</h3>
            <p>Low Stock Alerts</p>
          </div>
          <div className="stat-card-footer">
            <button className="link-btn" onClick={() => navigate('/inventory')}>Review Inventory</button>
          </div>
        </div>
      </div>

      <div className="dashboard-insights-grid">
        <section className="dashboard-insight-panel trend-insight glass-panel">
          <div className="insight-header">
            <div>
              <h3>Trending Product</h3>
              <p>{trendWindow.label} compared with the previous {trendWindow.days} days</p>
            </div>
            <div className="trend-period-control">
              <select
                className="field-select"
                value={trendDays}
                onChange={(event) => setTrendDays(Number(event.target.value))}
                aria-label="Trending product period"
              >
                <option value={7}>Last 7 days</option>
                <option value={14}>Last 14 days</option>
                <option value={30}>Last 30 days</option>
                <option value={60}>Last 60 days</option>
              </select>
              <div className="insight-icon trend-icon">
                <Award size={22} />
              </div>
            </div>
          </div>

          {trendingProduct ? (
            <>
              <div className="trend-hero">
                <div>
                  <span className="eyebrow">{trendingProduct.category}</span>
                  <h2>{trendingProduct.product_name}</h2>
                  <p>{trendingProduct.size}{trendingProduct.brand ? ` | ${trendingProduct.brand}` : ''}</p>
                </div>
                <span className={`trend-badge ${trendingProduct.quantity_delta >= 0 ? 'positive' : 'negative'}`}>
                  {trendingProduct.quantity_delta >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                  {getTrendLabel(trendingProduct)}
                </span>
              </div>

              <div className="insight-metric-grid">
                <div className="insight-metric">
                  <span>Units Sold</span>
                  <strong>{formatNumber(trendingProduct.current_quantity_sold)}</strong>
                  <small>{formatNumber(trendingProduct.previous_quantity_sold)} previous</small>
                </div>
                <div className="insight-metric">
                  <span>Revenue</span>
                  <strong>{formatCurrency(trendingProduct.current_revenue)}</strong>
                  <small>{formatCurrency(trendingProduct.average_unit_price)} avg sell</small>
                </div>
                {canViewCostDetails && (
                  <div className="insight-metric">
                    <span>Gross Profit</span>
                    <strong>{formatCurrency(trendingProduct.current_profit)}</strong>
                    <small>{formatPercent(trendingProduct.profit_margin_pct)} margin</small>
                  </div>
                )}
                <div className="insight-metric">
                  <span>Stock Now</span>
                  <strong>{formatNumber(trendingProduct.current_stock)}</strong>
                  <small>Last sold {formatDate(trendingProduct.last_sold_at)}</small>
                </div>
              </div>

              <div className="trend-list">
                {trendingProducts.slice(0, 4).map((product, index) => (
                  <div className="trend-list-row" key={product.variant_id}>
                    <span className="trend-rank">{index + 1}</span>
                    <div>
                      <strong>{product.product_name}</strong>
                      <small>{product.size} | {formatNumber(product.current_quantity_sold)} units</small>
                    </div>
                    <span className={product.quantity_delta >= 0 ? 'text-success' : 'text-danger'}>
                      {product.quantity_delta >= 0 ? '+' : ''}{formatNumber(product.quantity_delta)}
                    </span>
                  </div>
                ))}
              </div>

              {canViewCostDetails && averageCostUsage && (
                <div className="average-cost-audit">
                  <div className="average-cost-header">
                    <div>
                      <h4>Average Cost Usage</h4>
                      <p>Recent sales and stock movements using the current average buying price.</p>
                    </div>
                    <span className="report-meta-chip">
                      Avg cost {formatCurrency(averageCostUsage.average_buying_price)}
                    </span>
                  </div>
                  <div className="average-cost-summary">
                    <div>
                      <span>Units Costed</span>
                      <strong>{formatNumber(averageCostUsage.summary?.units_costed)}</strong>
                    </div>
                    <div>
                      <span>COGS From Average</span>
                      <strong>{formatCurrency(averageCostUsage.summary?.cogs_from_average)}</strong>
                    </div>
                    <div>
                      <span>Sales Rows</span>
                      <strong>{formatNumber(averageCostUsage.summary?.sale_rows)}</strong>
                    </div>
                  </div>
                  <div className="average-cost-list">
                    {(averageCostUsage.recent_sales || []).slice(0, 4).map((sale) => (
                      <div className="average-cost-row" key={sale._id}>
                        <div>
                          <strong>{sale.invoice_number}</strong>
                          <small>{formatDate(sale.date)} | Qty {formatNumber(sale.quantity)}</small>
                        </div>
                        <span>Cost used {formatCurrency(sale.average_cost_used)}</span>
                        <span>COGS {formatCurrency(sale.cogs)}</span>
                      </div>
                    ))}
                    {(averageCostUsage.recent_sales || []).length === 0 && (
                      <div className="td-secondary">No recent sale rows used this average cost in the selected period.</div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="dashboard-empty-state">
              <Package size={24} />
              <p>No product trend yet for this window.</p>
            </div>
          )}
        </section>
      </div>

      <div className="charts-grid">
        <div className="chart-card glass-panel">
          <div className="chart-header">
            <h3>Revenue Overview</h3>
          </div>
          <div className="chart-body">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `KES ${val}`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--glass-bg)', borderColor: 'var(--border-color)', borderRadius: '8px' }}
                  itemStyle={{ color: 'var(--text-primary)' }}
                />
                <Area type="monotone" dataKey="sales" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-card glass-panel">
          <div className="chart-header">
            <h3>Sales by Category</h3>
          </div>
          <div className="chart-body">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--glass-bg)', borderColor: 'var(--border-color)', borderRadius: '8px' }}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
