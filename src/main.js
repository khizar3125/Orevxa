import { OrvexaInterpreter } from './language/interpreter.js';
import { resolveModuleProgram } from './language/modules.js';
import { highlightOrvexa, highlightRealmScript } from './language/lexer.js';
import {
  buildStaticWebsite, downloadBlob, exportProjectZip, importProjectFile,
  loadProject, normalizePath, saveProject,
} from './studio/project.js';
import { DOCS, TUTORIALS } from './studio/docs.js';
import { EXPERIENCE_MODES, GAME_BLUEPRINTS, WEB_APP_TEMPLATES, PREFAB_KITBASH_LIBRARY, ATMOSPHERE_MOODS, VISUAL_UI_BLOCKS, getGameBlueprint, getWebAppTemplate, getPrefabKitbash, getAtmosphereMood, insertVisualUiBlock, autoFixProjectSource, getTemplateMeta, remixTemplate, getTemplateOfTheDay, APP_THEMES, applyAppTheme, movePageCard } from './studio/templates.js';
import { AI_PROVIDERS, ORVEXA_AI_TOOLS, loadAiConfig, saveAiConfig, buildWizardPrompt, planAutonomousActions, executeOrvexaAgentTurn, synthesizeRichOrvexaProject, critiqueAndEnhanceProject, executeAgentTool, AGENT_STARTER_PROMPTS, getAgentCapabilityMatrix, listAllPromptChips, explainProjectForBeginner, diagnoseRunError, scaffoldProjectV2, createAgentSession, rememberAgentTurn, generateProjectVariations, autoNameProject, suggestTemplateForPrompt } from './studio/aiAgent.js';
import { INTERACTIVE_LESSONS, getLessonProgress, completeLesson, explainTerm } from './studio/lessons.js';
import { createProjectSnapshot, listProjectSnapshots, restoreProjectSnapshot, buildShareCardSvg } from './studio/snapshots.js';
import { loadQuestProgress, saveQuestProgress, recordCreatorAction, getDailyQuests, questSummaryLine, levelTitle, ACHIEVEMENTS } from './studio/quests.js';
import { startWebGLScene, parseOBJ, exportOBJ, createMeshGeometry, projectScenePoint, sceneObjectIdentity } from './studio/scene3d.js';
import { importGLTF, exportGLB, importFBX, exportFBX } from './studio/assetFormats.js';
import { generatePlanarUVs, sculptTriangleMesh, createBasicRig, bakeRigPose, paintRigWeights, evaluateRigSkin, createAnimationClip, applyAnimationClip, bakeTriangleMeshTransform, joinTriangleMeshes } from './studio/modeling.js';
import { advancePhysics, countSceneStats, createEngineObject, createRigidBody, mirrorTriangleMesh, mirrorDuplicateTriangleMesh, subdivideTriangleMesh, createProceduralTerrainGeometry, optimizeTriangleMesh } from './studio/engine.js';
import { buildStandaloneGame, buildAndroidProjectZip } from './studio/gameExport.js';
import { renderPathTracedImage } from './studio/pathTracer.js';
import { SceneHistory, applyAxisTransform } from './studio/sceneHistory.js';
import { DEFAULT_REALM_SOURCE, validateRealmSource } from './language/realm.js';
import { mountAetherfallGame } from './studio/aetherfall-game.js';
import { buildPresetMaterialGraph, compileMaterialGraphToPBR } from './studio/materialGraph.js';
import { buildPresetGeometryNodeGraph, evaluateGeometryNodeGraph } from './studio/geometryNodes.js';
import { buildVfxTriangleMesh, createVfxEmitter, stepVfxEmitter } from './studio/vfx.js';
import { SEQUENCER_PRESETS, getSequencerPreset, renderTimelineSvg, sampleTimelineAtTime, sequenceDuration } from './studio/sequencer.js';
import { AUDIO_SYNTH_PRESETS, playSynthPreset, analyzeSynthPreset } from './studio/audioSynth.js';
import { TERRAIN_PRESETS, buildTerrainFromPreset } from './studio/terrainLab.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const app = $('#app');
let project = loadProject();
let stateStore = new Map();
let lastResult = null;
let activeInterpreter = null;
let baseConsoleLogs = [];
let pendingEventLogs = [];
let running = false;
let currentRightTab = 'preview';
let experienceMode = 'beginner'; try { experienceMode = ['beginner','creator','pro'].includes(localStorage.getItem('orvexa-experience-mode')) ? localStorage.getItem('orvexa-experience-mode') : 'beginner'; } catch {}
let lastAiAgentOutput = '';
let activeRealmSource = DEFAULT_REALM_SOURCE;
let worldGameCleanup = null;
let currentDocQuery = '';
let launchpadQuery = '';
let launchpadSort = 'popular';
let questStateCache = null;
let launchpadCategory = 'all';
let sequencerPlayback = { sequence: null, presetId: '', playing: false, time: 0, raf: 0, lastTs: 0 };
let lastCriticReport = null;
let activeFind = false;
let currentCanvasFrame = 0;
let currentSceneCleanup = null;
let sceneStartedAt = 0;
let currentSceneIndex = 0;
let selectedSceneObjectIndex = 0;
let selectedSceneObjectIndices = new Set();
let selectedSceneSource = null;
let autocompleteItems = [];
let autocompleteIndex = 0;
let toastTimer = 0;
let autosaveTimer = 0;
let latestError = null;
let simulationBaselines = new WeakMap();
let sceneHistories = new WeakMap();
let transformModeState = null;
let viewportGizmoMode = 'move';
let cameraPersistTimer = 0;
let nextEngineObjectId = 1;

const icons = {
  logo: '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 3 35 11.5v17L20 37 5 28.5v-17z" fill="none" stroke="currentColor" stroke-width="3"/><path d="M12 13h16v5H17v4h11v5H12z" fill="currentColor"/></svg>',
  run: '<svg viewBox="0 0 20 20"><path d="M6 3.8 16 10 6 16.2z" fill="currentColor"/></svg>',
  save: '<svg viewBox="0 0 20 20"><path d="M3 2.5h12l2 2V17H3z" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M6 3v5h8V3M6 17v-6h8v6" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
  download: '<svg viewBox="0 0 20 20"><path d="M10 2.5v10m-4-4 4 4 4-4M3 15.5v2h14v-2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  plus: '<svg viewBox="0 0 20 20"><path d="M10 3v14M3 10h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  folder: '<svg viewBox="0 0 20 20"><path d="M2.5 5.5h6l1.8 2h7.2v8H2.5z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>',
  search: '<svg viewBox="0 0 20 20"><circle cx="8.5" cy="8.5" r="5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="m12.3 12.3 4.3 4.3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
};

function renderShell() {
  app.innerHTML = `
    <div class="app-shell" id="appShell">
      <header class="topbar">
        <div class="brand-lockup"><span class="brand-mark">${icons.logo}</span><span class="brand-text"><strong>Orvexa</strong><small>STUDIO</small></span><span class="version-pill">ORVEXA STUDIO v6.0</span></div>
        <div class="project-title-wrap"><span class="project-dot"></span><button id="projectNameButton" class="project-name-button" title="Rename project">${escapeHtml(project.name)}</button><span class="saved-state" id="savedState"><span class="saved-dot"></span> Saved locally</span></div>
        <div class="top-actions">
          <div class="experience-switcher" role="group" aria-label="Experience mode switcher"><button type="button" class="experience-switch-button" data-experience-mode="beginner" title="Beginner — guided, friendly, 1-click">🌱<span>Beginner</span></button><button type="button" class="experience-switch-button" data-experience-mode="creator" title="Creator — balanced tools and previews">🎨<span>Creator</span></button><button type="button" class="experience-switch-button" data-experience-mode="pro" title="Pro — full Omega engine surface">🚀<span>Pro</span></button></div><button class="top-button secondary" id="quickCreateTopButton" type="button" title="Open the 1-click Quick Create Launchpad">⚡ <span>Quick Create</span></button><button class="top-button secondary" id="aiAgentTopButton" type="button" title="Open the Orvexa AI Agent">🤖 <span>AI Agent</span></button><button class="top-button secondary" id="autoFixTopButton" type="button" title="Auto-fix common errors in the current file with AI">🛠️ <span>Auto-Fix AI</span></button><button class="top-button primary play-world-top" id="playWorldButton" title="Play the Aetherfall open-world game">✦ <span>World</span></button>
          <a class="top-button secondary" id="modelerButton" href="./modeler.html" title="Open Orvexa Modeler">◇ <span>Modeler</span></a>
          <button class="top-button secondary" id="importButton" title="Import a .orv file, project JSON, or ZIP">Import</button>
          <input type="file" id="importInput" accept=".orv,.zip,.json,.orvproj" hidden /><input type="file" id="objImportInput" accept=".obj,text/plain" hidden />
          <button class="top-button secondary" id="exportButton" title="Export the complete project ZIP">Export ZIP</button>
          <button class="top-button secondary download-source" id="downloadButton">${icons.download}<span>Download</span></button>
          <button class="top-button secondary save-top-button" id="saveButton">Save</button>
          <button class="top-button secondary build-top-button" id="buildButton" title="Build a standalone static website snapshot">Build</button>
          <button class="top-button secondary stop-top-button" id="stopButton" disabled title="Execution is synchronous in this version; interruptible worker execution is on the roadmap">Stop</button>
          <button class="top-button theme-toggle" id="themeButton" aria-label="Switch theme" title="Switch theme">☼</button>
          <button class="top-button primary run-button" id="runButton">${icons.run}<span>Run</span><kbd>Ctrl ↵</kbd></button>
        </div>
      </header>
      <div class="workspace">
        <aside class="explorer-pane panel">
          <div class="pane-heading"><div><span class="eyebrow">WORKSPACE</span><h2>Explorer</h2></div><div class="pane-heading-actions"><button id="newFolderButton" class="icon-button" title="New folder">${icons.folder}</button><button id="newFileButton" class="icon-button" title="New file">${icons.plus}</button><button id="explorerMenuButton" class="icon-button" title="Project actions">⋯</button></div></div>
          <div class="explorer-project-label"><span class="chevron open">⌄</span><span class="folder-emoji">▰</span><span id="treeProjectName">${escapeHtml(project.name)}</span></div>
          <div id="fileTree" class="file-tree"></div>
          <div class="explorer-divider"></div>
          <div class="examples-heading"><span class="eyebrow">STARTER EXAMPLES</span><button id="examplesToggle" class="disclosure">−</button></div>
          <div id="exampleList" class="example-list">${TUTORIALS.map((t) => `<button class="example-link" data-example="${escapeAttr(t.file)}"><span class="example-file-icon">{ }</span><span><strong>${escapeHtml(t.title)}</strong><small>${escapeHtml(t.description)}</small></span></button>`).join('')}</div>
          <div class="explorer-footer"><div class="status-orbit"></div><span>Local workspace</span><span class="footer-spacer"></span><span class="tiny-chip">OFFLINE READY</span></div>
        </aside>
        <section class="editor-pane panel">
          <div class="editor-topline"><div class="editor-view-tabs"><button class="view-tab active" data-editor-mode="code">${escapeHtml(project.activeFile || 'main.orv')} <span class="tab-close">×</span></button></div><div class="editor-top-actions"><button id="findButton" class="subtle-action">${icons.search}<span>Find</span></button><button id="formatButton" class="subtle-action" title="Format basic indentation">Format</button><button id="editorMenuButton" class="icon-button" title="Editor options">⋯</button></div></div>
          <div class="file-crumbs"><span>PROJECT</span><span class="crumb-chevron">/</span><span id="fileCrumb">${escapeHtml(project.activeFile || 'main.orv')}</span><span class="crumb-dot">●</span><span id="editorLanguage">ORVEXA</span></div>
          <div id="findBar" class="find-bar" hidden><input id="findInput" placeholder="Find in current file…" aria-label="Find in current file"/><span id="findCount">—</span><button id="findPrev" class="tiny-control" title="Previous match">↑</button><button id="findNext" class="tiny-control" title="Next match">↓</button><button id="findClose" class="tiny-control" title="Close search">×</button></div>
          <div class="editor-workspace" id="editorWorkspace"><div id="autocompleteMenu" class="autocomplete-menu" hidden></div><div id="lineNumbers" class="line-numbers" aria-hidden="true"></div><div class="code-scroll" id="codeScroll"><pre id="codeHighlight" class="code-highlight" aria-hidden="true"></pre><textarea id="codeEditor" class="code-editor" autocomplete="off" autocapitalize="off" spellcheck="false" wrap="off" aria-label="Orvexa source editor"></textarea></div><div class="editor-empty-hint" id="editorHint" hidden>Choose a source file to begin.</div></div>
          <div class="editor-statusline"><span class="status-left"><span class="status-check">✓</span><span id="diagnosticStatus">No diagnostics</span><span class="status-divider"></span><span id="runStatus">Ready</span></span><span class="status-right"><span id="cursorPosition">Ln 1, Col 1</span><span class="status-divider"></span><span>UTF-8</span><span class="status-divider"></span><span>Spaces: 4</span><span class="language-chip">ORV</span></span></div>
          <section class="console-panel" id="consolePanel">
            <div class="console-topline"><div class="console-tabs"><button class="console-tab active" data-console-tab="output">Output <span class="console-badge" id="outputCount">0</span></button><button class="console-tab" data-console-tab="problems">Problems <span class="console-badge" id="problemCount">0</span></button><button class="console-tab" data-console-tab="build">Build log</button></div><div class="console-actions"><span class="console-status" id="consoleStatus"><i></i> Ready</span><button id="clearConsoleButton" class="subtle-action">Clear</button><button id="collapseConsoleButton" class="icon-button" title="Collapse console">⌄</button></div></div>
            <div class="console-content" id="consoleContent"><div class="console-welcome"><span class="console-terminal-mark">›_</span><div><strong>Orvexa console</strong><p>Run your program to see print output, runtime errors, and build messages here.</p></div></div></div>
          </section>
        </section>
        <aside class="preview-pane panel">
          <div class="preview-heading"><div><span class="eyebrow">LIVE WORKSPACE</span><h2>Preview</h2></div><div class="preview-toolbar"><button id="refreshPreviewButton" class="icon-button" title="Run current file">↻</button><button id="previewMenuButton" class="icon-button" title="Preview options">⋯</button></div></div>
          <div class="preview-tabs"><button data-right-tab="home" class="preview-tab"><span class="mini-tab-icon">🏠</span> Home</button><button data-right-tab="preview" class="preview-tab active"><span class="mini-tab-icon">◉</span> Website</button><button data-right-tab="scene" class="preview-tab"><span class="mini-tab-icon">◇</span> Scene</button><button data-right-tab="game" class="preview-tab"><span class="mini-tab-icon">✦</span> World</button><button data-right-tab="launchpad" class="preview-tab"><span class="mini-tab-icon">🚀</span> Quick Create</button><button data-right-tab="ai" class="preview-tab"><span class="mini-tab-icon">🤖</span> AI Agent</button><button data-right-tab="docs" class="preview-tab"><span class="mini-tab-icon">▤</span> Docs</button></div>
          <div class="preview-content" id="previewContent"><div class="preview-empty"><div class="preview-orbit"><span></span><i></i><b></b></div><h3>Ready when you are</h3><p>Run your Orvexa program to render its page here.</p><button id="previewRunButton" class="preview-empty-button">${icons.run} Run program</button><div class="preview-shortcut">Or press <kbd>Ctrl</kbd> + <kbd>Enter</kbd></div></div></div>
          <div class="preview-bottomline"><span class="preview-live-dot"></span><span id="previewState">Waiting for program</span><span class="footer-spacer"></span><span id="previewSize">Responsive preview</span></div>
        </aside>
      </div>
      <footer class="global-status"><span class="global-status-brand">${icons.logo}</span><span>Orvexa Studio</span><span class="status-divider"></span><span id="globalState">Ready</span><span class="footer-spacer"></span><span>Orvexa Studio v9.0 · Har Din Naya Kamaal</span><span class="status-divider"></span><span>Built for the browser</span><span class="status-divider"></span><span id="creatorLevelBadge" class="creator-badge">⭐ Lv 1 Naya Creator</span></footer>
      <div id="toast" class="toast" role="status" aria-live="polite"></div>
    </div>`;
}

function escapeHtml(value) { return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;'); }
function escapeAttr(value) { return escapeHtml(value).replaceAll('`', '&#96;'); }
function toast(message, kind = 'info') {
  const el = $('#toast'); if (!el) return; el.textContent = message; el.className = `toast visible ${kind}`;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('visible'), 2700);
}
function saveLocal(showToast = false) {
  project.updatedAt = new Date().toISOString();
  const ok = saveProject(project);
  $('#savedState').innerHTML = `<span class="saved-dot"></span>${ok ? 'Saved locally' : 'Storage unavailable'}`;
  $('#globalState').textContent = ok ? 'Saved' : 'Save to download to keep changes';
  if (showToast) toast(ok ? 'Project saved in this browser.' : 'Browser storage is full or unavailable. Download a project ZIP to keep your work.', ok ? 'success' : 'warning');
  return ok;
}
function scheduleSave() { $('#savedState').innerHTML = '<span class="saved-dot saving"></span> Saving…'; clearTimeout(autosaveTimer); autosaveTimer = setTimeout(() => saveLocal(), 300); }
function currentFile() { return project.files[project.activeFile] !== undefined ? project.activeFile : Object.keys(project.files)[0]; }
function contentOf(file = currentFile()) { return project.files[file] ?? ''; }
function setCurrentFile(file) {
  if (!(file in project.files)) return;
  project.activeFile = file;
  $('#codeEditor').value = project.files[file];
  $('#fileCrumb').textContent = file;
  $('.view-tab').firstElementChild?.replaceChildren();
  $('.view-tab').innerHTML = `${escapeHtml(file)} <span class="tab-close">×</span>`;
  $('.view-tab').title = file;
  $('#editorLanguage').textContent = file.toLowerCase().endsWith('.orv') ? 'ORVEXA' : file.toLowerCase().endsWith('.realm') ? 'ORVEXA REALMSCRIPT' : file.split('.').at(-1).toUpperCase();
  updateEditorVisuals(); renderTree(); updateCursorPosition(); scheduleSave();
}
function renderTree() {
  const tree = $('#fileTree'); if (!tree) return;
  const dirs = new Set(project.folders || []);
  for (const path of Object.keys(project.files)) {
    const parts = path.split('/'); parts.pop();
    let prefix = '';
    for (const part of parts) { prefix = prefix ? `${prefix}/${part}` : part; dirs.add(prefix); }
  }
  const items = [];
  for (const folder of dirs) items.push({ path: folder, kind: 'folder', depth: folder.split('/').length - 1 });
  for (const file of Object.keys(project.files)) items.push({ path: file, kind: 'file', depth: file.split('/').length - 1 });
  items.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }) || (a.kind === 'folder' ? -1 : 1));
  tree.innerHTML = items.map((item) => {
    const selected = item.kind === 'file' && item.path === currentFile();
    const name = item.path.split('/').at(-1);
    const icon = item.kind === 'folder' ? '<span class="tree-folder-icon">▰</span>' : `<span class="tree-file-icon ${fileColor(name)}">${fileGlyph(name)}</span>`;
    return `<button class="tree-item ${item.kind} ${selected ? 'selected' : ''}" data-kind="${item.kind}" data-path="${escapeAttr(item.path)}" style="--depth:${Math.min(item.depth, 6)}" title="${escapeAttr(item.path)}">${item.kind === 'folder' ? '<span class="tree-chevron">⌄</span>' : '<span class="tree-chevron-placeholder"></span>'}${icon}<span class="tree-item-label">${escapeHtml(name)}</span>${selected ? '<span class="tree-active-dot"></span>' : ''}</button>`;
  }).join('');
  $('#treeProjectName').textContent = project.name;
  $('#projectNameButton').textContent = project.name;
}
function fileGlyph(name) { const ext = name.split('.').at(-1).toLowerCase(); return ext === 'orv' ? '◈' : ext === 'js' || ext === 'ts' ? 'JS' : ext === 'css' ? '#' : ext === 'json' ? '{}' : ext === 'html' ? '5' : '·'; }
function fileColor(name) { const ext = name.split('.').at(-1).toLowerCase(); return `ext-${ext}`; }
function updateEditorVisuals() {
  const text = $('#codeEditor').value;
  $('#codeHighlight').innerHTML = (currentFile().toLowerCase().endsWith('.realm') ? highlightRealmScript(text) : highlightOrvexa(text)) + (text.endsWith('\n') ? ' ' : '\n ');
  const count = Math.max(1, text.split('\n').length);
  $('#lineNumbers').innerHTML = Array.from({ length: count }, (_, i) => `<span>${i + 1}</span>`).join('');
  $('#lineNumbers').scrollTop = $('#codeEditor').scrollTop;
}
function updateCursorPosition() {
  const editor = $('#codeEditor'); if (!editor) return;
  const text = editor.value.slice(0, editor.selectionStart); const line = text.split('\n').length; const col = text.length - (text.lastIndexOf('\n') + 1) + 1;
  $('#cursorPosition').textContent = `Ln ${line}, Col ${col}`;
}
function updateScroll() {
  const editor = $('#codeEditor'); $('#codeHighlight').style.transform = `translate(${-editor.scrollLeft}px, ${-editor.scrollTop}px)`;
  $('#lineNumbers').style.transform = `translateY(${-editor.scrollTop}px)`;
}
function refreshHighlights() {
  const text = $('#codeEditor').value; $('#codeHighlight').innerHTML = (currentFile().toLowerCase().endsWith('.realm') ? highlightRealmScript(text) : highlightOrvexa(text)) + (text.endsWith('\n') ? ' ' : '\n ');
  const count = Math.max(1, text.split('\n').length); $('#lineNumbers').innerHTML = Array.from({ length: count }, (_, i) => `<span>${i + 1}</span>`).join('');
  updateScroll(); updateCursorPosition();
}
function saveEditorToProject() {
  const file = currentFile(); if (file) project.files[file] = $('#codeEditor').value;
  scheduleSave(); refreshHighlights();
}
function updateDiagnostics(result) {
  const errors = (result?.logs || []).filter((x) => x.level === 'error').length || (result?.ok === false ? 1 : 0);
  $('#diagnosticStatus').textContent = errors ? `${errors} error${errors === 1 ? '' : 's'}` : 'No diagnostics';
  $('#diagnosticStatus').classList.toggle('has-errors', errors > 0);
  $('#problemCount').textContent = String(errors); $('#outputCount').textContent = String(result?.logs?.filter((x) => x.level !== 'error').length ?? 0);
  $('#consoleStatus').innerHTML = errors ? '<i class="error-dot"></i> Failed' : '<i></i> Ready';
  $('#runStatus').textContent = errors ? 'Runtime error' : result ? `Executed in ${result.steps} steps` : 'Ready';
}


function runProgram({ source, fromButton = false } = {}) {
  if (running) return;
  if (currentFile().toLowerCase().endsWith('.realm')) {
    if (source !== undefined) project.files[currentFile()] = source;
    saveEditorToProject();
    const realmSource = $('#codeEditor').value;
    const validation = validateRealmSource(realmSource);
    if (!validation.ok) {
      const logs = validation.errors.map(e => ({ level: 'error', text: e.message, line: e.line }));
      renderConsole(logs); $('#problemCount').textContent = String(logs.length);
      $('#diagnosticStatus').textContent = `${logs.length} RealmScript issue${logs.length === 1 ? '' : 's'}`;
      $('#runStatus').textContent = 'Realm build failed'; $('#globalState').textContent = 'RealmScript errors';
      $('#previewState').textContent = 'Realm build failed'; toast('RealmScript could not compile. Fix the highlighted directive errors.', 'error'); return;
    }
    activeRealmSource = realmSource;
    const realm = validation.realm;
    renderConsole([{ level: 'success', text: `Compiled realm: ${realm.name}` }, { level: 'info', text: `Terrain: ${validation.stats.terrainVertices.toLocaleString()} vertices · ${realm.scatters.reduce((n, s) => n + s.count, 0).toLocaleString()} scatter instances · ${realm.settlements.length} settlements` }, { level: 'info', text: 'World runtime ready. Open World to explore, pause, collect shards and activate the beacon.' }]);
    $('#diagnosticStatus').textContent = 'RealmScript valid'; $('#runStatus').textContent = `Built ${realm.name}`; $('#globalState').textContent = 'World ready'; $('#previewState').textContent = `Realm compiled · ${realm.name}`;
    activateRightTab('game'); toast(`RealmScript compiled: ${realm.name}`, 'success'); return;
  }
  if (source !== undefined) { project.files[currentFile()] = source; }
  saveEditorToProject(); running = true; latestError = null; bumpQuest('run-pressed', 1);
  const runButton = $('#runButton'); runButton.classList.add('running'); runButton.innerHTML = '<span class="run-spinner"></span><span>Running</span><kbd>Ctrl ↵</kbd>';
  $('#runStatus').textContent = 'Running…'; $('#globalState').textContent = 'Executing';
  const interpreter = new OrvexaInterpreter({ stateStore, maxSteps: 100_000 });
  let result;
  try {
    const ast = resolveModuleProgram(currentFile(), project.files);
    result = interpreter.run(ast);
  } catch (error) {
    latestError = { level: 'error', text: error.message, line: error.line ?? 1, column: error.column ?? 1 };
    result = { ok: false, appName: project.name, pages: [], scenes: [], logs: [latestError], steps: 0, error: latestError };
  }
  activeInterpreter = interpreter;
  lastResult = result;
  hydrateSceneAssets(result);
  if (!fromButton) { baseConsoleLogs = [...(result.logs || [])]; pendingEventLogs = []; }
  const displayLogs = fromButton ? [...baseConsoleLogs, ...pendingEventLogs, ...(result.ok ? [] : (result.logs || []).filter((x) => x.level === 'error'))] : (result.logs || []);
  const displayResult = { ...result, logs: displayLogs };
  updateDiagnostics(displayResult); renderConsole(displayLogs); renderPreview(result); renderSceneTab(result); renderDocsTab();
  $('#previewState').textContent = result.ok ? 'Program running' : 'Execution failed';
  $('#globalState').textContent = result.ok ? 'Execution completed' : 'Runtime error';
  $('#previewState').classList.toggle('state-error', !result.ok);
  $('#runButton').classList.remove('running'); $('#runButton').innerHTML = `${icons.run}<span>Run</span><kbd>Ctrl ↵</kbd>`;
  running = false;
  if (!result.ok) { toast(`Run failed: ${result.error?.message || 'Unknown error'}`, 'error'); }
  else if (!fromButton) toast('Program executed successfully.', 'success');
}

function renderConsole(logs = [], tab = 'output') {
  const content = $('#consoleContent');
  const activeTab = $('.console-tab.active')?.dataset.consoleTab || tab;
  const shown = activeTab === 'problems' ? logs.filter((x) => x.level === 'error' || x.level === 'warning') : activeTab === 'build' ? buildLogs : logs;
  if (!shown.length) {
    content.innerHTML = `<div class="console-welcome"><span class="console-terminal-mark">›_</span><div><strong>${activeTab === 'problems' ? 'No problems found' : activeTab === 'build' ? 'No build steps yet' : 'No output yet'}</strong><p>${activeTab === 'problems' ? 'Syntax and runtime diagnostics will appear here.' : activeTab === 'build' ? 'Use Build to create a static website snapshot ZIP.' : 'Use print(...) in an Orvexa program to display output.'}</p></div></div>`;
    return;
  }
  content.innerHTML = shown.map((log) => `<div class="console-line level-${escapeAttr(log.level || 'info')}"><span class="console-gutter">${log.line ? String(log.line).padStart(2, '0') : '›'}</span><span class="console-level">${escapeHtml((log.level || 'info').toUpperCase())}</span><code>${escapeHtml(log.text ?? '')}</code>${log.column ? `<button class="diagnostic-jump" data-line="${Number(log.line) || 1}" data-column="${Number(log.column) || 1}" title="Jump to location">${log.line}:${log.column}</button>` : ''}</div>`).join('');
}
let buildLogs = [];
function addBuildLog(level, text) { buildLogs.push({ level, text }); renderConsole(lastResult?.logs || []); }

function renderPreview(result) {
  const panel = $('#previewContent');
  if (!result) {
    panel.innerHTML = `<div class="preview-empty"><div class="preview-orbit"><span></span><i></i><b></b></div><h3>Ready when you are</h3><p>Run your Orvexa program to render its page here.</p><button id="previewRunButton" class="preview-empty-button">${icons.run} Run program</button><div class="preview-shortcut">Or press <kbd>Ctrl</kbd> + <kbd>Enter</kbd></div></div>`;
    $('#previewRunButton')?.addEventListener('click', () => runProgram({ source: $('#codeEditor').value }));
    $('#previewState').textContent = 'Waiting for program';
    return;
  }
  if (!result.ok) {
    panel.innerHTML = `<div class="preview-error"><div class="error-symbol">!</div><h3>Could not render preview</h3><p>${escapeHtml(result?.error?.message || 'Fix the error and run again.')}</p><div class="error-location">Line ${Number(result?.error?.line) || 1}, column ${Number(result?.error?.column) || 1}</div><button id="jumpErrorButton" class="preview-empty-button">Jump to error</button></div>`;
    $('#jumpErrorButton')?.addEventListener('click', () => jumpTo(Number(result?.error?.line) || 1, Number(result?.error?.column) || 1));
    return;
  }
  const page = result.pages?.[0];
  if (!page) {
    panel.innerHTML = `<div class="preview-empty small"><div class="preview-orbit"><span></span><i></i><b></b></div><h3>No page declared</h3><p>This program executed, but it didn't create a page. Add <code>page "Home" { ... }</code> to render a website.</p><button id="openDocsFromPreview" class="preview-empty-button">Open language docs</button></div>`;
    $('#openDocsFromPreview')?.addEventListener('click', () => activateRightTab('docs'));
    return;
  }
  const root = document.createElement('div'); root.className = 'rendered-page'; root.setAttribute('aria-label', `Preview page: ${page.name}`);
  (page.children || []).forEach((node) => appendUiNode(root, node));
  panel.replaceChildren(root);
}

function safeHttpUrl(value) {
  try { const url = new URL(String(value)); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; } catch { return null; }
}
function appendUiNode(parent, node) {
  if (!node || node.__orvUi !== true) return;
  const props = node.props || {}; const children = node.children || [];
  let el;
  const label = props.label ?? props.value ?? '';
  switch (node.component) {
    case 'column': el = document.createElement('div'); el.className = 'ui-column'; el.style.gap = `${clampNum(props.gap, 12, 0, 80)}px`; break;
    case 'row': el = document.createElement('div'); el.className = 'ui-row'; el.style.gap = `${clampNum(props.gap, 12, 0, 80)}px`; break;
    case 'card': case 'panel': el = document.createElement('section'); el.className = 'ui-card'; el.style.padding = `${clampNum(props.padding, 18, 0, 64)}px`; break;
    case 'title': el = document.createElement(`h${clampNum(props.level, 2, 1, 6)}`); el.className = 'ui-title'; el.style.fontSize = `${clampNum(props.size, 28, 14, 68)}px`; break;
    case 'paragraph': el = document.createElement('p'); el.className = 'ui-paragraph'; break;
    case 'text': el = document.createElement('p'); el.className = 'ui-text'; break;
    case 'button': el = document.createElement('button'); el.type = 'button'; el.className = 'ui-button'; if (typeof node.onClick === 'function') el.addEventListener('click', () => { const before = activeInterpreter?.logs.length ?? 0; try { node.onClick(); } catch (error) { pendingEventLogs.push({ level: 'error', text: error.message || String(error), line: error.line, column: error.column }); } if (activeInterpreter) pendingEventLogs.push(...activeInterpreter.logs.slice(before)); runProgram({ source: $('#codeEditor').value, fromButton: true }); }); break;
    case 'input': el = document.createElement('input'); el.className = 'ui-input'; el.placeholder = String(label); el.value = String(props.value ?? ''); el.type = ['text', 'email', 'number', 'password', 'url', 'search'].includes(props.type) ? props.type : 'text'; break;
    case 'textarea': el = document.createElement('textarea'); el.className = 'ui-input ui-textarea'; el.placeholder = String(label); el.value = String(props.value ?? ''); break;
    case 'badge': el = document.createElement('span'); el.className = 'ui-badge'; break;
    case 'divider': el = document.createElement('hr'); el.className = 'ui-divider'; break;
    case 'spacer': el = document.createElement('div'); el.className = 'ui-spacer'; el.style.height = `${clampNum(props.size, 16, 1, 160)}px`; break;
    case 'image': {
      const src = safeHttpUrl(props.src ?? props.url);
      if (!src) { el = document.createElement('div'); el.className = 'ui-image-placeholder'; el.textContent = String(props.alt || 'Image unavailable'); }
      else { el = document.createElement('img'); el.className = 'ui-image'; el.src = src; el.alt = String(props.alt || ''); el.loading = 'lazy'; }
      break;
    }
    case 'link': {
      const href = safeHttpUrl(props.url ?? props.href);
      if (href) { el = document.createElement('a'); el.href = href; el.target = '_blank'; el.rel = 'noopener noreferrer'; el.className = 'ui-link'; }
      else { el = document.createElement('span'); el.className = 'ui-text'; }
      break;
    }
    case 'list': el = document.createElement('ul'); el.className = 'ui-list'; if (Array.isArray(props.items)) for (const item of props.items) { const li = document.createElement('li'); li.textContent = String(item); el.append(li); } break;
    default: el = document.createElement('div'); el.className = 'ui-generic';
  }
  if (['title', 'paragraph', 'text', 'button', 'badge', 'link', 'input', 'textarea', 'image'].includes(node.component)) {
    if (node.component === 'input' || node.component === 'textarea') { /* placeholder and value are properties */ }
    else if (node.component === 'image') { /* image is created with a validated URL */ }
    else el.textContent = label === '' && children.length ? '' : String(label);
  }
  if (props.color && ['title', 'text', 'paragraph', 'badge'].includes(node.component)) el.style.color = safeCssColor(props.color);
  if (props.background && ['card', 'panel', 'badge'].includes(node.component)) el.style.background = safeCssColor(props.background);
  if (props.width && ['image', 'input', 'textarea'].includes(node.component)) el.style.maxWidth = '100%';
  children.forEach((child) => appendUiNode(el, child));
  parent.append(el);
}
function safeCssColor(value) { const s = String(value); return /^(#[\da-f]{3,8}|rgba?\([\d\s,.%]+\)|hsla?\([\d\s,.%deg]+\)|[a-z]{1,20})$/i.test(s) ? s : 'inherit'; }
function clampNum(v, fallback, min, max) { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback; }

function activateRightTab(tab) {
  if (tab === currentRightTab && tab === 'game' && worldGameCleanup) return;
  if (worldGameCleanup) { try { worldGameCleanup(); } catch {} worldGameCleanup = null; }
  currentRightTab = tab;
  $('#appShell')?.classList.toggle('world-immersive', tab === 'game');
  $$('[data-right-tab]').forEach((button) => button.classList.toggle('active', button.dataset.rightTab === tab));
  if (tab === 'preview') renderPreview(lastResult);
  else if (tab === 'scene') renderSceneTab(lastResult);
  else if (tab === 'game') renderGameTab();
  else if (tab === 'home') renderHomeTab();
  else if (tab === 'launchpad') renderLaunchpadTab();
  else if (tab === 'ai') renderAiAgentTab();
  else renderDocsTab();
  if (tab !== 'scene') stopSceneAnimation(); else startSceneAnimation();
}
function recordRecentCreation(kind, id, title) {
  try {
    const key = 'orvexa-recent-creations';
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    list.unshift({ kind, id, title, at: new Date().toISOString() });
    localStorage.setItem(key, JSON.stringify(list.slice(0, 8)));
    if (!localStorage.getItem('orvexa-first-launch-done')) { localStorage.setItem('orvexa-first-launch-done', '1'); spawnConfetti(); }
  } catch { /* private mode */ }
}

function spawnConfetti() {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const colors = ['#ff6b9d', '#ffd94a', '#56f0e8', '#8a7cff', '#3ddc97'];
  for (let i = 0; i < 28; i++) {
    const piece = document.createElement('div');
    piece.className = 'orvexa-confetti-piece';
    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.background = colors[i % colors.length];
    piece.style.animationDelay = `${Math.random() * 0.3}s`;
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 2400);
  }
}

let tourStepIndex = 0;
const TOUR_STEPS = [
  { selector: '#quickCreateTopButton', text: '⚡ Yahan hai Quick Create — 1 click mein game ya website shuru karo. Kuch type karne ki zaroorat nahi!' },
  { selector: '#aiAgentTopButton', text: '🤖 AI Agent ko bas bolo kya chahiye — "ek racing game banao" — woh khud bana dega.' },
  { selector: '#autoFixTopButton', text: '🛠️ Galti ho jaye to ghabrana mat — Auto-Fix AI ek click mein theek kar dega.' },
  { selector: '.experience-switcher', text: '🌱 Mode badlo: Beginner = super simple, Pro = full power. Abhi Beginner hi best hai.' },
  { selector: '#playWorldButton', text: '✦ Aur ye hai Aetherfall — ek poori 3D duniya jo khelne ke liye ready hai. Tour khatam, ab banao kuch kamaal ka!' },
];
function endTour(done = true) {
  document.querySelector('#tourOverlay')?.remove();
  document.querySelectorAll('.tour-highlight').forEach(el => el.classList.remove('tour-highlight'));
  if (done) { try { localStorage.setItem('orvexa-tour-done', '1'); } catch {} }
}
function showTourStep() {
  endTour(false);
  const step = TOUR_STEPS[tourStepIndex];
  if (!step) { endTour(true); toast('🎉 Tour pura! Ab Quick Create se pehla game launch karo.', 'success'); return; }
  const target = document.querySelector(step.selector);
  target?.classList.add('tour-highlight');
  target?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  const overlay = document.createElement('div');
  overlay.id = 'tourOverlay';
  overlay.className = 'tour-overlay';
  overlay.innerHTML = `<div class="tour-card"><span class="docs-kicker">ORVEXA TOUR · ${tourStepIndex + 1} / ${TOUR_STEPS.length}</span><p>${step.text}</p><div class="tour-actions"><button type="button" class="button secondary" id="tourSkipButton">Skip karo</button><button type="button" class="button primary" id="tourNextButton">${tourStepIndex === TOUR_STEPS.length - 1 ? '✓ Khatam' : 'Aage →'}</button></div></div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#tourSkipButton')?.addEventListener('click', () => endTour(true));
  overlay.querySelector('#tourNextButton')?.addEventListener('click', () => { tourStepIndex++; showTourStep(); });
}
function startTour() { tourStepIndex = 0; showTourStep(); }

function renderHomeTab() { refreshCreatorBadge();
  if (currentRightTab !== 'home') return;
  const panel = $('#previewContent');
  const progress = getLessonProgress();
  let recent = [];
  try { recent = JSON.parse(localStorage.getItem('orvexa-recent-creations') || '[]'); } catch { recent = []; }
  const totd = getTemplateOfTheDay();
  const snapshots = listProjectSnapshots();
  panel.innerHTML = `<div class="home-panel">
    <div class="home-hero"><span class="docs-kicker">ORVEXA STUDIO v8.0 · SABKE LIYE CREATOR</span><h3>Kya banana hai aaj? 🎨</h3><p>Bina code seekhe — ek click mein realistic game, website ya app. AI tumhaara saathi hai, galti hogi to woh theek kar dega.</p>
    <div class="home-big-cards">
      <button type="button" class="home-big-card" id="homeMakeGame"><strong>🎮 Game Banao</strong><span>24 ready games — 1 click mein kheliye</span></button>
      <button type="button" class="home-big-card" id="homeMakeWeb"><strong>🌐 Website / App Banao</strong><span>18 ready templates — dukaan, portfolio, sab kuch</span></button>
      <button type="button" class="home-big-card" id="homeMake3d"><strong>🧊 3D Model Banao</strong><span>Scene aur Modeler — drag, drop, rang badlo</span></button>
    </div>
    <div class="home-actions"><button type="button" class="button primary" id="homeStartTour">🎓 Guided Tour chalao</button><button type="button" class="button secondary" id="homeAskAi">🤖 AI se banao</button><span class="home-xp">⭐ Creator Level ${progress.level} · ${progress.totalXp} XP · ${progress.completed}/${progress.totalLessons} lessons</span></div></div>
    <h4>📅 Aaj ke Creator Quests — XP kamao, badge jeeto!</h4>
    <div class="home-quests">${getDailyQuests(getQuestState(), todayText()).map(q => `<div class="home-quest${q.completed ? ' done' : ''}"><span class="home-quest-icon">${q.icon}</span><div><strong>${escapeHtml(q.titleHi)}</strong><p>${escapeHtml(q.titleEn)} · +${q.xp} XP</p><div class="quest-bar"><i style="width:${q.progressPercent}%"></i></div></div><span class="home-quest-progress">${q.completed ? '✅ Ho gaya!' : `${q.progress}/${q.target}`}</span></div>`).join('')}</div>
    <div class="home-badges">${ACHIEVEMENTS.map(b => { const owned = getQuestState().unlockedAchievements.includes(b.id); return `<span class="home-badge${owned ? ' owned' : ' locked'}" title="${escapeAttr(owned ? b.descHi : `${b.descHi} (abhi locked)`)}">${b.icon} ${escapeHtml(b.nameHi)}</span>`; }).join('')}</div>
    <p class="launchpad-note">${escapeHtml(questSummaryLine(getQuestState(), todayText()).lineHi)}</p>
    <h4>⭐ Aaj ka Template</h4>
    <div class="launchpad-grid"><div class="launchpad-card glass"><strong>${getTemplateMeta(totd).emoji} ${escapeHtml(totd.name)}</strong><span>${escapeHtml(totd.description)} · ${getTemplateMeta(totd).timeToMake} · ${getTemplateMeta(totd).difficulty}</span><div class="launchpad-card-actions"><button type="button" class="button primary" id="homeTotdLaunch">▶ Launch &amp; Play</button></div></div></div>
    ${recent.length ? `<h4>🕘 Haal hi mein banaya</h4><div class="home-recent">${recent.map(r => `<button type="button" class="ai-chip" data-home-recent="${escapeAttr(r.kind)}:${escapeAttr(r.id)}">${r.kind === 'game' ? '🎮' : '🌐'} ${escapeHtml(r.title)}</button>`).join('')}</div>` : ''}
    <h4>🎓 Interactive Lessons — Seekho khelte khelte</h4>
    <div class="home-lessons">${progress.lessons.map(l => `<div class="home-lesson${l.done ? ' done' : ''}"><span class="home-lesson-icon">${l.icon}</span><div><strong>${escapeHtml(l.title)}</strong><p>${escapeHtml(l.task)}</p><small>+${l.xp} XP · ${l.hint}</small></div>${l.done ? '<span class="home-lesson-done">✅ Ho gaya</span>' : `<button type="button" class="button secondary" data-lesson-go="${escapeAttr(l.id)}" data-lesson-tab="${escapeAttr(l.actionTab)}">Shuru karo →</button><button type="button" class="button secondary" data-lesson-done="${escapeAttr(l.id)}">✓ Kar liya</button>`}</div>`).join('')}</div>
    <h4>🗂️ Mere Snapshots (Version Safety)</h4>
    <div class="home-snapshots"><button type="button" class="button secondary" id="homeSnapshotCreate">📸 Abhi ka snapshot lo</button><button type="button" class="button secondary" id="homeShareCard">🖼️ Share card download</button>
    ${snapshots.map(s => `<span class="ai-chip">${escapeHtml(s.label)} · ${s.fileCount} files <button type="button" data-snapshot-restore="${escapeAttr(s.id)}">↩ Wapas lao</button></span>`).join('') || '<span class="launchpad-empty">Abhi koi snapshot nahi — pehla snapshot lo, phir bina dare experiment karo!</span>'}</div>
    <p class="launchpad-note">Pro shabd ka matlab chahiye? AI Agent se poochho ya kisi shabd pe lesson dictionary dekho: <button type="button" class="inline-action" id="homeDictMesh">mesh?</button> <button type="button" class="inline-action" id="homeDictPhysics">physics?</button> <span id="homeDictOutput"></span></p>
  </div>`;
  $('#previewState').textContent = 'Home — Kya banana hai aaj?';
  $('#homeMakeGame')?.addEventListener('click', () => { launchpadCategory = 'games'; activateRightTab('launchpad'); });
  $('#homeMakeWeb')?.addEventListener('click', () => { launchpadCategory = 'web'; activateRightTab('launchpad'); });
  $('#homeMake3d')?.addEventListener('click', () => activateRightTab('scene'));
  $('#homeStartTour')?.addEventListener('click', startTour);
  $('#homeAskAi')?.addEventListener('click', () => activateRightTab('ai'));
  $('#homeTotdLaunch')?.addEventListener('click', () => { if (totd.realmSource || totd.playable) loadBlueprintIntoProject(totd.id); else loadWebTemplateIntoProject(totd.id); });
  panel.querySelectorAll('[data-home-recent]').forEach(b => b.addEventListener('click', () => { const [kind, id] = b.dataset.homeRecent.split(':'); if (kind === 'game') loadBlueprintIntoProject(id); else loadWebTemplateIntoProject(id); }));
  panel.querySelectorAll('[data-lesson-go]').forEach(b => b.addEventListener('click', () => activateRightTab(b.dataset.lessonTab)));
  panel.querySelectorAll('[data-lesson-done]').forEach(b => b.addEventListener('click', () => { const next = completeLesson(b.dataset.lessonDone); bumpQuest('lesson-completed', 1); spawnConfetti(); toast(`🎉 Lesson pura! +XP · Kul ${next.totalXp} XP · Level ${next.level}`, 'success'); renderHomeTab(); }));
  panel.querySelectorAll('[data-snapshot-restore]').forEach(b => b.addEventListener('click', () => { try { const restored = restoreProjectSnapshot(b.dataset.snapshotRestore); project.files = { ...restored.files }; setCurrentFile(project.files['main.orv'] ? 'main.orv' : Object.keys(project.files)[0]); runProgram({ source: project.files['main.orv'] || '' }); toast(`↩ Snapshot wapas aa gaya: ${restored.label}`, 'success'); } catch (error) { toast(error.message, 'error'); } }));
  $('#homeSnapshotCreate')?.addEventListener('click', () => { const snap = createProjectSnapshot({ ...project.files, [currentFile()]: $('#codeEditor')?.value ?? project.files[currentFile()] }, `${project.name || 'Project'} · ${new Date().toLocaleTimeString()}`); toast(`📸 Snapshot save: ${snap.label} (${snap.fileCount} files)`, 'success'); renderHomeTab(); });
  $('#homeShareCard')?.addEventListener('click', () => { const source = project.files['main.orv'] || ''; const svg = buildShareCardSvg({ title: project.name || 'My Orvexa Creation', kind: /scene\s+"/.test(source) ? 'game' : 'web', lines: source.split('\n').length }); const a = document.createElement('a'); a.href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`; a.download = 'orvexa-share-card.svg'; a.click(); toast('🖼️ Share card download ho gaya!', 'success'); });
  const dict = (term) => { const out = $('#homeDictOutput'); if (out) out.textContent = explainTerm(term); };
  $('#homeDictMesh')?.addEventListener('click', () => dict('mesh'));
  $('#homeDictPhysics')?.addEventListener('click', () => dict('physics'));
}

function renderGameTab() {
  if (currentRightTab !== 'game') return;
  const panel = $('#previewContent');
  panel.innerHTML = '';
  const cleanupGame = mountAetherfallGame(panel, { source: activeRealmSource });
  const onExit = () => activateRightTab('preview');
  document.addEventListener('orvexa-exit-world', onExit);
  worldGameCleanup = () => { document.removeEventListener('orvexa-exit-world', onExit); cleanupGame?.(); };
}
function renderSceneTab(result) {
  if (currentRightTab !== 'scene') return;
  const panel = $('#previewContent');
  const scenes = result?.scenes || [];
  if (!scenes.length) {
    panel.innerHTML = `<div class="scene-empty"><div class="scene-icon">◇</div><h3>Orvexa Forge Engine</h3><p>Build a 3D scene visually or start from Orvexa code. Add meshes, edit transforms and PBR-style material settings, and test simple rigid-body physics in the browser.</p><button id="createForgeScene" class="preview-empty-button">Create 3D game scene</button><button id="openSceneExample" class="scene-action">Open code example</button></div>`;
    $('#createForgeScene')?.addEventListener('click', () => {
      if (!lastResult) lastResult = { ok: true, appName: project.name, pages: [], scenes: [], logs: [], steps: 0 };
      const scene = { name: 'Forge Scene', objects: [], kind: 'scene', simulation: { running: false, gravity: 9.81, collisions: true, elapsed: 0 } };
      lastResult.scenes.push(scene); currentSceneIndex = lastResult.scenes.length - 1; selectedSceneObjectIndex = 0;
      project.sceneState ||= {}; project.sceneState[scene.name] ||= { additions: [], deleted: [], overrides: {}, simulation: { gravity: 9.81, collisions: true } };
      saveLocal(true); renderSceneTab(lastResult);
    });
    $('#openSceneExample')?.addEventListener('click', () => openExample('examples/forge-game.orv'));
    stopSceneAnimation(); return;
  }
  if (currentSceneIndex >= scenes.length) currentSceneIndex = 0;
  const options = scenes.map((s, i) => `<option value="${i}" ${i === currentSceneIndex ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('');
  const scene = scenes[currentSceneIndex];
  if (selectedSceneSource !== scene) { selectedSceneSource = scene; selectedSceneObjectIndex = 0; selectedSceneObjectIndices = new Set(); }
  scene.simulation ||= { running: false, gravity: 9.81, collisions: true, elapsed: 0 };
  if (selectedSceneObjectIndex >= scene.objects.length) selectedSceneObjectIndex = Math.max(0, scene.objects.length - 1);
  selectedSceneObjectIndices = new Set([...selectedSceneObjectIndices].filter(index => Number.isInteger(index) && index >= 0 && index < scene.objects.length));
  if (scene.objects.length && !selectedSceneObjectIndices.size) selectedSceneObjectIndices.add(selectedSceneObjectIndex);
  const selected = scene.objects[selectedSceneObjectIndex] || null;
  const availableShadowSources = scene.objects.map((object, index) => ({ object, index, key: sceneObjectIdentity(object, index) })).filter(item => item.object?.type === 'light' && item.object.visible !== false);
  const configuredShadowSource = scene.renderSettings?.shadowCasterId || 'auto';
  const shadowSourceValue = availableShadowSources.some(item => item.key === configuredShadowSource) ? configuredShadowSource : 'auto';
  const shadowSourceOptions = availableShadowSources.map(({ object, key }, index) => `<option value="${escapeHtml(key)}" ${key === shadowSourceValue ? 'selected' : ''}>${escapeHtml(object.name || `Light ${index + 1}`)} · ${escapeHtml(object.lightType || 'point')}</option>`).join('');
  const editable = selected && !['animation', 'rigidbody', 'material'].includes(selected.type);
  const meshEditable = selected && ['cube','sphere','plane','cylinder','torus','cone','pyramid','capsule','mesh'].includes(selected.type);
  const stats = countSceneStats(scene);
  const gravity = Number(scene.simulation.gravity ?? 9.81);
  const history = ensureSceneHistory(scene);
  const accordionNames = ['forge-export-accordion','forge-model-accordion','forge-render-accordion','forge-sim-accordion','forge-kitbash-accordion','forge-terrain-accordion','forge-sequencer-accordion','forge-audio-accordion'];
  const preservedAccordions = Object.fromEntries(accordionNames.map(name => [name, Boolean(panel.querySelector(`.${name}`)?.open)]));
  const preservedObjectSearch = $('#sceneObjectSearch', panel)?.value || '';
  panel.innerHTML = `<div class="scene-workbench forge-workbench">
    <div class="scene-tools forge-toolbar"><label for="sceneSelector">SCENE</label><select id="sceneSelector" aria-label="Choose scene">${options}</select><span class="scene-count">${scene.objects.length} objects</span><button id="sceneUndoButton" class="scene-action" title="Undo scene edit (Ctrl+Z)" ${history.canUndo ? '' : 'disabled'}>↶ Undo</button><button id="sceneRedoButton" class="scene-action" title="Redo scene edit (Ctrl+Y)" ${history.canRedo ? '' : 'disabled'}>↷ Redo</button><button id="importAssetButton" class="scene-action">＋ Import model</button><input type="file" id="sceneAssetInput" accept=".obj,.glb,.gltf,.fbx,text/plain,model/gltf-binary,model/gltf+json" hidden></div>
    <details class="forge-accordion forge-export-accordion"><summary><span class="accordion-title">Export & build</span><span class="accordion-description">3D formats, playable game and Android project</span></summary><div class="accordion-body"><button id="exportObjButton" class="scene-action" ${meshEditable ? '' : 'disabled'}>Export OBJ</button><button id="exportGlbButton" class="scene-action" ${meshEditable ? '' : 'disabled'}>Export GLB</button><button id="exportFbxButton" class="scene-action" ${meshEditable ? '' : 'disabled'}>Export FBX</button><button id="buildGameButton" class="scene-action forge-build-game">Playable Game ZIP</button><button id="buildAndroidButton" class="scene-action">Android APK Project</button><button id="exportFullProjectButton" class="scene-action forge-build-game">Full Project Backup ZIP</button></div></details>
    <div class="forge-create-row forge-quick-add"><span class="forge-section-label">ADD OBJECT</span>${['cube','sphere','cylinder','cone','torus','plane','pyramid','capsule'].map(type => `<button class="forge-mesh-button" data-add-primitive="${type}" title="Create ${type}">${({cube:'Cube',sphere:'Sphere',cylinder:'Cylinder',cone:'Cone',torus:'Torus',plane:'Plane',pyramid:'Pyramid',capsule:'Capsule'})[type]}</button>`).join('')}<button class="forge-mesh-button forge-terrain-button" data-add-terrain title="Generate deterministic fractal terrain mesh">⛰ Generate Terrain</button><button class="forge-mesh-button" data-add-geonodes title="Evaluate a Procedural Geometry Nodes DAG crystal cluster">✦ Procedural Crystal</button><button class="forge-mesh-button" data-add-vfx title="Spawn a budgeted live particle VFX emitter">🔥 VFX Emitter</button></div>
    ${meshEditable ? `<details class="forge-accordion forge-model-accordion"><summary><span class="accordion-title">Modeling tools</span><span class="accordion-description">Join objects, apply transforms, symmetry, sculpt and rigging</span></summary><div class="accordion-body"><div class="forge-create-row forge-selection-tools"><span class="forge-section-label">OBJECT OPERATIONS</span><button class="forge-mesh-button" id="joinSelectedMeshes" ${selectedSceneObjectIndices.size >= 2 ? '' : 'disabled'}>Join selected meshes (${selectedSceneObjectIndices.size})</button><button class="forge-mesh-button" id="applyObjectTransform">Apply rotation & scale</button><span class="forge-mini-help">Tick objects in the hierarchy to select several. Join uses the active object's material.</span></div><div class="forge-create-row forge-model-tools"><span class="forge-section-label">MESH TOOLS</span><button class="forge-mesh-button" data-model-tool="convert">Convert to mesh</button><button class="forge-mesh-button" data-model-tool="optimize">Optimize mesh</button><button class="forge-mesh-button" data-model-tool="subdivide">Subdivide ×4</button><button class="forge-mesh-button" data-model-tool="mirror-x">Mirror X</button><button class="forge-mesh-button" data-model-tool="mirror-y">Mirror Y</button><button class="forge-mesh-button" data-model-tool="mirror-z">Flip Z</button><button class="forge-mesh-button" data-model-tool="mirror-dup-x">Mirror +X</button><button class="forge-mesh-button" data-model-tool="mirror-dup-y">Mirror +Y</button><button class="forge-mesh-button" data-model-tool="mirror-dup-z">Mirror +Z</button><button class="forge-mesh-button" data-model-tool="uv">Generate UVs</button><button class="forge-mesh-button" data-model-tool="sculpt-up">Sculpt +Y</button><button class="forge-mesh-button" data-model-tool="sculpt-down">Sculpt −Y</button><button class="forge-mesh-button" data-model-tool="sculpt-smooth">Smooth</button><button class="forge-mesh-button" data-model-tool="sculpt-inflate">Inflate</button><button class="forge-mesh-button" data-model-tool="sculpt-flatten">Flatten</button><button class="forge-mesh-button" data-model-tool="rig">Create biped rig</button><button class="forge-mesh-button" data-model-tool="pose-left-arm">Pose left arm</button><button class="forge-mesh-button" data-model-tool="pose-right-arm">Pose right arm</button><button class="forge-mesh-button" data-model-tool="pose-left-leg">Pose left leg</button><button class="forge-mesh-button" data-model-tool="pose-right-leg">Pose right leg</button><button class="forge-mesh-button" data-model-tool="rig-reset">Reset rig pose</button><button class="forge-mesh-button" data-model-tool="weight-spine">Paint Spine Weights</button><button class="forge-mesh-button" data-model-tool="weight-left-arm">Paint Left Arm</button><button class="forge-mesh-button" data-model-tool="weight-right-arm">Paint Right Arm</button><button class="forge-mesh-button" data-model-tool="weight-left-leg">Paint Left Leg</button><button class="forge-mesh-button" data-model-tool="weight-right-leg">Paint Right Leg</button><button class="forge-mesh-button" data-model-tool="anim-walk">Create Walk Clip</button><button class="forge-mesh-button" data-model-tool="anim-sample">Sample Clip</button></div></div></details>` : ''}
    <details class="forge-accordion forge-render-accordion"><summary><span class="accordion-title">Lighting & image quality</span><span class="accordion-description">Performance mode, IBL probe, shadows, fog and offline render</span></summary><div class="accordion-body forge-render-row"><span class="forge-section-label">RENDER SETTINGS</span><label class="render-mode-label">Performance <select id="renderPerformanceMode"><option value="low" ${(scene.renderSettings?.performanceMode||'balanced')==='low'?'selected':''}>Low lag</option><option value="balanced" ${(scene.renderSettings?.performanceMode||'balanced')==='balanced'?'selected':''}>Balanced</option><option value="high" ${(scene.renderSettings?.performanceMode||'balanced')==='high'?'selected':''}>High quality</option><option value="ultra" ${(scene.renderSettings?.performanceMode||'balanced')==='ultra'?'selected':''}>Ultra</option></select></label><label class="render-mode-label">IBL Probe <select id="renderEnvironmentPreset"><option value="studio" ${(scene.renderSettings?.environmentPreset||'studio')==='studio'?'selected':''}>Studio Neutral</option><option value="sunset" ${scene.renderSettings?.environmentPreset==='sunset'?'selected':''}>Copper Sunset</option><option value="overcast" ${scene.renderSettings?.environmentPreset==='overcast'?'selected':''}>Overcast Sky</option><option value="night" ${scene.renderSettings?.environmentPreset==='night'?'selected':''}>Moonlit Night</option><option value="ember" ${scene.renderSettings?.environmentPreset==='ember'?'selected':''}>Ember Forge</option></select></label><label class="render-mode-label">Tone Mapping <select id="renderToneMapping">${['aces','agx','filmic'].map(m=>`<option value="${m}" ${(scene.renderSettings?.toneMapping||scene.renderSettings?.toneMappingMode||'aces')===m?'selected':''}>${m.toUpperCase()}</option>`).join('')}</select></label><label><input type="checkbox" id="renderLumenGI" ${scene.renderSettings?.lumenGI !== false ? 'checked' : ''}> Lumen GI</label><label><input type="checkbox" id="renderBloom" ${scene.renderSettings?.bloom !== false ? 'checked' : ''}> Bloom</label><label><input type="checkbox" id="renderAdaptiveResolution" ${scene.renderSettings?.adaptiveResolution !== false ? 'checked' : ''}> Adaptive resolution</label><label><input type="checkbox" id="renderShadows" ${scene.renderSettings?.shadows !== false ? 'checked' : ''}> Shadows enabled</label><label class="render-mode-label">Shadow resolution <select id="renderShadowResolution"><option value="512" ${Number(scene.renderSettings?.shadowResolution ?? 1024) === 512 ? 'selected' : ''}>512 · performance</option><option value="1024" ${Number(scene.renderSettings?.shadowResolution ?? 1024) === 1024 ? 'selected' : ''}>1024 · balanced</option><option value="2048" ${Number(scene.renderSettings?.shadowResolution ?? 1024) === 2048 ? 'selected' : ''}>2048 · detailed</option></select></label><label class="render-mode-label">Shadow source <select id="renderShadowCaster"><option value="auto" ${shadowSourceValue === 'auto' ? 'selected' : ''}>Automatic · first active light</option>${shadowSourceOptions}</select></label><label><input type="checkbox" id="renderPostFx" ${scene.renderSettings?.postProcessing !== false ? 'checked' : ''}> Filmic + vignette</label><label><input type="checkbox" id="renderFog" ${scene.renderSettings?.fog ? 'checked' : ''}> Distance fog</label><label class="render-exposure-label">Environment <input type="range" id="renderEnvironmentStrength" min="0" max="2.5" step="0.1" value="${Number(scene.renderSettings?.environmentStrength ?? 1)}"></label><output id="renderEnvironmentValue">${Number(scene.renderSettings?.environmentStrength ?? 1).toFixed(1)}</output><label class="render-mode-label">Shadow softness <select id="renderShadowSoftness"><option value="0.65" ${Number(scene.renderSettings?.shadowSoftness ?? 1.25) < 0.9 ? 'selected' : ''}>Crisp</option><option value="1.25" ${Number(scene.renderSettings?.shadowSoftness ?? 1.25) >= 0.9 && Number(scene.renderSettings?.shadowSoftness ?? 1.25) < 1.7 ? 'selected' : ''}>Soft</option><option value="2.1" ${Number(scene.renderSettings?.shadowSoftness ?? 1.25) >= 1.7 ? 'selected' : ''}>Very soft</option></select></label><label class="render-exposure-label">Exposure <input type="range" id="renderExposure" min="0.4" max="2.5" step="0.05" value="${Number(scene.renderSettings?.exposure ?? 1.15)}"></label><output id="renderExposureValue">${Number(scene.renderSettings?.exposure ?? 1.15).toFixed(2)}</output><button id="pathTraceButton" class="scene-action forge-build-game">Offline Path Trace</button></div></details>
    <details class="forge-accordion forge-kitbash-accordion"><summary><span class="accordion-title">Prefab kitbash & atmosphere</span><span class="accordion-description">12 one-click assemblies · 8 cinematic moods</span></summary><div class="accordion-body"><div class="forge-create-row"><span class="forge-section-label">KITBASH PREFABS</span>${PREFAB_KITBASH_LIBRARY.map(pp => `<button class="forge-mesh-button" data-wb-prefab="${escapeAttr(pp.id)}" title="${escapeAttr(pp.description)}">${escapeHtml(pp.name)}</button>`).join('')}</div><div class="forge-create-row"><span class="forge-section-label">DAYLIGHT & WEATHER</span><button class="forge-mesh-button" data-wb-day="morning">☀ Subah</button><button class="forge-mesh-button" data-wb-day="evening">🌇 Shaam</button><button class="forge-mesh-button" data-wb-day="night">🌙 Raat</button><button class="forge-mesh-button" data-wb-weather="rain">🌧 Baarish</button><button class="forge-mesh-button" data-wb-weather="snow">❄ Barf</button><button class="forge-mesh-button" data-wb-weather="clear">☀ Saaf</button><button class="forge-mesh-button" id="sceneSnapshotButton">📸 Photo Lo</button><button class="forge-mesh-button" id="magicSceneButton">🪄 Magic Scene</button></div>
    <div class="forge-create-row"><span class="forge-section-label">ATMOSPHERE MOODS</span>${ATMOSPHERE_MOODS.map(m => `<button class="forge-mesh-button" data-wb-mood="${escapeAttr(m.id)}" title="${escapeAttr(m.description)}">${escapeHtml(m.name)}</button>`).join('')}</div></div></details>
    <details class="forge-accordion forge-terrain-accordion"><summary><span class="accordion-title">Terrain Erosion Lab</span><span class="accordion-description">Hydraulic erosion · biomes · foliage scatter</span></summary><div class="accordion-body"><div class="forge-create-row"><span class="forge-section-label">TERRAIN LAB</span><label class="gravity-setting">Biome <select id="terrainBiomeSelect"><option value="alpine">Alpine</option><option value="desert">Desert</option><option value="tundra">Tundra</option><option value="forest">Forest</option></select></label><label class="gravity-setting">Erosion <input id="terrainErosionSlider" type="range" min="0" max="4000" step="100" value="1200"><output id="terrainErosionValue">1200 droplets</output></label><label class="gravity-setting">Preset <select id="terrainPresetSelect">${Object.keys(TERRAIN_PRESETS).map(id => `<option value="${id}">${id}</option>`).join('')}</select></label><button class="forge-mesh-button forge-terrain-button" id="erodeScatterTerrainButton">⛰ Erode &amp; Scatter Biome Terrain</button></div></div></details>
    <details class="forge-accordion forge-sequencer-accordion"><summary><span class="accordion-title">Animation Sequencer</span><span class="accordion-description">Timeline clips · bezier / elastic curves · live scrub</span></summary><div class="accordion-body"><div class="forge-create-row"><span class="forge-section-label">SEQUENCER</span><label class="gravity-setting">Clip <select id="sequencerPresetSelect">${Object.entries(SEQUENCER_PRESETS).map(([id, sq]) => `<option value="${id}">${escapeHtml(sq.name)}</option>`).join('')}</select></label><button class="forge-mesh-button" id="sequencerPlayButton">▶ Play</button><button class="forge-mesh-button" id="sequencerStopButton">■ Stop</button><label class="gravity-setting">Scrub <input id="sequencerScrubber" type="range" min="0" max="8" step="0.01" value="0"><output id="sequencerTimeLabel">0.00s</output></label></div><div id="sequencerSvgPreview" class="sequencer-svg-preview">${renderTimelineSvg(getSequencerPreset('turntable-showcase'))}</div></div></details>
    <details class="forge-accordion forge-audio-accordion"><summary><span class="accordion-title">Procedural Audio Lab</span><span class="accordion-description">16 offline-synthesized SFX & music presets</span></summary><div class="accordion-body"><div class="forge-create-row"><span class="forge-section-label">AUDIO SYNTH</span>${Object.entries(AUDIO_SYNTH_PRESETS).map(([id, pr]) => `<button class="forge-mesh-button" data-wb-audio="${escapeAttr(id)}" title="Preview ${escapeAttr(pr.label || id)}">🔊 ${escapeHtml(pr.label || id)}</button>`).join('')}</div></div></details>
    <details class="forge-accordion forge-sim-accordion"><summary><span class="accordion-title">Physics simulation</span><span class="accordion-description">Play, pause, step and configure gravity</span></summary><div class="accordion-body forge-sim-row"><span class="forge-section-label">SIMULATION</span><button class="scene-action ${scene.simulation.running ? 'sim-active' : ''}" data-sim="play">▶ Play</button><button class="scene-action" data-sim="pause">Ⅱ Pause</button><button class="scene-action" data-sim="step">▸ Step</button><button class="scene-action" data-sim="reset">↺ Reset</button><label class="gravity-setting">Gravity <input id="sceneGravity" type="number" min="0" max="100" step="0.1" value="${Number.isFinite(gravity) ? gravity : 9.81}"></label><label class="gravity-setting gravity-check"><input id="sceneCollisions" type="checkbox" ${scene.simulation.collisions !== false ? 'checked' : ''}> Collisions</label><span class="sim-status ${scene.simulation.running ? 'is-running' : ''}">${scene.simulation.running ? 'PLAYING' : 'PAUSED'}</span></div></details>
    <div class="forge-view-row"><span class="forge-section-label">VIEWPORT</span><button class="scene-action" data-scene-camera="selected">Focus Selected</button><button class="scene-action" data-scene-camera="all">Frame All</button><button class="scene-action" data-scene-camera="front">Front</button><button class="scene-action" data-scene-camera="top">Top</button><button class="scene-action" data-scene-camera="side">Side</button><span class="forge-view-hint">Drag the coloured handles · G/R/S + axis + value also works</span><div class="forge-gizmo-mode-group" role="group" aria-label="Viewport transform tool"><button type="button" class="scene-action gizmo-mode-button ${viewportGizmoMode==='move'?'active':''}" data-gizmo-mode="move" aria-pressed="${viewportGizmoMode==='move'}" title="Move (G)">↔ Move</button><button type="button" class="scene-action gizmo-mode-button ${viewportGizmoMode==='rotate'?'active':''}" data-gizmo-mode="rotate" aria-pressed="${viewportGizmoMode==='rotate'}" title="Rotate (R)">⟳ Rotate</button><button type="button" class="scene-action gizmo-mode-button ${viewportGizmoMode==='scale'?'active':''}" data-gizmo-mode="scale" aria-pressed="${viewportGizmoMode==='scale'}" title="Scale (S)">⤢ Scale</button></div><output id="sceneTransformStatus" class="forge-transform-status" aria-live="polite">G / R / S → X / Y / Z → value → Enter</output></div>
    <div class="scene-canvas-wrap forge-canvas-wrap"><canvas id="sceneCanvas" aria-label="Orvexa Forge real-time WebGL 3D scene preview"></canvas><svg id="sceneGizmo" class="forge-gizmo-overlay" aria-label="Interactive move, rotate and scale gizmo for the selected mesh"></svg><div class="canvas-badge"><span class="preview-live-dot"></span> Orvexa Forge · WebGL</div><div class="forge-perf-hud" data-forge-perf-hud>Starting renderer…</div><div class="canvas-hint">Select Move / Rotate / Scale above · drag empty space to orbit · scroll to zoom</div></div>
    <div class="forge-stat-row"><span>${stats.objects} entities</span><span>~${stats.vertices.toLocaleString()} vertices</span><span>~${stats.triangles.toLocaleString()} triangles</span><span>${stats.dynamicBodies} physics bodies</span></div>
    <div class="scene-object-list"><div class="scene-list-heading"><strong>Objects in scene</strong><span>${scene.objects.length} total</span></div><input id="sceneObjectSearch" class="scene-object-search" type="search" placeholder="Search objects by name or type…" aria-label="Search scene objects" autocomplete="off">${scene.objects.length ? scene.objects.map((obj, i) => `<div class="scene-object-entry" data-object-search="${escapeAttr(`${obj.name || ''} ${obj.type || ''}`.toLowerCase())}"><input class="scene-multi-select" type="checkbox" data-scene-multi-select="${i}" aria-label="Include ${escapeAttr(obj.name || obj.type)} in multi-selection" ${selectedSceneObjectIndices.has(i) ? 'checked' : ''}><button type="button" data-scene-object="${i}" class="scene-object-row ${i === selectedSceneObjectIndex ? 'selected' : ''} ${selectedSceneObjectIndices.has(i) && i !== selectedSceneObjectIndex ? 'multi-selected' : ''}"><span class="object-type-icon ${escapeAttr(obj.type)}">${obj.type === 'camera' ? '◉' : obj.type === 'light' ? '☼' : obj.type === 'animation' ? '↻' : obj.type === 'mesh' ? '▧' : '◇'}</span><span class="object-name">${escapeHtml(obj.name)}</span><span class="object-kind">${escapeHtml(obj.type)}</span><span class="object-color" style="--object-color:${safeCssColor(obj.color || '#74708d')}"></span></button></div>`).join('') : '<p class="forge-empty-list">Scene is empty. Use the Add Mesh buttons above to create geometry.</p>'}</div>
    ${editable ? `<div class="scene-inspector forge-inspector"><div class="scene-list-heading"><strong>Edit selected object</strong><span>${escapeHtml(selected.type)} · ${escapeHtml(selected.engineId || 'source')}</span></div><p class="inspector-help">Change position, rotation, scale or material below. Values save to this project automatically.</p><label>Name<input id="inspectorName" value="${escapeAttr(selected.name || '')}" maxlength="100"></label><div class="forge-subheading">TRANSFORM</div><div class="inspector-grid"><label>Position X<input type="number" step="0.1" data-transform="x" value="${Number(selected.position?.x)||0}"></label><label>Position Y<input type="number" step="0.1" data-transform="y" value="${Number(selected.position?.y)||0}"></label><label>Position Z<input type="number" step="0.1" data-transform="z" value="${Number(selected.position?.z)||0}"></label><label>Base size<input type="number" min="0.01" max="100" step="0.1" data-transform="size" value="${Number(selected.size ?? selected.radius ?? 1)||1}"></label><label>Rotation X °<input type="number" step="1" data-transform="rotationX" value="${Math.round((Number(selected.rotation?.x)||0)*180/Math.PI)}"></label><label>Rotation Y °<input type="number" step="1" data-transform="rotationY" value="${Math.round((Number(selected.rotation?.y)||0)*180/Math.PI)}"></label><label>Rotation Z °<input type="number" step="1" data-transform="rotationZ" value="${Math.round((Number(selected.rotation?.z)||0)*180/Math.PI)}"></label><label>Scale X<input type="number" min="0.01" max="100" step="0.1" data-transform="scaleX" value="${Number(selected.scale?.x)||1}"></label><label>Scale Y<input type="number" min="0.01" max="100" step="0.1" data-transform="scaleY" value="${Number(selected.scale?.y)||1}"></label><label>Scale Z<input type="number" min="0.01" max="100" step="0.1" data-transform="scaleZ" value="${Number(selected.scale?.z)||1}"></label></div>${selected.type === 'light' ? `<div class="forge-subheading">LIGHT SOURCE</div><div class="inspector-grid"><label>Type<select id="lightType"><option value="point" ${(selected.lightType || 'point') === 'point' ? 'selected' : ''}>Point</option><option value="directional" ${selected.lightType === 'directional' ? 'selected' : ''}>Directional</option><option value="spot" ${selected.lightType === 'spot' ? 'selected' : ''}>Spot</option></select></label><label>Intensity<input id="lightIntensity" type="number" min="0" max="12" step="0.1" value="${Number(selected.intensity ?? 1)}"></label><label>Direction X<input id="lightDirectionX" type="number" step="0.1" value="${Number(selected.direction?.x ?? -(Number(selected.position?.x) || 0.4))}"></label><label>Direction Y<input id="lightDirectionY" type="number" step="0.1" value="${Number(selected.direction?.y ?? -(Number(selected.position?.y) || 1))}"></label><label>Direction Z<input id="lightDirectionZ" type="number" step="0.1" value="${Number(selected.direction?.z ?? -(Number(selected.position?.z) || 0.3))}"></label><label>Range<input id="lightRange" type="number" min="0.1" max="500" step="1" value="${Number(selected.range ?? 20)}"></label><label>Source radius<input id="lightRadius" type="number" min="0" max="10" step="0.05" value="${Number(selected.radius ?? 0)}"></label>${(selected.lightType || 'point') === 'spot' ? `<label>Inner cone °<input id="lightInnerCone" type="number" min="0" max="88" step="1" value="${Number(selected.innerCone ?? 15)}"></label><label>Outer cone °<input id="lightOuterCone" type="number" min="1" max="89" step="1" value="${Number(selected.outerCone ?? 28)}"></label>` : ''}</div><p class="inspector-help">Directional light uses direction (light → scene); Point/Spot fade by range; Spot has adjustable inner/outer cones. Source radius adds sampled soft shadows in Offline Path Trace. Choose the real-time shadow-casting light in Lighting & image quality → Shadow source.</p>` : ''}<div class="forge-subheading">SCULPT / WEIGHT BRUSH · LOCAL SPACE</div><div class="inspector-grid"><label>Brush X<input id="sculptCenterX" type="number" step="0.1" value="${Number(selected.sculptBrush?.center?.x ?? 0)}"></label><label>Brush Y<input id="sculptCenterY" type="number" step="0.1" value="${Number(selected.sculptBrush?.center?.y ?? 0)}"></label><label>Brush Z<input id="sculptCenterZ" type="number" step="0.1" value="${Number(selected.sculptBrush?.center?.z ?? 0)}"></label><label>Radius<input id="sculptRadius" type="number" min="0.01" max="10" step="0.1" value="${Number(selected.sculptBrush?.radius ?? 0.9)}"></label><label>Strength<input id="sculptStrength" type="number" min="0.01" max="1" step="0.01" value="${Number(selected.sculptBrush?.strength ?? 0.16)}"></label></div>${selected.rig ? `<div class="forge-subheading">SKELETAL ANIMATION</div><label>Clip sample time<input id="animationTime" type="range" min="0" max="1" step="0.05" value="${Number(selected.animationTime ?? 0.25)}"></label><div class="forge-texture-actions"><span>${escapeHtml(selected.animationClip?.name || 'Rig pose only')} · ${(selected.rig.vertexWeights || []).length} weighted vertices</span><button id="resetAnimationPose" class="scene-action">Reset pose</button></div>` : ''}<div class="forge-subheading">SURFACE MATERIAL</div><div class="forge-texture-actions"><button class="scene-action" data-material-preset="matte">Matte</button><button class="scene-action" data-material-preset="chrome">Chrome</button><button class="scene-action" data-material-preset="gold">Gold</button><button class="scene-action" data-material-preset="ceramic">Ceramic</button><button class="scene-action" data-material-preset="rubber">Rubber</button><button class="scene-action" data-material-preset="neon">Neon</button></div><label class="forge-check-label"><input id="flatShadingEnabled" type="checkbox" ${selected.flatShading ? 'checked' : ''}> Flat shading (off = smooth custom-mesh normals)</label><label>Base colour<input id="inspectorColor" type="color" value="${/^#[0-9a-f]{6}$/i.test(selected.color||'') ? selected.color : '#7c5cff'}"></label><div class="forge-texture-actions"><input id="materialImageInput" type="file" accept="image/png,image/jpeg,image/webp" hidden><button id="loadMaterialImage" class="scene-action">${selected.material?.baseColorImage ? 'Replace base texture' : 'Load base texture'}</button><button id="clearMaterialImage" class="scene-action" ${selected.material?.baseColorImage ? '' : 'disabled'}>Clear texture</button><span>${selected.material?.baseColorImage ? 'Embedded image' : 'No texture'}</span></div><div class="forge-subheading">PBR TEXTURE CHANNELS</div><p class="inspector-help">Packed Metallic/Roughness uses glTF channels: Green = roughness, Blue = metallic. AO reads Red; Emissive uses RGB. Loading an emissive map activates emission at intensity 1.</p><input id="materialChannelImageInput" type="file" accept="image/png,image/jpeg,image/webp" hidden>${[['metallicRoughnessImage','Packed metallic / roughness'],['aoImage','Ambient occlusion'],['normalImage','Tangent-space normal'],['emissiveImage','Emissive colour']].map(([field,label]) => `<div class="forge-texture-actions forge-map-row"><span>${label}</span><button type="button" class="scene-action" data-load-material-map="${field}">${selected.material?.[field] ? 'Replace' : 'Load map'}</button><button type="button" class="scene-action" data-clear-material-map="${field}" ${selected.material?.[field] ? '' : 'disabled'}>Clear</button><small>${selected.material?.[field] ? 'Embedded' : 'Not set'}</small></div>`).join('')}<div class="forge-range-label"><label for="materialAOStrength">AO strength</label><output id="aoStrengthValue">${Number(selected.material?.aoStrength ?? 1).toFixed(2)}</output></div><input id="materialAOStrength" class="forge-range" type="range" min="0" max="1" step="0.01" value="${Number(selected.material?.aoStrength ?? 1)}"><div class="forge-range-label"><label for="materialNormalScale">Normal intensity</label><output id="normalScaleValue">${Number(selected.material?.normalScale ?? 1).toFixed(2)}</output></div><input id="materialNormalScale" class="forge-range" type="range" min="0" max="4" step="0.05" value="${Number(selected.material?.normalScale ?? 1)}"><div class="forge-range-label"><label for="materialMetallic">Metallic</label><output id="metallicValue">${Number(selected.material?.metallic ?? 0.05).toFixed(2)}</output></div><input id="materialMetallic" class="forge-range" type="range" min="0" max="1" step="0.01" value="${Number(selected.material?.metallic ?? 0.05)}"><div class="forge-range-label"><label for="materialRoughness">Roughness</label><output id="roughnessValue">${Number(selected.material?.roughness ?? 0.68).toFixed(2)}</output></div><input id="materialRoughness" class="forge-range" type="range" min="0.04" max="1" step="0.01" value="${Number(selected.material?.roughness ?? 0.68)}"><div class="forge-range-label"><label for="materialEmissive">Emission</label><output id="emissiveValue">${Number(selected.material?.emissive ?? 0).toFixed(2)}</output></div><input id="materialEmissive" class="forge-range" type="range" min="0" max="2" step="0.05" value="${Number(selected.material?.emissive ?? 0)}"><div class="forge-range-label"><label for="materialClearcoat">Clearcoat</label><output id="clearcoatValue">${Number(selected.material?.clearcoat ?? 0).toFixed(2)}</output></div><input id="materialClearcoat" class="forge-range" type="range" min="0" max="1" step="0.01" value="${Number(selected.material?.clearcoat ?? 0)}">
      <div class="forge-subheading">PHYSICS BODY</div><label class="forge-check-label"><input id="rigidBodyEnabled" type="checkbox" ${selected.rigidBody?.enabled ? 'checked' : ''}> Enable dynamic rigid body</label><div class="inspector-grid"><label>Mass<input id="rigidMass" type="number" min="0.01" max="100000" step="0.1" value="${Number(selected.rigidBody?.mass ?? 1)}"></label><label>Bounce<input id="rigidBounce" type="number" min="0" max="1" step="0.05" value="${Number(selected.rigidBody?.restitution ?? 0.12)}"></label><label>Friction<input id="rigidFriction" type="number" min="0" max="1" step="0.05" value="${Number(selected.rigidBody?.friction ?? 0.72)}"></label></div><div class="forge-inspector-actions"><button id="resetObjectTransform" class="scene-action">Reset Transform</button><button id="duplicateSceneObject" class="scene-action">Duplicate</button><button id="removeSceneObject" class="scene-action danger">Delete object</button></div></div>` : '<div class="scene-inspector"><strong>No object selected</strong><p class="forge-empty-list">Choose an entity in the hierarchy to edit it.</p></div>'}
    <div class="scene-disclaimer"><strong>Quick tip</strong><p>Choose Move, Rotate or Scale above the viewport and drag a red X, green Y or blue Z handle. For exact values, press G, R or S → X/Y/Z → type a value → Enter. Use Focus Selected whenever an object is outside the view.</p></div></div>`;
  for (const name of accordionNames) { const accordion = panel.querySelector(`.${name}`); if (accordion) accordion.open = preservedAccordions[name]; }
  const restoredSearch = $('#sceneObjectSearch', panel);
  if (restoredSearch && preservedObjectSearch) { restoredSearch.value = preservedObjectSearch; const query = preservedObjectSearch.trim().toLowerCase(); $$('.scene-object-entry', panel).forEach(row => { row.hidden = !row.dataset.objectSearch.includes(query); }); }
  $('#sceneSelector').addEventListener('change', (e) => { pauseScene(scene, false); currentSceneIndex = Number(e.target.value) || 0; selectedSceneObjectIndex = 0; selectedSceneObjectIndices = new Set(); renderSceneTab(result); });
  $('#sceneUndoButton')?.addEventListener('click', () => applySceneHistory(scene, 'undo'));
  $('#sceneRedoButton')?.addEventListener('click', () => applySceneHistory(scene, 'redo'));
  $$('[data-scene-camera]', panel).forEach(button => button.addEventListener('click', () => focusSceneCamera(scene, button.dataset.sceneCamera)));
  $$('[data-gizmo-mode]', panel).forEach(button => button.addEventListener('click', () => { viewportGizmoMode = button.dataset.gizmoMode; $$('[data-gizmo-mode]', panel).forEach(item => { const active = item.dataset.gizmoMode === viewportGizmoMode; item.classList.toggle('active', active); item.setAttribute('aria-pressed', String(active)); }); setupSceneTransformGizmo(scene, selectedSceneObjectIndex); const status = $('#sceneTransformStatus'); if (status) status.textContent = `${viewportGizmoMode.toUpperCase()} tool · drag a coloured ${viewportGizmoMode === 'rotate' ? 'ring' : 'axis handle'} to edit`; }));

  $('#importAssetButton').addEventListener('click', () => $('#sceneAssetInput').click());
  $('#sceneAssetInput').addEventListener('change', async e => { const file=e.target.files?.[0]; if(file) await importSceneAsset(file); e.target.value=''; });
  $('#exportObjButton').addEventListener('click', exportSelectedOBJ);
  $('#exportGlbButton').addEventListener('click', exportSelectedGLB);
  $('#exportFbxButton').addEventListener('click', exportSelectedFBX);
  $('#buildGameButton').addEventListener('click', exportStandaloneGame);
  $('#pathTraceButton')?.addEventListener('click', () => openPathTraceDialog(scene));
  $('#buildAndroidButton').addEventListener('click', exportAndroidProject);
  $('#exportFullProjectButton').addEventListener('click', exportProject);
  const updateRenderSettings=()=>{scene.renderSettings ||= {shadows:true,postProcessing:true,fog:false,exposure:1.15,vignette:0.22,fogDensity:0.012,fogColor:'#7788aa',performanceMode:'balanced',environmentPreset:'studio',adaptiveResolution:true,environmentStrength:1,shadowSoftness:1.25,shadowResolution:1024,shadowCasterId:'auto'};scene.renderSettings.shadows=$('#renderShadows')?.checked!==false;scene.renderSettings.postProcessing=$('#renderPostFx')?.checked!==false;scene.renderSettings.fog=$('#renderFog')?.checked===true;scene.renderSettings.exposure=Number($('#renderExposure')?.value??1.15);scene.renderSettings.performanceMode=$('#renderPerformanceMode')?.value||'balanced';scene.renderSettings.environmentPreset=$('#renderEnvironmentPreset')?.value||'studio';scene.renderSettings.toneMapping=$('#renderToneMapping')?.value||'aces';scene.renderSettings.toneMappingMode=scene.renderSettings.toneMapping;scene.renderSettings.lumenGI=$('#renderLumenGI')?.checked!==false;scene.renderSettings.bloom=$('#renderBloom')?.checked!==false;scene.renderSettings.adaptiveResolution=$('#renderAdaptiveResolution')?.checked!==false;scene.renderSettings.environmentStrength=Math.max(0,Math.min(2.5,Number($('#renderEnvironmentStrength')?.value??1)));scene.renderSettings.shadowSoftness=Number($('#renderShadowSoftness')?.value??1.25);scene.renderSettings.shadowResolution=[512,1024,2048].includes(Number($('#renderShadowResolution')?.value))?Number($('#renderShadowResolution').value):1024;scene.renderSettings.shadowCasterId=$('#renderShadowCaster')?.value||'auto';const out=$('#renderExposureValue');if(out)out.textContent=scene.renderSettings.exposure.toFixed(2);const envOut=$('#renderEnvironmentValue');if(envOut)envOut.textContent=scene.renderSettings.environmentStrength.toFixed(1);persistSceneState(scene);recordSceneEdit(scene,'Change render settings');$('#sceneCanvas')?.dispatchEvent(new CustomEvent('orvexa-render-settings-change'));saveLocal();};
  ['renderShadows','renderPostFx','renderFog','renderExposure','renderPerformanceMode','renderEnvironmentPreset','renderAdaptiveResolution','renderEnvironmentStrength','renderShadowSoftness','renderShadowResolution','renderShadowCaster','renderToneMapping','renderLumenGI','renderBloom'].forEach(id=>$('#'+id)?.addEventListener('change',updateRenderSettings));
  $$('[data-add-primitive]', panel).forEach(button => button.addEventListener('click', () => addScenePrimitive(button.dataset.addPrimitive)));
  $('#addTerrainButton')?.addEventListener('click', addProceduralTerrain);
  panel.querySelector('[data-add-terrain]')?.addEventListener('click', addProceduralTerrain);
  panel.querySelector('[data-add-geonodes]')?.addEventListener('click', addProceduralGeoNodeCluster);
  panel.querySelector('[data-add-vfx]')?.addEventListener('click', addSceneVfxEmitter);
  panel.querySelectorAll('[data-wb-prefab]').forEach(b => b.addEventListener('click', () => spawnPrefabIntoScene(b.dataset.wbPrefab)));
  panel.querySelectorAll('[data-wb-mood]').forEach(b => b.addEventListener('click', () => applyAtmosphereMood(b.dataset.wbMood)));
  $('#magicSceneButton', panel)?.addEventListener('click', magicSceneCombo);
  panel.querySelectorAll('[data-wb-day]').forEach(b => b.addEventListener('click', () => applySceneDaylight(b.dataset.wbDay)));
  panel.querySelectorAll('[data-wb-weather]').forEach(b => b.addEventListener('click', () => applySceneWeather(b.dataset.wbWeather)));
  $('#sceneSnapshotButton')?.addEventListener('click', () => { const canvas = $('#sceneCanvas'); if (!canvas) { toast('Pehle Scene tab kholo.', 'error'); return; } try { const a = document.createElement('a'); a.href = canvas.toDataURL('image/png'); a.download = 'orvexa-scene-photo.png'; a.click(); toast('📸 Photo download ho gaya!', 'success'); } catch (error) { toast('Photo nahi ban paya — ek baar canvas pe click karke dobara try karo.', 'error'); } });
  panel.querySelectorAll('[data-wb-audio]').forEach(b => b.addEventListener('click', () => previewAudioPreset(b.dataset.wbAudio)));
  $('#terrainErosionSlider')?.addEventListener('input', (e) => { const out = $('#terrainErosionValue'); if (out) out.textContent = `${e.target.value} droplets`; });
  $('#erodeScatterTerrainButton')?.addEventListener('click', () => addErodedBiomeTerrainToScene($('#terrainPresetSelect')?.value || 'alpine-ridged'));
  $('#sequencerPresetSelect')?.addEventListener('change', (e) => { const preview = $('#sequencerSvgPreview'); if (preview) preview.innerHTML = renderTimelineSvg(getSequencerPreset(e.target.value)); const seq = getSequencerPreset(e.target.value); const scrub = $('#sequencerScrubber'); if (scrub) scrub.max = String(sequenceDuration(seq) || seq.duration || 8); });
  $('#sequencerPlayButton')?.addEventListener('click', () => playSequencerPresetInScene($('#sequencerPresetSelect')?.value || 'turntable-showcase'));
  $('#sequencerStopButton')?.addEventListener('click', () => { stopSequencerPlayback(); const sceneNow = getStudioSceneForTools(); if (sceneNow) persistStudioScene(sceneNow); toast('🎬 Sequencer stopped', 'success'); });
  $('#sequencerScrubber')?.addEventListener('input', (e) => { const sceneNow = getStudioSceneForTools(); const seq = getSequencerPreset($('#sequencerPresetSelect')?.value || 'turntable-showcase'); if (sceneNow) { sampleTimelineAtTime(seq, Number(e.target.value) || 0, sceneNow); const label = $('#sequencerTimeLabel'); if (label) label.textContent = `${Number(e.target.value).toFixed(2)}s / ${(sequenceDuration(seq) || 8).toFixed(2)}s`; } });
  panel.querySelectorAll('[data-material-preset]').forEach(button => button.addEventListener('click', () => applyMaterialPreset(scene, selected, button.dataset.materialPreset)));
  $('#flatShadingEnabled')?.addEventListener('change', e => { selected.flatShading = e.target.checked; selected.geometryRevision = (selected.geometryRevision || 0) + 1; saveSceneOverride(scene, selectedSceneObjectIndex, selected); saveLocal(); setupSceneCanvas(scene); });
  $$('[data-model-tool]', panel).forEach(button=>button.addEventListener('click',()=>handleModelTool(button.dataset.modelTool,scene,selected)));
  $('#applyObjectTransform')?.addEventListener('click', () => applySelectedObjectTransform(scene, selected));
  $('#joinSelectedMeshes')?.addEventListener('click', () => joinSelectedSceneObjects(scene));
  $$('[data-sim]', panel).forEach(button => button.addEventListener('click', () => handleSimulationAction(button.dataset.sim, scene)));
  $('#sceneGravity').addEventListener('change', e => { const n=Number(e.target.value); if(Number.isFinite(n)) scene.simulation.gravity=Math.max(0,Math.min(100,n)); persistSceneState(scene); recordSceneEdit(scene,'Change gravity'); saveLocal(); });
  $('#sceneCollisions').addEventListener('change', e => { scene.simulation.collisions=e.target.checked; persistSceneState(scene); recordSceneEdit(scene,'Change collision setting'); saveLocal(); });
  $$('[data-scene-object]', panel).forEach(button => button.addEventListener('click', e => {
    const index = Number(button.dataset.sceneObject), anchor = selectedSceneObjectIndex;
    if (e.ctrlKey || e.metaKey) {
      if (selectedSceneObjectIndices.has(index) && selectedSceneObjectIndices.size > 1) {
        selectedSceneObjectIndices.delete(index);
        if (selectedSceneObjectIndex === index) selectedSceneObjectIndex = [...selectedSceneObjectIndices].at(-1) ?? index;
      } else { selectedSceneObjectIndices.add(index); selectedSceneObjectIndex = index; }
    } else if (e.shiftKey && Number.isInteger(anchor) && anchor !== index) {
      const low = Math.min(anchor, index), high = Math.max(anchor, index);
      selectedSceneObjectIndices = new Set(Array.from({ length: high - low + 1 }, (_, offset) => low + offset));
      selectedSceneObjectIndex = index;
    } else { selectedSceneObjectIndex = index; selectedSceneObjectIndices = new Set([index]); }
    renderSceneTab(result);
  }));
  $$('[data-scene-multi-select]', panel).forEach(input => input.addEventListener('change', e => {
    const index = Number(e.target.dataset.sceneMultiSelect);
    if (e.target.checked) { selectedSceneObjectIndices.add(index); selectedSceneObjectIndex = index; }
    else { selectedSceneObjectIndices.delete(index); if (selectedSceneObjectIndex === index) selectedSceneObjectIndex = [...selectedSceneObjectIndices].at(-1) ?? Math.max(0, scene.objects.findIndex(() => true)); }
    renderSceneTab(result);
  }));
  $('#sceneObjectSearch')?.addEventListener('input', e => { const query=e.target.value.trim().toLowerCase(); $$('.scene-object-entry', panel).forEach(row => { row.hidden = !row.dataset.objectSearch.includes(query); }); });
  $('#inspectorName')?.addEventListener('change', e => { selected.name=e.target.value.trim().slice(0,100)||selected.type; saveSceneOverride(scene,selectedSceneObjectIndex,selected); renderSceneTab(result); });
  const commitLightEdit=()=>{if(selected?.type!=='light')return;selected.lightType=['point','directional','spot'].includes($('#lightType')?.value)?$('#lightType').value:'point';selected.intensity=Math.max(0,Math.min(12,Number($('#lightIntensity')?.value??1)||0));selected.direction={x:Math.max(-10000,Math.min(10000,Number($('#lightDirectionX')?.value??-1)||0)),y:Math.max(-10000,Math.min(10000,Number($('#lightDirectionY')?.value??-1)||0)),z:Math.max(-10000,Math.min(10000,Number($('#lightDirectionZ')?.value??-1)||0))};if(Math.hypot(selected.direction.x,selected.direction.y,selected.direction.z)<1e-5)selected.direction={x:0,y:-1,z:0};const rangeValue=Number($('#lightRange')?.value??selected.range??20);selected.range=Math.max(.1,Math.min(500,Number.isFinite(rangeValue)?rangeValue:20));const radiusValue=Number($('#lightRadius')?.value??selected.radius??0);selected.radius=Math.max(0,Math.min(10,Number.isFinite(radiusValue)?radiusValue:0));const innerValue=Number($('#lightInnerCone')?.value??selected.innerCone??15);selected.innerCone=Math.max(0,Math.min(88,Number.isFinite(innerValue)?innerValue:15));const outerValue=Number($('#lightOuterCone')?.value??selected.outerCone??28);selected.outerCone=Math.max(selected.innerCone+1,Math.min(89,Number.isFinite(outerValue)?outerValue:28));saveSceneOverride(scene,selectedSceneObjectIndex,selected);renderSceneTab(result);};
  ['lightType','lightIntensity','lightDirectionX','lightDirectionY','lightDirectionZ','lightRange','lightRadius','lightInnerCone','lightOuterCone'].forEach(id=>$('#'+id)?.addEventListener('change',commitLightEdit));
  $('#inspectorColor')?.addEventListener('input', e => { selected.color=e.target.value; });
  $('#inspectorColor')?.addEventListener('change', () => { saveSceneOverride(scene,selectedSceneObjectIndex,selected); });
  $$('[data-transform]', panel).forEach(input => input.addEventListener('change', e => {
    const key=e.target.dataset.transform, n=Number(e.target.value); if(!Number.isFinite(n))return;
    if(key==='size') selected.size=Math.max(.01,Math.min(100,n));
    else if(key.startsWith('rotation')) { selected.rotation ||= {x:0,y:0,z:0}; const axis=key.slice(-1).toLowerCase(); selected.rotation[axis]=Math.max(-3600,Math.min(3600,n))*Math.PI/180; }
    else if(key.startsWith('scale')) { selected.scale ||= {x:1,y:1,z:1}; const axis=key.slice(-1).toLowerCase(); selected.scale[axis]=Math.max(.01,Math.min(100,n)); }
    else { selected.position ||= {x:0,y:0,z:0}; selected.position[key]=Math.max(-10000,Math.min(10000,n)); }
    saveSceneOverride(scene,selectedSceneObjectIndex,selected); renderSceneTab(result);
  }));
  const updateMaterial=()=>{selected.material ||= {metallic:0.05,roughness:0.68,emissive:0,clearcoat:0};selected.material.metallic=Number($('#materialMetallic')?.value??selected.material.metallic);selected.material.roughness=Number($('#materialRoughness')?.value??selected.material.roughness);selected.material.emissive=Number($('#materialEmissive')?.value??selected.material.emissive);selected.material.clearcoat=Number($('#materialClearcoat')?.value??selected.material.clearcoat??0);selected.material.aoStrength=Math.max(0,Math.min(1,Number($('#materialAOStrength')?.value??selected.material.aoStrength??1)));selected.material.normalScale=Math.max(0,Math.min(4,Number($('#materialNormalScale')?.value??selected.material.normalScale??1)));for(const [id,key] of [['metallicValue','metallic'],['roughnessValue','roughness'],['emissiveValue','emissive'],['clearcoatValue','clearcoat'],['aoStrengthValue','aoStrength'],['normalScaleValue','normalScale']]){const out=$(`#${id}`);if(out)out.textContent=selected.material[key].toFixed(2);}$('#sceneCanvas')?.dispatchEvent(new CustomEvent('orvexa-render-settings-change'));};
  ['materialMetallic','materialRoughness','materialEmissive','materialClearcoat','materialAOStrength','materialNormalScale'].forEach(id=>{const input=$('#'+id);input?.addEventListener('input',updateMaterial);input?.addEventListener('change',()=>{updateMaterial();saveSceneOverride(scene,selectedSceneObjectIndex,selected);});});
  $('#loadMaterialImage')?.addEventListener('click',()=>$('#materialImageInput')?.click());
  $('#materialImageInput')?.addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>1_000_000)throw new Error('Base-colour textures are limited to 1 MB each for browser-safe project storage.');if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('Choose a PNG, JPEG or WebP image.');const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||''));reader.onerror=()=>reject(new Error('Could not read the image file.'));reader.readAsDataURL(file);});if(!/^data:image\/(png|jpeg|webp);base64,/.test(data))throw new Error('Unsupported image encoding.');selected.material ||= {metallic:0.05,roughness:0.68,emissive:0};selected.material.baseColorImage=data;persistSceneState(scene);saveSceneOverride(scene,selectedSceneObjectIndex,selected);saveLocal(true);renderSceneTab(result);toast('Base-colour texture embedded in the project. Export GLB or the full project ZIP to share it.','success');}catch(error){toast(error.message||'Texture import failed.','error');}finally{e.target.value='';}});
  $('#clearMaterialImage')?.addEventListener('click',()=>{if(selected.material)delete selected.material.baseColorImage;persistSceneState(scene);saveSceneOverride(scene,selectedSceneObjectIndex,selected);saveLocal();renderSceneTab(result);});
  let activeMaterialMapField='metallicRoughnessImage';
  $$('[data-load-material-map]',panel).forEach(button=>button.addEventListener('click',()=>{activeMaterialMapField=button.dataset.loadMaterialMap;$('#materialChannelImageInput')?.click();}));
  $$('[data-clear-material-map]',panel).forEach(button=>button.addEventListener('click',()=>{const field=button.dataset.clearMaterialMap;if(selected.material)delete selected.material[field];persistSceneState(scene);saveSceneOverride(scene,selectedSceneObjectIndex,selected);saveLocal();renderSceneTab(result);toast('Material texture channel cleared.','success');}));
  $('#materialChannelImageInput')?.addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>350_000)throw new Error('PBR channel maps are limited to 350 KB each to help preserve browser project storage.');if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('Choose a PNG, JPEG or WebP image.');const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||''));reader.onerror=()=>reject(new Error('Could not read the image file.'));reader.readAsDataURL(file);});if(!/^data:image\/(png|jpeg|webp);base64,/.test(data))throw new Error('Unsupported image encoding.');selected.material ||= {metallic:0.05,roughness:0.68,emissive:0};selected.material[activeMaterialMapField]=data;if(activeMaterialMapField==='emissiveImage'&&!(Number(selected.material.emissive)>0))selected.material.emissive=1;persistSceneState(scene);saveSceneOverride(scene,selectedSceneObjectIndex,selected);saveLocal(true);renderSceneTab(result);const labels={metallicRoughnessImage:'Packed metallic/roughness map embedded.',aoImage:'Ambient occlusion map embedded.',normalImage:'Tangent-space normal map embedded.',emissiveImage:'Emissive map embedded; emission intensity set to 1. Adjust the Emission slider as needed.'};toast(labels[activeMaterialMapField]||'Material map embedded.','success');}catch(error){toast(error.message||'PBR map import failed.','error');}finally{e.target.value='';}});
  $('#rigidBodyEnabled')?.addEventListener('change', e=>{selected.rigidBody=createRigidBody({...selected.rigidBody,enabled:e.target.checked});saveSceneOverride(scene,selectedSceneObjectIndex,selected);renderSceneTab(result);});
  const updateBody=()=>{selected.rigidBody=createRigidBody({...selected.rigidBody,enabled:$('#rigidBodyEnabled')?.checked,mass:Number($('#rigidMass')?.value),restitution:Number($('#rigidBounce')?.value),friction:Number($('#rigidFriction')?.value)});saveSceneOverride(scene,selectedSceneObjectIndex,selected);};
  ['rigidMass','rigidBounce','rigidFriction'].forEach(id=>$('#'+id)?.addEventListener('change',updateBody));
  $('#resetObjectTransform')?.addEventListener('click',()=>{if(!selected)return;selected.position={x:0,y:0,z:0};selected.rotation={x:0,y:0,z:0};selected.scale={x:1,y:1,z:1};selected.size=1;saveSceneOverride(scene,selectedSceneObjectIndex,selected);renderSceneTab(result);toast('Object transform reset.','success');});
  $('#duplicateSceneObject')?.addEventListener('click',()=>duplicateSceneObject(scene,selected));
  $('#removeSceneObject')?.addEventListener('click',()=>deleteSceneObject(scene,selected));
  $('#resetAnimationPose')?.addEventListener('click',()=>handleModelTool('rig-reset',scene,selected));
  setupSceneCanvas(scene);
  setupSceneTransformGizmo(scene, selectedSceneObjectIndex);
}

function deepCopySceneValue(value) {
  if (value == null) return value;
  try { return JSON.parse(JSON.stringify(value)); } catch { return null; }
}
function ensureSceneHistory(scene) {
  let history = sceneHistories.get(scene);
  if (!history) {
    history = new SceneHistory({ maxEntries: 60, maxBytes: 24 * 1024 * 1024, maxEntryBytes: 10 * 1024 * 1024 });
    sceneHistories.set(scene, history);
    history.record(captureSceneSnapshot(scene), 'Scene opened');
  }
  return history;
}
function captureSceneSnapshot(scene) {
  const legacyOverrides = Object.fromEntries(Object.entries(project.sceneOverrides || {}).filter(([key]) => key.startsWith(`${scene.name}::`)));
  return {
    objects: (scene.objects || []).map(serializableSceneObject),
    savedState: deepCopySceneValue(project.sceneState?.[scene.name] ?? null),
    legacyOverrides,
    simulation: { gravity: Number(scene.simulation?.gravity ?? 9.81), collisions: scene.simulation?.collisions !== false, elapsed: Number(scene.simulation?.elapsed ?? 0) },
    renderSettings: deepCopySceneValue(scene.renderSettings || {}),
    editorCamera: deepCopySceneValue(scene.editorCamera || null),
    selectedIndex: selectedSceneObjectIndex,
  };
}
function recordSceneEdit(scene, label = 'Edit scene') {
  if (!scene) return false;
  const history = ensureSceneHistory(scene);
  const saved = history.record(captureSceneSnapshot(scene), label);
  const status = history.status;
  const undo = $('#sceneUndoButton'), redo = $('#sceneRedoButton');
  if (undo) { undo.disabled = !status.canUndo; undo.title = status.canUndo ? `Undo: ${status.undoLabel} (Ctrl+Z)` : 'Nothing to undo'; }
  if (redo) { redo.disabled = !status.canRedo; redo.title = status.canRedo ? `Redo: ${status.redoLabel} (Ctrl+Y)` : 'Nothing to redo'; }
  return saved;
}
function applySceneHistory(scene, direction) {
  if (!scene) return;
  const history = ensureSceneHistory(scene);
  const entry = direction === 'undo' ? history.undo() : history.redo();
  if (!entry) return;
  const snapshot = entry.snapshot;
  scene.objects = (snapshot.objects || []).map(obj => ({
    ...obj,
    position: { ...(obj.position || { x: 0, y: 0, z: 0 }) },
    rotation: { ...(obj.rotation || { x: 0, y: 0, z: 0 }) },
    scale: { ...(obj.scale || { x: 1, y: 1, z: 1 }) },
    material: { ...(obj.material || {}) },
    ...(Array.isArray(obj.geometry) ? { geometry: [...obj.geometry] } : {}),
    ...(Array.isArray(obj.uvs) ? { uvs: [...obj.uvs] } : {}),
  }));
  project.sceneState ||= {};
  if (snapshot.savedState == null) delete project.sceneState[scene.name];
  else project.sceneState[scene.name] = deepCopySceneValue(snapshot.savedState);
  project.sceneOverrides ||= {};
  for (const key of Object.keys(project.sceneOverrides)) if (key.startsWith(`${scene.name}::`)) delete project.sceneOverrides[key];
  Object.assign(project.sceneOverrides, deepCopySceneValue(snapshot.legacyOverrides || {}));
  scene.simulation = { ...(snapshot.simulation || {}), running: false, gravity: Number(snapshot.simulation?.gravity ?? 9.81), collisions: snapshot.simulation?.collisions !== false };
  scene.renderSettings = deepCopySceneValue(snapshot.renderSettings || {});
  if (snapshot.editorCamera) scene.editorCamera = deepCopySceneValue(snapshot.editorCamera); else delete scene.editorCamera;
  selectedSceneObjectIndex = Math.max(0, Math.min(Number(snapshot.selectedIndex ?? selectedSceneObjectIndex), scene.objects.length - 1));
  selectedSceneObjectIndices = new Set(scene.objects.length ? [selectedSceneObjectIndex] : []);
  saveLocal(true);
  renderSceneTab(lastResult);
  toast(`${direction === 'undo' ? 'Undid' : 'Redid'}: ${entry.label}`, 'success');
}
function focusSceneCamera(scene, mode = 'selected') {
  if (!scene) return;
  transformModeState = null;
  updateTransformStatus();
  const visible = (scene.objects || []).filter(obj => obj.visible !== false && ['cube','sphere','plane','cylinder','torus','cone','pyramid','capsule','mesh'].includes(obj.type));
  let targets = visible;
  if (mode !== 'all') {
    const selected = scene.objects?.[selectedSceneObjectIndex];
    if (selected && visible.includes(selected)) targets = [selected];
    else if (!visible.length) { toast('Select a visible mesh to focus the camera.', 'info'); return; }
    else targets = [visible[0]];
  }
  if (!targets.length) { toast('There are no visible meshes to frame.', 'info'); return; }
  const bounds = targets.map(obj => {
    const pos = obj.position || {};
    const sc = obj.scale || {};
    const size = Math.max(0.05, Math.abs(Number(obj.size ?? obj.radius ?? 1) || 1) * Math.max(Math.abs(Number(sc.x) || 1), Math.abs(Number(sc.y) || 1), Math.abs(Number(sc.z) || 1)));
    return { p: [Number(pos.x) || 0, Number(pos.y) || 0, Number(pos.z) || 0], r: size * (obj.type === 'plane' ? 1.1 : obj.type === 'mesh' ? 1.6 : 1.25) };
  });
  const min = [0,1,2].map(axis => Math.min(...bounds.map(b => b.p[axis] - b.r)));
  const max = [0,1,2].map(axis => Math.max(...bounds.map(b => b.p[axis] + b.r)));
  const target = min.map((v, i) => (v + max[i]) / 2);
  const radius = Math.max(0.75, Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) * 0.5);
  const camera = scene.editorCamera || { angle: 0.35, pitch: 0.25, zoom: 7 };
  camera.target = { x: target[0], y: target[1], z: target[2] };
  camera.zoom = Math.max(2.5, Math.min(80, radius / Math.tan(Math.PI / 8) * 1.18));
  if (mode === 'front') { camera.angle = 0; camera.pitch = 0; }
  else if (mode === 'side') { camera.angle = Math.PI / 2; camera.pitch = 0; }
  else if (mode === 'top') { camera.pitch = 1.12; }
  scene.editorCamera = camera;
  persistSceneState(scene);
  recordSceneEdit(scene, mode === 'all' ? 'Frame all meshes' : mode === 'selected' ? 'Focus selected mesh' : `Set ${mode} view`);
  saveLocal();
  setupSceneCanvas(scene);
  setupSceneTransformGizmo(scene, selectedSceneObjectIndex);
  const badge = $('.canvas-badge'); if (badge) badge.innerHTML = '<span class="preview-live-dot"></span> WebGL 3D preview';
}

function serializableSceneObject(obj) {
  const copy={engineId:obj.engineId,type:obj.type,name:obj.name,position:{...(obj.position||{x:0,y:0,z:0})},rotation:{...(obj.rotation||{x:0,y:0,z:0})},scale:{...(obj.scale||{x:1,y:1,z:1})},size:Number(obj.size??obj.radius??1),color:obj.color||'#7c5cff',visible:obj.visible!==false,material:{...(obj.material||{metallic:0.05,roughness:0.68,emissive:0})}};
  if(obj.type==='light'){copy.lightType=['point','directional','spot'].includes(obj.lightType)?obj.lightType:'point';copy.intensity=Math.max(0,Math.min(12,Number.isFinite(Number(obj.intensity))?Number(obj.intensity):1));if(obj.direction&&typeof obj.direction==='object')copy.direction={x:Number.isFinite(Number(obj.direction.x))?Number(obj.direction.x):0,y:Number.isFinite(Number(obj.direction.y))?Number(obj.direction.y):0,z:Number.isFinite(Number(obj.direction.z))?Number(obj.direction.z):0};copy.range=Math.max(.1,Math.min(500,Number.isFinite(Number(obj.range))?Number(obj.range):20));copy.radius=Math.max(0,Math.min(10,Number.isFinite(Number(obj.radius))?Number(obj.radius):0));copy.innerCone=Math.max(0,Math.min(88,Number.isFinite(Number(obj.innerCone))?Number(obj.innerCone):15));copy.outerCone=Math.max(copy.innerCone+1,Math.min(89,Number.isFinite(Number(obj.outerCone))?Number(obj.outerCone):28));}
  if(obj.rigidBody)copy.rigidBody={...obj.rigidBody,velocity:{...(obj.rigidBody.velocity||{x:0,y:0,z:0})}};
  if(obj.controller)copy.controller={...obj.controller};
  if(obj.uvs&&(Array.isArray(obj.uvs)||ArrayBuffer.isView(obj.uvs))&&obj.uvs.length<500000)copy.uvs=Array.from(obj.uvs);
  if(obj.rig&&typeof obj.rig==='object')copy.rig=obj.rig;
  if(obj.animationClip&&typeof obj.animationClip==='object')copy.animationClip=obj.animationClip;
  if(Number.isFinite(obj.animationTime))copy.animationTime=obj.animationTime;
  if(obj.sculptBrush&&typeof obj.sculptBrush==='object')copy.sculptBrush={...obj.sculptBrush,center:{...(obj.sculptBrush.center||{x:0,y:0,z:0})}};
  if(typeof obj.flatShading==='boolean')copy.flatShading=obj.flatShading;if(obj.terrainOptions&&typeof obj.terrainOptions==='object')copy.terrainOptions={...obj.terrainOptions};
  if(obj.assetPath)copy.assetPath=obj.assetPath; else if(obj.type==='mesh'&&(Array.isArray(obj.geometry)||ArrayBuffer.isView(obj.geometry))&&obj.geometry.length<750000)copy.geometry=Array.from(obj.geometry);
  if(Number.isFinite(obj.geometryRevision))copy.geometryRevision=obj.geometryRevision;if(Number.isFinite(obj.uvRevision))copy.uvRevision=obj.uvRevision;
  return copy;
}
function persistSceneState(scene, { clearBaseline = true } = {}) {
  project.sceneState ||= {}; const previous=project.sceneState[scene.name]||{};
  const added=scene.objects.filter(obj=>String(obj.engineId||'').startsWith('added:')).map(serializableSceneObject);
  const overrides={...(previous.overrides||{})};
  for(const obj of scene.objects)if(obj.engineId)overrides[obj.engineId]=serializableSceneObject(obj);
  project.sceneState[scene.name]={additions:added,deleted:[...new Set(previous.deleted||[])],overrides,simulation:{gravity:Number(scene.simulation?.gravity??9.81),collisions:scene.simulation?.collisions!==false},renderSettings:{shadows:scene.renderSettings?.shadows!==false,postProcessing:scene.renderSettings?.postProcessing!==false,fog:scene.renderSettings?.fog===true,exposure:Number(scene.renderSettings?.exposure??1.15),vignette:Number(scene.renderSettings?.vignette??0.22),fogDensity:Number(scene.renderSettings?.fogDensity??0.012),fogColor:scene.renderSettings?.fogColor||'#7788aa',performanceMode:['low','balanced','high','ultra'].includes(scene.renderSettings?.performanceMode)?scene.renderSettings.performanceMode:'balanced',adaptiveResolution:scene.renderSettings?.adaptiveResolution!==false,environmentStrength:Math.max(0,Math.min(2.5,Number(scene.renderSettings?.environmentStrength??1))),shadowSoftness:Math.max(.5,Math.min(2.5,Number(scene.renderSettings?.shadowSoftness??1.25))),shadowResolution:[512,1024,2048].includes(Number(scene.renderSettings?.shadowResolution))?Number(scene.renderSettings.shadowResolution):1024,shadowCasterId:String(scene.renderSettings?.shadowCasterId||'auto').slice(0,200),toneMapping:['aces','agx','filmic'].includes(scene.renderSettings?.toneMapping)?scene.renderSettings.toneMapping:'aces',toneMappingMode:['aces','agx','filmic'].includes(scene.renderSettings?.toneMappingMode)?scene.renderSettings.toneMappingMode:'aces',lumenGI:scene.renderSettings?.lumenGI!==false,bloom:scene.renderSettings?.bloom!==false,bloomStrength:Math.max(0,Math.min(2,Number(scene.renderSettings?.bloomStrength??0.35))),bloomThreshold:Math.max(0,Math.min(1,Number(scene.renderSettings?.bloomThreshold??0.85)))} ,camera:scene.editorCamera?deepCopySceneValue(scene.editorCamera):previous.camera};
  if(scene.simulation)scene.simulation.running=false;if(clearBaseline)simulationBaselines.delete(scene);
}
function hydrateSceneAssets(result) {
  if (!result?.ok) return;
  const assets = Object.entries(project.files).filter(([path]) => /^assets\/.*\.obj$/i.test(path));
  const unclaimedAssets=assets.filter(([path])=>!Object.values(project.sceneState||{}).some(saved=>(saved.additions||[]).some(obj=>obj.assetPath===path)));
  if (unclaimedAssets.length && !result.scenes.length) result.scenes.push({ name: 'Imported Models', objects: [] });
  for(const [sceneName] of Object.entries(project.sceneState||{}))if(!result.scenes.some(scene=>scene.name===sceneName))result.scenes.push({name:sceneName,objects:[],kind:'scene'});
  for (const [path, source] of unclaimedAssets) {
    const scene = result.scenes[0]; if (!scene || scene.objects.some(obj => obj.assetPath === path)) continue;
    try { const mesh = parseOBJ(source, path.split('/').at(-1)); mesh.assetPath=path; scene.objects.push(mesh); }
    catch (error) { result.logs.push({level:'warning',text:`Could not load ${path}: ${error.message}`}); }
  }
  for (const scene of result.scenes) {
    const saved=project.sceneState?.[scene.name]||{}; const deleted=new Set(saved.deleted||[]); const counts=new Map();
    const declarativeComponents=scene.objects.filter(o=>['rigidbody','material','materialGraph','controller','environment'].includes(o.type));
    const sourceObjects=scene.objects.map((obj,index)=>{
      if(!obj.engineId){const key=`${obj.type}:${obj.name}`;const occ=counts.get(key)||0;counts.set(key,occ+1);obj.engineId=`source:${encodeURIComponent(key)}:${occ}`;}
      const legacy=project.sceneOverrides?.[`${scene.name}::${index}`];if(legacy){if(legacy.name)obj.name=legacy.name;if(legacy.position)obj.position={...obj.position,...legacy.position};if(Number.isFinite(legacy.size))obj.size=legacy.size;if(typeof legacy.color==='string')obj.color=legacy.color;if(typeof legacy.visible==='boolean')obj.visible=legacy.visible;}
      const savedObject=saved.overrides?.[obj.engineId];if(savedObject)Object.assign(obj,savedObject,{engineId:obj.engineId});
      if(obj.type==='geometryNodes'){
        try{
          const graph=buildPresetGeometryNodeGraph(obj.preset||'crystal-cluster');
          const evaluated=evaluateGeometryNodeGraph(graph);
          obj.type='mesh';obj.geometry=Array.from(evaluated.geometry);obj.color=obj.color||graph.color||'#56e0e0';obj.material={metallic:0.2,roughness:0.25,clearcoat:0.5,emissive:0.3,...(graph.material||{}),...(obj.material||{})};obj.uvs=generatePlanarUVs(obj.geometry);
        }catch{}
      } else if(obj.type==='vfx'){
        const emitter=createVfxEmitter({id:obj.engineId,name:obj.name,preset:obj.preset||'campfire-sparks',position:obj.position||{x:0,y:0,z:0}});
        stepVfxEmitter(emitter,0.2);
        obj.type='mesh';obj.vfxEmitter=emitter;obj.geometry=Array.from(buildVfxTriangleMesh(emitter));obj.color=emitter.colorStart;obj.material={metallic:0,roughness:0.35,emissive:emitter.emissive,clearcoat:0};
      }
      if(['rigidbody','material','materialGraph','controller','environment'].includes(obj.type))return null;
      return deleted.has(obj.engineId)?null:obj;
    }).filter(Boolean);
    scene.objects=sourceObjects;
    for(const raw of saved.additions||[]){if(!raw?.engineId||deleted.has(raw.engineId))continue;const obj={...raw,position:{...(raw.position||{})},rotation:{...(raw.rotation||{})},scale:{...(raw.scale||{x:1,y:1,z:1})},material:{...(raw.material||{})}};if(obj.type==='mesh'&&!obj.geometry&&obj.assetPath&&project.files[obj.assetPath]){try{obj.geometry=parseOBJ(project.files[obj.assetPath],obj.name).geometry;}catch{}}if(!scene.objects.some(x=>x.engineId===obj.engineId))scene.objects.push(obj);}
    // Declarative component statements target scene entities by name.
    let scriptEnvPreset = null;
    for(const component of declarativeComponents){
      if(component.type==='environment'){scriptEnvPreset=component.preset||'studio';continue;}
      const target=scene.objects.find(o=>o.name===component.target||o.name===component.name);if(!target)continue;
      if(component.type==='rigidbody')target.rigidBody=createRigidBody({enabled:true,...component});
      else if(component.type==='material')target.material={metallic:Number(component.metallic)||0,roughness:Number(component.roughness??.68),emissive:Number(component.emissive)||0};
      else if(component.type==='materialGraph'){try{const graph=buildPresetMaterialGraph(component.preset||'arcane-crystal');const compiled=compileMaterialGraphToPBR(graph,{resolution:24});target.color=compiled.color;target.material={...(target.material||{}),...compiled.material};target.materialGraph=graph;}catch{}}
      else target.controller={speed:Number(component.speed??3),jumpSpeed:Number(component.jumpSpeed??5)};
    }
    scene.objects=scene.objects.filter(o=>!['rigidbody','material','materialGraph','controller','environment'].includes(o.type));
    scene.simulation={running:false,gravity:Number(saved.simulation?.gravity??9.81),collisions:saved.simulation?.collisions!==false,elapsed:0};if(saved.camera&&typeof saved.camera==='object')scene.editorCamera=deepCopySceneValue(saved.camera);scene.renderSettings={shadows:saved.renderSettings?.shadows!==false,postProcessing:saved.renderSettings?.postProcessing!==false,fog:saved.renderSettings?.fog===true,exposure:Number(saved.renderSettings?.exposure??1.15),vignette:Number(saved.renderSettings?.vignette??0.22),fogDensity:Number(saved.renderSettings?.fogDensity??0.012),fogColor:saved.renderSettings?.fogColor||'#7788aa',performanceMode:['low','balanced','high','ultra'].includes(saved.renderSettings?.performanceMode)?saved.renderSettings.performanceMode:'balanced',environmentPreset:['studio','sunset','overcast','night','ember'].includes(saved.renderSettings?.environmentPreset||scriptEnvPreset)?(saved.renderSettings?.environmentPreset||scriptEnvPreset):'studio',adaptiveResolution:saved.renderSettings?.adaptiveResolution!==false,environmentStrength:Math.max(0,Math.min(2.5,Number(saved.renderSettings?.environmentStrength??1))),shadowSoftness:Math.max(.5,Math.min(2.5,Number(saved.renderSettings?.shadowSoftness??1.25))),shadowResolution:[512,1024,2048].includes(Number(saved.renderSettings?.shadowResolution))?Number(saved.renderSettings.shadowResolution):1024,shadowCasterId:String(saved.renderSettings?.shadowCasterId||'auto').slice(0,200),toneMapping:['aces','agx','filmic'].includes(saved.renderSettings?.toneMapping)?saved.renderSettings.toneMapping:'aces',toneMappingMode:['aces','agx','filmic'].includes(saved.renderSettings?.toneMappingMode)?saved.renderSettings.toneMappingMode:'aces',lumenGI:saved.renderSettings?.lumenGI!==false,bloom:saved.renderSettings?.bloom!==false,bloomStrength:Number(saved.renderSettings?.bloomStrength??0.35),bloomThreshold:Number(saved.renderSettings?.bloomThreshold??0.85)};
  }
}
function saveSceneOverride(scene,index,obj){
  project.sceneOverrides ||= {};project.sceneOverrides[`${scene.name}::${index}`]={name:obj.name,position:obj.position?{x:Number(obj.position.x)||0,y:Number(obj.position.y)||0,z:Number(obj.position.z)||0}:undefined,size:Number(obj.size??obj.radius??1),color:obj.color,visible:obj.visible!==false};
  persistSceneState(scene);recordSceneEdit(scene, 'Edit object');saveLocal();
}
function addScenePrimitive(type) {
  const scene=lastResult?.scenes?.[currentSceneIndex];if(!scene)return;
  const obj=createEngineObject(type,++nextEngineObjectId);obj.position={x:((scene.objects.length%4)-1.5)*1.1,y:type==='plane'?-1:0,z:Math.floor(scene.objects.length/4)*-1.15};
  scene.objects.push(obj);selectedSceneObjectIndex=scene.objects.length-1;selectedSceneObjectIndices=new Set([selectedSceneObjectIndex]);persistSceneState(scene);recordSceneEdit(scene,`Add ${obj.type}`);saveLocal(true);renderSceneTab(lastResult);toast(`${obj.name} created in Orvexa Forge.`, 'success');
}
function addProceduralTerrain() {
  const scene=lastResult?.scenes?.[currentSceneIndex];if(!scene)return;
  const obj=createEngineObject('mesh',++nextEngineObjectId);obj.name='Procedural Terrain';obj.position={x:0,y:-0.65,z:0};obj.size=1;obj.color='#64884b';obj.material={metallic:0,roughness:0.94,emissive:0,clearcoat:0};obj.geometry=Array.from(createProceduralTerrainGeometry({width:18,depth:18,segments:32,amplitude:2.3,seed:1337,frequency:2.4}));obj.geometryRevision=1;obj.terrainOptions={width:18,depth:18,segments:32,amplitude:2.3,seed:1337,frequency:2.4};obj.flatShading=false;scene.objects.push(obj);selectedSceneObjectIndex=scene.objects.length-1;selectedSceneObjectIndices=new Set([selectedSceneObjectIndex]);persistSceneState(scene);recordSceneEdit(scene,'Generate terrain');saveLocal(true);renderSceneTab(lastResult);toast('Procedural terrain generated (2,048 triangles). Change its sculpt brush or export it as GLB/OBJ.','success');
}
function addProceduralGeoNodeCluster() {
  const scene=lastResult?.scenes?.[currentSceneIndex];if(!scene)return;
  const graph=buildPresetGeometryNodeGraph('crystal-cluster');
  const evaluated=evaluateGeometryNodeGraph(graph);
  const obj=createEngineObject('mesh',++nextEngineObjectId);obj.name='Sunshard Crystal Cluster';obj.position={x:0,y:0.2,z:0};obj.size=1;obj.color=graph.color;obj.material={...graph.material};obj.geometry=Array.from(evaluated.geometry);obj.uvs=generatePlanarUVs(obj.geometry);obj.geometryRevision=1;scene.objects.push(obj);selectedSceneObjectIndex=scene.objects.length-1;selectedSceneObjectIndices=new Set([selectedSceneObjectIndex]);persistSceneState(scene);recordSceneEdit(scene,'Add Geometry Nodes cluster');saveLocal(true);renderSceneTab(lastResult);toast(`Procedural Geometry Nodes cluster spawned (${evaluated.triangleCount} triangles).`,'success');
}
function addSceneVfxEmitter() {
  const scene=lastResult?.scenes?.[currentSceneIndex];if(!scene)return;
  const obj=createEngineObject('mesh',++nextEngineObjectId);obj.name='Arcane VFX Emitter';obj.position={x:0,y:0.4,z:0};obj.size=1;
  const emitter=createVfxEmitter({id:obj.engineId,name:obj.name,preset:'arcane-wisps',position:{x:0,y:0,z:0}});
  stepVfxEmitter(emitter,0.25);
  obj.vfxEmitter=emitter;obj.geometry=Array.from(buildVfxTriangleMesh(emitter));obj.color=emitter.colorStart;obj.material={metallic:0,roughness:0.3,emissive:emitter.emissive,clearcoat:0};obj.geometryRevision=1;scene.objects.push(obj);selectedSceneObjectIndex=scene.objects.length-1;selectedSceneObjectIndices=new Set([selectedSceneObjectIndex]);persistSceneState(scene);recordSceneEdit(scene,'Add VFX emitter');saveLocal(true);renderSceneTab(lastResult);toast('Live budgeted VFX emitter added to scene.','success');
}
function applyMaterialPreset(scene,obj,presetName) {
  if(!obj)return;const presets={matte:{color:'#8a8b95',metallic:0.02,roughness:0.88,emissive:0,clearcoat:0},chrome:{color:'#c9d2df',metallic:0.98,roughness:0.13,emissive:0,clearcoat:0.32},gold:{color:'#d6a640',metallic:0.92,roughness:0.24,emissive:0,clearcoat:0.2},ceramic:{color:'#e5e9f2',metallic:0.04,roughness:0.2,emissive:0,clearcoat:0.82},rubber:{color:'#292d34',metallic:0,roughness:0.97,emissive:0,clearcoat:0},neon:{color:'#45ffe2',metallic:0.08,roughness:0.26,emissive:1.6,clearcoat:0.35}};const preset=presets[presetName];if(!preset)return;obj.color=preset.color;obj.material={...(obj.material||{}),metallic:preset.metallic,roughness:preset.roughness,emissive:preset.emissive,clearcoat:preset.clearcoat};delete obj.material.emissiveTint;persistSceneState(scene);saveSceneOverride(scene,selectedSceneObjectIndex,obj);saveLocal();renderSceneTab(lastResult);toast(`${presetName[0].toUpperCase()+presetName.slice(1)} material applied.`,'success');
}
function handleModelTool(tool,scene,obj) {
  if(!obj)return;
  try {
    if(tool==='convert'){
      if(obj.type!=='mesh'){const sourceType=obj.type;obj.geometry=Array.from(createMeshGeometry(sourceType,32));obj.sourcePrimitive=sourceType;obj.type='mesh';obj.assetPath=undefined;obj.uvs=undefined;obj.rig=undefined;obj.geometryRevision=(obj.geometryRevision||0)+1;}
    } else {
      if(obj.type!=='mesh'){const sourceType=obj.type;obj.geometry=Array.from(createMeshGeometry(sourceType,32));obj.sourcePrimitive=sourceType;obj.type='mesh';obj.assetPath=undefined;obj.uvs=undefined;obj.rig=undefined;obj.geometryRevision=(obj.geometryRevision||0)+1;}
      if(tool==='optimize') {const optimized=optimizeTriangleMesh(obj.geometry);obj.geometry=Array.from(optimized.geometry);obj.geometryRevision=(obj.geometryRevision||0)+1;obj.uvs=undefined;obj.rig=undefined;obj.terrainOptions=undefined;obj.__optimizationResult={before:optimized.beforeTriangles,after:optimized.afterTriangles,removedDegenerate:optimized.removedDegenerate,removedDuplicate:optimized.removedDuplicate};}
      else if(tool==='subdivide') {obj.geometry=subdivideTriangleMesh(obj.geometry);obj.geometryRevision=(obj.geometryRevision||0)+1;obj.uvs=undefined;}
      else if(tool==='mirror-x'||tool==='mirror-y'||tool==='mirror-z') {obj.geometry=mirrorTriangleMesh(obj.geometry,tool.at(-1));obj.geometryRevision=(obj.geometryRevision||0)+1;obj.uvs=undefined;}
      else if(tool.startsWith('mirror-dup-')) {obj.geometry=mirrorDuplicateTriangleMesh(obj.geometry,tool.at(-1));obj.geometryRevision=(obj.geometryRevision||0)+1;obj.uvs=undefined;obj.rig=undefined;}
      else if(tool==='uv') {obj.uvs=generatePlanarUVs(obj.geometry);obj.uvRevision=(obj.uvRevision||0)+1;}
      else if(tool.startsWith('sculpt-')) {const mode=({'sculpt-up':'raise','sculpt-down':'lower','sculpt-smooth':'smooth','sculpt-inflate':'inflate','sculpt-flatten':'flatten'})[tool];obj.sculptBrush={radius:Math.max(.01,Math.min(10,Number($('#sculptRadius')?.value??obj.sculptBrush?.radius??.9))),strength:Math.max(.01,Math.min(1,Number($('#sculptStrength')?.value??obj.sculptBrush?.strength??.16))),center:{x:Number($('#sculptCenterX')?.value??0)||0,y:Number($('#sculptCenterY')?.value??0)||0,z:Number($('#sculptCenterZ')?.value??0)||0}};const result=sculptTriangleMesh(obj.geometry,{mode,...obj.sculptBrush});obj.geometry=result.geometry;obj.geometryRevision=(obj.geometryRevision||0)+1;obj.rig=undefined;}
      else if(tool==='rig') {obj.rig=createBasicRig(obj.geometry);}
      else if(tool.startsWith('weight-')) {if(!obj.rig)obj.rig=createBasicRig(obj.geometry);const boneName=tool.slice(7).replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase());const result=paintRigWeights(obj.geometry,obj.rig,boneName,{center:{x:Number($('#sculptCenterX')?.value??obj.sculptBrush?.center?.x)||0,y:Number($('#sculptCenterY')?.value??obj.sculptBrush?.center?.y)||0,z:Number($('#sculptCenterZ')?.value??obj.sculptBrush?.center?.z)||0},radius:Number($('#sculptRadius')?.value??obj.sculptBrush?.radius??0.9),strength:Number($('#sculptStrength')?.value??obj.sculptBrush?.strength??0.16)});obj.rig=result.rig;}
      else if(tool==='anim-walk') {if(!obj.rig)obj.rig=createBasicRig(obj.geometry);obj.animationClip=createAnimationClip(obj.rig,'Walk Cycle',{leftArm:[{time:0,pose:{z:-0.42}},{time:0.5,pose:{z:0.42}},{time:1,pose:{z:-0.42}}],rightArm:[{time:0,pose:{z:0.42}},{time:0.5,pose:{z:-0.42}},{time:1,pose:{z:0.42}}],leftLeg:[{time:0,pose:{z:0.34}},{time:0.5,pose:{z:-0.34}},{time:1,pose:{z:0.34}}],rightLeg:[{time:0,pose:{z:-0.34}},{time:0.5,pose:{z:0.34}},{time:1,pose:{z:-0.34}}]},1);const result=applyAnimationClip(obj.geometry,obj.rig,obj.animationClip,0.25);obj.rig=result.rig;obj.geometry=result.geometry;obj.animationTime=0.25;obj.geometryRevision=(obj.geometryRevision||0)+1;}
      else if(tool==='anim-sample') {if(!obj.rig||!obj.animationClip)throw new Error('Create a rig and animation clip first.');const time=Number($('#animationTime')?.value??0.5);const result=applyAnimationClip(obj.geometry,obj.rig,obj.animationClip,time);obj.rig=result.rig;obj.geometry=result.geometry;obj.animationTime=result.time;obj.geometryRevision=(obj.geometryRevision||0)+1;}
      else if(tool.startsWith('pose-')) {if(!obj.rig)obj.rig=createBasicRig(obj.geometry);const boneName=tool.slice(5).replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase());const bone=obj.rig.bones.find(b=>b.name===boneName);if(!bone)throw new Error(`Rig bone ${boneName} is unavailable for this mesh.`);const result=bakeRigPose(obj.geometry,obj.rig,boneName,{...(bone.pose||{}),z:(Number(bone.pose?.z)||0)+0.45});obj.geometry=result.geometry;obj.geometryRevision=(obj.geometryRevision||0)+1;}
      else if(tool==='rig-reset') {if(obj.rig?.restGeometry){obj.geometry=[...obj.rig.restGeometry];for(const bone of obj.rig.bones||[])bone.pose={x:0,y:0,z:0};obj.geometryRevision=(obj.geometryRevision||0)+1;}else throw new Error('Create a biped rig first.');}
    }
    saveSceneOverride(scene,selectedSceneObjectIndex,obj);saveLocal(true);renderSceneTab(lastResult);
    const labels={optimize:`Mesh optimized: ${obj.__optimizationResult?.before??0} → ${obj.__optimizationResult?.after??0} triangles`,uv:'Planar UV coordinates generated',rig:'Seven-bone rig with normalized multi-influence weights created', 'sculpt-up':'Sculpt brush raise applied','sculpt-down':'Sculpt brush lower applied','sculpt-smooth':'Neighbour-aware sculpt smoothing applied','sculpt-inflate':'Sculpt inflate applied','sculpt-flatten':'Sculpt flatten applied','rig-reset':'Rig pose reset','anim-walk':'Keyframed walk-cycle clip created and sampled','anim-sample':'Animation clip sampled at the selected time'};
    toast(labels[tool]||(tool.startsWith('weight-')?`Painted normalized ${tool.slice(7)} skin weights.`:tool.startsWith('pose-')?'Rig pose evaluated and baked into the mesh.':tool==='subdivide'?'Mesh subdivided into four triangles per source triangle.':`Model tool applied: ${tool}.`),'success');
  } catch(error){toast(`Model tool failed: ${error.message}`,'error');}
}
function applySelectedObjectTransform(scene, obj) {
  if (!scene || !obj) return;
  try {
    const sourceType = obj.type;
    const sourceGeometry = sourceType === 'mesh' ? obj.geometry : Array.from(createMeshGeometry(sourceType, 32));
    const geometry = bakeTriangleMeshTransform(sourceGeometry, obj);
    const uvs = Array.isArray(obj.uvs) && obj.uvs.length === geometry.length / 3 * 2 ? [...obj.uvs] : generatePlanarUVs(geometry);
    obj.geometry = geometry;
    obj.type = 'mesh';
    if (sourceType !== 'mesh') obj.sourcePrimitive = sourceType;
    delete obj.assetPath;
    obj.uvs = uvs;
    obj.position ||= { x: 0, y: 0, z: 0 };
    obj.rotation = { x: 0, y: 0, z: 0 };
    obj.scale = { x: 1, y: 1, z: 1 };
    obj.size = 1;
    delete obj.rig;
    delete obj.animationClip;
    delete obj.animationTime;
    delete obj.terrainOptions;
    obj.geometryRevision = (obj.geometryRevision || 0) + 1;
    obj.uvRevision = (obj.uvRevision || 0) + 1;
    persistSceneState(scene);
    recordSceneEdit(scene, 'Apply rotation and scale');
    saveLocal(true);
    renderSceneTab(lastResult);
    toast(`Applied rotation and scale to ${obj.name}. Position stayed unchanged.`, 'success');
  } catch (error) { toast(`Could not apply transform: ${error.message}`, 'error'); }
}

function joinSelectedSceneObjects(scene) {
  if (!scene) return;
  try {
    const chosen = new Set(selectedSceneObjectIndices);
    if (!chosen.has(selectedSceneObjectIndex) && scene.objects[selectedSceneObjectIndex]) chosen.add(selectedSceneObjectIndex);
    if (chosen.size < 2) throw new Error('Tick at least two objects in the hierarchy first.');
    const eligibleTypes = new Set(['cube', 'sphere', 'plane', 'cylinder', 'torus', 'cone', 'pyramid', 'capsule', 'mesh']);
    const indexes = [...chosen].filter(index => Number.isInteger(index) && index >= 0 && index < scene.objects.length).sort((a, b) => a - b);
    if (indexes.some(index => !eligibleTypes.has(scene.objects[index]?.type))) throw new Error('Join supports mesh objects and primitives only. Remove cameras/lights from the selection.');
    if (indexes.some(index => scene.objects[index]?.visible === false)) throw new Error('Unhide selected objects before joining them.');
    if (indexes.some(index => scene.objects[index]?.rigidBody?.enabled || scene.objects[index]?.controller)) throw new Error('Disable rigid bodies and player controllers before joining these objects.');
    const activeIndex = selectedSceneObjectIndex;
    const active = scene.objects[activeIndex];
    const entries = indexes.map(index => {
      const obj = scene.objects[index];
      const geometry = obj.type === 'mesh' ? obj.geometry : Array.from(createMeshGeometry(obj.type, 32));
      return { ...obj, geometry };
    });
    const joined = joinTriangleMeshes(entries, { maxFloats: 60_000 });
    const mergedUVs = [];
    for (const entry of entries) {
      const uv = Array.isArray(entry.uvs) && entry.uvs.length === entry.geometry.length / 3 * 2 ? entry.uvs : generatePlanarUVs(entry.geometry);
      for (let i = 0; i < uv.length; i++) mergedUVs.push(uv[i]);
    }
    // Keep the active object identity/material; a single render object can carry only one material in this engine.
    active.geometry = joined.geometry;
    active.uvs = mergedUVs;
    active.type = 'mesh';
    active.position = { x: 0, y: 0, z: 0 };
    active.rotation = { x: 0, y: 0, z: 0 };
    active.scale = { x: 1, y: 1, z: 1 };
    active.size = 1;
    delete active.assetPath;
    delete active.sourcePrimitive;
    delete active.terrainOptions;
    delete active.rig;
    delete active.animationClip;
    delete active.animationTime;
    delete active.rigidBody;
    delete active.controller;
    active.geometryRevision = (active.geometryRevision || 0) + 1;
    active.uvRevision = (active.uvRevision || 0) + 1;
    const removed = indexes.filter(index => index !== activeIndex).map(index => scene.objects[index]);
    project.sceneState ||= {};
    const savedState = project.sceneState[scene.name] || { additions: [], deleted: [], overrides: {} };
    savedState.deleted ||= [];
    savedState.overrides ||= {};
    for (const obj of removed) {
      if (obj.engineId && !String(obj.engineId).startsWith('added:')) savedState.deleted.push(obj.engineId);
      if (obj.engineId) delete savedState.overrides[obj.engineId];
    }
    savedState.deleted = [...new Set(savedState.deleted)];
    project.sceneState[scene.name] = savedState;
    const removeSet = new Set(removed);
    scene.objects = scene.objects.filter(obj => !removeSet.has(obj));
    selectedSceneObjectIndex = scene.objects.indexOf(active);
    selectedSceneObjectIndices = new Set([selectedSceneObjectIndex]);
    persistSceneState(scene);
    recordSceneEdit(scene, `Join ${joined.objectCount} meshes`);
    saveLocal(true);
    renderSceneTab(lastResult);
    toast(`Joined ${joined.objectCount} objects into ${active.name} (${joined.triangleCount.toLocaleString()} triangles). Active object's material is used for the result.`, 'success');
  } catch (error) { toast(`Could not join objects: ${error.message}`, 'error'); }
}

function duplicateSceneObject(scene,obj) {
  if(!obj)return;const copy=serializableSceneObject(obj);copy.engineId=`added:${Date.now().toString(36)}:${(++nextEngineObjectId).toString(36)}`;copy.name=`${obj.name} Copy`;copy.position.x=(Number(copy.position.x)||0)+0.6;copy.position.z=(Number(copy.position.z)||0)+0.25;
  const clone={...copy};if(obj.geometry)clone.geometry=[...obj.geometry];if(obj.uvs)clone.uvs=[...obj.uvs];if(obj.rig)clone.rig=JSON.parse(JSON.stringify(obj.rig));scene.objects.push(clone);selectedSceneObjectIndex=scene.objects.length-1;selectedSceneObjectIndices=new Set([selectedSceneObjectIndex]);persistSceneState(scene);recordSceneEdit(scene,'Duplicate object');saveLocal(true);renderSceneTab(lastResult);toast('Object duplicated.', 'success');
}
function deleteSceneObject(scene,obj) {
  if(!obj)return;const id=obj.engineId;project.sceneState ||= {};const state=project.sceneState[scene.name]||{additions:[],deleted:[],overrides:{}};if(id&&!String(id).startsWith('added:'))state.deleted=[...new Set([...(state.deleted||[]),id])];if(id&&state.overrides)delete state.overrides[id];project.sceneState[scene.name]=state;scene.objects=scene.objects.filter(x=>x!==obj);selectedSceneObjectIndex=Math.max(0,Math.min(selectedSceneObjectIndex,scene.objects.length-1));selectedSceneObjectIndices=new Set(scene.objects.length?[selectedSceneObjectIndex]:[]);persistSceneState(scene);recordSceneEdit(scene,'Delete object');saveLocal(true);renderSceneTab(lastResult);toast('Object removed from the scene.', 'success');
}
function handleSimulationAction(action,scene) {
  scene.simulation ||= {running:false,gravity:9.81,collisions:true,elapsed:0};
  if(action==='play'){
    if(!simulationBaselines.has(scene))simulationBaselines.set(scene,scene.objects.map(o=>({engineId:o.engineId,position:{...(o.position||{x:0,y:0,z:0})},velocity:{...(o.rigidBody?.velocity||{x:0,y:0,z:0})}})));
    scene.simulation.running=true;setupSceneCanvas(scene);renderSceneTab(lastResult);toast('Simulation running. Pause to save its current state.', 'success');return;
  }
  if(action==='pause'){pauseScene(scene,true);renderSceneTab(lastResult);return;}
  if(action==='step'){scene.simulation.running=false;advancePhysics(scene,1/60,{gravity:scene.simulation.gravity,collisions:scene.simulation.collisions});persistSceneState(scene,{clearBaseline:false});recordSceneEdit(scene,'Step simulation');saveLocal(true);renderSceneTab(lastResult);return;}
  if(action==='reset'){
    scene.simulation.running=false;const baseline=simulationBaselines.get(scene);if(baseline)for(const saved of baseline){const obj=scene.objects.find(o=>o.engineId===saved.engineId);if(obj){obj.position={...saved.position};if(obj.rigidBody)obj.rigidBody.velocity={...saved.velocity};}}
    scene.simulation.elapsed=0;persistSceneState(scene);recordSceneEdit(scene,'Reset simulation');saveLocal(true);setupSceneCanvas(scene);renderSceneTab(lastResult);toast('Simulation reset to its start positions.', 'success');
  }
}
function pauseScene(scene,save=true) {
  if(!scene)return;scene.simulation ||= {};scene.simulation.running=false;if(save){persistSceneState(scene,{clearBaseline:false});recordSceneEdit(scene,'Pause simulation');saveLocal(true);toast('Simulation paused; current transforms saved.', 'success');}
}

async function importSceneAsset(file) {
  try {
    const ext=file.name.toLowerCase().split('.').pop(); let meshes=[]; let textSource='';
    if(ext==='obj'){textSource=await file.text();meshes=[parseOBJ(textSource,file.name)];}
    else if(ext==='glb'){meshes=importGLTF(new Uint8Array(await file.arrayBuffer()),file.name);}
    else if(ext==='gltf'){textSource=await file.text();meshes=importGLTF(textSource,file.name);}
    else if(ext==='fbx'){textSource=await file.text();meshes=importFBX(textSource,file.name);}
    else throw new Error('Supported mesh formats are OBJ, GLB, embedded glTF and ASCII FBX.');
    if(!lastResult?.ok||!lastResult.scenes?.length){toast('Run a program with a scene first, then import the 3D model.','warning');return;}
    const scene=lastResult.scenes[currentSceneIndex]||lastResult.scenes[0];
    if(!Array.isArray(meshes)||!meshes.length)throw new Error('The file has no supported mesh primitives.');
    for(const mesh of meshes){
      if(mesh.geometry.length>750000)throw new Error('This mesh is over the 250,000-vertex editable limit. Export a lower-detail model and retry.');
      mesh.engineId=`added:${Date.now().toString(36)}:${(++nextEngineObjectId).toString(36)}`;
      if(ext==='obj'){const path=normalizePath(`assets/${file.name.replace(/[^a-z0-9._-]/gi,'-').slice(0,100)}`);project.files[path]=textSource;project.folders ||= [];if(!project.folders.includes('assets'))project.folders.push('assets');mesh.assetPath=path;}
      else if((ext==='gltf'||ext==='fbx')&&textSource&&textSource.length<1_900_000){const path=normalizePath(`assets/${file.name.replace(/[^a-z0-9._-]/gi,'-').slice(0,100)}`);project.files[path]=textSource;project.folders ||= [];if(!project.folders.includes('assets'))project.folders.push('assets');}
      scene.objects.push(mesh);
    }
    selectedSceneObjectIndex=scene.objects.length-1;selectedSceneObjectIndices=new Set([selectedSceneObjectIndex]);persistSceneState(scene);recordSceneEdit(scene,`Import ${ext.toUpperCase()} model`);saveLocal(true);renderTree();renderSceneTab(lastResult);
    toast(`Imported ${meshes.length} model${meshes.length===1?'':' meshes'} from ${ext.toUpperCase()}. Convert meshes, generate UVs, sculpt, or create a basic rig.`, 'success');
  } catch(error) { toast(`3D asset import failed: ${error.message}`, 'error'); }
}
function exportStandaloneGame() {
  try {
    const scene=lastResult?.scenes?.[currentSceneIndex];if(!scene)throw new Error('Open or create a 3D scene before building a game.');
    const blob=buildStandaloneGame(scene,`${scene.name||project.name} · Orvexa Game`);
    downloadBlob(blob,`${safeFilename(scene.name||project.name)}-Playable-Game.zip`);
    toast('Standalone playable HTML game ZIP created. Extract it and open index.html or host the folder.', 'success');
  } catch(error) { toast(`Game build failed: ${error.message}`, 'error'); }
}

async function openPathTraceDialog(scene) {
  document.querySelector('.pathtrace-backdrop')?.remove();
  const abortController = new AbortController();
  const backdrop = document.createElement('div'); backdrop.className = 'pathtrace-backdrop'; backdrop.innerHTML = `<section class="pathtrace-dialog" role="dialog" aria-modal="true" aria-label="Offline path tracing"><div class="pathtrace-head"><div><span class="eyebrow">ORVEXA FORGE · OFFLINE RENDER</span><h2>Path Trace Render</h2><p>Triangle BVH · hard-shadow rays · indirect light bounces · filmic output</p></div><button class="scene-action" id="pathTraceClose">Close</button></div><div class="pathtrace-controls"><label>Quality<select id="pathTraceQuality"><option value="mobile">Mobile preview · 96×72 · 2 samples</option><option value="balanced">Balanced · 160×112 · 2 samples</option><option value="high">High · 256×176 · 3 samples</option><option value="ultra">Ultra · 320×224 · 4 samples</option></select></label><button id="pathTraceRun" class="scene-action forge-build-game">Render image</button><button id="pathTraceDownload" class="scene-action" disabled>Download PNG</button><span id="pathTraceStatus" role="status">Ready to render. High settings can take a long time on mobile.</span></div><div class="pathtrace-canvas-wrap"><canvas id="pathTraceCanvas" aria-label="Offline path-traced scene result" width="96" height="72"></canvas></div><div class="pathtrace-footer" id="pathTraceStats">No render yet. Objects: ${(scene.objects||[]).filter(o=>o.visible!==false&&!['camera','light','animation','rigidbody','material','controller'].includes(o.type)).length}</div></section>`;
  document.body.append(backdrop);
  const close = () => { abortController.abort(); backdrop.remove(); };
  $('#pathTraceClose', backdrop).addEventListener('click', close);
  backdrop.addEventListener('click', event => { if (event.target === backdrop) close(); });
  const canvas = $('#pathTraceCanvas', backdrop), status = $('#pathTraceStatus', backdrop), stats = $('#pathTraceStats', backdrop), runButton = $('#pathTraceRun', backdrop), downloadButton = $('#pathTraceDownload', backdrop);
  let latestRendered = false, renderToken = 0;
  const presets = { mobile: {width:96,height:72,samples:2,bounces:2}, balanced:{width:160,height:112,samples:2,bounces:3}, high:{width:256,height:176,samples:3,bounces:4}, ultra:{width:320,height:224,samples:4,bounces:5} };
  runButton.addEventListener('click', async () => {
    const token = ++renderToken; const params = presets[$('#pathTraceQuality', backdrop).value] || presets.mobile;
    runButton.disabled = true; downloadButton.disabled = true; latestRendered = false; stats.textContent = 'Building BVH and tracing the scene…'; status.textContent = 'Preparing triangles…';
    try {
      const render = await renderPathTracedImage(scene, {...params, exposure: Number(scene.renderSettings?.exposure ?? 1.15), signal: abortController.signal, onProgress: progress => { if (token === renderToken && status.isConnected) status.textContent = `Tracing scanlines: ${progress.percent}% · ${progress.rays.toLocaleString()} path rays`; }});
      if (token !== renderToken || !canvas.isConnected) return;
      canvas.width = render.width; canvas.height = render.height;
      const context = canvas.getContext('2d');
      let imageData;
      try { imageData = new ImageData(render.pixels, render.width, render.height); } catch { imageData = context.createImageData(render.width, render.height); imageData.data.set(render.pixels); }
      context.putImageData(imageData,0,0); latestRendered = true; downloadButton.disabled = false;
      status.textContent = 'Render complete'; stats.textContent = `${render.stats.triangleCount.toLocaleString()} triangles · ${render.stats.lightCount} lights · ${render.stats.samples} samples · ${render.stats.bounces} bounces · ${render.stats.rays.toLocaleString()} path rays · indirect GI and shadow rays enabled.`;
    } catch (error) {
      if (token === renderToken && status.isConnected) { status.textContent = error.message || 'Render failed'; stats.textContent = 'Reduce mesh density or choose a faster quality preset if the scene is too large.'; }
    } finally { if (runButton.isConnected) runButton.disabled = false; }
  });
  downloadButton.addEventListener('click', () => {
    if (!latestRendered) return;
    canvas.toBlob(blob => { if (!blob) { toast('Could not encode this render as PNG.','error'); return; } downloadBlob(blob, `${safeFilename(scene.name || 'Orvexa-Path-Trace')}-path-trace.png`); toast('Path-traced PNG downloaded.','success'); }, 'image/png');
  });
}

function exportSelectedOBJ() {
  try {
    const scene=lastResult?.scenes?.[currentSceneIndex]; const obj=scene?.objects?.[selectedSceneObjectIndex];
    if(!obj) throw new Error('Select an object first.');
    const geometry=obj.type==='mesh'?obj.geometry:Array.from(createMeshGeometry(obj.type));
    const exportable={...obj,type:'mesh',geometry};
    downloadBlob(new Blob([exportOBJ(exportable)],{type:'text/plain;charset=utf-8'}),`${safeFilename(obj.name)}.obj`);
    toast(`Exported ${obj.name} as OBJ.`, 'success');
  } catch(error) { toast(`OBJ export failed: ${error.message}`, 'error'); }
}

function exportSelectedGLB() {
  try { const scene=lastResult?.scenes?.[currentSceneIndex],obj=scene?.objects?.[selectedSceneObjectIndex];if(!obj)throw new Error('Select a mesh first.');const geometry=obj.type==='mesh'?obj.geometry:Array.from(createMeshGeometry(obj.type,32));const bytes=exportGLB({...obj,type:'mesh',geometry});downloadBlob(new Blob([bytes],{type:'model/gltf-binary'}),`${safeFilename(obj.name)}.glb`);toast(`Exported ${obj.name} as GLB with generated or authored UVs and material settings.`, 'success'); }
  catch(error){toast(`GLB export failed: ${error.message}`,'error');}
}
function exportSelectedFBX() {
  try { const scene=lastResult?.scenes?.[currentSceneIndex],obj=scene?.objects?.[selectedSceneObjectIndex];if(!obj)throw new Error('Select a mesh first.');const geometry=obj.type==='mesh'?obj.geometry:Array.from(createMeshGeometry(obj.type,32));downloadBlob(new Blob([exportFBX({...obj,type:'mesh',geometry})],{type:'text/plain;charset=utf-8'}),`${safeFilename(obj.name)}.fbx`);toast(`Exported ${obj.name} as ASCII FBX mesh.`, 'success'); }
  catch(error){toast(`FBX export failed: ${error.message}`,'error');}
}
async function exportAndroidProject() {
  try { const scene=lastResult?.scenes?.[currentSceneIndex];if(!scene)throw new Error('Open or create a 3D scene before building its Android project.');const blob=await buildAndroidProjectZip(scene,`${scene.name||project.name} · Orvexa Game`);downloadBlob(blob,`${safeFilename(scene.name||project.name)}-Android-APK-Project.zip`);toast('Android project ZIP created. On a phone, upload its extracted OrvexaGame contents to GitHub and download the APK from the included Actions workflow.', 'success'); }
  catch(error){toast(`Android project export failed: ${error.message}`,'error');}
}

function stopSceneAnimation() { if (currentCanvasFrame) cancelAnimationFrame(currentCanvasFrame); currentCanvasFrame = 0; if (currentSceneCleanup) currentSceneCleanup(); currentSceneCleanup = null; }
function startSceneAnimation() { if (currentRightTab === 'scene' && lastResult?.scenes?.length && !currentCanvasFrame) setupSceneCanvas(lastResult.scenes[currentSceneIndex] || lastResult.scenes[0]); }
function setupSceneCanvas(scene) {
  stopSceneAnimation(); const canvas = $('#sceneCanvas'); if (!canvas) return;
  if (canvas.dataset.cameraPersistenceBound !== '1') {
    canvas.dataset.cameraPersistenceBound = '1';
    const queueCameraSave = () => { clearTimeout(cameraPersistTimer); cameraPersistTimer = setTimeout(() => { const activeScene=lastResult?.scenes?.[currentSceneIndex]; if(activeScene?.editorCamera){persistSceneState(activeScene);saveLocal();} }, 320); };
    canvas.addEventListener('orvexa-camera-change', queueCameraSave);
    canvas.addEventListener('orvexa-camera-preview', () => drawSceneTransformGizmo(scene, selectedSceneObjectIndex));
    canvas.addEventListener('orvexa-scene-change', () => { try { drawSceneTransformGizmo(scene, selectedSceneObjectIndex); } catch {} });
    canvas.addEventListener('wheel', queueCameraSave, { passive: true });
  }
  const stopWebGL = startWebGLScene(canvas, scene);
  if (stopWebGL) { canvas.dataset.renderer = 'webgl'; currentSceneCleanup = stopWebGL; const badge = $('.canvas-badge'); if (badge) badge.innerHTML = '<span class="preview-live-dot"></span> WebGL 3D preview'; return; }
  canvas.dataset.renderer = 'fallback';
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  const badge = $('.canvas-badge'); if (badge) badge.innerHTML = '<span class="preview-live-dot"></span> 2D fallback preview';
  let angleOffset = 0, dragging = false, lastX = 0, lastY = 0, zoom = 1;
  const redraw = (time) => {
    if (!canvas.isConnected || currentRightTab !== 'scene') { stopSceneAnimation(); return; }
    const rect = canvas.getBoundingClientRect(); const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.max(1, Math.floor(rect.width * dpr)) || canvas.height !== Math.max(1, Math.floor(rect.height * dpr))) { canvas.width = Math.max(1, Math.floor(rect.width * dpr)); canvas.height = Math.max(1, Math.floor(rect.height * dpr)); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); const w = rect.width, h = rect.height;
    ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#11121e'; ctx.fillRect(0, 0, w, h);
    const gradient = ctx.createRadialGradient(w * .5, h * .42, 0, w * .5, h * .42, Math.max(w, h) * .68); gradient.addColorStop(0, '#292344'); gradient.addColorStop(1, '#11121e'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
    const origin = { x: w / 2, y: h * .54 }; const scale = Math.min(w, h) * .20 * zoom;
    ctx.strokeStyle = '#34334d'; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = -6; x <= 6; x++) { const a = projectScene({ x, y: -1.15, z: -6 }, origin, scale, angleOffset); const b = projectScene({ x, y: -1.15, z: 6 }, origin, scale, angleOffset); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
    for (let z = -6; z <= 6; z++) { const a = projectScene({ x: -6, y: -1.15, z }, origin, scale, angleOffset); const b = projectScene({ x: 6, y: -1.15, z }, origin, scale, angleOffset); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
    ctx.stroke();
    const visible = scene.objects.filter((obj) => obj.visible !== false && !['camera', 'animation', 'light', 'rigidbody', 'material'].includes(obj.type));
    visible.forEach((obj) => drawSceneObject(ctx, obj, scene.objects, origin, scale, angleOffset, time));
    if (!dragging) angleOffset += .0026;
    currentCanvasFrame = requestAnimationFrame(redraw);
  };
  canvas.onpointerdown = (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; canvas.setPointerCapture(e.pointerId); };
  canvas.onpointermove = (e) => { if (!dragging) return; angleOffset += (e.clientX - lastX) * .012; lastX = e.clientX; lastY = e.clientY; };
  canvas.onpointerup = () => { dragging = false; };
  canvas.onpointercancel = () => { dragging = false; };
  canvas.onwheel = (e) => { e.preventDefault(); zoom = Math.max(.45, Math.min(2.1, zoom - e.deltaY * .001)); };
  currentCanvasFrame = requestAnimationFrame(redraw);
}
function projectScene(point, origin, scale, angle) {
  const ca = Math.cos(angle), sa = Math.sin(angle);
  const rx = point.x * ca - point.z * sa; const rz = point.x * sa + point.z * ca;
  const cy = Math.cos(-.45), sy = Math.sin(-.45); const ry = point.y * cy - rz * sy; const dz = point.y * sy + rz * cy;
  const perspective = 4.8 / (4.8 + dz * .09);
  return { x: origin.x + rx * scale * perspective, y: origin.y - ry * scale * perspective, z: dz };
}
function drawSceneObject(ctx, obj, objects, origin, scale, angle, time) {
  const pos = obj.position || { x: 0, y: 0, z: 0 }; const color = safeCssColor(obj.color || '#7c5cff');
  const a = angle * Number((objects.find((x) => x.type === 'animation' && x.name === obj.name)?.speed) ?? .2);
  const size = Math.max(.05, Number(obj.size ?? obj.radius ?? 1));
  if (obj.type === 'sphere') {
    const center = projectScene({ x: Number(pos.x || 0), y: Number(pos.y || 0), z: Number(pos.z || 0) }, origin, scale, angle);
    const r = size * scale * .45; const g = ctx.createRadialGradient(center.x - r * .3, center.y - r * .35, r * .05, center.x, center.y, r);
    g.addColorStop(0, lightenColor(color)); g.addColorStop(1, color); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(center.x, center.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffffff30'; ctx.stroke(); labelScene(ctx, obj.name, center.x, center.y + r + 15); return;
  }
  const s = size / 2;
  const vertices = [[-s,-s,-s],[s,-s,-s],[s,s,-s],[-s,s,-s],[-s,-s,s],[s,-s,s],[s,s,s],[-s,s,s]].map(([x,y,z]) => projectScene({x: x*Math.cos(a)-z*Math.sin(a)+Number(pos.x||0), y:y+Number(pos.y||0), z:x*Math.sin(a)+z*Math.cos(a)+Number(pos.z||0)}, origin, scale, angle));
  if (obj.type === 'plane') {
    const pts = [[-s,0,-s],[s,0,-s],[s,0,s],[-s,0,s]].map(([x,y,z])=>projectScene({x:x+Number(pos.x||0),y:y+Number(pos.y||0),z:z+Number(pos.z||0)},origin,scale,angle));
    ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y); pts.slice(1).forEach(p=>ctx.lineTo(p.x,p.y)); ctx.closePath(); ctx.fillStyle=color;ctx.globalAlpha=.55;ctx.fill();ctx.globalAlpha=1;ctx.strokeStyle=color;ctx.stroke(); labelScene(ctx,obj.name,pts[2].x,pts[2].y+14); return;
  }
  const faces = [[0,1,2,3],[4,5,6,7],[0,1,5,4],[2,3,7,6],[1,2,6,5],[0,3,7,4]];
  const depth = faces.map((inds, idx)=>({ idx, pts:inds.map(i=>vertices[i]), z:inds.reduce((n,i)=>n+vertices[i].z,0)/4 })).sort((x,y)=>y.z-x.z);
  depth.forEach((face,i)=>{ ctx.beginPath();ctx.moveTo(face.pts[0].x,face.pts[0].y);face.pts.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));ctx.closePath();ctx.fillStyle=shadeColor(color,[.55,.72,.88,.68,1,.48][face.idx]);ctx.fill();ctx.strokeStyle='#ded8ff88';ctx.lineWidth=1;ctx.stroke(); });
  labelScene(ctx,obj.name,vertices[6].x,vertices[6].y+16);
}
function shadeColor(color, factor) {
  const hex = String(color).match(/^#([\da-f]{3}|[\da-f]{6})$/i); if (!hex) return color;
  let h = hex[1]; if (h.length===3) h=h.split('').map(x=>x+x).join('');
  const nums=[0,2,4].map(i=>Math.max(0,Math.min(255,Math.round(parseInt(h.slice(i,i+2),16)*factor)))); return `rgb(${nums.join(',')})`;
}
function lightenColor(color) { return shadeColor(color,1.45); }
function labelScene(ctx, text, x, y) { ctx.font='11px ui-monospace, SFMono-Regular, Menlo, monospace';ctx.textAlign='center';ctx.fillStyle='#e4dfff';ctx.shadowColor='#111';ctx.shadowBlur=5;ctx.fillText(String(text).slice(0,28),x,y);ctx.shadowBlur=0; }


function getStudioSceneForTools() {
  if (!lastResult) lastResult = { ok: true, appName: project.name, pages: [], scenes: [], logs: [], steps: 0 };
  lastResult.scenes ||= [];
  if (!lastResult.scenes.length) lastResult.scenes.push({ name: 'Forge Scene', objects: [], kind: 'scene', simulation: { running: false, gravity: 9.81, collisions: true, elapsed: 0 } });
  currentSceneIndex = Math.min(currentSceneIndex, lastResult.scenes.length - 1);
  return lastResult.scenes[currentSceneIndex] || lastResult.scenes[0];
}
function persistStudioScene(scene) {
  persistSceneState(scene);
  saveLocal();
}
function loadBlueprintIntoProject(blueprintId) {
  try {
    const bp = getGameBlueprint(blueprintId);
    project.files['main.orv'] = bp.source;
    if (bp.id === 'aetherfall-rpg' && bp.realmSource) project.files['aetherfall.realm'] = bp.realmSource;
    setCurrentFile('main.orv');
    runProgram({ source: bp.source });
    activateRightTab(bp.id === 'aetherfall-rpg' ? 'game' : 'scene');
    recordRecentCreation('game', bp.id, bp.name); bumpQuest('template-launched', 1); bumpQuest('game-played', 1);
    toast(`Loaded game blueprint: ${bp.name}`, 'success');
  } catch (error) { toast(error.message, 'error'); }
}
function loadWebTemplateIntoProject(templateId) {
  try {
    const tpl = getWebAppTemplate(templateId);
    project.files['main.orv'] = tpl.source;
    setCurrentFile('main.orv');
    runProgram({ source: tpl.source });
    activateRightTab('preview');
    recordRecentCreation('web', tpl.id, tpl.name); bumpQuest('template-launched', 1);
    toast(`Loaded web app template: ${tpl.name}`, 'success');
  } catch (error) { toast(error.message, 'error'); }
}
function spawnPrefabIntoScene(prefabId) {
  try {
    const prefab = getPrefabKitbash(prefabId);
    const scene = getStudioSceneForTools(); if (!scene) throw new Error('No scene available yet.');
    const baseCount = scene.objects?.length || 0;
    (scene.objects ||= []).push(...prefab.parts.map((part, i) => ({
      type: part.type, name: `${prefab.name} ${part.name || i + 1}`,
      position: { x: (part.position?.x || 0) + baseCount * 0.02, y: part.position?.y || 0, z: part.position?.z || 0 },
      color: part.color || '#7c5cff', size: Math.max(0.2, part.scale?.x || 1), scale: { ...(part.scale || { x: 1, y: 1, z: 1 }) },
      ...(part.material ? { material: { ...part.material } } : {}), visible: true,
    })));
    persistStudioScene(scene); activateRightTab('scene');
    toast(`Spawned prefab: ${prefab.name} (${prefab.parts.length} parts)`, 'success');
  } catch (error) { toast(error.message, 'error'); }
}
function applyAtmosphereMood(moodId) {
  try {
    const mood = getAtmosphereMood(moodId);
    const scene = getStudioSceneForTools(); if (!scene) throw new Error('No scene available yet.');
    scene.renderSettings = { ...(scene.renderSettings || {}), environmentPreset: mood.environmentPreset, toneMapping: mood.toneMapping, toneMappingMode: mood.toneMappingMode, exposure: mood.exposure, environmentStrength: mood.environmentStrength, fog: mood.fog, fogColor: mood.fogColor, fogDensity: mood.fogDensity, lumenGI: mood.lumenGI, bloom: mood.bloom, bloomStrength: mood.bloomStrength, bloomThreshold: 0.85 };
    persistStudioScene(scene); activateRightTab('scene');
    toast(`Atmosphere mood applied: ${mood.name} (${mood.toneMapping.toUpperCase()} + Lumen GI + Bloom)`, 'success');
  } catch (error) { toast(error.message, 'error'); }
}
function insertUiBlockIntoCurrentFile(blockId) {
  try {
    const fixed = insertVisualUiBlock(project.files[currentFile] ?? $('#codeEditor').value, blockId);
    project.files[currentFile] = fixed;
    $('#codeEditor').value = fixed; updateEditorVisuals(); scheduleSave();
    toast('Visual UI block inserted into the current page.', 'success');
  } catch (error) { toast(error.message, 'error'); }
}
function applyExperienceMode(modeId, announce = true) {
  const mode = EXPERIENCE_MODES.find(m => m.id === modeId) || EXPERIENCE_MODES[0];
  experienceMode = mode.id;
  try { localStorage.setItem('orvexa-experience-mode', experienceMode); } catch {}
  document.querySelectorAll('.experience-switch-button').forEach(b => {
    const active = b.dataset.experienceMode === experienceMode;
    b.classList.toggle('active', active);
    b.setAttribute('aria-pressed', String(active));
  });
  document.body.dataset.experienceMode = experienceMode;
  if (announce) toast(`${mode.icon} ${mode.name} mode: ${mode.description}`, 'success');
  if (currentRightTab === 'launchpad') renderLaunchpadTab();
}

function previewAudioPreset(presetId) {
  try {
    const analysis = analyzeSynthPreset(presetId);
    playSynthPreset(presetId).catch(() => {});
    toast(`🔊 ${presetId} — ${analysis.duration.toFixed(2)}s · peak ${analysis.peak.toFixed(2)} · ~${Math.round(analysis.estimatedHz)} Hz`, 'success');
  } catch (error) { toast(error.message, 'error'); }
}

function stopSequencerPlayback() {
  sequencerPlayback.playing = false;
  if (sequencerPlayback.raf) cancelAnimationFrame(sequencerPlayback.raf);
  sequencerPlayback.raf = 0;
}

function playSequencerPresetInScene(presetId) {
  try {
    const scene = getStudioSceneForTools(); if (!scene) throw new Error('No scene available yet.');
    const sequence = getSequencerPreset(presetId);
    stopSequencerPlayback();
    sequencerPlayback = { sequence, presetId, playing: true, time: 0, raf: 0, lastTs: performance.now() };
    const duration = sequenceDuration(sequence) || sequence.duration || 6;
    const tick = (ts) => {
      if (!sequencerPlayback.playing) return;
      const dt = Math.min(0.1, (ts - sequencerPlayback.lastTs) / 1000 || 0);
      sequencerPlayback.lastTs = ts;
      sequencerPlayback.time += dt;
      if (sequencerPlayback.time >= duration) {
        if (sequence.loop) sequencerPlayback.time = 0;
        else { stopSequencerPlayback(); sequencerPlayback.time = duration; }
      }
      sampleTimelineAtTime(sequence, sequencerPlayback.time, scene);
      const scrub = $('#sequencerScrubber'); if (scrub) scrub.value = String(sequencerPlayback.time);
      const label = $('#sequencerTimeLabel'); if (label) label.textContent = `${sequencerPlayback.time.toFixed(2)}s / ${duration.toFixed(2)}s`;
      if (sequencerPlayback.playing) sequencerPlayback.raf = requestAnimationFrame(tick);
      else { persistStudioScene(scene); }
    };
    sequencerPlayback.raf = requestAnimationFrame(tick);
    toast(`🎬 Playing sequence: ${sequence.name}`, 'success');
  } catch (error) { toast(error.message, 'error'); }
}

function applySceneDaylight(preset) {
  try {
    const scene = getStudioSceneForTools(); if (!scene) throw new Error('No scene available yet.');
    const moods = { morning: 'unreal-daylight', evening: 'golden-hour', night: 'deep-space-nebula' };
    const mood = ATMOSPHERE_MOODS.find(m => m.id === moods[preset]) || ATMOSPHERE_MOODS[0];
    scene.renderSettings = { ...(scene.renderSettings || {}), environmentPreset: mood.environmentPreset, toneMapping: mood.toneMapping, exposure: mood.exposure, fogColor: mood.fogColor, fogDensity: mood.fogDensity, lumenGI: mood.lumenGI, bloom: mood.bloom, bloomStrength: mood.bloomStrength, daylightPreset: preset };
    const light = (scene.objects || []).find(o => o.type === 'light');
    if (light) { light.color = preset === 'night' ? '#8fb8ff' : preset === 'evening' ? '#ffb36b' : '#fff2dc'; light.intensity = preset === 'night' ? 0.8 : 1.6; }
    persistStudioScene(scene);
    toast(preset === 'morning' ? '☀ Subah ho gayi — taaza roshni!' : preset === 'evening' ? '🌇 Shaam ka golden hour!' : '🌙 Raat — chaandni aur taare!', 'success');
  } catch (error) { toast(error.message, 'error'); }
}

function applySceneWeather(weather) {
  try {
    const scene = getStudioSceneForTools(); if (!scene) throw new Error('No scene available yet.');
    scene.renderSettings = { ...(scene.renderSettings || {}), weather, fog: weather !== 'clear', fogDensity: weather === 'snow' ? 0.03 : weather === 'rain' ? 0.02 : 0.004 };
    scene.environment = { ...(scene.environment || {}), weather };
    persistStudioScene(scene);
    toast(weather === 'rain' ? '🌧 Baarish shuru!' : weather === 'snow' ? '❄ Barf gir rahi hai!' : '☀ Mausam saaf!', 'success');
  } catch (error) { toast(error.message, 'error'); }
}

function addErodedBiomeTerrainToScene(presetId) {
  try {
    const scene = getStudioSceneForTools(); if (!scene) throw new Error('No scene available yet.');
    const erosion = Math.round(Number($('#terrainErosionSlider')?.value ?? 1200));
    const biome = $('#terrainBiomeSelect')?.value || 'alpine';
    const built = buildTerrainFromPreset(presetId, { resolution: 48, erosionIterations: erosion, foliageCount: 24 });
    const obj = createEngineObject('mesh', ++nextEngineObjectId);
    obj.name = `Eroded Terrain · ${presetId}`;
    obj.position = { x: 0, y: -0.8, z: 0 };
    obj.size = 1; obj.scale = { x: 0.45, y: 0.45, z: 0.45 };
    obj.color = biome === 'desert' ? '#c8a35f' : biome === 'tundra' ? '#cfe4ef' : '#64884b';
    obj.material = { metallic: 0.02, roughness: 0.92, emissive: 0, clearcoat: 0, baseColorImage: built.splatTexture || undefined };
    obj.geometry = Array.from(built.geometry);
    obj.geometryRevision = 1;
    obj.flatShading = false;
    scene.objects.push(obj);
    const shapeFor = { pine: 'cone', crystal: 'cone', boulder: 'sphere', ruin: 'cube', palm: 'cylinder', cactus: 'capsule' };
    for (const item of (built.foliage || []).slice(0, 24)) {
      const f = createEngineObject(shapeFor[item.kind] || 'cone', ++nextEngineObjectId);
      f.name = `Biome ${item.kind} (${item.biome})`;
      f.position = { x: item.position.x * 0.45, y: Math.max(0, item.position.y * 0.45) + 0.2, z: item.position.z * 0.45 };
      f.size = Math.max(0.2, (item.scale || 0.7) * 0.8);
      f.color = item.color || '#62b26f';
      f.material = { metallic: 0.05, roughness: 0.7, emissive: item.kind === 'crystal' ? 0.4 : 0 };
      scene.objects.push(f);
    }
    selectedSceneObjectIndex = scene.objects.length - 1;
    selectedSceneObjectIndices = new Set([selectedSceneObjectIndex]);
    persistStudioScene(scene); activateRightTab('scene');
    toast(`⛰ Eroded biome terrain added: ${built.mesh.triangleCount.toLocaleString()} tris · ${built.foliage.length} foliage · biome ${biome}`, 'success');
  } catch (error) { toast(error.message, 'error'); }
}

function launchpadCard(kind, id, title, desc) {
  return `<button class="launchpad-card" type="button" data-launchpad-kind="${escapeAttr(kind)}" data-launchpad-id="${escapeAttr(id)}"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(desc)}</span></button>`;
}


function todayText() { return new Date().toISOString().slice(0, 10); }
function getQuestState() { if (!questStateCache) questStateCache = loadQuestProgress(); return questStateCache; }
function refreshCreatorBadge() { const el = $('#creatorLevelBadge'); if (!el) return; const s = questSummaryLine(getQuestState(), todayText()); el.textContent = `⭐ Lv ${s.level.level} ${s.title} · 🔥 ${s.streak} din · 🏅 ${s.badges}`; el.title = s.lineHi; }
function bumpQuest(action, amount = 1) {
  try {
    const r = recordCreatorAction(getQuestState(), action, amount, todayText());
    questStateCache = r.state; saveQuestProgress(r.state);
    if (r.completedQuests.length) { spawnConfetti(); toast(`🎉 Quest pura: ${r.completedQuests[0].titleHi} +${r.xpGained} XP!`, 'success'); }
    else if (r.newAchievements.length) { spawnConfetti(); toast(`🏅 Naya badge mila: ${r.newAchievements.map(b => b.nameHi).join(', ')}!`, 'success'); }
    else if (r.leveledUp) { spawnConfetti(); toast(`⭐ Level Up! Ab tum Creator Level ${r.level.level} — ${levelTitle(r.level.level)}!`, 'success'); }
    refreshCreatorBadge();
  } catch { /* quests flow ko kabhi nahi rokengi */ }
}
function magicSceneCombo() {
  try {
    const prefab = PREFAB_KITBASH_LIBRARY[Math.floor(Math.random() * PREFAB_KITBASH_LIBRARY.length)];
    const mood = ATMOSPHERE_MOODS[Math.floor(Math.random() * ATMOSPHERE_MOODS.length)];
    spawnPrefabIntoScene(prefab.id); applyAtmosphereMood(mood.id);
    bumpQuest('scene-built', 1);
    toast(`🪄 Magic Scene: ${prefab.name} + ${mood.name} — kaisa laga ye combo?`, 'success');
  } catch (error) { toast(error.message, 'error'); }
}

const LAUNCHPAD_CATEGORIES = [
  ['all', 'All'], ['games', '3D Games'], ['web', 'Web & Apps'], ['prefabs', '3D Kitbash Prefabs'],
  ['moods', 'Atmosphere Moods'], ['sounds', 'Sound FX & Music'], ['animations', 'Animation Clips'], ['ui', 'Visual UI Blocks'],
];

function launchpadMatches(text) {
  const q = launchpadQuery.trim().toLowerCase();
  return !q || String(text || '').toLowerCase().includes(q);
}

function renderLaunchpadTab() {
  if (currentRightTab !== 'launchpad') return;
  const panel = $('#previewContent');
  const cat = launchpadCategory;
  const show = (id) => cat === 'all' || cat === id;
  const sortEntries = (list) => launchpadSort === 'az' ? [...list].sort((a, b) => a.name.localeCompare(b.name)) : launchpadSort === 'biggest' ? [...list].sort((a, b) => (b.source || '').split('\n').length - (a.source || '').split('\n').length) : list;
  const gameCards = sortEntries(GAME_BLUEPRINTS).filter(b => launchpadMatches(`${b.name} ${b.description}`)).map(b => { const meta = getTemplateMeta(b); return `<div class="launchpad-card glass"><strong>${meta.emoji} ${escapeHtml(b.name)}</strong><span>${escapeHtml(b.description)}</span><span class="lp-meta">🏅 ${meta.difficulty} · ⏱ ${meta.timeToMake} · 📄 ${meta.lineCount} lines</span><div class="launchpad-card-actions"><button type="button" class="button primary" data-lp-launch-game="${escapeAttr(b.id)}">▶ Launch &amp; Play</button><button type="button" class="button secondary" data-lp-spawn-game="${escapeAttr(b.id)}">◇ 3D Scene</button><button type="button" class="button secondary" data-lp-remix="${escapeAttr(b.id)}">🎲 Remix</button></div></div>`; }).join('');
  const webCards = sortEntries(WEB_APP_TEMPLATES).filter(x => launchpadMatches(`${x.name} ${x.description}`)).map(x => { const meta = getTemplateMeta(x); return `<div class="launchpad-card glass"><strong>${meta.emoji} ${escapeHtml(x.name)}</strong><span>${escapeHtml(x.description)}</span><span class="lp-meta">🏅 ${meta.difficulty} · ⏱ ${meta.timeToMake} · 📄 ${meta.lineCount} lines</span><div class="launchpad-card-actions"><button type="button" class="button primary" data-lp-launch-web="${escapeAttr(x.id)}">▶ Launch &amp; Play</button><button type="button" class="button secondary" data-lp-remix="${escapeAttr(x.id)}">🎲 Remix</button></div></div>`; }).join('');
  const prefabCards = PREFAB_KITBASH_LIBRARY.filter(x => launchpadMatches(`${x.name} ${x.description}`)).map(x => `<div class="launchpad-card glass"><strong>🧱 ${escapeHtml(x.name)}</strong><span>${escapeHtml(x.description)} · ${x.parts.length} parts</span><div class="launchpad-card-actions"><button type="button" class="button primary" data-spawn-prefab="${escapeAttr(x.id)}">◇ Spawn in 3D Scene</button></div></div>`).join('');
  const moodCards = ATMOSPHERE_MOODS.filter(x => launchpadMatches(`${x.name} ${x.description}`)).map(x => `<div class="launchpad-card glass"><strong>🌅 ${escapeHtml(x.name)}</strong><span>${escapeHtml(x.description)}</span><div class="launchpad-card-actions"><button type="button" class="button primary" data-atmosphere-mood="${escapeAttr(x.id)}">✦ Apply Mood</button></div></div>`).join('');
  const soundCards = Object.entries(AUDIO_SYNTH_PRESETS).filter(([id, pr]) => launchpadMatches(`${id} ${pr.label || ''}`)).map(([id, pr]) => `<div class="launchpad-card glass"><strong>🔊 ${escapeHtml(pr.label || id)}</strong><span>${escapeHtml(id)} · ${Number(pr.duration || 0).toFixed ? '' : ''}offline WAV synth</span><div class="launchpad-card-actions"><button type="button" class="button primary" data-lp-sound="${escapeAttr(id)}">▶ Preview Sound</button></div></div>`).join('');
  const animCards = Object.entries(SEQUENCER_PRESETS).filter(([id, sq]) => launchpadMatches(`${id} ${sq.name}`)).map(([id, sq]) => `<div class="launchpad-card glass"><strong>🎬 ${escapeHtml(sq.name)}</strong><span>${escapeHtml(id)} · ${sq.duration}s · ${sq.tracks.length} tracks</span><div class="launchpad-card-actions"><button type="button" class="button primary" data-lp-anim="${escapeAttr(id)}">▶ Play in 3D Scene</button></div></div>`).join('');
  const uiCards = VISUAL_UI_BLOCKS.filter(x => launchpadMatches(`${x.name} ${x.description}`)).map(x => `<div class="launchpad-card glass"><strong>🧩 ${escapeHtml(x.name)}</strong><span>${escapeHtml(x.description)}</span><div class="launchpad-card-actions"><button type="button" class="button primary" data-insert-ui-block="${escapeAttr(x.id)}">＋ Insert UI Block</button></div></div>`).join('');
  panel.innerHTML = `<div class="launchpad-panel">
    <div class="launchpad-hero"><span class="docs-kicker">ORVEXA STUDIO v7.0 · OMEGA ENGINE · 1-CLICK CREATION</span><h3>⚡ Quick Create Launchpad</h3><p>Pick an experience mode, then launch a game, website, prefab, mood, sound or animation — no code, no API key, no setup.</p>
    <div class="launchpad-modes">${EXPERIENCE_MODES.map(m => `<button type="button" class="launchpad-mode${m.id === experienceMode ? ' active' : ''}" data-experience-mode="${m.id}"><strong>${m.icon} ${escapeHtml(m.name)}</strong><span>${escapeHtml(m.description)}</span></button>`).join('')}</div>
    <div class="launchpad-search"><select id="launchpadSortSelect" aria-label="Sort templates"><option value="popular"${launchpadSort === 'popular' ? ' selected' : ''}>⭐ Popular</option><option value="az"${launchpadSort === 'az' ? ' selected' : ''}>A–Z naam</option><option value="biggest"${launchpadSort === 'biggest' ? ' selected' : ''}>📄 Sabse bade pehle</option></select><button type="button" class="button secondary" id="launchpadSurprise">🎲 Surprise Me!</button><input id="launchpadSearchInput" type="search" placeholder="Search games, apps, prefabs, moods, sounds, animations…" value="${escapeAttr(launchpadQuery)}" aria-label="Search Launchpad"></div>
    <div class="launchpad-pills" role="group" aria-label="Launchpad categories">${LAUNCHPAD_CATEGORIES.map(([id, label]) => `<button type="button" class="launchpad-pill${cat === id ? ' active' : ''}" data-launchpad-category="${id}">${label}</button>`).join('')}</div></div>
    <div class="launchpad-theme-row"><span>🎨 App Theme (1-click rang badlo):</span>${APP_THEMES.map(th => `<button type="button" class="launchpad-pill" data-lp-theme="${th.id}" title="${escapeAttr(th.name)} — current project pe lagega">${escapeHtml(th.name)}</button>`).join('')}</div>
    ${show('games') ? `<h4>🎮 3D Games</h4><div class="launchpad-grid">${gameCards || '<p class="launchpad-empty">No games match your search.</p>'}</div>` : ''}
    ${show('web') ? `<h4>🌐 Web &amp; Apps</h4><div class="launchpad-grid">${webCards || '<p class="launchpad-empty">No web templates match your search.</p>'}</div>` : ''}
    ${show('prefabs') ? `<h4>🧱 3D Kitbash Prefabs</h4><div class="launchpad-grid">${prefabCards || '<p class="launchpad-empty">No prefabs match your search.</p>'}</div>` : ''}
    ${show('moods') ? `<h4>🌅 Atmosphere Moods</h4><div class="launchpad-grid">${moodCards || '<p class="launchpad-empty">No moods match your search.</p>'}</div>` : ''}
    ${show('sounds') ? `<h4>🔊 Sound FX &amp; Music</h4><div class="launchpad-grid">${soundCards || '<p class="launchpad-empty">No sounds match your search.</p>'}</div>` : ''}
    ${show('animations') ? `<h4>🎬 Animation Clips</h4><div class="launchpad-grid">${animCards || '<p class="launchpad-empty">No animation clips match your search.</p>'}</div>` : ''}
    ${show('ui') ? `<h4>🧩 Visual UI Blocks</h4><div class="launchpad-grid">${uiCards || '<p class="launchpad-empty">No UI blocks match your search.</p>'}</div>` : ''}
    <p class="launchpad-note">Want it done for you? Open the <button type="button" class="inline-action" id="launchpadOpenAi">🤖 AI Agent</button> — Omni-Agent 3.0 works offline with zero API key, in English, Hindi and Hinglish.</p>
  </div>`;
  $('#previewState').textContent = 'Quick Create Launchpad';
  panel.querySelectorAll('[data-experience-mode]').forEach(b => b.addEventListener('click', () => applyExperienceMode(b.dataset.experienceMode)));
  panel.querySelectorAll('[data-launchpad-category]').forEach(b => b.addEventListener('click', () => { launchpadCategory = b.dataset.launchpadCategory; renderLaunchpadTab(); }));
  $('#launchpadSortSelect')?.addEventListener('change', (e) => { launchpadSort = e.target.value; renderLaunchpadTab(); });
  $('#launchpadSurprise')?.addEventListener('click', () => { const pool = launchpadCategory === 'web' ? WEB_APP_TEMPLATES.map(x => ['web', x.id]) : GAME_BLUEPRINTS.map(x => ['game', x.id]); const [kind, id] = pool[Math.floor(Math.random() * pool.length)]; toast(kind === 'game' ? '🎲 Surprise game tumhaare liye!' : '🎲 Surprise template tumhaare liye!', 'success'); if (kind === 'game') loadBlueprintIntoProject(id); else loadWebTemplateIntoProject(id); });
  const search = $('#launchpadSearchInput');
  search?.addEventListener('input', () => { launchpadQuery = search.value; const pos = search.selectionStart; renderLaunchpadTab(); const next = $('#launchpadSearchInput'); if (next) { next.focus(); try { next.setSelectionRange(pos, pos); } catch {} } });
  panel.querySelectorAll('[data-lp-launch-game]').forEach(b => b.addEventListener('click', () => loadBlueprintIntoProject(b.dataset.lpLaunchGame)));
  panel.querySelectorAll('[data-lp-remix]').forEach(b => b.addEventListener('click', () => { try { const remix = remixTemplate(b.dataset.lpRemix, { title: `${(GAME_BLUEPRINTS.find(x => x.id === b.dataset.lpRemix) || WEB_APP_TEMPLATES.find(x => x.id === b.dataset.lpRemix))?.title || 'My Creation'} — Mera Remix`, themeId: APP_THEMES[Math.floor(Math.random() * APP_THEMES.length)].id }); project.files['main.orv'] = remix.source; setCurrentFile('main.orv'); runProgram({ source: remix.source }); recordRecentCreation('remix', remix.id, remix.title); bumpQuest('remix-made', 1); toast(`🎲 Remix ready: ${remix.title} (${remix.themeId}) — rang aur naam tumhaara!`, 'success'); } catch (error) { toast(error.message, 'error'); } }));
  panel.querySelectorAll('[data-lp-theme]').forEach(b => b.addEventListener('click', () => { try { const themed = applyAppTheme(project.files[currentFile()] ?? $('#codeEditor').value, b.dataset.lpTheme); project.files[currentFile()] = themed; $('#codeEditor').value = themed; updateEditorVisuals(); scheduleSave(); runProgram({ source: project.files['main.orv'] || themed }); toast(`🎨 Theme lag gaya: ${b.dataset.lpTheme} — dekho rang badal gaye!`, 'success'); } catch (error) { toast(error.message, 'error'); } }));
  panel.querySelectorAll('[data-lp-spawn-game]').forEach(b => b.addEventListener('click', () => { loadBlueprintIntoProject(b.dataset.lpSpawnGame); activateRightTab('scene'); }));
  panel.querySelectorAll('[data-lp-launch-web]').forEach(b => b.addEventListener('click', () => loadWebTemplateIntoProject(b.dataset.lpLaunchWeb)));
  panel.querySelectorAll('[data-spawn-prefab]').forEach(b => b.addEventListener('click', () => spawnPrefabIntoScene(b.dataset.spawnPrefab)));
  panel.querySelectorAll('[data-atmosphere-mood]').forEach(b => b.addEventListener('click', () => applyAtmosphereMood(b.dataset.atmosphereMood)));
  panel.querySelectorAll('[data-insert-ui-block]').forEach(b => b.addEventListener('click', () => { insertUiBlockIntoCurrentFile(b.dataset.insertUiBlock); bumpQuest('block-inserted', 1); }));
  panel.querySelectorAll('[data-lp-sound]').forEach(b => b.addEventListener('click', () => previewAudioPreset(b.dataset.lpSound)));
  panel.querySelectorAll('[data-lp-anim]').forEach(b => b.addEventListener('click', () => { activateRightTab('scene'); playSequencerPresetInScene(b.dataset.lpAnim); }));
  $('#launchpadOpenAi')?.addEventListener('click', () => activateRightTab('ai'));
}

function currentAiConfigFromForm() {
  return saveAiConfig({ provider: $('#aiProviderSelect')?.value || 'free-local', apiKey: $('#aiApiKeyInput')?.value || '', model: $('#aiModelInput')?.value || '', experienceMode });
}
function renderAiAgentTab() {
  if (currentRightTab !== 'ai') return;
  const panel = $('#previewContent');
  const cfg = loadAiConfig();
  panel.innerHTML = `<div class="ai-agent-panel">
    <div class="launchpad-hero"><span class="docs-kicker">ORVEXA OMNI-AGENT 3.0 · OMEGA AI</span><h3>🤖 AI Agent</h3><p>Free Built-In AI works instantly — no API key, no account, in English, Hindi and Hinglish. Hosted providers are optional.</p></div>
    <label class="ai-field"><span>AI provider</span><select id="aiProviderSelect">${Object.values(AI_PROVIDERS).map(pr => `<option value="${pr.id}"${pr.id === cfg.provider ? ' selected' : ''}>${escapeHtml(pr.name)}${pr.requiresApiKey ? ' (key required)' : ' (zero key)'}</option>`).join('')}</select></label>
    <label class="ai-field"><span>API key <small>(only for hosted providers — Free Built-In AI needs none)</small></span><input id="aiApiKeyInput" type="password" autocomplete="off" placeholder="Leave empty for Free Built-In AI" value="${escapeAttr(cfg.apiKey || '')}"/></label>
    <label class="ai-field"><span>Model</span><input id="aiModelInput" type="text" value="${escapeAttr(cfg.model || '')}" placeholder="orvexa-local-2.0"/></label>
    <div class="ai-wizard"><h4>✨ 3-Click Beginner AI Wizard</h4>
      <label class="ai-field"><span>1️⃣ What do you want to make?</span><input id="aiWizardGoal" type="text" placeholder="e.g. ek neon racing game banao / a portfolio website"/></label>
      <label class="ai-field"><span>2️⃣ Pick a style</span><select id="aiWizardStyle"><option value="bright and friendly">Bright &amp; friendly</option><option value="cyber neon">Cyber neon</option><option value="nature and calm">Nature &amp; calm</option><option value="royal golden temple">Royal golden temple</option><option value="frosty sky adventure">Frosty sky adventure</option></select></label>
      <label class="ai-field"><span>Who is it for?</span><select id="aiWizardAudience"><option value="beginners">Beginners</option><option value="kids">Kids</option><option value="gamers">Gamers</option><option value="customers">Customers</option><option value="students">Students</option></select></label>
      <button id="aiWizardGenerateButton" class="button primary" type="button">3️⃣ Generate my creation</button>
    </div>
    <label class="ai-field"><span>Or tell the Omni-Agent anything…</span><textarea id="aiAgentPrompt" rows="4" placeholder="e.g. Make a cyber game, add a crystal, golden hour mood, and fix any errors"></textarea></label>
    <div class="ai-actions"><button id="aiAgentRunButton" class="button primary" type="button">▶ Run AI Agent</button><button id="autoFixWithAiButton" class="button secondary" type="button">🛠 Auto-Fix with AI</button><button id="aiExplainButton" class="button secondary" type="button">📖 Mera Project Samjhao</button><button id="aiScaffoldButton" class="button secondary" type="button">🪄 Full Project Banao (Terrain+Sound+Animation)</button><button id="aiVariationsButton" class="button secondary" type="button">🎲 3 Versions Banao</button></div>
    <div id="aiVariationsList" class="ai-variations"></div>
    <div class="ai-chips"><h4>⚡ Try a starter prompt (English · Hindi · Hinglish)</h4><div class="ai-chip-row">${listAllPromptChips().map(ch => `<button type="button" class="ai-chip" data-ai-chip="${escapeAttr(ch.prompt)}">${escapeHtml(ch.language)} · ${escapeHtml(ch.prompt.slice(0, 42))}…</button>`).join('')}</div></div>
    <div class="ai-critic-card"><h4>📊 Project Quality Critic</h4><p>Scores rendering, gameplay, performance and accessibility — then offers 1-click upgrades powered by the 20 Omni-Agent tools.</p><button id="aiCriticRunButton" class="button secondary" type="button">📊 Critique my project</button><div id="aiCriticOutput" class="ai-critic-output">${lastCriticReport ? escapeHtml(lastCriticReport.summary) : 'No critique yet — press the button after running your project.'}</div><div id="aiCriticUpgrades" class="ai-critic-upgrades"></div></div>
    <div class="ai-tools-list"><h4>🤖 Omni-Agent 3.0 tools (${ORVEXA_AI_TOOLS.length})</h4><div class="ai-tool-grid">${ORVEXA_AI_TOOLS.map(x => `<button type="button" class="ai-tool-button" data-ai-tool="${escapeAttr(x.id)}" title="${escapeAttr(x.description)}"><strong>${escapeHtml(x.label)}</strong><span>${escapeHtml(x.category)}</span></button>`).join('')}</div></div>
    <div id="aiAgentOutput" class="ai-agent-output">${lastAiAgentOutput ? escapeHtml(lastAiAgentOutput) : 'Agent output will appear here. Tip: try “ek space game banao” — the Free Built-In AI understands Hindi and Hinglish too.'}</div>
  </div>`;
  $('#previewState').textContent = 'AI Agent ready';
  const setOutput = (text) => { lastAiAgentOutput = text; const out = $('#aiAgentOutput'); if (out) out.textContent = text; };
  const runAgent = async (promptText) => {
    const config = currentAiConfigFromForm();
    const prompt = String(promptText || '').trim();
    if (!prompt) { setOutput('Pehle kuch likho — what should the AI build? (Type a goal first.)'); return; }
    setOutput('Omni-Agent is planning and building…');
    try {
      const planned = planAutonomousActions(prompt, config);
      const turn = await executeOrvexaAgentTurn({ prompt, config, filename: 'main.orv' });
      const code = turn.files?.['main.orv'] || turn.code;
      if (code) {
        project.files['main.orv'] = code;
        setCurrentFile('main.orv');
        runProgram({ source: code });
        if (currentRightTab !== 'ai') activateRightTab('ai'); else renderAiAgentTab();
      }
      setOutput(`${turn.text}\n\nPlanned ${planned.length} steps · Provider: ${turn.providerUsed}${turn.fallbackUsed ? ' (offline fallback — no API key needed)' : ''}\n${turn.results.map(r => `${r.ok ? '✓' : '✗'} ${r.tool}`).join('\n')}`);
      toast('AI Agent finished — press Run / Play to explore!', 'success');
    } catch (error) { const doctor = diagnoseRunError(error, project.files['main.orv'] || ''); setOutput(`⚠️ ${doctor.simpleMessage}\n(Technical: ${error.message})`); toast(doctor.cause, 'error'); }
  };
  $('#aiAgentRunButton')?.addEventListener('click', () => runAgent($('#aiAgentPrompt')?.value));
  $('#aiWizardGenerateButton')?.addEventListener('click', () => runAgent(buildWizardPrompt({ goal: $('#aiWizardGoal')?.value || 'a fun interactive app', style: $('#aiWizardStyle')?.value, audience: $('#aiWizardAudience')?.value, language: 'Hinglish' })));
  panel.querySelectorAll('[data-ai-chip]').forEach(chip => chip.addEventListener('click', () => { const area = $('#aiAgentPrompt'); if (area) { area.value = chip.dataset.aiChip; area.focus(); } }));
  const renderCritic = () => {
    const sceneForCritic = lastResult?.scenes?.[currentSceneIndex] || null;
    lastCriticReport = critiqueAndEnhanceProject(project.files['main.orv'] ?? $('#codeEditor')?.value ?? '', sceneForCritic);
    const out = $('#aiCriticOutput');
    if (out) out.innerHTML = `<strong>Overall ${lastCriticReport.overall}/100 · Grade ${lastCriticReport.grade}</strong><div class="ai-score-bars"><span>🎨 Rendering ${lastCriticReport.renderingScore}</span><span>🎮 Gameplay ${lastCriticReport.gameplayScore}</span><span>⚡ Performance ${lastCriticReport.performanceScore}</span><span>♿ Accessibility ${lastCriticReport.accessibilityScore}</span></div><ul>${lastCriticReport.suggestions.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ul>`;
    const up = $('#aiCriticUpgrades');
    if (up) {
      up.innerHTML = lastCriticReport.oneClickUpgrades.map(u => `<button type="button" class="button secondary" data-critic-upgrade="${escapeAttr(u.id)}" data-critic-tool="${escapeAttr(u.tool)}" data-critic-args="${escapeAttr(JSON.stringify(u.args || {}))}">${escapeHtml(u.label)}</button>`).join('');
      up.querySelectorAll('[data-critic-upgrade]').forEach(b => b.addEventListener('click', () => {
        try {
          const args = JSON.parse(b.dataset.criticArgs || '{}');
          if (b.dataset.criticTool === 'apply_atmosphere_mood') { applyAtmosphereMood(args.moodId || 'golden-hour'); return; }
          const result = executeAgentTool(b.dataset.criticTool, args, { scene: sceneForCritic, source: project.files['main.orv'] || '' });
          setOutput(`1-click upgrade applied: ${result.summary}`);
          toast(result.summary, 'success');
          renderCritic();
        } catch (error) { toast(error.message, 'error'); }
      }));
    }
  };
  $('#aiCriticRunButton')?.addEventListener('click', renderCritic);
  $('#aiExplainButton')?.addEventListener('click', () => { const explained = explainProjectForBeginner(project.files['main.orv'] ?? $('#codeEditor')?.value ?? ''); setOutput(`📖 ${explained.explanation}`); });
  $('#aiScaffoldButton')?.addEventListener('click', () => { try { const prompt = $('#aiAgentPrompt')?.value || $('#aiWizardGoal')?.value || 'a fun game'; const scaffold = scaffoldProjectV2(prompt); project.files['main.orv'] = scaffold.files['main.orv']; if (scaffold.files['world.realm']) project.files['world.realm'] = scaffold.files['world.realm']; setCurrentFile('main.orv'); runProgram({ source: scaffold.files['main.orv'] }); setOutput(`🪄 Full project ready: ${scaffold.title} (${scaffold.domain}) · ${scaffold.badge}\nPipeline: ${scaffold.pipeline.join(' → ')}\nArtifacts: ${scaffold.artifacts.map(a => a.kind).join(', ')}`); spawnConfetti(); toast('🪄 Poora project ban gaya — terrain, sound, animation ke saath!', 'success'); } catch (error) { const doctor = diagnoseRunError(error, project.files['main.orv'] || ''); setOutput(`⚠️ ${doctor.simpleMessage}`); toast(error.message, 'error'); } });
  $('#aiVariationsButton')?.addEventListener('click', () => { try {
      const source = project.files['main.orv'] || $('#codeEditor')?.value || '';
      const variations = generateProjectVariations(source);
      const named = autoNameProject(source);
      const list = $('#aiVariationsList');
      if (list) list.innerHTML = `<h4>🎲 ${escapeHtml(named.name)} — 3 naye versions (ek chunno!)</h4>` + variations.map((v, i) => `<div class="ai-variation-card"><strong>${escapeHtml(v.name)}</strong><span>${escapeHtml(v.blurbHi)} · ${v.lines} lines</span><button type="button" class="button primary" data-variation-run="${i}">▶ Ye wala chalao</button></div>`).join('');
      list?.querySelectorAll('[data-variation-run]').forEach(b => b.addEventListener('click', () => { const v = variations[Number(b.dataset.variationRun)]; project.files['main.orv'] = v.source; setCurrentFile('main.orv'); runProgram({ source: v.source }); bumpQuest('ai-used', 1); spawnConfetti(); toast(`🎲 ${v.name} chal raha hai — kaisa laga?`, 'success'); }));
      bumpQuest('ai-used', 1);
      setOutput(`🎲 3 versions tayyar: ${variations.map(v => v.themeName).join(' · ')} — upar se ek chun kar chalao!`);
    } catch (error) { toast(error.message, 'error'); } });
  panel.querySelectorAll('[data-ai-tool]').forEach(b => b.addEventListener('click', () => {
    try {
      const defaults = { create_animation_sequence: { preset: 'turntable-showcase' }, generate_eroded_terrain: { preset: 'alpine-ridged', resolution: 24 }, synthesize_game_audio: { preset: 'coin-pickup' }, audit_and_optimize_performance: {}, write_project_file: { prompt: $('#aiAgentPrompt')?.value || 'custom web app' } };
      const result = executeAgentTool(b.dataset.aiTool, defaults[b.dataset.aiTool] || {}, { scene: lastResult?.scenes?.[currentSceneIndex] || null, source: project.files['main.orv'] || '' });
      if (result.source && b.dataset.aiTool === 'write_project_file') { project.files['main.orv'] = result.source; setCurrentFile('main.orv'); runProgram({ source: result.source }); }
      setOutput(`Tool ${b.dataset.aiTool}: ${result.summary}`);
      toast(result.summary, 'success');
    } catch (error) { toast(error.message, 'error'); }
  }));
  $('#autoFixWithAiButton')?.addEventListener('click', () => {
    const before = project.files[currentFile] ?? $('#codeEditor').value;
    const fixed = autoFixProjectSource(before, currentFile);
    project.files[currentFile] = fixed; $('#codeEditor').value = fixed; updateEditorVisuals(); scheduleSave();
    setOutput(fixed === before ? 'Auto-Fix: no common errors found — your source already looks clean.' : 'Auto-Fix applied: smart quotes, CRLF and bracket balance repaired. Press Run to verify.');
  });
}

function renderDocsTab() {
  if (currentRightTab !== 'docs') return;
  const panel = $('#previewContent');
  const query = currentDocQuery.trim().toLowerCase();
  const filtered = DOCS.filter((doc) => !query || `${doc.title} ${doc.category} ${doc.body}`.toLowerCase().includes(query));
  panel.innerHTML = `<div class="docs-workbench"><div class="docs-hero"><span class="docs-kicker">LANGUAGE HANDBOOK · PART 2</span><h3>Learn Orvexa.</h3><p>A living reference of syntax and APIs currently implemented in the Studio.</p><div class="docs-search-wrap">${icons.search}<input id="docsSearchInput" value="${escapeAttr(currentDocQuery)}" placeholder="Search syntax, functions, topics…" aria-label="Search documentation"/><kbd>/</kbd></div></div><div class="docs-count">${filtered.length} topics <span>·</span> searchable reference</div><div class="docs-list">${filtered.map((doc) => `<details class="docs-item"><summary><span class="docs-category">${escapeHtml(doc.category)}</span><strong>${escapeHtml(doc.title)}</strong><span class="docs-chevron">⌄</span></summary><div class="docs-body">${formatDocText(doc.body)}</div></details>`).join('') || '<div class="docs-no-results">No documentation matches this search.</div>'}</div><div class="docs-disclaimer">Documentation reflects the current implementation. Planned features are labeled as such.</div></div>`;
  $('#docsSearchInput')?.addEventListener('input', (e) => { currentDocQuery = e.target.value; const position = e.target.selectionStart; renderDocsTab(); const input = $('#docsSearchInput'); input?.focus(); input?.setSelectionRange(position, position); });
}
function formatDocText(text) {
  return escapeHtml(text).replace(/`([^`]+)`/g, '<code>$1</code>').replaceAll('\n', '<br>');
}

function activateConsoleTab(tab) {
  $$('[data-console-tab]').forEach((b) => b.classList.toggle('active', b.dataset.consoleTab === tab));
  renderConsole(lastResult?.logs || [], tab);
}
function openExample(file) {
  if (project.files[file] !== undefined) { setCurrentFile(file); toast(`Opened ${file}`); return; }
  toast(`Example not found: ${file}`, 'error');
}
function addNewFile() {
  const suggestion = project.folders?.length ? `${project.folders[0]}/new-file.orv` : 'new-file.orv';
  const requested = prompt('New file path (relative to project root):', suggestion);
  if (!requested) return;
  try {
    let path = normalizePath(requested);
    if (!/\.[a-z0-9]+$/i.test(path)) path += '.orv';
    if (project.files[path] !== undefined) { toast('A file with that path already exists.', 'warning'); return; }
    const parent = path.split('/').slice(0, -1).join('/'); if (parent && !project.folders.includes(parent)) project.folders.push(parent);
    project.files[path] = path.endsWith('.orv') ? `app "${path.split('/').at(-1).replace(/\.orv$/i, '')}"\n\nprint("Hello from ${path.split('/').at(-1)}")\n` : '';
    setCurrentFile(path); renderTree(); saveLocal(true); toast(`Created ${path}`, 'success');
  } catch (error) { toast(error.message, 'error'); }
}
function addNewFolder() {
  const requested = prompt('New folder path:', 'components'); if (!requested) return;
  try { const path = normalizePath(requested); if (!project.folders.includes(path)) project.folders.push(path); renderTree(); saveLocal(true); toast(`Created folder ${path}`, 'success'); }
  catch (error) { toast(error.message, 'error'); }
}
function renameActiveFile() {
  const file = currentFile(); const requested = prompt('Rename current file:', file); if (!requested || requested === file) return;
  try {
    const path = normalizePath(requested); if (project.files[path] !== undefined) throw new Error('A file already exists at that path.');
    project.files[path] = project.files[file]; delete project.files[file];
    if (project.activeFile === file) project.activeFile = path;
    renderTree(); setCurrentFile(path); saveLocal(true); toast(`Renamed to ${path}`, 'success');
  } catch (error) { toast(error.message, 'error'); }
}
function deleteActiveFile() {
  const file = currentFile(); if (Object.keys(project.files).length <= 1) { toast('Keep at least one file in the project.', 'warning'); return; }
  if (!confirm(`Delete "${file}" from this project?`)) return;
  delete project.files[file]; project.activeFile = Object.keys(project.files).find((f) => f.endsWith('.orv')) || Object.keys(project.files)[0];
  setCurrentFile(project.activeFile); renderTree(); saveLocal(true); toast(`Deleted ${file}`, 'success');
}
function downloadCurrentFile() {
  const file = currentFile(); const type = file.endsWith('.orv') ? 'text/plain;charset=utf-8' : 'application/octet-stream';
  downloadBlob(new Blob([contentOf(file)], { type }), file.split('/').at(-1)); toast(`Downloaded ${file}`, 'success');
}
function exportProject() {
  try { if (lastResult?.scenes) for (const scene of lastResult.scenes) persistSceneState(scene); saveLocal(); const blob = exportProjectZip(project); downloadBlob(blob, `${safeFilename(project.name)}-Orvexa-Project.zip`); addBuildLog('info', `Exported complete project ZIP with ${Object.keys(project.files).length} source files, ${Object.keys(project.sceneState||{}).length} persisted scenes, model data and engine settings.`); toast('Full project backup ZIP created with source, scenes, models and settings.', 'success'); }
  catch (error) { toast(`Export failed: ${error.message}`, 'error'); }
}
function safeFilename(value) { return String(value || 'Orvexa-Project').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'Orvexa-Project'; }
async function importProject() {
  const input = $('#importInput'); input.value = ''; input.click();
}
async function onImportFile(file) {
  if (!file) return;
  try {
    const imported = await importProjectFile(file);
    if (!confirm(`Import "${imported.name}" with ${Object.keys(imported.files).length} file(s)? The current in-browser project will be replaced. Download a ZIP first if you want a backup.`)) return;
    project = imported; stateStore = new Map(); lastResult = null; activeInterpreter = null; baseConsoleLogs = []; pendingEventLogs = []; saveLocal(); renderTree(); setCurrentFile(project.activeFile); renderPreview(null); renderConsole([]); updateDiagnostics(null); activateRightTab('preview'); toast('Project imported. Review its source before running it.', 'success');
  } catch (error) { toast(`Import failed: ${error.message}`, 'error'); }
}
function buildWebsite() {
  if (!lastResult) runProgram({ source: $('#codeEditor').value, fromButton: true });
  if (!lastResult?.ok) { toast('Fix runtime errors before building.', 'error'); activateConsoleTab('problems'); return; }
  try {
    const blob = buildStaticWebsite(project, lastResult);
    downloadBlob(blob, `${safeFilename(lastResult.appName || project.name)}-Website-Snapshot.zip`);
    buildLogs.push({ level: 'success', text: 'Build completed: index.html + README.txt packaged successfully.' });
    buildLogs.push({ level: 'warning', text: 'Website export currently creates a static UI snapshot. State and event handlers are not bundled.' });
    buildLogs.push({ level: 'info', text: 'Upload the extracted index.html to any static hosting provider.' });
    activateConsoleTab('build'); toast('Website snapshot ZIP created.', 'success');
  } catch (error) { buildLogs.push({ level: 'error', text: `Build failed: ${error.message}` }); activateConsoleTab('build'); toast(error.message, 'error'); }
}
function jumpTo(line, column = 1) {
  const editor = $('#codeEditor'); const lines = editor.value.split('\n'); const index = lines.slice(0, Math.max(0, line - 1)).reduce((n, x) => n + x.length + 1, 0) + Math.max(0, column - 1);
  editor.focus(); editor.setSelectionRange(index, Math.min(editor.value.length, index + 1));
  const lineHeight = parseFloat(getComputedStyle(editor).lineHeight) || 24; editor.scrollTop = Math.max(0, (line - 3) * lineHeight); updateScroll(); updateCursorPosition();
}
function moveToMatch(direction = 1) {
  const editor = $('#codeEditor'); const query = $('#findInput').value; if (!query) { $('#findCount').textContent = '0'; return; }
  const source = editor.value.toLowerCase(), needle = query.toLowerCase(); const matches = []; let p = 0;
  while ((p = source.indexOf(needle, p)) !== -1) { matches.push(p); p += Math.max(1, needle.length); }
  if (!matches.length) { $('#findCount').textContent = '0'; return; }
  const current = editor.selectionStart; let idx = direction > 0 ? matches.findIndex((m) => m > current) : matches.findLastIndex((m) => m < current);
  if (idx === -1) idx = direction > 0 ? 0 : matches.length - 1;
  editor.focus(); editor.setSelectionRange(matches[idx], matches[idx] + needle.length); $('#findCount').textContent = `${idx + 1} of ${matches.length}`; updateCursorPosition();
}
function openFind() { activeFind = true; $('#findBar').hidden = false; $('#findInput').focus(); $('#findInput').select(); }
function closeFind() { activeFind = false; $('#findBar').hidden = true; $('#codeEditor').focus(); }
const ORVEXA_COMPLETIONS = [
  ['app "App name"', 'Declare the application name'], ['state name = value', 'Create reactive state'], ['let name = value', 'Declare a variable'], ['const name = value', 'Declare a constant'],
  ['function name(value) {\n    return value\n}', 'Define a reusable function'], ['if condition {\n    \n} else {\n    \n}', 'Conditional branch'], ['for item in items {\n    print(item)\n}', 'Loop over a collection'],
  ['page "Home" {\n    column(gap: 16) {\n        title("Welcome", size: 32)\n        button("Click me") {\n            print("Clicked")\n        }\n    }\n}', 'Create an interactive page'],
  ['scene "Scene" {\n    camera(position: vec3(0, 2, 6))\n    cube("Hero", position: vec3(0, 0, 0), size: 1, color: "#7c5cff")\n}', 'Create a 3D scene'],
  ['print()', 'Write to the console'], ['vec3(0, 0, 0)', 'Create a 3D vector'], ['assert(condition, "message")', 'Check an expectation'],
  ...['app','state','let','const','function','fn','return','if','else','while','for','in','break','continue','page','scene','camera','light','cube','sphere','plane','cylinder','cone','pyramid','capsule','torus','rigidbody','material','controller','animate','print','warn','error','range','vec2','vec3','typeOf','assert','true','false','null'].map(word=>[word, 'Orvexa keyword or built-in'])
];
function showAutocomplete() {
  const editor=$('#codeEditor'), menu=$('#autocompleteMenu'); if(!editor||!menu)return;
  const start=editor.selectionStart, before=editor.value.slice(0,start), match=before.match(/[A-Za-z_][\w]*$/), query=match?.[0]?.toLowerCase()||'';
  autocompleteItems=ORVEXA_COMPLETIONS.filter(([label])=>!query||label.toLowerCase().startsWith(query)).slice(0,12); autocompleteIndex=0;
  if(!autocompleteItems.length){menu.hidden=true;return;}
  menu.innerHTML=autocompleteItems.map(([label,description],i)=>`<button class="autocomplete-item ${i===0?'active':''}" data-completion="${i}" type="button"><strong>${escapeHtml(label.split(/[ (\n]/)[0])}</strong><span>${escapeHtml(description)}</span></button>`).join(''); menu.hidden=false;
  $$('[data-completion]',menu).forEach(btn=>btn.addEventListener('mousedown',e=>{e.preventDefault();insertCompletion(Number(btn.dataset.completion));}));
}
function insertCompletion(index=autocompleteIndex) {
  const editor=$('#codeEditor'), item=autocompleteItems[index]; if(!item)return;
  const start=editor.selectionStart,end=editor.selectionEnd,before=editor.value.slice(0,start),match=before.match(/[A-Za-z_][\w]*$/),from=match?start-match[0].length:start;
  editor.setRangeText(item[0],from,end,'end'); menuHide(); saveEditorToProject(); refreshHighlights(); editor.focus();
}
function menuHide(){const menu=$('#autocompleteMenu');if(menu)menu.hidden=true;}
const COMMANDS = [
  ['Run current program','Ctrl + Enter',()=>runProgram({source:$('#codeEditor').value})],['Format source','',()=>formatBasicIndent()],['Save project','Ctrl + S',()=>saveLocal(true)],['Export project ZIP','',()=>exportProject()],['Import project','',()=>importProject()],['Download current file','',()=>downloadCurrentFile()],['Open documentation','',()=>activateRightTab('docs')],['Open website preview','',()=>activateRightTab('preview')],['Open 3D scene','',()=>activateRightTab('scene')],['Toggle theme','',()=>setTheme(document.documentElement.dataset.theme==='light'?'dark':'light')],['New file','',()=>addNewFile()],['Rename current file','',()=>renameActiveFile()],['Delete current file','',()=>deleteActiveFile()]
];
function openCommandPalette(){
  document.querySelector('.command-palette-backdrop')?.remove(); const backdrop=document.createElement('div');backdrop.className='command-palette-backdrop';backdrop.innerHTML='<div class="command-palette" role="dialog" aria-modal="true" aria-label="Command palette"><input id="commandSearch" placeholder="Search commands…" autocomplete="off"><div class="command-list" id="commandList"></div></div>';document.body.append(backdrop);
  const input=backdrop.querySelector('#commandSearch'),list=backdrop.querySelector('#commandList');
  const render=()=>{const q=input.value.toLowerCase();list.innerHTML=COMMANDS.filter(c=>c[0].toLowerCase().includes(q)).map((c,i)=>`<button class="command-item" data-command="${COMMANDS.indexOf(c)}"><span>${escapeHtml(c[0])}</span><small>${escapeHtml(c[1])}</small></button>`).join('')||'<p class="docs-no-results">No commands found.</p>';list.querySelectorAll('[data-command]').forEach(b=>b.addEventListener('click',()=>{const command=COMMANDS[Number(b.dataset.command)];backdrop.remove();command?.[2]();}));};
  input.addEventListener('input',render);backdrop.addEventListener('click',e=>{if(e.target===backdrop)backdrop.remove();});input.addEventListener('keydown',e=>{if(e.key==='Escape'){backdrop.remove();return;}if(e.key==='Enter')list.querySelector('button')?.click();});render();input.focus();
}

function formatBasicIndent() {
  const source = $('#codeEditor').value; const lines = source.split('\n'); let depth = 0;
  const formatted = lines.map((raw) => {
    const line = raw.trim(); if (!line) return '';
    const leadingClosers = (line.match(/^[}\]]+/)?.[0] || '').length; depth = Math.max(0, depth - leadingClosers);
    const result = `${'    '.repeat(depth)}${line}`;
    const opens = (line.match(/[({\[]/g) || []).length, closes = (line.match(/[)}\]]/g) || []).length;
    depth = Math.max(0, depth + opens - closes); return result;
  }).join('\n');
  $('#codeEditor').value = formatted; saveEditorToProject(); toast('Basic indentation formatting applied.', 'success');
}
function setTheme(theme) { document.documentElement.dataset.theme = theme; try { localStorage.setItem('orvexa-studio-theme', theme); } catch { /* theme remains active for this session */ } $('#themeButton').textContent = theme === 'light' ? '☾' : '☼'; }

function setupSceneTransformGizmo(scene, objectIndex = selectedSceneObjectIndex) {
  const svg = $('#sceneGizmo');
  if (!svg) return;
  const canvas = $('#sceneCanvas');
  const render = () => drawSceneTransformGizmo(scene, objectIndex);
  render();
  let drag = null;
  const localPoint = event => {
    const rect = svg.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  svg.onpointerdown = event => {
    const handle = event.target?.closest?.('[data-gizmo-axis]');
    if (!handle || event.button !== 0) return;
    const axis = handle.dataset.gizmoAxis;
    const mode = handle.dataset.gizmoMode || viewportGizmoMode;
    const dx = Number(handle.dataset.axisDx), dy = Number(handle.dataset.axisDy), magSq = dx * dx + dy * dy;
    if (!['x','y','z'].includes(axis) || !['move','rotate','scale'].includes(mode)) return;
    if (mode !== 'rotate' && (!Number.isFinite(magSq) || magSq < 0.04)) return;
    const obj = scene.objects?.[objectIndex];
    if (!obj) return;
    const point = localPoint(event);
    const center = { x: Number(handle.dataset.centerX), y: Number(handle.dataset.centerY) };
    if (!Number.isFinite(center.x) || !Number.isFinite(center.y)) return;
    const group = mode === 'move' ? (obj.position ||= { x: 0, y: 0, z: 0 }) : mode === 'rotate' ? (obj.rotation ||= { x: 0, y: 0, z: 0 }) : (obj.scale ||= { x: 1, y: 1, z: 1 });
    drag = {
      axis, mode, dx, dy, center, startX: point.x, startY: point.y,
      startValue: Number(group[axis]) || (mode === 'scale' ? 1 : 0),
      lastAngle: Math.atan2(point.y - center.y, point.x - center.x), angleTotal: 0, moved: false,
    };
    // The last recorded scene state becomes the exact pre-drag checkpoint for undo.
    recordSceneEdit(scene, `Before ${mode} gizmo`);
    try { svg.setPointerCapture(event.pointerId); } catch {}
    event.preventDefault(); event.stopPropagation();
  };
  svg.onpointermove = event => {
    if (!drag) return;
    const obj = scene.objects?.[objectIndex];
    if (!obj) { drag = null; return; }
    const point = localPoint(event);
    let value;
    if (drag.mode === 'rotate') {
      const angle = Math.atan2(point.y - drag.center.y, point.x - drag.center.x);
      let step = angle - drag.lastAngle;
      if (step > Math.PI) step -= Math.PI * 2;
      if (step < -Math.PI) step += Math.PI * 2;
      drag.angleTotal += step;
      drag.lastAngle = angle;
      value = Math.max(-Math.PI * 20, Math.min(Math.PI * 20, drag.startValue + drag.angleTotal));
      obj.rotation ||= { x: 0, y: 0, z: 0 };
      obj.rotation[drag.axis] = value;
    } else if (drag.mode === 'scale') {
      const magnitude = Math.hypot(drag.dx, drag.dy) || 1;
      const ux = drag.dx / magnitude, uy = drag.dy / magnitude;
      const screenDelta = (point.x - drag.startX) * ux + (point.y - drag.startY) * uy;
      const factor = Math.exp(Math.max(-9.2, Math.min(4.6, screenDelta / 105)));
      value = Math.max(0.01, Math.min(100, drag.startValue * factor));
      obj.scale ||= { x: 1, y: 1, z: 1 };
      obj.scale[drag.axis] = value;
    } else {
      const delta = ((point.x - drag.startX) * drag.dx + (point.y - drag.startY) * drag.dy) / Math.max(0.04, drag.dx * drag.dx + drag.dy * drag.dy);
      value = Math.max(-10000, Math.min(10000, drag.startValue + delta));
      obj.position ||= { x: 0, y: 0, z: 0 };
      obj.position[drag.axis] = value;
    }
    drag.moved = drag.moved || (drag.mode === 'rotate' ? Math.abs(drag.angleTotal) > 1e-4 : Math.abs(value - drag.startValue) > 1e-4);
    const fieldKey = drag.mode === 'move' ? drag.axis : `${drag.mode === 'rotate' ? 'rotation' : 'scale'}${drag.axis.toUpperCase()}`;
    const field = document.querySelector(`[data-transform="${fieldKey}"]`);
    if (field) field.value = String(Number((drag.mode === 'rotate' ? value * 180 / Math.PI : value).toFixed(3)));
    drawSceneTransformGizmo(scene, objectIndex);
    canvas?.dispatchEvent(new CustomEvent('orvexa-scene-change'));
    event.preventDefault(); event.stopPropagation();
  };
  const finishDrag = event => {
    if (!drag) return;
    const completed = drag; drag = null;
    try { if (svg.hasPointerCapture?.(event.pointerId)) svg.releasePointerCapture(event.pointerId); } catch {}
    const obj = scene.objects?.[objectIndex];
    if (obj && completed.moved) {
      saveSceneOverride(scene, objectIndex, obj);
      const value = Number((completed.mode === 'rotate' ? (Number(obj.rotation?.[completed.axis]) || 0) * 180 / Math.PI : completed.mode === 'scale' ? Number(obj.scale?.[completed.axis]) || 1 : Number(obj.position?.[completed.axis]) || 0).toFixed(2));
      const units = completed.mode === 'rotate' ? '°' : completed.mode === 'scale' ? '×' : 'units';
      const status = $('#sceneTransformStatus'); if (status) status.textContent = `${completed.mode.toUpperCase()} · ${completed.axis.toUpperCase()} · ${value}${units}`;
      canvas?.dispatchEvent(new CustomEvent('orvexa-scene-change'));
    } else drawSceneTransformGizmo(scene, objectIndex);
    event.preventDefault?.(); event.stopPropagation?.();
  };
  svg.onpointerup = finishDrag;
  svg.onpointercancel = finishDrag;
}

function drawSceneTransformGizmo(scene, objectIndex = selectedSceneObjectIndex) {
  const svg = $('#sceneGizmo');
  if (!svg) return;
  const canvas = $('#sceneCanvas');
  if (canvas?.dataset.renderer && canvas.dataset.renderer !== 'webgl') { svg.innerHTML = ''; return; }
  const rect = svg.getBoundingClientRect();
  const width = Math.max(1, rect.width), height = Math.max(1, rect.height);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  const object = scene?.objects?.[objectIndex];
  if (!object || object.visible === false || !['cube','sphere','plane','cylinder','torus','cone','pyramid','capsule','mesh'].includes(object.type)) { svg.innerHTML = ''; return; }
  const camera = scene.editorCamera || { target: { x: 0, y: 0, z: 0 }, angle: 0, pitch: Math.atan2(1.2, 7), zoom: Math.hypot(1.2, 7) };
  const center = projectScenePoint(object.position || { x: 0, y: 0, z: 0 }, camera, width, height);
  if (!center?.visible) { svg.innerHTML = ''; return; }
  const css = { x: '#ff5e6c', y: '#52e59b', z: '#69aaff' };
  const mode = viewportGizmoMode;
  let markup = `<circle cx="${center.x}" cy="${center.y}" r="4.2" fill="#f6f7ff" stroke="#10121c" stroke-width="1.5" pointer-events="none"/>`;
  if (mode === 'rotate') {
    const rings = [
      { axis: 'x', rx: 37, ry: 17, rotate: 54 },
      { axis: 'y', rx: 17, ry: 37, rotate: -36 },
      { axis: 'z', rx: 34, ry: 34, rotate: 0 },
    ];
    for (const ring of rings) {
      const transform = ring.rotate ? ` transform="rotate(${ring.rotate} ${center.x} ${center.y})"` : '';
      markup += `<ellipse cx="${center.x}" cy="${center.y}" rx="${ring.rx}" ry="${ring.ry}" fill="none" stroke="${css[ring.axis]}" stroke-width="2.6" opacity=".95" pointer-events="none"${transform}/><ellipse class="forge-gizmo-hit" cx="${center.x}" cy="${center.y}" rx="${ring.rx}" ry="${ring.ry}" fill="none" stroke="rgba(255,255,255,.001)" stroke-width="15" data-gizmo-axis="${ring.axis}" data-gizmo-mode="rotate" data-axis-dx="1" data-axis-dy="0" data-center-x="${center.x}" data-center-y="${center.y}" aria-label="Rotate around ${ring.axis.toUpperCase()} axis"${transform}/>`;
    }
    return void (svg.innerHTML = markup);
  }
  const sample = Math.max(0.2, Math.min(5, (Number(camera.zoom) || 7) * 0.12));
  for (const axis of ['x','y','z']) {
    const point = { x: Number(object.position?.x) || 0, y: Number(object.position?.y) || 0, z: Number(object.position?.z) || 0 };
    point[axis] += sample;
    const tip = projectScenePoint(point, camera, width, height);
    if (!tip || tip.depth <= 0.1) continue;
    const dx = (tip.x - center.x) / sample, dy = (tip.y - center.y) / sample;
    const magnitude = Math.hypot(dx, dy);
    if (!Number.isFinite(magnitude)) continue;
    let endX, endY;
    if (magnitude < 2) {
      const handleY = center.y + 28, depthDy = 40;
      if (mode === 'scale') {
        markup += `<rect x="${center.x-7}" y="${handleY-7}" width="14" height="14" rx="2" fill="#171a28" stroke="${css[axis]}" stroke-width="2.6" pointer-events="none"/><rect class="forge-gizmo-hit" x="${center.x-11}" y="${handleY-11}" width="22" height="22" fill="rgba(255,255,255,.001)" stroke="rgba(255,255,255,.001)" stroke-width="4" data-gizmo-axis="${axis}" data-gizmo-mode="scale" data-axis-dx="0" data-axis-dy="${depthDy}" data-center-x="${center.x}" data-center-y="${center.y}" aria-label="Scale on ${axis.toUpperCase()} axis"/>`;
      } else {
        markup += `<circle cx="${center.x}" cy="${handleY}" r="10" fill="#171a28" stroke="${css[axis]}" stroke-width="2.6" pointer-events="none"/><text x="${center.x}" y="${handleY + 4}" fill="${css[axis]}" font-size="11" font-weight="800" text-anchor="middle" pointer-events="none">${axis.toUpperCase()}</text><circle class="forge-gizmo-hit" cx="${center.x}" cy="${handleY}" r="12" fill="rgba(255,255,255,.001)" stroke="rgba(255,255,255,.001)" stroke-width="4" data-gizmo-axis="${axis}" data-gizmo-mode="move" data-axis-dx="0" data-axis-dy="${depthDy}" data-center-x="${center.x}" data-center-y="${center.y}" aria-label="Move on ${axis.toUpperCase()} depth axis"/>`;
      }
      continue;
    }
    const ux = dx / magnitude, uy = dy / magnitude;
    const length = 61; endX = center.x + ux * length; endY = center.y + uy * length;
    if (mode === 'scale') {
      markup += `<line x1="${center.x}" y1="${center.y}" x2="${endX}" y2="${endY}" stroke="${css[axis]}" stroke-width="2.8" stroke-linecap="round" pointer-events="none"/><rect x="${endX-6}" y="${endY-6}" width="12" height="12" fill="${css[axis]}" stroke="#171a28" stroke-width="1.5" pointer-events="none"/><line class="forge-gizmo-hit" x1="${center.x}" y1="${center.y}" x2="${endX}" y2="${endY}" stroke="rgba(255,255,255,.001)" stroke-width="17" stroke-linecap="round" data-gizmo-axis="${axis}" data-gizmo-mode="scale" data-axis-dx="${dx}" data-axis-dy="${dy}" data-center-x="${center.x}" data-center-y="${center.y}" aria-label="Scale on ${axis.toUpperCase()} axis"/>`;
    } else {
      const headX = endX - ux * 9, headY = endY - uy * 9, wing = 5;
      const p1x = headX - uy * wing, p1y = headY + ux * wing, p2x = headX + uy * wing, p2y = headY - ux * wing;
      markup += `<line x1="${center.x}" y1="${center.y}" x2="${endX}" y2="${endY}" stroke="${css[axis]}" stroke-width="2.8" stroke-linecap="round" pointer-events="none"/><polygon points="${endX},${endY} ${p1x},${p1y} ${p2x},${p2y}" fill="${css[axis]}" pointer-events="none"/><text x="${endX + ux * 9}" y="${endY + uy * 9 + 4}" fill="${css[axis]}" stroke="#11121e" stroke-width="2.5" paint-order="stroke" font-size="12" font-weight="800" text-anchor="middle" pointer-events="none">${axis.toUpperCase()}</text><line class="forge-gizmo-hit" x1="${center.x}" y1="${center.y}" x2="${endX}" y2="${endY}" stroke="rgba(255,255,255,.001)" stroke-width="15" stroke-linecap="round" data-gizmo-axis="${axis}" data-gizmo-mode="move" data-axis-dx="${dx}" data-axis-dy="${dy}" data-center-x="${center.x}" data-center-y="${center.y}" aria-label="Move on ${axis.toUpperCase()} axis"/>`;
    }
  }
  svg.innerHTML = markup;
}

function updateTransformStatus() {
  const output = $('#sceneTransformStatus');
  if (!output) return;
  if (!transformModeState) { output.textContent = 'G / R / S → X / Y / Z → value → Enter'; return; }
  const modeNames = { move: 'MOVE', rotate: 'ROTATE', scale: 'SCALE' };
  const unit = transformModeState.mode === 'rotate' ? 'deg' : transformModeState.mode === 'scale' ? 'factor' : 'units';
  output.textContent = `${modeNames[transformModeState.mode]} · axis ${transformModeState.axis || '?'} · ${transformModeState.value || `default ${transformModeState.mode === 'rotate' ? '15°' : transformModeState.mode === 'scale' ? '×1.1' : '1 unit'}`} ${unit} · Enter apply / Esc cancel`;
}
function beginTransformMode(mode) {
  const scene = lastResult?.scenes?.[currentSceneIndex], obj = scene?.objects?.[selectedSceneObjectIndex];
  if (!scene || !obj || ['animation','rigidbody','material'].includes(obj.type)) { toast('Select an editable scene object first.', 'info'); return; }
  transformModeState = { mode, axis: null, value: '' };
  updateTransformStatus();
  toast(`${mode[0].toUpperCase()+mode.slice(1)} mode: choose X, Y or Z, type a value, then press Enter. Esc cancels.`, 'info');
}
function handleTransformModeKey(event) {
  if (!transformModeState) return false;
  const key = String(event.key || '').toLowerCase();
  if (key === 'escape') { event.preventDefault(); transformModeState = null; updateTransformStatus(); toast('Transform cancelled.', 'info'); return true; }
  if (key === 'x' || key === 'y' || key === 'z') { event.preventDefault(); transformModeState.axis = key; updateTransformStatus(); return true; }
  if (key === 'backspace') { event.preventDefault(); transformModeState.value = transformModeState.value.slice(0, -1); updateTransformStatus(); return true; }
  if (key.length === 1 && /[0-9.\-]/.test(key)) {
    const next = transformModeState.value + key;
    if (/^-?\d*\.?\d*$/.test(next) && (next.match(/\./g) || []).length <= 1) { event.preventDefault(); transformModeState.value = next; updateTransformStatus(); }
    return true;
  }
  if (key === 'enter') {
    event.preventDefault();
    const command = transformModeState;
    if (!command.axis) { toast('Choose an axis first: X, Y or Z.', 'warning'); return true; }
    const scene = lastResult?.scenes?.[currentSceneIndex], obj = scene?.objects?.[selectedSceneObjectIndex];
    if (!scene || !obj) { transformModeState = null; updateTransformStatus(); return true; }
    const axis = command.axis;
    const value = command.value === '' ? (command.mode === 'rotate' ? 15 : command.mode === 'scale' ? 1.1 : 1) : Number(command.value);
    if (!Number.isFinite(value) || (command.mode === 'scale' && value <= 0)) { toast('Enter a valid number; scale factors must be greater than zero.', 'warning'); return true; }
    try { applyAxisTransform(obj, command.mode, axis, value); }
    catch (error) { toast(error.message || 'Transform could not be applied.', 'warning'); return true; }
    transformModeState = null;
    saveSceneOverride(scene, selectedSceneObjectIndex, obj);
    saveLocal(true);
    renderSceneTab(lastResult);
    toast(`${command.mode[0].toUpperCase()+command.mode.slice(1)} applied on ${axis.toUpperCase()}.`, 'success');
    return true;
  }
  return false;
}

function bindEvents() {
  $('#codeEditor').value = contentOf(); refreshHighlights();
  $('#codeEditor').addEventListener('input', () => { saveEditorToProject(); if(!$('#autocompleteMenu').hidden)showAutocomplete(); });
  $('#codeEditor').addEventListener('scroll', updateScroll);
  $('#codeEditor').addEventListener('click', updateCursorPosition);
  $('#codeEditor').addEventListener('keyup', updateCursorPosition);
  $('#codeEditor').addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveLocal(true); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); runProgram({ source: e.currentTarget.value }); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); openFind(); }
    if ((e.ctrlKey || e.metaKey) && e.code === 'Space') { e.preventDefault(); showAutocomplete(); return; }
    if (!$('#autocompleteMenu').hidden && ['ArrowDown','ArrowUp'].includes(e.key)) { e.preventDefault(); autocompleteIndex=(autocompleteIndex+(e.key==='ArrowDown'?1:-1)+autocompleteItems.length)%autocompleteItems.length; $$('[data-completion]',$('#autocompleteMenu')).forEach((b,i)=>b.classList.toggle('active',i===autocompleteIndex)); return; }
    if (!$('#autocompleteMenu').hidden && (e.key==='Tab'||e.key==='Enter')) { e.preventDefault(); insertCompletion(); return; }
    if (e.key==='Escape') menuHide();
    if (e.key === 'Tab') { e.preventDefault(); const start = e.currentTarget.selectionStart, end = e.currentTarget.selectionEnd, value = e.currentTarget.value; e.currentTarget.value = value.slice(0, start) + '    ' + value.slice(end); e.currentTarget.setSelectionRange(start + 4, start + 4); saveEditorToProject(); }
    if (e.key === 'Enter') {
      const value = e.currentTarget.value, caret = e.currentTarget.selectionStart, lineStart = value.lastIndexOf('\n', caret - 1) + 1, indent = value.slice(lineStart, caret).match(/^\s*/)?.[0] || '';
      if (indent) { e.preventDefault(); e.currentTarget.setRangeText(`\n${indent}`, caret, e.currentTarget.selectionEnd, 'end'); saveEditorToProject(); }
    }
    const pairs = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'" };
    if (pairs[e.key] && !e.ctrlKey && !e.metaKey && !e.altKey && e.currentTarget.selectionStart === e.currentTarget.selectionEnd && ['(', '[', '{', '"', "'"].includes(e.key)) {
      if (e.key === '"' || e.key === "'") { const after = e.currentTarget.value[e.currentTarget.selectionStart]; if (after && /[A-Za-z0-9]/.test(after)) return; }
      e.preventDefault(); const pos = e.currentTarget.selectionStart; e.currentTarget.setRangeText(e.key + pairs[e.key], pos, pos, 'end'); e.currentTarget.setSelectionRange(pos + 1, pos + 1); saveEditorToProject();
    }
  });
  $('#runButton').addEventListener('click', () => runProgram({ source: $('#codeEditor').value }));
  $('#previewRunButton')?.addEventListener('click', () => runProgram({ source: $('#codeEditor').value }));
  $('#refreshPreviewButton').addEventListener('click', () => runProgram({ source: $('#codeEditor').value }));
  $('#saveButton').addEventListener('click', () => saveLocal(true));
  $('#buildButton').addEventListener('click', buildWebsite);
  $('#stopButton').setAttribute('aria-label', 'Stop is not available because execution is synchronous in this version');
  $('#exportButton').addEventListener('click', exportProject);
  $('#downloadButton').addEventListener('click', downloadCurrentFile);
  $('#importButton').addEventListener('click', importProject);
  $('#importInput').addEventListener('change', (e) => onImportFile(e.target.files?.[0]));
  $('#newFileButton').addEventListener('click', addNewFile);
  $('#newFolderButton').addEventListener('click', addNewFolder);
  $('#explorerMenuButton').addEventListener('click', () => { const action = prompt('Project action: rename project, rename file, delete file, build, or export', 'rename project'); if (action === 'rename project') { const name = prompt('Project name:', project.name); if (name?.trim()) { project.name = name.trim().slice(0, 100); renderTree(); saveLocal(true); } } else if (action === 'rename file') renameActiveFile(); else if (action === 'delete file') deleteActiveFile(); else if (action === 'build') buildWebsite(); else if (action === 'export') exportProject(); else if (action) toast('Choose rename project, rename file, delete file, build, or export.', 'warning'); });
  $('#editorMenuButton').addEventListener('click', () => { const action = prompt('Editor action: rename file, delete file, or download file', 'rename file'); if (action?.toLowerCase() === 'rename file') renameActiveFile(); else if (action?.toLowerCase() === 'delete file') deleteActiveFile(); else if (action?.toLowerCase() === 'download file') downloadCurrentFile(); else if (action) toast('Action not recognized.', 'warning'); });
  $('#projectNameButton').addEventListener('click', () => { const name = prompt('Project name:', project.name); if (name?.trim()) { project.name = name.trim().slice(0, 100); renderTree(); saveLocal(true); } });
  $('#findButton').addEventListener('click', openFind); $('#findClose').addEventListener('click', closeFind);
  $('#findInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); moveToMatch(e.shiftKey ? -1 : 1); } if (e.key === 'Escape') closeFind(); });
  $('#findInput').addEventListener('input', () => moveToMatch(1)); $('#findNext').addEventListener('click', () => moveToMatch(1)); $('#findPrev').addEventListener('click', () => moveToMatch(-1));
  $('#formatButton').addEventListener('click', formatBasicIndent);
  $('#clearConsoleButton').addEventListener('click', () => { if ($('.console-tab.active')?.dataset.consoleTab === 'build') buildLogs = []; renderConsole([]); });
  $$('.console-tab').forEach((b) => b.addEventListener('click', () => activateConsoleTab(b.dataset.consoleTab)));
  $('#collapseConsoleButton').addEventListener('click', () => { $('#consolePanel').classList.toggle('collapsed'); $('#collapseConsoleButton').textContent = $('#consolePanel').classList.contains('collapsed') ? '⌃' : '⌄'; });
  $$('[data-right-tab]').forEach((button) => button.addEventListener('click', () => activateRightTab(button.dataset.rightTab)));
  $('#examplesToggle').addEventListener('click', () => { const list = $('#exampleList'); list.hidden = !list.hidden; $('#examplesToggle').textContent = list.hidden ? '+' : '−'; });
  $('#exampleList').addEventListener('click', (e) => { const button = e.target.closest('[data-example]'); if (button) openExample(button.dataset.example); });
  $('#fileTree').addEventListener('click', (e) => { const button = e.target.closest('[data-path]'); if (!button) return; const path = button.dataset.path; if (button.dataset.kind === 'file') setCurrentFile(path); else { const hasContent = Object.keys(project.files).some((f) => f.startsWith(`${path}/`)); if (hasContent) { const current = button.classList.toggle('folder-collapsed'); button.setAttribute('aria-expanded', String(!current)); $$('.tree-item', $('#fileTree')).forEach((child) => { if (child.dataset.path.startsWith(`${path}/`)) child.hidden = current; }); } else toast(`Folder "${path}" is empty. Add a file to it.`, 'info'); } });
  $('#fileTree').addEventListener('contextmenu', (e) => {
    const item = e.target.closest('[data-path]'); if (!item) return; e.preventDefault();
    if (item.dataset.kind === 'file') {
      setCurrentFile(item.dataset.path); const action = prompt(`Action for ${item.dataset.path}: rename or delete`, 'rename');
      if (action === 'rename') renameActiveFile(); else if (action === 'delete') deleteActiveFile();
      return;
    }
    const folder = item.dataset.path; const action = prompt(`Folder ${folder}: rename or delete`, 'rename');
    if (action === 'rename') {
      const requested = prompt('New folder path:', folder); if (!requested || requested === folder) return;
      try {
        const destination = normalizePath(requested);
        if (destination === folder || destination.startsWith(`${folder}/`)) throw new Error('A folder cannot be moved inside itself.');
        const moves = Object.keys(project.files).filter((p) => p.startsWith(`${folder}/`));
        for (const path of moves) { const next = normalizePath(`${destination}/${path.slice(folder.length + 1)}`); if (project.files[next] !== undefined) throw new Error(`A file already exists at ${next}.`); }
        const nextFiles = { ...project.files };
        for (const path of moves) { const next = `${destination}/${path.slice(folder.length + 1)}`; nextFiles[next] = project.files[path]; delete nextFiles[path]; }
        project.files = nextFiles;
        project.folders = project.folders.map((p) => p === folder ? destination : p.startsWith(`${folder}/`) ? `${destination}/${p.slice(folder.length + 1)}` : p);
        if (!project.folders.includes(destination)) project.folders.push(destination);
        if (project.activeFile && !project.files[project.activeFile]) project.activeFile = moves.length ? `${destination}/${moves[0].slice(folder.length + 1)}` : currentFile();
        renderTree(); setCurrentFile(project.activeFile); saveLocal(true); toast(`Renamed folder to ${destination}`, 'success');
      } catch (error) { toast(error.message, 'error'); }
    } else if (action === 'delete') {
      if (!confirm(`Delete folder "${folder}" and all of its files from this project?`)) return;
      const remove = Object.keys(project.files).filter((p) => p.startsWith(`${folder}/`)); remove.forEach((p) => delete project.files[p]);
      project.folders = project.folders.filter((p) => p !== folder && !p.startsWith(`${folder}/`));
      if (!Object.keys(project.files).length) project.files['main.orv'] = `app "Orvexa App"\n`;
      if (!project.files[project.activeFile]) project.activeFile = Object.keys(project.files)[0];
      renderTree(); setCurrentFile(project.activeFile); saveLocal(true); toast(`Deleted folder ${folder}`, 'success');
    }
  });
  $('#previewMenuButton').addEventListener('click', () => { const action = prompt('Preview action: website, scene, game, or docs', currentRightTab); if (['preview', 'scene', 'game', 'docs'].includes(action)) activateRightTab(action); });
  $('#playWorldButton').addEventListener('click', () => activateRightTab('game'));
  document.querySelectorAll('.experience-switch-button').forEach(b => b.addEventListener('click', () => applyExperienceMode(b.dataset.experienceMode)));
  applyExperienceMode(experienceMode, false);
  $('#quickCreateTopButton')?.addEventListener('click', () => activateRightTab('launchpad'));
  $('#aiAgentTopButton')?.addEventListener('click', () => activateRightTab('ai'));
  $('#autoFixTopButton')?.addEventListener('click', () => { activateRightTab('ai'); setTimeout(() => $('#autoFixWithAiButton')?.click(), 60); });
  $('#themeButton').addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'));
  $('#editorMenuButton').setAttribute('aria-label', 'Editor options');
  $('#previewContent').addEventListener('click', (e) => { const jump = e.target.closest('[data-line]'); if (jump) jumpTo(Number(jump.dataset.line), Number(jump.dataset.column)); });
  $('#consoleContent').addEventListener('click', (e) => { const jump = e.target.closest('[data-line]'); if (jump) jumpTo(Number(jump.dataset.line), Number(jump.dataset.column)); });
  $('#editorWorkspace').addEventListener('dragover', (e) => { e.preventDefault(); $('#editorWorkspace').classList.add('dragging'); });
  $('#editorWorkspace').addEventListener('dragleave', () => $('#editorWorkspace').classList.remove('dragging'));
  $('#editorWorkspace').addEventListener('drop', async (e) => { e.preventDefault(); $('#editorWorkspace').classList.remove('dragging'); const file = e.dataTransfer.files?.[0]; if (file) await onImportFile(file); });
  document.addEventListener('keydown', (e) => { const tag=String(document.activeElement?.tagName||'').toUpperCase(),editing=['INPUT','TEXTAREA','SELECT'].includes(tag)||document.activeElement?.isContentEditable; if (currentRightTab==='scene'&&!editing&&!e.ctrlKey&&!e.metaKey&&transformModeState&&handleTransformModeKey(e)) return; if (currentRightTab==='scene'&&!editing&&!e.ctrlKey&&!e.metaKey&&['g','r','s'].includes(e.key.toLowerCase())) { e.preventDefault(); beginTransformMode(({g:'move',r:'rotate',s:'scale'})[e.key.toLowerCase()]); return; } if ((e.ctrlKey||e.metaKey)&&currentRightTab==='scene'&&!editing&&e.key.toLowerCase()==='z') { e.preventDefault(); transformModeState=null; applySceneHistory(lastResult?.scenes?.[currentSceneIndex],e.shiftKey?'redo':'undo'); return; } if ((e.ctrlKey||e.metaKey)&&currentRightTab==='scene'&&!editing&&e.key.toLowerCase()==='y') { e.preventDefault(); applySceneHistory(lastResult?.scenes?.[currentSceneIndex],'redo'); return; } if (currentRightTab==='scene'&&!editing&&!e.ctrlKey&&!e.metaKey&&e.key.toLowerCase()==='f') { e.preventDefault(); focusSceneCamera(lastResult?.scenes?.[currentSceneIndex],'selected'); } if ((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key.toLowerCase()==='p') { e.preventDefault(); openCommandPalette(); } if (e.key === 'Escape' && activeFind) closeFind(); if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName) && currentRightTab === 'docs') { e.preventDefault(); $('#docsSearchInput')?.focus(); } });
}

renderShell();
renderTree();
bindEvents();
try { if (!localStorage.getItem('orvexa-tour-done')) setTimeout(() => { if (experienceMode === 'beginner') startTour(); }, 900); } catch {}
setTheme(localStorage.getItem('orvexa-studio-theme') || 'dark');
$('#editorHint').hidden = true;
$('#globalState').textContent = 'Ready';
saveLocal();
renderPreview(null);
renderDocsTab();
// A failed or incomplete project load must never run uploaded code automatically.
window.addEventListener('beforeunload', () => { worldGameCleanup?.(); if (project?.files) { project.files[currentFile()] = $('#codeEditor')?.value ?? project.files[currentFile()]; saveProject(project); } });
