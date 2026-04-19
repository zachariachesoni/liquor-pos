import mongoose from 'mongoose';

const supplierProductSchema = new mongoose.Schema({
  supplier_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: true
  },
  variant_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProductVariant',
    required: true
  },
  unit_cost: {
    type: Number,
    min: 0,
    required: true,
    default: 0
  },
  min_order_qty: {
    type: Number,
    min: 1,
    default: 1
  },
  lead_time_days: {
    type: Number,
    min: 0,
    default: 0
  },
  is_preferred: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

supplierProductSchema.index({ supplier_id: 1, variant_id: 1 }, { unique: true });
supplierProductSchema.index({ variant_id: 1, is_preferred: 1 });

export default mongoose.model('SupplierProduct', supplierProductSchema);
