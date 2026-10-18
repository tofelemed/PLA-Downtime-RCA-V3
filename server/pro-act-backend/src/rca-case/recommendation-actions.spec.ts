import { closedRecommendationStatus } from './recommendation-actions';

const action = (status: string) => ({ id: status, title: status, status });

describe('closedRecommendationStatus (recommendations at case closure, Marun E2E)', () => {
  it('completes a recommendation whose implementing actions are all done (cancelled ones aside)', () => {
    expect(
      closedRecommendationStatus('Open', [action('done'), action('cancelled')]),
    ).toBe('Completed');
    expect(closedRecommendationStatus('In Progress', [action('done')])).toBe(
      'Completed',
    );
  });

  it('cancels one whose actions were all cancelled; leaves the rest and final statuses alone', () => {
    expect(closedRecommendationStatus('Open', [action('cancelled')])).toBe(
      'Cancelled',
    );
    expect(closedRecommendationStatus('Open', [])).toBeNull();
    expect(
      closedRecommendationStatus('Open', [action('done'), action('open')]),
    ).toBeNull();
    expect(
      closedRecommendationStatus('Cancelled', [action('done')]),
    ).toBeNull();
    expect(closedRecommendationStatus(null, [action('done')])).toBe(
      'Completed',
    );
  });
});
