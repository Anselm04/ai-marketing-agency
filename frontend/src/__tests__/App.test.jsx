import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LandingPage from '../pages/LandingPage';
import { ThemeProvider } from '../context/ThemeContext';
import { LanguageProvider } from '../context/LanguageContext';

function wrap(ui) {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <MemoryRouter>{ui}</MemoryRouter>
      </LanguageProvider>
    </ThemeProvider>
  );
}

describe('LandingPage', () => {
  it('renders marketing headline', () => {
    render(wrap(<LandingPage />));
    expect(screen.getAllByText(/TrillionAI/i).length).toBeGreaterThan(0);
  });

  it('shows Marketing plans and excludes the retired unrelated app library', () => {
    render(wrap(<LandingPage />));
    expect(screen.getAllByText(/Starter/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: /Choose the workload your business needs/i })).toBeInTheDocument();
    expect(screen.getByText(/Plans are currently single-user workspaces/i)).toBeInTheDocument();
    for (const title of ['Quick Tasks', 'Orb Catch', 'Brief Agent', 'CaseCount', 'Quick Notes', 'Northstar Waitlist']) {
      expect(screen.queryByText(title)).not.toBeInTheDocument();
    }
    expect(screen.getAllByText(/Growth/i).length).toBeGreaterThan(0);
  });
});

