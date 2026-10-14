import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import {
  checkFailureCodes,
  classOfAssetType,
  EVENT_FIELD_OF_KIND,
  EventFailureField,
} from '../../domain/reliability/failure-dictionary';
import { failureCodesUnknown } from './failure-dictionary-errors';
import { dictionaryInForce } from './failure-dictionary-reads';

export interface FailureCodeCheck {
  tenantId: string;
  /** the event's asset after the write (its asset type selects the equipment class) */
  assetId: string | null;
  /** the event start: the dictionary in force then applies */
  at: Date;
  values: Partial<Record<EventFailureField, string | null | undefined>>;
}

const FIELDS = Object.values(EVENT_FIELD_OF_KIND);

/**
 * SME D11: event failure fields are codes of the plant's dictionary once it has entries of their kind
 * (422 FAILURE_CODE_UNKNOWN otherwise); without entries they stay free text, so existing events and
 * plants without a dictionary keep working. Only the fields a write sets are checked.
 */
@Injectable()
export class FailureDictionaryValidator {
  constructor(@InjectEntityManager() private readonly manager: EntityManager) {}

  async assertCodes(check: FailureCodeCheck): Promise<void> {
    const given = FIELDS.filter((field) => check.values[field]?.trim());
    if (given.length === 0) return;
    const entries = await dictionaryInForce(
      this.manager,
      check.tenantId,
      check.at,
    );
    if (entries.length === 0) return;
    const assetClass = classOfAssetType(
      entries,
      await this.assetType(check.tenantId, check.assetId),
    );
    const values = Object.fromEntries(
      given.map((field) => [field, check.values[field] ?? null]),
    );
    const problems = checkFailureCodes(values, entries, assetClass);
    if (problems.length > 0) throw failureCodesUnknown(problems);
  }

  private async assetType(
    tenantId: string,
    assetId: string | null,
  ): Promise<string | null> {
    if (!assetId) return null;
    const rows = await this.manager.query<Array<{ asset_type: string | null }>>(
      `SELECT "asset_type" FROM "assets" WHERE "id" = $1 AND "tenant_id" = $2`,
      [assetId, tenantId],
    );
    return rows[0]?.asset_type ?? null;
  }
}
