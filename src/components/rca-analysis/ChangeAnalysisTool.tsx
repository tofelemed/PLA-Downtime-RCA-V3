import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, CheckCircle, FileCheck, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ChangeAnalysis, RCAAnalysisConfig } from '../../types/RCAKnowledgeBase';

interface ChangeAnalysisToolProps {
  rcaId: string;
  initialQuestion?: string;
  onSave: (analysis: ChangeAnalysis) => void;
  existingAnalysis?: ChangeAnalysis | null;
  config?: RCAAnalysisConfig | null;
}

export const ChangeAnalysisTool: React.FC<ChangeAnalysisToolProps> = ({
  rcaId,
  initialQuestion = 'What changed before this incident?',
  onSave,
  existingAnalysis,
}) => {
  const { toast } = useToast();
  const [question, setQuestion] = useState(existingAnalysis?.question || initialQuestion);
  const [changes, setChanges] = useState(existingAnalysis?.changes || []);
  const [isSaving, setIsSaving] = useState(false);

  const addChange = () => {
    setChanges([
      ...changes,
      {
        id: `change-${Date.now()}`,
        category: 'Process' as const,
        description: '',
        changeDate: new Date().toISOString().split('T')[0],
        relatedToIncident: false,
        impactLevel: 'Medium' as const,
        evidence: [],
      },
    ]);
  };

  const handleSave = async () => {
    if (!question.trim()) {
      toast({ title: 'Analysis question required', variant: 'destructive' });
      return;
    }
    if (changes.length === 0) {
      toast({ title: 'Add at least one change record', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      onSave({ rcaId, question, changes } as ChangeAnalysis);
    } finally {
      setIsSaving(false);
    }
  };

  const relatedCount = changes.filter((c) => c.relatedToIncident).length;

  return (
    <Card className="border-2 border-rose-300 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-rose-50 to-pink-50 border-b">
        <CardTitle className="flex items-center gap-2 text-xl">
          <RefreshCw className="w-6 h-6 text-rose-600" />
          Change Analysis
          {existingAnalysis && (
            <Badge variant="outline" className="ml-2">
              <FileCheck className="w-3 h-3 mr-1" /> Saved
            </Badge>
          )}
        </CardTitle>
        <CardDescription>Identify changes that may have contributed to the incident</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <div>
          <Label>Analysis Question *</Label>
          <Input value={question} onChange={(e) => setQuestion(e.target.value)} className="mt-1" />
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">Changes Identified</Label>
          <Button size="sm" variant="outline" onClick={addChange}>
            <Plus className="w-4 h-4 mr-1" /> Add Change
          </Button>
        </div>

        <div className="space-y-3">
          {changes.map((change, idx) => (
            <div
              key={change.id}
              className={`p-3 border rounded-lg space-y-2 ${
                change.relatedToIncident ? 'border-orange-300 bg-orange-50' : 'bg-gray-50'
              }`}
            >
              <div className="flex justify-between items-center">
                <Badge variant="secondary">Change {idx + 1}</Badge>
                <Button size="sm" variant="ghost" onClick={() => setChanges(changes.filter((c) => c.id !== change.id))}>
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Category</Label>
                  <Select
                    value={change.category}
                    onValueChange={(v) => {
                      const u = [...changes];
                      u[idx].category = v as ChangeAnalysis['changes'][0]['category'];
                      setChanges(u);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['People', 'Equipment', 'Process', 'Materials', 'Environment', 'Management'].map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Change Date</Label>
                  <Input
                    type="date"
                    value={change.changeDate?.split('T')[0] || ''}
                    onChange={(e) => {
                      const u = [...changes];
                      u[idx].changeDate = e.target.value;
                      setChanges(u);
                    }}
                  />
                </div>
              </div>
              <Textarea
                value={change.description}
                onChange={(e) => {
                  const u = [...changes];
                  u[idx].description = e.target.value;
                  setChanges(u);
                }}
                placeholder="Describe what changed..."
                rows={2}
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Impact Level</Label>
                  <Select
                    value={change.impactLevel}
                    onValueChange={(v) => {
                      const u = [...changes];
                      u[idx].impactLevel = v as ChangeAnalysis['changes'][0]['impactLevel'];
                      setChanges(u);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="High">High</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="Low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={change.relatedToIncident}
                      onChange={(e) => {
                        const u = [...changes];
                        u[idx].relatedToIncident = e.target.checked;
                        setChanges(u);
                      }}
                      className="w-4 h-4"
                    />
                    Related to incident
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>

        {relatedCount > 0 && (
          <Badge className="bg-orange-600">{relatedCount} change(s) marked as related to incident</Badge>
        )}

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving}>
            <CheckCircle className="w-4 h-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Change Analysis'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ChangeAnalysisTool;
