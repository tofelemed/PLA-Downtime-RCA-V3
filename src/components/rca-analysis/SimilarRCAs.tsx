// Similar RCAs Component - Knowledge Base Integration
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Lightbulb, 
  TrendingUp, 
  CheckCircle, 
  AlertCircle, 
  Eye, 
  ThumbsUp, 
  Copy,
  Clock,
  DollarSign,
  Target
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { RCASimilarityMatch, RCAKnowledgeEntry } from '../../types/RCAKnowledgeBase';
import { rcaKnowledgeBaseService } from '../../services/RCAKnowledgeBaseService';

interface SimilarRCAsProps {
  matches: RCASimilarityMatch[];
  onApplyRecommendation: (recommendation: string) => void;
  onApplyEvidence: (evidenceType: string) => void;
  onMarkHelpful: (knowledgeId: string) => void;
}

export const SimilarRCAs: React.FC<SimilarRCAsProps> = ({
  matches,
  onApplyRecommendation,
  onApplyEvidence,
  onMarkHelpful
}) => {
  const { toast } = useToast();
  const [selectedKnowledge, setSelectedKnowledge] = useState<RCAKnowledgeEntry | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (matches.length === 0) {
    return (
      <Card className="border-gray-200">
        <CardContent className="pt-6 text-center py-8">
          <Lightbulb className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No similar past RCAs found</p>
          <p className="text-xs text-gray-400 mt-1">
            This appears to be a new type of issue
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleApplyRecommendations = (entry: RCAKnowledgeEntry) => {
    if (entry.recommendations && entry.recommendations.length > 0) {
      entry.recommendations.forEach(rec => {
        onApplyRecommendation(rec.description);
      });
      rcaKnowledgeBaseService.incrementReferenceCount(entry.id);
      toast({
        title: 'Success',
        description: `Applied ${entry.recommendations.length} recommendations from similar RCA`,
      });
    }
  };

  const handleMarkHelpful = (entry: RCAKnowledgeEntry) => {
    onMarkHelpful(entry.id);
    rcaKnowledgeBaseService.voteHelpful(entry.id, true);
    toast({
      title: 'Thank you!',
      description: 'Marked as helpful',
    });
  };

  return (
    <div className="space-y-3">
      <Card className="border-green-200 bg-green-50/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Lightbulb className="w-5 h-5 text-green-600" />
            Similar Past RCAs Found
            <Badge variant="default" className="bg-green-600">{matches.length}</Badge>
          </CardTitle>
          <CardDescription>
            Based on analysis, here are similar incidents from your knowledge base
          </CardDescription>
        </CardHeader>
      </Card>

      {matches.map((match) => (
        <Card 
          key={match.knowledgeEntry.id} 
          className={`border-2 hover:border-blue-300 transition-colors ${
            expandedId === match.knowledgeEntry.id ? 'border-blue-400 bg-blue-50/30' : 'border-gray-200'
          }`}
        >
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-base flex items-center gap-2">
                  {match.knowledgeEntry.title}
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${
                      match.similarityScore >= 70 ? 'bg-green-100 text-green-700 border-green-300' :
                      match.similarityScore >= 50 ? 'bg-blue-100 text-blue-700 border-blue-300' :
                      'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {Math.round(match.similarityScore)}% Match
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs mt-1">
                  {match.knowledgeEntry.equipmentCategory && (
                    <span className="mr-3">📦 {match.knowledgeEntry.equipmentCategory}</span>
                  )}
                  <span className="mr-3">🏭 {match.knowledgeEntry.unitName}</span>
                  <span>📅 {new Date(match.knowledgeEntry.closedDate || match.knowledgeEntry.createdAt).toLocaleDateString()}</span>
                </CardDescription>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge 
                  variant={match.knowledgeEntry.effectiveness >= 80 ? 'default' : 'secondary'}
                  className={`text-xs ${
                    match.knowledgeEntry.effectiveness >= 80 ? 'bg-green-600' :
                    match.knowledgeEntry.effectiveness >= 60 ? 'bg-yellow-600' :
                    'bg-red-600'
                  }`}
                >
                  {match.knowledgeEntry.effectiveness}% Effective
                </Badge>
                {match.knowledgeEntry.recurrenceCount > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {match.knowledgeEntry.recurrenceCount} Recurrence(s)
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            {/* Match Reasons */}
            <div className="flex flex-wrap gap-1">
              {match.matchReasons.map((reason, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  ✓ {reason}
                </Badge>
              ))}
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-2 text-xs text-center bg-gray-50 p-2 rounded">
              <div>
                <p className="font-semibold text-purple-600">{match.knowledgeEntry.recommendations.length}</p>
                <p className="text-gray-600">Actions</p>
              </div>
              <div>
                <p className="font-semibold text-blue-600">{match.knowledgeEntry.timesReferenced}</p>
                <p className="text-gray-600">References</p>
              </div>
              <div>
                <p className="font-semibold text-green-600">{match.knowledgeEntry.helpfulVotes}</p>
                <p className="text-gray-600">Helpful Votes</p>
              </div>
            </div>

            {/* Collapsed/Expanded View */}
            {expandedId === match.knowledgeEntry.id ? (
              <div className="space-y-3 pt-2">
                <Separator />
                
                {/* Root Cause */}
                {match.knowledgeEntry.rootCause && (
                  <div className="bg-yellow-50 p-3 rounded border border-yellow-200">
                    <p className="text-xs font-semibold text-yellow-800 mb-1">Root Cause:</p>
                    <p className="text-sm">{match.knowledgeEntry.rootCause}</p>
                    <Badge variant="outline" className="text-xs mt-2">
                      {match.knowledgeEntry.rootCauseCategory}
                    </Badge>
                  </div>
                )}

                {/* Recommendations */}
                {match.knowledgeEntry.recommendations.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-gray-700">Recommendations:</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleApplyRecommendations(match.knowledgeEntry)}
                        className="text-xs"
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        Apply All
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {match.knowledgeEntry.recommendations.map((rec, idx) => (
                        <div key={rec.id} className="bg-blue-50 p-2 rounded border border-blue-200 text-sm">
                          <p>{idx + 1}. {rec.description}</p>
                          {rec.effectiveness !== 'Unknown' && (
                            <Badge variant="outline" className="text-xs mt-1">
                              {rec.effectiveness} Effectiveness
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Performance Metrics */}
                {(match.knowledgeEntry.costSaved || match.knowledgeEntry.downtimeReduced) && (
                  <div className="grid grid-cols-2 gap-2">
                    {match.knowledgeEntry.costSaved && (
                      <div className="bg-green-50 p-2 rounded border border-green-200 text-center">
                        <DollarSign className="w-4 h-4 text-green-600 mx-auto" />
                        <p className="text-sm font-semibold">${match.knowledgeEntry.costSaved.toLocaleString()}</p>
                        <p className="text-xs text-gray-600">Cost Saved</p>
                      </div>
                    )}
                    {match.knowledgeEntry.downtimeReduced && (
                      <div className="bg-blue-50 p-2 rounded border border-blue-200 text-center">
                        <Clock className="w-4 h-4 text-blue-600 mx-auto" />
                        <p className="text-sm font-semibold">{match.knowledgeEntry.downtimeReduced} min</p>
                        <p className="text-xs text-gray-600">Downtime Reduced</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleMarkHelpful(match.knowledgeEntry)}
                  >
                    <ThumbsUp className="w-3 h-3 mr-1" />
                    Helpful
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedId(null)}
                  >
                    Collapse
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setExpandedId(match.knowledgeEntry.id)}
                >
                  <Eye className="w-3 h-3 mr-1" />
                  View Details
                </Button>
                {match.knowledgeEntry.recommendations.length > 0 && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleApplyRecommendations(match.knowledgeEntry)}
                    className="bg-green-600"
                  >
                    <Copy className="w-3 h-3 mr-1" />
                    Apply Actions
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Knowledge Base Tip */}
      {matches.length > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3 text-sm text-blue-800">
              <Target className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold mb-1">💡 Learn from the Past</p>
                <p className="text-xs">
                  These similar RCAs can help you:
                  • Identify root cause faster
                  • Avoid investigating the same issue twice
                  • Apply proven solutions
                  • Learn what worked (and what didn't)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SimilarRCAs;

