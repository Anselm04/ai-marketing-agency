import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LandingPage from '../pages/LandingPage';

describe('LandingPage', () => {
  it('renders marketing headline', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    );
    expect(screen.getAllByText(/AI Marketing Agency/i).length).toBeGreaterThan(0);
  });

  it('shows pricing tiers', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    );
    expect(screen.getAllByText(/Starter/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Growth/i).length).toBeGreaterThan(0);
  });
});
