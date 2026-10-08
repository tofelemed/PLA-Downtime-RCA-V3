import {
  Injectable,
  OnApplicationShutdown,
  UnprocessableEntityException,
} from '@nestjs/common';
import { SourceType } from '../envelope/canonical-envelope';
import { SourceAdapter } from './adapter.interface';

/** Adapters by source type; connector modules register theirs on init (plan 1.5, ING07). */
@Injectable()
export class AdapterRegistry implements OnApplicationShutdown {
  private readonly adapters = new Map<SourceType, SourceAdapter>();

  register(adapter: SourceAdapter): void {
    this.adapters.set(adapter.sourceType, adapter);
  }

  find(sourceType: SourceType): SourceAdapter | null {
    return this.adapters.get(sourceType) ?? null;
  }

  /** The adapter of `sourceType`; 422 `ADAPTER_UNAVAILABLE` when none is installed yet. */
  get(sourceType: SourceType): SourceAdapter {
    const adapter = this.find(sourceType);
    if (adapter) return adapter;
    throw new UnprocessableEntityException({
      code: 'ADAPTER_UNAVAILABLE',
      message: `No adapter for source type ${sourceType} is installed yet`,
    });
  }

  async onApplicationShutdown(): Promise<void> {
    for (const adapter of this.adapters.values()) await adapter.close?.();
  }
}
