import { describe, it, expect } from 'vitest';
import api from '../services/api';

describe('API Service', () => {
  it('is defined and has HTTP methods', () => {
    expect(api).toBeDefined();
    expect(typeof api.get).toBe('function');
    expect(typeof api.post).toBe('function');
    expect(typeof api.patch).toBe('function');
    expect(typeof api.delete).toBe('function');
    expect(typeof api.put).toBe('function');
  });
});
