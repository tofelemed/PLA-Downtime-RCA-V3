import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateTenantDto } from './create-tenant.dto';
import { UpdateTenantDisplaySettingsDto } from './update-tenant-display-settings.dto';
import { UpdateTenantDto } from './update-tenant.dto';

async function failedFields(
  type: new () => object,
  body: Record<string, unknown>,
): Promise<string[]> {
  const errors = await validate(plainToInstance(type, body));
  return errors.map((error) => error.property);
}

describe('tenant display settings DTOs', () => {
  it('accepts an empty body and every known value', async () => {
    expect(await failedFields(UpdateTenantDisplaySettingsDto, {})).toEqual([]);
    expect(
      await failedFields(UpdateTenantDisplaySettingsDto, {
        calendarSystem: 'gregorian',
        digits: 'latin',
      }),
    ).toEqual([]);
    expect(
      await failedFields(UpdateTenantDisplaySettingsDto, {
        calendarSystem: 'persian',
        digits: 'persian',
      }),
    ).toEqual([]);
  });

  it('refuses unknown calendar and digit values', async () => {
    expect(
      await failedFields(UpdateTenantDisplaySettingsDto, {
        calendarSystem: 'jalali',
        digits: 'arabic',
      }),
    ).toEqual(['calendarSystem', 'digits']);
  });

  it('applies the same rule on tenant create and update', async () => {
    expect(
      await failedFields(UpdateTenantDto, { calendarSystem: 'jalali' }),
    ).toEqual(['calendarSystem']);
    expect(
      await failedFields(CreateTenantDto, {
        code: 'T1',
        name: 'Plant 1',
        organizationId: '6f1c1b1e-8f43-4c1a-9d55-0d3c6b1f2a10',
        digits: 'jalali',
      }),
    ).toEqual(['digits']);
  });
});
