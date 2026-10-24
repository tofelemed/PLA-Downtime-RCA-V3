/** One short note per tab about what is not decided or not automatic yet (plain language, no codes). */
export interface DecisionNote {
  id: string;
  label: string;
  text: string;
}

const NOTES: Readonly<Record<string, DecisionNote>> = {
  profiles: {
    id: 'valuation',
    label: 'rates and valuation',
    text: 'Rates are entered in USD or IRR. Losses are valued only after finance approves a valuation policy. Plans need approved rates: there is no default rate.',
  },
  calendars: {
    id: 'calendar',
    label: 'the plant calendar',
    text: 'Create and publish the plant calendar here. A holiday with “Reduced hours” is flagged in the preview but does not shorten the shifts yet.',
  },
};

/** The note of a tab, or null (Plans and the other Profiles tabs have none). */
export const decisionNoteOf = (tab: string): DecisionNote | null => NOTES[tab] ?? null;
