#!/bin/bash

# Connectivity Module Testing Setup Script
# This script helps set up the environment for testing the Connectivity module

echo "🚀 Setting up Connectivity Module Testing Environment"
echo "=================================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the server/pro-act-backend directory"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ Error: npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ Node.js and npm are available"

# Install dependencies if needed
echo "📦 Checking dependencies..."
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
else
    echo "✅ Dependencies already installed"
fi

# Check if bcrypt is installed
if ! npm list bcrypt &> /dev/null; then
    echo "Installing bcrypt..."
    npm install bcrypt @types/bcrypt
fi

echo "✅ Dependencies are ready"

# Make test script executable
chmod +x test-connectivity.js

echo "✅ Test script is executable"

# Check if database migration file exists
if [ -f "connectivity-migration.sql" ]; then
    echo "✅ Database migration file found"
    echo "📋 To set up the database, run the SQL commands in connectivity-migration.sql"
else
    echo "⚠️  Database migration file not found"
fi

# Check if the backend is running
echo "🔍 Checking if backend server is running..."
if curl -s http://localhost:3000/api/connectivity/health > /dev/null 2>&1; then
    echo "✅ Backend server is running and accessible"
else
    echo "⚠️  Backend server is not running or not accessible"
    echo "   Please start the backend server with: npm run start:dev"
fi

echo ""
echo "🎯 Setup Complete!"
echo "=================="
echo ""
echo "Next steps:"
echo "1. Set up your database and run the migration: connectivity-migration.sql"
echo "2. Start the backend server: npm run start:dev"
echo "3. Run the test script: node test-connectivity.js"
echo "4. Or import the Postman collection: Connectivity_Module_Tests.postman_collection.json"
echo ""
echo "📚 For detailed testing instructions, see: CONNECTIVITY_TESTING_GUIDE.md"
echo ""
