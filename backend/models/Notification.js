import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  source_key: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  type: {
    type: String,
    enum: ['inventory', 'supplier', 'system', 'custom'],
    default: 'system'
  },
  severity: {
    type: String,
    enum: ['info', 'warning', 'critical'],
    default: 'info'
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['open', 'addressed'],
    default: 'open',
    index: true
  },
  generated: {
    type: Boolean,
    default: true
  },
  metadata: {
    type: Object,
    default: {}
  },
  addressed_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  addressed_at: {
    type: Date,
    default: null
  },
  resolution_note: {
    type: String,
    default: '',
    trim: true
  }
}, {
  timestamps: true
});

notificationSchema.index({ status: 1, severity: 1, updatedAt: -1 });

export default mongoose.model('Notification', notificationSchema);
