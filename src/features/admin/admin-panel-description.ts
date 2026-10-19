/** What each Admin panel tab holds, in the words of the page description. */
const TAB_TOPICS: Readonly<Record<string, string>> = {
  plants: 'plants and organizations',
  attributes: 'custom attributes',
  branding: 'branding',
  automation: 'status automation',
  settings: 'plant settings',
};

/**
 * QA_SHELL: the Admin panel description names only the tabs the user sees ("Plant settings." for a manager,
 * not the four tabs only administrators get).
 */
export function adminPanelDescription(tabs: readonly string[]): string {
  const topics = tabs.map((tab) => TAB_TOPICS[tab]).filter((topic): topic is string => Boolean(topic));
  if (topics.length === 0) return '';
  const list = topics.length === 1 ? topics[0] : `${topics.slice(0, -1).join(', ')} and ${topics[topics.length - 1]}`;
  return `${list.charAt(0).toUpperCase()}${list.slice(1)}.`;
}
