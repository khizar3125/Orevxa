import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(path.join(root, rel), 'utf8');
const memStorage = () => { const data = {}; return { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } }; };

test('v8 Content Store: 24 games, 18 web templates, 24 UI blocks', async () => {
  const t = await import('../src/studio/templates.js');
  assert.equal(t.GAME_BLUEPRINTS.length, 24);
  assert.equal(t.WEB_APP_TEMPLATES.length, 18);
  assert.equal(t.VISUAL_UI_BLOCKS.length, 24);
  for (const id of ['kart-racing-cup', 'zombie-wave-defense', 'fishing-village', 'ninja-dojo-runner', 'farm-tycoon', 'pinball-neon']) assert.ok(t.GAME_BLUEPRINTS.some(b => b.id === id), id);
  for (const id of ['restaurant-orders', 'travel-booking', 'job-board', 'event-tickets']) assert.ok(t.WEB_APP_TEMPLATES.some(b => b.id === id), id);
});

test('v8 blueprints: every source runs in the real interpreter with rich line counts', async () => {
  const t = await import('../src/studio/templates.js');
  const { OrvexaInterpreter } = await import('../src/language/interpreter.js');
  for (const b of [...t.GAME_BLUEPRINTS, ...t.WEB_APP_TEMPLATES]) {
    assert.ok(b.source.split('\n').length >= 80, `${b.id} too small`);
    assert.equal(new OrvexaInterpreter().run(b.source).ok, true, b.id);
  }
  for (const id of ['kart-racing-cup', 'zombie-wave-defense', 'restaurant-orders', 'event-tickets']) {
    const entry = [...t.GAME_BLUEPRINTS, ...t.WEB_APP_TEMPLATES].find(b => b.id === id);
    assert.ok(entry.source.split('\n').length >= 90, `${id} should be 90+ lines`);
  }
});

test('v8 template metadata: difficulty, time, tags and beginner learnings for all 32', async () => {
  const t = await import('../src/studio/templates.js');
  const metas = t.listTemplateMetas();
  assert.equal(metas.length, 42);
  for (const m of metas) {
    assert.ok(['beginner', 'creator', 'pro'].includes(m.difficulty), m.id);
    assert.match(m.timeToMake, /min/);
    assert.ok(m.tags.length >= 3 && m.whatYouLearn.length === 3, m.id);
    assert.ok(m.lineCount >= 80, m.id);
  }
});

test('v8 themes: applyAppTheme recolors a source and remix produces a runnable rename', async () => {
  const t = await import('../src/studio/templates.js');
  const { OrvexaInterpreter } = await import('../src/language/interpreter.js');
  assert.equal(t.APP_THEMES.length, 8);
  const drift = t.GAME_BLUEPRINTS.find(b => b.id === 'drift-city');
  const themed = t.applyAppTheme(drift.source, 'royal-gold');
  assert.ok(themed.includes('#eab96d') && themed !== drift.source);
  assert.equal(new OrvexaInterpreter().run(themed).ok, true);
  const remix = t.remixTemplate('kart-racing-cup', { title: 'Meri Rainbow Race', themeId: 'candy-pop' });
  assert.equal(remix.title, 'Meri Rainbow Race');
  assert.match(remix.source, /app "Meri Rainbow Race"/);
  assert.equal(new OrvexaInterpreter().run(remix.source).ok, true);
  assert.throws(() => t.getAppTheme('nope'));
});

test('v8 search: Hinglish synonyms find the right templates', async () => {
  const t = await import('../src/studio/templates.js');
  const shop = t.searchTemplates('dukaan');
  assert.ok(shop.some(x => x.id === 'ecommerce-store'));
  const games = t.searchTemplates('khel');
  assert.ok(games.filter(x => x.storeKind === 'game').length >= 10);
  assert.ok(t.searchTemplates('machli').some(x => x.id === 'fishing-village'));
  assert.equal(t.searchTemplates('').length, 24 + 18 + 12 + 8);
});

test('v8 template of the day is deterministic per date', async () => {
  const t = await import('../src/studio/templates.js');
  const a = t.getTemplateOfTheDay(new Date('2026-10-18T10:00:00'));
  const b = t.getTemplateOfTheDay(new Date('2026-10-18T22:00:00'));
  assert.equal(a.id, b.id);
  const c = t.getTemplateOfTheDay(new Date('2026-10-19T10:00:00'));
  assert.notEqual(c.id, a.id);
});

test('v8 visual reorder: movePageCard swaps card blocks and new blocks insert', async () => {
  const t = await import('../src/studio/templates.js');
  const src = t.GAME_BLUEPRINTS.find(b => b.id === 'pinball-neon').source;
  const moved = t.movePageCard(src, 'Multiplier', 'up');
  assert.notEqual(moved, src);
  assert.ok(moved.indexOf('Multiplier') < src.indexOf('Multiplier'));
  const withGallery = t.insertVisualUiBlock(src, 'gallery-grid');
  assert.match(withGallery, /Gallery piece one/);
  const withReward = t.insertVisualUiBlock(src, 'reward-card');
  assert.match(withReward, /DAILY REWARD/);
});

test('Agent 4.0: session memory resolves Hinglish follow-ups', async () => {
  const ai = await import('../src/studio/aiAgent.js');
  const session = ai.createAgentSession();
  ai.rememberAgentTurn(session, 'make a racing game', { tools: ['write_project_file'] });
  assert.equal(session.turns.length, 1);
  assert.equal(session.context.lastDomain, 'racing');
  const follow = ai.resolveFollowUpPrompt(session, 'usme aur bada tower lagao');
  assert.equal(follow.followUp, true);
  assert.equal(follow.domain, 'racing');
  const fresh = ai.resolveFollowUpPrompt(ai.createAgentSession(), 'build a portfolio');
  assert.equal(fresh.followUp, false);
});

test('Agent 4.0: beginner explainer reports honest project stats', async () => {
  const ai = await import('../src/studio/aiAgent.js');
  const source = ai.synthesizeOrvexaCodeFromPrompt('racing game');
  const explained = ai.explainProjectForBeginner(source);
  assert.ok(explained.stats.scenes === 1 && explained.stats.objects >= 10 && explained.stats.buttons >= 4);
  assert.match(explained.explanation, /Agla step|Next step/);
  assert.equal(ai.explainProjectForBeginner(source, 'English').stats.title, explained.stats.title);
});

test('Agent 4.0: error doctor explains brackets and ships a fixed source', async () => {
  const ai = await import('../src/studio/aiAgent.js');
  const broken = 'app "X"\n\npage "Home" {\n    title("Hi")\n';
  const doctor = ai.diagnoseRunError(new Error('Unbalanced brace at line 3'), broken);
  assert.match(doctor.cause, /bracket/i);
  assert.equal(doctor.oneClickFix.changed, true);
  assert.ok(doctor.fixedSource.trimEnd().endsWith('}'));
  const typo = ai.diagnoseRunError(new Error('Unknown identifier camra'), 'app "X"');
  assert.match(typo.cause, /shabd|word/i);
});

test('Agent 4.0: diff summary and undo stack round-trip', async () => {
  const ai = await import('../src/studio/aiAgent.js');
  const diff = ai.diffProjectSources('a\nb\nc', 'a\nx\nc\nd');
  assert.equal(diff.changed, true);
  assert.ok(diff.addedLines >= 1 && diff.removedLines >= 1);
  const stack = ai.createSourceUndoStack(3);
  ai.pushSourceUndo(stack, 'v1'); ai.pushSourceUndo(stack, 'v2');
  assert.equal(ai.popSourceUndo(stack).source, 'v2');
  assert.equal(ai.popSourceUndo(stack).source, 'v1');
  assert.equal(ai.popSourceUndo(stack), null);
});

test('Agent 4.0: scaffold v2 runs the full pipeline with a quality badge', async () => {
  const ai = await import('../src/studio/aiAgent.js');
  const scaffold = ai.scaffoldProjectV2('survival island game');
  assert.deepEqual(scaffold.pipeline, ['project', 'terrain', 'sequence', 'audio', 'critique']);
  assert.match(scaffold.badge, /Quality \d+\/100/);
  assert.ok(scaffold.artifacts.some(a => a.kind === 'terrain'));
  assert.ok(scaffold.artifacts.some(a => a.kind === 'audio'));
  const { OrvexaInterpreter } = await import('../src/language/interpreter.js');
  assert.equal(new OrvexaInterpreter().run(scaffold.files['main.orv']).ok, true);
});

test('Agent 4.0: 16 prompt chips across English and Hinglish', async () => {
  const ai = await import('../src/studio/aiAgent.js');
  const chips = ai.listAllPromptChips();
  assert.equal(chips.length, 16);
  assert.ok(chips.some(c => c.language === 'Hinglish'));
  assert.ok(chips.some(c => c.language === 'English'));
});

test('Lessons: XP progress, completion idempotence and reset with injected storage', async () => {
  const lessons = await import('../src/studio/lessons.js');
  const storage = memStorage();
  assert.equal(lessons.INTERACTIVE_LESSONS.length, 5);
  const before = lessons.getLessonProgress(storage);
  assert.equal(before.totalXp, 0);
  const after = lessons.completeLesson('pehla-run', storage);
  assert.equal(after.totalXp, 20);
  const again = lessons.completeLesson('pehla-run', storage);
  assert.equal(again.totalXp, 20, 'XP must not double-count');
  assert.equal(lessons.completeLesson('ai-ko-bolo', storage).completed, 2);
  assert.equal(lessons.resetLessonProgress(storage).totalXp, 0);
  assert.throws(() => lessons.completeLesson('nope', storage));
});

test('Lessons: beginner dictionary explains pro words in one line', async () => {
  const lessons = await import('../src/studio/lessons.js');
  for (const term of ['mesh', 'texture', 'physics', 'erosion', 'shader']) assert.ok(lessons.explainTerm(term).length > 12, term);
  assert.match(lessons.explainTerm('mesh'), /3D/);
});

test('Snapshots: create, list, restore byte-identical, delete', async () => {
  const snaps = await import('../src/studio/snapshots.js');
  const storage = memStorage();
  const files = { 'main.orv': 'app "X"\n', 'world.realm': 'realm-data' };
  const snap = snaps.createProjectSnapshot(files, 'Pehla snapshot', storage);
  assert.equal(snap.fileCount, 2);
  const listed = snaps.listProjectSnapshots(storage);
  assert.equal(listed.length, 1);
  assert.equal(listed[0].label, 'Pehla snapshot');
  const restored = snaps.restoreProjectSnapshot(snap.id, storage);
  assert.deepEqual(restored.files, files);
  snaps.deleteProjectSnapshot(snap.id, storage);
  assert.equal(snaps.listProjectSnapshots(storage).length, 0);
  assert.throws(() => snaps.restoreProjectSnapshot(snap.id, storage));
});

test('Snapshots: share card SVG carries title and Orvexa branding', async () => {
  const snaps = await import('../src/studio/snapshots.js');
  const svg = snaps.buildShareCardSvg({ title: 'Mera Pehla Game', kind: 'game', lines: 120 });
  assert.match(svg, /Mera Pehla Game/);
  assert.match(svg, /ORVEXA STUDIO/);
  assert.match(svg, /120 lines/);
});

test('Studio v8 UI: Home tab, tour, lessons, remix, daylight and share wiring', () => {
  const main = read('src/main.js');
  for (const needle of [
    'data-right-tab="home"', 'function renderHomeTab', 'homeMakeGame', 'homeMakeWeb', 'homeMake3d',
    'function startTour', 'TOUR_STEPS', 'orvexa-tour-done', 'spawnConfetti', 'recordRecentCreation',
    'data-home-recent', 'data-lesson-done', 'homeSnapshotCreate', 'homeShareCard', 'explainTerm',
    'data-lp-remix', 'data-lp-theme', 'remixTemplate', 'applyAppTheme', 'getTemplateOfTheDay',
    'data-wb-day', 'data-wb-weather', 'applySceneDaylight', 'applySceneWeather', 'sceneSnapshotButton',
    'listAllPromptChips', 'aiExplainButton', 'aiScaffoldButton', 'scaffoldProjectV2', 'diagnoseRunError',
    "else if (tab === 'home') renderHomeTab();", "else if (tab === 'launchpad') renderLaunchpadTab();", "else if (tab === 'ai') renderAiAgentTab();",
  ]) assert.ok(main.includes(needle), needle);
  const css = read('src/styles.css');
  for (const needle of ['.home-big-card', '.tour-overlay', '.tour-highlight', '.orvexa-confetti-piece', 'prefers-reduced-motion', ':focus-visible']) assert.ok(css.includes(needle), needle);
});

test('Aetherfall v8: daily challenge, photo mode and ambience packs with windDeform invariant', () => {
  const src = read('src/studio/aetherfall-game.js');
  assert.equal((src.match(/vec3 windDeform\(vec3 p, vec3 color\)/g) || []).length, 2);
  for (const needle of ['data-daily-challenge', 'dailyChallenge', 'updateDailyChallenge', 'togglePhotoMode', 'photo-mode', 'data-soundpack', 'setSoundPack', 'ambient-wind-pad', 'fantasy-harp-arpeggio', "key==='p'"]) assert.ok(src.includes(needle), needle);
  const rankLine = src.match(/function wayfarerRank\(\) \{[^}]+\}/)?.[0] || '';
  assert.match(rankLine, /CONTRACTS\.filter/);
  assert.ok(read('src/studio/aetherfall-game.css').includes('.aether-daily'));
});

test('v8 package version and sole-markdown invariant', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.version, '9.0.0');
  const plan = read('PLAN.md');
  assert.match(plan, /v8\.0/);
  assert.match(plan, /PART B/);
});
