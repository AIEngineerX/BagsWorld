export function formatNumber(num?: number): string {
  if (num === undefined || num === null) return '0';
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
  return num.toFixed(2);
}

export function formatAddress(address?: string): string {
  if (!address || address.length < 12) return address || '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function getTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function getStatusLabel(health: number): string {
  if (health >= 80) return 'THRIVING';
  if (health >= 60) return 'HEALTHY';
  if (health >= 45) return 'GROWING';
  if (health >= 25) return 'QUIET';
  if (health >= 10) return 'DORMANT';
  return 'CRITICAL';
}

const WEATHER_EMOJI: Record<string, string> = {
  sunny: '☀️',
  cloudy: '☁️',
  rain: '🌧️',
  storm: '⛈️',
  apocalypse: '🌋',
};

export function getWeatherEmoji(weather: string): string {
  return WEATHER_EMOJI[weather.toLowerCase()] || '🌤️';
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
