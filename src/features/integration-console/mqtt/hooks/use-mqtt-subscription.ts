import { useEffect, useState } from 'react';
import { JOB_POLL_MS, useIngestionJobs } from '@/api/v2/queries/ingestion-jobs';
import type { IngestionJobView } from '@/api/v2/types/integrations';
import { mqttHealthOf, subscribeJobOf, subscriptionStatus, type MqttHealthView, type SubscriptionStatusView } from '../model/mqtt-health';

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

/** Wall clock ticking with the job poll (ages are display only). */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), JOB_POLL_MS);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

/**
 * The subscribe job of an MQTT connection with its parsed health (design §8), polled with the jobs
 * list. The worker creates the job; the console only reads and commands it.
 */
export function useMqttSubscription(connectionId: string): MqttSubscription {
  const jobs = useIngestionJobs(connectionId);
  const now = useNow();
  const job = subscribeJobOf(jobs.items);
  const health = mqttHealthOf(job?.health);
  return { job, health, status: subscriptionStatus(job, health, now), now, isLoading: jobs.isLoading, isError: jobs.isError, error: jobs.error };
}
