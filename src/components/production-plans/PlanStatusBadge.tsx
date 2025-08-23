import React from 'react';
import { Badge } from '@/components/ui/badge';

type PlanStatusBadgeProps = {
  status: 'Planned' | 'Active' | 'Completed' | 'Cancelled';
};

const getStatusVariant = (status: string) => {
  switch (status) {
    case 'Planned': return 'secondary';
    case 'Active': return 'default';
    case 'Completed': return 'outline';
    case 'Cancelled': return 'destructive';
    default: return 'secondary';
  }
};

const PlanStatusBadge: React.FC<PlanStatusBadgeProps> = ({ status }) => (
  <Badge variant={getStatusVariant(status)} className="text-xs">
    {status}
  </Badge>
);

export default PlanStatusBadge; 