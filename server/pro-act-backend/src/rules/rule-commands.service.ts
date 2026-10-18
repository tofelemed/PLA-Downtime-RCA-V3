import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { assertRevision } from '../common/concurrency/revision';
import {
  RequestContext,
  requireTenantId,
  tenantRequired,
} from '../common/context/request-context';
import { assertTenantWideWriter } from '../profiles/profile-scope';
import { RuleKind } from './grammar/rule-catalog';
import { RuleDefinition } from './grammar/rule-definition';
import {
  RuleFieldError,
  validateRuleDefinition,
} from './grammar/rule-validator';
import { Rule } from './entities/rule.entity';
import { RuleVersion } from './entities/rule-version.entity';
import {
  noDraft,
  rollbackToCurrent,
  ruleExists,
  ruleInvalid,
  ruleNotFound,
  ruleRetired,
  separationOfDuties,
  versionNotFound,
} from './rule-errors';
import { assertRuleReferences } from './rule-references';

export interface NewRule {
  kind: RuleKind;
  name: string;
  description?: string | null;
  priority?: number;
  definition: unknown;
}

export interface RuleDraftChange {
  name?: string;
  description?: string | null;
  priority?: number;
  definition?: unknown;
}

export interface RuleTarget {
  id: string;
  expectedRowVersion: number;
}

export interface RuleCheck {
  valid: boolean;
  fieldErrors: RuleFieldError[];
  conditionCount: number | null;
}

const UNIQUE_VIOLATION = '23505';

/** The authenticated user of a write (approvals are always attributable). */
function actorOf(context: RequestContext): string {
  if (!context.userId) throw tenantRequired();
  return context.userId;
}

function isUniqueViolation(error: unknown): boolean {
  const withCode = error as {
    code?: unknown;
    driverError?: { code?: unknown };
  };
  return (
    withCode?.code === UNIQUE_VIOLATION ||
    withCode?.driverError?.code === UNIQUE_VIOLATION
  );
}

/**
 * Writes of declarative rules (plan 3.8, NFR02). Rules are tenant-wide, so every write needs a
 * tenant-wide grant (403 TENANT_SCOPE_REQUIRED). Definitions are validated server-side (schema +
 * semantics + tenant references) before they are stored; drafts are edited in place under If-Match,
 * activation and rollback only append immutable `rule_versions` rows; the author of a draft cannot
 * activate it (403 SEPARATION_OF_DUTIES).
 */
@Injectable()
export class RuleCommandsService {
  constructor(@InjectEntityManager() private readonly manager: EntityManager) {}

  /** Validation as the write endpoints apply it, without storing anything (live builder feedback). */
  async check(
    context: RequestContext,
    kind: RuleKind,
    candidate: unknown,
  ): Promise<RuleCheck> {
    const result = validateRuleDefinition(kind, candidate);
    if (!result.valid)
      return {
        valid: false,
        fieldErrors: result.fieldErrors,
        conditionCount: null,
      };
    try {
      await assertRuleReferences(
        this.manager,
        requireTenantId(context),
        result.definition,
      );
    } catch (error) {
      if (!(error instanceof UnprocessableEntityException)) throw error;
      const body = error.getResponse() as { fieldErrors: RuleFieldError[] };
      return {
        valid: false,
        fieldErrors: body.fieldErrors,
        conditionCount: result.conditionCount,
      };
    }
    return {
      valid: true,
      fieldErrors: [],
      conditionCount: result.conditionCount,
    };
  }

  async create(context: RequestContext, input: NewRule): Promise<Rule> {
    const tenantId = this.writerTenant(context);
    const definition = await this.validDefinition(
      tenantId,
      input.kind,
      input.definition,
    );
    const now = new Date();
    try {
      return await this.manager.save(
        this.manager.create(Rule, {
          tenantId,
          kind: input.kind,
          name: input.name.trim(),
          description: input.description?.trim() || null,
          priority: input.priority ?? 100,
          state: 'draft',
          activeVersion: null,
          draftDefinition: definition,
          draftAuthor: context.userId,
          draftUpdatedAt: now,
          retiredAt: null,
          createdBy: context.userId,
          updatedBy: context.userId,
        }),
      );
    } catch (error) {
      if (isUniqueViolation(error)) throw ruleExists(input.name.trim());
      throw error;
    }
  }

  /** Changes the draft and descriptive fields; the version in force is untouched until activation. */
  async update(
    context: RequestContext,
    target: RuleTarget,
    change: RuleDraftChange,
  ): Promise<Rule> {
    const tenantId = this.writerTenant(context);
    return this.locked(tenantId, target, async (manager, rule) => {
      if (rule.state === 'retired') throw ruleRetired();
      if (change.definition !== undefined) {
        rule.draftDefinition = await this.validDefinition(
          tenantId,
          rule.kind,
          change.definition,
        );
        rule.draftAuthor = context.userId;
        rule.draftUpdatedAt = new Date();
      }
      if (change.name !== undefined) rule.name = change.name.trim();
      if (change.description !== undefined)
        rule.description = change.description?.trim() || null;
      if (change.priority !== undefined) rule.priority = change.priority;
      rule.updatedBy = context.userId;
      try {
        return await manager.save(rule);
      } catch (error) {
        if (isUniqueViolation(error)) throw ruleExists(rule.name);
        throw error;
      }
    });
  }

  /** The draft becomes the next version and the one in force (a second person approves it). */
  async activate(
    context: RequestContext,
    target: RuleTarget,
    reason?: string,
  ): Promise<Rule> {
    const tenantId = this.writerTenant(context);
    return this.locked(tenantId, target, async (manager, rule) => {
      if (rule.state === 'retired') throw ruleRetired();
      if (!rule.draftDefinition) throw noDraft();
      if (
        !context.isSuperAdmin &&
        rule.draftAuthor &&
        rule.draftAuthor === context.userId
      )
        throw separationOfDuties();
      const definition = await this.validDefinition(
        tenantId,
        rule.kind,
        rule.draftDefinition,
      );
      const version = await this.appendVersion(manager, rule, {
        definition,
        origin: 'activation',
        restoredVersion: null,
        authoredBy: rule.draftAuthor,
        approvedBy: actorOf(context),
        reason: reason?.trim() || null,
      });
      Object.assign(rule, {
        state: 'active',
        activeVersion: version,
        draftDefinition: null,
        draftAuthor: null,
        draftUpdatedAt: null,
        updatedBy: context.userId,
      });
      return manager.save(rule);
    });
  }

  /** Restores the definition of an earlier version as a new version (history is never rewritten). */
  async rollback(
    context: RequestContext,
    target: RuleTarget,
    toVersion: number,
    reason?: string,
  ): Promise<Rule> {
    const tenantId = this.writerTenant(context);
    return this.locked(tenantId, target, async (manager, rule) => {
      if (rule.state === 'retired') throw ruleRetired();
      const source = await manager.findOne(RuleVersion, {
        where: { tenantId, ruleId: rule.id, version: toVersion },
      });
      if (!source) throw versionNotFound(toVersion);
      if (rule.state === 'active' && rule.activeVersion === toVersion)
        throw rollbackToCurrent();
      const version = await this.appendVersion(manager, rule, {
        definition: source.definition,
        origin: 'rollback',
        restoredVersion: toVersion,
        authoredBy: source.authoredBy,
        approvedBy: actorOf(context),
        reason: reason?.trim() || null,
      });
      Object.assign(rule, {
        state: 'active',
        activeVersion: version,
        updatedBy: context.userId,
      });
      return manager.save(rule);
    });
  }

  /** Stops applying the rule; its versions and simulations stay. */
  async retire(context: RequestContext, target: RuleTarget): Promise<Rule> {
    const tenantId = this.writerTenant(context);
    return this.locked(tenantId, target, async (manager, rule) => {
      if (rule.state === 'retired') throw ruleRetired();
      Object.assign(rule, {
        state: 'retired',
        retiredAt: new Date(),
        updatedBy: context.userId,
      });
      return manager.save(rule);
    });
  }

  private writerTenant(context: RequestContext): string {
    const tenantId = requireTenantId(context);
    assertTenantWideWriter(context, tenantId);
    return tenantId;
  }

  private async validDefinition(
    tenantId: string,
    kind: RuleKind,
    candidate: unknown,
  ): Promise<RuleDefinition> {
    const result = validateRuleDefinition(kind, candidate);
    if (!result.valid) throw ruleInvalid(result.fieldErrors);
    await assertRuleReferences(this.manager, tenantId, result.definition);
    return result.definition;
  }

  /** Runs `work` on the rule row locked FOR UPDATE after the If-Match check (412 when stale). */
  private locked<T>(
    tenantId: string,
    target: RuleTarget,
    work: (manager: EntityManager, rule: Rule) => Promise<T>,
  ): Promise<T> {
    return this.manager.transaction(async (manager) => {
      const rule = await manager
        .getRepository(Rule)
        .createQueryBuilder('rule')
        .setLock('pessimistic_write')
        .where('rule.id = :id AND rule.tenantId = :tenantId', {
          id: target.id,
          tenantId,
        })
        .getOne();
      if (!rule) throw ruleNotFound();
      assertRevision(rule.rowVersion, target.expectedRowVersion);
      return work(manager, rule);
    });
  }

  private async appendVersion(
    manager: EntityManager,
    rule: Rule,
    row: Pick<
      RuleVersion,
      | 'definition'
      | 'origin'
      | 'restoredVersion'
      | 'authoredBy'
      | 'approvedBy'
      | 'reason'
    >,
  ): Promise<number> {
    const latest: Array<{ max: number | null }> = await manager.query(
      'SELECT max("version")::int AS max FROM "rule_versions" WHERE "rule_id" = $1',
      [rule.id],
    );
    const version = (latest[0]?.max ?? 0) + 1;
    await manager.save(
      manager.create(RuleVersion, {
        ...row,
        tenantId: rule.tenantId,
        ruleId: rule.id,
        version,
        effectiveFrom: new Date(),
        createdBy: row.approvedBy,
        updatedBy: row.approvedBy,
      }),
    );
    return version;
  }
}
