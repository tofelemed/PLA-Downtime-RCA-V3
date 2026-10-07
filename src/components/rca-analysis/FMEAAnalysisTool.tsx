import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, AlertTriangle, CheckCircle, FileCheck, ClipboardList } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { FMEAAnalysis, RCAAnalysisConfig } from '../../types/RCAKnowledgeBase';

interface FMEAAnalysisToolProps {
  rcaId: string;
  initialFailureMode: string;
  onSave: (analysis: FMEAAnalysis) => void;
  existingAnalysis?: FMEAAnalysis | null;
  config?: RCAAnalysisConfig | null;
}

export const FMEAAnalysisTool: React.FC<FMEAAnalysisToolProps> = ({
  rcaId,
  initialFailureMode,
  onSave,
  existingAnalysis,
  config,
}) => {
  const { toast } = useToast();
  const riskThreshold = config?.fmeaConfig?.riskThreshold ?? 100;
  const [failureMode, setFailureMode] = useState(existingAnalysis?.failureMode || initialFailureMode);
  const [effects, setEffects] = useState(existingAnalysis?.effects || []);
  const [causes, setCauses] = useState(existingAnalysis?.causes || []);
  const [isSaving, setIsSaving] = useState(false);

  const addEffect = () => {
    setEffects([
      ...effects,
      {
        id: `eff-${Date.now()}`,
        description: '',
        severity: 5,
        currentControls: '',
        detection: 5,
      },
    ]);
  };

  const addCause = () => {
    const maxSeverity = effects.length ? Math.max(...effects.map((e) => e.severity)) : 5;
    const maxDetection = effects.length ? Math.max(...effects.map((e) => e.detection)) : 5;
    setCauses([
      ...causes,
      {
        id: `cause-${Date.now()}`,
        description: '',
        occurrence: 5,
        rpn: maxSeverity * 5 * maxDetection,
        recommendedActions: [],
      },
    ]);
  };

  const updateCause = (index: number, field: string, value: string | number) => {
    const updated = [...causes];
    (updated[index] as any)[field] = value;
    if (field === 'occurrence' || field === 'description') {
      const maxSeverity = effects.length ? Math.max(...effects.map((e) => e.severity)) : 5;
      const maxDetection = effects.length ? Math.max(...effects.map((e) => e.detection)) : 5;
      updated[index].rpn = maxSeverity * Number(updated[index].occurrence) * maxDetection;
    }
    setCauses(updated);
  };

  const handleSave = async () => {
    if (!failureMode.trim()) {
      toast({ title: 'Failure mode required', variant: 'destructive' });
      return;
    }
    if (effects.length === 0 || causes.length === 0) {
      toast({ title: 'Add at least one effect and one cause', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      onSave({ rcaId, failureMode, effects, causes } as FMEAAnalysis);
    } finally {
      setIsSaving(false);
    }
  };

  const highRpnCount = causes.filter((c) => c.rpn >= riskThreshold).length;

  return (
    <Card className="border-2 border-amber-300 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 border-b">
        <CardTitle className="flex items-center gap-2 text-xl">
          <ClipboardList className="w-6 h-6 text-amber-600" />
          FMEA Analysis
          {existingAnalysis && (
            <Badge variant="outline" className="ml-2">
              <FileCheck className="w-3 h-3 mr-1" /> Saved
            </Badge>
          )}
        </CardTitle>
        <CardDescription>Failure Mode and Effects Analysis — severity, occurrence, detection, RPN</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <div>
          <Label>Failure Mode *</Label>
          <Input
            value={failureMode}
            onChange={(e) => setFailureMode(e.target.value)}
            placeholder="How could this component/process fail?"
            className="mt-1"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-base font-semibold">Effects</Label>
            <Button size="sm" variant="outline" onClick={addEffect}>
              <Plus className="w-4 h-4 mr-1" /> Add Effect
            </Button>
          </div>
          <div className="space-y-3">
            {effects.map((effect, idx) => (
              <div key={effect.id} className="p-3 border rounded-lg bg-gray-50 space-y-2">
                <div className="flex justify-between">
                  <Badge variant="secondary">Effect {idx + 1}</Badge>
                  <Button size="sm" variant="ghost" onClick={() => setEffects(effects.filter((e) => e.id !== effect.id))}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
                <Textarea
                  value={effect.description}
                  onChange={(e) => {
                    const u = [...effects];
                    u[idx].description = e.target.value;
                    setEffects(u);
                  }}
                  placeholder="Effect on operation, safety, environment..."
                  rows={2}
                />
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Severity (1-10)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={effect.severity}
                      onChange={(e) => {
                        const u = [...effects];
                        u[idx].severity = Number(e.target.value);
                        setEffects(u);
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Detection (1-10)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={effect.detection}
                      onChange={(e) => {
                        const u = [...effects];
                        u[idx].detection = Number(e.target.value);
                        setEffects(u);
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Current Controls</Label>
                    <Input
                      value={effect.currentControls}
                      onChange={(e) => {
                        const u = [...effects];
                        u[idx].currentControls = e.target.value;
                        setEffects(u);
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-base font-semibold">Causes & RPN</Label>
            <Button size="sm" variant="outline" onClick={addCause}>
              <Plus className="w-4 h-4 mr-1" /> Add Cause
            </Button>
          </div>
          <div className="space-y-3">
            {causes.map((cause, idx) => (
              <div
                key={cause.id}
                className={`p-3 border rounded-lg space-y-2 ${
                  cause.rpn >= riskThreshold ? 'border-red-300 bg-red-50' : 'bg-gray-50'
                }`}
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Cause {idx + 1}</Badge>
                    <Badge className={cause.rpn >= riskThreshold ? 'bg-red-600' : 'bg-green-600'}>
                      RPN: {cause.rpn}
                    </Badge>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setCauses(causes.filter((c) => c.id !== cause.id))}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
                <Textarea
                  value={cause.description}
                  onChange={(e) => updateCause(idx, 'description', e.target.value)}
                  placeholder="Potential cause of failure..."
                  rows={2}
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Occurrence (1-10)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={cause.occurrence}
                      onChange={(e) => updateCause(idx, 'occurrence', Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Recommended Actions</Label>
                    <Input
                      value={cause.recommendedActions.join('; ')}
                      onChange={(e) => {
                        const u = [...causes];
                        u[idx].recommendedActions = e.target.value.split(';').map((s) => s.trim()).filter(Boolean);
                        setCauses(u);
                      }}
                      placeholder="Action 1; Action 2"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {highRpnCount > 0 && (
          <div className="flex items-center gap-2 text-amber-800 bg-amber-50 p-3 rounded border border-amber-200">
            <AlertTriangle className="w-5 h-5" />
            {highRpnCount} cause(s) exceed RPN threshold ({riskThreshold})
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving}>
            <CheckCircle className="w-4 h-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save FMEA'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default FMEAAnalysisTool;
