/**
 * Hierarchy Mapping Test Data Seeder
 * Creates sample hierarchy mappings for testing event ingestion and mapping functionality
 */
import { hierarchyMappingService } from './HierarchyMappingService';
import { masterDataService } from './MasterDataService';
import type { CreateSourceHierarchyMappingDto } from './api/hierarchyMappingApi';

export class HierarchyMappingSeeder {
  private static instance: HierarchyMappingSeeder;

  static getInstance(): HierarchyMappingSeeder {
    if (!HierarchyMappingSeeder.instance) {
      HierarchyMappingSeeder.instance = new HierarchyMappingSeeder();
    }
    return HierarchyMappingSeeder.instance;
  }

  /**
   * Seed test hierarchy mappings for a tenant
   */
  async seedHierarchyMappings(tenantId: string, organizationId?: string): Promise<void> {
    try {
      console.log('🔄 Seeding hierarchy mappings...', { tenantId, organizationId });

      // First, get existing units and assets to map to
      const units = await masterDataService.getUnits({ tenantId });
      const assets = await masterDataService.getAssets({ tenantId });
      const tenants = await masterDataService.getTenants();
      const organizations = await masterDataService.getOrganizations();

      console.log(`📊 Found ${units.length} units, ${assets.length} assets`);

      if (units.length === 0 && assets.length === 0) {
        console.warn('⚠️ No units or assets found. Creating hierarchy mappings anyway with sample data.');
      }

      // Get current tenant and organization
      const currentTenant = tenants.find(t => t.id === tenantId);
      const currentOrg = organizationId 
        ? organizations.find(o => o.id === organizationId)
        : currentTenant 
          ? organizations.find(o => o.id === currentTenant.organizationId)
          : organizations[0];

      // Sample mappings to create
      const mappings: CreateSourceHierarchyMappingDto[] = [];

      // Example 1: Direct PI mapping to Unit (high priority)
      if (units.length > 0) {
        mappings.push({
          sourceType: 'PI',
          sourceIdentifier: 'F1DPqQ_8kaqkDxyz',
          sourcePath: 'PI\\Plant1\\Line1\\Unit1',
          targetType: 'unit',
          targetId: units[0].id,
          tenantId,
          organizationId: currentOrg?.id,
          isPattern: false,
          priority: 90,
          isActive: true,
          description: 'Direct PI mapping to Production Unit 1 - High priority for exact matches',
        });
      }

      // Example 2: Pattern-based PI mapping (medium priority)
      if (units.length > 0) {
        mappings.push({
          sourceType: 'PI',
          sourceIdentifier: 'PI\\\\Plant1\\\\Line1\\\\*',
          sourcePath: 'PI\\Plant1\\Line1\\*',
          targetType: 'unit',
          targetId: units[0].id,
          tenantId,
          organizationId: currentOrg?.id,
          isPattern: true,
          pattern: 'PI\\\\Plant1\\\\Line1\\\\*',
          priority: 70,
          isActive: true,
          description: 'Pattern mapping: All PI elements under Plant1\\Line1 map to Unit 1',
        });
      }

      // Example 3: Direct PI mapping to Asset (high priority)
      if (assets.length > 0) {
        mappings.push({
          sourceType: 'PI',
          sourceIdentifier: 'P1xQw9_abc123def',
          sourcePath: 'PI\\Plant1\\Line1\\Asset1\\Pump1',
          targetType: 'asset',
          targetId: assets[0].id,
          tenantId,
          organizationId: currentOrg?.id,
          isPattern: false,
          priority: 85,
          isActive: true,
          description: 'Direct PI mapping to Asset - Pump 1',
        });
      }

      // Example 4: OPC UA mapping
      if (units.length > 0) {
        mappings.push({
          sourceType: 'OPCUA',
          sourceIdentifier: 'ns=2;s=Production.Line1.Unit1',
          sourcePath: 'Production\\Line1\\Unit1',
          targetType: 'unit',
          targetId: units[0].id,
          tenantId,
          organizationId: currentOrg?.id,
          isPattern: false,
          priority: 80,
          isActive: true,
          description: 'OPC UA node mapping to Production Unit',
        });
      }

      // Example 5: Pattern-based OPC UA mapping
      if (units.length > 1) {
        mappings.push({
          sourceType: 'OPCUA',
          sourceIdentifier: 'ns=2;s=Production.Line2.*',
          sourcePath: 'Production\\Line2\\*',
          targetType: 'unit',
          targetId: units[1]?.id || units[0].id,
          tenantId,
          organizationId: currentOrg?.id,
          isPattern: true,
          pattern: 'ns=2;s=Production.Line2.*',
          priority: 65,
          isActive: true,
          description: 'Pattern mapping: All OPC UA nodes under Line2 map to Unit 2',
        });
      }

      // Example 6: Modbus mapping
      if (assets.length > 0) {
        mappings.push({
          sourceType: 'Modbus',
          sourceIdentifier: '192.168.1.100:502:40001',
          sourcePath: 'Modbus\\192.168.1.100\\HoldingRegisters\\40001',
          targetType: 'asset',
          targetId: assets[0].id,
          tenantId,
          organizationId: currentOrg?.id,
          isPattern: false,
          priority: 75,
          isActive: true,
          description: 'Modbus register mapping to asset',
        });
      }

      // Example 7: MQTT topic mapping
      if (units.length > 0) {
        mappings.push({
          sourceType: 'MQTT',
          sourceIdentifier: 'factory/plant1/line1/data',
          sourcePath: 'factory\\plant1\\line1\\data',
          targetType: 'unit',
          targetId: units[0].id,
          tenantId,
          organizationId: currentOrg?.id,
          isPattern: false,
          priority: 70,
          isActive: true,
          description: 'MQTT topic mapping to production unit',
        });
      }

      // Example 8: Database connection mapping (low priority - fallback)
      if (currentTenant) {
        mappings.push({
          sourceType: 'Database',
          sourceIdentifier: 'DB:Historian:Plant1',
          sourcePath: 'Database\\Historian\\Plant1',
          targetType: 'tenant',
          targetId: currentTenant.id,
          tenantId,
          organizationId: currentOrg?.id,
          isPattern: false,
          priority: 30,
          isActive: true,
          description: 'Database historian connection maps to tenant level',
        });
      }

      // Example 9: Pattern-based REST API mapping
      if (units.length > 0) {
        mappings.push({
          sourceType: 'RESTAPI',
          sourceIdentifier: 'https://api.example.com/plants/plant1/units/*',
          sourcePath: 'RESTAPI\\plants\\plant1\\units\\*',
          targetType: 'unit',
          targetId: units[0].id,
          tenantId,
          organizationId: currentOrg?.id,
          isPattern: true,
          pattern: 'https://api.example.com/plants/plant1/units/*',
          priority: 60,
          isActive: true,
          description: 'REST API endpoint pattern mapping',
        });
      }

      // Example 10: Universal wildcard mapping (lowest priority)
      if (units.length > 0) {
        mappings.push({
          sourceType: '*',
          sourceIdentifier: '*',
          sourcePath: '*',
          targetType: 'unit',
          targetId: units[0].id,
          tenantId,
          organizationId: currentOrg?.id,
          isPattern: true,
          pattern: '*',
          priority: 10,
          isActive: true,
          description: 'Universal fallback mapping - matches all sources to default unit',
        });
      }

      // Create all mappings
      console.log(`📝 Creating ${mappings.length} hierarchy mappings...`);
      let createdCount = 0;
      let skippedCount = 0;

      for (const mapping of mappings) {
        try {
          // Check if mapping already exists (by source identifier and tenant)
          const existing = await hierarchyMappingService.getMappings(tenantId, {
            sourceType: mapping.sourceType,
          });
          
          const alreadyExists = existing.some(m => 
            m.sourceIdentifier === mapping.sourceIdentifier && 
            m.tenantId === tenantId
          );

          if (alreadyExists) {
            console.log(`⏭️  Skipping existing mapping: ${mapping.sourceIdentifier}`);
            skippedCount++;
            continue;
          }

          await hierarchyMappingService.createMapping(mapping);
          createdCount++;
          console.log(`✅ Created mapping: ${mapping.sourceType} -> ${mapping.targetType}`);
        } catch (error: any) {
          console.warn(`⚠️  Failed to create mapping ${mapping.sourceIdentifier}:`, error.message);
          // Continue with other mappings
        }
      }

      console.log(`✅ Hierarchy mapping seeding complete!`);
      console.log(`   Created: ${createdCount} mappings`);
      console.log(`   Skipped: ${skippedCount} existing mappings`);

      return;
    } catch (error: any) {
      console.error('❌ Failed to seed hierarchy mappings:', error);
      throw new Error(`Failed to seed hierarchy mappings: ${error.message}`);
    }
  }

  /**
   * Clear all hierarchy mappings for a tenant
   */
  async clearHierarchyMappings(tenantId: string): Promise<void> {
    try {
      console.log('🧹 Clearing hierarchy mappings...', { tenantId });
      
      const mappings = await hierarchyMappingService.getMappings(tenantId);
      console.log(`Found ${mappings.length} mappings to delete`);

      for (const mapping of mappings) {
        try {
          await hierarchyMappingService.deleteMapping(mapping.id);
        } catch (error: any) {
          console.warn(`Failed to delete mapping ${mapping.id}:`, error.message);
        }
      }

      console.log('✅ Cleared all hierarchy mappings');
    } catch (error: any) {
      console.error('❌ Failed to clear hierarchy mappings:', error);
      throw error;
    }
  }

  /**
   * Check if hierarchy mappings exist for a tenant
   */
  async hasMappings(tenantId: string): Promise<boolean> {
    try {
      const mappings = await hierarchyMappingService.getMappings(tenantId);
      return mappings.length > 0;
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
export const hierarchyMappingSeeder = HierarchyMappingSeeder.getInstance();

