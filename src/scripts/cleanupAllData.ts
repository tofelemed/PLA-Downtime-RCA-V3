// Complete data cleanup and reset script
import { masterDataService } from '../services/MasterDataService';
import { globalCementIndustryDataSeeder } from '../services/CementIndustryDataSeeder';
import { storageService } from '../services/StorageService';

async function cleanupAllData() {
  console.log('🧹🧹🧹 COMPLETE DATA CLEANUP STARTING 🧹🧹🧹');
  console.log('=' .repeat(70));
  console.log('⚠️  This will DELETE ALL data and reseed fresh cement industry data');
  console.log('=' .repeat(70));
  
  try {
    // Step 1: Get tenant info
    console.log('\n📍 Step 1: Finding tenant...');
    const tenants = await masterDataService.getTenants();
    const cementTenant = tenants.find(t => t.name.includes('Margoon') || t.code.includes('MARGOON'));
    
    if (!cementTenant) {
      console.error('❌ Margoon Cement tenant not found!');
      return;
    }
    
    console.log(`   ✅ Found: ${cementTenant.name} (ID: ${cementTenant.id})`);
    const tenantId = cementTenant.id;
    
    // Step 2: Count current data
    console.log('\n📊 Step 2: Counting existing data...');
    const [impactCodes, oeeCodes, reasonCodes, rcaCauseCodes, verificationCodes, products, units, assets] = await Promise.all([
      masterDataService.getImpactCodes({ tenantId }),
      masterDataService.getOEECodes({ tenantId }),
      masterDataService.getReasonCodes({ tenantId }),
      masterDataService.getRCACauseCodes({ tenantId }),
      masterDataService.getVerificationStatusCodes({ tenantId }),
      masterDataService.getProducts(),
      masterDataService.getUnits({ tenantId }),
      masterDataService.getAssets({ tenantId })
    ]);
    
    console.log(`   Impact Codes: ${impactCodes.length}`);
    console.log(`   OEE Codes: ${oeeCodes.length}`);
    console.log(`   Reason Codes: ${reasonCodes.length}`);
    console.log(`   RCA Cause Codes: ${rcaCauseCodes.length}`);
    console.log(`   Verification Codes: ${verificationCodes.length}`);
    console.log(`   Products: ${products.length}`);
    console.log(`   Units: ${units.length}`);
    console.log(`   Assets: ${assets.length}`);
    
    // Step 3: Delete all codes
    console.log('\n🗑️  Step 3: Deleting all codes...');
    let deleted = 0;
    
    for (const code of impactCodes) {
      await masterDataService.deleteImpactCode(code.id);
      deleted++;
    }
    console.log(`   ✅ Deleted ${impactCodes.length} Impact Codes`);
    
    for (const code of oeeCodes) {
      await masterDataService.deleteOEECode(code.id);
      deleted++;
    }
    console.log(`   ✅ Deleted ${oeeCodes.length} OEE Codes`);
    
    for (const code of reasonCodes) {
      await masterDataService.deleteReasonCode(code.id);
      deleted++;
    }
    console.log(`   ✅ Deleted ${reasonCodes.length} Reason Codes`);
    
    for (const code of rcaCauseCodes) {
      await masterDataService.deleteRCACauseCode(code.id);
      deleted++;
    }
    console.log(`   ✅ Deleted ${rcaCauseCodes.length} RCA Cause Codes`);
    
    for (const code of verificationCodes) {
      await masterDataService.deleteVerificationStatusCode(code.id);
      deleted++;
    }
    console.log(`   ✅ Deleted ${verificationCodes.length} Verification Status Codes`);
    
    // Step 4: Delete all products
    console.log('\n🗑️  Step 4: Deleting all products...');
    for (const product of products) {
      await masterDataService.deleteProduct(product.id);
      deleted++;
    }
    console.log(`   ✅ Deleted ${products.length} Products`);
    
    // Step 5: Delete all assets
    console.log('\n🗑️  Step 5: Deleting all assets...');
    for (const asset of assets) {
      await masterDataService.deleteAsset(asset.id);
      deleted++;
    }
    console.log(`   ✅ Deleted ${assets.length} Assets`);
    
    // Step 6: Delete all units
    console.log('\n🗑️  Step 6: Deleting all units...');
    for (const unit of units) {
      await masterDataService.deleteUnit(unit.id);
      deleted++;
    }
    console.log(`   ✅ Deleted ${units.length} Units`);
    
    console.log(`\n   📊 Total items deleted: ${deleted}`);
    
    // Step 7: Clear the seeded flag
    console.log('\n🔧 Step 7: Resetting seeder state...');
    // The seeder tracks if it has run, so we need to create a new instance
    
    // Step 8: Re-seed fresh data
    console.log('\n📦 Step 8: Seeding fresh cement industry data...');
    console.log('   This will take a moment...');
    
    await globalCementIndustryDataSeeder.seedCementIndustryData(tenantId);
    
    // Step 9: Verify new data
    console.log('\n✅ Step 9: Verifying new data...');
    const [newImpact, newOee, newReason, newProducts, newUnits, newAssets] = await Promise.all([
      masterDataService.getImpactCodes({ tenantId }),
      masterDataService.getOEECodes({ tenantId }),
      masterDataService.getReasonCodes({ tenantId }),
      masterDataService.getProducts(),
      masterDataService.getUnits({ tenantId }),
      masterDataService.getAssets({ tenantId })
    ]);
    
    console.log('\n📊 NEW DATA COUNTS:');
    console.log(`   Impact Codes: ${newImpact.length} (expected: 19)`);
    console.log(`   OEE Codes: ${newOee.length} (expected: 24)`);
    console.log(`   Reason Codes: ${newReason.length} (expected: 74)`);
    console.log(`   Products: ${newProducts.length} (expected: 23-24)`);
    console.log(`   Units: ${newUnits.length} (expected: 8)`);
    console.log(`   Assets: ${newAssets.length} (expected: 37)`);
    
    console.log('\n' + '='.repeat(70));
    console.log('✅✅✅ CLEANUP COMPLETE! ✅✅✅');
    console.log('=' .repeat(70));
    console.log('🔄 Please REFRESH your browser (Ctrl+Shift+R) to see the changes');
    console.log('=' .repeat(70));
    
    return {
      success: true,
      deleted,
      newCounts: {
        impactCodes: newImpact.length,
        oeeCodes: newOee.length,
        reasonCodes: newReason.length,
        products: newProducts.length,
        units: newUnits.length,
        assets: newAssets.length
      }
    };
    
  } catch (error) {
    console.error('❌❌❌ CLEANUP FAILED ❌❌❌');
    console.error(error);
    throw error;
  }
}

// Make available in browser console
if (typeof window !== 'undefined') {
  (window as any).cleanupAllData = cleanupAllData;
  console.log('💡 Cleanup function loaded!');
  console.log('   To cleanup duplicates and reset data, run: cleanupAllData()');
}

export { cleanupAllData };

