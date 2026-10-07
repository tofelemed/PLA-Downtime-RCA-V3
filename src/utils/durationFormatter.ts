/**
 * Utility functions for formatting duration in a user-friendly way
 */

export interface FormattedDuration {
  display: string;
  short: string;
  long: string;
  value: number;
  unit: 'minutes' | 'hours' | 'days' | 'weeks';
}

/**
 * Formats duration in minutes to a user-friendly string
 * @param minutes - Duration in minutes
 * @param format - Display format: 'auto', 'short', 'long', 'compact'
 * @returns Formatted duration object
 */
export function formatDuration(minutes: number, format: 'auto' | 'short' | 'long' | 'compact' = 'auto'): FormattedDuration {
  if (!minutes || minutes <= 0) {
    return {
      display: '0 min',
      short: '0m',
      long: '0 minutes',
      value: 0,
      unit: 'minutes'
    };
  }

  const totalMinutes = Math.round(minutes);
  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  const weeks = Math.floor(days / 7);
  const remainingDays = days % 7;

  let display = '';
  let short = '';
  let long = '';
  let unit: 'minutes' | 'hours' | 'days' | 'weeks' = 'minutes';

  // Auto-format: Choose the most appropriate unit
  if (format === 'auto') {
    if (totalMinutes < 60) {
      // Less than 1 hour
      display = `${totalMinutes} min`;
      short = `${totalMinutes}m`;
      long = `${totalMinutes} minute${totalMinutes !== 1 ? 's' : ''}`;
      unit = 'minutes';
    } else if (totalMinutes < 1440) {
      // Less than 1 day
      if (remainingMinutes === 0) {
        display = `${hours}h`;
        short = `${hours}h`;
        long = `${hours} hour${hours !== 1 ? 's' : ''}`;
      } else {
        display = `${hours}h ${remainingMinutes}m`;
        short = `${hours}h ${remainingMinutes}m`;
        long = `${hours} hour${hours !== 1 ? 's' : ''} and ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`;
      }
      unit = 'hours';
    } else if (totalMinutes < 10080) {
      // Less than 1 week
      if (remainingHours === 0 && remainingMinutes === 0) {
        display = `${days}d`;
        short = `${days}d`;
        long = `${days} day${days !== 1 ? 's' : ''}`;
      } else if (remainingMinutes === 0) {
        display = `${days}d ${remainingHours}h`;
        short = `${days}d ${remainingHours}h`;
        long = `${days} day${days !== 1 ? 's' : ''} and ${remainingHours} hour${remainingHours !== 1 ? 's' : ''}`;
      } else {
        display = `${days}d ${remainingHours}h ${remainingMinutes}m`;
        short = `${days}d ${remainingHours}h ${remainingMinutes}m`;
        long = `${days} day${days !== 1 ? 's' : ''}, ${remainingHours} hour${remainingHours !== 1 ? 's' : ''}, and ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`;
      }
      unit = 'days';
    } else {
      // 1 week or more
      if (remainingDays === 0 && remainingHours === 0 && remainingMinutes === 0) {
        display = `${weeks}w`;
        short = `${weeks}w`;
        long = `${weeks} week${weeks !== 1 ? 's' : ''}`;
      } else if (remainingHours === 0 && remainingMinutes === 0) {
        display = `${weeks}w ${remainingDays}d`;
        short = `${weeks}w ${remainingDays}d`;
        long = `${weeks} week${weeks !== 1 ? 's' : ''} and ${remainingDays} day${remainingDays !== 1 ? 's' : ''}`;
      } else {
        display = `${weeks}w ${remainingDays}d ${remainingHours}h`;
        short = `${weeks}w ${remainingDays}d ${remainingHours}h`;
        long = `${weeks} week${weeks !== 1 ? 's' : ''}, ${remainingDays} day${remainingDays !== 1 ? 's' : ''}, and ${remainingHours} hour${remainingHours !== 1 ? 's' : ''}`;
      }
      unit = 'weeks';
    }
  } else if (format === 'short') {
    // Short format: Always use compact notation
    if (totalMinutes < 60) {
      display = `${totalMinutes}m`;
      short = `${totalMinutes}m`;
      long = `${totalMinutes} minute${totalMinutes !== 1 ? 's' : ''}`;
      unit = 'minutes';
    } else if (totalMinutes < 1440) {
      if (remainingMinutes === 0) {
        display = `${hours}h`;
        short = `${hours}h`;
        long = `${hours} hour${hours !== 1 ? 's' : ''}`;
      } else {
        display = `${hours}h ${remainingMinutes}m`;
        short = `${hours}h ${remainingMinutes}m`;
        long = `${hours} hour${hours !== 1 ? 's' : ''} and ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`;
      }
      unit = 'hours';
    } else if (totalMinutes < 10080) {
      if (remainingHours === 0) {
        display = `${days}d`;
        short = `${days}d`;
        long = `${days} day${days !== 1 ? 's' : ''}`;
      } else {
        display = `${days}d ${remainingHours}h`;
        short = `${days}d ${remainingHours}h`;
        long = `${days} day${days !== 1 ? 's' : ''} and ${remainingHours} hour${remainingHours !== 1 ? 's' : ''}`;
      }
      unit = 'days';
    } else {
      if (remainingDays === 0) {
        display = `${weeks}w`;
        short = `${weeks}w`;
        long = `${weeks} week${weeks !== 1 ? 's' : ''}`;
      } else {
        display = `${weeks}w ${remainingDays}d`;
        short = `${weeks}w ${remainingDays}d`;
        long = `${weeks} week${weeks !== 1 ? 's' : ''} and ${remainingDays} day${remainingDays !== 1 ? 's' : ''}`;
      }
      unit = 'weeks';
    }
  } else if (format === 'long') {
    // Long format: Always use full words
    if (totalMinutes < 60) {
      display = `${totalMinutes} minute${totalMinutes !== 1 ? 's' : ''}`;
      short = `${totalMinutes}m`;
      long = `${totalMinutes} minute${totalMinutes !== 1 ? 's' : ''}`;
      unit = 'minutes';
    } else if (totalMinutes < 1440) {
      if (remainingMinutes === 0) {
        display = `${hours} hour${hours !== 1 ? 's' : ''}`;
        short = `${hours}h`;
        long = `${hours} hour${hours !== 1 ? 's' : ''}`;
      } else {
        display = `${hours} hour${hours !== 1 ? 's' : ''} and ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`;
        short = `${hours}h ${remainingMinutes}m`;
        long = `${hours} hour${hours !== 1 ? 's' : ''} and ${remainingMinutes} minute${remainingMinutes !== 1 !== 1 ? 's' : ''}`;
      }
      unit = 'hours';
    } else if (totalMinutes < 10080) {
      if (remainingHours === 0) {
        display = `${days} day${days !== 1 ? 's' : ''}`;
        short = `${days}d`;
        long = `${days} day${days !== 1 ? 's' : ''}`;
      } else {
        display = `${days} day${days !== 1 ? 's' : ''} and ${remainingHours} hour${remainingHours !== 1 ? 's' : ''}`;
        short = `${days}d ${remainingHours}h`;
        long = `${days} day${days !== 1 ? 's' : ''} and ${remainingHours} hour${remainingHours !== 1 ? 's' : ''}`;
      }
      unit = 'days';
    } else {
      if (remainingDays === 0) {
        display = `${weeks} week${weeks !== 1 ? 's' : ''}`;
        short = `${weeks}w`;
        long = `${weeks} week${weeks !== 1 ? 's' : ''}`;
      } else {
        display = `${weeks} week${weeks !== 1 ? 's' : ''} and ${remainingDays} day${remainingDays !== 1 ? 's' : ''}`;
        short = `${weeks}w ${remainingDays}d`;
        long = `${weeks} week${weeks !== 1 ? 's' : ''} and ${remainingDays} day${remainingDays !== 1 ? 's' : ''}`;
      }
      unit = 'weeks';
    }
  } else if (format === 'compact') {
    // Compact format: Use single character abbreviations, no spaces
    if (totalMinutes < 60) {
      display = `${totalMinutes}m`;
      short = `${totalMinutes}m`;
      long = `${totalMinutes} minute${totalMinutes !== 1 ? 's' : ''}`;
      unit = 'minutes';
    } else if (totalMinutes < 1440) {
      if (remainingMinutes === 0) {
        display = `${hours}h`;
        short = `${hours}h`;
        long = `${hours} hour${hours !== 1 ? 's' : ''}`;
      } else {
        display = `${hours}h${remainingMinutes}m`;
        short = `${hours}h${remainingMinutes}m`;
        long = `${hours} hour${hours !== 1 ? 's' : ''} and ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`;
      }
      unit = 'hours';
    } else if (totalMinutes < 10080) {
      if (remainingHours === 0) {
        display = `${days}d`;
        short = `${days}d`;
        long = `${days} day${days !== 1 ? 's' : ''}`;
      } else {
        display = `${days}d${remainingHours}h`;
        short = `${days}d${remainingHours}h`;
        long = `${days} day${days !== 1 ? 's' : ''} and ${remainingHours} hour${remainingHours !== 1 ? 's' : ''}`;
      }
      unit = 'days';
    } else {
      if (remainingDays === 0) {
        display = `${weeks}w`;
        short = `${weeks}w`;
        long = `${weeks} week${weeks !== 1 ? 's' : ''}`;
      } else {
        display = `${weeks}w${remainingDays}d`;
        short = `${weeks}w${remainingDays}d`;
        long = `${weeks} week${weeks !== 1 ? 's' : ''} and ${remainingDays} day${remainingDays !== 1 ? 's' : ''}`;
      }
      unit = 'weeks';
    }
  }

  return {
    display,
    short,
    long,
    value: totalMinutes,
    unit
  };
}

/**
 * Quick format function for simple duration display
 * @param minutes - Duration in minutes
 * @returns User-friendly duration string
 */
export function formatDurationSimple(minutes: number): string {
  return formatDuration(minutes, 'auto').display;
}

/**
 * Format duration for tooltips (longer, more descriptive)
 * @param minutes - Duration in minutes
 * @returns Detailed duration string
 */
export function formatDurationTooltip(minutes: number): string {
  return formatDuration(minutes, 'long').long;
}

/**
 * Format duration for compact display (tables, small spaces)
 * @param minutes - Duration in minutes
 * @returns Compact duration string
 */
export function formatDurationCompact(minutes: number): string {
  return formatDuration(minutes, 'compact').display;
}

/**
 * Examples of formatted durations:
 * 
 * formatDuration(45) = "45 min"
 * formatDuration(90) = "1h 30m" 
 * formatDuration(1500) = "1d 1h"
 * formatDuration(10080) = "1w"
 * formatDuration(14400) = "1w 2d"
 * 
 * formatDuration(45, 'long') = "45 minutes"
 * formatDuration(90, 'long') = "1 hour and 30 minutes"
 * formatDuration(1500, 'long') = "1 day and 1 hour"
 * 
 * formatDuration(45, 'compact') = "45m"
 * formatDuration(90, 'compact') = "1h30m"
 * formatDuration(1500, 'compact') = "1d1h"
 */
