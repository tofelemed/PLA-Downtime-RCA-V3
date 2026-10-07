/**
 * Script to check database status - what tables exist and how many rows they have
 */

import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

async function checkDatabaseStatus() {
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
    console.log('✅ Connected to database\n');

    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();

    // Get all tables in the database
    console.log('📋 Checking existing tables and row counts...\n');
    
    const tablesQuery = `
      SELECT 
        t.name AS table_name,
        SUM(p.rows) AS row_count
      FROM 
        sys.tables t
      INNER JOIN 
        sys.indexes i ON t.object_id = i.object_id
      INNER JOIN 
        sys.partitions p ON i.object_id = p.object_id AND i.index_id = p.index_id
      WHERE 
        t.is_ms_shipped = 0
        AND i.object_id > 255
        AND i.index_id <= 1
      GROUP BY 
        t.name
      ORDER BY 
        t.name;
    `;

    const tables = await queryRunner.query(tablesQuery);
    
    if (tables.length === 0) {
      console.log('⚠️  No user tables found in the database.');
      console.log('   The database might be empty or schema not created yet.\n');
    } else {
      console.log(`Found ${tables.length} table(s):\n`);
      
      let totalRows = 0;
      let tablesWithData = 0;
      
      for (const table of tables) {
        const tableName = table.table_name;
        const rowCount = parseInt(table.row_count) || 0;
        totalRows += rowCount;
        
        if (rowCount > 0) {
          tablesWithData++;
          console.log(`   ✅ ${tableName}: ${rowCount} rows`);
        } else {
          console.log(`   ⚪ ${tableName}: 0 rows (empty)`);
        }
      }
      
      console.log('\n' + '='.repeat(50));
      console.log(`Total tables: ${tables.length}`);
      console.log(`Tables with data: ${tablesWithData}`);
      console.log(`Total rows across all tables: ${totalRows}`);
      console.log('='.repeat(50));
      
      if (totalRows === 0) {
        console.log('\n✅ Database is completely empty - all tables have 0 rows.');
      } else {
        console.log(`\n⚠️  Database still contains ${totalRows} rows across ${tablesWithData} table(s).`);
        console.log('   You may need to run the delete script again or check for foreign key constraints.');
      }
    }

    await queryRunner.release();
    await dataSource.destroy();

  } catch (error: any) {
    console.error('❌ Error checking database:', error.message);
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
    process.exit(1);
  }
}

checkDatabaseStatus()
  .then(() => {
    console.log('\n✅ Status check completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Status check failed:', error);
    process.exit(1);
  });

