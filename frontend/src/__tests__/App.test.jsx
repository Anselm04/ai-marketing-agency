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

  it('shows pricing tiers and library', () => {
    render(wrap(<LandingPage />));
    expect(screen.getAllByText(/Starter/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Quick Tasks/i)).toBeInTheDocument();
    expect(screen.getByText(/Orb Catch/i)).toBeInTheDocument();
    expect(screen.getByText(/Brief Agent/i)).toBeInTheDocument();
    expect(screen.getByText(/CaseCount/i)).toBeInTheDocument();
    expect(screen.getByText(/Quick Notes/i)).toBeInTheDocument();
    expect(screen.getByText(/Northstar Waitlist/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Growth/i).length).toBeGreaterThan(0);
  });
});
