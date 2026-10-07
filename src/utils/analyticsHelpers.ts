// Analytics Helper Utilities
// This file provides consistent utilities for displaying user-friendly names in analytics

import { Unit, Asset, ImpactCode, OEECode } from '../services/MasterDataService';

/**
 * Helper function to get unit name from ID
 */
export const getUnitName = (unitId: string | undefined, units: Unit[]): string => {
  if (!unitId) return 'Unknown Unit';
  const unit = units.find(u => u.id === unitId);
  
  
  return unit ? unit.name : unitId;
};

/**
 * Helper function to get asset name from ID
 */
export const getAssetName = (assetId: string | undefined, assets: Asset[]): string => {
  if (!assetId) return 'Unknown Asset';
  const asset = assets.find(a => a.id === assetId);
  return asset ? asset.name : assetId;
};

/**
 * Helper function to get impact code name from ID
 */
export const getImpactCodeName = (impactCodeId: string | undefined, impactCodes: ImpactCode[]): string => {
  if (!impactCodeId) return 'Unknown Impact Code';
  const impactCode = impactCodes.find(ic => ic.id === impactCodeId);
  return impactCode ? impactCode.name : impactCodeId;
};

/**
 * Helper function to get OEE code name from ID
 */
export const getOEECodeName = (oeeCodeId: string | undefined, oeeCodes: OEECode[]): string => {
  if (!oeeCodeId) return 'Unknown OEE Code';
  const oeeCode = oeeCodes.find(oc => oc.id === oeeCodeId);
  return oeeCode ? oeeCode.name : oeeCodeId;
};

/**
 * Helper function to format analytics data with user-friendly names
 */
export const formatAnalyticsData = (data: any, context: {
  units: Unit[];
  assets: Asset[];
  impactCodes: ImpactCode[];
  oeeCodes: OEECode[];
}) => {
  if (!data) return data;

  // Handle arrays of events
  if (Array.isArray(data)) {
    return data.map(item => formatAnalyticsData(item, context));
  }

  // Handle single event object
  if (typeof data === 'object') {
    const formatted = { ...data };
    
    if (formatted.unitId) {
      formatted.unitName = getUnitName(formatted.unitId, context.units);
    }
    
    if (formatted.assetId) {
      formatted.assetName = getAssetName(formatted.assetId, context.assets);
    }
    
    if (formatted.impactCodeId) {
      formatted.impactCodeName = getImpactCodeName(formatted.impactCodeId, context.impactCodes);
    }
    
    if (formatted.oeeCodeId) {
      formatted.oeeCodeName = getOEECodeName(formatted.oeeCodeId, context.oeeCodes);
    }
    
    return formatted;
  }

  return data;
};

/**
 * Helper function to calculate analytics summary with user-friendly names
 */
export const calculateAnalyticsSummary = (events: any[], context: {
  units: Unit[];
  assets: Asset[];
  impactCodes: ImpactCode[];
  oeeCodes: OEECode[];
}) => {
  const totalLoss = events.reduce((sum, e) => sum + (Number(e.duration) || 0), 0);
  const eventCount = events.length;
  
  // Calculate top category
  const categoryMap: Record<string, number> = {};
  for (const e of events) {
    const cat = e.lossCategory || 'Other';
    categoryMap[cat] = (categoryMap[cat] || 0) + (Number(e.duration) || 0);
  }
  const topCategory = Object.entries(categoryMap).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
  
  // Calculate top unit
  const unitMap: Record<string, number> = {};
  for (const e of events) {
    const unit = e.unitId || 'Other';
    unitMap[unit] = (unitMap[unit] || 0) + (Number(e.duration) || 0);
  }
  const topUnitId = Object.entries(unitMap).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
  const topUnitName = getUnitName(topUnitId, context.units);
  
  
  // Get top events
  const topEvents = [...events].sort((a, b) => (Number(b.duration) || 0) - (Number(a.duration) || 0)).slice(0, 3);
  
  return {
    totalLoss,
    eventCount,
    topCategory,
    topUnitId,
    topUnitName,
    topEvents: topEvents.map(event => formatAnalyticsData(event, context))
  };
};

/**
 * Helper function to ensure all analytics displays use user-friendly names
 */
export const ensureUserFriendlyNames = (analyticsData: any, context: {
  units: Unit[];
  assets: Asset[];
  impactCodes: ImpactCode[];
  oeeCodes: OEECode[];
}) => {
  // This function can be called on any analytics data to ensure it uses user-friendly names
  return formatAnalyticsData(analyticsData, context);
};
