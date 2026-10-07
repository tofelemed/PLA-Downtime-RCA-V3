// Fishbone (Ishikawa) Diagram Tool - Industry Standard RCA Tool
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Save, AlertCircle, CheckCircle, Star, Copy, GitBranch, Target, TrendingUp, BarChart3, FileCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { FishboneDiagram, RCAAnalysisConfig } from '../../types/RCAKnowledgeBase';

interface FishboneDiagramToolProps {
  rcaId: string;
  initialEffect: string;
  onSave: (diagram: FishboneDiagram) => void;
  existingDiagram?: FishboneDiagram | null;
  config?: RCAAnalysisConfig | null;
}

export const FishboneDiagramTool: React.FC<FishboneDiagramToolProps> = ({
  rcaId,
  initialEffect,
  onSave,
  existingDiagram,
  config
}) => {
  const { toast } = useToast();
  const [effect, setEffect] = useState(initialEffect);
  const [isSaving, setIsSaving] = useState(false);
  
  const defaultCategories = config?.fishboneConfig.categories || [
    'Man (People)', 'Machine (Equipment)', 'Material', 'Method (Process)', 'Measurement', 'Environment'
  ];

  const [categories, setCategories] = useState<FishboneDiagram['categories']>(
    existingDiagram?.categories || defaultCategories.map(name => ({
      id: `cat-${Date.now()}-${name.replace(/[^a-z]/gi, '')}`,
      name,
      causes: []
    }))
  );

  const [isAddCauseDialogOpen, setIsAddCauseDialogOpen] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [newCause, setNewCause] = useState({
    description: '',
    isPrimary: true,
    likelihood: 'Medium' as 'High' | 'Medium' | 'Low'
  });

  const addCause = () => {
    if (!selectedCategoryId || !newCause.description.trim()) {
      toast({ title: 'Error', description: 'Please select category and enter cause', variant: 'destructive' });
      return;
    }

    const updated = categories.map(cat => {
      if (cat.id === selectedCategoryId) {
        return {
          ...cat,
          causes: [
            ...cat.causes,
            {
              id: `cause-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              description: newCause.description,
              isPrimary: newCause.isPrimary,
              likelihood: newCause.likelihood,
              evidence: []
            }
          ]
        };
      }
      return cat;
    });

    setCategories(updated);
    setNewCause({ description: '', isPrimary: true, likelihood: 'Medium' });
    setIsAddCauseDialogOpen(false);
    toast({ title: 'Success', description: 'Cause added to fishbone diagram' });
  };

  const removeCause = (categoryId: string, causeId: string) => {
    const updated = categories.map(cat => {
      if (cat.id === categoryId) {
        return {
          ...cat,
          causes: cat.causes.filter(c => c.id !== causeId)
        };
      }
      return cat;
    });
    setCategories(updated);
  };

  const togglePrimary = (categoryId: string, causeId: string) => {
    const updated = categories.map(cat => {
      if (cat.id === categoryId) {
        return {
          ...cat,
          causes: cat.causes.map(c => 
            c.id === causeId ? { ...c, isPrimary: !c.isPrimary } : c
          )
        };
      }
      return cat;
    });
    setCategories(updated);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (!effect.trim()) {
        toast({ title: 'Error', description: 'Effect/Problem is required', variant: 'destructive' });
        return;
      }

      const totalCauses = categories.reduce((sum, cat) => sum + cat.causes.length, 0);
      if (totalCauses === 0) {
        toast({ title: 'Error', description: 'Please add at least one cause', variant: 'destructive' });
        return;
      }

      const diagram: Omit<FishboneDiagram, 'id' | 'createdAt' | 'updatedAt'> = {
        rcaId,
        effect,
        categories,
      };

      onSave(diagram as FishboneDiagram);
      toast({ 
        title: '✅ Diagram Saved', 
        description: 'Fishbone diagram has been saved successfully',
        duration: 3000 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const exportToText = () => {
    let text = `FISHBONE (ISHIKAWA) DIAGRAM\n`;
    text += `${'='.repeat(60)}\n\n`;
    text += `Effect/Problem:\n${effect}\n\n`;
    text += `Cause Categories:\n`;
    text += `${'-'.repeat(60)}\n`;
    
    categories.forEach(cat => {
      text += `\n${cat.name.toUpperCase()}:\n`;
      if (cat.causes.length === 0) {
        text += `  (No causes identified)\n`;
      } else {
        cat.causes.forEach((cause, idx) => {
          text += `  ${idx + 1}. ${cause.description}`;
          if (cause.isPrimary) text += ` [PRIMARY]`;
          text += ` (${cause.likelihood} Likelihood)\n`;
        });
      }
    });
    
    text += `\n${'='.repeat(60)}\n`;
    text += `Total Causes: ${categories.reduce((sum, cat) => sum + cat.causes.length, 0)}\n`;
    text += `Primary Causes: ${categories.reduce((sum, cat) => sum + cat.causes.filter(c => c.isPrimary).length, 0)}\n`;
    text += `${'='.repeat(60)}\n`;
    
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied!', description: 'Diagram report copied to clipboard' });
  };

  const totalCauses = categories.reduce((sum, cat) => sum + cat.causes.length, 0);
  const primaryCauses = categories.reduce((sum, cat) => 
    sum + cat.causes.filter(c => c.isPrimary).length, 0
  );
  const highLikelihoodCauses = categories.reduce((sum, cat) => 
    sum + cat.causes.filter(c => c.likelihood === 'High').length, 0
  );

  // Category colors for 6M methodology
  const categoryColors: Record<string, string> = {
    'Man (People)': 'from-blue-500 to-blue-600',
    'Machine (Equipment)': 'from-purple-500 to-purple-600',
    'Material': 'from-green-500 to-green-600',
    'Method (Process)': 'from-orange-500 to-orange-600',
    'Measurement': 'from-pink-500 to-pink-600',
    'Environment': 'from-teal-500 to-teal-600',
  };

  const getCategoryColor = (name: string) => {
    return categoryColors[name] || 'from-gray-500 to-gray-600';
  };

  const getCategoryBorder = (name: string) => {
    const colorMap: Record<string, string> = {
      'Man (People)': 'border-blue-300',
      'Machine (Equipment)': 'border-purple-300',
      'Material': 'border-green-300',
      'Method (Process)': 'border-orange-300',
      'Measurement': 'border-pink-300',
      'Environment': 'border-teal-300',
    };
    return colorMap[name] || 'border-gray-300';
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="border-2 border-purple-300 bg-gradient-to-br from-purple-50 via-white to-purple-50 shadow-lg">
        <CardHeader className="border-b-2 border-purple-200 bg-gradient-to-r from-purple-100 to-purple-50">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-3 text-2xl">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-purple-400 flex items-center justify-center shadow-md">
                  <GitBranch className="w-6 h-6 text-white" />
                </div>
                <span className="bg-gradient-to-r from-purple-700 to-purple-500 bg-clip-text text-transparent font-bold">
                  Fishbone (Ishikawa) Diagram
                </span>
                <Badge variant="outline" className="ml-2 border-purple-400 text-purple-700 px-3">
                  <BarChart3 className="w-3 h-3 mr-1" />
                  {totalCauses} Causes
                </Badge>
                {primaryCauses > 0 && (
                  <Badge className="bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-md">
                    <Star className="w-3 h-3 mr-1 fill-white" />
                    {primaryCauses} Primary
                  </Badge>
                )}
                {existingDiagram && (
                  <Badge variant="outline" className="border-green-300 text-green-700">
                    <FileCheck className="w-3 h-3 mr-1" />
                    Previously Saved
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="mt-2 text-base">
                Cause-and-effect analysis using the 6M methodology (Man, Machine, Material, Method, Measurement, Environment)
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={exportToText}
              disabled={totalCauses === 0}
              className="ml-4"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy Report
            </Button>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-4 gap-3 mt-4">
            <div className="bg-white rounded-lg p-3 border-2 border-purple-200 shadow-sm">
              <div className="text-2xl font-bold text-purple-600">{totalCauses}</div>
              <div className="text-xs text-gray-600 font-medium">Total Causes</div>
            </div>
            <div className="bg-white rounded-lg p-3 border-2 border-orange-200 shadow-sm">
              <div className="text-2xl font-bold text-orange-600">{primaryCauses}</div>
              <div className="text-xs text-gray-600 font-medium">Primary Causes</div>
            </div>
            <div className="bg-white rounded-lg p-3 border-2 border-red-200 shadow-sm">
              <div className="text-2xl font-bold text-red-600">{highLikelihoodCauses}</div>
              <div className="text-xs text-gray-600 font-medium">High Likelihood</div>
            </div>
            <div className="bg-white rounded-lg p-3 border-2 border-blue-200 shadow-sm">
              <div className="text-2xl font-bold text-blue-600">{categories.length}</div>
              <div className="text-xs text-gray-600 font-medium">Categories</div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          {/* Effect/Problem */}
          <div className="bg-gradient-to-br from-red-50 to-orange-50 border-2 border-red-300 rounded-lg p-5 shadow-md">
            <Label htmlFor="effect" className="font-bold flex items-center gap-2 text-base mb-3">
              <Target className="w-5 h-5 text-red-600" />
              Effect / Problem (The "Fish Head")
              <span className="text-red-500">*</span>
            </Label>
            <Input
              id="effect"
              value={effect}
              onChange={(e) => setEffect(e.target.value)}
              placeholder="The undesired effect, problem, or defect you're analyzing..."
              className="font-medium text-lg h-14 border-2 border-red-300 focus:border-red-500 bg-white shadow-inner"
            />
            <p className="text-xs text-gray-600 mt-2 italic">
              Example: "FCC regenerator air blower catastrophic failure" or "Excessive product quality variation"
            </p>
          </div>

          <Separator className="my-6" />

          {/* Categories and Causes - 6M Grid */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <GitBranch className="w-5 h-5 text-purple-600" />
              <h3 className="text-lg font-bold text-gray-800">Cause Categories (6M Method)</h3>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {categories.map(category => (
                <Card 
                  key={category.id} 
                  className={`border-2 ${getCategoryBorder(category.name)} shadow-md hover:shadow-lg transition-all duration-200`}
                >
                  <CardHeader className={`pb-3 bg-gradient-to-r ${getCategoryColor(category.name)} text-white`}>
                    <CardTitle className="text-base font-bold flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                        {category.name}
                      </span>
                      <Badge variant="secondary" className="bg-white/20 text-white border-white/30 px-2 py-0">
                        {category.causes.length}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-3 space-y-2 min-h-[200px]">
                    {category.causes.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <AlertCircle className="w-8 h-8 text-gray-300 mb-2" />
                        <p className="text-xs text-gray-400 italic">No causes identified</p>
                        <p className="text-xs text-gray-400">Click "Add Cause" below</p>
                      </div>
                    )}
                    
                    {category.causes.map((cause, idx) => (
                      <div
                        key={cause.id}
                        className={`p-3 rounded-lg border-2 text-sm transition-all duration-200 hover:shadow-md ${
                          cause.isPrimary 
                            ? 'bg-gradient-to-r from-orange-50 to-yellow-50 border-orange-300 shadow-sm' 
                            : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                cause.isPrimary ? 'bg-orange-500 text-white' : 'bg-gray-400 text-white'
                              }`}>
                                {idx + 1}
                              </div>
                              {cause.isPrimary && (
                                <Star className="w-4 h-4 text-orange-500 fill-orange-500 animate-pulse" />
                              )}
                            </div>
                            <p className="font-medium text-gray-800 leading-tight mb-2">{cause.description}</p>
                            <div className="flex items-center gap-2">
                              <Badge 
                                variant="outline" 
                                className={`text-xs ${
                                  cause.likelihood === 'High' ? 'border-red-400 text-red-700 bg-red-50' :
                                  cause.likelihood === 'Medium' ? 'border-yellow-400 text-yellow-700 bg-yellow-50' :
                                  'border-green-400 text-green-700 bg-green-50'
                                }`}
                              >
                                {cause.likelihood} Likelihood
                              </Badge>
                              {cause.isPrimary && (
                                <Badge className="text-xs bg-orange-100 text-orange-700 border border-orange-300">
                                  Primary
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => togglePrimary(category.id, cause.id)}
                              className="h-7 w-7 p-0 hover:bg-orange-100"
                              title={cause.isPrimary ? "Mark as secondary" : "Mark as primary"}
                            >
                              <Star className={`w-4 h-4 ${cause.isPrimary ? 'fill-orange-500 text-orange-500' : 'text-gray-400'}`} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeCause(category.id, cause.id)}
                              className="h-7 w-7 p-0 text-red-500 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-3 border-2 border-dashed hover:bg-purple-50 hover:border-purple-400"
                      onClick={() => {
                        setSelectedCategoryId(category.id);
                        setIsAddCauseDialogOpen(true);
                      }}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Cause
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Save Diagram */}
          <div className="flex justify-end gap-3 pt-4">
            <Button 
              onClick={handleSave} 
              disabled={totalCauses === 0 || isSaving}
              size="lg"
              className="min-w-[200px] bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 shadow-lg"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5 mr-2" />
                  Save Diagram
                </>
              )}
            </Button>
          </div>

          {/* Analysis Summary */}
          <Card className="bg-gradient-to-br from-gray-50 to-white border-2 border-gray-300 shadow-inner">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Analysis Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-600 mb-2 font-medium">Completeness by Category:</p>
                  <div className="space-y-1">
                    {categories.map(cat => (
                      <div key={cat.id} className="flex items-center gap-2 text-xs">
                        {cat.causes.length > 0 ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-amber-600" />
                        )}
                        <span className="font-medium">{cat.name}:</span>
                        <span className="text-gray-600">{cat.causes.length} cause(s)</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-600 mb-2 font-medium">Distribution:</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span>Primary vs Secondary:</span>
                      <span className="font-bold">{primaryCauses} / {totalCauses - primaryCauses}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span>High Likelihood:</span>
                      <span className="font-bold text-red-600">{highLikelihoodCauses}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span>Avg per Category:</span>
                      <span className="font-bold">{(totalCauses / categories.length).toFixed(1)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      {/* Add Cause Dialog */}
      <Dialog open={isAddCauseDialogOpen} onOpenChange={setIsAddCauseDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Plus className="w-5 h-5 text-purple-600" />
              Add Contributing Cause
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="font-semibold">Category</Label>
              <div className={`p-3 rounded-lg bg-gradient-to-r ${getCategoryColor(categories.find(c => c.id === selectedCategoryId)?.name || '')} text-white font-bold`}>
                {categories.find(c => c.id === selectedCategoryId)?.name || ''}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="causeDesc" className="font-semibold">
                Cause Description <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="causeDesc"
                value={newCause.description}
                onChange={(e) => setNewCause({ ...newCause, description: e.target.value })}
                placeholder="Describe the potential contributing cause in detail..."
                rows={4}
                className="text-base border-2 focus:border-purple-500"
              />
              <p className="text-xs text-gray-500 italic">
                Be specific. Example: "Inadequate lubrication maintenance schedule" not just "Poor maintenance"
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="likelihood" className="font-semibold">Likelihood Assessment</Label>
                <Select
                  value={newCause.likelihood}
                  onValueChange={(value: any) => setNewCause({ ...newCause, likelihood: value })}
                >
                  <SelectTrigger className="border-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="High">
                      <span className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        High - Very likely contributor
                      </span>
                    </SelectItem>
                    <SelectItem value="Medium">
                      <span className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                        Medium - Possible contributor
                      </span>
                    </SelectItem>
                    <SelectItem value="Low">
                      <span className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        Low - Less likely contributor
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="font-semibold">Classification</Label>
                <div className="flex items-center gap-3 h-10 px-3 border-2 rounded-md bg-gray-50">
                  <input
                    type="checkbox"
                    id="isPrimary"
                    checked={newCause.isPrimary}
                    onChange={(e) => setNewCause({ ...newCause, isPrimary: e.target.checked })}
                    className="w-5 h-5 accent-orange-600"
                  />
                  <Label htmlFor="isPrimary" className="cursor-pointer flex items-center gap-2 font-medium">
                    <Star className="w-5 h-5 text-orange-500" />
                    Primary Cause
                  </Label>
                </div>
                <p className="text-xs text-gray-500 italic">
                  Primary causes are major contributors
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => setIsAddCauseDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={addCause}
              className="bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Cause
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FishboneDiagramTool;
