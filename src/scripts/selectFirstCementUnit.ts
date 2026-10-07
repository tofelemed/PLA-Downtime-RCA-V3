// Script to automatically select the first cement unit after seeding
import { masterDataService } from '../services/MasterDataService';

async function selectFirstCementUnit() {
  console.log('🎯 Selecting first cement unit for plant selector...');
  
  try {
    // Get current session data
    const sessionData = localStorage.getItem('proact_session');
    const session = sessionData ? JSON.parse(sessionData) : null;
    const tenantId = session?.tenant?.id || 'demo-tenant-001';
    
    console.log('📋 Current session:', session?.tenant?.name || 'No tenant');
    
    // Load all data
    const [organizations, tenants, units] = await Promise.all([
      masterDataService.getOrganizations(),
      masterDataService.getTenants(),
      masterDataService.getUnits()
    ]);
    
    console.log('📊 Available data:');
    console.log(`   - Organizations: ${organizations.length}`);
    console.log(`   - Tenants: ${tenants.length}`);
    console.log(`   - Units: ${units.length}`);
    
    // Find Hillal organization
    const hillalOrg = organizations.find(org => org.name === 'Hillal');
    if (!hillalOrg) {
      console.log('❌ Hillal organization not found');
      return;
    }
    
    // Find Margoon Cement tenant
    const margoonTenant = tenants.find(tenant => tenant.name === 'Margoon Cement');
    if (!margoonTenant) {
      console.log('❌ Margoon Cement tenant not found');
      return;
    }
    
    // Find first cement unit
    const cementUnits = units.filter(unit => 
      unit.name.includes('Raw Mill') || 
      unit.name.includes('Kiln') || 
      unit.name.includes('Cement Mill') || 
      unit.name.includes('Packaging') ||
      unit.name.includes('Coal Mill') ||
      unit.name.includes('Crusher') ||
      unit.name.includes('Preheater') ||
      unit.name.includes('Quality Control')
    );
    
    if (cementUnits.length === 0) {
      console.log('❌ No cement units found');
      return;
    }
    
    const firstUnit = cementUnits[0];
    console.log(`✅ Found first cement unit: ${firstUnit.name}`);
    
    // Create selection object
    const selection = {
      organization: hillalOrg,
      tenant: margoonTenant,
      unit: firstUnit
    };
    
    // Save to IndexedDB
    const { storageService } = await import('../services/StorageService');
    await storageService.initialize();
    await storageService.setAppSetting('plantSelection', selection);
    
    console.log('✅ Plant selection updated:');
    console.log(`   - Organization: ${selection.organization.name}`);
    console.log(`   - Plant: ${selection.tenant.name}`);
    console.log(`   - Unit: ${selection.unit.name}`);
    
    console.log('🔄 Please refresh the page to see the updated plant selector');
    
  } catch (error) {
    console.error('❌ Failed to select first cement unit:', error);
  }
}

// Export for use in browser console
if (typeof window !== 'undefined') {
  (window as any).selectFirstCementUnit = selectFirstCementUnit;
  console.log('🎯 selectFirstCementUnit() function available globally.');
}

export { selectFirstCementUnit };
