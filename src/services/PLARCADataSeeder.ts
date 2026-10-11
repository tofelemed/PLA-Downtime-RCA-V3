// Enhanced Data Seeder for PLA and RCA Testing
// This service populates IndexedDB with comprehensive sample data for testing PLA and RCA modules

import { masterDataService } from './MasterDataService';
import { storageService } from './StorageService';
import { 
  Organization, 
  Tenant, 
  Unit, 
  Asset, 
  Product, 
  ProductionEvent, 
  RCA, 
  RCATemplate,
  RCAEvidence,
  LogicTreeNode,
  RCARecommendation,
  ImpactCode,
  OEECode,
  ReasonCode
} from './MasterDataService';

export class PLARCADataSeeder {
  private static instance: PLARCADataSeeder;
  private isSeeded: boolean = false;

  private constructor() {}

  static getInstance(): PLARCADataSeeder {
    if (!PLARCADataSeeder.instance) {
      PLARCADataSeeder.instance = new PLARCADataSeeder();
    }
    return PLARCADataSeeder.instance;
  }

  // Check if data has already been seeded
  async isDataSeeded(tenantId: string): Promise<boolean> {
    try {
      const events = await masterDataService.getProductionEvents({ tenantId });
      const rcas = await masterDataService.getRCAs({ tenantId });
      const templates = await masterDataService.getRCATemplates({ tenantId });
      
      return events.length > 0 || rcas.length > 0 || templates.length > 0;
    } catch (error) {
      return false;
    }
  }

  // Main seeding method
  async seedPLARCAData(tenantId: string): Promise<void> {
    if (this.isSeeded) return;

    try {
      const alreadySeeded = await this.isDataSeeded(tenantId);
      if (alreadySeeded) {
        console.log('PLA/RCA data already seeded, skipping...');
        this.isSeeded = true;
        return;
      }

      console.log('Starting PLA/RCA data seeding...');
      
      // Initialize basic master data first
      await masterDataService.initializeSampleData(tenantId);
      
      // Seed organizations and tenants
      await this.seedOrganizationsAndTenants();
      
      // Seed units and assets
      await this.seedUnitsAndAssets(tenantId);
      
      // Seed products
      await this.seedProducts();
      
      // Seed RCA templates
      await this.seedRCATemplates(tenantId);
      
      // Seed production events
      await this.seedProductionEvents(tenantId);
      
      // Seed RCA investigations
      await this.seedRCAInvestigations(tenantId);
      
      // Seed additional master data
      await this.seedAdditionalMasterData(tenantId);
      
      this.isSeeded = true;
      console.log('PLA/RCA data seeded successfully');
    } catch (error) {
      console.error('Failed to seed PLA/RCA data:', error);
      throw error;
    }
  }

  // Seed organizations and tenants
  private async seedOrganizationsAndTenants(): Promise<void> {
    try {
      // Check if organization already exists
      const existingOrgs = await masterDataService.getOrganizations();
      let org;
      
      if (existingOrgs.length === 0) {
        const sampleOrg: Omit<Organization, 'id' | 'createdAt' | 'updatedAt'> = {
          name: 'Demo Manufacturing Corp',
          code: 'DEMO',
          description: 'Demo organization for testing',
          isActive: true
        };
        org = await masterDataService.createOrganization(sampleOrg);
        console.log('Created organization:', org.name);
      } else {
        org = existingOrgs[0];
        console.log('Using existing organization:', org.name);
      }

      // Check if tenant already exists
      const existingTenants = await masterDataService.getTenants();
      if (existingTenants.length === 0) {
        const sampleTenant: Omit<Tenant, 'id' | 'createdAt' | 'updatedAt'> = {
          name: 'Plant A - Production Facility',
          code: 'PLANT_A',
          description: 'Main production facility for testing',
          organizationId: org.id,
          isActive: true,
          address: '123 Industrial Blvd, Manufacturing City, MC 12345',
          contactPerson: 'John Smith',
          contactEmail: 'john.smith@demo.com',
          contactPhone: '+1-555-0123'
        };
        await masterDataService.createTenant(sampleTenant);
        console.log('Created tenant:', sampleTenant.name);
      } else {
        console.log('Using existing tenant:', existingTenants[0].name);
      }
    } catch (error) {
      console.warn('Could not create organization/tenant:', error);
      // Continue with seeding even if this fails
    }
  }

  // Seed units and assets
  private async seedUnitsAndAssets(tenantId: string): Promise<void> {
    // Create production units
    const units = [
      {
        name: 'Production Line A',
        code: 'LINE_A',
        description: 'Main production line for Product A',
        capacity: 1000,
        unitOfMeasure: 'units/hour',
        idealCycleTime: 3.6 // 3.6 seconds per unit
      },
      {
        name: 'Production Line B',
        code: 'LINE_B',
        description: 'Secondary production line for Product B',
        capacity: 800,
        unitOfMeasure: 'units/hour',
        idealCycleTime: 4.5 // 4.5 seconds per unit
      },
      {
        name: 'Packaging Line',
        code: 'PACK_LINE',
        description: 'Packaging and finishing line',
        capacity: 1200,
        unitOfMeasure: 'units/hour',
        idealCycleTime: 3.0 // 3.0 seconds per unit
      }
    ];

    const createdUnits = [];
    for (const unitData of units) {
      const unit = await masterDataService.createUnit(unitData);
      createdUnits.push(unit);
    }

    // Create assets for each unit
    const assets = [
      // Line A assets
      {
        name: 'Conveyor Belt A1',
        code: 'CONV_A1',
        unitId: createdUnits[0].id,
        description: 'Main conveyor belt for Line A',
        assetType: 'Equipment' as const,
        criticality: 'High' as const,
        manufacturer: 'Siemens',
        model: 'SIMATIC S7-1500',
        status: 'Active' as const,
        tenantId
      },
      {
        name: 'Pump A-001',
        code: 'PUMP_A001',
        unitId: createdUnits[0].id,
        description: 'Main process pump for Line A',
        assetType: 'Equipment' as const,
        criticality: 'High' as const,
        manufacturer: 'Grundfos',
        model: 'CR 32-4',
        status: 'Active' as const,
        tenantId
      },
      {
        name: 'Motor A-001',
        code: 'MOTOR_A001',
        unitId: createdUnits[0].id,
        description: 'Drive motor for conveyor A1',
        assetType: 'Equipment' as const,
        criticality: 'Medium' as const,
        manufacturer: 'ABB',
        model: 'M2BA 132S',
        status: 'Active' as const,
        tenantId
      },
      // Line B assets
      {
        name: 'Conveyor Belt B1',
        code: 'CONV_B1',
        unitId: createdUnits[1].id,
        description: 'Main conveyor belt for Line B',
        assetType: 'Equipment' as const,
        criticality: 'High' as const,
        manufacturer: 'Siemens',
        model: 'SIMATIC S7-1500',
        status: 'Active' as const,
        tenantId
      },
      {
        name: 'Pump B-001',
        code: 'PUMP_B001',
        unitId: createdUnits[1].id,
        description: 'Main process pump for Line B',
        assetType: 'Equipment' as const,
        criticality: 'High' as const,
        manufacturer: 'Grundfos',
        model: 'CR 32-4',
        status: 'Maintenance' as const,
        tenantId
      },
      // Packaging line assets
      {
        name: 'Packaging Machine',
        code: 'PACK_MACH',
        unitId: createdUnits[2].id,
        description: 'Automated packaging machine',
        assetType: 'Equipment' as const,
        criticality: 'Medium' as const,
        manufacturer: 'Bosch',
        model: 'Pack 201',
        status: 'Active' as const,
        tenantId
      }
    ];

    for (const assetData of assets) {
      await masterDataService.createAsset(assetData);
    }
  }

  // Seed products
  private async seedProducts(): Promise<void> {
    const products = [
      {
        name: 'Product A - Standard',
        code: 'PROD_A_STD',
        unitOfMeasure: 'pieces',
        description: 'Standard Product A',
        standardCost: 25.50
      },
      {
        name: 'Product A - Premium',
        code: 'PROD_A_PREM',
        unitOfMeasure: 'pieces',
        description: 'Premium Product A',
        standardCost: 35.75
      },
      {
        name: 'Product B - Standard',
        code: 'PROD_B_STD',
        unitOfMeasure: 'pieces',
        description: 'Standard Product B',
        standardCost: 18.25
      },
      {
        name: 'Product B - Premium',
        code: 'PROD_B_PREM',
        unitOfMeasure: 'pieces',
        description: 'Premium Product B',
        standardCost: 28.90
      }
    ];

    for (const productData of products) {
      await masterDataService.createProduct(productData);
    }
  }

  // Seed RCA templates
  private async seedRCATemplates(tenantId: string): Promise<void> {
    try {
      // Get organization ID
      const organizations = await masterDataService.getOrganizations();
      const orgId = organizations.length > 0 ? organizations[0].id : 'demo-org';

      const templates = [
        {
          name: 'Equipment Failure Template',
          description: 'Standard template for equipment failure investigations',
          category: 'Equipment',
          logicTreeStructure: {
            nodes: [
              {
                id: 'root_1',
                name: 'Equipment Failure Occurred',
                code: 'EF001',
                category: 'Root',
                description: 'Equipment failure has been reported',
                note: 'Initial failure event',
                finding: false,
                children: [
                  {
                    id: 'why_1',
                    name: 'Why did the equipment fail?',
                    code: 'W001',
                    category: 'Why',
                    description: '',
                    note: 'Primary why question',
                    finding: false,
                    children: [
                      {
                        id: 'cause_1',
                        name: 'Mechanical failure',
                        code: 'C001',
                        category: 'Cause',
                        description: 'Mechanical component failure',
                        note: 'Check mechanical systems',
                        finding: true,
                        children: []
                      },
                      {
                        id: 'cause_2',
                        name: 'Electrical failure',
                        code: 'C002',
                        category: 'Cause',
                        description: 'Electrical system failure',
                        note: 'Check electrical systems',
                        finding: true,
                        children: []
                      }
                    ]
                  }
                ]
              }
            ]
          },
          verificationChecklist: [
            'Equipment inspection completed',
            'Maintenance records reviewed',
            'Operator interviews conducted',
            'Environmental factors assessed',
            'Root cause identified and documented'
          ],
          organizationId: orgId,
          tenantId
        },
      {
        name: 'Process Deviation Template',
        description: 'Template for process deviation investigations',
        category: 'Process',
        logicTreeStructure: {
          nodes: [
            {
              id: 'root_2',
              name: 'Process Deviation Detected',
              code: 'PD001',
              category: 'Root',
              description: 'Process parameters outside normal range',
              note: 'Process monitoring alert',
              finding: false,
              children: [
                {
                  id: 'why_2',
                  name: 'Why did the process deviate?',
                  code: 'W002',
                  category: 'Why',
                  description: '',
                  note: 'Primary why question',
                  finding: false,
                  children: [
                    {
                      id: 'cause_3',
                      name: 'Material quality issue',
                      code: 'C003',
                      category: 'Cause',
                      description: 'Incoming material quality problem',
                      note: 'Check material specifications',
                      finding: true,
                      children: []
                    },
                    {
                      id: 'cause_4',
                      name: 'Operator error',
                      code: 'C004',
                      category: 'Cause',
                      description: 'Operator made incorrect adjustment',
                      note: 'Review training records',
                      finding: true,
                      children: []
                    }
                  ]
                }
              ]
            }
          ]
        },
        verificationChecklist: [
          'Process parameters documented',
          'Material quality verified',
          'Operator training reviewed',
          'Equipment calibration checked',
          'Process control system analyzed'
        ],
          organizationId: orgId,
          tenantId
        }
      ];

      for (const templateData of templates) {
        await masterDataService.createRCATemplate(templateData);
        console.log('Created RCA template:', templateData.name);
      }
    } catch (error) {
      console.warn('Could not create RCA templates:', error);
    }
  }

  // Seed production events
  private async seedProductionEvents(tenantId: string): Promise<void> {
    try {
      // Get actual units and assets
      const units = await masterDataService.getUnits();
      const assets = await masterDataService.getAssets({ tenantId });
      const impactCodes = await masterDataService.getImpactCodes({ tenantId });
      const oeeCodes = await masterDataService.getOEECodes({ tenantId });
      const reasonCodes = await masterDataService.getReasonCodes({ tenantId });

      if (units.length === 0 || assets.length === 0) {
        console.warn('No units or assets found, skipping production events');
        return;
      }

      // Find relevant codes
      const equipmentFailureImpact = impactCodes.find(ic => ic.name.includes('Equipment Failure'))?.id;
      const qualityDefectsImpact = impactCodes.find(ic => ic.name.includes('Quality Defects'))?.id;
      const unplannedDowntimeOEE = oeeCodes.find(oc => oc.name.includes('Unplanned Downtime'))?.id;
      const productionRejectsOEE = oeeCodes.find(oc => oc.name.includes('Production Rejects'))?.id;
      const sealFailureReason = reasonCodes.find(rc => rc.name.includes('Seal Failure'))?.id;
      const motorFailureReason = reasonCodes.find(rc => rc.name.includes('Motor Failure'))?.id;
      const processUpsetReason = reasonCodes.find(rc => rc.name.includes('Process Upset'))?.id;

      const candidates: Omit<ProductionEvent, 'id' | 'createdAt' | 'updatedAt'>[] = [
        {
          eventId: `PLA-EVT-${Date.now()}-1`,
          source: 'Manual',
          unitId: units[0]?.id,
          assetId: assets.find(a => a.name.includes('Pump A-001'))?.id,
          description: 'Pump A-001 seal failure causing production stoppage',
          startTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
          eventType: 'ProductionLoss',
          status: 'Closed',
          severity: 'High',
          impactCodeId: equipmentFailureImpact,
          oeeCodeId: unplannedDowntimeOEE,
          reasonCodeId: sealFailureReason,
          quantity:200,
          cost: 10000,
          duration: 120, // 2 hours in minutes
          tenantId
        },
        {
          eventId: `PLA-EVT-${Date.now()}-2`,
          source: 'Manual',
          unitId: units[1]?.id,
          assetId: assets.find(a => a.name.includes('Pump B-001'))?.id,
          description: 'Pump B-001 motor failure during night shift',
          startTime: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000).toISOString(),
          eventType: 'ProductionLoss',
          status: 'Open',
          severity: 'Critical',
          impactCodeId: equipmentFailureImpact,
          oeeCodeId: unplannedDowntimeOEE,
          reasonCodeId: motorFailureReason,
          quantity:150,
          cost: 7500,
          duration: 240, // 4 hours in minutes
          tenantId
        },
        {
          eventId: `PLA-EVT-${Date.now()}-3`,
          source: 'Manual',
          unitId: units[2]?.id,
          assetId: assets.find(a => a.name.includes('Packaging'))?.id,
          description: 'Packaging machine jam causing quality issues',
          startTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000).toISOString(),
          eventType: 'ProductionLoss',
          status: 'In Progress',
          severity: 'Medium',
          impactCodeId: qualityDefectsImpact,
          oeeCodeId: productionRejectsOEE,
          reasonCodeId: processUpsetReason,
          quantity:50,
          cost: 2000,
          duration: 60, // 1 hour in minutes
          tenantId
        }
      ];
      const events = candidates.filter(event => event.unitId && event.assetId); // Only create events with valid IDs

      for (const eventData of events) {
        await masterDataService.createProductionEvent(eventData);
        console.log('Created production event:', eventData.description);
      }
    } catch (error) {
      console.warn('Could not create production events:', error);
    }
  }

  // Seed RCA investigations
  private async seedRCAInvestigations(tenantId: string): Promise<void> {
    try {
      // Get actual events and templates
      const events = await masterDataService.getProductionEvents({ tenantId });
      const templates = await masterDataService.getRCATemplates({ tenantId });

      if (events.length === 0) {
        console.warn('No production events found, skipping RCA investigations');
        return;
      }

      const equipmentTemplate = templates.find(t => t.name.includes('Equipment Failure'));

      const rcas = [
        {
          eventId: events[0]?.id,
          title: 'Pump A-001 Seal Failure Investigation',
          description: 'Investigation into the seal failure of Pump A-001 that caused 2-hour production loss',
          status: 'In Progress' as const,
          teamLeadId: 'demo-user-1',
          teamMemberIds: ['demo-user-1', 'demo-user-2'],
          priority: 'High' as const,
          targetCloseDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          recommendations: [],
          evidence: [],
          templateId: equipmentTemplate?.id,
          teamCharter: 'Identify root cause of seal failure and implement preventive measures',
          tenantId
        },
        {
          eventId: events[1]?.id,
          title: 'Pump B-001 Motor Failure Analysis',
          description: 'Root cause analysis of motor failure in Pump B-001',
          status: 'Analysis' as const,
          teamLeadId: 'demo-user-2',
          teamMemberIds: ['demo-user-2', 'demo-user-3'],
          priority: 'Critical' as const,
          targetCloseDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
          recommendations: [],
          evidence: [],
          templateId: equipmentTemplate?.id,
          teamCharter: 'Prevent future motor failures through improved maintenance procedures',
          tenantId
        }
      ].filter(rca => rca.eventId); // Only create RCAs with valid event IDs

      for (const rcaData of rcas) {
        await masterDataService.createRCA(rcaData);
        console.log('Created RCA investigation:', rcaData.title);
      }
    } catch (error) {
      console.warn('Could not create RCA investigations:', error);
    }
  }

  // Seed additional master data
  private async seedAdditionalMasterData(tenantId: string): Promise<void> {
    // Add more impact codes
    const additionalImpactCodes = [
      {
        code: 'IC006',
        name: 'Safety Incident',
        description: 'Safety-related incidents affecting production',
        category: 'Availability' as const,
        costPerHour: 10000,
        tenantId
      },
      {
        code: 'IC007',
        name: 'Environmental Issue',
        description: 'Environmental compliance issues',
        category: 'Availability' as const,
        costPerHour: 8000,
        tenantId
      }
    ];

    for (const impactCode of additionalImpactCodes) {
      await masterDataService.createImpactCode(impactCode);
    }

    // Add more OEE codes
    const additionalOEECodes = [
      {
        code: 'OEE008',
        name: 'Safety Stop',
        description: 'Safety-related production stops',
        category: 'Unplanned' as const,
        impactType: 'Availability' as const,
        tenantId
      },
      {
        code: 'OEE009',
        name: 'Environmental Stop',
        description: 'Environmental compliance stops',
        category: 'Unplanned' as const,
        impactType: 'Availability' as const,
        tenantId
      }
    ];

    for (const oeeCode of additionalOEECodes) {
      await masterDataService.createOEECode(oeeCode);
    }
  }

  // Clear all seeded data
  async clearSeededData(tenantId: string): Promise<void> {
    try {
      // Clear production events
      const events = await masterDataService.getProductionEvents({ tenantId });
      for (const event of events) {
        await masterDataService.deleteProductionEvent(event.id);
      }

      // Clear RCAs
      const rcas = await masterDataService.getRCAs({ tenantId });
      for (const rca of rcas) {
        await masterDataService.deleteRCA(rca.id);
      }

      // Clear templates
      const templates = await masterDataService.getRCATemplates({ tenantId });
      for (const template of templates) {
        await masterDataService.deleteRCATemplate(template.id);
      }

      // Clear assets
      const assets = await masterDataService.getAssets({ tenantId });
      for (const asset of assets) {
        await masterDataService.deleteAsset(asset.id);
      }

      // Clear units
      const units = await masterDataService.getUnits();
      for (const unit of units) {
        await masterDataService.deleteUnit(unit.id);
      }

      // Clear products
      const products = await masterDataService.getProducts();
      for (const product of products) {
        await masterDataService.deleteProduct(product.id);
      }

      this.isSeeded = false;
      console.log('Seeded data cleared successfully');
    } catch (error) {
      console.error('Failed to clear seeded data:', error);
    }
  }

  // Reset data (clear and reseed)
  async resetSeededData(tenantId: string): Promise<void> {
    try {
      await this.clearSeededData(tenantId);
      await this.seedPLARCAData(tenantId);
      console.log('Seeded data reset successfully');
    } catch (error) {
      console.error('Failed to reset seeded data:', error);
    }
  }
}

// Global instance
export const globalPLARCADataSeeder = PLARCADataSeeder.getInstance();
export default globalPLARCADataSeeder;
