import React, { useEffect, useMemo, useState } from 'react';
import {
  BadgePlus,
  Building2,
  ClipboardCheck,
  CreditCard,
  DollarSign,
  FilePlus2,
  Link2,
  PackagePlus,
  Plus,
  Printer,
  Save,
  Search,
  Trash2,
  Truck,
  Wallet,
  X
} from 'lucide-react';
import api from '../utils/api';
import { useSystemSettings } from '../hooks/useSystemSettings';
import { getPrintBaseStyles, getPrintBrandMarkup } from '../utils/printBranding';
import './Products.css';
import './Reports.css';
import './Suppliers.css';

const paymentTermsOptions = [
  { value: 0, label: 'Cash on delivery' },
  { value: 7, label: 'Every 7 days' },
  { value: 14, label: 'Every 14 days' },
  { value: 30, label: 'Every 30 days' }
];

const formatCurrency = (value) => `KES ${Number(value || 0).toLocaleString()}`;
const formatDateInput = (value = new Date()) => new Date(value).toISOString().slice(0, 10);
const paymentTermsLabel = (days = 0) => {
  const normalizedDays = Number(days || 0);
  return paymentTermsOptions.find((option) => option.value === normalizedDays)?.label
    || (normalizedDays > 0 ? `Every ${normalizedDays} day${normalizedDays === 1 ? '' : 's'}` : 'Cash on delivery');
};

const createDefaultSupplierForm = () => ({
  name: '',
  contact_name: '',
  phone: '',
  email: '',
  address: '',
  payment_terms_days: 14,
  credit_limit: 0,
  account_number: '',
  notes: '',
  active: true
});

const createEmptyPurchaseItem = () => ({
  item_id: '',
  variant_id: '',
  qty_ordered: 1,
  qty_received: 1,
  unit_cost: '',
  min_order_qty: 1,
  lead_time_days: 0,
  is_preferred: false
});

const createDefaultPurchaseForm = () => ({
  supplier_id: '',
  purchase_order_id: '',
  mode: 'received',
  ordered_at: formatDateInput(),
  received_at: formatDateInput(),
  invoice_reference: '',
  notes: '',
  amount_paid: 0,
  items: [createEmptyPurchaseItem()]
});

const createDefaultPaymentForm = () => ({
  po_id: '',
  supplier_name: '',
  po_number: '',
  amount: '',
  paid_at: formatDateInput(),
  notes: ''
});

const ReportStatCard = ({ icon: Icon, tone, title, value, note }) => (
  <div className="stat-card glass-panel">
    <div className={`report-stat-icon ${tone}`}>
      <Icon size={24} />
    </div>
    <div className="report-stat-copy">
      <h3>{title}</h3>
      <p className="stat-number">{value}</p>
      {note ? <span className="report-stat-note">{note}</span> : null}
    </div>
  </div>
);

const Suppliers = () => {
  const { settings } = useSystemSettings();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('directory');
  const [suppliers, setSuppliers] = useState([]);
  const [productOptions, setProductOptions] = useState([]);
  const [payables, setPayables] = useState({ summary: { total_owed: 0, overdue_count: 0, overdue_amount: 0, due_this_week: 0, suppliers_with_balances: 0 }, rows: [], suppliers: [] });
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [openPurchaseOrders, setOpenPurchaseOrders] = useState([]);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortMode, setSortMode] = useState('owed_desc');
  const [toast, setToast] = useState(null);

  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [supplierForm, setSupplierForm] = useState(createDefaultSupplierForm());
  const [editingSupplierId, setEditingSupplierId] = useState(null);
  const [savingSupplier, setSavingSupplier] = useState(false);

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [selectedSupplierDetail, setSelectedSupplierDetail] = useState(null);

  const [linkForm, setLinkForm] = useState({
    variant_id: '',
    unit_cost: '',
    min_order_qty: 1,
    lead_time_days: 0,
    is_preferred: false
  });
  const [savingLink, setSavingLink] = useState(false);

  const [purchaseForm, setPurchaseForm] = useState(createDefaultPurchaseForm());
  const [savingPurchase, setSavingPurchase] = useState(false);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState(createDefaultPaymentForm());
  const [savingPayment, setSavingPayment] = useState(false);

  const setPageFeedback = (message = '', error = '') => {
    const text = error || message;
    if (!text) {
      setToast(null);
      return;
    }

    setToast({ message: text, type: error ? 'error' : 'success' });
    window.setTimeout(() => setToast(null), 3200);
  };

  const fetchDashboardData = async () => {
    const [suppliersRes, productsRes, payablesRes, purchaseOrdersRes, openOrdersRes] = await Promise.all([
      api.get('/suppliers'),
      api.get('/products'),
      api.get('/purchase-orders/payables/dashboard'),
      api.get('/purchase-orders'),
      api.get('/purchase-orders/open')
    ]);

    const products = (productsRes.data.data || []).flatMap((product) => (
      (product.variants || []).map((variant) => ({
        variant_id: variant._id,
        product_id: product._id,
        label: `${product.name} ${variant.size}`,
        product_name: product.name,
        brand: product.brand,
        category: product.category,
        size: variant.size,
        buying_price: variant.buying_price,
        retail_price: variant.retail_price,
        wholesale_price: variant.wholesale_price,
        current_stock: variant.current_stock,
        preferred_supplier_name: variant.supplier_summary?.preferred_supplier_name || '',
        preferred_unit_cost: variant.supplier_summary?.preferred_unit_cost ?? null
      }))
    )).sort((left, right) => left.label.localeCompare(right.label));

    setSuppliers(suppliersRes.data.data || []);
    setProductOptions(products);
    setPayables(payablesRes.data.data || { summary: {}, rows: [], suppliers: [] });
    setPurchaseOrders(purchaseOrdersRes.data.data || []);
    setOpenPurchaseOrders(openOrdersRes.data.data || []);
  };

  useEffect(() => {
    const loadPage = async () => {
      try {
        setLoading(true);
        await fetchDashboardData();
      } catch (error) {
        console.error('Failed to load supplier workspace', error);
        setPageFeedback('', error.response?.data?.message || 'Failed to load supplier workspace');
      } finally {
        setLoading(false);
      }
    };

    loadPage();
  }, []);

  const filteredSuppliers = useMemo(() => {
    const query = supplierSearch.trim().toLowerCase();
    const rows = suppliers.filter((supplier) => {
      const matchesSearch = !query || [supplier.name, supplier.contact_name, supplier.phone, supplier.email]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query));

      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'active' && supplier.active)
        || (statusFilter === 'inactive' && !supplier.active);

      return matchesSearch && matchesStatus;
    });

    return [...rows].sort((left, right) => {
      if (sortMode === 'name_asc') return left.name.localeCompare(right.name);
      if (sortMode === 'name_desc') return right.name.localeCompare(left.name);
      if (sortMode === 'owed_asc') return (left.stats?.total_owed || 0) - (right.stats?.total_owed || 0);
      return (right.stats?.total_owed || 0) - (left.stats?.total_owed || 0);
    });
  }, [statusFilter, supplierSearch, sortMode, suppliers]);

  const availableOpenOrders = useMemo(
    () => openPurchaseOrders.filter((purchaseOrder) => purchaseOrder.supplier?._id === purchaseForm.supplier_id),
    [openPurchaseOrders, purchaseForm.supplier_id]
  );

  const recentGrns = useMemo(
    () => purchaseOrders.filter((purchaseOrder) => ['received', 'partially_received'].includes(purchaseOrder.status)).slice(0, 6),
    [purchaseOrders]
  );

  const selectedOpenOrder = useMemo(
    () => availableOpenOrders.find((purchaseOrder) => purchaseOrder._id === purchaseForm.purchase_order_id) || null,
    [availableOpenOrders, purchaseForm.purchase_order_id]
  );

  const supplierStats = useMemo(() => ({
    total_suppliers: suppliers.length,
    active_suppliers: suppliers.filter((supplier) => supplier.active).length,
    linked_skus: suppliers.reduce((sum, supplier) => sum + Number(supplier.stats?.linked_products || 0), 0),
    total_owed: Number(payables.summary?.total_owed || 0)
  }), [payables.summary, suppliers]);

  const purchaseTotals = useMemo(() => purchaseForm.items.reduce((sum, item) => {
    const quantity = purchaseForm.purchase_order_id || purchaseForm.mode === 'received'
      ? Number(item.qty_received || 0)
      : Number(item.qty_ordered || 0);
    return sum + (quantity * Number(item.unit_cost || 0));
  }, 0), [purchaseForm.items, purchaseForm.mode, purchaseForm.purchase_order_id]);

  const loadSupplierDetail = async (supplierId, { openModal = false, silent = false } = {}) => {
    if (!supplierId) {
      setSelectedSupplierId('');
      setSelectedSupplierDetail(null);
      return null;
    }

    try {
      if (!silent) {
        setDetailLoading(true);
      }
      const response = await api.get(`/suppliers/${supplierId}`);
      const detail = response.data.data;
      setSelectedSupplierId(supplierId);
      setSelectedSupplierDetail(detail);
      if (openModal) {
        setShowDetailModal(true);
      }
      return detail;
    } catch (error) {
      console.error('Failed to load supplier detail', error);
      if (!silent) {
        setPageFeedback('', error.response?.data?.message || 'Failed to load supplier detail');
      }
      return null;
    } finally {
      if (!silent) {
        setDetailLoading(false);
      }
    }
  };

  const refreshWorkspace = async ({ refreshSelectedSupplier = true } = {}) => {
    await fetchDashboardData();
    if (refreshSelectedSupplier && selectedSupplierId) {
      await loadSupplierDetail(selectedSupplierId, { silent: true });
    }
  };

  const resetPurchaseForm = (supplierId = '') => {
    setPurchaseForm({
      ...createDefaultPurchaseForm(),
      supplier_id: supplierId
    });
  };

  const handleOpenSupplierModal = (supplier = null) => {
    if (supplier) {
      setEditingSupplierId(supplier._id);
      setSupplierForm({
        name: supplier.name || '',
        contact_name: supplier.contact_name || '',
        phone: supplier.phone || '',
        email: supplier.email || '',
        address: supplier.address || '',
        payment_terms_days: supplier.payment_terms_days ?? 14,
        credit_limit: supplier.credit_limit ?? 0,
        account_number: supplier.account_number || '',
        notes: supplier.notes || '',
        active: supplier.active !== false
      });
    } else {
      setEditingSupplierId(null);
      setSupplierForm(createDefaultSupplierForm());
    }

    setShowSupplierModal(true);
  };

  const handleSaveSupplier = async (event) => {
    event.preventDefault();

    try {
      setSavingSupplier(true);
      const payload = {
        ...supplierForm,
        payment_terms_days: Number(supplierForm.payment_terms_days || 0),
        credit_limit: Number(supplierForm.credit_limit || 0)
      };

      if (editingSupplierId) {
        await api.put(`/suppliers/${editingSupplierId}`, payload);
        setPageFeedback('Supplier updated successfully.');
      } else {
        await api.post('/suppliers', payload);
        setPageFeedback('Supplier created successfully.');
      }

      setShowSupplierModal(false);
      setSupplierForm(createDefaultSupplierForm());
      setEditingSupplierId(null);
      await refreshWorkspace();
    } catch (error) {
      console.error('Failed to save supplier', error);
      setPageFeedback('', error.response?.data?.message || 'Failed to save supplier');
    } finally {
      setSavingSupplier(false);
    }
  };

  const handleDeleteSupplier = async (supplier) => {
    if (!window.confirm(`Delete ${supplier.name}? Suppliers with linked products or GRNs must be marked inactive instead.`)) {
      return;
    }

    try {
      await api.delete(`/suppliers/${supplier._id}`);
      setPageFeedback('Supplier removed successfully.');
      await refreshWorkspace();
    } catch (error) {
      console.error('Failed to delete supplier', error);
      setPageFeedback('', error.response?.data?.message || 'Failed to delete supplier');
    }
  };

  const handleSupplierSelectForPurchase = async (supplierId) => {
    resetPurchaseForm(supplierId);
    if (supplierId) {
      await loadSupplierDetail(supplierId, { silent: true });
    }
  };

  const handleSelectOpenOrder = (purchaseOrderId) => {
    const purchaseOrder = availableOpenOrders.find((entry) => entry._id === purchaseOrderId);
    if (!purchaseOrder) {
      setPurchaseForm((prev) => ({
        ...prev,
        purchase_order_id: '',
        items: [createEmptyPurchaseItem()]
      }));
      return;
    }

    setPurchaseForm((prev) => ({
      ...prev,
      supplier_id: purchaseOrder.supplier?._id || prev.supplier_id,
      purchase_order_id: purchaseOrder._id,
      mode: 'received',
      ordered_at: formatDateInput(purchaseOrder.ordered_at || new Date()),
      received_at: formatDateInput(),
      invoice_reference: purchaseOrder.invoice_reference || '',
      notes: purchaseOrder.notes || '',
      amount_paid: 0,
      items: (purchaseOrder.items || []).map((item) => ({
        item_id: item._id,
        variant_id: item.variant?._id || '',
        qty_ordered: Number(item.qty_ordered || 0),
        qty_received: Math.max(0, Number(item.qty_ordered || 0) - Number(item.qty_received || 0)),
        unit_cost: Number(item.unit_cost || 0),
        min_order_qty: Number(item.qty_ordered || 1),
        lead_time_days: 0,
        is_preferred: false
      }))
    }));
  };

  const updatePurchaseItem = (index, field, value) => {
    setPurchaseForm((prev) => {
      const items = [...prev.items];
      const nextItem = { ...items[index], [field]: value };

      if (field === 'variant_id') {
        const variantOption = productOptions.find((option) => option.variant_id === value);
        const linkedProduct = selectedSupplierDetail?.supplier?._id === prev.supplier_id
          ? (selectedSupplierDetail.linked_products || []).find((link) => link.variant?._id === value)
          : null;

        nextItem.unit_cost = linkedProduct?.unit_cost ?? variantOption?.preferred_unit_cost ?? variantOption?.buying_price ?? '';
        nextItem.min_order_qty = linkedProduct?.min_order_qty ?? nextItem.min_order_qty;
        nextItem.lead_time_days = linkedProduct?.lead_time_days ?? nextItem.lead_time_days;
        nextItem.is_preferred = linkedProduct?.is_preferred ?? false;
      }

      if (field === 'qty_received' && Number(value || 0) > Number(nextItem.qty_ordered || 0)) {
        nextItem.qty_ordered = Number(value || 0);
      }

      items[index] = nextItem;
      return { ...prev, items };
    });
  };

  const addPurchaseItem = () => {
    setPurchaseForm((prev) => ({
      ...prev,
      items: [...prev.items, createEmptyPurchaseItem()]
    }));
  };

  const removePurchaseItem = (index) => {
    setPurchaseForm((prev) => ({
      ...prev,
      items: prev.items.length > 1
        ? prev.items.filter((_, currentIndex) => currentIndex !== index)
        : [createEmptyPurchaseItem()]
    }));
  };

  const printGrn = (purchaseOrder) => {
    if (!purchaseOrder) {
      return;
    }

    const printWindow = window.open('', '_blank', 'width=960,height=900');
    if (!printWindow) {
      return;
    }

    const rows = (purchaseOrder.items || []).map((item) => `
      <tr>
        <td style="padding:10px;border-bottom:1px solid #e5e7eb;">
          <strong>${item.variant?.product?.name || 'Unknown item'}</strong>
          <div style="font-size:12px;color:#64748b;">${item.variant?.size || ''}</div>
        </td>
        <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:center;">${item.qty_ordered}</td>
        <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:center;">${item.qty_received}</td>
        <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:right;">${Number(item.unit_cost || 0).toLocaleString()}</td>
        <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:right;">${Number(item.line_total || 0).toLocaleString()}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>GRN ${purchaseOrder.po_number}</title>
          <style>
            ${getPrintBaseStyles(`
              body { padding: 32px; color: #0f172a; }
              .print-title { font-size: 30px; }
              .panel { border:1px solid #e2e8f0; border-radius:16px; padding:16px; background:#f8fafc; }
              table { margin-top:16px; }
              th { padding:10px; background:#f8fafc; border-bottom:2px solid #cbd5e1; }
            `)}
            .panel { border:1px solid #e2e8f0; border-radius:16px; padding:16px; }
            .summary { margin-top:20px; text-align:right; font-weight:700; }
          </style>
        </head>
        <body>
          <div class="print-page">
            ${getPrintBrandMarkup({
              businessName: settings.business_name,
              businessLogoUrl: settings.business_logo_url,
              documentTitle: 'Goods Received Note',
              subtitle: 'Received supplier stock and liability summary',
              metaRows: [
                `<strong>PO / GRN:</strong> ${purchaseOrder.po_number}`,
                `<strong>Supplier:</strong> ${purchaseOrder.supplier?.name || 'Unknown supplier'}`,
                `<strong>Ordered:</strong> ${purchaseOrder.ordered_at ? new Date(purchaseOrder.ordered_at).toLocaleDateString() : 'N/A'}`,
                `<strong>Received:</strong> ${purchaseOrder.received_at ? new Date(purchaseOrder.received_at).toLocaleDateString() : 'Pending'}`
              ]
            })}
            <div class="panel">
              <div><strong>Status:</strong> ${purchaseOrder.status}</div>
              <div><strong>Payment:</strong> ${purchaseOrder.payment_status}</div>
              <div><strong>Invoice Ref:</strong> ${purchaseOrder.invoice_reference || 'N/A'}</div>
              <div><strong>Total:</strong> KES ${Number(purchaseOrder.total_amount || 0).toLocaleString()}</div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty Ordered</th>
                  <th>Qty Received</th>
                  <th>Unit Cost</th>
                  <th>Line Total</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
            <div class="summary">Outstanding Balance: KES ${Number(purchaseOrder.balance_outstanding || 0).toLocaleString()}</div>
            <p style="margin-top:24px;color:#64748b;">${purchaseOrder.notes || ''}</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const handleSavePurchase = async (mode) => {
    try {
      setSavingPurchase(true);
      const payloadItems = purchaseForm.items
        .filter((item) => item.variant_id)
        .map((item) => ({
          item_id: item.item_id || undefined,
          variant_id: item.variant_id,
          qty_ordered: Number(item.qty_ordered || 0),
          qty_received: mode === 'received' ? Number(item.qty_received || 0) : 0,
          qty_received_now: mode === 'received' ? Number(item.qty_received || 0) : 0,
          unit_cost: Number(item.unit_cost || 0),
          min_order_qty: Number(item.min_order_qty || 1),
          lead_time_days: Number(item.lead_time_days || 0),
          is_preferred: Boolean(item.is_preferred)
        }));

      if (!purchaseForm.supplier_id) {
        throw new Error('Select a supplier before saving a purchase order or GRN');
      }

      if (payloadItems.length === 0) {
        throw new Error('Add at least one line item before saving');
      }

      let response;

      if (purchaseForm.purchase_order_id) {
        response = await api.post(`/purchase-orders/${purchaseForm.purchase_order_id}/receive`, {
          received_at: purchaseForm.received_at,
          amount_paid_increment: mode === 'received' ? Number(purchaseForm.amount_paid || 0) : 0,
          invoice_reference: purchaseForm.invoice_reference,
          notes: purchaseForm.notes,
          items: payloadItems.map((item) => ({
            item_id: item.item_id,
            variant_id: item.variant_id,
            qty_ordered: item.qty_ordered,
            qty_received_now: item.qty_received_now,
            unit_cost: item.unit_cost,
            min_order_qty: item.min_order_qty,
            lead_time_days: item.lead_time_days,
            is_preferred: item.is_preferred
          }))
        });
      } else {
        response = await api.post('/purchase-orders', {
          supplier_id: purchaseForm.supplier_id,
          status: mode === 'draft' ? 'draft' : 'draft',
          ordered_at: purchaseForm.ordered_at,
          received_at: purchaseForm.received_at,
          amount_paid: mode === 'received' ? Number(purchaseForm.amount_paid || 0) : 0,
          invoice_reference: purchaseForm.invoice_reference,
          notes: purchaseForm.notes,
          items: payloadItems.map((item) => ({
            variant_id: item.variant_id,
            qty_ordered: item.qty_ordered,
            qty_received: mode === 'received' ? item.qty_received : 0,
            unit_cost: item.unit_cost,
            min_order_qty: item.min_order_qty,
            lead_time_days: item.lead_time_days,
            is_preferred: item.is_preferred
          }))
        });
      }

      const purchaseOrder = response.data.data;
      setPageFeedback(
        mode === 'draft'
          ? 'Draft purchase order saved successfully.'
          : 'Goods received note saved and stock updated successfully.'
      );

      await refreshWorkspace();
      resetPurchaseForm(purchaseForm.supplier_id);

      if (mode === 'received') {
        printGrn(purchaseOrder);
      }
    } catch (error) {
      console.error('Failed to save purchase order', error);
      setPageFeedback('', error.response?.data?.message || error.message || 'Failed to save purchase order');
    } finally {
      setSavingPurchase(false);
    }
  };

  const handleOpenPaymentModal = (purchaseOrder) => {
    setPaymentForm({
      po_id: purchaseOrder._id,
      supplier_name: purchaseOrder.supplier?.name || '',
      po_number: purchaseOrder.po_number,
      amount: Number(purchaseOrder.balance_outstanding || 0),
      paid_at: formatDateInput(),
      notes: ''
    });
    setShowPaymentModal(true);
  };

  const handleSavePayment = async (event) => {
    event.preventDefault();

    try {
      setSavingPayment(true);
      await api.post(`/purchase-orders/${paymentForm.po_id}/payments`, {
        amount: Number(paymentForm.amount || 0),
        paid_at: paymentForm.paid_at,
        notes: paymentForm.notes
      });
      setShowPaymentModal(false);
      setPaymentForm(createDefaultPaymentForm());
      setPageFeedback('Supplier payment recorded successfully.');
      await refreshWorkspace();
    } catch (error) {
      console.error('Failed to record supplier payment', error);
      setPageFeedback('', error.response?.data?.message || 'Failed to record supplier payment');
    } finally {
      setSavingPayment(false);
    }
  };

  const handleSaveLink = async (event) => {
    event.preventDefault();

    if (!selectedSupplierId) {
      return;
    }

    try {
      setSavingLink(true);
      await api.post(`/suppliers/${selectedSupplierId}/links`, {
        variant_id: linkForm.variant_id,
        unit_cost: Number(linkForm.unit_cost || 0),
        min_order_qty: Number(linkForm.min_order_qty || 1),
        lead_time_days: Number(linkForm.lead_time_days || 0),
        is_preferred: Boolean(linkForm.is_preferred)
      });

      setLinkForm({
        variant_id: '',
        unit_cost: '',
        min_order_qty: 1,
        lead_time_days: 0,
        is_preferred: false
      });
      setPageFeedback('Supplier SKU link saved successfully.');
      await refreshWorkspace();
      await loadSupplierDetail(selectedSupplierId, { silent: true });
    } catch (error) {
      console.error('Failed to save supplier link', error);
      setPageFeedback('', error.response?.data?.message || 'Failed to save supplier link');
    } finally {
      setSavingLink(false);
    }
  };

  const handleDeleteLink = async (link) => {
    if (!window.confirm(`Remove ${link.variant?.product?.name || 'this SKU'} from ${selectedSupplierDetail?.supplier?.name || 'supplier'}?`)) {
      return;
    }

    try {
      await api.delete(`/suppliers/links/${link._id}`);
      setPageFeedback('Supplier SKU link removed.');
      await refreshWorkspace();
      await loadSupplierDetail(selectedSupplierId, { silent: true });
    } catch (error) {
      console.error('Failed to remove supplier link', error);
      setPageFeedback('', error.response?.data?.message || 'Failed to remove supplier link');
    }
  };

  if (loading) {
    return (
      <div className="page-container animate-fade-in">
        <div className="glass-panel main-panel loading-panel">
          <div className="loading-spinner" />
          <p>Loading suppliers workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container animate-fade-in suppliers-page">
      <div className="page-header">
        <div className="page-header-copy">
          <h1 className="page-title">Suppliers & Purchasing</h1>
          <p className="page-subtitle">Manage vendor relationships, receive stock, and keep accounts payable under control.</p>
        </div>
        <div className="page-header-actions">
          <button className="icon-btn" onClick={() => handleOpenSupplierModal()}>
            <BadgePlus size={18} /> Add Supplier
          </button>
          <button className="primary-btn" onClick={() => setActiveTab('receiving')}>
            <PackagePlus size={18} /> New GRN
          </button>
        </div>
      </div>

      {toast && (
        <div className={`toast-popup ${toast.type === 'error' ? 'error' : 'success'}`}>
          {toast.message}
        </div>
      )}

      <div className="reports-grid">
        <ReportStatCard icon={Building2} tone="tone-primary" title="Suppliers" value={supplierStats.total_suppliers} note={`${supplierStats.active_suppliers} active`} />
        <ReportStatCard icon={Wallet} tone="tone-danger" title="Total Owed" value={formatCurrency(payables.summary?.total_owed)} note={`${payables.summary?.suppliers_with_balances || 0} suppliers with balances`} />
        <ReportStatCard icon={CreditCard} tone="tone-warning" title="Overdue GRNs" value={payables.summary?.overdue_count || 0} note={formatCurrency(payables.summary?.overdue_amount)} />
        <ReportStatCard icon={Link2} tone="tone-success" title="Linked SKUs" value={supplierStats.linked_skus} note={`${recentGrns.length} recent GRNs`} />
      </div>

      <div className="glass-panel main-panel report-mode-panel">
        <div className="report-picker-row">
          <label className="toolbar-control report-type-control">
            <span>Supplier View</span>
            <select className="field-select" value={activeTab} onChange={(event) => setActiveTab(event.target.value)}>
              <option value="directory">Supplier Directory</option>
              <option value="receiving">Receiving & GRN</option>
              <option value="payables">Accounts Payable</option>
            </select>
          </label>
        </div>
      </div>

      {activeTab === 'directory' && (
        <div className="glass-panel main-panel">
          <div className="panel-toolbar suppliers-toolbar">
            <div className="search-box">
              <Search size={18} className="search-icon" />
              <input
                type="text"
                placeholder="Search suppliers..."
                value={supplierSearch}
                onChange={(event) => setSupplierSearch(event.target.value)}
              />
            </div>
            <div className="toolbar-inline-group compact">
              <div className="toolbar-control compact">
                <label>Status</label>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="all">All suppliers</option>
                  <option value="active">Active only</option>
                  <option value="inactive">Inactive only</option>
                </select>
              </div>
              <div className="toolbar-control compact">
                <label>Sort</label>
                <select value={sortMode} onChange={(event) => setSortMode(event.target.value)}>
                  <option value="owed_desc">Highest owed</option>
                  <option value="owed_asc">Lowest owed</option>
                  <option value="name_asc">Name A-Z</option>
                  <option value="name_desc">Name Z-A</option>
                </select>
              </div>
            </div>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Contact</th>
                  <th>Terms</th>
                  <th>Linked SKUs</th>
                  <th>Total Owed</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSuppliers.map((supplier) => (
                  <tr key={supplier._id}>
                    <td>
                      <div className="td-primary">{supplier.name}</div>
                      <div className="td-secondary">{supplier.account_number || 'No account number'}</div>
                    </td>
                    <td>
                      <div className="font-medium">{supplier.contact_name || 'No contact name'}</div>
                      <div className="td-secondary">{supplier.phone || supplier.email || 'No phone or email'}</div>
                    </td>
                    <td>
                      <div className="font-medium">{paymentTermsLabel(supplier.payment_terms_days)}</div>
                      <div className="td-secondary">Limit {formatCurrency(supplier.credit_limit)}</div>
                    </td>
                    <td>{supplier.stats?.linked_products || 0}</td>
                    <td>
                      <div className="font-medium">{formatCurrency(supplier.stats?.total_owed)}</div>
                      <div className="td-secondary">Overdue {formatCurrency(supplier.stats?.overdue_balance)}</div>
                    </td>
                    <td>
                      <span className={`badge ${supplier.active ? 'badge-active' : 'badge-muted'}`}>
                        {supplier.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="action-group">
                        <button className="action-icon" title="View supplier detail" onClick={() => loadSupplierDetail(supplier._id, { openModal: true })}>
                          <ClipboardCheck size={16} />
                        </button>
                        <button className="action-icon" title="Edit supplier" onClick={() => handleOpenSupplierModal(supplier)}>
                          <FilePlus2 size={16} />
                        </button>
                        <button className="action-icon text-danger" title="Delete supplier" onClick={() => handleDeleteSupplier(supplier)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredSuppliers.length === 0 && (
                  <tr>
                    <td colSpan="7" className="empty-state">No suppliers match the current filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'receiving' && (
        <div className="suppliers-grid">
          <div className="glass-panel main-panel supplier-receiving-panel">
            <div className="detail-header">
              <div>
                <h2>Receive Stock / Create PO</h2>
                <p className="page-subtitle">Use the same workspace for draft purchase orders and ad-hoc or PO-based GRNs.</p>
              </div>
              <div className="report-meta-chip">{formatCurrency(purchaseTotals)} projected total</div>
            </div>

            <div className="supplier-receiving-grid">
              <div className="toolbar-control">
                <label>Supplier</label>
                <select value={purchaseForm.supplier_id} onChange={(event) => handleSupplierSelectForPurchase(event.target.value)}>
                  <option value="">Select supplier</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier._id} value={supplier._id}>{supplier.name}</option>
                  ))}
                </select>
              </div>
              <div className="toolbar-control">
                <label>Open PO (optional)</label>
                <select value={purchaseForm.purchase_order_id} onChange={(event) => handleSelectOpenOrder(event.target.value)}>
                  <option value="">Create ad-hoc GRN / PO</option>
                  {availableOpenOrders.map((purchaseOrder) => (
                    <option key={purchaseOrder._id} value={purchaseOrder._id}>
                      {purchaseOrder.po_number} - {purchaseOrder.status}
                    </option>
                  ))}
                </select>
              </div>
              <div className="toolbar-control">
                <label>Document Mode</label>
                <select
                  value={purchaseForm.mode}
                  onChange={(event) => setPurchaseForm((prev) => ({ ...prev, mode: event.target.value }))}
                  disabled={Boolean(purchaseForm.purchase_order_id)}
                >
                  <option value="received">Receive GRN</option>
                  <option value="draft">Save Draft PO</option>
                </select>
              </div>
            </div>

            <div className="modal-form-grid">
              <div className="modal-form-field">
                <label>Date Ordered</label>
                <input type="date" value={purchaseForm.ordered_at} onChange={(event) => setPurchaseForm((prev) => ({ ...prev, ordered_at: event.target.value }))} />
              </div>
              <div className="modal-form-field">
                <label>Date Received</label>
                <input type="date" value={purchaseForm.received_at} onChange={(event) => setPurchaseForm((prev) => ({ ...prev, received_at: event.target.value }))} disabled={purchaseForm.mode === 'draft' && !purchaseForm.purchase_order_id} />
              </div>
              <div className="modal-form-field">
                <label>Invoice Reference</label>
                <input value={purchaseForm.invoice_reference} onChange={(event) => setPurchaseForm((prev) => ({ ...prev, invoice_reference: event.target.value }))} placeholder="Supplier invoice number" />
              </div>
              <div className="modal-form-field">
                <label>Amount Paid Now</label>
                <input type="number" min="0" value={purchaseForm.amount_paid} onChange={(event) => setPurchaseForm((prev) => ({ ...prev, amount_paid: event.target.value }))} disabled={purchaseForm.mode === 'draft' && !purchaseForm.purchase_order_id} />
              </div>
              <div className="modal-form-field modal-form-field-full">
                <label>Notes</label>
                <textarea rows="3" value={purchaseForm.notes} onChange={(event) => setPurchaseForm((prev) => ({ ...prev, notes: event.target.value }))} placeholder="Delivery notes, invoice notes, or exceptions." />
              </div>
            </div>

            <div className="table-container supplier-line-items">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Qty Ordered</th>
                    <th>{purchaseForm.purchase_order_id || purchaseForm.mode === 'received' ? 'Qty Received' : 'Qty Planned'}</th>
                    <th>Unit Cost</th>
                    <th>Line Total</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseForm.items.map((item, index) => {
                    const linkedProduct = selectedSupplierDetail?.supplier?._id === purchaseForm.supplier_id
                      ? (selectedSupplierDetail.linked_products || []).find((link) => link.variant?._id === item.variant_id)
                      : null;
                    const quantityForLine = purchaseForm.purchase_order_id || purchaseForm.mode === 'received'
                      ? Number(item.qty_received || 0)
                      : Number(item.qty_ordered || 0);
                    const lineTotal = quantityForLine * Number(item.unit_cost || 0);

                    return (
                      <tr key={`purchase-item-${index}`}>
                        <td>
                          <select value={item.variant_id} onChange={(event) => updatePurchaseItem(index, 'variant_id', event.target.value)}>
                            <option value="">Select SKU</option>
                            {productOptions.map((option) => (
                              <option key={option.variant_id} value={option.variant_id}>{option.label}</option>
                            ))}
                          </select>
                          {linkedProduct && (
                            <div className="td-secondary">
                              Preferred supplier price {formatCurrency(linkedProduct.unit_cost)} | Lead time {linkedProduct.lead_time_days} days
                            </div>
                          )}
                        </td>
                        <td>
                          <input type="number" min="1" value={item.qty_ordered} onChange={(event) => updatePurchaseItem(index, 'qty_ordered', event.target.value)} />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={purchaseForm.mode === 'draft' && !purchaseForm.purchase_order_id ? 0 : item.qty_received}
                            onChange={(event) => updatePurchaseItem(index, 'qty_received', event.target.value)}
                            disabled={purchaseForm.mode === 'draft' && !purchaseForm.purchase_order_id}
                          />
                        </td>
                        <td>
                          <input type="number" min="0" value={item.unit_cost} onChange={(event) => updatePurchaseItem(index, 'unit_cost', event.target.value)} />
                          {linkedProduct && Number(item.unit_cost || 0) !== Number(linkedProduct.unit_cost || 0) && (
                            <div className="td-secondary text-warning">Changed from last supplier cost</div>
                          )}
                        </td>
                        <td className="font-medium">{formatCurrency(lineTotal)}</td>
                        <td className="text-right">
                          <button className="action-icon text-danger" onClick={() => removePurchaseItem(index)} title="Remove line">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="supplier-receiving-actions">
              <button className="icon-btn" onClick={addPurchaseItem}>
                <Plus size={18} /> Add Line Item
              </button>
              <div className="action-group">
                <button className="icon-btn" onClick={() => handleSavePurchase('draft')} disabled={savingPurchase}>
                  <FilePlus2 size={18} /> Save Draft PO
                </button>
                <button className="primary-btn" onClick={() => handleSavePurchase('received')} disabled={savingPurchase}>
                  <Printer size={18} /> Receive & Print GRN
                </button>
              </div>
            </div>
          </div>

          <div className="glass-panel main-panel supplier-side-panel">
            <div className="detail-header">
              <div>
                <h2>Recent GRNs</h2>
                <p className="page-subtitle">Latest received or partially received supplier documents.</p>
              </div>
            </div>
            <div className="report-card-list">
              {recentGrns.map((purchaseOrder) => (
                <div key={purchaseOrder._id} className="report-record-card supplier-history-card">
                  <div className="report-record-top supplier-history-header">
                    <div>
                      <strong>{purchaseOrder.po_number}</strong>
                      <div className="td-secondary">{purchaseOrder.supplier?.name || 'Unknown supplier'}</div>
                    </div>
                    <div className="supplier-history-status">
                      <span className="badge text-capitalize">{purchaseOrder.status}</span>
                    </div>
                  </div>
                  <div className="supplier-history-metrics">
                    <div className="supplier-history-metric">
                      <span className="supplier-history-label">Received</span>
                      <strong className="supplier-history-value">
                        {purchaseOrder.received_at ? new Date(purchaseOrder.received_at).toLocaleDateString() : 'Pending'}
                      </strong>
                    </div>
                    <div className="supplier-history-metric">
                      <span className="supplier-history-label">Line Total</span>
                      <strong className="supplier-history-value">{formatCurrency(purchaseOrder.total_amount)}</strong>
                    </div>
                    <div className="supplier-history-metric">
                      <span className="supplier-history-label">Balance</span>
                      <strong className="supplier-history-value">{formatCurrency(purchaseOrder.balance_outstanding)}</strong>
                    </div>
                  </div>
                  <div className="report-record-footer">
                    <button className="icon-btn" onClick={() => printGrn(purchaseOrder)}>
                      <Printer size={16} /> Print
                    </button>
                  </div>
                </div>
              ))}
              {recentGrns.length === 0 && (
                <div className="empty-state">No GRNs have been recorded yet.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'payables' && (
        <>
          <div className="reports-grid">
            <ReportStatCard icon={DollarSign} tone="tone-danger" title="Outstanding" value={formatCurrency(payables.summary?.total_owed)} />
            <ReportStatCard icon={Truck} tone="tone-warning" title="Overdue" value={payables.summary?.overdue_count || 0} note={formatCurrency(payables.summary?.overdue_amount)} />
            <ReportStatCard icon={Wallet} tone="tone-primary" title="Due This Week" value={payables.summary?.due_this_week || 0} />
            <ReportStatCard icon={Building2} tone="tone-success" title="Suppliers Owed" value={payables.summary?.suppliers_with_balances || 0} />
          </div>

          <div className="glass-panel main-panel">
            <div className="panel-toolbar">
              <div>
                <h2>Outstanding GRNs</h2>
                <p className="page-subtitle">Track supplier balances, due dates, and overdue liabilities in one place.</p>
              </div>
            </div>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>PO / GRN</th>
                    <th>Supplier</th>
                    <th>Due Date</th>
                    <th>Payment Status</th>
                    <th>Balance</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(payables.rows || []).map((purchaseOrder) => (
                    <tr key={purchaseOrder._id}>
                      <td>
                        <div className="font-medium">{purchaseOrder.po_number}</div>
                        <div className="td-secondary">{purchaseOrder.invoice_reference || 'No invoice ref'}</div>
                      </td>
                      <td>
                        <div className="font-medium">{purchaseOrder.supplier?.name || 'Unknown supplier'}</div>
                        <div className="td-secondary">{purchaseOrder.supplier?.payment_terms_label || paymentTermsLabel(0)}</div>
                      </td>
                      <td>
                        <div className="font-medium">{purchaseOrder.payment_due_date ? new Date(purchaseOrder.payment_due_date).toLocaleDateString() : 'Not due'}</div>
                        <div className={`td-secondary ${purchaseOrder.is_overdue ? 'text-danger' : ''}`}>
                          {purchaseOrder.is_overdue ? `${purchaseOrder.days_past_due} days overdue` : 'Within terms'}
                        </div>
                      </td>
                      <td><span className="badge text-capitalize">{purchaseOrder.payment_status}</span></td>
                      <td className="font-medium">{formatCurrency(purchaseOrder.balance_outstanding)}</td>
                      <td className="text-right">
                        <div className="action-group">
                          <button className="action-icon" title="View supplier detail" onClick={() => loadSupplierDetail(purchaseOrder.supplier?._id, { openModal: true })}>
                            <ClipboardCheck size={16} />
                          </button>
                          <button className="action-icon" title="Record payment" onClick={() => handleOpenPaymentModal(purchaseOrder)}>
                            <CreditCard size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(payables.rows || []).length === 0 && (
                    <tr>
                      <td colSpan="6" className="empty-state">No outstanding supplier balances right now.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {showSupplierModal && (
        <div className="modal-overlay">
          <div className="glass-panel modal-card modal-card-wide">
            <button className="modal-close-btn" onClick={() => setShowSupplierModal(false)}>
              <X size={20} />
            </button>
            <h2 className="modal-title">{editingSupplierId ? 'Edit Supplier' : 'Add Supplier'}</h2>
            <form onSubmit={handleSaveSupplier} className="modal-form">
              <div className="modal-form-grid">
                <div className="modal-form-field">
                  <label>Supplier Name</label>
                  <input required value={supplierForm.name} onChange={(event) => setSupplierForm((prev) => ({ ...prev, name: event.target.value }))} />
                </div>
                <div className="modal-form-field">
                  <label>Contact Person</label>
                  <input value={supplierForm.contact_name} onChange={(event) => setSupplierForm((prev) => ({ ...prev, contact_name: event.target.value }))} />
                </div>
                <div className="modal-form-field">
                  <label>Phone</label>
                  <input value={supplierForm.phone} onChange={(event) => setSupplierForm((prev) => ({ ...prev, phone: event.target.value }))} />
                </div>
                <div className="modal-form-field">
                  <label>Email</label>
                  <input type="email" value={supplierForm.email} onChange={(event) => setSupplierForm((prev) => ({ ...prev, email: event.target.value }))} />
                </div>
                <div className="modal-form-field">
                  <label>Payment Terms</label>
                  <select value={supplierForm.payment_terms_days} onChange={(event) => setSupplierForm((prev) => ({ ...prev, payment_terms_days: event.target.value }))}>
                    {paymentTermsOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div className="modal-form-field">
                  <label>Credit Limit</label>
                  <input type="number" min="0" value={supplierForm.credit_limit} onChange={(event) => setSupplierForm((prev) => ({ ...prev, credit_limit: event.target.value }))} />
                </div>
                <div className="modal-form-field">
                  <label>Account Number</label>
                  <input value={supplierForm.account_number} onChange={(event) => setSupplierForm((prev) => ({ ...prev, account_number: event.target.value }))} />
                </div>
                <div className="modal-form-field">
                  <label>Status</label>
                  <select value={supplierForm.active ? 'active' : 'inactive'} onChange={(event) => setSupplierForm((prev) => ({ ...prev, active: event.target.value === 'active' }))}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="modal-form-field modal-form-field-full">
                  <label>Physical Address</label>
                  <textarea rows="2" value={supplierForm.address} onChange={(event) => setSupplierForm((prev) => ({ ...prev, address: event.target.value }))} />
                </div>
                <div className="modal-form-field modal-form-field-full">
                  <label>Notes</label>
                  <textarea rows="3" value={supplierForm.notes} onChange={(event) => setSupplierForm((prev) => ({ ...prev, notes: event.target.value }))} />
                </div>
              </div>
              <div className="modal-actions">
                <button type="submit" className="primary-btn" disabled={savingSupplier}>
                  <Building2 size={18} /> {savingSupplier ? 'Saving...' : 'Save Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDetailModal && (
        <div className="modal-overlay">
          <div className="glass-panel modal-card modal-card-wide modal-detail-card supplier-detail-modal">
            <button className="modal-close-btn" onClick={() => setShowDetailModal(false)}>
              <X size={20} />
            </button>
            {detailLoading || !selectedSupplierDetail ? (
              <div className="loading-panel">
                <div className="loading-spinner" />
                <p>Loading supplier detail...</p>
              </div>
            ) : (
              <>
                <div className="modal-detail-header">
                  <div className="modal-detail-intro">
                    <h2 className="modal-title">{selectedSupplierDetail.supplier?.name}</h2>
                    <p className="modal-detail-subtitle">
                      {selectedSupplierDetail.supplier?.contact_name || 'No contact'} | {selectedSupplierDetail.supplier?.phone || 'No phone'} | {paymentTermsLabel(selectedSupplierDetail.supplier?.payment_terms_days)}
                    </p>
                  </div>
                  <button className="icon-btn" onClick={() => handleOpenSupplierModal(selectedSupplierDetail.supplier)}>
                    <FilePlus2 size={18} /> Edit Supplier
                  </button>
                </div>

                <div className="reports-grid">
                  <ReportStatCard icon={Link2} tone="tone-primary" title="Linked SKUs" value={selectedSupplierDetail.summary?.linked_products || 0} />
                  <ReportStatCard icon={Truck} tone="tone-success" title="Purchase Volume" value={formatCurrency(selectedSupplierDetail.summary?.total_purchase_volume)} />
                  <ReportStatCard icon={Wallet} tone="tone-danger" title="Outstanding" value={formatCurrency(selectedSupplierDetail.summary?.total_owed)} />
                  <ReportStatCard icon={CreditCard} tone="tone-warning" title="Overdue" value={formatCurrency(selectedSupplierDetail.summary?.overdue_balance)} />
                </div>

                <div className="supplier-detail-grid">
                  <div className="glass-panel modal-detail-panel">
                    <div className="modal-detail-panel-header">
                      <div>
                        <div className="font-medium">Supplier Profile</div>
                        <div className="td-secondary">Core commercial and contact details.</div>
                      </div>
                    </div>
                    <div className="modal-detail-meta">
                      <div><strong>Email:</strong> {selectedSupplierDetail.supplier?.email || 'N/A'}</div>
                      <div><strong>Credit Limit:</strong> {formatCurrency(selectedSupplierDetail.supplier?.credit_limit)}</div>
                      <div><strong>Account #:</strong> {selectedSupplierDetail.supplier?.account_number || 'N/A'}</div>
                      <div><strong>Status:</strong> {selectedSupplierDetail.supplier?.active ? 'Active' : 'Inactive'}</div>
                      <div className="supplier-meta-wide"><strong>Address:</strong> {selectedSupplierDetail.supplier?.address || 'N/A'}</div>
                      <div className="supplier-meta-wide"><strong>Notes:</strong> {selectedSupplierDetail.supplier?.notes || 'N/A'}</div>
                    </div>
                  </div>

                  <div className="glass-panel modal-detail-panel">
                    <div className="modal-detail-panel-header">
                      <div>
                        <div className="font-medium">Link SKU to Supplier</div>
                        <div className="td-secondary">Define supplier cost, MOQ, lead time, and preferred vendor status.</div>
                      </div>
                    </div>
                    <form onSubmit={handleSaveLink} className="modal-form-grid">
                      <div className="modal-form-field modal-form-field-full">
                        <label>SKU</label>
                        <select value={linkForm.variant_id} onChange={(event) => setLinkForm((prev) => ({ ...prev, variant_id: event.target.value }))}>
                          <option value="">Select SKU</option>
                          {productOptions.map((option) => (
                            <option key={option.variant_id} value={option.variant_id}>{option.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="modal-form-field">
                        <label>Unit Cost</label>
                        <input type="number" min="0" value={linkForm.unit_cost} onChange={(event) => setLinkForm((prev) => ({ ...prev, unit_cost: event.target.value }))} />
                      </div>
                      <div className="modal-form-field">
                        <label>Min Order Qty</label>
                        <input type="number" min="1" value={linkForm.min_order_qty} onChange={(event) => setLinkForm((prev) => ({ ...prev, min_order_qty: event.target.value }))} />
                      </div>
                      <div className="modal-form-field">
                        <label>Lead Time (Days)</label>
                        <input type="number" min="0" value={linkForm.lead_time_days} onChange={(event) => setLinkForm((prev) => ({ ...prev, lead_time_days: event.target.value }))} />
                      </div>
                      <div className="modal-form-field">
                        <label>Preferred Supplier</label>
                        <select value={linkForm.is_preferred ? 'yes' : 'no'} onChange={(event) => setLinkForm((prev) => ({ ...prev, is_preferred: event.target.value === 'yes' }))}>
                          <option value="no">No</option>
                          <option value="yes">Yes</option>
                        </select>
                      </div>
                      <div className="form-actions form-field-full">
                        <button className="primary-btn" type="submit" disabled={savingLink}>
                          <Save size={18} /> {savingLink ? 'Saving...' : 'Save Link'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>

                <div className="glass-panel main-panel report-detail-panel">
                  <div className="detail-header">
                    <div>
                      <h2>Linked Products</h2>
                      <p className="page-subtitle">Preferred suppliers, lead times, and the latest recorded cost by SKU.</p>
                    </div>
                  </div>
                  <div className="table-container">
                    <table className="report-table">
                      <thead>
                        <tr>
                          <th>SKU</th>
                          <th>Current Cost</th>
                          <th>MOQ</th>
                          <th>Lead Time</th>
                          <th>Preferred</th>
                          <th className="text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedSupplierDetail.linked_products || []).map((link) => (
                          <tr key={link._id}>
                            <td>
                              <div className="font-medium">{link.variant?.product?.name || 'Unknown product'}</div>
                              <div className="td-secondary">{link.variant?.size || ''} {link.variant?.product?.brand ? `| ${link.variant.product.brand}` : ''}</div>
                            </td>
                            <td>{formatCurrency(link.unit_cost)}</td>
                            <td>{link.min_order_qty}</td>
                            <td>{link.lead_time_days} days</td>
                            <td>{link.is_preferred ? <span className="badge badge-active">Preferred</span> : <span className="badge">Linked</span>}</td>
                            <td className="text-right">
                              <div className="action-group">
                                <button
                                  className="action-icon"
                                  onClick={() => setLinkForm({
                                    variant_id: link.variant?._id || '',
                                    unit_cost: link.unit_cost,
                                    min_order_qty: link.min_order_qty,
                                    lead_time_days: link.lead_time_days,
                                    is_preferred: link.is_preferred
                                  })}
                                  title="Edit link"
                                >
                                  <FilePlus2 size={16} />
                                </button>
                                <button className="action-icon text-danger" onClick={() => handleDeleteLink(link)} title="Delete link">
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {(selectedSupplierDetail.linked_products || []).length === 0 && (
                          <tr>
                            <td colSpan="6" className="empty-state">No SKUs linked to this supplier yet.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="supplier-detail-grid">
                  <div className="glass-panel main-panel report-detail-panel">
                    <div className="detail-header">
                      <div>
                        <h2>GRN History</h2>
                        <p className="page-subtitle">Purchase orders and received stock history for this supplier.</p>
                      </div>
                    </div>
                    <div className="report-card-list">
                      {(selectedSupplierDetail.purchase_orders || []).slice(0, 6).map((purchaseOrder) => (
                        <div key={purchaseOrder._id} className="report-record-card supplier-history-card">
                          <div className="report-record-top supplier-history-header">
                            <div>
                              <strong>{purchaseOrder.po_number}</strong>
                              <div className="td-secondary">{new Date(purchaseOrder.ordered_at || purchaseOrder.createdAt).toLocaleDateString()}</div>
                            </div>
                            <div className="supplier-history-status">
                              <span className="badge text-capitalize">{purchaseOrder.status}</span>
                            </div>
                          </div>
                          <div className="supplier-history-metrics">
                            <div className="supplier-history-metric">
                              <span className="supplier-history-label">Ordered</span>
                              <strong className="supplier-history-value">
                                {new Date(purchaseOrder.ordered_at || purchaseOrder.createdAt).toLocaleDateString()}
                              </strong>
                            </div>
                            <div className="supplier-history-metric">
                              <span className="supplier-history-label">Line Total</span>
                              <strong className="supplier-history-value">{formatCurrency(purchaseOrder.total_amount)}</strong>
                            </div>
                            <div className="supplier-history-metric">
                              <span className="supplier-history-label">Balance</span>
                              <strong className="supplier-history-value">{formatCurrency(purchaseOrder.balance_outstanding)}</strong>
                            </div>
                          </div>
                        </div>
                      ))}
                      {(selectedSupplierDetail.purchase_orders || []).length === 0 && (
                        <div className="empty-state">No purchase history yet.</div>
                      )}
                    </div>
                  </div>

                  <div className="glass-panel main-panel report-detail-panel">
                    <div className="detail-header">
                      <div>
                        <h2>Payment History</h2>
                        <p className="page-subtitle">Recorded payments against this supplier’s GRNs.</p>
                      </div>
                    </div>
                    <div className="report-card-list">
                      {(selectedSupplierDetail.payments || []).slice(0, 6).map((payment) => (
                        <div key={payment._id} className="report-record-card">
                          <div className="report-record-top">
                            <div>
                              <strong>{formatCurrency(payment.amount)}</strong>
                              <div className="td-secondary">{payment.po_id?.po_number || 'Direct supplier payment'}</div>
                            </div>
                            <span className="badge">{new Date(payment.paid_at || payment.createdAt).toLocaleDateString()}</span>
                          </div>
                          <div className="td-secondary">Recorded by {payment.recorded_by?.username || 'Unknown'} {payment.notes ? `| ${payment.notes}` : ''}</div>
                        </div>
                      ))}
                      {(selectedSupplierDetail.payments || []).length === 0 && (
                        <div className="empty-state">No payments recorded yet.</div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showPaymentModal && (
        <div className="modal-overlay">
          <div className="glass-panel modal-card">
            <button className="modal-close-btn" onClick={() => setShowPaymentModal(false)}>
              <X size={20} />
            </button>
            <h2 className="modal-title">Record Supplier Payment</h2>
            <form onSubmit={handleSavePayment} className="modal-form">
              <div className="modal-detail-meta">
                <div><strong>Supplier:</strong> {paymentForm.supplier_name}</div>
                <div><strong>PO / GRN:</strong> {paymentForm.po_number}</div>
              </div>
              <div className="modal-form-grid">
                <div className="modal-form-field">
                  <label>Amount</label>
                  <input type="number" min="0" required value={paymentForm.amount} onChange={(event) => setPaymentForm((prev) => ({ ...prev, amount: event.target.value }))} />
                </div>
                <div className="modal-form-field">
                  <label>Paid At</label>
                  <input type="date" required value={paymentForm.paid_at} onChange={(event) => setPaymentForm((prev) => ({ ...prev, paid_at: event.target.value }))} />
                </div>
                <div className="modal-form-field modal-form-field-full">
                  <label>Notes</label>
                  <textarea rows="3" value={paymentForm.notes} onChange={(event) => setPaymentForm((prev) => ({ ...prev, notes: event.target.value }))} />
                </div>
              </div>
              <div className="modal-actions">
                <button type="submit" className="primary-btn" disabled={savingPayment}>
                  <CreditCard size={18} /> {savingPayment ? 'Saving...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Suppliers;
