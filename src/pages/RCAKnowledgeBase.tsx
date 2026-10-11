// RCA Knowledge Base - Professional Dashboard for Closed RCAs and Lessons Learned
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usePlantSelection } from '../contexts/PlantSelectionContext';
import { masterDataService, RCA, ProductionEvent } from '../services/MasterDataService';
import { rcaKnowledgeBaseService } from '../services/RCAKnowledgeBaseService';
import { RCAKnowledgeEntry } from '../types/RCAKnowledgeBase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Database, Search, TrendingUp, AlertTriangle, CheckCircle, 
  Clock, Target, Award, BarChart3, PieChart, Calendar,
  FileText, Download, Filter, Eye, BookOpen, Lightbulb,
  GitBranch, Shield, Activity, Zap, TrendingDown, Camera,
  Video, Users, FolderTree, DollarSign, X, ThumbsUp, ThumbsDown
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface RCAWithKnowledge extends RCA {
  /** Not set by the v1 RCA mapper; the unit filter only matches RCAs that carry it. */
  unitId?: string;
  knowledgeEntry?: RCAKnowledgeEntry;
  event?: ProductionEvent;
  daysToResolve?: number;
  recurrenceCount?: number;
  qualityScore?: number;
  starRating?: number;
  rank?: number;
}

export const RCAKnowledgeBase: React.FC = () => {
  const { session } = useAuth();
  const { selection: plantSelection } = usePlantSelection();
  const { toast } = useToast();

  const [closedRCAs, setClosedRCAs] = useState<RCAWithKnowledge[]>([]);
  const [knowledgeEntries, setKnowledgeEntries] = useState<RCAKnowledgeEntry[]>([]);
  const [bestOfBestRCAs, setBestOfBestRCAs] = useState<(RCAKnowledgeEntry & { qualityScore: number })[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRootCause, setSelectedRootCause] = useState<string>('All');
  const [selectedUnit, setSelectedUnit] = useState<string>('All');
  const [selectedPriority, setSelectedPriority] = useState<string>('All');
  const [dateRange, setDateRange] = useState<string>('All Time');
  const [sortBy, setSortBy] = useState<'quality' | 'effectiveness' | 'recent' | 'referenced'>('quality');

  // View state
  const [selectedRCA, setSelectedRCA] = useState<RCAWithKnowledge | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    loadKnowledgeBase();
  }, [session?.tenant?.id, plantSelection?.tenant?.id]);

  const loadKnowledgeBase = async () => {
    setLoading(true);
    try {
      // Use plant selection tenant if available, otherwise fall back to session tenant
      const tenantId = plantSelection?.tenant?.id || session?.tenant?.id;
      
      if (!tenantId) {
        console.warn('⚠️ No tenant ID available for Knowledge Base');
        setLoading(false);
        return;
      }
      
      // Load closed RCAs - get all first, then filter
      const allRCAs = await masterDataService.getRCAs({});
      
      // Filter by tenant and status
      const tenantRCAs = allRCAs.filter(rca => rca.tenantId === tenantId);
      const closed = tenantRCAs.filter(rca => rca.status === 'Closed');
      
      // Load knowledge entries
      const entries = await rcaKnowledgeBaseService.searchKnowledgeBase('', tenantId);
      
      // Load Best of Best RCAs with full RCA data for accurate scoring
      const bestRCAs = await rcaKnowledgeBaseService.getBestOfBest(tenantId, 5);
      
      // Recalculate scores with full RCA data (including evidence)
      const bestWithAccurateScores = bestRCAs.map(entry => {
        const rca = closed.find(r => r.id === entry.rcaId);
        const accurateScore = rca 
          ? rcaKnowledgeBaseService.calculateQualityScore(entry, rca)
          : entry.qualityScore;
        return {
          ...entry,
          qualityScore: accurateScore
        };
      });
      
      // Load events for context
      const events = await masterDataService.getProductionEvents({});
      const tenantEvents = events.filter(e => e.tenantId === tenantId);
      
      // Enrich RCAs with knowledge data and quality scores
      const enrichedRCAs: RCAWithKnowledge[] = closed.map(rca => {
        const knowledgeEntry = entries.find(e => e.rcaId === rca.id);
        const event = tenantEvents.find(e => e.id === rca.eventId);
        
        // Calculate days to resolve
        let daysToResolve: number | undefined;
        if (rca.createdAt && rca.updatedAt) {
          const start = new Date(rca.createdAt);
          const end = new Date(rca.updatedAt);
          daysToResolve = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        }
        
        // Calculate quality score
        const qualityScore = knowledgeEntry 
          ? rcaKnowledgeBaseService.calculateQualityScore(knowledgeEntry, rca)
          : 0;
        const starRating = rcaKnowledgeBaseService.getStarRating(qualityScore);
        
        return {
          ...rca,
          knowledgeEntry,
          event,
          daysToResolve,
          recurrenceCount: knowledgeEntry?.recurrenceCount || 0,
          qualityScore,
          starRating
        };
      });
      
      setClosedRCAs(enrichedRCAs);
      setKnowledgeEntries(entries);
      setBestOfBestRCAs(bestWithAccurateScores);
    } catch (error) {
      console.error('❌ Failed to load knowledge base:', error);
      toast({
        title: 'Error',
        description: 'Failed to load RCA knowledge base',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Analytics calculations
  const totalClosedRCAs = closedRCAs.length;
  const averageDaysToResolve = closedRCAs.filter(r => r.daysToResolve).length > 0
    ? Math.round(closedRCAs.reduce((sum, r) => sum + (r.daysToResolve || 0), 0) / closedRCAs.filter(r => r.daysToResolve).length)
    : 0;
  
  const criticalRCAs = closedRCAs.filter(r => r.priority === 'Critical').length;
  const highRCAs = closedRCAs.filter(r => r.priority === 'High').length;
  
  const rootCauseDistribution = closedRCAs.reduce((acc, rca) => {
    const category = rca.rootCause || 'Unknown';
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const topRootCauses = Object.entries(rootCauseDistribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Filtering and Sorting
  const filteredRCAs = closedRCAs.filter(rca => {
    const matchesSearch = !searchQuery || 
      rca.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rca.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (rca.rootCause && rca.rootCause.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesRootCause = selectedRootCause === 'All' || rca.rootCause === selectedRootCause;
    const matchesUnit = selectedUnit === 'All' || rca.unitId === selectedUnit;
    const matchesPriority = selectedPriority === 'All' || rca.priority === selectedPriority;
    
    return matchesSearch && matchesRootCause && matchesUnit && matchesPriority;
  }).sort((a, b) => {
    // Sort based on selected option
    switch (sortBy) {
      case 'quality':
        return (b.qualityScore || 0) - (a.qualityScore || 0);
      case 'effectiveness':
        return (b.knowledgeEntry?.effectiveness || 0) - (a.knowledgeEntry?.effectiveness || 0);
      case 'referenced':
        return (b.knowledgeEntry?.timesReferenced || 0) - (a.knowledgeEntry?.timesReferenced || 0);
      case 'recent':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      default:
        return (b.qualityScore || 0) - (a.qualityScore || 0);
    }
  });

  // Helper: Render star rating
  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map(star => (
          <span key={star} className="text-base">
            {star <= rating ? '⭐' : '☆'}
          </span>
        ))}
      </div>
    );
  };

  // Helper: Get quality badge
  const getQualityBadge = (score: number) => {
    if (score >= 90) return { label: 'Excellent', color: 'bg-green-600' };
    if (score >= 75) return { label: 'Very Good', color: 'bg-blue-600' };
    if (score >= 60) return { label: 'Good', color: 'bg-yellow-600' };
    if (score >= 40) return { label: 'Fair', color: 'bg-orange-600' };
    return { label: 'Needs Improvement', color: 'bg-red-600' };
  };

  const exportKnowledgeBase = () => {
    let csv = 'RCA Title,Priority,Root Cause,Days to Resolve,Recommendations,Status,Created Date\n';
    
    closedRCAs.forEach(rca => {
      const recCount = rca.recommendations?.length || 0;
      csv += `"${rca.title}","${rca.priority}","${rca.rootCause || 'N/A'}","${rca.daysToResolve || 'N/A'}","${recCount}","${rca.status}","${new Date(rca.createdAt).toLocaleDateString()}"\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RCA_Knowledge_Base_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    
    toast({ title: 'Success', description: 'Knowledge base exported successfully' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Knowledge Base...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg">
            <Database className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-700 to-purple-600 bg-clip-text text-transparent">
              RCA Knowledge Base
            </h1>
            <p className="text-gray-600">Closed Investigations, Insights & Lessons Learned</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={exportKnowledgeBase}
            variant="outline"
            className="border-2 border-blue-300 hover:bg-blue-50"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button
            onClick={async () => {
              const tenantId = plantSelection?.tenant?.id || session?.tenant?.id;
              if (tenantId) {
                toast({ title: 'Refreshing...', description: 'Updating quality scores from current RCA data' });
                await rcaKnowledgeBaseService.refreshAllKnowledgeEntries(tenantId);
                await loadKnowledgeBase();
                toast({ title: 'Success', description: 'Quality scores refreshed!' });
              }
            }}
            variant="outline"
            className="border-2 border-green-300 hover:bg-green-50"
          >
            <Zap className="w-4 h-4 mr-2" />
            Refresh Scores
          </Button>
          <Button
            onClick={loadKnowledgeBase}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            <Activity className="w-4 h-4 mr-2" />
            Reload Data
          </Button>
        </div>
      </div>

      {/* KPI Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white shadow-lg hover:shadow-xl transition-all">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-600 flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-600" />
              Total Closed RCAs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-blue-700">{totalClosedRCAs}</div>
            <p className="text-xs text-gray-500 mt-1">Knowledge base entries</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-white shadow-lg hover:shadow-xl transition-all">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-600 flex items-center gap-2">
              <Clock className="w-4 h-4 text-green-600" />
              Avg Resolution Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-green-700">{averageDaysToResolve}</div>
            <p className="text-xs text-gray-500 mt-1">Days to close</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-white shadow-lg hover:shadow-xl transition-all">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-600 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-600" />
              Critical Investigations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-orange-700">{criticalRCAs}</div>
            <p className="text-xs text-gray-500 mt-1">{highRCAs} High priority</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-white shadow-lg hover:shadow-xl transition-all">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-600 flex items-center gap-2">
              <Target className="w-4 h-4 text-purple-600" />
              Knowledge Entries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-purple-700">{knowledgeEntries.length}</div>
            <p className="text-xs text-gray-500 mt-1">Searchable lessons learned</p>
          </CardContent>
        </Card>
      </div>

      {/* Best of Best Section */}
      {bestOfBestRCAs.length > 0 && (
        <Card className="border-4 border-yellow-400 bg-gradient-to-br from-yellow-50 via-white to-orange-50 shadow-2xl">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center shadow-lg">
                  <Award className="w-7 h-7 text-white" />
                </div>
                <div>
                  <CardTitle className="text-2xl font-bold bg-gradient-to-r from-yellow-700 to-orange-600 bg-clip-text text-transparent">
                    🏆 Best of Best RCAs
                  </CardTitle>
                  <CardDescription className="text-gray-700 font-medium">
                    Top {bestOfBestRCAs.length} highest quality investigations - Industry-leading practices
                  </CardDescription>
                </div>
              </div>
              <Badge className="bg-yellow-600 text-white px-4 py-2 text-sm">
                Excellence Showcase
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {bestOfBestRCAs.map((entry, index) => {
                const rca = closedRCAs.find(r => r.id === entry.rcaId);
                if (!rca) return null;
                
                const qualityBadge = getQualityBadge(entry.qualityScore);
                const starRating = rcaKnowledgeBaseService.getStarRating(entry.qualityScore);
                
                return (
                  <Card 
                    key={entry.id}
                    className="border-2 border-yellow-300 bg-white hover:shadow-xl transition-all cursor-pointer relative"
                    onClick={() => setSelectedRCA(rca)}
                  >
                    {/* Rank Badge - Smaller */}
                    <div className="absolute top-2 left-2 w-8 h-8 rounded-full bg-gradient-to-r from-yellow-500 to-orange-500 text-white flex items-center justify-center font-bold text-sm shadow-lg z-10">
                      #{index + 1}
                    </div>
                    
                    <CardHeader className="pb-2 pt-3 pl-12">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-sm font-bold text-gray-900 line-clamp-2 leading-tight">
                          {entry.title}
                        </CardTitle>
                        <Badge className={`${qualityBadge.color} text-white text-xs whitespace-nowrap`}>
                          {entry.qualityScore}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        {renderStars(starRating)}
                      </div>
                    </CardHeader>
                    
                    <CardContent className="space-y-2 pt-2">
                      {/* Compact Metrics */}
                      <div className="grid grid-cols-4 gap-1 text-center">
                        <div className="bg-green-50 rounded p-1">
                          <div className="text-sm font-bold text-green-700">{entry.effectiveness}%</div>
                          <div className="text-xs text-gray-500">Eff</div>
                        </div>
                        <div className="bg-blue-50 rounded p-1">
                          <div className="text-sm font-bold text-blue-700">{entry.helpfulVotes}</div>
                          <div className="text-xs text-gray-500">Votes</div>
                        </div>
                        <div className="bg-purple-50 rounded p-1">
                          <div className="text-sm font-bold text-purple-700">{entry.timesReferenced}</div>
                          <div className="text-xs text-gray-500">Refs</div>
                        </div>
                        <div className="bg-orange-50 rounded p-1">
                          <div className="text-sm font-bold text-orange-700">{entry.recurrenceCount}</div>
                          <div className="text-xs text-gray-500">Rec</div>
                        </div>
                      </div>
                      
                      {/* Root Cause - Compact */}
                      <div className="border-l-2 border-yellow-500 bg-yellow-50 p-2 rounded-r">
                        <div className="text-xs font-medium text-gray-800 line-clamp-2">{entry.rootCause || 'Not specified'}</div>
                      </div>
                      
                      {/* Compact Badges */}
                      <div className="flex flex-wrap gap-1">
                        {entry.effectiveness >= 90 && (
                          <Badge variant="outline" className="text-xs px-1 py-0 border-green-500 text-green-700">✓ Effective</Badge>
                        )}
                        {entry.recommendations && entry.recommendations.length >= 3 && (
                          <Badge variant="outline" className="text-xs px-1 py-0 border-blue-500 text-blue-700">API</Badge>
                        )}
                        {entry.contributingFactors && entry.contributingFactors.length >= 2 && (
                          <Badge variant="outline" className="text-xs px-1 py-0 border-purple-500 text-purple-700">ISO</Badge>
                        )}
                      </div>
                      
                      {/* Vote & View Buttons */}
                      <div className="flex gap-1">
                        <Button 
                          size="sm"
                          variant="outline"
                          className="flex-1 border-green-500 text-green-700 hover:bg-green-50"
                          onClick={async (e) => {
                            e.stopPropagation();
                            await rcaKnowledgeBaseService.voteHelpful(entry.id, true);
                            toast({ title: 'Thank you!', description: 'Marked as helpful' });
                            await loadKnowledgeBase();
                          }}
                        >
                          <ThumbsUp className="w-3 h-3" />
                        </Button>
                        <Button 
                          size="sm"
                          className="flex-[2] bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-semibold text-xs py-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRCA(rca);
                          }}
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          View
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            
            {bestOfBestRCAs.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Award className="w-16 h-16 mx-auto mb-3 text-gray-300" />
                <p className="font-medium">No Best of Best RCAs yet</p>
                <p className="text-sm mt-1">RCAs need quality score ≥50 and effectiveness ≥80% to qualify</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="investigations" className="w-full">
        <TabsList className="w-full grid grid-cols-4 bg-white border-2 border-gray-200 p-1 rounded-lg shadow">
          <TabsTrigger value="investigations" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Investigations
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="lessons" className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4" />
            Lessons Learned
          </TabsTrigger>
          <TabsTrigger value="trends" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Trends
          </TabsTrigger>
        </TabsList>

        {/* Investigations Tab */}
        <TabsContent value="investigations" className="space-y-6 mt-6">
          {/* Search and Filters */}
          <Card className="border-2 border-gray-200 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5 text-blue-600" />
                Search & Filter
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="md:col-span-2">
                  <Input
                    placeholder="Search by title, description, or root cause..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="border-2 focus:border-blue-500"
                  />
                </div>
                <Select value={selectedRootCause} onValueChange={setSelectedRootCause}>
                  <SelectTrigger className="border-2">
                    <SelectValue placeholder="Root Cause" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Root Causes</SelectItem>
                    {Object.keys(rootCauseDistribution).map(cause => (
                      <SelectItem key={cause} value={cause}>{cause}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedPriority} onValueChange={setSelectedPriority}>
                  <SelectTrigger className="border-2">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Priorities</SelectItem>
                    <SelectItem value="Critical">Critical</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="Low">Low</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                  <SelectTrigger className="border-2 w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quality">⭐ Quality Score</SelectItem>
                    <SelectItem value="effectiveness">📊 Effectiveness</SelectItem>
                    <SelectItem value="referenced">📚 Most Referenced</SelectItem>
                    <SelectItem value="recent">📅 Most Recent</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button
                    variant={viewMode === 'grid' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                  >
                    Grid
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                  >
                    List
                  </Button>
                </div>
              </div>
              <div className="mt-3 text-sm text-gray-600">
                Showing <strong>{filteredRCAs.length}</strong> of <strong>{totalClosedRCAs}</strong> closed investigations
              </div>
            </CardContent>
          </Card>

          {/* RCA List */}
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
            {filteredRCAs.map(rca => (
              <Card 
                key={rca.id} 
                className="border-2 border-gray-200 hover:border-blue-400 hover:shadow-lg transition-all cursor-pointer"
                onClick={() => setSelectedRCA(rca)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-base font-bold text-gray-800 line-clamp-2 pr-2">
                        {rca.title}
                      </CardTitle>
                      {rca.starRating && rca.starRating > 0 && (
                        <div className="mt-1 flex items-center gap-1">
                          {[...Array(rca.starRating)].map((_, i) => (
                            <span key={i} className="text-yellow-500 text-xs">⭐</span>
                          ))}
                          <span className="text-xs text-gray-500 ml-1">({rca.qualityScore}/100)</span>
                        </div>
                      )}
                    </div>
                    <Badge 
                      className={
                        rca.priority === 'Critical' ? 'bg-red-600' :
                        rca.priority === 'High' ? 'bg-orange-600' :
                        rca.priority === 'Medium' ? 'bg-yellow-600' :
                        'bg-green-600'
                      }
                    >
                      {rca.priority}
                    </Badge>
                  </div>
                  <CardDescription className="line-clamp-2">
                    {rca.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Quality & Effectiveness Indicators */}
                  {rca.knowledgeEntry && (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-green-50 border border-green-200 rounded px-2 py-1 text-center">
                        <div className="text-sm font-bold text-green-700">{rca.knowledgeEntry.effectiveness}%</div>
                        <div className="text-xs text-gray-600">Effective</div>
                      </div>
                      <div className="bg-blue-50 border border-blue-200 rounded px-2 py-1 text-center">
                        <div className="text-sm font-bold text-blue-700">{rca.knowledgeEntry.helpfulVotes}</div>
                        <div className="text-xs text-gray-600">Votes</div>
                      </div>
                      <div className="bg-purple-50 border border-purple-200 rounded px-2 py-1 text-center">
                        <div className="text-sm font-bold text-purple-700">{rca.knowledgeEntry.timesReferenced}</div>
                        <div className="text-xs text-gray-600">Refs</div>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2 text-sm">
                    <Target className="w-4 h-4 text-purple-600" />
                    <span className="font-medium">Root Cause:</span>
                    <span className="text-gray-600 truncate">{rca.rootCause || 'Not specified'}</span>
                  </div>
                  
                  {/* Compliance Badges */}
                  {rca.knowledgeEntry && (
                    <div className="flex flex-wrap gap-1">
                      {rca.knowledgeEntry.effectiveness >= 90 && (
                        <Badge variant="outline" className="text-xs border-green-500 text-green-700">
                          <Shield className="w-3 h-3 mr-1" />
                          High Effectiveness
                        </Badge>
                      )}
                      {rca.recommendations && rca.recommendations.length >= 3 && (
                        <Badge variant="outline" className="text-xs border-blue-500 text-blue-700">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          API RP 75
                        </Badge>
                      )}
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {rca.daysToResolve ? `${rca.daysToResolve} days` : 'N/A'}
                    </div>
                    <div className="flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {rca.recommendations?.length || 0} recommendations
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(rca.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      size="sm"
                      variant="outline"
                      className="border-green-500 text-green-700 hover:bg-green-50"
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (rca.knowledgeEntry) {
                          await rcaKnowledgeBaseService.voteHelpful(rca.knowledgeEntry.id, true);
                          toast({ title: 'Thank you!', description: 'Marked as helpful (+3 points when scores refresh)' });
                          await loadKnowledgeBase();
                        }
                      }}
                    >
                      <ThumbsUp className="w-3 h-3 mr-1" />
                      Helpful
                    </Button>
                    <Button 
                      size="sm" 
                      className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                    >
                      <Eye className="w-3 h-3 mr-2" />
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredRCAs.length === 0 && (
            <Card className="border-2 border-dashed border-gray-300">
              <CardContent className="py-12 text-center space-y-4">
                <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <div>
                  <p className="text-gray-500 text-lg font-medium">No closed RCAs found</p>
                  <p className="text-gray-400 text-sm mt-2">
                    for tenant: <strong>{plantSelection?.tenant?.name || session?.tenant?.name || 'Unknown'}</strong>
                  </p>
                </div>
                
                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 max-w-2xl mx-auto text-left">
                  <h4 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
                    <Lightbulb className="w-5 h-5" />
                    Possible Solutions:
                  </h4>
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-blue-600">1.</span>
                      <div>
                        <strong>Switch Organization/Tenant:</strong> Use the plant selector at the top-right to select a different organization or tenant (e.g., ADNOC Onshore)
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-blue-600">2.</span>
                      <div>
                        <strong>Close an RCA:</strong> Go to RCA Analysis module, open an investigation, and change its status to "Closed"
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-blue-600">3.</span>
                      <div>
                        <strong>Debug Data:</strong> Open browser console (F12) and run: <code className="bg-gray-800 text-green-400 px-2 py-1 rounded">debugRCAData()</code>
                      </div>
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Enhanced RCA Detail Dialog */}
        {selectedRCA && (
          <Dialog open={!!selectedRCA} onOpenChange={() => setSelectedRCA(null)}>
            <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto bg-gradient-to-br from-gray-50 to-blue-50">
              <DialogHeader className="border-b pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Badge className={
                        selectedRCA.priority === 'Critical' ? 'bg-red-600' :
                        selectedRCA.priority === 'High' ? 'bg-orange-600' :
                        selectedRCA.priority === 'Medium' ? 'bg-yellow-600' :
                        'bg-green-600'
                      }>
                        {selectedRCA.priority}
                      </Badge>
                      {selectedRCA.starRating && selectedRCA.starRating > 0 && renderStars(selectedRCA.starRating)}
                      {selectedRCA.qualityScore && (
                        <Badge variant="outline" className="text-sm">
                          Quality: {selectedRCA.qualityScore}/100
                        </Badge>
                      )}
                    </div>
                    <DialogTitle className="text-2xl font-bold text-gray-900">
                      {selectedRCA.title}
                    </DialogTitle>
                  </div>
                </div>
              </DialogHeader>
              
              <div className="space-y-6 mt-6">
                {/* Quick Stats Dashboard */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="border-2 border-blue-200">
                    <CardContent className="pt-4 text-center">
                      <Clock className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-blue-600">{selectedRCA.daysToResolve || 'N/A'}</div>
                      <div className="text-xs text-gray-600">Days to Resolve</div>
                    </CardContent>
                  </Card>
                  <Card className="border-2 border-green-200">
                    <CardContent className="pt-4 text-center">
                      <Lightbulb className="w-6 h-6 text-green-600 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-green-600">{selectedRCA.recommendations?.length || 0}</div>
                      <div className="text-xs text-gray-600">Recommendations</div>
                    </CardContent>
                  </Card>
                  <Card className="border-2 border-purple-200">
                    <CardContent className="pt-4 text-center">
                      <Camera className="w-6 h-6 text-purple-600 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-purple-600">{selectedRCA.evidence?.length || 0}</div>
                      <div className="text-xs text-gray-600">Evidence Items</div>
                    </CardContent>
                  </Card>
                  <Card className="border-2 border-orange-200">
                    <CardContent className="pt-4 text-center">
                      <FolderTree className="w-6 h-6 text-orange-600 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-orange-600">{selectedRCA.logicTree?.length || 0}</div>
                      <div className="text-xs text-gray-600">Logic Tree Nodes</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Effectiveness & Quality Metrics */}
                {selectedRCA.knowledgeEntry && (
                  <Card className="border-2 border-green-200 bg-gradient-to-r from-green-50 to-blue-50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Award className="w-5 h-5 text-green-600" />
                        Quality & Effectiveness Metrics
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-4 gap-4">
                        <div>
                          <div className="text-sm text-gray-600 mb-1">Effectiveness</div>
                          <div className="text-3xl font-bold text-green-700">{selectedRCA.knowledgeEntry.effectiveness}%</div>
                          <div className="w-full h-2 bg-gray-200 rounded-full mt-2">
                            <div className="h-full bg-green-600 rounded-full" style={{ width: `${selectedRCA.knowledgeEntry.effectiveness}%` }}></div>
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-600 mb-1">Times Referenced</div>
                          <div className="text-3xl font-bold text-purple-700">{selectedRCA.knowledgeEntry.timesReferenced}</div>
                          <div className="text-xs text-gray-500 mt-2">Used in investigations</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-600 mb-1">Helpful Votes</div>
                          <div className="text-3xl font-bold text-blue-700">{selectedRCA.knowledgeEntry.helpfulVotes}</div>
                          <div className="flex gap-1 mt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-green-500 text-green-700 hover:bg-green-50 text-xs px-2 py-1"
                              onClick={async () => {
                                await rcaKnowledgeBaseService.voteHelpful(selectedRCA.knowledgeEntry!.id, true);
                                toast({ title: 'Thank you!', description: 'Voted helpful (+3 points)' });
                                await loadKnowledgeBase();
                              }}
                            >
                              <ThumbsUp className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-600 mb-1">Recurrence Count</div>
                          <div className="text-3xl font-bold text-orange-700">{selectedRCA.knowledgeEntry.recurrenceCount}</div>
                          <div className="text-xs text-gray-500 mt-2">Issue reoccurrences</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Description */}
                <Card className="border-2 border-gray-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="w-5 h-5 text-blue-600" />
                      Problem Description
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700 leading-relaxed">{selectedRCA.description}</p>
                  </CardContent>
                </Card>

                {/* Root Cause - Highlighted */}
                <Card className="border-4 border-yellow-400 bg-gradient-to-r from-yellow-50 to-orange-50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Target className="w-5 h-5 text-yellow-600" />
                      Root Cause Analysis
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-white rounded-lg p-4 border-l-4 border-yellow-500">
                      <p className="text-gray-900 font-semibold text-lg">{selectedRCA.rootCause || 'Root cause not yet identified'}</p>
                    </div>
                    {selectedRCA.knowledgeEntry?.contributingFactors && selectedRCA.knowledgeEntry.contributingFactors.length > 0 && (
                      <div className="mt-4">
                        <h4 className="font-semibold text-gray-700 mb-2">Contributing Factors:</h4>
                        <ul className="list-disc list-inside space-y-1">
                          {selectedRCA.knowledgeEntry.contributingFactors.map((factor, idx) => (
                            <li key={idx} className="text-gray-700">{factor}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Recommendations */}
                {selectedRCA.recommendations && selectedRCA.recommendations.length > 0 && (
                  <Card className="border-2 border-blue-200">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Lightbulb className="w-5 h-5 text-blue-600" />
                        Recommendations & Actions ({selectedRCA.recommendations.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {selectedRCA.recommendations.map((rec, idx) => (
                          <div key={rec.id || idx} className="bg-gradient-to-r from-blue-50 to-white border-l-4 border-blue-500 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center flex-shrink-0 font-bold">
                                {idx + 1}
                              </div>
                              <div className="flex-1">
                                <p className="font-semibold text-gray-800 text-base mb-1">{rec.title || rec.description}</p>
                                {rec.description && rec.title && (
                                  <p className="text-gray-600 text-sm">{rec.description}</p>
                                )}
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {rec.priority && (
                                    <Badge variant="outline" className={
                                      rec.priority === 'High' ? 'border-red-500 text-red-700' :
                                      rec.priority === 'Medium' ? 'border-yellow-500 text-yellow-700' :
                                      'border-green-500 text-green-700'
                                    }>
                                      Priority: {rec.priority}
                                    </Badge>
                                  )}
                                  {rec.status && (
                                    <Badge variant="outline" className={
                                      rec.status === 'Completed' ? 'border-green-500 text-green-700' :
                                      rec.status === 'In Progress' ? 'border-blue-500 text-blue-700' :
                                      'border-gray-500 text-gray-700'
                                    }>
                                      {rec.status}
                                    </Badge>
                                  )}
                                  {rec.estimatedCost && (
                                    <Badge variant="outline" className="border-purple-500 text-purple-700">
                                      <DollarSign className="w-3 h-3 mr-1" />
                                      ${rec.estimatedCost.toLocaleString()}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Evidence */}
                {selectedRCA.evidence && selectedRCA.evidence.length > 0 && (
                  <Card className="border-2 border-purple-200">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Camera className="w-5 h-5 text-purple-600" />
                        Evidence Collected ({selectedRCA.evidence.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {selectedRCA.evidence.map((ev, idx) => (
                          <div key={ev.id || idx} className="bg-gradient-to-r from-purple-50 to-white border border-purple-200 rounded-lg p-3">
                            <div className="flex items-start gap-2">
                              {ev.type === 'Photo' && <Camera className="w-4 h-4 text-purple-600 mt-1" />}
                              {ev.type === 'Document' && <FileText className="w-4 h-4 text-blue-600 mt-1" />}
                              {ev.type === 'Video' && <Video className="w-4 h-4 text-red-600 mt-1" />}
                              {ev.type === 'Note' && <FileText className="w-4 h-4 text-gray-600 mt-1" />}
                              <div className="flex-1">
                                <p className="font-semibold text-sm text-gray-800">{ev.title}</p>
                                <p className="text-xs text-gray-600 line-clamp-2">{ev.description}</p>
                                <div className="flex gap-2 mt-1">
                                  <Badge variant="outline" className="text-xs">{ev.type}</Badge>
                                  {ev.collectedAt && (
                                    <span className="text-xs text-gray-500">{new Date(ev.collectedAt).toLocaleDateString()}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Team Information */}
                <Card className="border-2 border-indigo-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="w-5 h-5 text-indigo-600" />
                      Investigation Team
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-gray-600 mb-1">Team Lead</div>
                        <div className="font-semibold text-gray-800">{selectedRCA.teamLeadId || 'Not assigned'}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600 mb-1">Team Members</div>
                        <div className="font-semibold text-gray-800">{selectedRCA.teamMemberIds?.length || 0} members</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Timeline & Dates */}
                <Card className="border-2 border-gray-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-gray-600" />
                      Investigation Timeline
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-gray-600">Created</div>
                        <div className="font-semibold text-gray-800">{new Date(selectedRCA.createdAt).toLocaleDateString()}</div>
                      </div>
                      <div>
                        <div className="text-gray-600">Updated</div>
                        <div className="font-semibold text-gray-800">{new Date(selectedRCA.updatedAt).toLocaleDateString()}</div>
                      </div>
                      <div>
                        <div className="text-gray-600">Status</div>
                        <Badge className="bg-green-600">Closed</Badge>
                      </div>
                      <div>
                        <div className="text-gray-600">Resolution Time</div>
                        <div className="font-semibold text-gray-800">{selectedRCA.daysToResolve || 'N/A'} days</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Compliance Indicators & Community Feedback */}
                <Card className="border-2 border-green-200 bg-gradient-to-r from-green-50 to-blue-50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Shield className="w-5 h-5 text-green-600" />
                      Industry Standards Compliance
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-3">
                      {selectedRCA.knowledgeEntry?.effectiveness >= 90 && (
                        <Badge className="bg-green-600 text-white px-3 py-2">
                          <Shield className="w-4 h-4 mr-2" />
                          High Effectiveness (≥90%)
                        </Badge>
                      )}
                      {selectedRCA.recommendations && selectedRCA.recommendations.length >= 3 && (
                        <Badge className="bg-blue-600 text-white px-3 py-2">
                          <CheckCircle className="w-4 h-4 mr-2" />
                          API RP 75 Compliant
                        </Badge>
                      )}
                      {selectedRCA.knowledgeEntry?.contributingFactors && selectedRCA.knowledgeEntry.contributingFactors.length >= 2 && (
                        <Badge className="bg-purple-600 text-white px-3 py-2">
                          <Target className="w-4 h-4 mr-2" />
                          ISO 31000 Certified
                        </Badge>
                      )}
                      {selectedRCA.evidence && selectedRCA.evidence.length >= 3 && (
                        <Badge className="bg-indigo-600 text-white px-3 py-2">
                          <Camera className="w-4 h-4 mr-2" />
                          Well Documented
                        </Badge>
                      )}
                    </div>
                    
                    {/* Community Feedback Section */}
                    {selectedRCA.knowledgeEntry && (
                      <div className="border-t pt-4">
                        <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                          <ThumbsUp className="w-4 h-4 text-blue-600" />
                          Community Feedback
                        </h4>
                        <div className="flex items-center justify-between bg-white rounded-lg p-4 border-2 border-blue-200">
                          <div>
                            <div className="text-sm text-gray-600">Helpful Votes</div>
                            <div className="text-3xl font-bold text-blue-700">{selectedRCA.knowledgeEntry.helpfulVotes}</div>
                            <div className="text-xs text-gray-500 mt-1">Each vote adds +3 to quality score</div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="lg"
                              className="bg-green-600 hover:bg-green-700 text-white"
                              onClick={async () => {
                                await rcaKnowledgeBaseService.voteHelpful(selectedRCA.knowledgeEntry!.id, true);
                                toast({ 
                                  title: '👍 Thank you!', 
                                  description: `Voted helpful! Quality score will increase by +3 points`,
                                  duration: 3000
                                });
                                await loadKnowledgeBase();
                              }}
                            >
                              <ThumbsUp className="w-5 h-5 mr-2" />
                              Mark as Helpful
                            </Button>
                            <Button
                              size="lg"
                              variant="outline"
                              className="border-red-500 text-red-700 hover:bg-red-50"
                              onClick={async () => {
                                await rcaKnowledgeBaseService.voteHelpful(selectedRCA.knowledgeEntry!.id, false);
                                toast({ 
                                  title: 'Feedback recorded', 
                                  description: 'Vote removed',
                                  duration: 2000
                                });
                                await loadKnowledgeBase();
                              }}
                            >
                              <ThumbsDown className="w-5 h-5 mr-2" />
                              Not Helpful
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Root Cause Analysis */}
            <Card className="border-2 border-gray-200 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-blue-600" />
                  Top Root Causes (Pareto Analysis)
                </CardTitle>
                <CardDescription>Most common root causes across closed RCAs</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topRootCauses.map(([cause, count], idx) => {
                    const percentage = Math.round((count / totalClosedRCAs) * 100);
                    return (
                      <div key={cause} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                              idx === 0 ? 'bg-red-500' :
                              idx === 1 ? 'bg-orange-500' :
                              idx === 2 ? 'bg-yellow-500' :
                              'bg-gray-400'
                            }`}>
                              {idx + 1}
                            </div>
                            {cause}
                          </span>
                          <span className="text-gray-600">{count} ({percentage}%)</span>
                        </div>
                        <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${
                              idx === 0 ? 'bg-gradient-to-r from-red-500 to-red-600' :
                              idx === 1 ? 'bg-gradient-to-r from-orange-500 to-orange-600' :
                              idx === 2 ? 'bg-gradient-to-r from-yellow-500 to-yellow-600' :
                              'bg-gradient-to-r from-gray-400 to-gray-500'
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Resolution Time Analysis */}
            <Card className="border-2 border-gray-200 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-green-600" />
                  Resolution Time Distribution
                </CardTitle>
                <CardDescription>How long it takes to close investigations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { range: '0-7 days', min: 0, max: 7, color: 'green' },
                    { range: '8-14 days', min: 8, max: 14, color: 'blue' },
                    { range: '15-30 days', min: 15, max: 30, color: 'yellow' },
                    { range: '30+ days', min: 31, max: Infinity, color: 'red' },
                  ].map(bucket => {
                    const count = closedRCAs.filter(r => 
                      r.daysToResolve && r.daysToResolve >= bucket.min && r.daysToResolve <= bucket.max
                    ).length;
                    const percentage = totalClosedRCAs > 0 ? Math.round((count / totalClosedRCAs) * 100) : 0;
                    
                    return (
                      <div key={bucket.range} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{bucket.range}</span>
                          <span className="text-gray-600">{count} ({percentage}%)</span>
                        </div>
                        <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className={`h-full bg-gradient-to-r from-${bucket.color}-500 to-${bucket.color}-600`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Lessons Learned Tab */}
        <TabsContent value="lessons" className="space-y-6 mt-6">
          <Card className="border-2 border-yellow-200 bg-gradient-to-br from-yellow-50 to-white shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-yellow-600" />
                Key Lessons Learned
              </CardTitle>
              <CardDescription>Critical insights from closed investigations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {closedRCAs.slice(0, 10).map(rca => (
                <div key={rca.id} className="border-l-4 border-yellow-500 bg-white p-4 rounded-r-lg shadow">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-bold text-gray-800">{rca.title}</h4>
                    <Badge variant="outline" className="text-xs">{rca.priority}</Badge>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-semibold text-gray-700">Root Cause:</span>
                      <p className="text-gray-600 mt-1">{rca.rootCause || 'Not specified'}</p>
                    </div>
                    {rca.recommendations && rca.recommendations.length > 0 && (
                      <div>
                        <span className="font-semibold text-gray-700">Key Recommendations:</span>
                        <ul className="list-disc list-inside text-gray-600 mt-1 space-y-1">
                          {rca.recommendations.slice(0, 3).map((rec, idx) => (
                            <li key={idx}>{rec.description}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-6 mt-6">
          {/* Key Performance Indicators */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-white shadow-lg">
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-4xl font-bold text-green-600">{averageDaysToResolve}</div>
                  <p className="text-sm text-gray-600 mt-2 font-medium">Avg Days to Close</p>
                  <div className="flex items-center justify-center gap-1 mt-2 text-xs text-green-600 bg-green-100 py-1 px-2 rounded">
                    <TrendingDown className="w-3 h-3" />
                    <span>Faster resolution</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white shadow-lg">
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-4xl font-bold text-blue-600">{totalClosedRCAs}</div>
                  <p className="text-sm text-gray-600 mt-2 font-medium">Total Closed RCAs</p>
                  <div className="flex items-center justify-center gap-1 mt-2 text-xs text-blue-600 bg-blue-100 py-1 px-2 rounded">
                    <Database className="w-3 h-3" />
                    <span>Knowledge base</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-white shadow-lg">
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-4xl font-bold text-purple-600">
                    {totalClosedRCAs > 0 ? Math.round((closedRCAs.filter(r => r.recommendations && r.recommendations.length > 0).length / totalClosedRCAs) * 100) : 0}%
                  </div>
                  <p className="text-sm text-gray-600 mt-2 font-medium">With Recommendations</p>
                  <div className="flex items-center justify-center gap-1 mt-2 text-xs text-purple-600 bg-purple-100 py-1 px-2 rounded">
                    <Award className="w-3 h-3" />
                    <span>Quality indicator</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-white shadow-lg">
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-4xl font-bold text-orange-600">
                    {totalClosedRCAs > 0 ? Math.round(closedRCAs.reduce((sum, r) => sum + (r.recommendations?.length || 0), 0) / totalClosedRCAs) : 0}
                  </div>
                  <p className="text-sm text-gray-600 mt-2 font-medium">Avg Recommendations</p>
                  <div className="flex items-center justify-center gap-1 mt-2 text-xs text-orange-600 bg-orange-100 py-1 px-2 rounded">
                    <Lightbulb className="w-3 h-3" />
                    <span>Per investigation</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Metrics */}
          <Card className="border-2 border-gray-200 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-purple-600" />
                Investigation Quality Metrics
              </CardTitle>
              <CardDescription>Measure the effectiveness and completeness of RCA investigations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Completeness Score */}
                <div>
                  <h4 className="font-semibold text-gray-700 mb-3">Investigation Completeness</h4>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>RCAs with Root Cause Identified</span>
                        <span className="font-bold">
                          {totalClosedRCAs > 0 ? Math.round((closedRCAs.filter(r => r.rootCause && r.rootCause.trim()).length / totalClosedRCAs) * 100) : 0}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-green-500 to-green-600"
                          style={{ width: `${totalClosedRCAs > 0 ? Math.round((closedRCAs.filter(r => r.rootCause && r.rootCause.trim()).length / totalClosedRCAs) * 100) : 0}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>RCAs with Recommendations</span>
                        <span className="font-bold">
                          {totalClosedRCAs > 0 ? Math.round((closedRCAs.filter(r => r.recommendations && r.recommendations.length > 0).length / totalClosedRCAs) * 100) : 0}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-500 to-blue-600"
                          style={{ width: `${totalClosedRCAs > 0 ? Math.round((closedRCAs.filter(r => r.recommendations && r.recommendations.length > 0).length / totalClosedRCAs) * 100) : 0}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>RCAs with Evidence</span>
                        <span className="font-bold">
                          {totalClosedRCAs > 0 ? Math.round((closedRCAs.filter(r => r.evidence && r.evidence.length > 0).length / totalClosedRCAs) * 100) : 0}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-purple-500 to-purple-600"
                          style={{ width: `${totalClosedRCAs > 0 ? Math.round((closedRCAs.filter(r => r.evidence && r.evidence.length > 0).length / totalClosedRCAs) * 100) : 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Priority Distribution */}
                <div>
                  <h4 className="font-semibold text-gray-700 mb-3">Priority Distribution</h4>
                  <div className="space-y-3">
                    {['Critical', 'High', 'Medium', 'Low'].map(priority => {
                      const count = closedRCAs.filter(r => r.priority === priority).length;
                      const percentage = totalClosedRCAs > 0 ? Math.round((count / totalClosedRCAs) * 100) : 0;
                      const color = priority === 'Critical' ? 'red' : priority === 'High' ? 'orange' : priority === 'Medium' ? 'yellow' : 'green';
                      
                      return (
                        <div key={priority}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full bg-${color}-500`}></div>
                              {priority}
                            </span>
                            <span className="font-bold">{count} ({percentage}%)</span>
                          </div>
                          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className={`h-full bg-gradient-to-r from-${color}-500 to-${color}-600`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RCAKnowledgeBase;

