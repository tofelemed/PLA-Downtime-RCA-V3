import { DashboardSettingsDto } from './dashboard-config-v2.dto';

/**
 * Defaults of the plant dashboard settings (moved from the browser's `getDefaultDashboardConfiguration`,
 * which wrote them on page render). Returned while a plant stores none; "Reset to defaults" deletes the
 * stored settings so the plant follows these again. The v1 constants nothing read (OEE weights, loss
 * value per unit, default unaccounted %) were removed (FE-02); stored rows may still hold them and are
 * filtered to these keys on read.
 */
export const DASHBOARD_DEFAULTS: DashboardSettingsDto = {
  oee: {
    targetOEE: 85,
    targetAvailability: 90,
    targetPerformance: 95,
    targetQuality: 99,
  },
  losses: {
    highLossThreshold: 10,
    criticalLossThreshold: 20,
    defaultLossCategories: [
      'Downtime',
      'Breakdown',
      'Setup',
      'Quality',
      'Other',
    ],
  },
  costs: {
    costCalculationMethod: 'perUnit',
    defaultCostPerUnit: 50,
    defaultCostPerHour: 1000,
    highCostThreshold: 10000,
    criticalCostThreshold: 50000,
  },
  bottleneckRisk: {
    lossWeight: 0.4,
    costWeight: 0.3,
    oeeWeight: 0.3,
    lowRiskThreshold: 0.3,
    mediumRiskThreshold: 0.6,
    highRiskThreshold: 0.8,
  },
  display: {
    showOEE: true,
    showLosses: true,
    showCosts: true,
    showCapacity: true,
    showActions: true,
    decimalPlaces: 1,
    currencySymbol: '$',
    numberFormat: 'en-US',
    theme: 'default',
  },
  performance: {
    defaultIdealCycleTime: 6,
    performanceCalculationMethod: 'cycleTime',
    lowPerformanceThreshold: 70,
    highPerformanceThreshold: 95,
  },
  quality: {
    qualityCalculationMethod: 'defects',
    lowQualityThreshold: 95,
    highQualityThreshold: 99.5,
  },
  availability: {
    availabilityCalculationMethod: 'uptime',
    lowAvailabilityThreshold: 80,
    highAvailabilityThreshold: 95,
  },
};

export type DashboardSection = keyof DashboardSettingsDto;
export const DASHBOARD_SECTIONS = Object.keys(
  DASHBOARD_DEFAULTS,
) as DashboardSection[];
