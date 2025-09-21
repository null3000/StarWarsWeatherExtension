const SUPPORTED_LANGUAGES = ['en', 'es'];
const DEFAULT_LANGUAGE = 'en';

const localeCache = new Map();

function getRuntime() {
  if (typeof browser !== 'undefined' && browser.runtime) {
    return browser.runtime;
  }

  if (typeof chrome !== 'undefined' && chrome.runtime) {
    return chrome.runtime;
  }

  throw new Error('Browser runtime is not available.');
}

function normaliseLanguage(language) {
  const short = (language || '').toLowerCase().slice(0, 2);
  return SUPPORTED_LANGUAGES.includes(short) ? short : DEFAULT_LANGUAGE;
}

function formatMessage(template, substitutions) {
  if (!template || !Array.isArray(substitutions) || substitutions.length === 0) {
    return template ?? '';
  }

  return substitutions.reduce((result, value, index) => {
    const placeholder = new RegExp(`\\$${index + 1}`, 'g');
    return result.replace(placeholder, value);
  }, template);
}

export async function loadLocalization(language) {
  const normalised = normaliseLanguage(language);

  if (localeCache.has(normalised)) {
    return localeCache.get(normalised);
  }

  const runtime = getRuntime();
  const url = runtime.getURL(`_locales/${normalised}/messages.json`);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load locale file: ${response.status}`);
    }

    const messages = await response.json();
    const localization = {
      language: normalised,
      messages,
      getMessage(key, substitutions = []) {
        const entry = messages[key];
        if (!entry || !entry.message) {
          console.warn(`Missing i18n message for key: ${key}`);
          return '';
        }

        return formatMessage(entry.message, Array.isArray(substitutions) ? substitutions : [substitutions]);
      }
    };

    localeCache.set(normalised, localization);
    return localization;
  } catch (error) {
    console.error(`Unable to load localization for ${normalised}`, error);
    if (normalised !== DEFAULT_LANGUAGE) {
      return loadLocalization(DEFAULT_LANGUAGE);
    }

    throw error;
  }
}

export function invalidateLocalizationCache(language) {
  if (language) {
    localeCache.delete(normaliseLanguage(language));
  } else {
    localeCache.clear();
  }
}

export { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, formatMessage };
