import type { ReactNode } from 'react';
import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';
import { Section } from '@/features/ux-kit/page-layout';

const LEGACY_INFO = 'Kept from the previous version; calculations do not use them. Rates and ideal times come from production profiles.';

/**
 * v1 values the v2 calculations never read (DECISIONS 3.4 "Legacy fields"), folded away with a pointer to
 * what replaces them behind the ⓘ: rates and ideal times come from production profiles.
 */
export function LegacyValues({ children }: { children: ReactNode }) {
  return (
    <Section
      title="Legacy values"
      headingLevel={3}
      collapsible
      defaultOpen={false}
      titleAside={<KpiInfo label="Legacy values" text={LEGACY_INFO} />}
    >
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </Section>
  );
}
