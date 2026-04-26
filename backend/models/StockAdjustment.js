import mongoose from 'mongoose';

const stockAdjustmentSchema = new mongoose.Schema({
  variant_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProductVariant',
    required: true
  },
  adjustment_type: {
    type: String,
    enum: ['in', 'out'],
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  unit_cost: {
    type: Number,
    default: null
  },
  stock_before: {
    type: Number,
    default: null
  },
  stock_after: {
    type: Number,
    default: null
  },
  reason: {
    type: String,
    required: true,
    enum: ['sale', 'breakage', 'theft', 'promotion', 'expired', 'damaged', 'found', 'return', 'restocking', 'other']
  },
  notes: {
    type: String
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  purchase_order_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PurchaseOrder',
    default: null
  }
}, {
  timestamps: true
});

stockAdjustmentSchema.index({ variant_id: 1 });
stockAdjustmentSchema.index({ created_at: -1 });

export default mongoose.model('StockAdjustment', stockAdjustmentSchema);
