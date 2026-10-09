import { SetMetadata } from '@nestjs/common';

export const READ_ONLY_ALLOWED_KEY = 'readOnlyAllowed';

/**
 * A mutating HTTP method that does not change business data (previews that store nothing, export
 * requests over data the caller may already read, client audit entries): read-only callers may use it.
 * `WriteAccessGuard` refuses every other POST / PUT / PATCH / DELETE to them.
 */
export const ReadOnlyAllowed = () => SetMetadata(READ_ONLY_ALLOWED_KEY, true);
