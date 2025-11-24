'use client';

import { useEffect } from 'react';

interface LocationWithProducts {
  name: string;
  productIdentifiers: string[];
}

interface LocationsResponse {
  success: boolean;
  locations: LocationWithProducts[];
}

// Cache key dla miejscowości (ten sam co w komponencie)
const LOCATIONS_CACHE_KEY = 'locations_cache_v1';
const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minut

export const useLocationsPreload = () => {
  useEffect(() => {
    const preloadLocations = async () => {
      // Sprawdź czy już są dane w cache
      const cachedData = sessionStorage.getItem(LOCATIONS_CACHE_KEY);
      if (cachedData) {
        try {
          const parsedCache = JSON.parse(cachedData);
          const now = Date.now();

          if (
            parsedCache.timestamp &&
            now - parsedCache.timestamp < CACHE_EXPIRY_MS &&
            parsedCache.locations
          ) {
            console.log('🚀 Preload: Dane już są w cache');
            return; // Dane są świeże, nie ma potrzeby preloadingu
          }
        } catch (parseError) {
          console.error('🚀 Preload: Błąd parsowania cache:', parseError);
          sessionStorage.removeItem(LOCATIONS_CACHE_KEY);
        }
      }

      // Brak cache lub wygasł - uruchom preloading
      console.log('🚀 Preload: Rozpoczynam ładowanie danych w tle...');

      try {
        const response = await fetch('/api/r2/locations');
        const data: LocationsResponse = await response.json();

        if (data.success && data.locations && data.locations.length > 0) {
          // Zapisz w cache
          const cacheData = {
            locations: data.locations,
            timestamp: Date.now(),
          };

          try {
            sessionStorage.setItem(LOCATIONS_CACHE_KEY, JSON.stringify(cacheData));
            console.log(
              '🚀 Preload: Dane załadowane i zapisane w cache (' +
                data.locations.length +
                ' miejscowości)'
            );
          } catch (cacheError) {
            console.warn('🚀 Preload: Nie można zapisać w cache:', cacheError);
          }
        } else {
          console.log('🚀 Preload: Brak danych z API');
        }
      } catch (error) {
        console.error('🚀 Preload: Błąd ładowania danych:', error);
        // Nie logujemy jako błąd krytyczny - to tylko preloading
      }
    };

    // Uruchom preloading po krótkim opóźnieniu, żeby nie blokować głównego renderowania
    const timer = setTimeout(preloadLocations, 500);

    return () => clearTimeout(timer);
  }, []);
};
