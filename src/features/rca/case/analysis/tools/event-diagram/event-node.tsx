import { Handle, Position, type NodeProps } from 'reactflow';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useRcaFormat } from '../../../../use-rca-format';
import type { EventNodeData } from './diagram-model';

/** One event on the diagram canvas: what, kind, when, where and severity; connect from the bottom handle. */
export function EventNode({ data, selected }: NodeProps<EventNodeData>) {
  const { dateTime } = useRcaFormat();
  return (
    <div className={cn('w-56 rounded border bg-background p-2 text-xs shadow-sm', selected && 'ring-2 ring-ring')}>
      <Handle type="target" position={Position.Top} />
      <p className="text-sm font-medium">{data.label}</p>
      <p className="text-muted-foreground">
        {data.type ?? 'Event'}
        {data.timestamp ? ` · ${dateTime(data.timestamp)}` : ''}
      </p>
      {data.asset && <p>{data.asset}</p>}
      {data.description && <p className="line-clamp-3 text-muted-foreground">{data.description}</p>}
      {data.severity && (
        <Badge variant={data.severity === 'Critical' || data.severity === 'High' ? 'destructive' : 'outline'} className="mt-1">
          {data.severity}
        </Badge>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
