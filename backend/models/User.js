import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true // This creates the index
  },
  password: {
    type: String,
    required: true
  },
  email: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
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

// Index for role queries only (username already indexed above)
userSchema.index({ role: 1 });

export default mongoose.model('User', userSchema);
