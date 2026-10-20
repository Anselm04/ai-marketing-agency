import { describe, expect, test } from '@jest/globals';
import { safeCsvValue } from '../routes/export.js';

describe('customer export safety', () => {
  test.each(['=HYPERLINK("https://evil")', '+cmd', '-1+2', '@SUM(A1:A2)'])('neutralizes spreadsheet formula input %s', (value) => {
    expect(safeCsvValue(value)).toMatch(/^"'/);
  });

  test('still escapes embedded quotes', () => {
    expect(safeCsvValue('Acme "North"')).toBe('"Acme ""North"""');
  });
});
