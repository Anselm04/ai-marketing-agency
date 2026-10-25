import { describe, expect, test } from '@jest/globals';
import { currencyExponent, majorToMinor, minorToMajor, minorToMicros } from '../currencyService.js';

describe('currency service', () => {
  test('handles standard two-decimal currencies', () => {
    expect(currencyExponent('NZD')).toBe(2);
    expect(majorToMinor(123.45, 'NZD')).toBe(12345);
    expect(minorToMajor(12345, 'NZD')).toBe(123.45);
    expect(minorToMicros(12345, 'NZD')).toBe(123450000);
  });

  test('handles zero-decimal currencies', () => {
    expect(currencyExponent('JPY')).toBe(0);
    expect(majorToMinor(123, 'JPY')).toBe(123);
    expect(minorToMajor(123, 'JPY')).toBe(123);
    expect(minorToMicros(123, 'JPY')).toBe(123000000);
  });

  test('handles three-decimal currencies', () => {
    expect(currencyExponent('KWD')).toBe(3);
    expect(majorToMinor(1.234, 'KWD')).toBe(1234);
    expect(minorToMajor(1234, 'KWD')).toBe(1.234);
    expect(minorToMicros(1234, 'KWD')).toBe(1234000);
  });
});
