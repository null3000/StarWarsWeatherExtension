import { getPreferredLanguage, getVisitedPlanets, STORAGE_KEYS } from './storage.js';
import { invalidateLocalizationCache, loadLocalization } from './i18n.js';
import { track } from './telemetry.js';
import {
  cyclePlanetIndex,
  getOptionsPageUrl,
  getPlanetBackgroundClass,
  getTourPlanet,
  isPlanetVisited,
  PLANET_RULES
} from './tour.js';

let currentLocalization = null;
let tourPlanetIndex = 0;
let tourTimeOfDay = 'day';
let tourTrackedOpen = false;
let languageStorageAttached = false;
let tourSessionReported = false;
const tourPlanetsViewed = new Set();

const SHOULD_INIT = !(typeof globalThis !== 'undefined' && globalThis.__SWW_SKIP_INIT__ === true);

if (SHOULD_INIT && typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
}

async function initialize() {
  attachTourControls();
  attachKeyboardNavigation();
  attachCloseHandler();
  attachLanguageStorageListener();
  await refreshLocalization(getPreferredLanguage());

  if (!tourTrackedOpen) {
    track('tour_opened');
    tourTrackedOpen = true;
    // pagehide is best effort, but the SDK persists its queue, so a summary lost
    // at close is recovered on the next page load
    window.addEventListener('pagehide', reportTourSession);
  }

  renderTourPlanet({ trackView: true });
}

async function refreshLocalization(language) {
  currentLocalization = await loadLocalization(language);
  applyTranslations(currentLocalization);
  renderTourPlanet();
}

function documentLangForLanguage(language) {
  if (language === 'zh') {
    return 'zh-TW';
  }
  return language || 'en';
}

function applyTranslations(localization) {
  if (!localization) {
    return;
  }

  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.lang = documentLangForLanguage(localization.language);
  }

  document.querySelectorAll('[data-i18n]').forEach((element) => {
    const key = element.getAttribute('data-i18n');
    if (!key) {
      return;
    }

    element.textContent = localization.getMessage(key) || '';
  });

  document.querySelectorAll('[data-i18n-aria-label]').forEach((element) => {
    const key = element.getAttribute('data-i18n-aria-label');
    if (!key) {
      return;
    }

    const message = localization.getMessage(key) || '';
    if (message) {
      element.setAttribute('aria-label', message);
    }
  });

  const title = localization.getMessage('popup_tour_title');
  if (title) {
    document.title = title;
  }
}

function attachLanguageStorageListener() {
  if (languageStorageAttached || typeof window === 'undefined') {
    return;
  }

  languageStorageAttached = true;
  window.addEventListener('storage', async (event) => {
    if (event.key !== STORAGE_KEYS.language) {
      return;
    }

    const language = getPreferredLanguage();
    invalidateLocalizationCache(language);
    await refreshLocalization(language);
  });
}

function attachTourControls() {
  const prevButton = document.getElementById('tourPrev');
  const nextButton = document.getElementById('tourNext');
  const dayButton = document.getElementById('tourDay');
  const nightButton = document.getElementById('tourNight');

  if (prevButton) {
    prevButton.addEventListener('click', () => {
      tourPlanetIndex = cyclePlanetIndex(tourPlanetIndex, -1, PLANET_RULES.length);
      renderTourPlanet({ trackView: true });
    });
  }

  if (nextButton) {
    nextButton.addEventListener('click', () => {
      tourPlanetIndex = cyclePlanetIndex(tourPlanetIndex, 1, PLANET_RULES.length);
      renderTourPlanet({ trackView: true });
    });
  }

  if (dayButton) {
    dayButton.addEventListener('click', () => {
      setTourTimeOfDay('day');
    });
  }

  if (nightButton) {
    nightButton.addEventListener('click', () => {
      setTourTimeOfDay('night');
    });
  }

  syncTimeOfDayButtons();
}

// Browser owns these: Cmd/Ctrl+D bookmarks, Ctrl+N opens a window, Alt+← is Back.
function hasCommandModifier(event) {
  return Boolean(event.ctrlKey || event.metaKey || event.altKey);
}

function isArrowLeft(event) {
  // Shift+Arrow is a text-selection gesture
  if (hasCommandModifier(event) || event.shiftKey) {
    return false;
  }

  return event.key === 'ArrowLeft' || event.code === 'ArrowLeft';
}

function isArrowRight(event) {
  if (hasCommandModifier(event) || event.shiftKey) {
    return false;
  }

  return event.key === 'ArrowRight' || event.code === 'ArrowRight';
}

// Shift is fine here: Shift+D (and Caps Lock) still reads as "d"
function isDayKey(event) {
  if (hasCommandModifier(event)) {
    return false;
  }

  return event.key === 'd' || event.key === 'D' || event.code === 'KeyD';
}

function isNightKey(event) {
  if (hasCommandModifier(event)) {
    return false;
  }

  return event.key === 'n' || event.key === 'N' || event.code === 'KeyN';
}

function attachKeyboardNavigation() {
  // Capture phase so planet navigation wins before focused controls (e.g. radios).
  document.addEventListener(
    'keydown',
    (event) => {
      if (isArrowLeft(event)) {
        event.preventDefault();
        tourPlanetIndex = cyclePlanetIndex(tourPlanetIndex, -1, PLANET_RULES.length);
        renderTourPlanet({ trackView: true });
        return;
      }

      if (isArrowRight(event)) {
        event.preventDefault();
        tourPlanetIndex = cyclePlanetIndex(tourPlanetIndex, 1, PLANET_RULES.length);
        renderTourPlanet({ trackView: true });
        return;
      }

      if (isDayKey(event)) {
        setTourTimeOfDay('day');
        return;
      }

      if (isNightKey(event)) {
        setTourTimeOfDay('night');
      }
    },
    true
  );
}

function syncTimeOfDayButtons() {
  const dayButton = document.getElementById('tourDay');
  const nightButton = document.getElementById('tourNight');

  if (dayButton) {
    dayButton.setAttribute('aria-pressed', tourTimeOfDay === 'day' ? 'true' : 'false');
  }

  if (nightButton) {
    nightButton.setAttribute('aria-pressed', tourTimeOfDay === 'night' ? 'true' : 'false');
  }
}

function setTourTimeOfDay(timeOfDay) {
  const next = timeOfDay === 'night' ? 'night' : 'day';
  if (tourTimeOfDay === next) {
    return;
  }

  tourTimeOfDay = next;
  syncTimeOfDayButtons();
  renderTourPlanet({ trackView: true });
}

function attachCloseHandler() {
  const closeLink = document.getElementById('tourClose');
  if (!closeLink) {
    return;
  }

  closeLink.addEventListener('click', (event) => {
    event.preventDefault();
    reportTourSession();
    closeTourPage();
  });
}

function reportTourSession() {
  if (tourSessionReported || !tourPlanetsViewed.size) {
    return;
  }

  tourSessionReported = true;
  track('tour_viewed', {
    planetsViewed: tourPlanetsViewed.size,
    totalPlanets: PLANET_RULES.length,
    timeOfDay: tourTimeOfDay
  });
}

function closeTourPage() {
  window.close();

  // Popup-spawned tabs often cannot close themselves; fall back to options.
  window.setTimeout(() => {
    if (!window.closed) {
      window.location.href = getOptionsPageUrl();
    }
  }, 150);
}

function renderTourPlanet({ trackView = false } = {}) {
  const planet = getTourPlanet(tourPlanetIndex);
  if (!planet) {
    return;
  }

  const stage = document.getElementById('tourStage');
  const nameElement = document.getElementById('tourPlanetName');
  const descriptionElement = document.getElementById('tourPlanetDescription');
  const stampElement = document.getElementById('tourVisitedStamp');
  const counterElement = document.getElementById('tourCounter');
  const backgroundClass = getPlanetBackgroundClass(planet, tourTimeOfDay);

  if (stage) {
    stage.className = backgroundClass ? `tour-stage ${backgroundClass}` : 'tour-stage';
    stage.dataset.planet = planet.id;
    stage.dataset.timeOfDay = tourTimeOfDay;
  }

  const localization = currentLocalization;
  const name = localization?.getMessage(`planet_${planet.id}_name`) || planet.name;
  const description = localization?.getMessage(`planet_${planet.id}_description`) || '';

  if (nameElement) {
    nameElement.textContent = name;
  }

  if (descriptionElement) {
    descriptionElement.textContent = description;
  }

  if (counterElement) {
    counterElement.textContent = `${tourPlanetIndex + 1} / ${PLANET_RULES.length}`;
  }

  if (stampElement) {
    const visited = isPlanetVisited(planet.id, getVisitedPlanets());
    if (visited) {
      stampElement.hidden = false;
      stampElement.textContent =
        localization?.getMessage('passport_stamp_visited', [name]) || `${name} visited`;
    } else {
      stampElement.hidden = true;
      stampElement.textContent = '';
    }
  }

  if (trackView) {
    tourPlanetsViewed.add(planet.id);
  }
}

function resetTourPageStateForTests() {
  currentLocalization = null;
  tourPlanetIndex = 0;
  tourTimeOfDay = 'day';
  tourTrackedOpen = false;
  languageStorageAttached = false;
  tourSessionReported = false;
  tourPlanetsViewed.clear();
}

export {
  applyTranslations,
  attachCloseHandler,
  attachKeyboardNavigation,
  attachLanguageStorageListener,
  attachTourControls,
  closeTourPage,
  documentLangForLanguage,
  initialize,
  refreshLocalization,
  renderTourPlanet,
  resetTourPageStateForTests,
  setTourTimeOfDay
};
