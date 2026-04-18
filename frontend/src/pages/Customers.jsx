import React, { useEffect, useMemo, useState } from 'react';
import { UserPlus, Search, Phone, Mail, History, X, Download } from 'lucide-react';
import api from '../utils/api';
import { useSystemSettings } from '../hooks/useSystemSettings';
import './Products.css';
import './Customers.css';

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [historyCustomer, setHistoryCustomer] = useState(null);
  const [purchaseHistory, setPurchaseHistory] = useState([]);
  const [historySearch, setHistorySearch] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', customer_type: 'retail' });
  const { settings } = useSystemSettings();

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/customers');
      setCustomers(res.data.data || res.data);
    } catch (err) {
      console.error('Failed to load customers', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCustomer = async (e) => {
    e.preventDefault();
    try {
      await api.post('/customers', formData);
      setShowModal(false);
      fetchCustomers();
      setFormData({ name: '', phone: '', email: '', customer_type: 'retail' });
    } catch (err) {
      alert('Error creating customer');
      console.error(err);
    }
  };

  const openPurchaseHistory = async (customer) => {
    try {
      setHistoryCustomer(customer);
      setHistorySearch('');
      setHistoryLoading(true);
      const res = await api.get(`/customers/${customer._id}/purchase-history`);
      setPurchaseHistory(res.data.data || []);
    } catch (err) {
      console.error('Failed to load purchase history', err);
      setPurchaseHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const filtered = customers.filter((c) =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search)
  );

  const filteredHistory = useMemo(() => {
    const query = historySearch.trim().toLowerCase();
    if (!query) return purchaseHistory;

    return purchaseHistory.filter((sale) => {
      const itemMatch = (sale.items || []).some((item) =>
        [item.productName, item.category, item.size]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(query))
      );

      return (
        sale.invoice_number?.toLowerCase().includes(query) ||
        sale.payment_method?.toLowerCase().includes(query) ||
        itemMatch
      );
    });
  }, [historySearch, purchaseHistory]);

  const exportCustomerHistory = () => {
    if (!historyCustomer) return;

    const reportWindow = window.open('', '_blank', 'width=960,height=900');
    if (!reportWindow) return;

    const saleBlocks = filteredHistory.map((sale) => {
      const rows = (sale.items || []).map((item) => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${item.productName}<div style="font-size:12px;color:#666;">${item.size || ''}</div></td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${item.category}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center;">${item.quantity}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">KES ${Number(item.unit_price || 0).toLocaleString()}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">KES ${Number(item.subtotal || 0).toLocaleString()}</td>
        </tr>
      `).join('');

      return `
        <section style="margin-bottom:24px;border:1px solid #e5e7eb;border-radius:14px;padding:16px;">
          <div style="display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:12px;">
            <div>
              <strong>${sale.invoice_number}</strong>
              <div style="font-size:13px;color:#666;">${new Date(sale.createdAt).toLocaleString()}</div>
            </div>
            <div style="text-align:right;font-size:13px;">
              <div><strong>Payment:</strong> ${sale.payment_method}</div>
              <div><strong>Cashier:</strong> ${sale.user_id?.username || 'Unknown'}</div>
            </div>
          </div>
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr>
                <th style="text-align:left;padding:8px;border-bottom:2px solid #d1d5db;">Item</th>
                <th style="text-align:left;padding:8px;border-bottom:2px solid #d1d5db;">Category</th>
                <th style="text-align:center;padding:8px;border-bottom:2px solid #d1d5db;">Qty</th>
                <th style="text-align:right;padding:8px;border-bottom:2px solid #d1d5db;">Unit Price</th>
                <th style="text-align:right;padding:8px;border-bottom:2px solid #d1d5db;">Subtotal</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <div style="margin-top:12px;text-align:right;font-weight:700;">Sale Total: KES ${Number(sale.total_amount || 0).toLocaleString()}</div>
        </section>
      `;
    }).join('');

    reportWindow.document.write(`
      <html>
        <head>
          <title>${historyCustomer.name} Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 28px; color: #111827; }
            .header { display:flex; justify-content:space-between; gap:20px; flex-wrap:wrap; margin-bottom:28px; }
            .customer-meta { line-height:1.7; color:#374151; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 style="margin:0 0 8px 0;">${settings.business_name} Customer Report</h1>
              <div>${historyCustomer.name}</div>
            </div>
            <div class="customer-meta">
              <div><strong>Phone:</strong> ${historyCustomer.phone || 'N/A'}</div>
              <div><strong>Email:</strong> ${historyCustomer.email || 'N/A'}</div>
              <div><strong>Type:</strong> ${historyCustomer.customer_type || 'retail'}</div>
            </div>
          </div>
          <div style="margin-bottom:18px;font-weight:600;">Extracted invoices: ${filteredHistory.length}</div>
          ${saleBlocks || '<p>No purchase history matched the current search.</p>'}
          <p style="margin-top:24px;color:#6b7280;font-size:12px;">${settings.receipt_footer || ''}</p>
        </body>
      </html>
    `);
    reportWindow.document.close();
    reportWindow.focus();
    reportWindow.print();
  };

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">Manage customer profiles and purchase history.</p>
        </div>
        <button className="primary-btn" onClick={() => setShowModal(true)}>
          <UserPlus size={18} /> Add Customer
        </button>
      </div>

      <div className="glass-panel main-panel">
        <div className="panel-toolbar">
          <div className="search-box">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Search customers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="table-container">
          {loading ? (
            <div className="loading-panel"><div className="loading-spinner" /><p>Loading customer directory...</p></div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Contact</th>
                  <th>Total Purchases</th>
                  <th>Total Spent (KES)</th>
                  <th className="text-center">History</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c._id}>
                    <td className="font-medium">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'var(--primary-bg)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                          {c.name?.charAt(0) || 'U'}
                        </div>
                        {c.name}
                        {c.customer_type === 'wholesale' && <span className="badge" style={{ background: 'var(--warning-bg)', color: 'var(--warning)', fontSize: '0.7rem' }}>Wholesale</span>}
                      </div>
                    </td>
                    <td className="td-secondary">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Phone size={12} /> {c.phone || 'N/A'}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '4px' }}><Mail size={12} /> {c.email || 'N/A'}</div>
                    </td>
                    <td>{c.totalPurchases || 0} orders</td>
                    <td className="font-medium">{c.totalSpent?.toLocaleString() || 0}</td>
                    <td className="action-cell">
                      <button className="action-icon" title="View purchase history" onClick={() => openPurchaseHistory(c)}>
                        <History size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan="5" className="empty-state">No customers found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="glass-panel modal-card">
            <button className="modal-close-btn" onClick={() => setShowModal(false)}>
              <X size={20} />
            </button>
            <h2 className="modal-title">Add New Customer</h2>
            <form onSubmit={handleAddCustomer} className="modal-form">
              <div className="modal-form-grid">
                <div className="modal-form-field modal-form-field-full">
                  <label>Customer Name</label>
                  <input required type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                </div>
                <div className="modal-form-field">
                  <label>Phone Number</label>
                  <input required type="text" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                </div>
                <div className="modal-form-field">
                  <label>Email Address</label>
                  <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                </div>
                <div className="modal-form-field modal-form-field-full">
                  <label className="customer-checkbox-row">
                    <input
                      type="checkbox"
                      checked={formData.customer_type === 'wholesale'}
                      onChange={(e) => setFormData({ ...formData, customer_type: e.target.checked ? 'wholesale' : 'retail' })}
                    />
                    <div>
                      <span>This is a Wholesale Partner Account</span>
                      <small>Use this for customers who should access wholesale pricing.</small>
                    </div>
                  </label>
                </div>
              </div>
              <div className="modal-actions">
                <button type="submit" className="primary-btn">Save & Add Customer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {historyCustomer && (
        <div className="modal-overlay">
          <div className="glass-panel modal-card modal-card-wide modal-detail-card customer-history-modal">
            <button className="modal-close-btn" onClick={() => setHistoryCustomer(null)}>
              <X size={20} />
            </button>
            <div className="modal-detail-header">
              <div className="modal-detail-intro">
                <h2 className="modal-title">{historyCustomer.name} Purchase History</h2>
                <p className="modal-detail-subtitle">Search by invoice number, payment method, or items in this customer timeline.</p>
              </div>
              <button className="primary-btn" onClick={exportCustomerHistory}>
                <Download size={18} /> Extract Customer Report
              </button>
            </div>
            <div className="modal-detail-search customer-history-toolbar">
              <div className="search-box">
                <Search size={18} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search invoice or item..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                />
              </div>
            </div>
            <div className="customer-history-body">
              {historyLoading ? (
                <div className="loading-panel"><div className="loading-spinner" /><p>Loading purchase history...</p></div>
              ) : filteredHistory.length === 0 ? (
                <div className="empty-state">No purchase history matched the current search.</div>
              ) : (
                <div className="modal-detail-stack">
                  {filteredHistory.map((sale) => (
                    <div key={sale._id} className="glass-panel modal-detail-panel">
                      <div className="modal-detail-panel-header">
                        <div>
                          <div className="font-medium">{sale.invoice_number}</div>
                          <div className="td-secondary">{new Date(sale.createdAt).toLocaleString()}</div>
                        </div>
                        <div className="text-right">
                          <div className="badge" style={{ textTransform: 'capitalize' }}>{sale.sale_type || 'retail'}</div>
                          <div className="td-secondary" style={{ marginTop: '0.35rem', textTransform: 'capitalize' }}>{sale.payment_method}</div>
                        </div>
                      </div>

                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Item</th>
                            <th>Category</th>
                            <th>Qty</th>
                            <th>Unit Price</th>
                            <th className="text-right">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sale.items?.map((item) => (
                            <tr key={item.id || item._id}>
                              <td>
                                <div className="font-medium">{item.productName}</div>
                                <div className="td-secondary">
                                  {item.size} {item.wholesale_applied ? '- Wholesale price applied' : ''}
                                </div>
                              </td>
                              <td style={{ textTransform: 'capitalize' }}>{item.category}</td>
                              <td>{item.quantity}</td>
                              <td>KES {item.unit_price?.toLocaleString() || 0}</td>
                              <td className="text-right">KES {item.subtotal?.toLocaleString() || 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      <div className="modal-detail-totals">
                        <span className="td-secondary">Served by: {sale.user_id?.username || 'Unknown'}</span>
                        <strong>KES {sale.total_amount?.toLocaleString() || 0}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;
