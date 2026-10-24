import { Fragment, type ReactNode } from 'react';

export interface PolicySummaryRow {
  label: string;
  value: ReactNode;
}

/** The version in force of one policy card, read-only: label / value pairs (the card is the frame). */
export function PolicySummary({ rows, testId }: { rows: readonly PolicySummaryRow[]; testId: string }) {
  return (
    <dl className="grid max-w-3xl gap-x-4 gap-y-1 text-sm sm:grid-cols-[14rem_1fr]" data-testid={testId}>
      {rows.map((row) => (
        <Fragment key={row.label}>
          <dt className="text-muted-foreground">{row.label}</dt>
          <dd className="mb-1 sm:mb-0">{row.value}</dd>
        </Fragment>
      ))}
    </dl>
  );
}
