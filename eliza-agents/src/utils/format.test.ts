import { describe, it, expect } from 'vitest';
import {
  formatNumber,
  formatAddress,
  getTimeAgo,
  getStatusLabel,
  getWeatherEmoji,
  clamp,
} from './format.js';

describe('formatNumber', () => {
  // Happy path
  it('formats millions with M suffix', () => {
    expect(formatNumber(1000000)).toBe('1.00M');
    expect(formatNumber(5500000)).toBe('5.50M');
    expect(formatNumber(999999999)).toBe('1000.00M');
  });

  it('formats thousands with K suffix', () => {
    expect(formatNumber(1000)).toBe('1.00K');
    expect(formatNumber(50000)).toBe('50.00K');
    expect(formatNumber(999999)).toBe('1000.00K');
  });

  it('formats small numbers with 2 decimal places', () => {
    expect(formatNumber(0)).toBe('0.00');
    expect(formatNumber(1)).toBe('1.00');
    expect(formatNumber(999)).toBe('999.00');
    expect(formatNumber(123.456)).toBe('123.46');
  });

  // Edge cases
  it('handles undefined input', () => {
    expect(formatNumber(undefined)).toBe('0');
  });

  it('handles null input', () => {
    expect(formatNumber(null as unknown as number)).toBe('0');
  });

  it('handles negative numbers', () => {
    // Implementation checks num >= 1_000 which is false for negatives
    // So all negative numbers are formatted as small numbers
    expect(formatNumber(-100)).toBe('-100.00');
    expect(formatNumber(-1500)).toBe('-1500.00');
    expect(formatNumber(-2000000)).toBe('-2000000.00');
  });

  it('handles floating point precision', () => {
    expect(formatNumber(0.001)).toBe('0.00');
    expect(formatNumber(0.005)).toBe('0.01');
    expect(formatNumber(0.999)).toBe('1.00');
  });

  // Boundary conditions
  it('handles exact boundaries', () => {
    expect(formatNumber(999)).toBe('999.00');
    expect(formatNumber(1000)).toBe('1.00K');
    expect(formatNumber(999999)).toBe('1000.00K');
    expect(formatNumber(1000000)).toBe('1.00M');
  });
});

describe('formatAddress', () => {
  // Happy path
  it('formats long addresses correctly', () => {
    const address = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
    // Last 4 chars are 'gAsU' not 'sAsU'
    expect(formatAddress(address)).toBe('7xKXtg...gAsU');
  });

  it('truncates with proper prefix and suffix length', () => {
    const address = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ123456';
    expect(formatAddress(address)).toBe('ABCDEF...3456');
  });

  // Edge cases
  it('returns empty string for undefined', () => {
    expect(formatAddress(undefined)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(formatAddress('')).toBe('');
  });

  it('returns short addresses unchanged', () => {
    expect(formatAddress('short')).toBe('short');
    expect(formatAddress('12345678901')).toBe('12345678901');
  });

  // Boundary condition - exactly 12 characters (minimum for truncation)
  it('handles exactly 12 character addresses', () => {
    expect(formatAddress('123456789012')).toBe('123456...9012');
  });

  it('handles 11 character addresses unchanged', () => {
    expect(formatAddress('12345678901')).toBe('12345678901');
  });
});

describe('getTimeAgo', () => {
  // Use fresh timestamps in each test to avoid timing variance

  // Happy path
  it('returns "just now" for very recent timestamps', () => {
    const now = Date.now();
    expect(getTimeAgo(now)).toBe('just now');
    expect(getTimeAgo(now - 30000)).toBe('just now'); // 30 seconds ago
  });

  it('returns minutes ago', () => {
    const now = Date.now();
    expect(getTimeAgo(now - 65000)).toBe('1m ago'); // slightly over 1 min to be safe
    expect(getTimeAgo(now - 125000)).toBe('2m ago');
    expect(getTimeAgo(now - 3540000)).toBe('59m ago'); // 59 minutes
  });

  it('returns hours ago', () => {
    const now = Date.now();
    expect(getTimeAgo(now - 3660000)).toBe('1h ago'); // slightly over 1 hour
    expect(getTimeAgo(now - 7260000)).toBe('2h ago');
    expect(getTimeAgo(now - 82800000)).toBe('23h ago'); // 23 hours
  });

  it('returns days ago', () => {
    const now = Date.now();
    expect(getTimeAgo(now - 86460000)).toBe('1d ago'); // slightly over 1 day
    expect(getTimeAgo(now - 172860000)).toBe('2d ago');
    expect(getTimeAgo(now - 518400000)).toBe('6d ago'); // 6 days
  });

  it('returns formatted date for older timestamps', () => {
    const now = Date.now();
    const oldDate = now - 604800000; // 7 days ago
    const result = getTimeAgo(oldDate);
    expect(result).toMatch(/^\d{1,2}\/\d{1,2}\/\d{4}$/);
  });

  // Edge cases
  it('handles future timestamps gracefully', () => {
    const now = Date.now();
    const future = now + 60000;
    expect(getTimeAgo(future)).toBe('just now');
  });

  it('handles zero timestamp', () => {
    const result = getTimeAgo(0);
    expect(result).toMatch(/^\d{1,2}\/\d{1,2}\/\d{4}$/);
  });

  // Boundary conditions - use well within the ranges to avoid timing issues
  it('boundary between just now and minutes', () => {
    const now = Date.now();
    // Under 1 minute should show "just now"
    expect(getTimeAgo(now - 50000)).toBe('just now'); // 50 seconds
    // At or over 1 minute shows minutes
    expect(getTimeAgo(now - 65000)).toBe('1m ago'); // 1 min 5 sec
  });

  it('boundary between minutes and hours', () => {
    const now = Date.now();
    // Under 1 hour shows minutes
    expect(getTimeAgo(now - 3500000)).toBe('58m ago'); // ~58 min
    // At or over 1 hour shows hours
    expect(getTimeAgo(now - 3660000)).toBe('1h ago'); // 1 hour 1 min
  });

  it('boundary between hours and days', () => {
    const now = Date.now();
    // Under 24 hours shows hours
    expect(getTimeAgo(now - 82800000)).toBe('23h ago'); // 23 hours
    // At or over 24 hours shows days
    expect(getTimeAgo(now - 90000000)).toBe('1d ago'); // 25 hours
  });
});

describe('getStatusLabel', () => {
  // Happy path
  it('returns THRIVING for 80%+', () => {
    expect(getStatusLabel(80)).toBe('THRIVING');
    expect(getStatusLabel(90)).toBe('THRIVING');
    expect(getStatusLabel(100)).toBe('THRIVING');
  });

  it('returns HEALTHY for 60-79%', () => {
    expect(getStatusLabel(60)).toBe('HEALTHY');
    expect(getStatusLabel(70)).toBe('HEALTHY');
    expect(getStatusLabel(79)).toBe('HEALTHY');
  });

  it('returns GROWING for 45-59%', () => {
    expect(getStatusLabel(45)).toBe('GROWING');
    expect(getStatusLabel(50)).toBe('GROWING');
    expect(getStatusLabel(59)).toBe('GROWING');
  });

  it('returns QUIET for 25-44%', () => {
    expect(getStatusLabel(25)).toBe('QUIET');
    expect(getStatusLabel(35)).toBe('QUIET');
    expect(getStatusLabel(44)).toBe('QUIET');
  });

  it('returns DORMANT for 10-24%', () => {
    expect(getStatusLabel(10)).toBe('DORMANT');
    expect(getStatusLabel(15)).toBe('DORMANT');
    expect(getStatusLabel(24)).toBe('DORMANT');
  });

  it('returns CRITICAL for below 10%', () => {
    expect(getStatusLabel(0)).toBe('CRITICAL');
    expect(getStatusLabel(5)).toBe('CRITICAL');
    expect(getStatusLabel(9)).toBe('CRITICAL');
  });

  // Edge cases
  it('handles negative values', () => {
    expect(getStatusLabel(-10)).toBe('CRITICAL');
  });

  it('handles values over 100', () => {
    expect(getStatusLabel(150)).toBe('THRIVING');
  });

  // Boundary conditions
  it('exact boundary values', () => {
    expect(getStatusLabel(79.99)).toBe('HEALTHY');
    expect(getStatusLabel(80)).toBe('THRIVING');
    expect(getStatusLabel(59.99)).toBe('GROWING');
    expect(getStatusLabel(60)).toBe('HEALTHY');
    expect(getStatusLabel(44.99)).toBe('QUIET');
    expect(getStatusLabel(45)).toBe('GROWING');
    expect(getStatusLabel(24.99)).toBe('DORMANT');
    expect(getStatusLabel(25)).toBe('QUIET');
    expect(getStatusLabel(9.99)).toBe('CRITICAL');
    expect(getStatusLabel(10)).toBe('DORMANT');
  });
});

describe('getWeatherEmoji', () => {
  // Happy path
  it('returns correct emojis for known weather types', () => {
    expect(getWeatherEmoji('sunny')).toBe('☀️');
    expect(getWeatherEmoji('cloudy')).toBe('☁️');
    expect(getWeatherEmoji('rain')).toBe('🌧️');
    expect(getWeatherEmoji('storm')).toBe('⛈️');
    expect(getWeatherEmoji('apocalypse')).toBe('🌋');
  });

  it('is case-insensitive', () => {
    expect(getWeatherEmoji('SUNNY')).toBe('☀️');
    expect(getWeatherEmoji('Cloudy')).toBe('☁️');
    expect(getWeatherEmoji('RAIN')).toBe('🌧️');
    expect(getWeatherEmoji('Storm')).toBe('⛈️');
    expect(getWeatherEmoji('APOCALYPSE')).toBe('🌋');
  });

  // Edge cases
  it('returns default emoji for unknown weather', () => {
    expect(getWeatherEmoji('unknown')).toBe('🌤️');
    expect(getWeatherEmoji('foggy')).toBe('🌤️');
    expect(getWeatherEmoji('')).toBe('🌤️');
  });

  it('handles mixed case', () => {
    expect(getWeatherEmoji('SuNnY')).toBe('☀️');
    expect(getWeatherEmoji('cLoUdY')).toBe('☁️');
  });
});

describe('clamp', () => {
  // Happy path
  it('returns value when within bounds', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });

  it('clamps to minimum when below', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(-100, 0, 10)).toBe(0);
  });

  it('clamps to maximum when above', () => {
    expect(clamp(15, 0, 10)).toBe(10);
    expect(clamp(100, 0, 10)).toBe(10);
  });

  // Edge cases
  it('handles negative ranges', () => {
    expect(clamp(-5, -10, -1)).toBe(-5);
    expect(clamp(0, -10, -1)).toBe(-1);
    expect(clamp(-15, -10, -1)).toBe(-10);
  });

  it('handles floating point values', () => {
    expect(clamp(0.5, 0, 1)).toBe(0.5);
    expect(clamp(1.5, 0, 1)).toBe(1);
    expect(clamp(-0.5, 0, 1)).toBe(0);
  });

  it('handles same min and max', () => {
    expect(clamp(5, 5, 5)).toBe(5);
    expect(clamp(10, 5, 5)).toBe(5);
    expect(clamp(0, 5, 5)).toBe(5);
  });

  it('handles reversed min/max (unexpected but deterministic)', () => {
    // When min > max, the function behaves unexpectedly but deterministically
    // clamp(5, 10, 0) = Math.min(Math.max(5, 10), 0) = Math.min(10, 0) = 0
    expect(clamp(5, 10, 0)).toBe(0);
  });
});
