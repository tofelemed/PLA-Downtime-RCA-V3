import React, { useState } from 'react';
import { TimeSeriesMode } from '@/services/historian/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export const HistorianQueryForm: React.FC<{
  defaultStart: string;
  defaultEnd: string;
  onSubmit: (v: {
    mode: TimeSeriesMode;
    start: string;
    end: string;
    interval?: string;
    intervals?: number;
    includeBad?: boolean;
    boundaryType?: 'Inside'|'Outside'|'Exact'|'Interpolated';
    summaryTypes?: string;
  }) => void;
}> = ({ defaultStart, defaultEnd, onSubmit }) => {
  const [mode, setMode] = useState<TimeSeriesMode>('recorded');
  const [start, setStart] = useState<string>(defaultStart);
  const [end, setEnd] = useState<string>(defaultEnd);
  const [interval, setInterval] = useState<string>('1m');
  const [intervals, setIntervals] = useState<number>(300);
  const [includeBad, setIncludeBad] = useState<boolean>(false);
  const [boundaryType, setBoundaryType] = useState<'Inside'|'Outside'|'Exact'|'Interpolated'>('Inside');
  const [summaryTypes, setSummaryTypes] = useState<string>('Average;Minimum;Maximum;Total;Count');

  return (
    <div className="grid grid-cols-7 gap-3 items-end">
      <div>
        <Label>Mode</Label>
        <select className="w-full border rounded px-2 py-1" value={mode} onChange={e => setMode(e.target.value as TimeSeriesMode)}>
          <option value="recorded">Recorded</option>
          <option value="interpolated">Interpolated</option>
          <option value="summary">Summary</option>
          <option value="plot">Plot</option>
        </select>
      </div>
      <div>
        <Label>Start (UTC ISO)</Label>
        <Input value={start} onChange={e => setStart(e.target.value)} />
      </div>
      <div>
        <Label>End (UTC ISO)</Label>
        <Input value={end} onChange={e => setEnd(e.target.value)} />
      </div>
      {(mode === 'interpolated' || mode === 'summary') && (
        <div>
          <Label>Interval</Label>
          <Input value={interval} onChange={e => setInterval(e.target.value)} />
        </div>
      )}
      {mode === 'plot' && (
        <div>
          <Label>Intervals</Label>
          <Input type="number" value={intervals} onChange={e => setIntervals(Number(e.target.value||'0'))} />
        </div>
      )}
      {mode === 'recorded' && (
        <>
          <div>
            <Label>Boundary</Label>
            <select className="w-full border rounded px-2 py-1" value={boundaryType} onChange={e => setBoundaryType(e.target.value as any)}>
              <option value="Inside">Inside</option>
              <option value="Outside">Outside</option>
              <option value="Exact">Exact</option>
              <option value="Interpolated">Interpolated</option>
            </select>
          </div>
          <div>
            <Label className="block">Include Bad</Label>
            <input type="checkbox" checked={includeBad} onChange={e => setIncludeBad(e.target.checked)} />
          </div>
        </>
      )}
      {mode === 'summary' && (
        <div className="col-span-2">
          <Label>Summary Types</Label>
          <Input value={summaryTypes} onChange={e => setSummaryTypes(e.target.value)} />
        </div>
      )}
      <div>
        <Button onClick={() => onSubmit({ mode, start, end, interval, intervals, includeBad, boundaryType, summaryTypes })}>Run</Button>
      </div>
    </div>
  );
};

