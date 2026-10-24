import { createContext, useContext } from 'react';
import type { DataTableEmpty } from '../data-table/data-table-types';

/** The report look of the Reports page (redesign 24 Oct 2026, tables): set by the page, read by the shared tables and states. */
export interface ReportLook {
  /** Revision = Provisional: rows and figures the server marks provisional carry a "Provisional" marker */
  provisional: boolean;
}

/** null outside the Reports page: tables, states and markers look as they always did. */
export const ReportLookContext = createContext<ReportLook | null>(null);

/** The report look, or null outside the Reports page. */
export const useReportLook = (): ReportLook | null => useContext(ReportLookContext);

/** What every empty report table or card says. */
export const REPORT_EMPTY: Readonly<Required<Pick<DataTableEmpty, 'title' | 'text'>>> = {
  title: 'No data for these dates',
  text: 'Try other dates or units',
};
