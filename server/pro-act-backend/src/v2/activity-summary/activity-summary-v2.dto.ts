import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';
import { INSTANT, INSTANT_MESSAGE } from '../profiles/profile-v2.dto';

/** Window of the activity summary: records created in `[from, to)`, at most 400 days. */
export class ActivitySummaryQueryDto {
  @ApiProperty({
    description:
      'Records created at or after this instant (ISO 8601 with offset)',
  })
  @Matches(INSTANT, { message: `from ${INSTANT_MESSAGE}` })
  from: string = '';

  @ApiProperty({
    description:
      'Records created before this instant (exclusive); ≤ 400 days after from',
  })
  @Matches(INSTANT, { message: `to ${INSTANT_MESSAGE}` })
  to: string = '';
}
