import { RequestContext } from '../common/context/request-context';
import { AccountingPolicy } from '../periods/entities/accounting-policy.entity';
import { DemandStatusesService } from './demand-statuses.service';
import { FinanceTextCorrectionsService } from './finance-text-corrections.service';
import { FxRatesService } from './fx-rates.service';
import { ValuationPoliciesService } from './valuation-policies.service';

const TENANT = '00000000-0000-4000-8000-0000000000aa';
const ID = '00000000-0000-4000-8000-0000000000bb';

const context = (unitScoped = false): RequestContext => ({
  userId: 'u',
  tenantId: TENANT,
  organizationId: null,
  legacyRole: null,
  roles: ['finance_maintainer'],
  scopes: [
    unitScoped
      ? {
          kind: 'unit',
          id: 'unit-1',
          role: 'finance_maintainer',
          tenantId: TENANT,
        }
      : {
          kind: 'tenant',
          id: TENANT,
          role: 'finance_maintainer',
          tenantId: TENANT,
        },
  ],
  isSuperAdmin: false,
  correlationId: 'c',
});

function build(policy: Partial<AccountingPolicy> = {}) {
  const update = jest.fn().mockResolvedValue(undefined);
  const repo = { update };
  const row = { id: ID, tenantId: TENANT };
  const service = new FinanceTextCorrectionsService(
    {
      get: jest.fn().mockResolvedValue({ ...row, rate: '600000' }),
    } as unknown as FxRatesService,
    {
      get: jest.fn().mockResolvedValue(row),
    } as unknown as DemandStatusesService,
    {
      get: jest
        .fn()
        .mockResolvedValue({ ...row, backdateReason: null, ...policy }),
    } as unknown as ValuationPoliciesService,
    repo as never,
    repo as never,
    repo as never,
  );
  return { service, update };
}

describe('FinanceTextCorrectionsService (QA re-test N3)', () => {
  it('changes only the FX source text (trimmed), never the figures', async () => {
    const { service, update } = build();
    await service.fxSource(
      context(),
      ID,
      '  Planning rate agreed by finance  ',
    );
    expect(update).toHaveBeenCalledWith(
      { id: ID, tenantId: TENANT },
      { source: 'Planning rate agreed by finance' },
    );
  });

  it('changes only the demand evidence and refuses blank text', async () => {
    const { service, update } = build();
    await service.demandEvidence(context(), ID, 'Unmet orders');
    expect(update).toHaveBeenCalledWith(
      { id: ID, tenantId: TENANT },
      { evidence: 'Unmet orders' },
    );
    await expect(
      service.demandEvidence(context(), ID, '   '),
    ).rejects.toMatchObject({ response: { code: 'TEXT_REQUIRED' } });
  });

  it('corrects policy notes and the backdate reason of a backdated version only', async () => {
    const plain = build();
    await expect(
      plain.service.policyText(context(), ID, { backdateReason: 'x' }),
    ).rejects.toMatchObject({ response: { code: 'NOT_BACKDATED' } });
    await expect(
      plain.service.policyText(context(), ID, {}),
    ).rejects.toMatchObject({ response: { code: 'NOTHING_TO_CORRECT' } });
    const backdated = build({
      backdateReason: 'Commissioning (guide lesson 21)',
    });
    await backdated.service.policyText(context(), ID, {
      notes: 'Contribution margin by default',
      backdateReason: 'Commissioning',
    });
    expect(backdated.update).toHaveBeenCalledWith(
      { id: ID, tenantId: TENANT },
      {
        notes: 'Contribution margin by default',
        backdateReason: 'Commissioning',
      },
    );
  });

  it('needs a tenant-wide grant', async () => {
    const { service, update } = build();
    await expect(
      service.fxSource(context(true), ID, 'x'),
    ).rejects.toMatchObject({ response: { code: 'TENANT_SCOPE_REQUIRED' } });
    expect(update).not.toHaveBeenCalled();
  });
});
