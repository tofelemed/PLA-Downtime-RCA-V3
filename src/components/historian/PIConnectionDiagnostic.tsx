import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, XCircle, Activity, Database, Server } from 'lucide-react';
import { PIClient } from '@/services/pi/PIClient';

interface PIConnectionDiagnosticProps {
  piClient: PIClient;
}

interface DiagnosticResult {
  test: string;
  status: 'success' | 'error' | 'warning';
  message: string;
  details?: string;
  timestamp: string;
}

export default function PIConnectionDiagnostic({ piClient }: PIConnectionDiagnosticProps) {
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [running, setRunning] = useState(false);

  const runDiagnostics = async () => {
    setRunning(true);
    setResults([]);
    
    const newResults: DiagnosticResult[] = [];
    
    // Test 1: Basic connectivity
    try {
      const startTime = Date.now();
      const response = await piClient.getAssetServers();
      const endTime = Date.now();
      const latency = endTime - startTime;
      
      newResults.push({
        test: 'Basic Connectivity',
        status: 'success',
        message: `Connected successfully in ${latency}ms`,
        details: `Found ${response?.Items?.length || 0} asset servers`,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      newResults.push({
        test: 'Basic Connectivity',
        status: 'error',
        message: `Connection failed: ${error.status || 'Unknown'} ${error.statusText || ''}`,
        details: error.details || error.message,
        timestamp: new Date().toISOString()
      });
    }
    
    // Test 2: Authentication
    try {
      const response = await piClient.getAssetServers();
      if (response?.Items && response.Items.length > 0) {
        newResults.push({
          test: 'Authentication',
          status: 'success',
          message: 'Authentication successful',
          details: 'Able to access PI resources',
          timestamp: new Date().toISOString()
        });
      } else {
        newResults.push({
          test: 'Authentication',
          status: 'warning',
          message: 'Authentication successful but no resources found',
          details: 'Check if user has access to any PI resources',
          timestamp: new Date().toISOString()
        });
      }
    } catch (error: any) {
      if (error.status === 401 || error.status === 403) {
        newResults.push({
          test: 'Authentication',
          status: 'error',
          message: 'Authentication failed',
          details: `Status: ${error.status} - ${error.details || error.message}`,
          timestamp: new Date().toISOString()
        });
      } else {
        newResults.push({
          test: 'Authentication',
          status: 'error',
          message: 'Authentication test failed',
          details: error.details || error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Test 3: Database access
    try {
      const servers = await piClient.getAssetServers();
      if (servers?.Items && servers.Items.length > 0) {
        const firstServer = servers.Items[0];
        const databases = await piClient.getAFDatabases(firstServer.WebId);
        
        newResults.push({
          test: 'Database Access',
          status: 'success',
          message: 'Database access successful',
          details: `Found ${databases?.Items?.length || 0} databases in ${firstServer.Name}`,
          timestamp: new Date().toISOString()
        });
      } else {
        newResults.push({
          test: 'Database Access',
          status: 'warning',
          message: 'No asset servers available for testing',
          details: 'Cannot test database access without asset servers',
          timestamp: new Date().toISOString()
        });
      }
    } catch (error: any) {
      newResults.push({
        test: 'Database Access',
        status: 'error',
        message: 'Database access failed',
        details: error.details || error.message,
        timestamp: new Date().toISOString()
      });
    }
    
    // Test 4: Event frames endpoint (the one that's failing)
    try {
      const servers = await piClient.getAssetServers();
      if (servers?.Items && servers.Items.length > 0) {
        const firstServer = servers.Items[0];
        const databases = await piClient.getAFDatabases(firstServer.WebId);
        
        if (databases?.Items && databases.Items.length > 0) {
          const firstDb = databases.Items[0];
          
          // Test the specific endpoint that's failing
          const startTime = new Date(Date.now() - 60000).toISOString(); // 1 minute ago
          const endTime = new Date().toISOString();
          
          const eventFrames = await piClient.getEventFrames({
            databaseWebId: firstDb.WebId,
            startTimeUtc: startTime,
            endTimeUtc: endTime,
            maxCount: 1
          });
          
          newResults.push({
            test: 'Event Frames API',
            status: 'success',
            message: 'Event frames API working',
            details: `Successfully queried event frames from ${firstDb.Name}`,
            timestamp: new Date().toISOString()
          });
        } else {
          newResults.push({
            test: 'Event Frames API',
            status: 'warning',
            message: 'No databases available for testing',
            details: 'Cannot test event frames API without databases',
            timestamp: new Date().toISOString()
          });
        }
      } else {
        newResults.push({
          test: 'Event Frames API',
          status: 'warning',
          message: 'No asset servers available for testing',
          details: 'Cannot test event frames API without asset servers',
          timestamp: new Date().toISOString()
        });
      }
    } catch (error: any) {
      newResults.push({
        test: 'Event Frames API',
        status: 'error',
        message: 'Event frames API failed',
        details: `${error.status || 'Unknown'} - ${error.details || error.message}`,
        timestamp: new Date().toISOString()
      });
    }
    
    setResults(newResults);
    setRunning(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Activity className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge variant="default" className="bg-green-100 text-green-800">Success</Badge>;
      case 'warning':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Warning</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="w-5 h-5" />
          PI Connection Diagnostic
        </CardTitle>
        <CardDescription>
          Run comprehensive tests to diagnose PI Web API connection issues
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            This will test various PI Web API endpoints to identify connection issues
          </p>
          <Button 
            onClick={runDiagnostics} 
            disabled={running}
            className="flex items-center gap-2"
          >
            {running ? (
              <>
                <Activity className="w-4 h-4 animate-spin" />
                Running Tests...
              </>
            ) : (
              <>
                <Server className="w-4 h-4" />
                Run Diagnostics
              </>
            )}
          </Button>
        </div>

        {results.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium">Test Results</h4>
            {results.map((result, index) => (
              <div key={index} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(result.status)}
                    <span className="font-medium">{result.test}</span>
                  </div>
                  {getStatusBadge(result.status)}
                </div>
                <p className="text-sm text-gray-700 mb-1">{result.message}</p>
                {result.details && (
                  <p className="text-xs text-gray-500">{result.details}</p>
                )}
                <p className="text-xs text-gray-400 mt-2">
                  {new Date(result.timestamp).toLocaleTimeString()}
                </p>
              </div>
            ))}
          </div>
        )}

        {results.length > 0 && (
          <div className="border-t pt-4">
            <h4 className="font-medium mb-2">Recommendations</h4>
            <div className="space-y-2 text-sm text-gray-600">
              {results.some(r => r.status === 'error') && (
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-red-800">Immediate Action Required:</p>
                    <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
                      <li>Check PI Web API service status on your PI server</li>
                      <li>Verify network connectivity to the PI server</li>
                      <li>Check PI Web API configuration and logs</li>
                      <li>Verify user permissions and authentication</li>
                    </ul>
                  </div>
                </div>
              )}
              
              {results.some(r => r.status === 'warning') && (
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-yellow-800">Review Required:</p>
                    <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
                      <li>Check if PI resources are properly configured</li>
                      <li>Verify user access to PI databases and elements</li>
                      <li>Review PI Web API security settings</li>
                    </ul>
                  </div>
                </div>
              )}
              
              {results.every(r => r.status === 'success') && (
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-green-800">All Tests Passed:</p>
                    <p>Your PI Web API connection is working correctly.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
