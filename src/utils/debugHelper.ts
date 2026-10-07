// Debug helper to check session and data visibility
import { masterDataService } from '../services/MasterDataService';

export async function debugDataVisibility(sessionTenantId?: string, sessionOrgId?: string) {
  console.log('🐛 DEBUG: Data Visibility Check');
  console.log('=' .repeat(60));
  
  console.log('\n📍 Session Information:');
  console.log(`  Tenant ID: ${sessionTenantId || 'NOT SET'}`);
  console.log(`  Organization ID: ${sessionOrgId || 'NOT SET'}`);
  
  try {
    // Get all data without filters
    console.log('\n📊 Global Data (No Filters):');
    const allOrgs = await masterDataService.getOrganizations();
    const allTenants = await masterDataService.getTenants();
    const allProducts = await masterDataService.getProducts();
    
    console.log(`  Organizations: ${allOrgs.length}`);
    allOrgs.forEach(org => console.log(`    - ${org.name} (ID: ${org.id})`));
    
    console.log(`  Tenants: ${allTenants.length}`);
    allTenants.forEach(tenant => console.log(`    - ${tenant.name} (ID: ${tenant.id}, Org: ${tenant.organizationId})`));
    
    console.log(`  Products (Global): ${allProducts.length}`);
    if (allProducts.length > 0) {
      console.log(`    Sample: ${allProducts[0].code} - ${allProducts[0].name}`);
    }
    
    // Get data with tenant filter (like the UI does)
    if (sessionTenantId) {
      console.log(`\n🔍 Filtered Data (TenantId: ${sessionTenantId}):`);
      const impactCodes = await masterDataService.getImpactCodes({ tenantId: sessionTenantId });
      const oeeCodes = await masterDataService.getOEECodes({ tenantId: sessionTenantId });
      const reasonCodes = await masterDataService.getReasonCodes({ tenantId: sessionTenantId });
      const units = await masterDataService.getUnits({ tenantId: sessionTenantId });
      
      console.log(`  Impact Codes: ${impactCodes.length}`);
      if (impactCodes.length > 0) {
        console.log(`    Sample: ${impactCodes[0].code} - ${impactCodes[0].name} (TenantId: ${impactCodes[0].tenantId})`);
      }
      
      console.log(`  OEE Codes: ${oeeCodes.length}`);
      if (oeeCodes.length > 0) {
        console.log(`    Sample: ${oeeCodes[0].code} - ${oeeCodes[0].name} (TenantId: ${oeeCodes[0].tenantId})`);
      }
      
      console.log(`  Reason Codes: ${reasonCodes.length}`);
      if (reasonCodes.length > 0) {
        console.log(`    Sample: ${reasonCodes[0].code} - ${reasonCodes[0].name} (TenantId: ${reasonCodes[0].tenantId})`);
      }
      
      console.log(`  Units: ${units.length}`);
      if (units.length > 0) {
        console.log(`    Sample: ${units[0].code} - ${units[0].name} (TenantId: ${units[0].tenantId})`);
      }
    }
    
    // Check if tenant IDs match
    console.log('\n⚠️  Tenant ID Match Check:');
    if (sessionTenantId && allTenants.length > 0) {
      const matchingTenant = allTenants.find(t => t.id === sessionTenantId);
      if (matchingTenant) {
        console.log(`  ✅ Session tenant ID matches: ${matchingTenant.name}`);
      } else {
        console.log(`  ❌ Session tenant ID does NOT match any stored tenant!`);
        console.log(`     Session has: ${sessionTenantId}`);
        console.log(`     Available tenants:`);
        allTenants.forEach(t => console.log(`       - ${t.id} (${t.name})`));
      }
    }
    
    console.log('\n' + '='.repeat(60));
    
  } catch (error) {
    console.error('❌ Error during debug check:', error);
  }
}

// Call this from browser console: window.debugData()
if (typeof window !== 'undefined') {
  (window as any).debugData = debugDataVisibility;
}

