import Business from '../models/Business.js';
import User from '../models/User.js';
import Customer from '../models/Customer.js';
import Expense from '../models/Expense.js';
import Notification from '../models/Notification.js';
import Product from '../models/Product.js';
import ProductVariant from '../models/ProductVariant.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import PurchaseOrderItem from '../models/PurchaseOrderItem.js';
import Sale from '../models/Sale.js';
import SaleItem from '../models/SaleItem.js';
import StockAdjustment from '../models/StockAdjustment.js';
import Supplier from '../models/Supplier.js';
import SupplierPayment from '../models/SupplierPayment.js';
import SupplierProduct from '../models/SupplierProduct.js';
import SupplierProductPriceHistory from '../models/SupplierProductPriceHistory.js';
import SystemSettings from '../models/SystemSettings.js';

const TENANT_MODELS = [
  Customer,
  Expense,
  Notification,
  Product,
  ProductVariant,
  PurchaseOrder,
  PurchaseOrderItem,
  Sale,
  SaleItem,
  StockAdjustment,
  Supplier,
  SupplierPayment,
  SupplierProduct,
  SupplierProductPriceHistory,
  SystemSettings
];

export const normalizeBusinessSlug = (value = '') => (
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
);

export const createUniqueBusinessSlug = async (name, requestedSlug = '') => {
  const baseSlug = normalizeBusinessSlug(requestedSlug || name || 'business') || 'business';
  let slug = baseSlug;
  let index = 2;

  while (await Business.exists({ slug })) {
    slug = `${baseSlug}-${index}`;
    index += 1;
  }

  return slug;
};

export const getBusinessId = (req) => req.businessId || req.user?.business_id || null;

export const scopeToBusiness = (req, filters = {}) => ({
  ...filters,
  business_id: getBusinessId(req)
});

export const attachBusinessId = (req, payload = {}) => ({
  ...payload,
  business_id: getBusinessId(req)
});

export const createBusiness = async ({ name, slug }) => {
  const businessName = String(name || '').trim().replace(/\s+/g, ' ');
  if (!businessName) {
    const error = new Error('Business name is required');
    error.statusCode = 400;
    throw error;
  }

  const requestedSlug = normalizeBusinessSlug(slug);
  if (requestedSlug && await Business.exists({ slug: requestedSlug })) {
    const error = new Error('Business code already exists. Choose a different code.');
    error.statusCode = 409;
    throw error;
  }

  const businessSlug = requestedSlug || await createUniqueBusinessSlug(businessName);
  return Business.create({
    name: businessName,
    slug: businessSlug,
    is_active: true
  });
};

export const ensureLegacyBusinessForUser = async (user) => {
  if (user?.business_id) {
    return Business.findById(user.business_id);
  }

  let settings = await SystemSettings.findOne({ business_id: { $exists: false } }).lean();
  const businessName = settings?.business_name || 'Default Business';
  let business = await Business.findOne({ slug: 'default-business' });

  if (!business) {
    business = await Business.create({
      name: businessName,
      slug: 'default-business',
      is_active: true
    });
  }

  await User.updateMany(
    { $or: [{ business_id: { $exists: false } }, { business_id: null }] },
    { $set: { business_id: business._id } }
  );

  await Promise.all(TENANT_MODELS.map((Model) => Model.updateMany(
    { $or: [{ business_id: { $exists: false } }, { business_id: null }] },
    { $set: { business_id: business._id } }
  )));

  user.business_id = business._id;
  return business;
};

export const dropLegacyGlobalTenantIndexes = async () => {
  const dropIndex = async (Model, indexName) => {
    try {
      await Model.collection.dropIndex(indexName);
    } catch (error) {
      if (![26, 27].includes(error.code) && !/index not found/i.test(error.message || '')) {
        throw error;
      }
    }
  };

  await Promise.all([
    dropIndex(User, 'username_1'),
    dropIndex(Product, 'barcode_1'),
    dropIndex(ProductVariant, 'barcode_1'),
    dropIndex(PurchaseOrder, 'po_number_1'),
    dropIndex(Sale, 'invoice_number_1'),
    dropIndex(Sale, 'idempotency_key_1'),
    dropIndex(Supplier, 'name_1'),
    dropIndex(Notification, 'source_key_1'),
    dropIndex(SupplierProduct, 'supplier_id_1_variant_id_1')
  ]);
};
