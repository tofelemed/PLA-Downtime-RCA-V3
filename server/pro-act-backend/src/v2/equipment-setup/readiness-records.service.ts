import { Injectable, NotFoundException } from '@nestjs/common';
import { Asset } from '../../asset/asset.entity';
import { CalendarVersion } from '../../calendar/entities/calendar-version.entity';
import { Site } from '../../calendar/entities/site.entity';
import { versionOn } from '../../calendar/calendar-resolution';
import { RequestContext } from '../../common/context/request-context';
import { operationalDateAt } from '../../domain/calendar/schedule-metrics';
import { datesInRange, normalizeTime } from '../../domain/calendar/wall-clock';
import { UnitImpactRule } from '../../plant-model/entities/unit-impact-rule.entity';
import { Product } from '../../product/product.entity';
import { ReasonCode } from '../../reason-code/reason-code.entity';
import { Unit } from '../../unit/unit.entity';
import { check, coverageCheck, overlapping } from './readiness-checks';
import { EquipmentReadinessQueryDto } from './readiness-v2.dto';
import { ReadinessStore } from './readiness-store';
import { plural } from '../../common/helpers/plural';

@Injectable()
export class ReadinessRecordsService {
  constructor(private readonly store: ReadinessStore) {}
  async read(
    context: RequestContext,
    query: EquipmentReadinessQueryDto,
    unit: Unit,
  ) {
    const results = await Promise.all([
      this.assets(context, query),
      this.product(context, query),
      this.codes(context, query),
      this.calendar(context, query, unit),
      this.impact(context, query),
    ]);
    return [
      check(
        'unit',
        unit.retiredAt ? 'needs_attention' : 'ready',
        unit.retiredAt
          ? 'This production unit is retired.'
          : `${unit.name} belongs to the selected plant.`,
      ),
      ...results.flat(),
    ];
  }
  private async assets(
    context: RequestContext,
    query: EquipmentReadinessQueryDto,
  ) {
    const exists = await this.store
      .query(Asset, context, 'unitId')
      .andWhere('r.unitId = :unitId AND r.retiredAt IS NULL', query)
      .getExists();
    return check(
      'assets',
      exists ? 'ready' : 'missing',
      exists
        ? 'Active equipment exists under this unit. Review its hierarchy and classifications on the asset page.'
        : 'Create at least the extruder equipment under this unit.',
    );
  }
  private async product(
    context: RequestContext,
    query: EquipmentReadinessQueryDto,
  ) {
    if (!query.productId)
      return check(
        'product',
        'not_checked',
        'Choose the product grade to check its profile, rates and valuation.',
      );
    const product = await this.store
      .query(Product, context)
      .andWhere('r.id = :id', { id: query.productId })
      .getOne();
    if (!product)
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Product not found',
      });
    return check(
      'product',
      product.isActive ? 'ready' : 'needs_attention',
      product.isActive
        ? `${product.code}: ${product.name} is active.`
        : 'The selected product is inactive.',
    );
  }
  private async codes(
    context: RequestContext,
    query: EquipmentReadinessQueryDto,
  ) {
    const qb = this.store
      .query(ReasonCode, context)
      .andWhere('r.isActive = true AND r.defaultOeeComponent IS NOT NULL')
      .andWhere(
        '(r.effectiveFrom IS NULL OR r.effectiveFrom <= :from) AND (r.effectiveTo IS NULL OR r.effectiveTo >= :to)',
        query,
      );
    const children = qb
      .subQuery()
      .select('1')
      .from(ReasonCode, 'child')
      .where(
        'child.tenantId = r.tenantId AND child.parentId = r.id AND child.isActive = true',
      )
      .getQuery();
    const exists = await qb.andWhere(`NOT EXISTS ${children}`).getExists();
    return check(
      'codes',
      exists ? 'ready' : 'missing',
      exists
        ? 'At least one active leaf reason with an OEE default covers this window. Review whether the library covers all expected failures.'
        : 'Add an active leaf reason with an OEE default effective for this window; library headings alone cannot code events.',
    );
  }
  private async calendar(
    context: RequestContext,
    query: EquipmentReadinessQueryDto,
    unit: Unit,
  ) {
    const site = await this.store
      .query(Site, context)
      .andWhere(unit.siteId ? 'r.id = :id' : 'r.isDefault = true', {
        id: unit.siteId,
      })
      .getOne();
    if (!site)
      return check(
        'calendar',
        'missing',
        'The unit needs a site or the plant default site before calendar resolution.',
      );
    const from = operationalDateAt(
      new Date(query.from),
      site.timezone,
      normalizeTime(site.operationalDayStart),
    );
    const to = operationalDateAt(
      new Date(Date.parse(query.to) - 1),
      site.timezone,
      normalizeTime(site.operationalDayStart),
    );
    const versions = await this.store.rows(
      this.store
        .query(CalendarVersion, context)
        .andWhere(
          'r.siteId = :siteId AND (r.unitId = :unitId OR r.unitId IS NULL)',
          { siteId: site.id, unitId: unit.id },
        )
        .andWhere(
          'r.effectiveFrom <= :to AND (r.effectiveTo IS NULL OR r.effectiveTo > :from)',
          { from, to },
        ),
    );
    const dates = datesInRange(from, to);
    const published = versions.filter((row) => row.state === 'published');
    const missing = dates.filter(
      (date) => !versionOn(published, unit.id, date),
    );
    return check(
      'calendar',
      missing.length
        ? versions.length
          ? 'needs_attention'
          : 'missing'
        : 'ready',
      missing.length
        ? `No published calendar on ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? '…' : ''} (${site.timezone}). Publish the applicable version.`
        : `Published versions cover all ${dates.length} operational dates in ${site.timezone}; generated shifts are checked when generating the plan.`,
      (dates.length - missing.length) / dates.length,
    );
  }
  private async impact(
    context: RequestContext,
    query: EquipmentReadinessQueryDto,
  ) {
    const rows = await this.store.rows(
      overlapping(
        this.store
          .query(UnitImpactRule, context, 'unitId')
          .andWhere('r.unitId = :unitId', query),
        query,
      ),
    );
    if (!rows.length)
      return check(
        'impact',
        'optional',
        'No impact rules overlap this window. Configure these when asset derating or standby behavior is required.',
      );
    const pending = rows.filter((row) => row.state !== 'approved');
    if (pending.length)
      return check(
        'impact',
        'needs_attention',
        `${plural(pending.length, 'applicable impact rule version is', 'applicable impact rule versions are')} not approved.`,
      );
    // A rule per asset: one asset's coverage must never hide another asset's gap.
    const assets = [...new Set(rows.map((row) => row.assetId))];
    const gaps = assets.filter(
      (asset) =>
        coverageCheck(
          'impact',
          rows.filter((row) => row.assetId === asset),
          query,
        ).status !== 'ready',
    );
    return check(
      'impact',
      gaps.length ? 'needs_attention' : 'ready',
      gaps.length
        ? `${plural(gaps.length, 'configured asset has', 'configured assets have')} impact-rule coverage gaps.`
        : 'Every configured asset impact rule covers this window and is approved.',
    );
  }
}
