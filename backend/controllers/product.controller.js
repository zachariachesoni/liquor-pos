import Product from '../models/Product.js';
import ProductVariant from '../models/ProductVariant.js';
import logger from '../utils/logger.js';

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
    // Expected to receive basic product details + optionally variants array
    const product = await Product.create({
      name: req.body.name,
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
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
export const updateProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, data: product });
  } catch (error) {
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
