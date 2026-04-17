import Product from '../models/Product.js';
import ProductVariant from '../models/ProductVariant.js';
import logger from '../utils/logger.js';

const normalizeProductName = (name = '') => (
  typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : ''
);

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const findExistingProductByName = async (name, excludeId = null) => {
  const normalizedName = normalizeProductName(name);

  if (!normalizedName) {
    return null;
  }

  const pattern = normalizedName
    .split(' ')
    .map(escapeRegex)
    .join('\\s+');

  const query = {
    name: new RegExp(`^${pattern}$`, 'i'),
  };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  return Product.findOne(query);
};

// @desc    Get all products
// @route   GET /api/products
export const getProducts = async (req, res) => {
  try {
    const filters = {};
    if (req.query.q) filters.name = { $regex: req.query.q, $options: 'i' };
    if (req.query.category) filters.category = req.query.category;
    if (req.query.is_active !== undefined) filters.is_active = req.query.is_active === 'true';

    const products = await Product.find(filters);
    
    // Fetch variants and map them inside the product objects
    const variants = await ProductVariant.find({ product_id: { $in: products.map(p => p._id) }});
    
    const productsData = products.map(product => {
      const pVariants = variants.filter(v => v.product_id.toString() === product._id.toString());
      return { ...product.toObject(), variants: pVariants };
    });

    res.json({ success: true, count: productsData.length, data: productsData });
  } catch (error) {
    logger.error('Get products error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get single product
// @route   GET /api/products/:id
export const getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    
    // fetch variants
    const variants = await ProductVariant.find({ product_id: product._id });
    
    res.json({ success: true, data: { ...product.toObject(), variants } });
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

    const existingProduct = await findExistingProductByName(normalizedName);
    if (existingProduct) {
      return res.status(409).json({
        success: false,
        message: 'A product with that name already exists. Update the existing product instead of creating it again.'
      });
    }

    // Expected to receive basic product details + optionally variants array
    const product = await Product.create({
      name: normalizedName,
      brand: req.body.brand,
      category: req.body.category,
      description: req.body.description,
      barcode: req.body.barcode,
      image_url: req.body.image_url,
      is_active: req.body.is_active
    });

    if (req.body.variants && Array.isArray(req.body.variants)) {
      const variantDocs = req.body.variants.map(v => ({
        ...v,
        product_id: product._id
      }));
      await ProductVariant.create(variantDocs);
    }
    
    res.status(201).json({ success: true, data: product });
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
    const existingProduct = await Product.findById(req.params.id);
    if (!existingProduct) return res.status(404).json({ success: false, message: 'Product not found' });

    const nextName = req.body.name !== undefined
      ? normalizeProductName(req.body.name)
      : existingProduct.name;

    if (!nextName) {
      return res.status(400).json({ success: false, message: 'Product name is required' });
    }

    const duplicateProduct = await findExistingProductByName(nextName, existingProduct._id);
    if (duplicateProduct) {
      return res.status(409).json({
        success: false,
        message: 'A product with that name already exists. Choose a different name or edit the existing product.'
      });
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
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
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    // Cleanup variants
    await ProductVariant.deleteMany({ product_id: req.params.id });
    res.json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Create variant
// @route   POST /api/products/:productId/variants
export const createVariant = async (req, res) => {
  try {
    const variant = await ProductVariant.create({
      ...req.body,
      product_id: req.params.productId
    });
    res.status(201).json({ success: true, data: variant });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update variant
// @route   PUT /api/products/variants/:id
export const updateVariant = async (req, res) => {
  try {
    const variant = await ProductVariant.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, data: variant });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Delete variant
// @route   DELETE /api/products/variants/:id
export const deleteVariant = async (req, res) => {
  try {
    await ProductVariant.findByIdAndDelete(req.params.id);
    res.json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
