/** `GET /api/v2/units` item (backend `src/v2/units/unit-v2.view.ts`). */
export interface UnitView {
  id: string;
  code: string;
  name: string;
  siteId: string | null;
}

/** `GET /api/v2/shift-instances` item (backend `ShiftInstanceV2View`). */
export interface ShiftInstanceView {
  id: string | null;
  unitId: string | null;
  localDate: string;
  shiftName: string;
  utcStart: string;
  utcEnd: string;
  durationSeconds: number;
  localStart: string;
  localEnd: string;
  isExcluded: boolean;
}
