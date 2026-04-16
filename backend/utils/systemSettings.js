import SystemSettings from '../models/SystemSettings.js';

const DEFAULT_SETTINGS = {
  business_name: 'Liquor POS',
  business_logo_url: '',
  receipt_footer: 'Thank you for your business.',
  default_low_stock_level: 5,
  high_value_price_threshold: 10000,
  high_value_low_stock_level: 2
};

export const getSystemSettings = async () => {
  let settings = await SystemSettings.findOne();

  if (!settings) {
    settings = await SystemSettings.create(DEFAULT_SETTINGS);
  }

  return settings;
};

export const serializeSystemSettings = (settingsDoc) => {
  const settings = typeof settingsDoc?.toObject === 'function'
    ? settingsDoc.toObject()
    : settingsDoc;

  return {
    ...DEFAULT_SETTINGS,
    ...settings,
  };
};

export const calculateEffectiveLowStockLevel = (variant, settings = DEFAULT_SETTINGS) => {
  const baseLevel = Number(variant?.min_stock_level ?? settings.default_low_stock_level ?? DEFAULT_SETTINGS.default_low_stock_level);
  const retailPrice = Number(variant?.retail_price ?? variant?.buying_price ?? 0);
  const highValueThreshold = Number(settings.high_value_price_threshold ?? DEFAULT_SETTINGS.high_value_price_threshold);
  const highValueLevel = Number(settings.high_value_low_stock_level ?? DEFAULT_SETTINGS.high_value_low_stock_level);

  if (retailPrice >= highValueThreshold) {
    return Math.min(baseLevel, highValueLevel);
  }

  return baseLevel;
};
