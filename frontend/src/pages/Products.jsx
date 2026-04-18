import React, { useState, useEffect } from 'react';
import { Package, Plus, Search, Edit2, Trash2, SlidersHorizontal, X } from 'lucide-react';
import api from '../utils/api';
import './Products.css';

const Products = () => {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '', brand: '', category: 'whisky',
    size: '750ml', size_in_ml: 750,
    buying_price: 0, retail_price: 0, wholesale_price: 0,
    wholesale_threshold: 12, current_stock: 0, min_stock_level: 5
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await api.get('/products');
      // Flatten hierarchical nested variants out to flat rows for UI
      const flatList = [];
      res.data.data.forEach(prod => {
        if (prod.variants && prod.variants.length > 0) {
          prod.variants.forEach(variant => {
            flatList.push({
              id: variant._id,
              productId: prod._id,
              name: prod.name,
              brand: prod.brand,
              variant: variant.size,
              type: prod.category,
              bp: variant.buying_price,
              price: variant.retail_price,
              bulk_price: variant.wholesale_price,
              stock: variant.current_stock,
              minStockLevel: variant.min_stock_level,
              effectiveLowStockLevel: variant.effective_low_stock_level || variant.min_stock_level,
              isActive: prod.is_active !== false && variant.is_active !== false
            });
          });
        }
      });
      setProducts(flatList);
    } catch (err) {
      console.error('Failed to load products', err);
    } finally {
      setLoading(false);
    }
  };

  const calcMargin = (revenue, cost) => {
    if (!revenue) return 0;
    const margin = ((revenue - cost) / revenue) * 100;
    return margin.toFixed(1);
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: formData.name,
        brand: formData.brand,
        category: formData.category,
        is_active: true,
        variants: [{
          size: formData.size,
          size_in_ml: Number(formData.size_in_ml),
          buying_price: Number(formData.buying_price),
          retail_price: Number(formData.retail_price),
          wholesale_price: Number(formData.wholesale_price),
          wholesale_threshold: Number(formData.wholesale_threshold),
          current_stock: Number(formData.current_stock),
          min_stock_level: Number(formData.min_stock_level)
        }]
      };
      await api.post('/products', payload);
      setShowModal(false);
      fetchProducts();
      // Reset
      setFormData({ ...formData, name: '', brand: '', buying_price: 0, retail_price: 0, wholesale_price: 0, current_stock: 0, size_in_ml: 750, size: '750ml', min_stock_level: 5 });
    } catch (err) {
      alert(err.response?.data?.message || 'Error creating product');
      console.error(err);
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (window.confirm("Are you sure you want to delete this product?")) {
      try {
        await api.delete(`/products/${productId}`);
        fetchProducts();
      } catch (err) {
        alert("Error deleting product");
        console.error(err);
      }
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/products/${editData.productId}`, {
        name: editData.name,
        category: editData.type
      });
      await api.put(`/products/variants/${editData.id}`, {
        size: editData.variant,
        buying_price: Number(editData.bp),
        retail_price: Number(editData.price),
        wholesale_price: Number(editData.bulk_price),
        current_stock: Number(editData.stock),
        min_stock_level: Number(editData.minStockLevel)
      });
      setShowEditModal(false);
      fetchProducts();
    } catch (err) {
      alert(err.response?.data?.message || 'Error updating product details');
      console.error(err);
    }
  };

  const categories = ['all', ...new Set(products.map((product) => product.type).filter(Boolean))];

  const filtered = products.filter((product) => {
    const searchTerm = search.trim().toLowerCase();
    const matchesSearch = !searchTerm || [product.name, product.variant, product.type, product.brand]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(searchTerm));

    const matchesCategory = categoryFilter === 'all' || product.type === categoryFilter;
    const matchesStock = stockFilter === 'all'
      || (stockFilter === 'in-stock' && product.stock > 0)
      || (stockFilter === 'low-stock' && product.stock > 0 && product.stock <= product.effectiveLowStockLevel)
      || (stockFilter === 'out-of-stock' && product.stock <= 0);

    return matchesSearch && matchesCategory && matchesStock;
  });

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Products catalog</h1>
          <p className="page-subtitle">Manage your inventory items, costs, and pricing margins.</p>
        </div>
        <button className="primary-btn" onClick={() => setShowModal(true)}>
          <Plus size={18} /> Add Product
        </button>
      </div>

      <div className="glass-panel main-panel">
        <div className="panel-toolbar">
          <div className="search-box">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="icon-btn" onClick={() => setShowFilters((prev) => !prev)}>
            <SlidersHorizontal size={18} /> Filters
          </button>
        </div>

        {showFilters && (
          <div className="panel-toolbar" style={{ paddingTop: 0, borderTop: 'none' }}>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', width: '100%' }}>
              <div style={{ minWidth: '200px' }}>
                <label style={{ display: 'block', marginBottom: '0.4rem' }}>Category</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--text-color)', borderRadius: '8px' }}
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category === 'all' ? 'All categories' : category}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ minWidth: '200px' }}>
                <label style={{ display: 'block', marginBottom: '0.4rem' }}>Stock status</label>
                <select
                  value={stockFilter}
                  onChange={(e) => setStockFilter(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--text-color)', borderRadius: '8px' }}
                >
                  <option value="all">All stock levels</option>
                  <option value="in-stock">In stock</option>
                  <option value="low-stock">Low stock</option>
                  <option value="out-of-stock">Out of stock</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button
                  className="icon-btn"
                  type="button"
                  onClick={() => {
                    setCategoryFilter('all');
                    setStockFilter('all');
                    setSearch('');
                  }}
                >
                  Reset filters
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="table-container">
          {loading ? (
            <div className="loading-panel"><div className="loading-spinner" /><p>Loading product catalog...</p></div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product Info</th>
                  <th>Category</th>
                  <th>Cost (BP)</th>
                  <th>Retail Price (Margin)</th>
                  <th>Wholesale (Margin)</th>
                  <th>Stock</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(product => (
                  <tr key={product.id}>
                    <td>
                      <div className="td-primary">{product.name}</div>
                      <div className="td-secondary">{product.variant}</div>
                    </td>
                    <td><span className="badge">{product.type}</span></td>
                    <td className="font-medium text-danger">KES {product.bp?.toLocaleString() || 0}</td>
                    <td>
                      <div className="font-medium">KES {product.price?.toLocaleString() || 0}</div>
                      <div className="text-success text-xs font-semibold" style={{ fontSize: '0.75rem' }}>
                        {calcMargin(product.price, product.bp)}% Margin
                      </div>
                    </td>
                    <td>
                      <div className="font-medium text-warning">KES {product.bulk_price?.toLocaleString() || 0}</div>
                      <div className="text-success text-xs font-semibold" style={{ fontSize: '0.75rem' }}>
                        {calcMargin(product.bulk_price, product.bp)}% Margin
                      </div>
                    </td>
                    <td>
                      <span className={`status-dot ${product.stock > product.effectiveLowStockLevel ? 'green' : 'red'}`}></span>
                      {product.stock} units
                    </td>
                    <td className="text-right">
                      <button className="action-icon" onClick={() => {
                        setEditData({ ...product });
                        setShowEditModal(true);
                      }}><Edit2 size={16} /></button>
                      <button className="action-icon text-danger" onClick={() => handleDeleteProduct(product.productId)}><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan="7" className="empty-state">No products found.</td>
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
            <h2 className="modal-title">Add New Product</h2>
            <form onSubmit={handleAddProduct} className="modal-form">
              <div className="modal-form-grid">
                <div className="modal-form-field">
                  <label>Product Name</label>
                  <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                </div>
                <div className="modal-form-field">
                  <label>Category</label>
                  <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                    <option value="whisky">Whisky</option>
                    <option value="vodka">Vodka</option>
                    <option value="gin">Gin</option>
                    <option value="rum">Rum</option>
                    <option value="tequila">Tequila</option>
                    <option value="beer">Beer</option>
                    <option value="wine">Wine</option>
                    <option value="spirits">Spirits</option>
                    <option value="soft drinks">Soft Drinks</option>
                    <option value="mixer">Mixer</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="modal-form-field">
                  <label>Variant (e.g. 750ml)</label>
                  <input required type="text" value={formData.size} onChange={e => setFormData({ ...formData, size: e.target.value })} />
                </div>
                <div className="modal-form-field">
                  <label>Starting Stock</label>
                  <input required type="number" value={formData.current_stock} onChange={e => setFormData({ ...formData, current_stock: e.target.value })} />
                </div>
                <div className="modal-form-field">
                  <label>Buying Price (BP)</label>
                  <input required type="number" value={formData.buying_price} onChange={e => setFormData({ ...formData, buying_price: e.target.value })} />
                </div>
                <div className="modal-form-field">
                  <label>Low-Stock Threshold</label>
                  <input required type="number" min="0" value={formData.min_stock_level} onChange={e => setFormData({ ...formData, min_stock_level: e.target.value })} />
                </div>
                <div className="modal-form-field">
                  <label>Retail Price</label>
                  <input required type="number" value={formData.retail_price} onChange={e => setFormData({ ...formData, retail_price: e.target.value })} />
                </div>
                <div className="modal-form-field">
                  <label>Wholesale Price</label>
                  <input required type="number" value={formData.wholesale_price} onChange={e => setFormData({ ...formData, wholesale_price: e.target.value })} />
                </div>
              </div>
              <div className="modal-actions">
                <button type="submit" className="primary-btn">Save & Register Product</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && editData && (
        <div className="modal-overlay">
          <div className="glass-panel modal-card">
            <button className="modal-close-btn" onClick={() => setShowEditModal(false)}>
              <X size={20} />
            </button>
            <h2 className="modal-title">Edit Product Data</h2>
            <form onSubmit={handleEditSubmit} className="modal-form">
              <div className="modal-form-grid">
                <div className="modal-form-field">
                  <label>Product Name</label>
                  <input required type="text" value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} />
                </div>
                <div className="modal-form-field">
                  <label>Category</label>
                  <select value={editData.type} onChange={e => setEditData({ ...editData, type: e.target.value })}>
                    <option value="whisky">Whisky</option>
                    <option value="vodka">Vodka</option>
                    <option value="gin">Gin</option>
                    <option value="rum">Rum</option>
                    <option value="tequila">Tequila</option>
                    <option value="beer">Beer</option>
                    <option value="wine">Wine</option>
                    <option value="spirits">Spirits</option>
                    <option value="soft drinks">Soft Drinks</option>
                    <option value="mixer">Mixer</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="modal-form-field">
                  <label>Variant</label>
                  <input required type="text" value={editData.variant} onChange={e => setEditData({ ...editData, variant: e.target.value })} />
                </div>
                <div className="modal-form-field">
                  <label>Current Stock</label>
                  <input required type="number" value={editData.stock} onChange={e => setEditData({ ...editData, stock: e.target.value })} />
                </div>
                <div className="modal-form-field">
                  <label>Buying Price (BP)</label>
                  <input required type="number" value={editData.bp} onChange={e => setEditData({ ...editData, bp: e.target.value })} />
                </div>
                <div className="modal-form-field">
                  <label>Low-Stock Threshold</label>
                  <input required type="number" min="0" value={editData.minStockLevel} onChange={e => setEditData({ ...editData, minStockLevel: e.target.value })} />
                </div>
                <div className="modal-form-field">
                  <label>Retail Price</label>
                  <input required type="number" value={editData.price} onChange={e => setEditData({ ...editData, price: e.target.value })} />
                </div>
                <div className="modal-form-field">
                  <label>Wholesale Price</label>
                  <input required type="number" value={editData.bulk_price} onChange={e => setEditData({ ...editData, bulk_price: e.target.value })} />
                </div>
              </div>
              <div className="modal-actions">
                <button type="submit" className="primary-btn">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Products;
