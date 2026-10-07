/**
 * Complete Test Environment Setup Script
 * 
 * This script:
 * 1. Creates a test user (SuperAdmin)
 * 2. Sets up master data for Oil & Gas industry (ADNOC)
 * 3. Configures PI connection (if available)
 * 4. Tests event pulling from PI
 * 
 * Run with: npm run setup:test-env
 * Or: npx ts-node scripts/setup-test-environment.ts
 */

import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import axios from 'axios';
import * as bcrypt from 'bcryptjs';

dotenv.config();

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4004/api';
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '1433', 10);
const DB_USERNAME = process.env.DB_USERNAME || 'sa';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'ProActDB';

interface TestUser {
  email: string;
  password: string;
  name: string;
  role: string;
}

interface SetupResult {
  success: boolean;
  user?: TestUser;
  organizationId?: string;
  tenantId?: string;
  unitId?: string;
  piConnectionId?: string;
  message: string;
}

async function setupTestEnvironment(): Promise<SetupResult> {
  console.log('🚀 Starting Test Environment Setup...\n');
  console.log('='.repeat(70));

  const testUser: TestUser = {
    email: 'test@proact.com',
    password: 'Test123!@#',
    name: 'Test SuperAdmin',
    role: 'SuperAdmin'
  };

  try {
    // Step 1: Create test user
    console.log('\n👤 Step 1: Creating test user...');
    let userToken: string | null = null;
    let userId: string | null = null;
    let organizationId: string | null = null;
    let tenantId: string | null = null;

    try {
      // Try to register user
      const registerResponse = await axios.post(`${API_BASE_URL}/auth/register`, {
        email: testUser.email,
        password: testUser.password,
        name: testUser.name,
        role: testUser.role
      });

      console.log('   ✅ User registered successfully');
      userId = registerResponse.data.user?.id || registerResponse.data.id;
    } catch (error: any) {
      if (error.response?.status === 409) {
        console.log('   ℹ️  User already exists, attempting login...');
      } else {
        console.error('   ❌ Registration failed:', error.response?.data || error.message);
        throw error;
      }
    }

    // Login to get token
    try {
      const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
        email: testUser.email,
        password: testUser.password
      });

      userToken = loginResponse.data.accessToken || loginResponse.data.access_token;
      if (!userToken) {
        throw new Error('No access token received from login');
      }

      userId = loginResponse.data.user?.id || userId;
      console.log('   ✅ User logged in successfully');
      console.log(`   📧 Email: ${testUser.email}`);
      console.log(`   🔑 Role: ${testUser.role}`);
    } catch (error: any) {
      console.error('   ❌ Login failed:', error.response?.data || error.message);
      throw error;
    }

    // Step 2: Create Organization
    console.log('\n🏢 Step 2: Creating organization...');
    let org;
    try {
      // First, try to find existing organization
      const orgsResponse = await axios.get(`${API_BASE_URL}/organizations`, {
        headers: { Authorization: `Bearer ${userToken}` }
      });
      const orgs = Array.isArray(orgsResponse.data) ? orgsResponse.data : [];
      org = orgs.find((o: any) => o.name === 'ADNOC' || o.code === 'ADNOC-001');
      
      if (org) {
        organizationId = org.id;
        console.log(`   ℹ️  Using existing organization: ${org.name} (ID: ${org.id})`);
      } else {
        // Create new organization
        const orgResponse = await axios.post(
          `${API_BASE_URL}/organizations`,
          {
            name: 'ADNOC',
            code: 'ADNOC-001',
            description: 'Abu Dhabi National Oil Company - Test Organization'
          },
          {
            headers: { Authorization: `Bearer ${userToken}` }
          }
        );
        org = orgResponse.data;
        organizationId = org.id;
        console.log(`   ✅ Organization created: ${org.name} (ID: ${org.id})`);
      }
    } catch (error: any) {
      console.error('   ❌ Failed to get/create organization:', error.response?.data?.message || error.message);
      throw error;
    }

    // Step 3: Create Tenant
    console.log('\n🏭 Step 3: Creating tenant...');
    let tenant;
    try {
      // First, try to find existing tenant
      const tenantsResponse = await axios.get(`${API_BASE_URL}/tenants`, {
        headers: { Authorization: `Bearer ${userToken}` },
        params: { organizationId }
      });
      const tenants = Array.isArray(tenantsResponse.data) ? tenantsResponse.data : [];
      tenant = tenants.find((t: any) => t.name === 'ADNOC Onshore' || t.code === 'ADNOC-ONSHORE-001');
      
      if (tenant) {
        tenantId = tenant.id;
        console.log(`   ℹ️  Using existing tenant: ${tenant.name} (ID: ${tenant.id})`);
      } else {
        // Create new tenant
        const tenantResponse = await axios.post(
          `${API_BASE_URL}/tenants`,
          {
            name: 'ADNOC Onshore',
            code: 'ADNOC-ONSHORE-001',
            description: 'ADNOC Onshore Operations - Test Tenant',
            organizationId: organizationId
          },
          {
            headers: { Authorization: `Bearer ${userToken}` }
          }
        );
        tenant = tenantResponse.data;
        tenantId = tenant.id;
        console.log(`   ✅ Tenant created: ${tenant.name} (ID: ${tenant.id})`);
      }
    } catch (error: any) {
      console.error('   ❌ Failed to get/create tenant:', error.response?.data?.message || error.message);
      throw error;
    }

    // Step 4: Create Unit
    console.log('\n⚙️  Step 4: Creating production unit...');
    let unit;
    try {
      // First, try to find existing unit
      const unitsResponse = await axios.get(`${API_BASE_URL}/units`, {
        headers: { Authorization: `Bearer ${userToken}` },
        params: { tenantId }
      });
      const units = Array.isArray(unitsResponse.data) ? unitsResponse.data : [];
      unit = units.find((u: any) => u.code === 'CDU-001');
      
      if (unit) {
        console.log(`   ℹ️  Using existing unit: ${unit.name} (ID: ${unit.id})`);
      } else {
        // Create new unit
        const unitResponse = await axios.post(
          `${API_BASE_URL}/units`,
          {
            name: 'Crude Distillation Unit 1',
            code: 'CDU-001',
            description: 'Main crude distillation unit for oil processing',
            tenantId: tenantId,
            capacity: 150000,
            unitOfMeasure: 'BBL/day'
          },
          {
            headers: { Authorization: `Bearer ${userToken}` }
          }
        );
        unit = unitResponse.data;
        console.log(`   ✅ Unit created: ${unit.name} (ID: ${unit.id})`);
      }
    } catch (error: any) {
      console.error('   ❌ Failed to get/create unit:', error.response?.data?.message || error.message);
      throw error;
    }

    // Step 5: Create Impact Codes and OEE Codes
    console.log('\n📊 Step 5: Creating master data codes...');
    
    // Impact Codes
    const impactCodes = [
      { code: 'QTY-LOSS', name: 'Quantity Loss', description: 'Production quantity loss', category: 'Quality', costPerHour: 5000 },
      { code: 'AVAIL-LOSS', name: 'Availability Loss', description: 'Equipment availability loss', category: 'Availability', costPerHour: 3000 },
      { code: 'PERF-LOSS', name: 'Performance Loss', description: 'Performance degradation', category: 'Performance', costPerHour: 2000 }
    ];

    for (const impactCode of impactCodes) {
      try {
        await axios.post(
          `${API_BASE_URL}/impact-codes`,
          { ...impactCode, tenantId },
          { headers: { Authorization: `Bearer ${userToken}` } }
        );
        console.log(`   ✅ Created impact code: ${impactCode.code}`);
      } catch (error: any) {
        if (error.response?.status !== 409) {
          console.warn(`   ⚠️  Failed to create impact code ${impactCode.code}:`, error.response?.data?.message || error.message);
        }
      }
    }

    // OEE Codes
    const oeeCodes = [
      { code: 'PLANNED', name: 'Planned Downtime', description: 'Scheduled maintenance', category: 'Planned' },
      { code: 'UNPLANNED', name: 'Unplanned Downtime', description: 'Unexpected equipment failure', category: 'Unplanned' }
    ];

    for (const oeeCode of oeeCodes) {
      try {
        await axios.post(
          `${API_BASE_URL}/oee-codes`,
          { ...oeeCode, tenantId },
          { headers: { Authorization: `Bearer ${userToken}` } }
        );
        console.log(`   ✅ Created OEE code: ${oeeCode.code}`);
      } catch (error: any) {
        if (error.response?.status !== 409) {
          console.warn(`   ⚠️  Failed to create OEE code ${oeeCode.code}:`, error.response?.data?.message || error.message);
        }
      }
    }

    // Step 6: Create Products (Oil & Gas Industry)
    console.log('\n📦 Step 6: Creating products...');
    const products = [
      { name: 'Arab Light Crude', code: 'ALC', description: 'Arab Light crude oil - API 33.5, Sulfur 1.8%', unitOfMeasure: 'BBL', standardCost: 75.50 },
      { name: 'Arab Medium Crude', code: 'AMC', description: 'Arab Medium crude oil - API 30.5, Sulfur 2.5%', unitOfMeasure: 'BBL', standardCost: 72.25 },
      { name: 'Murban Crude', code: 'MUR', description: 'Murban crude oil from Abu Dhabi - API 40.5, Sulfur 0.8%', unitOfMeasure: 'BBL', standardCost: 78.80 },
      { name: 'Premium Gasoline 95', code: 'MOGAS-95', description: '95 RON premium gasoline', unitOfMeasure: 'BBL', standardCost: 95.50 },
      { name: 'Diesel Fuel EN590', code: 'DIESEL-EN590', description: 'Ultra low sulfur diesel - Cetane 51, Sulfur 10 ppm', unitOfMeasure: 'BBL', standardCost: 88.25 },
      { name: 'Jet Fuel Jet A-1', code: 'JETA1', description: 'Aviation turbine fuel - Flash Point 38°C', unitOfMeasure: 'BBL', standardCost: 92.00 },
      { name: 'Heavy Fuel Oil 380', code: 'HFO-380', description: 'High sulfur fuel oil - Viscosity 380 cSt', unitOfMeasure: 'MT', standardCost: 450.00 }
    ];

    let productsCreated = 0;
    for (const product of products) {
      try {
        await axios.post(
          `${API_BASE_URL}/products`,
          product,
          { headers: { Authorization: `Bearer ${userToken}` } }
        );
        productsCreated++;
        console.log(`   ✅ Created product: ${product.name}`);
      } catch (error: any) {
        if (error.response?.status !== 409) {
          console.warn(`   ⚠️  Failed to create product ${product.code}:`, error.response?.data?.message || error.message);
        }
      }
    }
    console.log(`   📊 Created ${productsCreated} products`);

    // Step 6.5: Create Additional Units and Assets
    console.log('\n🏭 Step 6.5: Creating additional production units...');
    const additionalUnits = [
      {
        name: 'Hydrocracker Unit',
        code: 'HCU-001',
        description: 'Hydrocracking unit for heavy oil processing',
        tenantId: tenantId,
        capacity: 80000,
        unitOfMeasure: 'BBL/day'
      },
      {
        name: 'Fluid Catalytic Cracker',
        code: 'FCC-001',
        description: 'FCC unit for gasoline production',
        tenantId: tenantId,
        capacity: 120000,
        unitOfMeasure: 'BBL/day'
      },
      {
        name: 'Reformer Unit',
        code: 'REF-001',
        description: 'Catalytic reformer for octane enhancement',
        tenantId: tenantId,
        capacity: 60000,
        unitOfMeasure: 'BBL/day'
      }
    ];

    const createdUnits = [unit];
    for (const unitData of additionalUnits) {
      try {
        const unitResponse = await axios.post(
          `${API_BASE_URL}/units`,
          unitData,
          { headers: { Authorization: `Bearer ${userToken}` } }
        );
        createdUnits.push(unitResponse.data);
        console.log(`   ✅ Created unit: ${unitData.name}`);
      } catch (error: any) {
        if (error.response?.status !== 409) {
          console.warn(`   ⚠️  Failed to create unit ${unitData.code}:`, error.response?.data?.message || error.message);
        }
      }
    }

    // Create Assets for the main unit
    console.log('\n⚙️  Step 6.6: Creating assets for production units...');
    const assets = [
      {
        name: 'Main Distillation Column',
        code: 'CDU-COL-001',
        description: 'Primary distillation column',
        unitId: unit.id,
        assetType: 'Equipment',
        criticality: 'High',
        status: 'Active'
      },
      {
        name: 'Crude Oil Feed Pump',
        code: 'CDU-PUMP-001',
        description: 'Main feed pump for crude oil',
        unitId: unit.id,
        assetType: 'Equipment',
        criticality: 'High',
        status: 'Active'
      },
      {
        name: 'Heat Exchanger E-101',
        code: 'CDU-HE-101',
        description: 'Preheat exchanger',
        unitId: unit.id,
        assetType: 'Equipment',
        criticality: 'Medium',
        status: 'Active'
      },
      {
        name: 'Furnace F-101',
        code: 'CDU-FURN-101',
        description: 'Crude oil heater',
        unitId: unit.id,
        assetType: 'Equipment',
        criticality: 'High',
        status: 'Active'
      }
    ];

    let assetsCreated = 0;
    for (const asset of assets) {
      try {
        await axios.post(
          `${API_BASE_URL}/assets`,
          asset,
          { headers: { Authorization: `Bearer ${userToken}` } }
        );
        assetsCreated++;
        console.log(`   ✅ Created asset: ${asset.name}`);
      } catch (error: any) {
        if (error.response?.status !== 409) {
          console.warn(`   ⚠️  Failed to create asset ${asset.code}:`, error.response?.data?.message || error.message);
        }
      }
    }
    console.log(`   📊 Created ${assetsCreated} assets`);

    // Step 7: Check for existing PI connection
    console.log('\n📡 Step 7: Checking PI connections...');
    let piConnectionId: string | null = null;
    try {
      const piConnectionsResponse = await axios.get(`${API_BASE_URL}/pi-connections`, {
        headers: { Authorization: `Bearer ${userToken}` },
        params: { tenantId }
      });
      
      const piConnections = Array.isArray(piConnectionsResponse.data) 
        ? piConnectionsResponse.data 
        : piConnectionsResponse.data?.connections || [];

      if (piConnections.length > 0) {
        const activeConnection = piConnections.find((c: any) => c.isActive) || piConnections[0];
        piConnectionId = activeConnection.id;
        console.log(`   ✅ Found PI connection: ${activeConnection.name} (ID: ${piConnectionId})`);
        console.log(`   📍 PI Web API URL: ${activeConnection.piWebApiUrl}`);
      } else {
        console.log('   ℹ️  No PI connections found. You can create one later.');
      }
    } catch (error: any) {
      console.warn('   ⚠️  Could not check PI connections:', error.response?.data?.message || error.message);
    }

    // Step 8: Test event pulling (if PI connection exists)
    if (piConnectionId) {
      console.log('\n🧪 Step 8: Testing PI event pulling...');
      try {
        // First, try the unified event pull endpoint
        const pullResponse = await axios.post(
          `${API_BASE_URL}/connectivity/events/pull`,
          {
            sourceType: 'PI',
            sourceId: piConnectionId,
            tenantId: tenantId,
            startTimeUtc: new Date(Date.now() - 3600 * 1000).toISOString(), // Last 1 hour
            endTimeUtc: new Date().toISOString(),
            maxCount: 50,
            autoCreateProductionEvents: true,
            filters: {
              scopeType: 'database' // or 'element'
            }
          },
          {
            headers: { Authorization: `Bearer ${userToken}` }
          }
        );

        const result = pullResponse.data;
        console.log(`   ✅ Event pull completed:`);
        console.log(`      - Events fetched: ${result.eventsFetched || 0}`);
        console.log(`      - Events stored: ${result.eventsStored || 0}`);
        console.log(`      - Production events created: ${result.productionEventsCreated || 0}`);
        
        if (result.errors && result.errors.length > 0) {
          console.log(`      - Errors: ${result.errors.length}`);
          result.errors.forEach((err: string) => console.log(`         ⚠️  ${err}`));
        }
      } catch (error: any) {
        console.warn('   ⚠️  PI event pull test failed:', error.response?.data?.message || error.message);
        console.log('   ℹ️  This is expected if PI system is not accessible or connection is not configured.');
        console.log('   ℹ️  You can configure a PI connection later and test event pulling from the UI.');
      }
    } else {
      console.log('\n⏭️  Step 8: Skipping PI event pull test (no PI connection found)');
      console.log('   ℹ️  To test PI event pulling:');
      console.log('      1. Create a PI connection in the Connectivity page');
      console.log('      2. Configure PI mappings and bindings');
      console.log('      3. Use the "Pull from PI" button in EventHub');
    }

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('✅ Test Environment Setup Complete!\n');
    console.log('📋 Summary:');
    console.log(`   👤 User: ${testUser.email} (${testUser.role})`);
    console.log(`   🏢 Organization: ADNOC (ID: ${organizationId})`);
    console.log(`   🏭 Tenant: ADNOC Onshore (ID: ${tenantId})`);
    console.log(`   ⚙️  Unit: Crude Distillation Unit 1 (ID: ${unit?.id})`);
    if (piConnectionId) {
      console.log(`   📡 PI Connection: ${piConnectionId}`);
    }
    console.log('\n💡 Next Steps:');
    console.log('   1. Login to the frontend with:');
    console.log(`      Email: ${testUser.email}`);
    console.log(`      Password: ${testUser.password}`);
    console.log('   2. Navigate to EventHub to see events');
    console.log('   3. Use "Pull from PI" button to pull events');
    console.log('   4. Check Master Data page to see the hierarchy');
    console.log('='.repeat(70));

    return {
      success: true,
      user: testUser,
      organizationId: organizationId!,
      tenantId: tenantId!,
      unitId: unit?.id,
      piConnectionId: piConnectionId || undefined,
      message: 'Test environment setup completed successfully'
    };

  } catch (error: any) {
    console.error('\n❌ Setup failed:', error.response?.data || error.message);
    return {
      success: false,
      message: `Setup failed: ${error.response?.data?.message || error.message}`
    };
  }
}

// Run if called directly
if (require.main === module) {
  setupTestEnvironment()
    .then((result) => {
      if (result.success) {
        console.log('\n✅ Setup completed successfully!');
        process.exit(0);
      } else {
        console.error('\n❌ Setup failed:', result.message);
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('\n❌ Setup failed with error:', error);
      process.exit(1);
    });
}

export { setupTestEnvironment };

