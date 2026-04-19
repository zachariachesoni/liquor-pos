import mongoose from 'mongoose';

const systemSettingsSchema = new mongoose.Schema({
  business_name: {
    type: String,
    default: 'Liquor POS',
    trim: true
  },
  business_logo_url: {
    type: String,
    default: '',
    trim: true
  },
  receipt_footer: {
    type: String,
    default: 'Thank you for your business.',
    trim: true
  },
  default_low_stock_level: {
    type: Number,
    default: 5,
    min: 0
  },
  high_value_price_threshold: {
    type: Number,
    default: 10000,
    min: 0
  },
  high_value_low_stock_level: {
    type: Number,
    default: 2,
    min: 0
  },
  minimum_margin_threshold: {
    type: Number,
    default: 15,
    min: 0
  }
}, {
  timestamps: true
});

export default mongoose.model('SystemSettings', systemSettingsSchema);
