import React from 'react';
import { ProductionPlanTemplate, Unit, Product } from '../../../services/MasterDataService';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type StepReviewProps = {
  template: Partial<ProductionPlanTemplate>;
  onUpdate: (updates: Partial<ProductionPlanTemplate>) => void;
  units?: Unit[];
  products?: Product[];
};

const StepReview: React.FC<StepReviewProps> = ({ template, units = [], products = [] }) => {
  const selectedUnit = units.find(u => u.id === template.unitId);
  const selectedProducts = products.filter(p => template.productIds?.includes(p.id));

  return (
    <div className="space-y-3">
      <div className="text-center">
        <h3 className="text-base font-semibold text-gray-900">Review Template</h3>
        <p className="text-xs text-gray-600 mt-1">
          Review all settings before creating your production plan template
        </p>
      </div>

      <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-green-50">
        <CardContent className="p-4 space-y-3">
          {/* Basic Info */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-gray-800 uppercase tracking-wide">Template Details</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-gray-600">Name:</span>
                <span className="ml-1 font-medium">{template.name || 'Not set'}</span>
              </div>
              <div>
                <span className="text-gray-600">Description:</span>
                <span className="ml-1 font-medium">{template.description || 'Not provided'}</span>
              </div>
            </div>
          </div>

          {/* Plan Basis */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-gray-800 uppercase tracking-wide">Plan Configuration</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-gray-600">Plan Basis:</span>
                <Badge variant="outline" className="ml-1 text-xs px-1 py-0">
                  {template.planBasis || 'Not set'}
                </Badge>
              </div>
              <div>
                <span className="text-gray-600">Unit:</span>
                <span className="ml-1 font-medium">{selectedUnit?.name || 'Not selected'}</span>
              </div>
            </div>
          </div>

          {/* Products */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-gray-800 uppercase tracking-wide">Products ({selectedProducts.length})</h4>
            <div className="grid grid-cols-1 gap-1">
              {selectedProducts.map((product) => (
                <div key={product.id} className="flex items-center justify-between p-1 bg-white rounded border border-gray-200">
                  <span className="text-xs font-medium">{product.name}</span>
                  <Badge variant="outline" className="text-xs px-1 py-0">
                    {product.code}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Schedule */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-gray-800 uppercase tracking-wide">Schedule</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-gray-600">Recurrence:</span>
                <span className="ml-1 font-medium">{template.recurrence || 'Daily'}</span>
              </div>
              <div>
                <span className="text-gray-600">Data Entry:</span>
                <span className="ml-1 font-medium">{template.dataEntryFrequency || 'Daily'}</span>
              </div>
              <div>
                <span className="text-gray-600">Start Date:</span>
                <span className="ml-1 font-medium">{template.startDate || 'Not set'}</span>
              </div>
              <div>
                <span className="text-gray-600">End Date:</span>
                <span className="ml-1 font-medium">{template.endDate || 'Not set'}</span>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="mt-3 p-2 bg-emerald-100 rounded border border-emerald-200">
            <p className="text-xs font-medium text-emerald-800 text-center">
              ✓ Template ready to create with {selectedProducts.length} product{selectedProducts.length !== 1 ? 's' : ''} and {template.planBasis || 'undefined'} planning approach
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StepReview; 