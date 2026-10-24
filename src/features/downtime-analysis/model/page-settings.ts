import { DOWNTIME_PAGES, type DowntimeView } from '@/features/analysis-navigation/analysis-pages';

export type DowntimeFilterScope = 'period' | 'output' | 'operational' | 'reliability';

function filterScope(view: DowntimeView, mode: string | null): DowntimeFilterScope {
  if (view === 'stops') return 'operational';
  if (view === 'reliability') return 'reliability';
  if (view === 'causes' && mode !== 'reasons' && mode !== 'assets') return 'output';
  return 'period';
}

function needsBundle(view: DowntimeView, mode: string | null): boolean {
  if (view === 'overview' || view === 'trends') return true;
  return view === 'causes' && mode === 'assets';
}

export function downtimePageSettings(view: DowntimeView, params: URLSearchParams) {
  const mode = params.get(view === 'causes' ? 'analysis' : 'comparison');
  return {
    mode,
    bundled: needsBundle(view, mode),
    scope: filterScope(view, mode),
    page: DOWNTIME_PAGES.find((entry) => entry.key === view) ?? DOWNTIME_PAGES[0],
    showTrend: view === 'trends' && mode !== 'crew' && mode !== 'calendar',
  };
}
