import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true
  },
  customer_type: {
    type: String,
    enum: ['retail', 'wholesale'],
    default: 'retail'
  },
  address: {
    type: String
  },
  notes: {
    type: String
  }
}, {
  timestamps: true
});

customerSchema.index({ name: 'text', phone: 'text', email: 'text' });

export default mongoose.model('Customer', customerSchema);
