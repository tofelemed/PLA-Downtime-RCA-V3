import React from 'react';
import { ProductionPlan } from '../../services/MasterDataService';
import { Edit, Trash2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';

type PlanActionsProps = {
  plan: ProductionPlan;
  onEdit: (plan: ProductionPlan) => void;
  onDelete: (id: string) => void;
  onView?: (plan: ProductionPlan) => void;
};

const PlanActions: React.FC<PlanActionsProps> = ({ plan, onEdit, onDelete, onView }) => (
  <div className="flex space-x-1">
    {onView && (
      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          onView(plan);
        }}
        className="h-8 w-8 p-0"
      >
        <Eye className="w-4 h-4" />
      </Button>
    )}
    <Button
      variant="ghost"
      size="sm"
      onClick={(e) => {
        e.stopPropagation();
        onEdit(plan);
      }}
      className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700"
    >
      <Edit className="w-4 h-4" />
    </Button>
    <Button
      variant="ghost"
      size="sm"
      onClick={(e) => {
        e.stopPropagation();
        onDelete(plan.id);
      }}
      className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
    >
      <Trash2 className="w-4 h-4" />
    </Button>
  </div>
);

export default PlanActions; 