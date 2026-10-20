import { Suspense } from 'react';
import { DataState } from '@/features/ux-kit/data-state';
import { OPS_VIEWS, type OpsReportProps } from './ops-report-registry';

/** One operating report, with a loading state while its code arrives. */
export function OpsReportView({ viewKey, ...props }: OpsReportProps & { viewKey: string }) {
  const entry = OPS_VIEWS.find((view) => view.key === viewKey);
  if (!entry) return null;
  const { Report } = entry;
  return (
    <Suspense fallback={<DataState state="loading" />}>
      <Report {...props} />
    </Suspense>
  );
}
