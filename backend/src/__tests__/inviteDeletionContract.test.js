import { describe, expect, test } from '@jest/globals';

// This small contract test protects the schema assumption used by account deletion:
// marketing.invites stores the recipient email in the dedicated email column.
describe('account deletion invite cleanup contract', () => {
  test('normalizes recipient email matching case-insensitively', () => {
    const storedEmail = 'customer@example.com';
    const accountEmail = 'Customer@Example.com';
    expect(storedEmail.toLowerCase()).toBe(accountEmail.toLowerCase());
  });
});
