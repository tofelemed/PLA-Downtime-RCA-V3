import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import type { ComponentType } from 'react';
import { renderInCase, stubAnalysesFetch } from './analysis-test-kit';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { FiveWhyTool } = await import('./tools/five-why/five-why-tool');
const { FishboneTool } = await import('./tools/fishbone/fishbone-tool');
const { FmeaTool } = await import('./tools/fmea/fmea-tool');
const { FaultTreeTool } = await import('./tools/fault-tree/fault-tree-tool');
const { BarrierTool } = await import('./tools/barrier/barrier-tool');
const { ChangeTool } = await import('./tools/change/change-tool');
const { LogicTreeTool } = await import('./tools/logic-tree/logic-tree-tool');
const { TimelineTool } = await import('./tools/timeline/timeline-tool');

/** No editable control may remain on a closed case: values are text, not disabled inputs. */
function expectNoControls() {
  expect(screen.queryAllByRole('textbox')).toHaveLength(0);
  expect(screen.queryAllByRole('combobox')).toHaveLength(0);
  expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  expect(document.querySelector('fieldset[disabled]')).toBeNull();
}

const RECORD_TOOLS: Array<[string, ComponentType, string, string[]]> = [
  ['5-Why', FiveWhyTool, 'five-why-tool', ['Extruder stopped for an hour', 'Gear teeth worn', 'ev-1 photographs', 'Inspection gap']],
  ['Fishbone', FishboneTool, 'fishbone-tool', ['Gearbox trip', 'Oil contaminated', 'High likelihood']],
  ['FMEA', FmeaTool, 'fmea-tool', ['Gearbox loses drive', 'Full stop', 'Trip alarm', 'Lubricant contamination', 'Oil sample', 'Set limits; Sample monthly']],
  ['Fault tree', FaultTreeTool, 'fault-tree-tool', ['Gearbox trip', 'Seal leak', 'Basic event', 'Top event']],
  ['Barrier', BarrierTool, 'barrier-tool', ['Contaminated oil', 'Oil sampling', 'Detection', 'Failed', 'Interval too long', 'Monthly sampling']],
  ['Change', ChangeTool, 'change-tool', ['What changed?', 'Breather replaced late', 'Equipment', 'High', 'Yes']],
];

describe('analysis tools on a closed case (read-only renders text)', () => {
  beforeEach(() => stubAnalysesFetch());
  afterEach(() => vi.unstubAllGlobals());

  it.each(RECORD_TOOLS)('%s shows its saved values as text, with no disabled inputs', async (_name, Tool, testId, values) => {
    renderInCase(<Tool />, true);
    const tool = await screen.findByTestId(testId);
    for (const value of values) expect(within(tool).getAllByText(value, { exact: false }).length).toBeGreaterThan(0);
    expectNoControls();
    expect(screen.queryByTestId('save-tool')).toBeNull();
  });

  it('5-Why steps are a numbered vertical stepper (Why 1 …) with answer and evidence', async () => {
    renderInCase(<FiveWhyTool />, true);
    const step = await screen.findByTestId('why-level');
    expect(step).toHaveTextContent('Why 1');
    expect(within(step).getByText('Answer (cause found)')).toBeInTheDocument();
    expect(within(step).getByText('Evidence / justification')).toBeInTheDocument();
  });

  it('5-Why "Copy report" still works on a closed case', async () => {
    renderInCase(<FiveWhyTool />, true);
    expect(await screen.findByRole('button', { name: /Copy report/ })).toBeEnabled();
  });

  it('FMEA is a compact table with the RPN in its own right-aligned column and the alert in words', async () => {
    renderInCase(<FmeaTool />, true);
    const causes = await screen.findByRole('table', { name: 'Causes' });
    const rpn = within(causes).getByRole('columnheader', { name: 'RPN' });
    expect(rpn.className).toContain('text-right');
    const cell = within(causes).getByTestId('fmea-rpn');
    expect(cell).toHaveTextContent('280');
    expect(cell.className).toContain('text-right');
    expect(within(causes).getByTestId('fmea-score')).toHaveTextContent('needs action');
    expect(within(screen.getByRole('table', { name: 'Effects' })).getByText('7')).toBeInTheDocument();
  });

  it('logic tree shows "Verified" as text, not a disabled checkbox', async () => {
    renderInCase(<LogicTreeTool />, true);
    const node = await screen.findByTestId('logic-node');
    expect(within(node).getByText('Verified')).toBeInTheDocument();
    expectNoControls();
  });

  it('timeline has no add / edit / delete on a closed case', async () => {
    renderInCase(<TimelineTool />, true);
    expect(await screen.findAllByTestId('timeline-entry')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /Add event/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Edit / })).toBeNull();
  });
});
