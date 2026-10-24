/** True when the server marks any of these figures provisional (`KpiAggregateView.quality`); a flag, never a calculation. */
export const anyProvisional = (views: ReadonlyArray<{ quality: string } | null | undefined>): boolean => views.some((view) => view?.quality === 'provisional');
