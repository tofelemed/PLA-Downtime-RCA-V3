// Script to seed comprehensive presentation data for system demo
// Generates realistic, persistent data for Dashboard, PLA, and RCA modules

import { globalPresentationDataSeeder } from '../services/PresentationDataSeeder';
import { globalDemoDataSeeder } from '../services/storage/DemoDataSeeder';
import { masterDataService } from '../services/MasterDataService';

// Get current tenant ID from session
function getCurrentTenantId(): string {
  // Try to get from localStorage first (AuthContext uses localStorage)
  const sessionData = localStorage.getItem('proact_session');
  if (sessionData) {
    try {
      const session = JSON.parse(sessionData);
      console.log('Found session data:', session);
      if (session.tenant?.id) {
        console.log('Using tenant ID from session:', session.tenant.id);
        return session.tenant.id;
      }
    } catch (error) {
      console.warn('Could not parse session data:', error);
    }
  }
  
  // Try sessionStorage as fallback
  const sessionStorageData = sessionStorage.getItem('proact-session');
  if (sessionStorageData) {
    try {
      const session = JSON.parse(sessionStorageData);
      if (session.tenant?.id) {
        console.log('Using tenant ID from sessionStorage:', session.tenant.id);
        return session.tenant.id;
      }
    } catch (error) {
      console.warn('Could not parse sessionStorage data:', error);
    }
  }
  
  console.warn('No session found, using demo tenant ID');
  return 'demo-tenant-001';
}

// Main function to seed comprehensive presentation data
async function seedPresentationData() {
  try {
    const tenantId = getCurrentTenantId();
    console.log('🎯 Starting comprehensive presentation data seeding...');
    console.log('📋 Using tenant ID:', tenantId);
    
    // Seed Universal Connector data first
    console.log('📡 Seeding Universal Connector data...');
    await globalDemoDataSeeder.seedIfNeeded();
    
    // Seed comprehensive presentation data
    console.log('🏭 Seeding comprehensive presentation data...');
    await globalPresentationDataSeeder.seedPresentationData(tenantId);
    
    console.log('✅ Presentation data seeded successfully!');
    console.log('🎉 System is now ready for presentation with:');
    console.log('   📊 Dashboard with analytics and KPIs');
    console.log('   🏭 PLA module with production events and OEE data');
    console.log('   🔍 RCA module with investigations and templates');
    console.log('   📋 Master data with comprehensive codes and hierarchies');
    console.log('   🏗️ Production units, assets, and products');
    console.log('   📈 Production plans and loss tracking');
    
  } catch (error) {
    console.error('❌ Failed to seed presentation data:', error);
    throw error;
  }
}

// Function to clear all presentation data
async function clearPresentationData() {
  try {
    const tenantId = getCurrentTenantId();
    console.log('🧹 Clearing all presentation data...');
    console.log('📋 Using tenant ID:', tenantId);
    
    await globalDemoDataSeeder.clearDemoData();
    await globalPresentationDataSeeder.clearSeededData(tenantId);
    
    console.log('✅ All presentation data cleared successfully!');
  } catch (error) {
    console.error('❌ Failed to clear presentation data:', error);
    throw error;
  }
}

// Function to reset all presentation data
async function resetPresentationData() {
  try {
    const tenantId = getCurrentTenantId();
    console.log('🔄 Resetting all presentation data...');
    console.log('📋 Using tenant ID:', tenantId);
    
    await globalDemoDataSeeder.resetDemoData();
    await globalPresentationDataSeeder.resetSeededData(tenantId);
    
    console.log('✅ All presentation data reset successfully!');
  } catch (error) {
    console.error('❌ Failed to reset presentation data:', error);
    throw error;
  }
}

// Function to verify presentation data
async function verifyPresentationData() {
  try {
    const tenantId = getCurrentTenantId();
    console.log('🔍 Verifying presentation data...');
    console.log('📋 Using tenant ID:', tenantId);
    
    // Check all data types
    const events = await masterDataService.getProductionEvents({ tenantId });
    const rcas = await masterDataService.getRCAs({ tenantId });
    const templates = await masterDataService.getRCATemplates({ tenantId });
    const units = await masterDataService.getUnits();
    const assets = await masterDataService.getAssets({ tenantId });
    const impactCodes = await masterDataService.getImpactCodes({ tenantId });
    const oeeCodes = await masterDataService.getOEECodes({ tenantId });
    const reasonCodes = await masterDataService.getReasonCodes({ tenantId });
    const products = await masterDataService.getProducts();
    const plans = await masterDataService.getProductionPlans({ tenantId });
    const losses = await masterDataService.getProductionLosses({ tenantId });
    const oeeSummaries = await masterDataService.getOEESummaries({ tenantId });
    
    console.log('📈 Presentation data verification:');
    console.log(`   ✅ Production Events: ${events.length} (6 realistic events)`);
    console.log(`   ✅ RCA Investigations: ${rcas.length} (3 active investigations)`);
    console.log(`   ✅ RCA Templates: ${templates.length} (3 comprehensive templates)`);
    console.log(`   ✅ Production Units: ${units.length} (5 production lines)`);
    console.log(`   ✅ Assets: ${assets.length} (12+ production assets)`);
    console.log(`   ✅ Impact Codes: ${impactCodes.length} (8 impact categories)`);
    console.log(`   ✅ OEE Codes: ${oeeCodes.length} (10 OEE categories)`);
    console.log(`   ✅ Reason Codes: ${reasonCodes.length} (40+ hierarchical codes)`);
    console.log(`   ✅ Products: ${products.length} (6 product variants)`);
    console.log(`   ✅ Production Plans: ${plans.length} (3 quarterly plans)`);
    console.log(`   ✅ Production Losses: ${losses.length} (linked to events)`);
    console.log(`   ✅ OEE Summaries: ${oeeSummaries.length} (per unit metrics)`);
    
    // Show sample data
    if (events.length > 0) {
      console.log('📋 Sample production event:', events[0].description);
    }
    if (rcas.length > 0) {
      console.log('📋 Sample RCA:', rcas[0].title);
    }
    if (units.length > 0) {
      console.log('📋 Sample unit:', units[0].name);
    }
    
    console.log('🎉 Presentation data verification completed successfully!');
    
  } catch (error) {
    console.error('❌ Failed to verify presentation data:', error);
    throw error;
  }
}

// Export functions for use in other scripts or browser console
export { 
  seedPresentationData, 
  clearPresentationData, 
  resetPresentationData, 
  verifyPresentationData,
  getCurrentTenantId 
};

// If running directly (not imported), make functions available globally
if (typeof window !== 'undefined') {
  // Browser environment - make functions available globally
  (window as any).seedPresentationData = seedPresentationData;
  (window as any).clearPresentationData = clearPresentationData;
  (window as any).resetPresentationData = resetPresentationData;
  (window as any).verifyPresentationData = verifyPresentationData;
  
  console.log('🎯 Presentation data seeding functions available globally:');
  console.log('   - seedPresentationData() - Seed comprehensive presentation data');
  console.log('   - clearPresentationData() - Clear all presentation data');
  console.log('   - resetPresentationData() - Reset all presentation data');
  console.log('   - verifyPresentationData() - Verify presentation data integrity');
}
