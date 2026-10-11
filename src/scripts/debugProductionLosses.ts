import { masterDataService, type ProductionEvent } from '../services/MasterDataService';
import { storageService } from '../services/StorageService';

/**
 * Debug helper to inspect production losses in IndexedDB
 * Usage: debugProductionLosses()
 */
export async function debugProductionLosses() {
  console.log('🔍 === PRODUCTION LOSSES DEBUG ===');
  
  try {
    // Get all production losses (no filter)
    const allLosses = await storageService.query('productionLosses', {});
    console.log(`📊 Total Production Losses in DB: ${allLosses.length}`);
    
    if (allLosses.length > 0) {
      console.log('\n📋 All Production Losses:');
      allLosses.forEach((loss: any, index: number) => {
        console.log(`\n  Loss ${index + 1}:`, {
          id: loss.id,
          planId: loss.planId,
          unitId: loss.unitId,
          quantity: loss.quantity,
          financialImpact: loss.financialImpact,
          lossDate: loss.lossDate,
          tenantId: loss.tenantId
        });
      });
      
      // Group by planId
      const byPlan = allLosses.reduce((acc: any, loss: any) => {
        const planId = loss.planId || 'NO_PLAN_ID';
        if (!acc[planId]) acc[planId] = [];
        acc[planId].push(loss);
        return acc;
      }, {});
      
      console.log('\n📊 Losses grouped by Plan ID:');
      Object.entries(byPlan).forEach(([planId, losses]: [string, any]) => {
        console.log(`  Plan ${planId}: ${losses.length} losses`);
      });
    } else {
      console.log('❌ No production losses found in database!');
    }
    
    // Get all production plans
    const allPlans = await storageService.query('productionPlans', {});
    console.log(`\n📋 Total Production Plans in DB: ${allPlans.length}`);
    
    if (allPlans.length > 0) {
      console.log('\n📋 All Production Plans:');
      allPlans.forEach((plan: any, index: number) => {
        const planLosses = allLosses.filter((l: any) => l.planId === plan.id);
        console.log(`\n  Plan ${index + 1}:`, {
          id: plan.id,
          name: plan.name,
          tenantId: plan.tenantId,
          lossesCount: planLosses.length
        });
      });
    }
    
    // Get all production loss events
    const lossEvents = (await storageService.query<ProductionEvent>('productionEvents'))
      .filter(event => event.eventType === 'ProductionLoss');
    console.log(`\n🎯 ProductionLoss Events: ${lossEvents.length}`);
    
    if (lossEvents.length > 0) {
      console.log('\n📋 ProductionLoss Events:');
      lossEvents.forEach((event: any, index: number) => {
        console.log(`\n  Event ${index + 1}:`, {
          id: event.id,
          title: event.title,
          planId: event.planId,
          unitId: event.unitId,
          quantity: event.quantity,
          eventType: event.eventType,
          tenantId: event.tenantId
        });
      });
    }
    
    console.log('\n✅ === DEBUG COMPLETE ===\n');
    
  } catch (error) {
    console.error('❌ Error debugging production losses:', error);
  }
}

// Expose globally for console access
if (typeof window !== 'undefined') {
  (window as any).debugProductionLosses = debugProductionLosses;
}

