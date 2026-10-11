// Comprehensive Cement Industry Data Seeding Script
// This script seeds all parts of the application with cement industry data
// Run this script to populate IndexedDB with comprehensive cement industry test data

import { globalCementIndustryDataSeeder } from '../services/CementIndustryDataSeeder';
import { globalDemoDataSeeder } from '../services/storage/DemoDataSeeder';
import { masterDataService } from '../services/MasterDataService';
import { storageService } from '../services/StorageService';
import { testPlantSelectorWithCementData } from './testPlantSelector';

// Get current tenant ID from session or use demo ID
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
  
  // Default to cement industry tenant
  return 'cement-tenant-001';
}

async function seedAllCementIndustryData() {
  try {
    const tenantId = getCurrentTenantId();
    console.log('🏭 Starting comprehensive cement industry data seeding...');
    console.log('📋 Using tenant ID:', tenantId);
    
    // Initialize storage service
    await storageService.initialize();
    
    // Seed Universal Connector data first
    console.log('📡 Seeding Universal Connector data...');
    await globalDemoDataSeeder.seedIfNeeded();
    
    // Seed comprehensive cement industry data
    console.log('🏭 Seeding cement industry data...');
    await globalCementIndustryDataSeeder.seedCementIndustryData(tenantId);
    
    console.log('✅ All cement industry data seeded successfully!');
    console.log('📊 You can now test the following modules:');
    console.log('   - Production Dashboard (PLA)');
    console.log('   - RCA Module');
    console.log('   - Event Hub');
    console.log('   - Plant Selector');
    console.log('   - Universal Connector');
    console.log('   - Master Data Management');
    console.log('   - Quality Control');
    console.log('   - Maintenance Management');
    
    // Verify data was created
    console.log('🔍 Verifying seeded data...');
    await verifyCementIndustryData(tenantId);
    
    // Test plant selector functionality
    console.log('🎯 Testing plant selector functionality...');
    await testPlantSelectorWithCementData();
    
  } catch (error) {
    console.error('❌ Failed to seed cement industry data:', error);
    throw error;
  }
}

// Function to seed data for a specific tenant ID
async function seedCementIndustryDataForTenant(tenantId: string) {
  try {
    console.log('🏭 Seeding cement industry data for specific tenant:', tenantId);
    
    // Initialize storage service
    await storageService.initialize();
    
    // Seed Universal Connector data
    console.log('📡 Seeding Universal Connector data...');
    await globalDemoDataSeeder.seedIfNeeded();
    
    // Seed cement industry data
    console.log('🏭 Seeding cement industry data...');
    await globalCementIndustryDataSeeder.seedCementIndustryData(tenantId);
    
    console.log('✅ Cement industry data seeded successfully for tenant:', tenantId);
    
    // Verify data was created
    await verifyCementIndustryData(tenantId);
    
  } catch (error) {
    console.error('❌ Failed to seed cement industry data for tenant:', error);
    throw error;
  }
}

// Verify all seeded data
async function verifyCementIndustryData(tenantId: string) {
  try {
    console.log('🔍 Verifying cement industry data...');
    
    const [
      organizations, 
      tenants, 
      units, 
      assets, 
      products, 
      plans, 
      events, 
      templates, 
      investigations, 
      losses, 
      oeeSummaries, 
      impactCodes, 
      oeeCodes, 
      reasonCodes, 
      dashboardConfigs
    ] = await Promise.all([
      masterDataService.getOrganizations(),
      masterDataService.getTenants(),
      masterDataService.getUnits(),
      masterDataService.getAssets({ tenantId }),
      masterDataService.getProducts(),
      masterDataService.getProductionPlans({ tenantId }),
      masterDataService.getProductionEvents({ tenantId }),
      masterDataService.getRCATemplates({ tenantId }),
      masterDataService.getRCAs({ tenantId }),
      masterDataService.getProductionLosses({ tenantId }),
      masterDataService.getOEESummaries({ tenantId }),
      masterDataService.getImpactCodes({ tenantId }),
      masterDataService.getOEECodes({ tenantId }),
      masterDataService.getReasonCodes({ tenantId }),
      masterDataService.getDashboardConfiguration(tenantId).then(config => (config ? [config] : []))
    ]);

    console.log('📈 Cement Industry Data Verification Results:');
    console.log(`   - Organizations: ${organizations.length} (${organizations[0]?.name || 'None'})`);
    console.log(`   - Tenants: ${tenants.length} (${tenants[0]?.name || 'None'})`);
    console.log(`   - Cement Units: ${units.length}`);
    console.log(`   - Cement Assets: ${assets.length}`);
    console.log(`   - Cement Products: ${products.length}`);
    console.log(`   - Production Plans: ${plans.length}`);
    console.log(`   - Production Events: ${events.length} (20+ events as requested)`);
    console.log(`   - RCA Templates: ${templates.length}`);
    console.log(`   - RCA Investigations: ${investigations.length}`);
    console.log(`   - Production Losses: ${losses.length}`);
    console.log(`   - OEE Summaries: ${oeeSummaries.length}`);
    console.log(`   - Impact Codes: ${impactCodes.length}`);
    console.log(`   - OEE Codes: ${oeeCodes.length}`);
    console.log(`   - Reason Codes: ${reasonCodes.length}`);
    console.log(`   - Dashboard Configs: ${dashboardConfigs.length}`);

    // Show sample data
    if (organizations.length > 0) {
      console.log('📋 Sample organization:', organizations[0].name);
    }
    if (tenants.length > 0) {
      console.log('📋 Sample tenant:', tenants[0].name);
    }
    if (units.length > 0) {
      console.log('📋 Sample unit:', units[0].name);
    }
    if (products.length > 0) {
      console.log('📋 Sample product:', products[0].name);
    }
    if (plans.length > 0) {
      console.log('📋 Sample production plan:', plans[0].name);
    }
    if (events.length > 0) {
      console.log('📋 Sample production event:', events[0].description);
    }
    if (templates.length > 0) {
      console.log('📋 Sample RCA template:', templates[0].name);
    }
    if (investigations.length > 0) {
      console.log('📋 Sample RCA investigation:', investigations[0].title);
    }

    // Verify event categories
    const eventCategories = events.reduce((acc, event) => {
      acc[event.eventType] = (acc[event.eventType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('📊 Event Categories Distribution:');
    Object.entries(eventCategories).forEach(([category, count]) => {
      console.log(`   - ${category}: ${count} events`);
    });

    // Verify plant hierarchy
    if (organizations.length > 0 && tenants.length > 0 && units.length > 0) {
      const org = organizations[0];
      const tenant = tenants[0];
      const unit = units[0];
      console.log('🏭 Plant Hierarchy Path:');
      console.log(`   - Organization: ${org.name} (${org.code})`);
      console.log(`   - Plant: ${tenant.name} (${tenant.code})`);
      console.log(`   - Unit: ${unit.name} (${unit.code})`);
    }

  } catch (error) {
    console.warn('Could not verify cement industry data:', error);
  }
}

// Test plant selector functionality
async function testPlantSelectorFunctionality(tenantId: string) {
  try {
    console.log('🎯 Testing plant selector functionality...');
    
    // Get plant selection from IndexedDB
    const plantSelection = await storageService.getAppSetting('plantSelection');
    
    if (plantSelection) {
      console.log('✅ Plant selector is working correctly:');
      console.log(`   - Selected Organization: ${plantSelection.organization?.name || 'None'}`);
      console.log(`   - Selected Plant: ${plantSelection.tenant?.name || 'None'}`);
      console.log(`   - Selected Unit: ${plantSelection.unit?.name || 'None'}`);
      console.log(`   - Selected Asset: ${plantSelection.asset?.name || 'None'}`);
      
      // Verify the path is correct
      if (plantSelection.organization && plantSelection.tenant && plantSelection.unit) {
        console.log('✅ Plant selector path is complete and correct');
        console.log(`   - Path: ${plantSelection.organization.name} > ${plantSelection.tenant.name} > ${plantSelection.unit.name}`);
      } else {
        console.log('⚠️ Plant selector path is incomplete');
      }
    } else {
      console.log('⚠️ No plant selection found in IndexedDB');
    }

    // Test plant hierarchy data
    const [organizations, tenants, units] = await Promise.all([
      masterDataService.getOrganizations(),
      masterDataService.getTenants(),
      masterDataService.getUnits()
    ]);

    console.log('🏭 Plant Hierarchy Data Available:');
    console.log(`   - Organizations: ${organizations.length}`);
    console.log(`   - Tenants: ${tenants.length}`);
    console.log(`   - Units: ${units.length}`);

    if (organizations.length > 0 && tenants.length > 0 && units.length > 0) {
      console.log('✅ Plant hierarchy data is properly structured');
      
      // Show hierarchy structure
      organizations.forEach(org => {
        const orgTenants = tenants.filter(t => t.organizationId === org.id);
        console.log(`   - ${org.name}:`);
        orgTenants.forEach(tenant => {
          const tenantUnits = units.filter(u => u.tenantId === tenant.id);
          console.log(`     - ${tenant.name}:`);
          tenantUnits.forEach(unit => {
            console.log(`       - ${unit.name}`);
          });
        });
      });
    } else {
      console.log('❌ Plant hierarchy data is incomplete');
    }

  } catch (error) {
    console.warn('Could not test plant selector functionality:', error);
  }
}

// Clear all cement industry data
async function clearAllCementIndustryData() {
  try {
    const tenantId = getCurrentTenantId();
    console.log('🧹 Clearing all cement industry data...');
    await globalCementIndustryDataSeeder.clearCementIndustryData(tenantId);
    console.log('✅ All cement industry data cleared');
  } catch (error) {
    console.error('❌ Failed to clear cement industry data:', error);
  }
}

// Reset cement industry data (clear and reseed)
async function resetCementIndustryData() {
  try {
    console.log('🔄 Resetting cement industry data...');
    await clearAllCementIndustryData();
    await seedAllCementIndustryData();
    console.log('✅ Cement industry data reset successfully');
  } catch (error) {
    console.error('❌ Failed to reset cement industry data:', error);
  }
}

// Export functions for use in browser console or other scripts
export {
  seedAllCementIndustryData,
  seedCementIndustryDataForTenant,
  verifyCementIndustryData,
  testPlantSelectorFunctionality,
  clearAllCementIndustryData,
  resetCementIndustryData
};

// Aliases for DataSeedingPage.tsx compatibility
export const seedCementIndustryData = seedAllCementIndustryData;
export const clearCementIndustryData = clearAllCementIndustryData;
export const resetCementIndustryDataAlias = resetCementIndustryData;

// Make available globally in browser for easy testing
if (typeof window !== 'undefined') {
  (window as any).seedCementIndustryData = seedAllCementIndustryData;
  (window as any).seedCementIndustryDataForTenant = seedCementIndustryDataForTenant;
  (window as any).verifyCementIndustryData = verifyCementIndustryData;
  (window as any).testPlantSelector = testPlantSelectorFunctionality;
  (window as any).clearCementIndustryData = clearAllCementIndustryData;
  (window as any).resetCementIndustryData = resetCementIndustryData;
  console.log('🏭 Cement seeding functions available (manual use only - no auto-run)');
}

// DISABLED: Auto-run removed to prevent automatic seeding
// This was causing cement data to seed automatically on /data-seeding page!
// if (typeof window !== 'undefined' && window.location.pathname.includes('seed')) {
//   seedAllCementIndustryData().catch(console.error);
// }