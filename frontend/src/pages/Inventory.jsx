import React, { useState, useEffect } from 'react';
import { ClipboardList, ArrowUpRight, ArrowDownRight, AlertTriangle, Plus, X } from 'lucide-react';
import api from '../utils/api';
import './Products.css'; // Re-use common page level CSS

const Inventory = () => {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ variantId: '', quantity: 0, type: 'in', reason: 'restocking', notes: '' });

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const res = await api.get('/inventory/stock-levels');
      setInventory(res.data.data || res.data); // handles wrapper if present
    } catch (err) {
      console.error('Failed to load inventory', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustStock = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        variantId: formData.variantId,
        quantity: Number(formData.quantity),
        type: formData.type,
        reason: formData.reason,
        notes: formData.notes
      };
      await api.post('/inventory/adjustments', payload);
      setShowModal(false);
      fetchInventory();
      setFormData({ variantId: '', quantity: 0, type: 'in', reason: 'restocking', notes: '' });
    } catch (err) {
      alert('Error adjusting stock');
      console.error(err);
    }
  };

  const getStatus = (variant) => {
    if (variant.current_stock === 0) return 'Out';
    if (variant.current_stock <= (variant.effective_low_stock_level || variant.min_stock_level || 5)) return 'Low';
    return 'Optimal';
  };

  const lowStockCount = inventory.filter(v => getStatus(v) !== 'Optimal').length;

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div className="page-header-copy">
          <h1 className="page-title">Inventory Control</h1>
          <p className="page-subtitle">Monitor stock levels and record adjustments.</p>
        </div>
        <div className="page-header-actions">
          <button className="icon-btn icon-btn-warning">
             <AlertTriangle size={18} /> Low Stock ({lowStockCount})
          </button>
          <button className="primary-btn" onClick={() => setShowModal(true)}>
            <Plus size={18} /> Stock Adjustment
          </button>
        </div>
      </div>

      <div className="glass-panel main-panel">
        <div className="table-container">
          {loading ? (
             <div className="loading-panel"><div className="loading-spinner" /><p>Refreshing inventory levels...</p></div>
          ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Stock Level</th>
                <th>Status</th>
                <th>Last Restock</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map(item => {
                const status = getStatus(item);
                return (
                <tr key={item._id}>
                  <td className="font-medium">{item.product_id?.name || 'Unknown/Deleted Product'} {item.size}</td>
                  <td>{item.current_stock} units</td>
                  <td>
                    {status === 'Optimal' && <span className="status-dot green"></span>}
                    {status === 'Low' && <span className="status-dot yellow"></span>}
                    {status === 'Out' && <span className="status-dot red"></span>}
                    {status}
                  </td>
                  <td className="td-secondary">{new Date(item.updatedAt).toLocaleDateString()}</td>
                  <td className="text-right">
                    <button className="action-icon action-icon-success" title="Stock In" onClick={() => { setFormData({...formData, variantId: item._id, type: 'in'}); setShowModal(true); }}>
                      <ArrowUpRight size={16} />
                    </button>
                    <button className="action-icon action-icon-danger" title="Stock Out" onClick={() => { setFormData({...formData, variantId: item._id, type: 'out'}); setShowModal(true); }}>
                      <ArrowDownRight size={16} />
                    </button>
                  </td>
                </tr>
              )})}
              {inventory.length === 0 && (
                <tr>
                  <td colSpan="5" className="empty-state">No inventory variants found.</td>
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
            <h2 className="modal-title">Adjust Stock</h2>
            <form onSubmit={handleAdjustStock} className="modal-form">
              <div className="modal-form-field">
                <label>Inventory Item</label>
                <select required value={formData.variantId} onChange={e => setFormData({...formData, variantId: e.target.value})}>
                   <option value="" disabled>Select Item</option>
                   {inventory.map(item => (
                     <option key={item._id} value={item._id}>{item.product_id?.name} {item.size}</option>
                   ))}
                </select>
              </div>
              <div className="modal-form-grid">
                <div className="modal-form-field">
                  <label>Quantity</label>
                  <input required type="number" min="1" value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} />
                </div>
                <div className="modal-form-field">
                  <label>Adjustment Type</label>
                  <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                     <option value="in">Stock In (Add)</option>
                     <option value="out">Stock Out (Subtract)</option>
                  </select>
                </div>
                <div className="modal-form-field modal-form-field-full">
                  <label>Reason</label>
                  <select value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value})}>
                     <option value="restocking">Restocking</option>
                     <option value="damaged">Damage / Spillage</option>
                     <option value="other">Inventory Correction / Other</option>
                     <option value="promotion">Promotional Giveaway</option>
                  </select>
                </div>
              </div>
              <div className="modal-actions">
                <button type="submit" className="primary-btn">Confirm Adjustment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
