/**
 * Date formatting utilities for user-friendly display
 */

/**
 * Format a date string to a user-friendly format
 * @param dateString - ISO date string or date string
 * @param options - Intl.DateTimeFormatOptions
 * @returns Formatted date string (e.g., "Dec 1, 2025")
 */
export function formatDate(
  dateString: string | Date | undefined | null,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }
): string {
  if (!dateString) return 'N/A';
  
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    if (isNaN(date.getTime())) return 'Invalid Date';
    
    return new Intl.DateTimeFormat('en-US', options).format(date);
  } catch (error) {
    console.warn('Date formatting error:', error);
    return 'Invalid Date';
  }
}

/**
 * Format a date range for display
 * @param startDate - Start date string
 * @param endDate - End date string
 * @returns Formatted date range (e.g., "Dec 1 - 17, 2025" or "Dec 1, 2025 - Jan 15, 2026")
 */
export function formatDateRange(
  startDate: string | Date | undefined | null,
  endDate: string | Date | undefined | null
): string {
  if (!startDate || !endDate) return 'N/A';
  
  try {
    const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
    const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 'Invalid Date Range';
    
    const startYear = start.getFullYear();
    const endYear = end.getFullYear();
    const startMonth = start.getMonth();
    const endMonth = end.getMonth();
    
    // If same year and month, show: "Dec 1 - 17, 2025"
    if (startYear === endYear && startMonth === endMonth) {
      return `${formatDate(start, { month: 'short', day: 'numeric' })} - ${end.getDate()}, ${startYear}`;
    }
    
    // If same year, different months: "Dec 1 - Jan 15, 2025"
    if (startYear === endYear) {
      return `${formatDate(start, { month: 'short', day: 'numeric' })} - ${formatDate(end, { month: 'short', day: 'numeric' })}, ${startYear}`;
    }
    
    // Different years: "Dec 1, 2025 - Jan 15, 2026"
    return `${formatDate(start, { month: 'short', day: 'numeric', year: 'numeric' })} - ${formatDate(end, { month: 'short', day: 'numeric', year: 'numeric' })}`;
  } catch (error) {
    console.warn('Date range formatting error:', error);
    return 'Invalid Date Range';
  }
}

/**
 * Format a date with time for display
 * @param dateString - ISO date string
 * @returns Formatted date with time (e.g., "Dec 1, 2025 at 10:30 AM")
 */
export function formatDateTime(dateString: string | Date | undefined | null): string {
  if (!dateString) return 'N/A';
  
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    if (isNaN(date.getTime())) return 'Invalid Date';
    
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch (error) {
    console.warn('DateTime formatting error:', error);
    return 'Invalid Date';
  }
}

/**
 * Format a relative time (e.g., "2 days ago", "in 3 weeks")
 * @param dateString - ISO date string
 * @returns Relative time string
 */
export function formatRelativeTime(dateString: string | Date | undefined | null): string {
  if (!dateString) return 'N/A';
  
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    if (isNaN(date.getTime())) return 'Invalid Date';
    
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (Math.abs(diffDays) > 30) {
      return formatDate(date);
    }
    
    if (Math.abs(diffDays) > 0) {
      if (diffDays > 0) {
        return `in ${diffDays} day${diffDays > 1 ? 's' : ''}`;
      } else {
        return `${Math.abs(diffDays)} day${Math.abs(diffDays) > 1 ? 's' : ''} ago`;
      }
    }
    
    if (Math.abs(diffHours) > 0) {
      if (diffHours > 0) {
        return `in ${diffHours} hour${diffHours > 1 ? 's' : ''}`;
      } else {
        return `${Math.abs(diffHours)} hour${Math.abs(diffHours) > 1 ? 's' : ''} ago`;
      }
    }
    
    if (Math.abs(diffMinutes) > 0) {
      if (diffMinutes > 0) {
        return `in ${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}`;
      } else {
        return `${Math.abs(diffMinutes)} minute${Math.abs(diffMinutes) > 1 ? 's' : ''} ago`;
      }
    }
    
    return 'just now';
  } catch (error) {
    console.warn('Relative time formatting error:', error);
    return 'Invalid Date';
  }
}

