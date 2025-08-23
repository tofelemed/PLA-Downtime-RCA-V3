import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { masterDataService, ProductionPlan, ProductionPlanTemplate, Unit, Product, UsefulProductionTime } from '../services/MasterDataService';
import TemplateManager from '../components/production-plans/TemplateManager';
import TemplateWizard from '../components/production-plans/TemplateWizard';
import TemplateSelector from '../components/production-plans/TemplateSelector';
import PlanForm from '../components/production-plans/PlanForm';
import PlanList from '../components/production-plans/PlanList';
import { PlanDashboard } from '../components/production-plans/PlanDashboard';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { usePlantSelection } from '../contexts/PlantSelectionContext';

// Time handling utilities
const HOURS = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
const MINUTES = ['00', '15', '30', '45'];
const AMPM = ['AM', 'PM'];

function parseTimeString(str: string) {
  if (!str) return { hour: '12', minute: '00', ampm: 'AM' };
  const [h, m] = str.split(':');
  let hour = parseInt(h, 10);
  let ampm = 'AM';
  if (hour === 0) { hour = 12; ampm = 'AM'; }
  else if (hour === 12) { ampm = 'PM'; }
  else if (hour > 12) { hour = hour - 12; ampm = 'PM'; }
  return { hour: hour.toString().padStart(2, '0'), minute: m || '00', ampm };
}

function to24Hour(hour: string, ampm: string) {
  let h = parseInt(hour, 10);
  if (ampm === 'AM' && h === 12) return '00';
  if (ampm === 'PM' && h !== 12) return (h + 12).toString().padStart(2, '0');
  return hour;
}

function buildTimeString(hour: string, minute: string, ampm: string) {
  return `${to24Hour(hour, ampm)}:${minute}`;
}

export const ProductionPlans: React.FC = () => {
  const { session } = useAuth();
  const { toast } = useToast();
  const { selection: plantSelection } = usePlantSelection();
  
  // State for plans
  const [plans, setPlans] = useState<ProductionPlan[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  
  // State for templates
  const [templates, setTemplates] = useState<ProductionPlanTemplate[]>([]);
  const [editTemplate, setEditTemplate] = useState<ProductionPlanTemplate | null>(null);
  const [wizardStep, setWizardStep] = useState(0);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [showTemplateWizard, setShowTemplateWizard] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  
  // State for plan creation
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [editPlan, setEditPlan] = useState<ProductionPlan | null>(null);
  
  // State for dashboard
  const [showDashboard, setShowDashboard] = useState(false);
  const [selectedPlanForDashboard, setSelectedPlanForDashboard] = useState<ProductionPlan | null>(null);

  useEffect(() => {
    loadData();
  }, [session]);

  const loadData = async () => {
    if (!session) return;

    try {
      const [plansData, templatesData, unitsData, productsData] = await Promise.all([
        masterDataService.getProductionPlans({ tenantId: session.tenant?.id }),
        masterDataService.getProductionPlanTemplates({ tenantId: session.tenant?.id }),
        masterDataService.getUnits({ tenantId: session.tenant?.id }),
        masterDataService.getProducts({ organizationId: session.organization?.id }),
      ]);

      setPlans(plansData);
      setTemplates(templatesData);
      setUnits(unitsData);
      setProducts(productsData);
    } catch (error) {
      console.error('Failed to load production data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load production data',
        variant: 'destructive',
      });
    }
  };

  // Template Management Functions
  const handleNewTemplate = () => {
    setEditTemplate(null);
    setWizardStep(0);
    setShowTemplateWizard(true);
  };

  const handleEditTemplate = (template: ProductionPlanTemplate) => {
    setEditTemplate(template);
    setWizardStep(0);
    setShowTemplateWizard(true);
  };

  const handleDeleteTemplate = async (id: string) => {
    const template = templates.find(t => t.id === id);
    const templateName = template?.name || 'this template';
    
    if (!window.confirm(`Are you sure you want to delete "${templateName}"? This action cannot be undone.`)) return;

    try {
      console.log('Deleting template:', id);
      await masterDataService.deleteProductionPlanTemplate(id);
      
      // Create audit log for template deletion
      if (session?.user && template) {
        await masterDataService.createAuditLog({
          userId: session.user.id,
          userName: session.user.name,
          action: 'Delete Production Plan Template',
          entityType: 'ProductionPlanTemplate',
          entityId: id,
          details: `Deleted template "${templateName}"`,
          organizationId: session.organization?.id || '',
          tenantId: session.tenant?.id || '',
          ipAddress: '',
          userAgent: '',
        });
      }
      
      toast({
        title: 'Success',
        description: `Template "${templateName}" deleted successfully`,
      });
      
      // Reload data to refresh the templates list
      await loadData();
    } catch (error) {
      console.error('Failed to delete template:', error);
      toast({
        title: 'Error',
        description: `Failed to delete template "${templateName}"`,
        variant: 'destructive',
      });
    }
  };

  const handleDuplicateTemplate = (template: ProductionPlanTemplate) => {
    const duplicateTemplate: ProductionPlanTemplate = {
      ...template,
      id: '', // Clear the ID to create a new template
      name: `${template.name} (Copy ${new Date().toLocaleDateString()})`,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setEditTemplate(duplicateTemplate);
    setWizardStep(0);
    setShowTemplateWizard(true);
  };

  const handleSaveTemplate = async (template: ProductionPlanTemplate) => {
    try {
      console.log('Saving template:', template);
      
      if (template.id && template.id.startsWith('template_')) {
        // This is a new template with a generated ID, create it
        const { id, ...templateData } = template;
        const savedTemplate = await masterDataService.createProductionPlanTemplate(templateData);
        console.log('Created new template:', savedTemplate);
        
        // Create audit log for new template
        if (session?.user) {
          await masterDataService.createAuditLog({
            userId: session.user.id,
            userName: session.user.name,
            action: 'Create Production Plan Template',
            entityType: 'ProductionPlanTemplate',
            entityId: savedTemplate.id,
            details: `Created template "${template.name}"`,
            organizationId: session.organization?.id || '',
            tenantId: session.tenant?.id || '',
            ipAddress: '',
            userAgent: '',
          });
        }
      } else if (template.id) {
        // This is an existing template, update it
        const savedTemplate = await masterDataService.updateProductionPlanTemplate(template.id, template);
        console.log('Updated template:', savedTemplate);
        
        // Create audit log for template update
        if (session?.user) {
          await masterDataService.createAuditLog({
            userId: session.user.id,
            userName: session.user.name,
            action: 'Update Production Plan Template',
            entityType: 'ProductionPlanTemplate',
            entityId: template.id,
            details: `Updated template "${template.name}"`,
            organizationId: session.organization?.id || '',
            tenantId: session.tenant?.id || '',
            ipAddress: '',
            userAgent: '',
          });
        }
      } else {
        // This is a new template without ID, create it
        const savedTemplate = await masterDataService.createProductionPlanTemplate(template);
        console.log('Created new template:', savedTemplate);
        
        // Create audit log for new template
        if (session?.user) {
          await masterDataService.createAuditLog({
            userId: session.user.id,
            userName: session.user.name,
            action: 'Create Production Plan Template',
            entityType: 'ProductionPlanTemplate',
            entityId: savedTemplate.id,
            details: `Created template "${template.name}"`,
            organizationId: session.organization?.id || '',
            tenantId: session.tenant?.id || '',
            ipAddress: '',
            userAgent: '',
          });
        }
      }
      
      setShowTemplateWizard(false);
      
      // Reload data to refresh the templates list
      await loadData();
      
      toast({
        title: 'Success',
        description: 'Template saved successfully',
      });
    } catch (error) {
      console.error('Failed to save template:', error);
      toast({
        title: 'Error',
        description: 'Failed to save template',
        variant: 'destructive',
      });
    }
  };

  // Plan Management Functions
  const handleNewPlan = () => {
    setEditPlan(null);
    setSelectedTemplateId(null);
    setShowPlanForm(true);
  };

  const handleEditPlan = (plan: ProductionPlan) => {
    // Try to find a matching template for this plan
    const matchingTemplate = templates.find(template => 
      template.unitId === plan.unitId && 
      template.productIds.includes(plan.productId)
    );
    setEditPlan(plan);
    setSelectedTemplateId(matchingTemplate ? matchingTemplate.id : null);
    setShowPlanForm(true);
  };

  const handleDeletePlan = async (id: string) => {
    if (!window.confirm('Delete this plan?')) return;

    try {
      // Get plan details before deletion for audit log
      const planToDelete = plans.find(p => p.id === id);
      
      await masterDataService.deleteProductionPlan(id);
      
      // Create audit log for plan deletion
      if (session?.user && planToDelete) {
        await masterDataService.createAuditLog({
          userId: session.user.id,
          userName: session.user.name,
          action: 'Delete Production Plan',
          entityType: 'ProductionPlan',
          entityId: id,
          details: `Deleted plan "${planToDelete.name}"`,
          organizationId: session.organization?.id || '',
          tenantId: session.tenant?.id || '',
          ipAddress: '',
          userAgent: '',
        });
      }
      
      toast({
        title: 'Success',
        description: 'Plan deleted successfully',
      });
      loadData();
    } catch (error) {
      console.error('Failed to delete plan:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete plan',
        variant: 'destructive',
      });
    }
  };

  const handleSavePlan = async (plan: ProductionPlan) => {
    try {
      console.log('Saving plan:', plan);
      
      if (plan.id && plan.id.startsWith('plan_')) {
        // This is a new plan with a generated ID, create it
        const { id, ...planData } = plan;
        const savedPlan = await masterDataService.createProductionPlan(planData);
        console.log('Created new plan:', savedPlan);
        
        // Create audit log for new plan
        if (session?.user) {
          await masterDataService.createAuditLog({
            userId: session.user.id,
            userName: session.user.name,
            action: 'Create Production Plan',
            entityType: 'ProductionPlan',
            entityId: savedPlan.id,
            details: `Created plan "${plan.name}"`,
            organizationId: session.organization?.id || '',
            tenantId: session.tenant?.id || '',
            ipAddress: '',
            userAgent: '',
          });
        }
      } else if (plan.id) {
        // This is an existing plan, update it
        const savedPlan = await masterDataService.updateProductionPlan(plan.id, plan);
        console.log('Updated plan:', savedPlan);
        
        // Create audit log for plan update
        if (session?.user) {
          await masterDataService.createAuditLog({
            userId: session.user.id,
            userName: session.user.name,
            action: 'Update Production Plan',
            entityType: 'ProductionPlan',
            entityId: plan.id,
            details: `Updated plan "${plan.name}"`,
            organizationId: session.organization?.id || '',
            tenantId: session.tenant?.id || '',
            ipAddress: '',
            userAgent: '',
          });
        }
      } else {
        // This is a new plan without ID, create it
        const savedPlan = await masterDataService.createProductionPlan(plan);
        console.log('Created new plan:', savedPlan);
        
        // Create audit log for new plan
        if (session?.user) {
          await masterDataService.createAuditLog({
            userId: session.user.id,
            userName: session.user.name,
            action: 'Create Production Plan',
            entityType: 'ProductionPlan',
            entityId: savedPlan.id,
            details: `Created plan "${plan.name}"`,
            organizationId: session.organization?.id || '',
            tenantId: session.tenant?.id || '',
            ipAddress: '',
            userAgent: '',
          });
        }
      }
      
      setShowPlanForm(false);
      
      // Reload data to refresh the plans list
      await loadData();
      
      toast({
        title: 'Success',
        description: 'Plan saved successfully',
      });
    } catch (error) {
      console.error('Failed to save plan:', error);
      toast({
        title: 'Error',
        description: 'Failed to save plan',
        variant: 'destructive',
      });
    }
  };

  // Template selector actions
  const handleUseTemplate = (template: ProductionPlanTemplate) => {
    // Calculate default planned quantity based on template
    const calculateDefaultQuantity = () => {
      if (!template.usefulProductionTime) return 0;
      
      let totalHours = 0;
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      
      days.forEach(day => {
        const daySchedule = template.usefulProductionTime[day];
        if (daySchedule?.start && daySchedule?.end) {
          const startHour = parseInt(daySchedule.start.split(':')[0]);
          const endHour = parseInt(daySchedule.end.split(':')[0]);
          const startMinute = parseInt(daySchedule.start.split(':')[1]);
          const endMinute = parseInt(daySchedule.end.split(':')[1]);
          
          let hours = endHour - startHour;
          let minutes = endMinute - startMinute;
          
          if (minutes < 0) {
            hours -= 1;
            minutes += 60;
          }
          
          totalHours += hours + (minutes / 60);
        }
      });
      
      // Assume 100 units per hour as default production rate
      return Math.round(totalHours * 100);
    };

    setEditPlan({
      id: '',
      name: `Plan from ${template.name}`,
      unitId: template.unitId,
      productId: template.productIds[0] || '',
      plannedQuantity: calculateDefaultQuantity(),
      toleranceLimit: 5,
      startDate: template.startDate,
      endDate: template.endDate,
      planBasis: template.planBasis,
      recurrence: template.recurrence,
      dataEntryFrequency: template.dataEntryFrequency || 'Daily',
      usefulProductionTime: template.usefulProductionTime,
      status: 'Planned',
      tenantId: session?.tenant?.id || '',
    } as ProductionPlan);
    setShowTemplateSelector(false);
    setShowPlanForm(true);
  };

  // Dashboard functions
  const handleViewDashboard = (plan: ProductionPlan) => {
    setSelectedPlanForDashboard(plan);
    setShowDashboard(true);
  };

  const handleCloseDashboard = () => {
    setShowDashboard(false);
    setSelectedPlanForDashboard(null);
  };

  if (!session) return null;

  // Filter by selected unit
  const selectedUnitId = plantSelection?.unit?.id;
  const filteredPlans = selectedUnitId ? plans.filter(p => p.unitId === selectedUnitId) : [];
  const filteredTemplates = selectedUnitId ? templates.filter(t => t.unitId === selectedUnitId) : [];

  // Show dashboard if selected
  if (showDashboard && selectedPlanForDashboard) {
    return (
      <PlanDashboard 
        plan={selectedPlanForDashboard} 
        onClose={handleCloseDashboard} 
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Production Plans</h2>
          <p className="text-muted-foreground">
            Manage production plans and templates
          </p>
        </div>
        
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => setShowTemplateManager(true)}>
            Manage Templates
          </Button>
          <Button variant="outline" onClick={() => setShowTemplateSelector(true)}>
            Create from Template
          </Button>
          <Button onClick={handleNewPlan}>
            Create Plan
          </Button>
        </div>
      </div>

      <PlanList 
        plans={filteredPlans} 
        units={units} 
        products={products} 
        onNewPlan={handleNewPlan}
        onEditPlan={handleEditPlan} 
        onDeletePlan={handleDeletePlan}
        onViewPlan={handleEditPlan}
        onViewDashboard={handleViewDashboard}
      />

      {/* Template Manager Modal */}
      <TemplateManager
        templates={filteredTemplates}
        onEdit={handleEditTemplate}
        onDelete={handleDeleteTemplate}
        onDuplicate={handleDuplicateTemplate}
        onNew={handleNewTemplate}
        onClose={() => setShowTemplateManager(false)}
        isOpen={showTemplateManager}
      />

      {/* Template Wizard Modal */}
      <TemplateWizard
        isOpen={showTemplateWizard}
        onClose={() => setShowTemplateWizard(false)}
        onSave={handleSaveTemplate}
        initialTemplate={editTemplate || undefined}
        units={units}
        products={products}
      />

      {/* Template Selector Modal */}
      <TemplateSelector
        templates={filteredTemplates}
        onSelect={handleUseTemplate}
        onClose={() => setShowTemplateSelector(false)}
        isOpen={showTemplateSelector}
      />

      {/* Plan Form Modal */}
      <PlanForm
        isOpen={showPlanForm}
        onClose={() => setShowPlanForm(false)}
        onSave={handleSavePlan}
        template={selectedTemplateId ? templates.find(t => t.id === selectedTemplateId) : undefined}
        units={units}
        products={products}
        initialPlan={editPlan || undefined}
      />
    </div>
  );
};

export default ProductionPlans; 