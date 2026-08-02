import {
  clearGeolocationAlerted,
  clearWeatherCache,
  getManualLocation,
  getPreferredLanguage,
  getPreferredUnit,
  getVisitedPlanets,
  hasShownGeolocationError,
  isOnboardingComplete,
  markGeolocationAlerted,
  markPlanetVisited,
  readGeocodeCache,
  readLastKnownWeather,
  readWeatherCache,
  setPreferredUnit,
  STORAGE_KEYS,
  writeGeocodeCache,
  writeLastKnownWeather,
  writeWeatherCache
} from './storage.js';
import { loadLocalization } from './i18n.js';
import { stateToAbbreviation } from './geo.js';
import { PLANET_RULES, DEFAULT_PLANET_RULE, explainMatch } from './planets.js';
import {
  WEATHER_ENDPOINT,
  GEOCODING_REVERSE_ENDPOINT,
  GEOLOCATION_OPTIONS,
  DEGREE_SYMBOL,
  HYPERSPACE_MIN_MS
} from './config.js';
import {
  recordError,
  recordGeocodeCall,
  recordTabOpen,
  recordTabOutcome,
  recordWeatherCall,
  track
} from './telemetry.js';
import { initPassport, updatePassportUi } from './passport.js';

const DEBUG = true;
const DEBUG_FORCE_PLANET_ID = null;

const SHOULD_INIT = !(typeof globalThis !== 'undefined' && globalThis.__SWW_SKIP_INIT__ === true);

let currentViewModel = null;
let currentLocalization = null;

function debug(...args) {
  if (DEBUG) {
    console.log('[StarWarsWeather]', ...args);
  }
}

function buildManualLocationKey(location) {
  if (!location || !Number.isFinite(location.lat) || !Number.isFinite(location.lon)) {
    return 'manual:invalid';
  }

  return `manual:${location.lat.toFixed(4)},${location.lon.toFixed(4)}`;
}

const WATCHED_SETTINGS = new Set([
  STORAGE_KEYS.unit,
  STORAGE_KEYS.language,
  STORAGE_KEYS.manualLocation
]);

function waitForMinimumHyperspace(startedAt, minMs = HYPERSPACE_MIN_MS) {
  const elapsed = Date.now() - startedAt;
  const remaining = Math.max(0, minMs - elapsed);
  if (remaining === 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    setTimeout(resolve, remaining);
  });
}

function isNavigatorOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/** A full or blocked localStorage must not take the render down with it. */
function safeStorageWrite(label, write) {
  try {
    write();
    return true;
  } catch (error) {
    console.warn(`Unable to persist ${label}`, error);
    return false;
  }
}

/** Reads can throw too: the cache prunes expired entries, so a read writes. */
function safeStorageRead(label, read, fallback = null) {
  try {
    return read();
  } catch (error) {
    console.warn(`Unable to read ${label}`, error);
    return fallback;
  }
}

/** The page an `online` retry is already armed on, so retries cannot stack. */
let onlineRetryTarget = null;

/**
 * Without this a tab that failed offline sits on the signal-lost screen until reopened.
 * Every failed pass asks for a retry, so only the first on a page arms a listener.
 */
function scheduleOnlineRetry() {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
    return;
  }

  if (onlineRetryTarget === window) {
    return;
  }

  onlineRetryTarget = window;
  window.addEventListener('online', () => {
    onlineRetryTarget = null;
    debug('Connectivity restored; retrying weather');
    refreshWeather({ isNewTab: false });
  }, { once: true });
}

function persistSuccessfulWeather(viewModel, localization = currentLocalization) {
  // Runs inside refreshWeather's try/catch: anything escaping here would repaint a
  // successful render as "Sensors offline". Covers the gaps between guarded writes.
  try {
    // applyWeatherToUi already drew the passport; only a new stamp changes it, and a
    // redraw still rewrites thirteen tiles plus the count.
    const isNewStamp = Boolean(viewModel.planetId)
      && !getVisitedPlanets().includes(viewModel.planetId);
    const marked = Boolean(viewModel.planetId)
      && safeStorageWrite('visited planets', () => markPlanetVisited(viewModel.planetId));

    if (marked && isNewStamp && localization) {
      updatePassportUi(localization);
    }

    safeStorageWrite('weather cache', () => writeWeatherCache(viewModel));
    safeStorageWrite('last known weather', () => writeLastKnownWeather(viewModel));
    safeStorageWrite('geolocation alert flag', () => clearGeolocationAlerted());
  } catch (error) {
    console.warn('Unable to persist the successful weather load', error);
  }
}

/**
 * Only a real new-tab render feeds the rollup. The settings listener, unit toggle and
 * online retry all re-enter refreshWeather(); counting them inflates `tabs`.
 */
function recordRenderOutcome(isNewTab, outcome, details) {
  if (isNewTab) {
    recordTabOutcome(outcome, details);
  }
}

function buildOfflineRandomViewModel(localization, language, unit) {
  const rule = PLANET_RULES[Math.floor(Math.random() * PLANET_RULES.length)] ?? DEFAULT_PLANET_RULE;
  const timeOfDay = resolveTimeOfDay(new Date(), localization);
  const planetName = localization.getMessage(`planet_${rule.id}_name`) || rule.name;
  const description = localization.getMessage(`planet_${rule.id}_description`) || '';
  const offlineMessage = localization.getMessage('offline_random_planet')
    || 'Sensors offline — signal lost. Displaying a random sector.';

  return {
    planetId: rule.id,
    planetClass: selectBackground(rule, timeOfDay.id, timeOfDay.isDaytime),
    planetName,
    headingPrefix: localization.getMessage('center_heading_prefix') || "IT'S LIKE",
    headingSuffix: localization.getMessage('center_heading_suffix') || 'OUTSIDE',
    message: offlineMessage,
    description,
    lastUpdated: null,
    lastUpdatedLabel: localization.getMessage('offline_signal_lost', [planetName])
      || `Sensors offline — last known: ${planetName}`,
    locationKey: 'offline',
    locationName: null,
    language,
    unit,
    timeOfDay: timeOfDay.id,
    timeOfDayLabel: timeOfDay.label,
    sunrise: null,
    sunset: null,
    timezoneOffset: null,
    offline: true
  };
}

function rehydrateLastKnownViewModel(stored, localization, language, unit) {
  const planetId = stored.planetId;
  const rule = planetId
    ? (PLANET_RULES.find((entry) => entry.id === planetId) ?? DEFAULT_PLANET_RULE)
    : null;
  const sunTimes = extractSunTimes(stored);
  const timeOfDay = resolveTimeOfDay(new Date(), localization, sunTimes);

  let planetName = stored.planetName;
  let description = stored.description;
  let message = stored.message;
  let planetClass = stored.planetClass;

  if (rule) {
    planetName = localization.getMessage(`planet_${rule.id}_name`) || rule.name || stored.planetName;
    description = localization.getMessage(`planet_${rule.id}_description`) || stored.description || '';
    planetClass = selectBackground(rule, timeOfDay.id, timeOfDay.isDaytime);

    // Stored message has the temperature baked in, in the unit and language of the
    // write, so it is only reusable while both still match.
    const isStale = (stored.language && stored.language !== language)
      || (stored.unit && stored.unit !== unit);

    if (isStale) {
      // Rebuilding from the persisted temps also keeps the temperature clickable:
      // updateMessage only wraps a label it can match.
      message = buildSummaryMessage({
        planetId: rule.id,
        tempF: stored.tempF,
        tempC: stored.tempC,
        unit,
        timeOfDayLabel: timeOfDay.label
      }, localization)
        || localization.getMessage('offline_signal_lost', [planetName])
        || `Sensors offline — last known: ${planetName}`;
    }
  }

  return {
    ...stored,
    planetId: rule?.id ?? stored.planetId ?? null,
    planetClass,
    planetName,
    headingPrefix: localization.getMessage('center_heading_prefix') || stored.headingPrefix || "IT'S LIKE",
    headingSuffix: localization.getMessage('center_heading_suffix') || stored.headingSuffix || 'OUTSIDE',
    message,
    description,
    lastUpdatedLabel: localization.getMessage('offline_signal_lost', [planetName])
      || `Sensors offline — last known: ${planetName}`,
    language,
    unit,
    timeOfDay: timeOfDay.id,
    timeOfDayLabel: timeOfDay.label,
    sunrise: sunTimes?.sunrise ?? stored.sunrise ?? null,
    sunset: sunTimes?.sunset ?? stored.sunset ?? null,
    timezoneOffset: sunTimes?.timezoneOffset ?? stored.timezoneOffset ?? null,
    offline: true
  };
}

/** `locationKey` scopes the stale reading: weather saved elsewhere is no fallback for here. */
function applyOfflineFallback(localization, language, unit, { errorType = 'unknown', locationKey = null, isNewTab = false } = {}) {
  // Only renders that recordTabOpen() counted may report a fallback, or
  // offlineFallbacks/tabs exceeds 1. Re-renders still add to `errors`.
  const fallbackForRollup = (mode) => (isNewTab ? mode : null);

  const lastKnown = readLastKnownWeather({ language, unit, locationKey });
  if (lastKnown) {
    debug('Applying last-known weather offline fallback', lastKnown);
    const viewModel = rehydrateLastKnownViewModel(lastKnown, localization, language, unit);
    applyWeatherToUi(viewModel, localization);
    recordError({ errorType, fallback: fallbackForRollup('last_known') });
    recordRenderOutcome(isNewTab, 'error', {
      planetId: viewModel.planetId,
      planet: viewModel.planetName,
      timeOfDay: viewModel.timeOfDay
    });
    return viewModel;
  }

  debug('No last-known weather; showing random offline planet');
  const viewModel = buildOfflineRandomViewModel(localization, language, unit);
  applyWeatherToUi(viewModel, localization);
  recordError({ errorType, fallback: fallbackForRollup('random') });
  recordRenderOutcome(isNewTab, 'error', {
    planetId: viewModel.planetId,
    planet: viewModel.planetName,
    timeOfDay: viewModel.timeOfDay
  });
  return viewModel;
}

/**
 * An HTTP status means the service answered and refused (bad key, quota, outage), so it gets an
 * explicit error rather than a stale planet passed off as the sky. Everything else is signal lost.
 */
function handleWeatherFailure(error, { localization, language, unit, locationKey, locationName = null, errorType, isNewTab }) {
  const status = Number(error?.status);
  if (Number.isFinite(status)) {
    debug('Weather service responded with a failure status', status);
    showErrorState(localization, locationName);
    // No `fallback`: nothing stale was shown, so keep this out of offlineFallbacks.
    recordError({ errorType, errorCode: String(status) });
    recordRenderOutcome(isNewTab, 'error');
    return null;
  }

  // navigator.onLine only says an interface exists, so it labels the failure rather than deciding it.
  scheduleOnlineRetry();
  return applyOfflineFallback(localization, language, unit, {
    errorType: isNavigatorOffline() ? 'offline' : errorType,
    locationKey,
    isNewTab
  });
}

/** `isNewTab` is false when the page re-renders itself (settings change, unit toggle, online retry). */
async function refreshWeather({ isNewTab = true } = {}) {
  const preferredLanguage = getPreferredLanguage();
  const unit = getPreferredUnit();
  const manualLocation = getManualLocation();
  const manualLocationKey = manualLocation ? buildManualLocationKey(manualLocation) : null;
  const usingManualLocation = Boolean(manualLocation && manualLocationKey && manualLocationKey !== 'manual:invalid');
  const locationKey = usingManualLocation ? manualLocationKey : 'auto';
  const manualLocationName = usingManualLocation
    ? (manualLocation.displayName || manualLocation.name || null)
    : null;

  const localization = await loadLocalization(preferredLanguage);
  const language = localization.language;

  debug('Initialising extension', { preferredLanguage, resolvedLanguage: language, unit, manualLocation, locationKey });
  if (isNewTab) {
    recordTabOpen();
  }

  initPassport(localization);

  const cached = readWeatherCache({ language, unit, locationKey });
  if (cached) {
    debug('Using cached weather data', cached);
    recordRenderOutcome(isNewTab, 'cache_hit', {
      planetId: cached.planetId,
      planet: cached.planetName,
      timeOfDay: cached.timeOfDay
    });
    applyWeatherToUi(cached, localization);
    return;
  }

  debug('No cached weather data available; showing loading state');
  const loadingStartedAt = Date.now();
  showLoadingState(localization, manualLocationName);

  // Fetch even when navigator.onLine is false: it reads false on VPN and virtual
  // adapters, which stranded those users on a random planet that re-rolled every tab.

  const failureContext = {
    localization,
    language,
    unit,
    locationKey,
    locationName: manualLocationName,
    isNewTab
  };

  if (usingManualLocation && manualLocation) {
    try {
      const weather = await fetchWeather(manualLocation.lat, manualLocation.lon);
      debug('Weather payload received (manual location)', weather);

      const viewModel = buildViewModel({
        weather,
        localization,
        language,
        unit,
        locationKey,
        fallbackLocationName: manualLocation.displayName || manualLocation.name || ''
      });

      debug('Constructed view model (manual location)', viewModel);
      await waitForMinimumHyperspace(loadingStartedAt);
      applyWeatherToUi(viewModel, localization);
      persistSuccessfulWeather(viewModel, localization);
      recordRenderOutcome(isNewTab, 'loaded', {
        planetId: viewModel.planetId,
        planet: viewModel.planetName,
        timeOfDay: viewModel.timeOfDay
      });
    } catch (error) {
      console.error('Unable to refresh weather data for manual location', error);
      await waitForMinimumHyperspace(loadingStartedAt);
      handleWeatherFailure(error, { ...failureContext, errorType: 'manual_fetch' });
    }

    return;
  }

  try {
    const position = await resolveLocation(localization);
    debug('Geolocation resolved', position);
    const weather = await fetchWeather(position.coords.latitude, position.coords.longitude);
    debug('Weather payload received', weather);

    let fallbackLocationName = '';
    try {
      const details = await fetchLocationDetails(position.coords.latitude, position.coords.longitude);
      if (details) {
        fallbackLocationName = formatDisplayName(details.name ?? '', details.state ?? '', details.country ?? '');
      }
    } catch (locationError) {
      debug('Reverse geocoding lookup failed', locationError);
    }

    const viewModel = buildViewModel({
      weather,
      localization,
      language,
      unit,
      locationKey: 'auto',
      fallbackLocationName
    });

    debug('Constructed view model', viewModel);
    await waitForMinimumHyperspace(loadingStartedAt);
    applyWeatherToUi(viewModel, localization);
    persistSuccessfulWeather(viewModel, localization);
    recordRenderOutcome(isNewTab, 'loaded', {
      planetId: viewModel.planetId,
      planet: viewModel.planetName,
      timeOfDay: viewModel.timeOfDay
    });
  } catch (error) {
    console.error('Unable to refresh weather data', error);
    await waitForMinimumHyperspace(loadingStartedAt);
    handleWeatherFailure(error, { ...failureContext, errorType: 'auto_fetch' });
  }
}

if (SHOULD_INIT) {
  refreshWeather();

  window.addEventListener('storage', (event) => {
    if (WATCHED_SETTINGS.has(event.key)) {
      debug('Settings changed via storage event', event.key);
      refreshWeather({ isNewTab: false });
    }
  });
}

function showLoadingState(localization, locationName = null) {
  const loadingElement = document.getElementById('loading');
  if (loadingElement) {
    loadingElement.innerText = '';
  }

  updateLocationLabel(localization, locationName);
  updateLastUpdated(localization.getMessage('last_updated_placeholder'));
}

function applyWeatherToUi(viewModel, localization) {
  if (!viewModel) {
    return;
  }

  currentViewModel = viewModel;
  currentLocalization = localization;

  const {
    planetClass,
    planetName,
    planetId,
    headingPrefix,
    headingSuffix,
    message,
    description,
    lastUpdated,
    lastUpdatedLabel = null,
    locationName,
    locationKey,
    language,
    unit,
    timeOfDay,
    timeOfDayLabel,
    matchReason = '',
    tempF,
    tempC
  } = viewModel;

  debug('Applying weather to UI', {
    planetClass,
    planetName,
    planetId,
    headingPrefix,
    headingSuffix,
    message,
    description,
    lastUpdated,
    locationName,
    locationKey,
    language,
    unit,
    timeOfDay,
    timeOfDayLabel,
    matchReason,
    tempF,
    tempC
  });

  hideElementById('test');

  updateBackground(planetClass);
  updatePlanetHeading({ name: planetName, prefix: headingPrefix, suffix: headingSuffix });
  updateMatchReason(matchReason, localization);
  updateMessage(message, viewModel, localization);
  updateDescription(description);
  updateLastUpdated(lastUpdatedLabel || formatLastUpdated(lastUpdated, localization));
  updateLocationLabel(localization, locationName);
  // Reads localStorage inside refreshWeather's try: an unreadable stamp list must not
  // repaint a rendered forecast as the offline fallback.
  try {
    updatePassportUi(localization);
  } catch (error) {
    console.warn('Unable to update the passport for this render', error);
  }
  clearLoadingText();
}

function hideElementById(id) {
  const element = document.getElementById(id);
  if (element) {
    element.style.display = 'none';
  }
}

function clearLoadingText() {
  const loadingElement = document.getElementById('loading');
  if (loadingElement) {
    loadingElement.innerText = '';
  }
}

/**
 * Terminal state for a service failure. Clears anything that could read as the
 * current sky (video, planet, leftover heading) so old data is not passed off as today's.
 */
function showErrorState(localization, locationName = null) {
  hideElementById('test');

  ['planet', 'center1Text', 'center3Text', 'description', 'loading'].forEach((id) => {
    const element = document.getElementById(id);
    if (element) {
      element.innerText = '';
    }
  });

  const messageElement = document.getElementById('message');
  if (messageElement) {
    messageElement.innerText = localization.getMessage('error_weather_unavailable') || 'Unable to retrieve weather data right now.';
  }

  // Nothing on screen is a reading any more, so a unit toggle must reload.
  currentViewModel = null;
  currentLocalization = localization;

  updateLocationLabel(localization, locationName);
  updateLastUpdated(localization.getMessage('last_updated_placeholder'));
}

async function resolveLocation(localization) {
  if (!('geolocation' in navigator)) {
    debug('Geolocation API unavailable');
    return Promise.reject(new Error('Geolocation API is not available.'));
  }

  const errorMessage = localization.getMessage('alert_geolocation_error') || 'Unable to retrieve your location. Please enable location services for this extension. Check the FAQ for more information.';

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, async (error) => {
      debug('Geolocation error', error);
      recordError({ errorType: 'geolocation', errorCode: String(error.code || 'unknown') });
      if (!hasShownGeolocationError() && !isOnboardingComplete()) {
        alert(errorMessage);
        markGeolocationAlerted();
      }

      try {
        const retryPosition = await requestGeolocation();
        debug('Geolocation retry succeeded', retryPosition);
        resolve(retryPosition);
      } catch (retryError) {
        debug('Geolocation retry failed', retryError);
        reject(retryError);
      }
    }, GEOLOCATION_OPTIONS);
  });
}

function requestGeolocation() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, GEOLOCATION_OPTIONS);
  });
}

async function fetchWeather(latitude, longitude) {
  const url = new URL(WEATHER_ENDPOINT);
  url.searchParams.set('lat', latitude);
  url.searchParams.set('lon', longitude);
  url.searchParams.set('appid', API_KEY);
  url.searchParams.set('units', 'imperial');

  recordWeatherCall();
  const response = await fetch(url.toString());
  if (!response.ok) {
    // Status must survive to the catch: it separates a service failure from lost connectivity.
    const error = new Error(`Weather request failed with status ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return response.json();
}

function buildViewModel({ weather, localization, language, unit, locationKey, fallbackLocationName }) {
  const now = new Date();
  const weatherMain = weather.weather?.[0]?.main ?? 'Clear';
  const weatherDescription = weather.weather?.[0]?.description ?? '';
  const tempF = Math.round(weather.main?.temp ?? 0);
  const tempC = Math.round((((tempF - 32) * 5) / 9) * 2) / 2;
  const humidity = weather.main?.humidity ?? 0;
  const windSpeedMph = weather.wind?.speed ?? 0;
  const sunTimes = extractSunTimes(weather);
  const timeOfDay = resolveTimeOfDay(now, localization, sunTimes);
  const locationName = resolveLocationName(weather, fallbackLocationName);

  const matchContext = {
    tempF,
    weatherMain,
    weatherDescription,
    humidity,
    windSpeedMph
  };

  const planetRule = selectPlanetRule(matchContext);
  const reasonKey = explainMatch(planetRule, matchContext);

  const planetKeyBase = `planet_${planetRule.id}`;
  const descriptionKey = `${planetKeyBase}_description`;
  const nameKey = `${planetKeyBase}_name`;

  const message = buildSummaryMessage({
    planetId: planetRule.id,
    tempF,
    tempC,
    unit,
    timeOfDayLabel: timeOfDay.label
  }, localization);
  const description = localization.getMessage(descriptionKey) || '';
  const planetDisplayName = localization.getMessage(nameKey) || planetRule.name;
  const matchReason = localization.getMessage(reasonKey) || '';

  return {
    planetId: planetRule.id,
    planetClass: selectBackground(planetRule, timeOfDay.id, timeOfDay.isDaytime),
    planetName: planetDisplayName,
    headingPrefix: localization.getMessage('center_heading_prefix') || "IT'S LIKE",
    headingSuffix: localization.getMessage('center_heading_suffix') || 'OUTSIDE',
    message,
    description,
    lastUpdated: now.toISOString(),
    lastUpdatedLabel: formatLastUpdated(now, localization),
    locationKey,
    locationName,
    language,
    unit,
    tempF,
    tempC,
    timeOfDay: timeOfDay.id,
    timeOfDayLabel: timeOfDay.label,
    sunrise: sunTimes?.sunrise ?? null,
    sunset: sunTimes?.sunset ?? null,
    timezoneOffset: sunTimes?.timezoneOffset ?? null,
    matchReason
  };
}

function formatTemperatureLabel(tempF, tempC, unit) {
  return unit === 'celsius'
    ? `${tempC}${DEGREE_SYMBOL}C`
    : `${tempF}${DEGREE_SYMBOL}F`;
}

function getOppositeUnit(unit) {
  return unit === 'celsius' ? 'fahrenheit' : 'celsius';
}

/**
 * Derives only from the persisted temperatures, so a stored view model can be
 * re-rendered in the current language and unit. Null for payloads written before that.
 */
function buildSummaryMessage({ planetId, tempF, tempC, unit, timeOfDayLabel }, localization) {
  if (typeof tempF !== 'number' || typeof tempC !== 'number') {
    return null;
  }

  const temperature = formatTemperatureLabel(tempF, tempC, unit);
  const summaryKey = `planet_${planetId || DEFAULT_PLANET_RULE.id}_summary`;
  return localization?.getMessage(summaryKey, [temperature, timeOfDayLabel || '']) || temperature;
}

function rebuildViewModelForUnit(viewModel, unit, localization) {
  if (!viewModel) {
    return null;
  }

  const message = buildSummaryMessage({
    planetId: viewModel.planetId,
    tempF: viewModel.tempF,
    tempC: viewModel.tempC,
    unit,
    timeOfDayLabel: viewModel.timeOfDayLabel
  }, localization);

  if (!message) {
    return null;
  }

  return {
    ...viewModel,
    unit,
    message
  };
}

async function handleTempToggle() {
  const currentUnit = getPreferredUnit();
  const nextUnit = getOppositeUnit(currentUnit);
  setPreferredUnit(nextUnit);
  clearWeatherCache();
  track('setting_changed', { setting: 'unit', value: nextUnit, surface: 'newtab' });

  if (currentViewModel && currentLocalization) {
    const rebuilt = rebuildViewModelForUnit(currentViewModel, nextUnit, currentLocalization);
    if (rebuilt) {
      applyWeatherToUi(rebuilt, currentLocalization);

      // Only a live reading may be re-cached. An offline fallback in the TTL cache
      // hands the next tab a cache hit on "Sensors offline" with no refresh attempt.
      if (!rebuilt.offline) {
        safeStorageWrite('weather cache', () => writeWeatherCache(rebuilt));
      }

      // Last-known moves either way, or the next offline load re-renders the temperature
      // in the old unit. Offline presentation is rebuilt per render, so it is dropped.
      const { offline, lastUpdatedLabel, ...lastKnown } = rebuilt;
      safeStorageWrite('last known weather', () => writeLastKnownWeather(lastKnown));
      return;
    }
  }

  await refreshWeather({ isNewTab: false });
}

function selectPlanetRule(context) {
  const matchedRule = PLANET_RULES.find((rule) => rule.predicate(context)) ?? DEFAULT_PLANET_RULE;

  if (DEBUG_FORCE_PLANET_ID) {
    const overrideRule = PLANET_RULES.find((rule) => rule.id === DEBUG_FORCE_PLANET_ID);
    if (overrideRule) {
      debug('Forcing planet override', DEBUG_FORCE_PLANET_ID);
      return overrideRule;
    }
  }

  return matchedRule;
}

/** Sunrise/sunset as unix UTC seconds, from an OWM payload or a persisted view model. */
function extractSunTimes(source) {
  if (!source || typeof source !== 'object') {
    return null;
  }

  const sunrise = Number(source.sys?.sunrise ?? source.sunrise);
  const sunset = Number(source.sys?.sunset ?? source.sunset);
  if (!Number.isFinite(sunrise) || !Number.isFinite(sunset) || sunset === sunrise) {
    return null;
  }

  const timezoneOffset = Number(source.timezone ?? source.timezoneOffset);
  return {
    sunrise,
    sunset,
    timezoneOffset: Number.isFinite(timezoneOffset) ? timezoneOffset : null
  };
}

function resolveTimezoneOffsetSeconds(date, timezoneOffset) {
  if (Number.isFinite(timezoneOffset)) {
    return timezoneOffset;
  }

  // Device offset is minutes west of UTC; callers want seconds east.
  return -date.getTimezoneOffset() * 60;
}

function secondsOfDay(unixSeconds, timezoneOffsetSeconds) {
  const localSeconds = unixSeconds + timezoneOffsetSeconds;
  return ((localSeconds % 86400) + 86400) % 86400;
}

/**
 * Seconds-of-day, so persisted sunrise/sunset stay usable offline on later days.
 * Null when sun times are unavailable; caller falls back to hour buckets.
 */
function resolveIsDaytime(date, sunTimes) {
  if (!sunTimes) {
    return null;
  }

  const tz = resolveTimezoneOffsetSeconds(date, sunTimes.timezoneOffset);
  const nowSod = secondsOfDay(Math.floor(date.getTime() / 1000), tz);
  const sunriseSod = secondsOfDay(sunTimes.sunrise, tz);
  const sunsetSod = secondsOfDay(sunTimes.sunset, tz);

  if (sunriseSod < sunsetSod) {
    return nowSod >= sunriseSod && nowSod < sunsetSod;
  }

  // Polar / wrap-around: day is anything outside the night window.
  return nowSod >= sunriseSod || nowSod < sunsetSod;
}

function localHourForSunTimes(date, sunTimes) {
  if (!sunTimes || !Number.isFinite(sunTimes.timezoneOffset)) {
    return date.getHours();
  }

  const localMs = date.getTime() + sunTimes.timezoneOffset * 1000;
  return new Date(localMs).getUTCHours();
}

function selectBackground(rule, timeOfDay, isDaytime = null) {
  const daytime = typeof isDaytime === 'boolean'
    ? isDaytime
    : (timeOfDay === 'morning' || timeOfDay === 'afternoon');
  return daytime
    ? (rule.backgrounds.day ?? rule.backgrounds.night)
    : (rule.backgrounds.night ?? rule.backgrounds.day);
}

function resolveTimeOfDayByHour(date, localization) {
  const hour = date.getHours();

  if (hour >= 5 && hour < 12) {
    return {
      id: 'morning',
      label: localization.getMessage('time_of_day_morning') || 'Morning',
      isDaytime: true
    };
  }

  if (hour >= 12 && hour < 17) {
    return {
      id: 'afternoon',
      label: localization.getMessage('time_of_day_afternoon') || 'Afternoon',
      isDaytime: true
    };
  }

  if (hour >= 17 && hour <= 20) {
    return {
      id: 'evening',
      label: localization.getMessage('time_of_day_evening') || 'Evening',
      isDaytime: false
    };
  }

  if (hour > 0 && hour < 5) {
    return {
      id: 'night',
      label: localization.getMessage('time_of_day_pre_dawn') || 'Late Night',
      isDaytime: false
    };
  }

  return {
    id: 'night',
    label: localization.getMessage('time_of_day_night') || 'Night',
    isDaytime: false
  };
}

/**
 * With sun times, day/night for the background art follows the sun and labels are
 * refined against it. Without them, falls back to hour buckets.
 */
function resolveTimeOfDay(date, localization, sunTimes = null) {
  const isDaytime = resolveIsDaytime(date, sunTimes);
  if (isDaytime === null) {
    return resolveTimeOfDayByHour(date, localization);
  }

  const hour = localHourForSunTimes(date, sunTimes);
  const tz = resolveTimezoneOffsetSeconds(date, sunTimes.timezoneOffset);
  const nowSod = secondsOfDay(Math.floor(date.getTime() / 1000), tz);
  const sunsetSod = secondsOfDay(sunTimes.sunset, tz);
  const secondsUntilSunset = (sunsetSod - nowSod + 86400) % 86400;
  const eveningWindowSec = 3 * 60 * 60;
  // On the 3h window alone, a December sunset makes lunchtime "Evening": Boston sets
  // at 16:15, Stockholm at 14:48, leaving "Afternoon" unreachable for months.
  const eveningEarliestHour = 15;
  // But Stockholm sets before 15:00 for ~2 months, so the clock floor alone would kill
  // "Evening" there. The last stretch of daylight is evening whatever the hour.
  const eveningSunsetFloorSec = 45 * 60;

  if (!isDaytime) {
    if (hour > 0 && hour < 5) {
      return {
        id: 'night',
        label: localization.getMessage('time_of_day_pre_dawn') || 'Late Night',
        isDaytime: false
      };
    }

    return {
      id: 'night',
      label: localization.getMessage('time_of_day_night') || 'Night',
      isDaytime: false
    };
  }

  // hour >= 17 catches long summer days where sunset is still hours away
  if (
    secondsUntilSunset <= eveningSunsetFloorSec
    || (secondsUntilSunset <= eveningWindowSec && hour >= eveningEarliestHour)
    || hour >= 17
  ) {
    return {
      id: 'evening',
      label: localization.getMessage('time_of_day_evening') || 'Evening',
      isDaytime: true
    };
  }

  if (hour >= 12) {
    return {
      id: 'afternoon',
      label: localization.getMessage('time_of_day_afternoon') || 'Afternoon',
      isDaytime: true
    };
  }

  return {
    id: 'morning',
    label: localization.getMessage('time_of_day_morning') || 'Morning',
    isDaytime: true
  };
}

function updateBackground(planetClass) {
  const element = document.getElementById('background');
  if (element && planetClass) {
    element.className = planetClass;
  }
}

function updatePlanetHeading({ name, prefix, suffix }) {
  const planetElement = document.getElementById('planet');
  const center1Element = document.getElementById('center1Text');
  const center3Element = document.getElementById('center3Text');

  if (planetElement && name) {
    planetElement.innerText = name.toUpperCase();
  }

  if (center1Element) {
    center1Element.innerText = prefix || "IT'S LIKE";
  }

  if (center3Element) {
    center3Element.innerText = suffix || 'OUTSIDE';
  }
}

function updateMatchReason(_matchReason, _localization) {
  // Match reason stays in the view model for tests/analytics; it is not shown in the UI.
}

function updateMessage(message, viewModel = null, localization = null) {
  const element = document.getElementById('message');
  if (!element || typeof message !== 'string') {
    return;
  }

  const tempF = viewModel?.tempF;
  const tempC = viewModel?.tempC;
  const unit = viewModel?.unit ?? getPreferredUnit();
  const canWrap = typeof tempF === 'number' && typeof tempC === 'number';
  const temperature = canWrap ? formatTemperatureLabel(tempF, tempC, unit) : null;

  if (!temperature || !message.includes(temperature)) {
    element.innerText = message;
    return;
  }

  const hint = localization?.getMessage('temp_toggle_hint') || 'Click to switch units';
  const buttonHtml = `<button type="button" class="temp-toggle" title="${hint}" aria-label="${hint}">${temperature}</button>`;
  element.innerHTML = message.replace(temperature, buttonHtml);

  const toggle = element.querySelector('.temp-toggle');
  if (toggle) {
    toggle.addEventListener('click', (event) => {
      event.preventDefault();
      handleTempToggle();
    });
  }
}

function updateDescription(description) {
  const element = document.getElementById('description');
  if (element && typeof description === 'string') {
    element.innerText = description;
  }
}

function updateLastUpdated(label) {
  const lastUpdatedElement = document.getElementById('LastUpdated');
  if (!lastUpdatedElement) {
    return;
  }

  lastUpdatedElement.innerText = label ?? '';
}

function updateLocationLabel(localization, locationName) {
  const element = document.getElementById('locationLabel');
  if (!element) {
    return;
  }

  if (locationName) {
    element.innerText = localization.getMessage('location_display', [locationName]) || `Showing weather in: ${locationName}`;
    return;
  }

  element.innerText = localization.getMessage('location_display_unknown') || 'Showing weather in: your area';
}

function formatLastUpdated(timestamp, localization) {
  const placeholder = localization.getMessage('last_updated_placeholder') || 'Last Updated: --';

  if (!timestamp) {
    return placeholder;
  }

  const parsed = new Date(timestamp);
  if (!Number.isFinite(parsed.getTime())) {
    return placeholder;
  }

  const locale = localization.language || 'en';
  const now = new Date();
  const sameDay = now.toDateString() === parsed.toDateString();

  const timeFormatter = new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit'
  });

  const time = timeFormatter.format(parsed);

  if (sameDay) {
    return localization.getMessage('last_updated_time', [time]) || placeholder;
  }

  const dateFormatter = new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric'
  });

  const date = dateFormatter.format(parsed);
  return localization.getMessage('last_updated_date_time', [date, time]) || placeholder;
}

function resolveLocationName(weather, fallbackLocationName) {
  if (fallbackLocationName && fallbackLocationName.trim()) {
    return fallbackLocationName.trim();
  }

  const name = weather?.name ? weather.name.trim() : '';
  const country = weather?.sys?.country ? weather.sys.country.trim() : '';
  const state = weather?.sys?.state ? weather.sys.state.trim() : '';

  return formatDisplayName(name, state, country);
}

function formatDisplayName(name, state, country) {
  const cleanedName = (name ?? '').trim();
  const cleanedState = (state ?? '').trim();
  const cleanedCountry = (country ?? '').trim();

  if (!cleanedName) {
    return '';
  }

  const parts = [cleanedName];
  if (cleanedCountry && cleanedCountry.toUpperCase() === 'US') {
    const abbr = stateToAbbreviation(cleanedState);
    if (abbr) {
      parts.push(abbr);
    }
    return parts.join(', ');
  }

  if (cleanedState && cleanedState.toLowerCase() !== cleanedName.toLowerCase()) {
    parts.push(cleanedState);
  }

  if (cleanedCountry) {
    parts.push(cleanedCountry);
  }

  return parts.join(', ');
}

/**
 * Place names do not change, so the long-lived cache halves the API calls on a cold
 * auto-location load.
 */
async function fetchLocationDetails(latitude, longitude) {
  const cached = readGeocodeCache(latitude, longitude);
  if (cached) {
    debug('Reverse geocoding served from cache', cached.details);
    return cached.details;
  }

  if (typeof API_KEY === 'undefined') {
    throw new Error('API key is not available');
  }

  const url = new URL(GEOCODING_REVERSE_ENDPOINT);
  url.searchParams.set('lat', latitude);
  url.searchParams.set('lon', longitude);
  url.searchParams.set('limit', '1');
  url.searchParams.set('appid', API_KEY);

  recordGeocodeCall();
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Reverse geocoding failed with status ${response.status}`);
  }

  const data = await response.json();
  const details = Array.isArray(data) && data.length > 0 ? data[0] : null;

  // Empty lookups are cached too (shorter TTL) so a nameless coordinate stops re-requesting.
  writeGeocodeCache(latitude, longitude, details);

  return details;
}

export {
  applyOfflineFallback,
  applyWeatherToUi,
  buildManualLocationKey,
  buildOfflineRandomViewModel,
  buildViewModel,
  explainMatch,
  extractSunTimes,
  fetchLocationDetails,
  fetchWeather,
  formatDisplayName,
  formatLastUpdated,
  formatTemperatureLabel,
  getOppositeUnit,
  handleTempToggle,
  isNavigatorOffline,
  persistSuccessfulWeather,
  rebuildViewModelForUnit,
  refreshWeather,
  rehydrateLastKnownViewModel,
  requestGeolocation,
  resolveIsDaytime,
  resolveLocation,
  resolveLocationName,
  resolveTimeOfDay,
  selectBackground,
  selectPlanetRule,
  showErrorState,
  showLoadingState,
  stateToAbbreviation,
  updateLocationLabel,
  updateMatchReason,
  updateMessage,
  waitForMinimumHyperspace
};
