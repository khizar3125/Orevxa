import { createMeshGeometry, projectScenePoint, startWebGLScene } from './studio/scene3d.js';
import { createProceduralTerrainGeometry, mirrorTriangleMesh, optimizeTriangleMesh, subdivideTriangleMesh } from './studio/engine.js';
import { bakeTriangleMeshTransform, createBasicRig, generatePlanarUVs, inspectUVLayout, joinTriangleMeshes, sculptTriangleMesh, solveRigIK, unwrapMeshUVIslands, validateUVs } from './studio/modeling.js';
import { exportFBX, exportGLB, exportOBJ, importFBX, importGLTF, parseOBJ } from './studio/assetFormats.js';
import { evaluateModifierStack, MODIFIER_TYPES, normalizeModifier, smoothTriangleMesh } from './studio/modifiers.js';
import { booleanTriangleMeshes, coplanarTriangleRegion, deleteSelectedFaces, extrudeTriangleFaces, fillMeshHoles, flipMeshNormals, fractureTriangleMesh, insetTriangleFaces, inspectMeshTopology, loopCutTriangleMesh, meshEdgeKey, meshVertexKey, pokeSelectedFaces, recalculateMeshNormals, splitSelectedEdges, translateMeshElements, weldMeshVertices, subdivideCatmullClark, latheProfileDetailed, geodesicSphereDetailed, fractureMeshVoronoi3D, bridgeVertexLoops } from './studio/meshEdit.js';
import { createWorldAssetPackage, WORLD_ASSETS_STORAGE_KEY } from './studio/worldAssets.js';
import { buildPresetMaterialGraph, compileMaterialGraphToPBR, renderMaterialGraphSvg } from './studio/materialGraph.js';
import { buildPresetGeometryNodeGraph, evaluateGeometryNodeGraph, renderGeometryNodeGraphSvg } from './studio/geometryNodes.js';
import { PREFAB_KITBASH_LIBRARY, ATMOSPHERE_MOODS, getPrefabKitbash } from './studio/templates.js';
import { synthesizeRichOrvexaProject, critiqueAndEnhanceProject, executeAgentTool } from './studio/aiAgent.js';
import { getSequencerPreset, renderTimelineSvg } from './studio/sequencer.js';
import { buildTerrainFromPreset } from './studio/terrainLab.js';
import { buildNaniteClusterDAG, decimateTriangleMesh } from './studio/naniteLod.js';
import { buildVfxTriangleMesh, createVfxEmitter, stepVfxEmitter } from './studio/vfx.js';

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const STORAGE_KEY = 'orvexa-modeler-project-v1';
const MAX_LOCAL_SAVE = 3_000_000;
const MAX_GEOMETRY_FLOATS = 2_250_000;
const RENDER_SETTINGS = { shadows: true, postProcessing: true, fog: false, exposure: 1.18, vignette: 0.12, fogDensity: 0.012, fogColor: '#7788aa', performanceMode: 'balanced', adaptiveResolution: true, environmentStrength: 1.25, shadowSoftness: 1.1, shadowResolution: 1024, shadowCasterId: 'auto' };
let scene;
let cleanupRenderer = null;
let activeObjectId = null;
let selectedIds = new Set();
let editSelectionMode = 'face';
let selectedEditFaces = new Set();
let selectedEditVertices = new Set();
let selectedEditEdges = new Set();
let activeInspectorTab = 'object';
let activeMode = 'object';
let activeModifierId = null;
let brushRadius = 0.45;
let brushStrength = 0.18;
let activeSculptStroke = false;
let lastPointer = null;
let toastTimer = 0;
let saveTimer = 0;
let uniqueCounter = 1;
let history = [];
let future = [];
let historyGestureRecorded = false;

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const finite = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
const esc = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const uid = prefix => `${prefix}-${Date.now().toString(36)}-${(uniqueCounter++).toString(36)}`;
const round = (n, digits = 3) => Number(Number(n || 0).toFixed(digits));
const axis = ['x', 'y', 'z'];
const radToDeg = n => Number(n || 0) * 180 / Math.PI;
const degToRad = n => Number(n || 0) * Math.PI / 180;

function makeMesh(primitive, index = 0, options = {}) {
  const name = options.name || `${primitive[0].toUpperCase()}${primitive.slice(1)} ${index || 1}`;
  const baseGeometry = options.baseGeometry ? Array.from(options.baseGeometry) : Array.from(options.geometry || createMeshGeometry(primitive, options.segments || 16));
  if (baseGeometry.length < 9 || baseGeometry.length % 9 !== 0 || baseGeometry.length > MAX_GEOMETRY_FLOATS || !baseGeometry.every(Number.isFinite)) throw new Error('The new object has invalid or oversized triangle geometry.');
  const obj = {
    __orvexaScene: true, engineId: options.engineId || uid('mesh'), type: 'mesh', primitive: options.primitive || primitive, name,
    position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, size: 1,
    color: options.color || ({ cube: '#8270ff', sphere: '#51c8c0', torus: '#f4a261', cylinder: '#71a2ff', cone: '#f28ab2', plane: '#26324a', pyramid: '#b2a0ff', capsule: '#edbc6a', terrain: '#60866b' })[primitive] || '#8270ff',
    material: { metallic: 0.05, roughness: 0.58, emissive: 0, clearcoat: 0, ...(options.material || {}) }, visible: options.visible !== false,
    baseGeometry, geometry: baseGeometry.slice(), modifiers: (options.modifiers || []).map((m, i) => normalizeModifier(m, i + 1)), flatShading: options.flatShading === true,
    uvs: Array.isArray(options.uvs) ? [...options.uvs] : null, geometryRevision: 1,
    gameplayRole: options.gameplayRole || 'prop',
    collisionMode: options.collisionMode || 'solid',
    loreText: String(options.loreText || '').slice(0, 220),
    ...(options.materialGraph ? { materialGraph: options.materialGraph } : {}),
  };
  obj.position = { ...obj.position, ...(options.position || {}) };
  obj.rotation = { ...obj.rotation, ...(options.rotation || {}) };
  obj.scale = { ...obj.scale, ...(options.scale || {}) };
  obj.size = Math.max(0.01, finite(options.size, 1));
  if (obj.modifiers.length) evaluateObject(obj, false);
  return obj;
}

function makeLight(kind, index) {
  const presets = {
    directional: { name: 'Key Light', position: { x: 4, y: 6, z: 3 }, color: '#fff0d6', intensity: 2.8, direction: { x: -0.45, y: -1, z: -0.38 }, range: 60 },
    point: { name: 'Fill Light', position: { x: -3, y: 2.8, z: 2 }, color: '#9fc8ff', intensity: 1.6, direction: { x: 0, y: -1, z: 0 }, range: 16 },
    spot: { name: 'Rim Light', position: { x: 0, y: 4, z: -5 }, color: '#b4a5ff', intensity: 2.2, direction: { x: 0, y: -0.55, z: 0.85 }, range: 22, innerCone: 20, outerCone: 35 },
  };
  const preset = presets[kind];
  return { __orvexaScene: true, engineId: uid('light'), type: 'light', lightType: kind, name: preset.name, position: { ...preset.position }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, color: preset.color, intensity: preset.intensity, direction: { ...preset.direction }, range: preset.range, innerCone: preset.innerCone || 15, outerCone: preset.outerCone || 35, visible: true };
}

function createDefaultProject() {
  const objects = [
    makeMesh('cube', 1, { name: 'Main Cube' }),
    makeMesh('sphere', 2, { name: 'Preview Sphere', position: { x: -1.55, y: 0, z: 0 }, color: '#49c8c2', material: { metallic: 0.18, roughness: 0.32 } }),
    makeMesh('torus', 3, { name: 'Torus Study', position: { x: 1.65, y: 0.05, z: 0 }, color: '#f1a35d', material: { metallic: 0.55, roughness: 0.27 } }),
    makeMesh('plane', 4, { name: 'Studio Floor', position: { x: 0, y: -1.05, z: 0 }, scale: { x: 22, y: 1, z: 22 }, size: 1, color: '#172034', material: { metallic: 0.04, roughness: 0.94 } }),
    makeLight('directional', 1), makeLight('point', 2), makeLight('spot', 3),
  ];
  return { schema: 'orvexa-modeler-project', version: 1, name: 'Untitled Model', objects, renderSettings: { ...RENDER_SETTINGS }, worldPartition: { enabled: false, cellSize: 128, loadRadius: 3, maxLoadedCells: 4096 }, editorCamera: { target: { x: 0, y: -0.05, z: 0 }, angle: -0.42, pitch: 0.28, zoom: 7.4 } };
}

function serializeObject(obj) {
  const copy = { ...obj };
  delete copy.geometry;
  delete copy.renderStats;
  if (obj.baseGeometry) copy.baseGeometry = Array.from(obj.baseGeometry);
  if (obj.modifiers) copy.modifiers = obj.modifiers.map((m, i) => normalizeModifier(m, i + 1));
  if (obj.uvs) copy.uvs = Array.from(obj.uvs);
  return copy;
}
function serializeProject() {
  return { schema: 'orvexa-modeler-project', version: 1, name: scene.name || 'Untitled Model', objects: scene.objects.map(serializeObject), renderSettings: { ...scene.renderSettings }, worldPartition: { enabled: scene.worldPartition?.enabled === true, cellSize: clamp(Math.round(finite(scene.worldPartition?.cellSize, 128)), 8, 4096), loadRadius: clamp(Math.round(finite(scene.worldPartition?.loadRadius, 3)), 0, 16), maxLoadedCells: clamp(Math.round(finite(scene.worldPartition?.maxLoadedCells, 4096)), 1, 20000) }, editorCamera: structuredCloneSafe(scene.editorCamera) };
}
function structuredCloneSafe(value) { try { return JSON.parse(JSON.stringify(value)); } catch { return {}; } }

function normalizeLoadedProject(input) {
  if (!input || input.schema !== 'orvexa-modeler-project' || !Array.isArray(input.objects)) throw new Error('This is not an Orvexa Modeler project file.');
  if (input.objects.length > 1000) throw new Error('The project has more than 1,000 objects.');
  const result = [];
  for (const [index, source] of input.objects.entries()) {
    if (source.type === 'light') {
      result.push({ ...makeLight(['directional', 'point', 'spot'].includes(source.lightType) ? source.lightType : 'point', index + 1), ...source, engineId: source.engineId || uid('light') });
      continue;
    }
    const base = source.baseGeometry || source.geometry;
    if (!(Array.isArray(base) || ArrayBuffer.isView(base)) || base.length < 9 || base.length % 9 !== 0 || base.length > MAX_GEOMETRY_FLOATS) throw new Error(`Object ${index + 1} has invalid mesh data.`);
    const obj = makeMesh('mesh', index + 1, { ...source, primitive: source.primitive || 'mesh', baseGeometry: base, engineId: source.engineId || uid('mesh') });
    obj.name = String(source.name || `Mesh ${index + 1}`).slice(0, 100);
    obj.visible = source.visible !== false;
    obj.material = { metallic: 0.05, roughness: 0.68, emissive: 0, clearcoat: 0, ...(source.material || {}) };
    obj.modifiers = (Array.isArray(source.modifiers) ? source.modifiers : []).slice(0, 32).map((m, i) => normalizeModifier(m, i + 1));
    obj.uvs = Array.isArray(source.uvs) && source.uvs.length <= MAX_GEOMETRY_FLOATS / 3 * 2 ? [...source.uvs] : null;
    if (obj.uvs && !validateUVs(obj.uvs, obj.geometry.length / 3)) obj.uvs = null;
    evaluateObject(obj, false);
    result.push(obj);
  }
  if (!result.some(o => o.type !== 'light')) result.unshift(makeMesh('cube', 1, { name: 'Main Cube' }));
  if (!result.some(o => o.type === 'light')) result.push(makeLight('directional', 1), makeLight('point', 2), makeLight('spot', 3));
  const wp = input.worldPartition || {};
  return { schema: 'orvexa-modeler-project', version: 1, name: String(input.name || 'Untitled Model').slice(0, 90), objects: result, renderSettings: { ...RENDER_SETTINGS, ...(input.renderSettings || {}) }, worldPartition: { enabled: wp.enabled === true, cellSize: clamp(Math.round(finite(wp.cellSize, 128)), 8, 4096), loadRadius: clamp(Math.round(finite(wp.loadRadius, 3)), 0, 16), maxLoadedCells: clamp(Math.round(finite(wp.maxLoadedCells, 4096)), 1, 20000) }, editorCamera: input.editorCamera || { target: { x: 0, y: 0, z: 0 }, angle: 0.4, pitch: 0.3, zoom: 7 } };
}

function showToast(message, kind = 'info') {
  const el = $('#modelerToast'); el.textContent = message; el.className = `toast visible ${kind}`;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('visible'), 3300);
}
function setSavedState(message, danger = false) { $('#saveState').textContent = message; $('#saveState').style.color = danger ? '#ff9da5' : ''; }
function scheduleLocalSave() {
  setSavedState('Saving…'); clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const source = JSON.stringify(serializeProject());
      if (source.length > MAX_LOCAL_SAVE) { setSavedState('Use Save Project for large scenes', true); return; }
      localStorage.setItem(STORAGE_KEY, source); setSavedState('Saved locally');
    } catch { setSavedState('Local storage full — export project', true); }
  }, 450);
}

function restoreProject() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return normalizeLoadedProject(JSON.parse(stored));
  } catch (error) { console.warn('Orvexa Modeler local project could not be restored:', error); }
  return createDefaultProject();
}

function rememberHistory() {
  try {
    const snap = JSON.stringify(serializeProject());
    history.push(snap); if (history.length > 24) history.shift(); future = [];
    updateUndoRedo();
  } catch { /* Large projects still remain editable; their change simply has no undo snapshot. */ }
}
function restoreSnapshot(snapshot) {
  const loaded = normalizeLoadedProject(JSON.parse(snapshot));
  scene.name = loaded.name; scene.objects = loaded.objects; scene.renderSettings = loaded.renderSettings; scene.worldPartition = loaded.worldPartition; scene.editorCamera = loaded.editorCamera;
  activeObjectId = scene.objects.find(o => o.type !== 'light')?.engineId || null; selectedIds = new Set(activeObjectId ? [activeObjectId] : []); activeModifierId = null; clearEditSelection();
  $('#projectName').value = scene.name; updateWorldPartitionControls(); rebuildRenderer(); renderAll(); scheduleLocalSave();
}
function updateUndoRedo() { $('#undoButton').disabled = history.length === 0; $('#redoButton').disabled = future.length === 0; }
function undo() { if (!history.length) return; try { future.push(JSON.stringify(serializeProject())); restoreSnapshot(history.pop()); showToast('Undo applied.'); } catch (error) { showToast(error.message, 'error'); } updateUndoRedo(); }
function redo() { if (!future.length) return; try { history.push(JSON.stringify(serializeProject())); restoreSnapshot(future.pop()); showToast('Redo applied.'); } catch (error) { showToast(error.message, 'error'); } updateUndoRedo(); }

function updateWorldPartitionControls() {
  const wp = scene.worldPartition ||= { enabled: false, cellSize: 128, loadRadius: 3, maxLoadedCells: 4096 };
  const button = $('#worldPartitionToggleButton'); button.textContent = wp.enabled ? 'World Stream: On' : 'World Stream: Off'; button.classList.toggle('active', wp.enabled); button.setAttribute('aria-pressed', String(wp.enabled));
  $('#worldCellSizeSelect').value = String(wp.cellSize); $('#worldLoadRadiusSelect').value = String(wp.loadRadius);
}
function renderAll() { updateEditToolVisibility(); renderOutliner(); renderInspector(); renderStats(); renderWireframe(); renderUVPreview(); updateUndoRedo(); updateWorldPartitionControls(); }
function getObject(id = activeObjectId) { return scene.objects.find(obj => obj.engineId === id) || null; }
function getSelectedObjects() { return scene.objects.filter(obj => selectedIds.has(obj.engineId) && obj.type !== 'light'); }
function selectedObject() { return getObject(activeObjectId); }
function clearEditSelection() { selectedEditFaces.clear(); selectedEditVertices.clear(); selectedEditEdges.clear(); }
function editSelectionCount() { return editSelectionMode === 'vertex' ? selectedEditVertices.size : editSelectionMode === 'edge' ? selectedEditEdges.size : selectedEditFaces.size; }
function updateEditToolVisibility() { const tools = $('#editModeTools'); if (tools) tools.hidden = activeMode !== 'edit' || selectedObject()?.type !== 'mesh'; }
function uniqueMeshVertexCount(geometry) { const keys = new Set(); for (let i = 0; i < geometry.length; i += 3) keys.add(meshVertexKey([geometry[i], geometry[i + 1], geometry[i + 2]])); return keys.size; }
function selectObject(id, { shift = false } = {}) {
  const obj = getObject(id); if (!obj) return;
  const previousActiveId = activeObjectId;
  if (shift && obj.type !== 'light') {
    if (selectedIds.has(id) && selectedIds.size > 1) selectedIds.delete(id); else selectedIds.add(id);
    activeObjectId = id;
  } else { activeObjectId = id; selectedIds = new Set([id]); }
  if (activeObjectId !== previousActiveId) { activeModifierId = null; clearEditSelection(); }
  updateEditToolVisibility(); renderOutliner(); renderInspector(); renderStats(); renderWireframe(); renderUVPreview();
}
function renderOutliner() {
  const filter = $('#outlinerSearch').value.trim().toLowerCase();
  const objects = scene.objects.filter(obj => !filter || obj.name.toLowerCase().includes(filter) || String(obj.primitive || obj.lightType || obj.type).toLowerCase().includes(filter));
  $('#objectCount').textContent = String(scene.objects.length);
  $('#outliner').innerHTML = objects.map((obj, index) => {
    const isLight = obj.type === 'light'; const icon = isLight ? '☼' : ({ cube: '▦', sphere: '◉', torus: '◎', plane: '▱', cylinder: '⬭', cone: '△', terrain: '⛰' }[obj.primitive] || '◇');
    return `<button class="outliner-item ${isLight ? 'light' : ''} ${selectedIds.has(obj.engineId) ? 'selected' : ''}" data-id="${esc(obj.engineId)}" title="${esc(obj.name)}"><span class="object-icon">${icon}</span><span class="object-label">${esc(obj.name)}</span><span class="visibility" data-visibility="${esc(obj.engineId)}" title="Toggle visibility">${obj.visible === false ? '◌' : '◉'}</span></button>`;
  }).join('') || '<p class="empty-note">No matching objects.</p>';
}
function renderStats() {
  const obj = selectedObject();
  const wp = scene?.worldPartition || {};
  $('#worldPartitionStatus').textContent = wp.enabled ? `Streaming · ${wp.cellSize}u cells / radius ${wp.loadRadius}` : 'World streaming off';
  const meshes = scene.objects.filter(o => o.type === 'mesh');
  const triangles = obj?.type === 'mesh' ? Math.floor(obj.geometry.length / 9) : 0;
  const vertices = obj?.type === 'mesh' ? uniqueMeshVertexCount(obj.geometry) : 0;
  $('#selectionStatus').textContent = obj ? `${obj.name}${selectedIds.size > 1 ? ` · ${selectedIds.size} selected` : ''}` : 'Nothing selected';
  $('#meshStats').textContent = `${triangles.toLocaleString()} triangles · ${vertices.toLocaleString()} vertices · ${scene.objects.length} objects`;
  $('#statTriangles').textContent = triangles.toLocaleString(); $('#statVertices').textContent = vertices.toLocaleString();
  $('#statUV').textContent = obj?.type === 'mesh' && obj.uvs?.length === obj.geometry.length / 3 * 2 ? 'Ready' : 'Missing';
  $('#statModifiers').textContent = String(obj?.type === 'mesh' ? (obj.modifiers || []).length : 0);
  $('#modifierCountChip').textContent = String(obj?.type === 'mesh' ? (obj.modifiers || []).length : 0);
  $('#modeStatus').textContent = activeMode === 'edit' && obj?.type === 'mesh' ? `Edit Mode · ${editSelectionCount()} ${editSelectionMode}${editSelectionCount() === 1 ? '' : 's'}` : `${activeMode[0].toUpperCase()}${activeMode.slice(1)} Mode`;
  const selectedCount = $('#editSelectionCount'); if (selectedCount) selectedCount.textContent = `${editSelectionCount()} ${editSelectionMode}${editSelectionCount() === 1 ? '' : 's'} selected`;
}

function renderInspector() {
  const obj = selectedObject();
  $('#inspectorObjectTitle').textContent = obj?.name || 'No selection';
  $('#objectNameInput').value = obj?.name || '';
  $('#objectVisibleInput').checked = obj?.visible !== false;
  const isLight = obj?.type === 'light';
  $('#lightInspectorGroup').hidden = !isLight;
  $('#meshInfoGroup').hidden = isLight || !obj;
  $('#applyModifiersButton').disabled = isLight || !(obj?.modifiers?.length);
  $('#applyTransformsButton').disabled = !obj;
  $('#smoothShadingButton').disabled = isLight;
  $('#flatShadingButton').disabled = isLight;
  for (const group of $$('[data-transform-group]')) group.querySelectorAll('input').forEach(input => { const [root, component] = input.dataset.transform.split('.'); input.value = root === 'rotation' ? round(radToDeg(obj?.rotation?.[component]), 2) : round(obj?.[root]?.[component] ?? (root === 'scale' ? 1 : 0), 3); input.disabled = !obj; });
  $('#objectNameInput').disabled = !obj; $('#objectVisibleInput').disabled = !obj;
  if (obj?.type === 'mesh') {
    $('#materialColor').value = /^#[0-9a-f]{6}$/i.test(obj.color || '') ? obj.color : '#7965ff';
    const mat = obj.material || {};
    for (const [id, key] of [['materialMetallic', 'metallic'], ['materialRoughness', 'roughness'], ['materialClearcoat', 'clearcoat'], ['materialEmissive', 'emissive']]) $(`#${id}`).value = finite(mat[key], key === 'roughness' ? 0.68 : 0);
    // The ids are intentionally assigned explicitly so output labels always match the actual value.
    $('#metallicOutput').textContent = round(mat.metallic, 2).toFixed(2); $('#roughnessOutput').textContent = round(mat.roughness ?? 0.68, 2).toFixed(2); $('#clearcoatOutput').textContent = round(mat.clearcoat, 2).toFixed(2); $('#emissiveOutput').textContent = round(mat.emissive, 2).toFixed(2);
    for (const [field, label] of [['baseColorImage', 'baseMapState'], ['metallicRoughnessImage', 'mrMapState'], ['normalImage', 'normalMapState'], ['aoImage', 'aoMapState'], ['emissiveImage', 'emissiveMapState']]) $(`#${label}`).textContent = obj.material?.[field] ? 'Embedded texture attached' : 'No texture';
    $('#worldAssetRole').value = ['prop', 'landmark', 'lore-shrine', 'beacon-totem'].includes(obj.gameplayRole) ? obj.gameplayRole : 'prop';
    $('#worldAssetCollision').value = ['solid', 'platform', 'none'].includes(obj.collisionMode) ? obj.collisionMode : 'solid';
    $('#worldAssetLore').value = String(obj.loreText || '');
    if (obj.materialGraph?.preset && $('#materialGraphPreset').querySelector(`option[value="${obj.materialGraph.preset}"]`)) {
      $('#materialGraphPreset').value = obj.materialGraph.preset;
    }
    $('#materialGraphSummary').textContent = obj.materialGraph
      ? `Active Graph: ${obj.materialGraph.name || obj.materialGraph.preset} (${(obj.materialGraph.nodes || []).length} nodes)`
      : 'No procedural node graph baked yet.';
  }
  if (isLight) {
    $('#lightTypeSelect').value = obj.lightType || 'point'; $('#lightIntensity').value = finite(obj.intensity, 1); $('#lightIntensityOutput').textContent = finite(obj.intensity, 1).toFixed(1); $('#lightRange').value = finite(obj.range, 20); $('#lightRangeOutput').textContent = String(Math.round(finite(obj.range, 20))); $('#lightColor').value = /^#[0-9a-f]{6}$/i.test(obj.color || '') ? obj.color : '#ffffff';
    $('#lightDirX').value = round(obj.direction?.x, 2); $('#lightDirY').value = round(obj.direction?.y, 2); $('#lightDirZ').value = round(obj.direction?.z, 2); $('#lightCone').value = finite(obj.outerCone, 35); $('#lightConeOutput').textContent = `${Math.round(finite(obj.outerCone, 35))}°`;
  }
  for (const page of $$('[data-inspector-page]')) page.hidden = page.dataset.inspectorPage !== activeInspectorTab;
  for (const tab of $$('[data-inspector-tab]')) { const active = tab.dataset.inspectorTab === activeInspectorTab; tab.classList.toggle('active', active); tab.setAttribute('aria-pressed', String(active)); }
  renderModifierStack();
}

function renderModifierStack() {
  const obj = selectedObject();
  if (!obj || obj.type !== 'mesh') { $('#modifierList').innerHTML = '<p class="empty-note">Select a mesh to edit its modifier stack.</p>'; $('#modifierSettings').innerHTML = '<p class="empty-note">No mesh selected.</p>'; return; }
  obj.modifiers ||= [];
  $('#modifierList').innerHTML = obj.modifiers.map((m, i) => `<div class="modifier-item ${m.id === activeModifierId ? 'active' : ''}" data-modifier-id="${esc(m.id)}"><input type="checkbox" data-modifier-enabled="${esc(m.id)}" ${m.enabled ? 'checked' : ''} aria-label="Enable ${esc(m.name)}"><button class="mod-select" data-modifier-select="${esc(m.id)}">${esc(m.name)}<small>${esc(m.type)} · ${m.enabled ? 'enabled' : 'disabled'}</small></button><button data-modifier-up="${esc(m.id)}" ${i === 0 ? 'disabled' : ''} title="Move modifier up">↑</button><button data-modifier-down="${esc(m.id)}" ${i === obj.modifiers.length - 1 ? 'disabled' : ''} title="Move modifier down">↓</button></div>`).join('') || '<p class="empty-note">No modifiers yet. Add one below to keep edits non-destructive.</p>';
  const m = obj.modifiers.find(item => item.id === activeModifierId);
  if (!m) { $('#modifierSettings').innerHTML = '<p class="empty-note">Select a modifier in the stack to adjust its parameters.</p>'; return; }
  let controls = '';
  if (m.type === 'subdivision') controls = `<label class="setting-control">Subdivision Levels <select data-modifier-param="levels"><option value="1" ${m.levels === 1 ? 'selected' : ''}>1 · 4× triangles</option><option value="2" ${m.levels === 2 ? 'selected' : ''}>2 · 16× triangles</option><option value="3" ${m.levels === 3 ? 'selected' : ''}>3 · 64× triangles</option></select></label>`;
  if (m.type === 'mirror') controls = `<label class="setting-control">Mirror Axis <select data-modifier-param="axis">${['x', 'y', 'z'].map(a => `<option ${m.axis === a ? 'selected' : ''}>${a}</option>`).join('')}</select></label>`;
  if (m.type === 'array') controls = `<label class="setting-control">Copies <input data-modifier-param="count" type="range" min="2" max="12" step="1" value="${m.count}"><span>${m.count}</span></label><label class="setting-control">Offset X <input data-modifier-param="offsetX" type="number" step="0.1" value="${m.offsetX}"></label><label class="setting-control">Offset Y <input data-modifier-param="offsetY" type="number" step="0.1" value="${m.offsetY}"></label><label class="setting-control">Offset Z <input data-modifier-param="offsetZ" type="number" step="0.1" value="${m.offsetZ}"></label>`;
  if (m.type === 'solidify') controls = `<label class="setting-control">Thickness <input data-modifier-param="thickness" type="range" min="0.001" max="2" step="0.01" value="${m.thickness}"><span>${m.thickness.toFixed(2)}</span></label><label class="setting-control">Offset <input data-modifier-param="offset" type="range" min="-1" max="1" step="0.05" value="${m.offset}"><span>${m.offset.toFixed(2)}</span></label>`;
  if (m.type === 'bevel') controls = `<label class="setting-control">Bevel Width Ratio <input data-modifier-param="width" type="range" min="0.01" max="0.35" step="0.01" value="${m.width}"><span>${m.width.toFixed(2)}</span></label>`;
  if (m.type === 'smooth') controls = `<label class="setting-control">Iterations <input data-modifier-param="iterations" type="number" min="1" max="5" value="${m.iterations}"></label><label class="setting-control">Relax Factor <input data-modifier-param="factor" type="range" min="0" max="0.9" step="0.05" value="${m.factor}"><span>${m.factor.toFixed(2)}</span></label>`;
  if (m.type === 'displace') controls = `<label class="setting-control">Axis <select data-modifier-param="axis">${['x', 'y', 'z'].map(a => `<option ${m.axis === a ? 'selected' : ''}>${a}</option>`).join('')}</select></label><label class="setting-control">Amount <input data-modifier-param="amount" type="range" min="-2" max="2" step="0.02" value="${m.amount}"><span>${m.amount.toFixed(2)}</span></label><label class="setting-control">Frequency <input data-modifier-param="frequency" type="range" min="0.1" max="16" step="0.1" value="${m.frequency}"><span>${m.frequency.toFixed(1)}</span></label><label class="setting-control">Seed <input data-modifier-param="seed" type="number" value="${m.seed}"></label>`;
  if (m.type === 'simpleDeform') controls = `<label class="setting-control">Deform Mode <select data-modifier-param="deformMode"><option value="twist" ${m.deformMode === 'twist' ? 'selected' : ''}>Twist</option><option value="bend" ${m.deformMode === 'bend' ? 'selected' : ''}>Bend</option><option value="taper" ${m.deformMode === 'taper' ? 'selected' : ''}>Taper</option></select></label><label class="setting-control">Amount <input data-modifier-param="amount" type="range" min="-3" max="3" step="0.05" value="${m.amount ?? 1}"><span>${Number(m.amount ?? 1).toFixed(2)}</span></label><label class="setting-control">Axis <select data-modifier-param="axis">${['x', 'y', 'z'].map(a => `<option ${m.axis === a ? 'selected' : ''}>${a}</option>`).join('')}</select></label>`;
  if (m.type === 'decimate') controls = `<label class="setting-control">Target Ratio <input data-modifier-param="targetRatio" type="range" min="0.05" max="1" step="0.05" value="${m.targetRatio ?? 0.5}"><span>${Number(m.targetRatio ?? 0.5).toFixed(2)}</span></label>`;
  if (m.type === 'remesh') controls = `<label class="setting-control">Voxel Size <input data-modifier-param="voxelSize" type="number" min="0.01" max="2" step="0.05" value="${m.voxelSize ?? 0.25}"></label>`;
  if (m.type === 'wireframe') controls = `<label class="setting-control">Thickness <input data-modifier-param="thickness" type="range" min="0.005" max="0.2" step="0.005" value="${m.thickness ?? 0.03}"><span>${Number(m.thickness ?? 0.03).toFixed(2)}</span></label>`;
  if (m.type === 'wave') controls = `<label class="setting-control">Amplitude <input data-modifier-param="amplitude" type="range" min="0" max="1" step="0.02" value="${m.amplitude ?? 0.15}"><span>${Number(m.amplitude ?? 0.15).toFixed(2)}</span></label><label class="setting-control">Frequency <input data-modifier-param="frequency" type="range" min="0.1" max="8" step="0.1" value="${m.frequency ?? 1.5}"><span>${Number(m.frequency ?? 1.5).toFixed(1)}</span></label>`;
  if (m.type === 'optimize') controls = `<label class="setting-control">Weld / cleanup tolerance <input data-modifier-param="tolerance" type="number" min="0.000000001" max="0.01" step="0.000001" value="${m.tolerance}"></label>`;
  $('#modifierSettings').innerHTML = `${controls}<button id="removeModifierButton" class="wide-button">Remove Modifier</button>`;
}

function updateObjectGeometry(obj) {
  if (!obj || obj.type !== 'mesh') return;
  if (!Array.isArray(obj.baseGeometry) && !ArrayBuffer.isView(obj.baseGeometry)) throw new Error('Mesh base geometry is missing.');
  const evaluated = evaluateModifierStack(obj.baseGeometry, obj.modifiers || []);
  obj.geometry = Array.from(evaluated.geometry); obj.geometryRevision = (obj.geometryRevision || 0) + 1;
  if (obj.uvs && obj.uvs.length !== obj.geometry.length / 3 * 2) obj.uvs = null;
  renderStats(); renderOutliner(); renderWireframe(); renderUVPreview(); triggerRender();
}
function evaluateObject(obj, increment = true) {
  const evaluated = evaluateModifierStack(obj.baseGeometry, obj.modifiers || []);
  obj.geometry = Array.from(evaluated.geometry);
  obj.geometryRevision = increment ? (obj.geometryRevision || 0) + 1 : obj.geometryRevision || 1;
  if (obj.uvs && obj.uvs.length !== obj.geometry.length / 3 * 2) obj.uvs = null;
}
function triggerRender() { $('#modelerCanvas')?.dispatchEvent(new Event('orvexa-render-settings-change')); }
function rebuildRenderer() { cleanupRenderer?.(); cleanupRenderer = startWebGLScene($('#modelerCanvas'), scene); $('#rendererWarning').hidden = Boolean(cleanupRenderer); triggerRender(); }
function refreshScene() { renderOutliner(); renderInspector(); renderStats(); renderWireframe(); renderUVPreview(); triggerRender(); scheduleLocalSave(); }

function addPrimitive(type) {
  rememberHistory();
  const existing = scene.objects.filter(o => o.type === 'mesh').length;
  const obj = makeMesh(type, existing + 1);
  obj.position = { x: round((existing % 4) * 0.35 - 0.5, 2), y: 0, z: round(-Math.floor(existing / 4) * 0.6, 2) };
  scene.objects.splice(scene.objects.findIndex(o => o.type === 'light') < 0 ? scene.objects.length : scene.objects.findIndex(o => o.type === 'light'), 0, obj);
  activeObjectId = obj.engineId; selectedIds = new Set([obj.engineId]); activeInspectorTab = 'object'; renderAll(); scheduleLocalSave(); triggerRender(); showToast(`${obj.name} added to the scene.`, 'success');
}
function addTerrain() {
  try {
    rememberHistory(); const baseGeometry = createProceduralTerrainGeometry({ width: 8, depth: 8, segments: 38, amplitude: 1.2, seed: Math.floor(Math.random() * 100000) });
    const obj = makeMesh('terrain', scene.objects.filter(o => o.type === 'mesh').length + 1, { name: 'Procedural Terrain', baseGeometry, color: '#64856c', material: { roughness: 0.95 } }); obj.primitive = 'terrain'; obj.position.y = -0.2;
    scene.objects.splice(Math.max(0, scene.objects.findIndex(o => o.type === 'light')), 0, obj); activeObjectId = obj.engineId; selectedIds = new Set([obj.engineId]); refreshScene(); showToast('Procedural terrain generated.', 'success');
  } catch (error) { showToast(error.message, 'error'); }
}
const MAGIC_MODELS = [
  { name: 'Magic Castle', parts: [['cube', 0, 0.6, 0, 2.2], ['cylinder', -1.4, 1.1, 0, 1], ['cylinder', 1.4, 1.1, 0, 1], ['cone', -1.4, 2.6, 0, 1.2], ['cone', 1.4, 2.6, 0, 1.2]] },
  { name: 'Magic Rocket', parts: [['cylinder', 0, 1, 0, 1.4], ['cone', 0, 2.3, 0, 1], ['sphere', 0, 1.5, 0.62, 0.4], ['cube', -0.7, 0.2, 0, 0.8], ['cube', 0.7, 0.2, 0, 0.8]] },
  { name: 'Magic Robot', parts: [['cube', 0, 1.1, 0, 1.2], ['sphere', 0, 2, 0, 0.7], ['cylinder', -0.8, 1, 0, 0.8], ['cylinder', 0.8, 1, 0, 0.8], ['cylinder', 0, 2.5, 0, 0.4]] },
];
let magicModelIndex = 0;
function addMagicModel() {
  rememberHistory();
  const recipe = MAGIC_MODELS[magicModelIndex++ % MAGIC_MODELS.length];
  const base = scene.objects.filter(o => o.type === 'mesh').length;
  const added = [];
  for (const [type, x, y, z, sc] of recipe.parts) {
    const obj = makeMesh(type, base + added.length + 1);
    obj.name = `${recipe.name} · ${type} ${added.length + 1}`;
    obj.position = { x: round(x, 2), y: round(y, 2), z: round(z, 2) };
    obj.scale = { x: sc, y: sc, z: sc };
    scene.objects.splice(scene.objects.findIndex(o => o.type === 'light') < 0 ? scene.objects.length : scene.objects.findIndex(o => o.type === 'light'), 0, obj);
    added.push(obj);
  }
  activeObjectId = added[0].engineId; selectedIds = new Set(added.map(o => o.engineId));
  activeInspectorTab = 'object'; renderAll(); scheduleLocalSave(); triggerRender();
  showToast(`🪄 ${recipe.name} ban gaya — ${added.length} parts! Scale/colour badlo aur apna banao.`, 'success');
}
function addLight() {
  rememberHistory(); const obj = makeLight('point', 4); obj.name = `Point Light ${scene.objects.filter(o => o.type === 'light').length + 1}`; obj.position = { x: 2, y: 3, z: 2 }; obj.color = '#fff2cf'; obj.intensity = 1.6;
  scene.objects.push(obj); activeObjectId = obj.engineId; selectedIds = new Set([obj.engineId]); refreshScene(); showToast('Point light added.', 'success');
}
function duplicateSelected() {
  const obj = selectedObject(); if (!obj) return;
  rememberHistory(); const copy = obj.type === 'light' ? structuredCloneSafe(obj) : { ...serializeObject(obj), baseGeometry: [...obj.baseGeometry], modifiers: obj.modifiers.map((m, i) => ({ ...m, id: uid('modifier') })), uvs: obj.uvs ? [...obj.uvs] : null };
  copy.engineId = uid(obj.type === 'light' ? 'light' : 'mesh'); copy.name = `${obj.name} Copy`; copy.position = { ...obj.position, x: finite(obj.position.x) + 0.7, y: finite(obj.position.y) + 0.25, z: finite(obj.position.z) + 0.45 };
  if (copy.type !== 'light') { copy.baseGeometry = [...obj.baseGeometry]; copy.geometry = [...obj.geometry]; evaluateObject(copy); }
  const index = scene.objects.indexOf(obj); scene.objects.splice(index + 1, 0, copy); activeObjectId = copy.engineId; selectedIds = new Set([copy.engineId]); refreshScene(); showToast(`${copy.name} duplicated.`);
}
function deleteSelected() {
  const ids = new Set(selectedIds); if (!ids.size) return;
  const removable = scene.objects.filter(obj => ids.has(obj.engineId) && (obj.type !== 'light' || scene.objects.filter(x => x.type === 'light').length > 1));
  if (!removable.length) { showToast('Keep at least one scene light.', 'warning'); return; }
  rememberHistory(); const removed = new Set(removable.map(o => o.engineId)); scene.objects = scene.objects.filter(o => !removed.has(o.engineId));
  activeObjectId = scene.objects.find(o => o.type !== 'light')?.engineId || scene.objects[0]?.engineId || null; selectedIds = new Set(activeObjectId ? [activeObjectId] : []); refreshScene(); showToast(`${removable.length} object${removable.length === 1 ? '' : 's'} deleted.`);
}
function joinSelected() {
  const items = getSelectedObjects();
  if (items.length < 2) { showToast('Shift-click at least two meshes in the Outliner first.', 'warning'); return; }
  try {
    rememberHistory(); const joined = joinTriangleMeshes(items, { maxFloats: MAX_GEOMETRY_FLOATS });
    const obj = makeMesh('mesh', 1, { name: `Joined Mesh (${items.length})`, baseGeometry: joined.geometry, color: items[0].color, material: { ...items[0].material } });
    const ids = new Set(items.map(o => o.engineId)); const firstIndex = Math.min(...scene.objects.map((o, i) => ids.has(o.engineId) ? i : Infinity));
    scene.objects = scene.objects.filter(o => !ids.has(o.engineId)); scene.objects.splice(Math.min(firstIndex, scene.objects.length), 0, obj); activeObjectId = obj.engineId; selectedIds = new Set([obj.engineId]); refreshScene(); showToast(`Joined ${joined.objectCount} meshes · ${joined.triangleCount.toLocaleString()} triangles.`, 'success');
  } catch (error) { showToast(error.message, 'error'); }
}
function applyTransforms() {
  const obj = selectedObject(); if (!obj) return;
  if (obj.type === 'light') { showToast('Light transforms remain editable; bake mesh transforms only for geometry objects.', 'info'); return; }
  try { rememberHistory(); evaluateObject(obj); obj.baseGeometry = Array.from(bakeTriangleMeshTransform(obj.geometry, obj)); obj.modifiers = []; obj.position = { x: 0, y: 0, z: 0 }; obj.rotation = { x: 0, y: 0, z: 0 }; obj.scale = { x: 1, y: 1, z: 1 }; obj.size = 1; obj.uvs = null; evaluateObject(obj); refreshScene(); showToast('Transform and modifier results baked into the mesh.'); }
  catch (error) { showToast(error.message, 'error'); }
}
function applyModifiers() {
  const obj = selectedObject(); if (!obj || obj.type !== 'mesh') return;
  try { rememberHistory(); obj.baseGeometry = Array.from(obj.geometry); obj.modifiers = []; obj.uvs = null; evaluateObject(obj); activeModifierId = null; refreshScene(); showToast('Modifier stack applied to the base mesh.', 'success'); }
  catch (error) { showToast(error.message, 'error'); }
}
function applyMeshOperation(type) {
  const obj = selectedObject(); if (!obj || obj.type !== 'mesh') { showToast('Select a mesh object first.', 'warning'); return; }
  try {
    rememberHistory(); evaluateObject(obj);
    let result = Array.from(obj.geometry);
    if (type === 'subdivide') result = subdivideTriangleMesh(result, MAX_GEOMETRY_FLOATS);
    else if (type === 'mirror') result = mirrorTriangleMesh(result, 'x').concat(Array.from(result));
    else if (type === 'smooth') result = smoothTriangleMesh(result, { iterations: 2, factor: 0.28 });
    else if (type === 'cleanup') result = optimizeTriangleMesh(result, { tolerance: 0.00001 }).geometry;
    else if (type === 'uv') { obj.uvs = generatePlanarUVs(obj.geometry); validateUVs(obj.uvs, obj.geometry.length / 3); obj.uvRevision = (obj.uvRevision || 0) + 1; refreshScene(); showToast('Quick box-projected UV layout generated.', 'success'); return; }
    if (result.length > MAX_GEOMETRY_FLOATS) throw new Error('Operation exceeds the safe editable-mesh budget. Reduce mesh detail first.');
    obj.baseGeometry = Array.from(result); obj.modifiers = []; obj.uvs = null; evaluateObject(obj); refreshScene(); showToast(`${type[0].toUpperCase()}${type.slice(1)} operation applied.`, 'success');
  } catch (error) { showToast(error.message, 'error'); }
}

function addModifier(type) {
  const obj = selectedObject(); if (!obj || obj.type !== 'mesh') { showToast('Select a mesh before adding modifiers.', 'warning'); return; }
  rememberHistory(); const modifier = normalizeModifier({ type, id: uid('modifier'), enabled: true }, obj.modifiers.length + 1); obj.modifiers.push(modifier); activeModifierId = modifier.id;
  try { updateObjectGeometry(obj); renderInspector(); scheduleLocalSave(); showToast(`${modifier.name} added to the non-destructive stack.`); }
  catch (error) { obj.modifiers.pop(); activeModifierId = null; renderInspector(); showToast(error.message, 'error'); }
}
function updateModifier(id, patch) {
  const obj = selectedObject(); const item = obj?.modifiers?.find(m => m.id === id); if (!item) return;
  const before = { ...item };
  Object.assign(item, patch); const normalized = normalizeModifier(item, obj.modifiers.indexOf(item) + 1); Object.assign(item, normalized);
  try { updateObjectGeometry(obj); scheduleLocalSave(); }
  catch (error) { Object.assign(item, before); try { updateObjectGeometry(obj); } catch { /* Keep previous evaluated geometry if recovery itself fails. */ } showToast(error.message, 'error'); renderInspector(); }
}
function removeModifier(id = activeModifierId) {
  const obj = selectedObject(); if (!obj?.modifiers) return;
  const index = obj.modifiers.findIndex(m => m.id === id); if (index < 0) return;
  rememberHistory(); obj.modifiers.splice(index, 1); activeModifierId = obj.modifiers[Math.max(0, index - 1)]?.id || null; updateObjectGeometry(obj); renderInspector(); scheduleLocalSave();
}
function setModifierEnabled(id, enabled) { updateModifier(id, { enabled }); renderInspector(); }
function moveModifier(id, offset) {
  const obj = selectedObject(); if (!obj?.modifiers) return; const from = obj.modifiers.findIndex(m => m.id === id), to = from + offset; if (from < 0 || to < 0 || to >= obj.modifiers.length) return;
  rememberHistory(); const [item] = obj.modifiers.splice(from, 1); obj.modifiers.splice(to, 0, item); activeModifierId = item.id; updateObjectGeometry(obj); renderInspector(); scheduleLocalSave();
}

function toWorld(local, obj) {
  const scale = obj.scale || { x: 1, y: 1, z: 1 }, size = finite(obj.size, 1), rotation = obj.rotation || {};
  let [x, y, z] = [local[0] * size * finite(scale.x, 1), local[1] * size * finite(scale.y, 1), local[2] * size * finite(scale.z, 1)];
  const cx = Math.cos(finite(rotation.x)), sx = Math.sin(finite(rotation.x)), cy = Math.cos(finite(rotation.y)), sy = Math.sin(finite(rotation.y)), cz = Math.cos(finite(rotation.z)), sz = Math.sin(finite(rotation.z));
  [y, z] = [y * cx - z * sx, y * sx + z * cx]; [x, z] = [x * cy + z * sy, -x * sy + z * cy]; [x, y] = [x * cz - y * sz, x * sz + y * cz];
  return [x + finite(obj.position?.x), y + finite(obj.position?.y), z + finite(obj.position?.z)];
}
function toLocal(world, obj, direction = false) {
  const rotation = obj.rotation || {}; let [x, y, z] = direction ? world : [world[0] - finite(obj.position?.x), world[1] - finite(obj.position?.y), world[2] - finite(obj.position?.z)];
  const cx = Math.cos(finite(rotation.x)), sx = Math.sin(finite(rotation.x)), cy = Math.cos(finite(rotation.y)), sy = Math.sin(finite(rotation.y)), cz = Math.cos(finite(rotation.z)), sz = Math.sin(finite(rotation.z));
  [x, y] = [x * cz + y * sz, -x * sz + y * cz]; [x, z] = [x * cy - z * sy, x * sy + z * cy]; [y, z] = [y * cx + z * sx, -y * sx + z * cx];
  const size = finite(obj.size, 1) || 1, scale = obj.scale || { x: 1, y: 1, z: 1 };
  return [x / (size * (finite(scale.x, 1) || 1)), y / (size * (finite(scale.y, 1) || 1)), z / (size * (finite(scale.z, 1) || 1))];
}
function normalize3(v) { const d = Math.hypot(...v) || 1; return v.map(n => n / d); }
function cross(a, b) { return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }
function subtract(a, b) { return a.map((v, i) => v - b[i]); }
function dot(a, b) { return a.reduce((sum, v, i) => sum + v * b[i], 0); }
function rayFromScreen(clientX, clientY) {
  const canvas = $('#modelerCanvas'), rect = canvas.getBoundingClientRect(); if (!rect.width || !rect.height) return null;
  const cam = scene.editorCamera || {}, target = cam.target || { x: 0, y: 0, z: 0 }, angle = finite(cam.angle), pitch = finite(cam.pitch, 0.25), zoom = clamp(finite(cam.zoom, 7), 2.5, 80);
  const horizontal = Math.cos(pitch) * zoom, eye = [finite(target.x) + Math.sin(angle) * horizontal, finite(target.y) + Math.sin(pitch) * zoom, finite(target.z) + Math.cos(angle) * horizontal];
  const forward = normalize3(subtract([finite(target.x), finite(target.y), finite(target.z)], eye)), right = normalize3(cross(forward, [0, 1, 0])), up = normalize3(cross(right, forward));
  const nx = ((clientX - rect.left) / rect.width) * 2 - 1, ny = 1 - ((clientY - rect.top) / rect.height) * 2, tangent = Math.tan(Math.PI / 8), aspect = rect.width / rect.height;
  const ray = normalize3([forward[0] + right[0] * nx * tangent * aspect + up[0] * ny * tangent, forward[1] + right[1] * nx * tangent * aspect + up[1] * ny * tangent, forward[2] + right[2] * nx * tangent * aspect + up[2] * ny * tangent]);
  return { origin: eye, direction: ray };
}
function intersectTriangle(origin, direction, a, b, c) {
  const edge1 = subtract(b, a), edge2 = subtract(c, a), p = cross(direction, edge2), determinant = dot(edge1, p);
  if (Math.abs(determinant) < 1e-8) return null;
  const inverse = 1 / determinant, tvec = subtract(origin, a), u = dot(tvec, p) * inverse;
  if (u < 0 || u > 1) return null;
  const q = cross(tvec, edge1), v = dot(direction, q) * inverse;
  if (v < 0 || u + v > 1) return null;
  const t = dot(edge2, q) * inverse; return t > 1e-4 ? t : null;
}
function rayHitObject(ray, obj) {
  if (obj.type !== 'mesh' || obj.visible === false) return null;
  const localOrigin = toLocal(ray.origin, obj), localDirection = toLocal(ray.direction, { ...obj, position: { x: 0, y: 0, z: 0 } }, true), g = obj.geometry;
  let best = Infinity, hit = null, faceIndex = -1;
  const ox = localOrigin[0], oy = localOrigin[1], oz = localOrigin[2], dx = localDirection[0], dy = localDirection[1], dz = localDirection[2];
  for (let i = 0; i < g.length; i += 9) {
    const a = [g[i], g[i+1], g[i+2]], b = [g[i+3], g[i+4], g[i+5]], c = [g[i+6], g[i+7], g[i+8]];
    const t = intersectTriangle([ox,oy,oz],[dx,dy,dz],a,b,c);
    if (t !== null && t < best) { best = t; hit = [ox+dx*t, oy+dy*t, oz+dz*t]; faceIndex = Math.floor(i / 9); }
  }
  return hit ? { distance: best, local: hit, faceIndex } : null;
}
function raycastScene(clientX, clientY, { includeAll = false } = {}) {
  const ray = rayFromScreen(clientX, clientY); if (!ray) return null;
  let nearest = null, best = Infinity;
  const objects = includeAll ? scene.objects.filter(o => o.type === 'mesh') : [selectedObject()].filter(Boolean);
  for (const obj of objects) {
    const hit = rayHitObject(ray, obj); if (hit && hit.distance < best) { best = hit.distance; nearest = { object: obj, ...hit }; }
  }
  return nearest;
}

function selectMeshElement(hit, clientX, clientY, shift = false) {
  const obj = hit?.object;
  if (!obj || obj.type !== 'mesh' || !Number.isInteger(hit.faceIndex)) return;
  const offset = hit.faceIndex * 9, g = obj.geometry;
  if (offset < 0 || offset + 8 >= g.length) return;
  const points = [[g[offset],g[offset+1],g[offset+2]],[g[offset+3],g[offset+4],g[offset+5]],[g[offset+6],g[offset+7],g[offset+8]]];
  let key = null;
  if (editSelectionMode === 'face') {
    const region = coplanarTriangleRegion(g, hit.faceIndex);
    const allSelected = region.every(index => selectedEditFaces.has(index));
    if (!shift) clearEditSelection();
    if (shift && allSelected) for (const index of region) selectedEditFaces.delete(index);
    else for (const index of region) selectedEditFaces.add(index);
  } else {
    const rect = $('#modelerCanvas').getBoundingClientRect();
    const projected = points.map(p => projectScenePoint(toWorld(p,obj), scene.editorCamera, rect.width, rect.height));
    if (projected.some(p => !p)) return;
    const click = [clientX - rect.left, clientY - rect.top];
    if (editSelectionMode === 'vertex') {
      let nearest = 0, distance = Infinity;
      for (let i=0;i<3;i++) { const d=Math.hypot(projected[i].x-click[0],projected[i].y-click[1]); if(d<distance){distance=d;nearest=i;} }
      if (distance > 14) return; // Avoid selecting a vertex when the click is nowhere near its screen-space handle.
      key = meshVertexKey(points[nearest]);
      if (!shift) clearEditSelection();
      if (shift && selectedEditVertices.has(key)) selectedEditVertices.delete(key); else selectedEditVertices.add(key);
    } else {
      let nearest = null, distance = Infinity;
      for (let i=0;i<3;i++) {
        const j=(i+1)%3, a=projected[i], b=projected[j], dx=b.x-a.x, dy=b.y-a.y, den=dx*dx+dy*dy || 1;
        const t=Math.max(0,Math.min(1,((click[0]-a.x)*dx+(click[1]-a.y)*dy)/den));
        const d=Math.hypot(click[0]-(a.x+t*dx),click[1]-(a.y+t*dy));
        if(d<distance){distance=d;nearest=i;}
      }
      if (distance > 10) return; // Edge selection requires a nearby click rather than any click in the face.
      key = meshEdgeKey(points[nearest],points[(nearest+1)%3]);
      if (!shift) clearEditSelection();
      if (shift && selectedEditEdges.has(key)) selectedEditEdges.delete(key); else selectedEditEdges.add(key);
    }
  }
  renderWireframe(); renderStats();
}

function moveSelectedMeshElements() {
  const obj = selectedObject(); if (!obj || obj.type !== 'mesh') return;
  const selection = editSelectionMode === 'vertex'
    ? { mode: 'vertex', vertices: [...selectedEditVertices] }
    : editSelectionMode === 'edge' ? { mode: 'edge', edges: [...selectedEditEdges] }
      : { mode: 'face', faces: [...selectedEditFaces] };
  try {
    rememberHistory();
    const result = translateMeshElements(obj.geometry, selection, { x: Number($('#editMoveX').value), y: Number($('#editMoveY').value), z: Number($('#editMoveZ').value) });
    obj.baseGeometry = Array.from(result.geometry); obj.modifiers = []; evaluateObject(obj); clearEditSelection(); refreshScene();
    showToast(`Moved selected components · ${result.movedVertices} welded vertices affected.`, 'success');
  } catch (error) { showToast(error.message, 'error'); }
}

function extrudeSelectedFaces() {
  const obj = selectedObject(); if (!obj || obj.type !== 'mesh') return;
  if (editSelectionMode !== 'face' || selectedEditFaces.size === 0) { showToast('Switch to Face selection and click one or more triangles first.', 'warning'); return; }
  try {
    rememberHistory();
    const result = extrudeTriangleFaces(obj.geometry, [...selectedEditFaces], Number($('#extrudeDistance').value));
    obj.baseGeometry = Array.from(result.geometry); obj.modifiers = []; obj.uvs = null; evaluateObject(obj); clearEditSelection(); refreshScene();
    showToast(`Extruded ${result.extrudedFaces} face${result.extrudedFaces === 1 ? '' : 's'} · generated ${result.sideTriangles} side triangles.`, 'success');
  } catch (error) { showToast(error.message, 'error'); }
}

function insetSelectedFaces() {
  const obj = selectedObject(); if (!obj || obj.type !== 'mesh') return;
  if (editSelectionMode !== 'face' || selectedEditFaces.size === 0) { showToast('Switch to Face selection and click one or more triangles first.', 'warning'); return; }
  try {
    rememberHistory();
    const result = insetTriangleFaces(obj.geometry, [...selectedEditFaces], Number($('#insetFactor').value));
    obj.baseGeometry = Array.from(result.geometry); obj.modifiers = []; obj.uvs = null; evaluateObject(obj); clearEditSelection(); refreshScene();
    showToast(`Inset ${result.insetFaces} face${result.insetFaces === 1 ? '' : 's'} into inner faces and border triangles.`, 'success');
  } catch (error) { showToast(error.message, 'error'); }
}

function splitSelectedMeshEdges() {
  const obj = selectedObject(); if (!obj || obj.type !== 'mesh') return;
  if (editSelectionMode !== 'edge' || selectedEditEdges.size === 0) { showToast('Switch to Edge selection and click one or more edges first.', 'warning'); return; }
  try {
    rememberHistory();
    const result = splitSelectedEdges(obj.geometry, [...selectedEditEdges]);
    obj.baseGeometry = Array.from(result.geometry); obj.modifiers = []; obj.uvs = null; evaluateObject(obj); clearEditSelection(); refreshScene();
    showToast(`Split ${result.splitFaces} triangle${result.splitFaces === 1 ? '' : 's'} along selected edges.`, 'success');
  } catch (error) { showToast(error.message, 'error'); }
}

function deleteSelectedMeshFaces() {
  const obj = selectedObject(); if (!obj || obj.type !== 'mesh') return;
  if (editSelectionMode !== 'face' || selectedEditFaces.size === 0) { showToast('Switch to Face selection and click one or more triangles first.', 'warning'); return; }
  try {
    rememberHistory();
    const result = deleteSelectedFaces(obj.geometry, [...selectedEditFaces]);
    obj.baseGeometry = Array.from(result.geometry); obj.modifiers = []; obj.uvs = null; evaluateObject(obj); clearEditSelection(); refreshScene();
    showToast(`Deleted ${result.deletedFaces} face${result.deletedFaces === 1 ? '' : 's'}.`, 'success');
  } catch (error) { showToast(error.message, 'error'); }
}

function applyMaterialGraphToSelected() {
  const obj = selectedObject(); if (!obj || obj.type !== 'mesh') { showToast('Select a mesh before baking a Material Lab graph.', 'warning'); return; }
  try {
    rememberHistory();
    const presetKey = $('#materialGraphPreset').value || 'arcane-crystal';
    const scale = clamp(finite($('#materialGraphScale').value, 6), 0.5, 32);
    const graph = buildPresetMaterialGraph(presetKey);
    for (const node of graph.nodes) {
      if (node.type === 'noise' || node.type === 'checker') node.params.scale = scale;
    }
    const compiled = compileMaterialGraphToPBR(graph, { resolution: 32 });
    if (!obj.uvs || obj.uvs.length !== (obj.geometry.length / 3) * 2) {
      obj.uvs = unwrapMeshUVIslands(obj.geometry).uvs;
      obj.uvRevision = (obj.uvRevision || 0) + 1;
    }
    obj.color = compiled.color;
    obj.material = { ...obj.material, ...compiled.material };
    obj.materialGraph = { ...graph, preset: presetKey };
    renderInspector(); renderUVPreview(); triggerRender(); scheduleLocalSave();
    showToast(`Baked Material Lab graph "${graph.name}" (${graph.nodes.length} nodes) onto ${obj.name}.`, 'success');
  } catch (error) { showToast(error.message, 'error'); }
}

function spawnProceduralGeoNodeMesh() {
  try {
    rememberHistory();
    const presetKey = $('#geoNodePreset').value || 'crystal-cluster';
    const count = clamp(Math.round(finite($('#geoNodeCount').value, 10)), 1, 64);
    const seed = Math.round(finite($('#geoNodeSeed').value, 77));
    const graph = buildPresetGeometryNodeGraph(presetKey);
    for (const node of graph.nodes) {
      if (node.type === 'scatterPoints') { node.params.count = count; node.params.seed = seed; }
      if (node.type === 'instanceOnPoints' || node.type === 'noiseDisplace' || node.type === 'primitiveMesh') node.params.seed = seed + 11;
    }
    const evaluated = evaluateGeometryNodeGraph(graph);
    const index = scene.objects.filter(o => o.type === 'mesh').length + 1;
    const meshObj = makeMesh('mesh', index, {
      name: `${graph.name} ${index}`,
      primitive: 'mesh',
      baseGeometry: evaluated.geometry,
      color: graph.color || '#56e0e0',
      material: { metallic: 0.15, roughness: 0.35, clearcoat: 0.4, emissive: 0.2, ...(graph.material || {}) },
    });
    meshObj.uvs = unwrapMeshUVIslands(meshObj.geometry).uvs;
    const lightAt = scene.objects.findIndex(o => o.type === 'light');
    scene.objects.splice(lightAt < 0 ? scene.objects.length : lightAt, 0, meshObj);
    activeObjectId = meshObj.engineId; selectedIds = new Set([activeObjectId]);
    $('#geoNodeSummary').textContent = `Spawned ${evaluated.triangleCount.toLocaleString()} tris · ${evaluated.vertexCount.toLocaleString()} verts (${evaluated.nodeCount} DAG nodes).`;
    refreshScene(); focusSelected();
    showToast(`Evaluated Geometry Nodes DAG: ${meshObj.name} (${evaluated.triangleCount} triangles).`, 'success');
  } catch (error) { showToast(error.message, 'error'); }
}

function unwrapSelectedUVIslands() {
  const obj = selectedObject(); if (!obj || obj.type !== 'mesh') return;
  try {
    rememberHistory();
    const res = unwrapMeshUVIslands(obj.geometry, { angleThresholdCos: 0.55, margin: 0.03 });
    obj.uvs = res.uvs; obj.uvRevision = (obj.uvRevision || 0) + 1;
    refreshScene();
    $('#uvSummary').textContent = `Unwrapped ${res.islandCount} UV island${res.islandCount === 1 ? '' : 's'} across ${(obj.geometry.length / 9).toLocaleString()} triangles.`;
    showToast(`Unwrapped ${res.islandCount} UV islands with seam/normal clustering.`, 'success');
  } catch (error) { showToast(error.message, 'error'); }
}

function inspectSelectedUVs() {
  const obj = selectedObject(); if (!obj || obj.type !== 'mesh') return;
  if (!Array.isArray(obj.uvs) || obj.uvs.length !== (obj.geometry.length / 3) * 2) {
    showToast('Generate Quick UVs or Unwrap UV Islands before inspecting UV layout.', 'warning'); return;
  }
  try {
    const info = inspectUVLayout(obj.uvs, obj.geometry);
    $('#uvSummary').textContent = `Coverage ${(info.coverage * 100).toFixed(1)}% · ${info.outOfBoundsCount} out-of-bounds · ${info.degenerateUVTriangles} zero-area UV tris.`;
    showToast(`UV Layout: ${(info.coverage * 100).toFixed(1)}% coverage, ${info.outOfBoundsCount} out-of-bounds.`, 'info');
  } catch (error) { showToast(error.message, 'error'); }
}

function weldSelectedMeshVertices() {
  const obj = selectedObject(); if (!obj || obj.type !== 'mesh') return;
  try {
    rememberHistory();
    const res = weldMeshVertices(obj.geometry, 0.015);
    obj.baseGeometry = Array.from(res.geometry); obj.modifiers = []; obj.uvs = null; evaluateObject(obj); refreshScene();
    $('#topologySummary').textContent = `Welded ${res.weldedCount} vertices (${res.beforeVertices} → ${res.afterVertices}) · ${res.triangleCount} triangles.`;
    showToast(`Welded ${res.weldedCount} close vertices.`, 'success');
  } catch (error) { showToast(error.message, 'error'); }
}

function flipSelectedMeshNormals() {
  const obj = selectedObject(); if (!obj || obj.type !== 'mesh') return;
  try {
    rememberHistory();
    const subset = activeMode === 'edit' && editSelectionMode === 'face' && selectedEditFaces.size ? [...selectedEditFaces] : null;
    const res = flipMeshNormals(obj.geometry, subset);
    obj.baseGeometry = Array.from(res.geometry); obj.modifiers = []; evaluateObject(obj); refreshScene();
    showToast(`Flipped normals on ${res.flippedFaces} face${res.flippedFaces === 1 ? '' : 's'}.`, 'success');
  } catch (error) { showToast(error.message, 'error'); }
}

function recalcSelectedMeshNormals() {
  const obj = selectedObject(); if (!obj || obj.type !== 'mesh') return;
  try {
    rememberHistory();
    const res = recalculateMeshNormals(obj.geometry);
    obj.baseGeometry = Array.from(res.geometry); obj.modifiers = []; evaluateObject(obj); refreshScene();
    showToast(`Recalculated outward normals (${res.correctedFaces} inverted face${res.correctedFaces === 1 ? '' : 's'} fixed).`, 'success');
  } catch (error) { showToast(error.message, 'error'); }
}

function inspectSelectedMeshTopology() {
  const obj = selectedObject(); if (!obj || obj.type !== 'mesh') return;
  try {
    const info = inspectMeshTopology(obj.geometry);
    const status = info.isWatertight ? 'Watertight Manifold' : info.isManifold ? `Manifold (${info.boundaryEdges} open boundary edges)` : `Non-manifold (${info.nonManifoldEdges} shared >2x, ${info.degenerateTriangles} degenerate)`;
    $('#topologySummary').textContent = `${status} · ${info.weldedVertexCount} welded verts · ${info.edgeCount} edges · ${info.triangleCount} tris.`;
    showToast(`Topology: ${status}`, info.isManifold ? 'success' : 'warning');
  } catch (error) { showToast(error.message, 'error'); }
}


function setBakedGeometry(obj, geometry, message) {
  if (!geometry || geometry.length > MAX_GEOMETRY_FLOATS) throw new Error('Result exceeds the safe editable-mesh budget.');
  obj.baseGeometry = Array.from(geometry); obj.modifiers = []; obj.uvs = null; evaluateObject(obj); refreshScene(); showToast(message, 'success');
}
function loopCutSelected() {
  const obj = selectedObject(); if (!obj || obj.type !== 'mesh') { showToast('Select a mesh first.', 'warning'); return; }
  try { rememberHistory(); evaluateObject(obj); const res = loopCutTriangleMesh(obj.geometry, { axis: 'y', position: 0, cuts: 1 }); setBakedGeometry(obj, res.geometry, `Loop Cut inserted at mid-height (${res.triangleCount} triangles).`); } catch (e) { showToast(e.message, 'error'); }
}
function pokeSelected() {
  const obj = selectedObject(); if (!obj || obj.type !== 'mesh') { showToast('Select a mesh first.', 'warning'); return; }
  try { rememberHistory(); evaluateObject(obj); const faces = selectedEditFaces.size ? [...selectedEditFaces] : obj.geometry.length / 9; const res = pokeSelectedFaces(obj.geometry, faces); setBakedGeometry(obj, res.geometry, `Poked faces into ${res.triangleCount} fan triangles.`); } catch (e) { showToast(e.message, 'error'); }
}
function fillHolesSelected() {
  const obj = selectedObject(); if (!obj || obj.type !== 'mesh') { showToast('Select a mesh first.', 'warning'); return; }
  try { rememberHistory(); evaluateObject(obj); const res = fillMeshHoles(obj.geometry); setBakedGeometry(obj, res.geometry, res.filledLoops ? `Filled ${res.filledLoops} hole loop(s) with ${res.addedTriangles} triangles.` : 'No open boundary holes found.'); const el = $('#apexSummary'); if (el) el.textContent = `Fill Holes: ${res.filledLoops} loops · ${res.triangleCount} triangles.`; } catch (e) { showToast(e.message, 'error'); }
}
function updateMaterialGraphSvgPreview() {
  const el = $('#materialGraphSvgPreview'); if (!el) return;
  try { el.innerHTML = renderMaterialGraphSvg(buildPresetMaterialGraph($('#materialGraphPreset')?.value || 'arcane-crystal')); } catch (e) { el.textContent = e.message; }
}
function updateGeoNodeSvgPreview() {
  const el = $('#geoNodeSvgPreview'); if (!el) return;
  try { el.innerHTML = renderGeometryNodeGraphSvg(buildPresetGeometryNodeGraph($('#geoNodePreset')?.value || 'crystal-cluster')); } catch (e) { el.textContent = e.message; }
}
function catmullClarkSelected() {
  const obj = selectedObject(); if (!obj || obj.type !== 'mesh') { showToast('Select a mesh first.', 'warning'); return; }
  try { rememberHistory(); evaluateObject(obj); const before = obj.geometry.length / 9; const out = subdivideCatmullClark(obj.geometry, { iterations: 1 }); setBakedGeometry(obj, out, `Catmull-Clark: ${before} → ${out.length / 9} triangles (quad-aware).`); const el = $('#omegaMeshSummary'); if (el) el.textContent = `Catmull-Clark subdivision applied to "${obj.name}": ${before} → ${out.length / 9} triangles.`; } catch (e) { showToast(e.message, 'error'); }
}
function addGeodesicSphere() {
  try { rememberHistory(); const g = geodesicSphereDetailed({ radius: 0.85, subdivisions: 2 }); const obj = makeMesh('sphere', scene.objects.filter(o => o.type === 'mesh').length + 1, { name: 'Geodesic Sphere', baseGeometry: g.geometry, uvs: Array.from(g.uvs), color: '#8fd8ff', material: { metallic: 0.35, roughness: 0.25 } }); scene.objects.push(obj); activeObjectId = obj.engineId; selectedIds = new Set([obj.engineId]); refreshScene(); showToast(`Geodesic sphere added (${g.triangleCount} triangles, spherical UVs).`, 'success'); } catch (e) { showToast(e.message, 'error'); }
}
function addLatheVase() {
  try { rememberHistory(); const l = latheProfileDetailed([[0, -0.7], [0.42, -0.68], [0.55, -0.3], [0.34, 0.25], [0.22, 0.62], [0.3, 0.78], [0.16, 0.86]], { segments: 28 }); const obj = makeMesh('cylinder', scene.objects.filter(o => o.type === 'mesh').length + 1, { name: 'Lathe Vase', baseGeometry: l.geometry, uvs: Array.from(l.uvs), color: '#c88a5c', material: { metallic: 0.15, roughness: 0.4, clearcoat: 0.4 } }); scene.objects.push(obj); activeObjectId = obj.engineId; selectedIds = new Set([obj.engineId]); refreshScene(); showToast(`Lathe vase revolved (${l.triangleCount} triangles, profile UVs).`, 'success'); } catch (e) { showToast(e.message, 'error'); }
}
function bridgeDemoLoops() {
  try { rememberHistory(); const loopA = [], loopB = []; for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; loopA.push([Math.cos(a) * 0.6, -0.5, Math.sin(a) * 0.6]); loopB.push([Math.cos(a) * 0.42, 0.55, Math.sin(a) * 0.42]); } const geometry = bridgeVertexLoops(loopA, loopB); const obj = makeMesh('cylinder', scene.objects.filter(o => o.type === 'mesh').length + 1, { name: 'Bridged Loops', baseGeometry: geometry, color: '#7ce8a8' }); scene.objects.push(obj); activeObjectId = obj.engineId; selectedIds = new Set([obj.engineId]); refreshScene(); showToast(`Bridged two edge loops into ${geometry.length / 9} triangles.`, 'success'); } catch (e) { showToast(e.message, 'error'); }
}
function fracture3dSelected() {
  const obj = selectedObject(); if (!obj || obj.type !== 'mesh') { showToast('Select a mesh first.', 'warning'); return; }
  try { rememberHistory(); evaluateObject(obj); const res = fractureMeshVoronoi3D(obj.geometry, { cells: 8, seed: 42, explode: 0.1 }); setBakedGeometry(obj, res.geometry, `3D Voronoi fracture: ${res.shardCount} shards with interior UVs.`); obj.uvs = Array.from(res.uvs); const el = $('#omegaMeshSummary'); if (el) el.textContent = `Fracture: ${res.shardCount} shards · ${res.triangleCount} tris · interior UV mode ${res.shards[0]?.interiorUvMode || 'box-planar'}.`; renderUVPreview(); } catch (e) { showToast(e.message, 'error'); }
}
function naniteDagStats() {
  const obj = selectedObject(); if (!obj || obj.type !== 'mesh') { showToast('Select a mesh first.', 'warning'); return; }
  try { evaluateObject(obj); const dag = buildNaniteClusterDAG(obj.geometry, { clusterSize: 64 }); const el = $('#omegaMeshSummary'); const text = `Nanite DAG for "${obj.name}": ${dag.levels.length} LOD levels · ratios ${dag.ratios.join(', ')} · clusters ${dag.clusters?.length ?? dag.totalTriangles ?? '—'}.`; if (el) el.textContent = text; showToast(text, 'success'); } catch (e) { showToast(e.message, 'error'); }
}
function topologyDoctor() {
  const obj = selectedObject(); if (!obj || obj.type !== 'mesh') { showToast('Select a mesh first.', 'warning'); return; }
  try { evaluateObject(obj); const topo = inspectMeshTopology(obj.geometry); const el = $('#omegaMeshSummary'); const verdict = topo.isManifold || topo.manifold ? 'Manifold ✓' : 'Non-manifold / open edges found'; const text = `🩺 Topology Doctor "${obj.name}": ${topo.triangleCount ?? obj.geometry.length / 9} tris · ${topo.vertexCount ?? '—'} verts · boundary edges ${topo.boundaryEdges ?? topo.openEdges ?? '—'} · degenerate ${topo.degenerateTriangles ?? topo.degenerate ?? 0} · ${verdict}.`; if (el) el.textContent = text; const ts = $('#topologySummary'); if (ts) ts.textContent = text; showToast(verdict, topo.isManifold || topo.manifold ? 'success' : 'warning'); } catch (e) { showToast(e.message, 'error'); }
}
function spawnModelerPrefab(prefabId) {
  try { rememberHistory(); const prefab = getPrefabKitbash(prefabId); const offset = scene.objects.filter(o => o.type === 'mesh').length * 0.15; let last = null;
    for (const part of prefab.parts) { const obj = makeMesh(part.primitive || part.type || 'cube', 0, { name: `${prefab.name} · ${part.name || 'Part'}`, color: part.color || '#7c5cff', material: part.material || {}, position: { x: (part.position?.x || 0) + offset, y: part.position?.y || 0, z: part.position?.z || 0 }, scale: part.scale || { x: 1, y: 1, z: 1 } }); scene.objects.push(obj); last = obj; }
    if (last) { activeObjectId = last.engineId; selectedIds = new Set([last.engineId]); } refreshScene(); showToast(`Prefab spawned: ${prefab.name} (${prefab.parts.length} parts).`, 'success'); } catch (e) { showToast(e.message, 'error'); }
}
function applyModelerMood(moodId) {
  const mood = ATMOSPHERE_MOODS.find(m => m.id === moodId); if (!mood) return;
  scene.environment = { ...(scene.environment || {}), preset: mood.environmentPreset, sky: mood.sky };
  triggerRender(); showToast(`Mood applied: ${mood.name} (${mood.toneMapping.toUpperCase()} · Lumen GI ${mood.lumenGI ? 'on' : 'off'} · Bloom ${mood.bloom ? 'on' : 'off'}). Use Apex → Render Pipeline to bake tone mapping.`, 'success');
}
function addModelerErodedTerrain() {
  try { rememberHistory(); const built = buildTerrainFromPreset('alpine-ridged', { resolution: 40, erosionIterations: 1000, foliageCount: 16 }); const obj = makeMesh('terrain', scene.objects.filter(o => o.type === 'mesh').length + 1, { name: 'Eroded Biome Terrain', baseGeometry: built.geometry, color: '#64884b', material: { roughness: 0.95, baseColorImage: built.splatTexture || undefined } }); obj.primitive = 'terrain'; obj.scale = { x: 0.22, y: 0.22, z: 0.22 }; obj.position.y = -0.4; scene.objects.push(obj); activeObjectId = obj.engineId; selectedIds = new Set([obj.engineId]); refreshScene(); showToast(`Eroded terrain added: ${built.mesh.triangleCount} triangles · ${built.foliage.length} biome foliage.`, 'success'); } catch (e) { showToast(e.message, 'error'); }
}
function runModelerAiGenerate() {
  const prompt = $('#modelerAiPrompt')?.value || 'custom game';
  const rich = synthesizeRichOrvexaProject(prompt);
  const out = $('#modelerAiOutput'); if (out) out.textContent = `${rich.title} (${rich.domain}, ${rich.lineCount} lines) — copy into Studio main.orv:\n${rich.source.split('\n').slice(0, 8).join('\n')}\n…`;
  showToast(`Omni-Agent generated "${rich.title}" (${rich.lineCount} lines, ${rich.domain}).`, 'success');
}
function runModelerAiCritique() {
  const obj = selectedObject();
  const fakeScene = { objects: scene.objects.map(o => ({ name: o.name, type: o.type, triangleCount: (o.geometry?.length || 0) / 9, material: o.material })) };
  const report = critiqueAndEnhanceProject('', fakeScene);
  const out = $('#modelerAiOutput'); if (out) out.textContent = `📊 Scene critique: overall ${report.overall}/100 · performance ${report.performanceScore}/100 · ${fakeScene.objects.length} objects. ${report.suggestions[0] || ''}`;
  showToast(`Critique: ${report.overall}/100 (Grade ${report.grade})`, 'success');
}
function previewModelerTurntable() {
  const el = $('#modelerSequencePreview'); if (!el) return;
  el.innerHTML = renderTimelineSvg(getSequencerPreset('turntable-showcase'));
  const result = executeAgentTool('create_animation_sequence', { preset: 'turntable-showcase' });
  const out = $('#modelerAiOutput'); if (out) out.textContent = result.summary;
  switchInspectorTab('ai');
}
function renderModelerRails() {
  const prefabRail = $('#modelerPrefabRail');
  if (prefabRail) prefabRail.innerHTML = PREFAB_KITBASH_LIBRARY.map(pf => `<button type="button" class="rail-chip" data-modeler-prefab="${pf.id}" title="${pf.description}">${pf.name}</button>`).join('');
  const moodRail = $('#modelerMoodRail');
  if (moodRail) moodRail.innerHTML = ATMOSPHERE_MOODS.map(m => `<button type="button" class="rail-chip mood" data-modeler-mood="${m.id}" title="${m.description}">${m.name}</button>`).join('');
  $$('[data-modeler-prefab]').forEach(b => b.addEventListener('click', () => spawnModelerPrefab(b.dataset.modelerPrefab)));
  $$('[data-modeler-mood]').forEach(b => b.addEventListener('click', () => applyModelerMood(b.dataset.modelerMood)));
}

function naniteDecimateSelected() {
  const obj = selectedObject(); if (!obj || obj.type !== 'mesh') { showToast('Select a mesh first.', 'warning'); return; }
  try { rememberHistory(); evaluateObject(obj); const res = decimateTriangleMesh(obj.geometry, { targetRatio: 0.5 }); const dag = buildNaniteClusterDAG(obj.geometry, { clusterSize: 64 }); setBakedGeometry(obj, res.geometry, `Nanite QEM decimation: ${res.originalTriangles} → ${res.triangleCount} triangles.`); const el = $('#apexSummary'); if (el) el.textContent = `Nanite DAG: ${dag.levels.length} LOD levels (${dag.ratios.join(', ')}) · ${res.originalTriangles} → ${res.triangleCount} tris.`; } catch (e) { showToast(e.message, 'error'); }
}
function booleanSelectedMeshes() {
  const items = getSelectedObjects().filter(o => o.type === 'mesh');
  if (items.length < 2) { showToast('Shift-click two meshes in the Outliner, then run Boolean.', 'warning'); return; }
  try { rememberHistory(); for (const o of items.slice(0, 2)) evaluateObject(o); const mode = $('#booleanModeSelect').value || 'union'; const res = booleanTriangleMeshes(items[0].geometry, items[1].geometry, mode); const el = $('#apexSummary'); setBakedGeometry(items[0], res.geometry, `Boolean ${mode}: ${res.triangleCount} triangles.`); if (el) el.textContent = `Boolean ${mode} of "${items[0].name}" × "${items[1].name}": ${res.triangleCount} triangles.`; } catch (e) { showToast(e.message, 'error'); }
}
function fractureSelected() {
  const obj = selectedObject(); if (!obj || obj.type !== 'mesh') { showToast('Select a mesh first.', 'warning'); return; }
  try { rememberHistory(); evaluateObject(obj); const res = fractureTriangleMesh(obj.geometry, { fragments: 8, seed: 42, explode: 0.12 }); setBakedGeometry(obj, res.geometry, `Voronoi fracture into ${res.fragments.length} fragments.`); const el = $('#apexSummary'); if (el) el.textContent = `Fracture: ${res.fragments.length} Voronoi fragments · ${res.triangleCount} triangles.`; } catch (e) { showToast(e.message, 'error'); }
}
function spawnVfxMesh() {
  try { rememberHistory(); const preset = $('#vfxPresetSelect').value || 'campfire-sparks'; const emitter = stepVfxEmitter(createVfxEmitter({ preset, position: { x: 0, y: 0, z: 0 } }), 0.5); const geometry = buildVfxTriangleMesh(emitter); const index = scene.objects.filter(o => o.type === 'mesh').length + 1; const obj = makeMesh('mesh', index, { name: `${emitter.name || preset} VFX`, baseGeometry: Array.from(geometry), color: emitter.colorStart || '#ffb86b', material: { metallic: 0, roughness: 0.35, emissive: 1 } }); const lightAt = scene.objects.findIndex(o => o.type === 'light'); scene.objects.splice(lightAt < 0 ? scene.objects.length : lightAt, 0, obj); activeObjectId = obj.engineId; selectedIds = new Set([activeObjectId]); refreshScene(); const el = $('#vfxSummary'); if (el) el.textContent = `Spawned ${preset} VFX mesh (${geometry.length / 9} particles triangles).`; showToast(`Spawned live VFX mesh: ${preset}.`, 'success'); } catch (e) { showToast(e.message, 'error'); }
}
function solveDemoIk() {
  try { const obj = selectedObject(); const rig = createBasicRig(obj?.type === 'mesh' ? obj.geometry : createMeshGeometry('cube', 12)); const solved = solveRigIK(rig, { chain: ['root', 'spine', 'head'], target: { x: 0.5, y: 0.6, z: 0 }, iterations: 16, damping: 0.85 }); const el = $('#vfxSummary'); if (el) el.textContent = `CCD IK solved: end effector (${solved.endEffector.x.toFixed(2)}, ${solved.endEffector.y.toFixed(2)}, ${solved.endEffector.z.toFixed(2)}) · error ${solved.error.toFixed(3)} · ${solved.converged ? 'converged' : 'best effort'} in ${solved.iterations} iterations.`; showToast('Solved 3D CCD inverse kinematics for the demo rig.', 'success'); } catch (e) { showToast(e.message, 'error'); }
}
function applyToneMappingPipeline() {
  const mode = $('#toneMappingSelect').value || 'aces'; scene.renderSettings = { ...scene.renderSettings, toneMapping: mode, toneMappingMode: mode, lumenGI: true, bloom: true, bloomStrength: 0.35, bloomThreshold: 0.85, environmentPreset: scene.renderSettings?.environmentPreset || 'studio' }; rebuildRenderer(); scheduleLocalSave(); const el = $('#renderPipelineSummary'); if (el) el.textContent = `Renderer: ${mode.toUpperCase()} tone mapping · Lumen GI on · Bloom on (strength 0.35).`; showToast(`Render pipeline: ${mode.toUpperCase()} + Lumen GI + Bloom.`, 'success');
}

function renderWireframe() {
  const group = $('#wireframeLines'), svg = $('#viewportOverlay'), canvas = $('#modelerCanvas');
  if (!group || !svg || !canvas) return;
  const rect = canvas.getBoundingClientRect(); svg.setAttribute('viewBox', `0 0 ${Math.max(1, rect.width)} ${Math.max(1, rect.height)}`);
  if (activeMode !== 'edit') { group.innerHTML = ''; return; }
  const obj = selectedObject(); if (!obj || obj.type !== 'mesh') { group.innerHTML = ''; return; }
  const g = obj.geometry, edges = new Map(), vertexPoints = new Map(), polygons = [];
  const keyOf = p => meshVertexKey(p);
  // Draw selected face fills first so editable edges and vertices remain crisp above them.
  for (const index of selectedEditFaces) {
    const offset = index * 9; if (offset < 0 || offset + 8 >= g.length) continue;
    const local = [[g[offset], g[offset+1], g[offset+2]],[g[offset+3], g[offset+4], g[offset+5]],[g[offset+6], g[offset+7], g[offset+8]]];
    const projected = local.map(p => projectScenePoint(toWorld(p, obj), scene.editorCamera, rect.width, rect.height));
    if (projected.every(p => p && p.visible)) polygons.push(`<polygon class="selected-face" points="${projected.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')}"/>`);
    if (polygons.length > 500) break;
  }
  for (let i = 0; i < g.length; i += 9) {
    const points = [[g[i],g[i+1],g[i+2]],[g[i+3],g[i+4],g[i+5]],[g[i+6],g[i+7],g[i+8]]];
    const keys = points.map(keyOf);
    points.forEach((point, k) => vertexPoints.set(keys[k], point));
    for (let k=0;k<3;k++) { const a=keys[k], b=keys[(k+1)%3], id=meshEdgeKey(a,b); if(!edges.has(id))edges.set(id,[a,b]); }
    if (edges.size > 7000) break;
  }
  const lines = [];
  for (const [id, [a,b]] of edges) {
    const pa = projectScenePoint(toWorld(vertexPoints.get(a), obj), scene.editorCamera, rect.width, rect.height), pb = projectScenePoint(toWorld(vertexPoints.get(b), obj), scene.editorCamera, rect.width, rect.height);
    if (pa && pb && Math.abs(pa.ndcX)<1.1 && Math.abs(pa.ndcY)<1.1 && Math.abs(pb.ndcX)<1.1 && Math.abs(pb.ndcY)<1.1) lines.push(`<line class="${selectedEditEdges.has(id) ? 'selected-edge' : ''}" x1="${pa.x.toFixed(2)}" y1="${pa.y.toFixed(2)}" x2="${pb.x.toFixed(2)}" y2="${pb.y.toFixed(2)}"/>`);
    if (lines.length > 7000) break;
  }
  const vertices = [...vertexPoints.entries()].slice(0, 1000).map(([key,p]) => { const point=projectScenePoint(toWorld(p,obj),scene.editorCamera,rect.width,rect.height); return point && point.visible ? `<circle class="${selectedEditVertices.has(key) ? 'selected-vertex' : ''}" cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="${selectedEditVertices.has(key) ? '4' : '2.2'}"/>` : ''; });
  group.innerHTML = polygons.join('') + lines.join('') + vertices.join('');
}

function renderUVPreview() {
  const canvas = $('#uvCanvas'); if (!canvas) return;
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  const obj = selectedObject(), size = canvas.width;
  ctx.clearRect(0, 0, size, size); ctx.fillStyle = '#0c1220'; ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = '#2b354a'; ctx.lineWidth = 1;
  for (let i=0;i<=8;i++) { const p = i*size/8; ctx.beginPath(); ctx.moveTo(p,0); ctx.lineTo(p,size); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0,p); ctx.lineTo(size,p); ctx.stroke(); }
  ctx.strokeStyle = '#8b79ff'; ctx.lineWidth = 1; ctx.fillStyle = '#8b79ff18';
  if (!obj || obj.type !== 'mesh' || !Array.isArray(obj.uvs) || obj.uvs.length !== obj.geometry.length / 3 * 2) { $('#uvEmptyLabel').hidden = false; $('#uvSummary').textContent = 'Generate quick UVs to preview the atlas.'; return; }
  $('#uvEmptyLabel').hidden = true;
  const tris = Math.min(obj.geometry.length / 9, 16000);
  for (let tri=0; tri<tris; tri++) {
    ctx.beginPath();
    for (let v=0;v<3;v++) { const i=(tri*3+v)*2, x=clamp(finite(obj.uvs[i]),0,1)*size, y=(1-clamp(finite(obj.uvs[i+1]),0,1))*size; if(v===0)ctx.moveTo(x,y);else ctx.lineTo(x,y); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  $('#uvSummary').textContent = `${tris.toLocaleString()} UV triangles · ${tris < obj.geometry.length / 9 ? 'preview capped' : 'all faces displayed'}`;
}
function switchInspectorTab(tab) { if (!['object','material','modifiers','uv','apex','ai'].includes(tab)) return; activeInspectorTab = tab; renderInspector(); }
function setMode(mode) {
  if (!['object','edit','sculpt'].includes(mode)) return;
  if (mode === 'sculpt') {
    const obj = selectedObject();
    if (!obj || obj.type !== 'mesh') { showToast('Select a mesh before entering Sculpt mode.', 'warning'); return; }
    if (obj.modifiers?.length) { const answer = confirm('Sculpting edits the base mesh. Apply the current modifier stack before sculpting?'); if (!answer) return; rememberHistory(); obj.baseGeometry = [...obj.geometry]; obj.modifiers = []; obj.uvs = null; evaluateObject(obj); }
  }
  activeMode = mode;
  for (const b of $$('[data-mode]')) { b.classList.toggle('active', b.dataset.mode === mode); b.setAttribute('aria-pressed', String(b.dataset.mode === mode)); }
  $('#sculptDock').hidden = mode !== 'sculpt'; updateEditToolVisibility();
  $('#viewportHint').textContent = mode === 'sculpt' ? 'Click and drag over the mesh to sculpt · orbit with right/middle drag' : mode === 'edit' ? 'Mesh wireframe edit view · select mesh tools from UV / Mesh · orbit and zoom' : 'Drag to orbit · Scroll to zoom · F to focus · G/R/S to edit transform';
  renderWireframe(); renderStats();
}
function focusSelected() {
  const obj = selectedObject(); if (!obj) return;
  const target = { x: finite(obj.position?.x), y: finite(obj.position?.y), z: finite(obj.position?.z) };
  let extent = 1;
  if (obj.type === 'mesh') {
    const g = obj.geometry; let lo=[Infinity,Infinity,Infinity], hi=[-Infinity,-Infinity,-Infinity];
    for(let i=0;i<g.length;i+=3)for(let a=0;a<3;a++){lo[a]=Math.min(lo[a],g[i+a]);hi[a]=Math.max(hi[a],g[i+a]);}
    extent = Math.max(...lo.map((v,i)=>hi[i]-v))*Math.max(Math.abs(obj.scale.x),Math.abs(obj.scale.y),Math.abs(obj.scale.z))*obj.size;
  }
  scene.editorCamera ||= {}; scene.editorCamera.target = target; scene.editorCamera.zoom = clamp(Math.max(2.5, extent * 2.8), 2.5, 80); rebuildRenderer(); renderWireframe();
}
function setView(view) {
  scene.editorCamera ||= { target: { x: 0, y: 0, z: 0 }, zoom: 7 };
  if (view === 'front') { scene.editorCamera.angle = 0; scene.editorCamera.pitch = 0; }
  else if (view === 'side') { scene.editorCamera.angle = Math.PI / 2; scene.editorCamera.pitch = 0; }
  else if (view === 'top') { scene.editorCamera.angle = 0; scene.editorCamera.pitch = 1.12; }
  rebuildRenderer(); renderWireframe(); scheduleLocalSave();
}

function exportBlob(blob, filename) {
  const url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.style.display = 'none'; document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 2500);
}
function publishSelectedToWorld() {
  try {
    const pack = createWorldAssetPackage(scene.objects, selectedIds);
    localStorage.setItem(WORLD_ASSETS_STORAGE_KEY, JSON.stringify(pack));
    window.dispatchEvent(new CustomEvent('orvexa-world-assets-published', { detail: { count: pack.assets.length } }));
    showToast(`${pack.assets.length} model${pack.assets.length === 1 ? '' : 's'} published to Aetherfall. Switch to the game tab and sync if it was already open.`, 'success');
  } catch (error) {
    showToast(error.message || 'Unable to publish models to Aetherfall.', 'error');
  }
}

function exportProject() {
  const source = JSON.stringify(serializeProject(), null, 2), blob = new Blob([source], { type: 'application/json' });
  exportBlob(blob, `${(scene.name || 'orvexa-model').replace(/[^\w.-]+/g, '-').slice(0, 80)}.orvmodel`);
  setSavedState('Project downloaded'); showToast('Editable .orvmodel project downloaded.', 'success');
}
function openTexture(field) { $(`[data-texture-input="${field}"]`).click(); }
function loadTexture(field, file) {
  const obj = selectedObject(); if (!obj || obj.type !== 'mesh' || !file) return;
  if (!/^image\/(png|jpeg|webp)$/i.test(file.type) || file.size > 4_000_000) { showToast('Use PNG, JPEG or WebP textures up to 4 MB each.', 'warning'); return; }
  rememberHistory(); const reader = new FileReader(); reader.onload = () => { obj.material ||= {}; obj.material[field] = reader.result; renderInspector(); triggerRender(); scheduleLocalSave(); showToast(`${file.name} attached to material.`, 'success'); }; reader.onerror = () => showToast('Unable to read the texture file.', 'error'); reader.readAsDataURL(file);
}
function exportSelected(format) {
  const obj = selectedObject(); if (!obj) { showToast('Select an object to export.', 'warning'); return; }
  try {
    const safeName = (obj.name || 'orvexa-mesh').replace(/[^\w.-]+/g, '-').slice(0, 80);
    let blob, filename;
    if (obj.type === 'light') { showToast('Select a mesh object to export as an asset.', 'warning'); return; }
    const exported = { ...obj, type: 'mesh', geometry: [...obj.geometry] };
    if (format === 'obj') { blob = new Blob([exportOBJ(exported)], { type: 'text/plain' }); filename = `${safeName}.obj`; }
    else if (format === 'fbx') { blob = new Blob([exportFBX(exported)], { type: 'text/plain' }); filename = `${safeName}.fbx`; }
    else { const bytes = exportGLB(exported); blob = new Blob([bytes], { type: 'model/gltf-binary' }); filename = `${safeName}.glb`; }
    exportBlob(blob, filename); showToast(`${filename} exported.`, 'success');
  } catch (error) { showToast(error.message || 'Export failed.', 'error'); }
}
async function openAsset(file) {
  if (!file) return;
  try {
    if (file.size > 32 * 1024 * 1024) throw new Error('Imported asset files are limited to 32 MB.');
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'orvmodel' || (ext === 'json' && file.type !== 'application/octet-stream')) {
      const parsed = JSON.parse(await file.text()); if (parsed.schema !== 'orvexa-modeler-project') throw new Error('JSON file is not an Orvexa Modeler project.');
      rememberHistory(); const loaded = normalizeLoadedProject(parsed); scene.name = loaded.name; scene.objects = loaded.objects; scene.renderSettings = loaded.renderSettings; scene.worldPartition = loaded.worldPartition; scene.editorCamera = loaded.editorCamera; $('#projectName').value = scene.name; activeObjectId = scene.objects.find(o => o.type !== 'light')?.engineId || null; selectedIds = new Set(activeObjectId ? [activeObjectId] : []); activeModifierId = null; rebuildRenderer(); refreshScene(); showToast('Modeler project opened.', 'success'); return;
    }
    let items;
    if (ext === 'obj') items = [parseOBJ(await file.text(), file.name)];
    else if (ext === 'glb' || ext === 'gltf') items = importGLTF(ext === 'gltf' ? await file.text() : new Uint8Array(await file.arrayBuffer()), file.name);
    else if (ext === 'fbx') items = importFBX(await file.text(), file.name);
    else throw new Error('Supported formats: .orvmodel, .obj, .glb, embedded .gltf and ASCII .fbx.');
    rememberHistory(); const loadedObjects = items.map((entry, i) => {
      const obj = makeMesh('mesh', scene.objects.filter(o => o.type === 'mesh').length + i + 1, { ...entry, name: items.length > 1 ? `${entry.name || 'Imported Mesh'} ${i + 1}` : entry.name, baseGeometry: entry.geometry, primitive: 'mesh' });
      obj.position = { x: finite(entry.position?.x), y: finite(entry.position?.y), z: finite(entry.position?.z) }; obj.rotation = { x: finite(entry.rotation?.x), y: finite(entry.rotation?.y), z: finite(entry.rotation?.z) }; obj.scale = { x: finite(entry.scale?.x,1), y: finite(entry.scale?.y,1), z: finite(entry.scale?.z,1) }; obj.size = finite(entry.size,1); obj.uvs = entry.uvs ? [...entry.uvs] : null; obj.material = { ...obj.material, ...(entry.material || {}) };
      return obj;
    });
    const lightAt = scene.objects.findIndex(o => o.type === 'light'); scene.objects.splice(lightAt < 0 ? scene.objects.length : lightAt, 0, ...loadedObjects); activeObjectId = loadedObjects[0].engineId; selectedIds = new Set([activeObjectId]); activeInspectorTab = 'object'; refreshScene(); focusSelected(); showToast(`${loadedObjects.length} mesh${loadedObjects.length===1?'':'es'} imported from ${file.name}.`, 'success');
  } catch (error) { showToast(error.message || 'Unable to import file.', 'error'); }
}

function applyTransformField(input) {
  const obj = selectedObject(); if (!obj) return;
  const [group, component] = input.dataset.transform.split('.'); const raw = Number(input.value);
  if (!Number.isFinite(raw)) { renderInspector(); showToast('Enter a valid finite number.', 'warning'); return; }
  rememberHistory();
  if (group === 'rotation') obj.rotation[component] = degToRad(raw);
  else if (group === 'scale') obj.scale[component] = clamp(raw, 0.01, 100);
  else obj.position[component] = clamp(raw, -100000, 100000);
  input.value = group === 'rotation' ? round(radToDeg(obj.rotation[component]), 2) : round(obj[group][component], 3);
  renderOutliner(); renderStats(); renderWireframe(); triggerRender(); scheduleLocalSave();
}
function resetTransform() {
  const obj = selectedObject(); if (!obj) return; rememberHistory(); obj.position = { x: 0, y: 0, z: 0 }; obj.rotation = { x: 0, y: 0, z: 0 }; obj.scale = { x: 1, y: 1, z: 1 }; obj.size = 1; refreshScene();
}
function applySculptAt(clientX, clientY) {
  const obj = selectedObject(); if (!obj || obj.type !== 'mesh') return;
  const hit = raycastScene(clientX, clientY, { includeAll: false }); if (!hit || hit.object.engineId !== obj.engineId) return;
  try {
    const symmetryX = Boolean($('#sculptSymmetryX')?.checked);
    const result = sculptTriangleMesh(obj.baseGeometry, { mode: $('#sculptMode').value, center: { x: hit.local[0], y: hit.local[1], z: hit.local[2] }, radius: brushRadius, strength: brushStrength, symmetryX });
    obj.baseGeometry = result.geometry; evaluateObject(obj); renderStats(); renderWireframe(); renderUVPreview(); triggerRender(); scheduleLocalSave();
  } catch (error) { if (!String(error.message).includes('did not touch')) showToast(error.message, 'error'); }
}

function bindEvents() {
  $('#modelerCanvas').addEventListener('orvexa-camera-preview', event => { scene.editorCamera = event.detail || scene.editorCamera; renderWireframe(); });
  $('#modelerCanvas').addEventListener('orvexa-camera-change', event => { scene.editorCamera = event.detail || scene.editorCamera; renderWireframe(); scheduleLocalSave(); });
  $('#modelerCanvas').addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    lastPointer = { x: event.clientX, y: event.clientY, moved: false };
    if (activeMode === 'sculpt') { event.preventDefault(); event.stopImmediatePropagation(); rememberHistory(); activeSculptStroke = true; applySculptAt(event.clientX, event.clientY); }
  }, true);
  $('#modelerCanvas').addEventListener('pointermove', event => {
    if (lastPointer && Math.hypot(event.clientX-lastPointer.x,event.clientY-lastPointer.y)>4) lastPointer.moved = true;
    if (activeMode === 'sculpt') {
      const rect = $('#modelerCanvas').getBoundingClientRect(), zoom = finite(scene.editorCamera?.zoom,7), screenRadius = clamp(brushRadius * rect.height / (2 * Math.tan(Math.PI/8) * zoom), 8, 180);
      $('#sculptBrush').setAttribute('cx', event.clientX - rect.left); $('#sculptBrush').setAttribute('cy', event.clientY - rect.top); $('#sculptBrush').setAttribute('r', screenRadius);
      if (activeSculptStroke) { event.preventDefault(); event.stopImmediatePropagation(); applySculptAt(event.clientX, event.clientY); }
    }
  }, true);
  $('#modelerCanvas').addEventListener('pointerup', event => {
    if (activeSculptStroke) { event.preventDefault(); event.stopImmediatePropagation(); activeSculptStroke = false; scheduleLocalSave(); }
    else if (lastPointer && !lastPointer.moved && activeMode === 'edit') {
      const hit = raycastScene(event.clientX, event.clientY, { includeAll: false });
      if (hit) selectMeshElement(hit, event.clientX, event.clientY, event.shiftKey);
    }
    else if (lastPointer && !lastPointer.moved && activeMode === 'object') {
      const hit = raycastScene(event.clientX, event.clientY, { includeAll: true });
      if (hit) selectObject(hit.object.engineId, { shift: event.shiftKey });
      else if (!event.shiftKey) { activeObjectId = null; selectedIds.clear(); renderAll(); }
    }
    lastPointer = null;
  }, true);
  $('#modelerCanvas').addEventListener('pointercancel', () => { activeSculptStroke = false; lastPointer = null; }, true);
  $('#modelerCanvas').addEventListener('pointerleave', () => { if (!activeSculptStroke) { $('#sculptBrush').setAttribute('r','0'); $('#sculptBrush').setAttribute('cx','-100'); } });

  $('#projectName').addEventListener('change', () => { const value = $('#projectName').value.trim().slice(0,90); scene.name = value || 'Untitled Model'; $('#projectName').value = scene.name; scheduleLocalSave(); });
  $('#openProjectButton').addEventListener('click', () => $('#openProjectInput').click()); $('#importAssetToolbar').addEventListener('click', () => $('#openProjectInput').click());
  $('#openProjectInput').addEventListener('change', async event => { await openAsset(event.target.files?.[0]); event.target.value = ''; });
  $('#saveProjectButton').addEventListener('click', exportProject); $('#undoButton').addEventListener('click', undo); $('#redoButton').addEventListener('click', redo);
  $('#publishToWorldButton').addEventListener('click', publishSelectedToWorld);
  $$('[data-add-primitive]').forEach(button => button.addEventListener('click', () => addPrimitive(button.dataset.addPrimitive)));
  $('#addTerrainButton').addEventListener('click', addTerrain); $('#magicModelButton').addEventListener('click', addMagicModel); $('#addLightButton').addEventListener('click', addLight); $('#duplicateButton').addEventListener('click', duplicateSelected); $('#deleteButton').addEventListener('click', deleteSelected); $('#joinButton').addEventListener('click', joinSelected);
  $('#outliner').addEventListener('click', event => { const vis = event.target.closest('[data-visibility]'); if (vis) { event.stopPropagation(); const obj = getObject(vis.dataset.visibility); if (obj) { obj.visible = obj.visible === false; renderOutliner(); triggerRender(); scheduleLocalSave(); } return; } const row = event.target.closest('[data-id]'); if (row) { selectObject(row.dataset.id, { shift: event.shiftKey }); } });
  $('#outliner').addEventListener('dblclick', event => { const row=event.target.closest('[data-id]'); if(!row)return; const obj=getObject(row.dataset.id); const requested=prompt('Rename object:',obj?.name||''); if(requested?.trim()&&obj){rememberHistory();obj.name=requested.trim().slice(0,100);refreshScene();} });
  $('#outlinerSearch').addEventListener('input', renderOutliner); $('#expandOutlinerButton').addEventListener('click', () => { $('#outlinerSearch').value='';renderOutliner(); });
  $$('[data-mode]').forEach(button => button.addEventListener('click', () => setMode(button.dataset.mode)));
  $('#elementSelectionMode').addEventListener('change', () => { editSelectionMode = ['vertex','edge','face'].includes($('#elementSelectionMode').value) ? $('#elementSelectionMode').value : 'face'; clearEditSelection(); renderWireframe(); renderStats(); });
  $('#moveSelectedElementsButton').addEventListener('click', moveSelectedMeshElements); $('#extrudeFacesButton').addEventListener('click', extrudeSelectedFaces); $('#insetFacesButton').addEventListener('click', insetSelectedFaces);
  $('#splitEdgesButton').addEventListener('click', splitSelectedMeshEdges); $('#deleteFacesButton').addEventListener('click', deleteSelectedMeshFaces);
  $$('[data-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.view))); $('#focusViewButton').addEventListener('click', focusSelected);
  $('#gridToggleButton').addEventListener('click', () => { const stage=$('#viewportStage'),on=stage.classList.toggle('grid-on');$('#gridToggleButton').classList.toggle('active',on);$('#gridToggleButton').setAttribute('aria-pressed',String(on)); });
  $('#worldPartitionToggleButton').addEventListener('click', () => { scene.worldPartition ||= { enabled: false, cellSize: 128, loadRadius: 3, maxLoadedCells: 4096 }; scene.worldPartition.enabled = !scene.worldPartition.enabled; updateWorldPartitionControls(); renderStats(); triggerRender(); scheduleLocalSave(); showToast(scene.worldPartition.enabled ? 'Distance-based world streaming enabled.' : 'World streaming disabled; all scene cells are available.', 'success'); });
  $('#worldCellSizeSelect').addEventListener('change', () => { scene.worldPartition.cellSize = clamp(Number($('#worldCellSizeSelect').value), 8, 4096); triggerRender(); renderStats(); scheduleLocalSave(); });
  $('#worldLoadRadiusSelect').addEventListener('change', () => { scene.worldPartition.loadRadius = clamp(Number($('#worldLoadRadiusSelect').value), 0, 16); triggerRender(); renderStats(); scheduleLocalSave(); });
  $$('[data-inspector-tab]').forEach(button => button.addEventListener('click', () => switchInspectorTab(button.dataset.inspectorTab)));
  $('#objectNameInput').addEventListener('change', () => { const obj=selectedObject();if(!obj)return;const name=$('#objectNameInput').value.trim();if(!name){$('#objectNameInput').value=obj.name;return;}rememberHistory();obj.name=name.slice(0,100);refreshScene(); });
  $('#objectVisibleInput').addEventListener('change', () => { const obj=selectedObject();if(obj){rememberHistory();obj.visible=$('#objectVisibleInput').checked;triggerRender();renderOutliner();scheduleLocalSave();} });
  $('#worldAssetRole').addEventListener('change', () => { const obj=selectedObject();if(obj?.type==='mesh'){rememberHistory();obj.gameplayRole=$('#worldAssetRole').value;scheduleLocalSave();showToast(`Gameplay role set to ${obj.gameplayRole}.`, 'info');} });
  $('#worldAssetCollision').addEventListener('change', () => { const obj=selectedObject();if(obj?.type==='mesh'){rememberHistory();obj.collisionMode=$('#worldAssetCollision').value;scheduleLocalSave();} });
  $('#worldAssetLore').addEventListener('change', () => { const obj=selectedObject();if(obj?.type==='mesh'){rememberHistory();obj.loreText=$('#worldAssetLore').value.trim().slice(0,220);scheduleLocalSave();} });
  $('#applyMaterialGraphButton').addEventListener('click', applyMaterialGraphToSelected);
  $('#spawnGeoNodeButton').addEventListener('click', spawnProceduralGeoNodeMesh);
  $('#unwrapIslandsButton').addEventListener('click', unwrapSelectedUVIslands);
  $('#inspectUVButton').addEventListener('click', inspectSelectedUVs);
  $('#weldVerticesButton').addEventListener('click', weldSelectedMeshVertices);
  $('#flipNormalsButton').addEventListener('click', flipSelectedMeshNormals);
  $('#recalcNormalsButton').addEventListener('click', recalcSelectedMeshNormals);
  $('#inspectTopologyButton').addEventListener('click', inspectSelectedMeshTopology);
  $('#loopCutButton')?.addEventListener('click', loopCutSelected);
  $('#pokeFacesButton')?.addEventListener('click', pokeSelected);
  $('#fillHolesButton')?.addEventListener('click', fillHolesSelected);
  $('#naniteDecimateButton')?.addEventListener('click', naniteDecimateSelected);
  $('#catmullClarkButton')?.addEventListener('click', catmullClarkSelected);
  $('#geodesicSphereButton')?.addEventListener('click', addGeodesicSphere);
  $('#latheVaseButton')?.addEventListener('click', addLatheVase);
  $('#bridgeLoopsButton')?.addEventListener('click', bridgeDemoLoops);
  $('#fracture3dButton')?.addEventListener('click', fracture3dSelected);
  $('#naniteDagStatsButton')?.addEventListener('click', naniteDagStats);
  $('#topologyDoctorButton')?.addEventListener('click', topologyDoctor);
  $('#modelerLatheRailButton')?.addEventListener('click', addLatheVase);
  $('#modelerGeodesicRailButton')?.addEventListener('click', addGeodesicSphere);
  $('#modelerTerrainRailButton')?.addEventListener('click', addModelerErodedTerrain);
  $('#modelerAiGenerateButton')?.addEventListener('click', runModelerAiGenerate);
  $('#modelerAiCritiqueButton')?.addEventListener('click', runModelerAiCritique);
  $('#modelerAiTerrainButton')?.addEventListener('click', addModelerErodedTerrain);
  $('#modelerAiTurntableButton')?.addEventListener('click', previewModelerTurntable);
  $('#materialGraphPreset')?.addEventListener('change', updateMaterialGraphSvgPreview);
  $('#geoNodePreset')?.addEventListener('change', updateGeoNodeSvgPreview);
  renderModelerRails(); updateMaterialGraphSvgPreview(); updateGeoNodeSvgPreview();
  $('#booleanMeshButton')?.addEventListener('click', booleanSelectedMeshes);
  $('#fractureMeshButton')?.addEventListener('click', fractureSelected);
  $('#spawnVfxButton')?.addEventListener('click', spawnVfxMesh);
  $('#solveIkButton')?.addEventListener('click', solveDemoIk);
  $('#applyToneMappingButton')?.addEventListener('click', applyToneMappingPipeline);
  $$('[data-transform]').forEach(input => { input.addEventListener('change', () => applyTransformField(input)); input.addEventListener('keydown', event => { if(event.key==='Enter'){event.preventDefault();input.blur();} }); });
  $$('[data-reset-transform]').forEach(button => button.addEventListener('click', resetTransform));
  for (const id of ['materialColor','materialMetallic','materialRoughness','materialClearcoat','materialEmissive']) $( '#' + id ).addEventListener('pointerdown', () => { if (!historyGestureRecorded) { rememberHistory(); historyGestureRecorded=true; } });
  for (const id of ['materialMetallic','materialRoughness','materialClearcoat','materialEmissive']) $(`#${id}`).addEventListener('input', () => {
    const obj=selectedObject();if(!obj||obj.type!=='mesh')return;const map={materialMetallic:'metallic',materialRoughness:'roughness',materialClearcoat:'clearcoat',materialEmissive:'emissive'};obj.material[map[id]]=Number($('#'+id).value);const out={materialMetallic:'metallicOutput',materialRoughness:'roughnessOutput',materialClearcoat:'clearcoatOutput',materialEmissive:'emissiveOutput'}[$(`#${id}`).id];$('#'+out).textContent=Number($('#'+id).value).toFixed(2);triggerRender();scheduleLocalSave();
  });
  for (const id of ['materialMetallic','materialRoughness','materialClearcoat','materialEmissive']) $(`#${id}`).addEventListener('change', () => { historyGestureRecorded=false;renderStats(); });
  $('#materialColor').addEventListener('input', () => {const o=selectedObject();if(o?.type==='mesh'){o.color=$('#materialColor').value;triggerRender();scheduleLocalSave();}});
  $$('[data-texture]').forEach(button => button.addEventListener('click', () => openTexture(button.dataset.texture)));
  $$('[data-texture-input]').forEach(input => input.addEventListener('change', () => {loadTexture(input.dataset.textureInput,input.files?.[0]);input.value='';}));
  $('#addModifierButton').addEventListener('click', () => addModifier($('#modifierTypeSelect').value));
  $('#modifierList').addEventListener('click', event => { const button=event.target.closest('[data-modifier-select]');if(button){activeModifierId=button.dataset.modifierSelect;renderInspector();}const up=event.target.closest('[data-modifier-up]');if(up)moveModifier(up.dataset.modifierUp,-1);const down=event.target.closest('[data-modifier-down]');if(down)moveModifier(down.dataset.modifierDown,1); });
  $('#modifierList').addEventListener('change', event => {const input=event.target.closest('[data-modifier-enabled]');if(input){rememberHistory();setModifierEnabled(input.dataset.modifierEnabled,input.checked);}});
  $('#modifierSettings').addEventListener('input', event => {const input=event.target.closest('[data-modifier-param]');if(!input)return;const obj=selectedObject(),m=obj?.modifiers?.find(x=>x.id===activeModifierId);if(!m)return;const key=input.dataset.modifierParam,value=input.type==='number'||input.type==='range'?Number(input.value):input.value;updateModifier(m.id,{[key]:value});const hint=input.parentElement.querySelector('span');if(hint)hint.textContent=Number(value).toFixed(2);});
  $('#modifierSettings').addEventListener('change', event => {const input=event.target.closest('[data-modifier-param]');if(input)renderInspector();});
  $('#modifierSettings').addEventListener('click', event => {if(event.target.closest('#removeModifierButton'))removeModifier();});
  $$('[data-quick-tool]').forEach(button => button.addEventListener('click', () => { const map={subdivide:'subdivide',smooth:'smooth',mirror:'mirror',uv:'uv',cleanup:'cleanup'}; if(button.dataset.quickTool==='uv')switchInspectorTab('uv');applyMeshOperation(map[button.dataset.quickTool]); }));
  for (const [id,op] of [['applyTransformsButton',applyTransforms],['applyModifiersButton',applyModifiers],['subdivideMeshButton',()=>applyMeshOperation('subdivide')],['mirrorMeshButton',()=>applyMeshOperation('mirror')],['cleanupMeshButton',()=>applyMeshOperation('cleanup')],['smoothMeshButton',()=>applyMeshOperation('smooth')],['generateUVButton',()=>applyMeshOperation('uv')],['clearUVButton',()=>{const o=selectedObject();if(o){rememberHistory();o.uvs=null;refreshScene();showToast('UV coordinates cleared.');}}],['smoothShadingButton',()=>{const o=selectedObject();if(o?.type==='mesh'){rememberHistory();o.flatShading=false;o.geometryRevision++;triggerRender();scheduleLocalSave();}}],['flatShadingButton',()=>{const o=selectedObject();if(o?.type==='mesh'){rememberHistory();o.flatShading=true;o.geometryRevision++;triggerRender();scheduleLocalSave();}}],['subdivideForSculpt',()=>applyMeshOperation('subdivide')]]) $(`#${id}`).addEventListener('click', op);
  $$('[data-export]').forEach(button => button.addEventListener('click', () => exportSelected(button.dataset.export)));
  $('#brushRadius').addEventListener('input', () => {brushRadius=Number($('#brushRadius').value);$('#brushRadiusValue').textContent=brushRadius.toFixed(2);});$('#brushStrength').addEventListener('input', () => {brushStrength=Number($('#brushStrength').value);$('#brushStrengthValue').textContent=brushStrength.toFixed(2);});
  $('#lightTypeSelect').addEventListener('change', () => {const o=selectedObject();if(o?.type==='light'){rememberHistory();o.lightType=$('#lightTypeSelect').value;triggerRender();scheduleLocalSave();renderOutliner();}});
  $('#lightIntensity').addEventListener('pointerdown', () => {if(!historyGestureRecorded){rememberHistory();historyGestureRecorded=true;}});$('#lightIntensity').addEventListener('input', () => {const o=selectedObject();if(o?.type==='light'){o.intensity=Number($('#lightIntensity').value);$('#lightIntensityOutput').textContent=o.intensity.toFixed(1);triggerRender();scheduleLocalSave();}});$('#lightIntensity').addEventListener('change',()=>historyGestureRecorded=false);
  $('#lightRange').addEventListener('input', () => {const o=selectedObject();if(o?.type==='light'){o.range=Number($('#lightRange').value);$('#lightRangeOutput').textContent=String(o.range);triggerRender();scheduleLocalSave();}});
  $('#lightColor').addEventListener('input', () => {const o=selectedObject();if(o?.type==='light'){o.color=$('#lightColor').value;triggerRender();scheduleLocalSave();}});
  for (const id of ['lightDirX','lightDirY','lightDirZ']) $(`#${id}`).addEventListener('change', () => {const o=selectedObject();if(o?.type==='light'){rememberHistory();o.direction||={x:0,y:-1,z:0};o.direction[id==='lightDirX'?'x':id==='lightDirY'?'y':'z']=Number($(`#${id}`).value);triggerRender();scheduleLocalSave();}});
  $('#lightCone').addEventListener('input', () => {const o=selectedObject();if(o?.type==='light'){o.outerCone=Number($('#lightCone').value);o.innerCone=Math.min(o.outerCone-1, Math.max(0,o.outerCone*.65));$('#lightConeOutput').textContent=`${o.outerCone}°`;triggerRender();scheduleLocalSave();}});
  $('#helpButton').addEventListener('click', () => showToast('Shortcuts: F focus · G/R/S sets transform fields · Shift-click multi-select · Shift+D duplicate · Delete removes · Ctrl+Z undo · Ctrl+Shift+Z redo · Tab cycles Object/Edit/Sculpt.', 'info'));
  document.addEventListener('keydown', event => {
    const tag = String(document.activeElement?.tagName || '').toLowerCase(), editing = ['input','textarea','select'].includes(tag) || document.activeElement?.isContentEditable;
    if ((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();exportProject();return;}
    if ((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();event.shiftKey?redo():undo();return;}
    if ((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='y'){event.preventDefault();redo();return;}
    if (editing) return;
    if (event.key==='Delete'||event.key==='Backspace'){event.preventDefault();deleteSelected();return;}
    if (event.shiftKey&&event.key.toLowerCase()==='d'){event.preventDefault();duplicateSelected();return;}
    if (event.key.toLowerCase()==='f'){event.preventDefault();focusSelected();return;}
    if (event.key==='Tab'){event.preventDefault();setMode(activeMode==='object'?'edit':activeMode==='edit'?'sculpt':'object');return;}
    if (['g','r','s'].includes(event.key.toLowerCase())) { const first=$('[data-transform="position.x"]');if(first){first.focus();first.select();showToast(`${event.key.toUpperCase()} selected — edit transform values in the Object panel.`);} }
  });
}

scene = restoreProject(); scene.worldPartition ||= { enabled: false, cellSize: 128, loadRadius: 3, maxLoadedCells: 4096 }; $('#projectName').value = scene.name; activeObjectId = scene.objects.find(o => o.type !== 'light')?.engineId || null; selectedIds = new Set(activeObjectId ? [activeObjectId] : []);
$('#viewportStage').classList.add('grid-on');
bindEvents(); rebuildRenderer(); renderAll(); updateUndoRedo(); scheduleLocalSave();
window.addEventListener('beforeunload', () => { cleanupRenderer?.(); clearTimeout(saveTimer); try { localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeProject())); } catch { /* The explicit project export remains available. */ } });
