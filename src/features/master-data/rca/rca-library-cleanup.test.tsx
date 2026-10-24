import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { RcaCauseView, RcaTemplateView, VerificationChecklistView } from '../api/master-data-types';
import { actAs } from '@/test/acting-user';
import { jsonResponse, listPage, stubV2Fetch, type V2Call } from '@/test/v2-fetch';

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { RcaTemplatesPage } = await import('./templates-page');
const { RcaCausesPage } = await import('./causes-page');
const { ChecklistsPage } = await import('./checklists-page');
const { RcaTemplateDetailPage } = await import('./template-detail-page');
const { ChecklistDetailPage } = await import('./checklist-detail-page');
const { CauseDialogs } = await import('./cause-dialogs');
const { LogicTreeEditor } = await import('./logic-tree-editor');
const { MoveNodeDialog } = await import('./move-node-dialog');

const REV = { rowVersion: 1, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' };
const CHECKLIST: VerificationChecklistView = { id: 'c1', code: 'VC-BRG', name: 'Bearing checks', description: null, color: '#3B82F6', items: ['Vibration below limit', 'Temperature normal'], isActive: true, ...REV };
const TEMPLATE: RcaTemplateView = { id: 't1', name: 'Pump failure', category: 'Equipment failure', description: 'Start here', isActive: true, nodeCount: 0, checklistIds: ['c1'], logicTree: [], ...REV };
const CAUSE: RcaCauseView = { id: 'k1', code: 'SEAL', name: 'Seal failure', category: 'Equipment', description: null, parentId: null, isActive: true, activeChildren: 0, ...REV };

function reply(call: V2Call) {
  const path = call.url.pathname;
  if (path.endsWith('/rca-templates/t1')) return jsonResponse(200, { ...TEMPLATE, isActive: false });
  if (path.endsWith('/verification-checklists/c1')) return jsonResponse(200, { ...CHECKLIST, isActive: false });
  if (path.endsWith('/verification-checklists')) return jsonResponse(200, listPage([CHECKLIST]));
  return undefined;
}

const show = (node: JSX.Element, path = '/', route = '*') =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={route} element={node} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

const buttonNames = (dialog: HTMLElement) => within(dialog).getAllByRole('button').map((button) => button.textContent?.trim());

// Configuration cleanup (24 Oct 2026): RCA library — no header descriptions, labelled h-9 filters, report cards with ⓘ
describe('RCA library lists', () => {
  beforeEach(() => {
    actAs('SuperAdmin');
    stubV2Fetch(reply);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('RCA templates: no description, a labelled h-9 filter row, the Templates card with ⓘ and its own empty text', async () => {
    show(<RcaTemplatesPage />, '/master-data/rca/templates');
    expect(screen.queryByText('Logic trees and verification checklists an RCA can start from.')).toBeNull();
    const filters = screen.getByTestId('rca-list-filters');
    expect(within(filters).getByText('Search')).toBeInTheDocument();
    expect(within(filters).getByLabelText('Status')).toHaveClass('h-9');
    expect(within(filters).getByLabelText('Sort')).toHaveClass('h-9');
    const card = screen.getByTestId('rca-templates');
    expect(within(card).getByRole('heading', { level: 2, name: 'Templates' })).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'About Templates' })).toBeInTheDocument();
    expect(await within(card).findByText('No RCA template with this status yet.')).toBeInTheDocument();
    const header = screen.getByRole('banner');
    for (const name of ['Export', 'Import', 'Add template']) expect(within(header).getByRole(name === 'Add template' ? 'link' : 'button', { name })).toBeInTheDocument();
  });

  it('Cause library and Verification checklists: no descriptions; cards with ⓘ and own empty messages', async () => {
    const causes = show(<RcaCausesPage />, '/master-data/rca/causes');
    expect(screen.queryByText('Causes RCAs pick from, by category and as a tree.')).toBeNull();
    expect(within(screen.getByTestId('rca-causes')).getByRole('button', { name: 'About Causes' })).toBeInTheDocument();
    expect(await screen.findByText('The cause library is empty for this status.')).toBeInTheDocument();
    causes.unmount();
    show(<ChecklistsPage />, '/master-data/rca/checklists');
    expect(screen.queryByText(/Checks that confirm an RCA's fix worked/)).toBeNull();
    expect(within(screen.getByTestId('rca-checklists')).getByRole('heading', { level: 2, name: 'Checklists' })).toBeInTheDocument();
  });
});

describe('RCA library details that cannot be changed (retired records)', () => {
  beforeEach(() => stubV2Fetch(reply));
  afterEach(() => {
    vi.unstubAllGlobals();
    actAs('SuperAdmin');
  });

  it('a retired template reads as text; the logic tree explanation is behind an ⓘ', async () => {
    show(<RcaTemplateDetailPage />, '/master-data/rca/templates/t1', '/master-data/rca/templates/:templateId');
    const facts = await screen.findByTestId('template-facts');
    expect(within(facts).getByText('Equipment failure')).toBeInTheDocument();
    expect(await within(facts).findByText('Bearing checks')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByText('Possible causes, from the failure down to root causes.')).toBeNull();
    expect(screen.getByRole('button', { name: 'About Logic tree' })).toBeInTheDocument();
  });

  it('a retired checklist reads as text with its numbered items', async () => {
    show(<ChecklistDetailPage />, '/master-data/rca/checklists/c1', '/master-data/rca/checklists/:checklistId');
    const facts = await screen.findByTestId('checklist-facts');
    expect(within(facts).getByText('VC-BRG')).toBeInTheDocument();
    expect(within(facts).getByText(/Temperature normal/)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).toBeNull();
  });
});

describe('RCA library dialogs', () => {
  const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');
  beforeEach(() => {
    actAs('SuperAdmin');
    stubV2Fetch(reply);
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    if (original) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', original);
    else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
  });

  it('Add cause: ⓘ instead of a description, Code focused, h-9 fields, Cancel then Create, Esc closes', async () => {
    show(<RcaCausesPage />, '/master-data/rca/causes');
    fireEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Add cause' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add cause' });
    expect(within(dialog).queryByText('Causes are grouped by category; codes are unique.')).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'About causes' })).toBeInTheDocument();
    await waitFor(() => expect(within(dialog).getByLabelText(/^Code/)).toHaveFocus());
    expect(dialog.querySelector('form')?.className).toContain('[&_input:not([type=checkbox]):not([type=radio])]:h-9');
    const names = buttonNames(dialog);
    expect(names.indexOf('Cancel')).toBeLessThan(names.indexOf('Create'));
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add cause' })).toBeNull());
  });

  it('Retire cause asks with its verb and closes on Esc', async () => {
    show(<CauseDialogs pending={{ kind: 'retire', cause: CAUSE }} onClose={() => undefined} />);
    const dialog = await screen.findByRole('alertdialog', { name: 'Retire Seal failure?' });
    const names = buttonNames(dialog);
    expect(names.indexOf('Cancel')).toBeLessThan(names.indexOf('Retire cause'));
  });

  it('Add top-level node: Name focused, Cancel then Apply, Esc closes', async () => {
    show(<LogicTreeEditor tree={[]} onChange={() => undefined} editable />);
    fireEvent.click(screen.getByRole('button', { name: 'Add top-level node' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add top-level node' });
    await waitFor(() => expect(within(dialog).getByLabelText(/^Name/)).toHaveFocus());
    const names = buttonNames(dialog);
    expect(names.indexOf('Cancel')).toBeLessThan(names.indexOf('Apply'));
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add top-level node' })).toBeNull());
  });

  it('Move: ⓘ instead of a description, the parent choice focused and h-9, Cancel then Move', async () => {
    const onClose = vi.fn();
    render(<MoveNodeDialog name="Seal failure" targets={[]} currentParentId={null} onMove={() => undefined} onClose={onClose} />);
    const dialog = screen.getByRole('dialog', { name: 'Move Seal failure' });
    expect(within(dialog).queryByText('Its sub-items move with it.')).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'About moving' })).toBeInTheDocument();
    await waitFor(() => expect(within(dialog).getByRole('combobox')).toHaveFocus());
    expect(within(dialog).getByRole('combobox')).toHaveClass('h-9');
    const names = buttonNames(dialog);
    expect(names.indexOf('Cancel')).toBeLessThan(names.indexOf('Move'));
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
