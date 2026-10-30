import { ForbiddenException } from '@nestjs/common';
import { anonymousContext } from '../../common/context/request-context';
import { ReasonWeight } from '../../domain/events/reason-weights';
import {
  assertMaySplitReasons,
  changesSplit,
  REASON_SPLITTERS,
} from './reason-split-roles';

const SPLIT: ReasonWeight[] = [
  { reasonCodeId: 'r1', weight: '0.60000000' },
  { reasonCodeId: 'r2', weight: '0.40000000' },
];

function contextWith(...roles: string[]) {
  return { ...anonymousContext('c1'), userId: 'u1', roles };
}

describe('reason splitters (owner decision 2026-10-30: operators code one reason)', () => {
  it('names the production engineer, the reliability engineer and the manager approver', () => {
    expect([...REASON_SPLITTERS]).toEqual([
      'production_engineer',
      'reliability_engineer',
      'manager_approver',
    ]);
  });

  describe('changesSplit', () => {
    it('is false when the write leaves the reason weights alone', () => {
      expect(changesSplit(SPLIT, undefined)).toBe(false);
    });

    it('is true when the write sets two or more reasons', () => {
      expect(changesSplit(null, SPLIT)).toBe(true);
    });

    it('is true when the write removes a stored split', () => {
      expect(changesSplit(SPLIT, null)).toBe(true);
    });

    it('is false when a single reason replaces a single reason', () => {
      expect(changesSplit(null, null)).toBe(false);
      expect(changesSplit([{ reasonCodeId: 'r1', weight: '1' }], null)).toBe(
        false,
      );
    });
  });

  describe('assertMaySplitReasons', () => {
    it.each(REASON_SPLITTERS)('lets a %s set a split', (role) => {
      expect(() =>
        assertMaySplitReasons(contextWith(role), null, SPLIT),
      ).not.toThrow();
    });

    it('lets SuperAdmin and OrgAdmin set a split', () => {
      expect(() =>
        assertMaySplitReasons(contextWith('SuperAdmin'), null, SPLIT),
      ).not.toThrow();
      expect(() =>
        assertMaySplitReasons(contextWith('OrgAdmin'), null, SPLIT),
      ).not.toThrow();
    });

    it('refuses an operator who sets a split, with 403 REASON_SPLIT_ROLE', () => {
      expect(() =>
        assertMaySplitReasons(contextWith('operator'), null, SPLIT),
      ).toThrow(ForbiddenException);
      try {
        assertMaySplitReasons(contextWith('operator'), null, SPLIT);
      } catch (error) {
        expect((error as ForbiddenException).getResponse()).toMatchObject({
          code: 'REASON_SPLIT_ROLE',
        });
      }
    });

    it('refuses an operator who removes a stored split', () => {
      expect(() =>
        assertMaySplitReasons(contextWith('operator'), SPLIT, null),
      ).toThrow(ForbiddenException);
    });

    it('lets an operator code one reason on an unsplit event', () => {
      expect(() =>
        assertMaySplitReasons(contextWith('operator'), null, null),
      ).not.toThrow();
      expect(() =>
        assertMaySplitReasons(contextWith('operator'), null, undefined),
      ).not.toThrow();
    });

    it('lets an operator change other fields of a split event', () => {
      expect(() =>
        assertMaySplitReasons(contextWith('operator'), SPLIT, undefined),
      ).not.toThrow();
    });
  });
});
