import {
  ReadPage,
  ReadRequest,
  SourceAdapter,
} from '../../../src/intake/adapters/adapter.interface';

/** Test double of an adapter (ING07): pages come from `next`, reads are counted. */
export class FakeAdapter implements SourceAdapter {
  readonly sourceType = 'rest_import' as const;
  reads = 0;
  next: (request: ReadRequest) => Promise<ReadPage> = () =>
    Promise.resolve({ records: [], nextCursor: {}, hasMore: false });

  capabilities() {
    return { replay: true };
  }
  validateConfig(): string[] {
    return [];
  }
  test() {
    return Promise.resolve({ connected: true, message: 'fake ok' });
  }
  discover() {
    return Promise.resolve({ topics: ['fake'] });
  }
  read(request: ReadRequest): Promise<ReadPage> {
    this.reads += 1;
    return this.next(request);
  }
  health() {
    return Promise.resolve({ status: 'ok' as const });
  }
}
