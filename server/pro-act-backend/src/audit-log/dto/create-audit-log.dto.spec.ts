import { ValidationFailedException } from '../../common/errors/validation-failed.exception';
import { createValidationPipe } from '../../common/validation/validation-pipe.factory';
import { CreateAuditLogDto } from './create-audit-log.dto';

const pipe = createValidationPipe();
const validate = (payload: Record<string, unknown>) =>
  pipe.transform(payload, { type: 'body', metatype: CreateAuditLogDto });

describe('CreateAuditLogDto', () => {
  it('accepts the payload the frontend auditApi sends (was 400 on every field)', async () => {
    const payload = {
      userId: 'u-1',
      userName: 'Ana',
      action: 'UPDATE',
      entityType: 'ProductionPlan',
      entityId: '7b0d3f3e-7c3a-4a43-9a51-5f3e2f0b1c2d',
      details: '{"message":"changed"}',
      organizationId: '',
      tenantId: '',
      ipAddress: '10.0.0.1',
      userAgent: 'Mozilla/5.0',
      timestamp: '2026-10-08T10:00:00.000Z',
    };
    await expect(validate(payload)).resolves.toMatchObject(payload);
  });

  it('requires action and entityType', async () => {
    await expect(validate({ entityId: 'x' })).rejects.toBeInstanceOf(
      ValidationFailedException,
    );
  });

  it('still rejects undeclared fields', async () => {
    await expect(
      validate({ action: 'A', entityType: 'T', entityId: 'x', extra: true }),
    ).rejects.toBeInstanceOf(ValidationFailedException);
  });
});
