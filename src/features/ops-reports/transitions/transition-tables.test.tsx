import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { TransitionRowView } from '@/api/v2/types/ops-reports';
import { TransitionsTable } from './transition-tables';

const row: TransitionRowView = {
  eventId: 'e1',
  unitId: 'u1',
  unitName: 'Line 1',
  start: '2027-03-01T03:30:00.000Z',
  end: '2027-03-01T06:30:00.000Z',
  seconds: '10800',
  fromProductId: 'a',
  fromProduct: 'HD5218',
  toProductId: 'b',
  toProduct: 'EX3',
  catalystFamily: null,
  operatingMode: null,
  standardId: 's1',
  referenceSeconds: '7200',
  referenceOffgrade: null,
  excessSeconds: '3600',
  uom: 't',
  allowanceLoss: '200',
  excessLoss: '100',
  offGrade: null,
  noStandard: false,
  calculated: true,
};

describe('TransitionsTable (R5)', () => {
  it('marks an overrun and says when a transition has no standard or is not calculated', () => {
    render(
      <TransitionsTable
        rows={[row, { ...row, eventId: 'e2', standardId: null, noStandard: true, excessSeconds: null }, { ...row, eventId: 'e3', calculated: false }]}
        timeZone="Asia/Tehran"
      />,
    );
    expect(screen.getByTestId('transition-excess')).toHaveAttribute('data-over', 'true');
    expect(screen.getByText('No standard')).toBeInTheDocument();
    expect(screen.getByText('Not calculated')).toBeInTheDocument();
    expect(screen.getAllByText('HD5218 → EX3')).toHaveLength(3);
  });
});
