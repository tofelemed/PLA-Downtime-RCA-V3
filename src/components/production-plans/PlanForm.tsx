import React, { useState, useEffect } from 'react';
import { ProductionPlan, ProductionPlanTemplate, Unit, Product, ProductionEvent } from '../../services/MasterDataService';
import { useAuth } from '../../contexts/AuthContext';
import { usePlantSelection } from '../../contexts/PlantSelectionContext';
import { Calendar, Package, Clock, Target, FileText, MessageSquare, CheckCircle, XCircle, User, Send, AlertCircle, Shield } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { PlanApprovalWorkflow } from './PlanApprovalWorkflow';
import { masterDataService } from '../../services/MasterDataService';

// Utility function to format time display
const formatTimeDisplay = (timeString: string): string => {
  if (!timeString) return '';
  
  // Handle potential data corruption or invalid formats
  const timeMatch = timeString.match(/^(\d{1,2}):(\d{2})$/);
  if (!timeMatch) {
    // Try to fix common issues
    const cleaned = timeString.replace(/[^0-9:]/g, '');
    const parts = cleaned.split(':');
    if (parts.length === 2) {
      const hours = parseInt(parts[0]) % 24;
      const minutes = parseInt(parts[1]) % 60;
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
    return '00:00'; // fallback
  }
  
  const hours = parseInt(timeMatch[1]);
  const minutes = parseInt(timeMatch[2]);
  
  // Ensure valid time range
  const validHours = Math.max(0, Math.min(23, hours));
  const validMinutes = Math.max(0, Math.min(59, minutes));
  
  return `${validHours.toString().padStart(2, '0')}:${validMinutes.toString().padStart(2, '0')}`;
};

// Utility function to sanitize time data
const sanitizeTimeData = (usefulProductionTime: any): any => {
  if (!usefulProductionTime) return usefulProductionTime;
  
  const sanitized = {};
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  days.forEach(day => {
    const daySchedule = usefulProductionTime[day];
    if (daySchedule?.start && daySchedule?.end) {
      // Check if the times look corrupted (like "05:04", "06:04")
      const startHour = parseInt(daySchedule.start.split(':')[0]);
      const startMinute = parseInt(daySchedule.start.split(':')[1]);
      const endHour = parseInt(daySchedule.end.split(':')[0]);
      const endMinute = parseInt(daySchedule.end.split(':')[1]);
      
      // If minutes are > 59 or hours are > 23, or if the times look suspicious
      const isCorrupted = startMinute > 59 || endMinute > 59 || startHour > 23 || endHour > 23 ||
                         (startMinute > 0 && startMinute % 4 === 0) || (endMinute > 0 && endMinute % 4 === 0);
      
      if (isCorrupted) {
        // Replace with sensible defaults
        sanitized[day] = { start: '08:00', end: '16:00' };
        console.log(`Sanitized corrupted time for ${day}: ${daySchedule.start}-${daySchedule.end} → 08:00-16:00`);
      } else {
        sanitized[day] = daySchedule;
      }
    } else if (daySchedule?.start || daySchedule?.end) {
      // Partial data, remove it
      console.log(`Removed partial time data for ${day}: ${daySchedule.start || 'N/A'}-${daySchedule.end || 'N/A'}`);
    }
  });
  
  return sanitized;
};

type PlanFormProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (plan: ProductionPlan) => void;
  template?: ProductionPlanTemplate;
  units: Unit[];
  products: Product[];
  initialPlan?: ProductionPlan;
};

const PlanForm: React.FC<PlanFormProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  template, 
  units, 
  products,
  initialPlan 
}) => {
  const { session } = useAuth();
  const { selection: plantSelection } = usePlantSelection();
  const [plan, setPlan] = useState<Partial<ProductionPlan>>(
    initialPlan || {
      id: '',
      name: '',
      unitId: template?.unitId || '',
      productId: template?.productIds?.[0] || '',
      plannedQuantity: 0,
      toleranceLimit: 5,
      startDate: '',
      endDate: '',
      status: 'Planned',
      actualQuantity: 0,
      organizationId: session?.organization?.id || '',
      tenantId: plantSelection?.tenant?.id || session?.tenant?.id || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      shift: '',
      crew: '',
      plannerNotes: '',
      comments: [],
      approvalStatus: 'Draft',
      customAttributes: {},
    }
  );
  const [originalPlan, setOriginalPlan] = useState<Partial<ProductionPlan> | null>(initialPlan);
  const [outputEvents, setOutputEvents] = useState<ProductionEvent[]>([]);
  const [newComment, setNewComment] = useState('');
  const [commentType, setCommentType] = useState<'Note' | 'Comment' | 'Approval' | 'Rejection'>('Comment');
  const [showApprovalWorkflow, setShowApprovalWorkflow] = useState(false);

  // Update plan state when initialPlan changes
  useEffect(() => {
    if (initialPlan) {
      setPlan(initialPlan);
      setOriginalPlan(initialPlan);
    }
  }, [initialPlan]);

  useEffect(() => {
    if (template && !initialPlan) {
      setPlan(prev => ({
        ...prev,
        unitId: template.unitId,
        productId: template.productIds?.[0] || '',
        name: `${template.name} Plan`,
        planBasis: template.planBasis,
        recurrence: template.recurrence,
        dataEntryFrequency: template.dataEntryFrequency,
        usefulProductionTime: template.usefulProductionTime,
        startDate: template.startDate,
        endDate: template.endDate,
        // Calculate default planned quantity based on template
        plannedQuantity: calculateDefaultPlannedQuantity(template),
      }));
    } else if (template && initialPlan) {
      // When editing a plan with a matching template, merge template data only for missing fields
      setPlan(prev => ({
        ...prev,
        planBasis: prev.planBasis || template.planBasis,
        recurrence: prev.recurrence || template.recurrence,
        dataEntryFrequency: prev.dataEntryFrequency || template.dataEntryFrequency,
        usefulProductionTime: prev.usefulProductionTime || template.usefulProductionTime,
      }));
    }
  }, [template, initialPlan]);

  // Calculate default planned quantity based on template settings
  const calculateDefaultPlannedQuantity = (template: ProductionPlanTemplate): number => {
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
    // This could be enhanced with actual production rates from the unit/product
    return Math.round(totalHours * 100);
  };

  useEffect(() => {
    if (session) {
      setPlan(prev => ({
        ...prev,
        organizationId: session.organization?.id || '',
        tenantId: plantSelection?.tenant?.id || session.tenant?.id || '',
      }));
    }
  }, [session, plantSelection?.tenant?.id]);

  useEffect(() => {
    // Reset form state when opening for creation (no initialPlan)
    if (isOpen && !initialPlan) {
      setPlan({
        id: '',
        name: '',
        unitId: template?.unitId || '',
        productId: template?.productIds?.[0] || '',
        plannedQuantity: 0,
        toleranceLimit: 5,
        startDate: '',
        endDate: '',
        status: 'Planned',
        actualQuantity: 0,
        organizationId: session?.organization?.id || '',
        tenantId: plantSelection?.tenant?.id || session?.tenant?.id || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        shift: '',
        crew: '',
        plannerNotes: '',
        comments: [],
        approvalStatus: 'Draft',
        customAttributes: {},
      });
    }
  }, [isOpen, initialPlan, template, session]);

  useEffect(() => {
    async function fetchOutputEvents() {
      if (!plan.id) return;
      const events = await masterDataService.getProductionEvents();
      setOutputEvents(events.filter(e => e.planId === plan.id && e.eventType === 'ProductionOutput'));
    }
    fetchOutputEvents();
  }, [plan.id]);

  const autoActualQuantity = outputEvents.reduce((sum, e) => sum + (e.quantity || 0), 0);

  const handleAddComment = () => {
    if (!newComment.trim() || !session?.user) return;
    
    const comment = {
      id: Math.random().toString(36).substr(2, 9),
      userId: session.user.id,
      userName: session.user.name,
      text: newComment.trim(),
      timestamp: new Date().toISOString(),
      type: commentType,
    };
    
    setPlan(prev => ({
      ...prev,
      comments: [...(prev.comments || []), comment]
    }));
    setNewComment('');
  };

  const handleDeleteComment = (commentId: string) => {
    setPlan(prev => ({
      ...prev,
      comments: (prev.comments || []).filter(c => c.id !== commentId)
    }));
  };

  const handleApprovalAction = (action: 'submit' | 'review' | 'approve' | 'reject', comment?: string) => {
    if (!session?.user) return;
    
    const now = new Date().toISOString();
    const updates: Partial<ProductionPlan> = {};
    
    switch (action) {
      case 'submit':
        updates.approvalStatus = 'Pending Review';
        updates.submittedBy = session.user.id;
        updates.submittedAt = now;
        break;
      case 'review':
        updates.approvalStatus = 'Pending Approval';
        updates.reviewedBy = session.user.id;
        updates.reviewedAt = now;
        break;
      case 'approve':
        updates.approvalStatus = 'Approved';
        updates.approvedBy = session.user.id;
        updates.approvedAt = now;
        break;
      case 'reject':
        updates.approvalStatus = 'Rejected';
        updates.rejectionReason = comment || newComment.trim();
        break;
    }
    
    setPlan(prev => ({ ...prev, ...updates }));
  };

  const handleSave = () => {
    if (plan.name && plan.unitId && plan.startDate && plan.endDate) {
      // Track changes for audit trail
      const changes: { field: string; oldValue: any; newValue: any }[] = [];
      
      if (originalPlan && initialPlan) {
        // This is an update - track changes
        const fieldsToTrack = [
          'name', 'unitId', 'productId', 'plannedQuantity', 'toleranceLimit', 
          'startDate', 'endDate', 'status', 'actualQuantity', 'shift', 'crew', 
          'plannerNotes', 'approvalStatus'
        ];
        
        fieldsToTrack.forEach(field => {
          const oldValue = originalPlan[field as keyof ProductionPlan];
          const newValue = plan[field as keyof ProductionPlan];
          
          if (oldValue !== newValue) {
            changes.push({
              field,
              oldValue: oldValue !== undefined ? oldValue : null,
              newValue: newValue !== undefined ? newValue : null
            });
          }
        });
      }
      
      // Create audit trail entry if there are changes
      let updatedAuditTrail = plan.auditTrail || [];
      if (changes.length > 0 && session?.user) {
        const auditEntry = {
          timestamp: new Date().toISOString(),
          userId: session.user.id,
          userName: session.user.name,
          changes
        };
        updatedAuditTrail = [...updatedAuditTrail, auditEntry];
      }
      
      const planToSave: ProductionPlan = {
        ...plan,
        tenantId: plan.tenantId || plantSelection?.tenant?.id || session?.tenant?.id || 'default-tenant',
        organizationId: plan.organizationId || session?.organization?.id || 'default-org',
        createdAt: plan.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        shift: plan.shift || '',
        crew: plan.crew || '',
        plannerNotes: plan.plannerNotes || '',
        comments: plan.comments || [],
        approvalStatus: plan.approvalStatus || 'Draft',
        customAttributes: plan.customAttributes || {},
        auditTrail: updatedAuditTrail,
      } as ProductionPlan;
      
      console.log('PlanForm: Saving plan:', planToSave);
      onSave(planToSave);
      onClose();
    }
  };

  const selectedUnit = units.find(u => u.id === plan.unitId);
  const selectedProduct = products.find(p => p.id === plan.productId);

  // Debug logging
  console.log('PlanForm Debug:', {
    initialPlan,
    template,
    plan,
    selectedUnit,
    selectedProduct
  });

  // Debug logging for template time data (only if there are issues)
  if (template?.usefulProductionTime && process.env.NODE_ENV === 'development') {
    console.log('Template Time Data Debug:', {
      templateName: template.name,
      usefulProductionTime: template.usefulProductionTime
    });
  }
  if (initialPlan?.usefulProductionTime && process.env.NODE_ENV === 'development') {
    console.log('Plan Time Data Debug:', {
      planName: initialPlan.name,
      usefulProductionTime: initialPlan.usefulProductionTime
    });
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl min-h-[600px] max-h-[95vh] overflow-y-auto bg-gradient-to-br from-white via-blue-50/80 to-purple-50/80 border border-blue-200 shadow-2xl rounded-2xl" key={plan.id || 'new-plan'}>
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Target className="w-5 h-5" />
            <span>{initialPlan ? 'Edit Production Plan' : 'Create Production Plan'}</span>
          </DialogTitle>
          <DialogDescription>
            {initialPlan ? 'Modify the production plan settings and configuration' : 'Create a new production plan with detailed configuration'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Approval Status Badge */}
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-blue-50 border border-gray-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-700">Approval Status:</span>
              <Badge 
                variant={
                  plan.approvalStatus === 'Approved' ? 'default' :
                  plan.approvalStatus === 'Rejected' ? 'destructive' :
                  plan.approvalStatus === 'Pending Review' || plan.approvalStatus === 'Pending Approval' ? 'secondary' :
                  'outline'
                }
                className={
                  plan.approvalStatus === 'Approved' ? 'bg-green-100 text-green-800 border-green-200' :
                  plan.approvalStatus === 'Rejected' ? 'bg-red-100 text-red-800 border-red-200' :
                  plan.approvalStatus === 'Pending Review' || plan.approvalStatus === 'Pending Approval' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                  'bg-gray-100 text-gray-800 border-gray-200'
                }
              >
                {plan.approvalStatus === 'Approved' && <CheckCircle className="w-3 h-3 mr-1" />}
                {plan.approvalStatus === 'Rejected' && <XCircle className="w-3 h-3 mr-1" />}
                {plan.approvalStatus === 'Pending Review' || plan.approvalStatus === 'Pending Approval' ? <AlertCircle className="w-3 h-3 mr-1" /> : null}
                {plan.approvalStatus}
              </Badge>
            </div>
            
            {/* Approval Workflow Actions */}
            {session?.user && (
              <div className="flex items-center space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowApprovalWorkflow(true)}
                  className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200 text-purple-700 hover:from-purple-100 hover:to-blue-100"
                >
                  <Shield className="w-3 h-3 mr-1" />
                  Approval Workflow
                </Button>
                {plan.approvalStatus === 'Draft' && (
                  <Button
                    size="sm"
                    onClick={() => handleApprovalAction('submit')}
                    className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white"
                  >
                    <Send className="w-3 h-3 mr-1" />
                    Submit for Review
                  </Button>
                )}
                {plan.approvalStatus === 'Pending Review' && ['SuperAdmin', 'OrgAdmin', 'TenantAdmin', 'Analyst', 'Engineer'].includes(session.user.role) && (
                  <Button
                    size="sm"
                    onClick={() => handleApprovalAction('review')}
                    className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white"
                  >
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Review & Approve
                  </Button>
                )}
                {plan.approvalStatus === 'Pending Approval' && ['SuperAdmin', 'OrgAdmin', 'TenantAdmin', 'Analyst', 'Engineer'].includes(session.user.role) && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => handleApprovalAction('approve')}
                      className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white"
                    >
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleApprovalAction('reject')}
                    >
                      <XCircle className="w-3 h-3 mr-1" />
                      Reject
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Template Info - Show only if template prop is provided */}
          {template && (
            <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>
                    {initialPlan ? `Editing Plan with Template: ${template.name}` : `Based on Template: ${template.name}`}
                  </span>
                </CardTitle>
                <CardDescription>
                  {template?.description || 'Plan created from template with advanced configuration'}
                </CardDescription>
                <div className="mt-2 text-xs text-blue-700">
                  You can override any field below. Changes here do not affect the template.
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-blue-800">Plan Basis:</span>
                    <p className="text-blue-700">{template?.planBasis || initialPlan?.planBasis || 'Not specified'}</p>
                  </div>
                  <div>
                    <span className="font-medium text-blue-800">Recurrence:</span>
                    <p className="text-blue-700">{template?.recurrence || initialPlan?.recurrence || 'Daily'}</p>
                  </div>
                  <div>
                    <span className="font-medium text-blue-800">Data Entry:</span>
                    <p className="text-blue-700">{template?.dataEntryFrequency || initialPlan?.dataEntryFrequency || 'Daily'}</p>
                  </div>
                  <div>
                    <span className="font-medium text-blue-800">Products:</span>
                    <p className="text-blue-700">
                      {template ? 
                        (initialPlan ? 'Single product plan' : `${template.productIds.length} selected`) : 
                        'Single product plan'
                      }
                    </p>
                  </div>
                </div>
                
                {/* Production Schedule Summary */}
                {(template?.usefulProductionTime || initialPlan?.usefulProductionTime) && (
                  <div className="mt-3 p-3 bg-blue-100 rounded-lg">
                    <h4 className="text-xs font-medium text-blue-800 mb-2">Production Schedule</h4>
                    <div className="grid grid-cols-7 gap-1 text-xs">
                      {(() => {
                        // Sanitize the time data once, outside the map
                        const sanitizedTemplateTime = template?.usefulProductionTime ? sanitizeTimeData(template.usefulProductionTime) : null;
                        const sanitizedPlanTime = initialPlan?.usefulProductionTime ? sanitizeTimeData(initialPlan.usefulProductionTime) : null;
                        
                        return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => {
                          const dayName = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][index];
                          const schedule = sanitizedTemplateTime?.[dayName] || sanitizedPlanTime?.[dayName];
                          
                          return (
                            <div key={day} className="text-center">
                              <div className="font-medium text-blue-800">{day}</div>
                              {schedule?.start && schedule?.end ? (
                                <div className="text-blue-600">
                                  {formatTimeDisplay(schedule.start)}-{formatTimeDisplay(schedule.end)}
                                </div>
                              ) : (
                                <div className="text-gray-400">Off</div>
                              )}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Plan Details */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Plan Name *</Label>
                <Input
                  id="name"
                  key={`name-${plan.id}`}
                  value={plan.name || ''}
                  onChange={(e) => setPlan(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter plan name"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select 
                  value={plan.status || 'Planned'} 
                  onValueChange={(value: 'Planned' | 'Active' | 'Completed' | 'Cancelled') => setPlan(prev => ({ ...prev, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Planned">Planned</SelectItem>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                    <SelectItem value="Cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date *</Label>
                <Input
                  id="startDate"
                  key={`startDate-${plan.id}`}
                  type="date"
                  value={plan.startDate || ''}
                  onChange={(e) => setPlan(prev => ({ ...prev, startDate: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date *</Label>
                <Input
                  id="endDate"
                  key={`endDate-${plan.id}`}
                  type="date"
                  value={plan.endDate || ''}
                  onChange={(e) => setPlan(prev => ({ ...prev, endDate: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="unitId">Production Unit *</Label>
                <Select 
                  key={`unitId-${plan.id}`}
                  value={plan.unitId || ''} 
                  onValueChange={(value) => setPlan(prev => ({ ...prev, unitId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>
                        {unit.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="plannedQuantity">Planned Quantity</Label>
                <Input
                  id="plannedQuantity"
                  key={`plannedQuantity-${plan.id}`}
                  type="number"
                  value={plan.plannedQuantity || 0}
                  onChange={(e) => setPlan(prev => ({ ...prev, plannedQuantity: parseFloat(e.target.value) || 0 }))}
                  placeholder="0"
                />
                {(template || (initialPlan && initialPlan.planBasis)) && (
                  <p className="text-xs text-blue-600">
                    💡 {template ? 
                      `Calculated from ${template.planBasis} template with ${Object.keys(template.usefulProductionTime || {}).filter(day => template.usefulProductionTime?.[day]?.start).length} production days` :
                      `Based on ${initialPlan?.planBasis} approach with template-derived configuration`
                    }
                  </p>
                )}
              </div>
            </div>
            {/* Actual Quantity Field */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="actualQuantity">Actual Quantity</Label>
                <div className="flex items-center space-x-2">
                  <Input
                    id="actualQuantity"
                    key={`actualQuantity-${plan.id}`}
                    type="number"
                    value={plan.actualQuantity || 0}
                    onChange={(e) => setPlan(prev => ({ ...prev, actualQuantity: parseFloat(e.target.value) || 0 }))}
                    placeholder="0"
                  />
                  {outputEvents.length > 0 && (
                    <Button type="button" size="sm" onClick={() => setPlan(prev => ({ ...prev, actualQuantity: autoActualQuantity }))}>
                      Auto-fill
                    </Button>
                  )}
                </div>
                <p className="text-xs text-blue-600">
                  💡 This value is auto-calculated from Production Output events, but you can also edit it manually if needed.
                </p>
              </div>
            </div>

            {/* Always show these fields for new plans or editing, regardless of template */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="planBasis">Plan Basis</Label>
                <Select 
                  value={plan.planBasis || template?.planBasis || ''} 
                  onValueChange={(value) => setPlan(prev => ({ ...prev, planBasis: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Time-based">Time-based</SelectItem>
                    <SelectItem value="Quantity-based">Quantity-based</SelectItem>
                    <SelectItem value="Demand-based">Demand-based</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="recurrence">Recurrence</Label>
                <Select 
                  value={plan.recurrence || template?.recurrence || ''} 
                  onValueChange={(value) => setPlan(prev => ({ ...prev, recurrence: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Daily">Daily</SelectItem>
                    <SelectItem value="Weekly">Weekly</SelectItem>
                    <SelectItem value="Monthly">Monthly</SelectItem>
                    <SelectItem value="Quarterly">Quarterly</SelectItem>
                    <SelectItem value="Yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dataEntryFrequency">Data Entry Frequency</Label>
                <Select 
                  value={plan.dataEntryFrequency || template?.dataEntryFrequency || ''} 
                  onValueChange={(value) => setPlan(prev => ({ ...prev, dataEntryFrequency: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Hourly">Hourly</SelectItem>
                    <SelectItem value="Daily">Daily</SelectItem>
                    <SelectItem value="Weekly">Weekly</SelectItem>
                    <SelectItem value="Monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Selected Product */}
            <div className="space-y-2">
              <Label htmlFor="productId">Product</Label>
              <Select 
                key={`productId-${plan.id}`}
                value={plan.productId || ''} 
                onValueChange={(value) => setPlan(prev => ({ ...prev, productId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {template ? (
                    // If using template, show template products first, then others
                    <>
                      {template.productIds.length > 0 && (
                        <div className="px-2 py-1.5 text-xs font-medium text-gray-500 border-b border-gray-200">
                          Template Products
                        </div>
                      )}
                      {template.productIds.map((productId) => {
                        const product = products.find(p => p.id === productId);
                        return product ? (
                          <SelectItem key={product.id} value={product.id} className="bg-blue-50">
                            <div className="flex items-center space-x-2">
                              <span>{product.name}</span>
                              <Badge variant="outline" className="text-xs">Template</Badge>
                            </div>
                          </SelectItem>
                        ) : null;
                      })}
                      {products.filter(p => !template.productIds.includes(p.id)).length > 0 && (
                        <div className="px-2 py-1.5 text-xs font-medium text-gray-500 border-b border-gray-200">
                          Other Products
                        </div>
                      )}
                      {products.filter(p => !template.productIds.includes(p.id)).map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </>
                  ) : initialPlan && initialPlan.planBasis ? (
                    // If editing a template-based plan, highlight the current product
                    <>
                      <div className="px-2 py-1.5 text-xs font-medium text-gray-500 border-b border-gray-200">
                        Template-Based Plan Product
                      </div>
                      {products.map((product) => (
                        <SelectItem 
                          key={product.id} 
                          value={product.id}
                          className={product.id === initialPlan.productId ? "bg-blue-50" : ""}
                        >
                          <div className="flex items-center space-x-2">
                            <span>{product.name}</span>
                            {product.id === initialPlan.productId && (
                              <Badge variant="outline" className="text-xs">Current</Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </>
                  ) : (
                    // If no template, show all products
                    products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {(template && template.productIds.length > 1) || (initialPlan && initialPlan.planBasis) && (
                <p className="text-xs text-blue-600">
                  {template ? 
                    `💡 Template includes ${template.productIds.length} products. You can create additional plans for other products.` :
                    '💡 This plan was created from a template with advanced configuration.'
                  }
                </p>
              )}
            </div>

            {/* Production Schedule - Only show when no template is used */}
            {!template && (
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Clock className="w-5 h-5 text-gray-600" />
                  <Label className="text-base font-medium">Production Schedule</Label>
                </div>
                <p className="text-sm text-gray-600">
                  Configure working hours for each day of the week. Leave empty for non-production days.
                </p>
                
                <Card className="border-gray-200">
                  <CardContent className="p-4">
                    <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                      {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                        <div key={day} className="p-3 bg-gray-50 rounded border border-gray-200 hover:shadow-sm transition-shadow">
                          <Label className="text-sm font-medium text-gray-700 mb-2 block">
                            {day}
                          </Label>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs text-gray-500">Start Time</Label>
                              <Input
                                type="time"
                                value={plan.usefulProductionTime?.[day]?.start || ''}
                                onChange={(e) => {
                                  const currentTime = plan.usefulProductionTime || {};
                                  const updatedTime = {
                                    ...currentTime,
                                    [day]: {
                                      ...currentTime[day],
                                      start: e.target.value
                                    }
                                  };
                                  setPlan(prev => ({ ...prev, usefulProductionTime: updatedTime }));
                                }}
                                placeholder="08:00"
                                className="h-8 text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-gray-500">End Time</Label>
                              <Input
                                type="time"
                                value={plan.usefulProductionTime?.[day]?.end || ''}
                                onChange={(e) => {
                                  const currentTime = plan.usefulProductionTime || {};
                                  const updatedTime = {
                                    ...currentTime,
                                    [day]: {
                                      ...currentTime[day],
                                      end: e.target.value
                                    }
                                  };
                                  setPlan(prev => ({ ...prev, usefulProductionTime: updatedTime }));
                                }}
                                placeholder="17:00"
                                className="h-8 text-sm"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="mt-3 p-2 bg-blue-50 rounded border border-blue-200">
                      <p className="text-xs text-blue-700">
                        💡 <strong>Tip:</strong> Set production hours for each day. This schedule will be used for OEE calculations and production planning.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Shift and Crew fields with Smart Prompts */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="shift">Shift</Label>
                <Select value={plan.shift || ''} onValueChange={value => setPlan(prev => ({ ...prev, shift: value }))}>
                  <SelectTrigger className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                    <SelectValue placeholder="Select shift" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Day">Day</SelectItem>
                    <SelectItem value="Night">Night</SelectItem>
                    <SelectItem value="Swing">Swing</SelectItem>
                    <SelectItem value="Custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
                {/* Shift Smart Prompt */}
                {(() => {
                  const currentHour = new Date().getHours();
                  const currentTime = new Date().toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit',
                    hour12: true 
                  });
                  
                  if (currentHour >= 6 && currentHour < 14 && !plan.shift) {
                    return (
                      <div className="p-2 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded text-xs">
                        <div className="flex items-center space-x-1">
                          <span>🌅</span>
                          <span className="text-yellow-800">It's {currentTime} - consider Day Shift</span>
                        </div>
                      </div>
                    );
                  } else if (currentHour >= 14 && currentHour < 22 && !plan.shift) {
                    return (
                      <div className="p-2 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded text-xs">
                        <div className="flex items-center space-x-1">
                          <span>🌆</span>
                          <span className="text-yellow-800">It's {currentTime} - consider Swing Shift</span>
                        </div>
                      </div>
                    );
                  } else if ((currentHour >= 22 || currentHour < 6) && !plan.shift) {
                    return (
                      <div className="p-2 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded text-xs">
                        <div className="flex items-center space-x-1">
                          <span>🌙</span>
                          <span className="text-yellow-800">It's {currentTime} - consider Night Shift</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
              <div className="space-y-2">
                <Label htmlFor="crew">Crew</Label>
                <Input
                  id="crew"
                  type="text"
                  value={plan.crew || ''}
                  onChange={e => setPlan(prev => ({ ...prev, crew: e.target.value }))}
                  placeholder="Crew name or code"
                  className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {/* Crew Smart Prompt */}
                {!plan.crew && (
                  <div className="p-2 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded text-xs">
                    <div className="flex items-center space-x-1">
                      <span>👥</span>
                      <span className="text-green-800">Common crews: Alpha, Bravo, Charlie, Delta</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Planner Notes and Comments */}
          <Tabs defaultValue="notes" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="notes" className="flex items-center space-x-2">
                <FileText className="w-4 h-4" />
                <span>Planner Notes</span>
              </TabsTrigger>
              <TabsTrigger value="comments" className="flex items-center space-x-2">
                <MessageSquare className="w-4 h-4" />
                <span>Comments & Approval</span>
                {plan.comments && plan.comments.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {plan.comments.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="notes" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="plannerNotes">Planner Notes</Label>
                <Textarea
                  id="plannerNotes"
                  placeholder="Add detailed notes about this production plan, including assumptions, constraints, or special instructions..."
                  value={plan.plannerNotes || ''}
                  onChange={(e) => setPlan(prev => ({ ...prev, plannerNotes: e.target.value }))}
                  rows={4}
                  className="resize-none"
                />
                <p className="text-xs text-gray-500">
                  These notes are visible to all users and provide context for the production plan.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="comments" className="space-y-4">
              {/* Comments List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-700">Comments & Approval History</h4>
                  <div className="flex items-center space-x-2">
                    <Select value={commentType} onValueChange={(value: 'Note' | 'Comment' | 'Approval' | 'Rejection') => setCommentType(value)}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Comment">Comment</SelectItem>
                        <SelectItem value="Note">Note</SelectItem>
                        <SelectItem value="Approval">Approval</SelectItem>
                        <SelectItem value="Rejection">Rejection</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Add Comment Form */}
                <div className="flex items-end space-x-2">
                  <div className="flex-1">
                    <Textarea
                      placeholder={`Add a ${commentType.toLowerCase()}...`}
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      rows={2}
                      className="resize-none"
                    />
                  </div>
                  <Button
                    onClick={handleAddComment}
                    disabled={!newComment.trim()}
                    size="sm"
                    className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </Button>
                </div>

                {/* Comments Display */}
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {plan.comments && plan.comments.length > 0 ? (
                    plan.comments.map((comment) => (
                      <div key={comment.id} className="flex items-start space-x-3 p-3 bg-gradient-to-br from-blue-50 via-white to-pink-50 rounded-lg border border-blue-100 shadow-sm">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-200 to-pink-200 flex items-center justify-center font-bold text-blue-700 shadow text-sm">
                          {comment.userName.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-blue-900 text-sm">{comment.userName}</span>
                            <Badge 
                              variant="outline" 
                              className={
                                comment.type === 'Approval' ? 'bg-green-100 text-green-800 border-green-200' :
                                comment.type === 'Rejection' ? 'bg-red-100 text-red-800 border-red-200' :
                                comment.type === 'Note' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                                'bg-blue-100 text-blue-800 border-blue-200'
                              }
                            >
                              {comment.type}
                            </Badge>
                            <span className="text-xs text-gray-400">
                              {new Date(comment.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <div className="text-gray-700 text-sm">{comment.text}</div>
                        </div>
                        {session?.user?.id === comment.userId && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteComment(comment.id)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <XCircle className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6 text-gray-400">
                      <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No comments yet. Start the discussion!</p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={!plan.name || !plan.unitId || !plan.startDate || !plan.endDate}
            >
              {initialPlan ? 'Update Plan' : 'Create Plan'}
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Plan Approval Workflow Modal */}
      <PlanApprovalWorkflow
        plan={plan as ProductionPlan}
        onApprovalAction={handleApprovalAction}
        onClose={() => setShowApprovalWorkflow(false)}
        isOpen={showApprovalWorkflow}
      />
    </Dialog>
  );
};

export default PlanForm; 