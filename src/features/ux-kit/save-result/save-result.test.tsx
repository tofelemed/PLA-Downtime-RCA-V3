import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { capabilitiesOf } from '@/features/auth/capabilities';
import { nextSetupLink } from './next-setup-link';
import { saveResultActions, type SaveResult } from './save-result';
import { SaveFailureFrame } from './save-failure-frame';
import { SaveResultDialog } from './save-result-dialog';
import { useSaveFeedback } from './use-save-feedback';

const toast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));

const RESULT: SaveResult = {
  title: 'Unit created',
  recordLabel: 'Extruder 3 (EXT-3)',
  message: 'It is saved.',
  viewPath: '/units/u3',
  viewLabel: 'View unit',
  listPath: '/units',
  listLabel: 'Production units',
  next: { label: 'Assets', path: '/assets' },
};

function showDialog(result: SaveResult, onClose = vi.fn(), at = '/units/new') {
  render(
    <MemoryRouter initialEntries={[at]}>
      <Routes>
        <Route path={at.split(/[?#]/)[0]} element={<SaveResultDialog result={result} onClose={onClose} />} />
        <Route path="*" element={<p>Moved on</p>} />
      </Routes>
    </MemoryRouter>,
  );
  return { dialog: screen.getByRole('dialog', { name: result.title }), onClose };
}

describe('saveResultActions', () => {
  it('orders View · Add another · Back · Next and makes Next the primary action', () => {
    const actions = saveResultActions({ ...RESULT, onAddAnother: vi.fn() });
    expect(actions.map((action) => action.label)).toEqual(['View unit', 'Add another', 'Back to Production units', 'Next: Assets']);
    expect(actions.filter((action) => action.primary).map((action) => action.id)).toEqual(['next']);
  });

  it('puts an own action last as the primary one; without Next, View is primary', () => {
    const own = saveResultActions({ ...RESULT, primaryAction: { label: 'Switch to Plant B', onSelect: vi.fn() } });
    expect(own.at(-1)).toMatchObject({ id: 'primary', primary: true });
    expect(own.find((action) => action.id === 'next')?.primary).toBe(false);
    const noNext = saveResultActions({ ...RESULT, next: null });
    expect(noNext.at(-1)).toMatchObject({ id: 'view', primary: true });
    expect(saveResultActions({ title: 'Saved', listPath: '/x', listLabel: 'X' })).toEqual([
      { id: 'list', label: 'Back to X', path: '/x', primary: true },
    ]);
  });

  it('drops "Back to …" when the list is the page already shown (hash ignored, search compared)', () => {
    const onAddAnother = vi.fn();
    const here = saveResultActions({ ...RESULT, listPath: '/units#top', next: null, viewPath: undefined, onAddAnother }, '/units');
    expect(here).toEqual([{ id: 'add-another', label: 'Add another', path: undefined, onSelect: onAddAnother, primary: true }]);
    expect(saveResultActions({ ...RESULT, listPath: '/units?tab=a' }, '/units?tab=b').some((a) => a.id === 'list')).toBe(true);
  });
});

describe('SaveResultDialog', () => {
  afterEach(() => toast.mockReset());

  it('names the record, links its actions and focuses the primary one', () => {
    const { dialog } = showDialog(RESULT);
    expect(within(dialog).getByText('Extruder 3 (EXT-3)')).toBeTruthy();
    expect(dialog.getAttribute('aria-describedby')).toBeTruthy();
    expect(within(dialog).getByRole('link', { name: 'View unit' }).getAttribute('href')).toBe('/units/u3');
    expect(within(dialog).getByRole('link', { name: 'Back to Production units' }).getAttribute('href')).toBe('/units');
    expect(document.activeElement).toBe(within(dialog).getByRole('link', { name: 'Next: Assets' }));
  });

  it('closes and navigates on a link, without counting it as a dismissal', () => {
    const onDismiss = vi.fn();
    const { dialog, onClose } = showDialog({ ...RESULT, onDismiss });
    fireEvent.click(within(dialog).getByRole('link', { name: 'Next: Assets' }));
    expect(screen.getByText('Moved on')).toBeTruthy();
    expect(onClose).toHaveBeenCalled();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('Esc keeps the user where they are and runs onDismiss', () => {
    const onDismiss = vi.fn();
    const { dialog, onClose } = showDialog({ ...RESULT, onDismiss });
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Moved on')).toBeNull();
  });

  it('shows no "Back to …" link on the list page itself', () => {
    const { dialog } = showDialog({ ...RESULT, viewPath: '/units#unit-u3' }, vi.fn(), '/units');
    expect(within(dialog).queryByRole('link', { name: 'Back to Production units' })).toBeNull();
    expect(within(dialog).getByRole('link', { name: 'View unit' })).toBeTruthy();
  });

  it('runs "Add another" and an own primary action as buttons', () => {
    const onAddAnother = vi.fn();
    const onSelect = vi.fn();
    const { dialog, onClose } = showDialog({ ...RESULT, onAddAnother, primaryAction: { label: 'Switch', onSelect } });
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Switch' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add another' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Switch' }));
    expect(onAddAnother).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe('useSaveFeedback', () => {
  const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter>{children}</MemoryRouter>;

  it('reports a small edit with a toast and a create with the result dialog', async () => {
    const { result } = renderHook(() => useSaveFeedback(), { wrapper });
    await act(() => result.current.run(async () => 1, 'Unit updated'));
    expect(toast).toHaveBeenCalledWith({ title: 'Unit updated' });
    render(<MemoryRouter>{result.current.dialog}</MemoryRouter>);
    expect(screen.queryByRole('dialog')).toBeNull();
    await act(() => result.current.run(async () => ({ id: 'u3' }), (saved) => ({ ...RESULT, viewPath: `/units/${saved.id}` })));
    render(<MemoryRouter>{result.current.dialog}</MemoryRouter>);
    expect(screen.getByRole('dialog', { name: 'Unit created' })).toBeTruthy();
  });

  it('keeps a failure for the red alert and rethrows it, without a toast', async () => {
    toast.mockReset();
    const { result } = renderHook(() => useSaveFeedback(), { wrapper });
    const refused = new Error('refused');
    await act(async () => {
      await expect(result.current.run(() => Promise.reject(refused), 'Saved')).rejects.toBe(refused);
    });
    expect(result.current.failure).toBe(refused);
    render(<>{result.current.alert}</>);
    expect(screen.getByTestId('save-failure-alert').querySelector('[role="alert"]')).toBeTruthy();
    expect(toast).not.toHaveBeenCalled();
    act(() => result.current.clearFailure());
    expect(result.current.failure).toBeNull();
  });
});

describe('SaveFailureFrame', () => {
  it('renders nothing without a failure; frames and focuses an own alert on a failure', () => {
    const { rerender } = render(<SaveFailureFrame failure={null}><p>Refused</p></SaveFailureFrame>);
    expect(screen.queryByTestId('save-failure-alert')).toBeNull();
    rerender(<SaveFailureFrame failure={new Error('x')}><p>Refused</p></SaveFailureFrame>);
    const frame = screen.getByTestId('save-failure-alert');
    expect(within(frame).getByText('Refused')).toBeTruthy();
    expect(document.activeElement).toBe(frame);
  });

  it('useSaveFeedback renders an own alert inside the frame', async () => {
    const { result } = renderHook(() => useSaveFeedback(undefined, () => <p>Own alert</p>), {
      wrapper: ({ children }: { children: ReactNode }) => <MemoryRouter>{children}</MemoryRouter>,
    });
    await act(async () => {
      await expect(result.current.run(() => Promise.reject(new Error('no')), 'Saved')).rejects.toThrow('no');
    });
    render(<>{result.current.alert}</>);
    expect(within(screen.getByTestId('save-failure-alert')).getByText('Own alert')).toBeTruthy();
  });
});

describe('nextSetupLink', () => {
  it('follows the Setup guide order: plants → units → assets → products → codes → stop policy', () => {
    expect(nextSetupLink('/setup/plants/new')).toEqual({ label: 'Production units', path: '/master-data/units' });
    expect(nextSetupLink('/master-data/units/new')).toEqual({ label: 'Assets', path: '/master-data/assets' });
    expect(nextSetupLink('/master-data/assets')?.label).toBe('Products');
    expect(nextSetupLink('/master-data/products/p1')?.label).toBe('Codes & rules');
    expect(nextSetupLink('/master-data/codes-rules?tab=rules')?.path).toBe('/master-data/stop-policy');
  });

  it('keeps the unit on unit-scoped pages and treats related pages as their step', () => {
    expect(nextSetupLink('/master-data/codes-rules', { unitId: 'u 1' })).toEqual({ label: 'Stop and plan policy', path: '/master-data/stop-policy?unitId=u%201' });
    expect(nextSetupLink('/master-data/failure-dictionary')?.path).toBe('/master-data/stop-policy');
    expect(nextSetupLink('/master-data/hierarchy')?.label).toBe('Products');
  });

  it('treats the CSV import sub-pages as part of their list page (SETUP_UX_FIXES Phase 4)', () => {
    expect(nextSetupLink('/master-data/failure-dictionary/import')).toEqual(nextSetupLink('/master-data/failure-dictionary'));
    expect(nextSetupLink('/master-data/standby-equipment/import')).toEqual(nextSetupLink('/master-data/standby-equipment'));
    expect(nextSetupLink('/master-data/standby-equipment/import')).not.toBeNull();
  });

  it('skips steps on the same page and pages the user cannot open', () => {
    expect(nextSetupLink('/connectivity')?.path).toBe('/master-data/unit-state');
    const analyst = { ...capabilitiesOf([]), canViewAnalysis: true };
    expect(nextSetupLink('/master-data/codes-rules', { capabilities: analyst })?.path).toBe('/setup/calendars');
  });

  it('falls back to the master-data group outside the guide; null at the end', () => {
    expect(nextSetupLink('/master-data/rca/templates/new')).toEqual({ label: 'Cause library', path: '/master-data/rca/causes' });
    expect(nextSetupLink('/master-data/rca/checklists')).toBeNull();
    expect(nextSetupLink('/downtime')).toBeNull();
    expect(nextSetupLink('/nowhere')).toBeNull();
  });
});
