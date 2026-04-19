import mongoose from 'mongoose';

const purchaseOrderItemSchema = new mongoose.Schema({
  po_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PurchaseOrder',
    required: true
  },
  variant_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProductVariant',
    required: true
  },
  qty_ordered: {
    type: Number,
    min: 0,
    required: true,
    default: 0
  },
  qty_received: {
    type: Number,
    min: 0,
    required: true,
    default: 0
  },
  unit_cost: {
    type: Number,
    min: 0,
    required: true,
    default: 0
  },
  line_total: {
    type: Number,
    min: 0,
    required: true,
    default: 0
  }
}, {
  timestamps: true
});

purchaseOrderItemSchema.index({ po_id: 1 });
purchaseOrderItemSchema.index({ variant_id: 1, createdAt: -1 });

export default mongoose.model('PurchaseOrderItem', purchaseOrderItemSchema);
