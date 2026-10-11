/**
 * Unified Analytics Service
 * Provides consistent calculation methods for production analytics across all pages
 * Ensures Dashboard and PLA Analytics show aligned metrics
 */

import { ProductionEvent, ProductionPlan } from '../MasterDataService';

export interface CostCalculationConfig {
  // Cost per hour by severity level
  criticalCostPerHour: number;
  highCostPerHour: number;
  mediumCostPerHour: number;
  lowCostPerHour: number;
  minimumCost: number;
  maxDurationHours: number; // Cap for unrealistic durations
}

export interface OEEMetrics {
  availability: number;
  performance: number;
  quality: number;
  overallOEE: number;
  totalDowntimeHours: number;
  totalCostUSD: number;
  oeeImpactPercent: number; // Loss as percentage of available time
}

export interface AnalyticsSummary {
  totalLossMinutes: number;
  totalLossHours: number;
  eventCount: number;
  totalCost: number;
  avgDurationMinutes: number;
  criticalEvents: number;
  highSeverityEvents: number;
  mediumSeverityEvents: number;
  lowSeverityEvents: number;
  openEvents: number;
  inProgressEvents: number;
  closedEvents: number;
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
  label: string;
}

/**
 * Default cost configuration - standardized across all analytics
 */
export const DEFAULT_COST_CONFIG: CostCalculationConfig = {
  criticalCostPerHour: 5000,  // $5,000/hour for critical events
  highCostPerHour: 3000,      // $3,000/hour for high severity
  mediumCostPerHour: 1500,    // $1,500/hour for medium severity
  lowCostPerHour: 500,        // $500/hour for low severity
  minimumCost: 500,           // Minimum cost per event
  maxDurationHours: 24        // Cap at 24 hours to prevent skewed calculations
};

/**
 * Unified Analytics Service Class
 */
export class UnifiedAnalyticsService {
  private costConfig: CostCalculationConfig;

  constructor(costConfig: CostCalculationConfig = DEFAULT_COST_CONFIG) {
    this.costConfig = costConfig;
  }

  /**
   * Calculate event duration in minutes
   * Handles both duration field and start/end time calculation
   */
  getEventDuration(event: ProductionEvent): number {
    // First check if duration is already provided
    let duration = Number(event.duration) || 0;
    
    // If no duration, calculate from start/end times
    if (duration === 0 && event.startTime && event.endTime) {
      const startTime = new Date(event.startTime).getTime();
      const endTime = new Date(event.endTime).getTime();
      duration = Math.max((endTime - startTime) / (1000 * 60), 0); // Convert to minutes
    }
    
    // Cap unrealistic durations
    const maxDurationMinutes = this.costConfig.maxDurationHours * 60;
    const cappedDuration = Math.min(duration, maxDurationMinutes);
    
    // Log warning for unrealistic durations
    if (duration > maxDurationMinutes) {
      console.warn('Unrealistic event duration detected and capped:', {
        eventId: event.id,
        originalDuration: duration,
        cappedDuration: cappedDuration,
        maxAllowed: maxDurationMinutes
      });
    }
    
    return cappedDuration;
  }

  /**
   * Calculate event cost using standardized formula
   */
  getEventCost(event: ProductionEvent & { costImpact?: number }): number {
    // Check if cost is already provided
    const existingCost = Number(event.cost) || Number(event.costImpact) || 0;
    if (existingCost > 0) {
      return existingCost;
    }
    
    // Calculate cost based on duration and severity
    const durationMinutes = this.getEventDuration(event);
    const durationHours = durationMinutes / 60;
    
    // Get cost per hour based on severity
    const severity = event.severity || 'Medium';
    let costPerHour: number;
    
    switch (severity) {
      case 'Critical':
        costPerHour = this.costConfig.criticalCostPerHour;
        break;
      case 'High':
        costPerHour = this.costConfig.highCostPerHour;
        break;
      case 'Medium':
        costPerHour = this.costConfig.mediumCostPerHour;
        break;
      case 'Low':
        costPerHour = this.costConfig.lowCostPerHour;
        break;
      default:
        costPerHour = this.costConfig.mediumCostPerHour;
    }
    
    // Calculate total cost with minimum threshold
    const estimatedCost = Math.max(
      durationHours * costPerHour,
      this.costConfig.minimumCost
    );
    
    return Math.round(estimatedCost);
  }

  /**
   * Calculate comprehensive analytics summary
   */
  calculateSummary(events: ProductionEvent[]): AnalyticsSummary {
    let totalLossMinutes = 0;
    let totalCost = 0;
    let criticalEvents = 0;
    let highSeverityEvents = 0;
    let mediumSeverityEvents = 0;
    let lowSeverityEvents = 0;
    let openEvents = 0;
    let inProgressEvents = 0;
    let closedEvents = 0;

    events.forEach(event => {
      // Duration
      totalLossMinutes += this.getEventDuration(event);
      
      // Cost
      totalCost += this.getEventCost(event);
      
      // Severity counts
      switch (event.severity) {
        case 'Critical':
          criticalEvents++;
          break;
        case 'High':
          highSeverityEvents++;
          break;
        case 'Medium':
          mediumSeverityEvents++;
          break;
        case 'Low':
          lowSeverityEvents++;
          break;
      }
      
      // Status counts
      switch (event.status) {
        case 'Open':
          openEvents++;
          break;
        case 'In Progress':
          inProgressEvents++;
          break;
        case 'Closed':
          closedEvents++;
          break;
      }
    });

    const eventCount = events.length;
    const avgDurationMinutes = eventCount > 0 ? totalLossMinutes / eventCount : 0;
    const totalLossHours = totalLossMinutes / 60;

    return {
      totalLossMinutes,
      totalLossHours,
      eventCount,
      totalCost,
      avgDurationMinutes,
      criticalEvents,
      highSeverityEvents,
      mediumSeverityEvents,
      lowSeverityEvents,
      openEvents,
      inProgressEvents,
      closedEvents
    };
  }

  /**
   * Calculate OEE metrics from events
   */
  calculateOEEMetrics(
    events: ProductionEvent[],
    dateRange?: DateRange
  ): OEEMetrics {
    if (!events.length) {
      return {
        availability: 95,
        performance: 94,
        quality: 98,
        overallOEE: 87.0,
        totalDowntimeHours: 0,
        totalCostUSD: 0,
        oeeImpactPercent: 0
      };
    }

    // Calculate total downtime
    const summary = this.calculateSummary(events);
    const totalDowntimeHours = summary.totalLossHours;
    const totalCost = summary.totalCost;

    // Calculate available time for OEE impact calculation
    let availableTimeHours = 720; // Default 30 days * 24 hours
    if (dateRange) {
      const timeDiff = dateRange.endDate.getTime() - dateRange.startDate.getTime();
      availableTimeHours = timeDiff / (1000 * 60 * 60);
    }

    // Calculate OEE components
    const baseAvailability = 95;
    const basePerformance = 94;
    const baseQuality = 98;

    // Impact factors
    const downtimeImpact = Math.min(totalDowntimeHours * 2, 10); // Max 10% impact
    const availability = Math.max(baseAvailability - downtimeImpact, 70);
    const performance = Math.max(basePerformance - (totalDowntimeHours * 1.5), 80);
    const quality = Math.max(baseQuality - (events.length * 0.5), 90);
    
    // Overall OEE = Availability × Performance × Quality
    const overallOEE = (availability * performance * quality) / 10000;

    // OEE Impact as percentage of available time lost
    const oeeImpactPercent = Math.min((totalDowntimeHours / availableTimeHours) * 100, 100);

    return {
      availability: Math.round(availability * 10) / 10,
      performance: Math.round(performance * 10) / 10,
      quality: Math.round(quality * 10) / 10,
      overallOEE: Math.round(overallOEE * 10) / 10,
      totalDowntimeHours: Math.round(totalDowntimeHours * 10) / 10,
      totalCostUSD: Math.round(totalCost),
      oeeImpactPercent: Math.round(oeeImpactPercent * 10) / 10
    };
  }

  /**
   * Filter events by date range
   */
  filterEventsByDateRange(
    events: ProductionEvent[],
    startDate: Date,
    endDate: Date
  ): ProductionEvent[] {
    const startTime = startDate.getTime();
    const endTime = endDate.getTime();

    return events.filter(event => {
      if (!event.startTime) return false;
      const eventTime = new Date(event.startTime).getTime();
      return eventTime >= startTime && eventTime <= endTime;
    });
  }

  /**
   * Get predefined date ranges
   * Uses consistent start/end of day for deterministic results across all pages
   */
  static getDateRanges(): Record<string, DateRange> {
    const now = new Date();
    // Use end of current day for consistency (23:59:59)
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    // Use start of day (00:00:00)
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    
    return {
      today: {
        startDate: startOfToday,
        endDate: endOfToday,
        label: 'Today'
      },
      yesterday: {
        startDate: new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000),
        endDate: new Date(startOfToday.getTime() - 1), // End of yesterday
        label: 'Yesterday'
      },
      last7Days: {
        // Start 7 days ago at 00:00:00, end today at 23:59:59
        startDate: new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000),
        endDate: endOfToday,
        label: 'Last 7 Days'
      },
      last30Days: {
        startDate: new Date(startOfToday.getTime() - 30 * 24 * 60 * 60 * 1000),
        endDate: endOfToday,
        label: 'Last 30 Days'
      },
      last90Days: {
        startDate: new Date(startOfToday.getTime() - 90 * 24 * 60 * 60 * 1000),
        endDate: endOfToday,
        label: 'Last 90 Days'
      },
      thisMonth: {
        startDate: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0),
        endDate: endOfToday,
        label: 'This Month'
      },
      lastMonth: {
        startDate: new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0),
        endDate: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999),
        label: 'Last Month'
      },
      thisYear: {
        startDate: new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0),
        endDate: endOfToday,
        label: 'This Year'
      },
      allTime: {
        startDate: new Date(2020, 0, 1, 0, 0, 0, 0), // Reasonable start date
        endDate: endOfToday,
        label: 'All Time'
      }
    };
  }

  /**
   * Format duration for display
   */
  static formatDuration(minutes: number): string {
    if (minutes < 60) {
      return `${Math.round(minutes)}m`;
    }
    
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    
    if (hours < 24) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    
    if (remainingHours === 0) {
      return `${days}d`;
    }
    
    return `${days}d ${remainingHours}h`;
  }

  /**
   * Format cost for display
   */
  static formatCost(cost: number): string {
    if (cost >= 1000000) {
      return `$${(cost / 1000000).toFixed(1)}M`;
    }
    if (cost >= 1000) {
      return `$${(cost / 1000).toFixed(1)}K`;
    }
    return `$${Math.round(cost)}`;
  }
}

// Export singleton instance
export const unifiedAnalyticsService = new UnifiedAnalyticsService();
