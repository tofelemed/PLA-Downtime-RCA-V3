import React from 'react';

const WORKFLOW_PHASES = [
  'Definition',
  'Data Collection',
  'Analysis',
  'Recommendations',
  'Approval',
  'Closure',
];

const STATUS_TO_PHASE = {
  'Draft': 'Definition',
  'In Progress': 'Data Collection',
  'Analysis': 'Analysis',
  'Published': 'Recommendations',
  'Closed': 'Closure',
};

export function RCAWorkflowStepper({ currentStatus }: { currentStatus: string }) {
  const currentPhase = STATUS_TO_PHASE[currentStatus] || 'Definition';
  const currentIdx = WORKFLOW_PHASES.indexOf(currentPhase);
  return (
    <div className="flex items-center gap-4 w-full my-4">
      {WORKFLOW_PHASES.map((phase, idx) => (
        <React.Fragment key={phase}>
          <div className={`flex flex-col items-center ${idx <= currentIdx ? 'text-blue-600 font-bold' : 'text-gray-400'}`}>
            <div className={`rounded-full w-8 h-8 flex items-center justify-center border-2 ${idx <= currentIdx ? 'border-blue-600 bg-blue-100' : 'border-gray-300 bg-gray-100'}`}>{idx + 1}</div>
            <span className="text-xs mt-1 whitespace-nowrap">{phase}</span>
          </div>
          {idx < WORKFLOW_PHASES.length - 1 && (
            <div className={`flex-1 h-1 ${idx < currentIdx ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
} 