const API_ORIGIN = (
  import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'
).replace(/\/+$/, '');

const FALLBACK =
  'https://via.placeholder.com/300?text=No+Image';

/**
 * Nuclear image URL resolver.
 * Turns backend paths into full URLs the browser can load.
 */
export function getImageUrl(path?: string | null): string {
  if (path == null) return FALLBACK;

  const value = String(path).trim();
  if (!value) return FALLBACK;

  // Absolute URL or in-form base64 preview
  if (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('data:') ||
    value.startsWith('blob:')
  ) {
    return value;
  }

  // "/static/uploads/products/xxx.jpg"
  if (value.startsWith('/')) {
    return API_ORIGIN + value;
  }

  // "static/uploads/products/xxx.jpg"
  return API_ORIGIN + '/' + value;
}

export { API_ORIGIN, FALLBACK };