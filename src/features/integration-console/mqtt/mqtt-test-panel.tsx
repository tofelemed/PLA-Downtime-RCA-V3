import { useTestConnection } from '@/api/v2/queries/integration-connections';
import type { ConnectionView } from '@/api/v2/types/integrations';
import { Button } from '@/components/ui/button';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';
import { ConsoleRefusal } from '../components/console-refusal';
import { ToneBadge } from '../components/tone-badge';
import type { SessionTest } from '../hooks/use-console-session';
import { mqttDiagnosticRows } from './model/mqtt-diagnostics';

export interface MqttTestPanelProps {
  connection: ConnectionView;
  last: SessionTest | null;
  timezone: string;
  onTested: (result: SessionTest['result']) => void;
}

const TEST_INFO = 'A CONNACK-only test with a throwaway client id: nothing is subscribed or stored. It proves the broker, credentials and TLS; whether messages arrive is shown by the subscription above (last message, counters).';

const TONE_CLASS = { ok: 'text-success', error: 'text-destructive', neutral: '' } as const;

/**
 * CONNACK-only test with a throwaway client id (nothing subscribed or stored; the running subscriber
 * is not disturbed): broker, protocol, TLS mode, reason codes and timings as the server reported them.
 */
export function MqttTestPanel({ connection, last, timezone, onTested }: MqttTestPanelProps) {
  const test = useTestConnection();
  const run = async () => {
    const result = await test.submit(connection.id).catch(() => null);
    if (result) onTested(result);
  };
  const health = last ? (last.result.connected ? 'connected' : 'failed') : 'not_tested';
  return (
    <section aria-label="Connection test" className="space-y-2 rounded-md border p-3 text-sm" data-testid="mqtt-test" data-health={health}>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => void run()} disabled={test.isPending} data-testid="run-diagnostics">
          {test.isPending ? 'Testing…' : 'Test connection'}
        </Button>
        <ToneBadge tone={health === 'connected' ? 'ok' : health === 'failed' ? 'error' : 'idle'} testId="connection-health">
          {health === 'connected' ? 'Broker answered' : health === 'failed' ? 'Test failed' : 'Not tested'}
        </ToneBadge>
        <KpiInfo label="Connection test" text={TEST_INFO} />
        {last && (
          <span className="text-xs text-muted-foreground">
            tested <PlantTime iso={last.at} tz={timezone} withDate withZone={false} />
          </span>
        )}
      </div>
      <ConsoleRefusal error={test.error} />
      {last && <p data-testid="mqtt-test-message">{last.result.message}</p>}
      {last && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
          {mqttDiagnosticRows(last.result).map((row) => (
            <div key={row.key} data-testid="diagnostic-step" data-step={row.key}>
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className={`break-all ${TONE_CLASS[row.tone]}`}>{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
