import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SeriesValuesTable } from './series-values-table';

describe('series values table (QA PLA re-test: OEE trend values)', () => {
  it('lists each bucket with the server values as percentages; a missing value says so', () => {
    render(
      <SeriesValuesTable
        caption="Values of the OEE chart"
        ratio
        series={[{ key: 'oee', label: 'OEE' }, { key: 'availability', label: 'Availability' }]}
        rows={[{ label: '2026-10-17', values: { oee: '0.924', availability: null } }]}
      />,
    );
    expect(screen.getByRole('columnheader', { name: 'OEE' })).toBeInTheDocument();
    const cells = screen.getAllByRole('cell').map((cell) => cell.textContent);
    expect(cells).toEqual(['2026-10-17', '92.4 %', 'Not available']);
  });
});
