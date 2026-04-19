export const generatePurchaseOrderNumber = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `PO-${year}${month}${day}-${random}`;
};

export const calculateLineTotal = (quantity, unitCost) => (
  Number(quantity || 0) * Number(unitCost || 0)
);

export const derivePaymentStatus = (totalAmount = 0, amountPaid = 0) => {
  const total = Number(totalAmount || 0);
  const paid = Number(amountPaid || 0);

  if (total <= 0 || paid <= 0) {
    return 'unpaid';
  }

  if (paid >= total) {
    return 'paid';
  }

  return 'partial';
};

export const derivePurchaseOrderStatus = (items = [], fallbackStatus = 'draft') => {
  const orderedTotal = items.reduce((sum, item) => sum + Number(item.qty_ordered || 0), 0);
  const receivedTotal = items.reduce((sum, item) => sum + Number(item.qty_received || 0), 0);

  if (receivedTotal <= 0) {
    return fallbackStatus === 'ordered' ? 'ordered' : 'draft';
  }

  if (orderedTotal > 0 && receivedTotal < orderedTotal) {
    return 'partially_received';
  }

  return 'received';
};

export const calculatePurchaseOrderTotal = (items = [], status = 'draft') => (
  items.reduce((sum, item) => {
    const quantity = ['received', 'partially_received'].includes(status)
      ? Number(item.qty_received || 0)
      : Number(item.qty_ordered || 0);

    return sum + calculateLineTotal(quantity, item.unit_cost);
  }, 0)
);

export const calculateDueDate = (baseDate, termsDays = 0) => {
  if (!baseDate) {
    return null;
  }

  const date = new Date(baseDate);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + Number(termsDays || 0));
  return date;
};

export const getPaymentTermsLabel = (termsDays = 0) => {
  const days = Number(termsDays || 0);
  if (days <= 0) {
    return 'Cash on delivery';
  }

  return `Net ${days}`;
};

export const getDaysPastDue = (date, referenceDate = new Date()) => {
  if (!date) {
    return 0;
  }

  const dueDate = new Date(date);
  dueDate.setHours(0, 0, 0, 0);
  const ref = new Date(referenceDate);
  ref.setHours(0, 0, 0, 0);

  const msDiff = ref.getTime() - dueDate.getTime();
  return Math.max(0, Math.floor(msDiff / (1000 * 60 * 60 * 24)));
};
