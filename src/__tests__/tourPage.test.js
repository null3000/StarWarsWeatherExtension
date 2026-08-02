import { afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import {
  createFetchMock,
  createSpy,
  installDom,
  installNavigator,
  installStorageMock,
  teardownDom
} from './testUtils.js';
import { invalidateLocalizationCache } from '../i18n.js';
import { markPlanetVisited, setPreferredLanguage, STORAGE_KEYS } from '../storage.js';

globalThis.__SWW_SKIP_INIT__ = true;

let tourPage = null;

const realFetch = globalThis.fetch;
const realBrowser = globalThis.browser;
const realChrome = globalThis.chrome;
const realNavigator = globalThis.navigator;

beforeAll(async () => {
  tourPage = await import('../tourPage.js');
});

beforeEach(() => {
  invalidateLocalizationCache();
  installStorageMock();
  tourPage.resetTourPageStateForTests();
  installDom(`
    <div id="tourStage" class="tour-stage"></div>
    <p id="tourVisitedStamp" hidden></p>
    <p id="tourCounter"></p>
    <h1 id="tourPlanetName"></h1>
    <p id="tourPlanetDescription"></p>
    <button id="tourPrev" type="button" data-i18n="popup_tour_prev">Prev</button>
    <button id="tourNext" type="button" data-i18n="popup_tour_next">Next</button>
    <div class="tour-time" role="group" data-i18n-aria-label="tour_time_of_day_label" aria-label="Time of day">
      <button id="tourDay" type="button" data-tour-time="day" aria-pressed="true">
        <span data-i18n="popup_tour_day">Day</span>
      </button>
      <button id="tourNight" type="button" data-tour-time="night" aria-pressed="false">
        <span data-i18n="popup_tour_night">Night</span>
      </button>
    </div>
    <button id="tourClose" type="button" data-i18n-aria-label="tour_back" aria-label="Back">Back</button>
    <span data-i18n="popup_tour_title">Tour the Galaxy</span>
    <p data-i18n="tour_keyboard_hint">Use ← → to change worlds</p>
  `);
  document.documentElement.lang = 'en';
  installNavigator(globalThis.window, { language: 'en-US' });
  globalThis.browser = {
    runtime: {
      getURL: (path) => `chrome-extension://test/${path}`
    }
  };
  delete globalThis.chrome;
});

afterEach(() => {
  teardownDom();
  invalidateLocalizationCache();
  delete globalThis.localStorage;
  if (realFetch) {
    globalThis.fetch = realFetch;
  } else {
    delete globalThis.fetch;
  }
  if (realBrowser) {
    globalThis.browser = realBrowser;
  } else {
    delete globalThis.browser;
  }
  if (realChrome) {
    globalThis.chrome = realChrome;
  } else {
    delete globalThis.chrome;
  }
  if (realNavigator) {
    globalThis.navigator = realNavigator;
  } else {
    delete globalThis.navigator;
  }
});

describe('tour page', () => {
  test('cycles planets, toggles night art, and shows visited stamp', async () => {
    markPlanetVisited('kamino');
    globalThis.fetch = createFetchMock([
      {
        json: {
          popup_tour_title: { message: 'Tour the Galaxy' },
          planet_hoth_name: { message: 'Hoth' },
          planet_hoth_description: { message: 'Ice world' },
          planet_kamino_name: { message: 'Kamino' },
          planet_kamino_description: { message: 'Ocean world' },
          passport_stamp_visited: { message: '$1 visited' }
        }
      }
    ]);

    await tourPage.refreshLocalization('en');
    tourPage.attachTourControls();
    tourPage.renderTourPlanet();

    expect(document.getElementById('tourPlanetName').textContent).toBe('Hoth');
    expect(document.getElementById('tourStage').className).toContain('hoth');
    expect(document.getElementById('tourVisitedStamp').hidden).toBe(true);

    document.getElementById('tourNext').dispatchEvent(new Event('click'));
    expect(document.getElementById('tourPlanetName').textContent).toBe('Kamino');
    expect(document.getElementById('tourStage').className).toContain('kamino');
    expect(document.getElementById('tourVisitedStamp').hidden).toBe(false);
    expect(document.getElementById('tourVisitedStamp').textContent).toBe('Kamino visited');

    document.getElementById('tourNight').dispatchEvent(new Event('click'));
    expect(document.getElementById('tourStage').className).toContain('kaminoNight');
    expect(document.getElementById('tourNight').getAttribute('aria-pressed')).toBe('true');
    expect(document.getElementById('tourDay').getAttribute('aria-pressed')).toBe('false');
  });

  test('arrow left and right keys cycle planets via key and code', async () => {
    globalThis.fetch = createFetchMock([
      {
        json: {
          popup_tour_title: { message: 'Tour the Galaxy' },
          planet_hoth_name: { message: 'Hoth' },
          planet_hoth_description: { message: 'Ice world' },
          planet_kamino_name: { message: 'Kamino' },
          planet_kamino_description: { message: 'Ocean world' },
          planet_mustafar_name: { message: 'Mustafar' },
          planet_mustafar_description: { message: 'Lava world' }
        }
      }
    ]);

    await tourPage.refreshLocalization('en');
    tourPage.attachKeyboardNavigation();
    tourPage.renderTourPlanet();

    expect(document.getElementById('tourPlanetName').textContent).toBe('Hoth');

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', code: 'ArrowRight', bubbles: true })
    );
    expect(document.getElementById('tourPlanetName').textContent).toBe('Kamino');

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', code: 'ArrowLeft', bubbles: true })
    );
    expect(document.getElementById('tourPlanetName').textContent).toBe('Hoth');

    // code-only path (some environments omit or normalize key differently)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '', code: 'ArrowRight', bubbles: true }));
    expect(document.getElementById('tourPlanetName').textContent).toBe('Kamino');

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', code: 'ArrowLeft', bubbles: true })
    );
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', code: 'ArrowLeft', bubbles: true })
    );
    expect(document.getElementById('tourPlanetName').textContent).toBe('Mustafar');
  });

  test('refreshLocalization updates chrome strings and planet copy for Spanish', async () => {
    globalThis.fetch = createFetchMock([
      {
        json: {
          popup_tour_title: { message: 'Recorrido por la galaxia' },
          popup_tour_prev: { message: 'Anterior' },
          popup_tour_next: { message: 'Siguiente' },
          tour_back: { message: 'Atrás' },
          tour_keyboard_hint: { message: 'Usa ← → para cambiar de mundo' },
          tour_time_of_day_label: { message: 'Hora del día' },
          planet_hoth_name: { message: 'Hoth' },
          planet_hoth_description: {
            message:
              'Un mundo de nieve y hielo, rodeado de numerosas lunas y hogar de criaturas mortales como la wampa.'
          }
        }
      }
    ]);

    await tourPage.refreshLocalization('es');

    expect(document.documentElement.lang).toBe('es');
    expect(document.title).toBe('Recorrido por la galaxia');
    expect(document.querySelector('[data-i18n="popup_tour_title"]').textContent).toBe(
      'Recorrido por la galaxia'
    );
    expect(document.getElementById('tourPrev').textContent).toBe('Anterior');
    expect(document.getElementById('tourNext').textContent).toBe('Siguiente');
    expect(document.getElementById('tourClose').getAttribute('aria-label')).toBe('Atrás');
    expect(document.querySelector('[data-i18n="tour_keyboard_hint"]').textContent).toBe(
      'Usa ← → para cambiar de mundo'
    );
    expect(document.querySelector('[data-i18n-aria-label="tour_time_of_day_label"]').getAttribute('aria-label')).toBe(
      'Hora del día'
    );
    expect(document.getElementById('tourPlanetName').textContent).toBe('Hoth');
    expect(document.getElementById('tourPlanetDescription').textContent).toContain(
      'mundo de nieve y hielo'
    );
  });

  test('refreshLocalization sets zh-TW document lang and Chinese planet copy', async () => {
    globalThis.fetch = createFetchMock([
      {
        json: {
          popup_tour_title: { message: '銀河巡遊' },
          popup_tour_prev: { message: '上一顆' },
          popup_tour_next: { message: '下一顆' },
          tour_back: { message: '返回' },
          tour_keyboard_hint: { message: '使用 ← → 切換星球' },
          tour_time_of_day_label: { message: '時段' },
          planet_hoth_name: { message: '霍斯' },
          planet_hoth_description: {
            message: '冰雪覆蓋的世界，被眾多衛星環繞，也是丸帕獸等致命生物的家園。'
          }
        }
      }
    ]);

    await tourPage.refreshLocalization('zh');

    expect(document.documentElement.lang).toBe('zh-TW');
    expect(tourPage.documentLangForLanguage('zh')).toBe('zh-TW');
    expect(document.getElementById('tourPlanetName').textContent).toBe('霍斯');
    expect(document.getElementById('tourPlanetDescription').textContent).toContain('冰雪覆蓋');
    expect(document.getElementById('tourClose').getAttribute('aria-label')).toBe('返回');
    expect(document.querySelector('[data-i18n-aria-label="tour_time_of_day_label"]').getAttribute('aria-label')).toBe(
      '時段'
    );
  });

  test('storage language change invalidates cache and refreshes localization', async () => {
    globalThis.fetch = createFetchMock([
      {
        json: {
          popup_tour_title: { message: 'Tour the Galaxy' },
          popup_tour_prev: { message: 'Prev' },
          popup_tour_next: { message: 'Next' },
          tour_back: { message: 'Back' },
          tour_keyboard_hint: { message: 'Use ← → to change worlds' },
          tour_time_of_day_label: { message: 'Time of day' },
          planet_hoth_name: { message: 'Hoth' },
          planet_hoth_description: { message: 'Ice world' }
        }
      },
      {
        json: {
          popup_tour_title: { message: 'Recorrido por la galaxia' },
          popup_tour_prev: { message: 'Anterior' },
          popup_tour_next: { message: 'Siguiente' },
          tour_back: { message: 'Atrás' },
          tour_keyboard_hint: { message: 'Usa ← → para cambiar de mundo' },
          tour_time_of_day_label: { message: 'Hora del día' },
          planet_hoth_name: { message: 'Hoth' },
          planet_hoth_description: {
            message: 'Un mundo de nieve y hielo.'
          }
        }
      }
    ]);

    await tourPage.refreshLocalization('en');
    expect(document.getElementById('tourPrev').textContent).toBe('Prev');

    tourPage.attachLanguageStorageListener();
    setPreferredLanguage('es');

    const storageEvent = new Event('storage');
    Object.defineProperty(storageEvent, 'key', { value: STORAGE_KEYS.language });
    window.dispatchEvent(storageEvent);

    // let the async storage handler finish
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.documentElement.lang).toBe('es');
    expect(document.getElementById('tourPrev').textContent).toBe('Anterior');
    expect(document.getElementById('tourPlanetDescription').textContent).toContain(
      'mundo de nieve y hielo'
    );
    expect(document.querySelector('[data-i18n-aria-label="tour_time_of_day_label"]').getAttribute('aria-label')).toBe(
      'Hora del día'
    );
    expect(document.getElementById('tourClose').getAttribute('aria-label')).toBe('Atrás');
  });

  test('closeTourPage attempts to close the tab', () => {
    const closeSpy = createSpy(() => {});
    globalThis.window.close = closeSpy;

    tourPage.closeTourPage();
    expect(closeSpy.calls.length).toBe(1);
  });
});
