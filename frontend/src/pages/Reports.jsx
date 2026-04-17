import React, { useEffect, useMemo, useState } from 'react';
import {
  Download,
  DollarSign,
  Package,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  User
} from 'lucide-react';
import api from '../utils/api';
import { useSystemSettings } from '../hooks/useSystemSettings';
import './Reports.css';

const defaultPnLData = {
  gross_revenue: 0,
  cogs: 0,
  gross_profit: 0,
  total_expenses: 0,
  net_profit: 0,
  expenses: []
};

const getPeriodParams = (period) => {
  const params = {};
  const now = new Date();

  switch (period) {
    case 'Today':
      now.setHours(0, 0, 0, 0);
      params.start_date = now.toISOString();
      break;
    case 'Week':
      now.setDate(now.getDate() - now.getDay());
      now.setHours(0, 0, 0, 0);
      params.start_date = now.toISOString();
      break;
    case 'Month':
      now.setDate(1);
      now.setHours(0, 0, 0, 0);
      params.start_date = now.toISOString();
      break;
    case 'Year':
      now.setMonth(0, 1);
      now.setHours(0, 0, 0, 0);
      params.start_date = now.toISOString();
      break;
    default:
      break;
  }

  return params;
};

const formatCurrency = (value) => `KES ${Number(value || 0).toLocaleString()}`;

const calcMargin = (profit, revenue) => {
  if (!revenue || revenue === 0) return '0.0';
  return ((profit / revenue) * 100).toFixed(1);
};

const Reports = () => {
  const [reportType, setReportType] = useState('pnl');
  const [period, setPeriod] = useState('Month');
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedVariant, setSelectedVariant] = useState('');
  const [pnlData, setPnLData] = useState(defaultPnLData);
  const [customerReport, setCustomerReport] = useState({ customer: null, summary: null, sales: [] });
  const [productReport, setProductReport] = useState({ product: null, summary: null, sales: [] });
  const { settings } = useSystemSettings();

  useEffect(() => {
    const fetchLookups = async () => {
      try {
        const [customersRes, productsRes] = await Promise.all([
          api.get('/customers'),
          api.get('/products')
        ]);

        const customerRows = customersRes.data.data || [];
        const productRows = productsRes.data.data || [];

        setCustomers(customerRows);
        setProducts(productRows);

        if (!selectedCustomer && customerRows.length > 0) {
          setSelectedCustomer(customerRows[0]._id);
        }

        if (!selectedProduct && productRows.length > 0) {
          setSelectedProduct(productRows[0]._id);
        }
      } catch (err) {
        console.error('Failed to load report lookups', err);
      }
    };

    fetchLookups();
  }, []);

  const selectedProductRecord = useMemo(
    () => products.find((product) => product._id === selectedProduct) || null,
    [products, selectedProduct]
  );

  const selectedCustomerRecord = useMemo(
    () => customers.find((customer) => customer._id === selectedCustomer) || null,
    [customers, selectedCustomer]
  );

  useEffect(() => {
    if (!selectedProductRecord) {
      setSelectedVariant('');
      return;
    }

    const variants = selectedProductRecord.variants || [];
    const hasSelectedVariant = variants.some((variant) => variant._id === selectedVariant);

    if (!hasSelectedVariant) {
      setSelectedVariant('');
    }
  }, [selectedProductRecord, selectedVariant]);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        setLoading(true);
        const params = getPeriodParams(period);

        if (reportType === 'pnl') {
          const res = await api.get('/reports/pnl', { params });
          setPnLData(res.data.data || defaultPnLData);
          return;
        }

        if (reportType === 'customer') {
          if (!selectedCustomer) {
            setCustomerReport({ customer: null, summary: null, sales: [] });
            return;
          }

          const res = await api.get('/reports/customer-sales', {
            params: {
              ...params,
              customer_id: selectedCustomer
            }
          });
          setCustomerReport(res.data.data || { customer: null, summary: null, sales: [] });
          return;
        }

        if (!selectedProduct) {
          setProductReport({ product: null, summary: null, sales: [] });
          return;
        }

        const res = await api.get('/reports/product-sales', {
          params: {
            ...params,
            product_id: selectedProduct,
            ...(selectedVariant ? { variant_id: selectedVariant } : {})
          }
        });
        setProductReport(res.data.data || { product: null, summary: null, sales: [] });
      } catch (err) {
        console.error('Failed to load report', err);
        if (reportType === 'pnl') setPnLData(defaultPnLData);
        if (reportType === 'customer') setCustomerReport({ customer: null, summary: null, sales: [] });
        if (reportType === 'product') setProductReport({ product: null, summary: null, sales: [] });
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [period, reportType, selectedCustomer, selectedProduct, selectedVariant]);

  const handleExport = () => {
    const label = reportType === 'pnl' ? 'Financial Report' : reportType === 'customer' ? 'Customer Sales Report' : 'Product Sales Report';
    document.title = `${settings.business_name} ${label} - ${period}`;
    window.print();
  };

  const generatedAt = new Date().toLocaleString();
  const pnlGrossMargin = calcMargin(pnlData.gross_profit, pnlData.gross_revenue);
  const pnlNetMargin = calcMargin(pnlData.net_profit, pnlData.gross_revenue);
  const customerMargin = calcMargin(customerReport.summary?.total_profit, customerReport.summary?.total_revenue);
  const productMargin = calcMargin(productReport.summary?.total_profit, productReport.summary?.total_revenue);

  const renderPnLView = () => (
    <>
      <div className="reports-grid">
        <div className="stat-card glass-panel">
          <div className="stat-icon" style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8' }}>
            <DollarSign size={24} />
          </div>
          <div>
            <h3>Gross Revenue</h3>
            <p className="stat-number">{formatCurrency(pnlData.gross_revenue)}</p>
          </div>
        </div>

        <div className="stat-card glass-panel">
          <div className="stat-icon" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
            <TrendingDown size={24} />
          </div>
          <div>
            <h3>COGS</h3>
            <p className="stat-number text-danger">{formatCurrency(pnlData.cogs)}</p>
          </div>
        </div>

        <div className="stat-card glass-panel">
          <div className="stat-icon" style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e' }}>
            <TrendingUp size={24} />
          </div>
          <div>
            <h3>Gross Profit</h3>
            <p className="stat-number text-success">{formatCurrency(pnlData.gross_profit)}</p>
            <span className="text-secondary text-xs">{pnlGrossMargin}% Margin</span>
          </div>
        </div>
      </div>

      <div className="glass-panel main-panel pnl-statement">
        <div className="pnl-header">
          <h2>Income Statement</h2>
          <span className="badge">Period: This {period}</span>
        </div>

        <table className="pnl-table">
          <tbody>
            <tr className="section-title">
              <td colSpan="2">REVENUE</td>
            </tr>
            <tr>
              <td>Gross Sales Revenue</td>
              <td className="text-right">{formatCurrency(pnlData.gross_revenue)}</td>
            </tr>

            <tr className="spacing"><td colSpan="2"></td></tr>

            <tr className="section-title">
              <td colSpan="2">COST OF GOODS SOLD</td>
            </tr>
            <tr>
              <td>Cost of Inventory Sold</td>
              <td className="text-right text-danger">- {formatCurrency(pnlData.cogs)}</td>
            </tr>
            <tr className="subtotal-row">
              <td><strong>GROSS PROFIT</strong></td>
              <td className="text-right text-success"><strong>{formatCurrency(pnlData.gross_profit)}</strong></td>
            </tr>

            <tr className="spacing"><td colSpan="2"></td></tr>

            <tr className="section-title">
              <td colSpan="2">OPERATING EXPENSES</td>
            </tr>
            <tr className="expense-row">
              <td>Total Registered Expenses</td>
              <td className="text-right text-danger">- {formatCurrency(pnlData.total_expenses)}</td>
            </tr>
            <tr className="subtotal-row">
              <td><strong>TOTAL OPERATING EXPENSES</strong></td>
              <td className="text-right text-danger"><strong>- {formatCurrency(pnlData.total_expenses)}</strong></td>
            </tr>

            <tr className="spacing"><td colSpan="2"></td></tr>

            <tr className="grand-total-row">
              <td>NET PROFIT</td>
              <td className="text-right text-success">{formatCurrency(pnlData.net_profit)}</td>
            </tr>
            <tr className="margin-row">
              <td>Net Profit Margin</td>
              <td className="text-right">{pnlNetMargin}%</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="glass-panel main-panel report-detail-panel">
        <div className="detail-header">
          <div>
            <h2>Expense Breakdown</h2>
            <p className="page-subtitle">Detailed operating expenses included in this reporting period.</p>
          </div>
          <div className="report-meta-chip">Expense entries: {pnlData.expenses?.length || 0}</div>
        </div>

        {pnlData.expenses?.length ? (
          <div className="table-container">
            <table className="report-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Recorded By</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {pnlData.expenses.map((expense) => (
                  <tr key={expense._id}>
                    <td>{new Date(expense.expenseDate || expense.expense_date || expense.createdAt).toLocaleDateString()}</td>
                    <td>
                      <div className="font-medium">{expense.description}</div>
                      <div className="td-secondary">{expense.reference_number || expense.referenceNumber || 'No reference'}</div>
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>{expense.category}</td>
                    <td>{expense.recordedBy?.username || 'Unknown'}</td>
                    <td className="text-right">{formatCurrency(expense.amount)}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan="4" className="text-right"><strong>Total Expenses</strong></td>
                  <td className="text-right"><strong>{formatCurrency(pnlData.total_expenses)}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">No expenses recorded for this period.</div>
        )}
      </div>
    </>
  );

  const renderCustomerView = () => {
    const reportCustomer = customerReport.customer || selectedCustomerRecord;
    const summary = customerReport.summary || {
      total_sales: 0,
      total_revenue: 0,
      total_items: 0,
      total_profit: 0
    };

    return (
      <>
        <div className="reports-grid">
          <div className="stat-card glass-panel">
            <div className="stat-icon" style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6' }}>
              <ShoppingCart size={24} />
            </div>
            <div>
              <h3>Total Orders</h3>
              <p className="stat-number">{summary.total_sales || 0}</p>
            </div>
          </div>

          <div className="stat-card glass-panel">
            <div className="stat-icon" style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e' }}>
              <DollarSign size={24} />
            </div>
            <div>
              <h3>Total Revenue</h3>
              <p className="stat-number">{formatCurrency(summary.total_revenue)}</p>
            </div>
          </div>

          <div className="stat-card glass-panel">
            <div className="stat-icon" style={{ background: 'rgba(234, 179, 8, 0.12)', color: '#eab308' }}>
              <TrendingUp size={24} />
            </div>
            <div>
              <h3>Total Profit</h3>
              <p className="stat-number text-success">{formatCurrency(summary.total_profit)}</p>
              <span className="text-secondary text-xs">{customerMargin}% Margin</span>
            </div>
          </div>
        </div>

        <div className="glass-panel main-panel report-detail-panel">
          <div className="detail-header">
            <div>
              <h2>{reportCustomer?.name || 'Customer sales report'}</h2>
              <p className="page-subtitle">
                {reportCustomer?.phone || 'No phone'} {reportCustomer?.email ? ` | ${reportCustomer.email}` : ''}
              </p>
            </div>
            <div className="report-meta-chip">Items sold: {summary.total_items || 0}</div>
          </div>

          {customerReport.sales?.length ? (
            <div className="report-card-list">
              {customerReport.sales.map((sale) => (
                <div key={sale._id} className="report-record-card">
                  <div className="report-record-top">
                    <div>
                      <strong>{sale.invoice_number}</strong>
                      <div className="td-secondary">{new Date(sale.createdAt).toLocaleString()}</div>
                    </div>
                    <div className="report-record-tags">
                      <span className="badge">{sale.sale_type || 'retail'}</span>
                      <span className="badge">{sale.payment_method || 'cash'}</span>
                    </div>
                  </div>

                  <table className="report-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Qty</th>
                        <th>Unit Price</th>
                        <th className="text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(sale.items || []).map((item) => (
                        <tr key={item.id}>
                          <td>
                            <div className="font-medium">{item.productName}</div>
                            <div className="td-secondary">{item.size} {item.brand ? `| ${item.brand}` : ''}</div>
                          </td>
                          <td>{item.quantity}</td>
                          <td>{formatCurrency(item.unit_price)}</td>
                          <td className="text-right">{formatCurrency(item.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="report-record-footer">
                    <span className="td-secondary">Served by: {sale.user_id?.username || 'Unknown'}</span>
                    <strong>{formatCurrency(sale.total_amount)}</strong>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">No sales recorded for this customer in the selected period.</div>
          )}
        </div>
      </>
    );
  };

  const renderProductView = () => {
    const reportProduct = productReport.product || selectedProductRecord;
    const summary = productReport.summary || {
      total_quantity: 0,
      total_revenue: 0,
      total_profit: 0,
      total_transactions: 0,
      variants: []
    };

    return (
      <>
        <div className="reports-grid">
          <div className="stat-card glass-panel">
            <div className="stat-icon" style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6' }}>
              <Package size={24} />
            </div>
            <div>
              <h3>Units Sold</h3>
              <p className="stat-number">{summary.total_quantity || 0}</p>
            </div>
          </div>

          <div className="stat-card glass-panel">
            <div className="stat-icon" style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e' }}>
              <DollarSign size={24} />
            </div>
            <div>
              <h3>Revenue</h3>
              <p className="stat-number">{formatCurrency(summary.total_revenue)}</p>
            </div>
          </div>

          <div className="stat-card glass-panel">
            <div className="stat-icon" style={{ background: 'rgba(234, 179, 8, 0.12)', color: '#eab308' }}>
              <TrendingUp size={24} />
            </div>
            <div>
              <h3>Profit</h3>
              <p className="stat-number text-success">{formatCurrency(summary.total_profit)}</p>
              <span className="text-secondary text-xs">{productMargin}% Margin</span>
            </div>
          </div>
        </div>

        <div className="glass-panel main-panel report-detail-panel">
          <div className="detail-header">
            <div>
              <h2>{reportProduct?.name || 'Product sales report'}</h2>
              <p className="page-subtitle">
                {reportProduct?.brand || 'No brand'} | {reportProduct?.category || 'Uncategorized'}
              </p>
            </div>
            <div className="report-meta-chip">Transactions: {summary.total_transactions || 0}</div>
          </div>

          <div className="variant-summary-grid">
            {(summary.variants || []).map((variant) => (
              <div key={variant.variant_id || variant.size} className="variant-summary-card">
                <strong>{variant.size}</strong>
                <span>{variant.quantity_sold} units sold</span>
                <span>{formatCurrency(variant.revenue)} revenue</span>
              </div>
            ))}
            {(!summary.variants || summary.variants.length === 0) && (
              <div className="empty-state">No product sales found for the selected period.</div>
            )}
          </div>

          {productReport.sales?.length > 0 && (
            <div className="table-container">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Variant</th>
                    <th>Customer</th>
                    <th>Qty</th>
                    <th>Unit Price</th>
                    <th className="text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {productReport.sales.map((sale) => (
                    <tr key={sale._id}>
                      <td>
                        <div className="font-medium">{sale.sale?.invoice_number}</div>
                        <div className="td-secondary">{new Date(sale.sale?.createdAt).toLocaleString()}</div>
                      </td>
                      <td>{sale.variant?.size || 'Unknown'}</td>
                      <td>{sale.customer?.name || 'Walk-in customer'}</td>
                      <td>{sale.quantity}</td>
                      <td>{formatCurrency(sale.unit_price)}</td>
                      <td className="text-right">{formatCurrency(sale.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </>
    );
  };

  const exportTitle = reportType === 'pnl'
    ? `${settings.business_name} Financial Report`
    : reportType === 'customer'
      ? `${settings.business_name} Customer Sales Report`
      : `${settings.business_name} Product Sales Report`;

  return (
    <div className="page-container animate-fade-in reports-wrapper">
      <div className="page-header report-toolbar-wrap">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">Review financial performance and generate individual sales reports.</p>
        </div>
        <div className="report-actions">
          <select className="filter-select" value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="Today">Today</option>
            <option value="Week">This Week</option>
            <option value="Month">This Month</option>
            <option value="Year">This Year</option>
          </select>
          <button className="primary-btn" onClick={handleExport}>
            <Download size={18} /> Export PDF
          </button>
        </div>
      </div>

      <div className="glass-panel main-panel report-mode-panel">
        <div className="report-mode-switch">
          <button className={reportType === 'pnl' ? 'active' : ''} onClick={() => setReportType('pnl')}>P&L</button>
          <button className={reportType === 'customer' ? 'active' : ''} onClick={() => setReportType('customer')}>Customer Sales</button>
          <button className={reportType === 'product' ? 'active' : ''} onClick={() => setReportType('product')}>Product Sales</button>
        </div>

        {reportType === 'customer' && (
          <div className="report-filter-row">
            <label>
              <span><User size={16} /> Customer</span>
              <select className="filter-select" value={selectedCustomer} onChange={(e) => setSelectedCustomer(e.target.value)}>
                {customers.map((customer) => (
                  <option key={customer._id} value={customer._id}>{customer.name}</option>
                ))}
              </select>
            </label>
          </div>
        )}

        {reportType === 'product' && (
          <div className="report-filter-row">
            <label>
              <span><Package size={16} /> Product</span>
              <select className="filter-select" value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)}>
                {products.map((product) => (
                  <option key={product._id} value={product._id}>{product.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span><ShoppingCart size={16} /> Variant</span>
              <select className="filter-select" value={selectedVariant} onChange={(e) => setSelectedVariant(e.target.value)}>
                <option value="">All variants</option>
                {(selectedProductRecord?.variants || []).map((variant) => (
                  <option key={variant._id} value={variant._id}>{variant.size}</option>
                ))}
              </select>
            </label>
          </div>
        )}
      </div>

      {loading ? (
        <div className="glass-panel main-panel loading-panel"><div className="loading-spinner" /><p>Refreshing report data...</p></div>
      ) : (
        <>
          {reportType === 'pnl' && renderPnLView()}
          {reportType === 'customer' && renderCustomerView()}
          {reportType === 'product' && renderProductView()}
        </>
      )}

      <section className="report-export-sheet">
        <div className="report-export-header">
          <div className="report-branding">
            <div>
              <h1>{exportTitle}</h1>
              <p>Generated from live system data for the selected reporting period.</p>
            </div>
          </div>
          <div className="report-export-meta">
            <span><strong>Period:</strong> This {period}</span>
            <span><strong>Generated:</strong> {generatedAt}</span>
          </div>
        </div>

        {reportType === 'pnl' && (
          <>
            <div className="report-export-summary">
              <div className="report-export-card"><span>Gross Revenue</span><strong>{formatCurrency(pnlData.gross_revenue)}</strong></div>
              <div className="report-export-card"><span>COGS</span><strong>{formatCurrency(pnlData.cogs)}</strong></div>
              <div className="report-export-card"><span>Total Expenses</span><strong>{formatCurrency(pnlData.total_expenses)}</strong></div>
              <div className="report-export-card"><span>Net Profit</span><strong>{formatCurrency(pnlData.net_profit)}</strong></div>
            </div>

            <table className="report-export-table">
              <thead>
                <tr>
                  <th>Line Item</th>
                  <th className="text-right">Amount (KES)</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Gross Sales Revenue</td><td className="text-right">{Number(pnlData.gross_revenue || 0).toLocaleString()}</td></tr>
                <tr><td>Cost of Goods Sold</td><td className="text-right">({Number(pnlData.cogs || 0).toLocaleString()})</td></tr>
                <tr><td>Gross Profit</td><td className="text-right">{Number(pnlData.gross_profit || 0).toLocaleString()}</td></tr>
                <tr><td>Total Operating Expenses</td><td className="text-right">({Number(pnlData.total_expenses || 0).toLocaleString()})</td></tr>
                <tr className="report-export-total"><td>Net Profit</td><td className="text-right">{Number(pnlData.net_profit || 0).toLocaleString()}</td></tr>
              </tbody>
            </table>

            <div className="report-export-footer">
              <span>Gross Margin: {pnlGrossMargin}%</span>
              <span>Net Margin: {pnlNetMargin}%</span>
            </div>

            <table className="report-export-table">
              <thead>
                <tr>
                  <th>Expense Date</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Recorded By</th>
                  <th className="text-right">Amount (KES)</th>
                </tr>
              </thead>
              <tbody>
                {(pnlData.expenses || []).map((expense) => (
                  <tr key={expense._id}>
                    <td>{new Date(expense.expenseDate || expense.expense_date || expense.createdAt).toLocaleDateString()}</td>
                    <td>{expense.description}</td>
                    <td style={{ textTransform: 'capitalize' }}>{expense.category}</td>
                    <td>{expense.recordedBy?.username || 'Unknown'}</td>
                    <td className="text-right">{Number(expense.amount || 0).toLocaleString()}</td>
                  </tr>
                ))}
                {(pnlData.expenses || []).length > 0 && (
                  <tr className="report-export-total">
                    <td colSpan="4" className="text-right">Total Expenses</td>
                    <td className="text-right">{Number(pnlData.total_expenses || 0).toLocaleString()}</td>
                  </tr>
                )}
                {(!pnlData.expenses || pnlData.expenses.length === 0) && (
                  <tr>
                    <td colSpan="5" className="text-right">No expenses recorded for this period.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </>
        )}

        {reportType === 'customer' && (
          <>
            <div className="report-export-summary">
              <div className="report-export-card"><span>Customer</span><strong>{(customerReport.customer || selectedCustomerRecord)?.name || 'N/A'}</strong></div>
              <div className="report-export-card"><span>Total Orders</span><strong>{customerReport.summary?.total_sales || 0}</strong></div>
              <div className="report-export-card"><span>Total Revenue</span><strong>{formatCurrency(customerReport.summary?.total_revenue)}</strong></div>
              <div className="report-export-card"><span>Total Profit</span><strong>{formatCurrency(customerReport.summary?.total_profit)}</strong></div>
            </div>

            <table className="report-export-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Date</th>
                  <th>Items</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {(customerReport.sales || []).map((sale) => (
                  <tr key={sale._id}>
                    <td>{sale.invoice_number}</td>
                    <td>{new Date(sale.createdAt).toLocaleString()}</td>
                    <td>{(sale.items || []).reduce((sum, item) => sum + (item.quantity || 0), 0)}</td>
                    <td className="text-right">{Number(sale.total_amount || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(customerReport.sales || []).map((sale) => (
              <table key={sale._id} className="report-export-table">
                <thead>
                  <tr>
                    <th colSpan="4">{sale.invoice_number} item detail</th>
                  </tr>
                  <tr>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Unit Price</th>
                    <th className="text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {(sale.items || []).map((item) => (
                    <tr key={item.id}>
                      <td>{item.productName} {item.size ? `(${item.size})` : ''}</td>
                      <td>{item.quantity}</td>
                      <td>{Number(item.unit_price || 0).toLocaleString()}</td>
                      <td className="text-right">{Number(item.subtotal || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
          </>
        )}

        {reportType === 'product' && (
          <>
            <div className="report-export-summary">
              <div className="report-export-card"><span>Product</span><strong>{(productReport.product || selectedProductRecord)?.name || 'N/A'}</strong></div>
              <div className="report-export-card"><span>Units Sold</span><strong>{productReport.summary?.total_quantity || 0}</strong></div>
              <div className="report-export-card"><span>Revenue</span><strong>{formatCurrency(productReport.summary?.total_revenue)}</strong></div>
              <div className="report-export-card"><span>Profit</span><strong>{formatCurrency(productReport.summary?.total_profit)}</strong></div>
            </div>

            <table className="report-export-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Variant</th>
                  <th>Customer</th>
                  <th>Qty</th>
                  <th className="text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {(productReport.sales || []).map((sale) => (
                  <tr key={sale._id}>
                    <td>{sale.sale?.invoice_number}</td>
                    <td>{sale.variant?.size || 'Unknown'}</td>
                    <td>{sale.customer?.name || 'Walk-in customer'}</td>
                    <td>{sale.quantity}</td>
                    <td className="text-right">{Number(sale.subtotal || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="report-export-footer">
              <span>Transactions: {productReport.summary?.total_transactions || 0}</span>
              <span>Margin: {productMargin}%</span>
            </div>
          </>
        )}
        <p style={{ marginTop: '1.5rem', color: '#555' }}>{settings.receipt_footer}</p>
      </section>
    </div>
  );
};

export default Reports;
