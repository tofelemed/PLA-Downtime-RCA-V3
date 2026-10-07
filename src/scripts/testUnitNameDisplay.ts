// Test script to verify unit name display fixes
import { seedPresentationData, verifyPresentationData } from './seedPresentationData';
import { masterDataService } from '../services/MasterDataService';

async function testUnitNameDisplay() {
  console.log('🧪 Testing unit name display fixes...');
  
  try {
    // Get current tenant ID
    const sessionData = localStorage.getItem('proact_session');
    const session = sessionData ? JSON.parse(sessionData) : null;
    const tenantId = session?.tenant?.id || 'demo-tenant-001';
    
    // Load units and events
    const [units, events] = await Promise.all([
      masterDataService.getUnits(),
      masterDataService.getProductionEvents({ tenantId })
    ]);
    
    console.log('✅ Units loaded:', units.length);
    console.log('✅ Events loaded:', events.length);
    
    // Test unit name resolution
    const eventsWithUnitNames = events.map(event => {
      const unit = units.find(u => u.id === event.unitId);
      return {
        eventId: event.id,
        description: event.description,
        unitId: event.unitId,
        unitName: unit ? unit.name : 'Unknown Unit',
        duration: event.duration,
        operatorName: event.operatorName
      };
    });
    
    console.log('📊 Sample events with unit names:');
    eventsWithUnitNames.slice(0, 3).forEach(event => {
      console.log(`   - ${event.description}`);
      console.log(`     Unit: ${event.unitName} (ID: ${event.unitId})`);
      console.log(`     Duration: ${event.duration} min`);
      console.log(`     Operator: ${event.operatorName || 'Operator'}`);
      console.log('');
    });
    
    // Check if any events still have unit IDs instead of names
    const eventsWithUnknownUnits = eventsWithUnitNames.filter(e => e.unitName === 'Unknown Unit');
    if (eventsWithUnknownUnits.length > 0) {
      console.warn('⚠️ Events with unknown units:', eventsWithUnknownUnits.length);
      eventsWithUnknownUnits.forEach(event => {
        console.log(`   - ${event.description} (Unit ID: ${event.unitId})`);
      });
    } else {
      console.log('✅ All events have proper unit names!');
    }
    
    // Test the getUnitName helper function
    const testUnitIds = events.map(e => e.unitId).filter(Boolean).slice(0, 3);
    console.log('🔍 Testing unit name resolution:');
    testUnitIds.forEach(unitId => {
      const unit = units.find(u => u.id === unitId);
      const unitName = unit ? unit.name : unitId || 'Unknown Unit';
      console.log(`   ${unitId} → ${unitName}`);
    });
    
    console.log('🎉 Unit name display test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Export for use in browser console
if (typeof window !== 'undefined') {
  (window as any).testUnitNameDisplay = testUnitNameDisplay;
  console.log('🧪 testUnitNameDisplay() function available globally for testing.');
}

export { testUnitNameDisplay };
