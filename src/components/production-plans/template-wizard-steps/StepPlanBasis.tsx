import React from 'react';
import { ProductionPlanTemplate, Unit, Product } from '../../../services/MasterDataService';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';

type StepPlanBasisProps = {
  template: Partial<ProductionPlanTemplate>;
  onUpdate: (updates: Partial<ProductionPlanTemplate>) => void;
  units?: Unit[];
  products?: Product[];
};

const StepPlanBasis: React.FC<StepPlanBasisProps> = ({ template, onUpdate }) => {
  return (
    <div className="space-y-3">
      <div className="text-center">
        <h3 className="text-base font-semibold text-gray-900">Plan Basis</h3>
        <p className="text-xs text-gray-600 mt-1">
          Select the fundamental approach for your production planning
        </p>
      </div>

      <Card className="border-0 shadow-sm bg-gradient-to-br from-green-50 to-emerald-50">
        <CardContent className="p-4">
          <div className="space-y-2">
            <Label htmlFor="planBasis" className="text-xs font-medium text-gray-700">
              Planning Approach <span className="text-red-500">*</span>
            </Label>
            <Select 
              value={template.planBasis || ''} 
              onValueChange={(value) => onUpdate({ planBasis: value })}
            >
              <SelectTrigger className="h-8 text-sm border-gray-300 focus:border-green-500 focus:ring-green-500">
                <SelectValue placeholder="Choose your planning approach" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Time-based" className="hover:bg-green-50">
                  <div className="flex flex-col">
                    <span className="font-medium text-sm">Time-based</span>
                    <span className="text-xs text-gray-500">Plan based on available production time</span>
                  </div>
                </SelectItem>
                <SelectItem value="Demand-based" className="hover:bg-green-50">
                  <div className="flex flex-col">
                    <span className="font-medium text-sm">Demand-based</span>
                    <span className="text-xs text-gray-500">Plan based on customer demand forecasts</span>
                  </div>
                </SelectItem>
                <SelectItem value="Capacity-based" className="hover:bg-green-50">
                  <div className="flex flex-col">
                    <span className="font-medium text-sm">Capacity-based</span>
                    <span className="text-xs text-gray-500">Plan based on equipment capacity limits</span>
                  </div>
                </SelectItem>
                <SelectItem value="Historical" className="hover:bg-green-50">
                  <div className="flex flex-col">
                    <span className="font-medium text-sm">Historical</span>
                    <span className="text-xs text-gray-500">Plan based on historical performance data</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StepPlanBasis; 