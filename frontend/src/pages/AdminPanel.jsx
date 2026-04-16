import { useEffect, useMemo, useState } from 'react';
import { ImagePlus, Save, Settings, Shield, Trash2, UserPlus } from 'lucide-react';
import api from '../utils/api';
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

const AdminPanel = () => {
  const [settings, setSettings] = useState(defaultSettings);
  const [staff, setStaff] = useState([]);
  const [inviteForm, setInviteForm] = useState(defaultInvite);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const activeEmployees = useMemo(
    () => staff.filter((member) => member.role !== 'admin'),
    [staff]
  );

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
      setError('');
    } catch (err) {
      console.error('Failed to load admin data', err);
      setError(err.response?.data?.message || 'Failed to load admin settings');
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
      setMessage('Staff role updated successfully.');
      setError('');
    } catch (err) {
      console.error('Failed to update staff role', err);
      setError(err.response?.data?.message || 'Failed to update role');
    }
  };

  const handleDeleteUser = async (member) => {
    if (!window.confirm(`Remove ${member.username} from the system entirely?`)) {
      return;
    }

    try {
      await api.delete(`/users/${member._id}`);
      setStaff((prev) => prev.filter((entry) => entry._id !== member._id));
      setMessage(`${member.username} removed successfully.`);
      setError('');
    } catch (err) {
      console.error('Failed to delete employee', err);
      setError(err.response?.data?.message || 'Failed to remove employee');
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
      setMessage('Business settings saved successfully.');
      setError('');
    } catch (err) {
      console.error('Failed to save settings', err);
      setError(err.response?.data?.message || 'Failed to save settings');
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
      setMessage(response.data.emailSent
        ? 'Team member invited successfully.'
        : `Team member created. Temporary password: ${response.data.temporaryPassword}`);
      setError('');
    } catch (err) {
      console.error('Failed to create staff account', err);
      setError(err.response?.data?.message || 'Failed to create staff account');
    } finally {
      setCreatingUser(false);
    }
  };

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Admin Console</h1>
          <p className="page-subtitle">Manage business identity, stock alert policies, and employee roles from one place.</p>
        </div>
      </div>

      {(message || error) && (
        <div style={{
          padding: '1rem 1.1rem',
          borderRadius: '14px',
          border: `1px solid ${error ? 'var(--danger)' : 'var(--success)'}`,
          background: error ? 'var(--danger-bg)' : 'var(--success-bg)',
          color: error ? 'var(--danger)' : 'var(--success)',
        }}>
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
          <div className="glass-panel main-panel" style={{ padding: '1.5rem' }}>
            <div className="detail-header">
              <div>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <Settings size={20} /> Business Identity
                </h2>
                <p className="page-subtitle">These settings flow through receipts, invoices, reports, and the app shell.</p>
              </div>
            </div>

            <form onSubmit={handleSaveSettings} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '1rem' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label>Business Name</label>
                <input value={settings.business_name} onChange={(e) => setSettings((prev) => ({ ...prev, business_name: e.target.value }))} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label>Business Logo URL</label>
                <input value={settings.business_logo_url} onChange={(e) => setSettings((prev) => ({ ...prev, business_logo_url: e.target.value }))} placeholder="https://example.com/logo.png" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label>Receipt / Report Footer</label>
                <textarea
                  value={settings.receipt_footer}
                  onChange={(e) => setSettings((prev) => ({ ...prev, receipt_footer: e.target.value }))}
                  rows="3"
                  style={{ width: '100%', padding: '0.75rem', background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--text-color)', borderRadius: '8px' }}
                />
              </div>
              <div>
                <label>Default Low-Stock Threshold</label>
                <input type="number" min="0" value={settings.default_low_stock_level} onChange={(e) => setSettings((prev) => ({ ...prev, default_low_stock_level: e.target.value }))} />
              </div>
              <div>
                <label>High-Value Price Threshold</label>
                <input type="number" min="0" value={settings.high_value_price_threshold} onChange={(e) => setSettings((prev) => ({ ...prev, high_value_price_threshold: e.target.value }))} />
              </div>
              <div>
                <label>High-Value Low-Stock Threshold</label>
                <input type="number" min="0" value={settings.high_value_low_stock_level} onChange={(e) => setSettings((prev) => ({ ...prev, high_value_low_stock_level: e.target.value }))} />
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'minmax(220px, 280px) 1fr', gap: '1rem', alignItems: 'start' }}>
                <div className="glass-panel" style={{ padding: '1rem', borderRadius: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.8rem' }}>
                    <ImagePlus size={18} />
                    <strong>Preview</strong>
                  </div>
                  {settings.business_logo_url ? (
                    <img src={settings.business_logo_url} alt={settings.business_name} style={{ width: '100%', maxHeight: '120px', objectFit: 'contain', borderRadius: '12px', background: 'rgba(255,255,255,0.04)', padding: '0.75rem' }} />
                  ) : (
                    <div style={{ minHeight: '120px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)' }}>
                      No logo set
                    </div>
                  )}
                  <div style={{ marginTop: '0.85rem' }}>
                    <div className="font-medium">{settings.business_name}</div>
                    <div className="td-secondary">{settings.receipt_footer}</div>
                  </div>
                </div>
                <div className="glass-panel" style={{ padding: '1rem', borderRadius: '16px' }}>
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
              <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
                <button className="primary-btn" type="submit" disabled={savingSettings}>
                  <Save size={18} /> {savingSettings ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>

          <div className="glass-panel main-panel" style={{ padding: '1.5rem' }}>
            <div className="detail-header">
              <div>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <Shield size={20} /> Team Roles
                </h2>
                <p className="page-subtitle">Invite staff, adjust role assignments, and remove old accounts completely.</p>
              </div>
              <div className="report-meta-chip">Active staff: {activeEmployees.length}</div>
            </div>

            <form onSubmit={handleCreateUser} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <label>Username</label>
                <input required value={inviteForm.username} onChange={(e) => setInviteForm((prev) => ({ ...prev, username: e.target.value }))} />
              </div>
              <div>
                <label>Email</label>
                <input required type="email" value={inviteForm.email} onChange={(e) => setInviteForm((prev) => ({ ...prev, email: e.target.value }))} />
              </div>
              <div>
                <label>Role</label>
                <select value={inviteForm.role} onChange={(e) => setInviteForm((prev) => ({ ...prev, role: e.target.value }))}>
                  <option value="manager">Manager</option>
                  <option value="cashier">Cashier</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button className="primary-btn" type="submit" disabled={creatingUser} style={{ width: '100%' }}>
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
                        <select value={member.role} onChange={(e) => updateStaffRole(member._id, e.target.value)} style={{ minWidth: '150px', padding: '0.55rem 0.75rem', background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--text-color)', borderRadius: '8px' }}>
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
        </>
      )}
    </div>
  );
};

export default AdminPanel;
