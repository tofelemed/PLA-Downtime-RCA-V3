import { useSharedLessons } from '@/api/v2/queries/rca-knowledge';
import type { SharedLessonView } from '@/api/v2/types/rca-knowledge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useRcaFormat } from '@/features/rca/use-rca-format';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { RCA_LESSON_STATUS_LABELS } from '@/features/ux-kit/labels/rca-labels';
import { humanize } from '@/features/ux-kit/labels';

function Lesson({ lesson }: { lesson: SharedLessonView }) {
  const { date } = useRcaFormat();
  return (
    <li className="space-y-1 rounded border p-3 text-sm" data-testid="shared-lesson">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{lesson.title}</span>
        <Badge variant={lesson.lessonStatus === 'caution' ? 'destructive' : 'secondary'}>
          {RCA_LESSON_STATUS_LABELS[lesson.lessonStatus] ?? lesson.lessonStatus}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        {lesson.sourcePlant} · shared {date(lesson.sharedAt)}
        {lesson.failureMode ? ` · failure mode: ${humanize(lesson.failureMode)}` : ''}
        {lesson.equipmentCategory ? ` · ${lesson.equipmentCategory}` : ''}
      </p>
      {lesson.problemStatement && <p>Problem: {lesson.problemStatement}</p>}
      {lesson.rootCause && <p>Root cause: {lesson.rootCause}</p>}
      {lesson.recommendations.length > 0 && (
        <ul className="list-disc pl-5">
          {lesson.recommendations.map((title) => (
            <li key={title}>{title}</li>
          ))}
        </ul>
      )}
    </li>
  );
}

/** SME CA9: read-only lessons of other plants of the organization, newest first. */
export function SharedLessons() {
  const lessons = useSharedLessons();
  return (
    <DataState
      state={dataStateOf(lessons, { isEmpty: lessons.items.length === 0 })}
      error={lessons.error}
      onRetry={() => lessons.refetch()}
      detail='No other plant of your organization has shared a lesson yet.'
    >
      <ul className="space-y-2">
        {lessons.items.map((lesson) => (
          <Lesson key={lesson.id} lesson={lesson} />
        ))}
      </ul>
      {lessons.hasNextPage && (
        <Button variant="outline" size="sm" disabled={lessons.isFetchingNextPage} onClick={() => void lessons.fetchNextPage()}>
          Show more
        </Button>
      )}
    </DataState>
  );
}
