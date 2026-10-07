// 5-Why Analysis Tool Component - Industry Standard RCA Tool
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, ChevronRight, CheckCircle, AlertTriangle, HelpCircle, Lightbulb, ArrowDown, Target, Shield, TrendingDown, FileCheck, Download, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { FiveWhyAnalysis as FiveWhyData, RCAAnalysisConfig } from '../../types/RCAKnowledgeBase';
import { rcaAnalysisConfigService } from '../../services/RCAAnalysisConfigService';

interface FiveWhyAnalysisProps {
  rcaId: string;
  initialProblem: string;
  onSave: (analysis: FiveWhyData) => void;
  existingAnalysis?: FiveWhyData | null;
  config?: RCAAnalysisConfig | null;
}

export const FiveWhyAnalysisTool: React.FC<FiveWhyAnalysisProps> = ({
  rcaId,
  initialProblem,
  onSave,
  existingAnalysis,
  config
}) => {
  const { toast } = useToast();
  const [problem, setProblem] = useState(initialProblem);
  const [whyLevels, setWhyLevels] = useState<FiveWhyData['whyLevels']>(
    existingAnalysis?.whyLevels || [
      { level: 1, question: 'Why did this happen?', answer: '', justification: '', evidence: [] }
    ]
  );
  const [rootCause, setRootCause] = useState(existingAnalysis?.rootCause || '');
  const [isSaving, setIsSaving] = useState(false);

  const minimumDepth = config?.fiveWhyConfig.minimumDepth || 5;
  const requireJustification = config?.fiveWhyConfig.requireJustification || false;

  const addWhyLevel = () => {
    const nextLevel = whyLevels.length + 1;
    const previousAnswer = whyLevels[whyLevels.length - 1].answer || 'this';
    setWhyLevels([
      ...whyLevels,
      {
        level: nextLevel,
        question: `Why did "${previousAnswer}" happen?`,
        answer: '',
        justification: '',
        evidence: []
      }
    ]);
  };

  const updateWhyLevel = (index: number, field: keyof FiveWhyData['whyLevels'][0], value: string) => {
    const updated = [...whyLevels];
    (updated[index] as any)[field] = value;
    
    // Auto-update next level's question if this answer changed
    if (field === 'answer' && index < whyLevels.length - 1) {
      updated[index + 1].question = `Why did "${value || 'this'}" happen?`;
    }
    
    setWhyLevels(updated);
  };

  const removeWhyLevel = (index: number) => {
    if (whyLevels.length <= 1) return;
    const updated = whyLevels.filter((_, i) => i !== index);
    // Re-number levels
    updated.forEach((level, i) => level.level = i + 1);
    setWhyLevels(updated);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Validation
      if (!problem.trim()) {
        toast({ title: 'Error', description: 'Problem statement is required', variant: 'destructive' });
        return;
      }

      if (whyLevels.length < minimumDepth) {
        toast({ 
          title: 'Incomplete Analysis', 
          description: `Please complete at least ${minimumDepth} "Why" levels`, 
          variant: 'destructive' 
        });
        return;
      }

      const incompleteLevel = whyLevels.find(w => !w.answer.trim());
      if (incompleteLevel) {
        toast({ 
          title: 'Incomplete Analysis', 
          description: `Please answer Why #${incompleteLevel.level}`, 
          variant: 'destructive' 
        });
        return;
      }

      if (requireJustification) {
        const missingJustification = whyLevels.find(w => !w.justification?.trim());
        if (missingJustification) {
          toast({ 
            title: 'Missing Justification', 
            description: `Please provide justification for Why #${missingJustification.level}`, 
            variant: 'destructive' 
          });
          return;
        }
      }

      if (!rootCause.trim()) {
        toast({ title: 'Error', description: 'Please identify the root cause', variant: 'destructive' });
        return;
      }

      const analysis: Omit<FiveWhyData, 'id' | 'createdAt' | 'updatedAt'> = {
        rcaId,
        problem,
        whyLevels,
        rootCause,
      };

      onSave(analysis as FiveWhyData);
      toast({ 
        title: '✅ Analysis Saved', 
        description: '5-Why Analysis has been saved successfully',
        duration: 3000 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const suggestRootCause = () => {
    const lastAnswer = whyLevels[whyLevels.length - 1]?.answer;
    if (lastAnswer && !rootCause) {
      setRootCause(lastAnswer);
      toast({ title: 'Suggestion Applied', description: 'Root cause populated from final "Why"' });
    }
  };

  const exportToText = () => {
    let text = `5-WHY ANALYSIS REPORT\n`;
    text += `${'='.repeat(60)}\n\n`;
    text += `Problem Statement:\n${problem}\n\n`;
    text += `Analysis Chain:\n`;
    text += `${'-'.repeat(60)}\n`;
    
    whyLevels.forEach((why, idx) => {
      text += `\nWhy #${why.level}: ${why.question}\n`;
      text += `Answer: ${why.answer}\n`;
      if (why.justification) {
        text += `Justification: ${why.justification}\n`;
      }
      if (idx < whyLevels.length - 1) {
        text += `   ↓\n`;
      }
    });
    
    text += `\n${'='.repeat(60)}\n`;
    text += `ROOT CAUSE IDENTIFIED:\n${rootCause}\n`;
    text += `${'='.repeat(60)}\n`;
    
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied!', description: 'Analysis report copied to clipboard' });
  };

  const isComplete = whyLevels.length >= minimumDepth && 
                     whyLevels.every(w => w.answer.trim()) && 
                     rootCause.trim();

  const completionPercentage = Math.round(
    ((whyLevels.filter(w => w.answer.trim()).length / minimumDepth) * 60 +
    (rootCause.trim() ? 40 : 0))
  );

  return (
    <div className="space-y-6">
      {/* Header Card with Industrial Design */}
      <Card className="border-2 border-blue-300 bg-gradient-to-br from-blue-50 via-white to-blue-50 shadow-lg">
        <CardHeader className="border-b-2 border-blue-200 bg-gradient-to-r from-blue-100 to-blue-50">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-3 text-2xl">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center shadow-md">
                  <HelpCircle className="w-6 h-6 text-white" />
                </div>
                <span className="bg-gradient-to-r from-blue-700 to-blue-500 bg-clip-text text-transparent font-bold">
                  5-Why Root Cause Analysis
                </span>
                {isComplete && (
                  <Badge className="ml-2 bg-gradient-to-r from-green-600 to-green-500 text-white shadow-md">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Complete
                  </Badge>
                )}
                {existingAnalysis && (
                  <Badge variant="outline" className="border-purple-300 text-purple-700">
                    <FileCheck className="w-3 h-3 mr-1" />
                    Previously Saved
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="mt-2 text-base">
                Systematic questioning technique to drill down to root causes. Industry standard method for problem-solving.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={exportToText}
              disabled={!isComplete}
              className="ml-4"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy Report
            </Button>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="font-medium text-gray-700">Analysis Progress</span>
              <span className="font-bold text-blue-700">{completionPercentage}%</span>
            </div>
            <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden shadow-inner">
              <div 
                className={`h-full transition-all duration-500 ${
                  completionPercentage === 100 
                    ? 'bg-gradient-to-r from-green-500 to-green-600' 
                    : 'bg-gradient-to-r from-blue-500 to-blue-600'
                }`}
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          {/* Problem Statement */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-lg p-5 shadow-md">
            <Label htmlFor="problem" className="font-bold flex items-center gap-2 text-base mb-3">
              <Target className="w-5 h-5 text-amber-600" />
              Problem Statement
              <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="problem"
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              placeholder="Clearly describe the problem or undesired event that occurred..."
              rows={3}
              className="font-medium text-base border-2 border-amber-300 focus:border-amber-500 bg-white"
            />
            <p className="text-xs text-gray-600 mt-2 italic">
              Tip: Be specific about what happened, when, and where. Example: "FCC regenerator air blower failed catastrophically on Jan 15, 2025"
            </p>
          </div>

          <Separator className="my-6" />

          {/* Why Levels - Industrial Design */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <TrendingDown className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-bold text-gray-800">Cause-Effect Chain</h3>
              <Badge variant="outline" className="ml-2">
                {whyLevels.length} of {minimumDepth} minimum
              </Badge>
            </div>

            {whyLevels.map((why, index) => (
              <div key={why.level} className="relative">
                <Card className={`border-l-8 shadow-md transition-all duration-300 hover:shadow-lg ${
                  why.answer 
                    ? 'border-l-green-500 bg-gradient-to-r from-green-50 to-white' 
                    : 'border-l-gray-300 bg-white'
                }`}>
                  <CardContent className="pt-5 pb-4 space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shadow-md ${
                          why.answer 
                            ? 'bg-gradient-to-br from-green-500 to-green-600 text-white' 
                            : 'bg-gradient-to-br from-gray-300 to-gray-400 text-gray-700'
                        }`}>
                          #{why.level}
                        </div>
                        <div>
                          <Badge variant={why.answer ? "default" : "secondary"} className="text-sm px-3 py-1">
                            Why Level {why.level}
                          </Badge>
                          {why.answer && (
                            <Badge className="ml-2 bg-green-100 text-green-700 border border-green-300">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Answered
                            </Badge>
                          )}
                        </div>
                      </div>
                      {whyLevels.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeWhyLevel(index)}
                          className="text-red-500 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>

                    {/* Question */}
                    <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded">
                      <Label className="text-sm font-semibold text-blue-800 flex items-center gap-2">
                        <HelpCircle className="w-4 h-4" />
                        {why.question}
                      </Label>
                    </div>

                    {/* Answer */}
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-gray-700">Answer / Cause Identified</Label>
                      <Input
                        value={why.answer}
                        onChange={(e) => updateWhyLevel(index, 'answer', e.target.value)}
                        placeholder="What caused this to happen?"
                        className="font-medium text-base border-2 focus:border-blue-500 h-12"
                      />
                    </div>

                    {/* Justification (if required) */}
                    {requireJustification && (
                      <div className="space-y-2 bg-yellow-50 border border-yellow-200 rounded p-3">
                        <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                          <Shield className="w-4 h-4 text-yellow-600" />
                          Evidence / Justification 
                          <span className="text-red-500">*</span>
                        </Label>
                        <Textarea
                          value={why.justification || ''}
                          onChange={(e) => updateWhyLevel(index, 'justification', e.target.value)}
                          placeholder="How do you know this? What data, observations, or evidence supports this answer?"
                          rows={2}
                          className="text-sm border-2 border-yellow-300 focus:border-yellow-500"
                        />
                      </div>
                    )}

                    {/* Continue indicator */}
                    {why.answer && index === whyLevels.length - 1 && (
                      <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 p-3 rounded border border-blue-200">
                        <ChevronRight className="w-4 h-4" />
                        <span className="font-medium">Ready for next level - Continue asking "Why?" or identify root cause</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Arrow between levels */}
                {index < whyLevels.length - 1 && (
                  <div className="flex justify-center my-2">
                    <ArrowDown className="w-6 h-6 text-blue-400 animate-bounce" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Add Why Button */}
          <Button
            onClick={addWhyLevel}
            variant="outline"
            size="lg"
            className="w-full border-2 border-dashed border-blue-300 hover:bg-blue-50 hover:border-blue-500 h-16"
            disabled={!whyLevels[whyLevels.length - 1]?.answer}
          >
            <Plus className="w-5 h-5 mr-2" />
            <span className="font-semibold">Add Level {whyLevels.length + 1} - Ask Another "Why?"</span>
          </Button>

          {whyLevels.length < minimumDepth && (
            <div className="flex items-center gap-3 text-sm bg-amber-50 border-2 border-amber-300 p-4 rounded-lg shadow">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <span className="font-medium text-amber-800">
                Please complete at least <strong>{minimumDepth - whyLevels.length}</strong> more level(s) to meet the minimum depth requirement for a thorough analysis
              </span>
            </div>
          )}

          <Separator className="my-6" />

          {/* Root Cause Section */}
          <div className="bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 border-2 border-orange-300 rounded-lg p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <Label htmlFor="rootCause" className="font-bold flex items-center gap-2 text-lg">
                <Target className="w-6 h-6 text-red-600" />
                Identified Root Cause
                <span className="text-red-500">*</span>
              </Label>
              {whyLevels.length >= minimumDepth && whyLevels[whyLevels.length - 1]?.answer && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={suggestRootCause}
                  className="border-blue-300 text-blue-700 hover:bg-blue-50"
                >
                  <Lightbulb className="w-4 h-4 mr-2" />
                  Use Final "Why"
                </Button>
              )}
            </div>
            <Textarea
              id="rootCause"
              value={rootCause}
              onChange={(e) => setRootCause(e.target.value)}
              placeholder="Based on the analysis above, what is the fundamental root cause that, if eliminated, would prevent recurrence?"
              rows={4}
              className="font-medium text-base border-2 border-orange-400 focus:border-red-500 bg-white shadow-inner"
            />
            <div className="mt-3 bg-white/70 p-3 rounded border border-orange-200">
              <p className="text-sm text-gray-700 font-medium">
                <strong>Guidelines:</strong> The root cause should be:
              </p>
              <ul className="text-sm text-gray-600 mt-2 space-y-1 ml-4">
                <li>• <strong>Specific</strong> and clearly defined</li>
                <li>• <strong>Actionable</strong> - something you can address</li>
                <li>• <strong>Preventable</strong> - can be eliminated or controlled</li>
                <li>• The <strong>fundamental</strong> reason, not just a symptom</li>
              </ul>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              onClick={handleSave}
              disabled={!isComplete || isSaving}
              size="lg"
              className="min-w-[200px] bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 shadow-lg"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Save Analysis
                </>
              )}
            </Button>
          </div>

          {/* Completion Checklist */}
          <Card className="bg-gradient-to-br from-gray-50 to-white border-2 border-gray-300 shadow-inner">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-700">Analysis Checklist</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  {whyLevels.length >= minimumDepth ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                  )}
                  <span className="text-sm font-medium">
                    Minimum depth: <strong>{whyLevels.length}/{minimumDepth}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {whyLevels.every(w => w.answer.trim()) ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                  )}
                  <span className="text-sm font-medium">All levels answered</span>
                </div>
                {requireJustification && (
                  <div className="flex items-center gap-3">
                    {whyLevels.every(w => w.justification?.trim()) ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-amber-600" />
                    )}
                    <span className="text-sm font-medium">All justifications provided</span>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  {rootCause.trim() ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                  )}
                  <span className="text-sm font-medium">Root cause identified</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
};

export default FiveWhyAnalysisTool;
