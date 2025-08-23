import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Clock, 
  DollarSign, 
  BarChart3,
  Calendar,
  Target,
  Activity,
  Zap,
  Shield,
  Users,
  Settings,
  Package
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface KPIMetric {
  id: string;
  title: string;
  value: string | number;
  change: number;
  changeType: 'increase' | 'decrease' | 'neutral';
  icon: React.ComponentType<any>;
  color: string;
  description: string;
}

interface ProductionMetric {
  period: string;
  availability: number;
  performance: number;
  quality: number;
  oee: number;
  downtime: number;
  cost: number;
}

const DashboardAnalytics: React.FC = () => {
  const { session } = useAuth();
  const [timeRange, setTimeRange] = useState('7d');
  const [selectedUnit, setSelectedUnit] = useState('all');
  const [loading, setLoading] = useState(false);

  // Mock data - in real app, this would come from API
  const kpiMetrics: KPIMetric[] = [
    {
      id: 'oee',
      title: 'Overall OEE',
      value: '87.2%',
      change: 2.1,
      changeType: 'increase',
      icon: Target,
      color: 'text-green-600',
      description: 'Overall Equipment Effectiveness'
    },
    {
      id: 'availability',
      title: 'Availability',
      value: '92.5%',
      change: -0.8,
      changeType: 'decrease',
      icon: Clock,
      color: 'text-blue-600',
      description: 'Equipment uptime percentage'
    },
    {
      id: 'performance',
      title: 'Performance',
      value: '94.1%',
      change: 1.3,
      changeType: 'increase',
      icon: Zap,
      color: 'text-orange-600',
      description: 'Speed and efficiency ratio'
    },
    {
      id: 'quality',
      title: 'Quality',
      value: '98.7%',
      change: 0.2,
      changeType: 'increase',
      icon: Shield,
      color: 'text-purple-600',
      description: 'First-pass yield rate'
    },
    {
      id: 'downtime',
      title: 'Total Downtime',
      value: '12.3h',
      change: -15.2,
      changeType: 'increase',
      icon: AlertTriangle,
      color: 'text-red-600',
      description: 'Unplanned downtime hours'
    },
    {
      id: 'cost',
      title: 'Production Cost',
      value: '$124.5K',
      change: -8.7,
      changeType: 'decrease',
      icon: DollarSign,
      color: 'text-emerald-600',
      description: 'Total production cost'
    }
  ];

  const productionData: ProductionMetric[] = [
    { period: 'Mon', availability: 94.2, performance: 96.1, quality: 98.5, oee: 88.9, downtime: 2.1, cost: 18.2 },
    { period: 'Tue', availability: 91.8, performance: 93.7, quality: 98.9, oee: 85.2, downtime: 3.9, cost: 22.1 },
    { period: 'Wed', availability: 95.1, performance: 95.8, quality: 99.1, oee: 90.1, downtime: 1.2, cost: 15.8 },
    { period: 'Thu', availability: 89.4, performance: 92.3, quality: 97.8, oee: 80.5, downtime: 5.1, cost: 28.9 },
    { period: 'Fri', availability: 93.7, performance: 94.9, quality: 98.3, oee: 87.2, downtime: 2.8, cost: 19.6 },
    { period: 'Sat', availability: 96.2, performance: 97.1, quality: 99.3, oee: 92.8, downtime: 0.9, cost: 12.4 },
    { period: 'Sun', availability: 94.8, performance: 95.5, quality: 98.7, oee: 88.9, downtime: 1.5, cost: 16.7 },
  ];

  const topIssues = [
    { id: 1, issue: 'Pump bearing failure', unit: 'Unit A', impact: 'High', duration: '4.2h', cost: '$12,400' },
    { id: 2, issue: 'Conveyor belt misalignment', unit: 'Unit B', impact: 'Medium', duration: '2.1h', cost: '$6,200' },
    { id: 3, issue: 'Temperature sensor fault', unit: 'Unit C', impact: 'Low', duration: '1.5h', cost: '$3,800' },
    { id: 4, issue: 'Motor overheating', unit: 'Unit A', impact: 'High', duration: '3.8h', cost: '$11,200' },
    { id: 5, issue: 'Control valve stuck', unit: 'Unit D', impact: 'Medium', duration: '2.8h', cost: '$8,500' },
  ];

  const recentEvents = [
    { id: 1, type: 'Downtime', unit: 'Unit A', description: 'Pump maintenance completed', time: '2 hours ago', status: 'resolved' },
    { id: 2, type: 'Alert', unit: 'Unit B', description: 'Temperature threshold exceeded', time: '4 hours ago', status: 'active' },
    { id: 3, type: 'Maintenance', unit: 'Unit C', description: 'Scheduled filter replacement', time: '6 hours ago', status: 'completed' },
    { id: 4, type: 'Quality', unit: 'Unit A', description: 'Quality check passed', time: '8 hours ago', status: 'resolved' },
  ];

  const getChangeIcon = (changeType: string) => {
    switch (changeType) {
      case 'increase':
        return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'decrease':
        return <TrendingDown className="w-4 h-4 text-red-600" />;
      default:
        return <Activity className="w-4 h-4 text-gray-600" />;
    }
  };

  const getChangeColor = (changeType: string) => {
    switch (changeType) {
      case 'increase':
        return 'text-green-600';
      case 'decrease':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact.toLowerCase()) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'resolved':
        return 'bg-green-100 text-green-800';
      case 'active':
        return 'bg-red-100 text-red-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Production Analytics</h2>
          <p className="text-muted-foreground">
            Real-time performance metrics and production insights
          </p>
        </div>
        <div className="flex space-x-4">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1d">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={selectedUnit} onValueChange={setSelectedUnit}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Select Unit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Units</SelectItem>
              <SelectItem value="unit-a">Unit A</SelectItem>
              <SelectItem value="unit-b">Unit B</SelectItem>
              <SelectItem value="unit-c">Unit C</SelectItem>
              <SelectItem value="unit-d">Unit D</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpiMetrics.map((metric) => (
          <Card key={metric.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
              <metric.icon className={`h-4 w-4 ${metric.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metric.value}</div>
              <div className="flex items-center space-x-2 mt-2">
                {getChangeIcon(metric.changeType)}
                <span className={`text-sm font-medium ${getChangeColor(metric.changeType)}`}>
                  {metric.change > 0 ? '+' : ''}{metric.change}%
                </span>
                <span className="text-xs text-muted-foreground">vs last period</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{metric.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="issues">Issues</TabsTrigger>
          <TabsTrigger value="events">Recent Events</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* OEE Trend Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="w-5 h-5 mr-2" />
                  OEE Trend
                </CardTitle>
                <CardDescription>Overall Equipment Effectiveness over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {productionData.map((data, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-sm font-medium">{data.period}</span>
                      <div className="flex items-center space-x-4">
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full"
                            style={{ width: `${data.oee}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium w-12">{data.oee}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Performance Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Target className="w-5 h-5 mr-2" />
                  Performance Breakdown
                </CardTitle>
                <CardDescription>Availability, Performance, and Quality metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Availability</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div className="bg-blue-500 h-2 rounded-full" style={{ width: '92.5%' }} />
                      </div>
                      <span className="text-sm font-medium">92.5%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Performance</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div className="bg-orange-500 h-2 rounded-full" style={{ width: '94.1%' }} />
                      </div>
                      <span className="text-sm font-medium">94.1%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Quality</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div className="bg-purple-500 h-2 rounded-full" style={{ width: '98.7%' }} />
                      </div>
                      <span className="text-sm font-medium">98.7%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="w-5 h-5 mr-2" />
                Production Trends
              </CardTitle>
              <CardDescription>Weekly performance trends and comparisons</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Period</th>
                      <th className="text-right py-2">Availability</th>
                      <th className="text-right py-2">Performance</th>
                      <th className="text-right py-2">Quality</th>
                      <th className="text-right py-2">OEE</th>
                      <th className="text-right py-2">Downtime (h)</th>
                      <th className="text-right py-2">Cost (K$)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productionData.map((data, index) => (
                      <tr key={index} className="border-b hover:bg-gray-50">
                        <td className="py-2 font-medium">{data.period}</td>
                        <td className="text-right py-2">{data.availability}%</td>
                        <td className="text-right py-2">{data.performance}%</td>
                        <td className="text-right py-2">{data.quality}%</td>
                        <td className="text-right py-2 font-medium">{data.oee}%</td>
                        <td className="text-right py-2">{data.downtime}</td>
                        <td className="text-right py-2">${data.cost}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="issues" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2" />
                Top Production Issues
              </CardTitle>
              <CardDescription>Most impactful production issues and their costs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topIssues.map((issue) => (
                  <div key={issue.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                    <div className="flex-1">
                      <h4 className="font-medium">{issue.issue}</h4>
                      <p className="text-sm text-gray-500">{issue.unit}</p>
                    </div>
                    <div className="flex items-center space-x-4">
                      <Badge className={getImpactColor(issue.impact)}>
                        {issue.impact}
                      </Badge>
                      <div className="text-right">
                        <p className="text-sm font-medium">{issue.duration}</p>
                        <p className="text-xs text-gray-500">{issue.cost}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Activity className="w-5 h-5 mr-2" />
                Recent Production Events
              </CardTitle>
              <CardDescription>Latest production events and their status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentEvents.map((event) => (
                  <div key={event.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                    <div className="flex items-center space-x-4">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <div>
                        <h4 className="font-medium">{event.type}</h4>
                        <p className="text-sm text-gray-500">{event.unit} • {event.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <Badge className={getStatusColor(event.status)}>
                        {event.status}
                      </Badge>
                      <span className="text-sm text-gray-500">{event.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DashboardAnalytics; 