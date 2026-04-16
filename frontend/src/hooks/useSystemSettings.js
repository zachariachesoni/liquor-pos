import { useEffect, useState } from 'react';
import api from '../utils/api';

const defaultSettings = {
  business_name: 'Liquor POS',
  business_logo_url: '',
  receipt_footer: 'Thank you for your business.',
  default_low_stock_level: 5,
  high_value_price_threshold: 10000,
  high_value_low_stock_level: 2,
};

export const useSystemSettings = () => {
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const fetchSettings = async () => {
      try {
        const response = await api.get('/settings/public');
        if (active) {
          setSettings({ ...defaultSettings, ...(response.data.data || {}) });
        }
      } catch (error) {
        console.error('Failed to load system settings', error);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchSettings();

    return () => {
      active = false;
    };
  }, []);

  return { settings, setSettings, loading };
};
