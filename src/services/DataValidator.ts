// Automated Data Validator and Fixer
import { masterDataService } from './MasterDataService';
import { globalCementIndustryDataSeeder } from './CementIndustryDataSeeder';
import { appSettingsApi } from './api/appSettingsApi';

export class DataValidator {
  private static instance: DataValidator;
  private isValidating = false;
  private hasValidated = false;

  private constructor() {}

  static getInstance(): DataValidator {
    if (!DataValidator.instance) {
      DataValidator.instance = new DataValidator();
    }
    return DataValidator.instance;
  }

  /**
   * Automatically validate and fix data issues
   */
  async validateAndFix(sessionTenantId?: string): Promise<{
    success: boolean;
    message: string;
    needsReload?: boolean;
  }> {
    if (this.isValidating) {
      console.log('⏳ Validation already in progress...');
      return { success: false, message: 'Validation in progress' };
    }

    if (this.hasValidated) {
      console.log('✅ Data already validated in this session');
      return { success: true, message: 'Already validated' };
    }

    this.isValidating = true;

    try {
      console.log('🔍 Auto-validating data...');
      
      // Step 1: Check if we have any organizations and tenants
      const organizations = await masterDataService.getOrganizations();
      const tenants = await masterDataService.getTenants();
      
      console.log(`   Found ${organizations.length} organizations, ${tenants.length} tenants`);

      // Step 2: If no data exists, DON'T auto-seed (let user choose industry)
      if (organizations.length === 0 || tenants.length === 0) {
        console.log('📦 No data found. Please use Data Seeding page to seed ADNOC or Cement data.');
        // DISABLED: Auto-seeding removed - user should choose industry type
        // await globalCementIndustryDataSeeder.seedCementIndustryData('temp');
        this.hasValidated = true;
        this.isValidating = false;
        return {
          success: true,
          message: 'No data found - please seed manually from Data Seeding page',
          needsReload: false
        };
      }

      // Step 3: Find the cement industry tenant (Margoon Cement)
      const cementTenant = tenants.find(t => 
        t.name.includes('Margoon') || t.code.includes('MARGOON')
      );

      if (!cementTenant) {
        console.log('⚠️ Margoon Cement tenant not found (this is OK if using ADNOC data)');
        // DISABLED: Auto-seeding removed - user should choose industry type
        // await globalCementIndustryDataSeeder.seedCementIndustryData('temp');
        this.hasValidated = true;
        this.isValidating = false;
        return {
          success: true,
          message: 'Using existing data (not cement-specific)',
          needsReload: false
        };
      }

      console.log(`   Found cement tenant: ${cementTenant.name} (ID: ${cementTenant.id})`);

      // Step 4: Check if session tenant ID matches
      if (sessionTenantId && sessionTenantId !== cementTenant.id) {
        console.log(`⚠️ Session tenant mismatch!`);
        console.log(`   Session: ${sessionTenantId}`);
        console.log(`   Cement Tenant: ${cementTenant.id}`);
        
        // Update plant selection to use the correct tenant
        await this.autoFixPlantSelection(cementTenant.id);
        
        this.hasValidated = true;
        this.isValidating = false;
        return {
          success: true,
          message: 'Plant selection updated. Please refresh.',
          needsReload: true
        };
      }

      // Step 5: Verify codes and products exist
      const [impactCodes, oeeCodes, reasonCodes, products] = await Promise.all([
        masterDataService.getImpactCodes({ tenantId: cementTenant.id }),
        masterDataService.getOEECodes({ tenantId: cementTenant.id }),
        masterDataService.getReasonCodes({ tenantId: cementTenant.id }),
        masterDataService.getProducts()
      ]);

      console.log(`   Impact Codes: ${impactCodes.length}`);
      console.log(`   OEE Codes: ${oeeCodes.length}`);
      console.log(`   Reason Codes: ${reasonCodes.length}`);
      console.log(`   Products: ${products.length}`);

      // Step 6: Check if we have reasonable amounts of data (not missing, not duplicated)
      const hasMinimumData = 
        impactCodes.length >= 15 && impactCodes.length <= 50 &&
        oeeCodes.length >= 20 && oeeCodes.length <= 50 &&
        reasonCodes.length >= 50 && reasonCodes.length <= 100 &&
        products.length >= 20 && products.length <= 30;

      if (!hasMinimumData) {
        const hasNone = impactCodes.length === 0 && oeeCodes.length === 0;
        const hasTooMany = impactCodes.length > 50 || oeeCodes.length > 50;
        
        if (hasNone) {
          console.log('📦 No data detected. Please use Data Seeding page.');
          // DISABLED: Auto-seeding removed - user should choose industry type
          // await globalCementIndustryDataSeeder.seedCementIndustryData(cementTenant.id);
        } else if (hasTooMany) {
          console.log('⚠️ Duplicate data detected! Cleaning up...');
          console.log(`   Impact: ${impactCodes.length}, OEE: ${oeeCodes.length}, Reason: ${reasonCodes.length}`);
          await this.cleanupDuplicates(cementTenant.id);
        } else {
          console.log('📦 Incomplete data detected. Reseeding...');
          await this.reseedCodesAndProducts(cementTenant.id);
        }
        
        this.hasValidated = true;
        this.isValidating = false;
        return {
          success: true,
          message: 'Data fixed successfully',
          needsReload: true
        };
      }

      // All good!
      console.log('✅ All data validated successfully');
      this.hasValidated = true;
      this.isValidating = false;
      return {
        success: true,
        message: 'All data valid'
      };

    } catch (error) {
      console.error('❌ Validation error:', error);
      this.isValidating = false;
      return {
        success: false,
        message: `Validation failed: ${error}`
      };
    }
  }

  /**
   * Auto-fix plant selection to use the correct tenant
   */
  private async autoFixPlantSelection(correctTenantId: string): Promise<void> {
    try {
      const organizations = await masterDataService.getOrganizations();
      const tenants = await masterDataService.getTenants();
      const units = await masterDataService.getUnits();

      const cementOrg = organizations.find(o => o.name.includes('Hillal'));
      const cementTenant = tenants.find(t => t.id === correctTenantId);
      const cementUnit = units.find(u => u.tenantId === correctTenantId);

      if (cementOrg && cementTenant && cementUnit) {
        const selection = {
          organization: cementOrg,
          tenant: cementTenant,
          unit: cementUnit
        };

        await appSettingsApi.setValue('plantSelection', selection);
        console.log('✅ Plant selection updated automatically');
      }
    } catch (error) {
      console.error('Failed to auto-fix plant selection:', error);
    }
  }

  /**
   * Reseed only codes and products (preserve units, assets, etc.)
   */
  private async reseedCodesAndProducts(tenantId: string): Promise<void> {
    try {
      // Clear existing codes
      const [impactCodes, oeeCodes, reasonCodes, rcaCauseCodes, verificationCodes] = await Promise.all([
        masterDataService.getImpactCodes({ tenantId }),
        masterDataService.getOEECodes({ tenantId }),
        masterDataService.getReasonCodes({ tenantId }),
        masterDataService.getRCACauseCodes({ tenantId }),
        masterDataService.getVerificationStatusCodes({ tenantId })
      ]);

      // Delete existing codes
      for (const code of impactCodes) {
        await masterDataService.deleteImpactCode(code.id);
      }
      for (const code of oeeCodes) {
        await masterDataService.deleteOEECode(code.id);
      }
      for (const code of reasonCodes) {
        await masterDataService.deleteReasonCode(code.id);
      }
      for (const code of rcaCauseCodes) {
        await masterDataService.deleteRCACauseCode(code.id);
      }
      for (const code of verificationCodes) {
        await masterDataService.deleteVerificationStatusCode(code.id);
      }

      // Clear products
      const products = await masterDataService.getProducts();
      for (const product of products) {
        await masterDataService.deleteProduct(product.id);
      }

      console.log('🗑️ Cleared existing codes and products');

      // DISABLED: Auto-reseeding removed - user should manually reseed from Data Seeding page
      // await globalCementIndustryDataSeeder.seedCementIndustryData(tenantId);
      console.log('⚠️ Auto-reseeding disabled. Please use Data Seeding page to reseed.');
      
      console.log('✅ Codes and products reseeded');
    } catch (error) {
      console.error('Failed to reseed codes and products:', error);
      throw error;
    }
  }

  /**
   * Clean up duplicate codes by keeping only unique ones
   */
  private async cleanupDuplicates(tenantId: string): Promise<void> {
    try {
      console.log('🧹 Starting duplicate cleanup...');
      
      // Get all codes
      const [impactCodes, oeeCodes, reasonCodes, rcaCauseCodes, verificationCodes] = await Promise.all([
        masterDataService.getImpactCodes({ tenantId }),
        masterDataService.getOEECodes({ tenantId }),
        masterDataService.getReasonCodes({ tenantId }),
        masterDataService.getRCACauseCodes({ tenantId }),
        masterDataService.getVerificationStatusCodes({ tenantId })
      ]);

      // Remove duplicates based on code field
      const removeDuplicates = async (codes: any[], deleteFunc: (id: string) => Promise<void>) => {
        const seenCodes = new Set<string>();
        const toDelete: string[] = [];
        
        for (const code of codes) {
          if (seenCodes.has(code.code)) {
            toDelete.push(code.id);
          } else {
            seenCodes.add(code.code);
          }
        }
        
        console.log(`   Found ${toDelete.length} duplicates to remove`);
        for (const id of toDelete) {
          await deleteFunc(id);
        }
        
        return codes.length - toDelete.length;
      };

      const impactRemaining = await removeDuplicates(impactCodes, (id) => masterDataService.deleteImpactCode(id));
      const oeeRemaining = await removeDuplicates(oeeCodes, (id) => masterDataService.deleteOEECode(id));
      const reasonRemaining = await removeDuplicates(reasonCodes, (id) => masterDataService.deleteReasonCode(id));
      const rcaRemaining = await removeDuplicates(rcaCauseCodes, (id) => masterDataService.deleteRCACauseCode(id));
      const verificationRemaining = await removeDuplicates(verificationCodes, (id) => masterDataService.deleteVerificationStatusCode(id));

      console.log('✅ Cleanup complete:');
      console.log(`   Impact Codes: ${impactRemaining}`);
      console.log(`   OEE Codes: ${oeeRemaining}`);
      console.log(`   Reason Codes: ${reasonRemaining}`);
      console.log(`   RCA Cause Codes: ${rcaRemaining}`);
      console.log(`   Verification Codes: ${verificationRemaining}`);
    } catch (error) {
      console.error('Failed to cleanup duplicates:', error);
      throw error;
    }
  }

  /**
   * Reset validation state (for testing)
   */
  resetValidation(): void {
    this.hasValidated = false;
  }
}

export const dataValidator = DataValidator.getInstance();

