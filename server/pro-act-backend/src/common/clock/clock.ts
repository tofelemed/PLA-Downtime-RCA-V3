import { Injectable } from '@nestjs/common';

/** The current instant; injected so tests can fix "now" (DT-09). */
export abstract class Clock {
  abstract now(): Date;
}

/** Wall-clock time of the server. */
@Injectable()
export class SystemClock extends Clock {
  now(): Date {
    return new Date();
  }
}
