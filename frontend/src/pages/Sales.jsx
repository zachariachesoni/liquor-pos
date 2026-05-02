import React, { useEffect, useMemo, useState } from 'react';
import { Download, ReceiptText, ChevronRight, X, Search, DollarSign, Package, TrendingUp, Wallet } from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useSystemSettings } from '../hooks/useSystemSettings';
import { getPrintBaseStyles, getPrintBrandMarkup } from '../utils/printBranding';
import './Products.css';
import './Reports.css';
import './Sales.css';

const Sales = () => {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('All');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState('');
  const [selectedSale, setSelectedSale] = useState(null);
  const [saleDetails, setSaleDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const { user } = useAuth();
  const { settings } = useSystemSettings();
  const isCashier = user?.role === 'cashier';

  const salesSummary = useMemo(() => {
    const paymentMap = new Map();
    const cashierMap = new Map();

    const totals = sales.reduce((acc, sale) => {
      const revenue = Number(sale.total_amount || 0);
      const profit = Number(sale.profit || 0);
      const itemCount = Number(sale.item_count || 0);
      const payment = sale.payment_method || 'unknown';
      const cashier = sale.user_id?.username || 'Unknown';

      acc.revenue += revenue;
      acc.profit += profit;
      acc.items += itemCount;
      paymentMap.set(payment, (paymentMap.get(payment) || 0) + revenue);
      cashierMap.set(cashier, (cashierMap.get(cashier) || 0) + revenue);
      return acc;
    }, {
      revenue: 0,
      profit: 0,
      items: 0
    });

    const topPayment = Array.from(paymentMap.entries()).sort((a, b) => b[1] - a[1])[0] || [];
    const topCashier = Array.from(cashierMap.entries()).sort((a, b) => b[1] - a[1])[0] || [];

    return {
      ...totals,
      transactions: sales.length,
      averageSale: sales.length ? totals.revenue / sales.length : 0,
      marginPct: totals.revenue > 0 ? (totals.profit / totals.revenue) * 100 : 0,
      topPayment: topPayment[0] || 'N/A',
      topCashier: topCashier[0] || 'N/A'
    };
  }, [sales]);

  useEffect(() => {
    fetchSales();
  }, [period, search, selectedDate]);

  const fetchSales = async () => {
    try {
      setLoading(true);
      const params = {};
      const now = new Date();
      if (period === 'Today') {
        now.setHours(0, 0, 0, 0);
        params.start_date = now.toISOString();
      } else if (period === 'Day') {
        const dayStart = new Date(`${selectedDate}T00:00:00`);
        const dayEnd = new Date(`${selectedDate}T23:59:59.999`);
        params.start_date = dayStart.toISOString();
        params.end_date = dayEnd.toISOString();
      } else if (period === 'Month') {
        now.setDate(1);
        now.setHours(0, 0, 0, 0);
        params.start_date = now.toISOString();
      }
      if (search.trim()) {
        params.q = search.trim();
      }

      const res = await api.get('/sales', { params });
      setSales(res.data.data || []);
    } catch (err) {
      console.error('Failed to load sales', err);
    } finally {
      setLoading(false);
    }
  };

  const openSaleDetails = async (sale) => {
    try {
      setSelectedSale(sale);
      setDetailsLoading(true);
      const res = await api.get(`/sales/${sale._id}`);
      setSaleDetails(res.data.data);
    } catch (err) {
      console.error('Failed to load sale details', err);
      setSaleDetails(null);
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeSaleDetails = () => {
    setSelectedSale(null);
    setSaleDetails(null);
  };

  const formatCurrency = (value) => `KES ${Number(value || 0).toLocaleString()}`;

  const downloadInvoice = (sale) => {
    if (!sale) return;

    const invoiceWindow = window.open('', '_blank', 'width=900,height=900');
    if (!invoiceWindow) return;

    const rows = (sale.items || []).map((item) => `
      <tr>
        <td style="padding:10px 8px;border-bottom:1px solid #ddd;">
          <strong>${item.productName}</strong>
          <div style="font-size:12px;color:#666;">${item.productBrand || ''} ${item.variantSize || ''}</div>
        </td>
        <td style="padding:10px 8px;border-bottom:1px solid #ddd;text-transform:capitalize;">${item.productCategory || ''}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #ddd;text-align:center;">${item.quantity}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #ddd;text-align:right;">KES ${(item.unit_price || 0).toLocaleString()}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #ddd;text-align:right;">KES ${(item.subtotal || 0).toLocaleString()}</td>
      </tr>
    `).join('');

    invoiceWindow.document.write(`
      <html>
        <head>
          <title>Invoice ${sale.invoice_number}</title>
          <style>
            ${getPrintBaseStyles(`
              body { padding: 28px; color: #111827; }
              .meta { margin: 18px 0; line-height: 1.8; font-size: 14px; }
              th { padding:10px 8px; border-bottom:2px solid #ccc; }
              .totals { margin-top:20px; margin-left:auto; width:320px; }
            `)}
            .totals { margin-top:20px; margin-left:auto; width:320px; }
            .totals div { display:flex; justify-content:space-between; padding:6px 0; }
            .total-line { border-top:2px solid #222; margin-top:8px; padding-top:10px !important; font-weight:700; }
          </style>
        </head>
        <body>
          <div class="print-page">
            ${getPrintBrandMarkup({
              businessName: settings.business_name,
              businessLogoUrl: settings.business_logo_url,
              documentTitle: 'Sales Invoice',
              subtitle: sale.invoice_number,
              metaRows: [
                `<strong>Date:</strong> ${new Date(sale.createdAt).toLocaleString()}`,
                `<strong>Sales Person:</strong> ${sale.user_id?.username || 'Unknown'}`,
                `<strong>Payment:</strong> ${sale.payment_method}`,
                `<strong>Type:</strong> ${sale.sale_type}`
              ]
            })}
            <div class="meta">
              <div><strong>Customer:</strong> ${sale.customer_id?.name || 'Walk-in Customer'}</div>
              <div><strong>Phone:</strong> ${sale.customer_id?.phone || 'N/A'}</div>
              <div><strong>Email:</strong> ${sale.customer_id?.email || 'N/A'}</div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th style="text-align:center;">Qty</th>
                  <th style="text-align:right;">Sell Price</th>
                  <th style="text-align:right;">Line Total</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
            <div class="totals">
              <div><span>Subtotal</span><strong>KES ${(sale.subtotal || sale.total_amount || 0).toLocaleString()}</strong></div>
              <div><span>Total</span><strong>KES ${(sale.total_amount || 0).toLocaleString()}</strong></div>
              <div class="total-line"><span>Recorded By</span><strong>${sale.user_id?.username || 'Unknown'}</strong></div>
            </div>
            ${settings.payment_account_number ? `
              <div class="totals">
                <div>
                  <span>${settings.payment_account_type === 'paybill' ? 'Paybill' : 'Till Number'}</span>
                  <strong>${settings.payment_account_number}</strong>
                </div>
              </div>
            ` : ''}
            <p class="print-footer">${settings.receipt_footer || ''}</p>
          </div>
        </body>
      </html>
    `);
    invoiceWindow.document.close();
    invoiceWindow.focus();
    invoiceWindow.print();
  };

  return (
    <>
      <div className="page-container animate-fade-in">
        <div className="page-header">
          <div className="page-header-copy">
            <h1 className="page-title">Sales History</h1>
            <p className="page-subtitle">
              {isCashier
                ? 'Review and reprint the transactions you recorded.'
                : 'Track revenue, items sold, profit, payments, and invoice details by period.'}
            </p>
          </div>
          <div className="page-header-actions">
            {isCashier && <div className="report-meta-chip">Your transactions only</div>}
            <div className="search-box toolbar-search">
              <Search size={18} className="search-icon" />
              <input
                type="text"
                placeholder="Search invoice number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="toolbar-control compact">
              <label>Period</label>
              <select
                className="field-select"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              >
                <option value="All">All Time</option>
                <option value="Day">Specific Day</option>
                <option value="Today">Today</option>
                <option value="Month">This Month</option>
              </select>
            </div>
            {period === 'Day' && (
              <div className="toolbar-control compact">
                <label>Sales Day</label>
                <input
                  className="field-select"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>

        <div className="reports-grid sales-summary-grid">
          <div className="stat-card glass-panel">
            <div className="report-stat-icon tone-success"><DollarSign size={22} /></div>
            <div className="report-stat-copy">
              <h3>Revenue</h3>
              <p className="stat-number">{formatCurrency(salesSummary.revenue)}</p>
              <span className="report-stat-note">{salesSummary.transactions} transactions</span>
            </div>
          </div>
          <div className="stat-card glass-panel">
            <div className="report-stat-icon tone-warning"><Package size={22} /></div>
            <div className="report-stat-copy">
              <h3>Items Sold</h3>
              <p className="stat-number">{salesSummary.items}</p>
              <span className="report-stat-note">Avg sale {formatCurrency(salesSummary.averageSale)}</span>
            </div>
          </div>
          <div className="stat-card glass-panel">
            <div className="report-stat-icon tone-primary"><TrendingUp size={22} /></div>
            <div className="report-stat-copy">
              <h3>Gross Profit</h3>
              <p className="stat-number">{formatCurrency(salesSummary.profit)}</p>
              <span className="report-stat-note">{salesSummary.marginPct.toFixed(1)}% margin</span>
            </div>
          </div>
          <div className="stat-card glass-panel">
            <div className="report-stat-icon tone-sky"><Wallet size={22} /></div>
            <div className="report-stat-copy">
              <h3>Top Payment</h3>
              <p className="stat-number text-capitalize">{salesSummary.topPayment}</p>
              <span className="report-stat-note">Top cashier {salesSummary.topCashier}</span>
            </div>
          </div>
        </div>

        <div className="glass-panel main-panel">
          <div className="table-container">
            {loading ? (
              <div className="loading-panel"><div className="loading-spinner" /><p>Refreshing sales records...</p></div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Date & Time</th>
                    <th>Type</th>
                    <th>Payment</th>
                    <th>Cashier</th>
                    <th className="text-center">Items</th>
                    <th className="text-right">Profit</th>
                    <th className="text-right">Total (KES)</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => (
                    <tr key={sale._id} className="table-clickable" onClick={() => openSaleDetails(sale)}>
                      <td className="font-medium text-primary">
                        <div className="inline-cluster">
                          <ReceiptText size={16} /> {sale.invoice_number}
                        </div>
                      </td>
                      <td className="td-secondary">{new Date(sale.createdAt).toLocaleString()}</td>
                      <td>{sale.sale_type}</td>
                      <td><span className="badge">{sale.payment_method}</span></td>
                      <td>{sale.user_id?.username || 'admin'}</td>
                      <td className="text-center">{sale.item_count || 0}</td>
                      <td className="font-medium text-right text-success">{Number(sale.profit || 0).toLocaleString()}</td>
                      <td className="font-medium text-right">{sale.total_amount?.toLocaleString()}</td>
                      <td className="text-right text-muted"><ChevronRight size={20} /></td>
                    </tr>
                  ))}
                  {sales.length === 0 && (
                    <tr>
                      <td colSpan="9" className="empty-state">No sales records matched your filters.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {selectedSale && (
        <div className="modal-overlay">
          <div className="glass-panel modal-card modal-card-wide modal-detail-card">
            <button className="modal-close-btn" onClick={closeSaleDetails}>
              <X size={20} />
            </button>
            {detailsLoading ? (
              <div className="loading-panel"><div className="loading-spinner" /><p>Loading invoice details...</p></div>
            ) : !saleDetails ? (
              <div className="empty-state">Unable to load invoice details.</div>
            ) : (
              <>
                <div className="modal-detail-header">
                  <div className="modal-detail-intro">
                    <h2 className="modal-title">{saleDetails.invoice_number}</h2>
                    <p className="modal-detail-subtitle">Individual invoice record and downloadable receipt.</p>
                  </div>
                  <button className="primary-btn" onClick={() => downloadInvoice(saleDetails)}>
                    <Download size={18} /> Download Invoice
                  </button>
                </div>

                <div className="modal-detail-meta">
                  <div><strong>Date:</strong> {new Date(saleDetails.createdAt).toLocaleString()}</div>
                  <div><strong>Sales Person:</strong> {saleDetails.user_id?.username || 'Unknown'}</div>
                  <div><strong>Customer:</strong> {saleDetails.customer_id?.name || 'Walk-in Customer'}</div>
                  <div><strong>Payment:</strong> <span className="text-capitalize">{saleDetails.payment_method}</span></div>
                  <div><strong>Customer Phone:</strong> {saleDetails.customer_id?.phone || 'N/A'}</div>
                  <div><strong>Type:</strong> <span className="text-capitalize">{saleDetails.sale_type}</span></div>
                  <div><strong>Items:</strong> {(saleDetails.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0)}</div>
                  <div><strong>Gross Profit:</strong> {formatCurrency((saleDetails.items || []).reduce((sum, item) => sum + Number(item.profit_margin || 0), 0))}</div>
                </div>

                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Category</th>
                      <th className="text-center">Qty</th>
                      <th className="text-right">Sell Price</th>
                      <th className="text-right">Profit</th>
                      <th className="text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {saleDetails.items?.map((item) => (
                      <tr key={item._id}>
                        <td>
                          <div className="font-medium">{item.productName}</div>
                          <div className="td-secondary">
                            {item.productBrand || ''} {item.variantSize || ''}
                          </div>
                        </td>
                        <td className="text-capitalize">{item.productCategory}</td>
                        <td className="text-center">{item.quantity}</td>
                        <td className="text-right">KES {item.unit_price?.toLocaleString() || 0}</td>
                        <td className="text-right text-success">KES {Number(item.profit_margin || 0).toLocaleString()}</td>
                        <td className="text-right">KES {item.subtotal?.toLocaleString() || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="modal-detail-totals">
                  <span>COGS: {formatCurrency((saleDetails.items || []).reduce((sum, item) => sum + (Number(item.buying_price || 0) * Number(item.quantity || 0)), 0))}</span>
                  <strong>Total: KES {saleDetails.total_amount?.toLocaleString() || 0}</strong>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default Sales;
