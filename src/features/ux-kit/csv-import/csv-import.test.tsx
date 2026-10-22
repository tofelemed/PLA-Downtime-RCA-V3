import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { V2ApiError } from '@/api/v2/errors';
import { CsvImportForm, csvTemplateText, importBlockedReason, type CsvImporter } from '.';

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

const COLUMNS = ['code', 'name'];
const ROWS = 'code,name\nPU,Pumps';
const SAVED = { title: 'Codes imported', message: '1 row: 1 new', listPath: '/list', listLabel: 'Codes' };

function importer(overrides: Partial<CsvImporter> = {}): CsvImporter {
  return {
    check: vi.fn(async () => ({ status: 'Check: 1 row', problems: [], ready: true })),
    submit: vi.fn(async () => SAVED),
    problemsOf: (error) => (error instanceof V2ApiError ? [{ line: 2, message: 'name is required' }] : []),
    pending: false,
    ...overrides,
  };
}

const show = (value: CsvImporter) =>
  render(
    <MemoryRouter initialEntries={['/list/import']}>
      <CsvImportForm id="codes" columns={COLUMNS} columnHelp="code and name" templateName="codes.csv" importer={value} listPath="/list" />
    </MemoryRouter>,
  );

const box = () => screen.getByLabelText('Or paste the rows') as HTMLTextAreaElement;
const importButton = () => screen.getByRole('button', { name: 'Import' });

describe('shared CSV import (SETUP_UX_FIXES Phase 4)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('builds the template from the header row only and explains a disabled Import', () => {
    expect(csvTemplateText(['code', 'name', 'a,b'])).toBe('code,name,"a,b"\r\n');
    expect(importBlockedReason('', null, false)).toMatch(/Choose a CSV file/);
    expect(importBlockedReason(ROWS, ROWS, false)).toMatch(/were imported/);
    expect(importBlockedReason(ROWS, null, false)).toBeNull();
  });

  it('Check shows the dry run status without storing; the template button downloads a CSV', async () => {
    const value = importer();
    const createUrl = vi.fn(() => 'blob:t');
    URL.createObjectURL = createUrl;
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    show(value);
    fireEvent.click(screen.getByTestId('codes-template'));
    expect(createUrl).toHaveBeenCalled();
    fireEvent.change(box(), { target: { value: ROWS } });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect((await screen.findByRole('status')).textContent).toBe('Check: 1 row');
    expect(value.submit).not.toHaveBeenCalled();
  });

  it('Import ends in the result dialog and stays disabled until the rows change', async () => {
    const value = importer();
    show(value);
    fireEvent.change(box(), { target: { value: ROWS } });
    fireEvent.click(importButton());
    const dialog = await screen.findByTestId('save-result-dialog');
    expect(within(dialog).getByText('Codes imported')).toBeTruthy();
    expect(within(dialog).getByRole('link', { name: 'Back to Codes' }).getAttribute('href')).toBe('/list');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(importButton()).toBeDisabled();
    expect(box().value).toBe(ROWS);
    fireEvent.change(box(), { target: { value: `${ROWS}\nVA,Valves` } });
    expect(importButton()).not.toBeDisabled();
  });

  it('a refusal is the red alert with the row problems, the rows kept', async () => {
    const value = importer({ submit: vi.fn(async () => { throw new V2ApiError(422, { code: 'IMPORT_INVALID', message: 'invalid', correlationId: 'c', retryable: false }); }) });
    show(value);
    fireEvent.change(box(), { target: { value: ROWS } });
    fireEvent.click(importButton());
    expect(await screen.findByTestId('save-failure-alert')).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Row problems' }).textContent).toContain('Row 2: name is required');
    expect(box().value).toBe(ROWS);
    expect(screen.queryByTestId('save-result-dialog')).toBeNull();
  });

  it('lists the row problems under the alert and blocks Import until the rows change', async () => {
    const value = importer({ check: vi.fn(async () => { throw new V2ApiError(422, { code: 'IMPORT_INVALID', message: 'invalid', correlationId: 'c', retryable: false }); }) });
    show(value);
    fireEvent.change(box(), { target: { value: ROWS } });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    const alert = await screen.findByTestId('save-failure-alert');
    const problems = screen.getByRole('list', { name: 'Row problems' });
    expect(alert.compareDocumentPosition(problems) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(problems.compareDocumentPosition(importButton()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(importButton()).toBeDisabled();
    fireEvent.change(box(), { target: { value: `${ROWS}\nVA,Valves` } });
    expect(importButton()).not.toBeDisabled();
  });

  it('a local precheck that is not ready stops Import before anything is sent', async () => {
    const value = importer({ precheck: () => ({ status: 'Fix the rows below first.', problems: [{ line: 1, message: 'code is required' }], ready: false }) });
    show(value);
    fireEvent.change(box(), { target: { value: ROWS } });
    fireEvent.click(importButton());
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Fix the rows below first.'));
    expect(screen.getByRole('list', { name: 'Row problems' }).textContent).toContain('Row 1: code is required');
    expect(value.submit).not.toHaveBeenCalled();
  });
});
