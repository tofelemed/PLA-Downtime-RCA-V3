import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import {
  REVIEW_DECISIONS,
  ReviewDecision,
} from '../../production-event/revisions/review-resolution';

/** `POST /api/v2/event-review-items/{id}/resolve` */
export class ResolveReviewItemDto {
  @ApiProperty({
    enum: REVIEW_DECISIONS,
    description:
      'keep_override: the user value stays; accept_source: the latest source value replaces it',
  })
  @IsIn(REVIEW_DECISIONS)
  decision!: ReviewDecision;
}
