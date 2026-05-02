import { useEffect, useMemo, useState } from 'react';
import { ImagePlus, KeyRound, Save, Settings, Shield, Trash2, User, UserPlus } from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { getCacheableSettings } from '../hooks/useSystemSettings';
import './Products.css';

const defaultSettings = {
  business_name: 'Liquor POS',
  business_logo_url: '',
  receipt_footer: 'Thank you for your business.',
  payment_account_type: '',
  payment_account_number: '',
  default_low_stock_level: 5,
  high_value_price_threshold: 10000,
  high_value_low_stock_level: 2,
  minimum_margin_threshold: 15,
};

const defaultInvite = {
  username: '',
  password: '',
  role: 'cashier',
};

const defaultPasswordForm = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024;

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
  const [toast, setToast] = useState(null);

  const activeEmployees = useMemo(
    () => staff.filter((member) => member.role !== 'admin'),
    [staff]
  );
  const isAdmin = user?.role === 'admin';

  const setFeedback = (nextMessage = '', nextError = '') => {
    const text = nextError || nextMessage;
    if (!text) {
      setToast(null);
      return;
    }

    setToast({ message: text, type: nextError ? 'error' : 'success' });
    window.setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => {
    fetchAdminData();
  }, [user?.role]);

  const fetchAdminData = async () => {
    if (user?.role !== 'admin') {
      setLoading(false);
      return;
    }

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
          minimum_margin_threshold: Number(settings.minimum_margin_threshold),
        };
      const response = await api.put('/settings', payload);
      const nextSettings = { ...defaultSettings, ...(response.data.data || {}) };
      setSettings(nextSettings);
      localStorage.setItem('system_settings_cache', JSON.stringify(getCacheableSettings(nextSettings)));
      setFeedback('Business settings saved successfully.');
    } catch (err) {
      console.error('Failed to save settings', err);
      setFeedback('', err.response?.data?.message || 'Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleLogoFileChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setFeedback('', 'Please choose an image file for the business logo.');
      event.target.value = '';
      return;
    }

    if (file.size > MAX_LOGO_SIZE_BYTES) {
      setFeedback('', 'Logo image must be 2MB or smaller.');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setSettings((prev) => ({ ...prev, business_logo_url: reader.result }));
      setFeedback('Logo selected. Save settings to apply it across the system.');
    };
    reader.onerror = () => {
      setFeedback('', 'Could not read the selected logo file.');
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const handleRemoveLogo = () => {
    setSettings((prev) => ({ ...prev, business_logo_url: '' }));
    setFeedback('Logo removed. Save settings to apply the change.');
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      setCreatingUser(true);
      const response = await api.post('/users', inviteForm);
      setStaff((prev) => [...prev, response.data.data]);
      setInviteForm(defaultInvite);
      setFeedback('Team member added successfully.');
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
        <div className="page-header-copy">
          <h1 className="page-title">{isAdmin ? 'Admin Console' : 'Account Settings'}</h1>
          <p className="page-subtitle">
            {isAdmin
              ? 'Manage business identity, stock alert policies, and employee roles from one place.'
              : 'Review your sign-in details and update your password securely.'}
          </p>
        </div>
      </div>

      {toast && (
        <div className={`toast-popup ${toast.type === 'error' ? 'error' : 'success'}`}>
          {toast.message}
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
            {isAdmin ? (
              <>
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
              </>
            ) : (
              <>
                <div className="glass-panel admin-stat-card">
                  <span className="admin-stat-label">Role</span>
                  <strong className="text-capitalize">{user?.role || 'staff'}</strong>
                  <span className="td-secondary">Your current POS access level</span>
                </div>
                <div className="glass-panel admin-stat-card">
                  <span className="admin-stat-label">Security</span>
                  <strong>Password</strong>
                  <span className="td-secondary">Use the form below to update your login password</span>
                </div>
              </>
            )}
          </div>

          <div className="admin-page-grid">
            {isAdmin && (
            <div className="glass-panel main-panel admin-section-card">
              <div className="detail-header admin-section-header">
                <div className="page-header-copy">
                  <h2 className="section-heading">
                    <Settings size={20} /> Business Identity
                  </h2>
                  <p className="page-subtitle">These settings control receipts and the app shell.</p>
                </div>
              </div>

              <form onSubmit={handleSaveSettings} className="admin-form-grid">
                <div className="form-field form-field-full">
                  <label>Business Name</label>
                  <input value={settings.business_name} onChange={(e) => setSettings((prev) => ({ ...prev, business_name: e.target.value }))} />
                </div>
                <div className="form-field form-field-full">
                  <label>Business Logo</label>
                  <div className="logo-upload-row">
                    <label className="icon-btn logo-upload-btn" htmlFor="businessLogoUpload">
                      <ImagePlus size={18} /> Choose Logo File
                    </label>
                    <input
                      id="businessLogoUpload"
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                      onChange={handleLogoFileChange}
                      className="sr-only-input"
                    />
                    {settings.business_logo_url && (
                      <button type="button" className="icon-btn" onClick={handleRemoveLogo}>
                        Remove Logo
                      </button>
                    )}
                  </div>
                  <span className="td-secondary">Upload a PNG, JPG, WEBP, or SVG file up to 2MB.</span>
                </div>
                <div className="form-field form-field-full">
                  <label>Sales Receipt Footer</label>
                  <textarea
                    value={settings.receipt_footer}
                    onChange={(e) => setSettings((prev) => ({ ...prev, receipt_footer: e.target.value }))}
                    rows="3"
                  />
                </div>
                <div className="form-field">
                  <label>Payment Account Type</label>
                  <select
                    value={settings.payment_account_type}
                    onChange={(e) => setSettings((prev) => ({ ...prev, payment_account_type: e.target.value }))}
                  >
                    <option value="">None</option>
                    <option value="paybill">Paybill</option>
                    <option value="till">Till Number</option>
                  </select>
                </div>
                <div className="form-field">
                  <label>Paybill / Till Number</label>
                  <input
                    value={settings.payment_account_number}
                    onChange={(e) => setSettings((prev) => ({ ...prev, payment_account_number: e.target.value }))}
                    placeholder="e.g. 123456"
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
                <div className="form-field">
                  <label>Minimum Margin Alert (%)</label>
                  <input type="number" min="0" value={settings.minimum_margin_threshold} onChange={(e) => setSettings((prev) => ({ ...prev, minimum_margin_threshold: e.target.value }))} />
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
                    <div className="preview-summary">
                      <div className="font-medium">{settings.business_name}</div>
                      <div className="td-secondary">{settings.payment_account_type && settings.payment_account_number
                        ? `${settings.payment_account_type === 'paybill' ? 'Paybill' : 'Till'}: ${settings.payment_account_number}`
                        : 'No payment account on receipt'}</div>
                    </div>
                  </div>
                  <div className="glass-panel admin-note-card">
                    <h3 className="section-heading">Stock Alert Rules</h3>
                    <p className="section-note">
                      Variants default to the low-stock level above. If a variant&apos;s retail price meets or exceeds the high-value price threshold,
                      the warning automatically uses the high-value threshold instead.
                    </p>
                    <div className="chip-stack">
                      <div className="report-meta-chip">Default: {settings.default_low_stock_level} units</div>
                      <div className="report-meta-chip">
                        High-value items at KES {Number(settings.high_value_price_threshold || 0).toLocaleString()} use {settings.high_value_low_stock_level} units
                      </div>
                      <div className="report-meta-chip">
                        Margin warnings trigger below {Number(settings.minimum_margin_threshold || 0).toLocaleString()}%
                      </div>
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
            )}

            <div className="admin-side-stack">
              {!isAdmin && (
                <div className="glass-panel main-panel admin-section-card">
                  <div className="detail-header admin-section-header">
                    <div className="page-header-copy">
                      <h2 className="section-heading">
                        <User size={20} /> Profile
                      </h2>
                      <p className="page-subtitle">Your current access and identity inside the POS.</p>
                    </div>
                  </div>
                  <div className="account-summary-card glass-panel">
                    <div className="account-summary-row">
                      <span className="admin-stat-label">Username</span>
                      <strong>{user?.username || 'Unknown user'}</strong>
                    </div>
                    <div className="account-summary-row">
                      <span className="admin-stat-label">Email</span>
                      <span className="td-secondary">{user?.email || 'No email on file'}</span>
                    </div>
                    <div className="account-summary-row">
                      <span className="admin-stat-label">Role</span>
                      <span className="report-meta-chip text-capitalize">{user?.role || 'staff'}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="glass-panel main-panel admin-section-card">
                <div className="detail-header admin-section-header">
                  <div className="page-header-copy">
                    <h2 className="section-heading">
                      <KeyRound size={20} /> Change Password
                    </h2>
                    <p className="page-subtitle">Update your login password from one secure place.</p>
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

              {isAdmin && (
              <div className="glass-panel main-panel admin-section-card">
                <div className="detail-header admin-section-header">
                  <div className="page-header-copy">
                    <h2 className="section-heading">
                      <Shield size={20} /> Team Roles
                    </h2>
                    <p className="page-subtitle">Add staff manually, set their password, adjust roles, and remove old accounts completely.</p>
                  </div>
                  <div className="report-meta-chip">Active staff: {activeEmployees.length}</div>
                </div>

                <form onSubmit={handleCreateUser} className="admin-form-grid admin-staff-form">
                  <div className="form-field">
                    <label>Username</label>
                    <input required value={inviteForm.username} onChange={(e) => setInviteForm((prev) => ({ ...prev, username: e.target.value }))} />
                  </div>
                  <div className="form-field">
                    <label>Password</label>
                    <input required type="password" minLength="6" value={inviteForm.password} onChange={(e) => setInviteForm((prev) => ({ ...prev, password: e.target.value }))} />
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
                      <UserPlus size={18} /> {creatingUser ? 'Adding...' : 'Add Staff'}
                    </button>
                  </div>
                </form>

                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Username</th>
                        <th>Role</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeEmployees.map((member) => (
                        <tr key={member._id}>
                          <td className="font-medium">{member.username}</td>
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
                          <td colSpan="3" className="empty-state">No employees on the roster yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminPanel;
