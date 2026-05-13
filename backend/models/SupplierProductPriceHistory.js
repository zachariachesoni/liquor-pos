import mongoose from 'mongoose';

const supplierProductPriceHistorySchema = new mongoose.Schema({
  business_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    index: true
  },
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
  old_cost: {
    type: Number,
    min: 0,
    required: true
  },
  new_cost: {
    type: Number,
    min: 0,
    required: true
  },
  changed_at: {
    type: Date,
    default: Date.now
  },
  changed_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

supplierProductPriceHistorySchema.index({ business_id: 1, supplier_id: 1, variant_id: 1, changed_at: -1 });
supplierProductPriceHistorySchema.index({ business_id: 1, variant_id: 1, changed_at: -1 });

export default mongoose.model('SupplierProductPriceHistory', supplierProductPriceHistorySchema);
