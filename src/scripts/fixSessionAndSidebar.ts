// Quick fix for session and sidebar issues
import { masterDataService } from '../services/MasterDataService';
import { storageService } from '../services/StorageService';

async function fixSessionAndSidebar() {
  console.log('🔧 Fixing Session and Sidebar...');
  
  try {
    // Step 1: Check if we have organizations and tenants
    const [organizations, tenants, users] = await Promise.all([
      masterDataService.getOrganizations(),
      masterDataService.getTenants(),
      masterDataService.getUsers()
    ]);
    
    console.log('📊 Current Data:');
    console.log(`   - Organizations: ${organizations.length}`);
    console.log(`   - Tenants: ${tenants.length}`);
    console.log(`   - Users: ${users.length}`);
    
    // Step 2: Find or create Hillal and Margoon Cement
    let hillalOrg = organizations.find(org => org.name === 'Hillal');
    let margoonTenant = tenants.find(tenant => tenant.name === 'Margoon Cement');
    
    if (!hillalOrg) {
      console.log('Creating Hillal organization...');
      hillalOrg = await masterDataService.createOrganization({
        name: 'Hillal',
        code: 'HILLAL',
        description: 'Hillal Cement Manufacturing Company',
        address: 'Industrial Area, Riyadh, Saudi Arabia',
        contactEmail: 'info@hillal.com',
        contactPhone: '+966-11-123-4567'
      });
    }
    
    if (!margoonTenant) {
      console.log('Creating Margoon Cement tenant...');
      margoonTenant = await masterDataService.createTenant({
        name: 'Margoon Cement',
        code: 'MARGON',
        description: 'Margoon Cement Production Facility',
        organizationId: hillalOrg.id,
        address: 'Margoon Industrial Complex, Jeddah, Saudi Arabia',
        contactEmail: 'operations@margoon.hillal.com',
        contactPhone: '+966-12-987-6543'
      });
    }
    
    // Step 3: Find or create a demo user
    let demoUser = users.find(user => user.email === 'demo@hillal.com');
    
    if (!demoUser) {
      console.log('Creating demo user...');
      demoUser = await masterDataService.createUser({
        name: 'Demo User',
        email: 'demo@hillal.com',
        passwordHash: 'demo123',
        role: 'SuperAdmin',
        organizationId: hillalOrg.id,
        tenantId: margoonTenant.id,
        isActive: true
      });
    }
    
    // Step 4: Create proper session data
    const sessionData = {
      user: {
        id: demoUser.id,
        name: demoUser.name,
        email: demoUser.email,
        role: demoUser.role
      },
      organization: {
        id: hillalOrg.id,
        name: hillalOrg.name,
        code: hillalOrg.code
      },
      tenant: {
        id: margoonTenant.id,
        name: margoonTenant.name,
        code: margoonTenant.code
      },
      token: `demo_token_${demoUser.id}`
    };
    
    // Step 5: Save session to localStorage and sessionStorage
    localStorage.setItem('proact_session', JSON.stringify(sessionData));
    sessionStorage.setItem('proact_session', JSON.stringify(sessionData));
    
    console.log('✅ Session data created and saved');
    console.log('📋 Session Details:');
    console.log(`   - User: ${sessionData.user.name} (${sessionData.user.role})`);
    console.log(`   - Organization: ${sessionData.organization.name}`);
    console.log(`   - Tenant: ${sessionData.tenant.name}`);
    
    // Step 6: Set up plant selection
    const units = await masterDataService.getUnits();
    const firstUnit = units.find(unit => unit.name.includes('Raw Mill')) || units[0];
    
    if (firstUnit) {
      const plantSelection = {
        organization: hillalOrg,
        tenant: margoonTenant,
        unit: firstUnit
      };
      
      await storageService.initialize();
      await storageService.setAppSetting('plantSelection', plantSelection);
      
      console.log('✅ Plant selection configured');
      console.log(`   - Selected Unit: ${firstUnit.name}`);
    }
    
    console.log('🎉 Session and sidebar should now work!');
    console.log('🔄 Please refresh the page (F5) to see the changes');
    
  } catch (error) {
    console.error('❌ Fix failed:', error);
  }
}

async function checkSessionStatus() {
  console.log('🔍 Checking Session Status...');
  
  try {
    // Check localStorage
    const localSession = localStorage.getItem('proact_session');
    if (localSession) {
      const session = JSON.parse(localSession);
      console.log('✅ localStorage session found:');
      console.log(`   - User: ${session.user?.name || 'Missing'} (${session.user?.role || 'Missing'})`);
      console.log(`   - Organization: ${session.organization?.name || 'Missing'}`);
      console.log(`   - Tenant: ${session.tenant?.name || 'Missing'}`);
    } else {
      console.log('❌ No session in localStorage');
    }
    
    // Check sessionStorage
    const sessionData = sessionStorage.getItem('proact_session');
    if (sessionData) {
      console.log('✅ sessionStorage session found');
    } else {
      console.log('❌ No session in sessionStorage');
    }
    
    // Check IndexedDB data
    const [organizations, tenants, users] = await Promise.all([
      masterDataService.getOrganizations(),
      masterDataService.getTenants(),
      masterDataService.getUsers()
    ]);
    
    console.log('📊 IndexedDB Data:');
    console.log(`   - Organizations: ${organizations.length}`);
    console.log(`   - Tenants: ${tenants.length}`);
    console.log(`   - Users: ${users.length}`);
    
    if (organizations.length > 0) {
      console.log('   - Organizations:', organizations.map(o => o.name));
    }
    if (tenants.length > 0) {
      console.log('   - Tenants:', tenants.map(t => t.name));
    }
    if (users.length > 0) {
      console.log('   - Users:', users.map(u => `${u.name} (${u.role})`));
    }
    
  } catch (error) {
    console.error('❌ Check failed:', error);
  }
}

// Export for use in browser console
if (typeof window !== 'undefined') {
  (window as any).fixSessionAndSidebar = fixSessionAndSidebar;
  (window as any).checkSessionStatus = checkSessionStatus;
  console.log('🔧 Session fix functions available:');
  console.log('   - fixSessionAndSidebar() - Fix everything');
  console.log('   - checkSessionStatus() - Check current status');
}

export { fixSessionAndSidebar, checkSessionStatus };
