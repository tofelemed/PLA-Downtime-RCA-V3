import React from 'react';
import { ProductionPlanTemplate, Unit, Product } from '../../../services/MasterDataService';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { formatDateRange } from '../../../utils/dateFormatters';

type StepScheduleProps = {
  template: Partial<ProductionPlanTemplate>;
  onUpdate: (updates: Partial<ProductionPlanTemplate>) => void;
  units?: Unit[];
  products?: Product[];
};

const StepSchedule: React.FC<StepScheduleProps> = ({ template, onUpdate }) => {
  return (
    <div className="space-y-3">
      <div className="text-center">
        <h3 className="text-base font-semibold text-gray-900">Schedule Configuration</h3>
        <p className="text-xs text-gray-600 mt-1">
          Configure the scheduling parameters for your production plan
        </p>
      </div>

      <Card className="border-0 shadow-sm bg-gradient-to-br from-indigo-50 to-blue-50">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="recurrence" className="text-xs font-medium text-gray-700">
                Recurrence
              </Label>
              <Select 
                value={template.recurrence || 'Daily'} 
                onValueChange={(value) => onUpdate({ recurrence: value })}
              >
                <SelectTrigger className="h-8 text-sm border-gray-300 focus:border-indigo-500 focus:ring-indigo-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Daily" className="hover:bg-indigo-50">Daily</SelectItem>
                  <SelectItem value="Weekly" className="hover:bg-indigo-50">Weekly</SelectItem>
                  <SelectItem value="Monthly" className="hover:bg-indigo-50">Monthly</SelectItem>
                  <SelectItem value="Quarterly" className="hover:bg-indigo-50">Quarterly</SelectItem>
                  <SelectItem value="Yearly" className="hover:bg-indigo-50">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="dataEntryFrequency" className="text-xs font-medium text-gray-700">
                Data Entry Frequency
              </Label>
              <Select 
                value={template.dataEntryFrequency || 'Daily'} 
                onValueChange={(value) => onUpdate({ dataEntryFrequency: value })}
              >
                <SelectTrigger className="h-8 text-sm border-gray-300 focus:border-indigo-500 focus:ring-indigo-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Hourly" className="hover:bg-indigo-50">Hourly</SelectItem>
                  <SelectItem value="Daily" className="hover:bg-indigo-50">Daily</SelectItem>
                  <SelectItem value="Weekly" className="hover:bg-indigo-50">Weekly</SelectItem>
                  <SelectItem value="Monthly" className="hover:bg-indigo-50">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="startDate" className="text-xs font-medium text-gray-700">
                Start Date
              </Label>
              <Input
                id="startDate"
                type="date"
                value={template.startDate || ''}
                onChange={(e) => onUpdate({ startDate: e.target.value })}
                className="h-8 text-sm border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="endDate" className="text-xs font-medium text-gray-700">
                End Date
              </Label>
              <Input
                id="endDate"
                type="date"
                value={template.endDate || ''}
                onChange={(e) => onUpdate({ endDate: e.target.value })}
                className="h-8 text-sm border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
          </div>

          {template.startDate && template.endDate && (
            <div className="mt-2 p-2 bg-indigo-100 rounded border border-indigo-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-indigo-800">
                    📅 {formatDateRange(template.startDate, template.endDate)}
                  </p>
                  <p className="text-xs text-indigo-700">
                    {template.recurrence || 'Daily'} • {template.dataEntryFrequency || 'Daily'} data entry
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StepSchedule; 