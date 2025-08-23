import React from 'react';
import { ProductionPlanTemplate, Unit } from '../../../services/MasterDataService';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type StepUnitProps = {
  template: Partial<ProductionPlanTemplate>;
  onUpdate: (updates: Partial<ProductionPlanTemplate>) => void;
  units?: Unit[];
  products?: any[];
};

const StepUnit: React.FC<StepUnitProps> = ({ template, onUpdate, units = [] }) => {
  const selectedUnit = units.find(u => u.id === template.unitId);

  return (
    <div className="space-y-3">
      <div className="text-center">
        <h3 className="text-base font-semibold text-gray-900">Production Unit</h3>
        <p className="text-xs text-gray-600 mt-1">
          Select the production unit for this template
        </p>
      </div>

      <Card className="border-0 shadow-sm bg-gradient-to-br from-orange-50 to-amber-50">
        <CardContent className="p-4">
          <div className="space-y-2">
            <Label htmlFor="unitId" className="text-xs font-medium text-gray-700">
              Production Unit <span className="text-red-500">*</span>
            </Label>
            <Select 
              value={template.unitId || ''} 
              onValueChange={(value) => onUpdate({ unitId: value })}
            >
              <SelectTrigger className="h-8 text-sm border-gray-300 focus:border-orange-500 focus:ring-orange-500">
                <SelectValue placeholder="Select a production unit" />
              </SelectTrigger>
              <SelectContent>
                {units.map((unit) => (
                  <SelectItem key={unit.id} value={unit.id} className="hover:bg-orange-50">
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">{unit.name}</span>
                      <span className="text-xs text-gray-500">{unit.code}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {template.unitId && (
            <div className="mt-2 p-2 bg-orange-100 rounded border border-orange-200">
              <p className="text-xs font-medium text-orange-800">
                ✓ Unit selected: {units.find(u => u.id === template.unitId)?.name}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedUnit && (
        <div className="p-4 bg-white rounded-lg border border-orange-200">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-gray-900">{selectedUnit.name}</h4>
            <Badge variant="outline" className="text-xs">
              {selectedUnit.code}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500">Capacity:</span>
              <p className="font-medium">{selectedUnit.capacity} {selectedUnit.unitOfMeasure}</p>
            </div>
            <div>
              <span className="text-gray-500">Type:</span>
              <p className="font-medium">{selectedUnit.description || 'Standard Unit'}</p>
            </div>
          </div>
        </div>
      )}

      {units.length === 0 && (
        <div className="text-center py-6">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-gray-400 text-xl">🏭</span>
          </div>
          <p className="text-sm text-gray-500">
            No production units available. Please create units first.
          </p>
        </div>
      )}
    </div>
  );
};

export default StepUnit; 