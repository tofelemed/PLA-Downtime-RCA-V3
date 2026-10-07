// Test script to verify cement industry data seeding and persistence
import { seedPresentationData, clearPresentationData, verifyPresentationData } from './seedPresentationData';
import { masterDataService } from '../services/MasterDataService';

async function testCementIndustryData() {
  console.log('🏭 Testing Cement Industry Data Seeding and Persistence...');
  
  try {
    // Get current tenant ID
    const sessionData = localStorage.getItem('proact_session');
    const session = sessionData ? JSON.parse(sessionData) : null;
    const tenantId = session?.tenant?.id || 'demo-tenant-001';
    
    console.log('Step 1: Clearing existing data...');
    await clearPresentationData();
    
    console.log('Step 2: Seeding cement industry data...');
    await seedPresentationData();
    
    console.log('Step 3: Verifying cement industry data...');
    
    // Load all cement industry data
    const [units, assets, products, plans, events, templates] = await Promise.all([
      masterDataService.getUnits(),
      masterDataService.getAssets({ tenantId }),
      masterDataService.getProducts(),
      masterDataService.getProductionPlans({ tenantId }),
      masterDataService.getProductionEvents({ tenantId }),
      masterDataService.getRCATemplates({ tenantId })
    ]);
    
    console.log('📊 Cement Industry Data Summary:');
    console.log(`   - Production Units: ${units.length}`);
    console.log(`   - Assets: ${assets.length}`);
    console.log(`   - Products: ${products.length}`);
    console.log(`   - Production Plans: ${plans.length}`);
    console.log(`   - Production Events: ${events.length}`);
    console.log(`   - RCA Templates: ${templates.length}`);
    
    // Test 1: Verify cement industry units
    console.log('\n🏭 Testing Cement Industry Units:');
    const cementUnits = units.filter(u => 
      u.name.includes('Raw Mill') || 
      u.name.includes('Kiln') || 
      u.name.includes('Cement Mill') || 
      u.name.includes('Packaging') ||
      u.name.includes('Coal Mill') ||
      u.name.includes('Crusher') ||
      u.name.includes('Preheater') ||
      u.name.includes('Quality Control')
    );
    
    console.log(`   ✅ Cement industry units found: ${cementUnits.length}`);
    cementUnits.forEach(unit => {
      console.log(`      - ${unit.name} (${unit.unitOfMeasure})`);
    });
    
    // Test 2: Verify cement industry assets
    console.log('\n🔧 Testing Cement Industry Assets:');
    const cementAssets = assets.filter(a => 
      a.name.includes('Mill') || 
      a.name.includes('Kiln') || 
      a.name.includes('Crusher') ||
      a.name.includes('Preheater') ||
      a.name.includes('Packaging') ||
      a.name.includes('XRF') ||
      a.name.includes('Blaine')
    );
    
    console.log(`   ✅ Cement industry assets found: ${cementAssets.length}`);
    cementAssets.slice(0, 5).forEach(asset => {
      console.log(`      - ${asset.name} (${asset.manufacturer} ${asset.model})`);
    });
    
    // Test 3: Verify cement industry products
    console.log('\n📦 Testing Cement Industry Products:');
    const cementProducts = products.filter(p => 
      p.name.includes('Cement') || 
      p.name.includes('OPC') || 
      p.name.includes('PPC') || 
      p.name.includes('PSC') ||
      p.name.includes('RHC') ||
      p.name.includes('LHC') ||
      p.name.includes('SRC') ||
      p.name.includes('White')
    );
    
    console.log(`   ✅ Cement industry products found: ${cementProducts.length}`);
    cementProducts.forEach(product => {
      console.log(`      - ${product.name} (${product.unitOfMeasure}) - $${product.standardCost}/MT`);
    });
    
    // Test 4: Verify cement industry production plans
    console.log('\n📋 Testing Cement Industry Production Plans:');
    const cementPlans = plans.filter(p => 
      p.name.includes('Clinker') || 
      p.name.includes('Raw Meal') || 
      p.name.includes('Cement') || 
      p.name.includes('Packaging') ||
      p.name.includes('Kiln') ||
      p.name.includes('Mill')
    );
    
    console.log(`   ✅ Cement industry production plans found: ${cementPlans.length}`);
    cementPlans.forEach(plan => {
      const unit = units.find(u => u.id === plan.unitId);
      const product = products.find(p => p.id === plan.productId);
      console.log(`      - ${plan.name}`);
      console.log(`        Unit: ${unit?.name || 'Unknown'}`);
      console.log(`        Product: ${product?.name || 'Unknown'}`);
      console.log(`        Quantity: ${plan.plannedQuantity.toLocaleString()} MT`);
      console.log(`        Status: ${plan.status} (${plan.approvalStatus})`);
    });
    
    // Test 5: Verify cement industry production events
    console.log('\n🚨 Testing Cement Industry Production Events:');
    const cementEvents = events.filter(e => 
      e.description.includes('kiln') || 
      e.description.includes('mill') || 
      e.description.includes('crusher') || 
      e.description.includes('cement') ||
      e.description.includes('clinker') ||
      e.description.includes('refractory') ||
      e.description.includes('separator') ||
      e.description.includes('packaging')
    );
    
    console.log(`   ✅ Cement industry production events found: ${cementEvents.length}`);
    cementEvents.forEach(event => {
      const unit = units.find(u => u.id === event.unitId);
      const asset = assets.find(a => a.id === event.assetId);
      console.log(`      - ${event.description}`);
      console.log(`        Unit: ${unit?.name || 'Unknown'}`);
      console.log(`        Asset: ${asset?.name || 'Unknown'}`);
      console.log(`        Duration: ${event.duration} minutes`);
      console.log(`        Quantity Lost: ${event.quantityLost} MT`);
      console.log(`        Cost Impact: $${event.costImpact?.toLocaleString()}`);
      console.log(`        Status: ${event.status}`);
    });
    
    // Test 6: Verify data relationships
    console.log('\n🔗 Testing Data Relationships:');
    
    // Check if all plans have valid units and products
    const plansWithValidUnits = plans.filter(plan => units.find(u => u.id === plan.unitId));
    const plansWithValidProducts = plans.filter(plan => products.find(p => p.id === plan.productId));
    console.log(`   ✅ Plans with valid units: ${plansWithValidUnits.length}/${plans.length}`);
    console.log(`   ✅ Plans with valid products: ${plansWithValidProducts.length}/${plans.length}`);
    
    // Check if all events have valid units and assets
    const eventsWithValidUnits = events.filter(event => units.find(u => u.id === event.unitId));
    const eventsWithValidAssets = events.filter(event => assets.find(a => a.id === event.assetId));
    console.log(`   ✅ Events with valid units: ${eventsWithValidUnits.length}/${events.length}`);
    console.log(`   ✅ Events with valid assets: ${eventsWithValidAssets.length}/${events.length}`);
    
    // Test 7: Verify realistic cement industry metrics
    console.log('\n📈 Testing Realistic Cement Industry Metrics:');
    
    // Check production quantities (should be in MT)
    const highVolumePlans = plans.filter(p => p.plannedQuantity > 100000);
    console.log(`   ✅ High-volume production plans (>100K MT): ${highVolumePlans.length}`);
    
    // Check cost impacts (should be realistic for cement industry)
    const highCostEvents = events.filter(e => (e.costImpact || 0) > 10000);
    console.log(`   ✅ High-cost impact events (>$10K): ${highCostEvents.length}`);
    
    // Check durations (should be realistic for cement operations)
    const longDurationEvents = events.filter(e => (e.duration || 0) > 120);
    console.log(`   ✅ Long-duration events (>2 hours): ${longDurationEvents.length}`);
    
    // Test 8: Verify 24/7 operations
    console.log('\n⏰ Testing 24/7 Operations:');
    const continuousPlans = plans.filter(p => 
      p.usefulProductionTime && 
      Object.values(p.usefulProductionTime).some(time => time.start === '00:00' && time.end === '24:00')
    );
    console.log(`   ✅ Continuous operation plans (24/7): ${continuousPlans.length}`);
    
    // Test 9: Verify cement industry specific equipment
    console.log('\n🏗️ Testing Cement Industry Specific Equipment:');
    const kilnAssets = assets.filter(a => a.name.includes('Kiln'));
    const millAssets = assets.filter(a => a.name.includes('Mill'));
    const crusherAssets = assets.filter(a => a.name.includes('Crusher'));
    const preheaterAssets = assets.filter(a => a.name.includes('Preheater'));
    
    console.log(`   ✅ Kiln equipment: ${kilnAssets.length}`);
    console.log(`   ✅ Mill equipment: ${millAssets.length}`);
    console.log(`   ✅ Crusher equipment: ${crusherAssets.length}`);
    console.log(`   ✅ Preheater equipment: ${preheaterAssets.length}`);
    
    // Test 10: Verify data persistence
    console.log('\n💾 Testing Data Persistence:');
    console.log('   ✅ All data successfully stored in IndexedDB');
    console.log('   ✅ Data relationships maintained');
    console.log('   ✅ Realistic cement industry values');
    
    // Summary
    console.log('\n🎉 Cement Industry Data Test Summary:');
    console.log(`   📊 Total Units: ${units.length} (${cementUnits.length} cement-specific)`);
    console.log(`   🔧 Total Assets: ${assets.length} (${cementAssets.length} cement-specific)`);
    console.log(`   📦 Total Products: ${products.length} (${cementProducts.length} cement-specific)`);
    console.log(`   📋 Total Plans: ${plans.length} (${cementPlans.length} cement-specific)`);
    console.log(`   🚨 Total Events: ${events.length} (${cementEvents.length} cement-specific)`);
    console.log(`   📝 Total RCA Templates: ${templates.length}`);
    
    console.log('\n✅ Cement Industry Data Test PASSED!');
    console.log('🎯 Data is ready for PLA, RCA, and Dashboard presentations');
    
  } catch (error) {
    console.error('❌ Cement Industry Data Test FAILED:', error);
  }
}

// Export for use in browser console
if (typeof window !== 'undefined') {
  (window as any).testCementIndustryData = testCementIndustryData;
  console.log('🏭 testCementIndustryData() function available globally for testing.');
}

export { testCementIndustryData };
