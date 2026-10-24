import { Fragment, type ReactNode } from 'react';

export interface Fact {
  label: string;
  value: ReactNode;
}

/** Label / value pairs of a record for readers (values as text, never disabled inputs). */
export function FactsList({ facts, testId }: { facts: readonly Fact[]; testId: string }) {
  return (
    <dl className="grid max-w-3xl gap-x-4 gap-y-1 rounded-lg border bg-card p-4 text-sm sm:grid-cols-[12rem_1fr]" data-testid={testId}>
      {facts.map((fact) => (
        <Fragment key={fact.label}>
          <dt className="text-muted-foreground">{fact.label}</dt>
          <dd className="mb-1 whitespace-pre-line sm:mb-0">{fact.value}</dd>
        </Fragment>
      ))}
    </dl>
  );
}
