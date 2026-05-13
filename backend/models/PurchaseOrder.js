import mongoose from 'mongoose';

const purchaseOrderSchema = new mongoose.Schema({
  business_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    index: true
  },
  po_number: {
    type: String,
    required: true
  },
  supplier_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: true
  },
  ordered_at: {
    type: Date,
    default: Date.now
  },
  received_at: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['draft', 'ordered', 'partially_received', 'received'],
    default: 'draft'
  },
  payment_status: {
    type: String,
    enum: ['unpaid', 'partial', 'paid'],
    default: 'unpaid'
  },
  total_amount: {
    type: Number,
    min: 0,
    default: 0
  },
  amount_paid: {
    type: Number,
    min: 0,
    default: 0
  },
  balance_outstanding: {
    type: Number,
    min: 0,
    default: 0
  },
  payment_due_date: {
    type: Date,
    default: null
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  },
  invoice_reference: {
    type: String,
    trim: true,
    default: ''
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

purchaseOrderSchema.index({ business_id: 1, supplier_id: 1, ordered_at: -1 });
purchaseOrderSchema.index({ business_id: 1, status: 1, payment_status: 1 });
purchaseOrderSchema.index({ business_id: 1, payment_due_date: 1, balance_outstanding: 1 });
purchaseOrderSchema.index({ business_id: 1, po_number: 1 }, { unique: true });

export default mongoose.model('PurchaseOrder', purchaseOrderSchema);
