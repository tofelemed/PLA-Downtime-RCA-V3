import {
  RCATriggerConfig,
  RCATriggerRuleModel,
} from '../rca-trigger-config/rca-trigger-config.entity';
import { ProductionEvent } from '../production-event/production-event.entity';

export interface RcaTriggerEvaluation {
  matched: boolean;
  ruleName?: string;
  reason: string;
}

/** Evaluate whether an event matches trigger rules (strict — no manual-creation fallback). */
export function evaluateRcaTriggerRules(
  event: ProductionEvent | Record<string, any>,
  config: RCATriggerConfig | null,
): RcaTriggerEvaluation {
  if (!config || !config.isActive) {
    return { matched: false, reason: 'No active trigger configuration' };
  }

  const globals = config.globalSettings ?? {
    alwaysAllowManualCreation: true,
    showWarningForLowImpact: true,
    requireApprovalForLowImpact: false,
  };

  const cost = Number(event.cost) || 0;
  const duration = Number(event.duration) || computeDurationMinutes(event);

  if (globals.minCostThresholdGlobal !== undefined && cost < globals.minCostThresholdGlobal) {
    return {
      matched: false,
      reason: `Cost below global threshold ($${globals.minCostThresholdGlobal})`,
    };
  }

  if (
    globals.minDurationThresholdGlobal !== undefined &&
    duration < globals.minDurationThresholdGlobal
  ) {
    return {
      matched: false,
      reason: `Duration below global threshold (${globals.minDurationThresholdGlobal} min)`,
    };
  }

  const applicableRules = (config.rules ?? [])
    .filter((rule) => rule.enabled)
    .filter((rule) => rule.eventType === 'All' || rule.eventType === event.eventType)
    .sort((a, b) => b.priority - a.priority);

  for (const rule of applicableRules) {
    if (ruleMatches(event, rule, duration)) {
      return {
        matched: true,
        ruleName: rule.name,
        reason: `Matched rule: ${rule.name}`,
      };
    }
  }

  return { matched: false, reason: 'No trigger rules matched' };
}

function computeDurationMinutes(event: ProductionEvent | Record<string, any>): number {
  if (event.duration !== undefined && event.duration !== null) {
    return Number(event.duration) || 0;
  }
  const start = event.startTime ? new Date(event.startTime).getTime() : NaN;
  const end = event.endTime ? new Date(event.endTime).getTime() : NaN;
  if (!Number.isNaN(start) && !Number.isNaN(end) && end > start) {
    return Math.round((end - start) / 60000);
  }
  return 0;
}

function ruleMatches(
  event: ProductionEvent | Record<string, any>,
  rule: RCATriggerRuleModel,
  durationMinutes: number,
): boolean {
  const e = event as Record<string, any>;
  const conditions = rule.conditions ?? {};
  const cost = Number(event.cost) || 0;

  if (conditions.severities?.length) {
    if (!event.severity || !conditions.severities.includes(event.severity)) {
      return false;
    }
  }

  if (conditions.minCost !== undefined && cost < conditions.minCost) {
    return false;
  }

  if (conditions.minDuration !== undefined && durationMinutes < conditions.minDuration) {
    return false;
  }

  if (conditions.statuses?.length) {
    if (!event.status || !conditions.statuses.includes(event.status)) {
      return false;
    }
  }

  if (event.eventType === 'IOW' && conditions.qualityResults?.length) {
    if (!e.qualityResult || !conditions.qualityResults.includes(e.qualityResult)) {
      return false;
    }
  }

  if (event.eventType === 'APM' && conditions.apmTypes?.length) {
    if (!event.apmType || !conditions.apmTypes.includes(event.apmType)) {
      return false;
    }
  }

  if (event.eventType === 'SOL' && conditions.solTypes?.length) {
    if (!event.solType || !conditions.solTypes.includes(event.solType)) {
      return false;
    }
  }

  if (conditions.requiresImpactCode && !event.impactCodeId) {
    return false;
  }

  if (conditions.requiresOEECode && !event.oeeCodeId) {
    return false;
  }

  return true;
}

export function mapEventSeverityToRcaPriority(
  severity?: string,
): 'Low' | 'Medium' | 'High' | 'Critical' {
  switch (severity) {
    case 'Critical':
      return 'Critical';
    case 'High':
      return 'High';
    case 'Medium':
      return 'Medium';
    default:
      return 'Medium';
  }
}
