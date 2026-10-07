// Fix script for production plans issue
import { seedPresentationData, clearPresentationData } from './seedPresentationData';
import { masterDataService } from '../services/MasterDataService';

async function fixProductionPlans() {
  console.log('🔧 Fixing Production Plans Issue...');
  
  try {
    // Get current tenant ID
    const sessionData = localStorage.getItem('proact_session');
    const session = sessionData ? JSON.parse(sessionData) : null;
    const tenantId = session?.tenant?.id || 'demo-tenant-001';
    
    console.log('Step 1: Clearing existing data...');
    await clearPresentationData();
    
    console.log('Step 2: Re-seeding data with enhanced logging...');
    await seedPresentationData();
    
    console.log('Step 3: Verifying production plans...');
    
    // Check if plans were created
    const plans = await masterDataService.getProductionPlans({ tenantId });
    const units = await masterDataService.getUnits();
    const products = await masterDataService.getProducts();
    
    console.log('📊 Verification Results:');
    console.log(`   - Production Plans: ${plans.length}`);
    console.log(`   - Units: ${units.length}`);
    console.log(`   - Products: ${products.length}`);
    
    if (plans.length > 0) {
      console.log('✅ Production Plans Found:');
      plans.forEach((plan, index) => {
        const unit = units.find(u => u.id === plan.unitId);
        const product = products.find(p => p.id === plan.productId);
        console.log(`   ${index + 1}. ${plan.name}`);
        console.log(`      - Unit: ${unit?.name || 'Unknown'} (${plan.unitId})`);
        console.log(`      - Product: ${product?.name || 'Unknown'} (${plan.productId})`);
        console.log(`      - Status: ${plan.status}`);
        console.log(`      - Quantity: ${plan.plannedQuantity.toLocaleString()}`);
      });
      
      console.log('\n🎉 Production Plans Issue FIXED!');
      console.log('📝 Next steps:');
      console.log('   1. Refresh the Production Plans page');
      console.log('   2. Verify plans are now visible');
      console.log('   3. Test plan creation and editing');
      
    } else {
      console.log('❌ Still no production plans found!');
      console.log('🔍 Debugging further...');
      
      // Check if units and products exist
      console.log('Available Units:');
      units.forEach(unit => {
        console.log(`   - ${unit.name} (${unit.id})`);
      });
      
      console.log('Available Products:');
      products.forEach(product => {
        console.log(`   - ${product.name} (${product.id})`);
      });
      
      // Try to create a simple plan manually
      if (units.length > 0 && products.length > 0) {
        console.log('🔧 Creating a test plan manually...');
        try {
          const testPlan = await masterDataService.createProductionPlan({
            name: 'Test Production Plan',
            unitId: units[0].id,
            productId: products[0].id,
            plannedQuantity: 1000,
            toleranceLimit: 5,
            startDate: new Date('2024-01-01').toISOString(),
            endDate: new Date('2024-03-31').toISOString(),
            status: 'Active' as const,
            approvalStatus: 'Approved' as const,
            planBasis: 'Test',
            dataEntryFrequency: 'Daily',
            plannerNotes: 'Test plan for debugging',
            tenantId
          });
          
          console.log('✅ Test plan created successfully:', testPlan.name);
          console.log('🔄 Please refresh the Production Plans page');
          
        } catch (error) {
          console.error('❌ Failed to create test plan:', error);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Fix failed:', error);
  }
}

// Export for use in browser console
if (typeof window !== 'undefined') {
  (window as any).fixProductionPlans = fixProductionPlans;
  console.log('🔧 fixProductionPlans() function available globally for fixing the issue.');
}

export { fixProductionPlans };
