import type { RuleSimulationView } from '@/api/v2/types/rules';
import { PlantTime } from '@/features/ux-kit/plant-time';

const counts = (record: Record<string, number>) =>
  Object.entries(record)
    .map(([value, count]) => `${value === 'null' ? '(empty)' : value}: ${count}`)
    .join(', ') || '—';

/** A recorded simulation run as the server returned it (counts and diffs are never computed here). */
export function SimulationResult({ result, timezone }: { result: RuleSimulationView; timezone: string }) {
  return (
    <div
      className="space-y-2 text-sm"
      data-testid="sim-result"
      data-evaluated={result.evaluated}
      data-matched={result.matched}
      data-changed={result.changed}
      data-version={result.version ?? 'draft'}
    >
      <p>
        {result.version === null ? 'Draft' : `Version ${result.version}`} over <PlantTime iso={result.scope.from} tz={timezone} withDate /> –{' '}
        <PlantTime iso={result.scope.to} tz={timezone} withDate />: <strong>{result.evaluated}</strong> event(s) evaluated, <strong>{result.matched}</strong> matched,{' '}
        <strong>{result.changed}</strong> would change.
        {result.truncated && ' Only the latest events were evaluated (sample limit).'}
        {result.budgetExceeded > 0 && ` ${result.budgetExceeded} evaluation(s) hit the step budget and did not match.`}
      </p>
      {Object.keys(result.fields).length > 0 && (
        <table className="w-full text-left text-xs">
          <thead>
            <tr>
              <th className="py-1">Field</th>
              <th>Before</th>
              <th>After</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(result.fields).map(([field, distribution]) => (
              <tr key={field} data-testid="sim-field" data-field={field}>
                <td className="py-1">{field}</td>
                <td>{counts(distribution.before)}</td>
                <td>{counts(distribution.after)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {Object.keys(result.flags).length > 0 && <p data-testid="sim-flags">Flags: {counts(result.flags)}</p>}
      {result.samples.length > 0 && (
        <details>
          <summary>Sample events ({result.samples.length})</summary>
          <ul className="mt-1 space-y-1 text-xs">
            {result.samples.map((sample) => (
              <li key={sample.eventId} data-testid="sim-sample">
                <PlantTime iso={sample.startTime} tz={timezone} withDate />:{' '}
                {sample.changes.map((change) => `${change.field} ${change.before ?? '(empty)'} → ${change.after}`).join('; ') || 'no change'}
                {sample.flags.length > 0 && ` · flags ${sample.flags.join(', ')}`}
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="text-xs text-muted-foreground">Run {result.runId} recorded. The rule is shown in isolation: on new events, user choices and reason-code defaults still come first.</p>
    </div>
  );
}
