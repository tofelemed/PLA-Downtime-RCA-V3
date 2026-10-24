import { createContext, useContext } from 'react';

/** True inside `ReportChrome` (the Reports page): shared cards drop captions and status chips there. */
export const ReportChromeContext = createContext(false);

/** True inside `ReportChrome`. */
export const useReportChrome = (): boolean => useContext(ReportChromeContext);
