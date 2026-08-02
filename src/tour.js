import { PLANET_RULES } from './planets.js';

const TOUR_PAGE_PATH = 'public/tour.html';
const OPTIONS_PAGE_PATH = 'public/options.html';

function getRuntime() {
  if (typeof browser !== 'undefined' && browser.runtime) {
    return browser.runtime;
  }

  if (typeof chrome !== 'undefined' && chrome.runtime) {
    return chrome.runtime;
  }

  return null;
}

function cyclePlanetIndex(index, delta, length = PLANET_RULES.length) {
  if (!Number.isFinite(length) || length <= 0) {
    return 0;
  }

  const current = Number.isFinite(index) ? index : 0;
  const step = Number.isFinite(delta) ? delta : 0;
  return ((current + step) % length + length) % length;
}

function getPlanetBackgroundClass(planet, timeOfDay) {
  if (!planet?.backgrounds) {
    return '';
  }

  const isDay = timeOfDay !== 'night';
  return isDay
    ? (planet.backgrounds.day ?? planet.backgrounds.night ?? '')
    : (planet.backgrounds.night ?? planet.backgrounds.day ?? '');
}

function getTourPlanet(index) {
  const safeIndex = cyclePlanetIndex(index, 0, PLANET_RULES.length);
  return PLANET_RULES[safeIndex] ?? null;
}

function getTourPageUrl() {
  const runtime = getRuntime();
  if (!runtime?.getURL) {
    return `/${TOUR_PAGE_PATH}`;
  }

  return runtime.getURL(TOUR_PAGE_PATH);
}

function getOptionsPageUrl() {
  const runtime = getRuntime();
  if (!runtime?.getURL) {
    return `/${OPTIONS_PAGE_PATH}`;
  }

  return runtime.getURL(OPTIONS_PAGE_PATH);
}

function isPlanetVisited(planetId, visitedPlanets) {
  if (!planetId || typeof planetId !== 'string') {
    return false;
  }

  return Array.isArray(visitedPlanets) && visitedPlanets.includes(planetId);
}

function openTourPage() {
  const url = getTourPageUrl();

  if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
    chrome.tabs.create({ url });
    return url;
  }

  if (typeof browser !== 'undefined' && browser.tabs?.create) {
    browser.tabs.create({ url });
    return url;
  }

  if (typeof window !== 'undefined' && typeof window.open === 'function') {
    window.open(url, '_blank');
  }

  return url;
}

function openSettingsPage() {
  const url = getOptionsPageUrl();

  // Full tab instead of the cramped options popup
  if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
    chrome.tabs.create({ url });
    return url;
  }

  if (typeof browser !== 'undefined' && browser.tabs?.create) {
    browser.tabs.create({ url });
    return url;
  }

  if (typeof window !== 'undefined') {
    if (typeof window.open === 'function') {
      window.open(url, '_blank');
    } else {
      window.location.href = url;
    }
  }

  return url;
}

export {
  TOUR_PAGE_PATH,
  OPTIONS_PAGE_PATH,
  cyclePlanetIndex,
  getPlanetBackgroundClass,
  getTourPlanet,
  getTourPageUrl,
  getOptionsPageUrl,
  isPlanetVisited,
  openSettingsPage,
  openTourPage,
  PLANET_RULES
};
