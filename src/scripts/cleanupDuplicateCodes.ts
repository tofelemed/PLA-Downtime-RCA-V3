// One-time script to cleanup duplicate codes
import { dataValidator } from '../services/DataValidator';

async function cleanupDuplicateCodes() {
  console.log('🧹 Starting duplicate code cleanup...');
  console.log('This will remove duplicate codes and keep only unique ones.');
  
  try {
    // Reset validation state so it runs again
    dataValidator.resetValidation();
    
    // Run validation which will detect and cleanup duplicates
    const result = await dataValidator.validateAndFix();
    
    console.log('✅ Cleanup complete!');
    console.log('Result:', result.message);
    
    if (result.needsReload) {
      console.log('🔄 Please refresh your browser to see the changes.');
    }
    
    return result;
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    throw error;
  }
}

// Make available in browser console
if (typeof window !== 'undefined') {
  (window as any).cleanupDuplicateCodes = cleanupDuplicateCodes;
  console.log('💡 Cleanup function loaded! Run: cleanupDuplicateCodes()');
}

export { cleanupDuplicateCodes };

