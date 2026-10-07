// Script to fix plant selector and session data
import { masterDataService } from '../services/MasterDataService';

async function fixPlantSelector() {
  console.log('🔧 Fixing Plant Selector and Session Data...');
  
  try {
    // Get current organizations and tenants
    const [organizations, tenants] = await Promise.all([
      masterDataService.getOrganizations(),
      masterDataService.getTenants()
    ]);
    
    console.log('📊 Current Data:');
    console.log(`   - Organizations: ${organizations.length}`);
    console.log(`   - Tenants: ${tenants.length}`);
    
    if (organizations.length > 0) {
      console.log('🏢 Organizations:');
      organizations.forEach(org => {
        console.log(`   - ${org.name} (${org.code})`);
      });
    }
    
    if (tenants.length > 0) {
      console.log('🏭 Tenants:');
      tenants.forEach(tenant => {
        const org = organizations.find(o => o.id === tenant.organizationId);
        console.log(`   - ${tenant.name} (${tenant.code}) • ${org?.name || 'Unknown Org'}`);
      });
    }
    
    // Check if Hillal and Margoon Cement exist
    const hillalOrg = organizations.find(org => org.name === 'Hillal');
    const margoonTenant = tenants.find(tenant => tenant.name === 'Margoon Cement');
    
    if (hillalOrg && margoonTenant) {
      console.log('✅ Hillal and Margoon Cement found!');
      
      // Update session data to use Margoon Cement
      const sessionData = {
        user: {
          id: 'demo-user',
          name: 'Demo User',
          email: 'demo@hillal.com',
          role: 'Admin'
        },
        organization: {
          id: hillalOrg.id,
          name: hillalOrg.name,
          code: hillalOrg.code
        },
        tenant: {
          id: margoonTenant.id,
          name: margoonTenant.name,
          code: margoonTenant.code
        }
      };
      
      // Update localStorage and sessionStorage
      localStorage.setItem('proact_session', JSON.stringify(sessionData));
      sessionStorage.setItem('proact_session', JSON.stringify(sessionData));
      
      console.log('✅ Session data updated:');
      console.log(`   - Organization: ${sessionData.organization.name}`);
      console.log(`   - Plant: ${sessionData.tenant.name}`);
      
      console.log('🔄 Please refresh the page to see the updated plant selector');
      
    } else {
      console.log('❌ Hillal or Margoon Cement not found!');
      console.log('💡 Please run: seedCementIndustryData() first');
    }
    
  } catch (error) {
    console.error('❌ Failed to fix plant selector:', error);
  }
}

async function refreshPlantSelector() {
  console.log('🔄 Refreshing Plant Selector...');
  
  try {
    // Force reload the page to refresh plant selector
    window.location.reload();
  } catch (error) {
    console.error('❌ Failed to refresh plant selector:', error);
  }
}

// Export for use in browser console
if (typeof window !== 'undefined') {
  (window as any).fixPlantSelector = fixPlantSelector;
  (window as any).refreshPlantSelector = refreshPlantSelector;
  console.log('🔧 Plant selector fix functions available globally:');
  console.log('   - fixPlantSelector()');
  console.log('   - refreshPlantSelector()');
}

export { fixPlantSelector, refreshPlantSelector };
