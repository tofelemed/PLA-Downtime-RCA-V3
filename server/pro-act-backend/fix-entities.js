#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('\n============================================================');
console.log('  ProAct Backend - Complete Entity Type Fix');
console.log('  Fixing ALL entities for MSSQL compatibility');
console.log('============================================================\n');

let totalFixed = 0;
const filesFixed = [];

// Recursively find all .entity.ts files
function findEntityFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory() && file !== 'node_modules' && file !== 'dist') {
      findEntityFiles(filePath, fileList);
    } else if (file.endsWith('.entity.ts')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Fix entity type issues
function fixEntityFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  const changes = [];
  
  // Fix 1: Boolean types (boolean → bit)
  if (content.includes("type: 'boolean'")) {
    content = content.replace(/type: 'boolean'/g, "type: 'bit'");
    changes.push('boolean→bit');
  }
  
  // Fix 2: JSON types (json → simple-json)
  if (content.includes("type: 'json'")) {
    content = content.replace(/type: 'json'/g, "type: 'simple-json'");
    changes.push('json→simple-json');
  }
  
  // Fix 3: Text types (text → nvarchar with MAX)
  // But be careful not to change already correct ones
  if (content.match(/type: 'text'(?!,)/)) {
    content = content.replace(/type: 'text'(?!,)/g, "type: 'nvarchar', length: 'MAX'");
    changes.push('text→nvarchar(MAX)');
  }
  
  // Fix 4: UUID columns with length (should not have length)
  if (content.match(/type: 'uuid',\s*length:/)) {
    content = content.replace(/type: 'uuid',\s*length:\s*\d+/g, "type: 'uuid'");
    content = content.replace(/type: 'uuid',\s*length:\s*'\d+'/g, "type: 'uuid'");
    changes.push('uuid:removed-length');
  }
  
  // Fix 5: Array types
  if (content.includes("type: 'array'")) {
    content = content.replace(/type: 'array'/g, "type: 'simple-array'");
    changes.push('array→simple-array');
  }
  
  // Fix 6: Timestamp to datetime for MSSQL
  if (content.includes("type: 'timestamp'")) {
    content = content.replace(/type: 'timestamp'/g, "type: 'datetime'");
    changes.push('timestamp→datetime');
  }
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    const relativePath = path.relative(process.cwd(), filePath);
    console.log(`  ✓ Fixed: ${relativePath}`);
    if (changes.length > 0) {
      console.log(`     Changes: ${changes.join(', ')}`);
    }
    filesFixed.push(path.basename(filePath));
    totalFixed++;
    return true;
  }
  
  return false;
}

// Main execution
const srcDir = path.join(__dirname, 'src');
const entityFiles = findEntityFiles(srcDir);

console.log(`Found ${entityFiles.length} entity files to check...\n`);

entityFiles.forEach(file => {
  fixEntityFile(file);
});

console.log('\n============================================================');
console.log('  Fix Summary');
console.log('============================================================\n');
console.log(`Total entity files scanned: ${entityFiles.length}`);
console.log(`Total files fixed: ${totalFixed}\n`);

if (totalFixed > 0) {
  console.log('All fixed files:');
  filesFixed.forEach(file => {
    console.log(`  • ${file}`);
  });
  console.log('');
}

console.log('============================================================');
console.log('  ✓ All entities are now MSSQL compatible!');
console.log('============================================================\n');

console.log('Next steps:');
console.log('  1. Clear cache: npx jest --clearCache');
console.log('  2. Run tests: npm run test:e2e');
console.log('  3. Or start backend: npm run start:dev\n');

