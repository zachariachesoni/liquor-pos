import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateWeightedAverageCost } from '../utils/inventoryCost.js';
import {
  calculateLineTotal,
  calculatePurchaseOrderTotal,
  derivePaymentStatus,
  derivePurchaseOrderStatus,
  getPaymentTermsLabel
} from '../utils/purchasing.js';

test('weighted average cost rounds to a whole shilling', () => {
  assert.equal(calculateWeightedAverageCost(5, 101, 3, 126), 110);
  assert.equal(calculateWeightedAverageCost(0, 75, 2, 82.4), 82);
});

test('purchase order totals follow draft versus received quantities', () => {
  const items = [
    { qty_ordered: 10, qty_received: 4, unit_cost: 120 },
    { qty_ordered: 6, qty_received: 6, unit_cost: 80 }
  ];

  assert.equal(calculateLineTotal(3, 50), 150);
  assert.equal(calculatePurchaseOrderTotal(items, 'draft'), 1680);
  assert.equal(calculatePurchaseOrderTotal(items, 'partially_received'), 960);
});

test('purchase and payment statuses stay predictable', () => {
  assert.equal(derivePurchaseOrderStatus([{ qty_ordered: 10, qty_received: 0 }], 'ordered'), 'ordered');
  assert.equal(derivePurchaseOrderStatus([{ qty_ordered: 10, qty_received: 3 }], 'ordered'), 'partially_received');
  assert.equal(derivePurchaseOrderStatus([{ qty_ordered: 10, qty_received: 10 }], 'ordered'), 'received');

  assert.equal(derivePaymentStatus(1000, 0), 'unpaid');
  assert.equal(derivePaymentStatus(1000, 600), 'partial');
  assert.equal(derivePaymentStatus(1000, 1000), 'paid');
});

test('payment terms use every-day wording', () => {
  assert.equal(getPaymentTermsLabel(0), 'Cash on delivery');
  assert.equal(getPaymentTermsLabel(7), 'Every 7 days');
  assert.equal(getPaymentTermsLabel(1), 'Every 1 day');
});
