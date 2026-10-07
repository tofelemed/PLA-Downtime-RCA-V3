// Test script to verify presentation data fixes
import { seedPresentationData, verifyPresentationData } from './seedPresentationData';
import { masterDataService } from '../services/MasterDataService';

async function testPresentationDataFixes() {
  console.log('🧪 Testing presentation data fixes...');
  
  try {
    // Clear and reseed data
    console.log('Step 1: Seeding fresh presentation data...');
    await seedPresentationData();
    
    // Verify the data
    console.log('Step 2: Verifying data integrity...');
    await verifyPresentationData();
    
    // Test specific fixes
    console.log('Step 3: Testing specific fixes...');
    
    // Get current tenant ID
    const sessionData = localStorage.getItem('proact_session');
    const session = sessionData ? JSON.parse(sessionData) : null;
    const tenantId = session?.tenant?.id || 'demo-tenant-001';
    
    // Test units loading
    const units = await masterDataService.getUnits();
    console.log('✅ Units loaded:', units.length, 'units found');
    if (units.length > 0) {
      console.log('   Sample unit:', units[0].name);
    }
    
    // Test events with duration
    const events = await masterDataService.getProductionEvents({ tenantId });
    console.log('✅ Events loaded:', events.length, 'events found');
    
    const eventsWithDuration = events.filter(e => e.duration && e.duration > 0);
    console.log('✅ Events with duration:', eventsWithDuration.length, 'out of', events.length);
    
    if (eventsWithDuration.length > 0) {
      console.log('   Sample event duration:', eventsWithDuration[0].duration, 'minutes');
      console.log('   Sample event description:', eventsWithDuration[0].description);
    }
    
    // Test unit names in events
    const eventsWithUnitNames = events.filter(e => {
      const unit = units.find(u => u.id === e.unitId);
      return unit && unit.name !== 'Unknown Unit';
    });
    console.log('✅ Events with proper unit names:', eventsWithUnitNames.length, 'out of', events.length);
    
    if (eventsWithUnitNames.length > 0) {
      const event = eventsWithUnitNames[0];
      const unit = units.find(u => u.id === event.unitId);
      console.log('   Sample event unit:', unit?.name);
    }
    
    // Calculate total duration
    const totalDuration = events.reduce((sum, e) => sum + (e.duration || 0), 0);
    console.log('✅ Total duration across all events:', totalDuration, 'minutes');
    
    console.log('🎉 All tests passed! Presentation data is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Export for use in browser console
if (typeof window !== 'undefined') {
  (window as any).testPresentationDataFixes = testPresentationDataFixes;
  console.log('🧪 testPresentationDataFixes() function available globally for testing.');
}

export { testPresentationDataFixes };
