import React, { useState } from 'react';
import { ProductionPlan, Unit, Product } from '../../services/MasterDataService';
import { Calendar, Package, Target, TrendingUp, BarChart3, CheckCircle, XCircle, AlertCircle, MessageSquare, FileText, History } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import PlanStatusBadge from './PlanStatusBadge';
import PlanActions from './PlanActions';
import { AuditTrailViewer } from '../AuditTrailViewer';

type PlanItemProps = {
  plan: ProductionPlan;
  unit?: Unit;
  product?: Product;
  onEdit: (plan: ProductionPlan) => void;
  onDelete: (id: string) => void;
  onView: (plan: ProductionPlan) => void;
  onViewDashboard: (plan: ProductionPlan) => void;
};

const PlanItem: React.FC<PlanItemProps> = ({ 
  plan, 
  unit, 
  product, 
  onEdit, 
  onDelete,
  onView,
  onViewDashboard
}) => {
  const [showAuditTrail, setShowAuditTrail] = useState(false);
  
  const progress = plan.actualQuantity && plan.plannedQuantity 
    ? Math.min((plan.actualQuantity / plan.plannedQuantity) * 100, 100)
    : 0;

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't trigger onView if clicking on buttons
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }
    onView(plan);
  };

  return (
    <>
      <Card className="hover:shadow-xl transition-shadow cursor-pointer bg-gradient-to-br from-white via-blue-50 to-purple-50 rounded-2xl border border-blue-100" onClick={handleCardClick}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div>
              <CardTitle className="text-lg font-bold text-blue-800 flex items-center gap-2"><Package className="w-5 h-5 text-blue-400" />{plan.name}</CardTitle>
              <CardDescription className="flex items-center space-x-2 text-sm text-gray-500">
                {unit && (
                  <><Package className="w-4 h-4 text-blue-300" /><span>{unit.name}</span></>
                )}
                {product && (
                  <><span>•</span><span>{product.name}</span></>
                )}
              </CardDescription>
            </div>
            <div className="flex flex-col items-end space-y-1">
              <PlanStatusBadge status={plan.status} />
              <Badge 
                variant={
                  plan.approvalStatus === 'Approved' ? 'default' :
                  plan.approvalStatus === 'Rejected' ? 'destructive' :
                  plan.approvalStatus === 'Pending Review' || plan.approvalStatus === 'Pending Approval' ? 'secondary' :
                  'outline'
                }
                className={
                  plan.approvalStatus === 'Approved' ? 'bg-green-100 text-green-800 border-green-200 text-xs rounded-full px-2 py-0.5' :
                  plan.approvalStatus === 'Rejected' ? 'bg-red-100 text-red-800 border-red-200 text-xs rounded-full px-2 py-0.5' :
                  plan.approvalStatus === 'Pending Review' || plan.approvalStatus === 'Pending Approval' ? 'bg-yellow-100 text-yellow-800 border-yellow-200 text-xs rounded-full px-2 py-0.5' :
                  'bg-gray-100 text-gray-800 border-gray-200 text-xs rounded-full px-2 py-0.5'
                }
              >
                {plan.approvalStatus === 'Approved' && <CheckCircle className="w-3 h-3 mr-1" />}
                {plan.approvalStatus === 'Rejected' && <XCircle className="w-3 h-3 mr-1" />}
                {plan.approvalStatus === 'Pending Review' || plan.approvalStatus === 'Pending Approval' ? <AlertCircle className="w-3 h-3 mr-1" /> : null}
                {plan.approvalStatus}
              </Badge>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                setShowAuditTrail(true);
              }}
              className="bg-gradient-to-r from-gray-50 to-blue-50 border-gray-200 text-gray-700 hover:from-gray-100 hover:to-blue-100"
            >
              <History className="w-4 h-4 mr-1" />
              Audit
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                onViewDashboard(plan);
              }}
              className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200 text-blue-700 hover:from-blue-100 hover:to-purple-100"
            >
              <BarChart3 className="w-4 h-4 mr-1" />
              Dashboard
            </Button>
            <PlanActions plan={plan} onEdit={onEdit} onDelete={onDelete} />
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="flex items-center space-x-2">
            <Target className="w-4 h-4 text-muted-foreground" />
            <div>
              <span className="font-medium text-muted-foreground">Planned:</span>
              <p>{plan.plannedQuantity.toLocaleString()}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <div>
              <span className="font-medium text-muted-foreground">Actual:</span>
              <p>{plan.actualQuantity?.toLocaleString() || '0'}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <div>
              <span className="font-medium text-muted-foreground">Progress:</span>
              <p>{progress.toFixed(1)}%</p>
            </div>
          </div>
          
          <div>
            <span className="font-medium text-muted-foreground">Schedule:</span>
            <p className="text-xs">{plan.startDate} - {plan.endDate}</p>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="mt-4">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Progress</span>
            <span>{progress.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Planner Notes and Comments Preview */}
        {(plan.plannerNotes || (plan.comments && plan.comments.length > 0)) && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-700">Notes & Comments</h4>
              <div className="flex items-center space-x-2 text-xs text-gray-500">
                {plan.plannerNotes && (
                  <div className="flex items-center space-x-1">
                    <FileText className="w-3 h-3" />
                    <span>Notes</span>
                  </div>
                )}
                {plan.comments && plan.comments.length > 0 && (
                  <div className="flex items-center space-x-1">
                    <MessageSquare className="w-3 h-3" />
                    <span>{plan.comments.length} comment{plan.comments.length !== 1 ? 's' : ''}</span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Planner Notes Preview */}
            {plan.plannerNotes && (
              <div className="mb-2 p-2 bg-blue-50 rounded border border-blue-200">
                <p className="text-xs text-blue-800 line-clamp-2">
                  {plan.plannerNotes}
                </p>
              </div>
            )}
            
            {/* Latest Comment Preview */}
            {plan.comments && plan.comments.length > 0 && (
              <div className="p-2 bg-gray-50 rounded border border-gray-200">
                <div className="flex items-start space-x-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-200 to-pink-200 flex items-center justify-center font-bold text-blue-700 shadow text-xs">
                    {plan.comments[plan.comments.length - 1].userName.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900 text-xs">{plan.comments[plan.comments.length - 1].userName}</span>
                      <Badge 
                        variant="outline" 
                        className={
                          plan.comments[plan.comments.length - 1].type === 'Approval' ? 'bg-green-100 text-green-800 border-green-200 text-xs' :
                          plan.comments[plan.comments.length - 1].type === 'Rejection' ? 'bg-red-100 text-red-800 border-red-200 text-xs' :
                          plan.comments[plan.comments.length - 1].type === 'Note' ? 'bg-purple-100 text-purple-800 border-purple-200 text-xs' :
                          'bg-blue-100 text-blue-800 border-blue-200 text-xs'
                        }
                      >
                        {plan.comments[plan.comments.length - 1].type}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-700 line-clamp-2">
                      {plan.comments[plan.comments.length - 1].text}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>

    {/* Audit Trail Viewer */}
    <AuditTrailViewer
      auditTrail={plan.auditTrail || []}
      entityType="Production Plan"
      entityName={plan.name}
      onClose={() => setShowAuditTrail(false)}
      isOpen={showAuditTrail}
    />
    </>
  );
};

export default PlanItem; 