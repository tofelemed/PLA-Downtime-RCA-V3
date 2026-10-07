// Oil and Gas Industry (ADNOC) Data Seeder
import { masterDataService } from './MasterDataService';
import { storageService, User } from './StorageService';

export class OilGasDataSeeder {
  private isSeeded = false;
  private currentTenantId: string | null = null;

  async seedOilGasData(tenantId: string): Promise<void> {
    // Reset seeded flag to allow re-seeding
    this.isSeeded = false;

    try {
      console.log('🛢️ Starting ADNOC Oil and Gas industry data seeding...');
      console.log('📋 Target tenant ID:', tenantId);
      
      // NOTE: Clearing is done by seedOilGasData.ts before calling this method
      // So we skip the clear step here to avoid double-clearing
      
      // Check if org and tenant already exist (created by seedOilGasData.ts)
      const existingOrgs = await masterDataService.getOrganizations();
      const adnocOrg = existingOrgs.find(org => org.name === 'ADNOC');
      const existingTenants = await masterDataService.getTenants();
      const adnocTenant = existingTenants.find(t => t.name === 'ADNOC Onshore');
      
      let actualTenantId = tenantId;
      
      if (adnocOrg && adnocTenant) {
        console.log('🏢 Step 1/13: Using existing ADNOC organization and tenant...');
        console.log(`   Organization: ${adnocOrg.name}`);
        console.log(`   Tenant: ${adnocTenant.name} (ID: ${adnocTenant.id})`);
        actualTenantId = adnocTenant.id;
        this.currentTenantId = actualTenantId;
        console.log('✅ Step 1/13 completed');
      } else {
        // Seed in order of dependencies
        console.log('🏢 Step 1/13: Seeding organizations and tenants...');
        await this.seedOilGasOrganizationsAndTenants(tenantId);
        actualTenantId = this.currentTenantId || tenantId;
        console.log('✅ Step 1/13 completed');
      }
      
      console.log('👥 Step 2/13: Seeding users...');
      try {
        await this.seedOilGasUsers(actualTenantId);
        console.log('✅ Step 2/13 completed');
      } catch (error) {
        console.error('❌ Step 2/13 FAILED:', error);
        throw new Error(`Failed to seed users: ${error}`);
      }
      
      console.log('📊 Step 3/13: Seeding master data codes...');
      try {
        await this.seedOilGasMasterDataCodes(actualTenantId);
        console.log('✅ Step 3/13 completed');
      } catch (error) {
        console.error('❌ Step 3/13 FAILED:', error);
        throw new Error(`Failed to seed master data codes: ${error}`);
      }
      
      console.log('🏭 Step 4/13: Seeding units and assets...');
      try {
        await this.seedOilGasUnits(actualTenantId);
        console.log('✅ Step 4/13 completed');
      } catch (error) {
        console.error('❌ Step 4/13 FAILED:', error);
        throw new Error(`Failed to seed units and assets: ${error}`);
      }
      
      console.log('📦 Step 5/13: Seeding products...');
      await this.seedOilGasProducts();
      console.log('✅ Step 5/13 completed');
      
      console.log('📋 Step 6/13: Seeding production plans...');
      await this.seedOilGasProductionPlans(actualTenantId);
      console.log('✅ Step 6/13 completed');
      
      console.log('📊 Step 7/13: Seeding production events (including plan-linked events)...');
      await this.seedOilGasProductionEvents(actualTenantId);
      console.log('✅ Step 7/13 completed');
      
      console.log('🔍 Step 8/13: Seeding RCA events...');
      await this.seedOilGasRCAEvents(actualTenantId);
      console.log('✅ Step 8/13 completed');
      
      console.log('📝 Step 9/15: Seeding RCA templates & verification checklists...');
      await this.seedOilGasRCATemplates(actualTenantId);
      await this.seedOilGasVerificationChecklists(actualTenantId);
      console.log('✅ Step 9/15 completed');
      
      console.log('🔬 Step 10/13: Seeding RCA investigations...');
      await this.seedOilGasRCAInvestigations(actualTenantId);
      console.log('✅ Step 10/13 completed');
      
      console.log('📉 Step 11/13: Seeding production losses...');
      await this.seedOilGasProductionLosses(actualTenantId);
      console.log('✅ Step 11/13 completed');
      
      console.log('📊 Step 12/13: Seeding OEE summaries...');
      await this.seedOilGasOEESummaries(actualTenantId);
      console.log('✅ Step 12/13 completed');
      
      console.log('📊 Step 13/14: Seeding dashboard data...');
      await this.seedOilGasDashboardData(actualTenantId);
      console.log('✅ Step 13/14 completed');
      
      console.log('⚙️ Step 14/15: Initializing RCA Trigger Configuration...');
      try {
        const { rcaTriggerConfigService } = await import('./RCATriggerConfigService');
        // Get the organization ID (use adnocOrg from earlier or fetch fresh)
        const orgId = adnocOrg?.id || (await masterDataService.getOrganizations()).find(o => o.name === 'ADNOC')?.id || '';
        
        console.log('   Creating RCA trigger config for tenant:', actualTenantId);
        console.log('   Organization ID:', orgId);
        
        const createdConfig = await rcaTriggerConfigService.initializeDefaultConfig(
          actualTenantId,
          orgId,
          'OilAndGas'
        );
        
        console.log('   ✅ RCA Trigger Config Created:', {
          id: createdConfig.id,
          rules: createdConfig.rules.length,
          enabledRules: createdConfig.rules.filter(r => r.enabled).length,
          manualCreation: createdConfig.globalSettings.alwaysAllowManualCreation
        });
        
        console.log('✅ Step 14/15 completed');
      } catch (error) {
        console.error('❌ Step 14/15 FAILED:', error);
        console.error('   Error details:', error);
        console.warn('⚠️ Continuing without RCA trigger config');
      }
      
      console.log('📚 Step 15/15: Initializing RCA Analysis Configuration & Knowledge Base...');
      try {
        const { rcaAnalysisConfigService } = await import('./RCAAnalysisConfigService');
        const { rcaKnowledgeBaseService } = await import('./RCAKnowledgeBaseService');
        
        const orgId = adnocOrg?.id || (await masterDataService.getOrganizations()).find(o => o.name === 'ADNOC')?.id || '';
        
        // Create analysis configuration
        const analysisConfig = await rcaAnalysisConfigService.initializeDefaultConfig(
          actualTenantId,
          orgId,
          'OilAndGas'
        );
        
        console.log('   ✅ RCA Analysis Config Created:', {
          id: analysisConfig.id,
          enabledTools: Object.entries(analysisConfig.enabledTools).filter(([, enabled]) => enabled).map(([tool]) => tool)
        });
        
        // Create knowledge base entries from existing RCAs
        const rcas = await masterDataService.getRCAs({ tenantId: actualTenantId });
        const events = await masterDataService.getProductionEvents({ tenantId: actualTenantId });
        
        let knowledgeEntriesCreated = 0;
        for (const rca of rcas.filter(r => r.status === 'Closed')) {
          try {
            const event = events.find(e => e.id === rca.eventId);
            await rcaKnowledgeBaseService.createKnowledgeEntry(rca, event);
            knowledgeEntriesCreated++;
          } catch (error) {
            console.warn('Could not create knowledge entry for RCA:', rca.id);
          }
        }
        
        console.log(`   ✅ Created ${knowledgeEntriesCreated} knowledge base entries from closed RCAs`);
        console.log('✅ Step 15/15 completed - RCA Analysis System initialized');
      } catch (error) {
        console.error('❌ Step 15/15 FAILED:', error);
        console.error('   Error details:', error);
        console.warn('⚠️ Continuing without RCA analysis config');
      }
      
      this.isSeeded = true;
      console.log('✅ ADNOC Oil and Gas industry data seeded successfully!');
      
      await this.verifyDataConsistency(actualTenantId);
      await this.verifyOilGasData(actualTenantId);
      await this.autoSelectFirstUnit(actualTenantId);
      
    } catch (error) {
      console.error('❌ Failed to seed Oil and Gas industry data:', error);
      throw error;
    }
  }

  // Seed ADNOC organization and tenants
  private async seedOilGasOrganizationsAndTenants(targetTenantId: string): Promise<void> {
    console.log('🏢 Seeding ADNOC organizations and tenants...');
    
    try {
      const existingOrgs = await masterDataService.getOrganizations();
      let adnocOrg = existingOrgs.find(org => org.name === 'ADNOC');
      
      if (!adnocOrg) {
        const newAdnocOrg = {
          name: 'ADNOC',
          code: 'ADNOC',
          description: 'Abu Dhabi National Oil Company - Leading oil and gas company',
          isActive: true
        };
        adnocOrg = await masterDataService.createOrganization(newAdnocOrg);
        console.log('✅ Created organization:', adnocOrg.name);
      } else {
        console.log('✅ Using existing organization:', adnocOrg.name);
      }

      const existingTenants = await masterDataService.getTenants();
      let adnocTenant = existingTenants.find(tenant => tenant.id === targetTenantId);
      
      if (!adnocTenant) {
        adnocTenant = existingTenants.find(tenant => tenant.name === 'ADNOC Onshore');
        
        if (!adnocTenant) {
          const newAdnocTenant = {
            id: targetTenantId,
            name: 'ADNOC Onshore',
            code: 'ADNOC_ONSHORE',
            description: 'ADNOC Onshore Operations - Oil and gas production and refining',
            organizationId: adnocOrg.id,
            isActive: true,
            address: 'Murban Field, Abu Dhabi, UAE',
            contactPerson: 'Mohammed Al-Jaber',
            contactEmail: 'mohammed.jaber@adnoc.ae',
            contactPhone: '+971-2-345-6789'
          };
          adnocTenant = await masterDataService.createTenant(newAdnocTenant);
          console.log('✅ Created tenant:', adnocTenant.name);
        } else {
          console.log('✅ Using existing tenant:', adnocTenant.name);
        }
      } else {
        console.log('✅ Using existing tenant with target ID:', adnocTenant.name);
      }

      this.currentTenantId = adnocTenant.id;
      
    } catch (error) {
      console.error('❌ Failed to seed organizations and tenants:', error);
      throw error;
    }
  }

  // Seed users for oil and gas
  private async seedOilGasUsers(tenantId: string): Promise<void> {
    console.log('👥 Seeding ADNOC users...');
    
    try {
      // Get organization ID
      const orgs = await masterDataService.getOrganizations();
      const adnocOrg = orgs.find(o => o.name === 'ADNOC');
      
      if (!adnocOrg) {
        console.error('❌ ADNOC organization not found for user creation');
        return;
      }

      const users = [
        {
          name: 'Mohammed Al-Jaber',
          email: 'mohammed.jaber@adnoc.ae',
          passwordHash: 'adnoc123',
          role: 'SuperAdmin' as const,
          organizationId: adnocOrg.id,
          tenantId: tenantId,
          isActive: true,
        },
        {
          name: 'Ahmed Al-Mansouri',
          email: 'ahmed.mansouri@adnoc.ae',
          passwordHash: 'adnoc123',
          role: 'TenantAdmin' as const,
          organizationId: adnocOrg.id,
          tenantId: tenantId,
          isActive: true,
        },
        {
          name: 'Fatima Al-Dhaheri',
          email: 'fatima.dhaheri@adnoc.ae',
          passwordHash: 'adnoc123',
          role: 'Engineer' as const,
          organizationId: adnocOrg.id,
          tenantId: tenantId,
          isActive: true,
        },
        {
          name: 'Khalid Al-Mazrouei',
          email: 'khalid.mazrouei@adnoc.ae',
          passwordHash: 'adnoc123',
          role: 'Engineer' as const,
          organizationId: adnocOrg.id,
          tenantId: tenantId,
          isActive: true,
        },
        {
          name: 'Sara Al-Kaabi',
          email: 'sara.kaabi@adnoc.ae',
          passwordHash: 'adnoc123',
          role: 'Analyst' as const,
          organizationId: adnocOrg.id,
          tenantId: tenantId,
          isActive: true,
        },
        {
          name: 'Ali Al-Suwaidi',
          email: 'ali.suwaidi@adnoc.ae',
          passwordHash: 'adnoc123',
          role: 'Operator' as const,
          organizationId: adnocOrg.id,
          tenantId: tenantId,
          isActive: true,
        },
        {
          name: 'Maryam Al-Shamsi',
          email: 'maryam.shamsi@adnoc.ae',
          passwordHash: 'adnoc123',
          role: 'Operator' as const,
          organizationId: adnocOrg.id,
          tenantId: tenantId,
          isActive: true,
        },
      ];

      for (const userData of users) {
        await storageService.create<User>('users', userData);
      }
      
      console.log(`✅ Created ${users.length} ADNOC users`);
    } catch (error) {
      console.error('❌ Failed to seed users:', error);
      throw error;
    }
  }

  // Seed master data codes for oil and gas
  private async seedOilGasMasterDataCodes(tenantId: string): Promise<void> {
    console.log('📊 Seeding Oil and Gas master data codes with COMPLETE cost information...');
    
    // Impact Codes for oil and gas - WITH FULL COST DATA
    const impactCodes = [
      { 
        code: 'PROD_LOSS', 
        name: 'Production Loss', 
        description: 'Loss of production output', 
        category: 'Availability' as const, 
        costBasis: 'perHour' as const,
        costPerHour: 85000, // $85k/hour for typical refinery production loss
      },
      { 
        code: 'SAFETY_INC', 
        name: 'Safety Incident', 
        description: 'Safety-related incident', 
        category: 'Availability' as const, 
        costBasis: 'perHour' as const,
        costPerHour: 103936, // $103,936/hour for major safety incidents (shutdown + investigation + regulatory)
      },
      { 
        code: 'ENV_IMPACT', 
        name: 'Environmental Impact', 
        description: 'Environmental impact or spill', 
        category: 'Availability' as const, 
        costBasis: 'perHour' as const,
        costPerHour: 125000, // $125k/hour for environmental incidents (cleanup + fines + shutdown)
      },
      { 
        code: 'QUALITY_DEV', 
        name: 'Quality Deviation', 
        description: 'Product quality out of specification', 
        category: 'Quality' as const, 
        costBasis: 'perUnit' as const,
        costPerUnit: 25, // $25 per barrel off-spec product (downgrade cost)
      },
      { 
        code: 'EQUIP_FAIL', 
        name: 'Equipment Failure', 
        description: 'Equipment breakdown or failure', 
        category: 'Availability' as const, 
        costBasis: 'perHour' as const,
        costPerHour: 45000, // $45k/hour for major equipment failure
      },
      { 
        code: 'PROC_UPSET', 
        name: 'Process Upset', 
        description: 'Process instability or upset', 
        category: 'Performance' as const, 
        costBasis: 'perHour' as const,
        costPerHour: 18500, // $18.5k/hour for process upsets (reduced throughput)
      },
      { 
        code: 'DOWNTIME', 
        name: 'Unplanned Downtime', 
        description: 'Unplanned shutdown', 
        category: 'Availability' as const, 
        costBasis: 'perHour' as const,
        costPerHour: 95000, // $95k/hour for unplanned downtime
      },
      { 
        code: 'MAINT_DEL', 
        name: 'Maintenance Delay', 
        description: 'Delayed maintenance activity', 
        category: 'Availability' as const, 
        costBasis: 'perHour' as const,
        costPerHour: 12000, // $12k/hour for maintenance delays
      },
      { 
        code: 'OPS_ERROR', 
        name: 'Operational Error', 
        description: 'Human error in operations', 
        category: 'Performance' as const, 
        costBasis: 'perHour' as const,
        costPerHour: 8500, // $8.5k/hour for operational errors
      },
      { 
        code: 'UTIL_FAIL', 
        name: 'Utility Failure', 
        description: 'Power, steam, or utilities failure', 
        category: 'Availability' as const, 
        costBasis: 'perHour' as const,
        costPerHour: 72000, // $72k/hour for utility failures (multiple units affected)
      },
      { 
        code: 'INSTR_FAIL', 
        name: 'Instrumentation Failure', 
        description: 'Control or instrumentation malfunction', 
        category: 'Performance' as const, 
        costBasis: 'perHour' as const,
        costPerHour: 15000, // $15k/hour for instrumentation issues
      },
      { 
        code: 'LEAK', 
        name: 'Leak Detected', 
        description: 'Hydrocarbon or chemical leak', 
        category: 'Availability' as const, 
        costBasis: 'perHour' as const,
        costPerHour: 156000, // $156k/hour for major leaks (safety + environmental + shutdown)
      },
      { 
        code: 'PRESSURE_DEV', 
        name: 'Pressure Deviation', 
        description: 'Abnormal pressure condition', 
        category: 'Performance' as const, 
        costBasis: 'perHour' as const,
        costPerHour: 22000, // $22k/hour for pressure deviations
      },
      { 
        code: 'TEMP_DEV', 
        name: 'Temperature Deviation', 
        description: 'Abnormal temperature condition', 
        category: 'Performance' as const, 
        costBasis: 'perHour' as const,
        costPerHour: 18000, // $18k/hour for temperature deviations
      },
      { 
        code: 'CORROSION', 
        name: 'Corrosion Detected', 
        description: 'Equipment corrosion identified', 
        category: 'Availability' as const, 
        costBasis: 'perHour' as const,
        costPerHour: 35000, // $35k/hour for corrosion-related shutdowns
      },
      { 
        code: 'VIBRATION', 
        name: 'Excessive Vibration', 
        description: 'Equipment vibration anomaly', 
        category: 'Availability' as const, 
        costBasis: 'perHour' as const,
        costPerHour: 28000, // $28k/hour for vibration-related issues
      },
      { 
        code: 'SUPPLY_ISSUE', 
        name: 'Supply Chain Issue', 
        description: 'Feedstock or supply problem', 
        category: 'Availability' as const, 
        costBasis: 'perHour' as const,
        costPerHour: 65000, // $65k/hour for feedstock supply issues
      },
      { 
        code: 'EMERG_SHUT', 
        name: 'Emergency Shutdown', 
        description: 'Emergency shutdown activated', 
        category: 'Availability' as const, 
        costBasis: 'perHour' as const,
        costPerHour: 175000, // $175k/hour for emergency shutdowns (highest impact)
      },
      { 
        code: 'FLARE_EVENT', 
        name: 'Flaring Event', 
        description: 'Unplanned flaring activity', 
        category: 'Performance' as const, 
        costBasis: 'perUnit' as const,
        costPerUnit: 850, // $850 per ton of gas flared (lost product + environmental cost)
      },
      { 
        code: 'CATALYST_DEGRAD', 
        name: 'Catalyst Degradation', 
        description: 'FCC catalyst performance decline', 
        category: 'Performance' as const, 
        costBasis: 'perHour' as const,
        costPerHour: 23712, // $23,712/hour for FCCU catalyst issues
      },
      { 
        code: 'CRUDE_QUAL', 
        name: 'Crude Quality Issue', 
        description: 'Off-spec crude feedstock', 
        category: 'Performance' as const, 
        costBasis: 'perHour' as const,
        costPerHour: 32000, // $32k/hour for crude quality issues
      },
      { 
        code: 'COMPRESSOR_FAIL', 
        name: 'Compressor Failure', 
        description: 'Gas compressor breakdown', 
        category: 'Availability' as const, 
        costBasis: 'perHour' as const,
        costPerHour: 58000, // $58k/hour for compressor failures
      },
      { 
        code: 'FURNACE_ISSUE', 
        name: 'Furnace Issue', 
        description: 'Heater or furnace problem', 
        category: 'Availability' as const, 
        costBasis: 'perHour' as const,
        costPerHour: 68000, // $68k/hour for furnace issues
      },
      { 
        code: 'COOLING_FAIL', 
        name: 'Cooling System Failure', 
        description: 'Cooling water or air cooler issue', 
        category: 'Availability' as const, 
        costBasis: 'perHour' as const,
        costPerHour: 42000, // $42k/hour for cooling system failures
      },
      { 
        code: 'POWER_OUTAGE', 
        name: 'Power Outage', 
        description: 'Electrical power loss', 
        category: 'Availability' as const, 
        costBasis: 'perHour' as const,
        costPerHour: 185000, // $185k/hour for total power loss (entire facility)
      },
    ];

    for (const code of impactCodes) {
      await masterDataService.createImpactCode({
        ...code,
        tenantId,
        organizationId: '',
        isActive: true
      });
    }
    console.log(`✅ Created ${impactCodes.length} Impact Codes with complete cost data`);

    // OEE Codes for oil and gas
    const oeeCodes = [
      { code: 'PLANNED_MAINT', name: 'Planned Maintenance', description: 'Scheduled maintenance shutdown', category: 'Planned Downtime', impactsOEE: true as const },
      { code: 'UNPLANNED_MAINT', name: 'Unplanned Maintenance', description: 'Emergency or corrective maintenance', category: 'Unplanned Downtime', impactsOEE: true as const },
      { code: 'PUMP_FAIL', name: 'Pump Failure', description: 'Pump breakdown or malfunction', category: 'Equipment Failure', impactsOEE: true as const },
      { code: 'COMPRESSOR_FAIL', name: 'Compressor Failure', description: 'Compressor breakdown', category: 'Equipment Failure', impactsOEE: true as const },
      { code: 'VALVE_ISSUE', name: 'Valve Issue', description: 'Control or isolation valve problem', category: 'Equipment Failure', impactsOEE: true as const },
      { code: 'HEAT_EXCH_FAIL', name: 'Heat Exchanger Failure', description: 'Heat exchanger fouling or failure', category: 'Equipment Failure', impactsOEE: true as const },
      { code: 'SEPARATOR_ISSUE', name: 'Separator Issue', description: 'Oil-water-gas separator problem', category: 'Process Issue', impactsOEE: true as const },
      { code: 'PIPELINE_BLOCK', name: 'Pipeline Blockage', description: 'Flow restriction in pipeline', category: 'Process Issue', impactsOEE: true as const },
      { code: 'WAX_BUILDUP', name: 'Wax Buildup', description: 'Paraffin wax deposition', category: 'Process Issue', impactsOEE: true as const },
      { code: 'HYDRATE_FORM', name: 'Hydrate Formation', description: 'Gas hydrate formation', category: 'Process Issue', impactsOEE: true as const },
      { code: 'WATER_CUT_HIGH', name: 'High Water Cut', description: 'Excessive water production', category: 'Quality Issue', impactsOEE: true as const },
      { code: 'GAS_BREAKTHRU', name: 'Gas Breakthrough', description: 'Gas coning or channeling', category: 'Quality Issue', impactsOEE: true as const },
      { code: 'DESALTER_ISSUE', name: 'Desalter Problem', description: 'Crude desalter malfunction', category: 'Process Issue', impactsOEE: true as const },
      { code: 'CATALYST_DEACT', name: 'Catalyst Deactivation', description: 'Catalyst performance degradation', category: 'Process Issue', impactsOEE: true as const },
      { code: 'POWER_OUTAGE', name: 'Power Outage', description: 'Electrical power loss', category: 'Utility Failure', impactsOEE: true as const },
      { code: 'STEAM_LOSS', name: 'Steam Loss', description: 'Steam supply interruption', category: 'Utility Failure', impactsOEE: true as const },
      { code: 'INSTRUMENT_FAIL', name: 'Instrument Failure', description: 'Measurement or control failure', category: 'Instrument Failure', impactsOEE: true as const },
      { code: 'DCS_FAILURE', name: 'DCS Failure', description: 'Distributed control system issue', category: 'Instrument Failure', impactsOEE: true as const },
      { code: 'SAFETY_TRIP', name: 'Safety System Trip', description: 'Safety instrumented system activation', category: 'Safety System', impactsOEE: true as const },
      { code: 'PRESSURE_TRIP', name: 'Pressure Trip', description: 'High/low pressure shutdown', category: 'Safety System', impactsOEE: true as const },
      { code: 'CHANGEOVER', name: 'Product Changeover', description: 'Switching product grades', category: 'Production Adjustment', impactsOEE: false as const },
      { code: 'STARTUP', name: 'Startup', description: 'Unit startup after shutdown', category: 'Production Adjustment', impactsOEE: false as const },
      { code: 'RATE_REDUCTION', name: 'Rate Reduction', description: 'Planned production rate reduction', category: 'Production Adjustment', impactsOEE: false as const },
      { code: 'WEATHER_DELAY', name: 'Weather Delay', description: 'Weather-related disruption', category: 'External Factor', impactsOEE: true as const }
    ];

    for (const code of oeeCodes) {
      await masterDataService.createOEECode({
        ...code,
        tenantId,
        organizationId: '',
        isActive: true
      });
    }
    console.log(`✅ Created ${oeeCodes.length} OEE Codes`);

    // Reason Codes for oil and gas
    const reasonCodes = [
      // Mechanical Failures
      { code: 'PUMP_SEAL_FAIL', name: 'Pump Seal Failure', description: 'Mechanical seal leakage', category: 'Mechanical' },
      { code: 'BEARING_FAIL', name: 'Bearing Failure', description: 'Bearing wear or seizure', category: 'Mechanical' },
      { code: 'COUPLING_FAIL', name: 'Coupling Failure', description: 'Shaft coupling breakdown', category: 'Mechanical' },
      { code: 'COMPRESSOR_SURGE', name: 'Compressor Surge', description: 'Compressor surge event', category: 'Mechanical' },
      { code: 'TURBINE_TRIP', name: 'Turbine Trip', description: 'Gas turbine shutdown', category: 'Mechanical' },
      { code: 'VALVE_STUCK', name: 'Valve Stuck', description: 'Control valve seized', category: 'Mechanical' },
      { code: 'MOTOR_BURNOUT', name: 'Motor Burnout', description: 'Electric motor failure', category: 'Mechanical' },
      { code: 'GEARBOX_FAIL', name: 'Gearbox Failure', description: 'Gearbox malfunction', category: 'Mechanical' },
      
      // Process Issues
      { code: 'FOULING', name: 'Equipment Fouling', description: 'Fouling of heat exchanger or vessel', category: 'Process' },
      { code: 'CORROSION_LEAK', name: 'Corrosion Leak', description: 'Corrosion-induced leak', category: 'Process' },
      { code: 'SCALING', name: 'Scaling', description: 'Scale deposition in equipment', category: 'Process' },
      { code: 'EMULSION', name: 'Emulsion Formation', description: 'Stable emulsion affecting separation', category: 'Process' },
      { code: 'FOAM', name: 'Foaming', description: 'Excessive foaming in vessel', category: 'Process' },
      { code: 'CARRYOVER', name: 'Liquid Carryover', description: 'Liquid entrainment in gas', category: 'Process' },
      { code: 'PLUGGING', name: 'Plugging', description: 'Equipment or line plugging', category: 'Process' },
      { code: 'CROSSFLOW', name: 'Crossflow', description: 'Unintended flow between systems', category: 'Process' },
      
      // Instrumentation
      { code: 'TRANSMITTER_FAIL', name: 'Transmitter Failure', description: 'Pressure/temperature transmitter fault', category: 'Instrumentation' },
      { code: 'ANALYZER_FAIL', name: 'Analyzer Failure', description: 'Online analyzer malfunction', category: 'Instrumentation' },
      { code: 'CONTROL_LOOP', name: 'Control Loop Issue', description: 'PID control loop problem', category: 'Instrumentation' },
      { code: 'SENSOR_DRIFT', name: 'Sensor Drift', description: 'Measurement sensor drift', category: 'Instrumentation' },
      { code: 'SOLENOID_FAIL', name: 'Solenoid Failure', description: 'Solenoid valve failure', category: 'Instrumentation' },
      
      // Electrical
      { code: 'CIRCUIT_BREAKER', name: 'Circuit Breaker Trip', description: 'Electrical breaker trip', category: 'Electrical' },
      { code: 'TRANSFORMER_FAIL', name: 'Transformer Failure', description: 'Power transformer issue', category: 'Electrical' },
      { code: 'VFD_FAIL', name: 'VFD Failure', description: 'Variable frequency drive fault', category: 'Electrical' },
      { code: 'CABLE_FAULT', name: 'Cable Fault', description: 'Electrical cable damage', category: 'Electrical' },
      { code: 'GROUNDING_ISSUE', name: 'Grounding Issue', description: 'Electrical grounding problem', category: 'Electrical' },
      
      // Operations
      { code: 'OPERATOR_ERROR', name: 'Operator Error', description: 'Human error in operation', category: 'Operations' },
      { code: 'PROCEDURE_DEV', name: 'Procedure Deviation', description: 'Deviation from standard procedure', category: 'Operations' },
      { code: 'TRAINING_GAP', name: 'Training Gap', description: 'Insufficient operator training', category: 'Operations' },
      { code: 'COMM_FAILURE', name: 'Communication Failure', description: 'Breakdown in communication', category: 'Operations' },
      
      // Maintenance
      { code: 'PM_OVERDUE', name: 'PM Overdue', description: 'Preventive maintenance delayed', category: 'Maintenance' },
      { code: 'POOR_MAINT', name: 'Poor Maintenance', description: 'Inadequate maintenance quality', category: 'Maintenance' },
      { code: 'SPARE_UNAVAIL', name: 'Spare Unavailable', description: 'Critical spare not available', category: 'Maintenance' },
      { code: 'WRONG_REPAIR', name: 'Incorrect Repair', description: 'Improper repair execution', category: 'Maintenance' },
      
      // Reservoir/Wells
      { code: 'WELL_DECLINE', name: 'Well Decline', description: 'Natural production decline', category: 'Reservoir' },
      { code: 'WATER_PRODUC', name: 'Water Production', description: 'Increasing water cut', category: 'Reservoir' },
      { code: 'GAS_LIFT_FAIL', name: 'Gas Lift Failure', description: 'Gas lift system issue', category: 'Reservoir' },
      { code: 'ESP_FAIL', name: 'ESP Failure', description: 'Electric submersible pump failure', category: 'Reservoir' },
      { code: 'SAND_PROD', name: 'Sand Production', description: 'Formation sand production', category: 'Reservoir' },
      { code: 'WELL_INTEG', name: 'Well Integrity', description: 'Wellbore integrity issue', category: 'Reservoir' },
      
      // Refining Specific
      { code: 'CRUDE_QUALITY', name: 'Crude Quality', description: 'Poor crude oil quality', category: 'Feedstock' },
      { code: 'CONTAMINANT', name: 'Contaminant', description: 'Feedstock contamination', category: 'Feedstock' },
      { code: 'COKE_BUILDUP', name: 'Coke Buildup', description: 'Coking in reactor or furnace', category: 'Refining' },
      { code: 'CATALYST_POISON', name: 'Catalyst Poisoning', description: 'Catalyst contamination', category: 'Refining' },
      { code: 'FRACTIONATION', name: 'Fractionation Issue', description: 'Poor separation in tower', category: 'Refining' },
      
      // Safety & Environmental
      { code: 'GAS_DETECT', name: 'Gas Detection', description: 'Combustible gas detected', category: 'Safety' },
      { code: 'FIRE_ALARM', name: 'Fire Alarm', description: 'Fire detection alarm', category: 'Safety' },
      { code: 'H2S_DETECT', name: 'H2S Detection', description: 'Hydrogen sulfide detected', category: 'Safety' },
      { code: 'SPILL_EVENT', name: 'Spill Event', description: 'Hydrocarbon spill', category: 'Environment' },
      { code: 'EMISSION_EXCEE', name: 'Emission Exceedance', description: 'Air emission limit exceeded', category: 'Environment' },
      
      // External Factors
      { code: 'POWER_GRID', name: 'Power Grid Issue', description: 'External power supply problem', category: 'External' },
      { code: 'FEEDSTOCK_DELAY', name: 'Feedstock Delay', description: 'Crude supply delay', category: 'External' },
      { code: 'PIPELINE_CONSTR', name: 'Pipeline Constraint', description: 'Export pipeline limitation', category: 'External' },
      { code: 'STORAGE_FULL', name: 'Storage Full', description: 'Tank storage at capacity', category: 'External' },
      { code: 'MARKET_DEMAND', name: 'Market Demand', description: 'Demand fluctuation', category: 'External' },
      { code: 'WEATHER_STORM', name: 'Severe Weather', description: 'Storm or extreme weather', category: 'External' },
      { code: 'TEMP_EXTREME', name: 'Extreme Temperature', description: 'Extreme ambient temperature', category: 'External' },
      
      // IT/Automation
      { code: 'SCADA_FAIL', name: 'SCADA Failure', description: 'SCADA system issue', category: 'Automation' },
      { code: 'NETWORK_DOWN', name: 'Network Down', description: 'Plant network failure', category: 'Automation' },
      { code: 'SOFTWARE_BUG', name: 'Software Bug', description: 'Control software issue', category: 'Automation' },
      { code: 'DATA_CORRUPT', name: 'Data Corruption', description: 'Historical data corruption', category: 'Automation' }
    ];

    for (const code of reasonCodes) {
      await masterDataService.createReasonCode({
        ...code,
        tenantId,
        organizationId: '',
        isActive: true
      });
    }
    console.log(`✅ Created ${reasonCodes.length} Reason Codes`);

    // RCA Cause Codes
    const rcaCauseCodes = [
      { code: 'ROOT_EQUIP_AGE', name: 'Equipment Age/Wear', description: 'Equipment at end of life', category: 'Equipment' },
      { code: 'ROOT_DESIGN_FLAW', name: 'Design Flaw', description: 'Inherent design deficiency', category: 'Design' },
      { code: 'ROOT_MAINT_PRACT', name: 'Maintenance Practice', description: 'Inadequate maintenance strategy', category: 'Maintenance' },
      { code: 'ROOT_OPS_PRACT', name: 'Operating Practice', description: 'Suboptimal operating procedures', category: 'Operations' },
      { code: 'ROOT_TRAINING', name: 'Training Deficiency', description: 'Insufficient personnel training', category: 'Human Factors' },
      { code: 'ROOT_PROC_CTRL', name: 'Process Control', description: 'Poor process control strategy', category: 'Process' },
      { code: 'ROOT_MATERIAL', name: 'Material Defect', description: 'Material of construction issue', category: 'Materials' },
      { code: 'ROOT_ENVIRON', name: 'Environmental Condition', description: 'Harsh operating environment', category: 'Environment' },
      { code: 'ROOT_VENDOR', name: 'Vendor Quality', description: 'Third-party equipment/service quality', category: 'External' },
      { code: 'ROOT_MGMT_SYS', name: 'Management System', description: 'Management system deficiency', category: 'Management' }
    ];

    for (const code of rcaCauseCodes) {
      await masterDataService.createRCACauseCode({
        ...code,
        tenantId,
        organizationId: '',
        isActive: true
      });
    }
    console.log(`✅ Created ${rcaCauseCodes.length} RCA Cause Codes`);

    // Verification Status Codes
    const verificationCodes = [
      { code: 'VERIFIED', name: 'Verified', description: 'Action verified effective', category: 'Status' },
      { code: 'NOT_VERIFIED', name: 'Not Verified', description: 'Not yet verified', category: 'Status' },
      { code: 'PARTIALLY_VER', name: 'Partially Verified', description: 'Partially effective', category: 'Status' },
      { code: 'INEFFECTIVE', name: 'Ineffective', description: 'Action ineffective', category: 'Status' },
      { code: 'PENDING', name: 'Pending', description: 'Pending verification', category: 'Status' }
    ];

    for (const code of verificationCodes) {
      await masterDataService.createVerificationStatusCode({
        ...code,
        tenantId,
        organizationId: '',
        isActive: true
      });
    }
    console.log(`✅ Created ${verificationCodes.length} Verification Status Codes`);
  }

  // Seed oil and gas units and assets
  private async seedOilGasUnits(tenantId: string): Promise<void> {
    console.log('🏭 Seeding Oil and Gas production units and assets...');
    
    const unitsWithAssets = [
      {
        unit: {
          name: 'Crude Oil Desalter',
          code: 'DESALTER-01',
          description: 'Crude oil desalting and dehydration unit',
          capacity: 150000,
          unitOfMeasure: 'BOPD',
          idealCycleTime: 60
        },
        assets: [
          { name: 'Desalter Vessel DV-101', code: 'DV-101', assetType: 'Equipment' as const, criticality: 'High' as const, description: 'Primary desalter vessel' },
          { name: 'Wash Water Pump P-101', code: 'P-101', assetType: 'Equipment' as const, criticality: 'High' as const, description: 'Wash water injection pump' },
          { name: 'Transformer TR-101', code: 'TR-101', assetType: 'Equipment' as const, criticality: 'High' as const, description: 'Electrostatic transformer' },
          { name: 'Level Controller LIC-101', code: 'LIC-101', assetType: 'Instrument' as const, criticality: 'Medium' as const, description: 'Interface level controller' },
          { name: 'Salt Analyzer AI-101', code: 'AI-101', assetType: 'Instrument' as const, criticality: 'Medium' as const, description: 'Salt content analyzer' }
        ]
      },
      {
        unit: {
          name: 'Atmospheric Distillation Unit',
          code: 'ADU-01',
          description: 'Crude oil atmospheric distillation',
          capacity: 100000,
          unitOfMeasure: 'BOPD',
          idealCycleTime: 120
        },
        assets: [
          { name: 'Crude Furnace F-201', code: 'F-201', assetType: 'Equipment' as const, criticality: 'Critical' as const, description: 'Crude heating furnace' },
          { name: 'Distillation Column T-201', code: 'T-201', assetType: 'Equipment' as const, criticality: 'Critical' as const, description: 'Main fractionation tower' },
          { name: 'Overhead Condenser E-201', code: 'E-201', assetType: 'Equipment' as const, criticality: 'High' as const, description: 'Tower overhead condenser' },
          { name: 'Reflux Pump P-201', code: 'P-201', assetType: 'Equipment' as const, criticality: 'High' as const, description: 'Top reflux pump' },
          { name: 'Bottom Pump P-202', code: 'P-202', assetType: 'Equipment' as const, criticality: 'High' as const, description: 'Residue pump' },
          { name: 'TIC Tower Top Temp', code: 'TIC-201', assetType: 'Instrument' as const, criticality: 'High' as const, description: 'Tower top temperature control' },
          { name: 'PIC Column Pressure', code: 'PIC-201', assetType: 'Instrument' as const, criticality: 'High' as const, description: 'Column pressure control' }
        ]
      },
      {
        unit: {
          name: 'Vacuum Distillation Unit',
          code: 'VDU-01',
          description: 'Vacuum distillation for heavy residue',
          capacity: 45000,
          unitOfMeasure: 'BOPD',
          idealCycleTime: 150
        },
        assets: [
          { name: 'Vacuum Furnace F-301', code: 'F-301', assetType: 'Equipment' as const, criticality: 'Critical' as const, description: 'Vacuum furnace heater' },
          { name: 'Vacuum Column T-301', code: 'T-301', assetType: 'Equipment' as const, criticality: 'Critical' as const, description: 'Vacuum distillation tower' },
          { name: 'Ejector System EJ-301', code: 'EJ-301', assetType: 'Equipment' as const, criticality: 'Critical' as const, description: 'Steam jet ejector' },
          { name: 'Vacuum Pump P-301', code: 'P-301', assetType: 'Equipment' as const, criticality: 'Critical' as const, description: 'Liquid ring vacuum pump' },
          { name: 'Wash Oil Pump P-302', code: 'P-302', assetType: 'Equipment' as const, criticality: 'High' as const, description: 'Wash oil circulation pump' }
        ]
      },
      {
        unit: {
          name: 'Fluid Catalytic Cracking Unit',
          code: 'FCCU-01',
          description: 'FCC unit for gasoline production',
          capacity: 50000,
          unitOfMeasure: 'BOPD',
          idealCycleTime: 180
        },
        assets: [
          { name: 'FCC Reactor R-401', code: 'R-401', assetType: 'Equipment' as const, criticality: 'Critical' as const, description: 'Catalytic reactor' },
          { name: 'Regenerator R-402', code: 'R-402', assetType: 'Equipment' as const, criticality: 'Critical' as const, description: 'Catalyst regenerator' },
          { name: 'Main Fractionator T-401', code: 'T-401', assetType: 'Equipment' as const, criticality: 'High' as const, description: 'Product fractionator' },
          { name: 'Air Blower K-401', code: 'K-401', assetType: 'Equipment' as const, criticality: 'Critical' as const, description: 'Regenerator air blower' },
          { name: 'Slide Valve SV-401', code: 'SV-401', assetType: 'Equipment' as const, criticality: 'Critical' as const, description: 'Catalyst slide valve' },
          { name: 'TIC Riser Temp', code: 'TIC-401', assetType: 'Instrument' as const, criticality: 'Critical' as const, description: 'Riser temperature control' },
          { name: 'DPI Catalyst Density', code: 'DPI-401', assetType: 'Instrument' as const, criticality: 'High' as const, description: 'Catalyst density indicator' }
        ]
      },
      {
        unit: {
          name: 'Hydrocracker Unit',
          code: 'HCU-01',
          description: 'Hydrocracking unit for diesel production',
          capacity: 35000,
          unitOfMeasure: 'BOPD',
          idealCycleTime: 200
        },
        assets: [
          { name: 'Hydrocracking Reactor R-501', code: 'R-501', assetType: 'Equipment' as const, criticality: 'Critical' as const, description: 'High pressure hydrocracker' },
          { name: 'Recycle Gas Compressor K-501', code: 'K-501', assetType: 'Equipment' as const, criticality: 'Critical' as const, description: 'Hydrogen recycle compressor' },
          { name: 'Reactor Effluent Cooler E-501', code: 'E-501', assetType: 'Equipment' as const, criticality: 'High' as const, description: 'High pressure separator' },
          { name: 'Charge Pump P-501', code: 'P-501', assetType: 'Equipment' as const, criticality: 'Critical' as const, description: 'High pressure charge pump' },
          { name: 'Fractionator T-501', code: 'T-501', assetType: 'Equipment' as const, criticality: 'High' as const, description: 'Product fractionation tower' }
        ]
      },
      {
        unit: {
          name: 'Gas Processing Plant',
          code: 'GPP-01',
          description: 'Natural gas processing and NGL extraction',
          capacity: 500,
          unitOfMeasure: 'MMSCFD',
          idealCycleTime: 90
        },
        assets: [
          { name: 'Inlet Separator V-601', code: 'V-601', assetType: 'Equipment' as const, criticality: 'High' as const, description: 'Three-phase separator' },
          { name: 'Glycol Contactor T-601', code: 'T-601', assetType: 'Equipment' as const, criticality: 'High' as const, description: 'TEG dehydration tower' },
          { name: 'Demethanizer T-602', code: 'T-602', assetType: 'Equipment' as const, criticality: 'High' as const, description: 'Demethanizer column' },
          { name: 'NGL Fractionator T-603', code: 'T-603', assetType: 'Equipment' as const, criticality: 'Medium' as const, description: 'NGL fractionation tower' },
          { name: 'Refrigeration Compressor K-601', code: 'K-601', assetType: 'Equipment' as const, criticality: 'Critical' as const, description: 'Propane refrigeration compressor' },
          { name: 'Glycol Pump P-601', code: 'P-601', assetType: 'Equipment' as const, criticality: 'High' as const, description: 'Lean glycol pump' }
        ]
      },
      {
        unit: {
          name: 'Sulfur Recovery Unit',
          code: 'SRU-01',
          description: 'Claus sulfur recovery from sour gas',
          capacity: 150,
          unitOfMeasure: 'TPD',
          idealCycleTime: 120
        },
        assets: [
          { name: 'Reaction Furnace F-701', code: 'F-701', assetType: 'Equipment' as const, criticality: 'Critical' as const, description: 'Thermal reactor furnace' },
          { name: 'Catalytic Reactor R-701', code: 'R-701', assetType: 'Equipment' as const, criticality: 'High' as const, description: 'First stage Claus reactor' },
          { name: 'Catalytic Reactor R-702', code: 'R-702', assetType: 'Equipment' as const, criticality: 'High' as const, description: 'Second stage Claus reactor' },
          { name: 'Sulfur Condenser E-701', code: 'E-701', assetType: 'Equipment' as const, criticality: 'High' as const, description: 'Sulfur condenser' },
          { name: 'Tail Gas Incinerator F-702', code: 'F-702', assetType: 'Equipment' as const, criticality: 'Critical' as const, description: 'Tail gas incinerator' },
          { name: 'H2S Analyzer AI-701', code: 'AI-701', assetType: 'Instrument' as const, criticality: 'Critical' as const, description: 'H2S analyzer' }
        ]
      },
      {
        unit: {
          name: 'Oil Production Facility',
          code: 'OPF-01',
          description: 'Crude oil production and treatment',
          capacity: 80000,
          unitOfMeasure: 'BOPD',
          idealCycleTime: 60
        },
        assets: [
          { name: 'HP Production Separator V-801', code: 'V-801', assetType: 'Equipment' as const, criticality: 'Critical' as const, description: 'High pressure separator' },
          { name: 'LP Production Separator V-802', code: 'V-802', assetType: 'Equipment' as const, criticality: 'High' as const, description: 'Low pressure separator' },
          { name: 'Oil Heater H-801', code: 'H-801', assetType: 'Equipment' as const, criticality: 'High' as const, description: 'Oil heating system' },
          { name: 'Free Water Knockout V-803', code: 'V-803', assetType: 'Equipment' as const, criticality: 'Medium' as const, description: 'Free water separator' },
          { name: 'Export Pump P-801', code: 'P-801', assetType: 'Equipment' as const, criticality: 'Critical' as const, description: 'Crude export pump' },
          { name: 'Metering System MS-801', code: 'MS-801', assetType: 'Instrument' as const, criticality: 'High' as const, description: 'Fiscal metering system' }
        ]
      },
      {
        unit: {
          name: 'Utilities and Offsite',
          code: 'UTIL-01',
          description: 'Power generation and utilities',
          capacity: 100,
          unitOfMeasure: 'MW',
          idealCycleTime: 0
        },
        assets: [
          { name: 'Gas Turbine Generator GTG-901', code: 'GTG-901', assetType: 'Equipment' as const, criticality: 'Critical' as const, description: 'Power generation turbine' },
          { name: 'Steam Boiler B-901', code: 'B-901', assetType: 'Equipment' as const, criticality: 'Critical' as const, description: 'Steam generation boiler' },
          { name: 'Cooling Tower CT-901', code: 'CT-901', assetType: 'Equipment' as const, criticality: 'High' as const, description: 'Main cooling tower' },
          { name: 'Instrument Air Compressor K-901', code: 'K-901', assetType: 'Equipment' as const, criticality: 'Critical' as const, description: 'Instrument air compressor' },
          { name: 'Nitrogen Generator N-901', code: 'N-901', assetType: 'System' as const, criticality: 'Medium' as const, description: 'Nitrogen generation system' },
          { name: 'Flare System FL-901', code: 'FL-901', assetType: 'System' as const, criticality: 'Critical' as const, description: 'Emergency flare system' }
        ]
      }
    ];

    for (const unitData of unitsWithAssets) {
      const unit = await masterDataService.createUnit({
        ...unitData.unit,
        tenantId,
        organizationId: ''
      });
      console.log(`✅ Created unit: ${unit.name}`);

      for (const assetData of unitData.assets) {
        const asset = await masterDataService.createAsset({
          ...assetData,
          unitId: unit.id,
          tenantId,
          organizationId: '',
          manufacturer: 'Various',
          model: 'N/A',
          serialNumber: `SN-${assetData.code}`,
          installationDate: '2020-01-01',
          status: 'Operational',
          lastMaintenanceDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          nextMaintenanceDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        });
      }
      console.log(`   ✅ Created ${unitData.assets.length} assets for ${unit.name}`);
    }
  }

  // Seed oil and gas products
  private async seedOilGasProducts(): Promise<void> {
    console.log('📦 Seeding Oil and Gas products...');
    
    const products = [
      // Crude Oil
      { name: 'Arab Light Crude', code: 'ALC', description: 'Arab Light crude oil', unitOfMeasure: 'BBL', category: 'Crude Oil', specifications: { API: '33.5', Sulfur: '1.8%' } },
      { name: 'Arab Medium Crude', code: 'AMC', description: 'Arab Medium crude oil', unitOfMeasure: 'BBL', category: 'Crude Oil', specifications: { API: '30.5', Sulfur: '2.5%' } },
      { name: 'Murban Crude', code: 'MUR', description: 'Murban crude oil from Abu Dhabi', unitOfMeasure: 'BBL', category: 'Crude Oil', specifications: { API: '40.5', Sulfur: '0.8%' } },
      
      // Refined Products
      { name: 'Premium Gasoline 95', code: 'MOGAS-95', description: '95 RON premium gasoline', unitOfMeasure: 'BBL', category: 'Gasoline', specifications: { RON: '95', RVP: '60 kPa' } },
      { name: 'Regular Gasoline 91', code: 'MOGAS-91', description: '91 RON regular gasoline', unitOfMeasure: 'BBL', category: 'Gasoline', specifications: { RON: '91', RVP: '60 kPa' } },
      { name: 'Diesel Fuel EN590', code: 'DIESEL-EN590', description: 'Ultra low sulfur diesel', unitOfMeasure: 'BBL', category: 'Diesel', specifications: { Cetane: '51', Sulfur: '10 ppm' } },
      { name: 'Jet Fuel Jet A-1', code: 'JETA1', description: 'Aviation turbine fuel', unitOfMeasure: 'BBL', category: 'Jet Fuel', specifications: { Flash_Point: '38°C', Freezing: '-47°C' } },
      { name: 'Kerosene', code: 'KERO', description: 'Illuminating kerosene', unitOfMeasure: 'BBL', category: 'Kerosene', specifications: { Flash_Point: '38°C' } },
      
      // Heavy Products
      { name: 'Heavy Fuel Oil 380', code: 'HFO-380', description: 'High sulfur fuel oil', unitOfMeasure: 'MT', category: 'Fuel Oil', specifications: { Viscosity: '380 cSt', Sulfur: '3.5%' } },
      { name: 'Vacuum Gas Oil', code: 'VGO', description: 'Vacuum gas oil feedstock', unitOfMeasure: 'BBL', category: 'Intermediate', specifications: { Density: '0.92 g/cm3' } },
      { name: 'Naphtha', code: 'NAPH', description: 'Full range naphtha', unitOfMeasure: 'BBL', category: 'Naphtha', specifications: { Distillation: 'C5-180°C' } },
      
      // Gas Products
      { name: 'Natural Gas', code: 'NG', description: 'Pipeline quality natural gas', unitOfMeasure: 'MMBTU', category: 'Natural Gas', specifications: { Heating_Value: '1000 BTU/scf' } },
      { name: 'Liquefied Petroleum Gas', code: 'LPG', description: 'Propane/butane mix', unitOfMeasure: 'MT', category: 'LPG', specifications: { Composition: 'C3/C4' } },
      { name: 'Propane', code: 'C3', description: 'Commercial propane', unitOfMeasure: 'MT', category: 'NGL', specifications: { Purity: '95%+' } },
      { name: 'Butane', code: 'C4', description: 'Commercial butane', unitOfMeasure: 'MT', category: 'NGL', specifications: { Purity: '95%+' } },
      { name: 'Ethane', code: 'C2', description: 'Petrochemical grade ethane', unitOfMeasure: 'MT', category: 'NGL', specifications: { Purity: '98%+' } },
      
      // Specialty Products
      { name: 'Base Oil Group II', code: 'BOII', description: 'Lubricant base oil', unitOfMeasure: 'BBL', category: 'Lubes', specifications: { Viscosity_Index: '95-120' } },
      { name: 'Petroleum Coke', code: 'PETCOKE', description: 'Fuel grade petroleum coke', unitOfMeasure: 'MT', category: 'Solid', specifications: { HGI: '40-50' } },
      { name: 'Sulfur', code: 'SULFUR', description: 'Elemental sulfur from SRU', unitOfMeasure: 'MT', category: 'Solid', specifications: { Purity: '99.9%+' } },
      { name: 'Asphalt', code: 'ASPH', description: 'Paving grade asphalt', unitOfMeasure: 'MT', category: 'Bitumen', specifications: { Penetration: '60/70' } }
    ];

    for (const product of products) {
      await masterDataService.createProduct({
        ...product,
        isActive: true
      });
    }
    console.log(`✅ Created ${products.length} products`);
  }

  // Seed production plans
  private async seedOilGasProductionPlans(tenantId: string): Promise<void> {
    console.log('📋 Seeding Oil and Gas production plans...');
    
    const units = await masterDataService.getUnits();
    const products = await masterDataService.getProducts();
    
    if (units.length === 0 || products.length === 0) {
      console.log('⚠️ No units or products found, skipping production plans');
      return;
    }

    // Create templates first
    const templates = [
      {
        name: 'Crude Processing Monthly Plan',
        description: 'Standard monthly plan for crude oil processing',
        unitId: units.find(u => u.code === 'ADU-01')?.id || units[0].id,
        productIds: [
          products.find(p => p.code === 'MOGAS-95')?.id,
          products.find(p => p.code === 'DIESEL-EN590')?.id,
          products.find(p => p.code === 'JETA1')?.id
        ].filter(Boolean) as string[],
        planBasis: 'Quantity-based',
        recurrence: 'Monthly',
        dataEntryFrequency: 'Daily',
        startDate: '2025-01-01',
        endDate: '2025-12-31',
        usefulProductionTime: {
          Monday: { start: '00:00', end: '23:59' },
          Tuesday: { start: '00:00', end: '23:59' },
          Wednesday: { start: '00:00', end: '23:59' },
          Thursday: { start: '00:00', end: '23:59' },
          Friday: { start: '00:00', end: '23:59' },
          Saturday: { start: '00:00', end: '23:59' },
          Sunday: { start: '00:00', end: '23:59' }
        },
        tenantId
      },
      {
        name: 'Gas Processing Quarterly Plan',
        description: 'Quarterly plan for natural gas processing',
        unitId: units.find(u => u.code === 'GPP-01')?.id || units[0].id,
        productIds: [
          products.find(p => p.code === 'NG')?.id,
          products.find(p => p.code === 'LPG')?.id,
          products.find(p => p.code === 'C3')?.id
        ].filter(Boolean) as string[],
        planBasis: 'Time-based',
        recurrence: 'Quarterly',
        dataEntryFrequency: 'Daily',
        startDate: '2025-01-01',
        endDate: '2025-12-31',
        usefulProductionTime: {
          Monday: { start: '00:00', end: '23:59' },
          Tuesday: { start: '00:00', end: '23:59' },
          Wednesday: { start: '00:00', end: '23:59' },
          Thursday: { start: '00:00', end: '23:59' },
          Friday: { start: '00:00', end: '23:59' },
          Saturday: { start: '00:00', end: '23:59' },
          Sunday: { start: '00:00', end: '23:59' }
        },
        tenantId
      }
    ];

    for (const template of templates) {
      await masterDataService.createProductionPlanTemplate(template);
      console.log(`✅ Created template: ${template.name}`);
    }

    // Create actual production plans - dates set to include TODAY for active dashboards
    const today = new Date();
    const planStartDate = new Date(today.getFullYear(), today.getMonth() - 2, 1); // 2 months ago
    const planEndDate = new Date(today.getFullYear(), today.getMonth() + 1, 0); // End of next month
    
    // 24/7 production schedule
    const fullWeekSchedule = {
      Monday: { start: '00:00', end: '23:59' },
      Tuesday: { start: '00:00', end: '23:59' },
      Wednesday: { start: '00:00', end: '23:59' },
      Thursday: { start: '00:00', end: '23:59' },
      Friday: { start: '00:00', end: '23:59' },
      Saturday: { start: '00:00', end: '23:59' },
      Sunday: { start: '00:00', end: '23:59' }
    };
    
    const plans = [
      {
        name: 'Q4 2025 Crude Processing',
        unitId: units.find(u => u.code === 'ADU-01')?.id || units[0].id,
        productId: products.find(p => p.code === 'DIESEL-EN590')?.id || products[0].id,
        plannedQuantity: 9000000,
        toleranceLimit: 5,
        startDate: planStartDate.toISOString().split('T')[0],
        endDate: planEndDate.toISOString().split('T')[0],
        planBasis: 'Quantity-based',
        recurrence: 'Quarterly',
        dataEntryFrequency: 'Daily',
        usefulProductionTime: fullWeekSchedule,
        status: 'Active' as const,
        actualQuantity: 0,
        approvalStatus: 'Approved' as const,
        tenantId
      },
      {
        name: 'Q4 2025 Gasoline Production',
        unitId: units.find(u => u.code === 'FCCU-01')?.id || units[1].id,
        productId: products.find(p => p.code === 'MOGAS-95')?.id || products[0].id,
        plannedQuantity: 4500000,
        toleranceLimit: 5,
        startDate: planStartDate.toISOString().split('T')[0],
        endDate: planEndDate.toISOString().split('T')[0],
        planBasis: 'Quantity-based',
        recurrence: 'Quarterly',
        dataEntryFrequency: 'Daily',
        usefulProductionTime: fullWeekSchedule,
        status: 'Active' as const,
        actualQuantity: 0,
        approvalStatus: 'Approved' as const,
        tenantId
      },
      {
        name: 'Q4 2025 Gas Processing',
        unitId: units.find(u => u.code === 'GPP-01')?.id || units[2].id,
        productId: products.find(p => p.code === 'NG')?.id || products[0].id,
        plannedQuantity: 45000,
        toleranceLimit: 3,
        startDate: planStartDate.toISOString().split('T')[0],
        endDate: planEndDate.toISOString().split('T')[0],
        planBasis: 'Time-based',
        recurrence: 'Quarterly',
        dataEntryFrequency: 'Daily',
        usefulProductionTime: fullWeekSchedule,
        status: 'Active' as const,
        actualQuantity: 0,
        approvalStatus: 'Approved' as const,
        tenantId
      }
    ];

    for (const plan of plans) {
      await masterDataService.createProductionPlan(plan);
      console.log(`✅ Created plan: ${plan.name}`);
    }
  }

  // Seed production events
  private async seedOilGasProductionEvents(tenantId: string): Promise<void> {
    console.log('📊 Seeding Oil and Gas production events...');
    
    const units = await masterDataService.getUnits();
    const assets = await masterDataService.getAssets({ tenantId });
    const impactCodes = await masterDataService.getImpactCodes({ tenantId });
    const oeeCodes = await masterDataService.getOEECodes({ tenantId });
    const products = await masterDataService.getProducts();
    
    if (units.length === 0 || assets.length === 0) {
      console.log('⚠️ No units or assets found, skipping production events');
      return;
    }

    const now = new Date();
    const eventCount = 150; // Generate 150 events over the past 60 days

    for (let i = 0; i < eventCount; i++) {
      const daysAgo = Math.floor(Math.random() * 60);
      const eventDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      
      const randomUnit = units[Math.floor(Math.random() * units.length)];
      const unitAssets = assets.filter(a => a.unitId === randomUnit.id);
      const randomAsset = unitAssets.length > 0 ? unitAssets[Math.floor(Math.random() * unitAssets.length)] : undefined;
      
      // Determine event type - use EventHub-compatible types
      const eventTypeRand = Math.random();
      let eventType: 'ProductionOutput' | 'ProductionLoss' | 'FailureWO' | 'IOW' | 'SOL' | 'APM';
      
      if (eventTypeRand < 0.25) {
        eventType = 'ProductionOutput';
      } else if (eventTypeRand < 0.50) {
        eventType = 'ProductionLoss'; // Downtime/loss events
      } else if (eventTypeRand < 0.70) {
        eventType = 'FailureWO'; // Maintenance/failure work orders
      } else if (eventTypeRand < 0.85) {
        eventType = 'IOW'; // Inspection observation work (quality)
      } else if (eventTypeRand < 0.92) {
        eventType = 'SOL'; // Safety and operational limits
      } else {
        eventType = 'APM'; // Asset performance monitoring
      }

      const event: any = {
        eventType,
        unitId: randomUnit.id,
        assetId: randomAsset?.id,
        timestamp: eventDate.toISOString(),
        startTime: eventDate.toISOString(),
        impactCodeId: impactCodes.length > 0 ? impactCodes[Math.floor(Math.random() * impactCodes.length)].id : undefined,
        oeeCodeId: oeeCodes.length > 0 ? oeeCodes[Math.floor(Math.random() * oeeCodes.length)].id : undefined,
        description: '',
        status: ['Open', 'In Progress', 'Closed'][Math.floor(Math.random() * 3)],
        severity: ['Low', 'Medium', 'High', 'Critical'][Math.floor(Math.random() * 4)],
        source: 'Manual',
        tenantId,
        organizationId: ''
      };

      switch (eventType) {
        case 'ProductionOutput':
          event.quantity = Math.floor(Math.random() * 50000) + 10000;
          event.productId = products.length > 0 ? products[Math.floor(Math.random() * products.length)].id : undefined;
          event.description = `Production output: ${event.quantity} barrels of ${products.find(p => p.id === event.productId)?.name || 'product'}`;
          break;
        case 'ProductionLoss':
          event.duration = Math.floor(Math.random() * 480) + 30; // 30 mins to 8 hours
          event.endTime = new Date(eventDate.getTime() + event.duration * 60 * 1000).toISOString();
          event.lossCategory = ['Availability', 'Performance', 'Quality'][Math.floor(Math.random() * 3)];
          event.cost = Math.floor(Math.random() * 200000) + 10000;
          event.description = `Unplanned downtime: ${randomAsset?.name || 'Equipment'} - ${Math.floor(event.duration / 60)}h ${event.duration % 60}m`;
          break;
        case 'FailureWO':
          event.duration = Math.floor(Math.random() * 360) + 60; // 1 to 6 hours
          event.endTime = new Date(eventDate.getTime() + event.duration * 60 * 1000).toISOString();
          event.failureMode = ['Bearing Failure', 'Seal Leak', 'Overheating', 'Electrical Fault'][Math.floor(Math.random() * 4)];
          event.cost = Math.floor(Math.random() * 150000) + 5000;
          event.description = `Maintenance work order: ${event.failureMode} on ${randomAsset?.name || 'equipment'}`;
          break;
        case 'IOW':
          event.parameter = ['Pressure', 'Temperature', 'Flow', 'Level', 'Composition'][Math.floor(Math.random() * 5)];
          event.qualityResult = Math.random() > 0.75 ? 'Fail' : 'Pass';
          event.description = `Quality inspection: ${event.parameter} - ${event.qualityResult}`;
          event.defectiveQuantity = event.qualityResult === 'Fail' ? Math.floor(Math.random() * 1000) + 100 : 0;
          break;
        case 'SOL':
          event.parameter = ['Pressure', 'Temperature', 'H2S Level', 'Gas Detection', 'Vibration'][Math.floor(Math.random() * 5)];
          event.limit = Math.floor(Math.random() * 100) + 50;
          event.limitType = Math.random() > 0.5 ? 'High' : 'Low';
          event.solType = Math.random() > 0.5 ? 'Safety' : 'Operational';
          event.description = `${event.solType} limit exceeded: ${event.parameter} ${event.limitType} (${event.limit})`;
          break;
        case 'APM':
          event.parameter = ['Vibration', 'Temperature', 'Bearing Temp', 'Motor Current', 'Pressure'][Math.floor(Math.random() * 5)];
          event.apmType = ['Health', 'Prediction', 'Alert'][Math.floor(Math.random() * 3)];
          event.recommendedAction = `Monitor ${event.parameter} trending - potential ${randomAsset?.assetType || 'equipment'} degradation`;
          event.description = `APM ${event.apmType}: ${event.parameter} trending abnormal on ${randomAsset?.name || 'equipment'}`;
          break;
      }

      await masterDataService.createProductionEvent(event);
    }
    
    console.log(`✅ Created ${eventCount} production events`);
    
    // ===== CREATE PLAN-LINKED PRODUCTION EVENTS =====
    // Create production output events linked to the 3 production plans for dashboard data
    console.log('📊 Creating plan-linked production events for dashboard data...');
    
    const plans = await masterDataService.getProductionPlans({ tenantId });
    const reasonCodes = await masterDataService.getReasonCodes({ tenantId });
    
    for (const plan of plans) {
      // Get the plan's date range
      const startDate = new Date(plan.startDate);
      const endDate = new Date(plan.endDate);
      const planDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Get the product for this plan
      const product = products.find(p => p.id === plan.productId);
      
      // Create daily production output events for the past 30 days
      const eventsToCreate = 10; // 10 events (every 3 days for 30 days)
      
      for (let i = 0; i < eventsToCreate; i++) {
        const daysAgo = i * 3; // Every 3 days going backward from today
        const eventDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
        
        // Only create if event is within plan date range
        if (eventDate < startDate || eventDate > endDate) continue;
        
        // Daily production quantity (planned / days * random variation)
        const dailyPlanned = plan.plannedQuantity / planDays;
        const actualQuantity = Math.floor(dailyPlanned * (0.85 + Math.random() * 0.25)); // 85-110% of daily plan
        
        const outputEvent = {
          eventType: 'ProductionOutput' as const,
          planId: plan.id, // LINK TO PLAN
          unitId: plan.unitId,
          productId: plan.productId,
          timestamp: eventDate.toISOString(),
          startTime: eventDate.toISOString(),
          quantity: actualQuantity,
          description: `Daily production: ${actualQuantity.toLocaleString()} ${product?.unitOfMeasure || 'units'} of ${product?.name || 'product'}`,
          status: 'Closed' as const,
          severity: 'Low' as const,
          source: 'Manual',
          tenantId,
          organizationId: ''
        };
        
        await masterDataService.createProductionEvent(outputEvent);
      }
      
      console.log(`   ✅ Created ${eventsToCreate} production output events for plan: ${plan.name}`);
      
      // Create some production loss events for the plan
      const lossEventsToCreate = 3; // 3 loss events per plan
      let totalLossQuantity = 0;
      
      for (let i = 0; i < lossEventsToCreate; i++) {
        const daysAgo = Math.floor(Math.random() * 30); // Random day within past 30 days
        const eventDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
        
        // Only create if event is within plan date range
        if (eventDate < startDate || eventDate > endDate) continue;
        
        const duration = Math.floor(Math.random() * 480) + 60; // 1-8 hours
        const lossQuantity = Math.floor((plan.plannedQuantity / planDays) * (duration / (24 * 60)) * 0.8); // Lost production based on downtime
        totalLossQuantity += lossQuantity;
        
        const lossEvent = {
          eventType: 'ProductionLoss' as const,
          planId: plan.id, // LINK TO PLAN
          unitId: plan.unitId,
          productId: plan.productId,
          timestamp: eventDate.toISOString(),
          startTime: eventDate.toISOString(),
          endTime: new Date(eventDate.getTime() + duration * 60 * 1000).toISOString(),
          duration: duration,
          quantity: lossQuantity,
          description: `Production loss: ${Math.floor(duration / 60)}h ${duration % 60}m downtime`,
          impactCodeId: impactCodes.find(c => c.code === 'PROD_LOSS')?.id,
          lossCategory: ['Availability', 'Performance', 'Quality'][Math.floor(Math.random() * 3)] as any,
          status: 'Closed' as const,
          severity: duration > 240 ? 'High' : 'Medium' as any,
          source: 'Manual',
          tenantId,
          organizationId: ''
        };
        
        await masterDataService.createProductionEvent(lossEvent);
        
        // Create corresponding production loss record immediately
        await masterDataService.createProductionLoss({
          planId: plan.id, // LINK TO PLAN
          unitId: plan.unitId,
          assetId: lossEvent.assetId,
          eventId: '', // Will be the event ID once saved
          lossDate: eventDate.toISOString().split('T')[0],
          lossType: 'Unplanned Downtime',
          lossCategory: lossEvent.lossCategory,
          quantity: lossQuantity,
          duration: duration,
          reasonCodeId: reasonCodes[Math.floor(Math.random() * reasonCodes.length)]?.id,
          impactCodeId: lossEvent.impactCodeId,
          description: lossEvent.description,
          financialImpact: (duration / 60) * (impactCodes.find(ic => ic.id === lossEvent.impactCodeId)?.costPerHour || 85000),
          tenantId,
          organizationId: ''
        });
      }
      
      console.log(`   ✅ Created ${lossEventsToCreate} production loss events for plan: ${plan.name}`);
      console.log(`   ✅ Created ${lossEventsToCreate} production loss records (planId: ${plan.id}) for plan: ${plan.name}`);
      
      // Calculate and update plan's actualQuantity from all plan-linked output events
      const planOutputEvents = await masterDataService.getProductionEvents({ 
        tenantId, 
        planId: plan.id 
      });
      
      const totalActualProduction = planOutputEvents
        .filter(e => e.eventType === 'ProductionOutput')
        .reduce((sum, e) => sum + (Number(e.quantity) || 0), 0);
      
      // Update the plan with actual quantity
      await masterDataService.updateProductionPlan(plan.id, {
        actualQuantity: totalActualProduction
      });
      
      console.log(`   ✅ Updated plan actualQuantity: ${totalActualProduction.toLocaleString()} (from ${eventsToCreate} output events)`);
    }
    
    console.log(`✅ Created plan-linked production events for ${plans.length} plans and updated actualQuantity`);
  }

  // Seed RCA events (events specifically for RCA investigations)
  private async seedOilGasRCAEvents(tenantId: string): Promise<void> {
    console.log('🔍 Seeding RCA-specific events...');
    
    const units = await masterDataService.getUnits();
    const assets = await masterDataService.getAssets({ tenantId });
    const impactCodes = await masterDataService.getImpactCodes({ tenantId });
    const oeeCodes = await masterDataService.getOEECodes({ tenantId });
    
    // Create specific high-impact events for RCA - using EventHub-compatible types
    const rcaEvents = [
      {
        eventType: 'FailureWO' as const,
        unitId: units.find(u => u.code === 'FCCU-01')?.id || units[0].id,
        assetId: assets.find(a => a.code === 'K-401')?.id,
        timestamp: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        startTime: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        duration: 1440, // 24 hours
        endTime: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000 + 1440 * 60 * 1000).toISOString(),
        description: 'FCC regenerator air blower catastrophic failure',
        impactCodeId: impactCodes.find(c => c.code === 'EQUIP_FAIL')?.id,
        oeeCodeId: oeeCodes.find(c => c.code === 'COMPRESSOR_FAIL')?.id,
        severity: 'Critical',
        status: 'Closed',
        cost: 500000,
        failureMode: 'Bearing Failure',
        source: 'Manual',
        tenantId,
        organizationId: ''
      },
      {
        eventType: 'ProductionLoss' as const,
        unitId: units.find(u => u.code === 'ADU-01')?.id || units[0].id,
        assetId: assets.find(a => a.code === 'F-201')?.id,
        timestamp: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
        startTime: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
        duration: 720, // 12 hours
        endTime: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000 + 720 * 60 * 1000).toISOString(),
        description: 'Crude furnace tube leak - emergency shutdown',
        impactCodeId: impactCodes.find(c => c.code === 'LEAK')?.id,
        oeeCodeId: oeeCodes.find(c => c.code === 'SAFETY_TRIP')?.id,
        severity: 'Critical',
        status: 'Closed',
        cost: 850000,
        lossCategory: 'Availability',
        source: 'Manual',
        tenantId,
        organizationId: ''
      },
      {
        eventType: 'SOL' as const,
        unitId: units.find(u => u.code === 'GPP-01')?.id || units[0].id,
        assetId: assets.find(a => a.code === 'K-601')?.id,
        timestamp: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(),
        startTime: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(),
        description: 'Refrigeration compressor vibration alarm and shutdown',
        impactCodeId: impactCodes.find(c => c.code === 'VIBRATION')?.id,
        oeeCodeId: oeeCodes.find(c => c.code === 'COMPRESSOR_FAIL')?.id,
        severity: 'High',
        status: 'Closed',
        parameter: 'Vibration',
        limit: 7.5,
        limitType: 'High',
        solType: 'Safety',
        source: 'Manual',
        tenantId,
        organizationId: ''
      },
      {
        eventType: 'FailureWO' as const,
        unitId: units.find(u => u.code === 'HCU-01')?.id || units[0].id,
        assetId: assets.find(a => a.code === 'P-501')?.id,
        timestamp: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
        startTime: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
        duration: 960, // 16 hours
        endTime: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000 + 960 * 60 * 1000).toISOString(),
        description: 'High pressure charge pump seal failure',
        impactCodeId: impactCodes.find(c => c.code === 'EQUIP_FAIL')?.id,
        oeeCodeId: oeeCodes.find(c => c.code === 'PUMP_FAIL')?.id,
        severity: 'High',
        status: 'Closed',
        cost: 320000,
        failureMode: 'Seal Leak',
        source: 'Manual',
        tenantId,
        organizationId: ''
      },
      {
        eventType: 'ProductionLoss' as const,
        unitId: units.find(u => u.code === 'UTIL-01')?.id || units[0].id,
        assetId: assets.find(a => a.code === 'GTG-901')?.id,
        timestamp: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000).toISOString(),
        startTime: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000).toISOString(),
        duration: 360, // 6 hours
        endTime: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000 + 360 * 60 * 1000).toISOString(),
        description: 'Gas turbine generator trip due to vibration',
        impactCodeId: impactCodes.find(c => c.code === 'UTIL_FAIL')?.id,
        oeeCodeId: oeeCodes.find(c => c.code === 'POWER_OUTAGE')?.id,
        severity: 'Critical',
        status: 'Closed',
        cost: 450000,
        lossCategory: 'Availability',
        source: 'Manual',
        tenantId,
        organizationId: ''
      }
    ];

    for (const event of rcaEvents) {
      await masterDataService.createProductionEvent(event);
      console.log(`✅ Created RCA event: ${event.description}`);
    }
  }

  // Seed comprehensive RCA templates with logic trees
  private async seedOilGasRCATemplates(tenantId: string): Promise<void> {
    const { seedRCATemplatesWithLogicTrees } = await import('./RCATemplatesAndChecklistsSeeder');
    await seedRCATemplatesWithLogicTrees(tenantId);
  }

  // Seed verification checklists
  private async seedOilGasVerificationChecklists(tenantId: string): Promise<void> {
    const { seedVerificationChecklists } = await import('./RCATemplatesAndChecklistsSeeder');
    await seedVerificationChecklists(tenantId);
  }

  // Legacy method kept for reference (replaced by comprehensive seeder above)
  private async _seedOilGasRCATemplatesOld(tenantId: string): Promise<void> {
    console.log('📝 Seeding Oil and Gas RCA templates...');
    
    const templates = [
      {
        name: 'Equipment Failure Investigation',
        description: 'Template for mechanical equipment failures',
        category: 'Equipment',
        sections: [
          {
            title: 'Event Description',
            fields: ['What happened?', 'When did it occur?', 'Who was affected?', 'Where did it happen?']
          },
          {
            title: 'Immediate Actions',
            fields: ['Emergency response taken', 'Equipment isolated?', 'Safety measures implemented']
          },
          {
            title: '5 Whys Analysis',
            fields: ['Why 1', 'Why 2', 'Why 3', 'Why 4', 'Why 5']
          },
          {
            title: 'Root Cause',
            fields: ['Identified root cause', 'Contributing factors', 'Equipment history review']
          },
          {
            title: 'Corrective Actions',
            fields: ['Short-term actions', 'Long-term actions', 'Preventive measures']
          }
        ],
        tenantId,
        organizationId: '',
        isActive: true
      },
      {
        name: 'Process Upset Investigation',
        description: 'Template for process deviations and upsets',
        category: 'Process',
        sections: [
          {
            title: 'Process Conditions',
            fields: ['Operating parameters before upset', 'Deviation observed', 'Process trend analysis']
          },
          {
            title: 'Impact Assessment',
            fields: ['Production impact', 'Quality impact', 'Safety implications']
          },
          {
            title: 'Cause Analysis',
            fields: ['Process variables reviewed', 'Control system check', 'Operator actions review']
          },
          {
            title: 'Root Cause',
            fields: ['Primary cause', 'Secondary causes', 'Systemic issues']
          },
          {
            title: 'Recommendations',
            fields: ['Process modifications', 'Control improvements', 'Training needs']
          }
        ],
        tenantId,
        organizationId: '',
        isActive: true
      },
      {
        name: 'Safety Incident Investigation',
        description: 'Template for safety-related incidents',
        category: 'Safety',
        sections: [
          {
            title: 'Incident Details',
            fields: ['Incident type', 'Personnel involved', 'Injuries sustained', 'Environmental impact']
          },
          {
            title: 'Immediate Response',
            fields: ['Emergency response', 'Medical treatment', 'Area secured', 'Reporting completed']
          },
          {
            title: 'Investigation',
            fields: ['Witness statements', 'Physical evidence', 'Procedures review', 'Training records check']
          },
          {
            title: 'Root Cause Analysis',
            fields: ['Direct causes', 'Indirect causes', 'Management system factors']
          },
          {
            title: 'Action Plan',
            fields: ['Immediate corrective actions', 'Long-term improvements', 'Communication plan']
          }
        ],
        tenantId,
        organizationId: '',
        isActive: true
      }
    ];

    for (const template of templates) {
      await masterDataService.createRCATemplate(template);
      console.log(`✅ Created RCA template: ${template.name}`);
    }
  }

  // Seed RCA investigations with comprehensive data for all tabs
  private async seedOilGasRCAInvestigations(tenantId: string): Promise<void> {
    console.log('🔬 Seeding comprehensive Oil and Gas RCA investigations with EVENT DIAGRAMS...');
    
    try {
      const events = await masterDataService.getProductionEvents({ tenantId });
      const templates = await masterDataService.getRCATemplates({ tenantId });
      const units = await masterDataService.getUnits();
      const assets = await masterDataService.getAssets({});
      const rcaCauseCodes = await masterDataService.getRCACauseCodes({ tenantId });
      const users = await storageService.query<User>('users', { tenantId });
      const orgs = await masterDataService.getOrganizations();
      const adnocOrg = orgs.find(o => o.name === 'ADNOC');
      const organizationId = adnocOrg?.id || '';
      
      const criticalEvents = events.filter(e => 
        e.severity === 'Critical' || e.severity === 'High'
      ).slice(0, 10);

      const userIds = users.map(u => u.id);
      
      const { rcaAnalysisConfigService } = await import('./RCAAnalysisConfigService');
      
      let rcaCount = 0;

      // =============================================
      // RCA 1: CLOSED - FCC Air Blower Failure
      // COMPLETE WITH ALL DATA + EVENT DIAGRAM
      // =============================================
      
      console.log('  Creating RCA 1/7: FCC Air Blower (CLOSED - Full Data + Event Diagram)...');
      
      const rca1 = await masterDataService.createRCA({
        title: 'FCC Air Blower Catastrophic Failure Investigation',
        description: 'Root cause analysis of catastrophic bearing failure in FCCU regenerator air blower. Event resulted in 48-hour unit shutdown, $2.5M production loss. Investigation identified inadequate lubrication and PM schedule gaps.',
        eventId: criticalEvents[0]?.id,
        unitId: units.find(u => u.name.includes('Fluid Catalytic'))?.id || units[0].id,
        assetId: assets.find(a => a.name.includes('Blower'))?.id,
        templateId: templates[0]?.id,
        status: 'Closed',
        closureStatus: 'Closed',
        priority: 'Critical',
        rootCause: 'Bearing failure due to inadequate lubrication caused by clogged oil filter. Contributing: Missed PM schedule, no vibration monitoring.',
        targetCloseDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        closedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        teamMemberIds: userIds.slice(0, 3),
        findings: {
          immediate: 'Bearing seized at 14:35 hrs. Temperature spiked from 65°C to 175°C in 8 minutes. Emergency shutdown automatic.',
          underlying: 'Oil filter 90% clogged restricting flow to 45% of design. Oil analysis: 850 ppm metal particles. Last filter change 8 months ago.',
          systemic: 'PM schedule inadequate - no filter checks between 18-month turnarounds. No condition monitoring. 45-day maintenance backlog.'
        },
        rcaCauseCodeIds: [rcaCauseCodes[0]?.id].filter(Boolean) as string[],
        
        evidence: [
          {
            id: `ev-rca1-1`,
            title: 'Vibration Trend Data - 30 Days',
            description: 'Historian data showing vibration increase from 2.5 mm/s to 15.8 mm/s over 72 hours before failure.',
            type: 'Time Series' as const,
            collectedBy: userIds[0] || 'Engineer',
            collectedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
            category: 'Process Data',
            location: 'DCS',
            severity: 'Critical',
            verified: true,
            tags: ['vibration'],
            nodeIds: []
          },
          {
            id: `ev-rca1-2`,
            title: 'Failed Bearing Photos',
            description: 'Photos showing severe scoring, cage deformation, blue discoloration (>300°C overheating).',
            type: 'Photo' as const,
            collectedBy: userIds[1] || 'Mechanic',
            collectedAt: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(),
            category: 'Physical Evidence',
            location: 'Workshop',
            severity: 'Critical',
            verified: true,
            tags: ['bearing', 'damage'],
            nodeIds: []
          },
          {
            id: `ev-rca1-3`,
            title: 'Oil Analysis Report LAB-1156',
            description: 'Viscosity: 28.5 cSt (Spec: 46), Iron: 850 ppm (limit 50), Water: 450 ppm (limit 200).',
            type: 'Document' as const,
            collectedBy: userIds[0] || 'Lab Tech',
            collectedAt: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000).toISOString(),
            category: 'Lab Results',
            location: 'Central Lab',
            severity: 'High',
            verified: true,
            tags: ['oil', 'chemistry'],
            nodeIds: []
          }
        ],
        
        logicTree: [
          { id: '1', rcaId: '', parentId: null, question: 'Why did the FCC Air Blower fail catastrophically?', answer: 'Bearing seizure causing 48-hour shutdown and $2.5M production loss', type: 'Root', code: 'ROOT-001', verified: true, evidenceIds: [], position: { x: 400, y: 50 }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), tenantId },
          { id: '2', rcaId: '', parentId: '1', question: 'Why did the bearing seize?', answer: 'Inadequate lubrication - oil flow restricted to 45% of design (2.25 L/min vs 5 L/min)', type: 'Why', code: 'WHY-001', verified: true, evidenceIds: [], position: { x: 400, y: 150 }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), tenantId },
          { id: '3', rcaId: '', parentId: '2', question: 'Why was lubrication inadequate?', answer: 'Oil filter was 90% clogged with metal particles (850 ppm Fe vs limit 50 ppm)', type: 'Why', code: 'WHY-002', verified: true, evidenceIds: [], position: { x: 400, y: 250 }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), tenantId },
          { id: '4', rcaId: '', parentId: '3', question: 'Why was oil filter severely clogged?', answer: 'Filter not changed for 8 months (OEM specification: 3 months or 2000 hours)', type: 'Why', code: 'WHY-003', verified: true, evidenceIds: [], position: { x: 400, y: 350 }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), tenantId },
          { id: '5', rcaId: '', parentId: '4', question: 'ROOT CAUSE: Why was filter not changed on schedule?', answer: 'PM schedule does not include filter changes between 18-month turnarounds. Maintenance backlog 45 days prevented proactive work.', type: 'Cause', code: 'RC-001', verified: true, evidenceIds: [], position: { x: 300, y: 450 }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), tenantId },
          { id: '6', rcaId: '', parentId: '1', question: 'Contributing Factor: Why was failure not detected early?', answer: 'No vibration or temperature monitoring with automatic alarms installed on critical equipment', type: 'Why', code: 'WHY-004', verified: true, evidenceIds: [], position: { x: 600, y: 150 }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), tenantId },
          { id: '7', rcaId: '', parentId: '6', question: 'CONTRIBUTING ROOT CAUSE: Why no condition monitoring?', answer: 'Capital budget ($75K) not approved for monitoring system installation due to competing priorities', type: 'Cause', code: 'RC-002', verified: true, evidenceIds: [], position: { x: 600, y: 250 }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), tenantId }
        ],
        
        recommendations: [
          {
            id: 'rec1-1',
            description: 'Replace bearing and install vibration monitoring system',
            assignedTo: userIds[0] || 'Mechanical Team',
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            status: 'In Progress',
            verificationStatus: 'Pending',
            verificationDate: ''
          },
          {
            id: 'rec1-2',
            description: 'Revise PM schedule to include monthly filter inspections',
            assignedTo: userIds[1] || 'Reliability',
            dueDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            status: 'Planned',
            verificationStatus: 'Pending',
            verificationDate: ''
          }
        ],
        
        correctiveActions: [],
        
        // ===== EVENT DIAGRAM - Comprehensive Timeline =====
        eventDiagram: {
          nodes: [
            { id: 'n1', data: { label: 'Normal Operation', time: '13:00', description: 'Blower running normally, vibration 2.5 mm/s' }, position: { x: 50, y: 100 }, type: 'event' },
            { id: 'n2', data: { label: 'Vibration Increase Detected', time: '13:45', description: 'Vibration increased to 5.2 mm/s. Operator noted unusual noise.' }, position: { x: 200, y: 100 }, type: 'event' },
            { id: 'n3', data: { label: 'Temperature Rise', time: '14:10', description: 'Bearing temp increased from 65°C to 95°C. No automatic alarm (threshold 110°C).' }, position: { x: 350, y: 100 }, type: 'event' },
            { id: 'n4', data: { label: 'Vibration Alarm', time: '14:25', description: 'Manual vibration reading 12.5 mm/s. Operator called supervisor.' }, position: { x: 500, y: 100 }, type: 'event' },
            { id: 'n5', data: { label: 'Decision Point', time: '14:28', description: 'Supervisor assessed: Continue operation vs shutdown. Decided to monitor.' }, position: { x: 650, y: 100 }, type: 'decision' },
            { id: 'n6', data: { label: 'Rapid Temperature Spike', time: '14:35', description: 'Temperature jumped to 175°C in 7 minutes. Smoke observed.' }, position: { x: 800, y: 100 }, type: 'event' },
            { id: 'n7', data: { label: 'BEARING SEIZURE', time: '14:35:45', description: 'Bearing completely seized. Motor current spiked to 450A (normal 280A).' }, position: { x: 950, y: 100 }, type: 'failure' },
            { id: 'n8', data: { label: 'Automatic Shutdown', time: '14:36', description: 'ESD triggered by high motor current. Unit shutdown initiated.' }, position: { x: 1100, y: 100 }, type: 'response' },
            { id: 'n9', data: { label: 'Emergency Response', time: '14:40', description: 'Fire watch posted. Area secured. Maintenance mobilized.' }, position: { x: 1250, y: 100 }, type: 'response' },
            { id: 'n10', data: { label: 'Damage Assessment', time: '16:00', description: 'Blower disassembled. Bearing destroyed, shaft scored, housing cracked.' }, position: { x: 1400, y: 100 }, type: 'investigation' },
            { id: 'n11', data: { label: 'Root Cause Identified', time: 'Day 3', description: 'Filter 90% clogged. No oil flow. PM schedule gap identified.' }, position: { x: 1550, y: 100 }, type: 'investigation' },
            { id: 'n12', data: { label: 'Corrective Actions', time: 'Day 5', description: 'New bearing ordered. Vibration monitoring approved. PM schedule revised.' }, position: { x: 1700, y: 100 }, type: 'resolution' }
          ],
          edges: [
            { id: 'e1-2', source: 'n1', target: 'n2', label: '45 min', type: 'timeline' },
            { id: 'e2-3', source: 'n2', target: 'n3', label: '25 min', type: 'timeline' },
            { id: 'e3-4', source: 'n3', target: 'n4', label: '15 min', type: 'timeline' },
            { id: 'e4-5', source: 'n4', target: 'n5', label: '3 min', type: 'timeline' },
            { id: 'e5-6', source: 'n5', target: 'n6', label: '7 min', type: 'causal' },
            { id: 'e6-7', source: 'n6', target: 'n7', label: '45 sec', type: 'causal' },
            { id: 'e7-8', source: 'n7', target: 'n8', label: '15 sec', type: 'automatic' },
            { id: 'e8-9', source: 'n8', target: 'n9', label: '4 min', type: 'response' },
            { id: 'e9-10', source: 'n9', target: 'n10', label: '1.3 hrs', type: 'investigation' },
            { id: 'e10-11', source: 'n10', target: 'n11', label: '2 days', type: 'investigation' },
            { id: 'e11-12', source: 'n11', target: 'n12', label: '2 days', type: 'resolution' }
          ]
        },
        
        approvedBy: userIds[0] || 'Manager',
        approvedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        approvalComments: 'Approved. Comprehensive RCA with clear root causes identified.',
        
        tenantId,
        organizationId
      });

      // Create 5-Why for RCA 1
      await rcaAnalysisConfigService.createFiveWhyAnalysis({
        rcaId: rca1.id,
        problem: 'FCC Air Blower bearing failure causing 48-hour shutdown',
        whyLevels: [
          { level: 1, question: 'Why did bearing fail?', answer: 'Bearing seized', justification: 'Physical inspection confirmed', evidence: ['Bearing photos'] },
          { level: 2, question: 'Why did bearing seize?', answer: 'Inadequate lubrication', justification: 'Oil analysis showed degradation', evidence: ['Oil analysis LAB-1156'] },
          { level: 3, question: 'Why inadequate lubrication?', answer: 'Oil filter 90% clogged', justification: 'Filter inspection post-failure', evidence: ['Filter inspection report'] },
          { level: 4, question: 'Why was filter clogged?', answer: 'Not changed for 8 months', justification: 'CMMS records review', evidence: ['PM history'] },
          { level: 5, question: 'Why not changed?', answer: 'PM schedule does not include filter changes between turnarounds', justification: 'Procedure review', evidence: ['PM procedures'] }
        ],
        rootCause: 'PM schedule inadequate - no filter changes between 18-month turnarounds',
        verifiedBy: userIds[0] || 'Manager',
        verifiedDate: new Date().toISOString()
      });

      // Create Fishbone for RCA 1
      await rcaAnalysisConfigService.createFishboneDiagram({
        rcaId: rca1.id,
        effect: 'FCC Air Blower Bearing Failure',
        categories: [
          {
            id: 'cat-machine',
            name: 'Machine (Equipment)',
            causes: [
              { id: 'c-m1', description: 'No vibration monitoring installed', isPrimary: true, evidence: ['Equipment list'], likelihood: 'High' },
              { id: 'c-m2', description: 'Lubrication system inadequate', isPrimary: true, evidence: ['Oil analysis'], likelihood: 'High' }
            ]
          },
          {
            id: 'cat-method',
            name: 'Method (Process)',
            causes: [
              { id: 'c-p1', description: 'PM schedule does not include filter changes', isPrimary: true, evidence: ['PM procedures'], likelihood: 'High' },
              { id: 'c-p2', description: 'No oil analysis program', isPrimary: true, likelihood: 'High' }
            ]
          },
          {
            id: 'cat-people',
            name: 'Man (People)',
            causes: [
              { id: 'c-h1', description: 'Operators did not recognize warning signs', isPrimary: false, likelihood: 'Medium' }
            ]
          },
          {
            id: 'cat-material',
            name: 'Material',
            causes: [
              { id: 'c-mat1', description: 'Oil quality degraded', isPrimary: false, evidence: ['Oil analysis'], likelihood: 'Medium' }
            ]
          },
          {
            id: 'cat-measurement',
            name: 'Measurement',
            causes: [
              { id: 'c-mes1', description: 'No vibration sensors', isPrimary: true, likelihood: 'High' },
              { id: 'c-mes2', description: 'No temperature alarms', isPrimary: true, likelihood: 'High' }
            ]
          },
          {
            id: 'cat-environment',
            name: 'Environment',
            causes: [
              { id: 'c-env1', description: 'High ambient temperature', isPrimary: false, likelihood: 'Low' }
            ]
          }
        ]
      });

      rcaCount++;
      console.log(`✅ RCA ${rcaCount}/7: ${rca1.title} (Closed with Event Diagram - 12 nodes)`);

      // =============================================
      // RCA 2: CLOSED - Crude Furnace Tube Leak
      // =============================================
      
      console.log('  Creating RCA 2/7: Crude Furnace (CLOSED - Full Data + Event Diagram)...');
      
      const rca2 = await masterDataService.createRCA({
        title: 'Crude Furnace Tube Leak Analysis',
        description: 'Investigation of furnace tube failure causing emergency shutdown and oil release',
        eventId: criticalEvents[1]?.id,
        unitId: units.find(u => u.name.includes('Atmospheric'))?.id || units[1].id,
        templateId: templates[0]?.id,
        status: 'Closed',
        closureStatus: 'Closed',
        priority: 'Critical',
        rootCause: 'Tube overheating due to coke deposition from high salt content in crude',
        targetCloseDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        closedDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        teamMemberIds: userIds.slice(1, 3),
        evidence: [
          {
            id: 'ev-rca2-1',
            title: 'Tube Metallurgy Report',
            description: 'SEM analysis showing overheating damage, creep deformation',
            type: 'Document' as const,
            collectedBy: userIds[0] || 'Engineer',
            collectedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
            category: 'Lab Results',
            verified: true,
            nodeIds: []
          },
          {
            id: 'ev-rca2-2',
            title: 'Crude Assay Data',
            description: 'Salt content 45 PTB vs design limit 10 PTB',
            type: 'Document' as const,
            collectedBy: userIds[1] || 'Lab',
            collectedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
            category: 'Process Data',
            verified: true,
            nodeIds: []
          }
        ],
        logicTree: [
          { id: '1', rcaId: '', parentId: null, question: 'Why did the crude furnace tube leak?', answer: 'Tube rupture due to localized overheating exceeding 600°C design temperature limit', type: 'Root', code: 'ROOT-001', verified: true, evidenceIds: [], position: { x: 400, y: 50 }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), tenantId },
          { id: '2', rcaId: '', parentId: '1', question: 'Why did tube overheat?', answer: 'Internal coke buildup restricted crude flow creating hot spots and temperature excursions', type: 'Why', code: 'WHY-001', verified: true, evidenceIds: [], position: { x: 400, y: 150 }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), tenantId },
          { id: '3', rcaId: '', parentId: '2', question: 'Why did coke deposit form?', answer: 'High salt content in crude (45 PTB vs design limit 10 PTB) caused salt deposition and coking', type: 'Why', code: 'WHY-002', verified: true, evidenceIds: [], position: { x: 400, y: 250 }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), tenantId },
          { id: '4', rcaId: '', parentId: '3', question: 'ROOT CAUSE: Why was crude salt content high?', answer: 'Desalter performance degraded to 65% efficiency (design: 95%). Poor water injection and chemical dosing. Unit needs upgrade.', type: 'Cause', code: 'RC-001', verified: true, evidenceIds: [], position: { x: 400, y: 350 }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), tenantId }
        ],
        recommendations: [
          {
            id: 'rec2-1',
            description: 'Replace failed tubes and improve desalter performance',
            assignedTo: userIds[0] || 'Maintenance',
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            status: 'In Progress',
            verificationStatus: 'Pending',
            verificationDate: ''
          }
        ],
        correctiveActions: [],
        findings: {},
        rcaCauseCodeIds: [],
        
        eventDiagram: {
          nodes: [
            { id: 'n1', data: { label: 'Normal Operation', time: 'Day -7, 08:00', description: 'Furnace operating at 350°C, crude flow 120,000 BPD, all parameters normal' }, position: { x: 50, y: 100 }, type: 'normal' },
            { id: 'n2', data: { label: 'Desalter Degradation', time: 'Day -7, 14:00', description: 'Desalter efficiency dropped from 95% to 75%. Operators noticed higher salt carryover.' }, position: { x: 180, y: 100 }, type: 'warning' },
            { id: 'n3', data: { label: 'High Salt Content', time: 'Day -6', description: 'Crude assay shows 32 PTB salt content (design limit: 10 PTB). Lab notified operations.' }, position: { x: 310, y: 100 }, type: 'warning' },
            { id: 'n4', data: { label: 'Coke Deposition Begins', time: 'Day -5', description: 'Tube skin temperature increased 15°C. Localized hot spots developing.' }, position: { x: 440, y: 100 }, type: 'warning' },
            { id: 'n5', data: { label: 'Temperature Alarm', time: 'Day -3, 10:15', description: 'Local hot spot reached 420°C (design max: 380°C). High temp alarm.' }, position: { x: 570, y: 100 }, type: 'alarm' },
            { id: 'n6', data: { label: 'Decision Point', time: 'Day -3, 11:00', description: 'Operations decided to continue with reduced firing rate to 90%.' }, position: { x: 700, y: 100 }, type: 'decision' },
            { id: 'n7', data: { label: 'Progressive Overheating', time: 'Day -2, 08:00', description: 'Despite reduced firing, hot spot reached 550°C due to coke insulation.' }, position: { x: 830, y: 100 }, type: 'alarm' },
            { id: 'n8', data: { label: 'Pressure Drop Warning', time: 'Day -1, 14:30', description: 'Pressure drop across tube bank increased 15%. Flow restriction detected.' }, position: { x: 960, y: 100 }, type: 'alarm' },
            { id: 'n9', data: { label: 'Tube Crack Initiation', time: 'Day 0, 03:15', description: 'Small crack formed in tube. Minor hydrocarbon vapor release to firebox.' }, position: { x: 1090, y: 100 }, type: 'warning' },
            { id: 'n10', data: { label: 'MAJOR TUBE RUPTURE', time: 'Day 0, 03:22', description: 'Catastrophic tube failure. 50 BPD crude oil released into firebox. Flash fire.' }, position: { x: 1220, y: 100 }, type: 'failure' },
            { id: 'n11', data: { label: 'Emergency Shutdown', time: 'Day 0, 03:25', description: 'Manual ESD activated. Feed cut. Flare system activated. Firefighting team deployed.' }, position: { x: 1350, y: 100 }, type: 'response' },
            { id: 'n12', data: { label: 'Fire Contained', time: 'Day 0, 04:00', description: 'Fire extinguished. Area secured. Spill contained in dike. No injuries.' }, position: { x: 1480, y: 100 }, type: 'response' },
            { id: 'n13', data: { label: 'Damage Assessment', time: 'Day 1', description: '8 furnace tubes failed. Firebox refractory damaged. Estimated loss: $2.8M.' }, position: { x: 1610, y: 100 }, type: 'investigation' },
            { id: 'n14', data: { label: 'Root Cause Identified', time: 'Day 5', description: 'Desalter inadequate for high-salt crude. Upgrade required. Crude spec review needed.' }, position: { x: 1740, y: 100 }, type: 'investigation' },
            { id: 'n15', data: { label: 'Corrective Actions', time: 'Day 10', description: 'All tubes replaced. Desalter retrofit project initiated. Crude quality limits tightened.' }, position: { x: 1870, y: 100 }, type: 'resolution' }
          ],
          edges: [
            { id: 'e1-2', source: 'n1', target: 'n2', label: '6 hrs', type: 'timeline' },
            { id: 'e2-3', source: 'n2', target: 'n3', label: '1 day', type: 'causal' },
            { id: 'e3-4', source: 'n3', target: 'n4', label: '1 day', type: 'causal' },
            { id: 'e4-5', source: 'n4', target: 'n5', label: '2 days', type: 'progression' },
            { id: 'e5-6', source: 'n5', target: 'n6', label: '45 min', type: 'decision' },
            { id: 'e6-7', source: 'n6', target: 'n7', label: '21 hrs', type: 'progression' },
            { id: 'e7-8', source: 'n7', target: 'n8', label: '1.3 days', type: 'progression' },
            { id: 'e8-9', source: 'n8', target: 'n9', label: '13 hrs', type: 'deterioration' },
            { id: 'e9-10', source: 'n9', target: 'n10', label: '7 min', type: 'failure' },
            { id: 'e10-11', source: 'n10', target: 'n11', label: '3 min', type: 'response' },
            { id: 'e11-12', source: 'n11', target: 'n12', label: '35 min', type: 'response' },
            { id: 'e12-13', source: 'n12', target: 'n13', label: '20 hrs', type: 'investigation' },
            { id: 'e13-14', source: 'n13', target: 'n14', label: '4 days', type: 'investigation' },
            { id: 'e14-15', source: 'n14', target: 'n15', label: '5 days', type: 'resolution' }
          ]
        },
        
        approvedBy: userIds[1] || 'Manager',
        approvedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        tenantId,
        organizationId
      });

      await rcaAnalysisConfigService.createFiveWhyAnalysis({
        rcaId: rca2.id,
        problem: 'Crude furnace tube leak',
        whyLevels: [
          { level: 1, question: 'Why did tube leak?', answer: 'Tube overheated', justification: 'Metallurgy report', evidence: ['Tube analysis'] },
          { level: 2, question: 'Why overheated?', answer: 'Coke buildup', justification: 'Inspection', evidence: ['Tube inspection'] },
          { level: 3, question: 'Why coke buildup?', answer: 'High salt in crude', justification: 'Crude assay', evidence: ['Assay data'] },
          { level: 4, question: 'Why high salt?', answer: 'Desalter performance poor', justification: 'Performance data', evidence: ['Desalter logs'] },
          { level: 5, question: 'Why poor performance?', answer: 'Desalter needs upgrade', justification: 'Engineering review', evidence: ['Equipment eval'] }
        ],
        rootCause: 'Desalter inadequate for high-salt crude',
        verifiedBy: userIds[0] || '',
        verifiedDate: new Date().toISOString()
      });

      await rcaAnalysisConfigService.createFishboneDiagram({
        rcaId: rca2.id,
        effect: 'Crude Furnace Tube Leak',
        categories: [
          {
            id: 'cat2-machine',
            name: 'Machine',
            causes: [
              { id: 'c2-m1', description: 'Furnace tube design adequate but overheated', isPrimary: false, likelihood: 'Low' }
            ]
          },
          {
            id: 'cat2-method',
            name: 'Method',
            causes: [
              { id: 'c2-p1', description: 'Desalter operation not optimized', isPrimary: true, likelihood: 'High' }
            ]
          }
        ]
      });

      rcaCount++;
      console.log(`✅ RCA ${rcaCount}/7: ${rca2.title} (Closed with Event Diagram - 15 nodes)`);

      // =============================================
      // RCA 3: APPROVAL - Gas Compressor
      // =============================================
      
      console.log('  Creating RCA 3/7: Gas Compressor (APPROVAL phase)...');
      
      const rca3 = await masterDataService.createRCA({
        title: 'Gas Compressor Anti-Surge Trip Investigation',
        description: 'Analysis of compressor trip due to anti-surge valve failure',
        eventId: criticalEvents[2]?.id,
        unitId: units.find(u => u.name.includes('Gas'))?.id || units[2].id,
        templateId: templates[0]?.id,
        status: 'Approval',
        priority: 'High',
        rootCause: 'Anti-surge valve failed to open due to low instrument air pressure',
        targetCloseDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        teamMemberIds: userIds.slice(0, 2),
        evidence: [
          {
            id: 'ev-rca3-1',
            title: 'Control System Logs',
            description: 'DCS logs show ASV command sent but valve did not respond',
            type: 'Time Series' as const,
            collectedBy: userIds[1] || 'I&E',
            collectedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
            category: 'Control Data',
            verified: true,
            nodeIds: []
          }
        ],
        logicTree: [
          { id: '1', rcaId: '', parentId: null, question: 'Why did gas compressor trip?', answer: 'Compressor entered surge condition triggering protective shutdown system', type: 'Root', code: 'ROOT-001', verified: true, evidenceIds: [], position: { x: 400, y: 50 }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), tenantId },
          { id: '2', rcaId: '', parentId: '1', question: 'Why did surge condition occur?', answer: 'Anti-surge valve failed to open when flow dropped below surge control line', type: 'Why', code: 'WHY-001', verified: true, evidenceIds: [], position: { x: 400, y: 150 }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), tenantId },
          { id: '3', rcaId: '', parentId: '2', question: 'Why did anti-surge valve not open?', answer: 'Valve actuator did not receive sufficient air pressure (3.5 bar actual vs 6 bar required)', type: 'Why', code: 'WHY-002', verified: true, evidenceIds: [], position: { x: 400, y: 250 }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), tenantId },
          { id: '4', rcaId: '', parentId: '3', question: 'ROOT CAUSE: Why was instrument air pressure low?', answer: 'No backup air/nitrogen supply for critical safety valves. Single point of failure in instrument air system. No low-pressure alarm.', type: 'Cause', code: 'RC-001', verified: true, evidenceIds: [], position: { x: 400, y: 350 }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), tenantId }
        ],
        recommendations: [
          {
            id: 'rec3-1',
            description: 'Install nitrogen backup system for critical valves',
            assignedTo: userIds[0] || 'Projects',
            dueDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            status: 'Planned',
            verificationStatus: 'Pending',
            verificationDate: ''
          }
        ],
        correctiveActions: [],
        findings: {},
        rcaCauseCodeIds: [],
        
        eventDiagram: {
          nodes: [
            { id: 'n1', data: { label: 'Normal Operation', time: '10:00', description: 'Compressor at 85% load, 22 MMSCFD, discharge pressure 45 bar, surge margin 15%' }, position: { x: 50, y: 100 }, type: 'normal' },
            { id: 'n2', data: { label: 'Downstream Demand Drop', time: '14:20', description: 'Export pipeline pressure increased to 48 bar. Gas flow reduced automatically.' }, position: { x: 200, y: 100 }, type: 'event' },
            { id: 'n3', data: { label: 'Approaching Surge Line', time: '14:35', description: 'Flow dropped to 18 MMSCFD. Surge margin decreased to 8%. Anti-surge control active.' }, position: { x: 350, y: 100 }, type: 'warning' },
            { id: 'n4', data: { label: 'ASV Command Sent', time: '14:36:15', description: 'DCS sent 100% open command to anti-surge valve to recycle gas and increase flow.' }, position: { x: 500, y: 100 }, type: 'event' },
            { id: 'n5', data: { label: 'Valve Failure', time: '14:36:18', description: 'ASV remained at 5% open position. Valve actuator did not respond to command.' }, position: { x: 650, y: 100 }, type: 'failure' },
            { id: 'n6', data: { label: 'Low Air Pressure', time: '14:36:20', description: 'Instrument air header pressure at 3.5 bar (required: 6 bar minimum for valve actuation)' }, position: { x: 800, y: 100 }, type: 'alarm' },
            { id: 'n7', data: { label: 'SURGE INITIATED', time: '14:36:25', description: 'Compressor entered deep surge. Severe vibration 18 mm/s. Flow reversal detected.' }, position: { x: 950, y: 100 }, type: 'failure' },
            { id: 'n8', data: { label: 'Compressor Trip', time: '14:36:30', description: 'Vibration >15 mm/s triggered protective shutdown. Motor current dropped to zero.' }, position: { x: 1100, y: 100 }, type: 'response' },
            { id: 'n9', data: { label: 'Auto Depressurization', time: '14:37', description: 'Blowdown valve opened automatically. 15 MMSCFD gas routed to flare system.' }, position: { x: 1250, y: 100 }, type: 'response' },
            { id: 'n10', data: { label: 'Emergency Response', time: '15:00', description: 'Operations secured area. I&E team mobilized. Air compressor status checked.' }, position: { x: 1400, y: 100 }, type: 'investigation' },
            { id: 'n11', data: { label: 'Air System Issue Found', time: '16:30', description: 'One of two air compressors offline. No low-pressure alarm configured.' }, position: { x: 1550, y: 100 }, type: 'investigation' },
            { id: 'n12', data: { label: 'Root Cause Identified', time: 'Day 2', description: 'Single point of failure - no backup nitrogen system for critical safety valves.' }, position: { x: 1700, y: 100 }, type: 'investigation' },
            { id: 'n13', data: { label: 'Corrective Actions', time: 'Day 7', description: 'Nitrogen backup system designed. Air pressure alarms added. ASV SOV upgrade planned.' }, position: { x: 1850, y: 100 }, type: 'resolution' }
          ],
          edges: [
            { id: 'e1-2', source: 'n1', target: 'n2', label: '4h 20min', type: 'timeline' },
            { id: 'e2-3', source: 'n2', target: 'n3', label: '15 min', type: 'progression' },
            { id: 'e3-4', source: 'n3', target: 'n4', label: '1m 15s', type: 'automatic' },
            { id: 'e4-5', source: 'n4', target: 'n5', label: '3 sec', type: 'failure' },
            { id: 'e5-6', source: 'n5', target: 'n6', label: '2 sec', type: 'causal' },
            { id: 'e6-7', source: 'n6', target: 'n7', label: '5 sec', type: 'cascade' },
            { id: 'e7-8', source: 'n7', target: 'n8', label: '5 sec', type: 'automatic' },
            { id: 'e8-9', source: 'n8', target: 'n9', label: '30 sec', type: 'automatic' },
            { id: 'e9-10', source: 'n9', target: 'n10', label: '23 min', type: 'response' },
            { id: 'e10-11', source: 'n10', target: 'n11', label: '1.5 hrs', type: 'investigation' },
            { id: 'e11-12', source: 'n11', target: 'n12', label: '1.5 days', type: 'investigation' },
            { id: 'e12-13', source: 'n12', target: 'n13', label: '5 days', type: 'resolution' }
          ]
        },
        
        tenantId,
        organizationId
      });

      rcaCount++;
      console.log(`✅ RCA ${rcaCount}/7: ${rca3.title} (Approval with Event Diagram - 13 nodes)`);

      // =============================================
      // RCA 4: RECOMMENDATIONS - Hydrocracker
      // =============================================
      
      console.log('  Creating RCA 4/7: Hydrocracker (RECOMMENDATIONS phase)...');
      
      const rca4 = await masterDataService.createRCA({
        title: 'Hydrocracker Catalyst Fouling Analysis',
        description: 'Investigation of accelerated catalyst deactivation',
        eventId: criticalEvents[3]?.id,
        unitId: units.find(u => u.name.includes('Hydrocracker'))?.id || units[3].id,
        templateId: templates[1]?.id,
        status: 'Recommendations',
        priority: 'High',
        rootCause: 'High nitrogen in feed due to off-spec crude blend',
        targetCloseDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        teamMemberIds: userIds.slice(1, 3),
        evidence: [
          {
            id: 'ev-rca4-1',
            title: 'Catalyst Activity Data',
            description: 'Activity dropped 30% in 60 days vs normal 90 days',
            type: 'Document' as const,
            collectedBy: userIds[1] || 'Process',
            collectedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            category: 'Process Data',
            verified: true,
            nodeIds: []
          }
        ],
        logicTree: [
          { id: '1', rcaId: '', parentId: null, question: 'Why is catalyst fouling faster than expected?', answer: 'Nitrogen content in feed exceeds design specification by 70%', type: 'Root', code: 'ROOT-001', verified: true, evidenceIds: [], position: { x: 400, y: 50 }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), tenantId },
          { id: '2', rcaId: '', parentId: '1', question: 'Why is nitrogen content high?', answer: 'Off-spec crude blend used due to supply constraints', type: 'Cause', code: 'RC-001', verified: true, evidenceIds: [], position: { x: 400, y: 150 }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), tenantId }
        ],
        recommendations: [],
        correctiveActions: [],
        findings: {},
        rcaCauseCodeIds: [],
        
        eventDiagram: {
          nodes: [
            { id: 'n1', data: { label: 'Catalyst Loaded', time: 'Day -90', description: 'Fresh catalyst loaded during turnaround. Initial activity 100%, nitrogen tolerance 850 ppm.' }, position: { x: 50, y: 100 }, type: 'normal' },
            { id: 'n2', data: { label: 'Normal Performance', time: 'Day -60', description: 'Catalyst activity 98%, product quality on-spec, conversion 85%.' }, position: { x: 180, y: 100 }, type: 'normal' },
            { id: 'n3', data: { label: 'Feed Change', time: 'Day -45', description: 'Crude blend changed from Arab Light to Arab Heavy mix due to supply availability.' }, position: { x: 310, y: 100 }, type: 'event' },
            { id: 'n4', data: { label: 'Nitrogen Increase', time: 'Day -40', description: 'Feed nitrogen content increased from 800 ppm to 1450 ppm (design limit: 850 ppm).' }, position: { x: 440, y: 100 }, type: 'warning' },
            { id: 'n5', data: { label: 'Catalyst Activity Drop', time: 'Day -30', description: 'Activity decreased to 92%. Product sulfur content trending up.' }, position: { x: 570, y: 100 }, type: 'warning' },
            { id: 'n6', data: { label: 'Decision Point', time: 'Day -25', description: 'Process engineer noted trend but catalyst still within acceptable range (>90%).' }, position: { x: 700, y: 100 }, type: 'decision' },
            { id: 'n7', data: { label: 'Accelerated Fouling', time: 'Day -15', description: 'Activity dropped to 85%. Pressure drop across reactor increasing.' }, position: { x: 830, y: 100 }, type: 'alarm' },
            { id: 'n8', data: { label: 'Product Off-Spec', time: 'Day -7', description: 'Diesel sulfur 12 ppm vs limit 10 ppm. First off-spec batch.' }, position: { x: 960, y: 100 }, type: 'alarm' },
            { id: 'n9', data: { label: 'CATALYST DEACTIVATION', time: 'Day 0', description: 'Activity at 78%. Cannot meet product spec. Unit derate required.' }, position: { x: 1090, y: 100 }, type: 'failure' },
            { id: 'n10', data: { label: 'Rate Reduction', time: 'Day 0, 14:00', description: 'Reduced throughput from 45k BPD to 35k BPD to meet product quality. $400k/day loss.' }, position: { x: 1220, y: 100 }, type: 'response' },
            { id: 'n11', data: { label: 'Feed Analysis', time: 'Day 2', description: 'Comprehensive feed analysis shows 1450 ppm nitrogen, 12 ppm metals (vs limit 8 ppm).' }, position: { x: 1350, y: 100 }, type: 'investigation' },
            { id: 'n12', data: { label: 'Root Cause Identified', time: 'Day 5', description: 'High nitrogen in feed poisoned catalyst. No crude specification enforcement.' }, position: { x: 1480, y: 100 }, type: 'investigation' },
            { id: 'n13', data: { label: 'Interim Action', time: 'Day 7', description: 'Reverted to Arab Light crude. Planning early catalyst change. Specification controls added.' }, position: { x: 1610, y: 100 }, type: 'resolution' },
            { id: 'n14', data: { label: 'Corrective Actions', time: 'Day 14', description: 'Crude quality monitoring enhanced. Online nitrogen analyzer approved. Catalyst change in 30 days.' }, position: { x: 1740, y: 100 }, type: 'resolution' }
          ],
          edges: [
            { id: 'e1-2', source: 'n1', target: 'n2', label: '30 days', type: 'timeline' },
            { id: 'e2-3', source: 'n2', target: 'n3', label: '15 days', type: 'timeline' },
            { id: 'e3-4', source: 'n3', target: 'n4', label: '5 days', type: 'causal' },
            { id: 'e4-5', source: 'n4', target: 'n5', label: '10 days', type: 'deterioration' },
            { id: 'e5-6', source: 'n5', target: 'n6', label: '5 days', type: 'decision' },
            { id: 'e6-7', source: 'n6', target: 'n7', label: '10 days', type: 'progression' },
            { id: 'e7-8', source: 'n7', target: 'n8', label: '8 days', type: 'deterioration' },
            { id: 'e8-9', source: 'n8', target: 'n9', label: '7 days', type: 'failure' },
            { id: 'e9-10', source: 'n9', target: 'n10', label: '14 hrs', type: 'response' },
            { id: 'e10-11', source: 'n10', target: 'n11', label: '2 days', type: 'investigation' },
            { id: 'e11-12', source: 'n11', target: 'n12', label: '3 days', type: 'investigation' },
            { id: 'e12-13', source: 'n12', target: 'n13', label: '2 days', type: 'interim' },
            { id: 'e13-14', source: 'n13', target: 'n14', label: '7 days', type: 'resolution' }
          ]
        },
        
        tenantId,
        organizationId
      });

      rcaCount++;
      console.log(`✅ RCA ${rcaCount}/7: ${rca4.title} (Recommendations with Event Diagram - 14 nodes)`);

      // =============================================
      // RCA 5: ANALYSIS - SRU Furnace
      // =============================================
      
      console.log('  Creating RCA 5/7: SRU Furnace (ANALYSIS phase)...');
      
      const rca5 = await masterDataService.createRCA({
        title: 'SRU Furnace Refractory Failure',
        description: 'Analysis of premature refractory degradation',
        eventId: criticalEvents[4]?.id,
        unitId: units.find(u => u.name.includes('Sulfur'))?.id || units[4].id,
        templateId: templates[0]?.id,
        status: 'Analysis',
        priority: 'Medium',
        rootCause: '',
        targetCloseDate: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        teamMemberIds: userIds.slice(0, 2),
        evidence: [
          {
            id: 'ev-rca5-1',
            title: 'Refractory Inspection',
            description: 'Significant spalling and cracking observed',
            type: 'Document' as const,
            collectedBy: userIds[0] || 'Inspector',
            collectedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            category: 'Inspection',
            verified: true,
            nodeIds: []
          }
        ],
        logicTree: [],
        recommendations: [],
        correctiveActions: [],
        findings: {},
        rcaCauseCodeIds: [],
        
        eventDiagram: {
          nodes: [
            { id: 'n1', data: { label: 'Normal Operation', time: 'Day -180', description: 'SRU furnace refractory in good condition post-turnaround. Design life: 24 months.' }, position: { x: 50, y: 100 }, type: 'normal' },
            { id: 'n2', data: { label: 'Normal Wear', time: 'Day -120', description: 'Routine inspection shows normal wear pattern. Thickness 95% of original.' }, position: { x: 200, y: 100 }, type: 'normal' },
            { id: 'n3', data: { label: 'Temperature Cycling', time: 'Day -60', description: 'Multiple startup/shutdown cycles due to acid gas supply fluctuations.' }, position: { x: 350, y: 100 }, type: 'event' },
            { id: 'n4', data: { label: 'Thermal Stress', time: 'Day -45', description: 'Refractory subjected to 15 thermal cycles (design: 5 cycles/year).' }, position: { x: 500, y: 100 }, type: 'warning' },
            { id: 'n5', data: { label: 'First Cracks Observed', time: 'Day -30', description: 'Inspection camera shows hairline cracks in burner zone. Minor spalling.' }, position: { x: 650, y: 100 }, type: 'alarm' },
            { id: 'n6', data: { label: 'Decision Point', time: 'Day -25', description: 'Decided to monitor closely. Cracks within acceptable limits per vendor guidance.' }, position: { x: 800, y: 100 }, type: 'decision' },
            { id: 'n7', data: { label: 'Crack Propagation', time: 'Day -15', description: 'Cracks expanded. Spalling increased. Shell temperature hot spots detected.' }, position: { x: 950, y: 100 }, type: 'alarm' },
            { id: 'n8', data: { label: 'Hot Spot Alarm', time: 'Day -7', description: 'Furnace shell temperature 180°C vs normal 120°C. Refractory thinning suspected.' }, position: { x: 1100, y: 100 }, type: 'alarm' },
            { id: 'n9', data: { label: 'MAJOR SPALLING EVENT', time: 'Day 0, 02:00', description: 'Large refractory section detached. Gas bypass to shell. CO alarm activated.' }, position: { x: 1250, y: 100 }, type: 'failure' },
            { id: 'n10', data: { label: 'Unit Shutdown', time: 'Day 0, 02:15', description: 'Manual shutdown initiated. Acid gas routed to incinerator. Area evacuated.' }, position: { x: 1400, y: 100 }, type: 'response' },
            { id: 'n11', data: { label: 'Emergency Inspection', time: 'Day 0, 08:00', description: 'Borescope inspection shows extensive damage. 40% of burner zone refractory compromised.' }, position: { x: 1550, y: 100 }, type: 'investigation' },
            { id: 'n12', data: { label: 'Investigation Ongoing', time: 'Day 3', description: 'Metallurgy team analyzing samples. Thermal cycling identified as key factor.' }, position: { x: 1700, y: 100 }, type: 'investigation' },
            { id: 'n13', data: { label: 'Status: Analysis Phase', time: 'Day 7', description: 'Detailed thermal stress analysis ongoing. Replacement refractory being specified.' }, position: { x: 1850, y: 100 }, type: 'investigation' }
          ],
          edges: [
            { id: 'e1-2', source: 'n1', target: 'n2', label: '60 days', type: 'timeline' },
            { id: 'e2-3', source: 'n2', target: 'n3', label: '60 days', type: 'timeline' },
            { id: 'e3-4', source: 'n3', target: 'n4', label: '15 days', type: 'causal' },
            { id: 'e4-5', source: 'n4', target: 'n5', label: '15 days', type: 'deterioration' },
            { id: 'e5-6', source: 'n5', target: 'n6', label: '5 days', type: 'decision' },
            { id: 'e6-7', source: 'n6', target: 'n7', label: '10 days', type: 'progression' },
            { id: 'e7-8', source: 'n7', target: 'n8', label: '8 days', type: 'deterioration' },
            { id: 'e8-9', source: 'n8', target: 'n9', label: '7 days', type: 'failure' },
            { id: 'e9-10', source: 'n9', target: 'n10', label: '15 min', type: 'response' },
            { id: 'e10-11', source: 'n10', target: 'n11', label: '5.75 hrs', type: 'investigation' },
            { id: 'e11-12', source: 'n11', target: 'n12', label: '3 days', type: 'investigation' },
            { id: 'e12-13', source: 'n12', target: 'n13', label: '4 days', type: 'investigation' }
          ]
        },
        
        tenantId,
        organizationId
      });

      rcaCount++;
      console.log(`✅ RCA ${rcaCount}/7: ${rca5.title} (Analysis with Event Diagram - 13 nodes)`);

      // =============================================
      // RCA 6: DATA COLLECTION - VDU Vacuum Loss
      // =============================================
      
      console.log('  Creating RCA 6/7: VDU Vacuum (DATA COLLECTION phase)...');
      
      const rca6 = await masterDataService.createRCA({
        title: 'Vacuum Distillation Unit Vacuum Loss',
        description: 'Investigation of sudden vacuum system degradation',
        eventId: criticalEvents[5]?.id,
        unitId: units.find(u => u.name.includes('Vacuum'))?.id || units[5].id,
        templateId: templates[1]?.id,
        status: 'Data Collection',
        priority: 'Medium',
        rootCause: '',
        targetCloseDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        teamMemberIds: userIds.slice(2, 3),
        evidence: [
          {
            id: 'ev-rca6-1',
            title: 'Vacuum Pressure Trend',
            description: 'Pressure increased from 50 mmHg to 120 mmHg',
            type: 'Time Series' as const,
            collectedBy: userIds[2] || 'Operator',
            collectedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            category: 'Process Data',
            verified: true,
            nodeIds: []
          }
        ],
        logicTree: [],
        recommendations: [],
        correctiveActions: [],
        findings: {},
        rcaCauseCodeIds: [],
        
        eventDiagram: {
          nodes: [
            { id: 'n1', data: { label: 'Normal Operation', time: 'Day -14, 08:00', description: 'VDU operating at design vacuum 50 mmHg, VGO yield 65%, product quality on-spec' }, position: { x: 50, y: 100 }, type: 'normal' },
            { id: 'n2', data: { label: 'Vacuum Creeping', time: 'Day -10', description: 'Vacuum pressure slowly increased to 60 mmHg. Operators noted but within operating range.' }, position: { x: 200, y: 100 }, type: 'warning' },
            { id: 'n3', data: { label: 'VGO Quality Degradation', time: 'Day -7', description: 'VGO flash point decreased from 180°C to 165°C. Lighter ends content increasing.' }, position: { x: 350, y: 100 }, type: 'warning' },
            { id: 'n4', data: { label: 'Ejector Performance Check', time: 'Day -5', description: 'Steam ejector steam flow verified OK. Cooling water flow OK. No obvious issue.' }, position: { x: 500, y: 100 }, type: 'investigation' },
            { id: 'n5', data: { label: 'Vacuum Further Degraded', time: 'Day -3', description: 'Pressure at 80 mmHg. VGO yield dropped to 62%. Product borderline off-spec.' }, position: { x: 650, y: 100 }, type: 'alarm' },
            { id: 'n6', data: { label: 'Decision Point', time: 'Day -2', description: 'Scheduled deep investigation for next shutdown in 7 days. Continued operation at reduced rate.' }, position: { x: 800, y: 100 }, type: 'decision' },
            { id: 'n7', data: { label: 'RAPID VACUUM LOSS', time: 'Day 0, 03:00', description: 'Vacuum pressure jumped to 120 mmHg. VGO yield collapsed to 58%. Product off-spec.' }, position: { x: 950, y: 100 }, type: 'failure' },
            { id: 'n8', data: { label: 'Unit Derate', time: 'Day 0, 06:00', description: 'Reduced feed from 60k BPD to 45k BPD to maintain product quality. $450k/day loss.' }, position: { x: 1100, y: 100 }, type: 'response' },
            { id: 'n9', data: { label: 'Emergency Investigation', time: 'Day 0, 10:00', description: 'All ejector stages checked. Steam traps inspected. Condenser performance assessed.' }, position: { x: 1250, y: 100 }, type: 'investigation' },
            { id: 'n10', data: { label: 'Fouling Suspected', time: 'Day 1', description: 'Intercondenser shell-side fouling suspected. Cooling water quality data being reviewed.' }, position: { x: 1400, y: 100 }, type: 'investigation' },
            { id: 'n11', data: { label: 'Data Collection', time: 'Day 3', description: 'Collecting cooling water analysis, ejector performance curves, previous cleaning records.' }, position: { x: 1550, y: 100 }, type: 'investigation' },
            { id: 'n12', data: { label: 'Status: Ongoing', time: 'Day 5', description: 'RCA team gathering all evidence. Root cause analysis in progress. Condenser cleaning scheduled.' }, position: { x: 1700, y: 100 }, type: 'investigation' }
          ],
          edges: [
            { id: 'e1-2', source: 'n1', target: 'n2', label: '4 days', type: 'timeline' },
            { id: 'e2-3', source: 'n2', target: 'n3', label: '3 days', type: 'deterioration' },
            { id: 'e3-4', source: 'n3', target: 'n4', label: '2 days', type: 'investigation' },
            { id: 'e4-5', source: 'n4', target: 'n5', label: '2 days', type: 'progression' },
            { id: 'e5-6', source: 'n5', target: 'n6', label: '1 day', type: 'decision' },
            { id: 'e6-7', source: 'n6', target: 'n7', label: '2 days', type: 'failure' },
            { id: 'e7-8', source: 'n7', target: 'n8', label: '3 hrs', type: 'response' },
            { id: 'e8-9', source: 'n8', target: 'n9', label: '4 hrs', type: 'investigation' },
            { id: 'e9-10', source: 'n9', target: 'n10', label: '1 day', type: 'investigation' },
            { id: 'e10-11', source: 'n10', target: 'n11', label: '2 days', type: 'investigation' },
            { id: 'e11-12', source: 'n11', target: 'n12', label: '2 days', type: 'investigation' }
          ]
        },
        
        tenantId,
        organizationId
      });

      rcaCount++;
      console.log(`✅ RCA ${rcaCount}/7: ${rca6.title} (Data Collection with Event Diagram - 12 nodes)`);

      // =============================================
      // RCA 7: DRAFT - Cooling Tower
      // =============================================
      
      console.log('  Creating RCA 7/7: Cooling Tower (DRAFT phase)...');
      
      const rca7 = await masterDataService.createRCA({
        title: 'Cooling Tower Efficiency Degradation',
        description: 'Initial investigation into reduced cooling tower performance',
        eventId: criticalEvents[6]?.id,
        unitId: units.find(u => u.name.includes('Utilities'))?.id || units[6].id,
        templateId: templates[0]?.id,
        status: 'Draft',
        priority: 'Low',
        rootCause: '',
        targetCloseDate: new Date(Date.now() + 50 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        teamMemberIds: [userIds[0] || ''],
        evidence: [],
        logicTree: [],
        recommendations: [],
        correctiveActions: [],
        findings: {},
        rcaCauseCodeIds: [],
        
        eventDiagram: {
          nodes: [
            { id: 'n1', data: { label: 'Normal Operation', time: 'Day -21', description: 'Cooling tower providing 30°C water, approach 5°C, range 12°C, all normal' }, position: { x: 50, y: 100 }, type: 'normal' },
            { id: 'n2', data: { label: 'Water Temp Increase', time: 'Day -14', description: 'Cooling water temperature slowly increasing to 32°C. Ambient temp unchanged.' }, position: { x: 200, y: 100 }, type: 'warning' },
            { id: 'n3', data: { label: 'Fill Media Check', time: 'Day -10', description: 'Visual inspection of fill shows some algae growth. Within normal range.' }, position: { x: 350, y: 100 }, type: 'investigation' },
            { id: 'n4', data: { label: 'Temperature Alarm', time: 'Day -7', description: 'Cooling water at 34°C. Units experiencing reduced heat transfer efficiency.' }, position: { x: 500, y: 100 }, type: 'alarm' },
            { id: 'n5', data: { label: 'Process Impact', time: 'Day -5', description: 'FCCU reactor temperatures 3°C higher. ADU condenser pressures increased.' }, position: { x: 650, y: 100 }, type: 'alarm' },
            { id: 'n6', data: { label: 'Decision Point', time: 'Day -3', description: 'Planned to increase biocide dosing and schedule cleaning for next weekend.' }, position: { x: 800, y: 100 }, type: 'decision' },
            { id: 'n7', data: { label: 'EFFICIENCY COLLAPSE', time: 'Day 0', description: 'Cooling water at 38°C. Multiple units derating. Fill media 60% blocked.' }, position: { x: 950, y: 100 }, type: 'failure' },
            { id: 'n8', data: { label: 'Emergency Response', time: 'Day 0, 08:00', description: 'Activated backup cooling tower. Increased biocide 3x. Operations alerted.' }, position: { x: 1100, y: 100 }, type: 'response' },
            { id: 'n9', data: { label: 'Impact Assessment', time: 'Day 1', description: 'Overall refinery throughput reduced 15%. Production loss $850k/day.' }, position: { x: 1250, y: 100 }, type: 'investigation' },
            { id: 'n10', data: { label: 'Investigation Started', time: 'Day 2', description: 'RCA team formed. Collecting data on fill condition, water chemistry, biocide program.' }, position: { x: 1400, y: 100 }, type: 'investigation' },
            { id: 'n11', data: { label: 'Status: Draft Phase', time: 'Day 5', description: 'Defining problem statement. Assembling timeline. Scheduling cleaning. RCA in early phase.' }, position: { x: 1550, y: 100 }, type: 'investigation' }
          ],
          edges: [
            { id: 'e1-2', source: 'n1', target: 'n2', label: '7 days', type: 'timeline' },
            { id: 'e2-3', source: 'n2', target: 'n3', label: '4 days', type: 'investigation' },
            { id: 'e3-4', source: 'n3', target: 'n4', label: '3 days', type: 'deterioration' },
            { id: 'e4-5', source: 'n4', target: 'n5', label: '2 days', type: 'progression' },
            { id: 'e5-6', source: 'n5', target: 'n6', label: '2 days', type: 'decision' },
            { id: 'e6-7', source: 'n6', target: 'n7', label: '3 days', type: 'failure' },
            { id: 'e7-8', source: 'n7', target: 'n8', label: '8 hrs', type: 'response' },
            { id: 'e8-9', source: 'n8', target: 'n9', label: '1 day', type: 'investigation' },
            { id: 'e9-10', source: 'n9', target: 'n10', label: '1 day', type: 'investigation' },
            { id: 'e10-11', source: 'n10', target: 'n11', label: '3 days', type: 'investigation' }
          ]
        },
        
        tenantId,
        organizationId
      });

      rcaCount++;
      console.log(`✅ RCA ${rcaCount}/7: ${rca7.title} (Draft with Event Diagram - 11 nodes)`);

      console.log(`\n🎉 Successfully created ${rcaCount} comprehensive RCAs with EVENT DIAGRAMS!`);
      console.log(`   - 2 Closed (full data with 5-Why, Fishbone, Event Diagrams)`);
      console.log(`   - 1 Approval (with Event Diagram)`);
      console.log(`   - 1 Recommendations (with Event Diagram)`);
      console.log(`   - 1 Analysis (with Event Diagram)`);
      console.log(`   - 1 Data Collection (with Event Diagram)`);
      console.log(`   - 1 Draft (with Event Diagram)`);
      console.log(`   - Event Diagram Nodes: 12 + 15 + 13 + 14 + 13 + 12 + 11 = 90 nodes total`);
      console.log(`   - Logic Trees with Q&A for all RCAs`);
      console.log(`   - 5-Why Analysis for closed RCAs`);
      console.log(`   - Fishbone Diagrams for closed RCAs`);
      console.log(`   - Evidence for all RCAs`);
      console.log(`   - Recommendations for advanced RCAs`);
      
      console.log('✅ Comprehensive RCA seeding completed - ALL 7 RCAs with event diagrams');
      return;
    } catch (error) {
      console.error('❌ Failed to seed comprehensive RCAs:', error);
      throw error;
    }
  }

  // Old basic seeder (backup - not used)
  private async seedBasicRCAInvestigations(tenantId: string): Promise<void> {
    const events = await masterDataService.getProductionEvents({ tenantId });
    const templates = await masterDataService.getRCATemplates({ tenantId });
    const units = await masterDataService.getUnits();
    const rcaCauseCodes = await masterDataService.getRCACauseCodes({ tenantId });
    const users = await masterDataService.getUsers({ tenantId });
    
    // Filter for critical events
    const criticalEvents = events.filter(e => 
      e.severity === 'Critical' || e.severity === 'High' || 
      (e.duration && e.duration > 360)
    ).slice(0, 10);

    const investigations = [
      {
        title: 'FCC Air Blower Failure Investigation',
        description: 'Root cause analysis of catastrophic air blower failure in FCCU',
        eventId: criticalEvents.find(e => e.description?.includes('blower'))?.id || criticalEvents[0]?.id,
        unitId: units.find(u => u.code === 'FCCU-01')?.id || units[0].id,
        templateId: templates.find(t => t.category === 'Equipment')?.id,
        status: 'Closed' as const,
        priority: 'Critical' as const,
        rootCause: 'Bearing failure due to inadequate lubrication system maintenance',
        targetCloseDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        teamMemberIds: [],
        evidence: [],
        recommendations: [
          {
            id: 'rec-fccu-1',
            description: 'Replace damaged compressor and upgrade bearing system',
            assignedTo: 'Mechanical Team',
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            status: 'In Progress',
            verificationStatus: 'Pending',
            verificationDate: ''
          },
          {
            id: 'rec-fccu-2',
            description: 'Implement predictive maintenance program with vibration monitoring',
            assignedTo: 'Reliability Team',
            dueDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            status: 'Planned',
            verificationStatus: 'Pending',
            verificationDate: ''
          }
        ],
        correctiveActions: [
          {
            id: 'action-fccu-1',
            description: 'Replace damaged compressor and upgrade bearing system',
            assignedTo: 'Mechanical Team',
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            status: 'In Progress',
            verificationStatus: 'Pending',
            verificationDate: ''
          },
          {
            id: 'action-fccu-2',
            description: 'Implement predictive maintenance program with vibration monitoring',
            assignedTo: 'Reliability Team',
            dueDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            status: 'Planned',
            verificationStatus: 'Pending',
            verificationDate: ''
          }
        ],
        findings: {
          immediate: 'Bearing seizure caused rapid temperature rise and catastrophic failure',
          underlying: 'Lubrication oil filter was clogged, restricting oil flow',
          systemic: 'Preventive maintenance schedule did not include filter inspection'
        },
        rcaCauseCodeIds: [rcaCauseCodes.find(c => c.code === 'ROOT_MAINT_PRACT')?.id].filter(Boolean) as string[],
        tenantId,
        organizationId: ''
      },
      {
        title: 'Crude Furnace Tube Leak Analysis',
        description: 'Investigation of furnace tube failure and emergency shutdown',
        eventId: criticalEvents.find(e => e.description?.includes('furnace'))?.id || criticalEvents[1]?.id,
        unitId: units.find(u => u.code === 'ADU-01')?.id || units[0].id,
        templateId: templates.find(t => t.category === 'Equipment')?.id,
        status: 'Closed' as const,
        priority: 'Critical' as const,
        rootCause: 'Localized overheating due to coke deposition inside tube caused by inadequate desalter performance',
        targetCloseDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        teamMemberIds: [],
        evidence: [],
        recommendations: [
          {
            id: 'rec-adu-1',
            description: 'Replace failed tube and inspect adjacent tubes',
            assignedTo: 'Maintenance Team',
            dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            status: 'In Progress',
            verificationStatus: 'Pending',
            verificationDate: ''
          },
          {
            id: 'rec-adu-2',
            description: 'Review crude desalting performance to reduce salt carryover',
            assignedTo: 'Process Team',
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            status: 'Planned',
            verificationStatus: 'Pending',
            verificationDate: ''
          }
        ],
        correctiveActions: [
          {
            id: 'action-adu-1',
            description: 'Replace failed tube and inspect adjacent tubes',
            assignedTo: 'Maintenance Team',
            dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            status: 'In Progress',
            verificationStatus: 'Pending',
            verificationDate: ''
          },
          {
            id: 'action-adu-2',
            description: 'Review crude desalting performance to reduce salt carryover',
            assignedTo: 'Process Team',
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            status: 'Planned',
            verificationStatus: 'Pending',
            verificationDate: ''
          }
        ],
        findings: {
          immediate: 'Tube rupture due to metal temperature exceeding design limits',
          underlying: 'Internal coke buildup restricted flow and caused hot spots',
          systemic: 'Inadequate desalter performance allowed high salt content in crude'
        },
        rcaCauseCodeIds: [
          rcaCauseCodes.find(c => c.code === 'ROOT_PROC_CTRL')?.id,
          rcaCauseCodes.find(c => c.code === 'ROOT_MAINT_PRACT')?.id
        ].filter(Boolean) as string[],
        tenantId,
        organizationId: ''
      },
      {
        title: 'Gas Turbine Vibration Trip',
        description: 'Analysis of unexpected turbine shutdown due to high vibration',
        eventId: criticalEvents.find(e => e.description?.includes('turbine'))?.id || criticalEvents[2]?.id,
        unitId: units.find(u => u.code === 'UTIL-01')?.id || units[0].id,
        templateId: templates.find(t => t.category === 'Equipment')?.id,
        status: 'Closed' as const,
        priority: 'High' as const,
        rootCause: 'Bearing wear due to contaminated lubricant and missed preventive maintenance',
        targetCloseDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        teamMemberIds: [],
        evidence: [],
        recommendations: [
          {
            id: 'rec-util-1',
            description: 'Perform borescope inspection of turbine internals',
            assignedTo: 'OEM Service Team',
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            status: 'In Progress',
            verificationStatus: 'Pending',
            verificationDate: ''
          }
        ],
        correctiveActions: [
          {
            id: 'action-util-1',
            description: 'Perform borescope inspection of turbine internals',
            assignedTo: 'OEM Service Team',
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            status: 'In Progress',
            verificationStatus: 'Pending',
            verificationDate: ''
          }
        ],
        findings: {
          immediate: 'High vibration triggered emergency shutdown',
          underlying: 'Bearing wear from contaminated lubricant',
          systemic: 'Missed preventive maintenance window due to operational priorities'
        },
        rcaCauseCodeIds: [],
        tenantId,
        organizationId: ''
      }
    ];

    for (const rca of investigations) {
      await masterDataService.createRCA(rca);
      console.log(`✅ Created RCA: ${rca.title}`);
    }
  }

  // Seed production losses
  private async seedOilGasProductionLosses(tenantId: string): Promise<void> {
    console.log('📉 Seeding production losses from ProductionLoss events...');
    
    const events = await masterDataService.getProductionEvents({ tenantId });
    const units = await masterDataService.getUnits();
    const reasonCodes = await masterDataService.getReasonCodes({ tenantId });
    const impactCodes = await masterDataService.getImpactCodes({ tenantId });
    
    // Create production losses from ProductionLoss events (not Downtime)
    const lossEvents = events.filter(e => e.eventType === 'ProductionLoss' && e.duration);
    
    console.log(`   Found ${lossEvents.length} ProductionLoss events to convert to losses`);
    
    for (const event of lossEvents) {
      const unit = units.find(u => u.id === event.unitId);
      if (!unit) continue;
      
      // Use quantity from event if available, otherwise calculate from unit capacity
      const lossQuantity = event.quantity || Math.floor((unit.capacity / 24) * ((event.duration || 0) / 60));
      
      // Get cost from impact code if available
      const impactCode = event.impactCodeId ? impactCodes.find(ic => ic.id === event.impactCodeId) : null;
      let financialImpact = lossQuantity * 50; // Default $50 per barrel
      
      if (impactCode?.costPerHour && event.duration) {
        financialImpact = (event.duration / 60) * impactCode.costPerHour;
      } else if (impactCode?.costPerUnit && lossQuantity) {
        financialImpact = lossQuantity * impactCode.costPerUnit;
      }
      
      await masterDataService.createProductionLoss({
        unitId: event.unitId,
        assetId: event.assetId,
        eventId: event.id,
        lossDate: event.timestamp.split('T')[0],
        lossType: 'Unplanned Downtime',
        lossCategory: event.lossCategory || 'Availability',
        quantity: lossQuantity,
        duration: event.duration,
        reasonCodeId: reasonCodes.length > 0 ? reasonCodes[Math.floor(Math.random() * reasonCodes.length)].id : undefined,
        impactCodeId: event.impactCodeId,
        description: `Production loss due to: ${event.description}`,
        financialImpact: financialImpact,
        tenantId,
        organizationId: ''
      });
    }
    
    console.log(`✅ Created ${lossEvents.length} production losses from ProductionLoss events`);
  }

  // Seed OEE summaries
  private async seedOilGasOEESummaries(tenantId: string): Promise<void> {
    console.log('📊 Seeding OEE summaries...');
    
    const units = await masterDataService.getUnits();
    const events = await masterDataService.getProductionEvents({ tenantId });
    
    // Generate OEE summaries for the past 60 days
    const now = new Date();
    for (let i = 0; i < 60; i++) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      
      for (const unit of units.slice(0, 5)) { // First 5 units
        // Calculate OEE components
        const dayEvents = events.filter(e => 
          e.unitId === unit.id && 
          e.timestamp.startsWith(dateStr)
        );
        
        const totalDowntime = dayEvents
          .filter(e => e.eventType === 'Downtime')
          .reduce((sum, e) => sum + (e.duration || 0), 0);
        
        const availability = Math.max(0, (1440 - totalDowntime) / 1440); // 1440 mins per day
        const performance = 0.75 + Math.random() * 0.20; // 75-95%
        const quality = 0.90 + Math.random() * 0.08; // 90-98%
        const oee = availability * performance * quality;
        
        await masterDataService.createOEESummary({
          unitId: unit.id,
          date: dateStr,
          shift: 'All',
          availability: Number((availability * 100).toFixed(2)),
          performance: Number((performance * 100).toFixed(2)),
          quality: Number((quality * 100).toFixed(2)),
          oee: Number((oee * 100).toFixed(2)),
          plannedProductionTime: 1440,
          actualProductionTime: 1440 - totalDowntime,
          downtime: totalDowntime,
          idealCycleTime: unit.idealCycleTime || 60,
          totalCount: Math.floor((1440 - totalDowntime) * 10),
          goodCount: Math.floor((1440 - totalDowntime) * 10 * quality),
          tenantId,
          organizationId: ''
        });
      }
    }
    
    console.log(`✅ Created ${60 * Math.min(units.length, 5)} OEE summaries`);
  }

  // Seed dashboard data
  private async seedOilGasDashboardData(tenantId: string): Promise<void> {
    console.log('📊 Seeding dashboard data...');
    // Dashboard data is derived from other data, no specific seeding needed
    console.log('✅ Dashboard data will be calculated from existing data');
  }

  // Verification methods
  private async verifyDataConsistency(tenantId: string): Promise<void> {
    console.log('🔍 Verifying data consistency...');
    
    const [units, assets, events, plans] = await Promise.all([
      masterDataService.getUnits(),
      masterDataService.getAssets({ tenantId }),
      masterDataService.getProductionEvents({ tenantId }),
      masterDataService.getProductionPlans({ tenantId })
    ]);
    
    // Check that all assets reference valid units
    for (const asset of assets) {
      if (!units.find(u => u.id === asset.unitId)) {
        console.warn(`⚠️ Asset ${asset.name} references non-existent unit ${asset.unitId}`);
      }
    }
    
    // Check that all events reference valid units
    for (const event of events) {
      if (!units.find(u => u.id === event.unitId)) {
        console.warn(`⚠️ Event references non-existent unit ${event.unitId}`);
      }
    }
    
    console.log('✅ Data consistency check completed');
  }

  private async verifyOilGasData(tenantId: string): Promise<void> {
    console.log('✅ Verifying Oil and Gas data...');
    
    const [
      impactCodes,
      oeeCodes,
      reasonCodes,
      units,
      assets,
      products,
      plans,
      events,
      rcas,
      users,
      rcaTemplates,
      verificationChecklists
    ] = await Promise.all([
      masterDataService.getImpactCodes({ tenantId }),
      masterDataService.getOEECodes({ tenantId }),
      masterDataService.getReasonCodes({ tenantId }),
      masterDataService.getUnits(),
      masterDataService.getAssets({ tenantId }),
      masterDataService.getProducts(),
      masterDataService.getProductionPlans({ tenantId }),
      masterDataService.getProductionEvents({ tenantId }),
      masterDataService.getRCAs({ tenantId }),
      storageService.query<User>('users', { tenantId }),
      masterDataService.getRCATemplates({ tenantId }),
      masterDataService.getVerificationStatusCodes({ tenantId })
    ]);
    
    console.log(`✅ Impact Codes: ${impactCodes.length}`);
    console.log(`✅ OEE Codes: ${oeeCodes.length}`);
    console.log(`✅ Reason Codes: ${reasonCodes.length}`);
    console.log(`✅ Units: ${units.length}`);
    console.log(`✅ Assets: ${assets.length}`);
    console.log(`✅ Products: ${products.length}`);
    console.log(`✅ Users: ${users.length}`);
    console.log(`✅ Production Plans: ${plans.length}`);
    console.log(`✅ Production Events: ${events.length}`);
    console.log(`✅ RCA Investigations: ${rcas.length}`);
    console.log(`✅ RCA Templates: ${rcaTemplates.length} (with logic trees & checklists)`);
    console.log(`✅ Verification Checklists: ${verificationChecklists.length} (total items: ${verificationChecklists.reduce((sum, c) => sum + (c.items?.length || 0), 0)})`);
  }

  private async autoSelectFirstUnit(tenantId: string): Promise<void> {
    console.log('🎯 Auto-selecting first unit...');
    const units = await masterDataService.getUnits();
    if (units.length > 0) {
      console.log(`✅ First unit available: ${units[0].name}`);
    }
  }

  // Clear existing oil and gas data
  private async clearExistingOilGasData(tenantId: string): Promise<void> {
    console.log('🧹 Clearing ALL existing data (including cement industry data)...');
    
    try {
      // Get all tenants to clear data for each
      const allTenants = await masterDataService.getTenants();
      console.log(`   Found ${allTenants.length} tenant(s) with data to clear`);
      
      // Clear data for EACH tenant
      for (const tenant of allTenants) {
        console.log(`   Clearing data for tenant: ${tenant.name}`);
        
        // Clear production plans
        const plans = await masterDataService.getProductionPlans({ tenantId: tenant.id });
        for (const plan of plans) {
          await masterDataService.deleteProductionPlan(plan.id);
        }

        // Clear production plan templates
        const templates = await masterDataService.getProductionPlanTemplates({ tenantId: tenant.id });
        for (const template of templates) {
          await masterDataService.deleteProductionPlanTemplate(template.id);
        }

        // Clear production events
        const events = await masterDataService.getProductionEvents({ tenantId: tenant.id });
        for (const event of events) {
          await masterDataService.deleteProductionEvent(event.id);
        }

        // Clear RCA templates
        const rcaTemplates = await masterDataService.getRCATemplates({ tenantId: tenant.id });
        for (const template of rcaTemplates) {
          await masterDataService.deleteRCATemplate(template.id);
        }

        // Clear RCA investigations
        const investigations = await masterDataService.getRCAs({ tenantId: tenant.id });
        for (const investigation of investigations) {
          await masterDataService.deleteRCA(investigation.id);
        }

        // Clear production losses
        const losses = await masterDataService.getProductionLosses({ tenantId: tenant.id });
        for (const loss of losses) {
          await masterDataService.deleteProductionLoss(loss.id);
        }

        // Clear OEE summaries
        const oeeSummaries = await masterDataService.getOEESummaries({ tenantId: tenant.id });
        for (const oee of oeeSummaries) {
          await masterDataService.deleteOEESummary(oee.id);
        }

        // Clear assets
        const assets = await masterDataService.getAssets({ tenantId: tenant.id });
        for (const asset of assets) {
          await masterDataService.deleteAsset(asset.id);
        }

        // Clear master data codes for this tenant
        const impactCodes = await masterDataService.getImpactCodes({ tenantId: tenant.id });
        for (const code of impactCodes) {
          await masterDataService.deleteImpactCode(code.id);
        }

        const oeeCodes = await masterDataService.getOEECodes({ tenantId: tenant.id });
        for (const code of oeeCodes) {
          await masterDataService.deleteOEECode(code.id);
        }

        const reasonCodes = await masterDataService.getReasonCodes({ tenantId: tenant.id });
        for (const code of reasonCodes) {
          await masterDataService.deleteReasonCode(code.id);
        }

        const rcaCauseCodes = await masterDataService.getRCACauseCodes({ tenantId: tenant.id });
        for (const code of rcaCauseCodes) {
          await masterDataService.deleteRCACauseCode(code.id);
        }

        const verificationCodes = await masterDataService.getVerificationStatusCodes({ tenantId: tenant.id });
        for (const code of verificationCodes) {
          await masterDataService.deleteVerificationStatusCode(code.id);
        }
      }

      // Clear all units (not tenant-specific)
      const units = await masterDataService.getUnits();
      for (const unit of units) {
        await masterDataService.deleteUnit(unit.id);
      }
      console.log(`   Cleared ${units.length} units`);

      // Clear all products (not tenant-specific)
      const products = await masterDataService.getProducts();
      for (const product of products) {
        await masterDataService.deleteProduct(product.id);
      }
      console.log(`   Cleared ${products.length} products`);

      // Clear all tenants
      for (const tenant of allTenants) {
        await masterDataService.deleteTenant(tenant.id);
      }
      console.log(`   Cleared ${allTenants.length} tenant(s)`);

      // Clear all organizations
      const organizations = await masterDataService.getOrganizations();
      for (const org of organizations) {
        await masterDataService.deleteOrganization(org.id);
      }
      console.log(`   Cleared ${organizations.length} organization(s)`);

      // Clear all users
      const allUsers = await storageService.query<User>('users', {});
      for (const user of allUsers) {
        await storageService.delete('users', user.id);
      }
      console.log(`   Cleared ${allUsers.length} user(s)`);

      console.log('✅ All existing data cleared (Cement + any other data)');
    } catch (error) {
      console.warn('⚠️ Warning: Could not clear some existing data:', error);
      // Continue anyway - we'll try to seed fresh data
    }
  }
}

// Global instance
export const globalOilGasDataSeeder = new OilGasDataSeeder();

