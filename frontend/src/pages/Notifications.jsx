import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Bell, CheckCircle2, ClipboardCheck, RefreshCw } from 'lucide-react';
import api from '../utils/api';
import PaginationControls from '../components/PaginationControls';
import './Products.css';
import './Reports.css';
import './Notifications.css';

const NOTIFICATION_PAGE_SIZE = 8;

const severityTone = {
  critical: 'notification-critical',
  warning: 'notification-warning',
  info: 'notification-info'
};

const typeLabel = {
  inventory: 'Inventory',
  supplier: 'Supplier',
  system: 'System change',
  custom: 'Admin note'
};

const isSystemChange = (notification) => (
  notification.type === 'system'
  || notification.source_key?.startsWith('price-change:')
  || notification.source_key?.startsWith('average-cost:')
);

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [statusFilter, setStatusFilter] = useState('open');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [addressingId, setAddressingId] = useState('');
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [notificationPage, setNotificationPage] = useState(1);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3200);
  };

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await api.get('/notifications', { params: { status: 'all' } });
      setNotifications(response.data.data || []);
    } catch (error) {
      console.error('Failed to load notifications', error);
      showToast(error.response?.data?.message || 'Failed to load notifications', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const visibleNotifications = useMemo(() => (
    statusFilter === 'all'
      ? notifications
      : notifications.filter((item) => item.status === statusFilter)
  ), [notifications, statusFilter]);

  useEffect(() => {
    setNotificationPage(1);
  }, [statusFilter]);

  const notificationTotalPages = Math.max(1, Math.ceil(visibleNotifications.length / NOTIFICATION_PAGE_SIZE));
  const safeNotificationPage = Math.min(Math.max(notificationPage, 1), notificationTotalPages);
  const paginatedNotifications = visibleNotifications.slice(
    (safeNotificationPage - 1) * NOTIFICATION_PAGE_SIZE,
    safeNotificationPage * NOTIFICATION_PAGE_SIZE
  );

  const counts = useMemo(() => ({
    open: notifications.filter((item) => item.status === 'open').length,
    critical: notifications.filter((item) => item.status === 'open' && item.severity === 'critical').length,
    addressed: notifications.filter((item) => item.status === 'addressed').length,
    changes: notifications.filter(isSystemChange).length
  }), [notifications]);

  const handleAddress = async (notification) => {
    try {
      setAddressingId(notification._id);
      await api.patch(`/notifications/${notification._id}/address`, {
        resolution_note: 'Reviewed and addressed from the notifications tab.'
      });
      showToast('Notification marked as addressed.');
      await fetchNotifications();
    } catch (error) {
      console.error('Failed to address notification', error);
      showToast(error.response?.data?.message || 'Failed to address notification', 'error');
    } finally {
      setAddressingId('');
    }
  };

  const handleAddressAll = async () => {
    try {
      setMarkingAllRead(true);
      await api.patch('/notifications/address-all', {
        resolution_note: 'Marked as read from the notifications tab.'
      });
      showToast('All open notifications marked as read.');
      await fetchNotifications();
    } catch (error) {
      console.error('Failed to mark all notifications as read', error);
      showToast(error.response?.data?.message || 'Failed to mark all notifications as read', 'error');
    } finally {
      setMarkingAllRead(false);
    }
  };

  return (
    <div className="page-container animate-fade-in notifications-page">
      {toast && (
        <div className={`toast-popup ${toast.type === 'error' ? 'error' : 'success'}`}>
          {toast.message}
        </div>
      )}

      <div className="page-header">
        <div className="page-header-copy">
          <h1 className="page-title">Notifications & Changes</h1>
          <p className="page-subtitle">Track admin concerns and important system changes, including supplier price movements and average-cost updates.</p>
        </div>
        <div className="page-header-actions">
          <div className="toolbar-control compact">
            <label>Status</label>
            <select className="field-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="open">Open concerns</option>
              <option value="addressed">Addressed</option>
              <option value="all">All notifications</option>
            </select>
          </div>
          <div className="notification-toolbar-actions">
            <button className="icon-btn" type="button" onClick={fetchNotifications}>
              <RefreshCw size={18} /> Refresh
            </button>
            <button className="primary-btn" type="button" onClick={handleAddressAll} disabled={counts.open === 0 || markingAllRead}>
              <ClipboardCheck size={18} /> {markingAllRead ? 'Marking...' : 'Mark All as Read'}
            </button>
          </div>
        </div>
      </div>

      <div className="reports-grid">
        <div className="stat-card glass-panel">
          <div className="report-stat-icon tone-warning"><Bell size={24} /></div>
          <div className="report-stat-copy">
            <h3>Open</h3>
            <p className="stat-number">{counts.open}</p>
          </div>
        </div>
        <div className="stat-card glass-panel">
          <div className="report-stat-icon tone-danger"><AlertTriangle size={24} /></div>
          <div className="report-stat-copy">
            <h3>Critical</h3>
            <p className="stat-number">{counts.critical}</p>
          </div>
        </div>
        <div className="stat-card glass-panel">
          <div className="report-stat-icon tone-success"><CheckCircle2 size={24} /></div>
          <div className="report-stat-copy">
            <h3>Addressed</h3>
            <p className="stat-number">{counts.addressed}</p>
          </div>
        </div>
        <div className="stat-card glass-panel">
          <div className="report-stat-icon tone-sky"><RefreshCw size={24} /></div>
          <div className="report-stat-copy">
            <h3>System Changes</h3>
            <p className="stat-number">{counts.changes}</p>
          </div>
        </div>
      </div>

      <div className="glass-panel main-panel notification-list-panel">
        {loading ? (
          <div className="loading-panel">
            <div className="loading-spinner" />
            <p>Loading notifications...</p>
          </div>
        ) : visibleNotifications.length ? (
          <>
            <div className="notification-list">
              {paginatedNotifications.map((notification) => (
                <div className={`notification-card ${severityTone[notification.severity] || severityTone.info}`} key={notification._id}>
                  <div className="notification-icon">
                    {notification.status === 'addressed'
                      ? <CheckCircle2 size={22} />
                      : isSystemChange(notification) ? <RefreshCw size={22} /> : <AlertTriangle size={22} />}
                  </div>
                  <div className="notification-copy">
                    <div className="notification-title-row">
                      <h3>{notification.title}</h3>
                      <span className="badge text-capitalize">{notification.severity}</span>
                      <span className="report-meta-chip">{typeLabel[notification.type] || 'Notification'}</span>
                    </div>
                    <p>{notification.message}</p>
                    <div className="td-secondary">
                      {notification.status === 'addressed'
                        ? `Addressed ${notification.addressed_at ? new Date(notification.addressed_at).toLocaleString() : ''} by ${notification.addressed_by?.username || 'system'}`
                        : `Updated ${new Date(notification.updatedAt || notification.createdAt).toLocaleString()}`}
                    </div>
                  </div>
                  <div className="notification-actions">
                    {notification.status === 'open' ? (
                      <button className="primary-btn" type="button" onClick={() => handleAddress(notification)} disabled={addressingId === notification._id}>
                        <ClipboardCheck size={18} /> {addressingId === notification._id ? 'Addressing...' : 'Mark Addressed'}
                      </button>
                    ) : (
                      <span className="report-meta-chip">Done</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <PaginationControls
              totalItems={visibleNotifications.length}
              pageSize={NOTIFICATION_PAGE_SIZE}
              currentPage={safeNotificationPage}
              onPageChange={setNotificationPage}
              label="notifications"
            />
          </>
        ) : (
          <div className="empty-state">No notifications in this view.</div>
        )}
      </div>
    </div>
  );
};

export default Notifications;
