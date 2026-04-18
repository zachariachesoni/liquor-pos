import { useState } from 'react';
import { KeyRound, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './Products.css';

const defaultPasswordForm = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

const Account = () => {
  const { user, changePassword } = useAuth();
  const [passwordForm, setPasswordForm] = useState(defaultPasswordForm);
  const [changingPassword, setChangingPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const setFeedback = (nextMessage = '', nextError = '') => {
    setMessage(nextMessage);
    setError(nextError);
  };

  const handleChangePassword = async (event) => {
    event.preventDefault();

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
      setFeedback('', 'Failed to change password.');
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="page-container animate-fade-in admin-shell">
      <div className="page-header">
        <div className="page-header-copy">
          <h1 className="page-title">My Account</h1>
          <p className="page-subtitle">Review your sign-in details and update your password securely.</p>
        </div>
      </div>

      {(message || error) && (
        <div className={`feedback-banner ${error ? 'error' : 'success'}`}>
          {error || message}
        </div>
      )}

      <div className="admin-page-grid account-page-grid">
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
              <span className="report-meta-chip">{user?.role || 'staff'}</span>
            </div>
          </div>
        </div>

        <div className="glass-panel main-panel admin-section-card">
          <div className="detail-header admin-section-header">
            <div className="page-header-copy">
              <h2 className="section-heading">
                <KeyRound size={20} /> Change Password
              </h2>
              <p className="page-subtitle">Use your current password, then choose a new one with at least 6 characters.</p>
            </div>
          </div>

          <form onSubmit={handleChangePassword} className="admin-form-grid">
            <div className="form-field form-field-full">
              <label>Current Password</label>
              <input
                type="password"
                value={passwordForm.currentPassword}
                onChange={(event) => setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))}
              />
            </div>
            <div className="form-field">
              <label>New Password</label>
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={(event) => setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))}
              />
            </div>
            <div className="form-field">
              <label>Confirm New Password</label>
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(event) => setPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
              />
            </div>
            <div className="form-actions form-field-full">
              <button className="primary-btn" type="submit" disabled={changingPassword}>
                <KeyRound size={18} /> {changingPassword ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Account;
