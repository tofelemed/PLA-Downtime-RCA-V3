#!/usr/bin/env node

/**
 * Simple Connectivity Module Test Script
 * 
 * This script provides basic testing functionality for the Connectivity module.
 * Run with: node test-connectivity.js
 */

const http = require('http');
const https = require('https');

// Configuration
const config = {
  baseUrl: 'http://localhost:3000/api/connectivity',
  timeout: 5000
};

// Test data
const testData = {
  opcua: {
    name: 'Test OPC UA Server',
    endpoint: 'opc.tcp://localhost:4840',
    securityMode: 'None',
    securityPolicy: 'None',
    username: 'testuser',
    password: 'testpass',
    timeoutMs: 30000,
    sessionTimeoutMs: 60000,
    keepAliveMs: 10000,
    maxMessageSize: 65536,
    pollingIntervalMs: 1000,
    subscriptionSize: 1000,
    enabled: true
  },
  modbus: {
    name: 'Test Modbus Device',
    connectionType: 'tcp',
    ipAddress: '192.168.1.100',
    port: 502,
    timeoutMs: 5000,
    retryCount: 3,
    unitId: 1,
    pollingIntervalMs: 1000,
    startAddress: 0,
    registerCount: 10,
    dataType: 'uint16',
    enabled: true
  },
  mqtt: {
    name: 'Test MQTT Broker',
    brokerUrl: 'mqtt://localhost:1883',
    port: 1883,
    clientId: 'ProAct_Test_Client',
    username: 'testuser',
    password: 'testpass',
    keepAliveSeconds: 60,
    cleanSession: true,
    subscribeTopics: 'sensors/+/temperature,devices/+/status',
    publishTopic: 'commands/device/control',
    qosLevel: 1,
    enabled: true
  },
  integration: {
    name: 'Test PI Integration',
    integrationType: 'pi',
    endpoint: 'https://pi-server.company.com/piwebapi',
    apiKey: 'test-api-key',
    username: 'pi-user',
    password: 'pi-password',
    systemType: 'aveva-pi',
    enabled: true,
    syncIntervalSeconds: 300
  }
};

// Utility functions
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(config.baseUrl + path);
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Connectivity-Test-Script/1.0'
      },
      timeout: config.timeout
    };

    if (data) {
      const jsonData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(jsonData);
    }

    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedData = responseData ? JSON.parse(responseData) : {};
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: parsedData
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: responseData
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Test functions
async function testHealthEndpoint() {
  console.log('\n🏥 Testing Health Endpoint...');
  try {
    const response = await makeRequest('GET', '/health');
    console.log(`Status: ${response.statusCode}`);
    console.log('Response:', JSON.stringify(response.data, null, 2));
    return response.statusCode === 200;
  } catch (error) {
    console.error('❌ Health endpoint test failed:', error.message);
    return false;
  }
}

async function testOPCUAConnection() {
  console.log('\n🔗 Testing OPC UA Connection...');
  try {
    // Create connection
    const createResponse = await makeRequest('POST', '/opcua/connections', testData.opcua);
    console.log(`Create Status: ${createResponse.statusCode}`);
    
    if (createResponse.statusCode === 201) {
      const connectionId = createResponse.data.data?.id;
      console.log(`Created OPC UA connection with ID: ${connectionId}`);
      
      // Get all connections
      const getAllResponse = await makeRequest('GET', '/opcua/connections');
      console.log(`Get All Status: ${getAllResponse.statusCode}`);
      
      // Test connection
      if (connectionId) {
        const testResponse = await makeRequest('POST', `/opcua/connections/${connectionId}/test`);
        console.log(`Test Status: ${testResponse.statusCode}`);
      }
      
      return true;
    } else {
      console.log('Response:', JSON.stringify(createResponse.data, null, 2));
      return false;
    }
  } catch (error) {
    console.error('❌ OPC UA connection test failed:', error.message);
    return false;
  }
}

async function testModbusConnection() {
  console.log('\n⚙️ Testing Modbus Connection...');
  try {
    const response = await makeRequest('POST', '/modbus/connections', testData.modbus);
    console.log(`Status: ${response.statusCode}`);
    console.log('Response:', JSON.stringify(response.data, null, 2));
    return response.statusCode === 201;
  } catch (error) {
    console.error('❌ Modbus connection test failed:', error.message);
    return false;
  }
}

async function testMQTTConnection() {
  console.log('\n📡 Testing MQTT Connection...');
  try {
    const response = await makeRequest('POST', '/mqtt/connections', testData.mqtt);
    console.log(`Status: ${response.statusCode}`);
    console.log('Response:', JSON.stringify(response.data, null, 2));
    return response.statusCode === 201;
  } catch (error) {
    console.error('❌ MQTT connection test failed:', error.message);
    return false;
  }
}

async function testSystemIntegration() {
  console.log('\n🔧 Testing System Integration...');
  try {
    const response = await makeRequest('POST', '/integrations', testData.integration);
    console.log(`Status: ${response.statusCode}`);
    console.log('Response:', JSON.stringify(response.data, null, 2));
    return response.statusCode === 201;
  } catch (error) {
    console.error('❌ System integration test failed:', error.message);
    return false;
  }
}

async function testMetricsEndpoint() {
  console.log('\n📊 Testing Metrics Endpoint...');
  try {
    const response = await makeRequest('GET', '/metrics');
    console.log(`Status: ${response.statusCode}`);
    console.log('Response:', JSON.stringify(response.data, null, 2));
    return response.statusCode === 200;
  } catch (error) {
    console.error('❌ Metrics endpoint test failed:', error.message);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting Connectivity Module Tests');
  console.log(`Base URL: ${config.baseUrl}`);
  console.log('=' .repeat(50));

  const tests = [
    { name: 'Health Endpoint', fn: testHealthEndpoint },
    { name: 'OPC UA Connection', fn: testOPCUAConnection },
    { name: 'Modbus Connection', fn: testModbusConnection },
    { name: 'MQTT Connection', fn: testMQTTConnection },
    { name: 'System Integration', fn: testSystemIntegration },
    { name: 'Metrics Endpoint', fn: testMetricsEndpoint }
  ];

  const results = [];
  
  for (const test of tests) {
    try {
      const result = await test.fn();
      results.push({ name: test.name, passed: result });
      console.log(result ? '✅' : '❌', test.name);
    } catch (error) {
      results.push({ name: test.name, passed: false, error: error.message });
      console.log('❌', test.name, '- Error:', error.message);
    }
  }

  // Summary
  console.log('\n' + '=' .repeat(50));
  console.log('📋 Test Summary:');
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  results.forEach(result => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} - ${result.name}`);
    if (result.error) {
      console.log(`    Error: ${result.error}`);
    }
  });
  
  console.log(`\n🎯 Results: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('🎉 All tests passed! Connectivity module is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Check the server logs and configuration.');
  }
}

// Error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = {
  makeRequest,
  testHealthEndpoint,
  testOPCUAConnection,
  testModbusConnection,
  testMQTTConnection,
  testSystemIntegration,
  testMetricsEndpoint,
  runTests
};
