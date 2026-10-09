import { RealtimeMessage, RoutedMessage } from './realtime-message';

/** Outcome of a resume request for one room. */
export type ResumeResult =
  | { kind: 'current'; headSeq: string | null }
  | { kind: 'replay'; headSeq: string | null; messages: RealtimeMessage[] }
  | { kind: 'resync'; headSeq: string | null };

/**
 * Recent messages per room (plan 3.1, API05 `sinceSeq`): numbers each delivery with the room's
 * previous `seq` and lets a reconnecting client resume. A `sinceSeq` older than the buffer, or unknown
 * to this process (restart, another instance), answers `resync`: the client refetches its snapshot.
 */
export class ReplayBuffer {
  private readonly rooms = new Map<string, RealtimeMessage[]>();
  private readonly heads = new Map<string, string>();

  constructor(private readonly capacity: number) {}

  /** Stamps `prevSeq`, stores the message and returns it. */
  append(message: RoutedMessage): RealtimeMessage {
    const stamped: RealtimeMessage = {
      ...message,
      prevSeq: this.heads.get(message.room) ?? null,
    };
    const list = this.rooms.get(message.room) ?? [];
    list.push(stamped);
    if (list.length > this.capacity)
      list.splice(0, list.length - this.capacity);
    this.rooms.set(message.room, list);
    this.heads.set(message.room, stamped.seq);
    return stamped;
  }

  headSeq(room: string): string | null {
    return this.heads.get(room) ?? null;
  }

  /** What a client that last saw `sinceSeq` in `room` needs (undefined = new subscriber). */
  resume(room: string, sinceSeq: string | undefined): ResumeResult {
    const headSeq = this.headSeq(room);
    if (sinceSeq === undefined || sinceSeq === headSeq) {
      return { kind: 'current', headSeq };
    }
    const list = this.rooms.get(room) ?? [];
    const index = list.findIndex((message) => message.seq === sinceSeq);
    if (index < 0) return { kind: 'resync', headSeq };
    return { kind: 'replay', headSeq, messages: list.slice(index + 1) };
  }
}
