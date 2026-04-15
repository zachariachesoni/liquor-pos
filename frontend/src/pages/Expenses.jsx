import React, { useState, useEffect } from 'react';
import { Plus, Receipt, Calendar, PieChart, X } from 'lucide-react';
import api from '../utils/api';
import './Products.css';

const Expenses = () => {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [formData, setFormData] = useState({ amount: '', category: 'other', description: '', expenseDate: new Date().toISOString().split('T')[0] });

  const calculateBudget = () => {
    const categories = {};
    let total = 0;
    expenses.forEach(exp => {
      categories[exp.category] = (categories[exp.category] || 0) + exp.amount;
      total += exp.amount;
    });
    return { categories, total };
  };

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

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Expenses Tracking</h1>
          <p className="page-subtitle">Record and monitor business expenses.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="icon-btn" onClick={() => setShowBudgetModal(true)}><PieChart size={18} /> Budget Report</button>
          <button className="primary-btn" onClick={() => setShowModal(true)}>
             <Plus size={18} /> Record Expense
          </button>
        </div>
      </div>

      <div className="glass-panel main-panel">
        <div className="table-container">
          {loading ? (
             <div style={{ padding: '2rem', textAlign: 'center' }}>Loading expenses from database...</div>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
            <button onClick={() => setShowModal(false)} style={{ position: 'absolute', right: '1rem', top: '1rem', background: 'transparent', border: 'none', color: 'var(--text-color)', cursor: 'pointer'}}>
              <X size={20} />
            </button>
            <h2 style={{ marginBottom: '1.5rem' }}>Record Expense</h2>
            {errorMessage && (
              <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', borderRadius: '8px', background: 'var(--danger-bg)', color: 'var(--danger)' }}>
                {errorMessage}
              </div>
            )}
            <form onSubmit={handleRecordExpense} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label>Description</label>
                <input required type="text" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="e.g. Electricity bill" style={{ width: '100%', padding: '0.5rem', background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--text-color)', borderRadius: '4px' }}/>
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label>Amount (KES)</label>
                  <input required type="number" min="0" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} style={{ width: '100%', padding: '0.5rem', background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--text-color)', borderRadius: '4px' }}/>
                </div>
                <div style={{ flex: 1 }}>
                  <label>Date</label>
                  <input required type="date" value={formData.expenseDate} onChange={e => setFormData({...formData, expenseDate: e.target.value})} style={{ width: '100%', padding: '0.5rem', background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--text-color)', borderRadius: '4px' }}/>
                </div>
              </div>
              <div>
                <label>Category</label>
                <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} style={{ width: '100%', padding: '0.5rem', background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--text-color)', borderRadius: '4px' }}>
                   <option value="rent">Rent</option>
                   <option value="salaries">Salaries</option>
                   <option value="transport">Transport</option>
                   <option value="restocking">Restocking</option>
                   <option value="utilities">Utilities</option>
                   <option value="maintenance">Maintenance</option>
                   <option value="other">Other</option>
                </select>
              </div>
              <button type="submit" className="primary-btn" style={{ marginTop: '1rem' }}>Save Expense</button>
            </form>
          </div>
        </div>
      )}

      {showBudgetModal && (
        <div className="modal-overlay">
          <div className="glass-panel modal-card">
            <button onClick={() => setShowBudgetModal(false)} style={{ position: 'absolute', right: '1rem', top: '1rem', background: 'transparent', border: 'none', color: 'var(--text-color)', cursor: 'pointer'}}>
              <X size={20} />
            </button>
            <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <PieChart className="text-primary"/> Categorical Budget Report
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {(() => {
                const { categories, total } = calculateBudget();
                if (total === 0) return <p>No expenses recorded yet.</p>;
                return Object.entries(categories).sort((a,b) => b[1]-a[1]).map(([cat, amt]) => {
                   const pct = ((amt / total) * 100).toFixed(1);
                   return (
                     <div key={cat} style={{ width: '100%' }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                          <span style={{ textTransform: 'capitalize' }}>{cat}</span>
                          <span>KES {amt.toLocaleString()} ({pct}%)</span>
                       </div>
                       <div style={{ width: '100%', height: '8px', background: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--danger)', borderRadius: '4px' }}></div>
                       </div>
                     </div>
                   );
                });
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;
