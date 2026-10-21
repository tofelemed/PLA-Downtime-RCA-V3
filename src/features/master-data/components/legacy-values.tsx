import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Section } from '@/features/ux-kit/page-layout';

/**
 * v1 values the v2 calculations never read (DECISIONS 3.4 "Legacy fields"), folded away with a pointer to
 * what replaces them: rates and ideal times come from production profiles.
 */
export function LegacyValues({ children }: { children: ReactNode }) {
  return (
    <Section
      title="Legacy values"
      headingLevel={3}
      collapsible
      defaultOpen={false}
      description={
        <>
          Kept from the previous version; calculations do not use them. Rates and ideal times come from{' '}
          <Link className="underline" to="/setup/profiles">
            production profiles
          </Link>
          .
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </Section>
  );
}
