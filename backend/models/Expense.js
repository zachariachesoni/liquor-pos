import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema({
  category: {
    type: String,
    required: true,
    enum: ['rent', 'salaries', 'transport', 'restocking', 'utilities', 'maintenance', 'other']
  },
  description: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  expense_date: {
    type: Date,
    default: Date.now
  },
  payment_method: {
    type: String,
    enum: ['cash', 'mpesa', 'bank']
  },
  reference_number: {
    type: String
  },
  receipt_image: {
    type: String
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

expenseSchema.index({ category: 1 });
expenseSchema.index({ expense_date: -1 });

export default mongoose.model('Expense', expenseSchema);
