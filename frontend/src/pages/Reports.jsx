import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Clock3,
  CreditCard,
  Download,
  DollarSign,
  Package,
  ReceiptText,
  ShoppingCart,
  Truck,
  TrendingDown,
  TrendingUp,
  User,
  Wallet
} from 'lucide-react';
import api from '../utils/api';
import { useSystemSettings } from '../hooks/useSystemSettings';
import './Products.css';
import './Reports.css';

const defaultPnLData = {
  gross_revenue: 0,
  cogs: 0,
  gross_profit: 0,
  total_expenses: 0,
  net_profit: 0,
  expenses: []
};

const defaultSupplierStatement = {
  supplier: null,
  summary: null,
  purchase_orders: [],
  payments: []
};

const defaultPayableAging = {
  summary: null,
  rows: []
};

const defaultPurchaseHistory = {
  variants: [],
  summary: null,
  rows: []
};

const defaultMarginReport = {
  threshold: 15,
  rows: []
};

const defaultTopSuppliersReport = {
  summary: null,
  rows: []
};

const reportLabels = {
  pnl: 'Financial Report',
  customer: 'Customer Sales Report',
  product: 'Product Sales Report',
  supplier: 'Supplier Statement',
  aging: 'Accounts Payable Aging',
  purchases: 'Purchase History Report',
  margin: 'Margin Erosion Report',
  'top-suppliers': 'Top Suppliers Report'
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

const ReportStatCard = ({ icon: Icon, tone, title, value, note, valueClassName = '' }) => (
  <div className="stat-card glass-panel">
    <div className={`report-stat-icon ${tone}`}>
      <Icon size={24} />
    </div>
    <div className="report-stat-copy">
      <h3>{title}</h3>
      <p className={`stat-number ${valueClassName}`.trim()}>{value}</p>
      {note ? <span className="report-stat-note">{note}</span> : null}
    </div>
  </div>
);

const Reports = () => {
  const [reportType, setReportType] = useState('pnl');
  const [period, setPeriod] = useState('Month');
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedVariant, setSelectedVariant] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [pnlData, setPnLData] = useState(defaultPnLData);
  const [customerReport, setCustomerReport] = useState({ customer: null, summary: null, sales: [] });
  const [productReport, setProductReport] = useState({ product: null, summary: null, sales: [] });
  const [supplierStatement, setSupplierStatement] = useState(defaultSupplierStatement);
  const [payableAging, setPayableAging] = useState(defaultPayableAging);
  const [purchaseHistory, setPurchaseHistory] = useState(defaultPurchaseHistory);
  const [marginReport, setMarginReport] = useState(defaultMarginReport);
  const [topSuppliersReport, setTopSuppliersReport] = useState(defaultTopSuppliersReport);
  const { settings } = useSystemSettings();

  useEffect(() => {
    const fetchLookups = async () => {
      try {
        const [customersRes, productsRes, suppliersRes] = await Promise.all([
          api.get('/customers'),
          api.get('/products'),
          api.get('/suppliers')
        ]);

        const customerRows = customersRes.data.data || [];
        const productRows = productsRes.data.data || [];
        const supplierRows = suppliersRes.data.data || [];

        setCustomers(customerRows);
        setProducts(productRows);
        setSuppliers(supplierRows);

        if (!selectedCustomer && customerRows.length > 0) {
          setSelectedCustomer(customerRows[0]._id);
        }

        if (!selectedProduct && productRows.length > 0) {
          setSelectedProduct(productRows[0]._id);
        }

        if (!selectedSupplier && supplierRows.length > 0) {
          setSelectedSupplier(supplierRows[0]._id);
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

  const selectedSupplierRecord = useMemo(
    () => suppliers.find((supplier) => supplier._id === selectedSupplier) || null,
    [selectedSupplier, suppliers]
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

        if (reportType === 'product') {
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
          return;
        }

        if (reportType === 'supplier') {
          if (!selectedSupplier) {
            setSupplierStatement(defaultSupplierStatement);
            return;
          }

          const res = await api.get('/reports/supplier-statement', {
            params: {
              ...params,
              supplier_id: selectedSupplier
            }
          });
          setSupplierStatement(res.data.data || defaultSupplierStatement);
          return;
        }

        if (reportType === 'aging') {
          const res = await api.get('/reports/accounts-payable-aging', { params });
          setPayableAging(res.data.data || defaultPayableAging);
          return;
        }

        if (reportType === 'purchases') {
          if (!selectedProduct) {
            setPurchaseHistory(defaultPurchaseHistory);
            return;
          }

          const res = await api.get('/reports/purchase-history', {
            params: {
              ...params,
              product_id: selectedProduct,
              ...(selectedVariant ? { variant_id: selectedVariant } : {})
            }
          });
          setPurchaseHistory(res.data.data || defaultPurchaseHistory);
          return;
        }

        if (reportType === 'margin') {
          const res = await api.get('/reports/margin-erosion', { params });
          setMarginReport(res.data.data || defaultMarginReport);
          return;
        }

        const res = await api.get('/reports/top-suppliers', { params });
        setTopSuppliersReport(res.data.data || defaultTopSuppliersReport);
      } catch (err) {
        console.error('Failed to load report', err);
        if (reportType === 'pnl') setPnLData(defaultPnLData);
        if (reportType === 'customer') setCustomerReport({ customer: null, summary: null, sales: [] });
        if (reportType === 'product') setProductReport({ product: null, summary: null, sales: [] });
        if (reportType === 'supplier') setSupplierStatement(defaultSupplierStatement);
        if (reportType === 'aging') setPayableAging(defaultPayableAging);
        if (reportType === 'purchases') setPurchaseHistory(defaultPurchaseHistory);
        if (reportType === 'margin') setMarginReport(defaultMarginReport);
        if (reportType === 'top-suppliers') setTopSuppliersReport(defaultTopSuppliersReport);
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [period, reportType, selectedCustomer, selectedProduct, selectedVariant, selectedSupplier]);

  const handleExport = () => {
    const label = reportLabels[reportType] || 'Report';
    document.title = `${settings.business_name} ${label} - ${period}`;
    window.print();
  };

  const generatedAt = new Date().toLocaleString();
  const isProductScopedReport = reportType === 'product' || reportType === 'purchases';
  const pnlGrossMargin = calcMargin(pnlData.gross_profit, pnlData.gross_revenue);
  const pnlNetMargin = calcMargin(pnlData.net_profit, pnlData.gross_revenue);
  const customerMargin = calcMargin(customerReport.summary?.total_profit, customerReport.summary?.total_revenue);
  const productMargin = calcMargin(productReport.summary?.total_profit, productReport.summary?.total_revenue);

  const renderPnLView = () => (
    <>
      <div className="reports-grid">
        <ReportStatCard
          icon={DollarSign}
          tone="tone-sky"
          title="Gross Revenue"
          value={formatCurrency(pnlData.gross_revenue)}
        />
        <ReportStatCard
          icon={TrendingDown}
          tone="tone-danger"
          title="COGS"
          value={formatCurrency(pnlData.cogs)}
          valueClassName="text-danger"
        />
        <ReportStatCard
          icon={TrendingUp}
          tone="tone-success"
          title="Gross Profit"
          value={formatCurrency(pnlData.gross_profit)}
          valueClassName="text-success"
          note={`${pnlGrossMargin}% Margin`}
        />
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
                    <td className="text-capitalize">{expense.category}</td>
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
          <ReportStatCard
            icon={ShoppingCart}
            tone="tone-primary"
            title="Total Orders"
            value={summary.total_sales || 0}
          />
          <ReportStatCard
            icon={DollarSign}
            tone="tone-success"
            title="Total Revenue"
            value={formatCurrency(summary.total_revenue)}
          />
          <ReportStatCard
            icon={TrendingUp}
            tone="tone-warning"
            title="Total Profit"
            value={formatCurrency(summary.total_profit)}
            valueClassName="text-success"
            note={`${customerMargin}% Margin`}
          />
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
                      <span className="badge text-capitalize">{sale.sale_type || 'retail'}</span>
                      <span className="badge text-capitalize">{sale.payment_method || 'cash'}</span>
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
          <ReportStatCard
            icon={Package}
            tone="tone-primary"
            title="Units Sold"
            value={summary.total_quantity || 0}
          />
          <ReportStatCard
            icon={DollarSign}
            tone="tone-success"
            title="Revenue"
            value={formatCurrency(summary.total_revenue)}
          />
          <ReportStatCard
            icon={TrendingUp}
            tone="tone-warning"
            title="Profit"
            value={formatCurrency(summary.total_profit)}
            valueClassName="text-success"
            note={`${productMargin}% Margin`}
          />
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

  const renderSupplierStatementView = () => {
    const summary = supplierStatement.summary || {
      purchase_volume: 0,
      payments_total: 0,
      outstanding_balance: 0,
      order_count: 0
    };
    const supplier = supplierStatement.supplier || selectedSupplierRecord;

    return (
      <>
        <div className="reports-grid">
          <ReportStatCard icon={Truck} tone="tone-primary" title="Purchase Volume" value={formatCurrency(summary.purchase_volume)} />
          <ReportStatCard icon={CreditCard} tone="tone-success" title="Payments" value={formatCurrency(summary.payments_total)} />
          <ReportStatCard icon={DollarSign} tone="tone-danger" title="Outstanding" value={formatCurrency(summary.outstanding_balance)} />
          <ReportStatCard icon={ReceiptText} tone="tone-warning" title="GRNs" value={summary.order_count || 0} />
        </div>

        <div className="supplier-report-grid">
          <div className="glass-panel main-panel report-detail-panel">
            <div className="detail-header">
              <div>
                <h2>{supplier?.name || 'Supplier statement'}</h2>
                <p className="page-subtitle">
                  {supplier?.contact_name || 'No contact'} {supplier?.phone ? `| ${supplier.phone}` : ''} {supplier?.payment_terms_label ? `| ${supplier.payment_terms_label}` : ''}
                </p>
              </div>
              <div className="report-meta-chip">GRNs: {summary.order_count || 0}</div>
            </div>

            {supplierStatement.purchase_orders?.length ? (
              <div className="report-card-list">
                {supplierStatement.purchase_orders.map((purchaseOrder) => (
                  <div key={purchaseOrder._id} className="report-record-card">
                    <div className="report-record-top">
                      <div>
                        <strong>{purchaseOrder.po_number}</strong>
                        <div className="td-secondary">{new Date(purchaseOrder.received_at || purchaseOrder.ordered_at || purchaseOrder.createdAt).toLocaleDateString()}</div>
                      </div>
                      <span className="badge text-capitalize">{purchaseOrder.status}</span>
                    </div>
                    <table className="report-table">
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>Qty Ordered</th>
                          <th>Qty Received</th>
                          <th>Unit Cost</th>
                          <th className="text-right">Line Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(purchaseOrder.items || []).map((item) => (
                          <tr key={item._id}>
                            <td>
                              <div className="font-medium">{item.variant?.product?.name || 'Unknown item'}</div>
                              <div className="td-secondary">{item.variant?.size || ''}</div>
                            </td>
                            <td>{item.qty_ordered}</td>
                            <td>{item.qty_received}</td>
                            <td>{formatCurrency(item.unit_cost)}</td>
                            <td className="text-right">{formatCurrency(item.line_total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="report-record-footer">
                      <span className="td-secondary">Invoice Ref: {purchaseOrder.invoice_reference || 'N/A'}</span>
                      <strong>{formatCurrency(purchaseOrder.total_amount)}</strong>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">No GRNs found for this supplier in the selected period.</div>
            )}
          </div>

          <div className="glass-panel main-panel report-detail-panel">
            <div className="detail-header">
              <div>
                <h2>Payment Timeline</h2>
                <p className="page-subtitle">Payments recorded against supplier GRNs in the same period.</p>
              </div>
            </div>

            {supplierStatement.payments?.length ? (
              <div className="table-container">
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>GRN</th>
                      <th>Recorded By</th>
                      <th className="text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supplierStatement.payments.map((payment) => (
                      <tr key={payment._id}>
                        <td>{new Date(payment.paid_at || payment.createdAt).toLocaleDateString()}</td>
                        <td>{payment.po_id?.po_number || 'N/A'}</td>
                        <td>{payment.recorded_by?.username || 'Unknown'}</td>
                        <td className="text-right">{formatCurrency(payment.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">No payments recorded in the selected period.</div>
            )}
          </div>
        </div>
      </>
    );
  };

  const renderPayableAgingView = () => {
    const summary = payableAging.summary || {
      total_owed: 0,
      current: 0,
      due_0_7: 0,
      due_8_14: 0,
      due_15_30: 0,
      due_30_plus: 0
    };

    return (
      <>
        <div className="reports-grid">
          <ReportStatCard icon={DollarSign} tone="tone-danger" title="Total Owed" value={formatCurrency(summary.total_owed)} />
          <ReportStatCard icon={Clock3} tone="tone-primary" title="Current" value={formatCurrency(summary.current)} />
          <ReportStatCard icon={TrendingDown} tone="tone-warning" title="8-14 Days" value={formatCurrency(summary.due_8_14)} />
          <ReportStatCard icon={AlertTriangle} tone="tone-danger" title="30+ Days" value={formatCurrency(summary.due_30_plus)} />
        </div>

        <div className="glass-panel main-panel report-detail-panel">
          <div className="detail-header">
            <div>
              <h2>Accounts Payable Aging</h2>
              <p className="page-subtitle">Outstanding GRNs grouped by how far they have moved past supplier payment terms.</p>
            </div>
          </div>
          <div className="table-container">
            <table className="report-table">
              <thead>
                <tr>
                  <th>GRN</th>
                  <th>Supplier</th>
                  <th>Due Date</th>
                  <th>Bucket</th>
                  <th className="text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {(payableAging.rows || []).map((row) => (
                  <tr key={row._id}>
                    <td>{row.po_number}</td>
                    <td>{row.supplier?.name || 'Unknown supplier'}</td>
                    <td>{row.payment_due_date ? new Date(row.payment_due_date).toLocaleDateString() : 'Not set'}</td>
                    <td>{row.bucket === 'current' ? 'Current' : `${row.days_past_due} days overdue`}</td>
                    <td className="text-right">{formatCurrency(row.balance_outstanding)}</td>
                  </tr>
                ))}
                {(payableAging.rows || []).length === 0 && (
                  <tr>
                    <td colSpan="5" className="empty-state">No outstanding balances found for the selected period.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </>
    );
  };

  const renderPurchaseHistoryView = () => {
    const summary = purchaseHistory.summary || {
      total_qty_ordered: 0,
      total_qty_received: 0,
      total_spend: 0,
      supplier_count: 0
    };

    return (
      <>
        <div className="reports-grid">
          <ReportStatCard icon={Package} tone="tone-primary" title="Qty Ordered" value={summary.total_qty_ordered || 0} />
          <ReportStatCard icon={Truck} tone="tone-success" title="Qty Received" value={summary.total_qty_received || 0} />
          <ReportStatCard icon={DollarSign} tone="tone-warning" title="Purchase Spend" value={formatCurrency(summary.total_spend)} />
          <ReportStatCard icon={Building2} tone="tone-danger" title="Suppliers" value={summary.supplier_count || 0} />
        </div>

        <div className="glass-panel main-panel report-detail-panel">
          <div className="detail-header">
            <div>
              <h2>Purchase History by SKU</h2>
              <p className="page-subtitle">See supplier, quantity, and cost changes over time for the selected product or variant.</p>
            </div>
          </div>
          <div className="table-container">
            <table className="report-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Supplier</th>
                  <th>SKU</th>
                  <th>Qty Ordered</th>
                  <th>Qty Received</th>
                  <th>Unit Cost</th>
                  <th className="text-right">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {(purchaseHistory.rows || []).map((row) => (
                  <tr key={row._id}>
                    <td>{new Date(row.received_at || row.ordered_at).toLocaleDateString()}</td>
                    <td>{row.supplier?.name || 'Unknown supplier'}</td>
                    <td>
                      <div className="font-medium">{row.variant?.product?.name || 'Unknown item'}</div>
                      <div className="td-secondary">{row.variant?.size || ''}</div>
                    </td>
                    <td>{row.qty_ordered}</td>
                    <td>{row.qty_received}</td>
                    <td>{formatCurrency(row.unit_cost)}</td>
                    <td className="text-right">{formatCurrency(row.line_total)}</td>
                  </tr>
                ))}
                {(purchaseHistory.rows || []).length === 0 && (
                  <tr>
                    <td colSpan="7" className="empty-state">No purchase history found for the selected SKU.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </>
    );
  };

  const renderMarginErosionView = () => (
    <>
      <div className="reports-grid">
        <ReportStatCard icon={AlertTriangle} tone="tone-warning" title="Threshold" value={`${marginReport.threshold || 0}%`} />
        <ReportStatCard icon={Package} tone="tone-primary" title="Affected SKUs" value={marginReport.rows?.length || 0} />
        <ReportStatCard icon={TrendingDown} tone="tone-danger" title="Lowest Retail Margin" value={`${Number(marginReport.rows?.[0]?.retail_margin_pct || 0).toFixed(1)}%`} />
        <ReportStatCard icon={DollarSign} tone="tone-success" title="Highest Cost Increase" value={formatCurrency(Math.max(...(marginReport.rows || []).map((row) => Number(row.cost_change || 0)), 0))} />
      </div>

      <div className="glass-panel main-panel report-detail-panel">
        <div className="detail-header">
          <div>
            <h2>Margin Erosion</h2>
            <p className="page-subtitle">SKUs where supplier cost has risen or retail/wholesale margin has dropped below the configured threshold.</p>
          </div>
        </div>
        <div className="table-container">
          <table className="report-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Previous Cost</th>
                <th>Current Cost</th>
                <th>Retail Margin</th>
                <th>Wholesale Margin</th>
                <th className="text-right">Cost Change</th>
              </tr>
            </thead>
            <tbody>
              {(marginReport.rows || []).map((row) => (
                <tr key={row.variant_id}>
                  <td>
                    <div className="font-medium">{row.product?.name || 'Unknown item'}</div>
                    <div className="td-secondary">{row.size} {row.product?.brand ? `| ${row.product.brand}` : ''}</div>
                  </td>
                  <td>{formatCurrency(row.previous_cost)}</td>
                  <td>{formatCurrency(row.current_cost)}</td>
                  <td className={row.retail_margin_pct < row.threshold ? 'text-danger' : ''}>{Number(row.retail_margin_pct || 0).toFixed(1)}%</td>
                  <td className={row.wholesale_margin_pct < row.threshold ? 'text-danger' : ''}>{Number(row.wholesale_margin_pct || 0).toFixed(1)}%</td>
                  <td className="text-right">{formatCurrency(row.cost_change)}</td>
                </tr>
              ))}
              {(marginReport.rows || []).length === 0 && (
                <tr>
                  <td colSpan="6" className="empty-state">No margin erosion risks found for the selected period.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );

  const renderTopSuppliersView = () => {
    const summary = topSuppliersReport.summary || {
      purchase_volume: 0,
      outstanding_balance: 0,
      orders_count: 0
    };

    return (
      <>
        <div className="reports-grid">
          <ReportStatCard icon={Building2} tone="tone-primary" title="Suppliers" value={topSuppliersReport.rows?.length || 0} />
          <ReportStatCard icon={DollarSign} tone="tone-success" title="Purchase Volume" value={formatCurrency(summary.purchase_volume)} />
          <ReportStatCard icon={ReceiptText} tone="tone-warning" title="GRNs" value={summary.orders_count || 0} />
          <ReportStatCard icon={Wallet} tone="tone-danger" title="Outstanding" value={formatCurrency(summary.outstanding_balance)} />
        </div>

        <div className="glass-panel main-panel report-detail-panel">
          <div className="detail-header">
            <div>
              <h2>Top Suppliers by Purchase Volume</h2>
              <p className="page-subtitle">Rank suppliers by total received purchase value within the selected period.</p>
            </div>
          </div>
          <div className="table-container">
            <table className="report-table">
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Payment Terms</th>
                  <th>Orders</th>
                  <th>Paid</th>
                  <th>Outstanding</th>
                  <th className="text-right">Purchase Volume</th>
                </tr>
              </thead>
              <tbody>
                {(topSuppliersReport.rows || []).map((row) => (
                  <tr key={row.supplier_id}>
                    <td>
                      <div className="font-medium">{row.supplier_name}</div>
                      <div className="td-secondary">{row.phone || 'No phone'}</div>
                    </td>
                    <td>{row.payment_terms_label}</td>
                    <td>{row.orders_count}</td>
                    <td>{formatCurrency(row.amount_paid)}</td>
                    <td>{formatCurrency(row.outstanding_balance)}</td>
                    <td className="text-right">{formatCurrency(row.purchase_volume)}</td>
                  </tr>
                ))}
                {(topSuppliersReport.rows || []).length === 0 && (
                  <tr>
                    <td colSpan="6" className="empty-state">No supplier purchase activity found for the selected period.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </>
    );
  };

  const exportLabel = reportLabels[reportType] || 'Report';
  const exportTitle = exportLabel;

  return (
    <div className="page-container animate-fade-in reports-wrapper">
      <div className="page-header report-toolbar-wrap">
        <div className="page-header-copy">
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">Track sales, supplier liabilities, purchase costs, and margin health from one reporting workspace.</p>
        </div>
        <div className="page-header-actions report-actions">
          <div className="toolbar-control compact report-period-control">
            <label>Period</label>
            <select className="filter-select field-select" value={period} onChange={(e) => setPeriod(e.target.value)}>
              <option value="Today">Today</option>
              <option value="Week">This Week</option>
              <option value="Month">This Month</option>
              <option value="Year">This Year</option>
            </select>
          </div>
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
          <button className={reportType === 'supplier' ? 'active' : ''} onClick={() => setReportType('supplier')}>Supplier Statement</button>
          <button className={reportType === 'aging' ? 'active' : ''} onClick={() => setReportType('aging')}>AP Aging</button>
          <button className={reportType === 'purchases' ? 'active' : ''} onClick={() => setReportType('purchases')}>Purchase History</button>
          <button className={reportType === 'margin' ? 'active' : ''} onClick={() => setReportType('margin')}>Margin Erosion</button>
          <button className={reportType === 'top-suppliers' ? 'active' : ''} onClick={() => setReportType('top-suppliers')}>Top Suppliers</button>
        </div>

        {reportType === 'customer' && (
          <div className="report-filter-row">
            <label>
              <span><User size={16} /> Customer</span>
              <select className="filter-select" value={selectedCustomer} onChange={(e) => setSelectedCustomer(e.target.value)}>
                {customers.length === 0 && <option value="">No customers available</option>}
                {customers.map((customer) => (
                  <option key={customer._id} value={customer._id}>{customer.name}</option>
                ))}
              </select>
            </label>
          </div>
        )}

        {reportType === 'supplier' && (
          <div className="report-filter-row">
            <label>
              <span><Building2 size={16} /> Supplier</span>
              <select className="filter-select" value={selectedSupplier} onChange={(e) => setSelectedSupplier(e.target.value)}>
                {suppliers.length === 0 && <option value="">No suppliers available</option>}
                {suppliers.map((supplier) => (
                  <option key={supplier._id} value={supplier._id}>{supplier.name}</option>
                ))}
              </select>
            </label>
          </div>
        )}

        {isProductScopedReport && (
          <div className="report-filter-row">
            <label>
              <span><Package size={16} /> Product</span>
              <select className="filter-select" value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)}>
                {products.length === 0 && <option value="">No products available</option>}
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
          {reportType === 'supplier' && renderSupplierStatementView()}
          {reportType === 'aging' && renderPayableAgingView()}
          {reportType === 'purchases' && renderPurchaseHistoryView()}
          {reportType === 'margin' && renderMarginErosionView()}
          {reportType === 'top-suppliers' && renderTopSuppliersView()}
        </>
      )}

      <section className="report-export-sheet">
        <div className="report-export-header">
          <div className="report-branding">
            {settings.business_logo_url ? (
              <img src={settings.business_logo_url} alt={settings.business_name} />
            ) : (
              <div className="report-brand-fallback">
                {(settings.business_name || 'B').trim().charAt(0).toUpperCase() || 'B'}
              </div>
            )}
            <div>
              <span className="report-kicker">{settings.business_name}</span>
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
                    <td className="text-capitalize">{expense.category}</td>
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

        {reportType === 'supplier' && (
          <>
            <div className="report-export-summary">
              <div className="report-export-card"><span>Supplier</span><strong>{(supplierStatement.supplier || selectedSupplierRecord)?.name || 'N/A'}</strong></div>
              <div className="report-export-card"><span>Purchase Volume</span><strong>{formatCurrency(supplierStatement.summary?.purchase_volume)}</strong></div>
              <div className="report-export-card"><span>Payments</span><strong>{formatCurrency(supplierStatement.summary?.payments_total)}</strong></div>
              <div className="report-export-card"><span>Outstanding</span><strong>{formatCurrency(supplierStatement.summary?.outstanding_balance)}</strong></div>
            </div>

            <table className="report-export-table">
              <thead>
                <tr>
                  <th>GRN</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Invoice Ref</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {(supplierStatement.purchase_orders || []).map((purchaseOrder) => (
                  <tr key={purchaseOrder._id}>
                    <td>{purchaseOrder.po_number}</td>
                    <td>{new Date(purchaseOrder.received_at || purchaseOrder.ordered_at || purchaseOrder.createdAt).toLocaleDateString()}</td>
                    <td>{purchaseOrder.status}</td>
                    <td>{purchaseOrder.invoice_reference || 'N/A'}</td>
                    <td className="text-right">{Number(purchaseOrder.total_amount || 0).toLocaleString()}</td>
                  </tr>
                ))}
                {(supplierStatement.purchase_orders || []).length === 0 && (
                  <tr>
                    <td colSpan="5" className="text-right">No GRNs found for this supplier in the selected period.</td>
                  </tr>
                )}
              </tbody>
            </table>

            <table className="report-export-table">
              <thead>
                <tr>
                  <th>Payment Date</th>
                  <th>GRN</th>
                  <th>Recorded By</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(supplierStatement.payments || []).map((payment) => (
                  <tr key={payment._id}>
                    <td>{new Date(payment.paid_at || payment.createdAt).toLocaleDateString()}</td>
                    <td>{payment.po_id?.po_number || 'N/A'}</td>
                    <td>{payment.recorded_by?.username || 'Unknown'}</td>
                    <td className="text-right">{Number(payment.amount || 0).toLocaleString()}</td>
                  </tr>
                ))}
                {(supplierStatement.payments || []).length === 0 && (
                  <tr>
                    <td colSpan="4" className="text-right">No payments recorded in the selected period.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </>
        )}

        {reportType === 'aging' && (
          <>
            <div className="report-export-summary">
              <div className="report-export-card"><span>Total Owed</span><strong>{formatCurrency(payableAging.summary?.total_owed)}</strong></div>
              <div className="report-export-card"><span>Current</span><strong>{formatCurrency(payableAging.summary?.current)}</strong></div>
              <div className="report-export-card"><span>0-7 Days</span><strong>{formatCurrency(payableAging.summary?.due_0_7)}</strong></div>
              <div className="report-export-card"><span>30+ Days</span><strong>{formatCurrency(payableAging.summary?.due_30_plus)}</strong></div>
            </div>

            <table className="report-export-table">
              <thead>
                <tr>
                  <th>GRN</th>
                  <th>Supplier</th>
                  <th>Due Date</th>
                  <th>Bucket</th>
                  <th className="text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {(payableAging.rows || []).map((row) => (
                  <tr key={row._id}>
                    <td>{row.po_number}</td>
                    <td>{row.supplier?.name || 'Unknown supplier'}</td>
                    <td>{row.payment_due_date ? new Date(row.payment_due_date).toLocaleDateString() : 'Not set'}</td>
                    <td>{row.bucket === 'current' ? 'Current' : `${row.days_past_due} days overdue`}</td>
                    <td className="text-right">{Number(row.balance_outstanding || 0).toLocaleString()}</td>
                  </tr>
                ))}
                {(payableAging.rows || []).length === 0 && (
                  <tr>
                    <td colSpan="5" className="text-right">No outstanding balances found for the selected period.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </>
        )}

        {reportType === 'purchases' && (
          <>
            <div className="report-export-summary">
              <div className="report-export-card"><span>Product</span><strong>{selectedProductRecord?.name || 'N/A'}</strong></div>
              <div className="report-export-card"><span>Qty Ordered</span><strong>{purchaseHistory.summary?.total_qty_ordered || 0}</strong></div>
              <div className="report-export-card"><span>Qty Received</span><strong>{purchaseHistory.summary?.total_qty_received || 0}</strong></div>
              <div className="report-export-card"><span>Spend</span><strong>{formatCurrency(purchaseHistory.summary?.total_spend)}</strong></div>
            </div>

            <table className="report-export-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Supplier</th>
                  <th>SKU</th>
                  <th>Qty Ordered</th>
                  <th>Qty Received</th>
                  <th>Unit Cost</th>
                  <th className="text-right">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {(purchaseHistory.rows || []).map((row) => (
                  <tr key={row._id}>
                    <td>{new Date(row.received_at || row.ordered_at).toLocaleDateString()}</td>
                    <td>{row.supplier?.name || 'Unknown supplier'}</td>
                    <td>{row.variant?.product?.name || 'Unknown item'} {row.variant?.size ? `(${row.variant.size})` : ''}</td>
                    <td>{row.qty_ordered}</td>
                    <td>{row.qty_received}</td>
                    <td>{Number(row.unit_cost || 0).toLocaleString()}</td>
                    <td className="text-right">{Number(row.line_total || 0).toLocaleString()}</td>
                  </tr>
                ))}
                {(purchaseHistory.rows || []).length === 0 && (
                  <tr>
                    <td colSpan="7" className="text-right">No purchase history found for the selected SKU.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </>
        )}

        {reportType === 'margin' && (
          <>
            <div className="report-export-summary">
              <div className="report-export-card"><span>Threshold</span><strong>{marginReport.threshold || 0}%</strong></div>
              <div className="report-export-card"><span>Affected SKUs</span><strong>{marginReport.rows?.length || 0}</strong></div>
              <div className="report-export-card"><span>Lowest Retail Margin</span><strong>{Number(marginReport.rows?.[0]?.retail_margin_pct || 0).toFixed(1)}%</strong></div>
              <div className="report-export-card"><span>Largest Cost Increase</span><strong>{formatCurrency(Math.max(...(marginReport.rows || []).map((row) => Number(row.cost_change || 0)), 0))}</strong></div>
            </div>

            <table className="report-export-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Previous Cost</th>
                  <th>Current Cost</th>
                  <th>Retail Margin</th>
                  <th>Wholesale Margin</th>
                  <th className="text-right">Cost Change</th>
                </tr>
              </thead>
              <tbody>
                {(marginReport.rows || []).map((row) => (
                  <tr key={row.variant_id}>
                    <td>{row.product?.name || 'Unknown item'} {row.size ? `(${row.size})` : ''}</td>
                    <td>{Number(row.previous_cost || 0).toLocaleString()}</td>
                    <td>{Number(row.current_cost || 0).toLocaleString()}</td>
                    <td>{Number(row.retail_margin_pct || 0).toFixed(1)}%</td>
                    <td>{Number(row.wholesale_margin_pct || 0).toFixed(1)}%</td>
                    <td className="text-right">{Number(row.cost_change || 0).toLocaleString()}</td>
                  </tr>
                ))}
                {(marginReport.rows || []).length === 0 && (
                  <tr>
                    <td colSpan="6" className="text-right">No margin erosion risks found for the selected period.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </>
        )}

        {reportType === 'top-suppliers' && (
          <>
            <div className="report-export-summary">
              <div className="report-export-card"><span>Suppliers</span><strong>{topSuppliersReport.rows?.length || 0}</strong></div>
              <div className="report-export-card"><span>Purchase Volume</span><strong>{formatCurrency(topSuppliersReport.summary?.purchase_volume)}</strong></div>
              <div className="report-export-card"><span>GRNs</span><strong>{topSuppliersReport.summary?.orders_count || 0}</strong></div>
              <div className="report-export-card"><span>Outstanding</span><strong>{formatCurrency(topSuppliersReport.summary?.outstanding_balance)}</strong></div>
            </div>

            <table className="report-export-table">
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Payment Terms</th>
                  <th>Orders</th>
                  <th>Paid</th>
                  <th>Outstanding</th>
                  <th className="text-right">Purchase Volume</th>
                </tr>
              </thead>
              <tbody>
                {(topSuppliersReport.rows || []).map((row) => (
                  <tr key={row.supplier_id}>
                    <td>{row.supplier_name}</td>
                    <td>{row.payment_terms_label}</td>
                    <td>{row.orders_count}</td>
                    <td>{Number(row.amount_paid || 0).toLocaleString()}</td>
                    <td>{Number(row.outstanding_balance || 0).toLocaleString()}</td>
                    <td className="text-right">{Number(row.purchase_volume || 0).toLocaleString()}</td>
                  </tr>
                ))}
                {(topSuppliersReport.rows || []).length === 0 && (
                  <tr>
                    <td colSpan="6" className="text-right">No supplier purchase activity found for the selected period.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </>
        )}
        <p className="report-export-note">{settings.receipt_footer}</p>
      </section>
    </div>
  );
};

export default Reports;
