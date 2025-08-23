import React, { useState, useMemo } from 'react';
import { ProductionPlanTemplate } from '../../services/MasterDataService';
import { Plus, Edit, Trash2, Copy, FileText, Search, Filter, Calendar, Package, Clock, Users, Settings } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type TemplateManagerProps = {
  templates: ProductionPlanTemplate[];
  onEdit: (template: ProductionPlanTemplate) => void;
  onDelete: (id: string) => void;
  onDuplicate: (template: ProductionPlanTemplate) => void;
  onNew: () => void;
  onClose: () => void;
  isOpen: boolean;
};

const TemplateManager: React.FC<TemplateManagerProps> = ({ 
  templates, 
  onEdit, 
  onDelete, 
  onDuplicate, 
  onNew,
  onClose,
  isOpen
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBasis, setFilterBasis] = useState('all');

  const filteredTemplates = useMemo(() => {
    return templates.filter(template => {
      const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           template.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           template.planBasis.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesFilter = filterBasis === 'all' || template.planBasis === filterBasis;
      
      return matchesSearch && matchesFilter;
    });
  }, [templates, searchQuery, filterBasis]);

  const planBasisOptions = useMemo(() => {
    const bases = [...new Set(templates.map(t => t.planBasis))];
    return bases;
  }, [templates]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Production Templates</h2>
                <p className="text-sm text-gray-600">Manage and organize your production plan templates</p>
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col flex-1 min-h-0">
          {/* Header with Stats and Actions */}
          <div className="flex justify-between items-center mb-6 flex-shrink-0">
            <div className="flex items-center space-x-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{templates.length}</div>
                <div className="text-xs text-gray-500">Total Templates</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{filteredTemplates.length}</div>
                <div className="text-xs text-gray-500">Filtered</div>
              </div>
            </div>
            
            <Button onClick={onNew} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg">
              <Plus className="w-4 h-4 mr-2" />
              Create Template
            </Button>
          </div>

          {/* Search and Filter Bar */}
          <div className="flex space-x-4 mb-6 flex-shrink-0">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search templates by name, description, or plan basis..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            
            <Select value={filterBasis} onValueChange={setFilterBasis}>
              <SelectTrigger className="w-48 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by basis" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Plan Bases</SelectItem>
                {planBasisOptions.map(basis => (
                  <SelectItem key={basis} value={basis}>{basis}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Templates Grid */}
          <div className="flex-1 overflow-y-auto">
            {filteredTemplates.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTemplates.map((template) => (
                  <Card key={template.id} className="group hover:shadow-xl transition-all duration-300 border-0 bg-gradient-to-br from-white to-gray-50 hover:from-blue-50 hover:to-indigo-50">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-lg font-semibold text-gray-900 group-hover:text-blue-700 transition-colors truncate">
                            {template.name}
                          </CardTitle>
                          <CardDescription className="text-sm text-gray-600 mt-1 line-clamp-2">
                            {template.description || 'No description provided'}
                          </CardDescription>
                        </div>
                        <Badge 
                          variant="secondary" 
                          className="ml-2 bg-gradient-to-r from-blue-100 to-purple-100 text-blue-800 border-blue-200"
                        >
                          v{template.version || 1}
                        </Badge>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="space-y-4">
                      {/* Template Stats */}
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center space-x-2">
                          <Package className="w-4 h-4 text-blue-500" />
                          <span className="text-gray-600">{template.productIds.length} products</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-4 h-4 text-green-500" />
                          <span className="text-gray-600">{template.recurrence || 'Daily'}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Clock className="w-4 h-4 text-purple-500" />
                          <span className="text-gray-600">{template.dataEntryFrequency || 'Daily'}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Settings className="w-4 h-4 text-orange-500" />
                          <span className="text-gray-600">{template.planBasis}</span>
                        </div>
                      </div>

                      {/* Schedule Info */}
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <div className="text-xs text-gray-500 mb-1">Schedule Period</div>
                        <div className="text-sm font-medium text-gray-900">
                          {template.startDate} → {template.endDate}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex space-x-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onDuplicate(template)}
                          className="flex-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200"
                        >
                          <Copy className="w-3 h-3 mr-1" />
                          Duplicate
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onEdit(template)}
                          className="flex-1 text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
                        >
                          <Edit className="w-3 h-3 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onDelete(template.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="text-center py-16 border-0 bg-gradient-to-br from-gray-50 to-blue-50">
                <CardContent>
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <FileText className="w-10 h-10 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    {searchQuery || filterBasis !== 'all' ? 'No templates found' : 'No templates yet'}
                  </h3>
                  <p className="text-gray-600 mb-6 max-w-md mx-auto">
                    {searchQuery || filterBasis !== 'all' 
                      ? 'Try adjusting your search or filter criteria'
                      : 'Create your first production plan template to get started with efficient planning'
                    }
                  </p>
                  <Button onClick={onNew} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Template
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TemplateManager; 