import mongoose from 'mongoose';

const supplierPaymentSchema = new mongoose.Schema({
  po_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PurchaseOrder',
    required: true
  },
  supplier_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: true
  },
  amount: {
    type: Number,
    min: 0,
    required: true
  },
  paid_at: {
    type: Date,
    default: Date.now
  },
  recorded_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  }
}, {
  timestamps: true
});

supplierPaymentSchema.index({ supplier_id: 1, paid_at: -1 });
supplierPaymentSchema.index({ po_id: 1, paid_at: -1 });

export default mongoose.model('SupplierPayment', supplierPaymentSchema);
