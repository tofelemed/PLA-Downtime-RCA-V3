// Comprehensive Data Seeder for System Presentation
// Generates realistic, persistent data for Dashboard, PLA, and RCA modules

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
  ReasonCode,
  ProductionPlan,
  ProductionLoss,
  OEESummary
} from './MasterDataService';

export class PresentationDataSeeder {
  private static instance: PresentationDataSeeder;
  private isSeeded: boolean = false;

  private constructor() {}

  static getInstance(): PresentationDataSeeder {
    if (!PresentationDataSeeder.instance) {
      PresentationDataSeeder.instance = new PresentationDataSeeder();
    }
    return PresentationDataSeeder.instance;
  }

  // Main seeding method for presentation
  async seedPresentationData(tenantId: string): Promise<void> {
    if (this.isSeeded) return;

    try {
      console.log('🎯 Starting comprehensive presentation data seeding...');
      
      // Clear existing data first
      await this.clearExistingData(tenantId);
      
      // Seed in order of dependencies
      await this.seedOrganizationsAndTenants();
      await this.seedMasterDataCodes(tenantId);
      await this.seedUnitsAndAssets(tenantId);
      await this.seedProducts();
      
      // Verify units and products exist before creating plans
      const units = await masterDataService.getUnits();
      const products = await masterDataService.getProducts();
      console.log(`📊 Prerequisites check: ${units.length} units, ${products.length} products`);
      
      if (units.length === 0 || products.length === 0) {
        throw new Error(`Missing prerequisites: ${units.length} units, ${products.length} products`);
      }
      
      await this.seedProductionPlans(tenantId);
      await this.seedProductionPlanTemplates(tenantId);
      await this.seedRCATemplates(tenantId);
      await this.seedProductionEvents(tenantId);
      await this.seedProductionLosses(tenantId);
      await this.seedOEESummaries(tenantId);
      await this.seedRCAInvestigations(tenantId);
      await this.seedDashboardData(tenantId);
      
      this.isSeeded = true;
      console.log('✅ Presentation data seeded successfully!');
      
      // Verify data
      await this.verifySeededData(tenantId);
      
    } catch (error) {
      console.error('❌ Failed to seed presentation data:', error);
      throw error;
    }
  }

  // Clear existing data
  private async clearExistingData(tenantId: string): Promise<void> {
    console.log('🧹 Clearing existing data...');
    
    try {
      // Clear production plans first (they depend on units and products)
      const plans = await masterDataService.getProductionPlans({ tenantId });
      for (const plan of plans) {
        await masterDataService.deleteProductionPlan(plan.id);
      }

      // Clear production plan templates
      const planTemplates = await masterDataService.getProductionPlanTemplates({ tenantId });
      for (const template of planTemplates) {
        await masterDataService.deleteProductionPlanTemplate(template.id);
      }

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

      // Clear tenant-specific assets (but keep units and products as they are global)
      const assets = await masterDataService.getAssets({ tenantId });
      for (const asset of assets) {
        await masterDataService.deleteAsset(asset.id);
      }

      console.log('✅ Existing data cleared');
    } catch (error) {
      console.warn('Warning: Could not clear some existing data:', error);
    }
  }

  // Seed organizations and tenants
  private async seedOrganizationsAndTenants(): Promise<void> {
    console.log('🏢 Seeding organizations and tenants...');
    
    try {
      const existingOrgs = await masterDataService.getOrganizations();
      let org;
      
      if (existingOrgs.length === 0) {
        const sampleOrg: Omit<Organization, 'id' | 'createdAt' | 'updatedAt'> = {
          name: 'Advanced Manufacturing Solutions',
          code: 'AMS',
          description: 'Leading manufacturer of industrial equipment',
          isActive: true
        };
        org = await masterDataService.createOrganization(sampleOrg);
        console.log('✅ Created organization:', org.name);
      } else {
        org = existingOrgs[0];
        console.log('✅ Using existing organization:', org.name);
      }

      const existingTenants = await masterDataService.getTenants();
      if (existingTenants.length === 0) {
        const sampleTenant: Omit<Tenant, 'id' | 'createdAt' | 'updatedAt'> = {
          name: 'Plant Alpha - Main Production Facility',
          code: 'PLANT_ALPHA',
          description: 'Primary manufacturing facility with 3 production lines',
          organizationId: org.id,
          isActive: true,
          address: '1234 Industrial Parkway, Manufacturing City, MC 12345',
          contactPerson: 'Sarah Johnson',
          contactEmail: 'sarah.johnson@ams.com',
          contactPhone: '+1-555-0123'
        };
        await masterDataService.createTenant(sampleTenant);
        console.log('✅ Created tenant:', sampleTenant.name);
      } else {
        console.log('✅ Using existing tenant:', existingTenants[0].name);
      }
    } catch (error) {
      console.warn('Could not create organization/tenant:', error);
    }
  }

  // Seed comprehensive master data codes
  private async seedMasterDataCodes(tenantId: string): Promise<void> {
    console.log('📊 Seeding master data codes...');
    
    // Impact Codes
    const impactCodes = [
      { code: 'IC001', name: 'Equipment Failure', description: 'Unplanned equipment breakdowns', category: 'Availability' as const, costPerHour: 8500, tenantId },
      { code: 'IC002', name: 'Setup & Changeover', description: 'Equipment setup and product changeover time', category: 'Availability' as const, costPerHour: 3200, tenantId },
      { code: 'IC003', name: 'Reduced Speed', description: 'Equipment operating below designed speed', category: 'Performance' as const, costPerHour: 4200, tenantId },
      { code: 'IC004', name: 'Quality Defects', description: 'Products that do not meet quality standards', category: 'Quality' as const, costPerHour: 6800, tenantId },
      { code: 'IC005', name: 'Material Shortage', description: 'Lack of required materials for production', category: 'Availability' as const, costPerHour: 5500, tenantId },
      { code: 'IC006', name: 'Safety Incident', description: 'Safety-related incidents affecting production', category: 'Availability' as const, costPerHour: 12000, tenantId },
      { code: 'IC007', name: 'Environmental Issue', description: 'Environmental compliance issues', category: 'Availability' as const, costPerHour: 9500, tenantId },
      { code: 'IC008', name: 'Maintenance Delay', description: 'Delayed maintenance activities', category: 'Availability' as const, costPerHour: 4800, tenantId }
    ];

    for (const code of impactCodes) {
      await masterDataService.createImpactCode(code);
    }

    // OEE Codes
    const oeeCodes = [
      { code: 'OEE001', name: 'Planned Maintenance', description: 'Scheduled maintenance activities', category: 'Planned' as const, impactType: 'Availability' as const, tenantId },
      { code: 'OEE002', name: 'Unplanned Downtime', description: 'Unexpected equipment failures', category: 'Unplanned' as const, impactType: 'Availability' as const, tenantId },
      { code: 'OEE003', name: 'Setup and Adjustment', description: 'Equipment setup and adjustment time', category: 'Planned' as const, impactType: 'Performance' as const, tenantId },
      { code: 'OEE004', name: 'Idling and Minor Stops', description: 'Short stops and idling periods', category: 'Unplanned' as const, impactType: 'Performance' as const, tenantId },
      { code: 'OEE005', name: 'Reduced Speed', description: 'Equipment operating below optimal speed', category: 'Unplanned' as const, impactType: 'Performance' as const, tenantId },
      { code: 'OEE006', name: 'Startup Rejects', description: 'Defects during startup phase', category: 'Unplanned' as const, impactType: 'Quality' as const, tenantId },
      { code: 'OEE007', name: 'Production Rejects', description: 'Defects during normal production', category: 'Unplanned' as const, impactType: 'Quality' as const, tenantId },
      { code: 'OEE008', name: 'Safety Stop', description: 'Safety-related production stops', category: 'Unplanned' as const, impactType: 'Availability' as const, tenantId },
      { code: 'OEE009', name: 'Environmental Stop', description: 'Environmental compliance stops', category: 'Unplanned' as const, impactType: 'Availability' as const, tenantId },
      { code: 'OEE010', name: 'Material Handling', description: 'Material loading and unloading', category: 'Planned' as const, impactType: 'Performance' as const, tenantId }
    ];

    for (const code of oeeCodes) {
      await masterDataService.createOEECode(code);
    }

    // Reason Codes (Hierarchical)
    const reasonCodes = [
      // Top-level
      { code: '100', name: 'Equipment Failure', description: 'Equipment-related failures', parentId: '', tenantId },
      { code: '200', name: 'Process Failure', description: 'Process-related failures', parentId: '', tenantId },
      { code: '300', name: 'Material Issues', description: 'Material-related issues', parentId: '', tenantId },
      { code: '400', name: 'Personnel Issues', description: 'Personnel-related issues', parentId: '', tenantId },
      { code: '500', name: 'Planned Downtime', description: 'Scheduled/planned downtime', parentId: '', tenantId },
      
      // Equipment Failure children
      { code: '110', name: 'Mechanical', description: 'Mechanical breakdowns', parentId: '100', tenantId },
      { code: '120', name: 'Electrical', description: 'Electrical failures', parentId: '100', tenantId },
      { code: '130', name: 'Instrumentation', description: 'Instrumentation/control failures', parentId: '100', tenantId },
      { code: '140', name: 'Hydraulic', description: 'Hydraulic system failures', parentId: '100', tenantId },
      
      // Mechanical grandchildren
      { code: '111', name: 'Bearing Failure', description: 'Bearing-related failures', parentId: '110', tenantId },
      { code: '112', name: 'Gearbox Failure', description: 'Gearbox-related failures', parentId: '110', tenantId },
      { code: '113', name: 'Pump Failure', description: 'Pump breakdowns', parentId: '110', tenantId },
      { code: '114', name: 'Seal Failure', description: 'Seal or gasket failures', parentId: '110', tenantId },
      { code: '115', name: 'Belt Failure', description: 'Belt or chain failures', parentId: '110', tenantId },
      
      // Electrical grandchildren
      { code: '121', name: 'Motor Failure', description: 'Motor breakdowns', parentId: '120', tenantId },
      { code: '122', name: 'Power Supply', description: 'Power supply interruptions', parentId: '120', tenantId },
      { code: '123', name: 'Wiring Issue', description: 'Wiring or connection faults', parentId: '120', tenantId },
      { code: '124', name: 'Control Panel', description: 'Control panel failures', parentId: '120', tenantId },
      
      // Process Failure children
      { code: '210', name: 'Process Upset', description: 'Process upsets', parentId: '200', tenantId },
      { code: '220', name: 'Quality Deviation', description: 'Quality deviations', parentId: '200', tenantId },
      { code: '230', name: 'Capacity Loss', description: 'Capacity or throughput loss', parentId: '200', tenantId },
      { code: '240', name: 'Temperature Control', description: 'Temperature control issues', parentId: '200', tenantId },
      
      // Material Issues children
      { code: '310', name: 'Wrong Material', description: 'Incorrect material used', parentId: '300', tenantId },
      { code: '320', name: 'Material Delay', description: 'Material delivery delay', parentId: '300', tenantId },
      { code: '330', name: 'Material Defect', description: 'Defective or contaminated material', parentId: '300', tenantId },
      { code: '340', name: 'Material Shortage', description: 'Insufficient material quantity', parentId: '300', tenantId },
      
      // Personnel Issues children
      { code: '410', name: 'Operator Error', description: 'Operator mistakes', parentId: '400', tenantId },
      { code: '420', name: 'Staff Shortage', description: 'Not enough staff', parentId: '400', tenantId },
      { code: '430', name: 'Training Issue', description: 'Insufficient training', parentId: '400', tenantId },
      { code: '440', name: 'Safety Violation', description: 'Safety protocol violations', parentId: '400', tenantId },
      
      // Planned Downtime children
      { code: '510', name: 'Scheduled Maintenance', description: 'Planned maintenance', parentId: '500', tenantId },
      { code: '520', name: 'Changeover', description: 'Planned changeover', parentId: '500', tenantId },
      { code: '530', name: 'Cleaning', description: 'Scheduled cleaning', parentId: '500', tenantId },
      { code: '540', name: 'Break/Meeting', description: 'Operator breaks or meetings', parentId: '500', tenantId }
    ];

    for (const code of reasonCodes) {
      await masterDataService.createReasonCode(code);
    }

    console.log('✅ Master data codes seeded');
  }

  // Seed production units and assets
  private async seedUnitsAndAssets(tenantId: string): Promise<void> {
    console.log('🏭 Seeding cement industry units and assets...');
    
    // Check if units already exist
    const existingUnits = await masterDataService.getUnits();
    if (existingUnits.length > 0) {
      console.log(`✅ Units already exist (${existingUnits.length}), skipping unit creation`);
      // Still create assets for existing units
      await this.seedAssetsForExistingUnits(tenantId, existingUnits);
      return;
    }
    
    const units = [
      {
        name: 'Raw Mill Unit - RM-1',
        code: 'RM-1',
        description: 'Primary raw material grinding and preparation unit',
        capacity: 300,
        unitOfMeasure: 'TPH (Tons Per Hour)',
        idealCycleTime: 0.2
      },
      {
        name: 'Kiln Unit - K-1',
        code: 'K-1',
        description: 'Rotary kiln for clinker production',
        capacity: 5000,
        unitOfMeasure: 'TPD (Tons Per Day)',
        idealCycleTime: 1.0
      },
      {
        name: 'Cement Mill Unit - CM-1',
        code: 'CM-1',
        description: 'Finish grinding mill for cement production',
        capacity: 200,
        unitOfMeasure: 'TPH (Tons Per Hour)',
        idealCycleTime: 0.3
      },
      {
        name: 'Packaging Unit - PK-1',
        code: 'PK-1',
        description: 'Cement packaging and bagging facility',
        capacity: 150,
        unitOfMeasure: 'TPH (Tons Per Hour)',
        idealCycleTime: 0.4
      },
      {
        name: 'Quality Control Lab - QC-1',
        code: 'QC-1',
        description: 'Cement quality testing and analysis laboratory',
        capacity: 50,
        unitOfMeasure: 'samples/hour',
        idealCycleTime: 1.2
      },
      {
        name: 'Coal Mill Unit - CM-2',
        code: 'CM-2',
        description: 'Coal grinding mill for kiln fuel preparation',
        capacity: 50,
        unitOfMeasure: 'TPH (Tons Per Hour)',
        idealCycleTime: 1.2
      },
      {
        name: 'Crusher Unit - CR-1',
        code: 'CR-1',
        description: 'Primary limestone crusher for raw material preparation',
        capacity: 800,
        unitOfMeasure: 'TPH (Tons Per Hour)',
        idealCycleTime: 0.075
      },
      {
        name: 'Preheater Unit - PH-1',
        code: 'PH-1',
        description: 'Cyclone preheater for kiln feed preheating',
        capacity: 5000,
        unitOfMeasure: 'TPD (Tons Per Day)',
        idealCycleTime: 1.0
      }
    ];

    const createdUnits = [];
    for (const unitData of units) {
      const unit = await masterDataService.createUnit(unitData);
      createdUnits.push(unit);
    }

    // Create comprehensive cement industry assets for each unit
    const assets = [
      // Raw Mill Unit assets
      {
        name: 'Raw Mill Ball Mill - RM-1-BM',
        code: 'RM-1-BM',
        unitId: createdUnits[0].id,
        description: 'Primary ball mill for raw material grinding',
        assetType: 'Equipment' as const,
        criticality: 'High' as const,
        manufacturer: 'FLSmidth',
        model: 'UM-38.4',
        status: 'Active' as const,
        tenantId
      },
      {
        name: 'Raw Mill Separator - RM-1-SEP',
        code: 'RM-1-SEP',
        unitId: createdUnits[0].id,
        description: 'Dynamic separator for raw mill product classification',
        assetType: 'Equipment' as const,
        criticality: 'High' as const,
        manufacturer: 'FLSmidth',
        model: 'SEPAX-425',
        status: 'Active' as const,
        tenantId
      },
      {
        name: 'Raw Mill Fan - RM-1-FAN',
        code: 'RM-1-FAN',
        unitId: createdUnits[0].id,
        description: 'Main fan for raw mill ventilation and material transport',
        assetType: 'Equipment' as const,
        criticality: 'High' as const,
        manufacturer: 'Howden',
        model: 'HT-2000',
        status: 'Active' as const,
        tenantId
      },
      {
        name: 'Raw Mill Motor - RM-1-MOT',
        code: 'RM-1-MOT',
        unitId: createdUnits[0].id,
        description: 'Main drive motor for raw mill',
        assetType: 'Equipment' as const,
        criticality: 'High' as const,
        manufacturer: 'ABB',
        model: 'AMZ 800',
        status: 'Active' as const,
        tenantId
      },
      
      // Kiln Unit assets
      {
        name: 'Rotary Kiln - K-1-RK',
        code: 'K-1-RK',
        unitId: createdUnits[1].id,
        description: 'Main rotary kiln for clinker production',
        assetType: 'Equipment' as const,
        criticality: 'Critical' as const,
        manufacturer: 'FLSmidth',
        model: 'ROTAX-2',
        status: 'Active' as const,
        tenantId
      },
      {
        name: 'Kiln Drive - K-1-DRIVE',
        code: 'K-1-DRIVE',
        unitId: createdUnits[1].id,
        description: 'Main drive system for rotary kiln',
        assetType: 'Equipment' as const,
        criticality: 'Critical' as const,
        manufacturer: 'Siemens',
        model: 'SIMOVERT-MASTERDRIVES',
        status: 'Active' as const,
        tenantId
      },
      {
        name: 'Kiln Burner - K-1-BURNER',
        code: 'K-1-BURNER',
        unitId: createdUnits[1].id,
        description: 'Multi-fuel burner for kiln combustion',
        assetType: 'Equipment' as const,
        criticality: 'Critical' as const,
        manufacturer: 'FLSmidth',
        model: 'DUOFLEX',
        status: 'Active' as const,
        tenantId
      },
      {
        name: 'Kiln Shell - K-1-SHELL',
        code: 'K-1-SHELL',
        unitId: createdUnits[1].id,
        description: 'Kiln shell with refractory lining',
        assetType: 'Equipment' as const,
        criticality: 'Critical' as const,
        manufacturer: 'FLSmidth',
        model: 'KILN-SHELL-4.8x72',
        status: 'Active' as const,
        tenantId
      },
      
      // Cement Mill Unit assets
      {
        name: 'Cement Mill Ball Mill - CM-1-BM',
        code: 'CM-1-BM',
        unitId: createdUnits[2].id,
        description: 'Finish grinding ball mill for cement production',
        assetType: 'Equipment' as const,
        criticality: 'High' as const,
        manufacturer: 'FLSmidth',
        model: 'UM-46.4',
        status: 'Active' as const,
        tenantId
      },
      {
        name: 'Cement Mill Separator - CM-1-SEP',
        code: 'CM-1-SEP',
        unitId: createdUnits[2].id,
        description: 'High-efficiency separator for cement mill',
        assetType: 'Equipment' as const,
        criticality: 'High' as const,
        manufacturer: 'FLSmidth',
        model: 'SEPAX-450',
        status: 'Active' as const,
        tenantId
      },
      {
        name: 'Cement Mill Fan - CM-1-FAN',
        code: 'CM-1-FAN',
        unitId: createdUnits[2].id,
        description: 'Main fan for cement mill ventilation',
        assetType: 'Equipment' as const,
        criticality: 'High' as const,
        manufacturer: 'Howden',
        model: 'HT-2500',
        status: 'Active' as const,
        tenantId
      },
      
      // Packaging Unit assets
      {
        name: 'Packaging Machine - PK-1-PM',
        code: 'PK-1-PM',
        unitId: createdUnits[3].id,
        description: 'Automated cement packaging machine',
        assetType: 'Equipment' as const,
        criticality: 'Medium' as const,
        manufacturer: 'Haver & Boecker',
        model: 'ROTO-PACKER',
        status: 'Active' as const,
        tenantId
      },
      {
        name: 'Bag Conveyor - PK-1-CONV',
        code: 'PK-1-CONV',
        unitId: createdUnits[3].id,
        description: 'Conveyor system for bagged cement transport',
        assetType: 'Equipment' as const,
        criticality: 'Medium' as const,
        manufacturer: 'Continental',
        model: 'CONTI-CONVEYOR',
        status: 'Active' as const,
        tenantId
      },
      
      // Quality Control Lab assets
      {
        name: 'X-Ray Fluorescence - QC-1-XRF',
        code: 'QC-1-XRF',
        unitId: createdUnits[4].id,
        description: 'XRF analyzer for chemical composition analysis',
        assetType: 'Instrument' as const,
        criticality: 'High' as const,
        manufacturer: 'Bruker',
        model: 'S8-TIGER',
        status: 'Active' as const,
        tenantId
      },
      {
        name: 'Blaine Apparatus - QC-1-BLAINE',
        code: 'QC-1-BLAINE',
        unitId: createdUnits[4].id,
        description: 'Blaine fineness testing apparatus',
        assetType: 'Instrument' as const,
        criticality: 'Medium' as const,
        manufacturer: 'Humboldt',
        model: 'H-2980',
        status: 'Active' as const,
        tenantId
      },
      
      // Coal Mill Unit assets
      {
        name: 'Coal Mill - CM-2-COAL',
        code: 'CM-2-COAL',
        unitId: createdUnits[5].id,
        description: 'Vertical roller mill for coal grinding',
        assetType: 'Equipment' as const,
        criticality: 'High' as const,
        manufacturer: 'LOESCHE',
        model: 'LM-28.2D',
        status: 'Active' as const,
        tenantId
      },
      
      // Crusher Unit assets
      {
        name: 'Primary Crusher - CR-1-PC',
        code: 'CR-1-PC',
        unitId: createdUnits[6].id,
        description: 'Primary hammer crusher for limestone',
        assetType: 'Equipment' as const,
        criticality: 'High' as const,
        manufacturer: 'FLSmidth',
        model: 'EV-200x300',
        status: 'Active' as const,
        tenantId
      },
      
      // Preheater Unit assets
      {
        name: 'Cyclone Preheater - PH-1-CYC',
        code: 'PH-1-CYC',
        unitId: createdUnits[7].id,
        description: '4-stage cyclone preheater system',
        assetType: 'Equipment' as const,
        criticality: 'Critical' as const,
        manufacturer: 'FLSmidth',
        model: 'PREHEATER-4ST',
        status: 'Active' as const,
        tenantId
      }
    ];

    for (const assetData of assets) {
      await masterDataService.createAsset(assetData);
    }

    console.log('✅ Production units and assets seeded');
  }

  // Seed assets for existing units
  private async seedAssetsForExistingUnits(tenantId: string, existingUnits: any[]): Promise<void> {
    console.log('🔧 Seeding assets for existing units...');
    
    // Create assets for existing units (similar to the main asset creation logic)
    const assets = [
      // Raw Mill Unit assets
      {
        name: 'Raw Mill Ball Mill - RM-1-BM',
        code: 'RM-1-BM',
        unitId: existingUnits.find(u => u.name.includes('Raw Mill'))?.id || existingUnits[0]?.id,
        description: 'Primary ball mill for raw material grinding',
        assetType: 'Equipment' as const,
        criticality: 'High' as const,
        manufacturer: 'FLSmidth',
        model: 'UM-38.4',
        status: 'Active' as const,
        tenantId
      },
      // Add more assets as needed...
    ].filter(asset => asset.unitId);

    for (const assetData of assets) {
      await masterDataService.createAsset(assetData);
    }

    console.log('✅ Assets seeded for existing units');
  }

  // Seed products
  private async seedProducts(): Promise<void> {
    console.log('📦 Seeding cement industry products...');
    
    // Check if products already exist
    const existingProducts = await masterDataService.getProducts();
    if (existingProducts.length > 0) {
      console.log(`✅ Products already exist (${existingProducts.length}), skipping product creation`);
      return;
    }
    
    const products = [
      {
        name: 'Ordinary Portland Cement - OPC 53 Grade',
        code: 'OPC-53',
        unitOfMeasure: 'MT (Metric Tons)',
        description: 'High-strength Ordinary Portland Cement 53 Grade for structural applications',
        standardCost: 85.50
      },
      {
        name: 'Ordinary Portland Cement - OPC 43 Grade',
        code: 'OPC-43',
        unitOfMeasure: 'MT (Metric Tons)',
        description: 'Standard Ordinary Portland Cement 43 Grade for general construction',
        standardCost: 78.25
      },
      {
        name: 'Portland Pozzolana Cement - PPC',
        code: 'PPC',
        unitOfMeasure: 'MT (Metric Tons)',
        description: 'Portland Pozzolana Cement with fly ash for enhanced durability',
        standardCost: 82.75
      },
      {
        name: 'Portland Slag Cement - PSC',
        code: 'PSC',
        unitOfMeasure: 'MT (Metric Tons)',
        description: 'Portland Slag Cement with blast furnace slag for marine applications',
        standardCost: 79.50
      },
      {
        name: 'Rapid Hardening Cement - RHC',
        code: 'RHC',
        unitOfMeasure: 'MT (Metric Tons)',
        description: 'Rapid Hardening Cement for quick setting applications',
        standardCost: 95.25
      },
      {
        name: 'Low Heat Cement - LHC',
        code: 'LHC',
        unitOfMeasure: 'MT (Metric Tons)',
        description: 'Low Heat Cement for mass concrete applications',
        standardCost: 88.75
      },
      {
        name: 'Sulphate Resistant Cement - SRC',
        code: 'SRC',
        unitOfMeasure: 'MT (Metric Tons)',
        description: 'Sulphate Resistant Cement for aggressive environments',
        standardCost: 92.40
      },
      {
        name: 'White Cement - WC',
        code: 'WC',
        unitOfMeasure: 'MT (Metric Tons)',
        description: 'White Portland Cement for decorative applications',
        standardCost: 125.00
      }
    ];

    for (const productData of products) {
      await masterDataService.createProduct(productData);
    }

    console.log('✅ Products seeded');
  }

  // Seed production plans
  private async seedProductionPlans(tenantId: string): Promise<void> {
    console.log('📋 Seeding production plans...');
    
    try {
      const units = await masterDataService.getUnits();
      const products = await masterDataService.getProducts();
      
      if (units.length === 0 || products.length === 0) {
        console.warn('No units or products found, skipping production plans');
        return;
      }

      // Find units and products more reliably
      const kilnUnit = units.find(u => u.name.includes('Kiln')) || units[0];
      const rawMillUnit = units.find(u => u.name.includes('Raw Mill')) || units[1];
      const cementMillUnit = units.find(u => u.name.includes('Cement Mill')) || units[2];
      const packagingUnit = units.find(u => u.name.includes('Packaging')) || units[3];
      
      const opc53Product = products.find(p => p.name.includes('OPC 53')) || products[0];
      const opc43Product = products.find(p => p.name.includes('OPC 43')) || products[1];
      const ppcProduct = products.find(p => p.name.includes('PPC')) || products[2];
      
      console.log('🔍 Unit assignments:');
      console.log(`   - Kiln Unit: ${kilnUnit?.name} (${kilnUnit?.id})`);
      console.log(`   - Raw Mill Unit: ${rawMillUnit?.name} (${rawMillUnit?.id})`);
      console.log(`   - Cement Mill Unit: ${cementMillUnit?.name} (${cementMillUnit?.id})`);
      console.log(`   - Packaging Unit: ${packagingUnit?.name} (${packagingUnit?.id})`);
      
      console.log('🔍 Product assignments:');
      console.log(`   - OPC 53 Product: ${opc53Product?.name} (${opc53Product?.id})`);
      console.log(`   - OPC 43 Product: ${opc43Product?.name} (${opc43Product?.id})`);
      console.log(`   - PPC Product: ${ppcProduct?.name} (${ppcProduct?.id})`);

      const plans = [
        {
          name: 'Q1 2024 Clinker Production Plan - Kiln K-1',
          unitId: kilnUnit?.id,
          productId: opc53Product?.id,
          plannedQuantity: 450000, // MT of clinker
          toleranceLimit: 3,
          startDate: new Date('2024-01-01').toISOString(),
          endDate: new Date('2024-03-31').toISOString(),
          status: 'Active' as const,
          approvalStatus: 'Approved' as const,
          planBasis: 'Market Demand',
          usefulProductionTime: {
            'Monday': { start: '00:00', end: '24:00' },
            'Tuesday': { start: '00:00', end: '24:00' },
            'Wednesday': { start: '00:00', end: '24:00' },
            'Thursday': { start: '00:00', end: '24:00' },
            'Friday': { start: '00:00', end: '24:00' },
            'Saturday': { start: '00:00', end: '24:00' },
            'Sunday': { start: '00:00', end: '24:00' }
          },
          dataEntryFrequency: 'Shift',
          plannerNotes: 'Continuous kiln operation for Q1 clinker production target',
          tenantId
        },
        {
          name: 'Q1 2024 Raw Meal Production Plan - Raw Mill RM-1',
          unitId: rawMillUnit?.id,
          productId: opc43Product?.id,
          plannedQuantity: 540000, // MT of raw meal
          toleranceLimit: 5,
          startDate: new Date('2024-01-01').toISOString(),
          endDate: new Date('2024-03-31').toISOString(),
          status: 'Active' as const,
          approvalStatus: 'Approved' as const,
          planBasis: 'Kiln Feed Requirements',
          usefulProductionTime: {
            'Monday': { start: '06:00', end: '22:00' },
            'Tuesday': { start: '06:00', end: '22:00' },
            'Wednesday': { start: '06:00', end: '22:00' },
            'Thursday': { start: '06:00', end: '22:00' },
            'Friday': { start: '06:00', end: '22:00' },
            'Saturday': { start: '06:00', end: '18:00' }
          },
          dataEntryFrequency: 'Shift',
          plannerNotes: 'Raw meal production to support kiln operations',
          tenantId
        },
        {
          name: 'Q1 2024 Cement Production Plan - Cement Mill CM-1',
          unitId: cementMillUnit?.id,
          productId: ppcProduct?.id,
          plannedQuantity: 360000, // MT of cement
          toleranceLimit: 3,
          startDate: new Date('2024-01-01').toISOString(),
          endDate: new Date('2024-03-31').toISOString(),
          status: 'Active' as const,
          approvalStatus: 'Approved' as const,
          planBasis: 'Market Demand',
          usefulProductionTime: {
            'Monday': { start: '06:00', end: '22:00' },
            'Tuesday': { start: '06:00', end: '22:00' },
            'Wednesday': { start: '06:00', end: '22:00' },
            'Thursday': { start: '06:00', end: '22:00' },
            'Friday': { start: '06:00', end: '22:00' },
            'Saturday': { start: '06:00', end: '18:00' }
          },
          dataEntryFrequency: 'Shift',
          plannerNotes: 'Finish grinding operations for cement production',
          tenantId
        },
        {
          name: 'Q1 2024 Packaging Plan - Packaging Unit PK-1',
          unitId: packagingUnit?.id,
          productId: opc43Product?.id,
          plannedQuantity: 300000, // MT of bagged cement
          toleranceLimit: 2,
          startDate: new Date('2024-01-01').toISOString(),
          endDate: new Date('2024-03-31').toISOString(),
          status: 'Active' as const,
          approvalStatus: 'Approved' as const,
          planBasis: 'Customer Orders',
          usefulProductionTime: {
            'Monday': { start: '06:00', end: '18:00' },
            'Tuesday': { start: '06:00', end: '18:00' },
            'Wednesday': { start: '06:00', end: '18:00' },
            'Thursday': { start: '06:00', end: '18:00' },
            'Friday': { start: '06:00', end: '18:00' },
            'Saturday': { start: '06:00', end: '14:00' }
          },
          dataEntryFrequency: 'Daily',
          plannerNotes: 'Increased capacity for Q2 demand',
          tenantId
        },
        {
          name: 'Packaging Plan - Line 1',
          unitId: units[3]?.id,
          productId: products[0]?.id,
          plannedQuantity: 60000,
          toleranceLimit: 3,
          startDate: new Date('2024-01-01').toISOString(),
          endDate: new Date('2024-03-31').toISOString(),
          status: 'Active' as const,
          approvalStatus: 'Approved' as const,
          planBasis: 'Downstream Requirements',
          usefulProductionTime: {
            'Monday': { start: '06:00', end: '22:00' },
            'Tuesday': { start: '06:00', end: '22:00' },
            'Wednesday': { start: '06:00', end: '22:00' },
            'Thursday': { start: '06:00', end: '22:00' },
            'Friday': { start: '06:00', end: '22:00' },
            'Saturday': { start: '08:00', end: '20:00' },
            'Sunday': { start: '08:00', end: '16:00' }
          },
          dataEntryFrequency: 'Shift',
          plannerNotes: 'High-volume packaging operations',
          tenantId
        }
      ].filter(plan => plan.unitId && plan.productId);

      console.log(`📋 Creating ${plans.length} production plans...`);
      
      for (const planData of plans) {
        try {
          const createdPlan = await masterDataService.createProductionPlan(planData);
          console.log(`✅ Created plan: ${createdPlan.name} (${createdPlan.id})`);
        } catch (error) {
          console.error(`❌ Failed to create plan: ${planData.name}`, error);
        }
      }

      console.log('✅ Production plans seeded');
    } catch (error) {
      console.warn('Could not create production plans:', error);
    }
  }

  // Seed production plan templates
  private async seedProductionPlanTemplates(tenantId: string): Promise<void> {
    console.log('📋 Seeding production plan templates...');
    
    try {
      const units = await masterDataService.getUnits();
      const products = await masterDataService.getProducts();
      const organizations = await masterDataService.getOrganizations();
      const orgId = organizations.length > 0 ? organizations[0].id : undefined;
      
      if (units.length === 0 || products.length === 0) {
        console.warn('No units or products found, skipping production plan templates');
        return;
      }

      const templates = [
        {
          name: 'Standard Production Template - Line A',
          description: 'Standard template for high-volume production on Line A',
          unitId: units[0]?.id,
          productIds: [products[0]?.id, products[1]?.id].filter(Boolean),
          planBasis: 'Customer Orders',
          startDate: new Date('2024-01-01').toISOString(),
          endDate: new Date('2024-12-31').toISOString(),
          recurrence: 'Quarterly',
          usefulProductionTime: {
            'Monday': { start: '06:00', end: '18:00' },
            'Tuesday': { start: '06:00', end: '18:00' },
            'Wednesday': { start: '06:00', end: '18:00' },
            'Thursday': { start: '06:00', end: '18:00' },
            'Friday': { start: '06:00', end: '18:00' },
            'Saturday': { start: '06:00', end: '14:00' }
          },
          dataEntryFrequency: 'Daily',
          tenantId,
          orgId
        },
        {
          name: 'Precision Manufacturing Template - Line B',
          description: 'Template for precision manufacturing operations on Line B',
          unitId: units[1]?.id,
          productIds: [products[2]?.id, products[3]?.id].filter(Boolean),
          planBasis: 'Market Forecast',
          startDate: new Date('2024-01-01').toISOString(),
          endDate: new Date('2024-12-31').toISOString(),
          recurrence: 'Monthly',
          usefulProductionTime: {
            'Monday': { start: '08:00', end: '20:00' },
            'Tuesday': { start: '08:00', end: '20:00' },
            'Wednesday': { start: '08:00', end: '20:00' },
            'Thursday': { start: '08:00', end: '20:00' },
            'Friday': { start: '08:00', end: '20:00' }
          },
          dataEntryFrequency: 'Daily',
          tenantId,
          orgId
        },
        {
          name: 'Assembly Operations Template - Line C',
          description: 'Template for complex assembly operations on Line C',
          unitId: units[2]?.id,
          productIds: [products[4]?.id, products[5]?.id].filter(Boolean),
          planBasis: 'Inventory Replenishment',
          startDate: new Date('2024-01-01').toISOString(),
          endDate: new Date('2024-12-31').toISOString(),
          recurrence: 'Weekly',
          usefulProductionTime: {
            'Monday': { start: '07:00', end: '19:00' },
            'Tuesday': { start: '07:00', end: '19:00' },
            'Wednesday': { start: '07:00', end: '19:00' },
            'Thursday': { start: '07:00', end: '19:00' },
            'Friday': { start: '07:00', end: '19:00' },
            'Saturday': { start: '08:00', end: '16:00' }
          },
          dataEntryFrequency: 'Shift',
          tenantId,
          orgId
        },
        {
          name: 'Packaging Operations Template',
          description: 'Template for high-volume packaging operations',
          unitId: units[3]?.id,
          productIds: [products[0]?.id, products[1]?.id, products[2]?.id].filter(Boolean),
          planBasis: 'Downstream Requirements',
          startDate: new Date('2024-01-01').toISOString(),
          endDate: new Date('2024-12-31').toISOString(),
          recurrence: 'Daily',
          usefulProductionTime: {
            'Monday': { start: '06:00', end: '22:00' },
            'Tuesday': { start: '06:00', end: '22:00' },
            'Wednesday': { start: '06:00', end: '22:00' },
            'Thursday': { start: '06:00', end: '22:00' },
            'Friday': { start: '06:00', end: '22:00' },
            'Saturday': { start: '08:00', end: '20:00' },
            'Sunday': { start: '08:00', end: '16:00' }
          },
          dataEntryFrequency: 'Shift',
          tenantId,
          orgId
        }
      ].filter(template => template.unitId && template.productIds.length > 0);

      for (const templateData of templates) {
        await masterDataService.createProductionPlanTemplate(templateData);
      }

      console.log('✅ Production plan templates seeded');
    } catch (error) {
      console.warn('Could not create production plan templates:', error);
    }
  }

  // Seed RCA templates
  private async seedRCATemplates(tenantId: string): Promise<void> {
    console.log('📋 Seeding RCA templates...');
    
    try {
      const organizations = await masterDataService.getOrganizations();
      const orgId = organizations.length > 0 ? organizations[0].id : 'demo-org';

      const templates = [
        {
          name: 'Equipment Failure Investigation Template',
          description: 'Comprehensive template for equipment failure root cause analysis',
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
                      },
                      {
                        id: 'cause_3',
                        name: 'Maintenance issue',
                        code: 'C003',
                        category: 'Cause',
                        description: 'Inadequate or delayed maintenance',
                        note: 'Review maintenance records',
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
            'Root cause identified and documented',
            'Preventive measures defined',
            'Implementation plan created'
          ],
          organizationId: orgId,
          tenantId
        },
        {
          name: 'Process Deviation Analysis Template',
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
                        id: 'cause_4',
                        name: 'Material quality issue',
                        code: 'C004',
                        category: 'Cause',
                        description: 'Incoming material quality problem',
                        note: 'Check material specifications',
                        finding: true,
                        children: []
                      },
                      {
                        id: 'cause_5',
                        name: 'Operator error',
                        code: 'C005',
                        category: 'Cause',
                        description: 'Operator made incorrect adjustment',
                        note: 'Review training records',
                        finding: true,
                        children: []
                      },
                      {
                        id: 'cause_6',
                        name: 'Equipment malfunction',
                        code: 'C006',
                        category: 'Cause',
                        description: 'Equipment not functioning properly',
                        note: 'Check equipment status',
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
            'Process control system analyzed',
            'Environmental conditions assessed',
            'Corrective actions implemented'
          ],
          organizationId: orgId,
          tenantId
        },
        {
          name: 'Quality Issue Investigation Template',
          description: 'Template for quality-related problem investigations',
          category: 'Quality',
          logicTreeStructure: {
            nodes: [
              {
                id: 'root_3',
                name: 'Quality Issue Identified',
                code: 'QI001',
                category: 'Root',
                description: 'Product quality issue detected',
                note: 'Quality control alert',
                finding: false,
                children: [
                  {
                    id: 'why_3',
                    name: 'Why did the quality issue occur?',
                    code: 'W003',
                    category: 'Why',
                    description: '',
                    note: 'Primary why question',
                    finding: false,
                    children: [
                      {
                        id: 'cause_7',
                        name: 'Process parameter drift',
                        code: 'C007',
                        category: 'Cause',
                        description: 'Process parameters drifted from setpoint',
                        note: 'Check process control',
                        finding: true,
                        children: []
                      },
                      {
                        id: 'cause_8',
                        name: 'Tool wear',
                        code: 'C008',
                        category: 'Cause',
                        description: 'Tooling worn beyond acceptable limits',
                        note: 'Check tool condition',
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
            'Quality specifications reviewed',
            'Process parameters analyzed',
            'Tool condition checked',
            'Material quality verified',
            'Operator procedures reviewed',
            'Root cause identified',
            'Corrective actions implemented'
          ],
          organizationId: orgId,
          tenantId
        }
      ];

      for (const templateData of templates) {
        await masterDataService.createRCATemplate(templateData);
      }

      console.log('✅ RCA templates seeded');
    } catch (error) {
      console.warn('Could not create RCA templates:', error);
    }
  }

  // Seed production events with realistic data
  private async seedProductionEvents(tenantId: string): Promise<void> {
    console.log('🚨 Seeding production events...');
    
    try {
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
      const reducedSpeedImpact = impactCodes.find(ic => ic.name.includes('Reduced Speed'))?.id;
      const materialShortageImpact = impactCodes.find(ic => ic.name.includes('Material Shortage'))?.id;
      
      const unplannedDowntimeOEE = oeeCodes.find(oc => oc.name.includes('Unplanned Downtime'))?.id;
      const productionRejectsOEE = oeeCodes.find(oc => oc.name.includes('Production Rejects'))?.id;
      const reducedSpeedOEE = oeeCodes.find(oc => oc.name.includes('Reduced Speed'))?.id;
      
      const sealFailureReason = reasonCodes.find(rc => rc.name.includes('Seal Failure'))?.id;
      const motorFailureReason = reasonCodes.find(rc => rc.name.includes('Motor Failure'))?.id;
      const processUpsetReason = reasonCodes.find(rc => rc.name.includes('Process Upset'))?.id;
      const materialDelayReason = reasonCodes.find(rc => rc.name.includes('Material Delay'))?.id;

      const events = [
        {
          unitId: units.find(u => u.name.includes('Kiln'))?.id,
          assetId: assets.find(a => a.name.includes('Rotary Kiln'))?.id,
          description: 'Rotary kiln refractory lining failure causing emergency shutdown',
          startTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 6 * 60 * 60 * 1000).toISOString(),
          eventType: 'ProductionLoss',
          status: 'Closed',
          impactCodeId: equipmentFailureImpact,
          oeeCodeId: unplannedDowntimeOEE,
          reasonCodeId: reasonCodes.find(rc => rc.name.includes('Mechanical'))?.id,
          quantityLost: 1250, // MT of clinker
          costImpact: 106250, // $85/MT * 1250 MT
          duration: 360, // 6 hours in minutes
          tenantId
        },
        {
          unitId: units.find(u => u.name.includes('Raw Mill'))?.id,
          assetId: assets.find(a => a.name.includes('Raw Mill Ball Mill'))?.id,
          description: 'Raw mill ball mill motor failure during peak production',
          startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000).toISOString(),
          eventType: 'ProductionLoss',
          status: 'Open',
          impactCodeId: equipmentFailureImpact,
          oeeCodeId: unplannedDowntimeOEE,
          reasonCodeId: motorFailureReason,
          quantityLost: 1200, // MT of raw meal
          costImpact: 36000, // $30/MT * 1200 MT
          duration: 240, // 4 hours in minutes
          tenantId
        },
        {
          unitId: units.find(u => u.name.includes('Cement Mill'))?.id,
          assetId: assets.find(a => a.name.includes('Cement Mill Separator'))?.id,
          description: 'Cement mill separator efficiency drop causing quality issues',
          startTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString(),
          eventType: 'QualityIssue',
          status: 'In Progress',
          impactCodeId: qualityDefectsImpact,
          oeeCodeId: productionRejectsOEE,
          reasonCodeId: processUpsetReason,
          quantityLost: 150, // MT of cement
          costImpact: 12750, // $85/MT * 150 MT
          duration: 180, // 3 hours in minutes
          tenantId
        },
        {
          unitId: units.find(u => u.name.includes('Coal Mill'))?.id,
          assetId: assets.find(a => a.name.includes('Coal Mill'))?.id,
          description: 'Coal mill roller wear causing reduced grinding capacity',
          startTime: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000).toISOString(),
          eventType: 'PerformanceLoss',
          status: 'Closed',
          impactCodeId: reducedSpeedImpact,
          oeeCodeId: reducedSpeedOEE,
          reasonCodeId: reasonCodes.find(rc => rc.name.includes('Mechanical'))?.id,
          quantityLost: 300, // MT of coal
          costImpact: 15000, // $50/MT * 300 MT
          duration: 720, // 12 hours in minutes
          tenantId
        },
        {
          unitId: units.find(u => u.name.includes('Crusher'))?.id,
          assetId: assets.find(a => a.name.includes('Primary Crusher'))?.id,
          description: 'Primary crusher hammer wear causing reduced throughput',
          startTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000).toISOString(),
          eventType: 'PerformanceLoss',
          status: 'Closed',
          impactCodeId: reducedSpeedImpact,
          oeeCodeId: reducedSpeedOEE,
          reasonCodeId: reasonCodes.find(rc => rc.name.includes('Mechanical'))?.id,
          quantityLost: 1600, // MT of limestone
          costImpact: 8000, // $5/MT * 1600 MT
          duration: 240, // 4 hours in minutes
          tenantId
        },
        {
          unitId: units.find(u => u.name.includes('Packaging'))?.id,
          assetId: assets.find(a => a.name.includes('Packaging Machine'))?.id,
          description: 'Cement packaging machine bag feed system malfunction',
          startTime: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() - 6 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
          eventType: 'ProductionLoss',
          status: 'In Progress',
          impactCodeId: equipmentFailureImpact,
          oeeCodeId: unplannedDowntimeOEE,
          reasonCodeId: reasonCodes.find(rc => rc.name.includes('Mechanical'))?.id,
          quantityLost: 300, // MT of cement
          costImpact: 25500, // $85/MT * 300 MT
          duration: 120, // 2 hours in minutes
          tenantId
        },
        {
          unitId: units.find(u => u.name.includes('Preheater'))?.id,
          assetId: assets.find(a => a.name.includes('Cyclone Preheater'))?.id,
          description: 'Cyclone preheater stage 4 blockage causing kiln feed interruption',
          startTime: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
          eventType: 'ProductionLoss',
          status: 'Closed',
          impactCodeId: equipmentFailureImpact,
          oeeCodeId: unplannedDowntimeOEE,
          reasonCodeId: processUpsetReason,
          quantityLost: 416, // MT of clinker (2 hours at 5000 TPD)
          costImpact: 35360, // $85/MT * 416 MT
          duration: 120, // 2 hours in minutes
          tenantId
        }
      ].filter(event => event.unitId && event.assetId);

      for (const eventData of events) {
        await masterDataService.createProductionEvent(eventData);
        console.log('✅ Created production event:', eventData.description);
      }

      console.log('✅ Production events seeded');
    } catch (error) {
      console.warn('Could not create production events:', error);
    }
  }

  // Seed production losses
  private async seedProductionLosses(tenantId: string): Promise<void> {
    console.log('📉 Seeding production losses...');
    
    try {
      const plans = await masterDataService.getProductionPlans({ tenantId });
      const events = await masterDataService.getProductionEvents({ tenantId });
      
      if (plans.length === 0 || events.length === 0) {
        console.warn('No plans or events found, skipping production losses');
        return;
      }

      const losses = events.map(event => ({
        planId: plans[0]?.id,
        eventId: event.id,
        period: new Date(event.startTime).toISOString().split('T')[0],
        quantityLost: event.quantityLost || 0,
        costImpact: event.costImpact || 0,
        tenantId
      }));

      for (const lossData of losses) {
        await masterDataService.createProductionLoss(lossData);
      }

      console.log('✅ Production losses seeded');
    } catch (error) {
      console.warn('Could not create production losses:', error);
    }
  }

  // Seed OEE summaries
  private async seedOEESummaries(tenantId: string): Promise<void> {
    console.log('📊 Seeding OEE summaries...');
    
    try {
      const units = await masterDataService.getUnits();
      
      if (units.length === 0) {
        console.warn('No units found, skipping OEE summaries');
        return;
      }

      const summaries = units.map(unit => ({
        unitId: unit.id,
        period: new Date().toISOString().split('T')[0],
        availability: 85 + Math.random() * 10, // 85-95%
        performance: 78 + Math.random() * 15,  // 78-93%
        quality: 92 + Math.random() * 6,       // 92-98%
        oee: 0, // Will be calculated
        plannedProductionTime: 24 * 60, // 24 hours in minutes
        actualProductionTime: 0, // Will be calculated
        idealCycleTime: unit.idealCycleTime || 3.0,
        actualCycleTime: 0, // Will be calculated
        tenantId
      }));

      // Calculate derived values
      for (const summary of summaries) {
        summary.actualProductionTime = summary.plannedProductionTime * (summary.availability / 100);
        summary.actualCycleTime = summary.idealCycleTime * (100 / summary.performance);
        summary.oee = (summary.availability * summary.performance * summary.quality) / 10000;
        
        await masterDataService.createOEESummary(summary);
      }

      console.log('✅ OEE summaries seeded');
    } catch (error) {
      console.warn('Could not create OEE summaries:', error);
    }
  }

  // Seed RCA investigations
  private async seedRCAInvestigations(tenantId: string): Promise<void> {
    console.log('🔍 Seeding RCA investigations...');
    
    try {
      const events = await masterDataService.getProductionEvents({ tenantId });
      const templates = await masterDataService.getRCATemplates({ tenantId });

      if (events.length === 0) {
        console.warn('No production events found, skipping RCA investigations');
        return;
      }

      const equipmentTemplate = templates.find(t => t.name.includes('Equipment Failure'));
      const processTemplate = templates.find(t => t.name.includes('Process Deviation'));
      const qualityTemplate = templates.find(t => t.name.includes('Quality Issue'));

      const rcas = [
        {
          eventId: events[0]?.id,
          title: 'Pump A-001 Seal Failure Investigation',
          description: 'Comprehensive investigation into the seal failure of Pump A-001 that caused 3-hour production loss and $25,500 cost impact',
          status: 'In Progress' as const,
          teamLeadId: 'demo-user-1',
          teamMemberIds: ['demo-user-1', 'demo-user-2', 'demo-user-3'],
          priority: 'High' as const,
          targetCloseDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
          recommendations: [],
          evidence: [],
          templateId: equipmentTemplate?.id,
          teamCharter: 'Identify root cause of seal failure and implement preventive measures to reduce similar failures by 50%',
          tenantId
        },
        {
          eventId: events[1]?.id,
          title: 'Pump B-001 Motor Failure Analysis',
          description: 'Root cause analysis of motor failure in Pump B-001 during night shift',
          status: 'Analysis' as const,
          teamLeadId: 'demo-user-2',
          teamMemberIds: ['demo-user-2', 'demo-user-4'],
          priority: 'Critical' as const,
          targetCloseDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          recommendations: [],
          evidence: [],
          templateId: equipmentTemplate?.id,
          teamCharter: 'Prevent future motor failures through improved maintenance procedures and early warning systems',
          tenantId
        },
        {
          eventId: events[2]?.id,
          title: 'Assembly Robot C1 Quality Issue Investigation',
          description: 'Investigation into quality issues with Assembly Robot C1 causing high reject rates',
          status: 'Data Collection' as const,
          teamLeadId: 'demo-user-3',
          teamMemberIds: ['demo-user-3', 'demo-user-5'],
          priority: 'Medium' as const,
          targetCloseDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          recommendations: [],
          evidence: [],
          templateId: qualityTemplate?.id,
          teamCharter: 'Improve robot performance and reduce quality issues by 75%',
          tenantId
        }
      ].filter(rca => rca.eventId);

      for (const rcaData of rcas) {
        await masterDataService.createRCA(rcaData);
        console.log('✅ Created RCA investigation:', rcaData.title);
      }

      console.log('✅ RCA investigations seeded');
    } catch (error) {
      console.warn('Could not create RCA investigations:', error);
    }
  }

  // Seed dashboard data
  private async seedDashboardData(tenantId: string): Promise<void> {
    console.log('📊 Seeding dashboard data...');
    
    try {
      // Create dashboard configuration
      const dashboardConfig = {
        tenantId,
        widgets: [
          {
            id: 'production-overview',
            type: 'ProductionOverview',
            position: { x: 0, y: 0, w: 6, h: 4 },
            config: {
              showTrends: true,
              timeRange: '30d',
              units: ['all']
            }
          },
          {
            id: 'oee-summary',
            type: 'OEESummary',
            position: { x: 6, y: 0, w: 6, h: 4 },
            config: {
              showTargets: true,
              showTrends: true
            }
          },
          {
            id: 'recent-events',
            type: 'RecentEvents',
            position: { x: 0, y: 4, w: 8, h: 4 },
            config: {
              maxEvents: 10,
              showStatus: true
            }
          },
          {
            id: 'rca-status',
            type: 'RCAStatus',
            position: { x: 8, y: 4, w: 4, h: 4 },
            config: {
              showPriorities: true,
              showProgress: true
            }
          }
        ],
        layout: 'grid',
        theme: 'dark'
      };

      await masterDataService.createDashboardConfiguration(dashboardConfig);
      console.log('✅ Dashboard configuration seeded');
    } catch (error) {
      console.warn('Could not create dashboard configuration:', error);
    }
  }

  // Verify seeded data
  private async verifySeededData(tenantId: string): Promise<void> {
    console.log('🔍 Verifying seeded data...');
    
    try {
      const events = await masterDataService.getProductionEvents({ tenantId });
      const rcas = await masterDataService.getRCAs({ tenantId });
      const templates = await masterDataService.getRCATemplates({ tenantId });
      const units = await masterDataService.getUnits();
      const assets = await masterDataService.getAssets({ tenantId });
      const impactCodes = await masterDataService.getImpactCodes({ tenantId });
      const oeeCodes = await masterDataService.getOEECodes({ tenantId });
      const reasonCodes = await masterDataService.getReasonCodes({ tenantId });
      const products = await masterDataService.getProducts();
      const plans = await masterDataService.getProductionPlans({ tenantId });
      const planTemplates = await masterDataService.getProductionPlanTemplates({ tenantId });
      const losses = await masterDataService.getProductionLosses({ tenantId });
      const oeeSummaries = await masterDataService.getOEESummaries({ tenantId });

      console.log('📈 Data verification results:');
      console.log(`   - Production Events: ${events.length}`);
      console.log(`   - RCA Investigations: ${rcas.length}`);
      console.log(`   - RCA Templates: ${templates.length}`);
      console.log(`   - Production Units: ${units.length}`);
      console.log(`   - Assets: ${assets.length}`);
      console.log(`   - Impact Codes: ${impactCodes.length}`);
      console.log(`   - OEE Codes: ${oeeCodes.length}`);
      console.log(`   - Reason Codes: ${reasonCodes.length}`);
      console.log(`   - Products: ${products.length}`);
      console.log(`   - Production Plans: ${plans.length}`);
      console.log(`   - Production Plan Templates: ${planTemplates.length}`);
      console.log(`   - Production Losses: ${losses.length}`);
      console.log(`   - OEE Summaries: ${oeeSummaries.length}`);

      // Show sample data
      if (events.length > 0) {
        console.log('📋 Sample production event:', events[0].description);
      }
      if (rcas.length > 0) {
        console.log('📋 Sample RCA:', rcas[0].title);
      }
      if (units.length > 0) {
        console.log('📋 Sample unit:', units[0].name);
      }
      if (assets.length > 0) {
        console.log('📋 Sample asset:', assets[0].name);
      }

      console.log('✅ Data verification completed');
    } catch (error) {
      console.error('❌ Data verification failed:', error);
    }
  }

  // Clear all seeded data
  async clearSeededData(tenantId: string): Promise<void> {
    try {
      console.log('🧹 Clearing all seeded data...');
      
      // Clear in reverse order of dependencies
      const losses = await masterDataService.getProductionLosses({ tenantId });
      for (const loss of losses) {
        await masterDataService.deleteProductionLoss(loss.id);
      }

      const oeeSummaries = await masterDataService.getOEESummaries({ tenantId });
      for (const summary of oeeSummaries) {
        await masterDataService.deleteOEESummary(summary.id);
      }

      const events = await masterDataService.getProductionEvents({ tenantId });
      for (const event of events) {
        await masterDataService.deleteProductionEvent(event.id);
      }

      const rcas = await masterDataService.getRCAs({ tenantId });
      for (const rca of rcas) {
        await masterDataService.deleteRCA(rca.id);
      }

      const templates = await masterDataService.getRCATemplates({ tenantId });
      for (const template of templates) {
        await masterDataService.deleteRCATemplate(template.id);
      }

      const plans = await masterDataService.getProductionPlans({ tenantId });
      for (const plan of plans) {
        await masterDataService.deleteProductionPlan(plan.id);
      }

      const planTemplates = await masterDataService.getProductionPlanTemplates({ tenantId });
      for (const template of planTemplates) {
        await masterDataService.deleteProductionPlanTemplate(template.id);
      }

      const assets = await masterDataService.getAssets({ tenantId });
      for (const asset of assets) {
        await masterDataService.deleteAsset(asset.id);
      }

      const units = await masterDataService.getUnits();
      for (const unit of units) {
        await masterDataService.deleteUnit(unit.id);
      }

      const products = await masterDataService.getProducts();
      for (const product of products) {
        await masterDataService.deleteProduct(product.id);
      }

      this.isSeeded = false;
      console.log('✅ All seeded data cleared');
    } catch (error) {
      console.error('❌ Failed to clear seeded data:', error);
    }
  }

  // Reset data (clear and reseed)
  async resetSeededData(tenantId: string): Promise<void> {
    try {
      await this.clearSeededData(tenantId);
      await this.seedPresentationData(tenantId);
      console.log('✅ Seeded data reset successfully');
    } catch (error) {
      console.error('❌ Failed to reset seeded data:', error);
    }
  }
}

// Global instance
export const globalPresentationDataSeeder = PresentationDataSeeder.getInstance();
export default globalPresentationDataSeeder;
