export const WEATHER_ENDPOINT = 'https://api.openweathermap.org/data/2.5/weather';
export const GEOCODING_DIRECT_ENDPOINT = 'https://api.openweathermap.org/geo/1.0/direct';
export const GEOCODING_REVERSE_ENDPOINT = 'https://api.openweathermap.org/geo/1.0/reverse';

export const GEOLOCATION_OPTIONS = Object.freeze({
  enableHighAccuracy: false,
  timeout: 5000,
  maximumAge: 600000
});

export const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/** A coordinate's city/state/country effectively never changes, hence the long TTL. */
export const GEOCODE_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** Shorter TTL for empty geocode results so they get retried eventually. */
export const GEOCODE_NEGATIVE_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 1 day

/** Decimal places used to bucket coordinates in the geocode cache (~1.1km at the equator). */
export const GEOCODE_CACHE_PRECISION = 2;

/** Enough for home, work and a trip's stops without growing unbounded. */
export const GEOCODE_CACHE_MAX_ENTRIES = 8;

/** Larger than the coordinate cache: typed searches get mistyped and retried a lot. */
export const GEOCODE_QUERY_CACHE_MAX_ENTRIES = 12;

/** Hyperspace hold before revealing a planet (non-cache loads only). */
export const HYPERSPACE_MIN_MS = 3000;

export const DEGREE_SYMBOL = '\u00B0';

export const MAX_SHORTCUTS = 8;
export const SHORTCUT_ROW_MAX_WIDTH = 560;
export const SHORTCUT_TILE_WIDTH = 64;
export const SHORTCUT_GAP = 16;
export const FAVICON_SIZE = 32;

export const SUGGESTION_LIMIT = 5;
export const DEBOUNCE_MS = 200;

export const GEOCODING_RESULT_LIMIT = 5;
