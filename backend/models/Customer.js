import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema({
  business_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    index: true
  },
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
  },
  is_active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

customerSchema.index({ name: 'text', phone: 'text', email: 'text' });
customerSchema.index({ business_id: 1, createdAt: -1 });

export default mongoose.model('Customer', customerSchema);
