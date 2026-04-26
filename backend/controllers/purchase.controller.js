import { mongoose } from '../config/database.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import PurchaseOrderItem from '../models/PurchaseOrderItem.js';
import Supplier from '../models/Supplier.js';
import SupplierPayment from '../models/SupplierPayment.js';
import ProductVariant from '../models/ProductVariant.js';
import StockAdjustment from '../models/StockAdjustment.js';
import logger from '../utils/logger.js';
import {
  generatePurchaseOrderNumber,
  calculateLineTotal,
  derivePaymentStatus,
  derivePurchaseOrderStatus,
  calculatePurchaseOrderTotal,
  calculateDueDate,
  getPaymentTermsLabel,
  getDaysPastDue
} from '../utils/purchasing.js';
import { syncSupplierProductPricing } from '../utils/supplierProducts.js';

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const sanitizeText = (value = '') => (
  typeof value === 'string' ? value.trim() : ''
);

const toNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const getNormalizedPaymentInput = (value) => Math.max(0, toNumber(value, 0));

const calculateWeightedAverageCost = (currentStock, currentCost, receivedQuantity, receivedUnitCost) => {
  const stock = Math.max(0, Number(currentStock || 0));
  const quantity = Math.max(0, Number(receivedQuantity || 0));
  const oldCost = Math.max(0, Number(currentCost || 0));
  const newCost = Math.max(0, Number(receivedUnitCost || 0));

  if (quantity <= 0) return oldCost;
  if (stock <= 0) return newCost;

  return ((stock * oldCost) + (quantity * newCost)) / (stock + quantity);
};

const normalizeCreatePurchaseItems = (items = []) => items.map((item) => {
  const variantId = item.variant_id || item.variantId;
  const qtyReceived = Math.max(0, toNumber(item.qty_received ?? item.qtyReceived, 0));
  const qtyOrdered = Math.max(0, toNumber(
    item.qty_ordered ?? item.qtyOrdered ?? item.quantity ?? qtyReceived,
    qtyReceived
  ));
  const unitCost = toNumber(item.unit_cost ?? item.unitCost, NaN);

  if (!isValidObjectId(variantId)) {
    throw new Error('Each purchase item must include a valid inventory variant');
  }

  if (!Number.isFinite(unitCost) || unitCost < 0) {
    throw new Error('Each purchase item must include a valid unit cost');
  }

  if (qtyOrdered <= 0 && qtyReceived <= 0) {
    throw new Error('Each purchase item must include an ordered quantity or received quantity greater than zero');
  }

  return {
    variant_id: variantId,
    qty_ordered: Math.max(qtyOrdered, qtyReceived),
    qty_received: qtyReceived,
    unit_cost: unitCost,
    line_total: 0,
    min_order_qty: item.min_order_qty ?? item.minOrderQty,
    lead_time_days: item.lead_time_days ?? item.leadTimeDays,
    is_preferred: item.is_preferred ?? item.isPreferred
  };
});

const normalizeReceiveItems = (items = []) => items.map((item) => {
  const itemId = item.item_id || item.itemId || item._id || null;
  const variantId = item.variant_id || item.variantId || null;
  const qtyReceivedNow = Math.max(0, toNumber(item.qty_received_now ?? item.qtyReceivedNow ?? item.qty_received ?? item.qtyReceived, 0));
  const qtyOrdered = Math.max(0, toNumber(item.qty_ordered ?? item.qtyOrdered, qtyReceivedNow));
  const unitCost = item.unit_cost ?? item.unitCost;

  if (!itemId && !isValidObjectId(variantId)) {
    throw new Error('Each received line must reference an existing item or a valid inventory variant');
  }

  if (unitCost !== undefined && (!Number.isFinite(Number(unitCost)) || Number(unitCost) < 0)) {
    throw new Error('Unit cost must be zero or a positive number');
  }

  return {
    item_id: itemId,
    variant_id: variantId,
    qty_received_now: qtyReceivedNow,
    qty_ordered: qtyOrdered,
    unit_cost: unitCost !== undefined ? Number(unitCost) : undefined,
    min_order_qty: item.min_order_qty ?? item.minOrderQty,
    lead_time_days: item.lead_time_days ?? item.leadTimeDays,
    is_preferred: item.is_preferred ?? item.isPreferred
  };
});

const attachPurchaseOrderItems = (purchaseOrders = [], purchaseOrderItems = []) => {
  const itemsByPurchaseOrder = purchaseOrderItems.reduce((map, item) => {
    const key = String(item.po_id);
    if (!map.has(key)) {
      map.set(key, []);
    }

    map.get(key).push({
      ...item,
      variant: item.variant_id ? {
        _id: item.variant_id._id,
        size: item.variant_id.size,
        current_stock: item.variant_id.current_stock,
        retail_price: item.variant_id.retail_price,
        wholesale_price: item.variant_id.wholesale_price,
        buying_price: item.variant_id.buying_price,
        min_stock_level: item.variant_id.min_stock_level,
        product: item.variant_id.product_id ? {
          _id: item.variant_id.product_id._id,
          name: item.variant_id.product_id.name,
          brand: item.variant_id.product_id.brand,
          category: item.variant_id.product_id.category
        } : null
      } : null
    });

    return map;
  }, new Map());

  return purchaseOrders.map((purchaseOrder) => {
    const balanceOutstanding = Number(purchaseOrder.balance_outstanding || 0);
    const daysPastDue = balanceOutstanding > 0 ? getDaysPastDue(purchaseOrder.payment_due_date) : 0;

    return {
      ...purchaseOrder,
      supplier: purchaseOrder.supplier_id ? {
        _id: purchaseOrder.supplier_id._id,
        name: purchaseOrder.supplier_id.name,
        contact_name: purchaseOrder.supplier_id.contact_name,
        phone: purchaseOrder.supplier_id.phone,
        payment_terms_days: purchaseOrder.supplier_id.payment_terms_days,
        payment_terms_label: getPaymentTermsLabel(purchaseOrder.supplier_id.payment_terms_days)
      } : null,
      items: itemsByPurchaseOrder.get(String(purchaseOrder._id)) || [],
      days_past_due: daysPastDue,
      is_overdue: daysPastDue > 0
    };
  });
};

const fetchPurchaseOrdersWithItems = async (filters = {}, sort = { ordered_at: -1 }) => {
  const purchaseOrders = await PurchaseOrder.find(filters)
    .populate('supplier_id', 'name contact_name phone payment_terms_days active')
    .populate('created_by', 'username')
    .sort(sort)
    .lean();

  const purchaseOrderIds = purchaseOrders.map((purchaseOrder) => purchaseOrder._id);
  const purchaseOrderItems = purchaseOrderIds.length
    ? await PurchaseOrderItem.find({ po_id: { $in: purchaseOrderIds } })
        .populate({
          path: 'variant_id',
          populate: {
            path: 'product_id',
            select: 'name brand category'
          }
        })
        .lean()
    : [];

  return attachPurchaseOrderItems(purchaseOrders, purchaseOrderItems);
};

const recalculatePurchaseOrderSnapshot = ({ items, draftStatus, amountPaid, supplierTermsDays, receivedAt }) => {
  const status = derivePurchaseOrderStatus(items, draftStatus);
  const totalAmount = calculatePurchaseOrderTotal(items, status);
  const normalizedAmountPaid = Math.max(0, Math.min(Number(amountPaid || 0), totalAmount));
  const paymentStatus = derivePaymentStatus(totalAmount, normalizedAmountPaid);
  const effectiveReceivedAt = ['received', 'partially_received'].includes(status)
    ? (receivedAt ? new Date(receivedAt) : new Date())
    : null;

  return {
    status,
    total_amount: totalAmount,
    amount_paid: normalizedAmountPaid,
    payment_status: paymentStatus,
    balance_outstanding: Math.max(0, totalAmount - normalizedAmountPaid),
    received_at: effectiveReceivedAt,
    payment_due_date: effectiveReceivedAt ? calculateDueDate(effectiveReceivedAt, supplierTermsDays) : null
  };
};

const applyReceiptInventory = async ({
  receiptLines = [],
  purchaseOrderId,
  supplier,
  userId
}) => {
  if (!receiptLines.length) {
    return;
  }

  const variantIds = receiptLines.map((line) => line.variant_id);
  const variants = await ProductVariant.find({ _id: { $in: variantIds } });
  const variantsById = new Map(variants.map((variant) => [String(variant._id), variant]));

  for (const line of receiptLines) {
    const variant = variantsById.get(String(line.variant_id));
    if (!variant) {
      throw new Error('One or more received items reference inventory variants that no longer exist');
    }

    const stockBefore = Number(variant.current_stock || 0);
    const receivedQuantity = Number(line.qty_received_delta || 0);
    const stockAfter = stockBefore + receivedQuantity;
    const previousCost = Number(variant.buying_price || 0);
    const averageCost = calculateWeightedAverageCost(stockBefore, previousCost, receivedQuantity, line.unit_cost);

    variant.current_stock = stockAfter;
    variant.buying_price = averageCost;
    await variant.save();

    await StockAdjustment.create({
      variant_id: variant._id,
      adjustment_type: 'in',
      quantity: receivedQuantity,
      unit_cost: Number(line.unit_cost || 0),
      stock_before: stockBefore,
      stock_after: stockAfter,
      reason: 'restocking',
      notes: sanitizeText(line.notes) || `Received via ${line.po_number || 'purchase order'} from ${supplier.name}. Average cost ${averageCost.toFixed(2)} from ${previousCost.toFixed(2)}.`,
      user_id: userId,
      purchase_order_id: purchaseOrderId
    });

    await syncSupplierProductPricing({
      supplierId: supplier._id,
      variantId: variant._id,
      unitCost: line.unit_cost,
      minOrderQty: line.min_order_qty,
      leadTimeDays: line.lead_time_days,
      isPreferred: line.is_preferred,
      userId
    });
  }
};

// @desc    Get purchase orders
// @route   GET /api/purchase-orders
export const getPurchaseOrders = async (req, res) => {
  try {
    const filters = {};
    const query = req.query.q?.trim();

    if (req.query.supplier_id) {
      if (!isValidObjectId(req.query.supplier_id)) {
        return res.status(400).json({ success: false, message: 'Invalid supplier id' });
      }
      filters.supplier_id = req.query.supplier_id;
    }

    if (req.query.status && req.query.status !== 'all') {
      filters.status = req.query.status;
    }

    if (req.query.payment_status && req.query.payment_status !== 'all') {
      filters.payment_status = req.query.payment_status;
    }

    if (query) {
      filters.$or = [
        { po_number: { $regex: query, $options: 'i' } },
        { invoice_reference: { $regex: query, $options: 'i' } },
        { notes: { $regex: query, $options: 'i' } }
      ];
    }

    const data = await fetchPurchaseOrdersWithItems(filters, { ordered_at: -1, createdAt: -1 });
    res.json({ success: true, count: data.length, data });
  } catch (error) {
    logger.error('Get purchase orders error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get open purchase orders
// @route   GET /api/purchase-orders/open
export const getOpenPurchaseOrders = async (req, res) => {
  try {
    const filters = {
      status: { $in: ['draft', 'ordered', 'partially_received'] }
    };

    if (req.query.supplier_id) {
      if (!isValidObjectId(req.query.supplier_id)) {
        return res.status(400).json({ success: false, message: 'Invalid supplier id' });
      }
      filters.supplier_id = req.query.supplier_id;
    }

    const data = await fetchPurchaseOrdersWithItems(filters, { ordered_at: -1, createdAt: -1 });
    res.json({ success: true, count: data.length, data });
  } catch (error) {
    logger.error('Get open purchase orders error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get purchase order detail
// @route   GET /api/purchase-orders/:id
export const getPurchaseOrder = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid purchase order id' });
    }

    const [purchaseOrder] = await fetchPurchaseOrdersWithItems({ _id: req.params.id });
    if (!purchaseOrder) {
      return res.status(404).json({ success: false, message: 'Purchase order not found' });
    }

    const payments = await SupplierPayment.find({ po_id: req.params.id })
      .populate('recorded_by', 'username')
      .sort({ paid_at: -1 })
      .lean();

    res.json({
      success: true,
      data: {
        ...purchaseOrder,
        payments
      }
    });
  } catch (error) {
    logger.error('Get purchase order detail error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Create draft PO or ad-hoc GRN
// @route   POST /api/purchase-orders
export const createPurchaseOrder = async (req, res) => {
  try {
    const supplierId = req.body.supplier_id || req.body.supplierId;
    if (!isValidObjectId(supplierId)) {
      return res.status(400).json({ success: false, message: 'A valid supplier is required' });
    }

    const items = normalizeCreatePurchaseItems(req.body.items);
    const supplier = await Supplier.findById(supplierId);
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    const variantIds = items.map((item) => item.variant_id);
    const variantCount = await ProductVariant.countDocuments({ _id: { $in: variantIds } });
    if (variantCount !== variantIds.length) {
      return res.status(400).json({ success: false, message: 'One or more purchase items reference missing inventory variants' });
    }

    const draftStatus = req.body.status === 'ordered' ? 'ordered' : 'draft';
    const amountPaidInput = getNormalizedPaymentInput(req.body.amount_paid ?? req.body.amountPaid);
    const orderSnapshot = recalculatePurchaseOrderSnapshot({
      items,
      draftStatus,
      amountPaid: amountPaidInput,
      supplierTermsDays: supplier.payment_terms_days,
      receivedAt: req.body.received_at ?? req.body.receivedAt
    });

    if (amountPaidInput > orderSnapshot.total_amount) {
      return res.status(400).json({ success: false, message: 'Amount paid cannot exceed the GRN total' });
    }

    if (['draft', 'ordered'].includes(orderSnapshot.status) && amountPaidInput > 0) {
      return res.status(400).json({ success: false, message: 'Payments can only be recorded once stock has been received' });
    }

    items.forEach((item) => {
      item.line_total = calculateLineTotal(
        ['received', 'partially_received'].includes(orderSnapshot.status) ? item.qty_received : item.qty_ordered,
        item.unit_cost
      );
    });

    const purchaseOrder = await PurchaseOrder.create({
      po_number: generatePurchaseOrderNumber(),
      supplier_id: supplier._id,
      ordered_at: req.body.ordered_at ? new Date(req.body.ordered_at) : new Date(),
      received_at: orderSnapshot.received_at,
      status: orderSnapshot.status,
      payment_status: orderSnapshot.payment_status,
      total_amount: orderSnapshot.total_amount,
      amount_paid: orderSnapshot.amount_paid,
      balance_outstanding: orderSnapshot.balance_outstanding,
      payment_due_date: orderSnapshot.payment_due_date,
      notes: sanitizeText(req.body.notes),
      invoice_reference: sanitizeText(req.body.invoice_reference || req.body.invoiceReference),
      created_by: req.user._id || req.user.id
    });

    const purchaseOrderItems = await PurchaseOrderItem.create(items.map((item) => ({
      po_id: purchaseOrder._id,
      variant_id: item.variant_id,
      qty_ordered: item.qty_ordered,
      qty_received: item.qty_received,
      unit_cost: item.unit_cost,
      line_total: item.line_total
    })));

    if (['received', 'partially_received'].includes(orderSnapshot.status)) {
      await applyReceiptInventory({
        receiptLines: purchaseOrderItems.map((item, index) => ({
          variant_id: item.variant_id,
          qty_received_delta: item.qty_received,
          unit_cost: item.unit_cost,
          min_order_qty: items[index].min_order_qty,
          lead_time_days: items[index].lead_time_days,
          is_preferred: items[index].is_preferred,
          po_number: purchaseOrder.po_number,
          notes: purchaseOrder.notes
        })),
        purchaseOrderId: purchaseOrder._id,
        supplier,
        userId: req.user._id || req.user.id
      });
    }

    const [result] = await fetchPurchaseOrdersWithItems({ _id: purchaseOrder._id });
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    logger.error('Create purchase order error:', error);
    res.status(400).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    Receive stock against an existing PO
// @route   POST /api/purchase-orders/:id/receive
export const receivePurchaseOrder = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid purchase order id' });
    }

    const purchaseOrder = await PurchaseOrder.findById(req.params.id);
    if (!purchaseOrder) {
      return res.status(404).json({ success: false, message: 'Purchase order not found' });
    }

    const supplier = await Supplier.findById(purchaseOrder.supplier_id);
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    const incomingItems = normalizeReceiveItems(req.body.items);
    const existingItems = await PurchaseOrderItem.find({ po_id: purchaseOrder._id });
    const existingItemsById = new Map(existingItems.map((item) => [String(item._id), item]));
    const existingItemsByVariant = new Map(existingItems.map((item) => [String(item.variant_id), item]));

    const receiptLines = [];
    for (const incomingItem of incomingItems) {
      let targetItem = incomingItem.item_id ? existingItemsById.get(String(incomingItem.item_id)) : null;
      if (!targetItem && incomingItem.variant_id) {
        targetItem = existingItemsByVariant.get(String(incomingItem.variant_id)) || null;
      }

      if (targetItem) {
        if (incomingItem.unit_cost !== undefined) {
          targetItem.unit_cost = incomingItem.unit_cost;
        }

        if (incomingItem.qty_ordered > targetItem.qty_ordered) {
          targetItem.qty_ordered = incomingItem.qty_ordered;
        }

        if (incomingItem.qty_received_now > 0) {
          targetItem.qty_received += incomingItem.qty_received_now;
          if (targetItem.qty_received > targetItem.qty_ordered) {
            targetItem.qty_ordered = targetItem.qty_received;
          }

          receiptLines.push({
            variant_id: targetItem.variant_id,
            qty_received_delta: incomingItem.qty_received_now,
            unit_cost: targetItem.unit_cost,
            min_order_qty: incomingItem.min_order_qty,
            lead_time_days: incomingItem.lead_time_days,
            is_preferred: incomingItem.is_preferred,
            po_number: purchaseOrder.po_number,
            notes: req.body.notes || purchaseOrder.notes
          });
        }

        targetItem.line_total = calculateLineTotal(targetItem.qty_received, targetItem.unit_cost);
      } else {
        if (!isValidObjectId(incomingItem.variant_id)) {
          return res.status(400).json({ success: false, message: 'Each new received line requires a valid inventory variant' });
        }

        if (incomingItem.qty_received_now <= 0) {
          return res.status(400).json({ success: false, message: 'New received items must include a received quantity greater than zero' });
        }

        const variantExists = await ProductVariant.exists({ _id: incomingItem.variant_id });
        if (!variantExists) {
          return res.status(404).json({ success: false, message: 'One or more inventory variants could not be found' });
        }

        const createdItem = new PurchaseOrderItem({
          po_id: purchaseOrder._id,
          variant_id: incomingItem.variant_id,
          qty_ordered: Math.max(incomingItem.qty_ordered, incomingItem.qty_received_now),
          qty_received: incomingItem.qty_received_now,
          unit_cost: incomingItem.unit_cost ?? 0,
          line_total: calculateLineTotal(incomingItem.qty_received_now, incomingItem.unit_cost ?? 0)
        });

        existingItems.push(createdItem);
        receiptLines.push({
          variant_id: incomingItem.variant_id,
          qty_received_delta: incomingItem.qty_received_now,
          unit_cost: incomingItem.unit_cost ?? 0,
          min_order_qty: incomingItem.min_order_qty,
          lead_time_days: incomingItem.lead_time_days,
          is_preferred: incomingItem.is_preferred,
          po_number: purchaseOrder.po_number,
          notes: req.body.notes || purchaseOrder.notes
        });
      }
    }

    const amountPaidIncrement = getNormalizedPaymentInput(req.body.amount_paid_increment ?? req.body.amountPaidIncrement);
    if (!receiptLines.length && amountPaidIncrement <= 0) {
      return res.status(400).json({ success: false, message: 'Record received quantities or a payment adjustment before saving this GRN' });
    }

    if (amountPaidIncrement > Number(purchaseOrder.balance_outstanding || 0)) {
      return res.status(400).json({ success: false, message: 'Payment amount cannot exceed the outstanding balance' });
    }

    const updatedItems = [...existingItems];
    const orderSnapshot = recalculatePurchaseOrderSnapshot({
      items: updatedItems,
      draftStatus: purchaseOrder.status === 'draft' ? 'ordered' : 'ordered',
      amountPaid: Number(purchaseOrder.amount_paid || 0) + amountPaidIncrement,
      supplierTermsDays: supplier.payment_terms_days,
      receivedAt: req.body.received_at ?? req.body.receivedAt ?? purchaseOrder.received_at ?? new Date()
    });

    purchaseOrder.received_at = orderSnapshot.received_at;
    purchaseOrder.status = orderSnapshot.status;
    purchaseOrder.total_amount = orderSnapshot.total_amount;
    purchaseOrder.amount_paid = orderSnapshot.amount_paid;
    purchaseOrder.balance_outstanding = orderSnapshot.balance_outstanding;
    purchaseOrder.payment_status = orderSnapshot.payment_status;
    purchaseOrder.payment_due_date = orderSnapshot.payment_due_date;
    purchaseOrder.notes = sanitizeText(req.body.notes) || purchaseOrder.notes;
    purchaseOrder.invoice_reference = sanitizeText(req.body.invoice_reference || req.body.invoiceReference) || purchaseOrder.invoice_reference;

    await Promise.all(existingItems.map((item) => item.save()));
    await purchaseOrder.save();

    if (receiptLines.length) {
      await applyReceiptInventory({
        receiptLines,
        purchaseOrderId: purchaseOrder._id,
        supplier,
        userId: req.user._id || req.user.id
      });
    }

    if (amountPaidIncrement > 0) {
      await SupplierPayment.create({
        po_id: purchaseOrder._id,
        supplier_id: supplier._id,
        amount: amountPaidIncrement,
        paid_at: req.body.paid_at ? new Date(req.body.paid_at) : new Date(),
        recorded_by: req.user._id || req.user.id,
        notes: sanitizeText(req.body.payment_notes || req.body.paymentNotes || req.body.notes)
      });
    }

    const [result] = await fetchPurchaseOrdersWithItems({ _id: purchaseOrder._id });
    const payments = await SupplierPayment.find({ po_id: purchaseOrder._id })
      .populate('recorded_by', 'username')
      .sort({ paid_at: -1 })
      .lean();

    res.json({
      success: true,
      data: {
        ...result,
        payments
      }
    });
  } catch (error) {
    logger.error('Receive purchase order error:', error);
    res.status(400).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    Record payment against a GRN
// @route   POST /api/purchase-orders/:id/payments
export const recordSupplierPayment = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid purchase order id' });
    }

    const purchaseOrder = await PurchaseOrder.findById(req.params.id);
    if (!purchaseOrder) {
      return res.status(404).json({ success: false, message: 'Purchase order not found' });
    }

    if (!['received', 'partially_received'].includes(purchaseOrder.status) || Number(purchaseOrder.total_amount || 0) <= 0) {
      return res.status(400).json({ success: false, message: 'Payments can only be recorded against received GRNs' });
    }

    const amount = Math.max(0, toNumber(req.body.amount, 0));
    if (amount <= 0) {
      return res.status(400).json({ success: false, message: 'Payment amount must be greater than zero' });
    }

    if (amount > Number(purchaseOrder.balance_outstanding || 0)) {
      return res.status(400).json({ success: false, message: 'Payment amount cannot exceed the outstanding balance' });
    }

    const payment = await SupplierPayment.create({
      po_id: purchaseOrder._id,
      supplier_id: purchaseOrder.supplier_id,
      amount,
      paid_at: req.body.paid_at ? new Date(req.body.paid_at) : new Date(),
      recorded_by: req.user._id || req.user.id,
      notes: sanitizeText(req.body.notes)
    });

    purchaseOrder.amount_paid = Number(purchaseOrder.amount_paid || 0) + amount;
    purchaseOrder.balance_outstanding = Math.max(0, Number(purchaseOrder.total_amount || 0) - Number(purchaseOrder.amount_paid || 0));
    purchaseOrder.payment_status = derivePaymentStatus(purchaseOrder.total_amount, purchaseOrder.amount_paid);
    await purchaseOrder.save();

    const [result] = await fetchPurchaseOrdersWithItems({ _id: purchaseOrder._id });
    const populatedPayment = await SupplierPayment.findById(payment._id).populate('recorded_by', 'username').lean();

    res.status(201).json({
      success: true,
      data: {
        purchase_order: result,
        payment: populatedPayment
      }
    });
  } catch (error) {
    logger.error('Record supplier payment error:', error);
    res.status(400).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    Get accounts payable dashboard
// @route   GET /api/purchase-orders/payables/dashboard
export const getPayablesDashboard = async (req, res) => {
  try {
    const purchaseOrders = await fetchPurchaseOrdersWithItems({
      status: { $in: ['received', 'partially_received'] },
      balance_outstanding: { $gt: 0 }
    }, { payment_due_date: 1, ordered_at: -1 });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueThisWeekEnd = new Date(today);
    dueThisWeekEnd.setDate(dueThisWeekEnd.getDate() + 7);

    const summary = purchaseOrders.reduce((acc, purchaseOrder) => {
      const balance = Number(purchaseOrder.balance_outstanding || 0);
      const dueDate = purchaseOrder.payment_due_date ? new Date(purchaseOrder.payment_due_date) : null;
      const supplierId = purchaseOrder.supplier?._id ? String(purchaseOrder.supplier._id) : null;

      acc.total_owed += balance;

      if (supplierId) {
        acc.suppliers_set.add(supplierId);
      }

      if (dueDate && dueDate < today) {
        acc.overdue_count += 1;
        acc.overdue_amount += balance;
      }

      if (dueDate && dueDate >= today && dueDate <= dueThisWeekEnd) {
        acc.due_this_week += 1;
      }

      return acc;
    }, {
      total_owed: 0,
      overdue_count: 0,
      overdue_amount: 0,
      due_this_week: 0,
      suppliers_set: new Set()
    });

    const bySupplierMap = new Map();
    purchaseOrders.forEach((purchaseOrder) => {
      const supplier = purchaseOrder.supplier;
      if (!supplier) {
        return;
      }

      const key = String(supplier._id);
      const current = bySupplierMap.get(key) || {
        supplier_id: supplier._id,
        supplier_name: supplier.name,
        total_owed: 0,
        overdue_balance: 0,
        orders: 0
      };

      current.total_owed += Number(purchaseOrder.balance_outstanding || 0);
      current.orders += 1;
      if (purchaseOrder.is_overdue) {
        current.overdue_balance += Number(purchaseOrder.balance_outstanding || 0);
      }

      bySupplierMap.set(key, current);
    });

    res.json({
      success: true,
      data: {
        summary: {
          total_owed: summary.total_owed,
          overdue_count: summary.overdue_count,
          overdue_amount: summary.overdue_amount,
          due_this_week: summary.due_this_week,
          suppliers_with_balances: summary.suppliers_set.size
        },
        rows: purchaseOrders,
        suppliers: Array.from(bySupplierMap.values()).sort((left, right) => right.total_owed - left.total_owed)
      }
    });
  } catch (error) {
    logger.error('Get payables dashboard error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
