// Test script for plant selector functionality
// This script tests the plant selector with cement industry data

import { masterDataService } from '../services/MasterDataService';
import { storageService } from '../services/StorageService';

export async function testPlantSelectorWithCementData() {
  console.log('🎯 Testing plant selector with cement industry data...');
  
  try {
    // Initialize storage service
    await storageService.initialize();
    
    // Get plant hierarchy data
    const [organizations, tenants, units, assets] = await Promise.all([
      masterDataService.getOrganizations(),
      masterDataService.getTenants(),
      masterDataService.getUnits(),
      masterDataService.getAssets({ tenantId: 'cement-tenant-001' })
    ]);

    console.log('📊 Plant Hierarchy Data:');
    console.log(`   - Organizations: ${organizations.length}`);
    console.log(`   - Tenants: ${tenants.length}`);
    console.log(`   - Units: ${units.length}`);
    console.log(`   - Assets: ${assets.length}`);

    // Test plant selection
    const plantSelection = await storageService.getAppSetting('plantSelection');
    
    if (plantSelection) {
      console.log('✅ Plant selection found:');
      console.log(`   - Organization: ${plantSelection.organization?.name || 'None'}`);
      console.log(`   - Plant: ${plantSelection.tenant?.name || 'None'}`);
      console.log(`   - Unit: ${plantSelection.unit?.name || 'None'}`);
      console.log(`   - Asset: ${plantSelection.asset?.name || 'None'}`);
      
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

    // Test hierarchy structure
    if (organizations.length > 0 && tenants.length > 0 && units.length > 0) {
      console.log('🏭 Plant Hierarchy Structure:');
      organizations.forEach(org => {
        const orgTenants = tenants.filter(t => t.organizationId === org.id);
        console.log(`   - ${org.name} (${org.code}):`);
        orgTenants.forEach(tenant => {
          const tenantUnits = units.filter(u => u.tenantId === tenant.id);
          console.log(`     - ${tenant.name} (${tenant.code}):`);
          tenantUnits.forEach(unit => {
            const unitAssets = assets.filter(a => a.unitId === unit.id);
            console.log(`       - ${unit.name} (${unit.code}) - ${unitAssets.length} assets`);
          });
        });
      });
    }

    // Test plant selector functionality
    console.log('🔧 Testing plant selector functionality...');
    
    // Test selecting different units
    const firstUnit = units[0];
    const firstTenant = tenants[0];
    const firstOrg = organizations[0];
    
    if (firstUnit && firstTenant && firstOrg) {
      const testSelection = {
        organization: firstOrg,
        tenant: firstTenant,
        unit: firstUnit
      };
      
      // Save test selection
      await storageService.setAppSetting('plantSelection', testSelection);
      console.log('✅ Test plant selection saved');
      
      // Verify it was saved
      const savedSelection = await storageService.getAppSetting('plantSelection');
      if (savedSelection && savedSelection.unit?.id === firstUnit.id) {
        console.log('✅ Plant selection persistence working correctly');
      } else {
        console.log('❌ Plant selection persistence failed');
      }
    }

    console.log('🎉 Plant selector testing completed successfully!');
    
  } catch (error) {
    console.error('❌ Plant selector testing failed:', error);
    throw error;
  }
}

// Make available globally for browser console usage
if (typeof window !== 'undefined') {
  (window as any).testPlantSelectorWithCementData = testPlantSelectorWithCementData;
}

export default testPlantSelectorWithCementData;
