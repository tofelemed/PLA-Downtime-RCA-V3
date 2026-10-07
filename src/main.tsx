import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// ===== AUTOMATIC SEEDING COMPLETELY DISABLED =====
// All auto-seeding scripts are disabled
// Use Data Seeding page UI to seed ADNOC or Cement data

// NO automatic scripts imported - prevents any auto-seeding
// import './scripts/cleanupAllData' // DISABLED

// Make it clear no auto-seeding occurs
if (typeof window !== 'undefined') {
  console.log('');
  console.log('=' .repeat(70));
  console.log('🛢️  PRO-ACT APPLICATION READY');
  console.log('=' .repeat(70));
  console.log('✅ No auto-seeding enabled');
  console.log('💡 To seed data:');
  console.log('   1. Navigate to Data Seeding page');
  console.log('   2. Click "Seed ADNOC Dataset" or "Seed Complete Dataset" (cement)');
  console.log('   3. Wait for completion');
  console.log('   4. Refresh browser');
  console.log('   Or run in console: seedOilGasData()');
  console.log('=' .repeat(70));
  console.log('');
}

// DISABLED: These were causing automatic seeding and duplicates
// import './scripts/seedPLARCAData'
// import './scripts/testDataSeeding'
// import './scripts/seedPresentationData'
// import './scripts/testPresentationData'
// import './scripts/testUnitNameDisplay'
// import './scripts/testProductionPlans'
// import './scripts/testProductionPlansPage'
// import './scripts/testCementIndustryData'
// import './scripts/debugProductionPlans'
// import './scripts/fixProductionPlans'
// import './scripts/testProductionPlansSeeding'
// import './scripts/seedCementIndustryData'
// import './scripts/fixPlantSelector'
// import './scripts/selectFirstCementUnit'
// import './scripts/fixSessionAndSidebar'

if (typeof document !== 'undefined') {
  document.body.classList.add('dark');
}

createRoot(document.getElementById("root")!).render(<App />);
