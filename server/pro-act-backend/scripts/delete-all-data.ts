/**
 * Script to delete all data from the database
 * 
 * WARNING: This will delete ALL data from ALL tables!
 * Use with extreme caution.
 * 
 * Run with: npm run delete-all-data
 * Or: ts-node server/pro-act-backend/scripts/delete-all-data.ts
 */

import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config();

async function deleteAllData() {
  console.log('⚠️  WARNING: This will DELETE ALL DATA from the database!');
  console.log('⚠️  This action is IRREVERSIBLE!');
  console.log('');
  
  // Read confirmation
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const answer = await new Promise<string>((resolve) => {
    readline.question('Type "DELETE ALL" to confirm: ', (input: string) => {
      readline.close();
      resolve(input);
    });
  });

  if (answer !== 'DELETE ALL') {
    console.log('❌ Deletion cancelled.');
    return;
  }

  const dataSource = new DataSource({
    type: 'mssql',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '1433', 10),
    username: process.env.DB_USERNAME || 'sa',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ProActDB',
    options: {
      encrypt: false,
      trustServerCertificate: true,
    },
  });

  try {
    await dataSource.initialize();
    console.log('✅ Connected to database');

    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();

    console.log('🗑️  Starting data deletion...');

    // Disable foreign key constraints
    await queryRunner.query('EXEC sp_MSforeachtable "ALTER TABLE ? NOCHECK CONSTRAINT all"');
    console.log('✅ Foreign key constraints disabled');

    // List of tables to delete from (in order to respect foreign keys)
    const tables = [
      // Child tables first
      'custom_attribute_values',
      'custom_attribute_definitions',
      'historian_history',
      'historian_tags',
      'pi_sync_watermarks',
      'pi_sync_jobs',
      'pi_events',
      'pi_af_elements',
      'af_bindings',
      'pi_mappings',
      'pi_connections',
      'production_events',
      'production_plans',
      'production_plan_templates',
      'production_losses',
      'oee_summaries',
      'reconcile_forms',
      'unmapped_events',
      'rca_recommendations',
      'rca_evidences',
      'rca_analysis_configs',
      'rca_analysis_methodologies',
      'rca_knowledge_bases',
      'rca_trigger_configs',
      'rca_templates',
      'rca_cause_codes',
      'reason_codes',
      'verification_status_codes',
      'impact_codes',
      'oee_codes',
      'tasks',
      'audit_logs',
      'app_settings',
      'logic_tree_nodes',
      'evidence_categories',
      'evidence_locations',
      'loss_categories',
      'assets',
      'units',
      'products',
      'tenants',
      'organizations',
      'users',
      'roles',
      // Streaming and data-source tables
      'stream_alerts',
      'stream_metrics',
      'stream_data_sinks',
      'stream_data_sources',
      'stream_processors',
      'stream_connection_configs',
      'data_sources',
      // Hierarchy mapping
      'source_hierarchy_mappings',
      // RCA analysis tables
      'five_why_analyses',
      'fishbone_diagrams',
      'fmea_analyses',
      'fault_tree_analyses',
      'barrier_analyses',
      'change_analyses',
      // Main RCA table
      'rcas',
    ];

    let totalDeleted = 0;
    for (const table of tables) {
      try {
        const result = await queryRunner.query(`DELETE FROM [${table}]`);
        const rowsAffected = result.affectedRows || 0;
        if (rowsAffected > 0) {
          console.log(`   ✅ Deleted ${rowsAffected} rows from ${table}`);
          totalDeleted += rowsAffected;
        }
      } catch (error: any) {
        // Table might not exist or might be empty
        if (error.message?.includes('Invalid object name')) {
          console.log(`   ⚠️  Table ${table} does not exist, skipping...`);
        } else {
          console.log(`   ⚠️  Error deleting from ${table}: ${error.message}`);
        }
      }
    }

    // Re-enable foreign key constraints
    await queryRunner.query('EXEC sp_MSforeachtable "ALTER TABLE ? CHECK CONSTRAINT all"');
    console.log('✅ Foreign key constraints re-enabled');

    console.log('');
    console.log(`✅ Data deletion complete! Total rows deleted: ${totalDeleted}`);
    console.log('✅ Database is now empty.');

    await queryRunner.release();
    await dataSource.destroy();

  } catch (error: any) {
    console.error('❌ Error deleting data:', error);
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  deleteAllData()
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

export { deleteAllData };

