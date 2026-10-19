import { mountAetherfallGame } from './studio/aetherfall-game.js';
import { DEFAULT_REALM_SOURCE } from './language/realm.js';

document.addEventListener('orvexa-exit-world', () => { window.location.href = './index.html'; });
const root = document.getElementById('gameRoot');
if (!root) throw new Error('Aetherfall player root was not found.');
mountAetherfallGame(root, { source: DEFAULT_REALM_SOURCE });
