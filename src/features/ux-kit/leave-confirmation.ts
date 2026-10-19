/**
 * The question "leave this page and discard the unsaved changes?" asked through the app's own dialog
 * (`UnsavedChangesDialogHost`, mounted once by the app). Without a mounted host (isolated tests,
 * pages rendered outside the app shell) callers fall back to the browser's `confirm()`.
 */
interface PendingLeave {
  message: string;
  resolve: (leave: boolean) => void;
}

let pending: PendingLeave | null = null;
let hostCount = 0;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

/** Registers a mounted dialog host; the returned function unregisters it. */
export function registerLeaveHost(): () => void {
  hostCount += 1;
  return () => {
    hostCount -= 1;
    if (hostCount === 0) settleLeave(false);
  };
}

export function hasLeaveHost(): boolean {
  return hostCount > 0;
}

export function subscribeLeave(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The question on screen, or null. */
export function pendingLeaveMessage(): string | null {
  return pending?.message ?? null;
}

/** Asks the host; resolves true to leave. A newer question answers an older one "stay". */
export function requestLeave(message: string): Promise<boolean> {
  pending?.resolve(false);
  return new Promise<boolean>((resolve) => {
    pending = { message, resolve };
    emit();
  });
}

/** The host's answer. A second answer for the same question is ignored. */
export function settleLeave(leave: boolean): void {
  const current = pending;
  if (!current) return;
  pending = null;
  emit();
  current.resolve(leave);
}
