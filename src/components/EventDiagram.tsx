import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  addEdge,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  Connection,
  ReactFlowProvider,
  NodeProps,
  useReactFlow,
  Handle,
  Position,
  NodeResizer,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Plus, Trash2, Edit2, AlertTriangle, FileText, Clock, Users, Wrench, Eye, ClipboardList, Info } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Select } from './ui/select';
import { Label } from './ui/label';

// Extended event types and icons
const eventTypeIcons = {
  Failure: <AlertTriangle className="w-5 h-5 text-red-500" />,
  Alarm: <Clock className="w-5 h-5 text-yellow-500" />,
  Action: <Users className="w-5 h-5 text-blue-500" />,
  Note: <FileText className="w-5 h-5 text-gray-500" />,
  Maintenance: <Wrench className="w-5 h-5 text-green-700" />,
  Inspection: <Eye className="w-5 h-5 text-purple-500" />,
  'Operator Action': <ClipboardList className="w-5 h-5 text-pink-500" />,
  Info: <Info className="w-5 h-5 text-cyan-500" />,
};

const eventTypeOptions = [
  'Failure',
  'Alarm',
  'Action',
  'Note',
  'Maintenance',
  'Inspection',
  'Operator Action',
  'Info',
];

const severityOptions = ['Low', 'Medium', 'High', 'Critical'];

const nodeStyle = {
  borderRadius: 16,
  padding: 12,
  background: 'linear-gradient(135deg, #e0e7ff 0%, #fce7f3 100%)',
  border: '2px solid #a5b4fc',
  boxShadow: '0 4px 16px rgba(59,130,246,0.08)',
};

export type EventNodeData = {
  label: string;
  type: string;
  timestamp: string;
  description?: string;
  asset?: string;
  severity?: string;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
};

export interface EventDiagramProps {
  nodes: Node<EventNodeData>[];
  edges: Edge[];
  assets: any[];
  units: any[];
  onNodesChange?: (nodes: Node<EventNodeData>[]) => void;
  onEdgesChange?: (edges: Edge[]) => void;
  onAddEvent?: () => void;
  onEditEvent?: (node: NodeProps<EventNodeData>) => void;
  onDeleteEvent?: (node: NodeProps<EventNodeData>) => void;
  onConnect?: (connection: Connection) => void;
}

const initialNodes: Node<EventNodeData>[] = [
  // {
  //   id: '1',
  //   type: 'default',
  //   position: { x: 0, y: 0 },
  //   data: {
  //     label: 'Pump Failure',
  //     type: 'Failure',
  //     timestamp: '2024-06-01T10:00:00Z',
  //     description: 'Pump A failed',
  //     asset: 'Pump A',
  //     severity: 'High',
  //   },
  //   style: nodeStyle,
  // },
  // {
  //   id: '2',
  //   type: 'default',
  //   position: { x: 250, y: 100 },
  //   data: {
  //     label: 'High Vibration Alarm',
  //     type: 'Alarm',
  //     timestamp: '2024-06-01T10:05:00Z',
  //     description: 'Alarm triggered for high vibration',
  //     asset: 'Pump A',
  //     severity: 'Medium',
  //   },
  //   style: nodeStyle,
  // },
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', animated: true, style: { stroke: '#6366f1' } },
];

// Move nodeTypes outside the component to avoid recreation on every render
const BASE_WIDTH = 180;
const BASE_HEIGHT = 100;

const ResizableEventNode = (props: NodeProps<EventNodeData>) => {
  const { id, data, selected } = props;
  const width = (props as any).width || 180;
  const height = (props as any).height || 100;

  return (
    <div
      style={{
      //  width,
       // height,
        minWidth: 60,
        minHeight: 40,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        //position: 'relative',
      }}
    >
      <NodeResizer
        color="#6366f1"
        isVisible={!!selected}
        minWidth={60}
        minHeight={40}
        lineStyle={{ borderRadius: 8 }}
        handleStyle={{ width: 12, height: 12, borderRadius: 6, background: '#6366f1' }}
      />
      <div
        className="select-none"
        style={{
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        {/* Handles for connecting nodes */}
        <Handle type="target" position={Position.Top} id={`${id}-t`} isConnectable={true} style={{ background: '#6366f1', width: 12, height: 12, borderRadius: 6, top: -8 }} />
        <Handle type="source" position={Position.Bottom} id={`${id}-b`} isConnectable={true} style={{ background: '#6366f1', width: 12, height: 12, borderRadius: 6, bottom: -8 }} />
        <div className="flex items-center gap-2 mb-1">
          {eventTypeIcons[data.type] || <FileText className="w-5 h-5 text-gray-400" />}
          <span
            className="font-bold text-blue-900"
            style={{
              fontSize: `clamp(10px, ${width / 12}px, 1.2rem)`,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: width - 40,
            }}
          >
            {data.label}
          </span>
        </div>
        <div
          className="text-xs text-gray-500 mb-1"
          style={{ fontSize: `clamp(8px, ${width / 18}px, 1rem)` }}
        >
          {data.timestamp ? new Date(data.timestamp).toLocaleString() : ''}
        </div>
        <div
          className="text-xs text-gray-700 mb-1"
          style={{ fontSize: `clamp(8px, ${width / 18}px, 1rem)` }}
        >
          {data.description}
        </div>
        <div className="flex flex-wrap gap-2 mt-1">
          {data.asset && (
            <span className="inline-block px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-xs font-semibold">
              {data.asset}
            </span>
          )}
          {data.severity && (
            <span
              className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                data.severity === 'High'
                  ? 'bg-red-100 text-red-700'
                  : data.severity === 'Medium'
                  ? 'bg-yellow-100 text-yellow-700'
                  : data.severity === 'Critical'
                  ? 'bg-red-700 text-white'
                  : 'bg-green-100 text-green-700'
              }`}
            >
              {data.severity}
            </span>
          )}
        </div>
        <div className="flex gap-2 mt-2">
          <button
            className="p-1 rounded hover:bg-green-100"
            title="Edit"
            type="button"
            onClick={() => {
              if (data.onEdit) data.onEdit(id);
            }}
            style={{ fontSize: `clamp(10px, ${width / 18}px, 1rem)` }}
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            className="p-1 rounded hover:bg-red-100"
            title="Delete"
            type="button"
            onClick={() => {
              if (data.onDelete) data.onDelete(id);
            }}
            style={{ fontSize: `clamp(10px, ${width / 18}px, 1rem)` }}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

const nodeTypes = {
  default: ResizableEventNode,
};

export const EventDiagram: React.FC<EventDiagramProps & { filterNodeIds?: string[] }> = ({
  nodes: propNodes,
  edges: propEdges,
  assets,
  units,
  onNodesChange,
  onEdgesChange,
  onAddEvent,
  onEditEvent,
  onDeleteEvent,
  onConnect,
  filterNodeIds,
}) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [nodes, setNodes, onNodesChangeInternal] = useNodesState(propNodes && propNodes.length > 0 ? propNodes : initialNodes);
  const [edges, setEdges, onEdgesChangeInternal] = useEdgesState(propEdges && propEdges.length > 0 ? propEdges : initialEdges);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingNode, setEditingNode] = useState<Node<EventNodeData> | null>(null);
  const [form, setForm] = useState<EventNodeData>({ label: '', type: 'Failure', timestamp: '', description: '', asset: '', severity: 'Medium' });
  const [formError, setFormError] = useState<string | null>(null);

  // Legend/help toggle
  const [showLegend, setShowLegend] = useState(false);

  const handleConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#6366f1' } }, eds));
      onConnect && onConnect(params);
    },
    [setEdges, onConnect]
  );

  // Handler to delete an edge
  const handleEdgeClick = useCallback((event, edge) => {
    event.stopPropagation();
    if (window.confirm('Delete this connection?')) {
      setEdges((eds) => {
        const updated = eds.filter(e => e.id !== edge.id);
        onEdgesChange && onEdgesChange(updated);
        return updated;
      });
    }
  }, [setEdges, onEdgesChange]);

  // Filter nodes/edges if filterNodeIds is provided
  const filteredNodes = useMemo(() => {
    if (!filterNodeIds) return nodes;
    return nodes.filter(n => filterNodeIds.includes(n.id));
  }, [nodes, filterNodeIds]);


  // In EventDiagram, when creating normalizedNodes, inject onEdit and onDelete handlers into node.data
  // In normalizedNodes, pass onEdit/onDelete as functions that receive node id
  const normalizedNodes = filteredNodes.map((n) => ({
    ...n,
    type: 'default',
    position: n.position || { x: 100, y: 100 },
    width: n.width,
    height: n.height,
    data: {
      ...n.data,
      onEdit: (id: string) => handleEditNodeById(id),
      onDelete: (id: string) => handleDeleteNodeById(id),
    },
  }));

  const filteredEdges = useMemo(() => {
    if (!filterNodeIds) return edges;
    return edges.filter(e => filterNodeIds.includes(e.source) && filterNodeIds.includes(e.target));
  }, [edges, filterNodeIds]);

  // Only fit view on initial load or when the set of node IDs changes
  const prevNodeIds = useRef<string[]>([]);
  useEffect(() => {
    const currentNodeIds = nodes.map(n => n.id).sort();
    if (
      reactFlowInstance &&
      nodes.length > 0 &&
      (prevNodeIds.current.length === 0 ||
        prevNodeIds.current.join(',') !== currentNodeIds.join(','))
    ) {
      setTimeout(() => {
        try {
          reactFlowInstance.fitView({ padding: 0.2, includeHiddenNodes: false });
        } catch (e) { /* ignore */ }
      }, 100);
      prevNodeIds.current = currentNodeIds;
    }
  }, [reactFlowInstance, nodes]);

  // Add/Edit modal handlers
  const handleModalSave = () => {
    // Validation
    if (!form.label.trim()) {
      setFormError('Label is required.');
      return;
    }
    if (!form.type) {
      setFormError('Type is required.');
      return;
    }
    if (!form.timestamp) {
      setFormError('Timestamp is required.');
      return;
    }
    if (!form.asset) {
      setFormError('Asset/Unit is required.');
      return;
    }
    setFormError(null);
    if (modalMode === 'add') {
      const newNode: Node<EventNodeData> = {
        id: (Math.random() * 1e8).toFixed(0),
        type: 'default',
        position: { x: 100, y: 100 }, // always set position
        data: { ...form },
        style: nodeStyle,
      };
      setNodes((nds) => {
        const updated = [...nds, newNode];
        onNodesChange && onNodesChange(updated);
        return updated;
      });
    } else if (modalMode === 'edit' && editingNode) {
      setNodes((nds) => {
        const updated = nds.map(n => n.id === editingNode.id ? { ...n, data: { ...form }, position: n.position || { x: 100, y: 100 } } : n);
        onNodesChange && onNodesChange(updated);
        return updated;
      });
    }
    setShowModal(false);
    setEditingNode(null);
    setForm({ label: '', type: 'Failure', timestamp: '', description: '', asset: '', severity: 'Medium' });
  };

  // Add event button handler
  const handleAddEvent = () => {
    setModalMode('add');
    setEditingNode(null);
    setForm({ label: '', type: 'Failure', timestamp: '', description: '', asset: '', severity: 'Medium' });
    setShowModal(true);
  };

  // Edit and delete handlers by node id
  const handleEditNodeById = (id: string) => {
    const node = nodes.find(n => n.id === id);
    if (!node) return;
    setModalMode('edit');
    setEditingNode(node);
    setForm({ ...node.data });
    setShowModal(true);
  };
  const handleDeleteNodeById = (id: string) => {
    const node = nodes.find(n => n.id === id);
    if (!node) return;
    if (window.confirm('Delete event "' + node.data.label + '"?')) {
      setNodes((nds) => {
        const updated = nds.filter(n => n.id !== id);
        onNodesChange && onNodesChange(updated);
        return updated;
      });
      setEdges((eds) => {
        const updated = eds.filter(e => e.source !== id && e.target !== id);
        onEdgesChange && onEdgesChange(updated);
        return updated;
      });
    }
  };

  return (
    <ReactFlowProvider>
      <div className="w-full h-[500px] bg-gradient-to-br from-blue-100/40 via-white/80 to-pink-100/40 rounded-3xl border border-blue-100 shadow-xl p-4 relative" ref={reactFlowWrapper}>
        <button
          className="absolute top-4 right-8 z-10 flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-600 to-pink-500 text-white font-bold shadow-lg hover:from-blue-700 hover:to-pink-600 transition"
          onClick={handleAddEvent}
        >
          <Plus className="w-5 h-5" /> Add Event
        </button>
        <button
          className="absolute top-4 left-8 z-10 flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-gray-200 to-blue-100 text-blue-700 font-bold shadow hover:bg-blue-50 transition"
          onClick={() => setShowLegend(l => !l)}
        >
          <Info className="w-5 h-5" /> Legend / Help
        </button>
        <ReactFlow
          nodes={normalizedNodes}
          edges={filteredEdges}
          onNodesChange={changes => {
            onNodesChangeInternal(changes);
            // Always persist the full, updated nodes array (with positions)
            if (onNodesChange) {
              // Apply all changes to the current nodes array
              let updatedNodes = nodes;
              changes.forEach(change => {
                if (change.type === 'position' && 'id' in change) {
                  updatedNodes = updatedNodes.map(n => n.id === change.id ? { ...n, position: change.position } : n);
                }
                if (change.type === 'dimensions' && 'id' in change) {
                  updatedNodes = updatedNodes.map(n => n.id === change.id ? { ...n, width: (change as any).width, height: (change as any).height } : n);
                }
                // Handle other change types if needed
              });
              onNodesChange(updatedNodes);
            }
          }}
          onEdgesChange={changes => {
            onEdgesChangeInternal(changes);
            if (onEdgesChange) {
              console.log('[EventDiagram] onEdgesChange - edges:', edges);
              onEdgesChange(edges);
            }
          }}
          onEdgeClick={handleEdgeClick}
          onConnect={params => {
            setEdges((eds) => {
              const newEdges = addEdge({ ...params, animated: true, style: { stroke: '#6366f1' } }, eds);
              if (onEdgesChange) {
                console.log('[EventDiagram] onConnect - newEdges:', newEdges);
                onEdgesChange(newEdges);
              }
              return newEdges;
            });
            onConnect && onConnect(params);
          }}
          nodeTypes={nodeTypes}
          fitView
          onInit={setReactFlowInstance}
          defaultViewport={{ x: 0, y: 0, zoom: 0.4 }}
          zoomOnDoubleClick={false}
          onDoubleClick={e => {
            if (reactFlowInstance) {
              reactFlowInstance.setViewport({ x: 0, y: 0, zoom: 0.5 });
            }
          }}
          panOnDrag={true}
          zoomOnScroll={true}
          zoomOnPinch={true}
        >
          <MiniMap nodeColor={() => '#00aaff'}
  nodeStrokeWidth={2}
  zoomable
  pannable
  style={{ height: 150, width: 200 }} />
          <Controls  />
          <Background gap={16} size={1} />
        </ReactFlow>
        {/* Legend/Help Section */}
        {showLegend && (
          <div className="absolute left-1/2 top-20 z-20 -translate-x-1/2 bg-white rounded-2xl shadow-2xl border border-blue-200 p-6 w-full max-w-lg">
            <h3 className="text-lg font-bold mb-2 flex items-center gap-2"><Info className="w-5 h-5 text-cyan-500" /> Event Diagram Legend</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              {eventTypeOptions.map(type => (
                <div key={type} className="flex items-center gap-2">
                  {eventTypeIcons[type]}
                  <span className="font-semibold text-sm">{type}</span>
                </div>
              ))}
            </div>
            <div className="text-xs text-gray-500 mb-2">- Drag nodes to reposition.<br/>- Click arrows to connect events.<br/>- Use the edit and delete buttons on each event.<br/>- Double-click background to reset view.<br/>- Use the Add Event button to create new events.</div>
            <Button size="sm" className="mt-2" onClick={() => setShowLegend(false)}>Close</Button>
          </div>
        )}
        {/* Add/Edit Modal */}
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{modalMode === 'add' ? 'Add Event' : 'Edit Event'}</DialogTitle>
              <DialogDescription>Fill in the event details below.</DialogDescription>
            </DialogHeader>
            <form className="space-y-3" onSubmit={e => { e.preventDefault(); handleModalSave(); }}>
              {formError && <div className="text-red-600 text-xs font-semibold mb-2">{formError}</div>}
              <div>
                <Label>Label</Label>
                <Input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} required />
              </div>
              <div>
                <Label>Type</Label>
                <select className="w-full border rounded px-2 py-2 mt-1" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} required>
                  {eventTypeOptions.map(type => <option key={type} value={type}>{type}</option>)}
                </select>
              </div>
              <div>
                <Label>Timestamp</Label>
                <Input type="datetime-local" value={form.timestamp} onChange={e => setForm(f => ({ ...f, timestamp: e.target.value }))} required />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div>
                <Label>Asset/Unit</Label>
                <select className="w-full border rounded px-2 py-2 mt-1" value={form.asset} onChange={e => setForm(f => ({ ...f, asset: e.target.value }))} required>
                  <option value="">Select...</option>
                  {assets.map(asset => <option key={asset.id} value={asset.name}>{asset.name}</option>)}
                  {units.map(unit => <option key={unit.id} value={unit.name}>{unit.name}</option>)}
                </select>
              </div>
              <div>
                <Label>Severity</Label>
                <select className="w-full border rounded px-2 py-2 mt-1" value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))} required>
                  {severityOptions.map(sev => <option key={sev} value={sev}>{sev}</option>)}
                </select>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button type="submit">{modalMode === 'add' ? 'Add' : 'Save'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </ReactFlowProvider>
  );
}; 