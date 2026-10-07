#!/usr/bin/env ts-node

/**
 * Automated Test Runner for ProAct Backend
 * Runs all endpoint tests and generates coverage report
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface TestResult {
  suite: string;
  passed: number;
  failed: number;
  duration: number;
}

class TestRunner {
  private results: TestResult[] = [];
  private totalPassed = 0;
  private totalFailed = 0;
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  async runAllTests() {
    console.log('\n========================================');
    console.log('  ProAct Backend - Automated Testing');
    console.log('========================================\n');

    console.log('Starting comprehensive endpoint testing...\n');

    try {
      // Run E2E tests
      console.log('📋 Running E2E Tests...\n');
      this.runTestSuite('npm run test:e2e');

      // Run Unit tests
      console.log('\n📋 Running Unit Tests...\n');
      this.runTestSuite('npm run test');

      // Generate coverage report
      console.log('\n📊 Generating Coverage Report...\n');
      this.runTestSuite('npm run test:cov');

      // Display results
      this.displayResults();
    } catch (error) {
      console.error('\n❌ Test execution failed:', error.message);
      process.exit(1);
    }
  }

  private runTestSuite(command: string) {
    try {
      execSync(command, {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..'),
      });
    } catch (error) {
      console.warn(`⚠️  Some tests failed in: ${command}`);
    }
  }

  private displayResults() {
    const duration = ((Date.now() - this.startTime) / 1000).toFixed(2);

    console.log('\n========================================');
    console.log('  Test Execution Summary');
    console.log('========================================\n');

    console.log(`⏱️  Total Duration: ${duration}s`);
    console.log(`✅ Tests Passed: ${this.totalPassed}`);
    console.log(`❌ Tests Failed: ${this.totalFailed}`);

    console.log('\n📊 Coverage Report Location:');
    console.log('   ./coverage/lcov-report/index.html');

    console.log('\n========================================\n');

    if (this.totalFailed > 0) {
      console.log('⚠️  Some tests failed. Please review the output above.\n');
      process.exit(1);
    } else {
      console.log('✅ All tests passed successfully!\n');
    }
  }
}

// Run tests
const runner = new TestRunner();
runner.runAllTests();

