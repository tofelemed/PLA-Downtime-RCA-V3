import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { CodeDetailView } from '@/api/v2/types/codes-admin';
import type { RuleView } from '@/api/v2/types/rules';
import { actAs } from '@/test/acting-user';
import { stubV2Fetch } from '@/test/v2-fetch';

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { CodesAdminPage } = await import('./codes-admin-page');
const { RuleNewPage } = await import('./rules/rule-new-page');
const { CodeMappingsTab } = await import('./codes/code-mappings-tab');
const { RuleActions } = await import('./rules/rule-actions');
const { RuleRollbackAction } = await import('./rules/rule-rollback-action');
const { CodeEditor } = await import('./codes/code-editor');

const show = (node: JSX.Element, path = '/master-data/codes-rules') =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="*" element={node} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

const MECH: CodeDetailView = {
  id: 'r1', library: 'reason', code: 'MECH', name: 'Mechanical', description: null, parentId: null, path: 'r1', level: 0, version: 1, rowVersion: 1,
  effectiveFrom: null, effectiveTo: null, active: true, defaults: { oeeComponent: null, scheduleClass: 'planned', impactCodeId: null },
};

const RULE: RuleView = {
  id: 'rule-1',
  kind: 'coding_default',
  name: 'Long stops are unplanned',
  description: null,
  priority: 10,
  state: 'active',
  activeVersion: 2,
  activeDefinition: null,
  draft: { definition: { when: { all: [] }, then: [] }, authorId: 'someone-else', updatedAt: null },
  appliedBy: 'server',
  rowVersion: 3,
  createdAt: '2026-10-01T00:00:00Z',
  createdBy: 'someone-else',
  retiredAt: null,
};

/** The dialog's buttons in DOM order (the footer reads Cancel, then the primary action on the right). */
const buttonNames = (dialog: HTMLElement) => within(dialog).getAllByRole('button').map((button) => button.textContent?.trim());

// Configuration cleanup (24 Oct 2026): Codes & rules — no header description, report cards with ⓘ, labelled h-9 filters
describe('Codes & rules cleanup', () => {
  beforeEach(() => {
    actAs('SuperAdmin');
    stubV2Fetch(() => undefined);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('the codes page has no description or timezone line and no cause-library note under the list', async () => {
    show(<CodesAdminPage />);
    expect(screen.queryByText(/Every change is kept as a version/)).toBeNull();
    expect(screen.queryByText(/Times in/)).toBeNull();
    expect(screen.queryByText(/Root causes for investigations/)).toBeNull();
    const card = await screen.findByTestId('code-library-card');
    expect(within(card).getByRole('heading', { level: 2, name: 'Reason codes' })).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'About Reason codes' })).toBeInTheDocument();
    expect(within(screen.getByRole('banner')).getByTestId('code-new')).toBeInTheDocument();
  });

  it('the code filters are one labelled row: Library, Search, Show retired', () => {
    show(<CodesAdminPage />);
    const filters = screen.getByTestId('code-library-filters');
    expect(filters.className).toContain('items-end');
    expect(within(filters).getByLabelText('Library')).toHaveClass('h-9');
    expect(within(filters).getByText('Search')).toBeInTheDocument();
    expect(within(filters).getByRole('searchbox', { name: 'Search codes' }).parentElement?.className).toContain('[&_input]:h-9');
    expect(within(filters).getByLabelText('Show retired')).toBeInTheDocument();
  });

  it('the Rules tab is a card with the activation rule behind its ⓘ and an own empty message', async () => {
    show(<CodesAdminPage />, '/master-data/codes-rules?tab=rules');
    const card = screen.getByTestId('rules-card');
    expect(within(card).getByRole('heading', { level: 2, name: 'Rules' })).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'About Rules' })).toBeInTheDocument();
    expect(await within(card).findByText('No rules yet.')).toBeInTheDocument();
    expect(screen.queryByText(/Rules become active only when/)).toBeNull();
    expect(screen.getByLabelText('State')).toHaveClass('h-9');
    expect(screen.getByLabelText('Kind')).toHaveClass('h-9');
  });

  it('New rule keeps no description paragraph; the activation rule is behind the title ⓘ', () => {
    show(<RuleNewPage />, '/master-data/codes-rules/rules/new');
    expect(screen.queryByText(/A new rule is saved as a draft/)).toBeNull();
    expect(screen.getByRole('button', { name: 'About new rules' })).toBeInTheDocument();
  });
});

describe('Codes & rules dialogs', () => {
  beforeEach(() => {
    actAs('SuperAdmin');
    stubV2Fetch(() => undefined);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('New code: ⓘ instead of a description, the Code field focused, Cancel then Create, h-9 fields, Esc closes', async () => {
    show(<CodesAdminPage />);
    fireEvent.click(screen.getByTestId('code-new'));
    const dialog = await screen.findByTestId('code-create-dialog');
    expect(within(dialog).getByRole('heading', { name: 'New reason code' })).toBeInTheDocument();
    expect(within(dialog).queryByText(/Codes are live as soon as/)).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'About new codes' })).toBeInTheDocument();
    await waitFor(() => expect(within(dialog).getByLabelText(/^Code/)).toHaveFocus());
    const names = buttonNames(dialog);
    expect(names.indexOf('Cancel')).toBeLessThan(names.indexOf('Create'));
    expect(within(dialog).getByRole('button', { name: 'Create' })).toHaveClass('h-9');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('code-create-dialog')).toBeNull());
  });

  it('Add default mapping: ⓘ in the title, Mapping focused, Cancel then Save as next version, Cancel closes', async () => {
    show(<CodeMappingsTab reasonId="reason-1" active />);
    expect(screen.getByRole('heading', { level: 2, name: 'Default mappings' })).toBeInTheDocument();
    expect(screen.queryByText(/Each save is the next version/)).toBeNull();
    fireEvent.click(screen.getByTestId('mapping-new'));
    const dialog = await screen.findByTestId('mapping-dialog');
    expect(within(dialog).getByRole('button', { name: 'About default mappings' })).toBeInTheDocument();
    expect(within(dialog).queryByText('Saved as the next version of this mapping.')).toBeNull();
    await waitFor(() => expect(within(dialog).getByLabelText('Mapping')).toHaveFocus());
    const names = buttonNames(dialog);
    expect(names.indexOf('Cancel')).toBeLessThan(names.indexOf('Save as next version'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByTestId('mapping-dialog')).toBeNull());
  });

  it('Activate draft and Restore version confirmations open with their verb and close on Esc', async () => {
    actAs('Manager', 'u2');
    show(
      <>
        <RuleActions rule={RULE} currentUserId="u2" />
        <RuleRollbackAction rule={RULE} version={1} />
      </>,
    );
    fireEvent.click(screen.getByTestId('rule-activate'));
    const activation = await screen.findByRole('alertdialog');
    expect(within(activation).getByRole('button', { name: 'Activate rule' })).toBeInTheDocument();
    fireEvent.keyDown(activation, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    fireEvent.click(screen.getByTestId('rule-rollback'));
    const rollback = await screen.findByRole('alertdialog', { name: 'Restore version 1?' });
    const names = buttonNames(rollback);
    expect(names.indexOf('Cancel')).toBeLessThan(names.indexOf('Restore version'));
  });
});

describe('Code details for readers', () => {
  beforeEach(() => stubV2Fetch(() => undefined));
  afterEach(() => vi.unstubAllGlobals());

  it('a viewer reads the code as text, not as disabled inputs', () => {
    actAs('viewer');
    show(<CodeEditor library="reason-codes" code={MECH} />);
    const facts = screen.getByTestId('code-facts');
    expect(within(facts).getByText('Mechanical')).toBeInTheDocument();
    expect(within(facts).getByText('Default schedule class')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByTestId('code-save')).toBeNull();
  });

  it('a writer keeps the editor, Cancel left of Save', () => {
    actAs('SuperAdmin');
    show(<CodeEditor library="reason-codes" code={MECH} />);
    expect(screen.getByLabelText('Name')).toHaveValue('Mechanical');
    const cancel = screen.getByTestId('code-cancel');
    expect(cancel.compareDocumentPosition(screen.getByTestId('code-save')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
