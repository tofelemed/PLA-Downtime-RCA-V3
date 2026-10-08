import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, IsNull, Repository } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../common/context/request-context';
import { scopedQuery } from '../common/query/scoped-query';
import { toDec } from '../domain/actuals/decimal';
import { IntegrationConnectionService } from '../intake/connections/integration-connection.service';
import { Product } from '../product/product.entity';
import { Unit } from '../unit/unit.entity';
import { Signal } from './entities/signal.entity';

/** A signal definition as the API hands it in (decimals as strings). */
export type NewSignal = Pick<
  Signal,
  'connectionId' | 'name' | 'sourceKey' | 'unitId' | 'semanticType'
> &
  Partial<
    Pick<
      Signal,
      | 'productId'
      | 'canonicalUom'
      | 'rateTimebase'
      | 'interpolation'
      | 'maxGapSeconds'
      | 'resetPolicy'
      | 'rolloverModulus'
      | 'expectedMin'
      | 'expectedMax'
      | 'cadenceSeconds'
      | 'qualityPolicy'
      | 'isAuthority'
    >
  > & { sourcePath?: string; effectiveFrom?: string };

/** The first version of a signal is valid from the start of time unless a start is given. */
const BEGINNING = new Date(0);
const SIGNALS_PER_JOB = 200;

/**
 * Signal definitions (plan 1.7, PI07, PI09): typed bindings of source streams to units. Creating a
 * signal for a source key that has a current version closes that version at the new start and stores
 * the next version (samples stay with the version effective at their time). Configuration that would
 * make the engine guess is refused (422): a rate without timebase, a counter with `detect_drop` and a
 * non-positive modulus, a min above the max.
 */
@Injectable()
export class SignalsService {
  constructor(
    @InjectRepository(Signal) private readonly signals: Repository<Signal>,
    @InjectRepository(Unit) private readonly units: Repository<Unit>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    private readonly connections: IntegrationConnectionService,
  ) {}

  async create(context: RequestContext, input: NewSignal): Promise<Signal> {
    const tenantId = requireTenantId(context);
    assertConsistent(input);
    await this.connections.get(context, input.connectionId);
    await this.assertUnit(tenantId, input.unitId);
    await this.assertProduct(tenantId, input.productId);
    return this.signals.manager.transaction(async (manager) => {
      const current = await manager.findOne(Signal, {
        where: {
          tenantId,
          connectionId: input.connectionId,
          sourceKey: input.sourceKey,
          effectiveTo: IsNull(),
        },
        lock: { mode: 'pessimistic_write' },
      });
      const effectiveFrom = startOf(input, current);
      if (current) await closeVersion(manager, current, effectiveFrom);
      return manager.save(
        manager.create(Signal, {
          ...definitionOf(input),
          tenantId,
          effectiveFrom,
          effectiveTo: null,
          version: (current?.version ?? 0) + 1,
          createdBy: context.userId,
          updatedBy: context.userId,
        }),
      );
    });
  }

  /** A signal of the caller's tenant (and unit scope); 404 for foreign or unknown ids. */
  async get(context: RequestContext, id: string): Promise<Signal> {
    const signal = await scopedQuery(this.signals, 's', {
      context,
      unitProperty: 'unitId',
    })
      .andWhere('s.id = :id', { id })
      .getOne();
    if (!signal) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Signal not found',
      });
    }
    return signal;
  }

  /**
   * Signals of one connection for an adapter read: the given ids (any version), or every current one;
   * at most 200 per job (D07 pilot sizing).
   */
  forConnection(
    tenantId: string,
    connectionId: string,
    ids?: string[],
  ): Promise<Signal[]> {
    return this.signals.find({
      where: ids?.length
        ? { tenantId, connectionId, id: In(ids) }
        : { tenantId, connectionId, effectiveTo: IsNull() },
      order: { createdAt: 'ASC', id: 'ASC' },
      take: SIGNALS_PER_JOB,
    });
  }

  private async assertUnit(tenantId: string, unitId: string): Promise<void> {
    const found = await this.units.exists({ where: { id: unitId, tenantId } });
    if (found) return;
    throw invalid('INVALID_REFERENCE', 'unitId is not a unit of the tenant');
  }

  private async assertProduct(
    tenantId: string,
    productId: string | null | undefined,
  ): Promise<void> {
    if (!productId) return;
    const found = await this.products.exists({
      where: { id: productId, tenantId },
    });
    if (found) return;
    throw invalid(
      'INVALID_REFERENCE',
      'productId is not a product of the tenant',
    );
  }
}

function definitionOf(input: NewSignal): Partial<Signal> {
  return {
    connectionId: input.connectionId,
    name: input.name,
    sourceKey: input.sourceKey,
    sourceBinding: {
      webId: input.sourceKey,
      ...(input.sourcePath ? { path: input.sourcePath } : {}),
    },
    unitId: input.unitId,
    productId: input.productId ?? null,
    semanticType: input.semanticType,
    canonicalUom: input.canonicalUom ?? null,
    rateTimebase: input.rateTimebase ?? null,
    interpolation: input.interpolation ?? 'step',
    maxGapSeconds: input.maxGapSeconds ?? 900,
    resetPolicy: input.resetPolicy ?? 'none',
    rolloverModulus: input.rolloverModulus ?? null,
    expectedMin: input.expectedMin ?? null,
    expectedMax: input.expectedMax ?? null,
    cadenceSeconds: input.cadenceSeconds ?? null,
    qualityPolicy: { ...(input.qualityPolicy ?? {}) },
    isAuthority: input.isAuthority ?? false,
  };
}

function assertConsistent(input: NewSignal): void {
  if (input.semanticType === 'rate' && !input.rateTimebase) {
    throw invalid(
      'RATE_TIMEBASE_REQUIRED',
      'rate signals need rateTimebase (s, min, h, d)',
    );
  }
  const modulus = toDec(input.rolloverModulus);
  if (modulus !== null && modulus.lte(0)) {
    throw invalid('INVALID_MODULUS', 'rolloverModulus must be positive');
  }
  const min = toDec(input.expectedMin);
  const max = toDec(input.expectedMax);
  if (min !== null && max !== null && min.gt(max)) {
    throw invalid('INVALID_RANGE', 'expectedMin must not exceed expectedMax');
  }
}

/** Start of a new version: given, else now (next version) or the beginning (first version). */
function startOf(input: NewSignal, current: Signal | null): Date {
  const start = input.effectiveFrom
    ? new Date(input.effectiveFrom)
    : current
      ? new Date()
      : BEGINNING;
  if (current && start <= current.effectiveFrom) {
    throw invalid(
      'INVALID_EFFECTIVE_FROM',
      'a next version must start after the current version',
    );
  }
  return start;
}

async function closeVersion(
  manager: EntityManager,
  current: Signal,
  end: Date,
): Promise<void> {
  current.effectiveTo = end;
  await manager.save(current);
}

function invalid(code: string, message: string): UnprocessableEntityException {
  return new UnprocessableEntityException({ code, message });
}
