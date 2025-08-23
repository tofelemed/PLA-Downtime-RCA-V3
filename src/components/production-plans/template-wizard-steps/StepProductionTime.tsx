import React from 'react';
import { ProductionPlanTemplate, Unit, Product, UsefulProductionTime } from '../../../services/MasterDataService';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

type StepProductionTimeProps = {
  template: Partial<ProductionPlanTemplate>;
  onUpdate: (updates: Partial<ProductionPlanTemplate>) => void;
  units?: Unit[];
  products?: Product[];
};

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const StepProductionTime: React.FC<StepProductionTimeProps> = ({ template, onUpdate }) => {
  const updateProductionTime = (day: string, field: 'start' | 'end', value: string) => {
    const currentTime = template.usefulProductionTime || {};
    const updatedTime = {
      ...currentTime,
      [day]: {
        ...currentTime[day],
        [field]: value
      }
    };
    onUpdate({ usefulProductionTime: updatedTime });
  };

  return (
    <div className="space-y-3">
      <div className="text-center">
        <h3 className="text-base font-semibold text-gray-900">Production Hours</h3>
        <p className="text-xs text-gray-600 mt-1">
          Configure working hours for each day of the week
        </p>
      </div>

      <Card className="border-0 shadow-sm bg-gradient-to-br from-teal-50 to-cyan-50">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
            {days.map((day) => (
              <div key={day} className="p-2 bg-white rounded border border-gray-200 hover:shadow-sm transition-shadow">
                <Label className="text-xs font-medium text-gray-700 mb-1 block">
                  {day}
                </Label>
                <div className="grid grid-cols-2 gap-1">
                  <div>
                    <Input
                      type="time"
                      value={template.usefulProductionTime?.[day]?.start || ''}
                      onChange={(e) => updateProductionTime(day, 'start', e.target.value)}
                      placeholder="08:00"
                      className="h-6 text-xs border-gray-300 focus:border-teal-500 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <Input
                      type="time"
                      value={template.usefulProductionTime?.[day]?.end || ''}
                      onChange={(e) => updateProductionTime(day, 'end', e.target.value)}
                      placeholder="17:00"
                      className="h-6 text-xs border-gray-300 focus:border-teal-500 focus:ring-teal-500"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-2 p-2 bg-teal-100 rounded border border-teal-200">
            <p className="text-xs text-teal-800">
              💡 <strong>Tip:</strong> Set production hours for each day. Leave empty for non-production days.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StepProductionTime; 