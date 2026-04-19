import React, { useState, useEffect } from 'react';
import { Search, ShoppingCart, Minus, Plus, Trash2, CreditCard, Banknote, UserPlus, Printer, X } from 'lucide-react';
import api from '../utils/api';
import { useSystemSettings } from '../hooks/useSystemSettings';
import { getPrintBaseStyles, getPrintBrandMarkup } from '../utils/printBranding';
import './POS.css';

const POS = () => {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [cartFeedback, setCartFeedback] = useState('');
  const [compactCheckout, setCompactCheckout] = useState(() => (typeof window !== 'undefined' ? window.innerWidth <= 900 : false));
  const [checkoutExpanded, setCheckoutExpanded] = useState(() => (typeof window !== 'undefined' ? window.innerWidth > 900 : true));
  const [search, setSearch] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [priceList, setPriceList] = useState('retail'); // 'retail' or 'wholesale'
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [showWholesaleModal, setShowWholesaleModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '' });
  const { settings, loading: settingsLoading } = useSystemSettings();

  useEffect(() => {
    fetchCatalog();
    fetchCustomers();
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const isCompact = window.innerWidth <= 900;
      setCompactCheckout(isCompact);
      if (!isCompact) {
        setCheckoutExpanded(true);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchCustomers = async () => {
    try {
      const res = await api.get('/customers');
      setCustomers(res.data.data || res.data);
    } catch (err) {
      console.error('Failed to load customers', err);
    }
  };

  const fetchCatalog = async () => {
    try {
      setLoading(true);
      const res = await api.get('/products');
      const flatList = [];
      res.data.data.forEach(prod => {
        if (prod.variants && prod.variants.length > 0) {
          prod.variants.forEach(variant => {
            flatList.push({
              id: variant._id,
              productId: prod._id,
              name: prod.name,
              variant: variant.size,
              category: prod.category,
              price: variant.retail_price,
              wholesale_price: variant.wholesale_price,
              buying_price: variant.buying_price,
              bulk_threshold: variant.wholesale_threshold,
              stock: variant.current_stock
            });
          });
        }
      });
      setProducts(flatList);
    } catch (err) {
      console.error('Failed to load catalog', err);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (product) => {
    if (product.stock <= 0) {
      setCartFeedback(`${product.name} ${product.variant} is out of stock.`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          setCartFeedback(`Only ${product.stock} unit${product.stock === 1 ? '' : 's'} of ${product.name} ${product.variant} are available.`);
          return prev;
        }

        setCartFeedback('');
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }

      setCartFeedback('');
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (id, delta) => {
    setCart((prev) => prev.map(item => {
      if (item.id === id) {
        if (delta > 0 && item.quantity >= item.stock) {
          setCartFeedback(`Only ${item.stock} unit${item.stock === 1 ? '' : 's'} of ${item.name} ${item.variant} are available.`);
          return item;
        }

        const newQty = Math.max(1, item.quantity + delta);
        setCartFeedback('');
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeFromCart = (id) => {
    setCart((prev) => prev.filter(item => item.id !== id));
    setCartFeedback('');
  };

  const activeCustomer = customers.find(c => c._id === selectedCustomerId);
  const isWholesaleBuyer = activeCustomer?.customer_type === 'wholesale';

  const calculateWholesaleApplies = (item) => {
    return isWholesaleBuyer && (priceList === 'wholesale' || item.quantity >= item.bulk_threshold);
  };

  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => {
      const activePrice = calculateWholesaleApplies(item) ? item.wholesale_price : item.price;
      return sum + (activePrice * item.quantity);
    }, 0);
  };

  const subtotal = calculateSubtotal();
  const cartLineCount = cart.length;
  const cartUnitCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const customerSummary = activeCustomer?.name || 'Walk-in customer';
  const activePricingLabel = priceList === 'wholesale' ? 'Wholesale pricing' : 'Retail pricing';
  const cartHeaderSummary = cartLineCount === 0
    ? 'No items yet'
    : `${cartUnitCount} unit${cartUnitCount === 1 ? '' : 's'} in ${cartLineCount} line${cartLineCount === 1 ? '' : 's'}`;
  const normalizedCashReceived = Number(cashReceived || 0);
  const computedAmountPaid = paymentMethod === 'cash'
    ? (normalizedCashReceived > 0 ? normalizedCashReceived : subtotal)
    : subtotal;
  const computedChangeDue = paymentMethod === 'cash' && normalizedCashReceived > 0
    ? Math.max(0, normalizedCashReceived - subtotal)
    : 0;
  const isCashShort = paymentMethod === 'cash' && cashReceived !== '' && normalizedCashReceived < subtotal;
  const outstandingCash = paymentMethod === 'cash' && normalizedCashReceived > 0
    ? Math.max(0, subtotal - normalizedCashReceived)
    : 0;
  const checkoutButtonLabel = isCashShort
    ? 'Enter Full Cash Amount'
    : `Complete ${paymentMethod === 'cash' ? 'Cash Sale' : 'M-Pesa Sale'}`;

  const printReceipt = (receipt) => {
    if (!receipt) return;

    const receiptWindow = window.open('', '_blank', 'width=420,height=720');
    if (!receiptWindow) return;

    const rows = receipt.items.map((item) => `
      <tr>
        <td style="padding:6px 0;">${item.name}<div style="font-size:12px;color:#666;">${item.variant}${item.wholesaleApplied ? ' - Wholesale' : ''}</div></td>
        <td style="padding:6px 0;text-align:center;">${item.quantity}</td>
        <td style="padding:6px 0;text-align:right;">KES ${item.unitPrice.toLocaleString()}</td>
        <td style="padding:6px 0;text-align:right;">KES ${item.total.toLocaleString()}</td>
      </tr>
    `).join('');

    receiptWindow.document.write(`
      <html>
        <head>
          <title>Receipt ${receipt.invoiceNumber}</title>
          <style>
            ${getPrintBaseStyles(`
              body { padding: 24px; color: #111827; }
              .print-page { max-width: 420px; }
              .print-title { font-size: 24px; }
              .print-subtitle { font-size: 13px; }
              .meta { margin: 16px 0; font-size: 14px; line-height: 1.6; }
              table { margin-top: 12px; }
              thead th { text-align: left; border-bottom: 1px solid #d1d5db; padding-bottom: 8px; }
              .totals { margin-top: 16px; border-top: 1px solid #d1d5db; padding-top: 12px; font-size: 14px; }
            `)}
            .totals div { display: flex; justify-content: space-between; margin-bottom: 6px; }
          </style>
        </head>
        <body>
          <div class="print-page">
            ${getPrintBrandMarkup({
              businessName: receipt.businessName,
              businessLogoUrl: receipt.businessLogoUrl,
              documentTitle: 'Sales Receipt',
              subtitle: receipt.invoiceNumber,
              metaRows: [
                `<strong>Date:</strong> ${receipt.createdAt}`,
                `<strong>Customer:</strong> ${receipt.customerName}`,
                `<strong>Payment:</strong> ${receipt.paymentMethod}`,
                `<strong>Price List:</strong> ${receipt.saleType}`
              ]
            })}
            <div class="meta">
              <div><strong>Invoice:</strong> ${receipt.invoiceNumber}</div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th style="text-align:center;">Qty</th>
                  <th style="text-align:right;">Price</th>
                  <th style="text-align:right;">Total</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
            <div class="totals">
              <div><span>Subtotal</span><strong>KES ${receipt.subtotal.toLocaleString()}</strong></div>
              <div><span>Amount Paid</span><strong>KES ${receipt.amountPaid.toLocaleString()}</strong></div>
              <div><span>Change</span><strong>KES ${receipt.changeDue.toLocaleString()}</strong></div>
            </div>
            <p class="print-footer">${receipt.receiptFooter || ''}</p>
          </div>
        </body>
      </html>
    `);
    receiptWindow.document.close();
    receiptWindow.focus();
    receiptWindow.print();
  };

  const handleCheckout = async () => {
    try {
      const receiptItems = cart.map((item) => {
        const wholesaleApplied = calculateWholesaleApplies(item);
        const unitPrice = wholesaleApplied ? item.wholesale_price : item.price;

        return {
          id: item.id,
          name: item.name,
          variant: item.variant,
          quantity: item.quantity,
          unitPrice,
          wholesaleApplied,
          total: unitPrice * item.quantity,
        };
      });

      const payload = {
        customerId: selectedCustomerId || null,
        items: cart.map(item => ({
          variantId: item.id,
          quantity: item.quantity
        })),
        paymentMethod: paymentMethod,
        priceList: priceList,
        amountPaid: computedAmountPaid
      };

      const res = await api.post('/sales', payload);
      const sale = res.data.data;
      let resolvedSettings = settings;

      if (settingsLoading || !settings.business_name || settings.business_name === 'Liquor POS') {
        try {
          const settingsResponse = await api.get('/settings/public');
          resolvedSettings = { ...settings, ...(settingsResponse.data.data || {}) };
        } catch (settingsError) {
          console.error('Failed to refresh business settings before printing receipt', settingsError);
        }
      }

      setReceiptData({
        businessName: resolvedSettings.business_name || 'Business',
        businessLogoUrl: resolvedSettings.business_logo_url || '',
        receiptFooter: resolvedSettings.receipt_footer || '',
        invoiceNumber: sale.invoice_number,
        createdAt: new Date(sale.createdAt || Date.now()).toLocaleString(),
        customerName: activeCustomer?.name || 'Walk-in Customer',
        paymentMethod,
        saleType: priceList,
        subtotal,
        amountPaid: Number(sale.amount_paid || subtotal),
        changeDue: Number(sale.change_due || 0),
        items: receiptItems,
      });
      setShowReceiptModal(true);
      setCart([]);
      setSelectedCustomerId('');
      setPriceList('retail');
      setCashReceived('');
      fetchCatalog(); // Refresh stock
    } catch (err) {
      alert(err.response?.data?.message || 'Checkout failed');
      console.error(err);
    }
  };

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...newCustomer, customer_type: 'wholesale' };
      const res = await api.post('/customers', payload);
      const created = res.data.data;
      setCustomers([...customers, created]);
      setSelectedCustomerId(created._id);
      setPriceList('wholesale');
      setShowWholesaleModal(false);
      setNewCustomer({ name: '', phone: '' });
    } catch (err) {
      alert('Error creating customer');
      console.error(err);
    }
  };

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="pos-container animate-fade-in">
      <div className="pos-catalog glass-panel">
        <div className="catalog-header">
          <h2>Product Catalog</h2>
          <div className="search-box">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="product-grid">
          {loading ? (<div className="catalog-loading">Loading products...</div>) : filteredProducts.map(product => (
            <div
              key={product.id}
              className={`product-card ${product.stock <= 0 ? 'disabled' : ''}`}
              onClick={() => addToCart(product)}
            >
              <div className="product-category-badge">{product.category}</div>
              <h3 className="product-name">{product.name}</h3>
              <div className="product-variant">{product.variant}</div>
              <div className="product-prices">
                <div className={`price-item ${priceList === 'retail' ? 'active-price' : ''}`}>
                  <span>Retail</span>
                  <strong>KES {product.price?.toLocaleString()}</strong>
                </div>
                <div className={`price-item wholesale ${priceList === 'wholesale' ? 'active-price' : ''}`}>
                  <span>Wholesale</span>
                  <strong>KES {product.wholesale_price?.toLocaleString()}</strong>
                </div>
              </div>
              <div className={`product-stock ${product.stock <= 0 ? 'out-of-stock' : ''}`}>
                {product.stock <= 0 ? 'Out of stock' : `${product.stock} in stock`}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="pos-cart glass-panel">
        <div className="cart-header">
          <div className="cart-title-block">
            <div className="cart-title">
              <ShoppingCart size={20} />
              <h2>Current Order</h2>
            </div>
          </div>
          <button className="clear-btn" onClick={() => setCart([])} disabled={cartLineCount === 0}>Clear order</button>
        </div>

        <div className="order-toolbar">
          <div className="toolbar-field customer-field">
            <label className="cart-section-label">Customer</label>
            <select
              className="cart-select"
              value={selectedCustomerId}
              onChange={(e) => {
                const nextCustomerId = e.target.value;
                setSelectedCustomerId(nextCustomerId);
                const customer = customers.find((entry) => entry._id === nextCustomerId);
                setPriceList(customer?.customer_type === 'wholesale' ? 'wholesale' : 'retail');
              }}
            >
              <option value="">Walk-in customer</option>
              {customers.map((customer) => (
                <option key={customer._id} value={customer._id}>
                  {customer.name} {customer.customer_type === 'wholesale' ? '(Wholesale)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="toolbar-field pricing-field">
            <label className="cart-section-label">Pricing</label>
            <div className="pricing-toggle-group">
              <button
                className={`pricing-toggle-btn ${priceList === 'retail' ? 'active' : ''}`}
                onClick={() => { setPriceList('retail'); }}
              >
                Retail
              </button>
              <button
                className={`pricing-toggle-btn ${priceList === 'wholesale' ? 'active' : ''}`}
                onClick={() => {
                   if (!isWholesaleBuyer) {
                     setShowWholesaleModal(true);
                   } else {
                     setPriceList('wholesale');
                   }
                }}
              >
                Wholesale
              </button>
            </div>
          </div>
        </div>

        {(selectedCustomerId || priceList === 'wholesale') && (
          <div className={`cart-context-banner ${isWholesaleBuyer ? 'success' : 'warning'}`}>
            {selectedCustomerId && !isWholesaleBuyer
              ? 'Selected customer uses retail pricing.'
              : isWholesaleBuyer
                ? `Wholesale account active: ${activeCustomer?.name}`
                : 'Wholesale pricing requires a wholesale account.'}
            {!isWholesaleBuyer && (
              <button
                type="button"
                className="pricing-link-btn"
                onClick={() => setShowWholesaleModal(true)}
              >
                Manage wholesale access
              </button>
            )}
          </div>
        )}

        {cartFeedback && (
          <div className="cart-feedback" role="alert">
            {cartFeedback}
          </div>
        )}

        <div className="cart-items">
          {cart.length === 0 ? (
            <div className="empty-cart">
              <ShoppingCart size={48} className="empty-icon" />
              <p>Order is empty</p>
              <span>Tap products on the left to start building this sale.</span>
            </div>
          ) : (
            <>
              <div className="cart-list-header">
                <span>Item</span>
                <span>Qty</span>
                <span></span>
              </div>
              {cart.map(item => {
                const appliesWholesale = calculateWholesaleApplies(item);

                return (
                  <div key={item.id} className={`cart-item ${appliesWholesale ? 'wholesale-active' : ''}`}>
                    <div className="cart-item-details">
                      <h4>{item.name}</h4>
                      <div className="item-subline">
                        <span>{item.variant}</span>
                        {appliesWholesale ? (
                          <span className="item-inline-note">Wholesale</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="quantity-control">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, -1)}
                        disabled={item.quantity <= 1}
                        aria-label={`Decrease quantity for ${item.name} ${item.variant}`}
                      >
                        <Minus size={14} />
                      </button>
                      <span className="quantity-value">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, 1)}
                        disabled={item.quantity >= item.stock}
                        aria-label={`Increase quantity for ${item.name} ${item.variant}`}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <button type="button" className="del-btn" onClick={() => removeFromCart(item.id)} aria-label={`Remove ${item.name} ${item.variant}`}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                );
              })}
            </>
          )}
        </div>

        <div className={`cart-summary ${compactCheckout ? 'compact' : ''}`}>
          <div className="summary-row">
            <span>Subtotal</span>
            <span>KES {subtotal.toLocaleString()}</span>
          </div>
          <div className="summary-row total compact-total-row">
            <span>Total</span>
            <span>KES {subtotal.toLocaleString()}</span>
          </div>

          {compactCheckout && (
            <button
              type="button"
              className="checkout-toggle-btn"
              onClick={() => setCheckoutExpanded((prev) => !prev)}
            >
              {checkoutExpanded ? 'Hide Checkout Controls' : 'Show Checkout Controls'}
            </button>
          )}

          {(!compactCheckout || checkoutExpanded) && (
            <>
              <div className="payment-subheading">Choose payment method</div>
              <div className="payment-methods">
                <button
                  className={`pay-btn ${paymentMethod === 'cash' ? 'active' : ''}`}
                  onClick={() => setPaymentMethod('cash')}
                >
                  <Banknote size={16} /> Cash
                </button>
                <button
                  className={`pay-btn ${paymentMethod === 'mpesa' ? 'active' : ''}`}
                  onClick={() => {
                    setPaymentMethod('mpesa');
                    setCashReceived('');
                  }}
                >
                  <CreditCard size={16} /> M-Pesa
                </button>
              </div>

              {paymentMethod === 'cash' && (
                <div className="cash-panel">
                  <label htmlFor="cashReceived" className="cash-label">Cash Received</label>
                  <input
                    id="cashReceived"
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    className="cash-input"
                    placeholder="Enter amount received"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                  />
                  <div className="cash-summary">
                    <div className="summary-row">
                      <span>Amount Tendered</span>
                      <span>KES {computedAmountPaid.toLocaleString()}</span>
                    </div>
                    {cashReceived !== '' && (
                      <div className={`summary-row ${isCashShort ? 'cash-warning' : 'cash-change'}`}>
                        <span>{isCashShort ? 'Balance Remaining' : 'Change Due'}</span>
                        <span>KES {(isCashShort ? outstandingCash : computedChangeDue).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <button
                className="checkout-btn"
                disabled={cart.length === 0 || isCashShort}
                onClick={handleCheckout}
              >
                {checkoutButtonLabel}
              </button>
              {cart.length === 0 && (
                <div className="checkout-hint">Add at least one item to continue.</div>
              )}
              {isCashShort && (
                <div className="checkout-hint warning">Cash received is below the order total.</div>
              )}
            </>
          )}
        </div>
      </div>

      {showWholesaleModal && (
        <div className="modal-overlay">
          <div className="glass-panel modal-card">
            <button className="modal-close-btn" onClick={() => setShowWholesaleModal(false)}>
              <X size={20} />
            </button>
            <h2 className="modal-title">Select Wholesale Partner</h2>
            <p className="modal-note">You must select an existing wholesale account or create a new one to unlock wholesale pricing.</p>

            <div className="modal-form-field">
              <label>Customer Directory</label>
              <select
                value={selectedCustomerId}
                onChange={e => {
                  setSelectedCustomerId(e.target.value);
                  const cust = customers.find(c => c._id === e.target.value);
                  if (cust?.customer_type === 'wholesale') {
                     setPriceList('wholesale');
                     setShowWholesaleModal(false);
                  }
                }}
              >
                <option value="">-- Search Directory --</option>
                {customers.map(c => (
                  <option key={c._id} value={c._id} disabled={c.customer_type !== 'wholesale'}>
                    {c.name} {c.customer_type !== 'wholesale' ? '(Retail Only - Locked)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="pos-modal-panel">
              <h3 className="pos-modal-panel-title">Or Register New Wholesale Account</h3>
              <form onSubmit={handleCreateCustomer} className="modal-form">
                <div className="modal-form-grid">
                  <div className="modal-form-field modal-form-field-full">
                    <label>Business / Customer Name</label>
                    <input required type="text" value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} />
                  </div>
                  <div className="modal-form-field modal-form-field-full">
                    <label>Phone Number</label>
                    <input type="text" value={newCustomer.phone} onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})} />
                  </div>
                </div>
                <div className="modal-actions">
                  <button type="submit" className="primary-btn">Register & Apply Wholesale</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showReceiptModal && receiptData && (
        <div className="modal-overlay">
          <div className="glass-panel modal-card modal-card-wide pos-receipt-modal">
            <button className="modal-close-btn" onClick={() => setShowReceiptModal(false)}>
              <X size={20} />
            </button>
            <div className="receipt-header">
              <div>
                <h2 className="modal-title">{receiptData.businessName} Receipt</h2>
                <p className="receipt-subtitle">Invoice {receiptData.invoiceNumber}</p>
              </div>
              <button className="primary-btn" onClick={() => printReceipt(receiptData)}>
                <Printer size={18} /> Print Receipt
              </button>
            </div>
            <div className="pos-receipt-body">
              <div className="receipt-meta">
                <div><strong>Date:</strong> {receiptData.createdAt}</div>
                <div><strong>Customer:</strong> {receiptData.customerName}</div>
                <div><strong>Payment:</strong> <span className="receipt-meta-value-capitalize">{receiptData.paymentMethod}</span></div>
                <div><strong>Price List:</strong> <span className="receipt-meta-value-capitalize">{receiptData.saleType}</span></div>
              </div>
              <table className="data-table receipt-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Unit Price</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {receiptData.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="font-medium">{item.name}</div>
                        <div className="td-secondary">
                          {item.variant} {item.wholesaleApplied ? '- Wholesale' : ''}
                        </div>
                      </td>
                      <td>{item.quantity}</td>
                      <td>KES {item.unitPrice.toLocaleString()}</td>
                      <td className="text-right">KES {item.total.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="receipt-totals">
                <div><span>Subtotal</span><strong>KES {receiptData.subtotal.toLocaleString()}</strong></div>
                <div><span>Amount Paid</span><strong>KES {receiptData.amountPaid.toLocaleString()}</strong></div>
                <div><span>Change</span><strong>KES {receiptData.changeDue.toLocaleString()}</strong></div>
              </div>
              {receiptData.receiptFooter && (
                <p className="td-secondary receipt-footer-note">{receiptData.receiptFooter}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POS;
