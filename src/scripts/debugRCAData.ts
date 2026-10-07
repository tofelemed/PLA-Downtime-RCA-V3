// Debug RCA Data - Console Helper
// Run this in browser console: debugRCAData()

import { masterDataService } from '../services/MasterDataService';

export async function debugRCAData() {
  console.log('🔍 RCA DATA DEBUG REPORT');
  console.log('='.repeat(60));
  
  try {
    // Get all RCAs
    const allRCAs = await masterDataService.getRCAs({});
    console.log(`\n📊 Total RCAs in database: ${allRCAs.length}`);
    
    // Group by status
    const byStatus: Record<string, number> = {};
    allRCAs.forEach(rca => {
      byStatus[rca.status || 'Unknown'] = (byStatus[rca.status || 'Unknown'] || 0) + 1;
    });
    
    console.log('\n📈 RCAs by Status:');
    Object.entries(byStatus).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });
    
    // Group by tenant
    const byTenant: Record<string, number> = {};
    allRCAs.forEach(rca => {
      const tenant = rca.tenantId || 'No Tenant';
      byTenant[tenant] = (byTenant[tenant] || 0) + 1;
    });
    
    console.log('\n🏢 RCAs by Tenant:');
    Object.entries(byTenant).forEach(([tenantId, count]) => {
      console.log(`   ${tenantId}: ${count}`);
    });
    
    // Show closed RCAs
    const closedRCAs = allRCAs.filter(rca => rca.status === 'Closed');
    console.log(`\n✅ Closed RCAs: ${closedRCAs.length}`);
    if (closedRCAs.length > 0) {
      console.log('\nClosed RCA Details:');
      closedRCAs.forEach((rca, idx) => {
        console.log(`   ${idx + 1}. ${rca.title}`);
        console.log(`      ID: ${rca.id}`);
        console.log(`      Status: "${rca.status}"`);
        console.log(`      Tenant: ${rca.tenantId || 'Not set'}`);
        console.log(`      Priority: ${rca.priority}`);
        console.log(`      Created: ${new Date(rca.createdAt).toLocaleDateString()}`);
        console.log('');
      });
    }
    
    // Get tenants
    const tenants = await masterDataService.getTenants();
    console.log('\n🏢 Available Tenants:');
    tenants.forEach(t => {
      console.log(`   - ${t.name} (ID: ${t.id})`);
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Debug report complete!');
    console.log('\n💡 TIP: If Closed RCAs have different tenant IDs than expected,');
    console.log('   you may need to update the RCA tenant assignment.');
    
  } catch (error) {
    console.error('❌ Error during debug:', error);
  }
}

// Auto-expose to window
if (typeof window !== 'undefined') {
  (window as any).debugRCAData = debugRCAData;
}

