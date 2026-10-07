import React, { useState, useEffect } from 'react';
import { ProductionPlan, masterDataService } from '../services/MasterDataService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';
import { Separator } from './ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { 
  Calendar, 
  Clock, 
  Target, 
  TrendingUp, 
  CheckCircle, 
  AlertCircle, 
  Settings,
  Filter,
  Search,
  Plus,
  Eye,
  BarChart3,
  XCircle
} from 'lucide-react';

interface ProductionPlanSelectorProps {
  tenantId: string;
  selectedPlan: ProductionPlan | null;
  onPlanSelect: (plan: ProductionPlan | null) => void;
  onConfigurePlan?: () => void;
  unitId?: string; // Optional filter by unit
  showConfigureButton?: boolean;
  className?: string;
}

export const ProductionPlanSelector: React.FC<ProductionPlanSelectorProps> = ({
  tenantId,
  selectedPlan,
  onPlanSelect,
  onConfigurePlan,
  unitId,
  showConfigureButton = true,
  className = ''
}) => {
  const [plans, setPlans] = useState<ProductionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterUnitId, setFilterUnitId] = useState<string>(unitId || '');
  const [showAllPlans, setShowAllPlans] = useState(false);

  useEffect(() => {
    const fetchPlans = async () => {
      if (!tenantId) return;
      
      setLoading(true);
      try {
        const filters: { tenantId: string; unitId?: string; status?: string } = { tenantId };
        if (filterUnitId) filters.unitId = filterUnitId;
        if (filterStatus && filterStatus !== 'all') filters.status = filterStatus;
        
        const plansData = await masterDataService.getProductionPlans(filters);
        setPlans(plansData);
      } catch (error) {
        console.error('Error fetching production plans:', error);
        setPlans([]); // Ensure plans is set to empty array on error
      } finally {
        setLoading(false);
      }
    };

    fetchPlans();
  }, [tenantId, filterUnitId, filterStatus]);

  const handlePlanSelect = (planId: string) => {
    if (planId === 'none') {
      onPlanSelect(null);
      return;
    }
    
    const plan = plans.find(p => p.id === planId);
    onPlanSelect(plan || null);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'Planned': { color: 'bg-blue-100 text-blue-800 border-blue-200', icon: Calendar },
      'Active': { color: 'bg-green-100 text-green-800 border-green-200', icon: TrendingUp },
      'Completed': { color: 'bg-gray-100 text-gray-800 border-gray-200', icon: CheckCircle },
      'Cancelled': { color: 'bg-red-100 text-red-800 border-red-200', icon: AlertCircle }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig['Planned'];
    const Icon = config.icon;
    
    return (
      <Badge variant="outline" className={`${config.color} text-xs flex items-center space-x-1`}>
        <Icon className="w-3 h-3" />
        <span>{status}</span>
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatQuantity = (quantity: number) => {
    if (quantity >= 1000) {
      return `${(quantity / 1000).toFixed(1)}K`;
    }
    return quantity.toString();
  };

  // Filter plans for display
  const displayPlans = showAllPlans ? plans : plans.slice(0, 10);
  const hasMorePlans = plans.length > 10;

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span className="text-sm text-gray-600">Loading production plans...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card className={className}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl">Production Plan Selection</CardTitle>
                <CardDescription>Select a production plan for waterfall analysis</CardDescription>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {showConfigureButton && onConfigurePlan && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" onClick={onConfigurePlan}>
                      <Plus className="w-4 h-4 mr-2" />
                      New Plan
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Create a new production plan</p>
                  </TooltipContent>
                </Tooltip>
              )}
              {selectedPlan && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={async () => {
                        try {
                          await masterDataService.simulateProductionEvents(selectedPlan.unitId, 20, tenantId);
                          // Refresh plans to show updated data
                          window.location.reload();
                        } catch (error) {
                          console.error('Error creating sample data:', error);
                        }
                      }}
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Add Sample Data
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Generate sample production events for testing</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Filter by Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Planned">Planned</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-medium">Quick Selection</Label>
              <Select value={selectedPlan?.id || 'none'} onValueChange={handlePlanSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a plan..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Plan Selected</SelectItem>
                  {plans.map(plan => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name} ({plan.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Selected Plan Display */}
          {selectedPlan ? (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-semibold text-blue-900">{selectedPlan.name}</h3>
                    {getStatusBadge(selectedPlan.status)}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <Label className="text-blue-700 font-medium">Planned Quantity</Label>
                      <p className="text-blue-900 font-semibold">{formatQuantity(selectedPlan.plannedQuantity)} MT</p>
                    </div>
                    <div>
                      <Label className="text-blue-700 font-medium">Period</Label>
                      <p className="text-blue-900 font-semibold">
                        {formatDate(selectedPlan.startDate)} - {formatDate(selectedPlan.endDate)}
                      </p>
                    </div>
                    <div>
                      <Label className="text-blue-700 font-medium">Actual Quantity</Label>
                      <p className="text-blue-900 font-semibold">
                        {selectedPlan.actualQuantity ? formatQuantity(selectedPlan.actualQuantity) : 'N/A'} MT
                      </p>
                    </div>
                    <div>
                      <Label className="text-blue-700 font-medium">Approval Status</Label>
                      <Badge variant="outline" className="text-xs">
                        {selectedPlan.approvalStatus || 'Draft'}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" onClick={() => onPlanSelect(null)}>
                        <XCircle className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Clear selection</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
              <div className="p-4 bg-gray-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Target className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Production Plan Selected</h3>
              <p className="text-gray-500 mb-4">Select a production plan to view the waterfall analysis</p>
              <div className="flex items-center justify-center space-x-2">
                <Badge variant="outline" className="text-xs">
                  {plans.length} plans available
                </Badge>
              </div>
            </div>
          )}

          {/* Plans List (Optional - for detailed view) */}
          {plans.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Available Plans</Label>
                  {hasMorePlans && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setShowAllPlans(!showAllPlans)}
                    >
                      {showAllPlans ? 'Show Less' : `Show All (${plans.length})`}
                    </Button>
                  )}
                </div>
                
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {displayPlans.map(plan => (
                    <div
                      key={plan.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedPlan?.id === plan.id 
                          ? 'bg-blue-50 border-blue-200' 
                          : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                      }`}
                      onClick={() => onPlanSelect(plan)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="font-medium text-gray-900">{plan.name}</span>
                            {getStatusBadge(plan.status)}
                          </div>
                          <div className="flex items-center space-x-4 text-xs text-gray-600">
                            <span className="flex items-center space-x-1">
                              <Target className="w-3 h-3" />
                              <span>{formatQuantity(plan.plannedQuantity)} MT</span>
                            </span>
                            <span className="flex items-center space-x-1">
                              <Calendar className="w-3 h-3" />
                              <span>{formatDate(plan.startDate)} - {formatDate(plan.endDate)}</span>
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {selectedPlan?.id === plan.id && (
                            <CheckCircle className="w-4 h-4 text-blue-600" />
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onPlanSelect(plan);
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {plans.length === 0 && !loading && (
            <div className="text-center py-8">
              <div className="p-4 bg-gray-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Settings className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Production Plans Found</h3>
              <p className="text-gray-500 mb-4">Create your first production plan to get started</p>
              {showConfigureButton && onConfigurePlan && (
                <Button onClick={onConfigurePlan}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Plan
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};
