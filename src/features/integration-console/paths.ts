/** Routes of the Connectivity area (src/app/routes/integration.tsx); every record is deep-linkable. */
export const CONSOLE_PATH = '/connectivity';
export const NEW_CONNECTION_PATH = '/connectivity/connections/new';
export const NEW_MAPPING_PATH = '/connectivity/mappings/new';
export const HISTORIAN_PATH = '/enhanced-historian';
/** SME R13: which source statuses are released (versions per source system) */
export const STATUS_MAPPINGS_PATH = '/connectivity/source-status';

export type ConsoleTab = 'connections' | 'quarantine' | 'mappings';

export const consolePath = (tab: ConsoleTab = 'connections'): string => (tab === 'connections' ? CONSOLE_PATH : `${CONSOLE_PATH}?tab=${tab}`);
export const connectionPath = (id: string, tab?: string): string => `/connectivity/connections/${id}${tab ? `?tab=${tab}` : ''}`;
export const editConnectionPath = (id: string): string => `/connectivity/connections/${id}/edit`;
export const newSignalPath = (connectionId: string): string => `/connectivity/connections/${connectionId}/signals/new`;
export const exceptionPath = (id: string): string => `/connectivity/quarantine/${id}`;
export const mappingPath = (id: string): string => `/connectivity/mappings/${id}`;

/** The historian trend of one or more signals (`?signal=<id>` repeated). */
export function historianPath(signalIds: readonly string[]): string {
  const params = new URLSearchParams();
  for (const id of signalIds) params.append('signal', id);
  const query = params.toString();
  return query ? `${HISTORIAN_PATH}?${query}` : HISTORIAN_PATH;
}
