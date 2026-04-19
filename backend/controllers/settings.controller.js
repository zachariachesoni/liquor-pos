import logger from '../utils/logger.js';
import { getSystemSettings, serializeSystemSettings } from '../utils/systemSettings.js';

export const getPublicSettings = async (req, res) => {
  try {
    const settings = await getSystemSettings();
    res.json({ success: true, data: serializeSystemSettings(settings) });
  } catch (error) {
    logger.error('Get public settings error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getSettings = async (req, res) => {
  try {
    const settings = await getSystemSettings();
    res.json({ success: true, data: serializeSystemSettings(settings) });
  } catch (error) {
    logger.error('Get settings error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const updateSettings = async (req, res) => {
  try {
    const settings = await getSystemSettings();

    const fields = [
      'business_name',
      'business_logo_url',
      'receipt_footer',
      'default_low_stock_level',
      'high_value_price_threshold',
      'high_value_low_stock_level',
      'minimum_margin_threshold'
    ];

    fields.forEach((field) => {
      if (req.body[field] !== undefined) {
        settings[field] = ['default_low_stock_level', 'high_value_price_threshold', 'high_value_low_stock_level', 'minimum_margin_threshold'].includes(field)
          ? Number(req.body[field])
          : req.body[field];
      }
    });

    await settings.save();

    res.json({ success: true, data: serializeSystemSettings(settings) });
  } catch (error) {
    logger.error('Update settings error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
