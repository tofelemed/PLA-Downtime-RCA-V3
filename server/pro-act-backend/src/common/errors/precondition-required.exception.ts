import { HttpException, HttpStatus } from '@nestjs/common';

/** 428: the request is missing a required precondition header (e.g. `Idempotency-Key`, `If-Match`). */
export class PreconditionRequiredException extends HttpException {
  constructor(code: string, message: string) {
    super({ code, message }, HttpStatus.PRECONDITION_REQUIRED);
  }
}
