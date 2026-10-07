// Script to clear all data and seed ADNOC Oil and Gas data
import { masterDataService } from '../services/MasterDataService';
import { globalOilGasDataSeeder } from '../services/OilGasDataSeeder';
import { storageService } from '../services/StorageService';

async function seedOilGasData() {
  console.log('🛢️🛢️🛢️ ADNOC OIL AND GAS DATA SEEDING 🛢️🛢️🛢️');
  console.log('=' .repeat(70));
  console.log('⚠️  This will DELETE ALL existing data and seed fresh ADNOC data');
  console.log('=' .repeat(70));
  
  try {
    // Step 1: Clear ALL existing data (cement and any other data)
    console.log('\n🧹 Step 1: Clearing ALL existing data...');
    
    // Get all existing data
    const [
      allOrgs,
      allTenants,
      allUnits,
      allAssets,
      allProducts,
      allImpactCodes,
      allOEECodes,
      allReasonCodes,
      allRCACauseCodes,
      allVerificationCodes
    ] = await Promise.all([
      masterDataService.getOrganizations(),
      masterDataService.getTenants(),
      masterDataService.getUnits(),
      masterDataService.getAssets({}),
      masterDataService.getProducts(),
      masterDataService.getImpactCodes({}),
      masterDataService.getOEECodes({}),
      masterDataService.getReasonCodes({}),
      masterDataService.getRCACauseCodes({}),
      masterDataService.getVerificationStatusCodes({})
    ]);
    
    console.log('\n📊 Current data count:');
    console.log(`   Organizations: ${allOrgs.length}`);
    console.log(`   Tenants: ${allTenants.length}`);
    console.log(`   Units: ${allUnits.length}`);
    console.log(`   Assets: ${allAssets.length}`);
    console.log(`   Products: ${allProducts.length}`);
    console.log(`   Impact Codes: ${allImpactCodes.length}`);
    console.log(`   OEE Codes: ${allOEECodes.length}`);
    console.log(`   Reason Codes: ${allReasonCodes.length}`);
    console.log(`   RCA Cause Codes: ${allRCACauseCodes.length}`);
    console.log(`   Verification Codes: ${allVerificationCodes.length}`);
    
    // Step 2: Delete all data (in reverse order of dependencies)
    console.log('\n🗑️  Step 2: Deleting all existing data...');
    let deleted = 0;
    
    // Delete transactional data first (for all tenants)
    for (const tenant of allTenants) {
      const [plans, templates, events, rcas, losses, oees] = await Promise.all([
        masterDataService.getProductionPlans({ tenantId: tenant.id }),
        masterDataService.getProductionPlanTemplates({ tenantId: tenant.id }),
        masterDataService.getProductionEvents({ tenantId: tenant.id }),
        masterDataService.getRCAs({ tenantId: tenant.id }),
        masterDataService.getProductionLosses({ tenantId: tenant.id }),
        masterDataService.getOEESummaries({ tenantId: tenant.id })
      ]);
      
      for (const item of [...plans, ...templates, ...events, ...rcas, ...losses, ...oees]) {
        try {
          if ('planBasis' in item) {
            await masterDataService.deleteProductionPlan(item.id);
          } else if ('sections' in item && !('eventType' in item)) {
            await masterDataService.deleteProductionPlanTemplate(item.id);
          } else if ('eventType' in item) {
            await masterDataService.deleteProductionEvent(item.id);
          } else if ('rootCause' in item) {
            await masterDataService.deleteRCA(item.id);
          } else if ('lossType' in item) {
            await masterDataService.deleteProductionLoss(item.id);
          } else if ('oee' in item) {
            await masterDataService.deleteOEESummary(item.id);
          }
          deleted++;
        } catch (error) {
          console.warn(`Warning: Could not delete item ${item.id}:`, error);
        }
      }
    }
    console.log(`   ✅ Deleted transactional data`);
    
    // Delete RCA templates
    for (const tenant of allTenants) {
      const rcaTemplates = await masterDataService.getRCATemplates({ tenantId: tenant.id });
      for (const template of rcaTemplates) {
        await masterDataService.deleteRCATemplate(template.id);
        deleted++;
      }
    }
    console.log(`   ✅ Deleted RCA templates`);
    
    // Delete assets
    for (const asset of allAssets) {
      await masterDataService.deleteAsset(asset.id);
      deleted++;
    }
    console.log(`   ✅ Deleted ${allAssets.length} assets`);
    
    // Delete units
    for (const unit of allUnits) {
      await masterDataService.deleteUnit(unit.id);
      deleted++;
    }
    console.log(`   ✅ Deleted ${allUnits.length} units`);
    
    // Delete products
    for (const product of allProducts) {
      await masterDataService.deleteProduct(product.id);
      deleted++;
    }
    console.log(`   ✅ Deleted ${allProducts.length} products`);
    
    // Delete all codes
    for (const code of allImpactCodes) {
      await masterDataService.deleteImpactCode(code.id);
      deleted++;
    }
    console.log(`   ✅ Deleted ${allImpactCodes.length} impact codes`);
    
    for (const code of allOEECodes) {
      await masterDataService.deleteOEECode(code.id);
      deleted++;
    }
    console.log(`   ✅ Deleted ${allOEECodes.length} OEE codes`);
    
    for (const code of allReasonCodes) {
      await masterDataService.deleteReasonCode(code.id);
      deleted++;
    }
    console.log(`   ✅ Deleted ${allReasonCodes.length} reason codes`);
    
    for (const code of allRCACauseCodes) {
      await masterDataService.deleteRCACauseCode(code.id);
      deleted++;
    }
    console.log(`   ✅ Deleted ${allRCACauseCodes.length} RCA cause codes`);
    
    for (const code of allVerificationCodes) {
      await masterDataService.deleteVerificationStatusCode(code.id);
      deleted++;
    }
    console.log(`   ✅ Deleted ${allVerificationCodes.length} verification codes`);
    
    // Delete tenants
    for (const tenant of allTenants) {
      await masterDataService.deleteTenant(tenant.id);
      deleted++;
    }
    console.log(`   ✅ Deleted ${allTenants.length} tenants`);
    
    // Delete organizations
    for (const org of allOrgs) {
      await masterDataService.deleteOrganization(org.id);
      deleted++;
    }
    console.log(`   ✅ Deleted ${allOrgs.length} organizations`);
    
    console.log(`\n   📊 Total items deleted: ${deleted}`);
    
    // Step 3: Create new ADNOC tenant
    console.log('\n🏢 Step 3: Creating ADNOC organization and tenant...');
    
    const adnocOrg = await masterDataService.createOrganization({
      name: 'ADNOC',
      code: 'ADNOC',
      description: 'Abu Dhabi National Oil Company',
      isActive: true
    });
    console.log(`   ✅ Created organization: ${adnocOrg.name}`);
    
    const adnocTenant = await masterDataService.createTenant({
      name: 'ADNOC Onshore',
      code: 'ADNOC_ONSHORE',
      description: 'ADNOC Onshore Operations - Oil and gas production and refining',
      organizationId: adnocOrg.id,
      isActive: true,
      address: 'Murban Field, Abu Dhabi, UAE',
      contactPerson: 'Mohammed Al-Jaber',
      contactEmail: 'mohammed.jaber@adnoc.ae',
      contactPhone: '+971-2-345-6789'
    });
    console.log(`   ✅ Created tenant: ${adnocTenant.name} (ID: ${adnocTenant.id})`);
    
    // Step 4: Seed ADNOC Oil and Gas data
    console.log('\n📦 Step 4: Seeding ADNOC Oil and Gas data...');
    console.log('   This will take a moment...');
    
    await globalOilGasDataSeeder.seedOilGasData(adnocTenant.id);
    
    // Step 5: Verify new data
    console.log('\n✅ Step 5: Verifying new data...');
    const [
      newImpact,
      newOee,
      newReason,
      newProducts,
      newUnits,
      newAssets,
      newPlans,
      newEvents,
      newRCAs
    ] = await Promise.all([
      masterDataService.getImpactCodes({ tenantId: adnocTenant.id }),
      masterDataService.getOEECodes({ tenantId: adnocTenant.id }),
      masterDataService.getReasonCodes({ tenantId: adnocTenant.id }),
      masterDataService.getProducts(),
      masterDataService.getUnits(),
      masterDataService.getAssets({ tenantId: adnocTenant.id }),
      masterDataService.getProductionPlans({ tenantId: adnocTenant.id }),
      masterDataService.getProductionEvents({ tenantId: adnocTenant.id }),
      masterDataService.getRCAs({ tenantId: adnocTenant.id })
    ]);
    
    console.log('\n📊 NEW ADNOC DATA COUNTS:');
    console.log(`   Impact Codes: ${newImpact.length} (expected: 19)`);
    console.log(`   OEE Codes: ${newOee.length} (expected: 24)`);
    console.log(`   Reason Codes: ${newReason.length} (expected: ~62)`);
    console.log(`   Products: ${newProducts.length} (expected: 20)`);
    console.log(`   Units: ${newUnits.length} (expected: 9)`);
    console.log(`   Assets: ${newAssets.length} (expected: ~45)`);
    console.log(`   Production Plans: ${newPlans.length} (expected: 3)`);
    console.log(`   Production Events: ${newEvents.length} (expected: ~150)`);
    console.log(`   RCA Investigations: ${newRCAs.length} (expected: 7)`);
    
    console.log('\n' + '='.repeat(70));
    console.log('✅✅✅ ADNOC DATA SEEDING COMPLETE! ✅✅✅');
    console.log('=' .repeat(70));
    console.log('🔄 Please REFRESH your browser (Ctrl+Shift+R or Cmd+Shift+R)');
    console.log('🛢️  Your application now has ADNOC Oil and Gas industry data!');
    console.log('=' .repeat(70));
    
    return {
      success: true,
      deleted,
      organization: adnocOrg.name,
      tenant: adnocTenant.name,
      tenantId: adnocTenant.id,
      newCounts: {
        impactCodes: newImpact.length,
        oeeCodes: newOee.length,
        reasonCodes: newReason.length,
        products: newProducts.length,
        units: newUnits.length,
        assets: newAssets.length,
        plans: newPlans.length,
        events: newEvents.length,
        rcas: newRCAs.length
      }
    };
    
  } catch (error) {
    console.error('❌❌❌ SEEDING FAILED ❌❌❌');
    console.error(error);
    throw error;
  }
}

// Make available in browser console
if (typeof window !== 'undefined') {
  (window as any).seedOilGasData = seedOilGasData;
  console.log('🛢️ ADNOC Oil and Gas seeding function loaded!');
  console.log('   To clear all data and seed ADNOC data, run: seedOilGasData()');
}

export { seedOilGasData };

