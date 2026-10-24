import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { DashboardHeader } from './dashboard-header';

const LABELS = ['24 h', '7 days', '30 days', '3 months', '6 months', '1 year'];

function renderHeader(orgOnly = false) {
  const onKey = vi.fn();
  render(
    <MemoryRouter>
      <DashboardHeader keyValue="7d" onKey={onKey} orgOnly={orgOnly} plantName="Marun" />
    </MemoryRouter>,
  );
  return onKey;
}

describe('DashboardHeader', () => {
  it('offers the six periods as one radio group and reports the chosen key', async () => {
    const onKey = renderHeader();
    const group = screen.getByRole('radiogroup', { name: 'Time period' });
    expect(within(group).getAllByRole('radio').map((radio) => radio.parentElement?.textContent)).toEqual(LABELS);
    expect(within(group).getByRole('radio', { name: '7 days' })).toBeChecked();
    await userEvent.click(within(group).getByText('3 months'));
    expect(onKey).toHaveBeenCalledWith('3m');
  });

  it('shows only the title: no "As of" line and no Provisional / Approved badge', () => {
    renderHeader();
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.queryByText(/^As of /)).toBeNull();
    expect(screen.queryByText(/Provisional|Approved/)).toBeNull();
    expect(screen.queryByTestId('dashboard-org-note')).toBeNull();
  });

  it('says which plant is shown when only an organisation is chosen', () => {
    renderHeader(true);
    expect(screen.getByTestId('dashboard-org-note')).toHaveTextContent('Showing Marun — organisation-wide figures are not available yet');
  });
});
