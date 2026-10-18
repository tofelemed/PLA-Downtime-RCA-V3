import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import NotFound from './NotFound';

describe('NotFound', () => {
  it('names the missing path, titles the tab and links back in-app', () => {
    render(
      <MemoryRouter initialEntries={['/downtime-analysis']}>
        <NotFound />
      </MemoryRouter>,
    );
    expect(screen.getByText('/downtime-analysis')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to the dashboard' })).toHaveAttribute('href', '/dashboard');
    expect(document.title).toBe('Page not found · Traverse Forge');
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('inside the app shell it renders no second main landmark', () => {
    render(
      <MemoryRouter initialEntries={['/nowhere']}>
        <NotFound embedded />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: '404' })).toBeInTheDocument();
    expect(screen.queryByRole('main')).toBeNull();
  });
});
