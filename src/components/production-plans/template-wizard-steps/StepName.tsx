import React from 'react';
import { ProductionPlanTemplate, Unit, Product } from '../../../services/MasterDataService';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';

type StepNameProps = {
  template: Partial<ProductionPlanTemplate>;
  onUpdate: (updates: Partial<ProductionPlanTemplate>) => void;
  units?: Unit[];
  products?: Product[];
};

const StepName: React.FC<StepNameProps> = ({ template, onUpdate }) => {
  return (
    <div className="space-y-3">
      <div className="text-center">
        <h3 className="text-base font-semibold text-gray-900">Template Details</h3>
        <p className="text-xs text-gray-600 mt-1">
          Define the basic information for your production plan template
        </p>
      </div>

      <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50">
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1">
            <Label htmlFor="name" className="text-xs font-medium text-gray-700">
              Template Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              value={template.name || ''}
              onChange={(e) => onUpdate({ name: e.target.value })}
              placeholder="Enter a descriptive template name"
              className="h-8 text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="description" className="text-xs font-medium text-gray-700">
              Description
            </Label>
            <Textarea
              id="description"
              value={template.description || ''}
              onChange={(e) => onUpdate({ description: e.target.value })}
              placeholder="Brief description of the template's purpose"
              rows={2}
              className="text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500 resize-none"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StepName; 