const parseCookies = (cookieHeader = '') => (
  cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const separatorIndex = part.indexOf('=');
      if (separatorIndex === -1) return acc;

      const key = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();
      acc[key] = decodeURIComponent(value);
      return acc;
    }, {})
);

const normalizeSameSite = (value) => {
  const normalized = String(value || '').trim().toLowerCase();

  if (['strict', 'lax', 'none'].includes(normalized)) {
    return normalized;
  }

  return process.env.NODE_ENV === 'production' ? 'none' : 'lax';
};

export const getAuthCookieOptions = () => {
  const sameSite = normalizeSameSite(process.env.COOKIE_SAMESITE);
  const secure = process.env.COOKIE_SECURE
    ? process.env.COOKIE_SECURE === 'true'
    : process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
};

export const getAuthTokenFromRequest = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }

  const cookies = parseCookies(req.headers.cookie);
  return cookies.auth_token || null;
};
