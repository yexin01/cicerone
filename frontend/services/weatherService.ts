/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { Sun, Cloud, CloudRain, CloudSnow, CloudLightning, CloudDrizzle, CloudFog, Wind } from 'lucide-react';

export interface WeatherData {
  maxTemp: number;
  minTemp: number;
  weatherCode: number;
  date: string;
}

export const getWeatherIcon = (code: number) => {
  // WMO Weather interpretation codes (https://open-meteo.com/en/docs)
  if (code === 0) return { icon: Sun, label: 'Clear sky', color: 'text-amber-500' };
  if (code >= 1 && code <= 3) return { icon: Cloud, label: 'Partly cloudy', color: 'text-zinc-500' };
  if (code >= 45 && code <= 48) return { icon: CloudFog, label: 'Foggy', color: 'text-zinc-400' };
  if (code >= 51 && code <= 55) return { icon: CloudDrizzle, label: 'Drizzle', color: 'text-blue-300' };
  if (code >= 61 && code <= 67) return { icon: CloudRain, label: 'Rain', color: 'text-blue-500' };
  if (code >= 71 && code <= 77) return { icon: CloudSnow, label: 'Snow', color: 'text-cyan-200' };
  if (code >= 80 && code <= 82) return { icon: CloudRain, label: 'Showers', color: 'text-blue-400' };
  if (code >= 85 && code <= 86) return { icon: CloudSnow, label: 'Snow showers', color: 'text-cyan-300' };
  if (code >= 95 && code <= 99) return { icon: CloudLightning, label: 'Thunderstorm', color: 'text-purple-500' };
  
  return { icon: Sun, label: 'Unknown', color: 'text-zinc-500' };
};

export const getDayWeather = async (lat: number, lng: number, dateStr: string): Promise<WeatherData | null> => {
  try {
    // Check if date is too far in the future (Open-Meteo forecast is usually 7-14 days)
    // For this demo, if the date is far, we might not get data, but the API handles historical/forecast seamlessly if within range.
    // If it's a past trip, we could use the archive endpoint, but let's stick to forecast for planning.
    
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=weather_code,temperature_2m_max,temperature_2m_min&start_date=${dateStr}&end_date=${dateStr}&timezone=auto`;
    
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const data = await response.json();
    
    if (!data.daily || !data.daily.time || data.daily.time.length === 0) {
        return null;
    }

    return {
      maxTemp: data.daily.temperature_2m_max[0],
      minTemp: data.daily.temperature_2m_min[0],
      weatherCode: data.daily.weather_code[0],
      date: dateStr
    };
  } catch (error) {
    console.warn("Failed to fetch weather", error);
    return null;
  }
};