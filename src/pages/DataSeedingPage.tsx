import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Database, Trash2, RotateCcw, CheckCircle, XCircle, Bug } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

// Import the seeding functions
import { seedAllData, clearAllData, resetAllData } from '../scripts/seedPLARCAData';
import { seedPresentationData, clearPresentationData, resetPresentationData, verifyPresentationData } from '../scripts/seedPresentationData';
import { seedCementIndustryData, clearCementIndustryData, verifyCementIndustryData } from '../scripts/seedCementIndustryData';
import { diagnoseCementIndustryData } from '../scripts/diagnoseCementData';
import { seedOilGasDataUI, verifyOilGasData, clearOilGasData } from '../scripts/seedOilGasDataUI';

export const DataSeedingPage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [operation, setOperation] = useState<string | null>(null);
  const [lastOperation, setLastOperation] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean | null>(null);
  const { toast } = useToast();
  const { session } = useAuth();

  const handleOperation = async (operationName: string, operationFn: () => Promise<void>) => {
    setIsLoading(true);
    setOperation(operationName);
    setIsSuccess(null);

    try {
      await operationFn();
      setIsSuccess(true);
      setLastOperation(operationName);
      toast({
        title: 'Success',
        description: `${operationName} completed successfully!`,
      });
    } catch (error) {
      setIsSuccess(false);
      setLastOperation(operationName);
      toast({
        title: 'Error',
        description: `${operationName} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setOperation(null);
    }
  };

  const handleSeedData = () => {
    handleOperation('Data Seeding', seedAllData);
  };

  const handleClearData = () => {
    handleOperation('Data Clearing', clearAllData);
  };

  const handleResetData = () => {
    handleOperation('Data Reset', resetAllData);
  };

  const handleSeedPresentationData = () => {
    handleOperation('Presentation Data Seeding', seedPresentationData);
  };

  const handleClearPresentationData = () => {
    handleOperation('Presentation Data Clearing', clearPresentationData);
  };

  const handleResetPresentationData = () => {
    handleOperation('Presentation Data Reset', resetPresentationData);
  };

  const handleVerifyPresentationData = () => {
    handleOperation('Presentation Data Verification', verifyPresentationData);
  };

  const handleSeedCementIndustryData = () => {
    handleOperation('Cement Industry Data Seeding', seedCementIndustryData);
  };

  const handleClearCementIndustryData = () => {
    handleOperation('Cement Industry Data Clearing', clearCementIndustryData);
  };

  const handleVerifyCementIndustryData = () => {
    handleOperation('Cement Industry Data Verification', verifyCementIndustryData);
  };

  const handleDiagnoseCementIndustryData = () => {
    handleOperation('Cement Industry Data Diagnosis', diagnoseCementIndustryData);
  };

  const handleSeedOilGasData = () => {
    handleOperation('ADNOC Oil and Gas Data Seeding', seedOilGasDataUI);
  };

  const handleVerifyOilGasData = () => {
    handleOperation('ADNOC Oil and Gas Data Verification', verifyOilGasData);
  };

  const handleClearOilGasData = () => {
    handleOperation('ADNOC Oil and Gas Data Clearing', clearOilGasData);
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">PLA & RCA Data Seeding</h1>
        <p className="text-muted-foreground">
          Manage test data for Plant Level Analytics (PLA) and Root Cause Analysis (RCA) modules.
        </p>
        {session && (
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <p className="text-sm">
              <strong>Current Tenant:</strong> {session.tenant?.name || 'Unknown'} 
              <span className="text-muted-foreground ml-2">(ID: {session.tenant?.id || 'demo-tenant-001'})</span>
            </p>
          </div>
        )}
      </div>

      {/* Status Alert */}
      {lastOperation && (
        <Alert className={`mb-6 ${isSuccess ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
          {isSuccess ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <XCircle className="h-4 w-4 text-red-600" />
          )}
          <AlertDescription className={isSuccess ? 'text-green-800' : 'text-red-800'}>
            {isSuccess ? '✅' : '❌'} {lastOperation} {isSuccess ? 'completed successfully' : 'failed'}
          </AlertDescription>
        </Alert>
      )}

      {/* ADNOC Oil & Gas Data Actions - New & Featured */}
      <div className="mb-8 border-2 border-blue-300 rounded-lg p-6 bg-gradient-to-br from-blue-50 to-cyan-50">
        <div className="mb-4">
          <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
            🛢️ ADNOC Oil & Gas Data (Complete Industry Data)
            <Badge variant="default" className="bg-gradient-to-r from-blue-600 to-cyan-600">NEW</Badge>
          </h2>
          <p className="text-muted-foreground mb-4">
            Comprehensive oil and gas industry data for ADNOC (Abu Dhabi National Oil Company). Includes 9 production units covering upstream, midstream, and downstream operations with 150+ events, 3 RCA investigations, and complete master data.
          </p>
          <div className="grid gap-2 md:grid-cols-3 text-sm mb-4">
            <div className="bg-white p-3 rounded-md border border-blue-200">
              <strong>🏢 Organization:</strong>
              <ul className="mt-1 text-muted-foreground">
                <li>• ADNOC Organization</li>
                <li>• ADNOC Onshore Tenant</li>
                <li>• 9 Production Units</li>
                <li>• ~47 Assets</li>
              </ul>
            </div>
            <div className="bg-white p-3 rounded-md border border-blue-200">
              <strong>🛢️ Production Units:</strong>
              <ul className="mt-1 text-muted-foreground">
                <li>• Crude Oil Desalter (150k BOPD)</li>
                <li>• Atmospheric Distillation (100k)</li>
                <li>• FCCU & Hydrocracker</li>
                <li>• Gas Processing (500 MMSCFD)</li>
              </ul>
            </div>
            <div className="bg-white p-3 rounded-md border border-blue-200">
              <strong>📊 Data & Events:</strong>
              <ul className="mt-1 text-muted-foreground">
                <li>• 20 Products (Crude, Gasoline, Diesel)</li>
                <li>• ~150 Production Events</li>
                <li>• 3 RCA Investigations</li>
                <li>• 105+ Master Data Codes</li>
              </ul>
            </div>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-blue-400">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Database className="h-5 w-5 text-blue-600" />
                Seed ADNOC Data
              </CardTitle>
              <CardDescription>
                Generate complete ADNOC oil & gas dataset (clears all existing data first)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleSeedOilGasData} 
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                size="default"
              >
                {isLoading && operation === 'ADNOC Oil and Gas Data Seeding' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Database className="mr-2 h-4 w-4" />
                )}
                Seed ADNOC Dataset
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CheckCircle className="h-5 w-5" />
                Verify ADNOC Data
              </CardTitle>
              <CardDescription>
                Check ADNOC data integrity and counts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleVerifyOilGasData} 
                disabled={isLoading}
                variant="outline"
                className="w-full"
                size="sm"
              >
                {isLoading && operation === 'ADNOC Oil and Gas Data Verification' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="mr-2 h-4 w-4" />
                )}
                Verify ADNOC Data
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Trash2 className="h-5 w-5" />
                Clear ADNOC Data
              </CardTitle>
              <CardDescription>
                Remove ADNOC oil & gas data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleClearOilGasData} 
                disabled={isLoading}
                variant="destructive"
                className="w-full"
                size="sm"
              >
                {isLoading && operation === 'ADNOC Oil and Gas Data Clearing' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Clear ADNOC Data
              </Button>
            </CardContent>
          </Card>
        </div>
        
        {/* ADNOC Oil & Gas Details */}
        <Card className="mt-4 bg-white">
          <CardHeader>
            <CardTitle className="text-lg">🛢️ ADNOC Oil & Gas Data Details</CardTitle>
            <CardDescription>
              Complete oil and gas operations data covering entire value chain
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h4 className="font-semibold mb-2">Production Units (9 Units)</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Crude Oil Desalter - 150,000 BOPD</li>
                  <li>• Atmospheric Distillation Unit - 100,000 BOPD</li>
                  <li>• Vacuum Distillation Unit - 45,000 BOPD</li>
                  <li>• Fluid Catalytic Cracking Unit - 50,000 BOPD</li>
                  <li>• Hydrocracker Unit - 35,000 BOPD</li>
                  <li>• Gas Processing Plant - 500 MMSCFD</li>
                  <li>• Sulfur Recovery Unit - 150 TPD</li>
                  <li>• Oil Production Facility - 80,000 BOPD</li>
                  <li>• Utilities & Offsite - 100 MW</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Products (20 Products)</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Crude: Arab Light, Arab Medium, Murban</li>
                  <li>• Gasoline: Premium 95 RON, Regular 91 RON</li>
                  <li>• Diesel: Ultra Low Sulfur (EN590)</li>
                  <li>• Jet Fuel: Jet A-1</li>
                  <li>• Gas: Natural Gas, LPG, Propane, Butane</li>
                  <li>• Heavy: Fuel Oil 380, VGO, Naphtha</li>
                  <li>• Specialty: Base Oil, Asphalt, Sulfur</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Master Data Codes (105+ Codes)</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• 19 Impact Codes (Safety, Equipment, Process)</li>
                  <li>• 24 OEE Codes (Failures, Trips, Upsets)</li>
                  <li>• 62 Reason Codes (Mechanical, Process, Ops)</li>
                  <li>• 10 RCA Cause Codes</li>
                  <li>• 5 Verification Status Codes</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Events & Investigations</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• ~150 Production Events (60 days history)</li>
                  <li>• 3 RCA Investigations (Critical failures)</li>
                  <li>• 3 Production Plans (Q1 2025)</li>
                  <li>• ~30 Production Losses</li>
                  <li>• ~300 OEE Summaries</li>
                </ul>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <div className="p-3 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-200">
                <p className="text-sm">
                  <strong>🛢️ Industry Coverage:</strong> Complete oil & gas value chain from upstream production through midstream processing to downstream refining. Includes realistic failure scenarios like FCC air blower failure, furnace tube leaks, and turbine trips.
                </p>
              </div>
              <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <p className="text-sm">
                  <strong>⚠️ Note:</strong> Seeding ADNOC data will clear ALL existing data (including cement industry data). Make sure to backup any important data before proceeding. The seeding process takes 30-60 seconds.
                </p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm">
                  <strong>✅ After Seeding:</strong> Refresh your browser (Ctrl+Shift+R) and use the plant selector to navigate: ADNOC → ADNOC Onshore → Select Unit. Check the browser console for detailed seeding logs.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cement Industry Data Actions - Featured */}
      <div className="mb-8 border-2 border-orange-200 rounded-lg p-6 bg-orange-50">
        <div className="mb-4">
          <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
            🏭 Cement Industry Data (Complete & Recommended)
            <Badge variant="default" className="bg-orange-600">Featured</Badge>
          </h2>
          <p className="text-muted-foreground mb-4">
            Complete cement industry data for Hillal organization and Margoon Cement plant. Includes 8 production units, 8 cement products, 25+ events across all categories, production plans, RCA investigations, and complete master data.
          </p>
          <div className="grid gap-2 md:grid-cols-3 text-sm mb-4">
            <div className="bg-white p-3 rounded-md">
              <strong>Plant Hierarchy:</strong>
              <ul className="mt-1 text-muted-foreground">
                <li>• Hillal Organization</li>
                <li>• Margoon Cement Plant</li>
                <li>• 8 Production Units</li>
                <li>• 50+ Assets</li>
              </ul>
            </div>
            <div className="bg-white p-3 rounded-md">
              <strong>Production Data:</strong>
              <ul className="mt-1 text-muted-foreground">
                <li>• 8 Cement Products</li>
                <li>• 4 Production Plans</li>
                <li>• 25+ Events (All Types)</li>
                <li>• 4 OEE Summaries</li>
              </ul>
            </div>
            <div className="bg-white p-3 rounded-md">
              <strong>RCA & Master Data:</strong>
              <ul className="mt-1 text-muted-foreground">
                <li>• 2 RCA Investigations</li>
                <li>• 5 Impact Codes</li>
                <li>• 5 OEE Codes</li>
                <li>• 15+ Reason Codes</li>
              </ul>
            </div>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-orange-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Database className="h-5 w-5 text-orange-600" />
                Seed Cement Industry Data
              </CardTitle>
              <CardDescription>
                Generate complete cement industry dataset (8 units, 25+ events, all master data)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleSeedCementIndustryData} 
                disabled={isLoading}
                className="w-full bg-orange-600 hover:bg-orange-700"
                size="default"
              >
                {isLoading && operation === 'Cement Industry Data Seeding' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Database className="mr-2 h-4 w-4" />
                )}
                Seed Complete Dataset
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CheckCircle className="h-5 w-5" />
                Verify Cement Data
              </CardTitle>
              <CardDescription>
                Check cement industry data integrity
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleVerifyCementIndustryData} 
                disabled={isLoading}
                variant="outline"
                className="w-full"
                size="sm"
              >
                {isLoading && operation === 'Cement Industry Data Verification' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="mr-2 h-4 w-4" />
                )}
                Verify Cement Data
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Trash2 className="h-5 w-5" />
                Clear Cement Data
              </CardTitle>
              <CardDescription>
                Remove cement industry data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleClearCementIndustryData} 
                disabled={isLoading}
                variant="destructive"
                className="w-full"
                size="sm"
              >
                {isLoading && operation === 'Cement Industry Data Clearing' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Clear Cement Data
              </Button>
            </CardContent>
          </Card>

          <Card className="border-blue-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bug className="h-5 w-5 text-blue-600" />
                Diagnose Data
              </CardTitle>
              <CardDescription>
                Check data integrity and relationships
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleDiagnoseCementIndustryData} 
                disabled={isLoading}
                variant="secondary"
                className="w-full"
                size="sm"
              >
                {isLoading && operation === 'Cement Industry Data Diagnosis' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Bug className="mr-2 h-4 w-4" />
                )}
                Run Diagnostics
              </Button>
            </CardContent>
          </Card>
        </div>
        
        {/* Cement Industry Details */}
        <Card className="mt-4 bg-white">
          <CardHeader>
            <CardTitle className="text-lg">🏭 Cement Industry Data Details</CardTitle>
            <CardDescription>
              Complete cement manufacturing plant data structure
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h4 className="font-semibold mb-2">Units & Hierarchy</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Raw Mill Unit - RM-1 (300 TPH)</li>
                  <li>• Kiln Unit - K-1 (5,000 TPD)</li>
                  <li>• Cement Mill Unit - CM-1 (200 TPH)</li>
                  <li>• Packaging Unit - PK-1 (150 TPH)</li>
                  <li>• Quality Control Lab - QC-1</li>
                  <li>• Coal Mill, Crusher, Preheater</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Cement Products</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• OPC 53 Grade ($85.50/MT)</li>
                  <li>• OPC 43 Grade ($78.25/MT)</li>
                  <li>• Portland Pozzolana Cement (PPC)</li>
                  <li>• Portland Slag Cement (PSC)</li>
                  <li>• Rapid Hardening Cement (RHC)</li>
                  <li>• Low Heat, Sulphate Resistant, White Cement</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Event Categories (25+ Events)</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Production Loss: Equipment failures, material shortages</li>
                  <li>• IOW: Quality issues, parameter deviations</li>
                  <li>• SOL: Safety & operational limits</li>
                  <li>• APM: Predictive maintenance alerts</li>
                  <li>• Failure WO: Work order failures</li>
                  <li>• Production Output: Rate variations</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Plant Selector Integration</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• ✅ Auto-selects first unit (Raw Mill)</li>
                  <li>• ✅ Shows full path: Hillal &gt; Margoon Cement &gt; Unit</li>
                  <li>• ✅ Persists selection in IndexedDB</li>
                  <li>• ✅ Supports unit and asset navigation</li>
                  <li>• ✅ Works with all production modules</li>
                </ul>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                <p className="text-sm">
                  <strong>💡 Recommended:</strong> Use this dataset for comprehensive testing. It includes realistic cement industry scenarios with proper plant hierarchy, making it ideal for demos and testing all application modules.
                </p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm">
                  <strong>🔍 Diagnostic Tool:</strong> If the plant selector doesn't show units or RCA data is missing, click the "Run Diagnostics" button. It will check data integrity, verify relationships, and show you exactly what's missing. Check the browser console for detailed diagnostic output.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Presentation Data Actions */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4">🎯 Presentation Data (Comprehensive)</h2>
        <p className="text-muted-foreground mb-6">
          Comprehensive, realistic data for system presentation. Includes Dashboard, PLA, and RCA modules with complete data relationships.
        </p>
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Database className="h-5 w-5" />
                Seed Presentation Data
              </CardTitle>
              <CardDescription>
                Generate comprehensive presentation data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleSeedPresentationData} 
                disabled={isLoading}
                className="w-full"
                size="sm"
              >
                {isLoading && operation === 'Presentation Data Seeding' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Database className="mr-2 h-4 w-4" />
                )}
                Seed Presentation Data
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CheckCircle className="h-5 w-5" />
                Verify Data
              </CardTitle>
              <CardDescription>
                Check data integrity and completeness
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleVerifyPresentationData} 
                disabled={isLoading}
                variant="outline"
                className="w-full"
                size="sm"
              >
                {isLoading && operation === 'Presentation Data Verification' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="mr-2 h-4 w-4" />
                )}
                Verify Data
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Trash2 className="h-5 w-5" />
                Clear Data
              </CardTitle>
              <CardDescription>
                Remove all presentation data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleClearPresentationData} 
                disabled={isLoading}
                variant="destructive"
                className="w-full"
                size="sm"
              >
                {isLoading && operation === 'Presentation Data Clearing' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Clear Data
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <RotateCcw className="h-5 w-5" />
                Reset Data
              </CardTitle>
              <CardDescription>
                Clear and reseed presentation data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleResetPresentationData} 
                disabled={isLoading}
                variant="outline"
                className="w-full"
                size="sm"
              >
                {isLoading && operation === 'Presentation Data Reset' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="mr-2 h-4 w-4" />
                )}
                Reset Data
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Legacy Actions */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4">🔧 Legacy Data Seeding</h2>
        <p className="text-muted-foreground mb-6">
          Basic data seeding for testing. Use presentation data above for demos.
        </p>
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Seed Data
            </CardTitle>
            <CardDescription>
              Populate IndexedDB with comprehensive test data for PLA and RCA modules
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={handleSeedData} 
              disabled={isLoading}
              className="w-full"
            >
              {isLoading && operation === 'Data Seeding' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Database className="mr-2 h-4 w-4" />
              )}
              Seed Test Data
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Clear Data
            </CardTitle>
            <CardDescription>
              Remove all seeded test data from IndexedDB
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={handleClearData} 
              disabled={isLoading}
              variant="destructive"
              className="w-full"
            >
              {isLoading && operation === 'Data Clearing' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Clear All Data
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              Reset Data
            </CardTitle>
            <CardDescription>
              Clear existing data and reseed with fresh test data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={handleResetData} 
              disabled={isLoading}
              variant="outline"
              className="w-full"
            >
              {isLoading && operation === 'Data Reset' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="mr-2 h-4 w-4" />
              )}
              Reset Data
            </Button>
          </CardContent>
        </Card>
        </div>
      </div>

      {/* What Gets Seeded */}
      <Card>
        <CardHeader>
          <CardTitle>What Gets Seeded</CardTitle>
          <CardDescription>
            Comprehensive test data for thorough PLA and RCA testing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="font-semibold mb-2">Organizations & Infrastructure</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Demo Manufacturing Corp organization</li>
                <li>• Plant A production facility tenant</li>
                <li>• 3 production units (Line A, Line B, Packaging)</li>
                <li>• 6 production assets (pumps, motors, conveyors)</li>
                <li>• 4 product variants (Standard & Premium)</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Master Data Codes</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• 7 Impact Codes (Equipment, Quality, Performance)</li>
                <li>• 9 OEE Codes (Planned/Unplanned categories)</li>
                <li>• 25+ Reason Codes (hierarchical structure)</li>
                <li>• Cost tracking and categorization</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Production Events</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• 3 realistic production events</li>
                <li>• Pump failures and quality issues</li>
                <li>• Cost impacts ($2K - $10K range)</li>
                <li>• Different statuses (Open, In Progress, Closed)</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">RCA Investigations</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• 2 RCA templates (Equipment & Process)</li>
                <li>• 2 active RCA investigations</li>
                <li>• Logic tree structures</li>
                <li>• Team assignments and priorities</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Testing Instructions */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Testing Instructions</CardTitle>
          <CardDescription>
            Steps to test the seeded data across different modules
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">1. PLA Module Testing</h4>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">Production Dashboard</Badge>
                <Badge variant="outline">Event Hub</Badge>
                <Badge variant="outline">OEE Analytics</Badge>
                <Badge variant="outline">Loss Analysis</Badge>
                <Badge variant="outline">Codes Management</Badge>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2">2. RCA Module Testing</h4>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">RCA Dashboard</Badge>
                <Badge variant="outline">Logic Trees</Badge>
                <Badge variant="outline">Evidence Collection</Badge>
                <Badge variant="outline">Recommendations</Badge>
                <Badge variant="outline">Templates</Badge>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2">3. Integration Testing</h4>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">Event → RCA Creation</Badge>
                <Badge variant="outline">Data Consistency</Badge>
                <Badge variant="outline">Cross-Module Navigation</Badge>
              </div>
            </div>
          </div>
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <p className="text-sm">
              <strong>📖 Detailed Testing Guide:</strong> See <code>docs/PLA_RCA_TESTING_GUIDE.md</code> for comprehensive testing steps and scenarios.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Browser Console Commands */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Browser Console Commands</CardTitle>
          <CardDescription>
            Alternative way to run seeding operations from browser console
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="p-3 bg-muted rounded-lg">
              <code className="text-sm">seedPLARCAData()</code>
              <p className="text-xs text-muted-foreground mt-1">Seed all test data</p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <code className="text-sm">clearPLARCAData()</code>
              <p className="text-xs text-muted-foreground mt-1">Clear all test data</p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <code className="text-sm">resetPLARCAData()</code>
              <p className="text-xs text-muted-foreground mt-1">Reset all test data</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DataSeedingPage;
