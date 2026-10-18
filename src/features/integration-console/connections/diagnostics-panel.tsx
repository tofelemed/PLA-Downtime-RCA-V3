import { useTestConnection } from '@/api/v2/queries/integration-connections';
import type { ConnectionView } from '@/api/v2/types/integrations';
import { Button } from '@/components/ui/button';
import { DIAGNOSTIC_STATUS_LABELS, labelOf } from '@/features/ux-kit/labels';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { StatusIcon, type AppIcon } from '@/lib/icons';
import { ConsoleRefusal } from '../components/console-refusal';
import { ToneBadge } from '../components/tone-badge';
import type { SessionTest } from '../hooks/use-console-session';
import { capabilityList, connectionHealth, diagnosticRows, HEALTH_LABEL, type DiagnosticRow } from '../model/diagnostics';

export interface DiagnosticsPanelProps {
  connection: ConnectionView;
  last: SessionTest | null;
  timezone: string;
  onTested: (result: SessionTest['result']) => void;
}

const ICONS: Record<DiagnosticRow['status'], AppIcon> = {
  ok: StatusIcon.success,
  failed: StatusIcon.error,
  skipped: StatusIcon.info,
  not_applicable: StatusIcon.info,
  not_run: StatusIcon.pending,
};

/**
 * Staged connection test (PI01): DNS, TLS, authentication, version, authorization and read, each with
 * the server's result and detail; then the detected capabilities. Running it needs a writer role.
 */
export function DiagnosticsPanel({ connection, last, timezone, onTested }: DiagnosticsPanelProps) {
  const test = useTestConnection();
  const health = connectionHealth(last?.result ?? null);
  const run = async () => {
    const result = await test.submit(connection.id).catch(() => null);
    if (result) onTested(result);
  };
  return (
    <section aria-label="Diagnostics" className="space-y-3" data-testid="diagnostics-panel" data-health={health}>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => void run()} disabled={test.isPending} data-testid="run-diagnostics">
          {test.isPending ? 'Testing…' : 'Run diagnostics'}
        </Button>
        <ToneBadge tone={health === 'connected' ? 'ok' : health === 'not_tested' ? 'idle' : 'error'} testId="connection-health">
          {HEALTH_LABEL[health]}
        </ToneBadge>
        {last && (
          <span className="text-xs text-muted-foreground">
            tested <PlantTime iso={last.at} tz={timezone} withDate />
          </span>
        )}
      </div>
      <ConsoleRefusal error={test.error} />
      <ol className="divide-y rounded-md border text-sm">
        {diagnosticRows(last?.result ?? null).map((row) => {
          const Icon = ICONS[row.status];
          return (
            <li key={row.key} className="flex items-start gap-2 p-2" data-testid="diagnostic-step" data-step={row.key} data-status={row.status}>
              <Icon className={`mt-0.5 h-4 w-4 ${row.status === 'failed' ? 'text-destructive' : row.status === 'ok' ? 'text-success' : 'text-muted-foreground'}`} aria-hidden />
              <span className="w-48 shrink-0 font-medium">{row.label}</span>
              <span className="text-muted-foreground">{row.status === 'not_run' ? 'Not run' : labelOf(DIAGNOSTIC_STATUS_LABELS, row.status)}{row.detail ? ` — ${row.detail}` : ''}</span>
            </li>
          );
        })}
      </ol>
      {last && <p className="text-sm">{last.result.message}</p>}
      {capabilityList(last?.result.capabilities).length > 0 && (
        <p className="text-xs text-muted-foreground" data-testid="detected-capabilities">
          Detected: {capabilityList(last?.result.capabilities).join(', ')}
        </p>
      )}
      <p className="text-xs text-muted-foreground">A reachable source does not mean accounting works: map, run a limited job and clear the quarantine first.</p>
    </section>
  );
}
