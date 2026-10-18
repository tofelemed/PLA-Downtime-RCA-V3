import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { BrowserRouter, Link, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_UNSAVED_MESSAGE, useUnsavedChangesGuard, valuesDiffer } from './use-unsaved-changes-guard';

function Form() {
  const [name, setName] = useState('');
  useUnsavedChangesGuard(valuesDiffer({ name }, { name: '' }));
  return (
    <div>
      <label htmlFor="name">Name</label>
      <input id="name" value={name} onChange={(event) => setName(event.target.value)} />
      <Link to="/elsewhere">Leave</Link>
    </div>
  );
}

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

const renderInMemory = () =>
  render(
    <MemoryRouter initialEntries={['/form']}>
      <Where />
      <Routes>
        <Route path="/form" element={<Form />} />
        <Route path="/elsewhere" element={<p>Elsewhere</p>} />
      </Routes>
    </MemoryRouter>,
  );

describe('useUnsavedChangesGuard', () => {
  afterEach(() => vi.restoreAllMocks());

  it('a clean form leaves without asking', async () => {
    const confirm = vi.spyOn(window, 'confirm');
    renderInMemory();
    await userEvent.click(screen.getByRole('link', { name: 'Leave' }));
    expect(confirm).not.toHaveBeenCalled();
    expect(screen.getByTestId('where')).toHaveTextContent('/elsewhere');
  });

  it('a dirty form asks before an in-app link; declining stays, accepting leaves', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    renderInMemory();
    await userEvent.type(screen.getByLabelText('Name'), 'Pump 7');
    await userEvent.click(screen.getByRole('link', { name: 'Leave' }));
    expect(confirm).toHaveBeenCalledWith(DEFAULT_UNSAVED_MESSAGE);
    expect(screen.getByTestId('where')).toHaveTextContent('/form');
    expect(screen.getByLabelText('Name')).toHaveValue('Pump 7');
    await userEvent.click(screen.getByRole('link', { name: 'Leave' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/elsewhere');
  });

  it('modified clicks (new tab) are left to the browser', async () => {
    const confirm = vi.spyOn(window, 'confirm');
    renderInMemory();
    await userEvent.type(screen.getByLabelText('Name'), 'x');
    fireEvent.click(screen.getByRole('link', { name: 'Leave' }), { ctrlKey: true });
    expect(confirm).not.toHaveBeenCalled();
  });

  it('a dirty form asks the browser before the tab closes or reloads', async () => {
    renderInMemory();
    const clean = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
    await userEvent.type(screen.getByLabelText('Name'), 'x');
    const dirty = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
  });

  it('back button: a declined prompt keeps the page and steps history forward again', async () => {
    window.history.replaceState({ usr: null, key: 'start', idx: 0 }, '', '/start');
    render(
      <BrowserRouter>
        <Where />
        <Routes>
          <Route path="/start" element={<Link to="/form">Open form</Link>} />
          <Route path="/form" element={<Form />} />
        </Routes>
      </BrowserRouter>,
    );
    await userEvent.click(screen.getByRole('link', { name: 'Open form' }));
    await userEvent.type(screen.getByLabelText('Name'), 'x');
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const go = vi.spyOn(window.history, 'go').mockImplementation(() => undefined);
    act(() => {
      window.history.replaceState({ usr: null, key: 'start', idx: 0 }, '', '/start');
      window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
    });
    expect(confirm).toHaveBeenCalled();
    expect(go).toHaveBeenCalledWith(1);
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/form'));
    expect(screen.getByLabelText('Name')).toHaveValue('x');
  });
});
