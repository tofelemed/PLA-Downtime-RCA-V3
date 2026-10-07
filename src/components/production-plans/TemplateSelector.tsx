import React from 'react';
import { ProductionPlanTemplate } from '../../services/MasterDataService';
import { Check, FileText, Calendar, Package } from 'lucide-react';
import { formatDateRange } from '../../utils/dateFormatters';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type TemplateSelectorProps = {
  templates: ProductionPlanTemplate[];
  onSelect: (template: ProductionPlanTemplate) => void;
  onClose: () => void;
  isOpen: boolean;
};

const TemplateSelector: React.FC<TemplateSelectorProps> = ({ 
  templates, 
  onSelect, 
  onClose,
  isOpen
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <FileText className="w-5 h-5" />
            <span>Select Production Plan Template</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium mb-2">Available Templates</h3>
            <p className="text-sm text-muted-foreground">
              Choose a template to create a new production plan
            </p>
          </div>

          <div className="grid gap-4">
            {templates.map((template) => (
              <Card 
                key={template.id} 
                className="hover:shadow-md transition-shadow cursor-pointer border-2 hover:border-primary/20"
                onClick={() => onSelect(template)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div>
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                        <CardDescription className="flex items-center space-x-2">
                          <span>{template.planBasis}</span>
                          <span>•</span>
                          <span>{template.recurrence || 'Daily'}</span>
                          <span>•</span>
                          <span>v{template.version || 1}</span>
                        </CardDescription>
                      </div>
                      <Badge variant="secondary">
                        {template.productIds.length} product{template.productIds.length !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                    
                    <Button variant="outline" size="sm">
                      <Check className="w-4 h-4 mr-1" />
                      Use Template
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <span className="font-medium text-muted-foreground">Schedule:</span>
                        <p>{formatDateRange(template.startDate, template.endDate)}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Package className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <span className="font-medium text-muted-foreground">Data Entry:</span>
                        <p>{template.dataEntryFrequency || 'Daily'}</p>
                      </div>
                    </div>
                    <div>
                      <span className="font-medium text-muted-foreground">Description:</span>
                      <p className="text-muted-foreground">{template.description || 'No description available'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {templates.length === 0 && (
              <Card className="text-center py-12">
                <CardContent>
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">No templates available</h3>
                  <p className="text-sm text-muted-foreground">
                    Create a template first to use this feature
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TemplateSelector; 