import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import {
  toArrayParam,
  toBooleanParam,
} from '../../../common/dto/query-param.transformers';
import { ListQueryDto } from '../../common/list-query.dto';

/** Stored values of the v1 `tasks` table (kept, so v1 rows read the same). */
export const TASK_STATUSES = [
  'Open',
  'In Progress',
  'Completed',
  'Cancelled',
] as const;
export const TASK_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'] as const;
export const TASK_LINK_TYPES = [
  'RCA',
  'RCARecommendation',
  'ProductionEvent',
  'ProductionPlan',
] as const;
export const TASK_SORTS = ['dueDate', '-createdAt', 'createdAt'] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export type TaskLinkType = (typeof TASK_LINK_TYPES)[number];

/** Filters shared by the list and the summary. */
export class TaskFiltersDto extends ListQueryDto {
  @ApiPropertyOptional({ enum: TASK_PRIORITIES, isArray: true })
  @IsOptional()
  @Transform(toArrayParam)
  @IsArray()
  @ArrayMaxSize(TASK_PRIORITIES.length)
  @IsIn(TASK_PRIORITIES, { each: true })
  priorities?: TaskPriority[];

  @ApiPropertyOptional({ description: 'Tasks assigned to you only' })
  @IsOptional()
  @Transform(toBooleanParam)
  @IsBoolean()
  assignedToMe?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @ApiPropertyOptional({ enum: TASK_LINK_TYPES })
  @IsOptional()
  @IsIn(TASK_LINK_TYPES)
  linkType?: TaskLinkType;

  @ApiPropertyOptional({ description: 'Tasks linked to this record' })
  @IsOptional()
  @IsUUID()
  linkId?: string;

  @ApiPropertyOptional({
    maxLength: 100,
    description: 'Search in title and description',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

/** `GET /v2/tasks`. */
export class TasksListQueryDto extends TaskFiltersDto {
  @ApiPropertyOptional({ enum: TASK_STATUSES, isArray: true })
  @IsOptional()
  @Transform(toArrayParam)
  @IsArray()
  @ArrayMaxSize(TASK_STATUSES.length)
  @IsIn(TASK_STATUSES, { each: true })
  statuses?: TaskStatus[];

  @ApiPropertyOptional({
    description: 'Due before now and not completed or cancelled',
  })
  @IsOptional()
  @Transform(toBooleanParam)
  @IsBoolean()
  overdue?: boolean;

  @ApiPropertyOptional({
    enum: TASK_SORTS,
    default: 'dueDate',
    description: 'dueDate: earliest due first, tasks without a due date last',
  })
  @IsOptional()
  @IsIn(TASK_SORTS)
  sort?: string = undefined;
}

export class CreateTaskV2Dto {
  @ApiProperty({ maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({ maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiProperty({ description: 'An active member of the plant' })
  @IsUUID()
  assigneeId: string;

  @ApiProperty({ enum: TASK_PRIORITIES })
  @IsIn(TASK_PRIORITIES)
  priority: TaskPriority;

  @ApiPropertyOptional({ enum: TASK_STATUSES, default: 'Open' })
  @IsOptional()
  @IsIn(TASK_STATUSES)
  status?: TaskStatus;

  @ApiPropertyOptional({ description: 'ISO 8601 instant' })
  @IsOptional()
  @IsISO8601()
  dueDate?: string;

  @ApiPropertyOptional({ enum: TASK_LINK_TYPES })
  @IsOptional()
  @IsIn(TASK_LINK_TYPES)
  linkType?: TaskLinkType;

  @ApiPropertyOptional({ description: 'Required with linkType' })
  @ValidateIf((dto: CreateTaskV2Dto) => dto.linkType !== undefined)
  @IsUUID()
  linkId?: string;

  @ApiPropertyOptional({
    description:
      'Item 5: the RCA action this task carries out; needs linkType RCA with the case of the action as linkId ' +
      '(422 INVALID_REFERENCE). One open task per action (409 ACTION_TASK_EXISTS).',
  })
  @IsOptional()
  @IsUUID()
  rcaActionId?: string;
}

export class UpdateTaskV2Dto {
  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ maxLength: 5000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @ApiPropertyOptional({ enum: TASK_PRIORITIES })
  @IsOptional()
  @IsIn(TASK_PRIORITIES)
  priority?: TaskPriority;

  @ApiPropertyOptional({ enum: TASK_STATUSES })
  @IsOptional()
  @IsIn(TASK_STATUSES)
  status?: TaskStatus;

  @ApiPropertyOptional({
    nullable: true,
    description: 'ISO 8601 instant; null clears it',
  })
  @IsOptional()
  @ValidateIf((_dto, value) => value !== null)
  @IsISO8601()
  dueDate?: string | null;

  @ApiPropertyOptional({
    enum: TASK_LINK_TYPES,
    nullable: true,
    description: 'null removes the link',
  })
  @IsOptional()
  @ValidateIf((_dto, value) => value !== null)
  @IsIn(TASK_LINK_TYPES)
  linkType?: TaskLinkType | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_dto, value) => value !== null)
  @IsUUID()
  linkId?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Item 5: the RCA action this task carries out (linkType RCA of the case of the action); null unlinks. ' +
      'Changing the link away from RCA clears it.',
  })
  @IsOptional()
  @ValidateIf((_dto, value) => value !== null)
  @IsUUID()
  rcaActionId?: string | null;
}
