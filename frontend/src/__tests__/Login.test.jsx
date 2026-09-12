import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from '../pages/Login';
import { LanguageProvider } from '../context/LanguageContext';

describe('Login', () => {
  it('renders login form elements', () => {
    render(
      <LanguageProvider>
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      </LanguageProvider>,
    );
    expect(screen.getByPlaceholderText(/you@company.com/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/••••••••/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign in/i })).toBeInTheDocument();
  });
});
