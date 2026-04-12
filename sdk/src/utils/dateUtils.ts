import { format } from 'date-fns';

/**
 * Date utility functions for ANAF e-Factura SDK
 *
 * Provides consistent date formatting and validation
 * that matches ANAF API requirements.
 */

/**
 * Format date for ANAF API (YYYY-MM-DD format)
 * @param date Date to format (string, Date, or number)
 * @returns Formatted date string
 */
export function formatDateForAnaf(date: string | Date | number): string {
  if (typeof date === 'string') {
    // If already in correct format, return as-is
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }
    // Try to parse the string
    date = new Date(date);
  } else if (typeof date === 'number') {
    date = new Date(date);
  }

  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new Error('Invalid date provided');
  }

  return format(date, 'yyyy-MM-dd');
}

/**
 * Get current date in ANAF format
 * @returns Current date as YYYY-MM-DD string
 */
export function getCurrentDateForAnaf(): string {
  return formatDateForAnaf(new Date());
}

/**
 * Validate date string format for ANAF API
 * @param dateString Date string to validate
 * @returns True if format is valid
 */
export function isValidAnafDateFormat(dateString: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateString);
}

/**
 * Convert date to Unix timestamp in milliseconds
 * Used for pagination endpoints
 * @param date Date to convert
 * @returns Unix timestamp in milliseconds
 */
export function dateToTimestamp(date: string | Date | number): number {
  if (typeof date === 'string') {
    date = new Date(date);
  } else if (typeof date === 'number') {
    // Assume it's already a timestamp
    return date;
  }

  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new Error('Invalid date provided for timestamp conversion');
  }

  return date.getTime();
}

/**
 * Get date range for pagination (start of day to end of day)
 * @param date Target date
 * @returns Object with start and end timestamps
 */
export function getDayRange(date: string | Date): { start: number; end: number } {
  const targetDate = typeof date === 'string' ? new Date(date) : date;

  if (!(targetDate instanceof Date) || isNaN(targetDate.getTime())) {
    throw new Error('Invalid date provided for range calculation');
  }

  const start = new Date(targetDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(targetDate);
  end.setHours(23, 59, 59, 999);

  return {
    start: start.getTime(),
    end: end.getTime(),
  };
}

/**
 * Calculate days between two dates
 * @param from Start date
 * @param to End date
 * @returns Number of days
 */
export function daysBetween(from: string | Date, to: string | Date): number {
  const fromDate = typeof from === 'string' ? new Date(from) : from;
  const toDate = typeof to === 'string' ? new Date(to) : to;

  if (
    !(fromDate instanceof Date) ||
    isNaN(fromDate.getTime()) ||
    !(toDate instanceof Date) ||
    isNaN(toDate.getTime())
  ) {
    throw new Error('Invalid dates provided for calculation');
  }

  const diffTime = Math.abs(toDate.getTime() - fromDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Get date N days ago from today
 * @param days Number of days to subtract
 * @returns Date N days ago
 */
export function getDaysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

/**
 * Validate that days parameter is within ANAF limits (1-60)
 * @param days Days value to validate
 * @returns True if valid
 */
export function isValidDaysParameter(days: number): boolean {
  return Number.isInteger(days) && days >= 1 && days <= 60;
}
