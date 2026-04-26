import React, { useState, useEffect } from 'react';
import { ClipboardList, ArrowUpRight, ArrowDownRight, AlertTriangle, Plus, Truck, X, Search } from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { canManageInventory as canManageInventoryAccess } from '../utils/accessControl';
import './Products.css';
import './Reports.css';
import './Inventory.css';

const Inventory = () => {
  const { user } = useAuth();
  const [inventory, setInventory] = useState([]);
  const [reorderSuggestions, setReorderSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [creatingDraftFor, setCreatingDraftFor] = useState('');
  const [inventorySearch, setInventorySearch] = useState('');
  const [feedback, setFeedback] = useState({ message: '', error: '' });
  const [formData, setFormData] = useState({ variantId: '', quantity: 0, type: 'in', reason: 'restocking', unitCost: '', notes: '' });
  const canManageInventory = canManageInventoryAccess(user?.role);
  const inventoryColumnCount = canManageInventory ? 5 : 4;

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const [inventoryRes, reorderRes] = await Promise.all([
        api.get('/inventory/stock-levels'),
        api.get('/inventory/reorder-suggestions')
      ]);
      setInventory(inventoryRes.data.data || inventoryRes.data);
      setReorderSuggestions(reorderRes.data.data || reorderRes.data || []);
    } catch (err) {
      console.error('Failed to load inventory', err);
      setFeedback({ message: '', error: 'Failed to load inventory insights' });
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
        unitCost: formData.type === 'in' ? formData.unitCost : undefined,
        notes: formData.notes
      };
      await api.post('/inventory/adjustments', payload);
      setShowModal(false);
      fetchInventory();
      setFormData({ variantId: '', quantity: 0, type: 'in', reason: 'restocking', unitCost: '', notes: '' });
      setFeedback({ message: 'Inventory adjustment saved successfully.', error: '' });
    } catch (err) {
      console.error(err);
      setFeedback({ message: '', error: err.response?.data?.message || 'Error adjusting stock' });
    }
  };

  const handleCreateDraftPO = async (suggestion) => {
    if (!suggestion.preferred_supplier?._id) {
      setFeedback({ message: '', error: 'Link a preferred supplier before creating a draft PO.' });
      return;
    }

    try {
      setCreatingDraftFor(suggestion.variant_id);
      await api.post('/purchase-orders', {
        supplier_id: suggestion.preferred_supplier._id,
        status: 'draft',
        notes: `Auto-created from reorder suggestion for ${suggestion.product_name} ${suggestion.size}.`,
        items: [{
          variant_id: suggestion.variant_id,
          qty_ordered: Number(suggestion.suggested_qty || 1),
          qty_received: 0,
          unit_cost: Number(
            suggestion.preferred_supplier.unit_cost
              ?? suggestion.last_purchase?.last_unit_cost
              ?? 0
          ),
          min_order_qty: Number(suggestion.preferred_supplier.min_order_qty || 1),
          lead_time_days: Number(suggestion.preferred_supplier.lead_time_days || 0),
          is_preferred: true
        }]
      });
      setFeedback({ message: `Draft PO created for ${suggestion.product_name} ${suggestion.size}.`, error: '' });
      await fetchInventory();
    } catch (err) {
      console.error('Failed to create draft purchase order', err);
      setFeedback({ message: '', error: err.response?.data?.message || 'Failed to create draft purchase order' });
    } finally {
      setCreatingDraftFor('');
    }
  };

  const getStatus = (variant) => {
    if (variant.current_stock === 0) return 'Out';
    if (variant.current_stock <= (variant.effective_low_stock_level || variant.min_stock_level || 5)) return 'Low';
    return 'Optimal';
  };

  const lowStockCount = inventory.filter(v => getStatus(v) !== 'Optimal').length;
  const normalizedSearch = inventorySearch.trim().toLowerCase();
  const filteredInventory = inventory.filter((item) => {
    if (!normalizedSearch) return true;

    const haystack = [
      item.product_id?.name,
      item.product_id?.category,
      item.size,
      getStatus(item)
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(normalizedSearch);
  });

  const filteredReorderSuggestions = reorderSuggestions.filter((suggestion) => {
    if (!normalizedSearch) return true;

    const haystack = [
      suggestion.product_name,
      suggestion.product_brand,
      suggestion.category,
      suggestion.size,
      suggestion.preferred_supplier?.name
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(normalizedSearch);
  });

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div className="page-header-copy">
          <h1 className="page-title">Inventory Control</h1>
          <p className="page-subtitle">
            {canManageInventory
              ? 'Monitor stock levels, reorder needs, and record adjustments.'
              : 'Monitor stock levels and low-stock reorder needs in a read-only view.'}
          </p>
        </div>
        <div className="page-header-actions">
          <div className="search-box toolbar-search inventory-search">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Search product, size, category..."
              value={inventorySearch}
              onChange={(e) => setInventorySearch(e.target.value)}
            />
          </div>
          <button className="icon-btn icon-btn-warning" onClick={() => setShowSuggestions((prev) => !prev)}>
             <AlertTriangle size={18} /> Reorder ({reorderSuggestions.length || lowStockCount})
          </button>
          {!canManageInventory && <div className="report-meta-chip">Read-only access</div>}
          {canManageInventory && (
            <button className="primary-btn" onClick={() => setShowModal(true)}>
              <Plus size={18} /> Stock Adjustment
            </button>
          )}
        </div>
      </div>

      {(feedback.message || feedback.error) && (
        <div className={`feedback-banner ${feedback.error ? 'error' : 'success'}`}>
          {feedback.error || feedback.message}
        </div>
      )}

      {showSuggestions && (
        <div className="glass-panel main-panel reorder-suggestions-panel">
          <div className="detail-header">
            <div>
              <h2>Reorder Suggestions</h2>
              <p className="page-subtitle">
                {canManageInventory
                  ? 'Preferred supplier, last buy price, lead time, and one-tap draft PO creation for low-stock SKUs.'
                  : 'A read-only view of the SKUs that need restocking attention.'}
              </p>
            </div>
            <div className="report-meta-chip">
              {canManageInventory ? `Suggestions: ${filteredReorderSuggestions.length}` : 'Manager action required'}
            </div>
          </div>

          <div className="reorder-suggestion-grid">
            {filteredReorderSuggestions.map((suggestion) => (
              <div key={suggestion.variant_id} className="glass-panel reorder-suggestion-card">
                <div className="report-record-top">
                  <div>
                    <strong>{suggestion.product_name}</strong>
                    <div className="td-secondary">{suggestion.size} {suggestion.product_brand ? `| ${suggestion.product_brand}` : ''}</div>
                  </div>
                  <span className="badge">Stock {suggestion.current_stock}</span>
                </div>

                <div className="reorder-suggestion-copy">
                  <div><strong>Suggested Qty:</strong> {suggestion.suggested_qty}</div>
                  {canManageInventory ? (
                    <>
                      <div><strong>Preferred Supplier:</strong> {suggestion.preferred_supplier?.name || 'Link supplier first'}</div>
                      <div><strong>Last Cost:</strong> {suggestion.last_purchase?.last_unit_cost ? `KES ${Number(suggestion.last_purchase.last_unit_cost).toLocaleString()}` : 'N/A'}</div>
                      <div><strong>Lead Time:</strong> {suggestion.preferred_supplier ? `${suggestion.preferred_supplier.lead_time_days} days` : 'N/A'}</div>
                    </>
                  ) : (
                    <>
                      <div><strong>Status:</strong> Reorder attention needed</div>
                      <div><strong>Manager Note:</strong> Raise this item for purchasing follow-up.</div>
                    </>
                  )}
                </div>

                <div className="reorder-suggestion-actions">
                  <div className="td-secondary">
                    {suggestion.open_purchase_orders?.length
                      ? `${suggestion.open_purchase_orders.length} open PO(s) already reference this SKU`
                      : 'No draft purchase order yet'}
                  </div>
                  {canManageInventory ? (
                    <button
                      className="primary-btn"
                      onClick={() => handleCreateDraftPO(suggestion)}
                      disabled={!suggestion.preferred_supplier?._id || creatingDraftFor === suggestion.variant_id}
                    >
                      <Truck size={16} /> {creatingDraftFor === suggestion.variant_id ? 'Creating...' : 'Create Draft PO'}
                    </button>
                  ) : (
                    <div className="td-secondary">Draft purchase orders are limited to managers and admins.</div>
                  )}
                </div>
              </div>
            ))}

            {filteredReorderSuggestions.length === 0 && (
              <div className="empty-state">
                {normalizedSearch ? 'No reorder suggestions matched your search.' : 'No reorder suggestions right now.'}
              </div>
            )}
          </div>
        </div>
      )}

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
                {canManageInventory && <th className="text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredInventory.map(item => {
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
                  {canManageInventory && (
                    <td className="text-right">
                      <button className="action-icon action-icon-success" title="Stock In" onClick={() => { setFormData({...formData, variantId: item._id, type: 'in'}); setShowModal(true); }}>
                        <ArrowUpRight size={16} />
                      </button>
                      <button className="action-icon action-icon-danger" title="Stock Out" onClick={() => { setFormData({...formData, variantId: item._id, type: 'out'}); setShowModal(true); }}>
                        <ArrowDownRight size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              )})}
              {filteredInventory.length === 0 && (
                <tr>
                  <td colSpan={inventoryColumnCount} className="empty-state">
                    {normalizedSearch ? 'No inventory items matched your search.' : 'No inventory variants found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          )}
        </div>
      </div>

      {canManageInventory && showModal && (
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
                  {formData.type === 'in' && (
                    <div className="modal-form-field">
                      <label>Unit Cost</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.unitCost}
                        placeholder="Leave blank to use current average cost"
                        onChange={e => setFormData({...formData, unitCost: e.target.value})}
                      />
                    </div>
                  )}
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
