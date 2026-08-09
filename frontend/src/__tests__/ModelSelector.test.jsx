import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ModelSelector from '../pages/ModelSelector';

vi.mock('../utils/api', () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: { available: [] } })),
  },
}));

vi.mock('../context/ToastContext', () => ({
  useToast: () => ({ showToast: vi.fn() }),
  ToastProvider: ({ children }) => children,
}));

vi.mock('../components/Layout', () => ({
  default: ({ children }) => <div data-testid="layout">{children}</div>,
}));

describe('ModelSelector', () => {
  it('renders model selector page', () => {
    render(
      <BrowserRouter>
        <ModelSelector />
      </BrowserRouter>
    );
    expect(screen.getByText('AI Model Selector')).toBeInTheDocument();
  });
});
