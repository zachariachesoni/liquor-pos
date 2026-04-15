import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  brand: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['whisky', 'vodka', 'gin', 'rum', 'tequila', 'beer', 'wine', 'spirits', 'soft drinks', 'mixer', 'other']
  },
  description: {
    type: String
  },
  barcode: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  image_url: {
    type: String
  },
  is_active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for faster searches
productSchema.index({ name: 'text', brand: 'text', description: 'text' });
productSchema.index({ category: 1 });
productSchema.index({ brand: 1 });

export default mongoose.model('Product', productSchema);
