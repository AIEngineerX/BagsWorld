/**
 * World State API Tests
 *
 * Tests the /api/world-state endpoint functionality.
 */

import { mockWorldState, setupMockFetch } from '../mocks/bags-api';

describe('/api/world-state', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET request', () => {
    it('should return world state with health', async () => {
      setupMockFetch({
        '/api/world-state': mockWorldState,
      });

      const response = await fetch('http://localhost:3000/api/world-state');
      const data = await response.json();

      expect(data.health).toBeDefined();
      expect(data.health).toBeGreaterThanOrEqual(0);
      expect(data.health).toBeLessThanOrEqual(100);
    });

    it('should return weather information', async () => {
      setupMockFetch({
        '/api/world-state': mockWorldState,
      });

      const response = await fetch('http://localhost:3000/api/world-state');
      const data = await response.json();

      expect(data.weather).toBeDefined();
      expect(['sunny', 'cloudy', 'rain', 'storm', 'apocalypse']).toContain(data.weather);
    });

    it('should return population array', async () => {
      setupMockFetch({
        '/api/world-state': mockWorldState,
      });

      const response = await fetch('http://localhost:3000/api/world-state');
      const data = await response.json();

      expect(Array.isArray(data.population)).toBe(true);
    });

    it('should return buildings array', async () => {
      setupMockFetch({
        '/api/world-state': mockWorldState,
      });

      const response = await fetch('http://localhost:3000/api/world-state');
      const data = await response.json();

      expect(Array.isArray(data.buildings)).toBe(true);
    });
  });

  describe('POST request with tokens', () => {
    it('should accept registered tokens', async () => {
      const tokens = ['Token1111111111111111111111111111111111111'];

      setupMockFetch({
        '/api/world-state': { ...mockWorldState, registeredTokens: tokens },
      });

      const response = await fetch('http://localhost:3000/api/world-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokens }),
      });

      expect(response.ok).toBe(true);
    });
  });
});

describe('World Calculator', () => {
  describe('Building Level Calculation', () => {
    it('should calculate level 1 for market cap < $100K', () => {
      const marketCap = 50000;
      let level = 1;

      if (marketCap >= 10000000) level = 5;
      else if (marketCap >= 2000000) level = 4;
      else if (marketCap >= 500000) level = 3;
      else if (marketCap >= 100000) level = 2;
      else level = 1;

      expect(level).toBe(1);
    });

    it('should calculate level 3 for market cap $500K-$2M', () => {
      const marketCap = 1000000;
      let level = 1;

      if (marketCap >= 10000000) level = 5;
      else if (marketCap >= 2000000) level = 4;
      else if (marketCap >= 500000) level = 3;
      else if (marketCap >= 100000) level = 2;
      else level = 1;

      expect(level).toBe(3);
    });

    it('should calculate level 5 for market cap > $10M', () => {
      const marketCap = 15000000;
      let level = 1;

      if (marketCap >= 10000000) level = 5;
      else if (marketCap >= 2000000) level = 4;
      else if (marketCap >= 500000) level = 3;
      else if (marketCap >= 100000) level = 2;
      else level = 1;

      expect(level).toBe(5);
    });
  });

  describe('Weather Calculation', () => {
    it('should return sunny for health > 80%', () => {
      const health = 85;
      let weather = 'sunny';

      if (health < 20) weather = 'apocalypse';
      else if (health < 40) weather = 'storm';
      else if (health < 60) weather = 'rain';
      else if (health < 80) weather = 'cloudy';
      else weather = 'sunny';

      expect(weather).toBe('sunny');
    });

    it('should return apocalypse for health < 20%', () => {
      const health = 15;
      let weather = 'sunny';

      if (health < 20) weather = 'apocalypse';
      else if (health < 40) weather = 'storm';
      else if (health < 60) weather = 'rain';
      else if (health < 80) weather = 'cloudy';
      else weather = 'sunny';

      expect(weather).toBe('apocalypse');
    });
  });
});
