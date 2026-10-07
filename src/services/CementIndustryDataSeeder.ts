// Cement Industry Specific Data Seeder
import { masterDataService } from './MasterDataService';

export class CementIndustryDataSeeder {
  private isSeeded = false;
  private currentTenantId: string | null = null;

  async seedCementIndustryData(tenantId: string): Promise<void> {
    if (this.isSeeded) {
      console.log('🏭 Cement industry data already seeded');
      return;
    }

    try {
      console.log('🏭 Starting cement industry data seeding...');
      console.log('📋 Target tenant ID:', tenantId);
      
      // Clear existing cement industry data first
      await this.clearExistingCementIndustryData(tenantId);
      
      // Seed in order of dependencies (following master data hierarchy)
      await this.seedCementOrganizationsAndTenants(tenantId);
      await this.seedCementMasterDataCodes(tenantId);  // Impact codes, OEE codes, Reason codes
      await this.seedCementUnits(tenantId);            // Production units
      // Assets are seeded within seedCementUnits method
      await this.seedCementProducts();                 // Products
      await this.seedCementProductionPlans(tenantId);  // Production plans (depends on units & products)
      await this.seedCementProductionEvents(tenantId); // Production events (depends on units, assets, codes)
      await this.seedCementRCAEvents(tenantId); // Additional events specifically for RCA investigations
      await this.seedCementRCATemplates(tenantId);     // RCA templates
      await this.seedCementRCAInvestigations(tenantId); // RCA investigations (depends on events)
      await this.seedCementProductionLosses(tenantId); // Production losses (depends on events)
      await this.seedCementOEESummaries(tenantId);     // OEE summaries (depends on events)
      await this.seedCementDashboardData(tenantId);    // Dashboard data (depends on all above)
      
      this.isSeeded = true;
      console.log('✅ Cement industry data seeded successfully!');
      
      // Verify data consistency
      await this.verifyDataConsistency(tenantId);
      
      // Verify data
      await this.verifyCementIndustryData(tenantId);
      
      // Auto-select first unit for plant selector
      await this.autoSelectFirstUnit(tenantId);
      
    } catch (error) {
      console.error('❌ Failed to seed cement industry data:', error);
      throw error;
    }
  }


  // Seed cement industry organizations and tenants
  private async seedCementOrganizationsAndTenants(targetTenantId: string): Promise<void> {
    console.log('🏢 Seeding cement industry organizations and tenants...');
    
    try {
      // Check if Hillal organization already exists
      const existingOrgs = await masterDataService.getOrganizations();
      let hillalOrg = existingOrgs.find(org => org.name === 'Hillal');
      
      if (!hillalOrg) {
        // Create Hillal organization
        const newHillalOrg = {
          name: 'Hillal',
          code: 'HILLAL',
          description: 'Leading cement manufacturing company with multiple plants',
          isActive: true
        };
        hillalOrg = await masterDataService.createOrganization(newHillalOrg);
        console.log('✅ Created organization:', hillalOrg.name);
      } else {
        console.log('✅ Using existing organization:', hillalOrg.name);
      }

      // Check if the target tenant ID already exists
      const existingTenants = await masterDataService.getTenants();
      let margoonTenant = existingTenants.find(tenant => tenant.id === targetTenantId);
      
      if (!margoonTenant) {
        // Check if any Margoon Cement tenant exists
        margoonTenant = existingTenants.find(tenant => tenant.name === 'Margoon Cement');
        
        if (!margoonTenant) {
          // Create Margoon Cement plant with the target tenant ID
          const newMargoonTenant = {
            id: targetTenantId, // Use the provided tenant ID
            name: 'Margoon Cement',
            code: 'MARGOON_CEMENT',
            description: 'Margoon Cement Plant - Primary cement manufacturing facility',
            organizationId: hillalOrg.id,
            isActive: true,
            address: 'Margoon Industrial Area, Cement City, CC 12345',
            contactPerson: 'Ahmed Al-Margoon',
            contactEmail: 'ahmed.margoon@hillal.com',
            contactPhone: '+966-11-234-5678'
          };
          margoonTenant = await masterDataService.createTenant(newMargoonTenant);
          console.log('✅ Created tenant with target ID:', margoonTenant.name, margoonTenant.id);
        } else {
          console.log('✅ Using existing Margoon Cement tenant:', margoonTenant.name, margoonTenant.id);
        }
      } else {
        console.log('✅ Using existing tenant with target ID:', margoonTenant.name, margoonTenant.id);
      }

      // Store the tenant ID for later use
      this.currentTenantId = margoonTenant.id;

    } catch (error) {
      console.warn('Could not create cement industry organizations and tenants:', error);
    }
  }

  // Seed cement industry master data codes
  private async seedCementMasterDataCodes(tenantId: string): Promise<void> {
    console.log('📋 Seeding comprehensive cement industry master data codes...');
    
    try {
      // ===== IMPACT CODES FOR CEMENT INDUSTRY =====
      const impactCodes = [
        // Availability Impact Codes
        { code: 'IC-A001', name: 'Equipment Breakdown', description: 'Unplanned equipment failure causing production stoppage', category: 'Availability' as const, costPerHour: 12000, costBasis: 'perHour' as const, tenantId },
        { code: 'IC-A002', name: 'Preventive Maintenance', description: 'Scheduled preventive maintenance downtime', category: 'Availability' as const, costPerHour: 5000, costBasis: 'perHour' as const, tenantId },
        { code: 'IC-A003', name: 'Material Shortage', description: 'Raw material unavailability causing stoppage', category: 'Availability' as const, costPerHour: 10000, costBasis: 'perHour' as const, tenantId },
        { code: 'IC-A004', name: 'Power Outage', description: 'Electrical power supply interruption', category: 'Availability' as const, costPerHour: 15000, costBasis: 'perHour' as const, tenantId },
        { code: 'IC-A005', name: 'Process Shutdown', description: 'Emergency or unplanned process shutdown', category: 'Availability' as const, costPerHour: 18000, costBasis: 'perHour' as const, tenantId },
        { code: 'IC-A006', name: 'Refractory Repair', description: 'Kiln or cooler refractory maintenance', category: 'Availability' as const, costPerHour: 20000, costBasis: 'perHour' as const, tenantId },
        { code: 'IC-A007', name: 'Safety Stop', description: 'Safety-related production stoppage', category: 'Availability' as const, costPerHour: 8000, costBasis: 'perHour' as const, tenantId },
        
        // Performance Impact Codes
        { code: 'IC-P001', name: 'Reduced Speed Operation', description: 'Equipment operating below design capacity', category: 'Performance' as const, costPerHour: 6000, costBasis: 'perHour' as const, tenantId },
        { code: 'IC-P002', name: 'Feed Rate Limitation', description: 'Reduced feed rate due to process constraints', category: 'Performance' as const, costPerHour: 7000, costBasis: 'perHour' as const, tenantId },
        { code: 'IC-P003', name: 'Equipment Wear', description: 'Performance loss due to equipment wear', category: 'Performance' as const, costPerHour: 5500, costBasis: 'perHour' as const, tenantId },
        { code: 'IC-P004', name: 'Startup Losses', description: 'Production losses during startup phase', category: 'Performance' as const, costPerHour: 4500, costBasis: 'perHour' as const, tenantId },
        { code: 'IC-P005', name: 'Minor Stops', description: 'Frequent short duration stoppages', category: 'Performance' as const, costPerHour: 3500, costBasis: 'perHour' as const, tenantId },
        { code: 'IC-P006', name: 'Product Changeover', description: 'Time lost during product changeover', category: 'Performance' as const, costPerHour: 4000, costBasis: 'perHour' as const, tenantId },
        
        // Quality Impact Codes
        { code: 'IC-Q001', name: 'Off-Spec Product', description: 'Product not meeting quality specifications', category: 'Quality' as const, costPerUnit: 80, costBasis: 'perUnit' as const, tenantId },
        { code: 'IC-Q002', name: 'Chemical Composition Deviation', description: 'Cement chemical composition out of specification', category: 'Quality' as const, costPerUnit: 95, costBasis: 'perUnit' as const, tenantId },
        { code: 'IC-Q003', name: 'Physical Property Deviation', description: 'Cement physical properties out of specification', category: 'Quality' as const, costPerUnit: 75, costBasis: 'perUnit' as const, tenantId },
        { code: 'IC-Q004', name: 'Grinding Quality Issue', description: 'Fineness or particle size distribution issues', category: 'Quality' as const, costPerUnit: 65, costBasis: 'perUnit' as const, tenantId },
        { code: 'IC-Q005', name: 'Clinker Quality Issue', description: 'Clinker quality defects', category: 'Quality' as const, costPerUnit: 85, costBasis: 'perUnit' as const, tenantId },
        { code: 'IC-Q006', name: 'Contamination', description: 'Product contamination requiring rework', category: 'Quality' as const, costPerUnit: 100, costBasis: 'perUnit' as const, tenantId }
      ];

      for (const code of impactCodes) {
        await masterDataService.createImpactCode(code);
      }
      console.log(`✅ Created ${impactCodes.length} Impact Codes`);

      // ===== OEE CODES FOR CEMENT INDUSTRY =====
      const oeeCodes = [
        // Planned Availability
        { code: 'OEE-PA001', name: 'Planned Maintenance', description: 'Scheduled preventive maintenance activities', category: 'Planned' as const, impactType: 'Availability' as const, tenantId },
        { code: 'OEE-PA002', name: 'Planned Shutdown', description: 'Scheduled production shutdown', category: 'Planned' as const, impactType: 'Availability' as const, tenantId },
        { code: 'OEE-PA003', name: 'Plant Turnaround', description: 'Major planned turnaround activities', category: 'Planned' as const, impactType: 'Availability' as const, tenantId },
        { code: 'OEE-PA004', name: 'Refractory Replacement', description: 'Planned refractory lining replacement', category: 'Planned' as const, impactType: 'Availability' as const, tenantId },
        { code: 'OEE-PA005', name: 'No Production Scheduled', description: 'Planned non-production period', category: 'Planned' as const, impactType: 'Availability' as const, tenantId },
        
        // Unplanned Availability
        { code: 'OEE-UA001', name: 'Equipment Breakdown', description: 'Unexpected equipment failure', category: 'Unplanned' as const, impactType: 'Availability' as const, tenantId },
        { code: 'OEE-UA002', name: 'Power Failure', description: 'Electrical power supply interruption', category: 'Unplanned' as const, impactType: 'Availability' as const, tenantId },
        { code: 'OEE-UA003', name: 'Material Unavailability', description: 'Raw material shortage or unavailability', category: 'Unplanned' as const, impactType: 'Availability' as const, tenantId },
        { code: 'OEE-UA004', name: 'Process Trip', description: 'Unplanned process shutdown or trip', category: 'Unplanned' as const, impactType: 'Availability' as const, tenantId },
        { code: 'OEE-UA005', name: 'Safety Stop', description: 'Safety-related unplanned stoppage', category: 'Unplanned' as const, impactType: 'Availability' as const, tenantId },
        { code: 'OEE-UA006', name: 'Emergency Maintenance', description: 'Unscheduled emergency maintenance', category: 'Unplanned' as const, impactType: 'Availability' as const, tenantId },
        
        // Planned Performance
        { code: 'OEE-PP001', name: 'Planned Rate Reduction', description: 'Scheduled production rate reduction', category: 'Planned' as const, impactType: 'Performance' as const, tenantId },
        { code: 'OEE-PP002', name: 'Changeover Time', description: 'Product changeover activities', category: 'Planned' as const, impactType: 'Performance' as const, tenantId },
        { code: 'OEE-PP003', name: 'Startup/Shutdown', description: 'Planned startup and shutdown activities', category: 'Planned' as const, impactType: 'Performance' as const, tenantId },
        { code: 'OEE-PP004', name: 'Trial Run', description: 'Planned trial or test run', category: 'Planned' as const, impactType: 'Performance' as const, tenantId },
        
        // Unplanned Performance
        { code: 'OEE-UP001', name: 'Speed Loss', description: 'Equipment running below optimal speed', category: 'Unplanned' as const, impactType: 'Performance' as const, tenantId },
        { code: 'OEE-UP002', name: 'Minor Stops', description: 'Frequent short duration stops', category: 'Unplanned' as const, impactType: 'Performance' as const, tenantId },
        { code: 'OEE-UP003', name: 'Equipment Wear', description: 'Performance loss due to wear', category: 'Unplanned' as const, impactType: 'Performance' as const, tenantId },
        { code: 'OEE-UP004', name: 'Feed Restriction', description: 'Feed rate limitation due to process issues', category: 'Unplanned' as const, impactType: 'Performance' as const, tenantId },
        { code: 'OEE-UP005', name: 'Operator Inefficiency', description: 'Performance loss due to operator actions', category: 'Unplanned' as const, impactType: 'Performance' as const, tenantId },
        
        // Quality (Unplanned)
        { code: 'OEE-Q001', name: 'Startup Rejects', description: 'Quality rejects during startup', category: 'Unplanned' as const, impactType: 'Quality' as const, tenantId },
        { code: 'OEE-Q002', name: 'Production Rejects', description: 'Quality rejects during normal production', category: 'Unplanned' as const, impactType: 'Quality' as const, tenantId },
        { code: 'OEE-Q003', name: 'Rework Required', description: 'Products requiring rework', category: 'Unplanned' as const, impactType: 'Quality' as const, tenantId },
        { code: 'OEE-Q004', name: 'Off-Spec Material', description: 'Material not meeting quality specs', category: 'Unplanned' as const, impactType: 'Quality' as const, tenantId },
        { code: 'OEE-Q005', name: 'Process Deviation', description: 'Quality loss due to process deviation', category: 'Unplanned' as const, impactType: 'Quality' as const, tenantId }
      ];

      for (const code of oeeCodes) {
        await masterDataService.createOEECode(code);
      }
      console.log(`✅ Created ${oeeCodes.length} OEE Codes`);

      // ===== REASON CODES FOR CEMENT INDUSTRY (HIERARCHICAL) =====
      const reasonCodes = [
        // ========== TOP LEVEL (No Parent) ==========
        { code: '100', name: 'Equipment Failure', description: 'Equipment-related failures and breakdowns', parentId: undefined, tenantId },
        { code: '200', name: 'Process Issues', description: 'Process-related problems and upsets', parentId: undefined, tenantId },
        { code: '300', name: 'Material Issues', description: 'Raw material and fuel-related issues', parentId: undefined, tenantId },
        { code: '400', name: 'Personnel Issues', description: 'Human resource and operator-related issues', parentId: undefined, tenantId },
        { code: '500', name: 'Utilities & Services', description: 'Utilities and support services issues', parentId: undefined, tenantId },
        { code: '600', name: 'Quality Issues', description: 'Product quality-related problems', parentId: undefined, tenantId },
        
        // ========== EQUIPMENT FAILURE (100) - LEVEL 2 ==========
        { code: '110', name: 'Mechanical Failure', description: 'Mechanical component failures', parentId: '100', tenantId },
        { code: '120', name: 'Electrical Failure', description: 'Electrical system failures', parentId: '100', tenantId },
        { code: '130', name: 'Instrumentation Failure', description: 'Instrumentation and control failures', parentId: '100', tenantId },
        { code: '140', name: 'Refractory Failure', description: 'Refractory lining failures', parentId: '100', tenantId },
        { code: '150', name: 'Structural Failure', description: 'Structural integrity issues', parentId: '100', tenantId },
        
        // Mechanical Failure (110) - LEVEL 3
        { code: '111', name: 'Bearing Failure', description: 'Bearing-related failures', parentId: '110', tenantId },
        { code: '112', name: 'Gearbox Failure', description: 'Gearbox and transmission failures', parentId: '110', tenantId },
        { code: '113', name: 'Pump Failure', description: 'Pump breakdowns and failures', parentId: '110', tenantId },
        { code: '114', name: 'Fan Failure', description: 'Fan and blower failures', parentId: '110', tenantId },
        { code: '115', name: 'Seal Failure', description: 'Seal and gasket failures', parentId: '110', tenantId },
        { code: '116', name: 'Coupling Failure', description: 'Coupling and alignment issues', parentId: '110', tenantId },
        { code: '117', name: 'Belt/Chain Failure', description: 'Belt and chain drive failures', parentId: '110', tenantId },
        { code: '118', name: 'Conveyor Failure', description: 'Conveyor system failures', parentId: '110', tenantId },
        { code: '119', name: 'Crusher Failure', description: 'Crusher mechanical failures', parentId: '110', tenantId },
        
        // Electrical Failure (120) - LEVEL 3
        { code: '121', name: 'Motor Failure', description: 'Electric motor failures', parentId: '120', tenantId },
        { code: '122', name: 'Transformer Failure', description: 'Transformer failures', parentId: '120', tenantId },
        { code: '123', name: 'Switchgear Failure', description: 'Switchgear and breaker failures', parentId: '120', tenantId },
        { code: '124', name: 'Wiring Issue', description: 'Electrical wiring problems', parentId: '120', tenantId },
        { code: '125', name: 'Control Panel Issue', description: 'Control panel and MCC issues', parentId: '120', tenantId },
        { code: '126', name: 'VFD Failure', description: 'Variable frequency drive failures', parentId: '120', tenantId },
        
        // Instrumentation Failure (130) - LEVEL 3
        { code: '131', name: 'Sensor Failure', description: 'Temperature, pressure, level sensor failures', parentId: '130', tenantId },
        { code: '132', name: 'Analyzer Failure', description: 'Online analyzer failures', parentId: '130', tenantId },
        { code: '133', name: 'Control Valve Failure', description: 'Control valve failures', parentId: '130', tenantId },
        { code: '134', name: 'Transmitter Failure', description: 'Signal transmitter failures', parentId: '130', tenantId },
        { code: '135', name: 'PLC/DCS Issue', description: 'PLC or DCS system issues', parentId: '130', tenantId },
        
        // Refractory Failure (140) - LEVEL 3
        { code: '141', name: 'Kiln Refractory', description: 'Rotary kiln refractory damage', parentId: '140', tenantId },
        { code: '142', name: 'Cooler Refractory', description: 'Clinker cooler refractory damage', parentId: '140', tenantId },
        { code: '143', name: 'Preheater Refractory', description: 'Preheater refractory damage', parentId: '140', tenantId },
        { code: '144', name: 'Calciner Refractory', description: 'Calciner refractory damage', parentId: '140', tenantId },
        
        // ========== PROCESS ISSUES (200) - LEVEL 2 ==========
        { code: '210', name: 'Process Upset', description: 'Process parameter deviations', parentId: '200', tenantId },
        { code: '220', name: 'Temperature Control', description: 'Temperature control issues', parentId: '200', tenantId },
        { code: '230', name: 'Feed Issues', description: 'Feed rate and composition issues', parentId: '200', tenantId },
        { code: '240', name: 'Coating/Ring Formation', description: 'Coating or ring formation in kiln', parentId: '200', tenantId },
        { code: '250', name: 'Blockage', description: 'Process equipment blockages', parentId: '200', tenantId },
        
        // Process Upset (210) - LEVEL 3
        { code: '211', name: 'Kiln Process Upset', description: 'Rotary kiln process instability', parentId: '210', tenantId },
        { code: '212', name: 'Preheater Upset', description: 'Preheater process instability', parentId: '210', tenantId },
        { code: '213', name: 'Mill Process Upset', description: 'Grinding mill process issues', parentId: '210', tenantId },
        { code: '214', name: 'Burning Zone Issues', description: 'Kiln burning zone problems', parentId: '210', tenantId },
        
        // ========== MATERIAL ISSUES (300) - LEVEL 2 ==========
        { code: '310', name: 'Raw Material Issues', description: 'Raw material-related problems', parentId: '300', tenantId },
        { code: '320', name: 'Fuel Issues', description: 'Fuel-related problems', parentId: '300', tenantId },
        { code: '330', name: 'Additive Issues', description: 'Cement additive problems', parentId: '300', tenantId },
        
        // Raw Material Issues (310) - LEVEL 3
        { code: '311', name: 'Limestone Quality', description: 'Limestone quality variation', parentId: '310', tenantId },
        { code: '312', name: 'Clay Quality', description: 'Clay or shale quality issues', parentId: '310', tenantId },
        { code: '313', name: 'Iron Ore Quality', description: 'Iron ore quality variation', parentId: '310', tenantId },
        { code: '314', name: 'Gypsum Quality', description: 'Gypsum quality issues', parentId: '310', tenantId },
        { code: '315', name: 'Material Shortage', description: 'Raw material unavailability', parentId: '310', tenantId },
        { code: '316', name: 'Material Delay', description: 'Material delivery delays', parentId: '310', tenantId },
        
        // Fuel Issues (320) - LEVEL 3
        { code: '321', name: 'Coal Quality', description: 'Coal quality variation', parentId: '320', tenantId },
        { code: '322', name: 'Petcoke Quality', description: 'Petroleum coke quality issues', parentId: '320', tenantId },
        { code: '323', name: 'Alternative Fuel Issues', description: 'Alternative fuel quality problems', parentId: '320', tenantId },
        { code: '324', name: 'Fuel Shortage', description: 'Fuel unavailability', parentId: '320', tenantId },
        
        // ========== PERSONNEL ISSUES (400) - LEVEL 2 ==========
        { code: '410', name: 'Operator Error', description: 'Operator mistakes or errors', parentId: '400', tenantId },
        { code: '420', name: 'Insufficient Manpower', description: 'Lack of adequate staff', parentId: '400', tenantId },
        { code: '430', name: 'Training Gap', description: 'Inadequate training or skills', parentId: '400', tenantId },
        { code: '440', name: 'Communication Gap', description: 'Communication breakdowns', parentId: '400', tenantId },
        
        // ========== UTILITIES & SERVICES (500) - LEVEL 2 ==========
        { code: '510', name: 'Power Supply', description: 'Electrical power supply issues', parentId: '500', tenantId },
        { code: '520', name: 'Compressed Air', description: 'Compressed air system issues', parentId: '500', tenantId },
        { code: '530', name: 'Water Supply', description: 'Water supply issues', parentId: '500', tenantId },
        { code: '540', name: 'Cooling System', description: 'Cooling system problems', parentId: '500', tenantId },
        
        // ========== QUALITY ISSUES (600) - LEVEL 2 ==========
        { code: '610', name: 'Chemical Composition', description: 'Cement chemical composition deviation', parentId: '600', tenantId },
        { code: '620', name: 'Physical Properties', description: 'Physical property deviations', parentId: '600', tenantId },
        { code: '630', name: 'Fineness Issue', description: 'Cement fineness problems', parentId: '600', tenantId },
        { code: '640', name: 'Setting Time Issue', description: 'Setting time deviations', parentId: '600', tenantId },
        { code: '650', name: 'Strength Issue', description: 'Compressive strength problems', parentId: '600', tenantId }
      ];

      for (const code of reasonCodes) {
        await masterDataService.createReasonCode(code);
      }
      console.log(`✅ Created ${reasonCodes.length} Reason Codes (Hierarchical)`);

      // ===== RCA CAUSE CODES FOR CEMENT INDUSTRY =====
      const rcaCauseCodes = [
        // Equipment Category
        { code: 'RCA-EQ001', name: 'Poor Maintenance', description: 'Inadequate or poor maintenance practices', category: 'Equipment' as const, tenantId },
        { code: 'RCA-EQ002', name: 'Equipment Age', description: 'Old or outdated equipment', category: 'Equipment' as const, tenantId },
        { code: 'RCA-EQ003', name: 'Design Flaw', description: 'Equipment design inadequacy', category: 'Equipment' as const, tenantId },
        { code: 'RCA-EQ004', name: 'Wrong Specification', description: 'Equipment not suitable for application', category: 'Equipment' as const, tenantId },
        { code: 'RCA-EQ005', name: 'Wear and Tear', description: 'Normal wear exceeding limits', category: 'Equipment' as const, tenantId },
        { code: 'RCA-EQ006', name: 'Corrosion', description: 'Equipment corrosion damage', category: 'Equipment' as const, tenantId },
        
        // Process Category
        { code: 'RCA-PR001', name: 'Process Design Issue', description: 'Process design inadequacy', category: 'Process' as const, tenantId },
        { code: 'RCA-PR002', name: 'Operating Outside Limits', description: 'Operating beyond design parameters', category: 'Process' as const, tenantId },
        { code: 'RCA-PR003', name: 'Inadequate Process Control', description: 'Poor process control strategy', category: 'Process' as const, tenantId },
        { code: 'RCA-PR004', name: 'Process Optimization Needed', description: 'Process not optimized', category: 'Process' as const, tenantId },
        { code: 'RCA-PR005', name: 'Wrong Operating Procedure', description: 'Incorrect operating procedures', category: 'Process' as const, tenantId },
        
        // Material Category
        { code: 'RCA-MT001', name: 'Poor Material Quality', description: 'Substandard raw material quality', category: 'Material' as const, tenantId },
        { code: 'RCA-MT002', name: 'Material Contamination', description: 'Material contamination issues', category: 'Material' as const, tenantId },
        { code: 'RCA-MT003', name: 'Wrong Material Spec', description: 'Material not meeting specifications', category: 'Material' as const, tenantId },
        { code: 'RCA-MT004', name: 'Inconsistent Supply', description: 'Material quality inconsistency', category: 'Material' as const, tenantId },
        { code: 'RCA-MT005', name: 'Supplier Issue', description: 'Raw material supplier problems', category: 'Material' as const, tenantId },
        
        // Personnel Category
        { code: 'RCA-PE001', name: 'Lack of Training', description: 'Insufficient operator training', category: 'Personnel' as const, tenantId },
        { code: 'RCA-PE002', name: 'Procedure Not Followed', description: 'Failure to follow procedures', category: 'Personnel' as const, tenantId },
        { code: 'RCA-PE003', name: 'Human Error', description: 'Operator mistake or error', category: 'Personnel' as const, tenantId },
        { code: 'RCA-PE004', name: 'Fatigue', description: 'Operator fatigue affecting performance', category: 'Personnel' as const, tenantId },
        { code: 'RCA-PE005', name: 'Inadequate Supervision', description: 'Lack of proper supervision', category: 'Personnel' as const, tenantId },
        
        // Environment Category
        { code: 'RCA-EN001', name: 'Temperature Extremes', description: 'Extreme ambient temperature effects', category: 'Environment' as const, tenantId },
        { code: 'RCA-EN002', name: 'Humidity Effects', description: 'High humidity affecting operations', category: 'Environment' as const, tenantId },
        { code: 'RCA-EN003', name: 'Dust Accumulation', description: 'Excessive dust affecting equipment', category: 'Environment' as const, tenantId },
        { code: 'RCA-EN004', name: 'Weather Conditions', description: 'Adverse weather affecting operations', category: 'Environment' as const, tenantId },
        
        // Method Category
        { code: 'RCA-ME001', name: 'Inadequate Procedure', description: 'Operating procedure inadequacy', category: 'Method' as const, tenantId },
        { code: 'RCA-ME002', name: 'Procedure Not Updated', description: 'Outdated procedures', category: 'Method' as const, tenantId },
        { code: 'RCA-ME003', name: 'Wrong Method Used', description: 'Incorrect method or approach', category: 'Method' as const, tenantId },
        { code: 'RCA-ME004', name: 'Inspection Gap', description: 'Inadequate inspection methods', category: 'Method' as const, tenantId },
        { code: 'RCA-ME005', name: 'Poor Communication', description: 'Communication method inadequacy', category: 'Method' as const, tenantId }
      ];

      for (const code of rcaCauseCodes) {
        await masterDataService.createRCACauseCode(code);
      }
      console.log(`✅ Created ${rcaCauseCodes.length} RCA Cause Codes`);

      // ===== VERIFICATION STATUS CODES FOR CEMENT INDUSTRY =====
      const verificationStatusCodes = [
        { 
          code: 'VS-001', 
          name: 'Not Started', 
          description: 'Verification not yet started', 
          color: '#9CA3AF',
          tenantId,
          items: []
        },
        { 
          code: 'VS-002', 
          name: 'In Progress', 
          description: 'Verification activities ongoing', 
          color: '#3B82F6',
          tenantId,
          items: ['Initial review completed', 'Data collection ongoing', 'Stakeholder interviews scheduled']
        },
        { 
          code: 'VS-003', 
          name: 'Pending Review', 
          description: 'Awaiting management review', 
          color: '#F59E0B',
          tenantId,
          items: ['Documentation complete', 'Evidence collected', 'Awaiting supervisor approval']
        },
        { 
          code: 'VS-004', 
          name: 'Verified', 
          description: 'Successfully verified and approved', 
          color: '#10B981',
          tenantId,
          items: ['All checks completed', 'Root cause confirmed', 'Corrective actions defined']
        },
        { 
          code: 'VS-005', 
          name: 'Rejected', 
          description: 'Verification rejected - needs rework', 
          color: '#EF4444',
          tenantId,
          items: ['Insufficient evidence', 'Further investigation needed', 'Additional data required']
        },
        { 
          code: 'VS-006', 
          name: 'Closed', 
          description: 'Verification closed and archived', 
          color: '#6B7280',
          tenantId,
          items: ['Actions implemented', 'Effectiveness verified', 'Documentation archived']
        }
      ];

      for (const code of verificationStatusCodes) {
        await masterDataService.createVerificationStatusCode(code);
      }
      console.log(`✅ Created ${verificationStatusCodes.length} Verification Status Codes`);

      console.log('✅ Cement industry master data codes seeded successfully!');
      console.log(`   📊 Total codes created: ${impactCodes.length + oeeCodes.length + reasonCodes.length + rcaCauseCodes.length + verificationStatusCodes.length}`);
    } catch (error) {
      console.warn('Could not create cement industry master data codes:', error);
    }
  }

  // Verify data consistency between master data and production events
  private async verifyDataConsistency(tenantId: string): Promise<void> {
    console.log('🔍 Verifying data consistency...');
    
    try {
      const units = await masterDataService.getUnits();
      const assets = await masterDataService.getAssets({ tenantId });
      const events = await masterDataService.getProductionEvents({ tenantId });
      const impactCodes = await masterDataService.getImpactCodes({ tenantId });
      const oeeCodes = await masterDataService.getOEECodes({ tenantId });

      let inconsistencies = 0;

      // Check unit references in events
      const eventUnitIds = events.map(e => e.unitId).filter(id => id);
      const validUnitIds = units.map(u => u.id);
      const invalidUnitReferences = eventUnitIds.filter(id => !validUnitIds.includes(id));
      
      if (invalidUnitReferences.length > 0) {
        console.error('❌ Events with invalid unit references:', invalidUnitReferences);
        inconsistencies += invalidUnitReferences.length;
      }

      // Check asset references in events
      const eventAssetIds = events.map(e => e.assetId).filter(id => id);
      const validAssetIds = assets.map(a => a.id);
      const invalidAssetReferences = eventAssetIds.filter(id => !validAssetIds.includes(id));
      
      if (invalidAssetReferences.length > 0) {
        console.error('❌ Events with invalid asset references:', invalidAssetReferences);
        inconsistencies += invalidAssetReferences.length;
      }

      // Check impact code references in events
      const eventImpactCodeIds = events.map(e => e.impactCodeId).filter(id => id);
      const validImpactCodeIds = impactCodes.map(ic => ic.id);
      const invalidImpactCodeReferences = eventImpactCodeIds.filter(id => !validImpactCodeIds.includes(id));
      
      if (invalidImpactCodeReferences.length > 0) {
        console.error('❌ Events with invalid impact code references:', invalidImpactCodeReferences);
        inconsistencies += invalidImpactCodeReferences.length;
      }

      // Check OEE code references in events
      const eventOEECodeIds = events.map(e => e.oeeCodeId).filter(id => id);
      const validOEECodeIds = oeeCodes.map(oc => oc.id);
      const invalidOEECodeReferences = eventOEECodeIds.filter(id => !validOEECodeIds.includes(id));
      
      if (invalidOEECodeReferences.length > 0) {
        console.error('❌ Events with invalid OEE code references:', invalidOEECodeReferences);
        inconsistencies += invalidOEECodeReferences.length;
      }

      if (inconsistencies === 0) {
        console.log('✅ Data consistency verification passed - all references are valid');
      } else {
        console.error(`❌ Found ${inconsistencies} data consistency issues`);
      }

      // Summary statistics
      console.log('📊 Data Summary:', {
        units: units.length,
        assets: assets.length,
        events: events.length,
        impactCodes: impactCodes.length,
        oeeCodes: oeeCodes.length
      });

    } catch (error) {
      console.error('❌ Error during data consistency verification:', error);
    }
  }

  // Seed cement industry units
  private async seedCementUnits(tenantId: string): Promise<void> {
    console.log('🏭 Seeding cement industry units...');
    
    // Get the tenant to use its ID properly
    const tenants = await masterDataService.getTenants();
    const margoonTenant = tenants.find(t => t.name === 'Margoon Cement');
    const actualTenantId = margoonTenant?.id || tenantId;
    
    console.log(`Using tenant ID: ${actualTenantId} for units`);
    
    const units = [
      {
        name: 'Raw Mill Unit - RM-1',
        code: 'RM-1',
        description: 'Primary raw material grinding and preparation unit',
        capacity: 300,
        unitOfMeasure: 'TPH (Tons Per Hour)',
        idealCycleTime: 0.2,
        tenantId: actualTenantId
      },
      {
        name: 'Kiln Unit - K-1',
        code: 'K-1',
        description: 'Rotary kiln for clinker production',
        capacity: 5000,
        unitOfMeasure: 'TPD (Tons Per Day)',
        idealCycleTime: 1.0,
        tenantId: actualTenantId
      },
      {
        name: 'Cement Mill Unit - CM-1',
        code: 'CM-1',
        description: 'Finish grinding mill for cement production',
        capacity: 200,
        unitOfMeasure: 'TPH (Tons Per Hour)',
        idealCycleTime: 0.3,
        tenantId: actualTenantId
      },
      {
        name: 'Packaging Unit - PK-1',
        code: 'PK-1',
        description: 'Cement packaging and bagging facility',
        capacity: 150,
        unitOfMeasure: 'TPH (Tons Per Hour)',
        idealCycleTime: 0.4,
        tenantId: actualTenantId
      },
      {
        name: 'Quality Control Lab - QC-1',
        code: 'QC-1',
        description: 'Cement quality testing and analysis laboratory',
        capacity: 50,
        unitOfMeasure: 'samples/hour',
        idealCycleTime: 1.2,
        tenantId: actualTenantId
      },
      {
        name: 'Coal Mill Unit - CM-2',
        code: 'CM-2',
        description: 'Coal grinding mill for kiln fuel preparation',
        capacity: 50,
        unitOfMeasure: 'TPH (Tons Per Hour)',
        idealCycleTime: 1.2,
        tenantId: actualTenantId
      },
      {
        name: 'Crusher Unit - CR-1',
        code: 'CR-1',
        description: 'Primary limestone crusher for raw material preparation',
        capacity: 800,
        unitOfMeasure: 'TPH (Tons Per Hour)',
        idealCycleTime: 0.075,
        tenantId: actualTenantId
      },
      {
        name: 'Preheater Unit - PH-1',
        code: 'PH-1',
        description: 'Cyclone preheater for kiln feed preheating',
        capacity: 5000,
        unitOfMeasure: 'TPD (Tons Per Day)',
        idealCycleTime: 1.0,
        tenantId: actualTenantId
      }
    ];

    const createdUnits = [];
    for (const unitData of units) {
      const unit = await masterDataService.createUnit(unitData);
      createdUnits.push(unit);
    }

    // Create cement industry assets
    await this.seedCementAssets(tenantId, createdUnits);
    
    console.log('✅ Cement industry units seeded');
  }

  // Seed cement industry assets
  private async seedCementAssets(tenantId: string, units: any[]): Promise<void> {
    console.log('🔧 Seeding comprehensive cement industry assets...');
    
    const assets = [
      // ========== RAW MILL UNIT ASSETS ==========
      {
        name: 'Raw Mill Ball Mill - RM-1-BM',
        code: 'RM-1-BM',
        unitId: units.find(u => u.name.includes('Raw Mill'))?.id,
        description: 'Primary vertical roller mill for raw material grinding - 300 TPH capacity with four grinding rollers',
        assetType: 'Equipment' as const,
        criticality: 'High' as const,
        manufacturer: 'FLSmidth',
        model: 'ATOX-50',
        serialNumber: 'VRM-2024-001',
        status: 'Active' as const,
        tenantId
      },
      {
        name: 'Raw Mill Separator - RM-1-SEP',
        code: 'RM-1-SEP',
        unitId: units.find(u => u.name.includes('Raw Mill'))?.id,
        description: 'High-efficiency dynamic separator for raw mill product classification with variable speed control',
        assetType: 'Equipment' as const,
        criticality: 'High' as const,
        manufacturer: 'FLSmidth',
        model: 'SEPAX-425',
        serialNumber: 'SEP-2024-001',
        status: 'Active' as const,
        tenantId
      },
      {
        name: 'Raw Mill Fan - RM-1-FAN',
        code: 'RM-1-FAN',
        unitId: units.find(u => u.name.includes('Raw Mill'))?.id,
        description: 'Main circulation fan for raw mill ventilation system - 350,000 Nm³/h',
        assetType: 'Equipment' as const,
        criticality: 'High' as const,
        manufacturer: 'Howden',
        model: 'HT-3500',
        serialNumber: 'FAN-2024-001',
        status: 'Active' as const,
        tenantId
      },
      {
        name: 'Raw Mill Feed Conveyor - RM-1-CONV',
        code: 'RM-1-CONV',
        unitId: units.find(u => u.name.includes('Raw Mill'))?.id,
        description: 'Belt conveyor for raw material feed to mill inlet',
        assetType: 'Equipment' as const,
        criticality: 'Medium' as const,
        manufacturer: 'Continental',
        model: 'CONTI-PLUS',
        serialNumber: 'CONV-2024-001',
        status: 'Active' as const,
        tenantId
      },
      {
        name: 'Raw Mill Bag Filter - RM-1-BF',
        code: 'RM-1-BF',
        unitId: units.find(u => u.name.includes('Raw Mill'))?.id,
        description: 'Bag house dust collector for raw mill exhaust gas cleaning',
        assetType: 'Equipment' as const,
        criticality: 'High' as const,
        manufacturer: 'Intensiv-Filter',
        model: 'HYBRID-4500',
        serialNumber: 'BF-2024-001',
        status: 'Active' as const,
        tenantId
      },
      
      // ========== KILN UNIT ASSETS ==========
      {
        name: 'Rotary Kiln - K-1-RK',
        code: 'K-1-RK',
        unitId: units.find(u => u.name.includes('Kiln'))?.id,
        description: 'Main rotary kiln for clinker production - 4.8m x 72m with 5000 TPD capacity',
        assetType: 'Equipment' as const,
        criticality: 'High' as const,
        manufacturer: 'FLSmidth',
        model: 'ROTAX-2',
        serialNumber: 'KILN-2024-001',
        status: 'Active' as const,
        tenantId
      },
      {
        name: 'Kiln Main Drive - K-1-DRIVE',
        code: 'K-1-DRIVE',
        unitId: units.find(u => u.name.includes('Kiln'))?.id,
        description: 'Main drive system for rotary kiln with VFD control - 2500 kW',
        assetType: 'Equipment' as const,
        criticality: 'High' as const,
        manufacturer: 'Siemens',
        model: 'SIMOVERT-MASTERDRIVES',
        serialNumber: 'DRIVE-2024-001',
        status: 'Active' as const,
        tenantId
      },
      {
        name: 'Kiln Auxiliary Drive - K-1-AUXDRIVE',
        code: 'K-1-AUXDRIVE',
        unitId: units.find(u => u.name.includes('Kiln'))?.id,
        description: 'Auxiliary drive for kiln slow rotation during maintenance',
        assetType: 'Equipment' as const,
        criticality: 'Medium' as const,
        manufacturer: 'SEW Eurodrive',
        model: 'DRN132M4',
        serialNumber: 'AUXD-2024-001',
        status: 'Active' as const,
        tenantId
      },
      {
        name: 'Kiln Hood - K-1-HOOD',
        code: 'K-1-HOOD',
        unitId: units.find(u => u.name.includes('Kiln'))?.id,
        description: 'Kiln discharge end hood with secondary air intake',
        assetType: 'Equipment' as const,
        criticality: 'High' as const,
        manufacturer: 'FLSmidth',
        model: 'HOOD-STD',
        serialNumber: 'HOOD-2024-001',
        status: 'Active' as const,
        tenantId
      },
      {
        name: 'Kiln Burner - K-1-BURNER',
        code: 'K-1-BURNER',
        unitId: units.find(u => u.name.includes('Kiln'))?.id,
        description: 'Multi-channel burner for coal and alternative fuels - 120 MW thermal capacity',
        assetType: 'Equipment' as const,
        criticality: 'High' as const,
        manufacturer: 'FLSmidth',
        model: 'JETFLEX-BURNER',
        serialNumber: 'BURN-2024-001',
        status: 'Active' as const,
        tenantId
      },
      {
        name: 'Clinker Cooler - K-1-COOL',
        code: 'K-1-COOL',
        unitId: units.find(u => u.name.includes('Kiln'))?.id,
        description: 'Grate cooler for clinker cooling from 1400°C to 100°C',
        assetType: 'Equipment' as const,
        criticality: 'High' as const,
        manufacturer: 'FLSmidth',
        model: 'CROSS-BAR-COOLER',
        serialNumber: 'COOL-2024-001',
        status: 'Active' as const,
        tenantId
      },
      
      // ========== PREHEATER UNIT ASSETS ==========
      {
        name: 'Preheater Tower - PH-1-TOWER',
        code: 'PH-1-TOWER',
        unitId: units.find(u => u.name.includes('Preheater'))?.id,
        description: '5-stage cyclone preheater tower for raw meal preheating',
        assetType: 'Equipment' as const,
        criticality: 'High' as const,
        manufacturer: 'FLSmidth',
        model: 'ILC-5STAGE',
        serialNumber: 'PREH-2024-001',
        status: 'Active' as const,
        tenantId
      },
      {
        name: 'Preheater Cyclone C1 - PH-1-C1',
        code: 'PH-1-C1',
        unitId: units.find(u => u.name.includes('Preheater'))?.id,
        description: 'First stage cyclone separator',
        assetType: 'Equipment' as const,
        criticality: 'High' as const,
        manufacturer: 'FLSmidth',
        model: 'CYCLONE-C1',
        serialNumber: 'CYC1-2024-001',
        status: 'Active' as const,
        tenantId
      },
      {
        name: 'Calciner - PH-1-CALC',
        code: 'PH-1-CALC',
        unitId: units.find(u => u.name.includes('Preheater'))?.id,
        description: 'In-line calciner for 90% calcination before kiln inlet',
        assetType: 'Equipment' as const,
        criticality: 'High' as const,
        manufacturer: 'FLSmidth',
        model: 'ILC-CALCINER',
        serialNumber: 'CALC-2024-001',
        status: 'Active' as const,
        tenantId
      },
      
      // ========== CEMENT MILL UNIT ASSETS ==========
      {
        name: 'Cement Mill Ball Mill - CM-1-BM',
        code: 'CM-1-BM',
        unitId: units.find(u => u.name.includes('Cement Mill'))?.id,
        description: 'Finish grinding ball mill for cement production - 200 TPH capacity, two compartments',
        assetType: 'Equipment' as const,
        criticality: 'High' as const,
        manufacturer: 'FLSmidth',
        model: 'UM-46.4',
        serialNumber: 'CM-2024-001',
        status: 'Active' as const,
        tenantId
      },
      {
        name: 'Cement Mill Separator - CM-1-SEP',
        code: 'CM-1-SEP',
        unitId: units.find(u => u.name.includes('Cement Mill'))?.id,
        description: 'High-efficiency third generation separator for cement fineness control',
        assetType: 'Equipment' as const,
        criticality: 'High' as const,
        manufacturer: 'FLSmidth',
        model: 'SEPAX-450',
        serialNumber: 'CSEP-2024-001',
        status: 'Active' as const,
        tenantId
      },
      {
        name: 'Cement Mill Fan - CM-1-FAN',
        code: 'CM-1-FAN',
        unitId: units.find(u => u.name.includes('Cement Mill'))?.id,
        description: 'Main circulation fan for cement mill ventilation - 280,000 Nm³/h',
        assetType: 'Equipment' as const,
        criticality: 'High' as const,
        manufacturer: 'Howden',
        model: 'HT-2800',
        serialNumber: 'CFAN-2024-001',
        status: 'Active' as const,
        tenantId
      },
      {
        name: 'Cement Mill Bag Filter - CM-1-BF',
        code: 'CM-1-BF',
        unitId: units.find(u => u.name.includes('Cement Mill'))?.id,
        description: 'Pulse-jet bag filter for cement mill exhaust gas dedusting',
        assetType: 'Equipment' as const,
        criticality: 'High' as const,
        manufacturer: 'Intensiv-Filter',
        model: 'HYBRID-3500',
        serialNumber: 'CBF-2024-001',
        status: 'Active' as const,
        tenantId
      },
      {
        name: 'Cement Silo - CM-1-SILO',
        code: 'CM-1-SILO',
        unitId: units.find(u => u.name.includes('Cement Mill'))?.id,
        description: 'Cement storage silo - 10,000 MT capacity with aeration system',
        assetType: 'Equipment' as const,
        criticality: 'Medium' as const,
        manufacturer: 'SILOS CÓRDOBA',
        model: 'SC-10000',
        serialNumber: 'SILO-2024-001',
        status: 'Active' as const,
        tenantId
      },
      
      // ========== PACKAGING UNIT ASSETS ==========
      {
        name: 'Rotary Packer - PK-1-RP1',
        code: 'PK-1-RP1',
        unitId: units.find(u => u.name.includes('Packaging'))?.id,
        description: 'Automated rotary packer for 50kg bags - 2400 bags/hour',
        assetType: 'Equipment' as const,
        criticality: 'High' as const,
        manufacturer: 'Haver & Boecker',
        model: 'ROTO-PACKER-8',
        serialNumber: 'PACK-2024-001',
        status: 'Active' as const,
        tenantId
      },
      {
        name: 'Rotary Packer - PK-1-RP2',
        code: 'PK-1-RP2',
        unitId: units.find(u => u.name.includes('Packaging'))?.id,
        description: 'Automated rotary packer for 25kg bags - 3000 bags/hour',
        assetType: 'Equipment' as const,
        criticality: 'High' as const,
        manufacturer: 'Haver & Boecker',
        model: 'ROTO-PACKER-6',
        serialNumber: 'PACK-2024-002',
        status: 'Active' as const,
        tenantId
      },
      {
        name: 'Bag Palletizer - PK-1-PAL',
        code: 'PK-1-PAL',
        unitId: units.find(u => u.name.includes('Packaging'))?.id,
        description: 'Automatic palletizer for cement bags with stretch wrapper',
        assetType: 'Equipment' as const,
        criticality: 'Medium' as const,
        manufacturer: 'Haver & Boecker',
        model: 'NIAGARA-PAL',
        serialNumber: 'PAL-2024-001',
        status: 'Active' as const,
        tenantId
      },
      {
        name: 'Bag Loading Conveyor - PK-1-CONV',
        code: 'PK-1-CONV',
        unitId: units.find(u => u.name.includes('Packaging'))?.id,
        description: 'Belt conveyor system for bagged cement transport to warehouse',
        assetType: 'Equipment' as const,
        criticality: 'Medium' as const,
        manufacturer: 'Continental',
        model: 'CONTI-PLUS',
        serialNumber: 'PCONV-2024-001',
        status: 'Active' as const,
        tenantId
      },
      {
        name: 'Truck Loading System - PK-1-TLS',
        code: 'PK-1-TLS',
        unitId: units.find(u => u.name.includes('Packaging'))?.id,
        description: 'Automatic truck loading system for bulk cement dispatch',
        assetType: 'Equipment' as const,
        criticality: 'Medium' as const,
        manufacturer: 'Schenck Process',
        model: 'LOADMASTER',
        serialNumber: 'TLS-2024-001',
        status: 'Active' as const,
        tenantId
      },
      
      // ========== CRUSHER UNIT ASSETS ==========
      {
        name: 'Limestone Crusher - CR-1-CRUSH',
        code: 'CR-1-CRUSH',
        unitId: units.find(u => u.name.includes('Crusher'))?.id,
        description: 'Primary hammer crusher for limestone crushing - 800 TPH capacity',
        assetType: 'Equipment' as const,
        criticality: 'High' as const,
        manufacturer: 'thyssenkrupp',
        model: 'EV-HAMMER',
        serialNumber: 'CRUSH-2024-001',
        status: 'Active' as const,
        tenantId
      },
      {
        name: 'Crusher Apron Feeder - CR-1-FEED',
        code: 'CR-1-FEED',
        unitId: units.find(u => u.name.includes('Crusher'))?.id,
        description: 'Heavy-duty apron feeder for limestone feed to crusher',
        assetType: 'Equipment' as const,
        criticality: 'High' as const,
        manufacturer: 'Metso',
        model: 'APRON-FEEDER',
        serialNumber: 'FEED-2024-001',
        status: 'Active' as const,
        tenantId
      },
      {
        name: 'Crusher Discharge Conveyor - CR-1-CONV',
        code: 'CR-1-CONV',
        unitId: units.find(u => u.name.includes('Crusher'))?.id,
        description: 'Belt conveyor for crushed limestone transport to storage',
        assetType: 'Equipment' as const,
        criticality: 'High' as const,
        manufacturer: 'Continental',
        model: 'CONTI-HEAVY',
        serialNumber: 'CRCONV-2024-001',
        status: 'Active' as const,
        tenantId
      },
      
      // ========== COAL MILL UNIT ASSETS ==========
      {
        name: 'Coal Mill - CM-2-MILL',
        code: 'CM-2-MILL',
        unitId: units.find(u => u.name.includes('Coal Mill'))?.id,
        description: 'Vertical roller mill for coal grinding - 50 TPH capacity',
        assetType: 'Equipment' as const,
        criticality: 'High' as const,
        manufacturer: 'Loesche',
        model: 'LM-20.2',
        serialNumber: 'COMILL-2024-001',
        status: 'Active' as const,
        tenantId
      },
      {
        name: 'Coal Mill Bag Filter - CM-2-BF',
        code: 'CM-2-BF',
        unitId: units.find(u => u.name.includes('Coal Mill'))?.id,
        description: 'Explosion-proof bag filter for coal mill with CO monitoring',
        assetType: 'Equipment' as const,
        criticality: 'High' as const,
        manufacturer: 'Intensiv-Filter',
        model: 'EXPROOF-2500',
        serialNumber: 'COBF-2024-001',
        status: 'Active' as const,
        tenantId
      },
      
      // ========== QUALITY CONTROL LAB ASSETS ==========
      {
        name: 'XRF Analyzer - QC-1-XRF',
        code: 'QC-1-XRF',
        unitId: units.find(u => u.name.includes('Quality Control'))?.id,
        description: 'X-Ray Fluorescence analyzer for chemical composition analysis of raw materials and cement',
        assetType: 'Instrument' as const,
        criticality: 'High' as const,
        manufacturer: 'Bruker',
        model: 'S8-TIGER',
        serialNumber: 'XRF-2024-001',
        status: 'Active' as const,
        tenantId
      },
      {
        name: 'XRD Analyzer - QC-1-XRD',
        code: 'QC-1-XRD',
        unitId: units.find(u => u.name.includes('Quality Control'))?.id,
        description: 'X-Ray Diffraction analyzer for mineralogical phase analysis',
        assetType: 'Instrument' as const,
        criticality: 'High' as const,
        manufacturer: 'PANalytical',
        model: 'AERIS-COMPACT',
        serialNumber: 'XRD-2024-001',
        status: 'Active' as const,
        tenantId
      },
      {
        name: 'Blaine Air Permeability Apparatus - QC-1-BLAINE',
        code: 'QC-1-BLAINE',
        unitId: units.find(u => u.name.includes('Quality Control'))?.id,
        description: 'Blaine apparatus for cement fineness measurement (specific surface area)',
        assetType: 'Instrument' as const,
        criticality: 'High' as const,
        manufacturer: 'Controls Group',
        model: 'C207',
        serialNumber: 'BLAINE-2024-001',
        status: 'Active' as const,
        tenantId
      },
      {
        name: 'Compression Testing Machine - QC-1-CTM',
        code: 'QC-1-CTM',
        unitId: units.find(u => u.name.includes('Quality Control'))?.id,
        description: 'Automatic compression testing machine for cement strength testing - 3000 kN capacity',
        assetType: 'Instrument' as const,
        criticality: 'High' as const,
        manufacturer: 'Controls Group',
        model: 'AUTOMAX-5',
        serialNumber: 'CTM-2024-001',
        status: 'Active' as const,
        tenantId
      },
      {
        name: 'Vicat Apparatus - QC-1-VICAT',
        code: 'QC-1-VICAT',
        unitId: units.find(u => u.name.includes('Quality Control'))?.id,
        description: 'Automatic Vicat apparatus for cement setting time determination',
        assetType: 'Instrument' as const,
        criticality: 'Medium' as const,
        manufacturer: 'Controls Group',
        model: 'C145-A',
        serialNumber: 'VICAT-2024-001',
        status: 'Active' as const,
        tenantId
      },
      {
        name: 'Le Chatelier Apparatus - QC-1-LECHAT',
        code: 'QC-1-LECHAT',
        unitId: units.find(u => u.name.includes('Quality Control'))?.id,
        description: 'Le Chatelier apparatus for cement soundness testing',
        assetType: 'Instrument' as const,
        criticality: 'Medium' as const,
        manufacturer: 'Controls Group',
        model: 'C155',
        serialNumber: 'LECHAT-2024-001',
        status: 'Active' as const,
        tenantId
      },
      {
        name: 'Lab Sieve Shaker - QC-1-SIEVE',
        code: 'QC-1-SIEVE',
        unitId: units.find(u => u.name.includes('Quality Control'))?.id,
        description: 'Electromagnetic sieve shaker for particle size analysis',
        assetType: 'Instrument' as const,
        criticality: 'Medium' as const,
        manufacturer: 'Retsch',
        model: 'AS-200',
        serialNumber: 'SIEVE-2024-001',
        status: 'Active' as const,
        tenantId
      },
      {
        name: 'Lab Furnace - QC-1-FURN',
        code: 'QC-1-FURN',
        unitId: units.find(u => u.name.includes('Quality Control'))?.id,
        description: 'High-temperature furnace for loss on ignition and free lime determination - 1200°C max',
        assetType: 'Instrument' as const,
        criticality: 'High' as const,
        manufacturer: 'Nabertherm',
        model: 'LT-15/12',
        serialNumber: 'FURN-2024-001',
        status: 'Active' as const,
        tenantId
      }
    ].filter(asset => asset.unitId);

    for (const assetData of assets) {
      await masterDataService.createAsset(assetData);
    }

    console.log(`✅ Cement industry assets seeded successfully - ${assets.length} assets created`);
    console.log('   🏭 Asset distribution:');
    console.log('      - Raw Mill Unit: 5 assets');
    console.log('      - Kiln Unit: 6 assets');
    console.log('      - Preheater Unit: 3 assets');
    console.log('      - Cement Mill Unit: 5 assets');
    console.log('      - Packaging Unit: 5 assets');
    console.log('      - Crusher Unit: 3 assets');
    console.log('      - Coal Mill Unit: 2 assets');
    console.log('      - Quality Control Lab: 8 instruments');
  }

  // Seed cement industry products
  private async seedCementProducts(): Promise<void> {
    console.log('📦 Seeding comprehensive cement industry products...');
    
    const products = [
      // ===== ORDINARY PORTLAND CEMENT (OPC) =====
      {
        name: 'Ordinary Portland Cement - OPC 53 Grade',
        code: 'OPC-53',
        unitOfMeasure: 'MT (Metric Tons)',
        description: 'High-strength Ordinary Portland Cement 53 Grade - Minimum 28-day strength 53 MPa. Ideal for structural applications, high-rise buildings, bridges, and pre-stressed concrete. Conforms to IS 12269:2013 standards.',
        standardCost: 85.50
      },
      {
        name: 'Ordinary Portland Cement - OPC 43 Grade',
        code: 'OPC-43',
        unitOfMeasure: 'MT (Metric Tons)',
        description: 'Standard Ordinary Portland Cement 43 Grade - Minimum 28-day strength 43 MPa. Suitable for general construction, plastering, and non-structural applications. Conforms to IS 8112:1989 standards.',
        standardCost: 78.25
      },
      {
        name: 'Ordinary Portland Cement - OPC 33 Grade',
        code: 'OPC-33',
        unitOfMeasure: 'MT (Metric Tons)',
        description: 'Ordinary Portland Cement 33 Grade - Minimum 28-day strength 33 MPa. Used for plain concrete work and non-critical structures. Conforms to IS 269:2015 standards.',
        standardCost: 72.80
      },
      
      // ===== PORTLAND POZZOLANA CEMENT (PPC) =====
      {
        name: 'Portland Pozzolana Cement - PPC',
        code: 'PPC',
        unitOfMeasure: 'MT (Metric Tons)',
        description: 'Portland Pozzolana Cement with 15-35% fly ash content. Provides excellent workability, reduced permeability, and enhanced chemical resistance. Ideal for marine structures, mass concrete, and sewage works. Conforms to IS 1489:1991 Part 1.',
        standardCost: 82.75
      },
      {
        name: 'Portland Pozzolana Cement - PPC Premium',
        code: 'PPC-PREM',
        unitOfMeasure: 'MT (Metric Tons)',
        description: 'Premium grade Portland Pozzolana Cement with optimized pozzolanic materials. Superior durability and long-term strength. Ideal for infrastructure projects and aggressive environments.',
        standardCost: 87.90
      },
      
      // ===== PORTLAND SLAG CEMENT (PSC) =====
      {
        name: 'Portland Slag Cement - PSC',
        code: 'PSC',
        unitOfMeasure: 'MT (Metric Tons)',
        description: 'Portland Slag Cement with 25-70% blast furnace slag. Excellent sulfate and chloride resistance. Ideal for marine environments, sewage systems, and mass concrete dams. Conforms to IS 455:1989 standards.',
        standardCost: 79.50
      },
      
      // ===== COMPOSITE CEMENT =====
      {
        name: 'Portland Composite Cement - PCC',
        code: 'PCC',
        unitOfMeasure: 'MT (Metric Tons)',
        description: 'Portland Composite Cement containing blend of fly ash, slag, and other pozzolanic materials. Balanced performance for diverse applications. Conforms to IS 1489:1991 Part 2.',
        standardCost: 81.35
      },
      
      // ===== SPECIAL PURPOSE CEMENTS =====
      {
        name: 'Rapid Hardening Cement - RHC',
        code: 'RHC',
        unitOfMeasure: 'MT (Metric Tons)',
        description: 'Rapid Hardening Cement with high early strength - 16 MPa at 3 days. Achieves 75% of 28-day strength within 7 days. Ideal for urgent repairs, pre-cast elements, and cold weather concreting. Conforms to IS 8041:1990.',
        standardCost: 95.25
      },
      {
        name: 'Quick Setting Cement - QSC',
        code: 'QSC',
        unitOfMeasure: 'MT (Metric Tons)',
        description: 'Quick Setting Cement with initial setting time 5 minutes and final setting within 30 minutes. Used for underwater construction, foundations in waterlogged areas, and emergency repairs.',
        standardCost: 110.00
      },
      {
        name: 'Low Heat Cement - LHC',
        code: 'LHC',
        unitOfMeasure: 'MT (Metric Tons)',
        description: 'Low Heat Cement with modified composition producing less heat of hydration. Ideal for mass concrete works like dams, thick foundations, and large retaining walls. Prevents thermal cracking. Conforms to IS 12600:1989.',
        standardCost: 88.75
      },
      {
        name: 'Sulphate Resistant Cement - SRC',
        code: 'SRC',
        unitOfMeasure: 'MT (Metric Tons)',
        description: 'Sulphate Resistant Cement with controlled C3A content (<5%). Excellent resistance to sulfate attack from soil and groundwater. Used in coastal areas, sewage treatment plants, and chemical industries. Conforms to IS 12330:1988.',
        standardCost: 92.40
      },
      {
        name: 'High Alumina Cement - HAC',
        code: 'HAC',
        unitOfMeasure: 'MT (Metric Tons)',
        description: 'High Alumina Cement with very high early strength and heat resistance up to 1250°C. Used in refractory applications, emergency repairs, and high-temperature installations.',
        standardCost: 145.00
      },
      {
        name: 'Hydrophobic Cement',
        code: 'HC',
        unitOfMeasure: 'MT (Metric Tons)',
        description: 'Hydrophobic Cement with water-repellent additives. Maintains quality during transport and storage in humid conditions. Used in areas with long storage requirements and high humidity.',
        standardCost: 98.60
      },
      {
        name: 'Expansive Cement',
        code: 'EC',
        unitOfMeasure: 'MT (Metric Tons)',
        description: 'Expansive Cement that expands during setting, compensating for shrinkage. Used in grouts, anchors, pre-stressing applications, and crack repairs. Provides tight seals and strong bonds.',
        standardCost: 105.25
      },
      
      // ===== WHITE & COLORED CEMENT =====
      {
        name: 'White Portland Cement',
        code: 'WPC',
        unitOfMeasure: 'MT (Metric Tons)',
        description: 'White Portland Cement manufactured from raw materials containing negligible iron and manganese oxides. Used for architectural purposes, decorative works, terrazzo flooring, and tile jointing. Superior whiteness and brightness.',
        standardCost: 125.00
      },
      {
        name: 'Colored Cement - Gray',
        code: 'CC-GRAY',
        unitOfMeasure: 'MT (Metric Tons)',
        description: 'Gray colored cement for decorative applications, architectural finishes, and aesthetic concrete works.',
        standardCost: 95.00
      },
      
      // ===== MASONRY CEMENT =====
      {
        name: 'Masonry Cement',
        code: 'MC',
        unitOfMeasure: 'MT (Metric Tons)',
        description: 'Masonry Cement specially formulated for mortar preparation. Contains plasticizers for improved workability and water retention. Used in bricklaying, block laying, and plastering works.',
        standardCost: 76.50
      },
      
      // ===== BLENDED CEMENTS =====
      {
        name: 'Blended Cement - Type B',
        code: 'BC-B',
        unitOfMeasure: 'MT (Metric Tons)',
        description: 'Blended Cement containing multiple supplementary cementitious materials. Optimized for durability, sustainability, and reduced carbon footprint. Suitable for general construction applications.',
        standardCost: 80.75
      },
      
      // ===== INTERMEDIATE PRODUCTS =====
      {
        name: 'Clinker',
        code: 'CLK',
        unitOfMeasure: 'MT (Metric Tons)',
        description: 'Cement clinker - intermediate product from kiln before final grinding. Dark grey nodules from limestone and clay calcination at 1400-1500°C. Raw material for various cement types.',
        standardCost: 65.00
      },
      {
        name: 'Raw Meal',
        code: 'RM',
        unitOfMeasure: 'MT (Metric Tons)',
        description: 'Raw meal - finely ground mixture of limestone, clay, and corrective materials ready for kiln feed. Precisely proportioned for optimal clinker production.',
        standardCost: 30.00
      },
      
      // ===== CEMENT ADDITIVES & BLENDING MATERIALS =====
      {
        name: 'Gypsum',
        code: 'GYP',
        unitOfMeasure: 'MT (Metric Tons)',
        description: 'Gypsum (CaSO4·2H2O) - added to clinker (3-5%) during final grinding to control setting time of cement. Essential for cement manufacturing.',
        standardCost: 25.00
      },
      {
        name: 'Fly Ash',
        code: 'FA',
        unitOfMeasure: 'MT (Metric Tons)',
        description: 'Fly ash - pozzolanic material used in PPC cement production. Improves workability, reduces heat of hydration, and enhances long-term strength.',
        standardCost: 18.00
      },
      {
        name: 'Blast Furnace Slag',
        code: 'BFS',
        unitOfMeasure: 'MT (Metric Tons)',
        description: 'Granulated blast furnace slag - used in PSC cement production. Provides excellent sulfate and chemical resistance.',
        standardCost: 22.00
      }
    ];

    for (const productData of products) {
      await masterDataService.createProduct(productData);
    }

    console.log(`✅ Cement industry products seeded successfully - ${products.length} products created`);
    console.log('   📋 Product categories:');
    console.log('      - Ordinary Portland Cement (OPC): 3 grades');
    console.log('      - Portland Pozzolana Cement (PPC): 2 variants');
    console.log('      - Special Purpose Cements: 9 types');
    console.log('      - White & Colored Cement: 2 types');
    console.log('      - Intermediate Products: 2 types');
    console.log('      - Additives & Blending Materials: 3 types');
  }

  // Seed cement industry production plans
  private async seedCementProductionPlans(tenantId: string): Promise<void> {
    console.log('📋 Seeding cement industry production plans...');
    
    try {
      const units = await masterDataService.getUnits();
      const products = await masterDataService.getProducts();
      
      if (units.length === 0 || products.length === 0) {
        console.warn('No units or products found, skipping production plans');
        return;
      }

      // Find units and products
      const kilnUnit = units.find(u => u.name.includes('Kiln')) || units[0];
      const rawMillUnit = units.find(u => u.name.includes('Raw Mill')) || units[1];
      const cementMillUnit = units.find(u => u.name.includes('Cement Mill')) || units[2];
      const packagingUnit = units.find(u => u.name.includes('Packaging')) || units[3];
      
      const opc53Product = products.find(p => p.name.includes('OPC 53')) || products[0];
      const opc43Product = products.find(p => p.name.includes('OPC 43')) || products[1];
      const ppcProduct = products.find(p => p.name.includes('PPC')) || products[2];

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
          plannerNotes: 'Cement packaging and bagging operations',
          tenantId
        }
      ].filter(plan => plan.unitId && plan.productId);

      console.log(`📋 Creating ${plans.length} cement industry production plans...`);
      
      for (const planData of plans) {
        try {
          const createdPlan = await masterDataService.createProductionPlan(planData);
          console.log(`✅ Created plan: ${createdPlan.name} (${createdPlan.id})`);
        } catch (error) {
          console.error(`❌ Failed to create plan: ${planData.name}`, error);
        }
      }

      console.log('✅ Cement industry production plans seeded');
    } catch (error) {
      console.warn('Could not create cement industry production plans:', error);
    }
  }

  // Seed cement industry production events (20+ events of different categories)
  private async seedCementProductionEvents(tenantId: string): Promise<void> {
    console.log('🚨 Seeding cement industry production events (20+ events)...');
    
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
      const equipmentFailureImpact = impactCodes.find(ic => ic.name.includes('Equipment Breakdown'))?.id;
      const qualityDefectsImpact = impactCodes.find(ic => ic.name.includes('Off-Spec Product'))?.id;
      const reducedSpeedImpact = impactCodes.find(ic => ic.name.includes('Reduced Speed'))?.id;
      const materialShortageImpact = impactCodes.find(ic => ic.name.includes('Material Shortage'))?.id;

      // Find unit IDs with better error handling
      const crusherUnitId = units.find(u => u.name.includes('Crusher'))?.id;
      const cementMillUnitId = units.find(u => u.name.includes('Cement Mill'))?.id;
      const rawMillUnitId = units.find(u => u.name.includes('Raw Mill'))?.id;
      const kilnUnitId = units.find(u => u.name.includes('Kiln'))?.id;

      // Debug logging and validation
      console.log('Unit IDs found:', {
        crusherUnitId,
        cementMillUnitId,
        rawMillUnitId,
        kilnUnitId,
        unitsCount: units.length,
        unitNames: units.map(u => u.name)
      });

      // Validate that all required unit IDs are found
      const missingUnits = [];
      if (!crusherUnitId) missingUnits.push('Crusher Unit');
      if (!cementMillUnitId) missingUnits.push('Cement Mill Unit');
      if (!rawMillUnitId) missingUnits.push('Raw Mill Unit');
      if (!kilnUnitId) missingUnits.push('Kiln Unit');

      if (missingUnits.length > 0) {
        console.error('❌ Missing unit IDs for production events:', missingUnits);
        console.log('Available units:', units.map(u => ({ id: u.id, name: u.name })));
        
        // Suggest fixes for missing units
        console.log('💡 Suggested unit name patterns for consistency:');
        console.log('   - Crusher Unit: Should contain "Crusher"');
        console.log('   - Cement Mill Unit: Should contain "Cement Mill"');
        console.log('   - Raw Mill Unit: Should contain "Raw Mill"');
        console.log('   - Kiln Unit: Should contain "Kiln"');
        
        throw new Error(`Missing required units for production events: ${missingUnits.join(', ')}`);
      }
      const processUpsetImpact = impactCodes.find(ic => ic.name.includes('Process Upset'))?.id;

      const unplannedDowntimeOEE = oeeCodes.find(oc => oc.name.includes('Equipment Breakdown'))?.id;
      const productionRejectsOEE = oeeCodes.find(oc => oc.name.includes('Production Rejects'))?.id;
      const reducedSpeedOEE = oeeCodes.find(oc => oc.name.includes('Speed Loss'))?.id;

      // Find asset IDs with validation
      const crusherAssetId = assets.find(a => a.name.includes('Crusher'))?.id;
      const cementMillBallMillAssetId = assets.find(a => a.name.includes('Cement Mill Ball Mill'))?.id;
      const rawMillBallMillAssetId = assets.find(a => a.name.includes('Raw Mill Ball Mill'))?.id;

      // Validate that all required asset IDs are found
      const missingAssets = [];
      if (!crusherAssetId) missingAssets.push('Crusher Asset');
      if (!cementMillBallMillAssetId) missingAssets.push('Cement Mill Ball Mill Asset');
      if (!rawMillBallMillAssetId) missingAssets.push('Raw Mill Ball Mill Asset');

      if (missingAssets.length > 0) {
        console.warn('⚠️ Missing asset IDs for production events:', missingAssets);
        console.log('Available assets:', assets.map(a => ({ id: a.id, name: a.name, unitId: a.unitId })));
      }
      const plannedDowntimeOEE = oeeCodes.find(oc => oc.name.includes('Planned Downtime'))?.id;
      const startupLossesOEE = oeeCodes.find(oc => oc.name.includes('Startup Losses'))?.id;

      const bearingFailureReason = reasonCodes.find(rc => rc.name.includes('Bearing Failure'))?.id;
      const motorFailureReason = reasonCodes.find(rc => rc.name.includes('Motor Failure'))?.id;

      // Validate that all required codes are found
      const missingCodes = [];
      if (!equipmentFailureImpact) missingCodes.push('Equipment Breakdown Impact Code');
      if (!reducedSpeedImpact) missingCodes.push('Reduced Speed Operation Impact Code');
      if (!unplannedDowntimeOEE) missingCodes.push('Equipment Breakdown OEE Code');
      if (!reducedSpeedOEE) missingCodes.push('Speed Loss OEE Code');

      if (missingCodes.length > 0) {
        console.warn('⚠️ Missing codes for production events:', missingCodes);
        console.log('Available impact codes:', impactCodes.map(ic => ({ id: ic.id, name: ic.name })));
        console.log('Available OEE codes:', oeeCodes.map(oc => ({ id: oc.id, name: oc.name })));
      }
      const refractoryFailureReason = reasonCodes.find(rc => rc.name.includes('Refractory Failure'))?.id;
      const sealFailureReason = reasonCodes.find(rc => rc.name.includes('Seal Failure'))?.id;
      const gearboxFailureReason = reasonCodes.find(rc => rc.name.includes('Gearbox Failure'))?.id;
      const pumpFailureReason = reasonCodes.find(rc => rc.name.includes('Pump Failure'))?.id;
      const processUpsetReason = reasonCodes.find(rc => rc.name.includes('Process Upset'))?.id;
      const materialDelayReason = reasonCodes.find(rc => rc.name.includes('Material Delay'))?.id;
      const materialDefectReason = reasonCodes.find(rc => rc.name.includes('Material Defect'))?.id;
      const materialShortageReason = reasonCodes.find(rc => rc.name.includes('Material Shortage'))?.id;

      const events = [
        // Production Loss Events (Equipment Failures)
        {
          eventId: 'EVT-001',
          unitId: units.find(u => u.name.includes('Kiln'))?.id,
          assetId: assets.find(a => a.name.includes('Rotary Kiln'))?.id,
          description: 'Rotary kiln refractory lining failure causing emergency shutdown',
          startTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 6 * 60 * 60 * 1000).toISOString(),
          eventType: 'ProductionLoss' as const,
          status: 'Closed' as const,
          source: 'Manual' as const,
          quantity: 1250, // MT of clinker lost
          cost: 106250, // $85/MT * 1250 MT
          duration: 360, // 6 hours in minutes
          impactCodeId: equipmentFailureImpact,
          oeeCodeId: unplannedDowntimeOEE,
          reasonCodeId: refractoryFailureReason,
          lossCategory: 'Equipment Failure',
          operatorName: 'Ahmed Al-Margoon',
          shift: 'Day',
          crew: 'A',
          tenantId
        },
        {
          eventId: 'EVT-002',
          unitId: units.find(u => u.name.includes('Raw Mill'))?.id,
          assetId: assets.find(a => a.name.includes('Raw Mill Ball Mill'))?.id,
          description: 'Raw mill ball mill motor failure during peak production',
          startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000).toISOString(),
          eventType: 'ProductionLoss' as const,
          status: 'Open' as const,
          source: 'Manual' as const,
          quantity: 1200, // MT of raw meal lost
          cost: 36000, // $30/MT * 1200 MT
          duration: 240, // 4 hours in minutes
          impactCodeId: equipmentFailureImpact,
          oeeCodeId: unplannedDowntimeOEE,
          reasonCodeId: motorFailureReason,
          lossCategory: 'Equipment Failure',
          operatorName: 'Mohammed Al-Hassan',
          shift: 'Night',
          crew: 'B',
          tenantId
        },
        {
          eventId: 'EVT-003',
          unitId: units.find(u => u.name.includes('Cement Mill'))?.id,
          assetId: assets.find(a => a.name.includes('Cement Mill Ball Mill'))?.id,
          description: 'Cement mill ball mill bearing failure causing production stoppage',
          startTime: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString(),
          eventType: 'ProductionLoss' as const,
          status: 'Closed' as const,
          source: 'Manual' as const,
          quantity: 600, // MT of cement lost
          cost: 51000, // $85/MT * 600 MT
          duration: 180, // 3 hours in minutes
          impactCodeId: equipmentFailureImpact,
          oeeCodeId: unplannedDowntimeOEE,
          reasonCodeId: bearingFailureReason,
          lossCategory: 'Equipment Failure',
          operatorName: 'Omar Al-Rashid',
          shift: 'Day',
          crew: 'A',
          tenantId
        },
        {
          eventId: 'EVT-004',
          unitId: units.find(u => u.name.includes('Packaging'))?.id,
          assetId: assets.find(a => a.name.includes('Packaging Machine'))?.id,
          description: 'Packaging machine gearbox failure during bagging operations',
          startTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
          eventType: 'ProductionLoss' as const,
          status: 'In Progress' as const,
          source: 'Manual' as const,
          quantity: 300, // MT of bagged cement lost
          cost: 25500, // $85/MT * 300 MT
          duration: 120, // 2 hours in minutes
          impactCodeId: equipmentFailureImpact,
          oeeCodeId: unplannedDowntimeOEE,
          reasonCodeId: gearboxFailureReason,
          lossCategory: 'Equipment Failure',
          operatorName: 'Khalid Al-Mansouri',
          shift: 'Evening',
          crew: 'C',
          tenantId
        },
        {
          eventId: 'EVT-005',
          unitId: units.find(u => u.name.includes('Coal Mill'))?.id,
          assetId: assets.find(a => a.name.includes('Coal Mill'))?.id,
          description: 'Coal mill pump failure affecting kiln fuel supply',
          startTime: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000 + 1.5 * 60 * 60 * 1000).toISOString(),
          eventType: 'ProductionLoss' as const,
          status: 'Closed' as const,
          source: 'Manual' as const,
          quantity: 750, // MT of clinker lost
          cost: 63750, // $85/MT * 750 MT
          duration: 90, // 1.5 hours in minutes
          impactCodeId: equipmentFailureImpact,
          oeeCodeId: unplannedDowntimeOEE,
          reasonCodeId: pumpFailureReason,
          lossCategory: 'Equipment Failure',
          operatorName: 'Saeed Al-Zahrani',
          shift: 'Night',
          crew: 'B',
          tenantId
        },

        // Quality Issues (IOW - In Operation Window)
        {
          eventId: 'EVT-006',
          unitId: units.find(u => u.name.includes('Cement Mill'))?.id,
          assetId: assets.find(a => a.name.includes('Cement Mill Ball Mill'))?.id,
          description: 'Cement mill separator efficiency drop causing quality issues',
          startTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString(),
          eventType: 'IOW' as const,
          status: 'In Progress' as const,
          source: 'Manual' as const,
          parameter: 'Cement Fineness',
          value: 4200, // cm²/g
          limit: 3000, // cm²/g
          limitType: 'High' as const,
          breachDuration: 180, // 3 hours in minutes
          impactCodeId: qualityDefectsImpact,
          oeeCodeId: productionRejectsOEE,
          reasonCodeId: processUpsetReason,
          operatorName: 'Fahad Al-Qahtani',
          shift: 'Day',
          crew: 'A',
          tenantId
        },
        {
          eventId: 'EVT-007',
          unitId: units.find(u => u.name.includes('Kiln'))?.id,
          assetId: assets.find(a => a.name.includes('Rotary Kiln'))?.id,
          description: 'Kiln temperature deviation affecting clinker quality',
          startTime: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
          eventType: 'IOW' as const,
          status: 'Closed' as const,
          source: 'Manual' as const,
          parameter: 'Kiln Temperature',
          value: 1450, // °C
          limit: 1400, // °C
          limitType: 'High' as const,
          breachDuration: 120, // 2 hours in minutes
          impactCodeId: qualityDefectsImpact,
          oeeCodeId: productionRejectsOEE,
          reasonCodeId: processUpsetReason,
          operatorName: 'Nasser Al-Dosari',
          shift: 'Evening',
          crew: 'C',
          tenantId
        },
        {
          eventId: 'EVT-008',
          unitId: units.find(u => u.name.includes('Raw Mill'))?.id,
          assetId: assets.find(a => a.name.includes('Raw Mill Ball Mill'))?.id,
          description: 'Raw meal chemical composition out of specification',
          startTime: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000).toISOString(),
          eventType: 'IOW' as const,
          status: 'Closed' as const,
          source: 'Manual' as const,
          parameter: 'Lime Saturation Factor',
          value: 0.95,
          limit: 0.92,
          limitType: 'High' as const,
          breachDuration: 240, // 4 hours in minutes
          impactCodeId: qualityDefectsImpact,
          oeeCodeId: productionRejectsOEE,
          reasonCodeId: materialDefectReason,
          operatorName: 'Majed Al-Shammari',
          shift: 'Day',
          crew: 'A',
          tenantId
        },

        // Safety Operational Limits (SOL)
        {
          eventId: 'EVT-009',
          unitId: units.find(u => u.name.includes('Kiln'))?.id,
          assetId: assets.find(a => a.name.includes('Rotary Kiln'))?.id,
          description: 'Kiln shell temperature exceeding safety limits',
          startTime: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000).toISOString(),
          eventType: 'SOL' as const,
          status: 'Closed' as const,
          source: 'Manual' as const,
          solType: 'Safety' as const,
          parameter: 'Kiln Shell Temperature',
          value: 380, // °C
          limit: 350, // °C
          limitType: 'High' as const,
          breachDuration: 60, // 1 hour in minutes
          impactCodeId: equipmentFailureImpact,
          oeeCodeId: unplannedDowntimeOEE,
          reasonCodeId: processUpsetReason,
          operatorName: 'Rashid Al-Mutairi',
          shift: 'Night',
          crew: 'B',
          tenantId
        },
        {
          eventId: 'EVT-010',
          unitId: units.find(u => u.name.includes('Raw Mill'))?.id,
          assetId: assets.find(a => a.name.includes('Raw Mill Ball Mill'))?.id,
          description: 'Raw mill vibration levels exceeding operational limits',
          startTime: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000 + 0.5 * 60 * 60 * 1000).toISOString(),
          eventType: 'SOL' as const,
          status: 'Closed' as const,
          source: 'Manual' as const,
          solType: 'Operational' as const,
          parameter: 'Mill Vibration',
          value: 12.5, // mm/s
          limit: 10.0, // mm/s
          limitType: 'High' as const,
          breachDuration: 30, // 30 minutes
          impactCodeId: equipmentFailureImpact,
          oeeCodeId: unplannedDowntimeOEE,
          reasonCodeId: bearingFailureReason,
          operatorName: 'Turki Al-Otaibi',
          shift: 'Evening',
          crew: 'C',
          tenantId
        },

        // Asset Performance Management (APM)
        {
          eventId: 'EVT-011',
          unitId: units.find(u => u.name.includes('Cement Mill'))?.id,
          assetId: assets.find(a => a.name.includes('Cement Mill Ball Mill'))?.id,
          description: 'Cement mill motor current trending high indicating potential failure',
          startTime: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
          eventType: 'APM' as const,
          status: 'Investigating' as const,
          source: 'Simulated PI' as const,
          apmType: 'Predictive Maintenance',
          severity: 'Medium' as const,
          recommendedAction: 'Schedule motor inspection and bearing replacement',
          parameter: 'Motor Current',
          value: 450, // A
          limit: 400, // A
          limitType: 'High' as const,
          breachDuration: 120, // 2 hours in minutes
          impactCodeId: equipmentFailureImpact,
          oeeCodeId: unplannedDowntimeOEE,
          reasonCodeId: motorFailureReason,
          operatorName: 'Yazeed Al-Harbi',
          shift: 'Day',
          crew: 'A',
          tenantId
        },
        {
          eventId: 'EVT-012',
          unitId: units.find(u => u.name.includes('Kiln'))?.id,
          assetId: assets.find(a => a.name.includes('Rotary Kiln'))?.id,
          description: 'Kiln drive system temperature anomaly detected',
          startTime: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000 + 1.5 * 60 * 60 * 1000).toISOString(),
          eventType: 'APM' as const,
          status: 'Closed' as const,
          source: 'Simulated PI' as const,
          apmType: 'Condition Monitoring',
          severity: 'High' as const,
          recommendedAction: 'Immediate drive system inspection and lubrication',
          parameter: 'Drive Temperature',
          value: 85, // °C
          limit: 75, // °C
          limitType: 'High' as const,
          breachDuration: 90, // 1.5 hours in minutes
          impactCodeId: equipmentFailureImpact,
          oeeCodeId: unplannedDowntimeOEE,
          reasonCodeId: gearboxFailureReason,
          operatorName: 'Bandar Al-Ghamdi',
          shift: 'Night',
          crew: 'B',
          tenantId
        },

        // Failure Work Orders
        {
          eventId: 'EVT-013',
          unitId: units.find(u => u.name.includes('Packaging'))?.id,
          assetId: assets.find(a => a.name.includes('Packaging Machine'))?.id,
          description: 'Packaging machine seal failure requiring immediate repair',
          startTime: new Date(Date.now() - 13 * 24 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() - 13 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString(),
          eventType: 'FailureWO' as const,
          status: 'Completed' as const,
          source: 'CMMS' as const,
          workOrderId: 'WO-2024-001',
          failureMode: 'Seal Leakage',
          defectiveQuantity: 150, // MT of defective bags
          parameter: 'Seal Pressure',
          value: 0.5, // bar
          limit: 2.0, // bar
          limitType: 'Low' as const,
          breachDuration: 180, // 3 hours in minutes
          impactCodeId: equipmentFailureImpact,
          oeeCodeId: unplannedDowntimeOEE,
          reasonCodeId: sealFailureReason,
          operatorName: 'Sultan Al-Rashid',
          shift: 'Evening',
          crew: 'C',
          tenantId
        },
        {
          eventId: 'EVT-014',
          unitId: units.find(u => u.name.includes('Raw Mill'))?.id,
          assetId: assets.find(a => a.name.includes('Raw Mill Separator'))?.id,
          description: 'Raw mill separator blade damage causing efficiency loss',
          startTime: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000).toISOString(),
          eventType: 'FailureWO' as const,
          status: 'In Progress' as const,
          source: 'CMMS' as const,
          workOrderId: 'WO-2024-002',
          failureMode: 'Blade Damage',
          defectiveQuantity: 800, // MT of off-spec raw meal
          parameter: 'Separator Efficiency',
          value: 65, // %
          limit: 80, // %
          limitType: 'Low' as const,
          breachDuration: 240, // 4 hours in minutes
          impactCodeId: qualityDefectsImpact,
          oeeCodeId: productionRejectsOEE,
          reasonCodeId: processUpsetReason,
          operatorName: 'Faisal Al-Maliki',
          shift: 'Day',
          crew: 'A',
          tenantId
        },

        // Production Output Events
        {
          eventId: 'EVT-015',
          unitId: units.find(u => u.name.includes('Kiln'))?.id,
          assetId: assets.find(a => a.name.includes('Rotary Kiln'))?.id,
          description: 'Kiln production rate reduced due to material feed issues',
          startTime: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000 + 6 * 60 * 60 * 1000).toISOString(),
          eventType: 'ProductionOutput' as const,
          status: 'Closed' as const,
          source: 'Manual' as const,
          quantity: 18000, // MT of clinker produced (reduced from 20000)
          cost: 1530000, // $85/MT * 18000 MT
          duration: 360, // 6 hours in minutes
          impactCodeId: reducedSpeedImpact,
          oeeCodeId: reducedSpeedOEE,
          reasonCodeId: materialDelayReason,
          lossCategory: 'Reduced Speed',
          operatorName: 'Abdulrahman Al-Shehri',
          shift: 'Night',
          crew: 'B',
          tenantId
        },
        {
          eventId: 'EVT-016',
          unitId: cementMillUnitId,
          assetId: cementMillBallMillAssetId,
          description: 'Cement mill production reduced due to grinding media wear',
          startTime: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000).toISOString(),
          eventType: 'ProductionOutput' as const,
          status: 'Closed' as const,
          source: 'Manual' as const,
          quantity: 14000, // MT of cement produced (reduced from 16000)
          cost: 1190000, // $85/MT * 14000 MT
          duration: 480, // 8 hours in minutes
          impactCodeId: reducedSpeedImpact,
          oeeCodeId: reducedSpeedOEE,
          reasonCodeId: processUpsetReason,
          lossCategory: 'Reduced Speed',
          operatorName: 'Mansour Al-Qahtani',
          shift: 'Day',
          crew: 'A',
          tenantId
        },

        // Material Shortage Events
        {
          eventId: 'EVT-017',
          unitId: units.find(u => u.name.includes('Raw Mill'))?.id,
          assetId: assets.find(a => a.name.includes('Raw Mill Ball Mill'))?.id,
          description: 'Limestone shortage causing raw mill production stoppage',
          startTime: new Date(Date.now() - 17 * 24 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() - 17 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
          eventType: 'ProductionLoss' as const,
          status: 'Closed' as const,
          source: 'Manual' as const,
          quantity: 600, // MT of raw meal lost
          cost: 18000, // $30/MT * 600 MT
          duration: 120, // 2 hours in minutes
          impactCodeId: materialShortageImpact,
          oeeCodeId: unplannedDowntimeOEE,
          reasonCodeId: materialShortageReason,
          lossCategory: 'Material Shortage',
          operatorName: 'Nawaf Al-Dosari',
          shift: 'Evening',
          crew: 'C',
          tenantId
        },
        {
          eventId: 'EVT-018',
          unitId: units.find(u => u.name.includes('Coal Mill'))?.id,
          assetId: assets.find(a => a.name.includes('Coal Mill'))?.id,
          description: 'Coal delivery delay affecting kiln fuel supply',
          startTime: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString(),
          eventType: 'ProductionLoss' as const,
          status: 'Closed' as const,
          source: 'Manual' as const,
          quantity: 1500, // MT of clinker lost
          cost: 127500, // $85/MT * 1500 MT
          duration: 180, // 3 hours in minutes
          impactCodeId: materialShortageImpact,
          oeeCodeId: unplannedDowntimeOEE,
          reasonCodeId: materialDelayReason,
          lossCategory: 'Material Shortage',
          operatorName: 'Saad Al-Mutairi',
          shift: 'Night',
          crew: 'B',
          tenantId
        },

        // Process Upset Events
        {
          eventId: 'EVT-019',
          unitId: units.find(u => u.name.includes('Kiln'))?.id,
          assetId: assets.find(a => a.name.includes('Rotary Kiln'))?.id,
          description: 'Kiln process upset due to feed composition variation',
          startTime: new Date(Date.now() - 19 * 24 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() - 19 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000).toISOString(),
          eventType: 'ProductionLoss' as const,
          status: 'Closed' as const,
          source: 'Manual' as const,
          quantity: 2000, // MT of clinker lost
          cost: 170000, // $85/MT * 2000 MT
          duration: 240, // 4 hours in minutes
          impactCodeId: processUpsetImpact,
          oeeCodeId: unplannedDowntimeOEE,
          reasonCodeId: processUpsetReason,
          lossCategory: 'Process Upset',
          operatorName: 'Khalid Al-Shammari',
          shift: 'Day',
          crew: 'A',
          tenantId
        },
        {
          eventId: 'EVT-020',
          unitId: units.find(u => u.name.includes('Cement Mill'))?.id,
          assetId: assets.find(a => a.name.includes('Cement Mill Ball Mill'))?.id,
          description: 'Cement mill process upset due to gypsum quality variation',
          startTime: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000 + 2.5 * 60 * 60 * 1000).toISOString(),
          eventType: 'ProductionLoss' as const,
          status: 'Closed' as const,
          source: 'Manual' as const,
          quantity: 425, // MT of cement lost
          cost: 36125, // $85/MT * 425 MT
          duration: 150, // 2.5 hours in minutes
          impactCodeId: processUpsetImpact,
          oeeCodeId: unplannedDowntimeOEE,
          reasonCodeId: materialDefectReason,
          lossCategory: 'Process Upset',
          operatorName: 'Majed Al-Otaibi',
          shift: 'Evening',
          crew: 'C',
          tenantId
        },

        // Additional Events for Comprehensive Coverage
        {
          eventId: 'EVT-021',
          unitId: units.find(u => u.name.includes('Packaging'))?.id,
          assetId: assets.find(a => a.name.includes('Packaging Machine'))?.id,
          description: 'Packaging machine startup losses during shift changeover',
          startTime: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000).toISOString(),
          eventType: 'ProductionLoss' as const,
          status: 'Closed' as const,
          source: 'Manual' as const,
          quantity: 100, // MT of bagged cement lost
          cost: 8500, // $85/MT * 100 MT
          duration: 60, // 1 hour in minutes
          impactCodeId: reducedSpeedImpact,
          oeeCodeId: startupLossesOEE,
          reasonCodeId: processUpsetReason,
          lossCategory: 'Startup Losses',
          operatorName: 'Fahad Al-Harbi',
          shift: 'Day',
          crew: 'A',
          tenantId
        },
        {
          eventId: 'EVT-022',
          unitId: units.find(u => u.name.includes('Quality Control'))?.id,
          assetId: assets.find(a => a.name.includes('X-Ray Fluorescence'))?.id,
          description: 'XRF analyzer calibration drift affecting quality control',
          startTime: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000 + 0.5 * 60 * 60 * 1000).toISOString(),
          eventType: 'IOW' as const,
          status: 'Closed' as const,
          source: 'Manual' as const,
          parameter: 'Calibration Accuracy',
          value: 2.5, // %
          limit: 1.0, // %
          limitType: 'High' as const,
          breachDuration: 30, // 30 minutes
          impactCodeId: qualityDefectsImpact,
          oeeCodeId: productionRejectsOEE,
          reasonCodeId: processUpsetReason,
          operatorName: 'Lab Technician',
          shift: 'Day',
          crew: 'QC',
          tenantId
        },
        {
          eventId: 'EVT-023',
          unitId: crusherUnitId,
          assetId: crusherAssetId,
          description: 'Primary crusher maintenance shutdown for liner replacement',
          startTime: new Date(Date.now() - 23 * 24 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() - 23 * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000).toISOString(),
          eventType: 'ProductionLoss' as const,
          status: 'Closed' as const,
          source: 'Manual' as const,
          quantity: 3200, // MT of crushed limestone lost
          cost: 96000, // $30/MT * 3200 MT
          duration: 480, // 8 hours in minutes
          impactCodeId: equipmentFailureImpact,
          oeeCodeId: plannedDowntimeOEE,
          reasonCodeId: processUpsetReason,
          lossCategory: 'Planned Maintenance',
          operatorName: 'Maintenance Team',
          shift: 'Day',
          crew: 'Maintenance',
          tenantId
        },
        {
          eventId: 'EVT-024',
          unitId: units.find(u => u.name.includes('Preheater'))?.id,
          assetId: assets.find(a => a.name.includes('Preheater'))?.id,
          description: 'Preheater cyclone blockage causing kiln feed interruption',
          startTime: new Date(Date.now() - 24 * 24 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() - 24 * 24 * 60 * 60 * 1000 + 1.5 * 60 * 60 * 1000).toISOString(),
          eventType: 'ProductionLoss' as const,
          status: 'Closed' as const,
          source: 'Manual' as const,
          quantity: 750, // MT of clinker lost
          cost: 63750, // $85/MT * 750 MT
          duration: 90, // 1.5 hours in minutes
          impactCodeId: processUpsetImpact,
          oeeCodeId: unplannedDowntimeOEE,
          reasonCodeId: processUpsetReason,
          lossCategory: 'Process Upset',
          operatorName: 'Abdullah Al-Ghamdi',
          shift: 'Night',
          crew: 'B',
          tenantId
        },
        {
          eventId: 'EVT-025',
          unitId: rawMillUnitId,
          assetId: rawMillBallMillAssetId,
          description: 'Raw mill grinding media replacement causing production loss',
          startTime: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000 + 6 * 60 * 60 * 1000).toISOString(),
          eventType: 'ProductionLoss' as const,
          status: 'Closed' as const,
          source: 'Manual' as const,
          quantity: 1800, // MT of raw meal lost
          cost: 54000, // $30/MT * 1800 MT
          duration: 360, // 6 hours in minutes
          impactCodeId: equipmentFailureImpact,
          oeeCodeId: plannedDowntimeOEE,
          reasonCodeId: processUpsetReason,
          lossCategory: 'Planned Maintenance',
          operatorName: 'Maintenance Team',
          shift: 'Day',
          crew: 'Maintenance',
          tenantId
        }
      ].filter(event => event.unitId && event.assetId);

      console.log(`🚨 Creating ${events.length} cement industry production events...`);
      
      for (const eventData of events) {
        try {
          const createdEvent = await masterDataService.createProductionEvent(eventData);
          console.log(`✅ Created event: ${createdEvent.description} (${createdEvent.eventId})`);
        } catch (error) {
          console.error(`❌ Failed to create event: ${eventData.description}`, error);
        }
      }

      console.log(`✅ Cement industry production events seeded (${events.length} events)`);
    } catch (error) {
      console.warn('Could not create cement industry production events:', error);
    }
  }

  // Seed additional events specifically for RCA investigations
  private async seedCementRCAEvents(tenantId: string): Promise<void> {
    console.log('🚨 Seeding RCA-specific production events...');
    
    try {
      const units = await masterDataService.getUnits();
      const assets = await masterDataService.getAssets({ tenantId });
      const impactCodes = await masterDataService.getImpactCodes({ tenantId });
      const oeeCodes = await masterDataService.getOEECodes({ tenantId });
      const reasonCodes = await masterDataService.getReasonCodes({ tenantId });

      if (units.length === 0 || assets.length === 0) {
        console.warn('No units or assets found, skipping RCA events');
        return;
      }

      // Find relevant codes
      const equipmentFailureImpact = impactCodes.find(ic => ic.name.includes('Equipment Breakdown'))?.id;
      const qualityDefectsImpact = impactCodes.find(ic => ic.name.includes('Off-Spec Product'))?.id;
      const reducedSpeedImpact = impactCodes.find(ic => ic.name.includes('Reduced Speed'))?.id;

      // Find unit and asset IDs
      const kilnUnitId = units.find(u => u.name.includes('Kiln'))?.id;
      const rawMillUnitId = units.find(u => u.name.includes('Raw Mill'))?.id;
      const cementMillUnitId = units.find(u => u.name.includes('Cement Mill'))?.id;

      const rcaEvents = [
        {
          eventId: 'RCA-KILN-001',
          description: 'Rotary Kiln Refractory Lining Failure - Emergency Shutdown',
          startTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000).toISOString(),
          duration: 4 * 60, // 4 hours in minutes
          unitId: kilnUnitId,
          assetId: assets.find(a => a.name.includes('Kiln'))?.id,
          impactCodeId: equipmentFailureImpact,
          oeeCodeId: oeeCodes.find(oc => oc.name.includes('Equipment Failure'))?.id,
          reasonCodeId: reasonCodes.find(rc => rc.name.includes('Refractory'))?.id,
          severity: 'Critical' as const,
          status: 'Closed' as const,
          source: 'Manual' as const,
          eventType: 'FailureWO' as const,
          productionLoss: 2000, // MT clinker
          costImpact: 50000, // USD
          tenantId
        },
        {
          eventId: 'RCA-MOTOR-001',
          description: 'Raw Mill Motor Bearing Failure - Production Interruption',
          startTime: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
          duration: 2 * 60, // 2 hours in minutes
          unitId: rawMillUnitId,
          assetId: assets.find(a => a.name.includes('Raw Mill'))?.id,
          impactCodeId: equipmentFailureImpact,
          oeeCodeId: oeeCodes.find(oc => oc.name.includes('Equipment Failure'))?.id,
          reasonCodeId: reasonCodes.find(rc => rc.name.includes('Motor'))?.id,
          severity: 'High' as const,
          status: 'Closed' as const,
          source: 'Manual' as const,
          eventType: 'FailureWO' as const,
          productionLoss: 1500, // MT raw meal
          costImpact: 30000, // USD
          tenantId
        },
        {
          eventId: 'RCA-GEARBOX-001',
          description: 'Cement Mill Gearbox Failure - Quality Impact',
          startTime: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000).toISOString(),
          duration: 1 * 60, // 1 hour in minutes
          unitId: cementMillUnitId,
          assetId: assets.find(a => a.name.includes('Cement Mill'))?.id,
          impactCodeId: qualityDefectsImpact,
          oeeCodeId: oeeCodes.find(oc => oc.name.includes('Quality Issue'))?.id,
          reasonCodeId: reasonCodes.find(rc => rc.name.includes('Gearbox'))?.id,
          severity: 'Medium' as const,
          status: 'Closed' as const,
          source: 'Manual' as const,
          eventType: 'ProductionLoss' as const,
          productionLoss: 800, // MT cement
          costImpact: 15000, // USD
          tenantId
        }
      ].filter(event => event.unitId && event.assetId);

      for (const eventData of rcaEvents) {
        await masterDataService.createProductionEvent(eventData);
      }

      console.log('✅ RCA-specific production events seeded');
    } catch (error) {
      console.warn('Could not create RCA-specific production events:', error);
    }
  }

  // Seed cement industry RCA templates
  private async seedCementRCATemplates(tenantId: string): Promise<void> {
    console.log('📋 Seeding comprehensive cement industry RCA templates...');
    
    try {
      const templates = [
        {
          name: 'Cement Kiln Failure Investigation',
          description: 'Comprehensive template for cement kiln failure root cause analysis with 5P methodology',
          category: 'Equipment',
          logicTreeStructure: {
            nodes: [
              {
                id: 'root_1',
                name: 'Cement Kiln Failure Occurred',
                code: 'CKF001',
                category: 'Root',
                description: 'Cement kiln failure has been reported',
                note: 'Initial kiln failure event - document failure mode and impact',
                finding: false,
                children: [
                  {
                    id: 'why_1',
                    name: 'Why did the kiln fail?',
                    code: 'W001',
                    category: 'Why',
                    description: 'Primary why question to identify failure mechanism',
                    note: 'Investigate all possible failure modes systematically',
                    finding: false,
                    children: [
                      {
                        id: 'cause_1',
                        name: 'Refractory lining failure',
                        code: 'C001',
                        category: 'Parts',
                        description: 'Refractory lining deterioration or failure',
                        note: 'Check refractory condition, thermal cycling, chemical attack',
                        finding: true,
                        children: [
                          {
                            id: 'why_2',
                            name: 'Why did refractory fail?',
                            code: 'W002',
                            category: 'Why',
                            description: 'Secondary why for refractory failure',
                            note: 'Investigate thermal, chemical, and mechanical factors',
                            finding: false,
                            children: [
                              {
                                id: 'cause_thermal',
                                name: 'Thermal cycling damage',
                                code: 'C101',
                                category: 'Process',
                                description: 'Excessive thermal cycling causing refractory stress',
                                note: 'Review temperature profiles and start-up procedures',
                                finding: true,
                                children: []
                              },
                              {
                                id: 'cause_chemical',
                                name: 'Chemical attack',
                                code: 'C102',
                                category: 'Parts',
                                description: 'Alkali attack on refractory lining',
                                note: 'Analyze raw material composition and kiln atmosphere',
                                finding: true,
                                children: []
                              }
                            ]
                          }
                        ]
                      },
                      {
                        id: 'cause_2',
                        name: 'Mechanical failure',
                        code: 'C002',
                        category: 'Parts',
                        description: 'Mechanical component failure',
                        note: 'Check mechanical systems, bearings, and alignment',
                        finding: true,
                        children: [
                          {
                            id: 'why_3',
                            name: 'Why did mechanical failure occur?',
                            code: 'W003',
                            category: 'Why',
                            description: 'Secondary why for mechanical failure',
                            note: 'Investigate maintenance, operation, and design factors',
                            finding: false,
                            children: [
                              {
                                id: 'cause_maintenance',
                                name: 'Inadequate maintenance',
                                code: 'C201',
                                category: 'Process',
                                description: 'Lack of preventive maintenance',
                                note: 'Review maintenance schedules and procedures',
                                finding: true,
                                children: []
                              },
                              {
                                id: 'cause_operation',
                                name: 'Operational issues',
                                code: 'C202',
                                category: 'People',
                                description: 'Operator error or improper operation',
                                note: 'Review operator training and procedures',
                                finding: true,
                                children: []
                              }
                            ]
                          }
                        ]
                      },
                      {
                        id: 'cause_3',
                        name: 'Process upset',
                        code: 'C003',
                        category: 'Process',
                        description: 'Process parameter deviation',
                        note: 'Review process parameters and control systems',
                        finding: true,
                        children: [
                          {
                            id: 'why_4',
                            name: 'Why did process upset occur?',
                            code: 'W004',
                            category: 'Why',
                            description: 'Secondary why for process upset',
                            note: 'Investigate control systems and raw material quality',
                            finding: false,
                            children: [
                              {
                                id: 'cause_control',
                                name: 'Control system failure',
                                code: 'C301',
                                category: 'Parts',
                                description: 'Control system malfunction or sensor failure',
                                note: 'Check control systems and instrumentation',
                                finding: true,
                                children: []
                              },
                              {
                                id: 'cause_material',
                                name: 'Raw material variability',
                                code: 'C302',
                                category: 'Parts',
                                description: 'Raw material quality issues',
                                note: 'Review raw material quality control',
                                finding: true,
                                children: []
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          },
          verificationChecklist: [
            'Kiln inspection completed',
            'Refractory lining condition assessed',
            'Process parameters reviewed',
            'Maintenance records checked',
            'Operator interviews conducted',
            'Control system analysis completed',
            'Raw material quality reviewed',
            'Root cause identified and documented',
            'Preventive measures defined',
            'Implementation plan created',
            'Cost-benefit analysis completed',
            'Stakeholder approval obtained'
          ],
          organizationId: 'demo-org',
          tenantId
        },
        {
          name: 'Motor Failure Investigation',
          description: 'Comprehensive template for motor failure root cause analysis',
          category: 'Equipment',
          logicTreeStructure: {
            nodes: [
              {
                id: 'root_motor',
                name: 'Motor Failure Occurred',
                code: 'MF001',
                category: 'Root',
                description: 'Motor failure has been reported',
                note: 'Document motor type, location, and failure symptoms',
                finding: false,
                children: [
                  {
                    id: 'why_motor',
                    name: 'Why did the motor fail?',
                    code: 'WM001',
                    category: 'Why',
                    description: 'Primary why question for motor failure',
                    note: 'Investigate electrical, mechanical, and operational factors',
                    finding: false,
                    children: [
                      {
                        id: 'cause_bearing',
                        name: 'Bearing failure',
                        code: 'CB001',
                        category: 'Parts',
                        description: 'Motor bearing failure',
                        note: 'Check bearing condition, lubrication, and alignment',
                        finding: true,
                        children: []
                      },
                      {
                        id: 'cause_electrical',
                        name: 'Electrical failure',
                        code: 'CE001',
                        category: 'Parts',
                        description: 'Electrical component failure',
                        note: 'Check windings, insulation, and electrical connections',
                        finding: true,
                        children: []
                      },
                      {
                        id: 'cause_overload',
                        name: 'Overload condition',
                        code: 'CO001',
                        category: 'Process',
                        description: 'Motor overload causing failure',
                        note: 'Review load conditions and protection settings',
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
            'Motor inspection completed',
            'Bearing condition assessed',
            'Electrical system checked',
            'Load analysis completed',
            'Vibration analysis performed',
            'Lubrication system reviewed',
            'Maintenance records checked',
            'Root cause identified and documented',
            'Preventive measures defined',
            'Implementation plan created'
          ],
          organizationId: 'demo-org',
          tenantId
        }
      ];

      for (const templateData of templates) {
        await masterDataService.createRCATemplate(templateData);
      }

      console.log('✅ Comprehensive cement industry RCA templates seeded');
    } catch (error) {
      console.warn('Could not create comprehensive cement industry RCA templates:', error);
    }
  }

  // Seed cement industry RCA investigations
  private async seedCementRCAInvestigations(tenantId: string): Promise<void> {
    console.log('🔍 Seeding comprehensive cement industry RCA investigations...');
    
    try {
      const templates = await masterDataService.getRCATemplates({ tenantId });
      const events = await masterDataService.getProductionEvents({ tenantId });
      const assets = await masterDataService.getAssets({ tenantId });
      const units = await masterDataService.getUnits();
      
      if (templates.length === 0 || events.length === 0) {
        console.warn('No RCA templates or events found, skipping RCA investigations');
        return;
      }

      // Create comprehensive RCA investigations with full data
      const investigations = [
        {
          title: 'Rotary Kiln Refractory Lining Failure Investigation',
          description: 'Comprehensive investigation into the rotary kiln refractory lining failure that caused emergency shutdown and production loss of 2,000 MT clinker',
          status: 'Analysis' as const,
          teamLeadId: 'demo-user-1',
          teamMemberIds: ['demo-user-1', 'demo-user-2', 'demo-user-3'],
          priority: 'Critical' as const,
          targetCloseDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          templateId: templates[0]?.id,
          eventId: events.find(e => e.description.includes('refractory') || e.description.includes('kiln'))?.id,
          teamCharter: 'Identify root cause of refractory failure and implement preventive measures to avoid future production losses',
          rootCause: 'Thermal cycling and chemical attack caused refractory lining degradation in the burning zone',
          actualCloseDate: null,
          approvalStatus: 'Pending' as const,
          closureStatus: 'Pending' as const,
          tenantId,
          // Comprehensive evidence with 5P categorization
          evidence: [
            {
              id: 'ev_001',
              rcaId: '', // Will be set after RCA creation
              title: 'Refractory Lining Visual Inspection',
              description: 'Visual inspection of refractory lining showing severe degradation in burning zone',
              type: 'Photo' as const,
              collectedBy: 'demo-user-1',
              collectedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
              createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
              updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
              tenantId,
              category: 'Equipment Inspection',
              location: 'Kiln Burning Zone',
              timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
              relatedAssetId: assets.find(a => a.name.includes('Kiln'))?.id || '',
              severity: 'High' as const,
              tags: ['refractory', 'kiln', 'burning-zone', 'degradation'],
              verified: true,
              fiveP: 'Parts' as const,
              task: 'Document refractory condition and identify failure patterns',
              dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
              status: 'completed' as const,
              attachments: []
            },
            {
              id: 'ev_002',
              rcaId: '',
              title: 'Temperature Profile Analysis',
              description: 'Analysis of kiln temperature profiles showing excessive thermal cycling',
              type: 'Time Series' as const,
              collectedBy: 'demo-user-2',
              collectedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
              createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
              updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
              tenantId,
              category: 'Process Data',
              location: 'Control Room',
              timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
              relatedAssetId: assets.find(a => a.name.includes('Kiln'))?.id || '',
              severity: 'High' as const,
              tags: ['temperature', 'thermal-cycling', 'process-data'],
              verified: true,
              fiveP: 'Process' as const,
              task: 'Analyze temperature trends and identify thermal cycling patterns',
              dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
              status: 'completed' as const,
              attachments: [],
              // Time series specific fields
              tsProvider: 'pi' as const,
              tsStreams: [
                { id: 'kiln_temp_burning_zone', name: 'Kiln Burning Zone Temperature', units: '°C' },
                { id: 'kiln_temp_preheater', name: 'Preheater Temperature', units: '°C' }
              ],
              tsMode: 'interpolated' as const,
              tsStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
              tsEnd: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
              tsInterval: '1m',
              tsIntervals: 10080,
              tsSummaryTypes: 'min,max,avg',
              tsStreamsNote: 'Temperature data from PI system for thermal cycling analysis'
            },
            {
              id: 'ev_003',
              rcaId: '',
              title: 'Maintenance Records Review',
              description: 'Review of maintenance records showing last refractory replacement 18 months ago',
              type: 'Document' as const,
              collectedBy: 'demo-user-3',
              collectedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
              createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
              updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
              tenantId,
              category: 'Maintenance Records',
              location: 'Maintenance Office',
              timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
              relatedAssetId: assets.find(a => a.name.includes('Kiln'))?.id || '',
              severity: 'Medium' as const,
              tags: ['maintenance', 'refractory-replacement', 'records'],
              verified: true,
              fiveP: 'Paper' as const,
              task: 'Review maintenance history and identify maintenance gaps',
              dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
              status: 'completed' as const,
              attachments: []
            },
            {
              id: 'ev_004',
              rcaId: '',
              title: 'Operator Interview - Shift A',
              description: 'Interview with shift A operators regarding kiln operation and observed issues',
              type: 'Note' as const,
              collectedBy: 'demo-user-1',
              collectedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
              createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
              updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
              tenantId,
              category: 'Operator Feedback',
              location: 'Control Room',
              timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
              relatedAssetId: assets.find(a => a.name.includes('Kiln'))?.id || '',
              severity: 'Medium' as const,
              tags: ['operator-interview', 'shift-a', 'kiln-operation'],
              verified: true,
              fiveP: 'People' as const,
              task: 'Interview operators to gather operational insights',
              dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
              status: 'completed' as const,
              attachments: []
            },
            {
              id: 'ev_005',
              rcaId: '',
              title: 'Chemical Analysis of Refractory Samples',
              description: 'Chemical analysis showing alkali attack on refractory lining',
              type: 'Document' as const,
              collectedBy: 'demo-user-2',
              collectedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
              createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
              updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
              tenantId,
              category: 'Laboratory Analysis',
              location: 'Quality Lab',
              timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
              relatedAssetId: assets.find(a => a.name.includes('Kiln'))?.id || '',
              severity: 'High' as const,
              tags: ['chemical-analysis', 'alkali-attack', 'refractory-samples'],
              verified: true,
              fiveP: 'Parts' as const,
              task: 'Analyze refractory samples for chemical degradation',
              dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
              status: 'completed' as const,
              attachments: []
            }
          ],
          // Logic tree based on template with additional nodes
          logicTree: [
            {
              id: 'root_1',
              rcaId: '', // Will be set after RCA creation
              parentId: null,
              question: 'Cement Kiln Failure Occurred',
              answer: 'Cement kiln failure has been reported',
              type: 'Root' as const,
              code: 'CKF001',
              note: 'Initial kiln failure event - refractory lining failure in burning zone',
              finding: false,
              verified: false,
              evidenceIds: [],
              position: { x: 100, y: 100 },
              severity: 'Critical',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              tenantId
            },
            {
              id: 'why_1',
              rcaId: '',
              parentId: 'root_1',
              question: 'Why did the kiln fail?',
              answer: 'Refractory lining failure in burning zone',
              type: 'Why' as const,
              code: 'W001',
              note: 'Primary why question - refractory lining degradation',
              finding: false,
              verified: false,
              evidenceIds: [],
              position: { x: 100, y: 200 },
              severity: 'High',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              tenantId
            },
            {
              id: 'cause_1',
              rcaId: '',
              parentId: 'why_1',
              question: 'Refractory lining failure',
              answer: 'Thermal cycling and chemical attack caused refractory degradation',
              type: 'Cause' as const,
              code: 'C001',
              note: 'Root cause identified - thermal cycling and alkali attack',
              finding: true,
              verified: true,
              evidenceIds: ['ev_001', 'ev_002', 'ev_005'],
              position: { x: 100, y: 300 },
              severity: 'High',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              tenantId
            },
            {
              id: 'why_2',
              rcaId: '',
              parentId: 'cause_1',
              question: 'Why did thermal cycling occur?',
              answer: 'Frequent kiln start-ups and shutdowns',
              type: 'Why' as const,
              code: 'W002',
              note: 'Secondary why question - operational pattern analysis',
              finding: false,
              verified: false,
              evidenceIds: [],
              position: { x: 100, y: 400 },
              severity: 'Medium',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              tenantId
            },
            {
              id: 'cause_2',
              rcaId: '',
              parentId: 'why_2',
              question: 'Frequent start-ups and shutdowns',
              answer: 'Raw material quality issues causing process instability',
              type: 'Cause' as const,
              code: 'C002',
              note: 'Contributing cause - raw material variability',
              finding: true,
              verified: true,
              evidenceIds: ['ev_003', 'ev_004'],
              position: { x: 100, y: 500 },
              severity: 'Medium',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              tenantId
            }
          ],
          // Event diagram data
          eventDiagram: {
            nodes: [
              {
                id: 'event_1',
                data: {
                  label: 'Kiln Refractory Failure',
                  type: 'Failure',
                  timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
                  description: 'Refractory lining failure in burning zone',
                  asset: 'Rotary Kiln #1',
                  severity: 'Critical'
                },
                position: { x: 100, y: 100 }
              },
              {
                id: 'event_2',
                data: {
                  label: 'Emergency Shutdown',
                  type: 'Action',
                  timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(),
                  description: 'Emergency shutdown initiated due to refractory failure',
                  asset: 'Rotary Kiln #1',
                  severity: 'Critical'
                },
                position: { x: 300, y: 100 }
              },
              {
                id: 'event_3',
                data: {
                  label: 'Production Loss',
                  type: 'Impact',
                  timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString(),
                  description: 'Production loss of 2,000 MT clinker',
                  asset: 'Kiln Line',
                  severity: 'High'
                },
                position: { x: 500, y: 100 }
              }
            ],
            edges: [
              {
                id: 'edge_1',
                source: 'event_1',
                target: 'event_2',
                label: 'Caused'
              },
              {
                id: 'edge_2',
                source: 'event_2',
                target: 'event_3',
                label: 'Resulted in'
              }
            ]
          },
          // Recommendations
          recommendations: [
            {
              id: 'rec_001',
              rcaId: '', // Will be set after RCA creation
              title: 'Implement Refractory Monitoring System',
              description: 'Install thermal imaging system to monitor refractory condition in real-time',
              priority: 'High' as const,
              assigneeId: 'demo-user-2',
              dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              status: 'Open' as const,
              estimatedCost: 50000,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              tenantId
            },
            {
              id: 'rec_002',
              rcaId: '',
              title: 'Improve Raw Material Quality Control',
              description: 'Implement stricter raw material quality control to reduce process variability',
              priority: 'Medium' as const,
              assigneeId: 'demo-user-3',
              dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
              status: 'In Progress' as const,
              estimatedCost: 25000,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              tenantId
            },
            {
              id: 'rec_003',
              rcaId: '',
              title: 'Refractory Replacement Schedule',
              description: 'Establish preventive maintenance schedule for refractory replacement every 12 months',
              priority: 'High' as const,
              assigneeId: 'demo-user-1',
              dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
              status: 'Open' as const,
              estimatedCost: 100000,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              tenantId
            }
          ]
        },
        {
          title: 'Raw Mill Motor Failure Root Cause Analysis',
          description: 'Investigation into the raw mill ball mill motor failure during peak production causing 1,500 MT raw meal production loss',
          status: 'Recommendations' as const,
          teamLeadId: 'demo-user-2',
          teamMemberIds: ['demo-user-2', 'demo-user-3', 'demo-user-1'],
          priority: 'High' as const,
          targetCloseDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
          templateId: templates[0]?.id,
          eventId: events.find(e => e.description.includes('motor') || e.description.includes('mill'))?.id,
          teamCharter: 'Prevent future motor failures through improved maintenance procedures and monitoring',
          rootCause: 'Bearing failure due to inadequate lubrication and vibration monitoring',
          actualCloseDate: null,
          approvalStatus: 'Approved' as const,
          approvedBy: 'demo-user-1',
          approvedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          approvalComments: 'Investigation completed satisfactorily. Recommendations are practical and cost-effective.',
          closureStatus: 'Pending' as const,
          tenantId,
          // Evidence for raw mill motor failure
          evidence: [
            {
              id: 'ev_006',
              rcaId: '',
              title: 'Motor Bearing Inspection',
              description: 'Visual inspection of failed motor bearing showing severe wear and lack of lubrication',
              type: 'Photo' as const,
              collectedBy: 'demo-user-2',
              collectedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
              createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
              updatedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
              tenantId,
              category: 'Equipment Inspection',
              location: 'Raw Mill Motor Room',
              timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
              relatedAssetId: assets.find(a => a.name.includes('Raw Mill'))?.id || '',
              severity: 'High' as const,
              tags: ['motor', 'bearing', 'lubrication', 'wear'],
              verified: true,
              fiveP: 'Parts' as const,
              task: 'Document bearing condition and identify failure mode',
              dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
              status: 'completed' as const,
              attachments: []
            },
            {
              id: 'ev_007',
              rcaId: '',
              title: 'Vibration Analysis Report',
              description: 'Vibration analysis showing excessive vibration levels prior to failure',
              type: 'Time Series' as const,
              collectedBy: 'demo-user-3',
              collectedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
              createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
              updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
              tenantId,
              category: 'Vibration Analysis',
              location: 'Raw Mill Motor Room',
              timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
              relatedAssetId: assets.find(a => a.name.includes('Raw Mill'))?.id || '',
              severity: 'High' as const,
              tags: ['vibration', 'motor', 'analysis', 'monitoring'],
              verified: true,
              fiveP: 'Process' as const,
              task: 'Analyze vibration trends and identify failure indicators',
              dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
              status: 'completed' as const,
              attachments: [],
              tsProvider: 'pi' as const,
              tsStreams: [
                { id: 'raw_mill_motor_vibration', name: 'Raw Mill Motor Vibration', units: 'mm/s' },
                { id: 'raw_mill_motor_current', name: 'Raw Mill Motor Current', units: 'A' }
              ],
              tsMode: 'interpolated' as const,
              tsStart: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
              tsEnd: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
              tsInterval: '5m',
              tsIntervals: 4032,
              tsSummaryTypes: 'min,max,avg',
              tsStreamsNote: 'Vibration and current data from PI system for motor analysis'
            }
          ],
          // Logic tree for motor failure
          logicTree: [
            {
              id: 'root_2',
              rcaId: '',
              parentId: null,
              question: 'Raw Mill Motor Failure Occurred',
              answer: 'Raw mill motor failure during peak production',
              type: 'Root' as const,
              code: 'RMF001',
              note: 'Motor failure causing production loss',
              finding: false,
              verified: false,
              evidenceIds: [],
              position: { x: 200, y: 100 },
              severity: 'High',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              tenantId
            },
            {
              id: 'why_3',
              rcaId: '',
              parentId: 'root_2',
              question: 'Why did the motor fail?',
              answer: 'Bearing failure due to inadequate maintenance',
              type: 'Why' as const,
              code: 'W003',
              note: 'Primary cause - bearing failure',
              finding: false,
              verified: false,
              evidenceIds: [],
              position: { x: 200, y: 200 },
              severity: 'High',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              tenantId
            },
            {
              id: 'cause_3',
              rcaId: '',
              parentId: 'why_3',
              question: 'Bearing failure',
              answer: 'Inadequate lubrication and vibration monitoring',
              type: 'Cause' as const,
              code: 'C003',
              note: 'Root cause - maintenance and monitoring gaps',
              finding: true,
              verified: true,
              evidenceIds: ['ev_006', 'ev_007'],
              position: { x: 200, y: 300 },
              severity: 'High',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              tenantId
            }
          ],
          // Event diagram for motor failure
          eventDiagram: {
            nodes: [
              {
                id: 'event_4',
                data: {
                  label: 'Motor Bearing Failure',
                  type: 'Failure',
                  timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
                  description: 'Motor bearing failure due to inadequate lubrication',
                  asset: 'Raw Mill Motor',
                  severity: 'High'
                },
                position: { x: 100, y: 200 }
              },
              {
                id: 'event_5',
                data: {
                  label: 'Motor Shutdown',
                  type: 'Action',
                  timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000 + 15 * 60 * 1000).toISOString(),
                  description: 'Emergency motor shutdown to prevent further damage',
                  asset: 'Raw Mill Motor',
                  severity: 'High'
                },
                position: { x: 300, y: 200 }
              },
              {
                id: 'event_6',
                data: {
                  label: 'Raw Mill Production Loss',
                  type: 'Impact',
                  timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(),
                  description: 'Production loss of 1,500 MT raw meal',
                  asset: 'Raw Mill Line',
                  severity: 'Medium'
                },
                position: { x: 500, y: 200 }
              }
            ],
            edges: [
              {
                id: 'edge_3',
                source: 'event_4',
                target: 'event_5',
                label: 'Triggered'
              },
              {
                id: 'edge_4',
                source: 'event_5',
                target: 'event_6',
                label: 'Caused'
              }
            ]
          },
          // Recommendations for motor failure
          recommendations: [
            {
              id: 'rec_004',
              rcaId: '',
              title: 'Implement Vibration Monitoring System',
              description: 'Install continuous vibration monitoring system for all critical motors',
              priority: 'High' as const,
              assigneeId: 'demo-user-3',
              dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
              status: 'In Progress' as const,
              estimatedCost: 75000,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              tenantId
            },
            {
              id: 'rec_005',
              rcaId: '',
              title: 'Improve Lubrication Schedule',
              description: 'Establish automated lubrication system and strict maintenance schedule',
              priority: 'High' as const,
              assigneeId: 'demo-user-2',
              dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
              status: 'Open' as const,
              estimatedCost: 30000,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              tenantId
            }
          ]
        },
        {
          title: 'Cement Mill Gearbox Failure Investigation',
          description: 'Investigation into cement mill gearbox failure causing production interruption and quality issues',
          status: 'Closure' as const,
          teamLeadId: 'demo-user-3',
          teamMemberIds: ['demo-user-3', 'demo-user-1'],
          priority: 'Medium' as const,
          targetCloseDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          templateId: templates[0]?.id,
          eventId: events.find(e => e.description.includes('gearbox') || e.description.includes('cement mill'))?.id,
          teamCharter: 'Identify root cause of gearbox failure and implement preventive measures',
          rootCause: 'Gear tooth fatigue due to misalignment and inadequate oil analysis program',
          actualCloseDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          approvalStatus: 'Approved' as const,
          approvedBy: 'demo-user-1',
          approvedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          approvalComments: 'Investigation completed successfully. All recommendations implemented.',
          closureStatus: 'Closed' as const,
          closedBy: 'demo-user-3',
          closedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          closureNotes: 'All recommendations implemented successfully. Gearbox alignment corrected and oil analysis program established.',
          tenantId,
          // Evidence for gearbox failure
          evidence: [
            {
              id: 'ev_008',
              rcaId: '',
              title: 'Gearbox Internal Inspection',
              description: 'Internal inspection showing gear tooth fatigue and wear patterns',
              type: 'Photo' as const,
              collectedBy: 'demo-user-3',
              collectedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
              createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
              updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
              tenantId,
              category: 'Equipment Inspection',
              location: 'Cement Mill Gearbox',
              timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
              relatedAssetId: assets.find(a => a.name.includes('Cement Mill'))?.id || '',
              severity: 'Medium' as const,
              tags: ['gearbox', 'gear-tooth', 'fatigue', 'wear'],
              verified: true,
              fiveP: 'Parts' as const,
              task: 'Document gear condition and identify failure patterns',
              dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
              status: 'completed' as const,
              attachments: []
            }
          ],
          // Logic tree for gearbox failure
          logicTree: [
            {
              id: 'root_3',
              rcaId: '',
              parentId: null,
              question: 'Cement Mill Gearbox Failure Occurred',
              answer: 'Gearbox failure causing production interruption',
              type: 'Root' as const,
              code: 'CMF001',
              note: 'Gearbox failure investigation',
              finding: false,
              verified: false,
              evidenceIds: [],
              position: { x: 300, y: 100 },
              severity: 'Medium',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              tenantId
            },
            {
              id: 'cause_4',
              rcaId: '',
              parentId: 'root_3',
              question: 'Gear tooth fatigue',
              answer: 'Misalignment and inadequate oil analysis program',
              type: 'Cause' as const,
              code: 'C004',
              note: 'Root cause identified and addressed',
              finding: true,
              verified: true,
              evidenceIds: ['ev_008'],
              position: { x: 300, y: 200 },
              severity: 'Medium',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              tenantId
            }
          ],
          // Event diagram for gearbox failure
          eventDiagram: {
            nodes: [
              {
                id: 'event_7',
                data: {
                  label: 'Gearbox Failure',
                  type: 'Failure',
                  timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
                  description: 'Gearbox gear tooth fatigue failure',
                  asset: 'Cement Mill Gearbox',
                  severity: 'Medium'
                },
                position: { x: 100, y: 300 }
              }
            ],
            edges: []
          },
          // Recommendations for gearbox failure
          recommendations: [
            {
              id: 'rec_006',
              rcaId: '',
              title: 'Implement Oil Analysis Program',
              description: 'Establish regular oil analysis program for all gearboxes',
              priority: 'Medium' as const,
              assigneeId: 'demo-user-3',
              dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
              status: 'Completed' as const,
              estimatedCost: 15000,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              tenantId
            },
            {
              id: 'rec_007',
              rcaId: '',
              title: 'Correct Gearbox Alignment',
              description: 'Perform precision alignment of cement mill gearbox',
              priority: 'High' as const,
              assigneeId: 'demo-user-1',
              dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
              status: 'Completed' as const,
              estimatedCost: 20000,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              tenantId
            }
          ]
        }
      ].filter(inv => inv.templateId && inv.eventId);

      // Create RCA investigations with full data
      for (const investigationData of investigations) {
        const rca = await masterDataService.createRCA(investigationData);
        
        // Update evidence and logic tree with RCA ID
        if (rca.evidence && rca.evidence.length > 0) {
          const updatedEvidence = rca.evidence.map(ev => ({ ...ev, rcaId: rca.id }));
          await masterDataService.updateRCA(rca.id, { evidence: updatedEvidence });
        }
        
        if (rca.logicTree && rca.logicTree.length > 0) {
          const updatedLogicTree = rca.logicTree.map(node => ({ ...node, rcaId: rca.id }));
          await masterDataService.updateRCA(rca.id, { logicTree: updatedLogicTree });
        }
        
        if (rca.recommendations && rca.recommendations.length > 0) {
          const updatedRecommendations = rca.recommendations.map(rec => ({ ...rec, rcaId: rca.id }));
          await masterDataService.updateRCA(rca.id, { recommendations: updatedRecommendations });
        }
      }

      console.log('✅ Comprehensive cement industry RCA investigations seeded with full data');
    } catch (error) {
      console.warn('Could not create comprehensive cement industry RCA investigations:', error);
    }
  }

  // Seed cement industry production losses
  private async seedCementProductionLosses(tenantId: string): Promise<void> {
    console.log('📉 Seeding cement industry production losses...');
    
    try {
      const plans = await masterDataService.getProductionPlans({ tenantId });
      
      if (plans.length === 0) {
        console.warn('No production plans found, skipping production losses');
        return;
      }

      const losses = [
        {
          planId: plans.find(p => p.name.includes('Clinker'))?.id,
          period: '2024-01-15',
          actual: 18000, // MT
          shortRangePlan: 20000, // MT
          losses: 2000, // MT
          unaccountedLoss: 0,
          action: 'Reconcile' as const,
          tenantId
        },
        {
          planId: plans.find(p => p.name.includes('Raw Meal'))?.id,
          period: '2024-01-15',
          actual: 16500, // MT
          shortRangePlan: 18000, // MT
          losses: 1500, // MT
          unaccountedLoss: 0,
          action: 'RCA Required' as const,
          tenantId
        },
        {
          planId: plans.find(p => p.name.includes('Cement'))?.id,
          period: '2024-01-15',
          actual: 12000, // MT
          shortRangePlan: 13000, // MT
          losses: 1000, // MT
          unaccountedLoss: 0,
          action: 'Closed' as const,
          tenantId
        },
        {
          planId: plans.find(p => p.name.includes('Packaging'))?.id,
          period: '2024-01-15',
          actual: 10000, // MT
          shortRangePlan: 11000, // MT
          losses: 1000, // MT
          unaccountedLoss: 0,
          action: 'Reconcile' as const,
          tenantId
        }
      ].filter(loss => loss.planId);

      for (const lossData of losses) {
        await masterDataService.createProductionLoss(lossData);
      }

      console.log('✅ Cement industry production losses seeded');
    } catch (error) {
      console.warn('Could not create cement industry production losses:', error);
    }
  }

  // Seed cement industry OEE summaries
  private async seedCementOEESummaries(tenantId: string): Promise<void> {
    console.log('📊 Seeding cement industry OEE summaries...');
    
    try {
      const plans = await masterDataService.getProductionPlans({ tenantId });
      
      if (plans.length === 0) {
        console.warn('No production plans found, skipping OEE summaries');
        return;
      }

      const oeeSummaries = [
        {
          planId: plans.find(p => p.name.includes('Clinker'))?.id,
          period: '2024-01-15',
          availability: 85.5, // %
          performance: 92.3, // %
          quality: 98.7, // %
          oee: 78.2, // %
          overallOEE: 78.2, // %
          plannedProductionTime: 720, // minutes
          actualProductionTime: 616, // minutes
          goodOutput: 18000, // MT
          totalOutput: 18250, // MT
          tenantId
        },
        {
          planId: plans.find(p => p.name.includes('Raw Meal'))?.id,
          period: '2024-01-15',
          availability: 88.2, // %
          performance: 89.5, // %
          quality: 99.1, // %
          oee: 78.1, // %
          overallOEE: 78.1, // %
          plannedProductionTime: 960, // minutes
          actualProductionTime: 847, // minutes
          goodOutput: 16500, // MT
          totalOutput: 16650, // MT
          tenantId
        },
        {
          planId: plans.find(p => p.name.includes('Cement'))?.id,
          period: '2024-01-15',
          availability: 91.3, // %
          performance: 94.7, // %
          quality: 97.8, // %
          oee: 84.5, // %
          overallOEE: 84.5, // %
          plannedProductionTime: 960, // minutes
          actualProductionTime: 876, // minutes
          goodOutput: 12000, // MT
          totalOutput: 12270, // MT
          tenantId
        },
        {
          planId: plans.find(p => p.name.includes('Packaging'))?.id,
          period: '2024-01-15',
          availability: 95.2, // %
          performance: 96.8, // %
          quality: 99.5, // %
          oee: 91.8, // %
          overallOEE: 91.8, // %
          plannedProductionTime: 720, // minutes
          actualProductionTime: 685, // minutes
          goodOutput: 10000, // MT
          totalOutput: 10050, // MT
          tenantId
        }
      ].filter(oee => oee.planId);

      for (const oeeData of oeeSummaries) {
        await masterDataService.createOEESummary(oeeData);
      }

      console.log('✅ Cement industry OEE summaries seeded');
    } catch (error) {
      console.warn('Could not create cement industry OEE summaries:', error);
    }
  }

  // Seed cement industry dashboard data
  private async seedCementDashboardData(tenantId: string): Promise<void> {
    console.log('📊 Seeding cement industry dashboard data...');
    
    try {
      // Skip dashboard configuration seeding for now due to interface complexity
      console.log('⚠️ Dashboard configuration seeding skipped - interface not fully defined');
      console.log('✅ Cement industry dashboard data seeding completed (skipped)');
    } catch (error) {
      console.warn('Could not create cement industry dashboard data:', error);
    }
  }

  // Verify cement industry data
  private async verifyCementIndustryData(tenantId: string): Promise<void> {
    console.log('🔍 Verifying cement industry data...');
    console.log(`   Using Tenant ID for verification: ${tenantId}`);
    
    try {
      const [organizations, tenants, units, products, plans, events, templates, investigations, losses, oeeSummaries, impactCodes, oeeCodes, reasonCodes, rcaCauseCodes, verificationCodes] = await Promise.all([
        masterDataService.getOrganizations(),
        masterDataService.getTenants(),
        masterDataService.getUnits(),
        masterDataService.getProducts(),
        masterDataService.getProductionPlans({ tenantId }),
        masterDataService.getProductionEvents({ tenantId }),
        masterDataService.getRCATemplates({ tenantId }),
        masterDataService.getRCAs({ tenantId }),
        masterDataService.getProductionLosses({ tenantId }),
        masterDataService.getOEESummaries({ tenantId }),
        masterDataService.getImpactCodes({ tenantId }),
        masterDataService.getOEECodes({ tenantId }),
        masterDataService.getReasonCodes({ tenantId }),
        masterDataService.getRCACauseCodes({ tenantId }),
        masterDataService.getVerificationStatusCodes({ tenantId })
      ]);

      console.log('📈 Cement Industry Data Verification:');
      console.log(`   - Organizations: ${organizations.length} (${organizations[0]?.name || 'None'})`);
      if (organizations.length > 0) {
        console.log(`     → Org ID: ${organizations[0].id}, Name: ${organizations[0].name}`);
      }
      console.log(`   - Tenants: ${tenants.length} (${tenants[0]?.name || 'None'})`);
      if (tenants.length > 0) {
        console.log(`     → Tenant ID: ${tenants[0].id}, Name: ${tenants[0].name}`);
      }
      console.log(`   - Cement Units: ${units.length}`);
      console.log(`   - Cement Products: ${products.length}`);
      console.log(`   - Production Plans: ${plans.length}`);
      console.log(`   - Production Events: ${events.length}`);
      console.log(`   - RCA Templates: ${templates.length}`);
      console.log(`   - RCA Investigations: ${investigations.length}`);
      console.log(`   - Production Losses: ${losses.length}`);
      console.log(`   - OEE Summaries: ${oeeSummaries.length}`);
      console.log(`   - Impact Codes: ${impactCodes.length}`);
      console.log(`   - OEE Codes: ${oeeCodes.length}`);
      console.log(`   - Reason Codes: ${reasonCodes.length}`);
      console.log(`   - RCA Cause Codes: ${rcaCauseCodes.length}`);
      console.log(`   - Verification Status Codes: ${verificationCodes.length}`);

      // Debug: Show sample data with tenant IDs
      if (impactCodes.length > 0) {
        console.log('📋 Sample Impact Code:', { code: impactCodes[0].code, name: impactCodes[0].name, tenantId: impactCodes[0].tenantId });
      }
      if (oeeCodes.length > 0) {
        console.log('📋 Sample OEE Code:', { code: oeeCodes[0].code, name: oeeCodes[0].name, tenantId: oeeCodes[0].tenantId });
      }
      if (reasonCodes.length > 0) {
        console.log('📋 Sample Reason Code:', { code: reasonCodes[0].code, name: reasonCodes[0].name, tenantId: reasonCodes[0].tenantId });
      }
      if (products.length > 0) {
        console.log('📦 Sample Product:', { code: products[0].code, name: products[0].name });
      }
      if (units.length > 0) {
        console.log('🏭 Sample Unit:', { code: units[0].code, name: units[0].name, tenantId: units[0].tenantId });
      }
      if (plans.length > 0) {
        console.log('📋 Sample production plan:', plans[0].name);
      }
      if (events.length > 0) {
        console.log('🚨 Sample production event:', events[0].description);
      }

      // Detailed code breakdown
      console.log('\n📊 Detailed Code Statistics:');
      console.log(`   Impact Codes breakdown:`);
      console.log(`     - Availability: ${impactCodes.filter(c => c.category === 'Availability').length}`);
      console.log(`     - Performance: ${impactCodes.filter(c => c.category === 'Performance').length}`);
      console.log(`     - Quality: ${impactCodes.filter(c => c.category === 'Quality').length}`);
      console.log(`   OEE Codes breakdown:`);
      console.log(`     - Planned: ${oeeCodes.filter(c => c.category === 'Planned').length}`);
      console.log(`     - Unplanned: ${oeeCodes.filter(c => c.category === 'Unplanned').length}`);
      console.log(`   Reason Codes breakdown:`);
      console.log(`     - Top Level: ${reasonCodes.filter(c => !c.parentId).length}`);
      console.log(`     - With Parents: ${reasonCodes.filter(c => c.parentId).length}`);

    } catch (error) {
      console.warn('Could not verify cement industry data:', error);
    }
  }

  // Clear cement industry data (public method)
  async clearCementIndustryData(tenantId: string): Promise<void> {
    console.log('🧹 Clearing cement industry data...');
    await this.clearExistingCementIndustryData(tenantId);
    this.isSeeded = false;
    console.log('✅ Cement industry data cleared');
  }

  // Auto-select first unit for plant selector
  private async autoSelectFirstUnit(tenantId: string): Promise<void> {
    console.log('🎯 Auto-selecting first cement unit...');
    
    try {
      const [organizations, tenants, units] = await Promise.all([
        masterDataService.getOrganizations(),
        masterDataService.getTenants(),
        masterDataService.getUnits()
      ]);
      
      // Find Hillal organization
      const hillalOrg = organizations.find(org => org.name === 'Hillal');
      // Use the tenant ID that was passed to the seeder, not the one from database
      const margoonTenant = tenants.find(tenant => tenant.id === tenantId) || tenants.find(tenant => tenant.name === 'Margoon Cement');
      
      // Get units for the specified tenant ID
      const margoonUnits = units.filter(unit => unit.tenantId === tenantId);
      const firstUnit = margoonUnits.find(unit => unit.name.includes('Raw Mill')) || margoonUnits[0]; // Select Raw Mill as first unit
      
      console.log(`Found ${margoonUnits.length} units for tenant ID: ${tenantId}`);
      if (firstUnit) {
        console.log(`Selected unit: ${firstUnit.name} (tenantId: ${firstUnit.tenantId})`);
      }
      
      if (hillalOrg && margoonTenant && firstUnit) {
        const selection = {
          organization: hillalOrg,
          tenant: margoonTenant,
          unit: firstUnit
        };
        
        // Save to IndexedDB
        const { storageService } = await import('./StorageService');
        await storageService.initialize();
        await storageService.setAppSetting('plantSelection', selection);
        
        console.log('✅ Auto-selected first unit:');
        console.log(`   - Organization: ${selection.organization.name} (${selection.organization.id})`);
        console.log(`   - Plant: ${selection.tenant.name} (${selection.tenant.id})`);
        console.log(`   - Unit: ${selection.unit.name} (${selection.unit.id})`);
        console.log(`   - Path: ${selection.organization.name} > ${selection.tenant.name} > ${selection.unit.name}`);
      } else {
        console.warn('Could not find all required elements for auto-selection:');
        console.warn(`  - Organization: ${hillalOrg ? '✅' : '❌'}`);
        console.warn(`  - Tenant: ${margoonTenant ? '✅' : '❌'}`);
        console.warn(`  - Unit: ${firstUnit ? '✅' : '❌'}`);
      }
    } catch (error) {
      console.warn('Could not auto-select first unit:', error);
    }
  }

  // Clear existing cement industry data (private method)
  private async clearExistingCementIndustryData(tenantId: string): Promise<void> {
    console.log('🧹 Clearing existing cement industry data...');
    
    try {
      // Clear production plans
      const plans = await masterDataService.getProductionPlans({ tenantId });
      for (const plan of plans) {
        await masterDataService.deleteProductionPlan(plan.id);
      }

      // Clear production events
      const events = await masterDataService.getProductionEvents({ tenantId });
      for (const event of events) {
        await masterDataService.deleteProductionEvent(event.id);
      }

      // Clear RCA templates
      const templates = await masterDataService.getRCATemplates({ tenantId });
      for (const template of templates) {
        await masterDataService.deleteRCATemplate(template.id);
      }

      // Clear RCA investigations
      const investigations = await masterDataService.getRCAs({ tenantId });
      for (const investigation of investigations) {
        await masterDataService.deleteRCA(investigation.id);
      }

      // Clear production losses
      const losses = await masterDataService.getProductionLosses({ tenantId });
      for (const loss of losses) {
        await masterDataService.deleteProductionLoss(loss.id);
      }

      // Clear OEE summaries
      const oeeSummaries = await masterDataService.getOEESummaries({ tenantId });
      for (const oee of oeeSummaries) {
        await masterDataService.deleteOEESummary(oee.id);
      }

      // Clear assets
      const assets = await masterDataService.getAssets({ tenantId });
      for (const asset of assets) {
        await masterDataService.deleteAsset(asset.id);
      }

      // Clear units (cement industry specific)
      const units = await masterDataService.getUnits();
      const cementUnits = units.filter(u => 
        u.name.includes('Raw Mill') || 
        u.name.includes('Kiln') || 
        u.name.includes('Cement Mill') || 
        u.name.includes('Packaging') ||
        u.name.includes('Coal Mill') ||
        u.name.includes('Crusher') ||
        u.name.includes('Preheater') ||
        u.name.includes('Quality Control')
      );
      for (const unit of cementUnits) {
        await masterDataService.deleteUnit(unit.id);
      }

      // Clear products (cement industry specific)
      const products = await masterDataService.getProducts();
      const cementProducts = products.filter(p => 
        p.name.includes('Cement') || 
        p.name.includes('OPC') || 
        p.name.includes('PPC') || 
        p.name.includes('PSC') ||
        p.name.includes('RHC') ||
        p.name.includes('LHC') ||
        p.name.includes('SRC') ||
        p.name.includes('White')
      );
      for (const product of cementProducts) {
        await masterDataService.deleteProduct(product.id);
      }

      // Clear master data codes
      const impactCodes = await masterDataService.getImpactCodes({ tenantId });
      for (const code of impactCodes) {
        await masterDataService.deleteImpactCode(code.id);
      }

      const oeeCodes = await masterDataService.getOEECodes({ tenantId });
      for (const code of oeeCodes) {
        await masterDataService.deleteOEECode(code.id);
      }

      const reasonCodes = await masterDataService.getReasonCodes({ tenantId });
      for (const code of reasonCodes) {
        await masterDataService.deleteReasonCode(code.id);
      }

      // Skip dashboard configurations clearing for now

      // Clear tenants and organizations
      const tenants = await masterDataService.getTenants();
      for (const tenant of tenants) {
        await masterDataService.deleteTenant(tenant.id);
      }

      const organizations = await masterDataService.getOrganizations();
      for (const org of organizations) {
        await masterDataService.deleteOrganization(org.id);
      }

      console.log('✅ Cement industry data cleared');
    } catch (error) {
      console.warn('Warning: Could not clear some cement industry data:', error);
    }
  }
}

// Global instance
export const globalCementIndustryDataSeeder = new CementIndustryDataSeeder();
