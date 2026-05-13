import logger from '../utils/logger.js';
import { getSystemSettings, serializeSystemSettings } from '../utils/systemSettings.js';
import jwt from 'jsonwebtoken';
import Business from '../models/Business.js';
import User from '../models/User.js';
import { getAuthTokenFromRequest } from '../utils/authCookies.js';
import { ensureLegacyBusinessForUser, normalizeBusinessSlug } from '../utils/tenant.js';

const PAYMENT_ACCOUNT_TYPES = new Set(['', 'paybill', 'till']);
const NUMERIC_FIELDS = new Set([
  'default_low_stock_level',
  'high_value_price_threshold',
  'high_value_low_stock_level',
  'minimum_margin_threshold'
]);

const normalizeText = (value) => String(value ?? '').trim();

const normalizeNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
};

const getOptionalBusinessId = async (req) => {
  if (req.businessId) {
    return req.businessId;
  }

  const requestedBusiness = normalizeBusinessSlug(req.query.business || req.query.business_slug || req.query.businessCode);
  if (requestedBusiness) {
    const business = await Business.findOne({ slug: requestedBusiness, is_active: true });
    return business?._id || null;
  }

  const token = getAuthTokenFromRequest(req);
  if (!token) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || user.is_active === false) {
      return null;
    }

    const business = await ensureLegacyBusinessForUser(user);
    return business?._id || null;
  } catch (error) {
    return null;
  }
};

export const getPublicSettings = async (req, res) => {
  try {
    const businessId = await getOptionalBusinessId(req);
    const settings = await getSystemSettings(businessId);
    res.json({ success: true, data: serializeSystemSettings(settings) });
  } catch (error) {
    logger.error('Get public settings error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getSettings = async (req, res) => {
  try {
    const settings = await getSystemSettings(req.businessId);
    res.json({ success: true, data: serializeSystemSettings(settings) });
  } catch (error) {
    logger.error('Get settings error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const updateSettings = async (req, res) => {
  try {
    const settings = await getSystemSettings(req.businessId);

    const fields = [
      'business_name',
      'business_logo_url',
      'receipt_footer',
      'payment_account_type',
      'payment_account_number',
      'paybill_business_number',
      'paybill_account_number',
      'till_number',
      'default_low_stock_level',
      'high_value_price_threshold',
      'high_value_low_stock_level',
      'minimum_margin_threshold'
    ];

    fields.forEach((field) => {
      if (req.body[field] !== undefined) {
        settings[field] = NUMERIC_FIELDS.has(field)
          ? normalizeNumber(req.body[field], settings[field])
          : normalizeText(req.body[field]);
      }
    });

    settings.payment_account_type = normalizeText(settings.payment_account_type).toLowerCase();

    if (!PAYMENT_ACCOUNT_TYPES.has(settings.payment_account_type)) {
      return res.status(400).json({
        success: false,
        message: 'Payment account type must be Paybill, Till, or not shown.'
      });
    }

    const legacyAccountNumber = normalizeText(req.body.payment_account_number ?? settings.payment_account_number);
    const paybillBusinessNumber = normalizeText(settings.paybill_business_number || (
      settings.payment_account_type === 'paybill' ? legacyAccountNumber : ''
    ));
    const tillNumber = normalizeText(settings.till_number || (
      settings.payment_account_type === 'till' ? legacyAccountNumber : ''
    ));

    settings.paybill_business_number = paybillBusinessNumber;
    settings.paybill_account_number = normalizeText(settings.paybill_account_number);
    settings.till_number = tillNumber;
    settings.payment_account_number = settings.payment_account_type === 'paybill'
      ? paybillBusinessNumber
      : settings.payment_account_type === 'till'
        ? tillNumber
        : '';

    await settings.save();

    res.json({ success: true, data: serializeSystemSettings(settings) });
  } catch (error) {
    logger.error('Update settings error:', error);
    const isValidationError = ['ValidationError', 'CastError'].includes(error.name);
    res.status(isValidationError ? 400 : 500).json({
      success: false,
      message: isValidationError ? error.message : 'Failed to save settings'
    });
  }
};
