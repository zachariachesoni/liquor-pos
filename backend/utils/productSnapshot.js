const toNumber = (value) => {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric : 0;
};

const formatId = (value, stringifyIds) => {
  if (!value) return null;
  return stringifyIds ? String(value) : value;
};

export const getVariantProductSnapshot = (variant, {
  fallbackVariantId = null,
  stringifyIds = false,
  unknownProductName = 'Unknown product'
} = {}) => {
  const product = variant?.product_id || {};
  const variantId = variant?._id || fallbackVariantId || null;

  return {
    variant_id: formatId(variantId, stringifyIds),
    product_id: formatId(product?._id, stringifyIds),
    product_name: product?.name || unknownProductName,
    brand: product?.brand || '',
    category: product?.category || 'other',
    size: variant?.size || '',
    current_stock: toNumber(variant?.current_stock),
    buying_price: toNumber(variant?.buying_price),
    retail_price: toNumber(variant?.retail_price),
    wholesale_price: toNumber(variant?.wholesale_price)
  };
};
