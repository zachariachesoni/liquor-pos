import { useEffect, useState } from 'react';
import api from '../utils/api';

const SETTINGS_STORAGE_KEY = 'system_settings_cache';
const LARGE_INLINE_ASSET_PREFIX = 'data:image/';

const defaultSettings = {
  business_name: 'Liquor POS',
  business_logo_url: '',
  receipt_footer: 'Thank you for your business.',
  payment_account_type: '',
  payment_account_number: '',
  default_low_stock_level: 5,
  high_value_price_threshold: 10000,
  high_value_low_stock_level: 2,
  minimum_margin_threshold: 15,
};

export const getCacheableSettings = (settings) => {
  if (!settings?.business_logo_url?.startsWith(LARGE_INLINE_ASSET_PREFIX)) {
    return settings;
  }

  return {
    ...settings,
    business_logo_url: '',
  };
};

const applyBrowserBranding = (settings) => {
  const businessName = settings.business_name?.trim() || defaultSettings.business_name;
  document.title = `${businessName} POS`;

  let favicon = document.querySelector("link[rel='icon']");
  if (!favicon) {
    favicon = document.createElement('link');
    favicon.rel = 'icon';
    document.head.appendChild(favicon);
  }

  if (settings.business_logo_url) {
    favicon.href = settings.business_logo_url;
    return;
  }

  const initial = businessName.charAt(0).toUpperCase() || 'P';
  const fallbackSvg = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#6366f1" />
          <stop offset="100%" stop-color="#4338ca" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#g)" />
      <text x="50%" y="54%" text-anchor="middle" font-size="30" font-family="Arial, sans-serif" fill="#ffffff">${initial}</text>
    </svg>
  `);
  favicon.href = `data:image/svg+xml,${fallbackSvg}`;
};

export const useSystemSettings = () => {
  const [settings, setSettings] = useState(() => {
    try {
      const cached = localStorage.getItem(SETTINGS_STORAGE_KEY);
      return cached ? { ...defaultSettings, ...JSON.parse(cached) } : defaultSettings;
    } catch (error) {
      console.error('Failed to read cached system settings', error);
      return defaultSettings;
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const fetchSettings = async () => {
      try {
        const response = await api.get('/settings/public');
        if (active) {
          const nextSettings = { ...defaultSettings, ...(response.data.data || {}) };
          setSettings(nextSettings);
          localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(getCacheableSettings(nextSettings)));
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

  useEffect(() => {
    applyBrowserBranding(settings);
  }, [settings]);

  return { settings, setSettings, loading };
};
