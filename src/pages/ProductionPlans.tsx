import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { masterDataService, ProductionPlan, ProductionPlanTemplate, Unit, Product, UsefulProductionTime } from '../services/MasterDataService';
import { auditService } from '../services/AuditService';
import TemplateManager from '../components/production-plans/TemplateManager';
import TemplateWizard from '../components/production-plans/TemplateWizard';
import TemplateSelector from '../components/production-plans/TemplateSelector';
import PlanForm from '../components/production-plans/PlanForm';
import PlanList from '../components/production-plans/PlanList';
import { PlanDashboardSwitch } from '@/features/plan-dashboard/plan-dashboard-switch';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { usePlantSelection } from '../contexts/PlantSelectionContext';
import { PlanningLinkBanner } from '@/features/plans-profiles-calendars/legacy/planning-link-banner';

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
  }, [session, plantSelection?.tenant?.id]);

  const loadData = async () => {
    if (!session) return;
    
    // Use plant selection tenant if available, otherwise fall back to session tenant
    const tenantId = plantSelection?.tenant?.id || session.tenant?.id;

    try {
      const [plansData, templatesData, unitsData, productsData] = await Promise.all([
        masterDataService.getProductionPlans({ tenantId }),
        masterDataService.getProductionPlanTemplates({ tenantId }),
        masterDataService.getUnits(), // Load all units without filtering
        masterDataService.getProducts(),
      ]);

      setPlans(plansData);
      setTemplates(templatesData);
      setUnits(unitsData);
      setProducts(productsData);
      
      console.log('ProductionPlans Debug:', {
        tenantId: session.tenant?.id,
        unitsDataLength: unitsData.length,
        unitsData: unitsData.map(u => ({ id: u.id, name: u.name })),
        plansDataLength: plansData.length,
        plansData: plansData.map(p => ({ id: p.id, name: p.name, unitId: p.unitId }))
      });
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
        await auditService.logAction({
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
          await auditService.logAction({
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
          await auditService.logAction({
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
          await auditService.logAction({
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
        await auditService.logAction({
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
          await auditService.logAction({
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
          await auditService.logAction({
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
          await auditService.logAction({
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
    setEditPlan({
      id: '',
      name: `Plan from ${template.name}`,
      unitId: template.unitId,
      productId: template.productIds[0] || '',
      // no default quantity (no 100 units / h): targets come from rates — v2 plan preview (plan 3.4)
      plannedQuantity: 0,
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

  const handlePlanUpdate = (updatedPlan: ProductionPlan) => {
    // Update the selected plan for dashboard
    setSelectedPlanForDashboard(updatedPlan);
    
    // Update the plans list to reflect the change
    setPlans(prevPlans => 
      prevPlans.map(plan => 
        plan.id === updatedPlan.id ? updatedPlan : plan
      )
    );
  };

  if (!session) return null;

  // Filter by selected unit - show all plans if only plant is selected
  const selectedUnitId = plantSelection?.unit?.id;
  const filteredPlans = selectedUnitId ? plans.filter(p => p.unitId === selectedUnitId) : plans;
  const filteredTemplates = selectedUnitId ? templates.filter(t => t.unitId === selectedUnitId) : templates;

  // Show dashboard if selected
  if (showDashboard && selectedPlanForDashboard) {
    return (
      <PlanDashboardSwitch
        plan={selectedPlanForDashboard} 
        onClose={handleCloseDashboard}
        onPlanUpdate={handlePlanUpdate}
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
          <PlanningLinkBanner />
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