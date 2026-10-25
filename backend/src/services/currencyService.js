const ZERO_DECIMAL = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
]);
const THREE_DECIMAL = new Set(['BHD', 'JOD', 'KWD', 'OMR', 'TND']);

export function currencyExponent(currency) {
  const code = String(currency || '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) throw new Error('A valid three-letter currency code is required.');
  if (ZERO_DECIMAL.has(code)) return 0;
  if (THREE_DECIMAL.has(code)) return 3;
  return 2;
}

export function majorToMinor(amount, currency) {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric) || numeric < 0) throw new Error('Currency amount must be a non-negative number.');
  const factor = 10 ** currencyExponent(currency);
  return Math.round((numeric + Number.EPSILON) * factor);
}

export function minorToMajor(amount, currency) {
  const numeric = Number(amount);
  if (!Number.isInteger(numeric) || numeric < 0) throw new Error('Minor-unit amount must be a non-negative integer.');
  return numeric / (10 ** currencyExponent(currency));
}

export function minorToMicros(amount, currency) {
  const numeric = Number(amount);
  if (!Number.isInteger(numeric) || numeric < 0) throw new Error('Minor-unit amount must be a non-negative integer.');
  const exponent = currencyExponent(currency);
  if (exponent > 6) throw new Error('Currency precision cannot be represented in provider micros.');
  return numeric * (10 ** (6 - exponent));
}

export function currencyMetadata(currency) {
  const code = String(currency || '').trim().toUpperCase();
  return { currency: code, exponent: currencyExponent(code) };
}

export default { currencyExponent, majorToMinor, minorToMajor, minorToMicros, currencyMetadata };
