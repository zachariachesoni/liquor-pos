import { useEffect, useMemo, useState } from 'react';
import { ImagePlus, KeyRound, Save, Settings, Shield, Trash2, UserPlus } from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import './Products.css';

const defaultSettings = {
  business_name: 'Liquor POS',
  business_logo_url: '',
  receipt_footer: 'Thank you for your business.',
  default_low_stock_level: 5,
  high_value_price_threshold: 10000,
  high_value_low_stock_level: 2,
};

const defaultInvite = {
  username: '',
  email: '',
  role: 'cashier',
};

const defaultPasswordForm = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

const AdminPanel = () => {
  const { user, changePassword } = useAuth();
  const [settings, setSettings] = useState(defaultSettings);
  const [staff, setStaff] = useState([]);
  const [inviteForm, setInviteForm] = useState(defaultInvite);
  const [passwordForm, setPasswordForm] = useState(defaultPasswordForm);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const activeEmployees = useMemo(
    () => staff.filter((member) => member.role !== 'admin'),
    [staff]
  );

  const setFeedback = (nextMessage = '', nextError = '') => {
    setMessage(nextMessage);
    setError(nextError);
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      const [settingsResponse, usersResponse] = await Promise.all([
        api.get('/settings'),
        api.get('/users'),
      ]);

      setSettings({ ...defaultSettings, ...(settingsResponse.data.data || {}) });
      setStaff(usersResponse.data.data || []);
      setFeedback();
    } catch (err) {
      console.error('Failed to load admin data', err);
      setFeedback('', err.response?.data?.message || 'Failed to load admin settings');
    } finally {
      setLoading(false);
    }
  };

  const updateStaffRole = async (userId, nextRole) => {
    try {
      const current = activeEmployees.find((member) => member._id === userId);
      if (!current) return;

      const response = await api.put(`/users/${userId}`, {
        username: current.username,
        email: current.email,
        role: nextRole,
      });

      setStaff((prev) => prev.map((member) => (
        member._id === userId ? response.data.data : member
      )));
      setFeedback('Staff role updated successfully.');
    } catch (err) {
      console.error('Failed to update staff role', err);
      setFeedback('', err.response?.data?.message || 'Failed to update role');
    }
  };

  const handleDeleteUser = async (member) => {
    if (!window.confirm(`Remove ${member.username} from the system entirely?`)) {
      return;
    }

    try {
      await api.delete(`/users/${member._id}`);
      setStaff((prev) => prev.filter((entry) => entry._id !== member._id));
      setFeedback(`${member.username} removed successfully.`);
    } catch (err) {
      console.error('Failed to delete employee', err);
      setFeedback('', err.response?.data?.message || 'Failed to remove employee');
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      setSavingSettings(true);
      const payload = {
        ...settings,
        default_low_stock_level: Number(settings.default_low_stock_level),
        high_value_price_threshold: Number(settings.high_value_price_threshold),
        high_value_low_stock_level: Number(settings.high_value_low_stock_level),
      };
      const response = await api.put('/settings', payload);
      setSettings({ ...defaultSettings, ...(response.data.data || {}) });
      setFeedback('Business settings saved successfully.');
    } catch (err) {
      console.error('Failed to save settings', err);
      setFeedback('', err.response?.data?.message || 'Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      setCreatingUser(true);
      const response = await api.post('/users', inviteForm);
      setStaff((prev) => [...prev, response.data.data]);
      setInviteForm(defaultInvite);
      setFeedback(
        response.data.emailSent
          ? 'Team member invited successfully.'
          : `Team member created. Temporary password: ${response.data.temporaryPassword}`
      );
    } catch (err) {
      console.error('Failed to create staff account', err);
      setFeedback('', err.response?.data?.message || 'Failed to create staff account');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (passwordForm.newPassword.length < 6) {
      setFeedback('', 'New password must be at least 6 characters long.');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setFeedback('', 'New password and confirmation do not match.');
      return;
    }

    try {
      setChangingPassword(true);
      const result = await changePassword(passwordForm.currentPassword, passwordForm.newPassword);

      if (!result.success) {
        setFeedback('', result.message);
        return;
      }

      setPasswordForm(defaultPasswordForm);
      setFeedback(result.message || 'Password changed successfully.');
    } catch (err) {
      console.error('Failed to change password', err);
      setFeedback('', 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="page-container animate-fade-in admin-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">Admin Console</h1>
          <p className="page-subtitle">Manage business identity, stock alert policies, employee roles, and your account from one place.</p>
        </div>
      </div>

      {(message || error) && (
        <div className={`feedback-banner ${error ? 'error' : 'success'}`}>
          {error || message}
        </div>
      )}

      {loading ? (
        <div className="glass-panel main-panel loading-panel">
          <div className="loading-spinner" />
          <p>Loading admin controls...</p>
        </div>
      ) : (
        <>
          <div className="admin-overview-grid">
            <div className="glass-panel admin-stat-card">
              <span className="admin-stat-label">Signed in as</span>
              <strong>{user?.username || 'Admin'}</strong>
              <span className="td-secondary">{user?.email || 'No email on file'}</span>
            </div>
            <div className="glass-panel admin-stat-card">
              <span className="admin-stat-label">Active staff</span>
              <strong>{activeEmployees.length}</strong>
              <span className="td-secondary">Managers and cashiers currently on the roster</span>
            </div>
            <div className="glass-panel admin-stat-card">
              <span className="admin-stat-label">Current stock rule</span>
              <strong>{settings.default_low_stock_level} units</strong>
              <span className="td-secondary">High-value goods switch to {settings.high_value_low_stock_level} units</span>
            </div>
          </div>

          <div className="admin-page-grid">
            <div className="glass-panel main-panel admin-section-card">
              <div className="detail-header admin-section-header">
                <div>
                  <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <Settings size={20} /> Business Identity
                  </h2>
                  <p className="page-subtitle">These settings flow through receipts, invoices, reports, and the app shell.</p>
                </div>
              </div>

              <form onSubmit={handleSaveSettings} className="admin-form-grid">
                <div className="form-field form-field-full">
                  <label>Business Name</label>
                  <input value={settings.business_name} onChange={(e) => setSettings((prev) => ({ ...prev, business_name: e.target.value }))} />
                </div>
                <div className="form-field form-field-full">
                  <label>Business Logo URL</label>
                  <input value={settings.business_logo_url} onChange={(e) => setSettings((prev) => ({ ...prev, business_logo_url: e.target.value }))} placeholder="https://example.com/logo.png" />
                </div>
                <div className="form-field form-field-full">
                  <label>Receipt / Report Footer</label>
                  <textarea
                    value={settings.receipt_footer}
                    onChange={(e) => setSettings((prev) => ({ ...prev, receipt_footer: e.target.value }))}
                    rows="3"
                  />
                </div>
                <div className="form-field">
                  <label>Default Low-Stock Threshold</label>
                  <input type="number" min="0" value={settings.default_low_stock_level} onChange={(e) => setSettings((prev) => ({ ...prev, default_low_stock_level: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label>High-Value Price Threshold</label>
                  <input type="number" min="0" value={settings.high_value_price_threshold} onChange={(e) => setSettings((prev) => ({ ...prev, high_value_price_threshold: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label>High-Value Low-Stock Threshold</label>
                  <input type="number" min="0" value={settings.high_value_low_stock_level} onChange={(e) => setSettings((prev) => ({ ...prev, high_value_low_stock_level: e.target.value }))} />
                </div>
                <div className="form-field form-field-full admin-inline-grid">
                  <div className="glass-panel admin-preview-card">
                    <div className="admin-card-title">
                      <ImagePlus size={18} />
                      <strong>Preview</strong>
                    </div>
                    {settings.business_logo_url ? (
                      <img src={settings.business_logo_url} alt={settings.business_name} className="admin-preview-logo" />
                    ) : (
                      <div className="admin-preview-logo admin-preview-placeholder">
                        No logo set
                      </div>
                    )}
                    <div style={{ marginTop: '0.85rem' }}>
                      <div className="font-medium">{settings.business_name}</div>
                      <div className="td-secondary">{settings.receipt_footer}</div>
                    </div>
                  </div>
                  <div className="glass-panel admin-note-card">
                    <h3 style={{ marginBottom: '0.5rem' }}>Stock Alert Rules</h3>
                    <p className="td-secondary" style={{ marginBottom: '0.75rem' }}>
                      Variants default to the low-stock level above. If a variant&apos;s retail price meets or exceeds the high-value price threshold,
                      the warning automatically uses the high-value threshold instead.
                    </p>
                    <div className="report-meta-chip">Default: {settings.default_low_stock_level} units</div>
                    <div className="report-meta-chip" style={{ marginTop: '0.65rem', display: 'inline-flex' }}>
                      High-value items at KES {Number(settings.high_value_price_threshold || 0).toLocaleString()} use {settings.high_value_low_stock_level} units
                    </div>
                  </div>
                </div>
                <div className="form-actions form-field-full">
                  <button className="primary-btn" type="submit" disabled={savingSettings}>
                    <Save size={18} /> {savingSettings ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </form>
            </div>

            <div className="admin-side-stack">
              <div className="glass-panel main-panel admin-section-card">
                <div className="detail-header admin-section-header">
                  <div>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <KeyRound size={20} /> Change Password
                    </h2>
                    <p className="page-subtitle">Update the admin password from one secure place.</p>
                  </div>
                </div>

                <form onSubmit={handleChangePassword} className="admin-form-grid">
                  <div className="form-field form-field-full">
                    <label>Current Password</label>
                    <input
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                    />
                  </div>
                  <div className="form-field">
                    <label>New Password</label>
                    <input
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                    />
                  </div>
                  <div className="form-field">
                    <label>Confirm New Password</label>
                    <input
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                    />
                  </div>
                  <div className="form-actions form-field-full">
                    <button className="primary-btn" type="submit" disabled={changingPassword}>
                      <KeyRound size={18} /> {changingPassword ? 'Updating...' : 'Update Password'}
                    </button>
                  </div>
                </form>
              </div>

              <div className="glass-panel main-panel admin-section-card">
                <div className="detail-header admin-section-header">
                  <div>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <Shield size={20} /> Team Roles
                    </h2>
                    <p className="page-subtitle">Invite staff, adjust role assignments, and remove old accounts completely.</p>
                  </div>
                  <div className="report-meta-chip">Active staff: {activeEmployees.length}</div>
                </div>

                <form onSubmit={handleCreateUser} className="admin-form-grid admin-staff-form">
                  <div className="form-field">
                    <label>Username</label>
                    <input required value={inviteForm.username} onChange={(e) => setInviteForm((prev) => ({ ...prev, username: e.target.value }))} />
                  </div>
                  <div className="form-field">
                    <label>Email</label>
                    <input required type="email" value={inviteForm.email} onChange={(e) => setInviteForm((prev) => ({ ...prev, email: e.target.value }))} />
                  </div>
                  <div className="form-field">
                    <label>Role</label>
                    <select value={inviteForm.role} onChange={(e) => setInviteForm((prev) => ({ ...prev, role: e.target.value }))}>
                      <option value="manager">Manager</option>
                      <option value="cashier">Cashier</option>
                    </select>
                  </div>
                  <div className="form-actions form-actions-stretch">
                    <button className="primary-btn" type="submit" disabled={creatingUser}>
                      <UserPlus size={18} /> {creatingUser ? 'Inviting...' : 'Add Staff'}
                    </button>
                  </div>
                </form>

                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Username</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeEmployees.map((member) => (
                        <tr key={member._id}>
                          <td className="font-medium">{member.username}</td>
                          <td>{member.email || 'No email'}</td>
                          <td>
                            <select value={member.role} onChange={(e) => updateStaffRole(member._id, e.target.value)} className="table-select">
                              <option value="manager">Manager</option>
                              <option value="cashier">Cashier</option>
                            </select>
                          </td>
                          <td className="text-right">
                            <button className="action-icon text-danger" onClick={() => handleDeleteUser(member)} title="Remove employee">
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {activeEmployees.length === 0 && (
                        <tr>
                          <td colSpan="4" className="empty-state">No employees on the roster yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminPanel;
