import { describe, expect, test } from '@jest/globals';
import { LEGAL_TYPES, requireRealLegalDraft } from '../legal.js';

describe('legal draft truthfulness gate', () => {
  test('rejects AI fallback content instead of allowing it to be saved', () => {
    expect(() => requireRealLegalDraft({
      fallback: true,
      document: '[AI offline] terms template for Example Ltd.',
    })).toThrow('Nothing was saved');
  });

  test('rejects empty provider output', () => {
    expect(() => requireRealLegalDraft({ fallback: false, document: '   ' })).toThrow('Nothing was saved');
  });

  test('accepts a real non-empty draft for later human legal review', () => {
    expect(requireRealLegalDraft({ fallback: false, document: 'Draft legal text.' })).toBe('Draft legal text.');
  });

  test('only exposes the supported legal document types', () => {
    expect([...LEGAL_TYPES.keys()]).toEqual(['terms', 'privacy', 'gdpr', 'ccpa', 'dmca', 'cookie']);
  });
});
