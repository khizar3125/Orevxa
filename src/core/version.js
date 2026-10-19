/**
 * Single source of truth for the application version shown in the UI.
 * `tests/v10-production.test.js` asserts this stays in sync with package.json.
 */
export const APP_VERSION = '10.0.0';
export const APP_NAME = 'Orvexa Studio';
export const APP_TAGLINE = 'Har Din Naya Kamaal';
export const APP_RELEASE_NAME = 'Production Grade';
export const APP_VERSION_LABEL = `ORVEXA STUDIO v${APP_VERSION.split('.').slice(0, 2).join('.')}`;
export const RELEASE_YEAR = 2026;
