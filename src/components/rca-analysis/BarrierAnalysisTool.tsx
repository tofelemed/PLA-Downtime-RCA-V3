import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, CheckCircle, FileCheck, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { BarrierAnalysis, RCAAnalysisConfig } from '../../types/RCAKnowledgeBase';

interface BarrierAnalysisToolProps {
  rcaId: string;
  initialHazard: string;
  onSave: (analysis: BarrierAnalysis) => void;
  existingAnalysis?: BarrierAnalysis | null;
  config?: RCAAnalysisConfig | null;
}

export const BarrierAnalysisTool: React.FC<BarrierAnalysisToolProps> = ({
  rcaId,
  initialHazard,
  onSave,
  existingAnalysis,
}) => {
  const { toast } = useToast();
  const [hazard, setHazard] = useState(existingAnalysis?.hazard || initialHazard);
  const [barriers, setBarriers] = useState(existingAnalysis?.barriers || []);
  const [isSaving, setIsSaving] = useState(false);

  const addBarrier = () => {
    setBarriers([
      ...barriers,
      {
        id: `barrier-${Date.now()}`,
        type: 'Prevention' as const,
        description: '',
        effectiveness: 'Moderate' as const,
        failureReason: '',
        recommendations: [],
      },
    ]);
  };

  const handleSave = async () => {
    if (!hazard.trim()) {
      toast({ title: 'Hazard description required', variant: 'destructive' });
      return;
    }
    if (barriers.length === 0) {
      toast({ title: 'Add at least one barrier', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      onSave({ rcaId, hazard, barriers } as BarrierAnalysis);
    } finally {
      setIsSaving(false);
    }
  };

  const failedBarriers = barriers.filter((b) => b.effectiveness === 'Failed').length;

  return (
    <Card className="border-2 border-teal-300 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-teal-50 to-cyan-50 border-b">
        <CardTitle className="flex items-center gap-2 text-xl">
          <Shield className="w-6 h-6 text-teal-600" />
          Barrier Analysis
          {existingAnalysis && (
            <Badge variant="outline" className="ml-2">
              <FileCheck className="w-3 h-3 mr-1" /> Saved
            </Badge>
          )}
        </CardTitle>
        <CardDescription>Identify failed or weak barriers that allowed the incident to occur</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <div>
          <Label>Hazard / Undesired Event *</Label>
          <Textarea
            value={hazard}
            onChange={(e) => setHazard(e.target.value)}
            placeholder="What hazard or energy source was involved?"
            rows={2}
            className="mt-1"
          />
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">Safety Barriers</Label>
          <Button size="sm" variant="outline" onClick={addBarrier}>
            <Plus className="w-4 h-4 mr-1" /> Add Barrier
          </Button>
        </div>

        <div className="space-y-3">
          {barriers.map((barrier, idx) => (
            <div
              key={barrier.id}
              className={`p-3 border rounded-lg space-y-2 ${
                barrier.effectiveness === 'Failed' ? 'border-red-300 bg-red-50' : 'bg-gray-50'
              }`}
            >
              <div className="flex justify-between items-center">
                <Badge variant="secondary">Barrier {idx + 1}</Badge>
                <Button size="sm" variant="ghost" onClick={() => setBarriers(barriers.filter((b) => b.id !== barrier.id))}>
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Type</Label>
                  <Select
                    value={barrier.type}
                    onValueChange={(v) => {
                      const u = [...barriers];
                      u[idx].type = v as BarrierAnalysis['barriers'][0]['type'];
                      setBarriers(u);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Prevention">Prevention</SelectItem>
                      <SelectItem value="Detection">Detection</SelectItem>
                      <SelectItem value="Mitigation">Mitigation</SelectItem>
                      <SelectItem value="Recovery">Recovery</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Effectiveness</Label>
                  <Select
                    value={barrier.effectiveness}
                    onValueChange={(v) => {
                      const u = [...barriers];
                      u[idx].effectiveness = v as BarrierAnalysis['barriers'][0]['effectiveness'];
                      setBarriers(u);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Strong">Strong</SelectItem>
                      <SelectItem value="Moderate">Moderate</SelectItem>
                      <SelectItem value="Weak">Weak</SelectItem>
                      <SelectItem value="Failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Textarea
                value={barrier.description}
                onChange={(e) => {
                  const u = [...barriers];
                  u[idx].description = e.target.value;
                  setBarriers(u);
                }}
                placeholder="Describe the barrier (procedure, interlock, training, etc.)"
                rows={2}
              />
              {barrier.effectiveness === 'Failed' && (
                <Input
                  value={barrier.failureReason || ''}
                  onChange={(e) => {
                    const u = [...barriers];
                    u[idx].failureReason = e.target.value;
                    setBarriers(u);
                  }}
                  placeholder="Why did this barrier fail?"
                />
              )}
              <Input
                value={barrier.recommendations.join('; ')}
                onChange={(e) => {
                  const u = [...barriers];
                  u[idx].recommendations = e.target.value.split(';').map((s) => s.trim()).filter(Boolean);
                  setBarriers(u);
                }}
                placeholder="Recommendations (semicolon-separated)"
              />
            </div>
          ))}
        </div>

        {failedBarriers > 0 && (
          <Badge variant="destructive">{failedBarriers} failed barrier(s) identified</Badge>
        )}

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving}>
            <CheckCircle className="w-4 h-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Barrier Analysis'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default BarrierAnalysisTool;
