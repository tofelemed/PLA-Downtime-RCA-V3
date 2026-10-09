import React, { useState, useEffect } from 'react';
import { ProductionPlanTemplate, Unit, Product } from '../../services/MasterDataService';
import { useAuth } from '../../contexts/AuthContext';
import { ChevronLeft, ChevronRight, Check, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

// Import step components
import StepName from './template-wizard-steps/StepName';
import StepPlanBasis from './template-wizard-steps/StepPlanBasis';
import StepProducts from './template-wizard-steps/StepProducts';
import StepUnit from './template-wizard-steps/StepUnit';
import StepProductionTime from './template-wizard-steps/StepProductionTime';
import StepSchedule from './template-wizard-steps/StepSchedule';
import StepReview from './template-wizard-steps/StepReview';
import { StepCalendar } from '@/features/plans-profiles-calendars/template/step-calendar';
import { useFlag } from '@/api/v2/queries/feature-flags';

type TemplateWizardProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (template: ProductionPlanTemplate) => void;
  initialTemplate?: ProductionPlanTemplate;
  units?: Unit[];
  products?: Product[];
};

const steps = [
  { id: 'name', title: 'Template Name', component: StepName },
  { id: 'planBasis', title: 'Plan Basis', component: StepPlanBasis },
  { id: 'products', title: 'Products', component: StepProducts },
  { id: 'unit', title: 'Production Unit', component: StepUnit },
  { id: 'productionTime', title: 'Production Time', component: StepProductionTime },
  { id: 'schedule', title: 'Schedule', component: StepSchedule },
  { id: 'review', title: 'Review', component: StepReview },
];
// v2.plansProfilesCalendars: the production-time step becomes the unit's published calendar (plan 3.4)
const calendarSteps = steps.map((step) => (step.id === 'productionTime' ? { ...step, title: 'Calendar', component: StepCalendar } : step));

// Step validation logic
const isStepValid = (stepIdx, template) => {
  switch (steps[stepIdx].id) {
    case 'name':
      return !!template.name;
    case 'planBasis':
      return !!template.planBasis;
    case 'products':
      return Array.isArray(template.productIds) && template.productIds.length > 0;
    case 'unit':
      return !!template.unitId;
    case 'productionTime':
      return true; // Add more validation if needed
    case 'schedule':
      return !!template.startDate && !!template.endDate;
    case 'review':
      return true;
    default:
      return true;
  }
};

const getInitialTemplate = (session, initialTemplate) =>
  initialTemplate || {
    id: '',
    name: '',
    description: '',
    planBasis: '',
    productIds: [],
    unitId: '',
    recurrence: 'Daily',
    dataEntryFrequency: 'Daily',
    startDate: '',
    endDate: '',
    usefulProductionTime: {},
    version: 1,
    organizationId: session?.organization?.id || '',
    tenantId: session?.tenant?.id || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

const TemplateWizard: React.FC<TemplateWizardProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  initialTemplate,
  units = [],
  products = []
}) => {
  const { session } = useAuth();
  const activeSteps = useFlag('v2.plansProfilesCalendars').enabled ? calendarSteps : steps;
  const [currentStep, setCurrentStep] = useState(0);
  const [template, setTemplate] = useState<Partial<ProductionPlanTemplate>>(
    getInitialTemplate(session, initialTemplate)
  );

  // Reset form and step on modal close
  const handleDialogChange = (open: boolean) => {
    if (!open) {
      setTemplate(getInitialTemplate(session, initialTemplate));
      setCurrentStep(0);
      onClose();
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1 && isStepValid(currentStep, template)) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleStepUpdate = (updates: Partial<ProductionPlanTemplate>) => {
    setTemplate(prev => ({ ...prev, ...updates }));
  };

  const handleSave = () => {
    if (template.name && template.planBasis && template.unitId && template.productIds && template.productIds.length > 0) {
      // Generate a new ID for new templates
      const templateToSave: ProductionPlanTemplate = {
        ...template,
        id: template.id || `template_${Date.now()}`,
        tenantId: template.tenantId || session?.tenant?.id || 'default-tenant',
        organizationId: template.organizationId || session?.organization?.id || 'default-org',
        createdAt: template.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as ProductionPlanTemplate;
      
      onSave(templateToSave);
      handleDialogChange(false); // Close and reset
    }
  };

  const CurrentStepComponent = activeSteps[currentStep].component;
  const progress = ((currentStep + 1) / steps.length) * 100;

  useEffect(() => {
    if (session) {
      setTemplate(prev => ({
        ...prev,
        organizationId: session.organization?.id || '',
        tenantId: session.tenant?.id || '',
      }));
    }
  }, [session]);

  // Handle initialTemplate changes (for editing)
  useEffect(() => {
    if (initialTemplate) {
      setTemplate(initialTemplate);
      setCurrentStep(0); // Reset to first step when editing
    } else {
      setTemplate(getInitialTemplate(session, initialTemplate));
      setCurrentStep(0);
    }
  }, [initialTemplate, session]);

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] flex flex-col">
        <DialogHeader className="pb-4 flex-shrink-0">
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span>Production Plan Template Wizard</span>
              {initialTemplate && (
                <span className="text-sm text-muted-foreground">
                  (Editing: {initialTemplate.name})
                </span>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col flex-1 min-h-0">
          {/* Progress Bar - Static */}
          <div className="space-y-1 flex-shrink-0 mb-4">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Step {currentStep + 1} of {steps.length}</span>
              <span>{Math.round(progress)}% Complete</span>
            </div>
            <Progress value={progress} className="w-full h-2" />
          </div>

          {/* Step Navigation - Static */}
          <div className="flex items-center justify-between flex-shrink-0 mb-4">
            <div className="flex space-x-1">
              {activeSteps.map((step, index) => (
                <div
                  key={step.id}
                  className={`flex items-center space-x-1 px-2 py-1 rounded text-xs ${
                    index === currentStep
                      ? 'bg-primary text-primary-foreground'
                      : index < currentStep
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <span className="w-4 h-4 rounded-full flex items-center justify-center text-xs font-medium">
                    {index < currentStep ? (
                      <Check className="w-2 h-2" />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span className="hidden sm:inline">{step.title}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Step Content - Scrollable */}
          <div className="flex-1 overflow-y-auto">
            <Card className="border-0 h-full">
              <CardContent className="p-4 h-full">
                <CurrentStepComponent
                  template={template}
                  onUpdate={handleStepUpdate}
                  units={units}
                  products={products}
                />
              </CardContent>
            </Card>
          </div>

          {/* Navigation Buttons - Static */}
          <div className="flex justify-between pt-4 flex-shrink-0 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className="flex items-center space-x-1"
            >
              <ChevronLeft className="w-3 h-3" />
              <span>Previous</span>
            </Button>

            <div className="flex space-x-2">
              <Button variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
              
              {currentStep === steps.length - 1 ? (
                <Button 
                  size="sm"
                  onClick={handleSave}
                  disabled={!template.name || !template.planBasis || !template.unitId || !template.productIds || template.productIds.length === 0}
                  className="flex items-center space-x-1"
                >
                  <Check className="w-3 h-3" />
                  <span>Save Template</span>
                </Button>
              ) : (
                <Button 
                  size="sm"
                  onClick={handleNext}
                  disabled={!isStepValid(currentStep, template) || currentStep === steps.length - 1}
                  className="flex items-center space-x-1"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TemplateWizard; 