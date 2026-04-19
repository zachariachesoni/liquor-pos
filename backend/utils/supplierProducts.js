import SupplierProduct from '../models/SupplierProduct.js';
import SupplierProductPriceHistory from '../models/SupplierProductPriceHistory.js';

const toNumberOrDefault = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

export const syncSupplierProductPricing = async ({
  supplierId,
  variantId,
  unitCost,
  minOrderQty,
  leadTimeDays,
  isPreferred,
  userId,
  session = null
}) => {
  const normalizedUnitCost = toNumberOrDefault(unitCost, 0);

  let existingLink = await SupplierProduct.findOne({
    supplier_id: supplierId,
    variant_id: variantId
  }).session(session);

  const normalizedMinOrderQty = minOrderQty !== undefined
    ? Math.max(1, toNumberOrDefault(minOrderQty, 1))
    : Math.max(1, toNumberOrDefault(existingLink?.min_order_qty, 1));
  const normalizedLeadTimeDays = leadTimeDays !== undefined
    ? Math.max(0, toNumberOrDefault(leadTimeDays, 0))
    : Math.max(0, toNumberOrDefault(existingLink?.lead_time_days, 0));

  const currentPreferred = await SupplierProduct.findOne({
    variant_id: variantId,
    is_preferred: true
  }).session(session);

  const shouldSetPreferred = Boolean(isPreferred) || (!currentPreferred && !existingLink);

  if (existingLink && Number(existingLink.unit_cost || 0) !== normalizedUnitCost) {
    await SupplierProductPriceHistory.create([{
      supplier_id: supplierId,
      variant_id: variantId,
      old_cost: Number(existingLink.unit_cost || 0),
      new_cost: normalizedUnitCost,
      changed_by: userId
    }], { session, ordered: true });
  }

  if (!existingLink) {
    const [createdLink] = await SupplierProduct.create([{
      supplier_id: supplierId,
      variant_id: variantId,
      unit_cost: normalizedUnitCost,
      min_order_qty: normalizedMinOrderQty,
      lead_time_days: normalizedLeadTimeDays,
      is_preferred: shouldSetPreferred
    }], { session, ordered: true });

    existingLink = createdLink;
  } else {
    existingLink.unit_cost = normalizedUnitCost;
    existingLink.min_order_qty = normalizedMinOrderQty;
    existingLink.lead_time_days = normalizedLeadTimeDays;
    existingLink.is_preferred = shouldSetPreferred;
    await existingLink.save({ session });
  }

  if (shouldSetPreferred) {
    await SupplierProduct.updateMany(
      {
        variant_id: variantId,
        _id: { $ne: existingLink._id }
      },
      { $set: { is_preferred: false } },
      { session }
    );
  }

  return existingLink;
};
