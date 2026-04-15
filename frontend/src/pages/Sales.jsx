import React, { useState, useEffect } from 'react';
import { Download, ReceiptText, ChevronRight, X } from 'lucide-react';
import api from '../utils/api';
import './Products.css';

const Sales = () => {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('All');
  const [selectedSale, setSelectedSale] = useState(null);
  const [saleDetails, setSaleDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  useEffect(() => {
    fetchSales();
  }, [period]);

  const fetchSales = async () => {
    try {
      setLoading(true);
      const params = {};
      const now = new Date();
      if (period === 'Today') {
        now.setHours(0,0,0,0);
        params.start_date = now.toISOString();
      } else if (period === 'Month') {
        now.setDate(1);
        now.setHours(0,0,0,0);
        params.start_date = now.toISOString();
      }

      const res = await api.get('/sales', { params });
      setSales(res.data.data);
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
            body { font-family: Arial, sans-serif; padding: 28px; color: #111; }
            .header { display:flex; justify-content:space-between; gap:24px; margin-bottom:24px; }
            .meta { margin: 18px 0; line-height: 1.8; font-size: 14px; }
            table { width:100%; border-collapse:collapse; margin-top:16px; }
            th { text-align:left; font-size:12px; text-transform:uppercase; color:#666; padding:10px 8px; border-bottom:2px solid #ccc; }
            .totals { margin-top:20px; margin-left:auto; width:320px; }
            .totals div { display:flex; justify-content:space-between; padding:6px 0; }
            .total-line { border-top:2px solid #222; margin-top:8px; padding-top:10px !important; font-weight:700; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 style="margin:0 0 8px 0;">Liquor POS Invoice</h1>
              <div>${sale.invoice_number}</div>
            </div>
            <div style="text-align:right;">
              <div><strong>Date:</strong> ${new Date(sale.createdAt).toLocaleString()}</div>
              <div><strong>Sales Person:</strong> ${sale.user_id?.username || 'Unknown'}</div>
              <div><strong>Payment:</strong> ${sale.payment_method}</div>
              <div><strong>Type:</strong> ${sale.sale_type}</div>
            </div>
          </div>
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
          <div>
            <h1 className="page-title">Sales History</h1>
            <p className="page-subtitle">View and filter transaction logs.</p>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <select 
              style={{ padding: '0.5rem 1rem', background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--text-color)', borderRadius: '8px' }}
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            >
              <option value="All">All Time</option>
              <option value="Today">Today</option>
              <option value="Month">This Month</option>
            </select>
          </div>
        </div>

        <div className="glass-panel main-panel">
          <div className="table-container">
            {loading ? (
               <div style={{ padding: '2rem', textAlign: 'center' }}>Loading sales from database...</div>
            ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Date & Time</th>
                  <th>Type</th>
                  <th>Payment</th>
                  <th>Cashier</th>
                  <th className="text-right">Total (KES)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sales.map(sale => (
                  <tr key={sale._id} style={{ cursor: 'pointer' }} onClick={() => openSaleDetails(sale)}>
                    <td className="font-medium text-primary">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <ReceiptText size={16} /> {sale.invoice_number}
                      </div>
                    </td>
                    <td className="td-secondary">{new Date(sale.createdAt).toLocaleString()}</td>
                    <td>{sale.sale_type}</td>
                    <td><span className="badge">{sale.payment_method}</span></td>
                    <td>{sale.user_id?.username || 'admin'}</td>
                    <td className="font-medium text-right">{sale.total_amount?.toLocaleString()}</td>
                    <td className="text-right text-muted"><ChevronRight size={20} /></td>
                  </tr>
                ))}
                {sales.length === 0 && (
                  <tr>
                    <td colSpan="7" className="empty-state">No sales records found.</td>
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
          <div className="glass-panel modal-card modal-card-wide" style={{ paddingTop: '3.5rem' }}>
            <button onClick={closeSaleDetails} style={{ position: 'absolute', right: '1rem', top: '1rem', background: 'rgba(15, 23, 42, 0.9)', border: '1px solid var(--border-color)', color: 'var(--text-color)', cursor: 'pointer', borderRadius: '999px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
              <X size={20} />
            </button>
            {detailsLoading || !saleDetails ? (
              <div className="empty-state">Loading invoice details...</div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
                  <div>
                    <h2 style={{ marginBottom: '0.35rem' }}>{saleDetails.invoice_number}</h2>
                    <p className="page-subtitle">Individual invoice record and downloadable receipt.</p>
                  </div>
                  <button className="primary-btn" onClick={() => downloadInvoice(saleDetails)}>
                    <Download size={18} /> Download Invoice
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.75rem 1.25rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                  <div><strong>Date:</strong> {new Date(saleDetails.createdAt).toLocaleString()}</div>
                  <div><strong>Sales Person:</strong> {saleDetails.user_id?.username || 'Unknown'}</div>
                  <div><strong>Customer:</strong> {saleDetails.customer_id?.name || 'Walk-in Customer'}</div>
                  <div><strong>Payment:</strong> <span style={{ textTransform: 'capitalize' }}>{saleDetails.payment_method}</span></div>
                  <div><strong>Customer Phone:</strong> {saleDetails.customer_id?.phone || 'N/A'}</div>
                  <div><strong>Type:</strong> <span style={{ textTransform: 'capitalize' }}>{saleDetails.sale_type}</span></div>
                </div>

                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Category</th>
                      <th>Qty</th>
                      <th>Sell Price</th>
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
                        <td style={{ textTransform: 'capitalize' }}>{item.productCategory}</td>
                        <td>{item.quantity}</td>
                        <td>KES {item.unit_price?.toLocaleString() || 0}</td>
                        <td className="text-right">KES {item.subtotal?.toLocaleString() || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px dashed var(--border-color)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
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
