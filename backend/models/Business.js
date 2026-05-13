import mongoose from 'mongoose';

const normalizeTextValue = (value) => (
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value
);

const businessSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    set: normalizeTextValue
  },
  slug: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  is_active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

businessSchema.index({ slug: 1 }, { unique: true });
businessSchema.index({ is_active: 1 });

export default mongoose.model('Business', businessSchema);
