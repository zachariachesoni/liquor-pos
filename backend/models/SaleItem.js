import mongoose from 'mongoose';

const saleItemSchema = new mongoose.Schema({
  sale_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sale',
    required: true
  },
  variant_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProductVariant',
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  unit_price: {
    type: Number,
    required: true
  },
  wholesale_applied: {
    type: Boolean,
    default: false
  },
  buying_price: {
    type: Number,
    required: true
  },
  profit_margin: {
    type: Number,
    required: true
  },
  subtotal: {
    type: Number,
    required: true
  }
}, {
  timestamps: true
});

saleItemSchema.index({ sale_id: 1 });
saleItemSchema.index({ variant_id: 1 });

export default mongoose.model('SaleItem', saleItemSchema);
