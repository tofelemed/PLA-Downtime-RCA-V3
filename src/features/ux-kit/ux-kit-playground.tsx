import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataState } from './data-state';
import type { DataStateKind } from './data-state-of';
import { DecimalInput } from './decimal-input';
import { DurationText } from './duration-text';
import { PlantTime } from './plant-time';
import { Quantity } from './quantity';
import { ScopeHeader } from './scope-header';

/** Formatting examples only (dev route): fixed sample inputs that show how each component renders. */
const SAMPLE_INSTANT = '2026-10-09T02:30:00Z';
const STATES: DataStateKind[] = ['loading', 'empty', 'no-permission', 'source-offline', 'incomplete', 'calculation-pending', 'error'];

/**
 * Development-only playground of the UX kit (plan 3.1 step 4); the route is registered only when
 * `import.meta.env.DEV`, so it never ships in a production bundle.
 */
export function UxKitPlayground() {
  const [decimal, setDecimal] = useState<string | null>('1234.5');
  return (
    <div className="space-y-4 p-4">
      <ScopeHeader scopeLabel="Example plant · unit" timezone="Asia/Tehran" uom="t" baseline="Plan v1" isProvisional asOf={SAMPLE_INSTANT} />
      <Card>
        <CardHeader>
          <CardTitle>Formatting</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <div>
            Duration 5400 s: <DurationText seconds={5400} /> · <DurationText seconds={5400} variant="compact" /> ·{' '}
            <DurationText seconds={5400} variant="clock" />
          </div>
          <div>
            Plant time: <PlantTime iso={SAMPLE_INSTANT} tz="Asia/Tehran" /> · <PlantTime iso={SAMPLE_INSTANT} tz="Asia/Dubai" withDate />
          </div>
          <div>
            Quantity: <Quantity value="12345.678" uom="t" /> · <Quantity value="12" uom={null} />
          </div>
          <div className="max-w-xs">
            <DecimalInput aria-label="Decimal" value={decimal} onChange={setDecimal} /> value: {decimal ?? 'empty'}
          </div>
        </CardContent>
      </Card>
      {STATES.map((state) => (
        <DataState key={state} state={state} onRetry={() => undefined} />
      ))}
    </div>
  );
}
