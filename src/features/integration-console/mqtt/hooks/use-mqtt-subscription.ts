import { useIngestionJobs } from '@/api/v2/queries/ingestion-jobs';
import type { IngestionJobView } from '@/api/v2/types/integrations';
import { useJobClock } from '../../hooks/use-job-clock';
import { awaitsSubscribeJob, mqttHealthOf, subscribeJobOf, subscriptionStatus, type MqttHealthView, type SubscriptionStatusView } from '../model/mqtt-health';

export interface MqttSubscription {
  job: IngestionJobView | null;
  health: MqttHealthView;
  status: SubscriptionStatusView;
  /** wall clock of the last poll tick, for ages */
  now: number;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
}

/**
 * The subscribe job of an MQTT connection with its parsed health (design §8), polled with the jobs
 * list. The worker creates the job; the console only reads and commands it.
 */
export function useMqttSubscription(connectionId: string, isActive: boolean): MqttSubscription {
  const jobs = useIngestionJobs(connectionId, isActive ? awaitsSubscribeJob : undefined);
  const now = useJobClock(jobs.items.map((item) => item.state));
  const job = subscribeJobOf(jobs.items);
  const health = mqttHealthOf(job?.health);
  return { job, health, status: subscriptionStatus(job, health, now), now, isLoading: jobs.isLoading, isError: jobs.isError, error: jobs.error };
}
