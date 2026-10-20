import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const submit = vi.fn(() => Promise.resolve({ jobId: 'job-1', statusUrl: '/api/v2/exports/job-1' }));

vi.mock('@/features/display-currency/use-display-currency', () => ({ useDisplayCurrency: () => ({ currency: 'IRR' }) }));
vi.mock('@/api/v2/queries/report-exports', () => ({
  useCreateReportExport: () => ({ submit, isPending: false }),
  downloadReportExport: vi.fn(),
}));
vi.mock('@/api/v2/queries/period-overview', () => ({
  useExportJob: () => ({ data: { state: 'completed', error: null } }),
}));

const { ReportExportBar } = await import('./report-export-bar');

describe('ReportExportBar', () => {
  it('starts a PDF export of the report query in the display currency and offers the download when done', async () => {
    render(<ReportExportBar kind="daily" query={{ from: '2027-03-01T02:30:00Z', to: '2027-03-02T02:30:00Z' }} timezone="Asia/Tehran" />);
    fireEvent.click(screen.getByTestId('report-export-pdf'));
    await waitFor(() => expect(submit).toHaveBeenCalledWith({ kind: 'daily', query: { from: '2027-03-01T02:30:00Z', to: '2027-03-02T02:30:00Z' }, format: 'pdf', currency: 'IRR' }));
    expect(await screen.findByTestId('report-export-pdf-download')).toBeInTheDocument();
  });

  it('cannot start while the report query is not known', () => {
    render(<ReportExportBar kind="shift" query={null} formats={['pdf']} timezone="UTC" />);
    expect(screen.getByTestId('report-export-pdf')).toBeDisabled();
    expect(screen.queryByTestId('report-export-xlsx')).toBeNull();
  });
});
