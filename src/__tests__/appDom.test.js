import { afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  createLocalizationMock,
  installDom,
  installNavigator,
  installRuntimeMock,
  installStorageMock,
  teardownDom
} from './testUtils.js';
import {
  getPreferredUnit,
  markPlanetVisited,
  setManualLocation,
  setPreferredUnit,
  writeLastKnownWeather,
  STORAGE_KEYS
} from '../storage.js';

globalThis.__SWW_SKIP_INIT__ = true;

let app = null;

beforeAll(async () => {
  app = await import('../app.js');
});

beforeEach(() => {
  installStorageMock();
  installDom(`
    <div id="background"></div>
    <div id="test"></div>
    <div id="planet" tabindex="-1"></div>
    <div id="center1Text"></div>
    <div id="center3Text"></div>
    <div id="message"></div>
    <div id="description"></div>
    <div id="LastUpdated"></div>
    <div id="locationLabel"></div>
    <div id="loading"></div>
  `);
});

afterEach(() => {
  teardownDom();
  delete globalThis.localStorage;
});

describe('app DOM updates', () => {
  test('applyWeatherToUi updates core elements', () => {
    const localization = createLocalizationMock({
      location_display: { message: 'Showing weather in: $1' },
      last_updated_placeholder: { message: 'Last Updated: --' }
    });

    app.applyWeatherToUi({
      planetClass: 'tatooine',
      planetName: 'Tatooine',
      headingPrefix: "IT'S LIKE",
      headingSuffix: 'OUTSIDE',
      message: 'Hot',
      description: 'Dry',
      lastUpdated: new Date().toISOString(),
      lastUpdatedLabel: 'Last Updated: now',
      locationName: 'Austin',
      locationKey: 'auto',
      language: 'en',
      unit: 'fahrenheit',
      timeOfDay: 'afternoon',
      timeOfDayLabel: 'Afternoon'
    }, localization);

    expect(document.getElementById('background').className).toBe('tatooine');
    expect(document.getElementById('planet').innerText).toBe('TATOOINE');
    expect(document.getElementById('message').innerText).toBe('Hot');
    expect(document.getElementById('description').innerText).toBe('Dry');
    expect(document.getElementById('LastUpdated').innerText).toBe('Last Updated: now');
    expect(document.getElementById('locationLabel').innerText).toBe('Showing weather in: Austin');
    expect(document.getElementById('test').style.display).toBe('none');
  });

  test('updateMessage wraps temperature in a temp-toggle control', () => {
    const localization = createLocalizationMock({
      temp_toggle_hint: { message: 'Click to switch units' }
    });

    app.updateMessage('90\u00B0F, It\'s a Hot Afternoon', {
      tempF: 90,
      tempC: 32,
      unit: 'fahrenheit'
    }, localization);

    const toggle = document.querySelector('#message .temp-toggle');
    expect(toggle).toBeTruthy();
    expect(toggle.textContent).toBe('90\u00B0F');
    expect(toggle.getAttribute('title')).toBe('Click to switch units');
    expect(toggle.className).toBe('temp-toggle');
  });

  test('updateMatchReason does not show match UI on the new tab', () => {
    const localization = createLocalizationMock({});
    document.getElementById('planet').innerText = 'HOTH';
    expect(() => app.updateMatchReason('Matched: snow → Hoth', localization)).not.toThrow();
    expect(document.getElementById('matchReason')).toBeNull();
    expect(document.getElementById('matchReasonButton')).toBeNull();
    expect(document.getElementById('planet').classList.contains('has-match-reason')).toBe(false);
    expect(document.getElementById('planet').title).toBe('');
  });

  test('handleTempToggle flips preferred unit and rebuilds message', async () => {
    const localization = createLocalizationMock({
      location_display: { message: 'Showing weather in: $1' },
      planet_tatooine_summary: { message: '$1, It\'s a Hot $2' },
      temp_toggle_hint: { message: 'Click to switch units' }
    });

    app.applyWeatherToUi({
      planetClass: 'tatooine',
      planetId: 'tatooine',
      planetName: 'Tatooine',
      headingPrefix: "IT'S LIKE",
      headingSuffix: 'OUTSIDE',
      message: '90\u00B0F, It\'s a Hot Afternoon',
      description: 'Dry',
      lastUpdated: new Date().toISOString(),
      lastUpdatedLabel: 'Last Updated: now',
      locationName: 'Austin',
      locationKey: 'auto',
      language: 'en',
      unit: 'fahrenheit',
      tempF: 90,
      tempC: 32,
      timeOfDay: 'afternoon',
      timeOfDayLabel: 'Afternoon'
    }, localization);

    expect(document.querySelector('#message .temp-toggle').textContent).toBe('90\u00B0F');

    await app.handleTempToggle();

    expect(getPreferredUnit()).toBe('celsius');
    expect(document.querySelector('#message .temp-toggle').textContent).toBe('32\u00B0C');
    expect(document.getElementById('message').innerText.includes('32\u00B0C')).toBe(true);
  });

  test('showLoadingState clears loading and sets placeholder', () => {
    const localization = createLocalizationMock({
      last_updated_placeholder: { message: 'Last Updated: --' },
      location_display: { message: 'Showing weather in: $1' },
      location_display_unknown: { message: 'Showing weather in: your area' }
    });
    document.getElementById('loading').innerText = 'Loading...';

    app.showLoadingState(localization, 'Paris');

    expect(document.getElementById('loading').innerText).toBe('');
    expect(document.getElementById('locationLabel').innerText).toBe('Showing weather in: Paris');
    expect(document.getElementById('LastUpdated').innerText).toBe('Last Updated: --');
  });

  test('showErrorState updates message and clears description', () => {
    const localization = createLocalizationMock({
      error_weather_unavailable: { message: 'Unable to retrieve weather data right now.' },
      last_updated_placeholder: { message: 'Last Updated: --' },
      location_display_unknown: { message: 'Showing weather in: your area' }
    });

    app.showErrorState(localization, null);

    expect(document.getElementById('message').innerText).toBe('Unable to retrieve weather data right now.');
    expect(document.getElementById('description').innerText).toBe('');
    expect(document.getElementById('LastUpdated').innerText).toBe('Last Updated: --');
  });

  test('applyOfflineFallback random planet clears hyperspace-style empty loading', () => {
    const localization = createLocalizationMock({
      offline_random_planet: { message: 'Sensors offline — signal lost. Displaying a random sector.' },
      offline_signal_lost: { message: 'Sensors offline — last known: $1' },
      center_heading_prefix: { message: "IT'S LIKE" },
      center_heading_suffix: { message: 'OUTSIDE' },
      location_display_unknown: { message: 'Showing weather in: your area' },
      time_of_day_morning: { message: 'Morning' },
      time_of_day_afternoon: { message: 'Afternoon' },
      time_of_day_evening: { message: 'Evening' },
      time_of_day_night: { message: 'Night' },
      time_of_day_pre_dawn: { message: 'Late Night' },
      planet_hoth_name: { message: 'Hoth' },
      planet_hoth_description: { message: 'Cold' },
      planet_kamino_name: { message: 'Kamino' },
      planet_kamino_description: { message: 'Rain' },
      planet_endor_name: { message: 'Endor' },
      planet_endor_description: { message: 'Fog' },
      planet_bespin_name: { message: 'Bespin' },
      planet_bespin_description: { message: 'Wind' },
      planet_scarif_name: { message: 'Scarif' },
      planet_scarif_description: { message: 'Beach' },
      planet_dagobah_name: { message: 'Dagobah' },
      planet_dagobah_description: { message: 'Swamp' },
      planet_naboo_name: { message: 'Naboo' },
      planet_naboo_description: { message: 'Mild' },
      planet_coruscant_name: { message: 'Coruscant' },
      planet_coruscant_description: { message: 'City' },
      planet_tatooine_name: { message: 'Tatooine' },
      planet_tatooine_description: { message: 'Desert' },
      planet_mustafar_name: { message: 'Mustafar' },
      planet_mustafar_description: { message: 'Lava' }
    });

    document.getElementById('background').className = 'hyperspace';
    document.getElementById('loading').innerText = 'Loading...';

    app.applyOfflineFallback(localization, 'en', 'fahrenheit');

    expect(document.getElementById('background').className).not.toBe('hyperspace');
    expect(document.getElementById('loading').innerText).toBe('');
    expect(document.getElementById('message').innerText).toContain('Sensors offline');
    expect(document.getElementById('LastUpdated').innerText).toContain('Sensors offline');
  });
});

const LOCALE_PATH = join(import.meta.dir, '..', '..', '_locales', 'en', 'messages.json');
const LOCALE_MESSAGES = JSON.parse(readFileSync(LOCALE_PATH, 'utf8'));

const AUSTIN = { latitude: 30.2672, longitude: -97.7431 };

/** Planet rules match this to Tatooine. */
const HOT_WEATHER = {
  weather: [{ main: 'Clear', description: 'clear sky' }],
  main: { temp: 90, humidity: 10 },
  wind: { speed: 5 },
  name: 'Austin',
  sys: { country: 'US', state: 'Texas' }
};

const LOCALE_ROUTE = { match: '_locales', json: LOCALE_MESSAGES };
const GEOCODE_ROUTE = { match: 'geo/1.0/reverse', json: [{ name: 'Austin', state: 'Texas', country: 'US' }] };
const WEATHER_OK = { match: 'data/2.5/weather', json: HOT_WEATHER };

/**
 * Routes by URL because refreshWeather()'s request order shifts with the caches each
 * test seeds. Unmatched URLs reject like an unreachable network: TypeError, no status.
 */
function installFetchRouter(routes) {
  const calls = [];
  const fetchMock = async (input) => {
    const url = String(input);
    calls.push(url);

    const route = routes.find((entry) => url.includes(entry.match));
    if (!route || route.error) {
      throw route?.error ?? new TypeError('Failed to fetch');
    }

    return {
      ok: route.ok !== false,
      status: route.status ?? 200,
      json: async () => route.json ?? {}
    };
  };
  fetchMock.calls = calls;
  globalThis.fetch = fetchMock;
  return fetchMock;
}

/** Drain the promise chain of an event-triggered refresh, which nothing awaits. */
async function flushAsync(ticks = 50) {
  for (let i = 0; i < ticks; i += 1) {
    await Promise.resolve();
  }
}

function seedLastKnownHoth(overrides = {}) {
  writeLastKnownWeather({
    planetId: 'hoth',
    planetName: 'Hoth',
    planetClass: 'hoth',
    message: "10°F, It's a Very Cold Afternoon",
    description: 'Ice',
    language: 'en',
    unit: 'fahrenheit',
    locationKey: 'auto',
    locationName: 'Austin, TX',
    tempF: 10,
    tempC: -12,
    timeOfDayLabel: 'Afternoon',
    lastUpdated: new Date().toISOString(),
    ...overrides
  });
}

describe('new tab render', () => {
  const realFetch = globalThis.fetch;
  const realNavigator = globalThis.navigator;
  const realSetTimeout = globalThis.setTimeout;
  const realApiKey = globalThis.API_KEY;

  beforeEach(() => {
    installRuntimeMock();
    globalThis.API_KEY = 'test-key';
    // skip the hyperspace hold, it's a UX floor and isn't under test
    globalThis.setTimeout = (callback) => {
      callback();
      return 0;
    };
    installNavigator(globalThis.window, {
      language: 'en-US',
      onLine: true,
      geolocation: {
        getCurrentPosition(success) {
          success({ coords: { latitude: AUSTIN.latitude, longitude: AUSTIN.longitude } });
        }
      }
    });
  });

  afterEach(() => {
    globalThis.setTimeout = realSetTimeout;
    delete globalThis.browser;
    if (realFetch) {
      globalThis.fetch = realFetch;
    } else {
      delete globalThis.fetch;
    }
    if (realNavigator) {
      globalThis.navigator = realNavigator;
    } else {
      delete globalThis.navigator;
    }
    if (realApiKey) {
      globalThis.API_KEY = realApiKey;
    } else {
      delete globalThis.API_KEY;
    }
  });

  // Regression: a device with full or blocked localStorage saw "Sensors offline" on
  // every new tab even though the fetch had succeeded.
  test('a failing localStorage write cannot demote a successful render to the offline screen', async () => {
    seedLastKnownHoth();
    installFetchRouter([LOCALE_ROUTE, WEATHER_OK, GEOCODE_ROUTE]);

    localStorage.setItem = () => {
      throw new Error('QuotaExceededError');
    };

    await app.refreshWeather();

    expect(document.getElementById('planet').innerText).toBe('TATOOINE');
    expect(document.getElementById('message').innerText).toContain("It's a Hot");
    expect(document.getElementById('LastUpdated').innerText).not.toContain('Sensors offline');
    expect(document.getElementById('locationLabel').innerText).toContain('Austin');
  });

  test('a successful render survives a failure to record the planet as visited', async () => {
    installFetchRouter([LOCALE_ROUTE, WEATHER_OK, GEOCODE_ROUTE]);

    const realSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = (key, value) => {
      if (key === STORAGE_KEYS.visitedPlanets) {
        throw new Error('QuotaExceededError');
      }
      realSetItem(key, value);
    };

    await app.refreshWeather();

    expect(document.getElementById('planet').innerText).toBe('TATOOINE');
    // writes after the failed one still land
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.cache)).planetId).toBe('tatooine');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.lastKnownWeather)).planetId).toBe('tatooine');
  });

  test('an HTTP failure surfaces a service error instead of stale weather', async () => {
    seedLastKnownHoth();
    installFetchRouter([LOCALE_ROUTE, GEOCODE_ROUTE, { match: 'data/2.5/weather', ok: false, status: 429 }]);
    document.getElementById('planet').innerText = 'HOTH';

    await app.refreshWeather();

    expect(document.getElementById('message').innerText).toBe('Unable to retrieve weather data right now.');
    expect(document.getElementById('message').innerText).not.toContain('Sensors offline');
    expect(document.getElementById('planet').innerText).toBe('');
    expect(document.getElementById('LastUpdated').innerText).toBe('Last Updated: --');

    // No stale data was shown, so nothing counts as a fallback.
    const telemetry = JSON.parse(localStorage.getItem(STORAGE_KEYS.telemetry));
    expect(telemetry.errors).toBe(1);
    expect(telemetry.offlineFallbacks).toBe(0);
  });

  test('a network failure with no status keeps the signal-lost experience', async () => {
    seedLastKnownHoth();
    installFetchRouter([LOCALE_ROUTE, GEOCODE_ROUTE, { match: 'data/2.5/weather', error: new TypeError('Failed to fetch') }]);

    await app.refreshWeather();

    expect(document.getElementById('planet').innerText).toBe('HOTH');
    expect(document.getElementById('LastUpdated').innerText).toContain('Sensors offline');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.telemetry)).offlineFallbacks).toBe(1);
  });

  // navigator.onLine reads false on VPNs and virtual adapters, so it can't be the
  // one deciding the network is unreachable.
  test('navigator.onLine === false still attempts the fetch', async () => {
    installNavigator(globalThis.window, {
      language: 'en-US',
      onLine: false,
      geolocation: {
        getCurrentPosition(success) {
          success({ coords: { latitude: AUSTIN.latitude, longitude: AUSTIN.longitude } });
        }
      }
    });
    const fetchMock = installFetchRouter([LOCALE_ROUTE, WEATHER_OK, GEOCODE_ROUTE]);

    await app.refreshWeather();

    expect(fetchMock.calls.some((url) => url.includes('data/2.5/weather'))).toBe(true);
    expect(document.getElementById('planet').innerText).toBe('TATOOINE');
  });

  test('an offline failure arms exactly one online retry, and that retry recovers the page', async () => {
    const registered = [];
    const realAddEventListener = globalThis.window.addEventListener.bind(globalThis.window);
    globalThis.window.addEventListener = (type, ...rest) => {
      registered.push(type);
      return realAddEventListener(type, ...rest);
    };

    installFetchRouter([LOCALE_ROUTE, GEOCODE_ROUTE, { match: 'data/2.5/weather', error: new TypeError('Failed to fetch') }]);

    await app.refreshWeather();
    await app.refreshWeather({ isNewTab: false });

    expect(registered.filter((type) => type === 'online')).toHaveLength(1);
    expect(document.getElementById('LastUpdated').innerText).toContain('Sensors offline');

    installFetchRouter([LOCALE_ROUTE, WEATHER_OK, GEOCODE_ROUTE]);
    globalThis.window.dispatchEvent(new globalThis.window.Event('online'));
    await flushAsync();

    expect(document.getElementById('planet').innerText).toBe('TATOOINE');
    expect(document.getElementById('LastUpdated').innerText).not.toContain('Sensors offline');
  });

  // Austin's planet under a Tokyo request is worse than showing nothing known.
  test('last-known weather for one location is not rendered for another', async () => {
    setManualLocation({ name: 'Tokyo', displayName: 'Tokyo, JP', lat: 35.6895, lon: 139.6917, country: 'JP' });
    seedLastKnownHoth({ planetId: 'tatooine', planetName: 'Tatooine', locationKey: 'auto', locationName: 'Austin, TX' });
    installFetchRouter([LOCALE_ROUTE, { match: 'data/2.5/weather', error: new TypeError('Failed to fetch') }]);

    await app.refreshWeather();

    expect(document.getElementById('locationLabel').innerText).not.toContain('Austin');
    expect(document.getElementById('message').innerText)
      .toBe('Sensors offline — signal lost. Displaying a random sector.');
  });

  // The stored message holds the temperature pre-formatted, so reusing it after a unit
  // change showed "90°F" in Celsius mode and left the toggle unrendered.
  test('a stale reading is re-rendered in the unit in force now', async () => {
    seedLastKnownHoth({
      planetId: 'tatooine',
      planetName: 'Tatooine',
      planetClass: 'tatooine',
      message: "90°F, It's a Hot Afternoon",
      tempF: 90,
      tempC: 32
    });
    setPreferredUnit('celsius');
    installFetchRouter([LOCALE_ROUTE, { match: 'data/2.5/weather', error: new TypeError('Failed to fetch') }]);

    await app.refreshWeather();

    const message = document.getElementById('message');
    expect(message.innerText).not.toContain('90°F');
    expect(message.innerText).toContain('32°C');
    expect(document.querySelector('#message .temp-toggle').textContent).toBe('32°C');
  });

  test('toggling units on an offline fallback re-renders at once and is never cached', async () => {
    const localization = createLocalizationMock({
      offline_signal_lost: { message: 'Sensors offline — last known: $1' },
      planet_hoth_summary: { message: "$1, It's a Very Cold $2" },
      temp_toggle_hint: { message: 'Click to switch units' }
    });
    installFetchRouter([LOCALE_ROUTE, WEATHER_OK, GEOCODE_ROUTE]);

    app.applyWeatherToUi({
      planetId: 'hoth',
      planetClass: 'hoth',
      planetName: 'Hoth',
      message: "10°F, It's a Very Cold Afternoon",
      description: 'Ice',
      lastUpdated: new Date().toISOString(),
      lastUpdatedLabel: 'Sensors offline — last known: Hoth',
      locationKey: 'auto',
      language: 'en',
      unit: 'fahrenheit',
      tempF: 10,
      tempC: -12,
      timeOfDayLabel: 'Afternoon',
      offline: true
    }, localization);

    await app.handleTempToggle();

    expect(document.getElementById('message').innerText).toContain('-12°C');
    expect(document.getElementById('message').innerText).not.toContain('10°F');

    // An offline model must never reach the TTL cache, or the next tab gets a cache
    // hit on "Sensors offline" and never refreshes.
    expect(localStorage.getItem(STORAGE_KEYS.cache)).toBeNull();

    // Last-known has to move to the new unit too, or the next offline load renders
    // the unit the user just switched away from.
    const lastKnown = JSON.parse(localStorage.getItem(STORAGE_KEYS.lastKnownWeather));
    expect(lastKnown.unit).toBe('celsius');
    expect(lastKnown.offline).toBeUndefined();
  });

  test('toggling units on a live reading moves last-known onto the new unit too', async () => {
    const localization = createLocalizationMock({
      planet_tatooine_summary: { message: "$1, It's a Hot $2" },
      temp_toggle_hint: { message: 'Click to switch units' }
    });

    app.applyWeatherToUi({
      planetId: 'tatooine',
      planetClass: 'tatooine',
      planetName: 'Tatooine',
      message: "90°F, It's a Hot Afternoon",
      description: 'Desert',
      lastUpdated: new Date().toISOString(),
      lastUpdatedLabel: 'Last Updated: now',
      locationKey: 'auto',
      locationName: 'Austin, TX',
      language: 'en',
      unit: 'fahrenheit',
      tempF: 90,
      tempC: 32,
      timeOfDayLabel: 'Afternoon'
    }, localization);

    await app.handleTempToggle();

    const lastKnown = JSON.parse(localStorage.getItem(STORAGE_KEYS.lastKnownWeather));
    expect(lastKnown.unit).toBe('celsius');
    expect(lastKnown.message).toContain('32°C');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.cache)).unit).toBe('celsius');
  });

  // daily_activity.tabs is the denominator of cacheHits/tabs and errors/tabs, so
  // counting a settings change as a tab skews the ratios.
  test('a self-triggered re-render does not count as a new tab', async () => {
    installFetchRouter([LOCALE_ROUTE, WEATHER_OK, GEOCODE_ROUTE]);

    await app.refreshWeather();
    await app.refreshWeather({ isNewTab: false });
    await app.refreshWeather({ isNewTab: false });

    const telemetry = JSON.parse(localStorage.getItem(STORAGE_KEYS.telemetry));
    expect(telemetry.tabs).toBe(1);
    expect(telemetry.cacheHits).toBe(0);
  });
});

describe('time of day labels', () => {
  const localization = createLocalizationMock({
    time_of_day_morning: { message: 'Morning' },
    time_of_day_afternoon: { message: 'Afternoon' },
    time_of_day_evening: { message: 'Evening' },
    time_of_day_night: { message: 'Night' },
    time_of_day_pre_dawn: { message: 'Late Night' }
  });

  // Boston, Dec 21: sunrise 07:13, sunset 16:15 local (UTC-5)
  const BOSTON_WINTER = {
    sunrise: Date.parse('2024-12-21T12:13:00Z') / 1000,
    sunset: Date.parse('2024-12-21T21:15:00Z') / 1000,
    timezoneOffset: -5 * 60 * 60
  };

  // Stockholm, Dec 21: sunrise 08:44, sunset 14:48 local (UTC+1). The evening window
  // alone would open at 11:48 and leave "Afternoon" unreachable all winter.
  const STOCKHOLM_WINTER = {
    sunrise: Date.parse('2024-12-21T07:44:00Z') / 1000,
    sunset: Date.parse('2024-12-21T13:48:00Z') / 1000,
    timezoneOffset: 60 * 60
  };

  test('early afternoon on a short winter day is still Afternoon', () => {
    // 13:45 local in Boston
    const timeOfDay = app.resolveTimeOfDay(new Date('2024-12-21T18:45:00Z'), localization, BOSTON_WINTER);
    expect(timeOfDay.id).toBe('afternoon');
    expect(timeOfDay.isDaytime).toBe(true);
  });

  test('the last of the daylight is Evening even where the sun sets before 15:00', () => {
    // 14:30 local in Stockholm, 18 min before sunset. A bare clock floor on "Afternoon"
    // made "Evening" unreachable here for about two months.
    const timeOfDay = app.resolveTimeOfDay(new Date('2024-12-21T13:30:00Z'), localization, STOCKHOLM_WINTER);
    expect(timeOfDay.id).toBe('evening');
    expect(timeOfDay.isDaytime).toBe(true);
  });

  test('a 14:48 sunset does not make lunchtime Evening', () => {
    // 12:30 local in Stockholm
    const timeOfDay = app.resolveTimeOfDay(new Date('2024-12-21T11:30:00Z'), localization, STOCKHOLM_WINTER);
    expect(timeOfDay.id).toBe('afternoon');
  });

  test('the last stretch of daylight is still Evening', () => {
    // 15:30 local in Boston, 45 min before sunset
    expect(app.resolveTimeOfDay(new Date('2024-12-21T20:30:00Z'), localization, BOSTON_WINTER).id).toBe('evening');
  });

  test('after sunset is Night whatever the hour', () => {
    // 15:00 local in Stockholm, after a 14:48 sunset
    const timeOfDay = app.resolveTimeOfDay(new Date('2024-12-21T14:00:00Z'), localization, STOCKHOLM_WINTER);
    expect(timeOfDay.id).toBe('night');
    expect(timeOfDay.isDaytime).toBe(false);
  });

  test('a long summer day keeps the 17:00 evening rule', () => {
    const summer = {
      sunrise: Date.parse('2024-06-21T04:00:00Z') / 1000,
      sunset: Date.parse('2024-06-21T22:00:00Z') / 1000,
      timezoneOffset: 0
    };

    expect(app.resolveTimeOfDay(new Date('2024-06-21T14:00:00Z'), localization, summer).id).toBe('afternoon');
    expect(app.resolveTimeOfDay(new Date('2024-06-21T17:30:00Z'), localization, summer).id).toBe('evening');
  });
});

// applyWeatherToUi draws the passport and persistSuccessfulWeather draws it again so a
// fresh stamp lands on this tab; together they must not rebuild an unchanged grid.
describe('passport rendering on the success path', () => {
  const PASSPORT_MARKUP = `
    <div id="background"></div>
    <div id="test"></div>
    <div id="planet" tabindex="-1"></div>
    <div id="message"></div>
    <div id="description"></div>
    <div id="LastUpdated"></div>
    <div id="locationLabel"></div>
    <div id="loading"></div>
    <aside id="exploreMenu" class="explore-menu hidden">
      <button type="button" id="exploreMenuButton"></button>
      <div id="exploreMenuPanel" class="explore-menu-panel hidden" role="menu"></div>
    </aside>
    <aside id="passport" class="passport hidden">
      <div id="passportPanel" class="passport-panel hidden" role="dialog">
        <p id="passportCount"></p>
        <div id="passportProgressBar"></div>
        <ul id="passportGrid"></ul>
      </div>
    </aside>
  `;

  function viewModelFor(planetId) {
    return {
      planetClass: planetId,
      planetName: planetId,
      planetId,
      headingPrefix: "IT'S LIKE",
      headingSuffix: 'OUTSIDE',
      message: 'message',
      description: 'description',
      lastUpdated: new Date().toISOString(),
      locationName: 'Ann Arbor',
      locationKey: 'auto',
      language: 'en',
      unit: 'fahrenheit',
      timeOfDay: 'morning',
      timeOfDayLabel: 'Morning',
      matchReason: '',
      tempF: 10,
      tempC: -12
    };
  }

  // renderPassportGrid only wipes the grid when it can't reuse the existing tiles, so
  // counting resets counts teardowns. Redraws are asserted against the tiles.
  function countGridRebuilds() {
    const grid = document.getElementById('passportGrid');
    const counter = { rebuilds: 0 };
    let store = '';
    Object.defineProperty(grid, 'innerHTML', {
      get: () => store,
      set: (value) => {
        if (value === '') {
          counter.rebuilds += 1;
        }
        store = value;
      },
      configurable: true
    });
    return counter;
  }

  test('a newly visited planet redraws the passport so the stamp appears on this tab', () => {
    installDom(PASSPORT_MARKUP);
    const localization = createLocalizationMock({});
    const counter = countGridRebuilds();
    const grid = document.getElementById('passportGrid');
    const count = document.getElementById('passportCount');

    // The weather render happens before the visit is recorded, so the stamp is still locked.
    app.applyWeatherToUi(viewModelFor('hoth'), localization);
    const stamp = grid.querySelector('[data-planet="hoth"]');
    expect(stamp).not.toBeNull();
    expect(stamp.classList.contains('visited')).toBe(false);
    expect(count.textContent).toContain('0/13');

    app.persistSuccessfulWeather(viewModelFor('hoth'), localization);
    expect(grid.querySelector('[data-planet="hoth"]')).toBe(stamp);
    expect(stamp.classList.contains('visited')).toBe(true);
    expect(count.textContent).toContain('1/13');

    expect(counter.rebuilds).toBe(1);
  });

  test('an unreadable stamp list cannot undo a render that already succeeded', () => {
    installDom(PASSPORT_MARKUP);
    const localization = createLocalizationMock({});

    // applyWeatherToUi runs inside refreshWeather's try, so a throwing read here used
    // to repaint an already-successful fetch as the offline fallback.
    const realGetItem = localStorage.getItem.bind(localStorage);
    localStorage.getItem = (key) => {
      if (key === STORAGE_KEYS.visitedPlanets) {
        throw new Error('SecurityError');
      }
      return realGetItem(key);
    };

    try {
      expect(() => app.applyWeatherToUi(viewModelFor('hoth'), localization)).not.toThrow();
      expect(() => app.persistSuccessfulWeather(viewModelFor('hoth'), localization)).not.toThrow();
    } finally {
      localStorage.getItem = realGetItem;
    }

    expect(document.getElementById('planet').innerText).toBe('HOTH');
  });

  test('an already stamped planet does not rebuild the grid a second time', () => {
    installDom(PASSPORT_MARKUP);
    const localization = createLocalizationMock({});
    markPlanetVisited('hoth');
    const counter = countGridRebuilds();

    app.applyWeatherToUi(viewModelFor('hoth'), localization);
    app.persistSuccessfulWeather(viewModelFor('hoth'), localization);

    expect(counter.rebuilds).toBe(1);
  });
});
