import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  Package,
  Bell,
  CheckCircle,
  XCircle,
  Info
} from 'lucide-react';
import DashboardAnalytics from '@/components/DashboardAnalytics';
import HistorianMicroTrends from '@/components/historian/HistorianMicroTrends';
import { HistorianClient } from '@/services/historian/HistorianClient';
import { PIHistorianProvider } from '@/services/historian/providers/pi/PIHistorianProvider';
import { PIClient, basicAuthHeader } from '@/services/pi/PIClient';
import { piStore } from '@/services/pi/PIStore';

const DashboardCard: React.FC<{
  title: string;
  value: string;
  description: string;
  icon: React.ElementType;
  trend?: string;
}> = ({ title, value, description, icon: Icon, trend }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      <p className="text-xs text-muted-foreground">{description}</p>
      {trend && (
        <div className="flex items-center pt-1">
          <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
          <span className="text-xs text-green-500">{trend}</span>
        </div>
      )}
    </CardContent>
  </Card>
);

const Dashboard: React.FC = () => {
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [piConnection, setPiConnection] = useState<any>(null);
  const [historianClient, setHistorianClient] = useState<HistorianClient | null>(null);

  // Initialize PI connection and HistorianClient
  useEffect(() => {
    const initializePI = async () => {
      if (!session?.tenant?.id) return;
      
      try {
        const connection = await piStore.getConnectionByTenant(session.tenant.id);
        if (connection) {
          setPiConnection(connection);
          
          // Create HistorianClient with real PI credentials
          const client = new HistorianClient();
          const piClient = new PIClient({
            basePath: connection.baseUrl.replace(/^https?:\/\/[^\/]+/, ''), // Extract path from full URL
            authProvider: async () => basicAuthHeader(connection.username, connection.password || '')
          });
          
          const piProvider = new PIHistorianProvider(piClient);
          client.register(piProvider);
          setHistorianClient(client);
        }
      } catch (error) {
        console.error('Failed to initialize PI connection:', error);
      }
    };

    initializePI();
  }, [session?.tenant?.id]);

  // Mock data for quick stats
  const quickStats = [
    {
      title: 'Active Production Plans',
      value: '12',
      change: '+2',
      changeType: 'increase',
      icon: Calendar,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Open Events',
      value: '8',
      change: '-3',
      changeType: 'decrease',
      icon: AlertTriangle,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    },
    {
      title: 'RCA Investigations',
      value: '5',
      change: '+1',
      changeType: 'increase',
      icon: Target,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      title: 'Pending Tasks',
      value: '23',
      change: '-5',
      changeType: 'decrease',
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    }
  ];

  const recentAlerts = [
    {
      id: 1,
      type: 'warning',
      title: 'High Temperature Alert',
      description: 'Unit A temperature exceeded threshold',
      time: '5 minutes ago',
      unit: 'Unit A'
    },
    {
      id: 2,
      type: 'error',
      title: 'Equipment Failure',
      description: 'Pump B-001 stopped responding',
      time: '15 minutes ago',
      unit: 'Unit B'
    },
    {
      id: 3,
      type: 'info',
      title: 'Maintenance Due',
      description: 'Scheduled maintenance for Unit C',
      time: '1 hour ago',
      unit: 'Unit C'
    },
    {
      id: 4,
      type: 'success',
      title: 'Quality Check Passed',
      description: 'Batch #1234 quality verification completed',
      time: '2 hours ago',
      unit: 'Unit A'
    }
  ];

  const upcomingTasks = [
    {
      id: 1,
      title: 'Review RCA Report',
      priority: 'High',
      dueDate: 'Today',
      assignee: 'John Doe',
      type: 'RCA'
    },
    {
      id: 2,
      title: 'Update Production Plan',
      priority: 'Medium',
      dueDate: 'Tomorrow',
      assignee: 'Jane Smith',
      type: 'Planning'
    },
    {
      id: 3,
      title: 'Equipment Calibration',
      priority: 'Low',
      dueDate: 'Next Week',
      assignee: 'Mike Johnson',
      type: 'Maintenance'
    },
    {
      id: 4,
      title: 'Safety Audit',
      priority: 'High',
      dueDate: 'This Week',
      assignee: 'Sarah Wilson',
      type: 'Safety'
    }
  ];

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-orange-600" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'info':
        return <Info className="w-4 h-4 text-blue-600" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      default:
        return <Bell className="w-4 h-4 text-gray-600" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
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

  const getTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'rca':
        return 'bg-purple-100 text-purple-800';
      case 'planning':
        return 'bg-blue-100 text-blue-800';
      case 'maintenance':
        return 'bg-orange-100 text-orange-800';
      case 'safety':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (!session) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Please log in to view the dashboard</h2>
          <p className="text-muted-foreground">You need to be authenticated to access this page.</p>
        </div>
      </div>
    );
  }

  // HistorianClient is now initialized in useEffect with real PI credentials

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome back, {session.user.name}!
          </h1>
          <p className="text-muted-foreground">
            Here's what's happening with your production operations today.
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline">
            <Bell className="w-4 h-4 mr-2" />
            Notifications
          </Button>
          <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white">
            <Activity className="w-4 h-4 mr-2" />
            Quick Actions
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {quickStats.map((stat, index) => (
          <Card key={index} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="flex items-center space-x-2 mt-2">
                {stat.changeType === 'increase' ? (
                  <TrendingUp className="w-4 h-4 text-green-600" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-600" />
                )}
                <span className={`text-sm font-medium ${
                  stat.changeType === 'increase' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {stat.change}
                </span>
                <span className="text-xs text-muted-foreground">from yesterday</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Alerts */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Bell className="w-5 h-5 mr-2" />
                  Recent Alerts
                </CardTitle>
                <CardDescription>
                  Latest system alerts and notifications
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentAlerts.map((alert) => (
                    <div key={alert.id} className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                      {getAlertIcon(alert.type)}
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{alert.title}</h4>
                        <p className="text-xs text-gray-500">{alert.description}</p>
                        <div className="flex items-center space-x-2 mt-1">
                          <Badge variant="outline" className="text-xs">{alert.unit}</Badge>
                          <span className="text-xs text-gray-400">{alert.time}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Upcoming Tasks */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Upcoming Tasks
                </CardTitle>
                <CardDescription>
                  Tasks requiring attention
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {upcomingTasks.map((task) => (
                    <div key={task.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{task.title}</h4>
                        <div className="flex items-center space-x-2 mt-1">
                          <Badge className={getPriorityColor(task.priority)}>
                            {task.priority}
                          </Badge>
                          <Badge className={getTypeColor(task.type)}>
                            {task.type}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{task.assignee}</p>
                        <p className="text-xs text-gray-500">{task.dueDate}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Production Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="w-5 h-5 mr-2" />
                Production Summary
              </CardTitle>
              <CardDescription>
                Key production metrics for today
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">87.2%</div>
                  <p className="text-sm text-gray-500">Overall OEE</p>
                  <div className="flex items-center justify-center space-x-1 mt-1">
                    <TrendingUp className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-green-600">+2.1%</span>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">12.3h</div>
                  <p className="text-sm text-gray-500">Total Downtime</p>
                  <div className="flex items-center justify-center space-x-1 mt-1">
                    <TrendingDown className="w-4 h-4 text-red-600" />
                    <span className="text-sm text-red-600">-15.2%</span>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600">$124.5K</div>
                  <p className="text-sm text-gray-500">Production Cost</p>
                  <div className="flex items-center justify-center space-x-1 mt-1">
                    <TrendingDown className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-green-600">-8.7%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Historian Micro-Trends */}
          {historianClient && (
            <>
              <HistorianMicroTrends client={historianClient} tenantId={session?.tenant?.id || 'default-tenant'} />
              {process.env.NODE_ENV === 'development' && (
                <div className="text-xs text-gray-500 mt-2">
                  Debug: Dashboard tenant ID: {session?.tenant?.id || 'undefined'} | Using: {session?.tenant?.id || 'default-tenant'}
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <DashboardAnalytics />
        </TabsContent>

        <TabsContent value="alerts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2" />
                All Alerts & Notifications
              </CardTitle>
              <CardDescription>
                Complete list of system alerts and their status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <AlertTriangle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Alerts Management Coming Soon</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Advanced alert management and notification features will be available in the next phase
                </p>
                <Button variant="outline">
                  <Info className="w-4 h-4 mr-2" />
                  Under Development
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CheckCircle className="w-5 h-5 mr-2" />
                Task Management
              </CardTitle>
              <CardDescription>
                Manage and track all production-related tasks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <CheckCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Task Management Coming Soon</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Advanced task management and workflow features will be available in the next phase
                </p>
                <Button variant="outline">
                  <Info className="w-4 h-4 mr-2" />
                  Under Development
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Dashboard;
