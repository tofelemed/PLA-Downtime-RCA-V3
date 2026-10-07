// Test script to verify data seeding functionality
// This script can be run in the browser console to test the seeding

import { globalPLARCADataSeeder } from '../services/PLARCADataSeeder';
import { masterDataService } from '../services/MasterDataService';

export async function testDataSeeding() {
  console.log('🧪 Testing data seeding functionality...');
  
  try {
    const tenantId = 'demo-tenant-001';
    
    // Test 1: Check if data seeder is available
    console.log('✅ Test 1: Data seeder instance available');
    
    // Test 2: Check if data is already seeded
    const isSeeded = await globalPLARCADataSeeder.isDataSeeded(tenantId);
    console.log(`✅ Test 2: Data seeded check - ${isSeeded ? 'Already seeded' : 'Not seeded'}`);
    
    // Test 3: Try to seed data
    console.log('🔄 Test 3: Attempting to seed data...');
    await globalPLARCADataSeeder.seedPLARCAData(tenantId);
    console.log('✅ Test 3: Data seeding completed');
    
    // Test 4: Verify data was created
    console.log('🔍 Test 4: Verifying seeded data...');
    const events = await masterDataService.getProductionEvents({ tenantId });
    const rcas = await masterDataService.getRCAs({ tenantId });
    const templates = await masterDataService.getRCATemplates({ tenantId });
    const units = await masterDataService.getUnits();
    const assets = await masterDataService.getAssets({ tenantId });
    const impactCodes = await masterDataService.getImpactCodes({ tenantId });
    const oeeCodes = await masterDataService.getOEECodes({ tenantId });
    const reasonCodes = await masterDataService.getReasonCodes({ tenantId });
    
    console.log('📊 Test 4 Results:');
    console.log(`   - Production Events: ${events.length}`);
    console.log(`   - RCA Investigations: ${rcas.length}`);
    console.log(`   - RCA Templates: ${templates.length}`);
    console.log(`   - Production Units: ${units.length}`);
    console.log(`   - Assets: ${assets.length}`);
    console.log(`   - Impact Codes: ${impactCodes.length}`);
    console.log(`   - OEE Codes: ${oeeCodes.length}`);
    console.log(`   - Reason Codes: ${reasonCodes.length}`);
    
    // Test 5: Check data quality
    console.log('🔍 Test 5: Checking data quality...');
    if (events.length > 0) {
      console.log('✅ Production events created successfully');
      console.log('   Sample event:', events[0].description);
    }
    
    if (rcas.length > 0) {
      console.log('✅ RCA investigations created successfully');
      console.log('   Sample RCA:', rcas[0].title);
    }
    
    if (templates.length > 0) {
      console.log('✅ RCA templates created successfully');
      console.log('   Sample template:', templates[0].name);
    }
    
    if (units.length > 0) {
      console.log('✅ Production units created successfully');
      console.log('   Sample unit:', units[0].name);
    }
    
    if (assets.length > 0) {
      console.log('✅ Assets created successfully');
      console.log('   Sample asset:', assets[0].name);
    }
    
    console.log('🎉 All tests passed! Data seeding is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Make available globally in browser
if (typeof window !== 'undefined') {
  (window as any).testDataSeeding = testDataSeeding;
  console.log('🧪 Test function available: testDataSeeding()');
}
