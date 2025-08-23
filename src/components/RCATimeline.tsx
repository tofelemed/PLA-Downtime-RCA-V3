import React from 'react';
import { Card, CardHeader, CardContent, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { CheckCircle, AlertTriangle, Clock, Wrench, Users, FileText, Eye, ClipboardList, Info, Edit2, Trash2, Paperclip, ArrowRightCircle } from 'lucide-react';

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
  // Only show events linked to this RCA (production: by eventId, assetId, or evidence; manual: all)
  const allEvents = [
    ...productionEvents,
    ...manualEvents,
  ].filter(ev => !!ev.timestamp);
  // Sort by time
  const sortedEvents = [...allEvents].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return (
    <div className="w-full max-w-2xl mx-auto py-4 relative">
      {/* Vertical line with gradient and shadow */}
      <div className="absolute left-10 top-0 bottom-0 w-2 bg-gradient-to-b from-blue-300 via-pink-200 to-pink-400 shadow-xl rounded-full z-0 transition-all duration-500" style={{ minHeight: 60 * sortedEvents.length + 60 }} />
      <div className="flex flex-col gap-8 relative z-10">
        {sortedEvents.map((ev, idx) => (
          <div key={ev.id} className="flex items-start gap-6 relative group">
            {/* Dot with glow and icon */}
            <div className="flex flex-col items-center">
              <div className="relative z-20">
                <div className="absolute -inset-2 rounded-full bg-gradient-to-br from-blue-200 via-pink-200 to-pink-300 opacity-60 blur-lg animate-pulse" />
                {eventTypeIcons[ev.type] || eventTypeIcons['Info']}
              </div>
              {idx < sortedEvents.length - 1 && <div className="flex-1 w-2 bg-gradient-to-b from-blue-200 via-pink-200 to-pink-300 rounded-full" style={{ minHeight: 40 }} />}
            </div>
            {/* Card */}
            <Card className="flex-1 shadow-2xl border-0 rounded-2xl p-0 min-w-0 max-w-full bg-gradient-to-br from-white via-blue-50 to-pink-50 hover:shadow-3xl transition-all duration-300">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 px-5 pt-5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-extrabold text-blue-900 text-base truncate flex items-center gap-2">{ev.title}</span>
                  {ev.severity && <Badge className={severityColors[ev.severity] || 'bg-gray-100 text-gray-700'}>{ev.severity}</Badge>}
                  <Badge className="bg-blue-100 text-blue-700 text-xs font-semibold">{ev.type}</Badge>
                  {ev.asset && <Badge className="bg-purple-100 text-purple-700 text-xs font-semibold">{ev.asset}</Badge>}
                </div>
                <div className="flex gap-1">
                  {onEdit && <Button size="icon" variant="ghost" className="p-1 hover:bg-blue-100" onClick={() => onEdit(ev)} title="Edit"><Edit2 className="w-5 h-5" /></Button>}
                  {onDelete && <Button size="icon" variant="ghost" className="p-1 hover:bg-red-100" onClick={() => onDelete(ev)} title="Delete"><Trash2 className="w-5 h-5" /></Button>}
                  {onLinkEvidence && <Button size="icon" variant="ghost" className="p-1 hover:bg-pink-100" onClick={() => onLinkEvidence(ev)} title="Link Evidence"><Paperclip className="w-5 h-5" /></Button>}
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-0">
                <div className="flex items-center gap-2 mb-1 text-xs text-gray-500">
                  <span className="font-semibold bg-white/80 px-2 py-0.5 rounded shadow text-blue-700 border border-blue-100">{new Date(ev.timestamp).toLocaleString()}</span>
                  {ev.evidenceCount !== undefined && ev.evidenceCount > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-100 text-purple-700 text-xs font-semibold"><Paperclip className="w-4 h-4" /> {ev.evidenceCount} Evidence</span>
                  )}
                </div>
                <div className="text-sm text-gray-700 mb-1 min-w-0 truncate font-medium">{ev.description}</div>
              </CardContent>
            </Card>
          </div>
        ))}
        {/* Next Step Card/Button */}
        <div className="flex items-center gap-6 mt-8">
          <div className="flex flex-col items-center">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center shadow-xl animate-bounce">
              <ArrowRightCircle className="w-7 h-7 text-white" />
            </div>
          </div>
          <Card className="flex-1 shadow-2xl border-0 rounded-2xl p-0 min-w-0 max-w-full bg-gradient-to-r from-blue-100 via-pink-100 to-green-100 hover:shadow-3xl transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 px-5 pt-5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-extrabold text-green-900 text-lg flex items-center gap-2">Next Step</span>
                <Badge className="bg-green-200 text-green-800 text-xs font-semibold">Continue</Badge>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-0 flex items-center justify-between">
              <span className="text-base text-gray-700 font-semibold">Proceed to Recommendations & Analysis</span>
              <Button className="bg-gradient-to-r from-blue-600 to-pink-500 hover:from-blue-700 hover:to-pink-600 text-white shadow-lg rounded-full px-6 py-2 text-lg font-bold flex items-center gap-2">
                Go <ArrowRightCircle className="w-6 h-6" />
              </Button>
            </CardContent>
          </Card>
        </div>
        {sortedEvents.length === 0 && <div className="text-center text-gray-400 italic py-8">No RCA-related events found.</div>}
      </div>
    </div>
  );
}; 