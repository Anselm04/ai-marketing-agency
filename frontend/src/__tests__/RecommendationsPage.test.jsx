import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import RecommendationsPage from '../pages/RecommendationsPage';

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: [] })),
    post: vi.fn(() => Promise.resolve({ data: [{ id: '1', title: 'Test Campaign', description: 'Test desc', budget: 1000, platforms: ['Instagram'], timeline: '30 days', priority: 'high' }] })),
  },
}));

vi.mock('../components/Layout', () => ({
  default: ({ children }) => <div data-testid="layout">{children}</div>,
}));

describe('RecommendationsPage', () => {
  it('renders the recommendations page', async () => {
    render(
      <BrowserRouter>
        <RecommendationsPage />
      </BrowserRouter>
    );
    await waitFor(() => expect(screen.getByText('Campaign Recommendations')).toBeInTheDocument());
  });

  it('shows generate button and opens wizard', async () => {
    render(
      <BrowserRouter>
        <RecommendationsPage />
      </BrowserRouter>
    );
    const btn = await screen.findByText('Generate New');
    fireEvent.click(btn);
    expect(await screen.findByText('Campaign Wizard')).toBeInTheDocument();
    expect(await screen.findByText('Product Name')).toBeInTheDocument();
    expect(await screen.findByText('Budget ($)')).toBeInTheDocument();
  });
});
