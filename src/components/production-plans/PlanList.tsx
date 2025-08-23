import React from 'react';
import { ProductionPlan, Unit, Product } from '../../services/MasterDataService';
import { Plus, Filter, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PlanItem from './PlanItem';

// Helper to get name by id
const getName = (arr: { id: string; name: string }[], id: string) => arr.find(x => x.id === id)?.name || 'Unknown';

type PlanListProps = {
  plans: ProductionPlan[];
  units: Unit[];
  products: Product[];
  onNewPlan: () => void;
  onEditPlan: (plan: ProductionPlan) => void;
  onDeletePlan: (id: string) => void;
  onViewPlan: (plan: ProductionPlan) => void;
  onViewDashboard: (plan: ProductionPlan) => void;
};

const PlanList: React.FC<PlanListProps> = ({ 
  plans, 
  units, 
  products, 
  onNewPlan, 
  onEditPlan, 
  onDeletePlan,
  onViewPlan,
  onViewDashboard
}) => {
  return (
    <div className="space-y-6 bg-gradient-to-br from-white via-blue-50 to-purple-50 rounded-2xl shadow-lg p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-blue-100 mb-2">
        <div className="flex items-center gap-2">
          <Filter className="w-6 h-6 text-blue-500" />
          <h2 className="text-2xl font-bold text-blue-800">Production Plans</h2>
        </div>
        <Button onClick={onNewPlan} className="flex items-center space-x-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow rounded-full px-4 py-2">
          <Plus className="w-4 h-4" />
          <span>New Plan</span>
        </Button>
      </div>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 bg-white/70 rounded-xl p-4 shadow-sm border border-blue-100">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search plans..."
            className="pl-10 rounded-full border-blue-100"
          />
        </div>
        <Select>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Planned">Planned</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Completed">Completed</SelectItem>
            <SelectItem value="Cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by approval" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Approval</SelectItem>
            <SelectItem value="Draft">Draft</SelectItem>
            <SelectItem value="Pending Review">Pending Review</SelectItem>
            <SelectItem value="Pending Approval">Pending Approval</SelectItem>
            <SelectItem value="Approved">Approved</SelectItem>
            <SelectItem value="Rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Select>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by unit" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Units</SelectItem>
            {units.map((unit) => (
              <SelectItem key={unit.id} value={unit.id}>
                {unit.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Plans Grid */}
      <div className="grid gap-4">
        {plans.map((plan) => (
          <PlanItem
            key={plan.id}
            plan={plan}
            unit={units.find(u => u.id === plan.unitId)}
            product={products.find(p => p.id === plan.productId)}
            onEdit={onEditPlan}
            onDelete={onDeletePlan}
            onView={onViewPlan}
            onViewDashboard={onViewDashboard}
          />
        ))}
        
        {plans.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Plus className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">No production plans found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first production plan to get started
            </p>
            <Button onClick={onNewPlan}>
              <Plus className="w-4 h-4 mr-2" />
              Create Plan
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlanList; 