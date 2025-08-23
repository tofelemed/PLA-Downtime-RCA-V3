import React, { useState, useEffect } from 'react';
import { ProductionPlan } from '../../services/MasterDataService';
import { useAuth } from '../../contexts/AuthContext';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  User, 
  Send, 
  AlertCircle, 
  FileText, 
  MessageSquare,
  Calendar,
  ArrowRight,
  Eye,
  History,
  Shield,
  BadgeCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';

interface PlanApprovalWorkflowProps {
  plan: ProductionPlan;
  onApprovalAction: (action: 'submit' | 'review' | 'approve' | 'reject', comment?: string) => void;
  onClose: () => void;
  isOpen: boolean;
}

export const PlanApprovalWorkflow: React.FC<PlanApprovalWorkflowProps> = ({
  plan,
  onApprovalAction,
  onClose,
  isOpen
}) => {
  const { session } = useAuth();
  const [rejectionReason, setRejectionReason] = useState('');
  const [approvalComment, setApprovalComment] = useState('');
  const [activeTab, setActiveTab] = useState('workflow');

  // Calculate approval progress
  const getApprovalProgress = () => {
    switch (plan.approvalStatus) {
      case 'Draft': return 0;
      case 'Pending Review': return 25;
      case 'Pending Approval': return 50;
      case 'Approved': return 100;
      case 'Rejected': return 100;
      default: return 0;
    }
  };

  // Get approval step details
  const getApprovalSteps = () => {
    const steps = [
      {
        id: 'draft',
        title: 'Draft',
        description: 'Plan created',
        status: plan.approvalStatus === 'Draft' ? 'current' : 
                ['Pending Review', 'Pending Approval', 'Approved', 'Rejected'].includes(plan.approvalStatus) ? 'completed' : 'pending',
        icon: FileText,
        date: plan.createdAt
      },
      {
        id: 'submitted',
        title: 'Submitted',
        description: 'Submitted for review',
        status: plan.approvalStatus === 'Pending Review' ? 'current' : 
                ['Pending Approval', 'Approved', 'Rejected'].includes(plan.approvalStatus) ? 'completed' : 'pending',
        icon: Send,
        date: plan.submittedAt,
        user: plan.submittedBy
      },
      {
        id: 'reviewed',
        title: 'Reviewed',
        description: 'Reviewed by supervisor',
        status: plan.approvalStatus === 'Pending Approval' ? 'current' : 
                ['Approved', 'Rejected'].includes(plan.approvalStatus) ? 'completed' : 'pending',
        icon: Eye,
        date: plan.reviewedAt,
        user: plan.reviewedBy
      },
      {
        id: 'approved',
        title: 'Approved',
        description: 'Final approval',
        status: plan.approvalStatus === 'Approved' ? 'completed' : 
                plan.approvalStatus === 'Rejected' ? 'rejected' : 'pending',
        icon: CheckCircle,
        date: plan.approvedAt,
        user: plan.approvedBy
      }
    ];
    return steps;
  };

  // Get user role-based actions
  const getUserActions = () => {
    const userRole = session?.user?.role;
    const actions = [];

    // Define which roles can perform approval actions
    const canPerformActions = ['SuperAdmin', 'OrgAdmin', 'TenantAdmin', 'Analyst', 'Engineer'].includes(userRole || '');

    if (plan.approvalStatus === 'Draft' && canPerformActions) {
      actions.push({
        id: 'submit',
        label: 'Submit for Review',
        description: 'Submit this plan for supervisor review',
        icon: Send,
        variant: 'default' as const,
        action: () => onApprovalAction('submit')
      });
    }

    if (plan.approvalStatus === 'Pending Review' && canPerformActions) {
      actions.push({
        id: 'review',
        label: 'Review & Approve',
        description: 'Review the plan and approve for final approval',
        icon: Eye,
        variant: 'secondary' as const,
        action: () => onApprovalAction('review')
      });
    }

    if (plan.approvalStatus === 'Pending Approval' && canPerformActions) {
      actions.push(
        {
          id: 'approve',
          label: 'Approve Plan',
          description: 'Give final approval to this plan',
          icon: CheckCircle,
          variant: 'default' as const,
          action: () => onApprovalAction('approve', approvalComment)
        },
        {
          id: 'reject',
          label: 'Reject Plan',
          description: 'Reject this plan with reason',
          icon: XCircle,
          variant: 'destructive' as const,
          action: () => onApprovalAction('reject', rejectionReason)
        }
      );
    }

    return actions;
  };

  const steps = getApprovalSteps();
  const actions = getUserActions();
  const progress = getApprovalProgress();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl min-h-[600px] max-h-[95vh] overflow-y-auto bg-gradient-to-br from-white via-blue-50/80 to-purple-50/80 border border-blue-200 shadow-2xl rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Shield className="w-5 h-5 text-blue-600" />
            <span>Plan Approval Workflow</span>
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
              {plan.approvalStatus}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Manage the approval workflow for plan: <strong>{plan.name}</strong>
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="workflow" className="flex items-center space-x-2">
              <History className="w-4 h-4" />
              <span>Workflow</span>
            </TabsTrigger>
            <TabsTrigger value="actions" className="flex items-center space-x-2">
              <BadgeCheck className="w-4 h-4" />
              <span>Actions</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center space-x-2">
              <MessageSquare className="w-4 h-4" />
              <span>Comments</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="workflow" className="space-y-6">
            {/* Progress Bar */}
            <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-blue-900">Approval Progress</CardTitle>
                <CardDescription className="text-blue-700">
                  Current status: {plan.approvalStatus}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Progress value={progress} className="h-3" />
                  <div className="flex justify-between text-sm text-blue-700">
                    <span>Draft</span>
                    <span>Submitted</span>
                    <span>Reviewed</span>
                    <span>Approved</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Approval Steps */}
            <div className="space-y-4">
              {steps.map((step, index) => (
                <Card key={step.id} className={`border-l-4 ${
                  step.status === 'completed' ? 'border-l-green-500 bg-green-50' :
                  step.status === 'current' ? 'border-l-blue-500 bg-blue-50' :
                  step.status === 'rejected' ? 'border-l-red-500 bg-red-50' :
                  'border-l-gray-300 bg-gray-50'
                }`}>
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        step.status === 'completed' ? 'bg-green-100 text-green-600' :
                        step.status === 'current' ? 'bg-blue-100 text-blue-600' :
                        step.status === 'rejected' ? 'bg-red-100 text-red-600' :
                        'bg-gray-100 text-gray-400'
                      }`}>
                        <step.icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-gray-900">{step.title}</h4>
                          {step.status === 'completed' && <CheckCircle className="w-4 h-4 text-green-600" />}
                          {step.status === 'rejected' && <XCircle className="w-4 h-4 text-red-600" />}
                          {step.status === 'current' && <Clock className="w-4 h-4 text-blue-600" />}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{step.description}</p>
                        {step.date && (
                          <div className="flex items-center space-x-2 mt-2 text-xs text-gray-500">
                            <Calendar className="w-3 h-3" />
                            <span>{new Date(step.date).toLocaleString()}</span>
                            {step.user && (
                              <>
                                <User className="w-3 h-3" />
                                <span>by {step.user}</span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Rejection Reason (if rejected) */}
            {plan.approvalStatus === 'Rejected' && plan.rejectionReason && (
              <Card className="border-l-4 border-l-red-500 bg-red-50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-red-900 flex items-center space-x-2">
                    <XCircle className="w-4 h-4" />
                    <span>Rejection Reason</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-red-800">{plan.rejectionReason}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="actions" className="space-y-6">
            {/* Available Actions */}
            {actions.length > 0 ? (
              <div className="grid gap-4">
                {actions.map((action) => (
                  <Card key={action.id} className="border border-gray-200 hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                            <action.icon className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900">{action.label}</h4>
                            <p className="text-sm text-gray-600 mt-1">{action.description}</p>
                          </div>
                        </div>
                        <Button
                          variant={action.variant}
                          onClick={action.action}
                          className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
                        >
                          {action.label}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="border border-gray-200">
                <CardContent className="p-8 text-center">
                  <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">No Actions Available</h4>
                  <p className="text-gray-600">
                    {plan.approvalStatus === 'Approved' 
                      ? 'This plan has been approved and no further actions are required.'
                      : plan.approvalStatus === 'Rejected'
                      ? 'This plan has been rejected. Contact the approver for more information.'
                      : 'You do not have permission to perform actions on this plan.'
                    }
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Action Forms */}
            {plan.approvalStatus === 'Pending Approval' && (
              <div className="space-y-4">
                <Separator />
                <div className="grid gap-4">
                  {/* Approval Comment */}
                  <div className="space-y-2">
                    <Label htmlFor="approvalComment">Approval Comment (Optional)</Label>
                    <Textarea
                      id="approvalComment"
                      placeholder="Add a comment for this approval..."
                      value={approvalComment}
                      onChange={(e) => setApprovalComment(e.target.value)}
                      rows={3}
                    />
                  </div>

                  {/* Rejection Reason */}
                  <div className="space-y-2">
                    <Label htmlFor="rejectionReason">Rejection Reason (Required for rejection)</Label>
                    <Textarea
                      id="rejectionReason"
                      placeholder="Provide a reason for rejection..."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      rows={3}
                      className="border-red-300 focus:border-red-500 focus:ring-red-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            {/* Comments History */}
            <div className="space-y-4">
              {plan.comments && plan.comments.length > 0 ? (
                plan.comments.map((comment) => (
                  <Card key={comment.id} className="border border-gray-200">
                    <CardContent className="p-4">
                      <div className="flex items-start space-x-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-200 to-pink-200 flex items-center justify-center font-bold text-blue-700 text-sm">
                          {comment.userName.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-gray-900">{comment.userName}</span>
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
                          <p className="text-gray-700">{comment.text}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card className="border border-gray-200">
                  <CardContent className="p-8 text-center">
                    <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h4 className="text-lg font-semibold text-gray-900 mb-2">No Comments Yet</h4>
                    <p className="text-gray-600">
                      Comments and approval history will appear here as the workflow progresses.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end space-x-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}; 