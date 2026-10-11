import { useState } from 'react';
import type { ConnectionView } from '@/api/v2/types/integrations';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import type { ConsoleSession } from '../hooks/use-console-session';
import { QuarantineInbox } from '../quarantine/quarantine-inbox';
import { useMqttSubscription } from './hooks/use-mqtt-subscription';
import { MqttTestPanel } from './mqtt-test-panel';
import { ProfileEditor } from './profile-editor';
import { SubscriptionActions } from './subscription-actions';
import { SubscriptionCounters } from './subscription-counters';
import { SubscriptionStatus } from './subscription-status';

export interface MqttConnectionPanelProps {
  connection: ConnectionView;
  session: ConsoleSession;
  timezone: string;
}

/**
 * MQTT panel of one connection (plan 1.8 WP3 step 5, design §8): the subscription's live health from
 * the worker's heartbeat with pause / resume / drain / stop, the CONNACK test, the payload profile
 * editor (merge-patched, with live value-map classification) and this connection's quarantine.
 */
export function MqttConnectionPanel({ connection, session, timezone }: MqttConnectionPanelProps) {
  const { canWriteIntegration } = useCapabilities();
  const [tab, setTab] = useState('subscription');
  const subscription = useMqttSubscription(connection.id);
  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="flex-wrap">
        <TabsTrigger value="subscription" data-testid="tab-subscription">Subscription</TabsTrigger>
        <TabsTrigger value="profile" data-testid="tab-profile">Payload profile</TabsTrigger>
        <TabsTrigger value="quarantine" data-testid="tab-mqtt-quarantine">Quarantine</TabsTrigger>
      </TabsList>
      <TabsContent value="subscription" className="space-y-4">
        <DataState state={dataStateOf(subscription)} error={subscription.error}>
          <SubscriptionStatus connection={connection} subscription={subscription} timezone={timezone} />
          <SubscriptionCounters health={subscription.health} />
          <SubscriptionActions job={subscription.job} timezone={timezone} />
        </DataState>
        {canWriteIntegration && <MqttTestPanel connection={connection} last={session.testOf(connection.id)} timezone={timezone} onTested={(result) => session.recordTest(connection.id, result)} />}
      </TabsContent>
      <TabsContent value="profile">
        <ProfileEditor connection={connection} />
      </TabsContent>
      <TabsContent value="quarantine">
        <QuarantineInbox timezone={timezone} connectionId={connection.id} />
      </TabsContent>
    </Tabs>
  );
}
