import { withRpn } from './rca-analysis-rules';
import { readEventDiagram } from './rca-case-diagram';
import {
  readEvidence,
  readLogicTree,
  readRecommendations,
} from './rca-case-json';
import { flattenTemplateTree } from './rca-case-template';

describe('RCA case readers and rules', () => {
  it('reads the v1 screen shapes (flat logic nodes, evidence form fields, assignee)', () => {
    const [node] = readLogicTree(
      JSON.stringify([
        {
          id: 'n1',
          parentId: null,
          question: 'Pump trips',
          answer: 'Seen 3 times',
          type: 'Equipment',
          code: 'PT',
          note: 'check',
          finding: true,
        },
      ]),
    );
    expect(node).toMatchObject({
      label: 'Pump trips',
      description: 'Seen 3 times',
      kind: 'Equipment',
      code: 'PT',
      notes: 'check',
      verified: true,
    });
    const [item] = readEvidence([
      {
        id: 'e1',
        title: 'Photo',
        relatedAssetId: 'a1',
        timestamp: '2026-10-01T08:00',
        status: 'completed',
        dueDate: '2026-10-02',
        tags: ['x', 3],
        tsStart: '2026-10-01T00:00:00Z',
        tsEnd: '2026-10-02T00:00:00Z',
        tsMode: 'recorded',
        attachments: [{ name: 'inline.png', dataUrl: 'data:,' }],
      },
    ]);
    expect(item).toMatchObject({
      assetId: 'a1',
      occurredAt: '2026-10-01T08:00',
      taskStatus: 'completed',
      taskDueDate: '2026-10-02',
      tags: ['x'],
      attachments: [],
    });
    expect(item.timeSeries).toMatchObject({
      mode: 'recorded',
      start: '2026-10-01T00:00:00Z',
    });
    const [recommendation] = readRecommendations([
      { title: 'Fix', assigneeId: 'u1', estimatedCost: 1250.5 },
    ]);
    expect(recommendation).toMatchObject({
      ownerId: 'u1',
      estimatedCost: '1250.5',
    });
  });

  it('reads v1 (reactflow) and v2 diagrams and drops edges to unknown events', () => {
    const diagram = readEventDiagram(
      JSON.stringify({
        nodes: [
          {
            id: '1',
            data: {
              label: 'Alarm',
              type: 'Alarm',
              timestamp: '2026-10-01T07:00:00Z',
            },
            position: { x: 5, y: 6 },
          },
          { id: '2', label: 'Trip', type: 'Failure' },
        ],
        edges: [
          { id: 'a', source: '1', target: '2' },
          { id: 'b', source: '1', target: '9' },
        ],
      }),
    );
    expect(diagram.nodes.map((n) => [n.label, n.type])).toEqual([
      ['Alarm', 'Alarm'],
      ['Trip', 'Failure'],
    ]);
    expect(diagram.nodes[0].position).toEqual({ x: 5, y: 6 });
    expect(diagram.edges.map((e) => e.id)).toEqual(['a']);
    expect(readEventDiagram(null)).toEqual({ nodes: [], edges: [] });
  });

  it('flattens a template tree with fresh ids and parent links', () => {
    const nodes = flattenTemplateTree([
      {
        name: 'Failure',
        category: 'Root',
        children: [
          {
            name: 'Mode A',
            code: 'MA',
            children: [{ name: 'Cause', category: 'Cause' }],
          },
        ],
      },
      { name: 'Second' },
    ]);
    expect(nodes.map((n) => [n.id, n.parentId, n.label])).toEqual([
      ['t1', null, 'Failure'],
      ['t2', 't1', 'Mode A'],
      ['t3', 't2', 'Cause'],
      ['t4', null, 'Second'],
    ]);
  });

  it('computes FMEA RPN from the worst effect and the cause occurrence', () => {
    const effects = [
      { severity: 8, detection: 3 },
      { severity: 5, detection: 6 },
    ];
    expect(
      withRpn(effects, [{ id: 'c', description: '', occurrence: 4 }])[0].rpn,
    ).toBe(8 * 4 * 6);
    expect(
      withRpn([], [{ id: 'c', description: '', occurrence: 2 }])[0].rpn,
    ).toBe(5 * 2 * 5);
  });
});
