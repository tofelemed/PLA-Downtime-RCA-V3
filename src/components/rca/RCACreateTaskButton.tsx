import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CheckSquare, ExternalLink, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { RCARecommendation } from '@/services/MasterDataService';
import { createTaskFromRecommendation, createTaskFromRCA } from '@/services/rca/rcaTaskBridge';

interface RCACreateTaskButtonProps {
  rca: { id: string; title: string; description?: string };
  recommendation?: RCARecommendation;
  session: {
    user: { id: string; name: string };
    organization?: { id: string } | null;
    tenant?: { id: string; organizationId?: string } | null;
  };
  tenantId: string;
  organizationId: string;
  alreadyLinked?: boolean;
  size?: 'sm' | 'default';
  onCreated?: () => void;
}

export function RCACreateTaskButton({
  rca,
  recommendation,
  session,
  tenantId,
  organizationId,
  alreadyLinked = false,
  size = 'sm',
  onCreated,
}: RCACreateTaskButtonProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!organizationId || !tenantId) {
      toast({ title: 'Missing context', description: 'Select a tenant before creating tasks.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const ctx = {
        assignedBy: session.user.id,
        assignedByName: session.user.name,
        organizationId,
        tenantId,
      };

      if (recommendation) {
        if (alreadyLinked) {
          toast({ title: 'Task already exists', description: 'A task is already linked to this recommendation.' });
          return;
        }
        const task = await createTaskFromRecommendation(recommendation, rca, ctx);
        toast({
          title: 'Task created',
          description: `"${task.title}" added to Task Management.`,
        });
      } else {
        const task = await createTaskFromRCA(rca, { ...ctx, assignedTo: session.user.id });
        toast({
          title: 'Task created',
          description: `"${task.title}" linked to this RCA.`,
        });
      }
      onCreated?.();
    } catch (error: any) {
      toast({ title: 'Failed to create task', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (alreadyLinked && recommendation) {
    return (
      <Button size={size} variant="outline" asChild className="text-green-700 border-green-200">
        <Link to="/tasks">
          <CheckSquare className="w-4 h-4 mr-1" />
          View Task
        </Link>
      </Button>
    );
  }

  return (
    <Button size={size} variant="outline" onClick={handleCreate} disabled={loading}>
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckSquare className="w-4 h-4" />}
      <span className="ml-1">{recommendation ? 'Create Task' : 'Create RCA Task'}</span>
    </Button>
  );
}

export function RCATasksLink({ count }: { count: number }) {
  if (!count) return null;
  return (
    <Button size="sm" variant="ghost" asChild>
      <Link to="/tasks" className="text-blue-600">
        <ExternalLink className="w-4 h-4 mr-1" />
        {count} linked task{count !== 1 ? 's' : ''}
      </Link>
    </Button>
  );
}
