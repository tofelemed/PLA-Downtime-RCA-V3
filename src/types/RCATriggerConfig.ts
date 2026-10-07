// RCA Trigger Configuration Types
// Defines when an event should trigger RCA investigation

export interface RCATriggerRule {
  id: string;
  name: string;
  description: string;
  eventType: 'ProductionLoss' | 'IOW' | 'SOL' | 'APM' | 'FailureWO' | 'ProductionOutput' | 'All';
  enabled: boolean;
  conditions: {
    // Severity conditions
    severities?: ('Critical' | 'High' | 'Medium' | 'Low')[];
    
    // Cost threshold
    minCost?: number;
    
    // Duration threshold (in minutes)
    minDuration?: number;
    
    // Status conditions
    statuses?: ('Open' | 'In Progress' | 'Closed' | 'Cancelled')[];
    
    // Impact code categories
    impactCategories?: string[];
    
    // OEE code categories
    oeeCategories?: string[];
    
    // Custom conditions
    requiresImpactCode?: boolean;
    requiresOEECode?: boolean;
    
    // Quality specific (for IOW)
    qualityResults?: ('Pass' | 'Fail')[];
    
    // APM specific
    apmTypes?: ('Health' | 'Prediction' | 'Alert')[];
    
    // SOL specific
    solTypes?: ('Safety' | 'Operational')[];
  };
  priority: number; // Higher number = higher priority (evaluated first)
  createdAt: string;
  updatedAt: string;
  tenantId: string;
  organizationId?: string;
}

export interface RCATriggerConfig {
  id: string;
  name: string;
  description: string;
  rules: RCATriggerRule[];
  globalSettings: {
    // Global overrides
    alwaysAllowManualCreation: boolean; // Allow users to create RCA for any event
    showWarningForLowImpact: boolean; // Show warning when creating RCA for low-impact events
    requireApprovalForLowImpact: boolean; // Require approval for RCA on minor events
    minCostThresholdGlobal?: number; // Global minimum cost (overrides all rules)
    minDurationThresholdGlobal?: number; // Global minimum duration
  };
  tenantId: string;
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  /** When true, backend auto-creates RCAs for events matching trigger rules */
  autoCreateRca?: boolean;
}

// Helper function to evaluate if an event should trigger RCA
export function shouldTriggerRCA(
  event: any,
  config: RCATriggerConfig | null
): { shouldShow: boolean; reason: string; warning?: string } {
  // If no config, use basic logic (only open events)
  if (!config || !config.isActive) {
    return {
      shouldShow: event.status === 'Open',
      reason: 'No configuration - showing only for open events'
    };
  }

  // Global settings checks
  if (config.globalSettings.minCostThresholdGlobal && (event.cost || 0) < config.globalSettings.minCostThresholdGlobal) {
    if (!config.globalSettings.alwaysAllowManualCreation) {
      return {
        shouldShow: false,
        reason: `Cost below global threshold ($${config.globalSettings.minCostThresholdGlobal})`
      };
    }
  }

  if (config.globalSettings.minDurationThresholdGlobal && (event.duration || 0) < config.globalSettings.minDurationThresholdGlobal) {
    if (!config.globalSettings.alwaysAllowManualCreation) {
      return {
        shouldShow: false,
        reason: `Duration below global threshold (${config.globalSettings.minDurationThresholdGlobal} min)`
      };
    }
  }

  // Find applicable rules (sorted by priority)
  const applicableRules = config.rules
    .filter(rule => rule.enabled)
    .filter(rule => rule.eventType === 'All' || rule.eventType === event.eventType)
    .sort((a, b) => b.priority - a.priority);

  // Evaluate each rule
  for (const rule of applicableRules) {
    const conditions = rule.conditions;
    let matches = true;
    let failureReasons: string[] = [];

    // Check severity
    if (conditions.severities && conditions.severities.length > 0) {
      if (!event.severity || !conditions.severities.includes(event.severity)) {
        matches = false;
        failureReasons.push(`Severity not in [${conditions.severities.join(', ')}]`);
      }
    }

    // Check cost
    if (conditions.minCost !== undefined) {
      if ((event.cost || 0) < conditions.minCost) {
        matches = false;
        failureReasons.push(`Cost below $${conditions.minCost}`);
      }
    }

    // Check duration
    if (conditions.minDuration !== undefined) {
      if ((event.duration || 0) < conditions.minDuration) {
        matches = false;
        failureReasons.push(`Duration below ${conditions.minDuration} min`);
      }
    }

    // Check status
    if (conditions.statuses && conditions.statuses.length > 0) {
      if (!event.status || !conditions.statuses.includes(event.status)) {
        matches = false;
        failureReasons.push(`Status not in [${conditions.statuses.join(', ')}]`);
      }
    }

    // Check quality result (for IOW)
    if (event.eventType === 'IOW' && conditions.qualityResults && conditions.qualityResults.length > 0) {
      if (!event.qualityResult || !conditions.qualityResults.includes(event.qualityResult)) {
        matches = false;
        failureReasons.push(`Quality result not in [${conditions.qualityResults.join(', ')}]`);
      }
    }

    // Check APM type (for APM)
    if (event.eventType === 'APM' && conditions.apmTypes && conditions.apmTypes.length > 0) {
      if (!event.apmType || !conditions.apmTypes.includes(event.apmType)) {
        matches = false;
        failureReasons.push(`APM type not in [${conditions.apmTypes.join(', ')}]`);
      }
    }

    // Check SOL type (for SOL)
    if (event.eventType === 'SOL' && conditions.solTypes && conditions.solTypes.length > 0) {
      if (!event.solType || !conditions.solTypes.includes(event.solType)) {
        matches = false;
        failureReasons.push(`SOL type not in [${conditions.solTypes.join(', ')}]`);
      }
    }

    // Check if impact code required
    if (conditions.requiresImpactCode && !event.impactCodeId) {
      matches = false;
      failureReasons.push('Impact code required');
    }

    // Check if OEE code required
    if (conditions.requiresOEECode && !event.oeeCodeId) {
      matches = false;
      failureReasons.push('OEE code required');
    }

    // If this rule matches, return true
    if (matches) {
      return {
        shouldShow: true,
        reason: `Matched rule: ${rule.name}`,
        warning: config.globalSettings.showWarningForLowImpact && (event.cost || 0) < 25000 
          ? 'This is a relatively low-impact event. Consider if RCA is necessary.' 
          : undefined
      };
    }
  }

  // No rules matched
  if (config.globalSettings.alwaysAllowManualCreation) {
    return {
      shouldShow: true,
      reason: 'Manual creation allowed by global settings',
      warning: 'This event does not meet automatic RCA criteria. Proceed only if necessary.'
    };
  }

  return {
    shouldShow: false,
    reason: 'Does not meet any RCA trigger criteria'
  };
}

// Default configurations for different industries
export const DEFAULT_RCA_TRIGGER_CONFIGS = {
  OilAndGas: {
    name: 'Oil & Gas Industry Standard',
    description: 'Standard RCA trigger criteria for oil and gas operations',
    globalSettings: {
      alwaysAllowManualCreation: true,
      showWarningForLowImpact: true,
      requireApprovalForLowImpact: false,
      minCostThresholdGlobal: 10000, // $10k minimum
      minDurationThresholdGlobal: 60, // 1 hour minimum
    },
    rules: [
      {
        id: 'rule-safety-critical',
        name: 'Safety Critical Events',
        description: 'All safety-related incidents require RCA',
        eventType: 'SOL' as const,
        enabled: true,
        conditions: {
          solTypes: ['Safety'],
          severities: ['Critical', 'High', 'Medium'],
        },
        priority: 100,
      },
      {
        id: 'rule-high-cost',
        name: 'High Cost Events',
        description: 'Events with significant financial impact',
        eventType: 'All' as const,
        enabled: true,
        conditions: {
          minCost: 100000, // $100k
        },
        priority: 90,
      },
      {
        id: 'rule-critical-severity',
        name: 'Critical Severity',
        description: 'All critical severity events',
        eventType: 'All' as const,
        enabled: true,
        conditions: {
          severities: ['Critical'],
        },
        priority: 85,
      },
      {
        id: 'rule-long-downtime',
        name: 'Extended Downtime',
        description: 'Unplanned downtime exceeding 4 hours',
        eventType: 'ProductionLoss' as const,
        enabled: true,
        conditions: {
          minDuration: 240, // 4 hours
          statuses: ['Open', 'In Progress', 'Closed'],
        },
        priority: 80,
      },
      {
        id: 'rule-equipment-failure',
        name: 'Equipment Failures',
        description: 'Significant equipment failures requiring investigation',
        eventType: 'FailureWO' as const,
        enabled: true,
        conditions: {
          severities: ['Critical', 'High'],
          minCost: 50000, // $50k
        },
        priority: 75,
      },
      {
        id: 'rule-quality-failure',
        name: 'Quality Failures',
        description: 'Failed quality inspections',
        eventType: 'IOW' as const,
        enabled: true,
        conditions: {
          qualityResults: ['Fail'],
          severities: ['High', 'Critical'],
        },
        priority: 70,
      },
      {
        id: 'rule-predictive-alert',
        name: 'Predictive Alerts',
        description: 'Critical predictive maintenance alerts',
        eventType: 'APM' as const,
        enabled: true,
        conditions: {
          apmTypes: ['Prediction', 'Alert'],
          severities: ['Critical', 'High'],
        },
        priority: 65,
      },
    ],
  },
  Cement: {
    name: 'Cement Industry Standard',
    description: 'Standard RCA trigger criteria for cement manufacturing',
    globalSettings: {
      alwaysAllowManualCreation: true,
      showWarningForLowImpact: true,
      requireApprovalForLowImpact: false,
      minCostThresholdGlobal: 5000,
      minDurationThresholdGlobal: 30,
    },
    rules: [
      // Similar structure but with cement-specific thresholds
      {
        id: 'rule-kiln-issues',
        name: 'Kiln Critical Issues',
        description: 'Any kiln-related critical events',
        eventType: 'ProductionLoss' as const,
        enabled: true,
        conditions: {
          severities: ['Critical', 'High'],
          minDuration: 120, // 2 hours for kiln
        },
        priority: 100,
      },
      // ... more cement-specific rules
    ],
  },
};

