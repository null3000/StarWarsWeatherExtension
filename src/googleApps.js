import { getShowGoogleApps } from './storage.js';

export const GOOGLE_APPS = Object.freeze([
  { name: 'Gmail', url: 'https://mail.google.com/', icon: '/public/assets/google/gmail.png' },
  { name: 'Drive', url: 'https://drive.google.com/', icon: '/public/assets/google/drive.png' },
  { name: 'Maps', url: 'https://maps.google.com/', icon: '/public/assets/google/maps.png' },
  { name: 'YouTube', url: 'https://www.youtube.com/', icon: '/public/assets/google/youtube.png' },
  { name: 'Calendar', url: 'https://calendar.google.com/', icon: '/public/assets/google/calendar.png' },
  { name: 'Photos', url: 'https://photos.google.com/', icon: '/public/assets/google/photos.png' },
  { name: 'Docs', url: 'https://docs.google.com/', icon: '/public/assets/google/docs.png' },
  { name: 'Sheets', url: 'https://docs.google.com/spreadsheets/', icon: '/public/assets/google/sheets.png' },
  { name: 'News', url: 'https://news.google.com/', icon: '/public/assets/google/news.png' },
  { name: 'Translate', url: 'https://translate.google.com/', icon: '/public/assets/google/translate.png' },
  { name: 'Meet', url: 'https://meet.google.com/', icon: '/public/assets/google/meet.png' },
  { name: 'Keep', url: 'https://keep.google.com/', icon: '/public/assets/google/keep.png' }
]);

export function applyGoogleAppsVisibility(launcher, show) {
  if (!launcher) {
    return;
  }

  launcher.classList.toggle('hidden', !show);
  if (!show) {
    const panel = launcher.querySelector('#googleAppsPanel');
    const button = launcher.querySelector('#googleAppsButton');
    if (panel) {
      panel.classList.add('hidden');
    }
    if (button) {
      button.setAttribute('aria-expanded', 'false');
    }
  }
}

function appendInitialFallback(icon, appName) {
  const initial = document.createElement('span');
  initial.className = 'google-apps-initial';
  initial.textContent = appName[0] || '?';
  icon.appendChild(initial);
}

function renderAppLinks(panel) {
  if (!panel) {
    return;
  }

  panel.innerHTML = '';
  const list = document.createElement('div');
  list.className = 'google-apps-grid';

  for (const app of GOOGLE_APPS) {
    const link = document.createElement('a');
    link.className = 'google-apps-item';
    link.href = app.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.title = app.name;

    const icon = document.createElement('div');
    icon.className = 'google-apps-icon';

    if (app.icon) {
      const img = document.createElement('img');
      img.src = app.icon;
      img.alt = '';
      img.loading = 'lazy';
      img.addEventListener('error', () => {
        img.remove();
        appendInitialFallback(icon, app.name);
      });
      icon.appendChild(img);
    } else {
      appendInitialFallback(icon, app.name);
    }

    const label = document.createElement('span');
    label.className = 'google-apps-label';
    label.textContent = app.name;

    link.appendChild(icon);
    link.appendChild(label);
    list.appendChild(link);
  }

  panel.appendChild(list);
}

export function initGoogleApps({ launcher, localization } = {}) {
  if (!launcher) {
    return { destroy() {} };
  }

  const button = launcher.querySelector('#googleAppsButton');
  const panel = launcher.querySelector('#googleAppsPanel');
  if (!button || !panel) {
    return { destroy() {} };
  }

  renderAppLinks(panel);

  if (localization) {
    const label = localization.getMessage('google_apps_button_label');
    if (label) {
      button.setAttribute('aria-label', label);
      button.title = label;
    }
  }

  applyGoogleAppsVisibility(launcher, getShowGoogleApps());

  function isOpen() {
    return !panel.classList.contains('hidden');
  }

  function openPanel() {
    panel.classList.remove('hidden');
    button.setAttribute('aria-expanded', 'true');
  }

  function closePanel() {
    panel.classList.add('hidden');
    button.setAttribute('aria-expanded', 'false');
  }

  function togglePanel() {
    if (isOpen()) {
      closePanel();
    } else {
      openPanel();
    }
  }

  function onButtonClick(event) {
    event.stopPropagation();
    togglePanel();
  }

  function onDocumentClick(event) {
    if (!isOpen()) {
      return;
    }
    if (launcher.contains(event.target)) {
      return;
    }
    closePanel();
  }

  function onKeyDown(event) {
    if (event.key === 'Escape' && isOpen()) {
      closePanel();
      button.focus();
    }
  }

  button.addEventListener('click', onButtonClick);
  document.addEventListener('click', onDocumentClick);
  document.addEventListener('keydown', onKeyDown);

  return {
    destroy() {
      button.removeEventListener('click', onButtonClick);
      document.removeEventListener('click', onDocumentClick);
      document.removeEventListener('keydown', onKeyDown);
      closePanel();
    },
    openPanel,
    closePanel,
    isOpen
  };
}
