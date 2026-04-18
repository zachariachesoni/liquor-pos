import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, Cell, PieChart, Pie } from 'recharts';
import { TrendingUp, ShoppingBag, AlertTriangle, ArrowUpRight, DollarSign, Package } from 'lucide-react';
import api from '../utils/api';
import './Dashboard.css';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const response = await api.get('/dashboard/stats');
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

  const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981'];

  if (loading) return <div className="loading">Loading insights...</div>;

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1 className="page-title">Welcome back, {user?.username}</h1>
          <p className="page-subtitle">Here is what's happening with your store today.</p>
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
            <p>Today's Revenue</p>
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
            <p>This Week</p>
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
