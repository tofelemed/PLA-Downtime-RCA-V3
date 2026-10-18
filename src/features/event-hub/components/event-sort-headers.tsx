import { nextSortOf, type EventSort } from '../model/event-filters';

export interface EventSortControl {
  value: EventSort;
  onChange: (next: EventSort) => void;
}

interface SortHeaderSpec {
  label: string;
  testId: string;
  /** the column's two orders: [first click, second click] */
  orders: readonly [EventSort, EventSort];
  words: Readonly<Partial<Record<EventSort, string>>>;
}

const START: SortHeaderSpec = { label: 'Start', testId: 'sort-start', orders: ['newest', 'oldest'], words: { newest: 'newest first', oldest: 'oldest first' } };
const DURATION: SortHeaderSpec = {
  label: 'Duration',
  testId: 'sort-duration',
  orders: ['longest', 'shortest'],
  words: { longest: 'longest first', shortest: 'shortest first' },
};

function SortHeader({ spec, sort }: { spec: SortHeaderSpec; sort: EventSortControl }) {
  const active = spec.orders.includes(sort.value);
  const next = nextSortOf(sort.value, spec.orders);
  const state = active ? `sorted ${spec.words[sort.value]}` : 'not sorted';
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline"
      onClick={() => sort.onChange(next)}
      aria-label={`${spec.label}, ${state}. Sort ${spec.words[next]}`}
      data-testid={spec.testId}
      data-sort={active ? sort.value : 'none'}
    >
      {spec.label}
      <span aria-hidden="true" className={active ? undefined : 'text-muted-foreground'}>
        {active ? (sort.value === spec.orders[0] ? '↓' : '↑') : '↕'}
      </span>
    </button>
  );
}

/** E-1: the Start header toggles newest / oldest first (absent control: plain text). */
export function StartSortHeader({ sort }: { sort: EventSortControl | undefined }) {
  return sort ? <SortHeader spec={START} sort={sort} /> : <>Start</>;
}

/** E-1: the Duration header toggles longest / shortest first; a running stop counts as the longest. */
export function DurationSortHeader({ sort }: { sort: EventSortControl | undefined }) {
  return sort ? <SortHeader spec={DURATION} sort={sort} /> : <>Duration</>;
}
