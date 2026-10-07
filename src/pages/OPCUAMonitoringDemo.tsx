import React from 'react';
import { OPCUAMonitor } from '@/components/integrations/OPCUAMonitor';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Database, TrendingUp, AlertTriangle } from 'lucide-react';

export const OPCUAMonitoringDemo: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">OPC UA Real-Time Monitoring Demo</h1>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
          Experience advanced OPC UA node monitoring with live data updates, dynamic node management, 
          and comprehensive real-time analytics. This demo showcases the enhanced monitoring capabilities 
          built into the ProAct system.
        </p>
      </div>

      {/* Feature Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="text-center">
          <CardContent className="pt-6">
            <Activity className="w-12 h-12 text-blue-600 mx-auto mb-4" />
            <h3 className="font-semibold mb-2">Real-Time Updates</h3>
            <p className="text-sm text-muted-foreground">
              Live data streaming with configurable refresh rates
            </p>
          </CardContent>
        </Card>

        <Card className="text-center">
          <CardContent className="pt-6">
            <Database className="w-12 h-12 text-green-600 mx-auto mb-4" />
            <h3 className="font-semibold mb-2">Dynamic Management</h3>
            <p className="text-sm text-muted-foreground">
              Add, remove, and configure nodes on-the-fly
            </p>
          </CardContent>
        </Card>

        <Card className="text-center">
          <CardContent className="pt-6">
            <TrendingUp className="w-12 h-12 text-purple-600 mx-auto mb-4" />
            <h3 className="font-semibold mb-2">Advanced Analytics</h3>
            <p className="text-sm text-muted-foreground">
              Comprehensive monitoring statistics and health checks
            </p>
          </CardContent>
        </Card>

        <Card className="text-center">
          <CardContent className="pt-6">
            <AlertTriangle className="w-12 h-12 text-orange-600 mx-auto mb-4" />
            <h3 className="font-semibold mb-2">Quality Monitoring</h3>
            <p className="text-sm text-muted-foreground">
              Track data quality and connection health
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Demo Instructions */}
      <Card className="border-2 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            Demo Instructions
          </CardTitle>
          <CardDescription>
            Follow these steps to explore the enhanced OPC UA monitoring capabilities
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-3 text-blue-800">Getting Started</h4>
              <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
                <li>Observe the default monitored nodes (Temperature, Pressure, Status)</li>
                <li>Watch real-time data updates every second</li>
                <li>Notice quality indicators and status changes</li>
                <li>Explore monitoring statistics and metrics</li>
              </ol>
            </div>
            
            <div>
              <h4 className="font-medium mb-3 text-green-800">Interactive Features</h4>
              <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
                <li>Click "Add Node" to create new monitored nodes</li>
                <li>Toggle node status between Active/Inactive</li>
                <li>Adjust refresh intervals and monitoring settings</li>
                <li>Export monitoring data for analysis</li>
              </ol>
            </div>
          </div>
          
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium mb-2 text-blue-800">Key Features Demonstrated</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
              <Badge variant="outline" className="text-xs">Real-time Updates</Badge>
              <Badge variant="outline" className="text-xs">Dynamic Node Management</Badge>
              <Badge variant="outline" className="text-xs">Quality Monitoring</Badge>
              <Badge variant="outline" className="text-xs">Health Checks</Badge>
              <Badge variant="outline" className="text-xs">Data Persistence</Badge>
              <Badge variant="outline" className="text-xs">Event-driven Updates</Badge>
              <Badge variant="outline" className="text-xs">Export Capabilities</Badge>
              <Badge variant="outline" className="text-xs">Advanced Configuration</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Enhanced OPC UA Monitor */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5 text-indigo-600" />
            Enhanced OPC UA Real-Time Monitor
          </CardTitle>
          <CardDescription>
            Advanced monitoring interface with live data visualization and dynamic node management
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OPCUAMonitor />
        </CardContent>
      </Card>

      {/* Technical Details */}
      <Card>
        <CardHeader>
          <CardTitle>Technical Implementation Details</CardTitle>
          <CardDescription>
            Architecture and implementation details of the enhanced monitoring system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-3">Service Architecture</h4>
              <ul className="space-y-2 text-sm text-gray-700">
                <li>• <strong>OPCUAMonitoringService:</strong> Core monitoring service with subscription management</li>
                <li>• <strong>Event-driven Updates:</strong> Real-time notifications via EventBus</li>
                <li>• <strong>Data Persistence:</strong> IndexedDB storage for configuration and history</li>
                <li>• <strong>Health Monitoring:</strong> Automatic health checks and error handling</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-3">Key Components</h4>
              <ul className="space-y-2 text-sm text-gray-700">
                <li>• <strong>OPCUAMonitor:</strong> React component for UI interaction</li>
                <li>• <strong>Node Management:</strong> Add, remove, and configure monitored nodes</li>
                <li>• <strong>Real-time Display:</strong> Live data updates with quality indicators</li>
                <li>• <strong>Statistics Dashboard:</strong> Comprehensive monitoring metrics</li>
              </ul>
            </div>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">Data Flow</h4>
            <div className="text-sm text-gray-700">
              <p className="mb-2">
                <strong>1. Node Configuration:</strong> Users configure nodes through the UI interface
              </p>
              <p className="mb-2">
                <strong>2. Service Registration:</strong> Nodes are registered with the monitoring service
              </p>
              <p className="mb-2">
                <strong>3. Subscription Management:</strong> Active subscriptions are created for real-time updates
              </p>
              <p className="mb-2">
                <strong>4. Data Processing:</strong> Incoming data is processed and quality-checked
              </p>
              <p className="mb-2">
                <strong>5. Event Publishing:</strong> Updates are published via EventBus for real-time UI updates
              </p>
              <p>
                <strong>6. Persistence:</strong> Data and configuration are stored in IndexedDB for persistence
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
