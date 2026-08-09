import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import IntegrationHub from '../pages/IntegrationHub';

vi.mock('../utils/api', () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: { all: [], categories: [] } })),
    post: vi.fn(() => Promise.resolve({ data: { connected: true } })),
  },
}));

vi.mock('../context/ToastContext', () => ({
  useToast: () => ({ showToast: vi.fn() }),
  ToastProvider: ({ children }) => children,
}));

vi.mock('../components/Layout', () => ({
  default: ({ children }) => <div data-testid="layout">{children}</div>,
}));

describe('IntegrationHub', () => {
  it('renders integration hub page', () => {
    render(
      <BrowserRouter>
        <IntegrationHub />
      </BrowserRouter>
    );
    expect(screen.getByText('Integration Hub')).toBeInTheDocument();
  });
});
