// Debug script to check production plans data
import { masterDataService } from '../services/MasterDataService';

async function debugProductionPlans() {
  console.log('🔍 Debugging Production Plans Data...');
  
  try {
    // Get current tenant ID
    const sessionData = localStorage.getItem('proact_session');
    const session = sessionData ? JSON.parse(sessionData) : null;
    const tenantId = session?.tenant?.id || 'demo-tenant-001';
    
    console.log('📋 Current Session Info:');
    console.log('   - Session:', session ? 'Found' : 'Not found');
    console.log('   - Tenant ID:', tenantId);
    console.log('   - Organization ID:', session?.organization?.id || 'Not found');
    
    // Check all data
    console.log('\n📊 Loading all data...');
    const [plans, templates, units, products] = await Promise.all([
      masterDataService.getProductionPlans({ tenantId }),
      masterDataService.getProductionPlanTemplates({ tenantId }),
      masterDataService.getUnits(),
      masterDataService.getProducts()
    ]);
    
    console.log('📈 Data Counts:');
    console.log(`   - Production Plans: ${plans.length}`);
    console.log(`   - Production Plan Templates: ${templates.length}`);
    console.log(`   - Units: ${units.length}`);
    console.log(`   - Products: ${products.length}`);
    
    // Check if plans exist
    if (plans.length > 0) {
      console.log('\n✅ Production Plans Found:');
      plans.forEach((plan, index) => {
        const unit = units.find(u => u.id === plan.unitId);
        const product = products.find(p => p.id === plan.productId);
        console.log(`   ${index + 1}. ${plan.name}`);
        console.log(`      - ID: ${plan.id}`);
        console.log(`      - Unit: ${unit?.name || 'Unknown'} (${plan.unitId})`);
        console.log(`      - Product: ${product?.name || 'Unknown'} (${plan.productId})`);
        console.log(`      - Status: ${plan.status}`);
        console.log(`      - Approval: ${plan.approvalStatus}`);
        console.log(`      - Quantity: ${plan.plannedQuantity}`);
        console.log(`      - Tenant ID: ${plan.tenantId}`);
        console.log('');
      });
    } else {
      console.log('\n❌ No Production Plans Found!');
      
      // Check if units and products exist
      console.log('\n🔍 Checking Dependencies:');
      if (units.length > 0) {
        console.log('✅ Units available:');
        units.forEach(unit => {
          console.log(`   - ${unit.name} (${unit.id})`);
        });
      } else {
        console.log('❌ No units found!');
      }
      
      if (products.length > 0) {
        console.log('✅ Products available:');
        products.forEach(product => {
          console.log(`   - ${product.name} (${product.id})`);
        });
      } else {
        console.log('❌ No products found!');
      }
      
      // Check if templates exist
      if (templates.length > 0) {
        console.log('✅ Templates available:');
        templates.forEach(template => {
          console.log(`   - ${template.name} (${template.id})`);
        });
      } else {
        console.log('❌ No templates found!');
      }
    }
    
    // Check tenant ID matching
    console.log('\n🔍 Checking Tenant ID Matching:');
    const allPlans = await masterDataService.getProductionPlans();
    console.log(`   - Total plans in database: ${allPlans.length}`);
    
    if (allPlans.length > 0) {
      console.log('   - Plans with different tenant IDs:');
      allPlans.forEach(plan => {
        if (plan.tenantId !== tenantId) {
          console.log(`     - ${plan.name}: ${plan.tenantId} (expected: ${tenantId})`);
        }
      });
    }
    
    // Check if data was seeded properly
    console.log('\n🔍 Checking Data Seeding Status:');
    const hasUnits = units.length > 0;
    const hasProducts = products.length > 0;
    const hasPlans = plans.length > 0;
    const hasTemplates = templates.length > 0;
    
    console.log(`   - Units seeded: ${hasUnits ? '✅' : '❌'}`);
    console.log(`   - Products seeded: ${hasProducts ? '✅' : '❌'}`);
    console.log(`   - Plans seeded: ${hasPlans ? '✅' : '❌'}`);
    console.log(`   - Templates seeded: ${hasTemplates ? '✅' : '❌'}`);
    
    if (!hasPlans && (hasUnits && hasProducts)) {
      console.log('\n💡 Suggestion: Try re-seeding the data:');
      console.log('   clearPresentationData()');
      console.log('   seedPresentationData()');
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

// Export for use in browser console
if (typeof window !== 'undefined') {
  (window as any).debugProductionPlans = debugProductionPlans;
  console.log('🔍 debugProductionPlans() function available globally for debugging.');
}

export { debugProductionPlans };
