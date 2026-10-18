import { useNumberFormat } from '@/features/ux-kit/use-number-format';

export interface ChartTableRow {
  key: string;
  label: string;
  values: ReadonlyArray<number | null | undefined>;
}

/** The data of a report chart as a plain table (the "View as table" alternative, H-6). */
export function ChartTable({ caption, headers, rows }: { caption: string; headers: readonly string[]; rows: readonly ChartTableRow[] }) {
  const { axis } = useNumberFormat();
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="border-b text-left">
          {headers.map((header, index) => (
            <th key={header} scope="col" className={index === 0 ? 'py-1 pr-2 font-medium' : 'py-1 pl-2 text-right font-medium'}>
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key} className="border-b last:border-0">
            <th scope="row" className="py-1 pr-2 text-left font-normal">{row.label}</th>
            {row.values.map((value, index) => (
              <td key={headers[index + 1] ?? index} className="py-1 pl-2 text-right tabular-nums">
                {value === null || value === undefined ? '—' : axis(value)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
