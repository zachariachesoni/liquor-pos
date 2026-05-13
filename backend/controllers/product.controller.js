import Product from '../models/Product.js';
import ProductVariant from '../models/ProductVariant.js';
import SupplierProduct from '../models/SupplierProduct.js';
import logger from '../utils/logger.js';
import { calculateEffectiveLowStockLevel, getSystemSettings, serializeSystemSettings } from '../utils/systemSettings.js';
import { buildPaginationMeta, getPagination } from '../utils/pagination.js';
import { attachBusinessId, getBusinessId, scopeToBusiness } from '../utils/tenant.js';

const normalizeProductName = (name = '') => (
  typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : ''
);

const normalizeVariantSize = (size = '') => (
  typeof size === 'string' ? size.trim().replace(/\s+/g, ' ') : ''
);

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const findExistingProductByName = async (businessId, name, excludeId = null, activeOnly = true) => {
  const normalizedName = normalizeProductName(name);

  if (!normalizedName) {
    return null;
  }

  const pattern = normalizedName
    .split(' ')
    .map(escapeRegex)
    .join('\\s+');

  const query = {
    business_id: businessId,
    name: new RegExp(`^${pattern}$`, 'i'),
  };

  if (activeOnly) {
    query.is_active = { $ne: false };
  }

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  return Product.findOne(query);
};

const findExistingVariantBySize = async (businessId, productId, size, excludeId = null, activeOnly = true) => {
  const normalizedSize = normalizeVariantSize(size);

  if (!normalizedSize) {
    return null;
  }

  const pattern = normalizedSize
    .split(' ')
    .map(escapeRegex)
    .join('\\s+');

  const query = {
    business_id: businessId,
    product_id: productId,
    size: new RegExp(`^${pattern}$`, 'i')
  };

  if (activeOnly) {
    query.is_active = { $ne: false };
  }

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  return ProductVariant.findOne(query);
};

// @desc    Get all products
// @route   GET /api/products
export const getProducts = async (req, res) => {
  try {
    const filters = scopeToBusiness(req, req.query.include_inactive === 'true' ? {} : { is_active: { $ne: false } });
    if (req.query.q) filters.name = { $regex: req.query.q, $options: 'i' };
    if (req.query.category) filters.category = req.query.category;
    if (req.query.is_active !== undefined) filters.is_active = req.query.is_active === 'true';

    const pagination = getPagination(req.query, 25, 100);
    let productQuery = Product.find(filters).sort({ name: 1, createdAt: -1 });
    const total = pagination.enabled ? await Product.countDocuments(filters) : null;

    if (pagination.enabled) {
      productQuery = productQuery.skip(pagination.skip).limit(pagination.limit);
    }

    const [settingsDoc, products] = await Promise.all([
      getSystemSettings(getBusinessId(req)),
      productQuery
    ]);
    const settings = serializeSystemSettings(settingsDoc);
    
    // Fetch variants and map them inside the product objects
    const variantFilters = {
      product_id: { $in: products.map(p => p._id) },
      business_id: getBusinessId(req),
      ...(req.query.include_inactive === 'true' ? {} : { is_active: { $ne: false } })
    };
    const variants = await ProductVariant.find(variantFilters);
    const supplierLinks = variants.length
      ? await SupplierProduct.find(scopeToBusiness(req, { variant_id: { $in: variants.map((variant) => variant._id) } }))
          .populate('supplier_id', 'name')
          .lean()
      : [];

    const supplierLinksByVariant = supplierLinks.reduce((map, link) => {
      const key = String(link.variant_id);
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key).push(link);
      return map;
    }, new Map());
    
    const productsData = products.map(product => {
      const pVariants = variants
        .filter(v => v.product_id.toString() === product._id.toString())
        .map((variant) => {
          const variantObject = variant.toObject();
          const variantSupplierLinks = supplierLinksByVariant.get(String(variant._id)) || [];
          const preferredSupplier = variantSupplierLinks.find((link) => link.is_preferred) || null;
          const cheapestSupplier = variantSupplierLinks.reduce((lowest, link) => {
            if (!lowest || Number(link.unit_cost || 0) < Number(lowest.unit_cost || 0)) {
              return link;
            }
            return lowest;
          }, null);

          return {
            ...variantObject,
            effective_low_stock_level: calculateEffectiveLowStockLevel(variantObject, settings),
            supplier_summary: {
              supplier_count: variantSupplierLinks.length,
              preferred_supplier_name: preferredSupplier?.supplier_id?.name || null,
              preferred_supplier_id: preferredSupplier?.supplier_id?._id || null,
              preferred_unit_cost: preferredSupplier?.unit_cost ?? null,
              cheapest_supplier_name: cheapestSupplier?.supplier_id?.name || null,
              cheapest_supplier_id: cheapestSupplier?.supplier_id?._id || null,
              cheapest_unit_cost: cheapestSupplier?.unit_cost ?? null
            }
          };
        });
      return { ...product.toObject(), variants: pVariants };
    });

    res.json({
      success: true,
      count: pagination.enabled ? total : productsData.length,
      data: productsData,
      ...(pagination.enabled ? { pagination: buildPaginationMeta({ ...pagination, total }) } : {})
    });
  } catch (error) {
    logger.error('Get products error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get single product
// @route   GET /api/products/:id
export const getProduct = async (req, res) => {
  try {
    const product = await Product.findOne(scopeToBusiness(req, { _id: req.params.id }));
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    
    // fetch variants
    const [settingsDoc, variants] = await Promise.all([
      getSystemSettings(getBusinessId(req)),
      ProductVariant.find(scopeToBusiness(req, { product_id: product._id }))
    ]);
    const settings = serializeSystemSettings(settingsDoc);
    const supplierLinks = variants.length
      ? await SupplierProduct.find(scopeToBusiness(req, { variant_id: { $in: variants.map((variant) => variant._id) } }))
          .populate('supplier_id', 'name')
          .lean()
      : [];

    const supplierLinksByVariant = supplierLinks.reduce((map, link) => {
      const key = String(link.variant_id);
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key).push(link);
      return map;
    }, new Map());
    
    const variantsData = variants.map((variant) => {
      const variantObject = variant.toObject();
      const variantSupplierLinks = supplierLinksByVariant.get(String(variant._id)) || [];
      const preferredSupplier = variantSupplierLinks.find((link) => link.is_preferred) || null;
      const cheapestSupplier = variantSupplierLinks.reduce((lowest, link) => {
        if (!lowest || Number(link.unit_cost || 0) < Number(lowest.unit_cost || 0)) {
          return link;
        }
        return lowest;
      }, null);

      return {
        ...variantObject,
        effective_low_stock_level: calculateEffectiveLowStockLevel(variantObject, settings),
        supplier_summary: {
          supplier_count: variantSupplierLinks.length,
          preferred_supplier_name: preferredSupplier?.supplier_id?.name || null,
          preferred_supplier_id: preferredSupplier?.supplier_id?._id || null,
          preferred_unit_cost: preferredSupplier?.unit_cost ?? null,
          cheapest_supplier_name: cheapestSupplier?.supplier_id?.name || null,
          cheapest_supplier_id: cheapestSupplier?.supplier_id?._id || null,
          cheapest_unit_cost: cheapestSupplier?.unit_cost ?? null
        }
      };
    });

    res.json({ success: true, data: { ...product.toObject(), variants: variantsData } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Create product
// @route   POST /api/products
export const createProduct = async (req, res) => {
  try {
    const normalizedName = normalizeProductName(req.body.name);

    if (!normalizedName) {
      return res.status(400).json({ success: false, message: 'Product name is required' });
    }

    const businessId = getBusinessId(req);
    const existingProduct = await findExistingProductByName(businessId, normalizedName);
    if (existingProduct) {
      return res.status(409).json({
        success: false,
        message: 'A product with that name already exists. Update the existing product instead of creating it again.'
      });
    }

    // Expected to receive basic product details + optionally variants array
    const product = await Product.create(attachBusinessId(req, {
      name: normalizedName,
      brand: req.body.brand,
      category: req.body.category,
      description: req.body.description,
      barcode: req.body.barcode,
      image_url: req.body.image_url,
      is_active: req.body.is_active
    }));

    let createdVariants = [];
    if (req.body.variants && Array.isArray(req.body.variants)) {
      const variantDocs = req.body.variants.map(v => ({
        ...v,
        business_id: businessId,
        product_id: product._id
      }));
      createdVariants = await ProductVariant.create(variantDocs);
    }
    
    res.status(201).json({
      success: true,
      data: {
        ...product.toObject(),
        variants: createdVariants.map((variant) => variant.toObject())
      }
    });
  } catch (error) {
    logger.error('Create product error:', error);
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Product barcode already exists' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
export const updateProduct = async (req, res) => {
  try {
    const existingProduct = await Product.findOne(scopeToBusiness(req, { _id: req.params.id }));
    if (!existingProduct) return res.status(404).json({ success: false, message: 'Product not found' });

    const nextName = req.body.name !== undefined
      ? normalizeProductName(req.body.name)
      : existingProduct.name;

    if (!nextName) {
      return res.status(400).json({ success: false, message: 'Product name is required' });
    }

    const duplicateProduct = await findExistingProductByName(getBusinessId(req), nextName, existingProduct._id);
    if (duplicateProduct) {
      return res.status(409).json({
        success: false,
        message: 'A product with that name already exists. Choose a different name or edit the existing product.'
      });
    }

    const product = await Product.findOneAndUpdate(
      scopeToBusiness(req, { _id: req.params.id }),
      { ...req.body, name: nextName },
      { new: true }
    );

    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, data: product });
  } catch (error) {
    logger.error('Update product error:', error);
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Product barcode already exists' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findOneAndUpdate(
      scopeToBusiness(req, { _id: req.params.id }),
      { is_active: false },
      { new: true }
    );
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    await ProductVariant.updateMany(scopeToBusiness(req, { product_id: req.params.id }), { $set: { is_active: false } });
    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Create variant
// @route   POST /api/products/:productId/variants
export const createVariant = async (req, res) => {
  try {
    const businessId = getBusinessId(req);
    const product = await Product.findOne(scopeToBusiness(req, { _id: req.params.productId }));
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const normalizedSize = normalizeVariantSize(req.body.size);
    if (!normalizedSize) {
      return res.status(400).json({ success: false, message: 'Variant size is required' });
    }

    const existingVariant = await findExistingVariantBySize(businessId, req.params.productId, normalizedSize);
    if (existingVariant) {
      return res.status(409).json({
        success: false,
        message: 'This size already exists for the selected product. Edit the existing SKU instead.'
      });
    }

    const inactiveVariant = await findExistingVariantBySize(businessId, req.params.productId, normalizedSize, null, false);
    if (inactiveVariant && inactiveVariant.is_active === false) {
      const variant = await ProductVariant.findOneAndUpdate(
        scopeToBusiness(req, { _id: inactiveVariant._id }),
        {
          ...req.body,
          size: normalizedSize,
          business_id: businessId,
          product_id: req.params.productId,
          is_active: true
        },
        { new: true, runValidators: true }
      );
      return res.status(200).json({ success: true, data: variant, reactivated: true });
    }

    const variant = await ProductVariant.create({
      ...req.body,
      size: normalizedSize,
      business_id: businessId,
      product_id: req.params.productId
    });
    res.status(201).json({ success: true, data: variant });
  } catch (error) {
    logger.error('Create variant error:', error);
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Variant barcode or size already exists' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update variant
// @route   PUT /api/products/variants/:id
export const updateVariant = async (req, res) => {
  try {
    const existingVariant = await ProductVariant.findOne(scopeToBusiness(req, { _id: req.params.id }));
    if (!existingVariant) {
      return res.status(404).json({ success: false, message: 'Variant not found' });
    }

    const nextSize = req.body.size !== undefined
      ? normalizeVariantSize(req.body.size)
      : existingVariant.size;

    if (!nextSize) {
      return res.status(400).json({ success: false, message: 'Variant size is required' });
    }

    const duplicateVariant = await findExistingVariantBySize(getBusinessId(req), existingVariant.product_id, nextSize, existingVariant._id);
    if (duplicateVariant) {
      return res.status(409).json({
        success: false,
        message: 'This size already exists for the selected product. Choose a different variant size.'
      });
    }

    const variant = await ProductVariant.findOneAndUpdate(
      scopeToBusiness(req, { _id: req.params.id }),
      { ...req.body, size: nextSize },
      { new: true }
    );
    res.json({ success: true, data: variant });
  } catch (error) {
    logger.error('Update variant error:', error);
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Variant barcode or size already exists' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Delete variant
// @route   DELETE /api/products/variants/:id
export const deleteVariant = async (req, res) => {
  try {
    const variant = await ProductVariant.findOneAndUpdate(
      scopeToBusiness(req, { _id: req.params.id }),
      { is_active: false },
      { new: true }
    );
    if (!variant) return res.status(404).json({ success: false, message: 'Variant not found' });
    res.json({ success: true, data: variant });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
