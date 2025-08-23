import React from 'react';
import { Chrono } from 'react-chrono';
import { AlertTriangle, Clock, Wrench, Users, FileText, Eye, ClipboardList, Info } from 'lucide-react';
import { Button } from './ui/button';

const eventTypeIcons = {
  Failure: <AlertTriangle className="w-5 h-5 text-red-500" />,
  Alarm: <Clock className="w-5 h-5 text-yellow-500" />,
  Action: <Users className="w-5 h-5 text-blue-500" />,
  Note: <FileText className="w-5 h-5 text-gray-500" />,
  Maintenance: <Wrench className="w-5 h-5 text-green-700" />,
  Inspection: <Eye className="w-5 h-5 text-purple-500" />,
  'Operator Action': <ClipboardList className="w-5 h-5 text-pink-500" />,
  Info: <Info className="w-5 h-5 text-cyan-500" />,
};

export interface TimelineEvent {
  id: string;
  type: string;
  title: string;
  timestamp: string;
  description?: string;
  asset?: string;
  severity?: string;
  evidenceCount?: number;
}

export interface EventTimelineProps {
  events: TimelineEvent[];
  onEdit?: (event: TimelineEvent) => void;
  onDelete?: (event: TimelineEvent) => void;
  onLinkEvidence?: (event: TimelineEvent) => void;
}

export const EventTimeline: React.FC<EventTimelineProps> = ({ events, onEdit, onDelete, onLinkEvidence }) => {
  // Sort events chronologically
  const sortedEvents = [...events].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Prepare items for react-chrono
  const items = sortedEvents.map(ev => ({
    title: new Date(ev.timestamp).toLocaleString(),
    cardTitle: ev.title,
    cardSubtitle: ev.asset ? `Asset/Unit: ${ev.asset}` : '',
    cardDetailedText: ev.description,
    icon: eventTypeIcons[ev.type] || <Info className="w-5 h-5 text-cyan-500" />,
    id: ev.id,
    severity: ev.severity,
    evidenceCount: ev.evidenceCount,
    type: ev.type,
  }));

  return (
    <div className="w-full max-w-4xl mx-auto">
      <Chrono
        items={items}
        mode="VERTICAL"
        cardHeight={180}
        theme={{
          primary: '#6366f1',
          secondary: '#f472b6',
          cardBgColor: '#fff',
          cardForeColor: '#1e293b',
        }}
        disableClickOnCircle
        allowDynamicUpdate
        hideControls
        cardPositionHorizontal="TOP"
        useReadMore={false}
        slideShow={false}
        classNames={{
          card: 'rounded-2xl shadow-lg border border-blue-100 p-4',
          title: 'font-bold text-blue-800',
          subtitle: 'text-xs text-gray-500',
        }}
        cardContent={(item) => (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 mb-1">
              {eventTypeIcons[item.type]}
              <span className="font-bold text-blue-900 text-base">{item.cardTitle}</span>
              {item.severity && <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${item.severity === 'High' ? 'bg-red-100 text-red-700' : item.severity === 'Medium' ? 'bg-yellow-100 text-yellow-700' : item.severity === 'Critical' ? 'bg-red-700 text-white' : 'bg-green-100 text-green-700'}`}>{item.severity}</span>}
            </div>
            <div className="text-xs text-gray-500 mb-1">{item.title}</div>
            <div className="text-xs text-gray-700 mb-1">{item.cardDetailedText}</div>
            <div className="flex flex-wrap gap-2 mt-1">
              {item.cardSubtitle && <span className="inline-block px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-xs font-semibold">{item.cardSubtitle}</span>}
              {typeof item.evidenceCount === 'number' && <span className="inline-block px-2 py-0.5 rounded bg-purple-100 text-purple-700 text-xs font-semibold">Evidence: {item.evidenceCount}</span>}
            </div>
            <div className="flex gap-2 mt-2">
              <Button size="sm" variant="outline" onClick={() => onEdit && onEdit(item)}>Edit</Button>
              <Button size="sm" variant="destructive" onClick={() => onDelete && onDelete(item)}>Delete</Button>
              <Button size="sm" variant="outline" onClick={() => onLinkEvidence && onLinkEvidence(item)}>Link Evidence</Button>
            </div>
          </div>
        )}
      />
    </div>
  );
}; 