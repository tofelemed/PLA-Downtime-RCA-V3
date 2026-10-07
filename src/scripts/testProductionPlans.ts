// Test script to verify production plans data
import { seedPresentationData, verifyPresentationData } from './seedPresentationData';
import { masterDataService } from '../services/MasterDataService';

async function testProductionPlans() {
  console.log('🧪 Testing production plans data...');
  
  try {
    // Get current tenant ID
    const sessionData = localStorage.getItem('proact_session');
    const session = sessionData ? JSON.parse(sessionData) : null;
    const tenantId = session?.tenant?.id || 'demo-tenant-001';
    
    // Load production plans data
    const [plans, templates, units, products] = await Promise.all([
      masterDataService.getProductionPlans({ tenantId }),
      masterDataService.getProductionPlanTemplates({ tenantId }),
      masterDataService.getUnits(),
      masterDataService.getProducts()
    ]);
    
    console.log('✅ Production Plans loaded:', plans.length);
    console.log('✅ Production Plan Templates loaded:', templates.length);
    console.log('✅ Units loaded:', units.length);
    console.log('✅ Products loaded:', products.length);
    
    // Test production plans
    if (plans.length > 0) {
      console.log('📊 Production Plans Details:');
      plans.forEach((plan, index) => {
        const unit = units.find(u => u.id === plan.unitId);
        const product = products.find(p => p.id === plan.productId);
        console.log(`   ${index + 1}. ${plan.name}`);
        console.log(`      Unit: ${unit?.name || 'Unknown'} (${plan.unitId})`);
        console.log(`      Product: ${product?.name || 'Unknown'} (${plan.productId})`);
        console.log(`      Planned Quantity: ${plan.plannedQuantity.toLocaleString()}`);
        console.log(`      Status: ${plan.status}`);
        console.log(`      Approval: ${plan.approvalStatus}`);
        console.log(`      Period: ${plan.startDate} to ${plan.endDate}`);
        console.log(`      Plan Basis: ${plan.planBasis || 'N/A'}`);
        console.log(`      Data Entry: ${plan.dataEntryFrequency || 'N/A'}`);
        console.log('');
      });
    } else {
      console.warn('⚠️ No production plans found');
    }
    
    // Test production plan templates
    if (templates.length > 0) {
      console.log('📋 Production Plan Templates Details:');
      templates.forEach((template, index) => {
        const unit = units.find(u => u.id === template.unitId);
        const templateProducts = products.filter(p => template.productIds.includes(p.id));
        console.log(`   ${index + 1}. ${template.name}`);
        console.log(`      Description: ${template.description || 'N/A'}`);
        console.log(`      Unit: ${unit?.name || 'Unknown'} (${template.unitId})`);
        console.log(`      Products: ${templateProducts.map(p => p.name).join(', ')}`);
        console.log(`      Plan Basis: ${template.planBasis}`);
        console.log(`      Recurrence: ${template.recurrence || 'N/A'}`);
        console.log(`      Data Entry: ${template.dataEntryFrequency || 'N/A'}`);
        console.log('');
      });
    } else {
      console.warn('⚠️ No production plan templates found');
    }
    
    // Test data relationships
    console.log('🔗 Testing data relationships:');
    
    // Check if all plans have valid units
    const plansWithValidUnits = plans.filter(plan => units.find(u => u.id === plan.unitId));
    console.log(`   - Plans with valid units: ${plansWithValidUnits.length}/${plans.length}`);
    
    // Check if all plans have valid products
    const plansWithValidProducts = plans.filter(plan => products.find(p => p.id === plan.productId));
    console.log(`   - Plans with valid products: ${plansWithValidProducts.length}/${plans.length}`);
    
    // Check if all templates have valid units
    const templatesWithValidUnits = templates.filter(template => units.find(u => u.id === template.unitId));
    console.log(`   - Templates with valid units: ${templatesWithValidUnits.length}/${templates.length}`);
    
    // Check if all templates have valid products
    const templatesWithValidProducts = templates.filter(template => 
      template.productIds.every(productId => products.find(p => p.id === productId))
    );
    console.log(`   - Templates with valid products: ${templatesWithValidProducts.length}/${templates.length}`);
    
    // Test useful production time
    const plansWithUsefulTime = plans.filter(plan => plan.usefulProductionTime);
    console.log(`   - Plans with useful production time: ${plansWithUsefulTime.length}/${plans.length}`);
    
    if (plansWithUsefulTime.length > 0) {
      const samplePlan = plansWithUsefulTime[0];
      console.log(`   - Sample useful time (${samplePlan.name}):`);
      Object.entries(samplePlan.usefulProductionTime || {}).forEach(([day, time]) => {
        console.log(`     ${day}: ${time.start} - ${time.end}`);
      });
    }
    
    // Test status distribution
    const statusCounts = plans.reduce((acc, plan) => {
      acc[plan.status] = (acc[plan.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log('   - Status distribution:', statusCounts);
    
    // Test approval status distribution
    const approvalCounts = plans.reduce((acc, plan) => {
      acc[plan.approvalStatus] = (acc[plan.approvalStatus] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log('   - Approval status distribution:', approvalCounts);
    
    console.log('🎉 Production plans test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Export for use in browser console
if (typeof window !== 'undefined') {
  (window as any).testProductionPlans = testProductionPlans;
  console.log('🧪 testProductionPlans() function available globally for testing.');
}

export { testProductionPlans };
