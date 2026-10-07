// Test Page for RCA Knowledge Base & Analysis Tools
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usePlantSelection } from '../contexts/PlantSelectionContext';
import { rcaAnalysisConfigService } from '../services/RCAAnalysisConfigService';
import { rcaKnowledgeBaseService } from '../services/RCAKnowledgeBaseService';
import { RCASimilarityMatch, RCAAnalysisConfig, FiveWhyAnalysis as FiveWhyData, FishboneDiagram, FMEAAnalysis, FaultTreeAnalysis, BarrierAnalysis, ChangeAnalysis } from '../types/RCAKnowledgeBase';
import FiveWhyAnalysisTool from '../components/rca-analysis/FiveWhyAnalysis';
import FishboneDiagramTool from '../components/rca-analysis/FishboneDiagramTool';
import FMEAAnalysisTool from '../components/rca-analysis/FMEAAnalysisTool';
import FaultTreeAnalysisTool from '../components/rca-analysis/FaultTreeAnalysisTool';
import BarrierAnalysisTool from '../components/rca-analysis/BarrierAnalysisTool';
import ChangeAnalysisTool from '../components/rca-analysis/ChangeAnalysisTool';
import SimilarRCAs from '../components/rca-analysis/SimilarRCAs';
import { masterDataService } from '../services/MasterDataService';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, Search, BarChart3, BookOpen, Settings as SettingsIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const TestRCAAnalysisTools: React.FC = () => {
  const { session } = useAuth();
  const { selection: plantSelection } = usePlantSelection();
  const { toast } = useToast();

  const [analysisConfig, setAnalysisConfig] = useState<RCAAnalysisConfig | null>(null);
  const [knowledgeBaseEntries, setKnowledgeBaseEntries] = useState<any[]>([]);
  const [similarMatches, setSimilarMatches] = useState<RCASimilarityMatch[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [fiveWhyAnalysis, setFiveWhyAnalysis] = useState<FiveWhyData | null>(null);
  const [fishboneAnalysis, setFishboneAnalysis] = useState<FishboneDiagram | null>(null);
  const [fmeaAnalysis, setFmeaAnalysis] = useState<FMEAAnalysis | null>(null);
  const [faultTreeAnalysis, setFaultTreeAnalysis] = useState<FaultTreeAnalysis | null>(null);
  const [barrierAnalysis, setBarrierAnalysis] = useState<BarrierAnalysis | null>(null);
  const [changeAnalysis, setChangeAnalysis] = useState<ChangeAnalysis | null>(null);
  const [demoRcaId, setDemoRcaId] = useState<string | null>(null);

  const tenantId = plantSelection?.tenant?.id || session?.tenant?.id;

  useEffect(() => {
    loadConfig();
    loadKnowledgeBase();
    loadDemoRca();
  }, [tenantId]);

  const loadDemoRca = async () => {
    if (!tenantId) return;
    try {
      const rcas = await masterDataService.getRCAs({ tenantId });
      if (rcas.length > 0) {
        setDemoRcaId(rcas[0].id);
      }
    } catch (error) {
      console.error('Failed to load demo RCA:', error);
    }
  };

  const loadConfig = async () => {
    if (!tenantId) return;
    
    try {
      let config = await rcaAnalysisConfigService.getActiveConfig(tenantId);
      
      if (!config) {
        console.log('Initializing default analysis config...');
        config = await rcaAnalysisConfigService.initializeDefaultConfig(
          tenantId,
          session?.organization?.id || '',
          'OilAndGas'
        );
      }
      
      setAnalysisConfig(config);
      console.log('✅ Analysis config loaded:', config.name);
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  };

  const loadKnowledgeBase = async () => {
    if (!tenantId) return;
    
    try {
      const entries = await rcaKnowledgeBaseService.getAllKnowledgeEntries(tenantId);
      setKnowledgeBaseEntries(entries);
      console.log(`✅ Loaded ${entries.length} knowledge base entries`);
    } catch (error) {
      console.error('Failed to load knowledge base:', error);
    }
  };

  const handleSearch = async () => {
    if (!tenantId || !analysisConfig) return;
    
    try {
      const matches = await rcaKnowledgeBaseService.findSimilarRCAs({
        title: searchQuery,
        description: searchQuery,
      }, tenantId, analysisConfig);
      
      setSimilarMatches(matches);
      console.log(`Found ${matches.length} similar RCAs`);
      
      if (matches.length === 0) {
        toast({
          title: 'No Matches',
          description: 'No similar RCAs found. Try different keywords.',
        });
      }
    } catch (error) {
      console.error('Search failed:', error);
      toast({
        title: 'Error',
        description: 'Search failed',
        variant: 'destructive',
      });
    }
  };

  if (!session) {
    return <div className="container mx-auto p-6">Please log in to use this page.</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Lightbulb className="w-8 h-8 text-yellow-500" />
          RCA Knowledge Base & Analysis Tools - Test Page
        </h1>
        <p className="text-muted-foreground mt-2">
          Test and explore the new RCA enhancement features
        </p>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {analysisConfig ? '✅' : '❌'}
            </p>
            <p className="text-xs text-gray-500">
              {analysisConfig ? analysisConfig.name : 'Not configured'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Knowledge Base</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">
              {knowledgeBaseEntries.length}
            </p>
            <p className="text-xs text-gray-500">Historical RCAs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Enabled Tools</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {analysisConfig ? Object.values(analysisConfig.enabledTools).filter(Boolean).length : 0}
            </p>
            <p className="text-xs text-gray-500">Analysis methods</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Similarity</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-purple-600">
              {analysisConfig?.knowledgeBaseConfig.similarityThreshold || 40}%
            </p>
            <p className="text-xs text-gray-500">Match threshold</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="similar" className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8 h-auto">
          <TabsTrigger value="similar">
            <Search className="w-4 h-4 mr-2" />
            Similar RCAs
          </TabsTrigger>
          <TabsTrigger value="5why">
            <BarChart3 className="w-4 h-4 mr-2" />
            5-Why Analysis
          </TabsTrigger>
          <TabsTrigger value="fishbone">
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M3 12h18M3 12l4-4m-4 4l4 4m14-4l-4-4m4 4l-4 4" strokeWidth="2"/>
            </svg>
            Fishbone
          </TabsTrigger>
          <TabsTrigger value="fmea">FMEA</TabsTrigger>
          <TabsTrigger value="faulttree">Fault Tree</TabsTrigger>
          <TabsTrigger value="barrier">Barrier</TabsTrigger>
          <TabsTrigger value="change">Change</TabsTrigger>
          <TabsTrigger value="kb">
            <BookOpen className="w-4 h-4 mr-2" />
            Knowledge Base
          </TabsTrigger>
        </TabsList>

        {/* Similar RCAs Tab */}
        <TabsContent value="similar" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Test Similarity Detection</CardTitle>
              <CardDescription>
                Search for similar past RCAs using keywords
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter keywords (e.g., 'compressor vibration', 'furnace leak')..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="flex-1"
                />
                <Button onClick={handleSearch}>
                  <Search className="w-4 h-4 mr-2" />
                  Search
                </Button>
              </div>

              {similarMatches.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-semibold mb-3">
                    Found {similarMatches.length} similar RCA(s):
                  </h3>
                  <SimilarRCAs
                    matches={similarMatches}
                    onApplyRecommendation={(rec) => {
                      console.log('Applied recommendation:', rec);
                      toast({ title: 'Applied', description: 'Recommendation copied' });
                    }}
                    onApplyEvidence={(type) => {
                      toast({ title: 'Suggestion', description: `Consider adding ${type} evidence` });
                    }}
                    onMarkHelpful={(id) => {
                      toast({ title: 'Thank you!', description: 'Marked as helpful' });
                    }}
                  />
                </div>
              )}

              {searchQuery && similarMatches.length === 0 && (
                <Card className="bg-gray-50">
                  <CardContent className="pt-6 text-center text-gray-500">
                    No similar RCAs found. Try different keywords.
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 5-Why Tab */}
        <TabsContent value="5why" className="mt-4">
          {!demoRcaId ? (
            <Card><CardContent className="pt-6 text-muted-foreground">Select a tenant with at least one RCA to test analysis tools.</CardContent></Card>
          ) : (
          <FiveWhyAnalysisTool
            rcaId={demoRcaId}
            initialProblem="Compressor failed during normal operation causing emergency shutdown"
            onSave={async (analysis) => {
              setFiveWhyAnalysis(analysis);
              await rcaAnalysisConfigService.saveFiveWhyAnalysis({ ...analysis, tenantId });
              toast({ title: 'Success', description: '5-Why analysis saved' });
            }}
            existingAnalysis={fiveWhyAnalysis}
            config={analysisConfig}
          />
          )}
        </TabsContent>

        {/* Fishbone Tab */}
        <TabsContent value="fishbone" className="mt-4">
          {!demoRcaId ? (
            <Card><CardContent className="pt-6 text-muted-foreground">Select a tenant with at least one RCA to test analysis tools.</CardContent></Card>
          ) : (
          <FishboneDiagramTool
            rcaId={demoRcaId}
            initialEffect="Compressor Catastrophic Failure"
            onSave={async (diagram) => {
              setFishboneAnalysis(diagram);
              await rcaAnalysisConfigService.saveFishboneDiagram({ ...diagram, tenantId });
              toast({ title: 'Success', description: 'Fishbone diagram saved' });
            }}
            existingDiagram={fishboneAnalysis}
            config={analysisConfig}
          />
          )}
        </TabsContent>

        <TabsContent value="fmea" className="mt-4">
          {!demoRcaId ? (
            <Card><CardContent className="pt-6 text-muted-foreground">Select a tenant with at least one RCA to test analysis tools.</CardContent></Card>
          ) : (
          <FMEAAnalysisTool
            rcaId={demoRcaId}
            initialFailureMode="Seal failure"
            onSave={async (analysis) => {
              setFmeaAnalysis(analysis);
              await rcaAnalysisConfigService.saveFMEAAnalysis({ ...analysis, tenantId });
              toast({ title: 'Success', description: 'FMEA analysis saved' });
            }}
            existingAnalysis={fmeaAnalysis}
            config={analysisConfig}
          />
          )}
        </TabsContent>

        <TabsContent value="faulttree" className="mt-4">
          {!demoRcaId ? (
            <Card><CardContent className="pt-6 text-muted-foreground">Select a tenant with at least one RCA to test analysis tools.</CardContent></Card>
          ) : (
          <FaultTreeAnalysisTool
            rcaId={demoRcaId}
            initialTopEvent="Equipment shutdown"
            onSave={async (analysis) => {
              setFaultTreeAnalysis(analysis);
              await rcaAnalysisConfigService.saveFaultTreeAnalysis({ ...analysis, tenantId });
              toast({ title: 'Success', description: 'Fault tree saved' });
            }}
            existingAnalysis={faultTreeAnalysis}
            config={analysisConfig}
          />
          )}
        </TabsContent>

        <TabsContent value="barrier" className="mt-4">
          {!demoRcaId ? (
            <Card><CardContent className="pt-6 text-muted-foreground">Select a tenant with at least one RCA to test analysis tools.</CardContent></Card>
          ) : (
          <BarrierAnalysisTool
            rcaId={demoRcaId}
            initialHazard="High pressure leak"
            onSave={async (analysis) => {
              setBarrierAnalysis(analysis);
              await rcaAnalysisConfigService.saveBarrierAnalysis({ ...analysis, tenantId });
              toast({ title: 'Success', description: 'Barrier analysis saved' });
            }}
            existingAnalysis={barrierAnalysis}
            config={analysisConfig}
          />
          )}
        </TabsContent>

        <TabsContent value="change" className="mt-4">
          {!demoRcaId ? (
            <Card><CardContent className="pt-6 text-muted-foreground">Select a tenant with at least one RCA to test analysis tools.</CardContent></Card>
          ) : (
          <ChangeAnalysisTool
            rcaId={demoRcaId}
            onSave={async (analysis) => {
              setChangeAnalysis(analysis);
              await rcaAnalysisConfigService.saveChangeAnalysis({ ...analysis, tenantId });
              toast({ title: 'Success', description: 'Change analysis saved' });
            }}
            existingAnalysis={changeAnalysis}
            config={analysisConfig}
          />
          )}
        </TabsContent>

        {/* Knowledge Base Browser Tab */}
        <TabsContent value="kb" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Knowledge Base Browser</CardTitle>
              <CardDescription>
                All historical RCAs in your knowledge base ({knowledgeBaseEntries.length} total)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {knowledgeBaseEntries.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No knowledge base entries yet</p>
                  <p className="text-sm mt-2">Close some RCAs to populate the knowledge base</p>
                </div>
              )}

              {knowledgeBaseEntries.length > 0 && (
                <div className="space-y-3">
                  {knowledgeBaseEntries.map((entry, index) => (
                    <Card key={entry.id} className="border-2">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-base">{entry.title}</CardTitle>
                            <CardDescription className="text-xs mt-1">
                              {entry.equipmentCategory && <span className="mr-2">📦 {entry.equipmentCategory}</span>}
                              <span className="mr-2">🏭 {entry.unitName}</span>
                              <span>📅 {new Date(entry.closedDate || entry.createdAt).toLocaleDateString()}</span>
                            </CardDescription>
                          </div>
                          <div className="flex gap-2">
                            <Badge variant={entry.effectiveness >= 80 ? 'default' : 'secondary'}>
                              {entry.effectiveness}% Effective
                            </Badge>
                            {entry.recurrenceCount > 0 && (
                              <Badge variant="destructive">
                                {entry.recurrenceCount} Recurrence(s)
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="bg-yellow-50 p-3 rounded border border-yellow-200">
                          <p className="text-xs font-semibold text-yellow-800">Root Cause:</p>
                          <p className="text-sm mt-1">{entry.rootCause || 'Not identified'}</p>
                          <Badge variant="outline" className="text-xs mt-2">
                            {entry.rootCauseCategory}
                          </Badge>
                        </div>

                        {entry.recommendations && entry.recommendations.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-gray-700 mb-1">
                              {entry.recommendations.length} Recommendation(s):
                            </p>
                            {entry.recommendations.map((rec: any, idx: number) => (
                              <div key={rec.id} className="text-sm bg-blue-50 p-2 rounded mb-1">
                                {idx + 1}. {rec.description}
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="grid grid-cols-3 gap-2 text-xs text-center bg-gray-50 p-2 rounded">
                          <div>
                            <p className="font-semibold text-blue-600">{entry.timesReferenced}</p>
                            <p className="text-gray-600">References</p>
                          </div>
                          <div>
                            <p className="font-semibold text-green-600">{entry.helpfulVotes}</p>
                            <p className="text-gray-600">Helpful Votes</p>
                          </div>
                          <div>
                            <p className="font-semibold text-purple-600">{entry.keywords?.length || 0}</p>
                            <p className="text-gray-600">Keywords</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Info Panel */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-semibold text-blue-900 mb-2">🎓 How to Use:</p>
              <ul className="text-blue-800 space-y-1 text-xs">
                <li>• Test similarity search in "Similar RCAs" tab</li>
                <li>• Try all six analysis tools (5-Why, Fishbone, FMEA, Fault Tree, Barrier, Change)</li>
                <li>• Browse knowledge base entries</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-blue-900 mb-2">✅ What's Working:</p>
              <ul className="text-blue-800 space-y-1 text-xs">
                <li>• Similarity detection algorithm</li>
                <li>• Knowledge base auto-population</li>
                <li>• All six analysis tools integrated in RCAModule and test page</li>
                <li>• Data persisted via backend API</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TestRCAAnalysisTools;

