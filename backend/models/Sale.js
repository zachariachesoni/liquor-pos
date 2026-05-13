import mongoose from 'mongoose';

const saleSchema = new mongoose.Schema({
  business_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    index: true
  },
  invoice_number: {
    type: String,
    required: true
  },
  idempotency_key: {
    type: String,
    trim: true
  },
  customer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    nullable: true
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  subtotal: {
    type: Number,
    required: true,
    default: 0
  },
  discount: {
    type: Number,
    default: 0
  },
  tax: {
    type: Number,
    default: 0
  },
  total_amount: {
    type: Number,
    required: true
  },
  amount_paid: {
    type: Number,
    required: true,
    default: 0
  },
  change_due: {
    type: Number,
    default: 0
  },
  payment_method: {
    type: String,
    enum: ['cash', 'mpesa', 'bank', 'split'],
    required: true
  },
  sale_type: {
    type: String,
    enum: ['retail', 'wholesale'],
    default: 'retail'
  },
  notes: {
    type: String
  }
}, {
  timestamps: true
});

saleSchema.index({ business_id: 1, createdAt: -1 });
saleSchema.index({ business_id: 1, customer_id: 1 });
saleSchema.index({ business_id: 1, user_id: 1 });
saleSchema.index({ business_id: 1, invoice_number: 1 }, { unique: true });
saleSchema.index({ business_id: 1, idempotency_key: 1 }, { unique: true, sparse: true });

export default mongoose.model('Sale', saleSchema);
