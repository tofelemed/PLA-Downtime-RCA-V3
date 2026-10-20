import { EntityManager } from 'typeorm';
import {
  requireTenantId,
  RequestContext,
} from '../../common/context/request-context';
import { invalid } from '../../profiles/profile-errors';
import { namedReportUnits } from '../reports/report-scope';
import { CreateShiftNoteDto } from './ops-reports-v2.dto';

export interface ShiftNoteView {
  id: string;
  unitId: string;
  localDate: string;
  shiftName: string;
  body: string;
  createdAt: string;
  createdBy: string | null;
  authorName: string | null;
}

interface Row {
  id: string;
  unit_id: string;
  local_date: string;
  shift_name: string;
  body: string;
  created_at: Date;
  created_by: string | null;
  author_name: string | null;
}

const toView = (r: Row): ShiftNoteView => ({
  id: r.id,
  unitId: r.unit_id,
  localDate: r.local_date,
  shiftName: r.shift_name,
  body: r.body,
  createdAt: r.created_at.toISOString(),
  createdBy: r.created_by,
  authorName: r.author_name,
});

const SELECT = `SELECT n."id", n."unit_id", to_char(n."local_date", 'YYYY-MM-DD') AS "local_date", n."shift_name",
       n."body", n."created_at", n."created_by", u."name" AS "author_name"
  FROM "shift_notes" n LEFT JOIN "users" u ON u."id" = n."created_by"`;

/** Notes of a shift on the units, oldest first (IDX_shift_notes_tenant_unit_shift). */
export async function shiftNotes(
  manager: EntityManager,
  input: {
    tenantId: string;
    unitIds: string[];
    localDate: string;
    shiftName: string;
  },
): Promise<ShiftNoteView[]> {
  const rows: Row[] = await manager.query(
    `${SELECT}
      WHERE n."tenant_id" = $1 AND n."unit_id" = ANY($2::uuid[]) AND n."local_date" = $3::date AND n."shift_name" = $4
      ORDER BY n."created_at", n."id"`,
    [input.tenantId, input.unitIds, input.localDate, input.shiftName],
  );
  return rows.map(toView);
}

/**
 * Appends a handover note (R2): the unit must be a unit of the tenant and of the caller's scope (422
 * INVALID_REFERENCE); the author is the caller. Notes are never edited or deleted.
 */
export async function createShiftNote(
  manager: EntityManager,
  context: RequestContext,
  body: CreateShiftNoteDto,
): Promise<ShiftNoteView> {
  const tenantId = requireTenantId(context);
  const text = body.body.trim();
  if (!text) throw invalid('INVALID_NOTE', 'body must not be blank');
  await namedReportUnits(manager, context, [body.unitId]);
  const [created]: Array<{ id: string }> = await manager.query(
    `INSERT INTO "shift_notes" ("tenant_id", "unit_id", "local_date", "shift_name", "body", "created_by", "updated_by", "row_version")
     VALUES ($1, $2, $3::date, $4, $5, $6, $6, 1) RETURNING "id"`,
    [
      tenantId,
      body.unitId,
      body.localDate,
      body.shiftName,
      text,
      context.userId ?? null,
    ],
  );
  const [row]: Row[] = await manager.query(
    `${SELECT} WHERE n."id" = $1 AND n."tenant_id" = $2`,
    [created.id, tenantId],
  );
  return toView(row);
}
