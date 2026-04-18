import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Receipt, Calendar, PieChart, X, Download } from 'lucide-react';
import api from '../utils/api';
import { useSystemSettings } from '../hooks/useSystemSettings';
import './Products.css';
import './Expenses.css';

const calculateBudget = (expenseRows) => {
  const categories = {};
  const monthly = {};
  let total = 0;

  expenseRows.forEach((exp) => {
    categories[exp.category] = (categories[exp.category] || 0) + exp.amount;
    const monthKey = new Date(exp.expenseDate || exp.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    monthly[monthKey] = (monthly[monthKey] || 0) + exp.amount;
    total += exp.amount;
  });

  const sortedExpenses = [...expenseRows].sort((a, b) => b.amount - a.amount);
  return { categories, monthly, total, sortedExpenses };
};

const Expenses = () => {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [formData, setFormData] = useState({ amount: '', category: 'other', description: '', expenseDate: new Date().toISOString().split('T')[0] });
  const { settings } = useSystemSettings();
  const budget = useMemo(() => calculateBudget(expenses), [expenses]);

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const res = await api.get('/expenses');
      setExpenses(res.data.data || res.data); // in case backend wrap changes
      setErrorMessage('');
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Failed to load expenses');
      console.error('Failed to load expenses', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRecordExpense = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        description: formData.description,
        category: formData.category,
        expenseDate: formData.expenseDate,
        amount: Number(formData.amount)
      };
      await api.post('/expenses', payload);
      setShowModal(false);
      fetchExpenses();
      setFormData({ amount: '', category: 'other', description: '', expenseDate: new Date().toISOString().split('T')[0] });
      setErrorMessage('');
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Error recording expense');
      console.error(err);
    }
  };

  const exportExpenseReport = () => {
    const reportWindow = window.open('', '_blank', 'width=1100,height=900');
    if (!reportWindow) return;

    const { categories, monthly, total, sortedExpenses } = budget;
    const categoryRows = Object.entries(categories)
      .sort((a, b) => b[1] - a[1])
      .map(([category, amount]) => `
        <tr>
          <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-transform:capitalize;">${category}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">KES ${Number(amount).toLocaleString()}</td>
        </tr>
      `)
      .join('');

    const monthlyRows = Object.entries(monthly)
      .map(([month, amount]) => `
        <tr>
          <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;">${month}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">KES ${Number(amount).toLocaleString()}</td>
        </tr>
      `)
      .join('');

    const expenseRows = sortedExpenses
      .map((expense) => `
        <tr>
          <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;">${new Date(expense.expenseDate || expense.createdAt).toLocaleDateString()}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;">${expense.description}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-transform:capitalize;">${expense.category}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;">${expense.recordedBy?.username || 'admin'}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">KES ${Number(expense.amount || 0).toLocaleString()}</td>
        </tr>
      `)
      .join('');

    reportWindow.document.write(`
      <html>
        <head>
          <title>${settings.business_name} Expense Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 28px; color: #111827; }
            h1, h2, h3, p { margin: 0; }
            .header { display:flex; justify-content:space-between; gap:24px; flex-wrap:wrap; margin-bottom:28px; }
            .brand { display:flex; align-items:center; gap:16px; }
            .meta { text-align:right; font-size:14px; line-height:1.7; }
            .summary { display:grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap:16px; margin-bottom:24px; }
            .summary-card { border:1px solid #e5e7eb; border-radius:16px; padding:16px; }
            .summary-card span { display:block; color:#6b7280; font-size:13px; margin-bottom:8px; }
            .summary-card strong { font-size:22px; }
            .grid { display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-bottom:24px; }
            .panel { border:1px solid #e5e7eb; border-radius:16px; padding:18px; }
            table { width:100%; border-collapse:collapse; margin-top:12px; }
            th { text-align:left; font-size:12px; text-transform:uppercase; color:#6b7280; padding:10px 8px; border-bottom:2px solid #d1d5db; }
            .full-panel { border:1px solid #e5e7eb; border-radius:16px; padding:18px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="brand">
              <div>
                <h1>${settings.business_name} Expense Report</h1>
                <p style="margin-top:8px;color:#6b7280;">Comprehensive operating expense summary</p>
              </div>
            </div>
            <div class="meta">
              <div><strong>Generated:</strong> ${new Date().toLocaleString()}</div>
              <div><strong>Total Records:</strong> ${expenses.length}</div>
            </div>
          </div>

          <div class="summary">
            <div class="summary-card"><span>Total Spend</span><strong>KES ${Number(total).toLocaleString()}</strong></div>
            <div class="summary-card"><span>Tracked Categories</span><strong>${Object.keys(categories).length}</strong></div>
            <div class="summary-card"><span>Largest Expense</span><strong>KES ${Number(sortedExpenses[0]?.amount || 0).toLocaleString()}</strong></div>
          </div>

          <div class="grid">
            <div class="panel">
              <h3>Category Breakdown</h3>
              <table>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th style="text-align:right;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${categoryRows || '<tr><td colspan="2" style="padding:12px 8px;color:#6b7280;">No category data.</td></tr>'}
                </tbody>
              </table>
            </div>
            <div class="panel">
              <h3>Monthly Spend Trend</h3>
              <table>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th style="text-align:right;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${monthlyRows || '<tr><td colspan="2" style="padding:12px 8px;color:#6b7280;">No monthly data.</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>

          <div class="full-panel">
            <h3>Expense Ledger</h3>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Recorded By</th>
                  <th style="text-align:right;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${expenseRows || '<tr><td colspan="5" style="padding:12px 8px;color:#6b7280;">No expenses recorded.</td></tr>'}
                ${expenseRows ? `<tr><td colspan="4" style="padding:12px 8px;text-align:right;font-weight:700;">Total Spend</td><td style="padding:12px 8px;text-align:right;font-weight:700;">KES ${Number(total).toLocaleString()}</td></tr>` : ''}
              </tbody>
            </table>
          </div>

          <p style="margin-top:20px;color:#6b7280;font-size:12px;">${settings.receipt_footer || ''}</p>
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
        <div className="page-header-copy">
          <h1 className="page-title">Expenses Tracking</h1>
          <p className="page-subtitle">Record and monitor business expenses.</p>
        </div>
        <div className="page-header-actions">
          <button className="icon-btn" onClick={exportExpenseReport}><Download size={18} /> Export PDF</button>
          <button className="icon-btn" onClick={() => setShowBudgetModal(true)}><PieChart size={18} /> Budget Report</button>
          <button className="primary-btn" onClick={() => setShowModal(true)}>
             <Plus size={18} /> Record Expense
          </button>
        </div>
      </div>

      <div className="glass-panel main-panel">
        <div className="table-container">
          {loading ? (
             <div className="loading-panel"><div className="loading-spinner" /><p>Refreshing expense ledger...</p></div>
          ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Expense Detail</th>
                <th>Category</th>
                <th>Amount (KES)</th>
                <th>Recorded By</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map(exp => (
                <tr key={exp._id}>
                  <td className="td-secondary">
                    <div className="inline-cluster">
                      <Calendar size={14}/> {new Date(exp.expenseDate || exp.createdAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td>
                    <div className="font-medium">{exp.description}</div>
                    <div className="td-secondary">{exp._id.substring(0, 8)}...</div>
                  </td>
                  <td><span className="badge">{exp.category}</span></td>
                  <td className="font-medium text-danger">-{exp.amount?.toLocaleString()}</td>
                  <td className="td-secondary">{exp.recordedBy?.username || 'admin'}</td>
                </tr>
              ))}
              {expenses.length === 0 && (
                <tr>
                  <td colSpan="5" className="empty-state">No expense records found.</td>
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
            <h2 className="modal-title">Record Expense</h2>
            {errorMessage && (
              <div className="feedback-banner error">
                {errorMessage}
              </div>
            )}
            <form onSubmit={handleRecordExpense} className="modal-form">
              <div className="modal-form-grid">
                <div className="modal-form-field">
                  <label>Description</label>
                  <input required type="text" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="e.g. Electricity bill" />
                </div>
                <div className="modal-form-field">
                  <label>Category</label>
                  <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                     <option value="rent">Rent</option>
                     <option value="salaries">Salaries</option>
                     <option value="transport">Transport</option>
                     <option value="restocking">Restocking</option>
                     <option value="utilities">Utilities</option>
                     <option value="maintenance">Maintenance</option>
                     <option value="other">Other</option>
                  </select>
                </div>
                <div className="modal-form-field">
                  <label>Amount (KES)</label>
                  <input required type="number" min="0" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
                </div>
                <div className="modal-form-field">
                  <label>Date</label>
                  <input required type="date" value={formData.expenseDate} onChange={e => setFormData({...formData, expenseDate: e.target.value})} />
                </div>
              </div>
              <div className="modal-actions">
                <button type="submit" className="primary-btn">Save Expense</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBudgetModal && (
        <div className="modal-overlay">
          <div className="glass-panel modal-card modal-card-wide expense-budget-modal">
            <button className="modal-close-btn" onClick={() => setShowBudgetModal(false)}>
              <X size={20} />
            </button>
            <h2 className="expense-budget-title">
              <PieChart className="text-primary"/> Detailed Budget Report
            </h2>
            <div className="expense-budget-summary">
              <div className="glass-panel expense-budget-stat">
                <div className="td-secondary">Total Spend</div>
                <div className="font-medium expense-budget-stat-value">KES {budget.total.toLocaleString()}</div>
              </div>
              <div className="glass-panel expense-budget-stat">
                <div className="td-secondary">Tracked Categories</div>
                <div className="font-medium expense-budget-stat-value">{Object.keys(budget.categories).length}</div>
              </div>
              <div className="glass-panel expense-budget-stat">
                <div className="td-secondary">Largest Expense</div>
                <div className="font-medium expense-budget-stat-value">KES {Number(budget.sortedExpenses[0]?.amount || 0).toLocaleString()}</div>
              </div>
            </div>
            <div className="expense-budget-grid">
              <div className="glass-panel expense-budget-panel">
                <h3 className="expense-budget-panel-title">Category Breakdown</h3>
                <div className="expense-budget-breakdown">
                  {budget.total === 0 ? (
                    <p className="expense-budget-empty">No expenses recorded yet.</p>
                  ) : (
                    Object.entries(budget.categories).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => {
                      const pct = ((amt / budget.total) * 100).toFixed(1);
                      return (
                        <div key={cat} className="expense-budget-breakdown-row">
                          <div className="expense-budget-breakdown-meta">
                            <span className="expense-budget-breakdown-name">{cat}</span>
                            <span className="expense-budget-breakdown-value">KES {amt.toLocaleString()} ({pct}%)</span>
                          </div>
                          <div className="expense-budget-breakdown-track">
                            <div className="expense-budget-breakdown-fill" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
              <div className="glass-panel expense-budget-panel">
                <h3 className="expense-budget-panel-title">Monthly Spend Trend</h3>
                <div className="expense-budget-monthly">
                  {Object.entries(budget.monthly).length === 0 ? (
                    <p className="expense-budget-empty">No monthly data yet.</p>
                  ) : Object.entries(budget.monthly).map(([month, amount]) => (
                    <div key={month} className="expense-budget-month-row">
                      <span>{month}</span>
                      <strong>KES {Number(amount).toLocaleString()}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="glass-panel expense-budget-panel expense-budget-table-panel">
              <h3 className="expense-budget-panel-title">Highest Individual Expenses</h3>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th>Category</th>
                      <th>Date</th>
                      <th className="text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {budget.sortedExpenses.slice(0, 5).map((expense) => (
                      <tr key={expense._id}>
                        <td className="font-medium">{expense.description}</td>
                        <td className="text-capitalize">{expense.category}</td>
                        <td>{new Date(expense.expenseDate || expense.createdAt).toLocaleDateString()}</td>
                        <td className="text-right">KES {Number(expense.amount || 0).toLocaleString()}</td>
                      </tr>
                    ))}
                    {budget.sortedExpenses.length === 0 && (
                      <tr>
                        <td colSpan="4" className="empty-state">No expenses recorded yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;
