import { WINDOW_PRESETS } from './event-filters';
import type { RelativeWindow } from './relative-window';

export type WindowPreset = RelativeWindow;

/** The Event Hub list opens on the last 7 days unless the user picked another preset before. */
export const DEFAULT_WINDOW_PRESET: WindowPreset = WINDOW_PRESETS.find((preset) => preset.hours === 24 * 7) ?? WINDOW_PRESETS[0];

const keyOf = (userId: string, tenantId: string) => `proact.eventHub.window.${userId}.${tenantId}`;

/**
 * The preset this user last chose in this plant (per browser, `localStorage`), or the default. Only
 * presets are remembered (a shift or custom window is a one-off); storage may be unavailable or blocked.
 */
export function readWindowPreference(userId: string | null, tenantId: string | null): WindowPreset {
  if (!userId || !tenantId) return DEFAULT_WINDOW_PRESET;
  try {
    const hours = Number(window.localStorage.getItem(keyOf(userId, tenantId)));
    return WINDOW_PRESETS.find((preset) => preset.hours === hours) ?? DEFAULT_WINDOW_PRESET;
  } catch {
    return DEFAULT_WINDOW_PRESET;
  }
}

/** Remembers the window when it is one of the presets (matched by its label); anything else is ignored. */
export function rememberWindow(userId: string | null, tenantId: string | null, windowLabel: string): void {
  const preset = WINDOW_PRESETS.find((entry) => entry.label === windowLabel);
  if (!userId || !tenantId || !preset) return;
  try {
    window.localStorage.setItem(keyOf(userId, tenantId), String(preset.hours));
  } catch {
    // storage blocked (private mode, quota): the default applies next time
  }
}
