import type { JobAction } from '@/api/v2/types/integrations';

/** What each job command does to a subscription (design §6), shown in the confirmation dialog. */
export const MQTT_ACTION_TEXT: Record<JobAction, { label: string; confirm: string; destructive: boolean }> = {
  start: { label: 'Start', confirm: 'Connect with the stored client id; the broker delivers the backlog of the persistent session.', destructive: false },
  pause: { label: 'Pause', confirm: 'Disconnect but keep the broker session: the broker queues QoS 1 messages until resumed (within the session expiry).', destructive: false },
  resume: { label: 'Resume', confirm: 'Reconnect with the same client id and receive what the broker queued.', destructive: false },
  drain: { label: 'Drain', confirm: 'Stop subscribing, finish the message in flight, then stop.', destructive: false },
  stop: { label: 'Stop', confirm: 'Disconnect with session expiry 0: the broker drops the queue. Messages published while stopped are lost to Traverse Forge.', destructive: true },
};
