import { zipSync, unzip, zipText, unzipText } from './zip.js';
import { DEFAULT_REALM_SOURCE } from '../language/realm.js';

export const PROJECT_STORAGE_KEY = 'orvexa-studio-project-v1';
export const PROJECT_FORMAT = 'orvexa-studio-project';
export const PROJECT_VERSION = 7;

export const STARTER_SOURCE = `// Welcome to Orvexa — your program starts here.\napp "Orvexa Starter"\n\nstate clicks = 0\n\nprint("Orvexa runtime is ready.")\n\npage "Home" {\n    column(gap: 16) {\n        badge("PART 2 · SAFER LANGUAGE CORE")\n        title("Welcome to Orvexa", size: 32)\n        paragraph("A custom language for building interactive experiences.")\n        card(padding: 20) {\n            title("Your first stateful UI", size: 20)\n            text("This button runs an Orvexa block and updates real state.")\n            button("Clicks: " + clicks) {\n                clicks = clicks + 1\n                print("Button clicked", clicks)\n            }\n        }\n        row(gap: 10) {\n            badge("Parser")\n            badge("Interpreter")\n            badge("Live preview")\n        }\n    }\n}\n`;

export const EXAMPLE_FILES = {
  'examples/aetherfall.realm': DEFAULT_REALM_SOURCE,

  'examples/hello.orv': `app "Hello Orvexa"\nprint("Hello, world!")\nprint("2 + 3 =", 2 + 3)\n`,
  'examples/control-flow.orv': `app "Control Flow Lab"\n\nfunction factorial(n) {\n    if n <= 1 {\n        return 1\n    }\n    return n * factorial(n - 1)\n}\n\nlet total = 0\nfor i in range(1, 6) {\n    total = total + i\n    print("sum so far:", total)\n}\n\nprint("5! =", factorial(5))\n`,
  'examples/website.orv': `app "Tiny Web App"\nstate likes = 0\n\npage "Home" {\n    column(gap: 14) {\n        title("A real Orvexa page", size: 30)\n        paragraph("The Studio interprets UI declarations into live DOM elements.")\n        card(padding: 18) {\n            title("Community card", size: 20)\n            text("Change the source and press Run.")\n            button("Like · " + likes) {\n                likes = likes + 1\n            }\n        }\n        link("Orvexa documentation", url: "https://example.com")\n    }\n}\n`,
  'examples/helpers.orv': `function square(value) {
    return value * value
}
`,
  'examples/module-demo.orv': `import "./helpers.orv"
app "Modules Demo"
print("square(9) =", square(9))
`,
  'examples/types.orv': `// Types are runtime contracts: Orvexa checks them when values enter or change a typed slot.
app "Typed Orvexa"

let username: string = "Ada"
let score: number = 42
let isReady: boolean = true

function double(value: number): number {
    return value * 2
}

print(username, "score:", score, "double:", double(score))
print("username type:", typeOf(username), "ready:", isReady)
`,
  'examples/null-safe.orv': `// ?. safely reads a property when its parent may be null. ?? chooses a fallback only for null.
app "Null-safe Access"

let profile = null
let displayName = profile?.user?.name ?? "Guest"
print("Hello,", displayName)

let settings = { theme: "dark" }
print("Theme:", settings?.theme ?? "system")
`,
  'examples/data-toolkit.orv': `app "Data Toolkit"

let scores = [18, 7, 24, 18, 11]
print("Count:", len(scores))
print("Sum:", sum(scores))
print("Average:", average(scores))
print("Sorted:", sorted(scores))
print("Unique:", unique(scores))
print("First / last:", first(scores), last(scores))
print("Uppercase:", upper("learn orvexa"))

let person = { name: "Ada", role: "Builder" }
print("Keys:", keys(person))
print("Has role:", has(person, "role"))
`,
  'examples/scene-lab.orv': `app "WebGL Scene Lab"\nscene "Geometry Gallery" {\n    camera(position: vec3(0, 2, 7))\n    light(position: vec3(2, 4, 3), color: "#ffffff")\n    cube("Hero Cube", position: vec3(-1.5, 0, 0), size: 1.3, color: "#7c5cff")\n    sphere("Moon", position: vec3(0, 0, 0), radius: 0.8, color: "#ffb86b")\n    torus("Ring", position: vec3(1.6, 0, 0), size: 1.5, color: "#52d6c7")\n    plane("Floor", position: vec3(0, -1.1, 0), size: 5, color: "#22243c")\n    animate("Hero Cube", rotation: vec3(0, 1, 0), speed: 0.7)\n}\nprint("Try dragging to orbit the real-time WebGL scene.")\n`,
  'examples/scene.orv': `app "Scene Sketch"\nscene "Purple Hero" {\n    camera(position: vec3(0, 2, 6))\n    light(position: vec3(2, 4, 3), color: "#ffffff")\n    cube("Hero", position: vec3(0, 0, 0), size: 1.7, color: "#7c5cff")\n    sphere("Moon", position: vec3(1.8, 0.55, -0.5), radius: 0.48, color: "#ffb86b")\n    plane("Floor", position: vec3(0, -1.1, 0), size: 5, color: "#22243c")\n    animate("Hero", rotation: vec3(0, 1, 0), speed: 0.7)\n}\nprint("Scene parsed and ready for inspection.")\n`,
  'examples/forge-game.orv': `app "Orvexa Forge · Hover Arena"\n\nscene "Hover Arena" {\n    camera(position: vec3(0, 2, 7))\n    light(position: vec3(3, 5, 4), color: "#ffffff")\n    plane("Arena Floor", position: vec3(0, -1, 0), size: 10, color: "#242a45")\n    cube("Chrome Crate", position: vec3(-1.2, 0, 0), size: 0.9, color: "#7965ff")\n    sphere("Physics Ball", position: vec3(1.2, 1.3, 0), radius: 0.38, color: "#ffb86b")\n    cylinder("Energy Pillar", position: vec3(0, 0, -1.8), size: 1.1, color: "#55d6be")\n    torus("Portal Ring", position: vec3(2.1, 0.1, -1), size: 1.2, color: "#ff6b9d")\n    rigidbody("Physics Ball", mass: 1, restitution: 0.45, friction: 0.35, velocity: vec3(0.5, 0, 0))\n    controller("Physics Ball", speed: 3.2, jumpSpeed: 5)\n    material("Chrome Crate", metallic: 0.82, roughness: 0.22, emissive: 0.03)\n    animate("Portal Ring", rotation: vec3(0, 1, 0), speed: 0.8)\n}\n\nprint("Orvexa Forge ready. Open Scene, press Play, then move the ball with WASD or arrow keys. Space jumps after landing.")\n`,
  'examples/forge-quality.orv': `// Orvexa Forge quality profile: shadows, filmic exposure, fog and material tuning.
app "Forge Quality Lab"
scene "Studio Lighting" {
    camera(position: vec3(0, 2.4, 8))
    light(position: vec3(3, 6, 4), color: "#fff2dc")
    plane("Ground", position: vec3(0, -1.1, 0), size: 12, color: "#303549")
    sphere("Ceramic", position: vec3(-1.4, 0, 0), radius: 0.8, color: "#d8e0f7")
    cube("Anodized Metal", position: vec3(0, 0, 0), size: 1.2, color: "#7c92fa")
    torus("Emissive Ring", position: vec3(1.7, 0.1, 0), size: 1.5, color: "#ff789d")
    material("Anodized Metal", metallic: 0.72, roughness: 0.24, emissive: 0.02)
}
print("Open Scene to adjust shadows, filmic post effects and fog. Export GLB for a single mesh or Project ZIP to back up everything.")
`,
  'examples/forge-pathtrace.orv': `// Offline CPU path-tracing showcase: direct shadows, materials, emissive light and approximate indirect GI.
app "Forge Path Trace Gallery"
scene "Path Trace Gallery" {
    camera(position: vec3(0, 2.1, 7))
    light(position: vec3(3, 5, 3), color: "#fff0d8")
    light(position: vec3(-3, 3, 1), color: "#7ebcff")
    plane("Matte Floor", position: vec3(0, -1, 0), size: 10, color: "#444957")
    sphere("Rough Ceramic", position: vec3(-1.45, 0, 0), radius: 0.8, color: "#df6c54")
    sphere("Metal Sphere", position: vec3(0, 0, -0.3), radius: 0.8, color: "#8ba8d8")
    cube("Golden Block", position: vec3(1.55, -0.1, -0.4), size: 1.05, color: "#d7a84b")
    torus("Emissive Ring", position: vec3(0, 1.9, -1.4), size: 1.05, color: "#ff4f97")
    material("Rough Ceramic", metallic: 0.02, roughness: 0.88)
    material("Metal Sphere", metallic: 0.92, roughness: 0.19)
    material("Golden Block", metallic: 0.68, roughness: 0.28)
    material("Emissive Ring", metallic: 0.1, roughness: 0.24, emissive: 1.4)
}
print("Open Scene and press Offline Path Trace. Start with Mobile/Preview quality on slower devices.")
`,
};

export function createStarterProject() {
  return {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    name: 'My Orvexa Project',
    activeFile: 'main.orv',
    files: { 'main.orv': STARTER_SOURCE, ...EXAMPLE_FILES },
    folders: ['examples'],
    updatedAt: new Date().toISOString(),
  };
}

export function normalizePath(path) {
  const raw = String(path ?? '').replaceAll('\\', '/').trim();
  const pathParts = raw.split('/').filter((part) => part && part !== '.');
  if (!pathParts.length || pathParts.some((part) => part === '..' || part.includes('\0'))) throw new Error('Unsafe or empty project path.');
  return pathParts.join('/');
}

export function validateProject(input) {
  if (!input || typeof input !== 'object' || typeof input.files !== 'object' || input.files === null) throw new Error('This file is not an Orvexa project.');
  const files = {};
  for (const [path, content] of Object.entries(input.files)) {
    const safePath = normalizePath(path);
    if (typeof content !== 'string') throw new Error(`File "${safePath}" does not contain text.`);
    if (new TextEncoder().encode(content).length > 2_000_000) throw new Error(`File "${safePath}" is larger than the 2 MB per-file import limit.`);
    files[safePath] = content;
  }
  if (!Object.keys(files).length) throw new Error('The project has no files.');
  return {
    format: PROJECT_FORMAT, version: PROJECT_VERSION,
    name: String(input.name || 'Imported Orvexa Project').slice(0, 100),
    activeFile: files[input.activeFile] !== undefined ? input.activeFile : Object.keys(files).find((p) => p.endsWith('.orv')) ?? Object.keys(files)[0],
    files,
    folders: [...new Set((Array.isArray(input.folders) ? input.folders : []).map(normalizePath))],
    sceneOverrides: input.sceneOverrides && typeof input.sceneOverrides === 'object' && !Array.isArray(input.sceneOverrides) ? input.sceneOverrides : {},
    sceneState: input.sceneState && typeof input.sceneState === 'object' && !Array.isArray(input.sceneState) ? input.sceneState : {},
    updatedAt: new Date().toISOString(),
  };
}

export function saveProject(project) {
  const safe = validateProject(project);
  const payload = JSON.stringify({ ...safe, updatedAt: new Date().toISOString() });
  try { localStorage.setItem(PROJECT_STORAGE_KEY, payload); return true; }
  catch { return false; }
}

export function loadProject() {
  try {
    const raw = localStorage.getItem(PROJECT_STORAGE_KEY);
    if (raw) {
      const stored = JSON.parse(raw);
      const previousVersion = Number(stored.version) || 1;
      const project = validateProject(stored);
      if (previousVersion < 6) {
        // Add new lessons without overwriting any existing user files.
        for (const path of ['examples/types.orv', 'examples/null-safe.orv', 'examples/data-toolkit.orv', 'examples/scene-lab.orv', 'examples/forge-game.orv', 'examples/forge-quality.orv']) {
          if (project.files[path] === undefined && EXAMPLE_FILES[path] !== undefined) project.files[path] = EXAMPLE_FILES[path];
        }
        if (!project.folders.includes('examples')) project.folders.push('examples');
        saveProject(project);
      }
      if (project.files['examples/aetherfall.realm'] === undefined) { project.files['examples/aetherfall.realm'] = EXAMPLE_FILES['examples/aetherfall.realm']; if (!project.folders.includes('examples')) project.folders.push('examples'); saveProject(project); }
      return project;
    }
  } catch { /* fall back to a known-good starter project */ }
  return createStarterProject();
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = filename; a.rel = 'noopener'; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}

export function exportProjectZip(project) {
  const safe = validateProject(project); const entries = {};
  entries['orvexa.project.json'] = zipText(JSON.stringify(safe, null, 2));
  entries['README-IMPORT.txt'] = zipText(`Orvexa Studio project: ${safe.name}\n\nOpen this ZIP in Orvexa Studio using Import.\nThe source files are included in the project manifest.\nUploaded code is not executed during import; use Run only after reviewing the code.\n`);
  for (const [path, content] of Object.entries(safe.files)) entries[`source/${normalizePath(path)}`] = zipText(content);
  return new Blob([zipSync(entries)], { type: 'application/zip' });
}

export async function importProjectFile(file) {
  const name = file.name || 'import'; const lower = name.toLowerCase();
  if (lower.endsWith('.orv')) {
    return validateProject({ name: name.replace(/\.orv$/i, '') || 'Imported Orvexa File', files: { [normalizePath(name)]: await file.text() }, activeFile: normalizePath(name) });
  }
  if (lower.endsWith('.json') || lower.endsWith('.orvproj')) {
    const parsed = JSON.parse(await file.text());
    if (parsed.files) return validateProject(parsed);
    if (typeof parsed.source === 'string') return validateProject({ name: parsed.name || 'Imported Orvexa File', files: { 'main.orv': parsed.source } });
    throw new Error('JSON import expects an Orvexa project manifest with a files object.');
  }
  if (lower.endsWith('.zip')) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.byteLength > 32_000_000) throw new Error('Project ZIPs are limited to 32 MB.');
    const entries = await unzip(bytes, { maxUncompressed: 30_000_000, maxEntryBytes: 24_000_000 }); const files = {}; let manifest = null;
    for (const [path, data] of Object.entries(entries)) {
      if (path.endsWith('/')) continue;
      const basename = path.split('/').at(-1);
      if (basename === 'orvexa.project.json' || basename === 'project.json') {
        try { const meta = JSON.parse(unzipText(data)); if (meta.files && typeof meta.files === 'object') manifest = meta; } catch { /* ignore non-project json entries */ }
      }
      if (path.startsWith('__MACOSX/') || basename.startsWith('.')) continue;
      const relative = path.startsWith('source/') ? path.slice(7) : path;
      if (relative.includes('..')) continue;
      if (relative.endsWith('.orv') || relative.endsWith('.orvexa') || relative.endsWith('.json') || relative.endsWith('.txt') || relative.endsWith('.css') || relative.endsWith('.js') || relative.endsWith('.html')) {
        const safePath = normalizePath(relative);
        if (safePath === 'orvexa.project.json' || safePath === 'project.json' || safePath === 'README-IMPORT.txt') continue;
        const text = unzipText(data);
        if (new TextEncoder().encode(text).length > 2_000_000) throw new Error(`File "${safePath}" is larger than the 2 MB import limit.`);
        files[safePath] = text;
      }
    }
    if (manifest) return validateProject({ ...manifest, files: manifest.files });
    if (!Object.keys(files).length) throw new Error('This ZIP has no supported text files (.orv, .js, .html, .css, .json, or .txt).');
    return validateProject({ name: name.replace(/\.zip$/i, '') || 'Imported ZIP Project', files });
  }
  throw new Error('Supported imports: .orv, Orvexa project .json, and project .zip files.');
}

function esc(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}
function safeUrl(value) {
  try { const url = new URL(String(value)); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
}
function staticNode(node) {
  if (!node || node.__orvUi !== true) return '';
  const p = node.props || {}; const children = (node.children || []).map(staticNode).join('');
  const label = esc(p.label ?? p.value ?? '');
  switch (node.component) {
    case 'column': return `<div class="orv-column" style="gap:${Math.min(80, Math.max(0, Number(p.gap) || 12))}px">${children}</div>`;
    case 'row': return `<div class="orv-row" style="gap:${Math.min(80, Math.max(0, Number(p.gap) || 12))}px">${children}</div>`;
    case 'card': case 'panel': return `<section class="orv-card">${children || label}</section>`;
    case 'title': return `<h2 style="font-size:${Math.min(64, Math.max(14, Number(p.size) || 28))}px">${label || children}</h2>`;
    case 'paragraph': return `<p>${label || children}</p>`;
    case 'text': return `<p class="orv-text">${label || children}</p>`;
    case 'button': return `<button type="button" class="orv-button">${label || 'Button'}</button>`;
    case 'badge': return `<span class="orv-badge">${label}</span>`;
    case 'divider': return '<hr />';
    case 'spacer': return '<div style="height:16px"></div>';
    case 'image': { const src = safeUrl(p.src ?? p.url); return src ? `<img alt="${esc(p.alt ?? '')}" src="${esc(src)}" style="max-width:100%;border-radius:12px"/>` : ''; }
    case 'link': { const href = safeUrl(p.url ?? p.href); return href ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${label || href}</a>` : `<span>${label}</span>`; }
    case 'input': return `<input placeholder="${label}" value="${esc(p.value ?? '')}" />`;
    case 'textarea': return `<textarea placeholder="${label}">${esc(p.value ?? '')}</textarea>`;
    case 'list': return `<ul>${(Array.isArray(p.items) ? p.items : []).map((x) => `<li>${esc(x)}</li>`).join('')}${children}</ul>`;
    default: return `<div>${label}${children}</div>`;
  }
}

export function buildStaticWebsite(project, result) {
  const name = esc(result?.appName || project.name || 'Orvexa Website');
  const page = result?.pages?.[0];
  const markup = page ? (page.children || []).map(staticNode).join('') : '<p>No page() declaration was produced. Add a page block and build again.</p>';
  const html = `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${name}</title><style>
:root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,-apple-system,sans-serif;color:#f1efff;background:#101019}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 20% 0%,#272344,#101019 45%)}main{max-width:980px;margin:auto;padding:clamp(24px,5vw,64px)}h1,h2,h3{line-height:1.15;letter-spacing:-.035em}p{color:#c4c1d5;line-height:1.7}.orv-column{display:flex;flex-direction:column}.orv-row{display:flex;flex-wrap:wrap;align-items:center}.orv-card{padding:22px;border:1px solid #39354e;border-radius:18px;background:#1b1928;box-shadow:0 12px 40px #0002}.orv-text{margin:0}.orv-button{font:inherit;font-weight:650;color:white;background:#7659f5;border:0;border-radius:10px;padding:12px 17px;cursor:pointer}.orv-button:hover{background:#8971fa}.orv-badge{display:inline-flex;width:max-content;padding:5px 9px;border-radius:999px;background:#30274e;border:1px solid #51417f;color:#cfc5ff;font-size:12px}a{color:#b5a5ff}input,textarea{font:inherit;padding:10px;border-radius:8px;border:1px solid #48435a;background:#191724;color:inherit}hr{width:100%;border:0;border-top:1px solid #3b374c}img{height:auto}footer{margin-top:48px;padding-top:16px;border-top:1px solid #302d40;color:#918da4;font-size:12px}@media(max-width:560px){main{padding:22px}.orv-row{align-items:stretch}.orv-row>*{max-width:100%}}
</style></head><body><main>${markup}<footer>Built with Orvexa Studio · static website snapshot. UI event handlers and runtime logic are not included in this export yet.</footer></main></body></html>`;
  const readme = `${project.name || 'Orvexa Project'} — static website export\n\nOpen index.html in a modern browser or upload this folder to a static host.\nThis export captures the first page as standalone HTML/CSS. Orvexa state, click handlers, and program logic are not bundled in this version.\n\nSource files are included in the companion source project ZIP from Studio > Export.\n`;
  return new Blob([zipSync({ 'index.html': zipText(html), 'README.txt': zipText(readme) })], { type: 'application/zip' });
}
