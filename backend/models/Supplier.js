import mongoose from 'mongoose';

const normalizeTextValue = (value) => (
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value
);

const supplierSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    set: normalizeTextValue
  },
  contact_name: {
    type: String,
    trim: true,
    default: '',
    set: normalizeTextValue
  },
  phone: {
    type: String,
    trim: true,
    default: '',
    set: normalizeTextValue
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    default: ''
  },
  address: {
    type: String,
    trim: true,
    default: ''
  },
  payment_terms_days: {
    type: Number,
    min: 0,
    default: 0
  },
  credit_limit: {
    type: Number,
    min: 0,
    default: 0
  },
  account_number: {
    type: String,
    trim: true,
    default: '',
    set: normalizeTextValue
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  },
  active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

supplierSchema.index({ name: 'text', contact_name: 'text', phone: 'text', email: 'text' });
supplierSchema.index({ name: 1 }, { unique: true });
supplierSchema.index({ active: 1 });

export default mongoose.model('Supplier', supplierSchema);
