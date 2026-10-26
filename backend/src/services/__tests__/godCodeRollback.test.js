import { beforeEach, describe, expect, jest, test } from '@jest/globals';

const updateGodCode = jest.fn();
const store = { updateGodCode };

jest.unstable_mockModule('../../utils/store.js', () => ({ default: store }));
jest.unstable_mockModule('../../utils/logger.js', () => ({ logger: { error: jest.fn(), warn: jest.fn() } }));
jest.unstable_mockModule('../billingPersistence.js', () => ({ grantUserCredits: jest.fn() }));

const { restoreConsumedGodCode } = await import('../godCodeService.js');

beforeEach(() => {
  updateGodCode.mockReset();
});

describe('god-code consumption rollback', () => {
  test('restores only a code consumed by the same user', async () => {
    updateGodCode.mockResolvedValueOnce({ id: 'code-1', isUsed: false });

    const restored = await restoreConsumedGodCode(
      { hash: 'hash-1', encryptedCode: 'ciphertext' },
      { id: 'code-1', redeemedByUserId: 'user-1', usedByUserId: 'user-1' },
      'user-1',
    );

    expect(restored).toBe(true);
    expect(updateGodCode).toHaveBeenCalledWith('code-1', {
      encryptedCode: 'ciphertext',
      redeemedAt: null,
      redeemedByUserId: null,
      isUsed: false,
      usedAt: null,
      usedByUserId: null,
    });
  });

  test('will not restore a code consumed by another user', async () => {
    const restored = await restoreConsumedGodCode(
      { hash: 'hash-1', encryptedCode: 'ciphertext' },
      { id: 'code-1', redeemedByUserId: 'user-2', usedByUserId: 'user-2' },
      'user-1',
    );

    expect(restored).toBe(false);
    expect(updateGodCode).not.toHaveBeenCalled();
  });
});
