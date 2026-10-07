import React, { useState } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { CheckCircle, AlertTriangle, Clock, Wrench, Users, FileText, Eye, ClipboardList, Info, Edit2, Trash2, Paperclip, ArrowRightCircle, TrendingDown, TrendingUp, DollarSign, Target, MapPin, Calendar, Activity, Zap, Shield, AlertCircle, ChevronDown, ChevronRight, BarChart3, Timer, Gauge, Thermometer, Layers, Settings } from 'lucide-react';

const eventTypeIcons = {
  Failure: <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-red-400 to-pink-500 shadow-lg"><AlertTriangle className="w-6 h-6 text-white" /></span>,
  Alarm: <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-yellow-300 to-orange-400 shadow-lg"><Clock className="w-6 h-6 text-white" /></span>,
  Action: <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-cyan-500 shadow-lg"><Users className="w-6 h-6 text-white" /></span>,
  Note: <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 shadow-lg"><FileText className="w-6 h-6 text-white" /></span>,
  Maintenance: <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-green-700 shadow-lg"><Wrench className="w-6 h-6 text-white" /></span>,
  Inspection: <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 shadow-lg"><Eye className="w-6 h-6 text-white" /></span>,
  'Operator Action': <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-pink-700 shadow-lg"><ClipboardList className="w-6 h-6 text-white" /></span>,
  Info: <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-blue-400 shadow-lg"><Info className="w-6 h-6 text-white" /></span>,
  Production: <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-700 shadow-lg"><CheckCircle className="w-6 h-6 text-white" /></span>,
};

const severityColors = {
  High: 'bg-red-100 text-red-700',
  Medium: 'bg-yellow-100 text-yellow-700',
  Low: 'bg-green-100 text-green-700',
  Critical: 'bg-red-700 text-white',
};

export interface RCATimelineEvent {
  id: string;
  type: string;
  title: string;
  timestamp: string;
  description?: string;
  asset?: string;
  severity?: string;
  evidenceCount?: number;
  // Enhanced industrial fields
  duration?: number; // in minutes
  endTime?: string;
  impact?: 'Low' | 'Medium' | 'High' | 'Critical';
  cost?: number;
  operatorName?: string;
  shift?: string;
  unit?: string;
  parameter?: string;
  value?: number;
  limit?: number;
  status?: 'Open' | 'Closed' | 'Investigating';
  rootCause?: string;
  correctiveActions?: string[];
  preventiveActions?: string[];
  relatedEvents?: string[];
  kpis?: {
    availability?: number;
    performance?: number;
    quality?: number;
    oee?: number;
  };
  tags?: string[];
  attachments?: string[];
  notes?: string;
}

export interface RCATimelineProps {
  productionEvents: RCATimelineEvent[];
  manualEvents: RCATimelineEvent[];
  evidence: any[];
  onEdit?: (event: RCATimelineEvent) => void;
  onDelete?: (event: RCATimelineEvent) => void;
  onLinkEvidence?: (event: RCATimelineEvent) => void;
}

export const RCATimeline: React.FC<RCATimelineProps> = ({ productionEvents, manualEvents, evidence, onEdit, onDelete, onLinkEvidence }) => {
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);

  // Only show events linked to this RCA (production: by eventId, assetId, or evidence; manual: all)
  const allEvents = [
    ...productionEvents,
    ...manualEvents,
  ].filter(ev => !!ev.timestamp);
  
  // Sort by time
  const sortedEvents = [...allEvents].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const toggleEventExpansion = (eventId: string) => {
    const newExpanded = new Set(expandedEvents);
    if (newExpanded.has(eventId)) {
      newExpanded.delete(eventId);
    } else {
      newExpanded.add(eventId);
    }
    setExpandedEvents(newExpanded);
  };

  const formatDuration = (minutes?: number): string => {
    if (!minutes) return 'N/A';
    if (minutes < 60) return `${minutes}m`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
    return `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h`;
  };

  const getImpactIcon = (impact?: string) => {
    switch (impact) {
      case 'Critical': return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'High': return <AlertTriangle className="w-4 h-4 text-orange-600" />;
      case 'Medium': return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'Low': return <Info className="w-4 h-4 text-green-600" />;
      default: return <Info className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'Open': return 'bg-red-100 text-red-700 border-red-200';
      case 'Closed': return 'bg-green-100 text-green-700 border-green-200';
      case 'Investigating': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto py-6 relative">
      {/* Professional Header */}
      <div className="mb-8 bg-gradient-to-r from-slate-50 to-blue-50 border border-slate-200 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg">
              <BarChart3 className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Event Timeline Analysis</h2>
              <p className="text-slate-600 mt-1">Chronological sequence of events with detailed impact analysis</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge className="bg-blue-100 text-blue-700 border-blue-200">
              {sortedEvents.length} Events
            </Badge>
            <Badge className="bg-green-100 text-green-700 border-green-200">
              {evidence.length} Evidence Items
            </Badge>
          </div>
        </div>
      </div>

      {/* Professional Timeline */}
      <div className="relative">
        {/* Industrial Timeline Line */}
        <div className="absolute left-8 top-0 bottom-0 w-1 bg-gradient-to-b from-slate-300 via-blue-400 to-slate-300 rounded-full shadow-lg" 
             style={{ minHeight: 120 * sortedEvents.length + 100 }} />
        
        <div className="space-y-8">
          {sortedEvents.map((ev, idx) => {
            const isExpanded = expandedEvents.has(ev.id);
            const isSelected = selectedEvent === ev.id;
            
            return (
              <div key={ev.id} className="relative group">
                {/* Timeline Node */}
                <div className="absolute left-6 top-6 z-10">
                  <div className="relative">
                    {/* Node Glow */}
                    <div className={`absolute -inset-3 rounded-full opacity-20 transition-all duration-300 ${
                      ev.severity === 'Critical' ? 'bg-red-500' :
                      ev.severity === 'High' ? 'bg-orange-500' :
                      ev.severity === 'Medium' ? 'bg-yellow-500' : 'bg-blue-500'
                    } ${isSelected ? 'animate-pulse' : ''}`} />
                    
                    {/* Node Icon */}
                    <div className={`w-12 h-12 rounded-xl shadow-lg flex items-center justify-center transition-all duration-300 ${
                      isSelected ? 'scale-110' : 'scale-100'
                    } ${
                      ev.severity === 'Critical' ? 'bg-red-500' :
                      ev.severity === 'High' ? 'bg-orange-500' :
                      ev.severity === 'Medium' ? 'bg-yellow-500' : 'bg-blue-500'
                    }`}>
                      {eventTypeIcons[ev.type] || eventTypeIcons['Info']}
                    </div>
                  </div>
                </div>

                {/* Event Card */}
                <div className={`ml-20 transition-all duration-300 ${isExpanded ? 'mb-8' : ''}`}>
                  <Card className={`border-0 shadow-lg transition-all duration-300 hover:shadow-xl ${
                    isSelected ? 'ring-2 ring-blue-500 ring-opacity-50' : ''
                  } ${isExpanded ? 'bg-gradient-to-br from-white to-blue-50' : 'bg-white'}`}>
                    {/* Header */}
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-bold text-slate-800 truncate">{ev.title}</h3>
                            <Badge className={`${severityColors[ev.severity || 'Medium']} text-xs font-semibold`}>
                              {ev.severity || 'Medium'}
                            </Badge>
                            <Badge className="bg-blue-100 text-blue-700 text-xs font-semibold">
                              {ev.type}
                            </Badge>
                            {ev.status && (
                              <Badge className={`${getStatusColor(ev.status)} text-xs font-semibold`}>
                                {ev.status}
                              </Badge>
                            )}
                          </div>
                          
                          {/* Quick Info Bar */}
                          <div className="flex items-center gap-4 text-sm text-slate-600 mb-3">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              <span className="font-medium">{new Date(ev.timestamp).toLocaleString()}</span>
                            </div>
                            {ev.duration && (
                              <div className="flex items-center gap-1">
                                <Timer className="w-4 h-4" />
                                <span>{formatDuration(ev.duration)}</span>
                              </div>
                            )}
                            {ev.asset && (
                              <div className="flex items-center gap-1">
                                <Settings className="w-4 h-4" />
                                <span>{ev.asset}</span>
                              </div>
                            )}
                            {ev.evidenceCount !== undefined && ev.evidenceCount > 0 && (
                              <div className="flex items-center gap-1">
                                <Paperclip className="w-4 h-4" />
                                <span>{ev.evidenceCount} Evidence</span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 ml-4">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleEventExpansion(ev.id)}
                            className="text-slate-600 hover:text-blue-600"
                          >
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </Button>
                          {onEdit && (
                            <Button size="sm" variant="ghost" onClick={() => onEdit(ev)} className="text-slate-600 hover:text-blue-600">
                              <Edit2 className="w-4 h-4" />
                            </Button>
                          )}
                          {onLinkEvidence && (
                            <Button size="sm" variant="ghost" onClick={() => onLinkEvidence(ev)} className="text-slate-600 hover:text-purple-600">
                              <Paperclip className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>

                    {/* Basic Content */}
                    <CardContent className="pt-0">
                      <p className="text-slate-700 mb-4">{ev.description}</p>
                      
                      {/* Key Metrics Row */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        {ev.cost && (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <DollarSign className="w-4 h-4 text-red-600" />
                              <span className="text-xs font-semibold text-red-700">Cost Impact</span>
                            </div>
                            <div className="text-lg font-bold text-red-800">
                              ${ev.cost.toLocaleString()}
                            </div>
                          </div>
                        )}
                        
                        {ev.impact && (
                          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                              {getImpactIcon(ev.impact)}
                              <span className="text-xs font-semibold text-orange-700">Impact Level</span>
                            </div>
                            <div className="text-lg font-bold text-orange-800">
                              {ev.impact}
                            </div>
                          </div>
                        )}
                        
                        {ev.parameter && ev.value && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <Gauge className="w-4 h-4 text-blue-600" />
                              <span className="text-xs font-semibold text-blue-700">Parameter</span>
                            </div>
                            <div className="text-lg font-bold text-blue-800">
                              {ev.parameter}: {ev.value}
                            </div>
                          </div>
                        )}
                        
                        {ev.kpis?.oee && (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <TrendingUp className="w-4 h-4 text-green-600" />
                              <span className="text-xs font-semibold text-green-700">OEE Impact</span>
                            </div>
                            <div className="text-lg font-bold text-green-800">
                              {ev.kpis.oee.toFixed(1)}%
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Expanded Content */}
                      {isExpanded && (
                        <div className="border-t border-slate-200 pt-4 space-y-4">
                          {/* Detailed Information */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Operational Details */}
                            <div className="space-y-3">
                              <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                                <Activity className="w-5 h-5 text-blue-600" />
                                Operational Details
                              </h4>
                              <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                                {ev.operatorName && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-slate-600">Operator:</span>
                                    <span className="font-medium">{ev.operatorName}</span>
                                  </div>
                                )}
                                {ev.shift && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-slate-600">Shift:</span>
                                    <span className="font-medium">{ev.shift}</span>
                                  </div>
                                )}
                                {ev.unit && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-slate-600">Unit:</span>
                                    <span className="font-medium">{ev.unit}</span>
                                  </div>
                                )}
                                {ev.endTime && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-slate-600">End Time:</span>
                                    <span className="font-medium">{new Date(ev.endTime).toLocaleString()}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Performance Impact */}
                            {ev.kpis && (
                              <div className="space-y-3">
                                <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                                  <BarChart3 className="w-5 h-5 text-green-600" />
                                  Performance Impact
                                </h4>
                                <div className="bg-green-50 rounded-lg p-3 space-y-2">
                                  {ev.kpis.availability && (
                                    <div className="flex justify-between text-sm">
                                      <span className="text-green-700">Availability:</span>
                                      <span className="font-medium text-green-800">{ev.kpis.availability.toFixed(1)}%</span>
                                    </div>
                                  )}
                                  {ev.kpis.performance && (
                                    <div className="flex justify-between text-sm">
                                      <span className="text-green-700">Performance:</span>
                                      <span className="font-medium text-green-800">{ev.kpis.performance.toFixed(1)}%</span>
                                    </div>
                                  )}
                                  {ev.kpis.quality && (
                                    <div className="flex justify-between text-sm">
                                      <span className="text-green-700">Quality:</span>
                                      <span className="font-medium text-green-800">{ev.kpis.quality.toFixed(1)}%</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Root Cause & Actions */}
                          {(ev.rootCause || ev.correctiveActions || ev.preventiveActions) && (
                            <div className="space-y-3">
                              <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                                <Target className="w-5 h-5 text-purple-600" />
                                Analysis & Actions
                              </h4>
                              <div className="bg-purple-50 rounded-lg p-3 space-y-3">
                                {ev.rootCause && (
                                  <div>
                                    <span className="text-sm font-semibold text-purple-700">Root Cause:</span>
                                    <p className="text-sm text-purple-800 mt-1">{ev.rootCause}</p>
                                  </div>
                                )}
                                {ev.correctiveActions && ev.correctiveActions.length > 0 && (
                                  <div>
                                    <span className="text-sm font-semibold text-purple-700">Corrective Actions:</span>
                                    <ul className="text-sm text-purple-800 mt-1 space-y-1">
                                      {ev.correctiveActions.map((action, idx) => (
                                        <li key={idx} className="flex items-start gap-2">
                                          <span className="w-1 h-1 bg-purple-600 rounded-full mt-2 flex-shrink-0" />
                                          {action}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {ev.preventiveActions && ev.preventiveActions.length > 0 && (
                                  <div>
                                    <span className="text-sm font-semibold text-purple-700">Preventive Actions:</span>
                                    <ul className="text-sm text-purple-800 mt-1 space-y-1">
                                      {ev.preventiveActions.map((action, idx) => (
                                        <li key={idx} className="flex items-start gap-2">
                                          <span className="w-1 h-1 bg-purple-600 rounded-full mt-2 flex-shrink-0" />
                                          {action}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Tags and Notes */}
                          {(ev.tags || ev.notes) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {ev.tags && ev.tags.length > 0 && (
                                <div>
                                  <h5 className="text-sm font-semibold text-slate-700 mb-2">Tags</h5>
                                  <div className="flex flex-wrap gap-1">
                                    {ev.tags.map((tag, idx) => (
                                      <Badge key={idx} className="bg-slate-100 text-slate-700 text-xs">
                                        {tag}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {ev.notes && (
                                <div>
                                  <h5 className="text-sm font-semibold text-slate-700 mb-2">Notes</h5>
                                  <p className="text-sm text-slate-600 bg-slate-50 rounded p-2">{ev.notes}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            );
          })}

          {/* Next Phase Card */}
          <div className="ml-20">
            <Card className="border-0 shadow-lg bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                      <ArrowRightCircle className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-800">Proceed to Recommendations</h3>
                      <p className="text-slate-600 text-sm">Complete analysis and move to corrective action planning</p>
                    </div>
                  </div>
                  <Button className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white shadow-lg">
                    Continue Analysis
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {sortedEvents.length === 0 && (
        <div className="text-center py-12">
          <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="w-12 h-12 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">No Events Found</h3>
          <p className="text-slate-500">No RCA-related events have been recorded yet.</p>
        </div>
      )}
    </div>
  );
}; 