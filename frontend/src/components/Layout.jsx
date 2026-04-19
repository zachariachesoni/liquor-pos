import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, ShoppingCart, Package, ClipboardList, FileBarChart, Users, Receipt, PieChart, LogOut, Menu, X, Shield, User, Truck } from 'lucide-react';
import { useSystemSettings } from '../hooks/useSystemSettings';
import './Layout.css';

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const { settings } = useSystemSettings();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={20} />, roles: ['admin', 'manager', 'cashier'] },
    { name: 'POS', path: '/pos', icon: <ShoppingCart size={20} />, roles: ['admin', 'manager', 'cashier'] },
    { name: 'Products', path: '/products', icon: <Package size={20} />, roles: ['admin', 'manager'] },
    { name: 'Inventory', path: '/inventory', icon: <ClipboardList size={20} />, roles: ['admin', 'manager'] },
    { name: 'Suppliers', path: '/suppliers', icon: <Truck size={20} />, roles: ['admin', 'manager'] },
    { name: 'Reports', path: '/reports', icon: <PieChart size={20} />, roles: ['admin', 'manager'] },
    { name: 'Sales', path: '/sales', icon: <FileBarChart size={20} />, roles: ['admin', 'manager'] },
    { name: 'Customers', path: '/customers', icon: <Users size={20} />, roles: ['admin', 'manager', 'cashier'] },
    { name: 'Account', path: '/account', icon: <User size={20} />, roles: ['admin', 'manager', 'cashier'] },
    { name: 'Admin', path: '/admin', icon: <Shield size={20} />, roles: ['admin'] },
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

  return (
    <div className="layout-container">
      <aside className={`sidebar glass-panel ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="brand">
            {renderBrandIcon()}
            <h2>{settings.business_name}</h2>
          </div>
          <button className="mobile-close" onClick={toggleMobileMenu}>
            <X size={24} />
          </button>
        </div>

        <div className="user-profile">
          <div className="avatar">{user?.username?.charAt(0).toUpperCase()}</div>
          <div className="user-info">
            <span className="user-name">{user?.username}</span>
            <span className="user-role">{user?.role}</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              to={item.path}
              key={item.path}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              {item.icon}
              <span>{item.name}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
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
          <button className="mobile-toggle" onClick={toggleMobileMenu}>
            <Menu size={24} />
          </button>
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
