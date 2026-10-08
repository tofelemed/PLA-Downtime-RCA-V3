import { Injectable, Logger } from '@nestjs/common';
import { InProcessEventBus } from './in-process-event-bus';
import { OutboxTransport, PublishedMessage } from './outbox-transport';

/** Default transport: the worker's own in-process bus (plan 1.5, D10). */
@Injectable()
export class InProcessOutboxTransport implements OutboxTransport {
  readonly name = 'in-process';
  private readonly logger = new Logger(InProcessOutboxTransport.name);

  constructor(private readonly bus: InProcessEventBus) {}

  async publish(message: PublishedMessage): Promise<void> {
    const handled = await this.bus.dispatch(message);
    if (handled === 0) {
      this.logger.debug(
        `${message.type} #${message.id}: no in-process consumer`,
      );
    }
  }
}
