// Simple execution script for cement industry data seeding
// This script can be imported and run to seed all cement industry data

import { seedAllCementIndustryData } from './seedCementIndustryData';

// Main execution function
export async function runCementIndustrySeeding() {
  console.log('🚀 Starting cement industry data seeding...');
  
  try {
    await seedAllCementIndustryData();
    console.log('🎉 Cement industry data seeding completed successfully!');
    console.log('');
    console.log('📋 Next steps:');
    console.log('1. Open the Plant Selector to see the cement plant hierarchy');
    console.log('2. Navigate to Production Dashboard to see production plans and events');
    console.log('3. Check the Event Hub for 25+ cement industry events');
    console.log('4. Visit RCA Module to see cement industry investigations');
    console.log('5. Explore Quality Control and Maintenance modules');
    console.log('');
    console.log('🏭 Cement Industry Data Summary:');
    console.log('- Organization: Hillal');
    console.log('- Plant: Margoon Cement');
    console.log('- Units: Raw Mill, Kiln, Cement Mill, Packaging, Quality Control, Coal Mill, Crusher, Preheater');
    console.log('- Products: OPC 53, OPC 43, PPC, PSC, RHC, LHC, SRC, White Cement');
    console.log('- Events: 25+ events across all categories (ProductionLoss, IOW, SOL, APM, FailureWO, ProductionOutput)');
    console.log('- RCA: Comprehensive investigations with cement industry scenarios');
    console.log('- Master Data: Complete set of impact codes, OEE codes, and reason codes');
    
  } catch (error) {
    console.error('❌ Failed to seed cement industry data:', error);
    throw error;
  }
}

// Make available globally for browser console usage
if (typeof window !== 'undefined') {
  (window as any).runCementIndustrySeeding = runCementIndustrySeeding;
  
  // Auto-run if this script is loaded
  console.log('🏭 Cement Industry Seeding Script Loaded');
  console.log('💡 Run: runCementIndustrySeeding() in the console to seed data');
}

export default runCementIndustrySeeding;
