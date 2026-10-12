import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusIcon, UiIcon, type AppIcon } from '@/lib/icons';
import { cn } from '@/lib/utils';
import { isPagerHidden, type PagerModel } from './pager-model';

export interface ListPagerProps {
  pager: PagerModel;
  /** accessible name of the pager navigation, e.g. "Events pages" */
  label?: string;
  className?: string;
}

const formatCount = (value: number) => value.toLocaleString();

function rangeText(pager: PagerModel): string {
  if (pager.rangeEnd === 0) return 'No rows';
  const range = `${formatCount(pager.rangeStart)}–${formatCount(pager.rangeEnd)}`;
  return pager.totalCount === null ? range : `${range} of ${formatCount(pager.totalCount)}`;
}

function pageText(pager: PagerModel): string {
  const page = formatCount(pager.pageIndex + 1);
  return pager.pageCount === null ? `Page ${page}` : `Page ${page} of ${formatCount(pager.pageCount)}`;
}

function PageSizeSelect({ pager }: { pager: PagerModel }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground" aria-hidden="true">Rows per page</span>
      <Select value={String(pager.pageSize)} onValueChange={(value) => pager.setPageSize(Number(value))}>
        <SelectTrigger className="h-9 w-[76px]" aria-label="Rows per page">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {pager.pageSizeOptions.map((size) => (
            <SelectItem key={size} value={String(size)}>
              {size}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

interface StepButtonProps {
  icon: AppIcon;
  label: string;
  disabled: boolean;
  busy?: boolean;
  onClick: () => void;
}

function StepButton({ icon: Icon, label, disabled, busy = false, onClick }: StepButtonProps) {
  const Glyph = busy ? StatusIcon.loading : Icon;
  return (
    <Button type="button" variant="outline" size="icon" className="h-9 w-9" aria-label={label} title={label} disabled={disabled} onClick={onClick}>
      <Glyph aria-hidden="true" className={cn(busy && 'animate-spin')} />
    </Button>
  );
}

function PageButtons({ pager }: { pager: PagerModel }) {
  const { goTo, pageCount } = pager;
  const showLast = pageCount !== null && goTo !== undefined;
  return (
    <div className="flex items-center gap-1">
      <StepButton icon={UiIcon.first} label="First page" disabled={!pager.canPrevious} onClick={pager.first} />
      <StepButton icon={UiIcon.previous} label="Previous page" disabled={!pager.canPrevious} onClick={pager.previous} />
      <span className="px-2 tabular-nums">
        {pageText(pager)}
      </span>
      <StepButton icon={UiIcon.next} label="Next page" disabled={!pager.canNext || pager.isFetchingPage} busy={pager.isFetchingPage} onClick={pager.next} />
      {showLast && (
        <StepButton icon={UiIcon.last} label="Last page" disabled={!pager.canNext} onClick={() => goTo(pageCount - 1)} />
      )}
    </div>
  );
}

function AppendControls({ pager }: { pager: PagerModel }) {
  return (
    <>
      <span className="tabular-nums text-muted-foreground" aria-live="polite">
        Showing {formatCount(pager.rangeEnd)}
      </span>
      {pager.hasMore && pager.loadMore && (
        <Button type="button" variant="outline" size="sm" disabled={pager.isFetchingPage} onClick={pager.loadMore}>
          {pager.isFetchingPage && <StatusIcon.loading aria-hidden="true" className="animate-spin" />}
          Show more
        </Button>
      )}
    </>
  );
}

/**
 * Pager bar under a long list: "Rows per page", "21–40 of 135", First / Previous / "Page 2 of 7" / Next
 * (/ Last when the page count is known); in `append` mode "Showing 40" and "Show more". Renders nothing
 * when everything fits on the first page (see `isPagerHidden`). `DataTable` renders it for you.
 *
 * @example <ListPager pager={pager} label="Audit entries pages" />
 */
export function ListPager({ pager, label = 'Pagination', className }: ListPagerProps) {
  if (isPagerHidden(pager)) return null;
  return (
    <nav aria-label={label} className={cn('flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-sm', className)}>
      {pager.mode === 'append' ? (
        <AppendControls pager={pager} />
      ) : (
        <>
          <PageSizeSelect pager={pager} />
          <span className="tabular-nums text-muted-foreground" aria-live="polite">
            {rangeText(pager)}
          </span>
          <PageButtons pager={pager} />
        </>
      )}
    </nav>
  );
}
