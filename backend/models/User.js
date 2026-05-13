import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  business_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    index: true
  },
  username: {
    type: String,
    required: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['admin', 'manager', 'cashier'],
    required: true,
    default: 'cashier'
  },
  permissions: {
    type: Object,
    default: {}
  },
  is_active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

userSchema.index({ business_id: 1, username: 1 }, { unique: true });
userSchema.index({ business_id: 1, role: 1 });

export default mongoose.model('User', userSchema);
