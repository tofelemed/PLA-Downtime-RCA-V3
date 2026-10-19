import { describe, expect, it } from 'vitest';
import { V2ApiError } from '@/api/v2/errors';
import { importErrorsOf } from './dictionary-import-model';

describe('failure dictionary import (SME D11)', () => {
  it('reads the row problems of a refused import', () => {
    const error = new V2ApiError(422, {
      code: 'DICTIONARY_IMPORT_INVALID',
      message: 'The import has 1 invalid row; nothing was stored',
      correlationId: null,
      retryable: false,
      details: { errors: [{ line: 3, message: 'code and name are required' }] },
    });
    expect(importErrorsOf(error)).toEqual([{ line: 3, message: 'code and name are required' }]);
    expect(importErrorsOf(new Error('network'))).toEqual([]);
  });
});
