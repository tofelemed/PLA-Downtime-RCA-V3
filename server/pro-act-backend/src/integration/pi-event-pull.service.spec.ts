import { parseTenantMappingRules } from './pi-event-mapper';
import { PIEventPullService } from './pi-event-pull.service';

type Outcome = 'created' | 'updated' | 'unchanged' | 'skipped' | 'unmapped';

interface PullInternals {
  createProductionEventFromPI(
    ef: Record<string, unknown>,
    attributes: Record<string, unknown>,
    tenantId: string,
    organizationId: string | undefined,
    mappingConfig: ReturnType<typeof parseTenantMappingRules>,
    bindingMap: Map<string, unknown>,
  ): Promise<Outcome>;
}

const TENANT = '11111111-1111-4111-8111-111111111111';
const UNIT = '22222222-2222-4222-8222-222222222222';
const FRAME = {
  WebId: 'EF-1',
  Name: 'Compressor trip',
  TemplateName: 'Downtime',
  StartTime: '2026-10-08T06:00:00Z',
  EndTime: '2026-10-08T07:00:00Z',
};

/** Plan 1.2 step 3 (B5/I1): a PI re-sync is a source revision, never a v1 update with `status: 'Open'`. */
describe('PIEventPullService bridge to event revisions', () => {
  const existing = { id: 'event-1' };
  let findOne: jest.Mock;
  let create: jest.Mock;
  let update: jest.Mock;
  let applySourceRevision: jest.Mock;
  let service: PullInternals;

  beforeEach(() => {
    findOne = jest.fn();
    create = jest.fn().mockResolvedValue({});
    update = jest.fn();
    applySourceRevision = jest.fn();
    const stub = (value: object): never => value as never;
    service = new PIEventPullService(
      stub({}),
      stub({}),
      stub({}),
      stub({}),
      stub({}),
      stub({ findOne }),
      stub({ find: jest.fn().mockResolvedValue([]) }),
      stub({ create, update }),
      stub({
        findHierarchyMapping: jest
          .fn()
          .mockResolvedValue({ tenantId: TENANT, unitId: UNIT }),
      }),
      stub({}),
      stub({
        resolveMappedCodeFields: jest.fn((fields: unknown) =>
          Promise.resolve(fields),
        ),
      }),
      stub({}),
      stub({ applySourceRevision }),
    ) as unknown as PullInternals;
  });

  const pull = () =>
    service.createProductionEventFromPI(
      FRAME,
      {},
      TENANT,
      undefined,
      parseTenantMappingRules(null),
      new Map(),
    );

  it('applies a source revision to an existing event and never sends a status', async () => {
    findOne.mockResolvedValue(existing);
    applySourceRevision.mockResolvedValue('revised');

    expect(await pull()).toBe('updated');

    expect(update).not.toHaveBeenCalled();
    const [eventId, facts, provenance] = applySourceRevision.mock.calls[0] as [
      string,
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(eventId).toBe('event-1');
    expect(facts).toMatchObject({
      startTime: '2026-10-08T06:00:00.000Z',
      endTime: '2026-10-08T07:00:00.000Z',
      description: 'Compressor trip',
    });
    expect(facts).not.toHaveProperty('status');
    expect(facts).not.toHaveProperty('reasonCodeId');
    expect(provenance).toEqual({
      actorKind: 'connector',
      sourceRevision: '2026-10-08T07:00:00.000Z',
    });
  });

  it('reports a duplicate delivery as unchanged', async () => {
    findOne.mockResolvedValue(existing);
    applySourceRevision.mockResolvedValue('duplicate');

    expect(await pull()).toBe('unchanged');
  });

  it('creates new events as the connector without a status label', async () => {
    findOne.mockResolvedValue(null);

    expect(await pull()).toBe('created');

    const [dto, actor] = create.mock.calls[0] as [
      Record<string, unknown>,
      unknown,
    ];
    expect(dto).not.toHaveProperty('status');
    expect(dto).toMatchObject({ source: 'PI', unitId: UNIT });
    expect(actor).toEqual({ id: null, kind: 'connector' });
    expect(applySourceRevision).not.toHaveBeenCalled();
  });
});
