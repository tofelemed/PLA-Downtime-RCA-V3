import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { KIT_CASE, renderInCase, stubAnalysesFetch } from './analysis-test-kit';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { AddCauseDialog } = await import('./tools/fishbone/add-cause-dialog');
const { NodeDialog } = await import('./tools/logic-tree/node-dialog');
const { EventDialog } = await import('./tools/event-diagram/event-dialog');
const { ConnectionDialog } = await import('./tools/event-diagram/connection-dialog');
const { EvidenceLinkPopover } = await import('./tools/evidence-link-popover');
const { FiveWhyTool } = await import('./tools/five-why/five-why-tool');
const { FishboneTool } = await import('./tools/fishbone/fishbone-tool');
const { LogicTreeTool } = await import('./tools/logic-tree/logic-tree-tool');
const { TimelineTool } = await import('./tools/timeline/timeline-tool');
const { EventDiagramTool } = await import('./tools/event-diagram/event-diagram-tool');
const { DiagramToolbar } = await import('./tools/event-diagram/diagram-toolbar');

const postsOf = () => vi.mocked(globalThis.fetch).mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'POST');

/** Cancel sits left of the primary action in the footer, both h-9. */
function expectFooter(dialog: HTMLElement, primary: string) {
  const cancel = within(dialog).getByRole('button', { name: 'Cancel' });
  const submit = within(dialog).getByRole('button', { name: primary });
  expect(cancel.compareDocumentPosition(submit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(submit).toHaveAttribute('type', 'submit');
  expect(cancel.className).toContain('h-9');
  expect(submit.className).toContain('h-9');
  return { cancel, submit };
}

describe('analysis dialogs: title, labelled fields, Cancel / primary, Esc', () => {
  beforeEach(() => stubAnalysesFetch());
  afterEach(() => vi.unstubAllGlobals());

  it('Add cause (fishbone): md dialog, category line, ⓘ instead of the example paragraph, error under the field', async () => {
    const onAdd = vi.fn();
    const onClose = vi.fn();
    renderInCase(<AddCauseDialog category="Material" onAdd={onAdd} onClose={onClose} />, false);
    const dialog = screen.getByRole('dialog', { name: 'Add cause' });
    expect(dialog.className).toContain('sm:max-w-[560px]');
    expect(dialog).toHaveTextContent('Category: Material');
    expect(screen.queryByText(/Lubrication interval too long/)).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'About Add cause' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText(/^Cause/)).toHaveFocus());
    expect(screen.getByLabelText(/^Cause/)).toHaveAttribute('rows', '3');
    expect(screen.getByLabelText('Likelihood')).toBeInTheDocument();
    expect(screen.getByLabelText('Primary cause (a major contributor)')).toBeInTheDocument();
    const { submit } = expectFooter(dialog, 'Add cause');
    fireEvent.click(submit);
    expect(screen.getByTestId('field-error-cause-description')).toHaveTextContent('Describe the cause.');
    expect(onAdd).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/^Cause/), { target: { value: ' Breather late ' } });
    fireEvent.click(submit);
    expect(onAdd).toHaveBeenCalledWith({ description: 'Breather late', likelihood: 'Medium', isPrimary: false });
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('Logic-tree node: lg dialog keeps #node-label and save-node; Enter in the name submits', async () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    renderInCase(<NodeDialog title="Add a top-level node" onSave={onSave} onClose={onClose} />, false);
    const dialog = screen.getByRole('dialog', { name: 'Add a top-level node' });
    expect(dialog.className).toContain('sm:max-w-[720px]');
    expect(screen.queryByText(/A failure, mode, hypothesis/)).toBeNull();
    await waitFor(() => expect(dialog.querySelector('#node-label')).toHaveFocus());
    for (const label of [/^Name/, 'Code', 'Category', 'Analysis / finding', 'Note']) expect(within(dialog).getByLabelText(label)).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Note')).toHaveAttribute('rows', '3');
    expect(within(dialog).getByLabelText('Code').className).toContain('h-9');
    const { submit } = expectFooter(dialog, 'Save node');
    expect(submit).toHaveAttribute('data-testid', 'save-node');
    fireEvent.submit(dialog.querySelector('form') as HTMLFormElement);
    expect(screen.getByTestId('field-error-node-label')).toHaveTextContent('Enter a name.');
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByLabelText(/^Name/), { target: { value: 'Pump trips' } });
    fireEvent.submit(dialog.querySelector('form') as HTMLFormElement);
    expect(onSave).toHaveBeenCalledWith({ label: 'Pump trips', code: null, kind: 'Equipment', description: null, notes: null });
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('Event (diagram / timeline): lg dialog with labelled fields and an error under "What happened"', async () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    renderInCase(<EventDialog title="Add event" onSave={onSave} onClose={onClose} />, false);
    const dialog = screen.getByRole('dialog', { name: 'Add event' });
    expect(dialog.className).toContain('sm:max-w-[720px]');
    await waitFor(() => expect(within(dialog).getByLabelText(/^What happened/)).toHaveFocus());
    for (const label of ['Kind', 'Severity', 'Asset or unit', 'Description']) expect(within(dialog).getByLabelText(label)).toBeInTheDocument();
    expect(within(dialog).getByText('When')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('When date').className).toContain('h-9');
    expect(within(dialog).getByLabelText('When time').className).toContain('h-9');
    const { submit, cancel } = expectFooter(dialog, 'Save event');
    fireEvent.click(submit);
    expect(screen.getByTestId('field-error-event-label')).toHaveTextContent('Describe what happened.');
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.click(cancel);
    expect(onClose).toHaveBeenCalled();
  });

  it('Add connection: md dialog, two labelled selects, the refusal under the field, Esc closes', () => {
    const node = (id: string, label: string) => ({ id, label, type: null, timestamp: null, description: null, asset: null, severity: null, position: { x: 0, y: 0 } });
    const onClose = vi.fn();
    renderInCase(<ConnectionDialog diagram={{ nodes: [node('n1', 'Alarm'), node('n2', 'Trip')], edges: [] }} onAdd={vi.fn()} onClose={onClose} />, false);
    const dialog = screen.getByRole('dialog', { name: 'Add connection' });
    expect(dialog.className).toContain('sm:max-w-[560px]');
    expect(screen.queryByText('Connect a cause to the event it led to.')).toBeNull();
    expect(within(dialog).getByLabelText(/From \(cause\)/).className).toContain('h-9');
    const { submit } = expectFooter(dialog, 'Add connection');
    expect(submit).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText(/From \(cause\)/), { target: { value: 'n1' } });
    fireEvent.change(within(dialog).getByLabelText(/To \(effect\)/), { target: { value: 'n1' } });
    expect(screen.getByTestId('field-error-connection-to')).toHaveTextContent('Choose two different events.');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('Evidence link popover: titled dialog with a labelled checkbox per item; Esc closes', async () => {
    renderInCase(<EvidenceLinkPopover targetId="ln-1" targetName="Gearbox trips" evidence={KIT_CASE.evidence} onToggle={vi.fn()} />, false);
    fireEvent.click(screen.getByRole('button', { name: 'Link evidence to Gearbox trips' }));
    const popover = await screen.findByRole('dialog', { name: 'Evidence supporting Gearbox trips' });
    expect(within(popover).getByRole('checkbox', { name: /Oil sample/ })).toBeChecked();
    fireEvent.keyDown(popover, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('fishbone "Add cause" opens the dialog for its category', async () => {
    renderInCase(<FishboneTool />, false);
    fireEvent.click(await screen.findByRole('button', { name: 'Add cause to Material' }));
    expect(screen.getByRole('dialog', { name: 'Add cause' })).toHaveTextContent('Category: Material');
  });

  it('logic tree: add, edit and delete open their dialogs; the delete confirm is destructive and Esc closes it', async () => {
    renderInCase(<LogicTreeTool />, false);
    fireEvent.click(screen.getByTestId('add-root-node'));
    expect(screen.getByRole('dialog', { name: 'Add a top-level node' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit Gearbox trips' }));
    expect((screen.getByLabelText(/^Name/) as HTMLInputElement).value).toBe('Gearbox trips');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Gearbox trips' }));
    const confirm = await screen.findByRole('alertdialog', { name: 'Delete "Gearbox trips"?' });
    expect(within(confirm).getByRole('button', { name: 'Delete node' })).toBeInTheDocument();
    expect(within(confirm).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    fireEvent.keyDown(confirm, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  });

  it('logic tree "Reset to template": destructive confirm, Cancel focused and keeps the tree; confirming posts the reset', async () => {
    renderInCase(<LogicTreeTool />, false, { ...KIT_CASE, status: 'Analysis', templateId: 'tpl-1' });
    fireEvent.click(screen.getByRole('button', { name: 'Reset to template' }));
    const confirm = await screen.findByRole('alertdialog', { name: 'Reset the logic tree to its template?' });
    expect(within(confirm).getByRole('button', { name: 'Reset logic tree' }).className).toMatch(/destructive/);
    await waitFor(() => expect(within(confirm).getByRole('button', { name: 'Cancel' })).toHaveFocus());
    fireEvent.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(postsOf()).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Reset to template' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Reset logic tree' }));
    await waitFor(() => expect(postsOf()).toHaveLength(1));
    expect(new URL(String(postsOf()[0][0])).pathname).toBe('/api/v2/rcas/c1/logic-tree/reset');
  });

  it('logic tree: no "Reset to template" without a template', () => {
    renderInCase(<LogicTreeTool />, false, { ...KIT_CASE, status: 'Analysis' });
    expect(screen.queryByRole('button', { name: 'Reset to template' })).toBeNull();
  });

  it('event diagram "Delete selected event": disabled without a selection; the destructive confirm names the event and deletes only on confirm', async () => {
    const onDelete = vi.fn();
    const props = { eventCount: 2, onAdd: vi.fn(), onConnect: vi.fn(), onEdit: vi.fn(), onDelete };
    const view = renderInCase(<DiagramToolbar {...props} selected={undefined} />, false);
    expect(screen.getByRole('button', { name: 'Delete selected event' })).toBeDisabled();
    view.unmount();
    renderInCase(<DiagramToolbar {...props} selected={KIT_CASE.eventDiagram.nodes[0]} />, false);
    fireEvent.click(screen.getByRole('button', { name: 'Delete selected event' }));
    const confirm = await screen.findByRole('alertdialog', { name: 'Delete "Trip alarm"?' });
    expect(within(confirm).getByRole('button', { name: 'Delete event' }).className).toMatch(/destructive/);
    fireEvent.keyDown(confirm, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Delete selected event' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete event' }));
    expect(onDelete).toHaveBeenCalledWith('event-1');
  });

  it('timeline: add / edit open the event dialog; delete is confirmed', async () => {
    renderInCase(<TimelineTool />, false);
    fireEvent.click(screen.getByRole('button', { name: /Add event/ }));
    expect(screen.getByRole('dialog', { name: 'Add event' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit Trip alarm' }));
    expect(screen.getByRole('dialog', { name: 'Edit event' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Trip alarm' }));
    expect(await screen.findByRole('alertdialog', { name: 'Delete "Trip alarm"?' })).toBeInTheDocument();
  });

  it('event diagram: the toolbar (h-9, icon + words) opens add and connect; the legend explains the badge colours', async () => {
    renderInCase(<EventDiagramTool />, false);
    expect(screen.getByTestId('add-event').className).toContain('h-9');
    expect(screen.getByTestId('diagram-legend')).toHaveTextContent('High or critical severity');
    fireEvent.click(screen.getByTestId('add-connection'));
    expect(screen.getByRole('dialog', { name: 'Add connection' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByTestId('add-event'));
    expect(screen.getByRole('dialog', { name: 'Add event' })).toBeInTheDocument();
  });

  it('5-Why: "Use the last answer" is an h-9 button that copies the last answer to the root cause', async () => {
    renderInCase(<FiveWhyTool />, false, { ...KIT_CASE, status: 'Analysis' });
    const use = await screen.findByRole('button', { name: 'Use the last answer' });
    expect(use.className).toMatch(/(^| )h-9( |$)/);
    fireEvent.click(use);
    expect(screen.getByLabelText('Root cause')).toHaveValue('Gear teeth worn');
  });

  it('5-Why: removing a filled step asks first in a destructive confirm', async () => {
    renderInCase(<FiveWhyTool />, false);
    fireEvent.click(await screen.findByRole('button', { name: 'Ask another why' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove why 1' }));
    const confirm = await screen.findByRole('alertdialog', { name: 'Remove why 1?' });
    expect(within(confirm).getByRole('button', { name: 'Remove level' })).toBeInTheDocument();
    fireEvent.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  });
});
