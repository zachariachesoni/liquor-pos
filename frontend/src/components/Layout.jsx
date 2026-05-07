import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, ShoppingCart, Package, ClipboardList, FileBarChart, Users, Receipt, PieChart, LogOut, Menu, X, Shield, Truck, PanelLeftClose, PanelLeftOpen, Bell, Moon, Sun } from 'lucide-react';
import api from '../utils/api';
import { useSystemSettings } from '../hooks/useSystemSettings';
import { INVENTORY_ROUTE_ROLES, PRODUCTS_ROUTE_ROLES, SALES_ROUTE_ROLES } from '../utils/accessControl';
import './Layout.css';

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const { settings } = useSystemSettings();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('system_theme') || 'dark');
  const [openNotificationCount, setOpenNotificationCount] = useState(0);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('system_theme', theme);
  }, [theme]);

  useEffect(() => {
    let isMounted = true;

    const fetchOpenNotificationCount = async () => {
      if (!user || user.role !== 'admin') {
        if (isMounted) {
          setOpenNotificationCount(0);
        }
        return;
      }

      try {
        const response = await api.get('/notifications', { params: { status: 'open' } });
        const notifications = response.data.data || [];
        if (isMounted) {
          setOpenNotificationCount(response.data.count ?? notifications.length);
        }
      } catch (error) {
        if (isMounted) {
          setOpenNotificationCount(0);
        }
      }
    };

    fetchOpenNotificationCount();
    const intervalId = window.setInterval(fetchOpenNotificationCount, 60000);
    window.addEventListener('focus', fetchOpenNotificationCount);
    window.addEventListener('notifications:updated', fetchOpenNotificationCount);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', fetchOpenNotificationCount);
      window.removeEventListener('notifications:updated', fetchOpenNotificationCount);
    };
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={20} />, roles: ['admin', 'manager', 'cashier'] },
    { name: 'POS', path: '/pos', icon: <ShoppingCart size={20} />, roles: ['admin', 'manager', 'cashier'] },
    { name: 'Products', path: '/products', icon: <Package size={20} />, roles: PRODUCTS_ROUTE_ROLES },
    { name: 'Inventory', path: '/inventory', icon: <ClipboardList size={20} />, roles: INVENTORY_ROUTE_ROLES },
    { name: 'Suppliers', path: '/suppliers', icon: <Truck size={20} />, roles: ['admin', 'manager'] },
    { name: 'Reports', path: '/reports', icon: <PieChart size={20} />, roles: ['admin', 'manager'] },
    { name: 'Sales', path: '/sales', icon: <FileBarChart size={20} />, roles: SALES_ROUTE_ROLES },
    { name: 'Customers', path: '/customers', icon: <Users size={20} />, roles: ['admin', 'manager', 'cashier'] },
    { name: 'Notifications', path: '/notifications', icon: <Bell size={20} />, roles: ['admin'], hasAlert: openNotificationCount > 0 },
    { name: 'Admin', path: '/admin', icon: <Shield size={20} />, roles: ['admin', 'manager', 'cashier'] },
    { name: 'Expenses', path: '/expenses', icon: <Receipt size={20} />, roles: ['admin', 'manager'] }
  ].filter((item) => user && item.roles.includes(user.role));

  const renderBrandIcon = () => (
    settings.business_logo_url ? (
      <div className="brand-icon">
        <img src={settings.business_logo_url} alt={settings.business_name} />
      </div>
    ) : null
  );

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const toggleTheme = () => {
    setTheme((current) => (current === 'light' ? 'dark' : 'light'));
  };

  return (
    <div className={`layout-container ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className={`sidebar glass-panel ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="brand">
            {renderBrandIcon()}
            <h2>{settings.business_name}</h2>
          </div>
          <button
            className="sidebar-collapse-toggle"
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
          </button>
          <button className="mobile-close" onClick={toggleMobileMenu}>
            <X size={24} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              to={item.path}
              key={item.path}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
              title={item.name}
            >
              <span className="nav-icon-wrap">
                {item.icon}
                {item.hasAlert && <span className="nav-alert-dot" aria-label="Open notifications" />}
              </span>
              <span className="nav-label">{item.name}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="theme-toggle-btn" onClick={toggleTheme} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
          </button>
          <button className="logout-btn" onClick={handleLogout}>
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="mobile-header glass-panel">
          <div className="brand">
            {renderBrandIcon()}
            <h2>{settings.business_name}</h2>
          </div>
          <div className="mobile-header-actions">
            <button className="theme-toggle-btn icon-only" onClick={toggleTheme} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>
            <button className="mobile-toggle" onClick={toggleMobileMenu}>
              <Menu size={24} />
            </button>
          </div>
        </header>

        <div className="page-content animate-fade-in">
          {children}
        </div>
      </main>

      {mobileMenuOpen && <div className="sidebar-overlay" onClick={toggleMobileMenu}></div>}
    </div>
  );
};

export default Layout;
