import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
  applyGoogleAppsVisibility,
  GOOGLE_APPS,
  initGoogleApps
} from '../googleApps.js';
import {
  createLocalizationMock,
  installDom,
  installStorageMock,
  teardownDom
} from './testUtils.js';

const LAUNCHER_HTML = `
  <div id="googleAppsLauncher" class="google-apps-launcher">
    <button type="button" id="googleAppsButton" class="google-apps-button" aria-haspopup="true" aria-expanded="false" aria-controls="googleAppsPanel"></button>
    <div id="googleAppsPanel" class="google-apps-panel hidden" role="menu"></div>
  </div>
`;

beforeEach(() => {
  installStorageMock();
  installDom(LAUNCHER_HTML);
});

afterEach(() => {
  teardownDom();
  delete globalThis.localStorage;
});

describe('applyGoogleAppsVisibility', () => {
  test('hides launcher when show is false', () => {
    const launcher = document.getElementById('googleAppsLauncher');
    applyGoogleAppsVisibility(launcher, false);
    expect(launcher.classList.contains('hidden')).toBe(true);
  });

  test('shows launcher when show is true', () => {
    const launcher = document.getElementById('googleAppsLauncher');
    launcher.classList.add('hidden');
    applyGoogleAppsVisibility(launcher, true);
    expect(launcher.classList.contains('hidden')).toBe(false);
  });

  test('closes open panel when hiding launcher', () => {
    const launcher = document.getElementById('googleAppsLauncher');
    const panel = document.getElementById('googleAppsPanel');
    const button = document.getElementById('googleAppsButton');
    panel.classList.remove('hidden');
    button.setAttribute('aria-expanded', 'true');

    applyGoogleAppsVisibility(launcher, false);

    expect(panel.classList.contains('hidden')).toBe(true);
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  test('handles null launcher gracefully', () => {
    expect(() => applyGoogleAppsVisibility(null, true)).not.toThrow();
  });
});

describe('initGoogleApps', () => {
  test('renders app links with target and rel', () => {
    const launcher = document.getElementById('googleAppsLauncher');
    const localization = createLocalizationMock({
      google_apps_button_label: { message: 'Google apps' }
    });

    const controller = initGoogleApps({ launcher, localization });
    const links = document.querySelectorAll('#googleAppsPanel a.google-apps-item');

    expect(links.length).toBe(GOOGLE_APPS.length);
    expect(links[0].target).toBe('_blank');
    expect(links[0].rel).toBe('noopener noreferrer');
    expect(document.getElementById('googleAppsButton').getAttribute('aria-label')).toBe('Google apps');

    controller.destroy();
  });

  test('uses local icon paths instead of favicon service', () => {
    const launcher = document.getElementById('googleAppsLauncher');
    const controller = initGoogleApps({ launcher });
    const images = document.querySelectorAll('#googleAppsPanel img');

    expect(images.length).toBe(GOOGLE_APPS.length);
    for (const [index, app] of GOOGLE_APPS.entries()) {
      expect(app.icon).toMatch(/^\/public\/assets\/google\/.+\.png$/);
      expect(images[index].src).toContain(app.icon);
      expect(images[index].src).not.toContain('google.com/s2/favicons');
    }

    const sheets = GOOGLE_APPS.find((app) => app.name === 'Sheets');
    expect(sheets.url).toBe('https://docs.google.com/spreadsheets/');

    controller.destroy();
  });

  test('falls back to letter initial when icon fails to load', () => {
    const launcher = document.getElementById('googleAppsLauncher');
    const controller = initGoogleApps({ launcher });
    const firstIcon = document.querySelector('#googleAppsPanel .google-apps-icon');
    const img = firstIcon.querySelector('img');

    img.dispatchEvent(new Event('error'));

    expect(firstIcon.querySelector('img')).toBe(null);
    expect(firstIcon.querySelector('.google-apps-initial')?.textContent).toBe('G');

    controller.destroy();
  });

  test('toggles panel on button click and closes on Escape', () => {
    const launcher = document.getElementById('googleAppsLauncher');
    const button = document.getElementById('googleAppsButton');
    const panel = document.getElementById('googleAppsPanel');
    const controller = initGoogleApps({ launcher });

    button.dispatchEvent(new Event('click', { bubbles: true }));
    expect(panel.classList.contains('hidden')).toBe(false);
    expect(button.getAttribute('aria-expanded')).toBe('true');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(panel.classList.contains('hidden')).toBe(true);
    expect(button.getAttribute('aria-expanded')).toBe('false');

    controller.destroy();
  });

  test('closes panel on outside click', () => {
    const launcher = document.getElementById('googleAppsLauncher');
    const button = document.getElementById('googleAppsButton');
    const panel = document.getElementById('googleAppsPanel');
    const outside = document.createElement('div');
    document.body.appendChild(outside);

    const controller = initGoogleApps({ launcher });
    button.dispatchEvent(new Event('click', { bubbles: true }));
    expect(panel.classList.contains('hidden')).toBe(false);

    outside.dispatchEvent(new Event('click', { bubbles: true }));
    expect(panel.classList.contains('hidden')).toBe(true);

    controller.destroy();
  });
});
