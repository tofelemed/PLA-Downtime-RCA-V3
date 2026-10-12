import { useState } from 'react';
import { Link } from 'react-router-dom';
import { v2Request } from '@/api/v2/client';
import { useCreateTask } from '@/api/v2/queries/administration-tasks';
import type { ListResponse } from '@/api/v2/types/envelopes';
import type { TaskView } from '@/api/v2/types/administration';
import type { RcaRecommendationItem } from '@/api/v2/types/rca';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { friendlyToastContent } from '@/features/ux-kit/errors';
import { caseTask, recommendationTask } from '../../model/task-payload';
import { useCaseWorkspace } from '../case-context';

/** True when a task of this case already carries the title (one request, made on click). */
async function taskExists(rcaId: string, title: string): Promise<boolean> {
  const page = await v2Request<ListResponse<TaskView>>({ method: 'GET', path: '/tasks', query: { linkType: 'RCA', linkId: rcaId, q: title.slice(0, 100), limit: 20 } });
  return page.data.items.some((task) => task.title === title);
}

/** Creates a task in Task Management for the case or one recommendation (never twice for the same title). */
export function CreateTaskButton({ recommendation }: { recommendation?: RcaRecommendationItem }) {
  const { rca } = useCaseWorkspace();
  const { session } = useAuth();
  const create = useCreateTask();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const label = recommendation ? `Create task for ${recommendation.title}` : 'Create case task';
  const run = async () => {
    if (!session) return;
    setBusy(true);
    try {
      const body = recommendation ? recommendationTask(rca, recommendation, session.user.id) : caseTask(rca, session.user.id);
      if (await taskExists(rca.id, body.title)) {
        toast({ title: 'A task already exists', description: `"${body.title}" is already in Task Management.` });
        return;
      }
      await create.submit(body);
      toast({ title: 'Task created', description: `"${body.title}" is in Task Management.` });
    } catch (error) {
      toast({ ...friendlyToastContent(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={busy || !session}
      aria-label={label}
      onKeyDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        void run();
      }}
    >
      {recommendation ? 'Create task' : 'Create case task'}
    </Button>
  );
}

/** Task Management, where the tasks of this case are followed up. */
export function TasksLink() {
  return (
    <Button asChild size="sm" variant="ghost">
      <Link to="/tasks">Open Task Management</Link>
    </Button>
  );
}
