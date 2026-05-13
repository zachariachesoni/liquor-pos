import mongoose from 'mongoose';

const productVariantSchema = new mongoose.Schema({
  business_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    index: true
  },
  product_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  size: {
    type: String,
    required: true
  },
  size_in_ml: {
    type: Number,
    required: true
  },
  buying_price: {
    type: Number,
    required: true,
    default: 0
  },
  retail_price: {
    type: Number,
    required: true
  },
  wholesale_price: {
    type: Number,
    required: true
  },
  wholesale_threshold: {
    type: Number,
    default: 12
  },
  current_stock: {
    type: Number,
    default: 0
  },
  min_stock_level: {
    type: Number,
    default: 5
  },
  barcode: {
    type: String
  },
  is_active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Compound index for unique product-size combination
productVariantSchema.index({ product_id: 1, size: 1 }, { unique: true });
productVariantSchema.index({ business_id: 1, current_stock: 1 });
productVariantSchema.index({ business_id: 1, barcode: 1 }, { unique: true, sparse: true });

export default mongoose.model('ProductVariant', productVariantSchema);
