import mongoose from 'mongoose';

const saleSchema = new mongoose.Schema({
  invoice_number: {
    type: String,
    required: true,
    unique: true
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

saleSchema.index({ created_at: -1 });
saleSchema.index({ customer_id: 1 });
saleSchema.index({ user_id: 1 });
saleSchema.index({ invoice_number: 1 });

export default mongoose.model('Sale', saleSchema);
