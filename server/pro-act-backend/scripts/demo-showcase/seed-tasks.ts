/**
 * Tasks of the showcase (v1 task routes, the only ones there are): follow-ups a shift supervisor hands to
 * operators, engineers and reliability engineers, in every state (open, in progress, completed,
 * cancelled, one overdue). Assigned by a manager; found by title and kept.
 */
import { Role, ShowcaseContext } from './showcase-context';
import { DAY_MS, iso } from './showcase-window';

interface TaskSpec {
  title: string;
  description: string;
  role: Role;
  index: number;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  status: 'Open' | 'In Progress' | 'Completed' | 'Cancelled';
  dueInDays: number;
  entityType?: string;
}

const TASKS: readonly TaskSpec[] = [
  {
    title: "Code yesterday's uncoded stops on Extruder Line 1",
    description:
      'Event Hub → filter "Uncoded"; use the reason tree, ask maintenance when unsure.',
    role: 'operators',
    index: 0,
    priority: 'High',
    status: 'Open',
    dueInDays: 1,
    entityType: 'unit',
  },
  {
    title:
      'Confirm the cause of the running main drive trip on Extruder Line 2',
    description: 'Electrician on site; code the stop once the cause is known.',
    role: 'operators',
    index: 1,
    priority: 'Critical',
    status: 'In Progress',
    dueInDays: 0,
    entityType: 'unit',
  },
  {
    title: 'Record the knife change on the Pelletizer in the shift log',
    description: 'Knife set number and torque values.',
    role: 'operators',
    index: 2,
    priority: 'Medium',
    status: 'Completed',
    dueInDays: -2,
  },
  {
    title: 'Check bag film stock before the night shift',
    description: 'At least two reels staged at the FFS bagger (RCA kanban).',
    role: 'operators',
    index: 2,
    priority: 'Medium',
    status: 'Open',
    dueInDays: 1,
  },
  {
    title: 'Calibrate the Bagging net weigh scale',
    description: 'Monthly calibration with the 25 kg test weights; overdue.',
    role: 'operators',
    index: 0,
    priority: 'High',
    status: 'Open',
    dueInDays: -3,
  },
  {
    title: 'Clean the pellet screen during the next changeover',
    description: 'Superseded by the new PM plan.',
    role: 'operators',
    index: 1,
    priority: 'Low',
    status: 'Cancelled',
    dueInDays: -5,
  },
  {
    title: "Review and submit yesterday's shift accounting",
    description:
      'Morning and afternoon are in review; night shift still draft.',
    role: 'engineers',
    index: 0,
    priority: 'High',
    status: 'In Progress',
    dueInDays: 0,
    entityType: 'production_period',
  },
  {
    title: 'Rework the rejected Pelletizer night shift',
    description:
      'Split the die plate line and code the knife change (MECH-KNF), then resubmit.',
    role: 'engineers',
    index: 1,
    priority: 'High',
    status: 'Open',
    dueInDays: 1,
    entityType: 'production_period',
  },
  {
    title: 'Propose a new planning rate for HDPE F7000 after the trial',
    description: 'Trial ran 4 % above the planning rate for three days.',
    role: 'engineers',
    index: 2,
    priority: 'Medium',
    status: 'Open',
    dueInDays: 7,
  },
  {
    title: 'Prepare the weekly loss report for the S&OP meeting',
    description: 'Export of the approved week attached.',
    role: 'engineers',
    index: 3,
    priority: 'Medium',
    status: 'Completed',
    dueInDays: -1,
  },
  {
    title: 'Collect die plate blockage evidence for the RCA',
    description: 'Melt temperature trends and die inspection photos.',
    role: 'engineers',
    index: 4,
    priority: 'Medium',
    status: 'In Progress',
    dueInDays: 3,
    entityType: 'rca',
  },
  {
    title: 'Schedule a vibration survey of the Extruder 2 gearbox',
    description: 'Before the next PM window.',
    role: 'reliability',
    index: 0,
    priority: 'Medium',
    status: 'Open',
    dueInDays: 6,
  },
  {
    title: 'Publish the knowledge entries of the closed RCA cases',
    description: 'Review wording and publish in the Knowledge Base.',
    role: 'reliability',
    index: 1,
    priority: 'Low',
    status: 'Open',
    dueInDays: 5,
  },
  {
    title: 'Verify the oil cooler action on Extruder Line 2',
    description: 'Verification window ended; realized result recorded.',
    role: 'reliability',
    index: 2,
    priority: 'Medium',
    status: 'Completed',
    dueInDays: -1,
    entityType: 'rca',
  },
];

interface TaskRow {
  title: string;
}

export async function seedTasks(ctx: ShowcaseContext): Promise<void> {
  const specs = TASKS.slice(0, ctx.scenario.tasks);
  const manager = ctx.as('managers', 0);
  const existing = await manager.get<TaskRow[]>(
    `/tasks?tenantId=${ctx.tenantId}`,
  );
  const titles = new Set(existing.map((t) => t.title));
  const assigner = ctx.ids.users.get(ctx.persona('managers', 0));
  for (const spec of specs) {
    if (titles.has(spec.title)) {
      ctx.tally.kept('tasks');
      continue;
    }
    const assignee = ctx.ids.users.get(ctx.persona(spec.role, spec.index));
    if (!assignee || !assigner || !ctx.organizationId) continue;
    ctx.tally.created('tasks');
    if (ctx.dryRun) continue;
    const due = ctx.window.today + spec.dueInDays * DAY_MS + 10 * 3_600_000;
    const body: Record<string, unknown> = {
      title: spec.title,
      description: spec.description,
      assignedTo: assignee,
      assignedBy: assigner,
      priority: spec.priority,
      status: spec.status,
      dueDate: iso(due),
      organizationId: ctx.organizationId,
      tenantId: ctx.tenantId,
    };
    if (spec.status === 'Completed')
      body.completedDate = iso(Math.min(due, ctx.window.now));
    if (spec.entityType) body.entityType = spec.entityType;
    await manager.call('POST', '/tasks', body);
  }
}
