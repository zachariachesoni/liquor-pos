import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, ShoppingCart, Package, ClipboardList, FileBarChart, Users, Receipt, PieChart, LogOut, Menu, X, KeyRound, Shield } from 'lucide-react';
import { useSystemSettings } from '../hooks/useSystemSettings';
import './Layout.css';

const Layout = ({ children }) => {
  const { user, logout, changePassword } = useAuth();
  const { settings } = useSystemSettings();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={20} />, roles: ['admin', 'manager', 'cashier'] },
    { name: 'POS', path: '/pos', icon: <ShoppingCart size={20} />, roles: ['admin', 'manager', 'cashier'] },
    { name: 'Products', path: '/products', icon: <Package size={20} />, roles: ['admin', 'manager'] },
    { name: 'Inventory', path: '/inventory', icon: <ClipboardList size={20} />, roles: ['admin', 'manager'] },
    { name: 'Reports', path: '/reports', icon: <PieChart size={20} />, roles: ['admin', 'manager'] },
    { name: 'Sales', path: '/sales', icon: <FileBarChart size={20} />, roles: ['admin', 'manager'] },
    { name: 'Customers', path: '/customers', icon: <Users size={20} />, roles: ['admin', 'manager', 'cashier'] },
    { name: 'Admin', path: '/admin', icon: <Shield size={20} />, roles: ['admin'] },
    { name: 'Expenses', path: '/expenses', icon: <Receipt size={20} />, roles: ['admin', 'manager'] }
  ].filter((item) => user && item.roles.includes(user.role));

  const renderBrandIcon = () => (
    <div className="brand-icon">
      {settings.business_logo_url ? (
        <img src={settings.business_logo_url} alt={settings.business_name} />
      ) : (
        'L'
      )}
    </div>
  );

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordMessage('');

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New password and confirmation do not match');
      return;
    }

    setPasswordLoading(true);
    const result = await changePassword(passwordForm.currentPassword, passwordForm.newPassword);
    setPasswordLoading(false);

    if (!result.success) {
      setPasswordError(result.message);
      return;
    }

    setPasswordMessage(result.message);
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
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
          <button className="logout-btn" onClick={() => setShowPasswordModal(true)}>
            <KeyRound size={20} />
            <span>Change Password</span>
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
          <button className="mobile-toggle" onClick={toggleMobileMenu}>
            <Menu size={24} />
          </button>
        </header>

        <div className="page-content animate-fade-in">
          {children}
        </div>
      </main>

      {mobileMenuOpen && <div className="sidebar-overlay" onClick={toggleMobileMenu}></div>}

      {showPasswordModal && (
        <div className="modal-overlay">
          <div className="glass-panel modal-card">
            <button onClick={() => setShowPasswordModal(false)} style={{ position: 'absolute', right: '1rem', top: '1rem', background: 'transparent', border: 'none', color: 'var(--text-color)', cursor: 'pointer' }}>
              <X size={20} />
            </button>
            <h2 style={{ marginBottom: '1rem' }}>Change Password</h2>
            {passwordError && (
              <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', borderRadius: '8px', background: 'var(--danger-bg)', color: 'var(--danger)' }}>
                {passwordError}
              </div>
            )}
            {passwordMessage && (
              <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', borderRadius: '8px', background: 'var(--success-bg)', color: 'var(--success)' }}>
                {passwordMessage}
              </div>
            )}
            <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label>Current Password</label>
                <input type="password" required value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} style={{ width: '100%', padding: '0.6rem', background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--text-color)', borderRadius: '4px' }} />
              </div>
              <div>
                <label>New Password</label>
                <input type="password" required minLength={6} value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} style={{ width: '100%', padding: '0.6rem', background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--text-color)', borderRadius: '4px' }} />
              </div>
              <div>
                <label>Confirm New Password</label>
                <input type="password" required minLength={6} value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} style={{ width: '100%', padding: '0.6rem', background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--text-color)', borderRadius: '4px' }} />
              </div>
              <button type="submit" className="primary-btn" disabled={passwordLoading}>
                <KeyRound size={18} /> {passwordLoading ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout;
