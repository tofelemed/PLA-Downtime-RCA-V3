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
      'keep_override: the user value stays; accept_source: the latest source value replaces it; ' +
      'dismiss: only for declared_identity_mismatch, declared_window_mismatch and duplicate_declared_loss items (state dismissed)',
  })
  @IsIn(REVIEW_DECISIONS)
  decision!: ReviewDecision;
}
