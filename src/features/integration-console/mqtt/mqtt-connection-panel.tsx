import type { ConnectionView } from '@/api/v2/types/integrations';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { useConsoleSession } from '../hooks/use-console-session';
import { useUrlParam } from '../hooks/use-url-param';
import { QuarantineInbox } from '../quarantine/quarantine-inbox';
import { useMqttSubscription } from './hooks/use-mqtt-subscription';
import { MqttTestPanel } from './mqtt-test-panel';
import { ProfileEditor } from './profile-editor';
import { SubscriptionActions } from './subscription-actions';
import { SubscriptionCounters } from './subscription-counters';
import { SubscriptionStatus } from './subscription-status';

export interface MqttConnectionPanelProps {
  connection: ConnectionView;
  timezone: string;
}

const TABS = ['subscription', 'profile', 'quarantine'] as const;
type MqttTab = (typeof TABS)[number];

/**
 * MQTT panel of one connection (plan 1.8 WP3 step 5, design §8): the subscription's live health from
 * the worker's heartbeat with pause / resume / drain / stop, the CONNACK test, the payload profile
 * editor (merge-patched, with live value-map classification) and this connection's quarantine. The tab
 * is in the URL.
 */
export function MqttConnectionPanel({ connection, timezone }: MqttConnectionPanelProps) {
  const { canWriteIntegration } = useCapabilities();
  const session = useConsoleSession();
  const [tab, setTab] = useUrlParam<MqttTab>('tab', TABS, 'subscription');
  const subscription = useMqttSubscription(connection.id, connection.isActive);
  return (
    <Tabs value={tab} onValueChange={(next) => setTab(next as MqttTab)}>
      <TabsList className="h-auto flex-wrap">
        <TabsTrigger value="subscription" data-testid="tab-subscription">Subscription</TabsTrigger>
        <TabsTrigger value="profile" data-testid="tab-profile">Payload profile</TabsTrigger>
        <TabsTrigger value="quarantine" data-testid="tab-mqtt-quarantine">Quarantine</TabsTrigger>
      </TabsList>
      <TabsContent value="subscription" className="mt-4 space-y-4">
        <DataState state={dataStateOf(subscription)} error={subscription.error}>
          <SubscriptionStatus connection={connection} subscription={subscription} timezone={timezone} />
          <SubscriptionCounters health={subscription.health} />
          <SubscriptionActions job={subscription.job} timezone={timezone} />
        </DataState>
        {canWriteIntegration && <MqttTestPanel connection={connection} last={session.testOf(connection.id)} timezone={timezone} onTested={(result) => session.recordTest(connection.id, result)} />}
      </TabsContent>
      <TabsContent value="profile" className="mt-4">
        <ProfileEditor connection={connection} />
      </TabsContent>
      <TabsContent value="quarantine" className="mt-4">
        <QuarantineInbox timezone={timezone} connectionId={connection.id} />
      </TabsContent>
    </Tabs>
  );
}
