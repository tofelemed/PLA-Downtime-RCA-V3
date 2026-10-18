import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusIcon } from '@/lib/icons';
import { INTEGRATION_TONES, PRIORITY_TONES, RCA_CASE_STATUS_TONES } from './labels';
import { StatusBadge } from './status-badge';
import { toneOf } from './status-tone';
import { VersionStateBadge } from './version-state-badge';

describe('StatusBadge (C-2)', () => {
  it('always shows the words, marks the tone and keeps the icon decorative', () => {
    render(
      <StatusBadge tone="warning" icon={StatusIcon.warning} data-testid="badge">
        Provisional
      </StatusBadge>,
    );
    const badge = screen.getByTestId('badge');
    expect(badge).toHaveTextContent('Provisional');
    expect(badge).toHaveAttribute('data-tone', 'warning');
    expect(badge.className).toMatch(/text-warning/);
    expect(badge.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('lets a caller keep its own data-tone token', () => {
    render(<StatusBadge tone="success" data-tone="ok" data-testid="badge">Connected</StatusBadge>);
    expect(screen.getByTestId('badge')).toHaveAttribute('data-tone', 'ok');
    expect(screen.getByTestId('badge').className).toMatch(/text-success/);
  });

  it('one shared version-state badge: approved / published success, submitted info, others neutral', () => {
    const { rerender } = render(<VersionStateBadge state="published" />);
    expect(screen.getByTestId('version-state')).toHaveTextContent('Published');
    expect(screen.getByTestId('version-state')).toHaveAttribute('data-tone', 'success');
    rerender(<VersionStateBadge state="submitted" />);
    expect(screen.getByTestId('version-state')).toHaveAttribute('data-tone', 'info');
    rerender(<VersionStateBadge state="retired" />);
    expect(screen.getByTestId('version-state')).toHaveAttribute('data-tone', 'neutral');
  });
});

describe('domain tones (§5.8 warning vs alarm)', () => {
  it('maps priority, case status and console health; unmapped values stay neutral, never red', () => {
    expect(toneOf(PRIORITY_TONES, 'Critical')).toBe('danger');
    expect(toneOf(PRIORITY_TONES, 'High')).toBe('warning');
    expect(toneOf(PRIORITY_TONES, 'Medium')).toBe('neutral');
    expect(toneOf(RCA_CASE_STATUS_TONES, 'Closed')).toBe('success');
    expect(toneOf(RCA_CASE_STATUS_TONES, 'Closure Review')).toBe('info');
    expect(toneOf(RCA_CASE_STATUS_TONES, 'Draft')).toBe('neutral');
    expect(toneOf(INTEGRATION_TONES, 'error')).toBe('danger');
    expect(toneOf(INTEGRATION_TONES, 'busy')).toBe('info');
    expect(toneOf(PRIORITY_TONES, 'Someday')).toBe('neutral');
    expect(toneOf(PRIORITY_TONES, null)).toBe('neutral');
  });
});
