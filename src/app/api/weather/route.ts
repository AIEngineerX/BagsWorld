import { NextResponse } from "next/server";

// Washington DC coordinates
const DC_LAT = 38.9072;
const DC_LON = -77.0369;

export interface WeatherData {
  temperature: number;
  weatherCode: number;
  isDay: boolean;
  cloudCover: number;
  precipitation: number;
  windSpeed: number;
  description: string;
  gameWeather: "sunny" | "cloudy" | "rain" | "storm" | "apocalypse";
}

// WMO Weather interpretation codes to description
function getWeatherDescription(code: number): string {
  if (code === 0) return "Clear sky";
  if (code === 1) return "Mainly clear";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code >= 45 && code <= 48) return "Foggy";
  if (code >= 51 && code <= 55) return "Drizzle";
  if (code >= 56 && code <= 57) return "Freezing drizzle";
  if (code >= 61 && code <= 65) return "Rain";
  if (code >= 66 && code <= 67) return "Freezing rain";
  if (code >= 71 && code <= 75) return "Snow";
  if (code === 77) return "Snow grains";
  if (code >= 80 && code <= 82) return "Rain showers";
  if (code >= 85 && code <= 86) return "Snow showers";
  if (code === 95) return "Thunderstorm";
  if (code >= 96 && code <= 99) return "Thunderstorm with hail";
  return "Unknown";
}

// Convert weather code to game weather state
function getGameWeather(
  code: number,
  cloudCover: number,
  precipitation: number
): WeatherData["gameWeather"] {
  // Thunderstorm
  if (code >= 95 && code <= 99) return "storm";

  // Heavy rain or snow
  if (code >= 63 || (code >= 73 && code <= 75) || code >= 82) return "rain";

  // Light rain, drizzle, snow
  if (code >= 51 || code >= 61 || code >= 71 || code >= 80) return "rain";

  // Foggy
  if (code >= 45 && code <= 48) return "cloudy";

  // Overcast
  if (code === 3 || cloudCover > 70) return "cloudy";

  // Clear or partly cloudy
  if (code <= 2 && cloudCover < 30) return "sunny";

  return "cloudy";
}

// Cache weather data for 10 minutes to avoid hitting API too often
let cachedWeather: WeatherData | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

export async function GET() {
  try {
    const now = Date.now();

    // Return cached data if still valid
    if (cachedWeather && now - lastFetchTime < CACHE_DURATION) {
      return NextResponse.json(cachedWeather);
    }

    // Fetch from Open-Meteo API (free, no API key required)
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${DC_LAT}&longitude=${DC_LON}&current=temperature_2m,weather_code,is_day,cloud_cover,precipitation,wind_speed_10m&timezone=America/New_York`;

    const response = await fetch(url, {
      next: { revalidate: 600 }, // Cache for 10 minutes
    });

    if (!response.ok) {
      throw new Error(`Weather API error: ${response.status}`);
    }

    const data = await response.json();
    const current = data.current;

    const weatherData: WeatherData = {
      temperature: current.temperature_2m,
      weatherCode: current.weather_code,
      isDay: current.is_day === 1,
      cloudCover: current.cloud_cover,
      precipitation: current.precipitation,
      windSpeed: current.wind_speed_10m,
      description: getWeatherDescription(current.weather_code),
      gameWeather: getGameWeather(current.weather_code, current.cloud_cover, current.precipitation),
    };

    // Update cache
    cachedWeather = weatherData;
    lastFetchTime = now;

    return NextResponse.json(weatherData);
  } catch (error) {
    console.error("Error fetching weather:", error);

    // Return cached data if available, even if expired
    if (cachedWeather) {
      return NextResponse.json(cachedWeather);
    }

    // Fallback weather
    return NextResponse.json({
      temperature: 20,
      weatherCode: 2,
      isDay: true,
      cloudCover: 50,
      precipitation: 0,
      windSpeed: 10,
      description: "Partly cloudy",
      gameWeather: "cloudy",
    } as WeatherData);
  }
}
