import { MappingProfile } from '../attribute-mapping/attribute-mapping.service';
import { parseTenantMappingRules } from './pi-event-mapper';
import { FrameContext, PiFrameIngestService } from './pi-frame-ingest.service';
import { ResolvedMapping } from '../source-mapping/source-mapping.service';
import { unresolvedReason } from './unresolved-reason';

const TENANT = '11111111-1111-4111-8111-111111111111';
const UNIT = '22222222-2222-4222-8222-222222222222';
const FRAME = {
  WebId: 'EF-1',
  Name: 'Compressor trip',
  TemplateName: 'Production Loss',
  StartTime: '2026-10-08T06:00:00Z',
  EndTime: '2026-10-08T07:00:00Z',
  PrimaryReferencedElement: { WebId: 'EL-1', Path: '\\\\AF\\HDPE\\unit100' },
};

/**
 * Plan 1.2 step 3 (B5/I1) and plan 1.3: a PI re-sync is a source revision with typed attribute facts;
 * a frame without a unique mapping is quarantined, never placed by a guess.
 */
describe('PiFrameIngestService', () => {
  const existing = { id: 'event-1' };
  let findOne: jest.Mock;
  let create: jest.Mock;
  let applySourceRevision: jest.Mock;
  let activeRules: jest.Mock;
  let resolveFacts: jest.Mock;
  let placement: ResolvedMapping;
  let service: PiFrameIngestService;

  beforeEach(() => {
    findOne = jest.fn();
    create = jest.fn().mockResolvedValue({});
    applySourceRevision = jest.fn();
    activeRules = jest.fn().mockResolvedValue([]);
    resolveFacts = jest.fn().mockResolvedValue({ ids: {}, diagnostics: [] });
    placement = {
      status: 'mapped',
      tier: 'af_binding',
      unitId: UNIT,
      assetId: null,
      mappingId: 'm-1',
      version: 1,
      origin: 'af_binding',
    };
    const stub = (value: object): never => value as never;
    const planQuery: Record<string, jest.Mock> = {};
    for (const step of ['select', 'where', 'andWhere', 'orderBy']) {
      planQuery[step] = jest.fn(() => planQuery);
    }
    planQuery.getOne = jest.fn().mockResolvedValue(null);
    service = new PiFrameIngestService(
      stub({ findOne }),
      stub({ createQueryBuilder: () => planQuery }),
      stub({ create }),
      stub({ applySourceRevision }),
      stub({ resolveFacts }),
      stub({ defaultsFor: jest.fn().mockResolvedValue({}) }),
      stub({ activeRules }),
    );
  });

  const context = (): FrameContext => ({
    tenantId: TENANT,
    profile: new MappingProfile(parseTenantMappingRules(null), new Map()),
    resolver: { resolve: () => placement },
  });
  const ingest = (attributes: Record<string, unknown> = {}) =>
    service.ingest(
      context(),
      { ...FRAME, TemplateName: 'IOW Deviation' },
      attributes,
    );

  it('applies a source revision to an existing event and never sends a status', async () => {
    findOne.mockResolvedValue(existing);
    applySourceRevision.mockResolvedValue('revised');

    expect((await ingest({ Value: '12.5' })).outcome).toBe('updated');

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
      value: 12.5,
      mappingDiagnostics: [],
    });
    expect(facts).not.toHaveProperty('status');
    expect(facts).not.toHaveProperty('reasonCodeId');
    expect(provenance).toEqual({
      actorKind: 'connector',
      sourceRevision: '2026-10-08T07:00:00.000Z',
      sourceCoding: { reasonCodeId: null, reasonToken: null },
    });
  });

  it('hands the resolved reason to the revision beside the facts, never inside them (F2)', async () => {
    findOne.mockResolvedValue(existing);
    applySourceRevision.mockResolvedValue('revised');
    resolveFacts.mockResolvedValue({
      ids: { reasonCodeId: 'code-2' },
      diagnostics: [],
    });

    await service.ingest(context(), FRAME, {
      ReasonCode: { Name: 'Bearing', Value: 3, IsSystem: false },
    });

    const [, facts, provenance] = applySourceRevision.mock.calls[0] as [
      string,
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(facts).not.toHaveProperty('reasonCodeId');
    expect(provenance.sourceCoding).toEqual({
      reasonCodeId: 'code-2',
      reasonToken: 'Bearing',
    });
  });

  it('hands an unresolved token to the revision with a null code and keeps CODE_UNRESOLVED for the quarantine', async () => {
    findOne.mockResolvedValue(existing);
    applySourceRevision.mockResolvedValue('revised');
    const unresolved = {
      code: 'CODE_UNRESOLVED',
      field: 'reason',
      message: '"Bearingx" is not a code of this tenant',
    };
    resolveFacts.mockResolvedValue({ ids: {}, diagnostics: [unresolved] });
    const attributes = {
      ReasonCode: { Name: 'Bearingx', Value: 9, IsSystem: false },
    };

    const result = await service.ingest(context(), FRAME, attributes);

    const [, , provenance] = applySourceRevision.mock.calls[0] as [
      string,
      unknown,
      Record<string, unknown>,
    ];
    expect(provenance.sourceCoding).toEqual({
      reasonCodeId: null,
      reasonToken: 'Bearingx',
    });
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining(unresolved),
    );
    expect(unresolvedReason(result, attributes)).toMatchObject({
      errorCode: 'unknown_code',
      detail: { field: 'reason' },
    });
  });

  it('reports a duplicate delivery as unchanged', async () => {
    findOne.mockResolvedValue(existing);
    applySourceRevision.mockResolvedValue('duplicate');

    expect((await ingest()).outcome).toBe('unchanged');
  });

  it('creates new events as the connector with typed attribute facts', async () => {
    findOne.mockResolvedValue(null);

    const result = await service.ingest(context(), FRAME, {
      ReasonCode: { Name: 'Bearing', Value: 3, IsSystem: false },
      Quantity: 'n/a',
    });

    expect(result.outcome).toBe('created');
    const [dto, actor, facts] = create.mock.calls[0] as [
      Record<string, unknown>,
      unknown,
      Record<string, unknown>,
    ];
    expect(dto).not.toHaveProperty('status');
    expect(dto).not.toHaveProperty('quantity');
    expect(dto).toMatchObject({ source: 'PI', unitId: UNIT });
    expect(actor).toEqual({ id: null, kind: 'connector' });
    expect(facts.reason).toEqual({
      name: 'Bearing',
      value: 3,
      isSystem: false,
    });
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: 'TYPE_MISMATCH', field: 'quantity' }),
    ]);
    expect(applySourceRevision).not.toHaveBeenCalled();
  });

  it('fills open axes from the active coding_default rules, loading them once per frame context', async () => {
    findOne.mockResolvedValue(null);
    activeRules.mockResolvedValue([
      {
        id: 'rule-1',
        version: 3,
        definition: {
          when: { all: [{ field: 'source', op: 'eq', value: 'MQTT' }] },
          then: [{ set: 'oeeComponent', value: 'quality' }],
        },
      },
    ]);
    const mqtt = { ...context(), sourceSystem: 'MQTT' as const };

    await service.ingest(mqtt, FRAME, {});
    await service.ingest(mqtt, { ...FRAME, WebId: 'EF-2' }, {});

    expect(activeRules).toHaveBeenCalledTimes(1);
    const [dto] = create.mock.calls[0] as [Record<string, unknown>];
    expect(dto).toMatchObject({
      source: 'MQTT',
      classification: { oeeComponent: 'quality' },
      classificationBasis: {
        oeeComponent: {
          source: 'declarative_rule',
          ruleId: 'rule-1',
          ruleVersion: 3,
        },
      },
    });
  });

  it('never runs the rules on a source revision of a known event', async () => {
    findOne.mockResolvedValue(existing);
    applySourceRevision.mockResolvedValue('revised');

    await ingest();

    expect(activeRules).not.toHaveBeenCalled();
  });

  it('returns an ambiguous frame for quarantine instead of picking a mapping', async () => {
    placement = { status: 'ambiguous', tier: 'pattern', candidates: [] };

    expect(await ingest()).toMatchObject({ outcome: 'unmapped', placement });
    expect(create).not.toHaveBeenCalled();
  });
});
