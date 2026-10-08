import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReasonCode } from '../reason-code/reason-code.entity';
import { CodeDefaults, CodeDrivenAxis } from './classification-basis';
import { CodeMappingRuleKind } from './code-library-kind';
import { CodeMappingRule } from './code-mapping-rule.entity';

const REASON_RULE_AXES: ReadonlyArray<[CodeMappingRuleKind, CodeDrivenAxis]> = [
  ['reason_to_schedule_class', 'scheduleClass'],
  ['reason_to_oee', 'oeeComponent'],
  ['reason_to_impact', 'impactCodeId'],
];

/**
 * Classification defaults of a reason code at an instant (spec §3.2, plan 1.3 step 5): the
 * `code_mapping_rules` version in force wins; otherwise the reason code's own default columns.
 */
@Injectable()
export class CodeDefaultsService {
  constructor(
    @InjectRepository(CodeMappingRule)
    private readonly rules: Repository<CodeMappingRule>,
    @InjectRepository(ReasonCode)
    private readonly reasons: Repository<ReasonCode>,
  ) {}

  async defaultsFor(
    tenantId: string,
    reasonCodeId: string,
    at: Date,
  ): Promise<CodeDefaults> {
    const reason = await this.reasons.findOne({
      where: { id: reasonCodeId, tenantId },
    });
    if (!reason) return {};
    const defaults: CodeDefaults = codeColumnDefaults(reason);
    for (const rule of await this.rulesInForce(tenantId, reasonCodeId, at)) {
      const axis = REASON_RULE_AXES.find(([kind]) => kind === rule.ruleKind);
      const value = rule.targetCodeId ?? rule.targetValue;
      if (!axis || !value) continue;
      defaults[axis[1]] = {
        value,
        source: 'code_rule',
        ruleId: rule.id,
        ruleVersion: rule.version,
      };
    }
    return defaults;
  }

  /** Highest version per rule kind whose interval contains `at`. */
  rulesInForce(
    tenantId: string,
    sourceCodeId: string,
    at: Date,
  ): Promise<CodeMappingRule[]> {
    return this.rules
      .createQueryBuilder('rule')
      .distinctOn(['rule.ruleKind'])
      .where('rule.tenantId = :tenantId', { tenantId })
      .andWhere('rule.sourceCodeId = :sourceCodeId', { sourceCodeId })
      .andWhere('rule.effectiveFrom <= :at', { at })
      .andWhere('(rule.effectiveTo IS NULL OR rule.effectiveTo > :at)', { at })
      .orderBy('rule.ruleKind', 'ASC')
      .addOrderBy('rule.version', 'DESC')
      .getMany();
  }
}

function codeColumnDefaults(reason: ReasonCode): CodeDefaults {
  const defaults: CodeDefaults = {};
  const columns: Array<[CodeDrivenAxis, string | null | undefined]> = [
    ['scheduleClass', reason.defaultScheduleClass],
    ['oeeComponent', reason.defaultOeeComponent],
    ['impactCodeId', reason.defaultImpactCodeId],
  ];
  for (const [axis, value] of columns) {
    if (value) {
      defaults[axis] = {
        value,
        source: 'code_default',
        ruleId: null,
        ruleVersion: null,
      };
    }
  }
  return defaults;
}
