import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Trash2, 
  Filter, 
  Zap, 
  Eye, 
  EyeOff,
  Play,
  Pause,
  RotateCcw
} from 'lucide-react';
import { TransformConfig, FilterConfig } from '@/services/integrations/base/IConnector';

interface DataTransformationPanelProps {
  connectionId: string;
  transforms: TransformConfig[];
  filters: FilterConfig[];
  onAddTransform: (transform: TransformConfig) => void;
  onRemoveTransform: (transformId: string) => void;
  onAddFilter: (filter: FilterConfig) => void;
  onRemoveFilter: (filterId: string) => void;
  onToggleTransform: (transformId: string, enabled: boolean) => void;
  onToggleFilter: (filterId: string, enabled: boolean) => void;
}

export const DataTransformationPanel: React.FC<DataTransformationPanelProps> = ({
  connectionId,
  transforms,
  filters,
  onAddTransform,
  onRemoveTransform,
  onAddFilter,
  onRemoveFilter,
  onToggleTransform,
  onToggleFilter
}) => {
  const [showTransformForm, setShowTransformForm] = useState(false);
  const [showFilterForm, setShowFilterForm] = useState(false);
  const [transformForm, setTransformForm] = useState<Partial<TransformConfig>>({
    name: '',
    type: 'math',
    enabled: true,
    order: 0,
    config: {}
  });
  const [filterForm, setFilterForm] = useState<Partial<FilterConfig>>({
    name: '',
    type: 'regex',
    enabled: true,
    order: 0,
    config: {}
  });

  const transformTypes = [
    { value: 'math', label: 'Mathematical Operations', description: 'Add, subtract, multiply, divide, power, sqrt, abs' },
    { value: 'string', label: 'String Operations', description: 'Uppercase, lowercase, trim, replace, substring, pad' },
    { value: 'timestamp', label: 'Timestamp Operations', description: 'Convert formats, add/subtract time, format display' },
    { value: 'custom', label: 'Custom Function', description: 'Write custom JavaScript transformation logic' }
  ];

  const filterTypes = [
    { value: 'regex', label: 'Regular Expression', description: 'Filter data using regex patterns' },
    { value: 'range', label: 'Value Range', description: 'Filter numeric values within min/max range' },
    { value: 'custom', label: 'Custom Function', description: 'Write custom JavaScript filter logic' }
  ];

  const handleAddTransform = () => {
    if (!transformForm.name || !transformForm.type) return;

    const newTransform: TransformConfig = {
      id: `transform_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: transformForm.name,
      type: transformForm.type as any,
      enabled: transformForm.enabled || true,
      order: transformForm.order || 0,
      config: transformForm.config || {}
    };

    onAddTransform(newTransform);
    setTransformForm({ name: '', type: 'math', enabled: true, order: 0, config: {} });
    setShowTransformForm(false);
  };

  const handleAddFilter = () => {
    if (!filterForm.name || !filterForm.type) return;

    const newFilter: FilterConfig = {
      id: `filter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: filterForm.name,
      type: filterForm.type as any,
      enabled: filterForm.enabled || true,
      order: filterForm.order || 0,
      config: filterForm.config || {}
    };

    onAddFilter(newFilter);
    setFilterForm({ name: '', type: 'regex', enabled: true, order: 0, config: {} });
    setShowFilterForm(false);
  };

  const renderTransformConfig = () => {
    switch (transformForm.type) {
      case 'math':
        return (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Operation</Label>
              <Select
                value={transformForm.config?.operation || 'add'}
                onValueChange={(value) => setTransformForm({
                  ...transformForm,
                  config: { ...transformForm.config, operation: value }
                })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="add">Add</SelectItem>
                  <SelectItem value="subtract">Subtract</SelectItem>
                  <SelectItem value="multiply">Multiply</SelectItem>
                  <SelectItem value="divide">Divide</SelectItem>
                  <SelectItem value="power">Power</SelectItem>
                  <SelectItem value="sqrt">Square Root</SelectItem>
                  <SelectItem value="abs">Absolute Value</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Value</Label>
              <Input
                type="number"
                value={transformForm.config?.value || ''}
                onChange={(e) => setTransformForm({
                  ...transformForm,
                  config: { ...transformForm.config, value: parseFloat(e.target.value) || 0 }
                })}
                placeholder="0"
              />
            </div>
          </div>
        );

      case 'string':
        return (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Operation</Label>
              <Select
                value={transformForm.config?.operation || 'uppercase'}
                onValueChange={(value) => setTransformForm({
                  ...transformForm,
                  config: { ...transformForm.config, operation: value }
                })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="uppercase">Uppercase</SelectItem>
                  <SelectItem value="lowercase">Lowercase</SelectItem>
                  <SelectItem value="trim">Trim</SelectItem>
                  <SelectItem value="replace">Replace</SelectItem>
                  <SelectItem value="substring">Substring</SelectItem>
                  <SelectItem value="pad">Pad</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Value/Pattern</Label>
              <Input
                value={transformForm.config?.value || ''}
                onChange={(e) => setTransformForm({
                  ...transformForm,
                  config: { ...transformForm.config, value: e.target.value }
                })}
                placeholder="Value or pattern"
              />
            </div>
          </div>
        );

      case 'timestamp':
        return (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Operation</Label>
              <Select
                value={transformForm.config?.operation || 'toISO'}
                onValueChange={(value) => setTransformForm({
                  ...transformForm,
                  config: { ...transformForm.config, operation: value }
                })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="toISO">To ISO String</SelectItem>
                  <SelectItem value="toUnix">To Unix Timestamp</SelectItem>
                  <SelectItem value="format">Format Display</SelectItem>
                  <SelectItem value="addHours">Add Hours</SelectItem>
                  <SelectItem value="addDays">Add Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Value</Label>
              <Input
                type="number"
                value={transformForm.config?.value || ''}
                onChange={(e) => setTransformForm({
                  ...transformForm,
                  config: { ...transformForm.config, value: parseFloat(e.target.value) || 0 }
                })}
                placeholder="Hours/days to add"
              />
            </div>
          </div>
        );

      case 'custom':
        return (
          <div className="space-y-2">
            <Label>Custom Function</Label>
            <Textarea
              value={transformForm.config?.transformFunction || ''}
              onChange={(e) => setTransformForm({
                ...transformForm,
                config: { ...transformForm.config, transformFunction: e.target.value }
              })}
              placeholder="function(data) { return data * 2; }"
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Write a JavaScript function that takes 'data' as input and returns the transformed value
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  const renderFilterConfig = () => {
    switch (filterForm.type) {
      case 'regex':
        return (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Pattern</Label>
              <Input
                value={filterForm.config?.pattern || ''}
                onChange={(e) => setFilterForm({
                  ...filterForm,
                  config: { ...filterForm.config, pattern: e.target.value }
                })}
                placeholder="regex pattern"
              />
            </div>
            <div className="space-y-2">
              <Label>Flags</Label>
              <Input
                value={filterForm.config?.flags || ''}
                onChange={(e) => setFilterForm({
                  ...filterForm,
                  config: { ...filterForm.config, flags: e.target.value }
                })}
                placeholder="gi, m, s"
              />
            </div>
          </div>
        );

      case 'range':
        return (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Minimum Value</Label>
              <Input
                type="number"
                value={filterForm.config?.min || ''}
                onChange={(e) => setFilterForm({
                  ...filterForm,
                  config: { ...filterForm.config, min: parseFloat(e.target.value) || undefined }
                })}
                placeholder="Min value"
              />
            </div>
            <div className="space-y-2">
              <Label>Maximum Value</Label>
              <Input
                type="number"
                value={filterForm.config?.max || ''}
                onChange={(e) => setFilterForm({
                  ...filterForm,
                  config: { ...filterForm.config, max: parseFloat(e.target.value) || undefined }
                })}
                placeholder="Max value"
              />
            </div>
          </div>
        );

      case 'custom':
        return (
          <div className="space-y-2">
            <Label>Custom Filter Function</Label>
            <Textarea
              value={filterForm.config?.filterFunction || ''}
              onChange={(e) => setFilterForm({
                ...filterForm,
                config: { ...filterForm.config, filterFunction: e.target.value }
              })}
              placeholder="function(data) { return data > 100; }"
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Write a JavaScript function that takes 'data' as input and returns true to keep, false to filter out
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Data Transformation & Filtering</h3>
          <p className="text-sm text-muted-foreground">
            Configure data processing pipelines for connection: {connectionId}
          </p>
        </div>
      </div>

      {/* Transforms Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Data Transforms
              </CardTitle>
              <CardDescription>
                Apply mathematical, string, and timestamp transformations to your data
              </CardDescription>
            </div>
            <Button onClick={() => setShowTransformForm(true)} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Transform
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {transforms.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No transforms configured. Add your first transform to start processing data.
            </div>
          ) : (
            <div className="space-y-3">
              {transforms.map((transform, index) => (
                <div key={transform.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                      <Zap className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-medium">{transform.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {transformTypes.find(t => t.value === transform.type)?.label} • Order: {transform.order}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onToggleTransform(transform.id, !transform.enabled)}
                    >
                      {transform.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </Button>
                    <Badge variant={transform.enabled ? "default" : "secondary"}>
                      {transform.enabled ? "Active" : "Disabled"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveTransform(transform.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filters Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Filter className="w-5 h-5" />
                Data Filters
              </CardTitle>
              <CardDescription>
                Filter data based on conditions, ranges, and custom logic
              </CardDescription>
            </div>
            <Button onClick={() => setShowFilterForm(true)} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Filter
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {filters.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No filters configured. Add your first filter to start filtering data.
            </div>
          ) : (
            <div className="space-y-3">
              {filters.map((filter, index) => (
                <div key={filter.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                      <Filter className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <div className="font-medium">{filter.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {filterTypes.find(t => t.value === filter.type)?.label} • Order: {filter.order}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onToggleFilter(filter.id, !filter.enabled)}
                    >
                      {filter.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </Button>
                    <Badge variant={filter.enabled ? "default" : "secondary"}>
                      {filter.enabled ? "Active" : "Disabled"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveFilter(filter.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Transform Modal */}
      {showTransformForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Add Data Transform</CardTitle>
              <CardDescription>Configure a new data transformation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="transform-name">Name *</Label>
                  <Input
                    id="transform-name"
                    value={transformForm.name}
                    onChange={(e) => setTransformForm({ ...transformForm, name: e.target.value })}
                    placeholder="My Transform"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="transform-type">Type *</Label>
                  <Select
                    value={transformForm.type}
                    onValueChange={(value) => setTransformForm({ ...transformForm, type: value as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {transformTypes.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="transform-order">Order</Label>
                <Input
                  id="transform-order"
                  type="number"
                  value={transformForm.order}
                  onChange={(e) => setTransformForm({ ...transformForm, order: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>

              {renderTransformConfig()}

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="transform-enabled"
                  checked={transformForm.enabled}
                  onChange={(e) => setTransformForm({ ...transformForm, enabled: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="transform-enabled">Enable this transform</Label>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowTransformForm(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleAddTransform}>
                  Add Transform
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add Filter Modal */}
      {showFilterForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Add Data Filter</CardTitle>
              <CardDescription>Configure a new data filter</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="filter-name">Name *</Label>
                  <Input
                    id="filter-name"
                    value={filterForm.name}
                    onChange={(e) => setFilterForm({ ...filterForm, name: e.target.value })}
                    placeholder="My Filter"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="filter-type">Type *</Label>
                  <Select
                    value={filterForm.type}
                    onValueChange={(value) => setFilterForm({ ...filterForm, type: value as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {filterTypes.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="filter-order">Order</Label>
                <Input
                  id="filter-order"
                  type="number"
                  value={filterForm.order}
                  onChange={(e) => setFilterForm({ ...filterForm, order: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>

              {renderFilterConfig()}

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="filter-enabled"
                  checked={filterForm.enabled}
                  onChange={(e) => setFilterForm({ ...filterForm, enabled: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="filter-enabled">Enable this filter</Label>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowFilterForm(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleAddFilter}>
                  Add Filter
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
