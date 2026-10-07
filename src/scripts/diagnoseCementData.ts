// Diagnostic script to check cement industry data integrity
import { masterDataService } from '../services/MasterDataService';
import { storageService } from '../services/StorageService';

export async function diagnoseCementIndustryData() {
  console.log('🔍 Diagnosing cement industry data...\n');
  
  try {
    await storageService.initialize();
    
    // Get all data
    const organizations = await masterDataService.getOrganizations();
    const tenants = await masterDataService.getTenants();
    const units = await masterDataService.getUnits();
    const assets = await masterDataService.getAssets({});
    
    console.log('📊 Data Summary:');
    console.log(`   Organizations: ${organizations.length}`);
    console.log(`   Tenants: ${tenants.length}`);
    console.log(`   Units: ${units.length}`);
    console.log(`   Assets: ${assets.length}\n`);
    
    // Check Hillal organization
    const hillalOrg = organizations.find(o => o.name === 'Hillal');
    if (hillalOrg) {
      console.log('✅ Hillal Organization found:');
      console.log(`   ID: ${hillalOrg.id}`);
      console.log(`   Name: ${hillalOrg.name}\n`);
    } else {
      console.log('❌ Hillal Organization NOT found\n');
    }
    
    // Check Margoon Cement tenant
    const margoonTenant = tenants.find(t => t.name === 'Margoon Cement');
    if (margoonTenant) {
      console.log('✅ Margoon Cement Tenant found:');
      console.log(`   ID: ${margoonTenant.id}`);
      console.log(`   Name: ${margoonTenant.name}`);
      console.log(`   Organization ID: ${margoonTenant.organizationId}`);
      console.log(`   Matches Hillal: ${margoonTenant.organizationId === hillalOrg?.id ? '✅' : '❌'}\n`);
    } else {
      console.log('❌ Margoon Cement Tenant NOT found\n');
    }
    
    // Check units for Margoon Cement
    if (margoonTenant) {
      const margoonUnits = units.filter(u => u.tenantId === margoonTenant.id);
      console.log(`📍 Units for Margoon Cement: ${margoonUnits.length}`);
      
      if (margoonUnits.length > 0) {
        console.log('   Units:');
        margoonUnits.forEach(unit => {
          console.log(`   - ${unit.name} (ID: ${unit.id}, TenantID: ${unit.tenantId})`);
        });
        console.log('');
      } else {
        console.log('   ❌ No units found for Margoon Cement');
        console.log('   ⚠️ This is the problem! Units need tenantId set to:', margoonTenant.id);
        console.log('\n   Current units:');
        units.forEach(unit => {
          console.log(`   - ${unit.name} (TenantID: ${unit.tenantId || 'MISSING'})`);
        });
        console.log('');
      }
    }
    
    // Check plant selection
    const plantSelection = await storageService.getAppSetting('plantSelection');
    if (plantSelection) {
      console.log('✅ Plant Selection found:');
      console.log(`   Organization: ${plantSelection.organization?.name}`);
      console.log(`   Tenant: ${plantSelection.tenant?.name}`);
      console.log(`   Unit: ${plantSelection.unit?.name}`);
      
      if (plantSelection.unit && margoonTenant) {
        const unitValid = units.some(u => u.id === plantSelection.unit.id && u.tenantId === margoonTenant.id);
        console.log(`   Unit valid: ${unitValid ? '✅' : '❌'}\n`);
      }
    } else {
      console.log('❌ Plant Selection NOT found\n');
    }
    
    // Check RCA data
    const rcas = await masterDataService.getRCAs({});
    const rcaTemplates = await masterDataService.getRCATemplates({});
    console.log(`📋 RCA Data:`);
    console.log(`   RCA Templates: ${rcaTemplates.length}`);
    console.log(`   RCA Investigations: ${rcas.length}`);
    
    if (rcaTemplates.length > 0) {
      console.log('   Templates:');
      rcaTemplates.forEach(t => {
        console.log(`   - ${t.name}`);
      });
    }
    
    if (rcas.length > 0) {
      console.log('   Investigations:');
      rcas.forEach(r => {
        console.log(`   - ${r.title} (Status: ${r.status})`);
      });
    }
    
    if (rcas.length === 0 && rcaTemplates.length === 0) {
      console.log('   ❌ No RCA data found - this is the issue!\n');
    } else {
      console.log('');
    }
    
    // Check events
    const events = await masterDataService.getProductionEvents({});
    console.log(`🚨 Production Events: ${events.length}`);
    if (events.length > 0) {
      const eventTypes = events.reduce((acc, e) => {
        acc[e.eventType] = (acc[e.eventType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      console.log('   Event Types:');
      Object.entries(eventTypes).forEach(([type, count]) => {
        console.log(`   - ${type}: ${count}`);
      });
    }
    
    console.log('\n✅ Diagnostic complete!');
    
  } catch (error) {
    console.error('❌ Diagnostic failed:', error);
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  (window as any).diagnoseCementIndustryData = diagnoseCementIndustryData;
}

export default diagnoseCementIndustryData;
