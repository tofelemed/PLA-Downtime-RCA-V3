// Script to seed PLA and RCA data for testing
// Run this script to populate IndexedDB with comprehensive test data

import { globalPLARCADataSeeder } from '../services/PLARCADataSeeder';
import { globalDemoDataSeeder } from '../services/storage/DemoDataSeeder';
import { masterDataService } from '../services/MasterDataService';

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
  
  console.warn('No session found, using demo tenant ID');
  return 'demo-tenant-001';
}

async function seedAllData() {
  try {
    const tenantId = getCurrentTenantId();
    console.log('🚀 Starting comprehensive data seeding for PLA and RCA testing...');
    console.log('📋 Using tenant ID:', tenantId);
    
    // Seed Universal Connector data
    console.log('📡 Seeding Universal Connector data...');
    await globalDemoDataSeeder.seedIfNeeded();
    
    // Seed PLA and RCA data
    console.log('🏭 Seeding PLA and RCA data...');
    await globalPLARCADataSeeder.seedPLARCAData(tenantId);
    
    console.log('✅ All data seeded successfully!');
    console.log('📊 You can now test the following modules:');
    console.log('   - Production Dashboard (PLA)');
    console.log('   - RCA Module');
    console.log('   - Event Hub');
    console.log('   - Universal Connector');
    console.log('   - Master Data Management');
    
    // Verify data was created
    console.log('🔍 Verifying seeded data...');
    const events = await masterDataService.getProductionEvents({ tenantId });
    const rcas = await masterDataService.getRCAs({ tenantId });
    const templates = await masterDataService.getRCATemplates({ tenantId });
    const units = await masterDataService.getUnits();
    const assets = await masterDataService.getAssets({ tenantId });
    
    console.log('📈 Data verification results:');
    console.log(`   - Production Events: ${events.length}`);
    console.log(`   - RCA Investigations: ${rcas.length}`);
    console.log(`   - RCA Templates: ${templates.length}`);
    console.log(`   - Production Units: ${units.length}`);
    console.log(`   - Assets: ${assets.length}`);
    
    // Show sample data
    if (events.length > 0) {
      console.log('📋 Sample production event:', events[0].description);
    }
    if (rcas.length > 0) {
      console.log('📋 Sample RCA:', rcas[0].title);
    }
    
  } catch (error) {
    console.error('❌ Failed to seed data:', error);
    throw error;
  }
}

// Function to seed data for a specific tenant ID
async function seedDataForTenant(tenantId: string) {
  try {
    console.log('🚀 Seeding data for specific tenant:', tenantId);
    
    // Seed Universal Connector data
    console.log('📡 Seeding Universal Connector data...');
    await globalDemoDataSeeder.seedIfNeeded();
    
    // Seed PLA and RCA data
    console.log('🏭 Seeding PLA and RCA data...');
    await globalPLARCADataSeeder.seedPLARCAData(tenantId);
    
    console.log('✅ Data seeded successfully for tenant:', tenantId);
    
    // Verify data was created
    const events = await masterDataService.getProductionEvents({ tenantId });
    const rcas = await masterDataService.getRCAs({ tenantId });
    console.log(`📈 Created ${events.length} events and ${rcas.length} RCAs for tenant ${tenantId}`);
    
  } catch (error) {
    console.error('❌ Failed to seed data for tenant:', error);
    throw error;
  }
}

async function clearAllData() {
  try {
    const tenantId = getCurrentTenantId();
    console.log('🧹 Clearing all seeded data...');
    console.log('📋 Using tenant ID:', tenantId);
    
    await globalDemoDataSeeder.clearDemoData();
    await globalPLARCADataSeeder.clearSeededData(tenantId);
    
    console.log('✅ All data cleared successfully!');
  } catch (error) {
    console.error('❌ Failed to clear data:', error);
    throw error;
  }
}

async function resetAllData() {
  try {
    const tenantId = getCurrentTenantId();
    console.log('🔄 Resetting all seeded data...');
    console.log('📋 Using tenant ID:', tenantId);
    
    await globalDemoDataSeeder.resetDemoData();
    await globalPLARCADataSeeder.resetSeededData(tenantId);
    
    console.log('✅ All data reset successfully!');
  } catch (error) {
    console.error('❌ Failed to reset data:', error);
    throw error;
  }
}

// Debug function to check tenant ID and data
async function debugTenantAndData() {
  console.log('🔍 Debugging tenant ID and data...');
  
  // Check session data
  const sessionData = localStorage.getItem('proact_session');
  console.log('Session data from localStorage:', sessionData);
  
  if (sessionData) {
    try {
      const session = JSON.parse(sessionData);
      console.log('Parsed session:', session);
      console.log('Session tenant ID:', session.tenant?.id);
    } catch (error) {
      console.error('Error parsing session:', error);
    }
  }
  
  // Check what tenant ID we're using
  const tenantId = getCurrentTenantId();
  console.log('Using tenant ID:', tenantId);
  
  // Check what data exists for this tenant
  try {
    const events = await masterDataService.getProductionEvents({ tenantId });
    const rcas = await masterDataService.getRCAs({ tenantId });
    const templates = await masterDataService.getRCATemplates({ tenantId });
    const units = await masterDataService.getUnits();
    const assets = await masterDataService.getAssets({ tenantId });
    
    console.log('Data for tenant', tenantId, ':');
    console.log('  - Production Events:', events.length);
    console.log('  - RCA Investigations:', rcas.length);
    console.log('  - RCA Templates:', templates.length);
    console.log('  - Production Units:', units.length);
    console.log('  - Assets:', assets.length);
    
    // Check all tenants
    const allTenants = await masterDataService.getTenants();
    console.log('All tenants in system:', allTenants.map(t => ({ id: t.id, name: t.name })));
    
    // Check data for all tenants
    for (const tenant of allTenants) {
      const tenantEvents = await masterDataService.getProductionEvents({ tenantId: tenant.id });
      const tenantRCAs = await masterDataService.getRCAs({ tenantId: tenant.id });
      console.log(`Data for tenant ${tenant.name} (${tenant.id}):`, {
        events: tenantEvents.length,
        rcas: tenantRCAs.length
      });
    }
    
  } catch (error) {
    console.error('Error checking data:', error);
  }
}

// Export functions for use in other scripts or browser console
export { seedAllData, clearAllData, resetAllData, getCurrentTenantId, debugTenantAndData, seedDataForTenant };

// If running directly (not imported), execute seeding
if (typeof window !== 'undefined') {
  // Browser environment - make functions available globally
  (window as any).seedPLARCAData = seedAllData;
  (window as any).clearPLARCAData = clearAllData;
  (window as any).resetPLARCAData = resetAllData;
  (window as any).debugTenantAndData = debugTenantAndData;
  (window as any).seedDataForTenant = seedDataForTenant;
  
  console.log('🌐 Data seeding functions available globally:');
  console.log('   - seedPLARCAData() - Seed all test data');
  console.log('   - clearPLARCAData() - Clear all test data');
  console.log('   - resetPLARCAData() - Reset all test data');
  console.log('   - debugTenantAndData() - Debug tenant ID and data issues');
  console.log('   - seedDataForTenant(tenantId) - Seed data for specific tenant');
}
