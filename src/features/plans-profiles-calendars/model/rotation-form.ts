/** The fields of the "Add rotation" dialog (ISO dates, the cycle as typed). */
export interface RotationValues {
  crewId: string;
  cycle: string;
  anchorDate: string;
  effectiveFrom: string;
}

const REQUIRED: Readonly<Record<keyof RotationValues, string>> = {
  crewId: 'Choose a crew.',
  cycle: 'Enter the shift cycle.',
  anchorDate: 'Enter cycle day 1.',
  effectiveFrom: 'Enter the date it applies from.',
};

/** The message under each empty field (the server checks the rest). */
export function rotationErrors(values: RotationValues): Partial<Record<keyof RotationValues, string>> {
  const keys = Object.keys(REQUIRED) as (keyof RotationValues)[];
  return Object.fromEntries(keys.filter((key) => !values[key].trim()).map((key) => [key, REQUIRED[key]]));
}
