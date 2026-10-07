// Test script to verify production plans page functionality
import { seedPresentationData, clearPresentationData } from './seedPresentationData';
import { masterDataService } from '../services/MasterDataService';

async function testProductionPlansPage() {
  console.log('🧪 Testing Production Plans Page functionality...');
  
  try {
    // Get current tenant ID
    const sessionData = localStorage.getItem('proact_session');
    const session = sessionData ? JSON.parse(sessionData) : null;
    const tenantId = session?.tenant?.id || 'demo-tenant-001';
    
    console.log('Step 1: Clearing existing data...');
    await clearPresentationData();
    
    console.log('Step 2: Seeding comprehensive presentation data...');
    await seedPresentationData();
    
    console.log('Step 3: Verifying production plans page data...');
    
    // Load all data that the production plans page needs
    const [plans, templates, units, products] = await Promise.all([
      masterDataService.getProductionPlans({ tenantId }),
      masterDataService.getProductionPlanTemplates({ tenantId }),
      masterDataService.getUnits(),
      masterDataService.getProducts()
    ]);
    
    console.log('📊 Production Plans Page Data Summary:');
    console.log(`   - Production Plans: ${plans.length}`);
    console.log(`   - Production Plan Templates: ${templates.length}`);
    console.log(`   - Units: ${units.length}`);
    console.log(`   - Products: ${products.length}`);
    
    // Test 1: Verify plans have proper relationships
    console.log('\n🔗 Testing Plan Relationships:');
    const plansWithValidUnits = plans.filter(plan => units.find(u => u.id === plan.unitId));
    const plansWithValidProducts = plans.filter(plan => products.find(p => p.id === plan.productId));
    
    console.log(`   ✅ Plans with valid units: ${plansWithValidUnits.length}/${plans.length}`);
    console.log(`   ✅ Plans with valid products: ${plansWithValidProducts.length}/${plans.length}`);
    
    if (plansWithValidUnits.length !== plans.length || plansWithValidProducts.length !== plans.length) {
      console.error('❌ Some plans have invalid relationships!');
      return;
    }
    
    // Test 2: Verify templates have proper relationships
    console.log('\n🔗 Testing Template Relationships:');
    const templatesWithValidUnits = templates.filter(template => units.find(u => u.id === template.unitId));
    const templatesWithValidProducts = templates.filter(template => 
      template.productIds.every(productId => products.find(p => p.id === productId))
    );
    
    console.log(`   ✅ Templates with valid units: ${templatesWithValidUnits.length}/${templates.length}`);
    console.log(`   ✅ Templates with valid products: ${templatesWithValidProducts.length}/${templates.length}`);
    
    if (templatesWithValidUnits.length !== templates.length || templatesWithValidProducts.length !== templates.length) {
      console.error('❌ Some templates have invalid relationships!');
      return;
    }
    
    // Test 3: Verify plan data completeness
    console.log('\n📋 Testing Plan Data Completeness:');
    const plansWithUsefulTime = plans.filter(plan => plan.usefulProductionTime);
    const plansWithPlanBasis = plans.filter(plan => plan.planBasis);
    const plansWithDataEntryFreq = plans.filter(plan => plan.dataEntryFrequency);
    const plansWithPlannerNotes = plans.filter(plan => plan.plannerNotes);
    
    console.log(`   ✅ Plans with useful production time: ${plansWithUsefulTime.length}/${plans.length}`);
    console.log(`   ✅ Plans with plan basis: ${plansWithPlanBasis.length}/${plans.length}`);
    console.log(`   ✅ Plans with data entry frequency: ${plansWithDataEntryFreq.length}/${plans.length}`);
    console.log(`   ✅ Plans with planner notes: ${plansWithPlannerNotes.length}/${plans.length}`);
    
    // Test 4: Verify template data completeness
    console.log('\n📋 Testing Template Data Completeness:');
    const templatesWithDescription = templates.filter(template => template.description);
    const templatesWithRecurrence = templates.filter(template => template.recurrence);
    const templatesWithUsefulTime = templates.filter(template => template.usefulProductionTime);
    const templatesWithDataEntryFreq = templates.filter(template => template.dataEntryFrequency);
    
    console.log(`   ✅ Templates with description: ${templatesWithDescription.length}/${templates.length}`);
    console.log(`   ✅ Templates with recurrence: ${templatesWithRecurrence.length}/${templates.length}`);
    console.log(`   ✅ Templates with useful production time: ${templatesWithUsefulTime.length}/${templates.length}`);
    console.log(`   ✅ Templates with data entry frequency: ${templatesWithDataEntryFreq.length}/${templates.length}`);
    
    // Test 5: Verify status and approval distributions
    console.log('\n📊 Testing Status Distributions:');
    const statusCounts = plans.reduce((acc, plan) => {
      acc[plan.status] = (acc[plan.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const approvalCounts = plans.reduce((acc, plan) => {
      acc[plan.approvalStatus] = (acc[plan.approvalStatus] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('   📈 Plan Status Distribution:', statusCounts);
    console.log('   📈 Approval Status Distribution:', approvalCounts);
    
    // Test 6: Sample data display
    console.log('\n📋 Sample Production Plans:');
    plans.slice(0, 3).forEach((plan, index) => {
      const unit = units.find(u => u.id === plan.unitId);
      const product = products.find(p => p.id === plan.productId);
      console.log(`   ${index + 1}. ${plan.name}`);
      console.log(`      Unit: ${unit?.name || 'Unknown'}`);
      console.log(`      Product: ${product?.name || 'Unknown'}`);
      console.log(`      Quantity: ${plan.plannedQuantity.toLocaleString()}`);
      console.log(`      Status: ${plan.status} (${plan.approvalStatus})`);
      console.log(`      Period: ${new Date(plan.startDate).toLocaleDateString()} - ${new Date(plan.endDate).toLocaleDateString()}`);
      console.log('');
    });
    
    console.log('📋 Sample Production Plan Templates:');
    templates.slice(0, 2).forEach((template, index) => {
      const unit = units.find(u => u.id === template.unitId);
      const templateProducts = products.filter(p => template.productIds.includes(p.id));
      console.log(`   ${index + 1}. ${template.name}`);
      console.log(`      Description: ${template.description || 'N/A'}`);
      console.log(`      Unit: ${unit?.name || 'Unknown'}`);
      console.log(`      Products: ${templateProducts.map(p => p.name).join(', ')}`);
      console.log(`      Recurrence: ${template.recurrence || 'N/A'}`);
      console.log('');
    });
    
    // Test 7: Verify data is ready for UI display
    console.log('\n🎯 UI Readiness Test:');
    const hasActivePlans = plans.some(plan => plan.status === 'Active');
    const hasApprovedPlans = plans.some(plan => plan.approvalStatus === 'Approved');
    const hasPendingPlans = plans.some(plan => plan.approvalStatus === 'Pending Approval');
    const hasTemplates = templates.length > 0;
    const hasUnits = units.length > 0;
    const hasProducts = products.length > 0;
    
    console.log(`   ✅ Has active plans: ${hasActivePlans}`);
    console.log(`   ✅ Has approved plans: ${hasApprovedPlans}`);
    console.log(`   ✅ Has pending plans: ${hasPendingPlans}`);
    console.log(`   ✅ Has templates: ${hasTemplates}`);
    console.log(`   ✅ Has units: ${hasUnits}`);
    console.log(`   ✅ Has products: ${hasProducts}`);
    
    const allReady = hasActivePlans && hasApprovedPlans && hasTemplates && hasUnits && hasProducts;
    
    if (allReady) {
      console.log('\n🎉 Production Plans Page is ready for testing!');
      console.log('📝 Next steps:');
      console.log('   1. Navigate to http://localhost:8070/production-plans');
      console.log('   2. Verify plans are displayed with proper unit and product names');
      console.log('   3. Test plan creation using templates');
      console.log('   4. Test plan dashboard functionality');
      console.log('   5. Test plan editing and status changes');
    } else {
      console.error('\n❌ Production Plans Page is not ready - missing required data');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Export for use in browser console
if (typeof window !== 'undefined') {
  (window as any).testProductionPlansPage = testProductionPlansPage;
  console.log('🧪 testProductionPlansPage() function available globally for testing.');
}

export { testProductionPlansPage };
