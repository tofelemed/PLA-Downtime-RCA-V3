import { Injectable } from '@nestjs/common';
import { PublishedMessage } from './outbox-transport';

export type MessageHandler = (message: PublishedMessage) => Promise<void>;

/**
 * In-process subscribers by message type (`*` = every type). Handlers run one after another and must
 * be idempotent (use `InboxService`): a failure makes the relay redeliver the whole message.
 */
@Injectable()
export class InProcessEventBus {
  private readonly handlers = new Map<string, MessageHandler[]>();

  subscribe(type: string, handler: MessageHandler): () => void {
    const list = this.handlers.get(type) ?? [];
    list.push(handler);
    this.handlers.set(type, list);
    return () => {
      const current = this.handlers.get(type) ?? [];
      this.handlers.set(
        type,
        current.filter((entry) => entry !== handler),
      );
    };
  }

  async dispatch(message: PublishedMessage): Promise<number> {
    const handlers = [
      ...(this.handlers.get(message.type) ?? []),
      ...(this.handlers.get('*') ?? []),
    ];
    for (const handler of handlers) await handler(message);
    return handlers.length;
  }
}
