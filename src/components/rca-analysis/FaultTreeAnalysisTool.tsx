import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, CheckCircle, FileCheck, GitBranch } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { FaultTreeAnalysis, RCAAnalysisConfig } from '../../types/RCAKnowledgeBase';

interface FaultTreeAnalysisToolProps {
  rcaId: string;
  initialTopEvent: string;
  onSave: (analysis: FaultTreeAnalysis) => void;
  existingAnalysis?: FaultTreeAnalysis | null;
  config?: RCAAnalysisConfig | null;
}

export const FaultTreeAnalysisTool: React.FC<FaultTreeAnalysisToolProps> = ({
  rcaId,
  initialTopEvent,
  onSave,
  existingAnalysis,
}) => {
  const { toast } = useToast();
  const [topEvent, setTopEvent] = useState(existingAnalysis?.topEvent || initialTopEvent);
  const [nodes, setNodes] = useState(existingAnalysis?.nodes || []);
  const [isSaving, setIsSaving] = useState(false);

  const addNode = () => {
    setNodes([
      ...nodes,
      {
        id: `node-${Date.now()}`,
        type: 'BasicEvent' as const,
        description: '',
        parentId: undefined,
        probability: undefined,
        children: [],
      },
    ]);
  };

  const handleSave = async () => {
    if (!topEvent.trim()) {
      toast({ title: 'Top event required', variant: 'destructive' });
      return;
    }
    if (nodes.length === 0) {
      toast({ title: 'Add at least one fault tree node', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      onSave({ rcaId, topEvent, nodes } as FaultTreeAnalysis);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="border-2 border-indigo-300 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50 border-b">
        <CardTitle className="flex items-center gap-2 text-xl">
          <GitBranch className="w-6 h-6 text-indigo-600" />
          Fault Tree Analysis
          {existingAnalysis && (
            <Badge variant="outline" className="ml-2">
              <FileCheck className="w-3 h-3 mr-1" /> Saved
            </Badge>
          )}
        </CardTitle>
        <CardDescription>Top-down deductive analysis from undesired top event to basic causes</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <div>
          <Label>Top Event (Undesired Outcome) *</Label>
          <Input value={topEvent} onChange={(e) => setTopEvent(e.target.value)} className="mt-1" />
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">Fault Tree Nodes</Label>
          <Button size="sm" variant="outline" onClick={addNode}>
            <Plus className="w-4 h-4 mr-1" /> Add Node
          </Button>
        </div>

        <div className="space-y-3">
          {nodes.map((node, idx) => (
            <div key={node.id} className="p-3 border rounded-lg bg-gray-50 space-y-2">
              <div className="flex justify-between items-center">
                <Badge variant="secondary">Node {idx + 1}</Badge>
                <Button size="sm" variant="ghost" onClick={() => setNodes(nodes.filter((n) => n.id !== node.id))}>
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </div>
              <Input
                value={node.description}
                onChange={(e) => {
                  const u = [...nodes];
                  u[idx].description = e.target.value;
                  setNodes(u);
                }}
                placeholder="Event or gate description"
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Node Type</Label>
                  <Select
                    value={node.type}
                    onValueChange={(v) => {
                      const u = [...nodes];
                      u[idx].type = v as FaultTreeAnalysis['nodes'][0]['type'];
                      setNodes(u);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AND">AND Gate</SelectItem>
                      <SelectItem value="OR">OR Gate</SelectItem>
                      <SelectItem value="Event">Intermediate Event</SelectItem>
                      <SelectItem value="BasicEvent">Basic Event</SelectItem>
                      <SelectItem value="UndevelopedEvent">Undeveloped Event</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Parent Node</Label>
                  <Select
                    value={node.parentId || 'none'}
                    onValueChange={(v) => {
                      const u = [...nodes];
                      u[idx].parentId = v === 'none' ? undefined : v;
                      setNodes(u);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="None (root)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (root level)</SelectItem>
                      {nodes
                        .filter((n) => n.id !== node.id)
                        .map((n) => (
                          <SelectItem key={n.id} value={n.id}>
                            {n.description || n.id}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {(node.type === 'BasicEvent' || node.type === 'Event') && (
                <div>
                  <Label className="text-xs">Probability (0-1, optional)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    value={node.probability ?? ''}
                    onChange={(e) => {
                      const u = [...nodes];
                      u[idx].probability = e.target.value ? Number(e.target.value) : undefined;
                      setNodes(u);
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving}>
            <CheckCircle className="w-4 h-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Fault Tree'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default FaultTreeAnalysisTool;
