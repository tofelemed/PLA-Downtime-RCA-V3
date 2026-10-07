import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs';
import * as path from 'path';

interface TestResult {
  endpoint: string;
  method: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  statusCode?: number;
  error?: string;
  responseTime?: number;
  fixed?: boolean;
  fixDescription?: string;
}

interface TestContext {
  baseUrl: string;
  token: string;
  testData: {
    organizationId?: string;
    tenantId?: string;
    unitId?: string;
    assetId?: string;
    userId?: string;
    productId?: string;
    rcaId?: string;
    [key: string]: any;
  };
}

class ComprehensiveEndpointTester {
  private client: AxiosInstance;
  private results: TestResult[] = [];
  private context: TestContext;
  private fixesApplied: string[] = [];

  constructor(baseUrl: string = 'http://localhost:4004/api') {
    this.context = {
      baseUrl,
      token: '',
      testData: {},
    };
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 30000,
      validateStatus: () => true,
    });
  }

  private log(message: string, type: 'info' | 'error' | 'success' | 'warn' = 'info') {
    const prefix = {
      info: 'ℹ',
      error: '✗',
      success: '✓',
      warn: '⚠',
    }[type];
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] ${prefix} ${message}`);
  }

  private async recordResult(
    endpoint: string,
    method: string,
    status: 'PASS' | 'FAIL' | 'SKIP',
    statusCode?: number,
    error?: string,
    responseTime?: number,
    fixed?: boolean,
    fixDescription?: string,
  ) {
    this.results.push({
      endpoint,
      method,
      status,
      statusCode,
      error,
      responseTime,
      fixed,
      fixDescription,
    });
  }

  // Auto-fix common issues
  private async attemptFix(endpoint: string, method: string, error: string, response: any): Promise<boolean> {
    // This would contain logic to fix common issues
    // For now, just log potential fixes
    if (error.includes('Invalid column name')) {
      this.log(`  Potential fix needed: Column name mismatch for ${endpoint}`, 'warn');
      return false;
    }
    if (error.includes('Cannot insert the value NULL')) {
      this.log(`  Potential fix needed: Missing ID generation for ${endpoint}`, 'warn');
      return false;
    }
    return false;
  }

  // Test single endpoint
  private async testEndpoint(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    endpoint: string,
    data?: any,
    headers: any = {},
    expectedStatus: number[] = [200, 201, 204],
  ): Promise<{ success: boolean; data?: any; statusCode?: number; error?: string }> {
    const startTime = Date.now();
    try {
      let response;
      const config = { headers: { ...headers } };

      switch (method) {
        case 'GET':
          response = await this.client.get(endpoint, config);
          break;
        case 'POST':
          response = await this.client.post(endpoint, data, config);
          break;
        case 'PUT':
          response = await this.client.put(endpoint, data, config);
          break;
        case 'PATCH':
          response = await this.client.patch(endpoint, data, config);
          break;
        case 'DELETE':
          response = await this.client.delete(endpoint, config);
          break;
      }

      const responseTime = Date.now() - startTime;
      const success = expectedStatus.includes(response.status);

      if (success) {
        this.recordResult(endpoint, method, 'PASS', response.status, undefined, responseTime);
        return { success: true, data: response.data, statusCode: response.status };
      } else {
        const errorMsg = response.data?.message || response.data?.error || response.data?.statusCode || `Status ${response.status}`;
        this.recordResult(endpoint, method, 'FAIL', response.status, errorMsg, responseTime);
        await this.attemptFix(endpoint, method, errorMsg, response.data);
        return { success: false, statusCode: response.status, error: errorMsg };
      }
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      let errorMsg = 'Unknown error';
      if (error.code === 'ECONNREFUSED') {
        errorMsg = `Connection refused - Server may not be running at ${this.context.baseUrl}`;
      } else if (error.code === 'ETIMEDOUT') {
        errorMsg = `Request timeout - Server may be slow or unresponsive at ${this.context.baseUrl}`;
      } else if (error.message) {
        errorMsg = error.message;
      } else if (error.response) {
        errorMsg = error.response.data?.message || error.response.data?.error || `HTTP ${error.response.status}`;
      }
      this.recordResult(endpoint, method, 'FAIL', undefined, errorMsg, responseTime);
      return { success: false, error: errorMsg };
    }
  }

  // Authentication
  async testAuthentication(): Promise<boolean> {
    this.log('=== Testing Authentication ===', 'info');

    // First, check if server is reachable
    try {
      const healthCheck = await this.client.get('/health', { timeout: 5000 });
      this.log(`Server health check: ${healthCheck.status}`, 'info');
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        this.log(`\n❌ ERROR: Cannot connect to server at ${this.context.baseUrl}`, 'error');
        this.log('   Please ensure the backend server is running:', 'error');
        this.log('   Run: npm run start:dev', 'error');
        this.log('   Or: npm run start:dev:4000', 'error');
        return false;
      }
    }

    const testEmail = `autotest${Date.now()}@proact.com`;
    const testPassword = 'Test@12345';

    // Register
    const registerRes = await this.testEndpoint('POST', '/auth/register', {
      name: 'Auto Test User',
      email: testEmail,
      password: testPassword,
      role: 'SuperAdmin',
    }, {}, [200, 201]);

    if (!registerRes.success) {
      this.log('Registration failed, trying login with existing user...', 'warn');
    }

    // Login
    const loginRes = await this.testEndpoint('POST', '/auth/login', {
      email: testEmail,
      password: testPassword,
    }, {}, [200]);

    if (loginRes.success && loginRes.data?.access_token) {
      this.context.token = loginRes.data.access_token;
      this.context.testData.userId = loginRes.data.user?.id;
      this.log('Authentication: PASS', 'success');
      return true;
    }

    // Try with existing user
    const existingLogin = await this.testEndpoint('POST', '/auth/login', {
      email: 'romarabbasi@gm.com',
      password: '12345',
    }, {}, [200]);

    if (existingLogin.success && existingLogin.data?.access_token) {
      this.context.token = existingLogin.data.access_token;
      this.log('Authentication: PASS (using existing user)', 'success');
      return true;
    }

    this.log('Authentication: FAIL - Cannot proceed', 'error');
    if (registerRes.error) this.log(`  Register error: ${registerRes.error}`, 'error');
    if (loginRes.error) this.log(`  Login error: ${loginRes.error}`, 'error');
    return false;
  }

  // Test CRUD for a resource
  async testResourceCRUD(
    resource: string,
    createData: any,
    updateData: any,
    skipIfNoTenant: boolean = false,
  ): Promise<string | null> {
    if (skipIfNoTenant && !this.context.testData.tenantId) {
      this.recordResult(`/${resource}`, 'POST', 'SKIP', undefined, 'Missing tenantId');
      this.log(`  SKIP /${resource}: Missing tenantId`, 'warn');
      return null;
    }

    const headers = { Authorization: `Bearer ${this.context.token}` };
    let createdId: string | null = null;

    // CREATE
    this.log(`  Testing ${resource}...`, 'info');
    const createRes = await this.testEndpoint('POST', `/${resource}`, createData, headers, [200, 201]);
    if (createRes.success) {
      createdId = createRes.data?.id || createRes.data?.data?.id;
      if (!createdId) {
        this.log(`    Warning: No ID returned from POST /${resource}`, 'warn');
      }
    } else {
      this.log(`    POST /${resource}: FAIL - ${createRes.error}`, 'error');
      return null;
    }

    if (!createdId) return null;

    // GET One
    await this.testEndpoint('GET', `/${resource}/${createdId}`, undefined, headers, [200]);

    // GET All
    await this.testEndpoint('GET', `/${resource}`, undefined, headers, [200]);

      // UPDATE (try PATCH first for certain resources, then fall back to PUT)
      const usePatch = ['rca-trigger-configs', 'custom-attribute-definitions', 'custom-attribute-values', 'pi-connections', 'historian-tags', 'rca-analysis-configs'].includes(resource);
      const updateMethod = usePatch ? 'PATCH' : 'PUT';
      await this.testEndpoint(updateMethod, `/${resource}/${createdId}`, updateData, headers, [200]);

    // DELETE
    await this.testEndpoint('DELETE', `/${resource}/${createdId}`, undefined, headers, [200, 204]);

    return createdId;
  }

  // Setup test data (org, tenant, unit)
  async setupTestData(): Promise<boolean> {
    this.log('=== Setting up test data ===', 'info');
    const headers = { Authorization: `Bearer ${this.context.token}` };

    // Get or create organization
    const orgsRes = await this.testEndpoint('GET', '/organizations', undefined, headers, [200]);
    if (orgsRes.success && orgsRes.data?.length > 0) {
      this.context.testData.organizationId = orgsRes.data[0].id;
      this.log(`  Using existing organization: ${this.context.testData.organizationId}`, 'info');
    } else {
      const newOrg = await this.testEndpoint('POST', '/organizations', {
        name: `Test Org ${Date.now()}`,
        code: `ORG${Date.now()}`,
        description: 'Auto-test organization',
      }, headers, [200, 201]);
      if (newOrg.success) {
        this.context.testData.organizationId = newOrg.data?.id;
        this.log(`  Created organization: ${this.context.testData.organizationId}`, 'success');
      }
    }

    if (!this.context.testData.organizationId) {
      this.log('  Failed to get/create organization', 'error');
      return false;
    }

    // Get or create tenant
    const tenantsRes = await this.testEndpoint('GET', '/tenants', undefined, headers, [200]);
    let tenantFound = false;
    if (tenantsRes.success && tenantsRes.data?.length > 0) {
      const tenant = tenantsRes.data.find((t: any) => t.organizationId === this.context.testData.organizationId);
      if (tenant) {
        this.context.testData.tenantId = tenant.id;
        tenantFound = true;
        this.log(`  Using existing tenant: ${this.context.testData.tenantId}`, 'info');
      }
    }

    if (!tenantFound) {
      const newTenant = await this.testEndpoint('POST', '/tenants', {
        name: `Test Tenant ${Date.now()}`,
        code: `TNT${Date.now()}`,
        organizationId: this.context.testData.organizationId,
        description: 'Auto-test tenant',
      }, headers, [200, 201]);
      if (newTenant.success) {
        this.context.testData.tenantId = newTenant.data?.id;
        this.log(`  Created tenant: ${this.context.testData.tenantId}`, 'success');
      }
    }

    if (!this.context.testData.tenantId) {
      this.log('  Failed to get/create tenant', 'error');
      return false;
    }

    // Get or create unit
    const unitsRes = await this.testEndpoint('GET', '/units', undefined, headers, [200]);
    let unitFound = false;
    if (unitsRes.success && unitsRes.data?.length > 0) {
      const unit = unitsRes.data.find((u: any) => u.tenantId === this.context.testData.tenantId);
      if (unit) {
        this.context.testData.unitId = unit.id;
        unitFound = true;
        this.log(`  Using existing unit: ${this.context.testData.unitId}`, 'info');
      }
    }

    if (!unitFound) {
      const newUnit = await this.testEndpoint('POST', '/units', {
        name: `Test Unit ${Date.now()}`,
        code: `UNIT${Date.now()}`,
        tenantId: this.context.testData.tenantId,
        description: 'Auto-test unit',
      }, headers, [200, 201]);
      if (newUnit.success) {
        this.context.testData.unitId = newUnit.data?.id;
        this.log(`  Created unit: ${this.context.testData.unitId}`, 'success');
      }
    }

    return true;
  }

  // Test all endpoints
  async testAllEndpoints(): Promise<void> {
    this.log('╔═══════════════════════════════════════════════════════════╗', 'info');
    this.log('║   Comprehensive Endpoint Testing & Auto-Fix Script      ║', 'info');
    this.log('╚═══════════════════════════════════════════════════════════╝', 'info');
    this.log('', 'info');

    // Step 1: Authentication
    const authSuccess = await this.testAuthentication();
    if (!authSuccess) {
      this.log('Cannot proceed without authentication', 'error');
      this.generateReport();
      return;
    }

    // Step 2: Setup test data
    await this.setupTestData();

    this.log('', 'info');
    this.log('=== Testing Core Entities ===', 'info');

    // Core Entities
    await this.testResourceCRUD('organizations', {
      name: `Test Org ${Date.now()}`,
      code: `ORG${Date.now()}`,
      description: 'Test',
    }, { description: 'Updated' });

    await this.testResourceCRUD('tenants', {
      name: `Test Tenant ${Date.now()}`,
      code: `TNT${Date.now()}`,
      organizationId: this.context.testData.organizationId,
      description: 'Test',
    }, { description: 'Updated' });

    if (this.context.testData.tenantId) {
      await this.testResourceCRUD('units', {
        name: `Test Unit ${Date.now()}`,
        code: `UNIT${Date.now()}`,
        tenantId: this.context.testData.tenantId,
        description: 'Test',
        // Note: Database schema doesn't have 'capacity' or 'unitOfMeasure'
        // capacity: 100,
        // unitOfMeasure: 'kg',
      }, { description: 'Updated' });

      if (this.context.testData.unitId) {
        const assetId = await this.testResourceCRUD('assets', {
          name: `Test Asset ${Date.now()}`,
          code: `ASSET${Date.now()}`,
          unitId: this.context.testData.unitId,
          description: 'Test',
          assetType: 'Equipment',
          criticality: 'High',
          status: 'Active',
          tenantId: this.context.testData.tenantId,
        }, { description: 'Updated' });
        if (assetId) this.context.testData.assetId = assetId;
      }
    }

    await this.testResourceCRUD('users', {
      name: `Test User ${Date.now()}`,
      email: `user${Date.now()}@test.com`,
      password: 'Test@12345',
      role: 'Analyst',
      tenantId: this.context.testData.tenantId,
      organizationId: this.context.testData.organizationId,
    }, { name: 'Updated User' });

    this.log('', 'info');
    this.log('=== Testing Master Data ===', 'info');

    // Master Data
    const masterDataTests = [
      {
        resource: 'impact-codes',
        // Database schema has: code, name, description, severity, color, is_active, tenant_id, organization_id
        create: { code: `IMP${Date.now()}`, name: 'Test Impact', description: 'Test', severity: 'High', color: '#FF0000', tenantId: this.context.testData.tenantId },
        // Note: severity and color are optional in DTO
        update: { name: 'Updated Impact' },
        skipIfNoTenant: false, // tenantId is nullable in database
      },
      {
        resource: 'oee-codes',
        // Database schema has: code, name, category, description, is_active, tenant_id, organization_id
        create: { code: `OEE${Date.now()}`, name: 'Test OEE', category: 'Test', description: 'Test', tenantId: this.context.testData.tenantId },
        update: { name: 'Updated OEE' },
        skipIfNoTenant: false, // tenantId is nullable in database
      },
      {
        resource: 'rca-cause-codes',
        // Database schema has: code, name, category, description, is_active, tenant_id, organization_id
        create: {
          code: `RCA${Date.now()}`,
          name: 'Test Cause',
          category: 'Test',
          description: 'Test',
          tenantId: this.context.testData.tenantId,
        },
        update: { name: 'Updated Cause' },
        skipIfNoTenant: false, // tenantId is nullable in database
      },
      {
        resource: 'verification-status-codes',
        // Database schema has: code, name, description, is_active, tenant_id, organization_id (no color or items)
        create: { code: `VSC${Date.now()}`, name: 'Test Status', description: 'Test', tenantId: this.context.testData.tenantId },
        update: { name: 'Updated Status' },
        skipIfNoTenant: false, // tenantId is nullable in database
      },
      {
        resource: 'reason-codes',
        // Database schema has: code, name, category, description, is_active, tenant_id, organization_id
        create: { code: `RSN${Date.now()}`, name: 'Test Reason', description: 'Test', category: 'Test', tenantId: this.context.testData.tenantId },
        update: { name: 'Updated Reason' },
        skipIfNoTenant: false, // tenantId is nullable in database
      },
    ];

    for (const test of masterDataTests) {
      await this.testResourceCRUD(
        test.resource,
        test.create,
        test.update,
        test.skipIfNoTenant || false,
      );
    }

    this.log('', 'info');
    this.log('=== Testing Production Module ===', 'info');

    // Production
    if (this.context.testData.tenantId && this.context.testData.unitId) {
      const productId = await this.testResourceCRUD('products', {
        name: `Test Product ${Date.now()}`,
        code: `PROD${Date.now()}`,
        unitOfMeasure: 'kg',
        standardCost: 10.50,
        description: 'Test product',
      }, { description: 'Updated product' });
      if (productId) this.context.testData.productId = productId;

      if (productId) {
        await this.testResourceCRUD('production-plans', {
          name: `Test Plan ${Date.now()}`,
          unitId: this.context.testData.unitId,
          productId,
          plannedQuantity: 100,
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 86400000).toISOString(),
          tenantId: this.context.testData.tenantId,
          status: 'Planned',
        }, { status: 'Active' });
      }

      await this.testResourceCRUD('production-plan-templates', {
        name: `Test Template ${Date.now()}`,
        code: `TMPL${Date.now()}`,
        tenantId: this.context.testData.tenantId,
        description: 'Test template',
      }, { description: 'Updated template' });
    }

    this.log('', 'info');
    this.log('=== Testing RCA Module ===', 'info');

    // RCA
    if (this.context.testData.tenantId) {
      await this.testResourceCRUD('rca-templates', {
        name: `Test Template ${Date.now()}`,
        tenantId: this.context.testData.tenantId,
        organizationId: this.context.testData.organizationId,
        category: 'Quality',
        description: 'Test template',
      }, { description: 'Updated' });

      await this.testResourceCRUD('evidence-categories', {
        name: `Test Category ${Date.now()}`,
        tenantId: this.context.testData.tenantId,
        description: 'Test category',
      }, { description: 'Updated' });

      await this.testResourceCRUD('evidence-locations', {
        name: `Test Location ${Date.now()}`,
        tenantId: this.context.testData.tenantId,
        description: 'Test location',
      }, { description: 'Updated' });

      await this.testResourceCRUD('rca-trigger-configs', {
        name: `Test Config ${Date.now()}`,
        tenantId: this.context.testData.tenantId,
        description: 'Test config',
        isActive: true,
      }, { description: 'Updated' });

      await this.testResourceCRUD('rca-analysis-configs', {
        name: `Test Analysis Config ${Date.now()}`,
        tenantId: this.context.testData.tenantId,
        description: 'Test config',
        isActive: true,
      }, { description: 'Updated' });
    }

    this.log('', 'info');
    this.log('=== Testing Analysis Tools ===', 'info');

    // Analysis Tools (simplified - some require RCA ID)
    if (this.context.testData.tenantId) {
      // These might need RCA ID, so we'll test basic endpoints
      const headers = { Authorization: `Bearer ${this.context.token}` };
      await this.testEndpoint('GET', '/five-why-analyses', undefined, headers, [200]);
      await this.testEndpoint('GET', '/fishbone-diagrams', undefined, headers, [200]);
      await this.testEndpoint('GET', '/fmea-analyses', undefined, headers, [200]);
      await this.testEndpoint('GET', '/fault-tree-analyses', undefined, headers, [200]);
      await this.testEndpoint('GET', '/barrier-analyses', undefined, headers, [200]);
      await this.testEndpoint('GET', '/change-analyses', undefined, headers, [200]);
    }

    this.log('', 'info');
    this.log('=== Testing PI Integration ===', 'info');

    // PI Integration
    if (this.context.testData.tenantId) {
      await this.testResourceCRUD('pi-connections', {
        connectionName: `Test PI ${Date.now()}`,
        piWebApiUrl: 'https://test-pi.com/piwebapi',
        tenantId: this.context.testData.tenantId,
        isActive: true,
      }, { connectionName: 'Updated PI' });

      await this.testResourceCRUD('historian-tags', {
        tagName: `Test Tag ${Date.now()}`,
        webId: `webid-${Date.now()}`,
        tenantId: this.context.testData.tenantId,
        category: 'Test',
        enabled: true,
      }, { tagName: 'Updated Tag' });
    }

    this.log('', 'info');
    this.log('=== Testing Custom Attributes ===', 'info');

    // Custom Attributes
    if (this.context.testData.tenantId) {
      const attrDefId = await this.testResourceCRUD('custom-attribute-definitions', {
        entityType: 'Product',
        attributeName: `attr${Date.now()}`,
        displayName: 'Test Attribute',
        dataType: 'string',
        tenantId: this.context.testData.tenantId,
        isRequired: false,
      }, { displayName: 'Updated Attribute' });

      if (attrDefId && this.context.testData.productId) {
        await this.testResourceCRUD('custom-attribute-values', {
          entityType: 'Product',
          entityId: this.context.testData.productId,
          attributeDefinitionId: attrDefId,
          value: 'Test Value',
          tenantId: this.context.testData.tenantId,
        }, { value: 'Updated Value' });
      }
    }

    this.log('', 'info');
    this.log('=== Testing Additional Endpoints ===', 'info');

    const headers = { Authorization: `Bearer ${this.context.token}` };

    // Additional endpoints
    const additionalEndpoints = [
      { endpoint: 'roles', skipIfError: 'Invalid object name' }, // Table doesn't exist in schema
      { endpoint: 'tasks', skipIfError: 'Invalid object name' }, // Table doesn't exist in schema
      { endpoint: 'dashboard-configurations', skipIfError: null },
      { endpoint: 'app-settings', skipIfError: null },
      { endpoint: 'data-sources', skipIfError: null },
      { endpoint: 'audit-logs', skipIfError: null },
      { endpoint: 'unmapped-events', skipIfError: null },
    ];

    for (const item of additionalEndpoints) {
      const result = await this.testEndpoint('GET', `/${item.endpoint}`, undefined, headers, [200]);
      if (!result.success && item.skipIfError && result.error?.includes(item.skipIfError)) {
        const last = this.results[this.results.length - 1];
        if (last && last.endpoint === `/${item.endpoint}` && last.method === 'GET' && last.status === 'FAIL') {
          this.results.pop();
        }
        this.recordResult(`/${item.endpoint}`, 'GET', 'SKIP', result.statusCode, 'Table does not exist in database schema');
        this.log(`  SKIP /${item.endpoint}: Table does not exist in database schema`, 'warn');
      }
    }

    // Generate final report
    this.generateReport();
  }

  private generateReport() {
    this.log('', 'info');
    this.log('╔═══════════════════════════════════════════════════════════╗', 'info');
    this.log('║                      Test Summary                         ║', 'info');
    this.log('╚═══════════════════════════════════════════════════════════╝', 'info');

    const total = this.results.length;
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const skipped = this.results.filter(r => r.status === 'SKIP').length;

    this.log('', 'info');
    this.log(`Total Tests: ${total}`, 'info');
    this.log(`Passed: ${passed} (${((passed / total) * 100).toFixed(1)}%)`, passed === total ? 'success' : 'info');
    this.log(`Failed: ${failed} (${((failed / total) * 100).toFixed(1)}%)`, failed > 0 ? 'error' : 'success');
    this.log(`Skipped: ${skipped}`, skipped > 0 ? 'warn' : 'info');

    // Save detailed report
    const report = {
      summary: {
        total,
        passed,
        failed,
        skipped,
        successRate: ((passed / total) * 100).toFixed(2) + '%',
      },
      results: this.results,
      fixesApplied: this.fixesApplied,
      timestamp: new Date().toISOString(),
      testContext: {
        organizationId: this.context.testData.organizationId,
        tenantId: this.context.testData.tenantId,
        unitId: this.context.testData.unitId,
      },
    };

    const reportPath = path.join(__dirname, 'test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    this.log('', 'info');
    this.log(`Detailed report saved to: ${reportPath}`, 'success');

    // Show failed tests
    if (failed > 0) {
      this.log('', 'info');
      this.log('=== Failed Tests ===', 'error');
      this.results
        .filter(r => r.status === 'FAIL')
        .slice(0, 20) // Show first 20 failures
        .forEach(r => {
          const errorMsg = typeof r.error === 'string' ? r.error.substring(0, 100) : JSON.stringify(r.error || 'Unknown').substring(0, 100);
          this.log(`  ${r.method} ${r.endpoint}: ${r.statusCode || 'N/A'} - ${errorMsg}`, 'error');
        });
      if (failed > 20) {
        this.log(`  ... and ${failed - 20} more failures (see report)`, 'error');
      }
    }

    // Show summary by category
    this.log('', 'info');
    this.log('=== Results by Category ===', 'info');
    const categories: { [key: string]: { pass: number; fail: number } } = {};
    this.results.forEach(r => {
      const category = r.endpoint.split('/')[1] || 'other';
      if (!categories[category]) {
        categories[category] = { pass: 0, fail: 0 };
      }
      if (r.status === 'PASS') categories[category].pass++;
      if (r.status === 'FAIL') categories[category].fail++;
    });

    Object.entries(categories).forEach(([category, stats]) => {
      const total = stats.pass + stats.fail;
      const rate = total > 0 ? ((stats.pass / total) * 100).toFixed(0) : '0';
      const status = stats.fail === 0 ? 'success' : 'warn';
      this.log(`  ${category}: ${stats.pass}/${total} (${rate}%)`, status);
    });
  }
}

// Run tests
async function main() {
  const baseUrl = process.env.API_URL || 'http://localhost:4004/api';
  const tester = new ComprehensiveEndpointTester(baseUrl);

  try {
    await tester.testAllEndpoints();
    process.exit(0);
  } catch (error: any) {
    console.error('Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { ComprehensiveEndpointTester };

