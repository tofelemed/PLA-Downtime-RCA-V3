import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { KpiSection } from './kpi-section';
import { KpiTile, KpiTileRow } from './kpi-tile';

const spec = { title: 'Operational OEE', info: 'Share of scheduled time producing good output.' };

function renderTile(value: string | null) {
  return render(
    <MemoryRouter>
      <TooltipProvider>
        <KpiSection title="Overview" link={{ to: '/reports', label: 'Open report', testId: 'l' }}>
          <KpiTileRow>
            <KpiTile spec={spec} value={value} testId="t" />
          </KpiTileRow>
        </KpiSection>
      </TooltipProvider>
    </MemoryRouter>,
  );
}

describe('KpiTile', () => {
  it('wraps a long label to two lines instead of truncating it', () => {
    renderTile('1');
    const label = screen.getByText('Operational OEE');
    expect(label).toHaveClass('line-clamp-2');
    expect(label).not.toHaveClass('truncate');
  });

  it('lets a row take extra layout classes', () => {
    const { container } = render(<KpiTileRow className="xl:grid-cols-3">{null}</KpiTileRow>);
    expect(container.firstChild).toHaveClass('grid-cols-2', 'xl:grid-cols-3');
  });

  it('shows title and value, not the info text', () => {
    renderTile('82.1%');
    expect(screen.getByText('Operational OEE')).toBeInTheDocument();
    expect(screen.getByText('82.1%')).toBeInTheDocument();
    expect(screen.queryByText(spec.info)).not.toBeInTheDocument();
  });

  it('shows the info text when the info button is focused', async () => {
    renderTile('82.1%');
    await userEvent.tab();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'About Operational OEE' })).toHaveFocus();
    expect((await screen.findAllByText(spec.info)).length).toBeGreaterThan(0);
  });

  it('renders an em dash for a null value', () => {
    renderTile(null);
    expect(screen.getByTestId('t')).toHaveTextContent('—');
  });

  it('renders no change or previous-period line', () => {
    renderTile('82.1%');
    const text = screen.getByTestId('t').textContent ?? '';
    expect(text).not.toMatch(/▲|▼|prev\./);
  });

  it('renders the section as an h2 with its report link', () => {
    renderTile('1');
    expect(screen.getByRole('heading', { level: 2, name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByTestId('l')).toHaveAttribute('href', '/reports');
  });
});
