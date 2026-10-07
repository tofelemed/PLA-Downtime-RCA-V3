// UI wrapper for Oil and Gas data seeding
import { seedOilGasData } from './seedOilGasData';

export async function seedOilGasDataUI(): Promise<void> {
  console.log('🛢️ Starting ADNOC Oil and Gas data seeding from UI...');
  console.log('⚠️ This will clear ALL existing data first...');
  
  try {
    // Clear browser console for clean logging
    console.clear();
    console.log('🛢️ ADNOC Oil and Gas Data Seeding - Starting...');
    console.log('=' .repeat(70));
    
    await seedOilGasData();
    
    console.log('=' .repeat(70));
    console.log('✅ ADNOC Oil and Gas data seeding completed from UI');
    console.log('🔄 Please REFRESH your browser (Ctrl+Shift+R or Cmd+Shift+R)');
    console.log('=' .repeat(70));
  } catch (error) {
    console.log('=' .repeat(70));
    console.error('❌ ADNOC Oil and Gas data seeding failed:', error);
    console.log('=' .repeat(70));
    throw error;
  }
}

export async function verifyOilGasData(): Promise<void> {
  console.log('🔍 Verifying ADNOC Oil and Gas data...');
  
  const { masterDataService } = await import('../services/MasterDataService');
  
  try {
    // Find ADNOC tenant
    const orgs = await masterDataService.getOrganizations();
    const adnocOrg = orgs.find(o => o.name === 'ADNOC');
    
    if (!adnocOrg) {
      console.warn('⚠️ ADNOC organization not found. Please seed data first.');
      return;
    }
    
    const tenants = await masterDataService.getTenants();
    const adnocTenant = tenants.find(t => t.organizationId === adnocOrg.id);
    
    if (!adnocTenant) {
      console.warn('⚠️ ADNOC Onshore tenant not found. Please seed data first.');
      return;
    }
    
    const { storageService, User } = await import('../services/StorageService');
    
    const [
      impactCodes,
      oeeCodes,
      reasonCodes,
      rcaCauseCodes,
      units,
      assets,
      products,
      plans,
      events,
      rcas,
      losses,
      oees,
      users
    ] = await Promise.all([
      masterDataService.getImpactCodes({ tenantId: adnocTenant.id }),
      masterDataService.getOEECodes({ tenantId: adnocTenant.id }),
      masterDataService.getReasonCodes({ tenantId: adnocTenant.id }),
      masterDataService.getRCACauseCodes({ tenantId: adnocTenant.id }),
      masterDataService.getUnits(),
      masterDataService.getAssets({ tenantId: adnocTenant.id }),
      masterDataService.getProducts(),
      masterDataService.getProductionPlans({ tenantId: adnocTenant.id }),
      masterDataService.getProductionEvents({ tenantId: adnocTenant.id }),
      masterDataService.getRCAs({ tenantId: adnocTenant.id }),
      masterDataService.getProductionLosses({ tenantId: adnocTenant.id }),
      masterDataService.getOEESummaries({ tenantId: adnocTenant.id }),
      storageService.query('users', { tenantId: adnocTenant.id })
    ]);
    
    console.log('✅ ADNOC Oil and Gas Data Verification:');
    console.log(`   Organization: ${adnocOrg.name}`);
    console.log(`   Tenant: ${adnocTenant.name}`);
    console.log(`   Impact Codes: ${impactCodes.length} (expected: 25 with FULL cost data)`);
    console.log(`   OEE Codes: ${oeeCodes.length} (expected: 24)`);
    console.log(`   Reason Codes: ${reasonCodes.length} (expected: ~62)`);
    console.log(`   RCA Cause Codes: ${rcaCauseCodes.length} (expected: 10)`);
    console.log(`   Units: ${units.length} (expected: 9)`);
    console.log(`   Assets: ${assets.length} (expected: ~47)`);
    console.log(`   Products: ${products.length} (expected: 20)`);
    console.log(`   Users: ${users.length} (expected: 7)`);
    console.log(`   Production Plans: ${plans.length} (expected: 3)`);
    console.log(`   Production Events: ${events.length} (expected: ~150)`);
    console.log(`   RCA Investigations: ${rcas.length} (expected: 7)`);
    console.log(`   Production Losses: ${losses.length} (expected: ~30)`);
    console.log(`   OEE Summaries: ${oees.length} (expected: ~300)`);
    
    // Check RCA Trigger Configuration
    const { rcaTriggerConfigService } = await import('../services/RCATriggerConfigService');
    const rcaConfig = await rcaTriggerConfigService.getActiveConfig(adnocTenant.id);
    console.log(`   RCA Trigger Config: ${rcaConfig ? '✅ Configured' : '❌ Not configured'}`);
    if (rcaConfig) {
      console.log(`     - Total Rules: ${rcaConfig.rules.length}`);
      console.log(`     - Enabled Rules: ${rcaConfig.rules.filter(r => r.enabled).length}`);
      console.log(`     - Manual Creation: ${rcaConfig.globalSettings.alwaysAllowManualCreation ? 'Allowed' : 'Disabled'}`);
    }
    
    // Check RCA Analysis Configuration & Knowledge Base
    const { rcaAnalysisConfigService } = await import('../services/RCAAnalysisConfigService');
    const { rcaKnowledgeBaseService } = await import('../services/RCAKnowledgeBaseService');
    const analysisConfig = await rcaAnalysisConfigService.getActiveConfig(adnocTenant.id);
    const knowledgeEntries = await rcaKnowledgeBaseService.getAllKnowledgeEntries(adnocTenant.id);
    
    console.log(`   RCA Analysis Config: ${analysisConfig ? '✅ Configured' : '❌ Not configured'}`);
    if (analysisConfig) {
      const enabledTools = Object.entries(analysisConfig.enabledTools)
        .filter(([, enabled]) => enabled)
        .map(([tool]) => tool);
      console.log(`     - Enabled Tools: ${enabledTools.join(', ')}`);
      console.log(`     - Similarity Detection: ${analysisConfig.knowledgeBaseConfig.enableSimilarityDetection ? 'ON' : 'OFF'}`);
    }
    console.log(`   Knowledge Base Entries: ${knowledgeEntries.length}`);
    
    const isComplete = impactCodes.length >= 19 && 
                       oeeCodes.length >= 24 && 
                       units.length >= 9 && 
                       products.length >= 20 &&
                       rcaConfig !== null;
    
    if (isComplete) {
      console.log('✅ ADNOC data verification passed!');
    } else {
      console.warn('⚠️ Some ADNOC data may be incomplete. Consider reseeding.');
    }
  } catch (error) {
    console.error('❌ ADNOC data verification failed:', error);
    throw error;
  }
}

export async function clearOilGasData(): Promise<void> {
  console.log('🗑️ Clearing ADNOC Oil and Gas data...');
  
  const { masterDataService } = await import('../services/MasterDataService');
  
  try {
    // Find ADNOC tenant
    const orgs = await masterDataService.getOrganizations();
    const adnocOrg = orgs.find(o => o.name === 'ADNOC');
    
    if (!adnocOrg) {
      console.log('⚠️ ADNOC organization not found. Nothing to clear.');
      return;
    }
    
    const tenants = await masterDataService.getTenants();
    const adnocTenant = tenants.find(t => t.organizationId === adnocOrg.id);
    
    if (!adnocTenant) {
      console.log('⚠️ ADNOC Onshore tenant not found. Nothing to clear.');
      return;
    }
    
    const tenantId = adnocTenant.id;
    
    // Clear all ADNOC data
    const [plans, templates, events, rcas, losses, oees, assets, impactCodes, oeeCodes, reasonCodes] = await Promise.all([
      masterDataService.getProductionPlans({ tenantId }),
      masterDataService.getProductionPlanTemplates({ tenantId }),
      masterDataService.getProductionEvents({ tenantId }),
      masterDataService.getRCAs({ tenantId }),
      masterDataService.getProductionLosses({ tenantId }),
      masterDataService.getOEESummaries({ tenantId }),
      masterDataService.getAssets({ tenantId }),
      masterDataService.getImpactCodes({ tenantId }),
      masterDataService.getOEECodes({ tenantId }),
      masterDataService.getReasonCodes({ tenantId })
    ]);
    
    // Delete RCA trigger configs for this tenant
    const { rcaTriggerConfigService } = await import('../services/RCATriggerConfigService');
    const rcaConfigs = await rcaTriggerConfigService.getAllConfigs(tenantId);
    for (const config of rcaConfigs) {
      await rcaTriggerConfigService.deleteConfig(config.id);
    }
    console.log(`   ✅ Deleted ${rcaConfigs.length} RCA trigger configs`);
    
    // Delete all items
    for (const plan of plans) await masterDataService.deleteProductionPlan(plan.id);
    for (const template of templates) await masterDataService.deleteProductionPlanTemplate(template.id);
    for (const event of events) await masterDataService.deleteProductionEvent(event.id);
    for (const rca of rcas) await masterDataService.deleteRCA(rca.id);
    for (const loss of losses) await masterDataService.deleteProductionLoss(loss.id);
    for (const oee of oees) await masterDataService.deleteOEESummary(oee.id);
    for (const asset of assets) await masterDataService.deleteAsset(asset.id);
    for (const code of impactCodes) await masterDataService.deleteImpactCode(code.id);
    for (const code of oeeCodes) await masterDataService.deleteOEECode(code.id);
    for (const code of reasonCodes) await masterDataService.deleteReasonCode(code.id);
    
    // Delete units, products, tenant, and organization
    const units = await masterDataService.getUnits();
    for (const unit of units) await masterDataService.deleteUnit(unit.id);
    
    const products = await masterDataService.getProducts();
    for (const product of products) await masterDataService.deleteProduct(product.id);
    
    await masterDataService.deleteTenant(adnocTenant.id);
    await masterDataService.deleteOrganization(adnocOrg.id);
    
    console.log('✅ ADNOC Oil and Gas data cleared successfully');
  } catch (error) {
    console.error('❌ Failed to clear ADNOC data:', error);
    throw error;
  }
}

