# Orvexa Studio — MASTER PLAN & AUDIT (v10.0 production upgrade)

> **THIS IS THE ONLY MARKDOWN FILE IN THE REPOSITORY.**
> Planning, audit, roadmap, status and shipping notes all live here.
> Continuous work-in-progress state is mirrored in [`PROGRESS.txt`](./PROGRESS.txt)
> (plain text, so the sole-markdown invariant never breaks).
>
> **Baseline:** v9.0.0, commit `13bb1b3` (checkpoint before this upgrade).
> **Target:** v10.0.0 — polished, secure, accessible, offline-capable and
> production-ready, without breaking any existing v9 feature.

---

## PART 0 — Executive summary (audit + what v10 changes)

The v9 product is genuinely large (≈24,500 lines of JS/CSS/HTML, 223 tests,
24 games, 18 web templates, 24 UI blocks, 20 AI tools, a CPU path tracer,
WebGL scene engine, mesh editor and a playable open world). The foundation is
strong. The audit found that the **product surface is far ahead of its
production engineering**:

| Area | Audit finding | v10 response |
|---|---|---|
| Baseline tests | **221/223 pass, 2 fail.** Both failures are caused by a stray root `README.md` that violates the test-enforced “PLAN.md is the only markdown file” invariant. | Delete the 2-line redundant README (its content was only `# Orevxa`); both tests go green. |
| Version truth | Topbar says **v6.0**, Home hero says **v8.0**, Launchpad says **v7.0**, footer/package say **v9.0**. `package-lock.json` still says **2.8.0**. | One version source (`package.json` 10.0.0 + shared constant), all UI labels aligned, lockfile regenerated. |
| Duplicate artefacts | Nested `Orvexa-Studio-Latest.zip` (515 KB) is a byte-different copy of the same source tree, referenced by nothing at runtime. | Remove from Git (recoverable from history); generate one final distributable ZIP from `scripts/package.mjs` at release time. |
| Real bugs | `insertUiBlockIntoCurrentFile()` and the Auto-Fix handler index `project.files` with the **function reference** `currentFile` instead of calling `currentFile()`, creating a garbage file key and silently failing. | Fixed and covered by tests. |
| Fake / placeholder UI | Disabled “Stop” button with “on the roadmap” tooltip; 13 blocking `prompt()` / `confirm()` browser dialogs (including rename, delete and menus). | Remove the fake Stop control; replace every prompt with accessible in-app dialogs and real menus. |
| Architecture | `src/main.js` is a 1,972-line god module; settings, commands, dialogs and project health do not exist as concepts. | Extract testable core (`storage`, `preferences`, `shortcuts`, `search`, `errors`, `a11y`, `pwa`) and UI primitives (`dialog`, `menu`, `command palette`, `settings`). |
| Command palette | `Ctrl+Shift+P` only; substring filter; no arrow keys, no focus trap, no recents, no files, no `Ctrl+K`. | Palette 2.0: fuzzy ranking, sections, file quick-open, recents, full keyboard model, ARIA combobox, focus trap. |
| Project awareness | No project-wide search, no project health/audit, no file tabs. | Fuzzy project search (`Ctrl+Shift+F`), health score/issue report, multi-file editor tabs with dirty state. |
| Accessibility | Focus-visible exists, but dialogs have no traps/restore, tabs lack roles, toast is visual only, no skip link, preference for reduced motion not user-controllable. | Dialog primitive (focus trap, Esc, restore), tablist/tab roles, live-region announcer, skip link, high-contrast mode, user motion/contrast/font controls. |
| Settings | Theme only (dark/light). No persistence layer, no density, accent, editor font, wrap, autosave, data controls. | Versioned preference store + full Settings dialog + live application + export/reset data. |
| Offline / installability | UI claims “OFFLINE READY” but there is no manifest or service worker. | Real PWA: manifest, PNG icons, versioned service worker, offline shell, install button, update flow. |
| Performance | Production build is a raw copy: 1.7 MB, **no minification, no hashing, no compression, no SRI, no code splitting**. The 111 KB Aetherfall engine loads on every Studio boot even if World is never opened. | esbuild production pipeline (bundle, minify, hash, split, sourcemaps), lazy-loaded World/path-tracer/export modules, SRI, gzip/ETag dev server, cache policy. |
| Security | AI API key persisted in `localStorage` by default; no CSP meta on static pages; no SRI; `autoFix` bug; key re-rendered into DOM value. | Session-only key by default with explicit “remember” opt-in, CSP meta + hardened Netlify headers, SRI, URL validation, secret never logged. |
| Reliability | No global error boundary: a boot exception leaves a blank page. No storage-quota UX. | `installGlobalErrorHandlers`, safe boot fallback with recover/download actions, storage usage dashboard, quota-aware save messaging. |
| Testing gaps | 223 tests, all module-level; zero tests for storage/preferences/shortcuts/search/health/tabs/PWA/build output; no CI. | 237 tests including a jsdom boot test of the real shell, module-graph integrity, production-build assertions, a live HTTP verifier and GitHub Actions CI. |

### Priority order used (P0 → P3)

1. **P0 — correctness & safety:** failing tests, real bugs, fake Stop, version
   truth, destructive prompts, error boundary, key storage.
2. **P1 — production pipeline:** bundling/minification/hashing, SRI,
   compression, cache headers, CSP, CI, smoke verification, PWA.
3. **P2 — architecture & UX:** core modules, dialogs/menus, tabs, command
   palette 2.0, project search, settings, health dashboard.
4. **P3 — polish:** design tokens, density/accent/font controls, motion,
   responsive refinements, empty states, docs, keyboard help.

### Explicit non-goals / honest limitations

- **Interruptible execution / Stop:** the Orvexa interpreter is synchronous in
  the main thread. A real Stop requires moving execution to a Worker with a
  message protocol; that is a large, risky rewrite and is documented as future
  work instead of shipping a fake disabled button.
- **Client-side API keys:** any browser-stored hosted-provider key is exposed
  to same-origin scripts and physical device access. v10 defaults to
  session-only storage and documents that production secret handling belongs
  behind a server proxy. No backend is added to this static product.
- **Native APK:** unchanged: Studio generates an Android project + GitHub
  Actions workflow; it cannot compile an APK in-browser.
- **Unreal/Blender parity:** the custom WebGL renderer and CPU path tracer are
  intentionally lightweight; docs stay honest about this.

---

## PART A — Baseline inventory (v9, verified)

| Module | Lines | Verified role |
|---|---:|---|
| `src/studio/templates.js` | 3,198 | 24 games, 18 web apps, 12 prefabs, 8 moods, 24 blocks, themes, remix |
| `src/main.js` | 1,972 | Studio shell, editor, preview, scene workbench, home, launchpad, AI tab |
| `src/studio/aiAgent.js` | 1,655 | 9 providers, 20 tools, session memory, critic, scaffold, error doctor |
| `src/studio/materialGraph.js` | 1,355 | 18 presets, node compilation to PBR |
| `src/studio/meshEdit.js` | 1,249 | Catmull-Clark, lathe, geodesic, fracture, UVs |
| `src/modeler.js` + `modeler.html` | 1,124 + 209 | standalone mesh editor route |
| `src/studio/terrainLab.js` | 991 | erosion, 8 biomes, rivers, splat bake |
| `src/studio/sequencer.js` | 940 | timeline, curves, 8 presets, SVG |
| `src/studio/audioSynth.js` | 856 | 16 WAV presets, FX chain, spatial audio |
| `src/styles.css` | 754 | Studio design system |
| `src/studio/aetherfall-game.js` | 699 | playable open world (invariants: exactly 2× `windDeform`) |
| remaining 25 modules | ~5,400 | engine, scene, VFX, exports, language, quests, lessons, zip |
| tests | 223 | Node test runner, all green after README removal |

### Invariants that must never break

1. `scene3dCapabilities.renderer === 'WebGL 1'`.
2. `formatsImported` exactly `['OBJ', 'GLB', 'glTF embedded', 'ASCII FBX']`.
3. `aetherfall-game.js` contains exactly 2× `vec3 windDeform(vec3 p, vec3 color)`.
4. Every Modeler `$('#id')` exists once in `modeler.html`.
5. `PLAN.md` is the only `.md` file in the repo (and in the release ZIP).
6. `scripts/serve.mjs` sets no restrictive CSP / referrer policy that would
   break the sandboxed live preview.
7. All existing content counts stay: 24 games / 18 web / 24 blocks / 12 prefabs
   / 8 moods / 20 AI tools / 8 sequencer presets / 8 terrains / 18 materials.

---

## PART B — v10 roadmap and implementation status

### V10-1 · Repo hygiene, truth and bug fixes — `P0`
- [x] Delete root `README.md` (redundant; broke 2 tests).
- [x] Remove nested duplicate source ZIP from Git; keep one generated release ZIP.
- [x] Version 10.0.0 everywhere + regenerate lockfile.
- [x] Fix `currentFile` indexing bugs (UI block insert + Auto-Fix).
- [x] Remove fake disabled Stop button and its dead binding.
- [x] `.editorconfig`, `.nvmrc`, `.gitattributes` for stable line endings.
- [x] `PROGRESS.txt` continuity file (non-markdown).
- **Acceptance:** `npm test` fully green; `rg "README.md"` only historical.

### V10-2 · Core architecture modules — `P1/P2`
New pure, injectable, test-covered modules:

- [x] `src/core/storage.js` — safe local/session storage, JSON schema reads,
  namespace usage accounting, quota-aware writes, data export/import.
- [x] `src/core/preferences.js` — versioned preferences, validation, accent/
  theme/density/motion/contrast/editor options, CSS-variable projection.
- [x] `src/core/shortcuts.js` — normalisation, platform labels, registry,
  conflict detection, context-aware matching, human-readable help.
- [x] `src/core/search.js` — deterministic fuzzy scoring, subsequence
  highlighting, ranked command/file search.
- [x] `src/core/a11y.js` — focusable discovery, focus trap, restore, live
  announcer, reduced-motion query, skip-link helper.
- [x] `src/core/errors.js` — error classification, beginner-friendly
  description, global handlers, safe boot fallback, diagnostics log.
- [x] `src/core/pwa.js` — registration, update flow, install prompt, standalone
  detection, offline status events.
- [x] `src/studio/editorTabs.js` — bounded tab model, dirty tracking, cycle,
  close-neighbour semantics.
- [x] `src/studio/health.js` — project audit: structure, imports, syntax
  hazards, TODOs, size/duplication, accessibility hints, score/grade.
- [x] `src/studio/projectSearch.js` — whole-project literal search with
  per-file grouping, line/column, snippets and limits.
- **Acceptance:** every module has direct unit tests and no DOM dependency
  except the explicitly DOM-facing UI modules.

### V10-3 · Premium UI primitives & interaction — `P2`
- [x] `src/ui/dialog.js` — modal base with focus trap, Esc, backdrop, focus
  restore, ARIA, prompt/confirm replacements, destructive variant.
- [x] `src/ui/menu.js` — anchored menu with keyboard navigation, outside click,
  ARIA roles and destructive items.
- [x] `src/ui/commandPalette.js` — fuzzy commands + files + recents, sections,
  keyboard model, empty state, ARIA combobox.
- [x] `src/ui/settingsDialog.js` — appearance, editor, accessibility, AI
  privacy, storage/data, about; live apply, reset, export.
- [x] `src/ui/healthDialog.js` — score ring, metrics, grouped issues, filters.
- [x] `src/ui/shortcutsDialog.js` — generated from the shortcut registry.
- [x] Replace all blocking `prompt()` / `confirm()` use in Studio with dialogs
  and menus (file/folder create, rename, delete, project menu, editor menu,
  preview menu, import confirm, project name).
- [x] Multi-file editor tabs (open/close/activate/dirty indicator, max bound).
- [x] Project-wide search UI + open-at-line.
- [x] Keyboard shortcuts: `Ctrl/Cmd+K` palette, `Ctrl/Cmd+Shift+P` palette,
  `Ctrl/Cmd+,` settings, `F1` help, `Ctrl/Cmd+Shift+F` project search,
  `Ctrl/Cmd+Alt+Arrow` tab cycling.
- **Acceptance:** no blocking native prompts remain in `src/main.js`; every
  dialog is keyboard-operable and restores focus.

### V10-4 · Design system, responsiveness & accessibility — `P3`
- [x] Token layer for accent, spacing, radii, elevation, focus ring, control
  height; light/dark/system themes; high-contrast preset.
- [x] Density modes (compact / comfortable / spacious) and editor font scale.
- [x] User motion preference + `prefers-reduced-motion` respected globally.
- [x] Skip link, tablist roles, `aria-selected`, `aria-live` toasts and
  announcer, `aria-busy` run state, icon-button labels.
- [x] Mobile: 320 px → 4K breakpoints, 40 px+ touch targets, scrollable tabs,
  safe-area padding, mobile command bar.
- [x] Premium motion: staggered card entrance, hover lift, button press,
  shimmer skeletons, reduced-motion fallbacks.
- [x] Empty states for health/search/palette/settings storage.
- **Acceptance:** static a11y checks + manual keyboard pass documented; no
  layout overflow at 320 px in the three main routes.

### V10-5 · Production build & delivery — `P1`
- [x] esbuild pipeline: bundle/split, minify, content hashes, sourcemaps,
  target ES2022, reported gzip sizes.
- [x] Subresource Integrity on scripts/styles in generated HTML.
- [x] Lazy-loaded Aetherfall engine, path tracer and game exporters.
- [x] `scripts/serve.mjs`: gzip, ETag/304, HEAD, cache policy, PWA aliases,
  hardened non-preview-breaking headers, graceful shutdown.
- [x] `scripts/verify.mjs`: builds, boots the dist server on an ephemeral port,
  fetches every HTML route + hashed assets + manifest + service worker,
  asserts security/cache headers and absence of source paths.
- [x] `scripts/package.mjs`: one deterministic release ZIP built with the
  project's own ZIP writer, excludes dev artefacts, re-reads and CRC-verifies
  every entry, writes a `.sha256` sidecar.
- [x] GitHub Actions CI: install, test, build, verify on Node 22.
- [x] Netlify: immutable asset caching, no-cache HTML/SW, security headers
  (kept separate from the preview-safe dev server).
- **Acceptance:** built initial JS is minified and materially smaller than the
  raw sources; verifier passes; release ZIP reproducible.

### V10-6 · Reliability, privacy & data safety — `P1`
- [x] Global error boundary + `unhandledrejection` handling with toast and a
  recoverable boot screen (reload, safe mode, download project, reset session).
- [x] Quota-aware save feedback and storage usage meter.
- [x] Snapshot before destructive project replacement (template launch/import).
- [x] AI key: session-only by default, explicit remember opt-in, migration that
  strips legacy keys from `localStorage`, “forget key” action.
- [x] Static CSP meta, `X-Content-Type-Options`, permissions policy, COOP,
  no-referrer for external links, URL validation for links/images.
- **Acceptance:** no API key is written to `localStorage` unless remembered;
  errors never leave a blank page.

### V10-7 · Documentation & onboarding — `P3`
- [x] Update in-app Docs with v10 settings, shortcuts, privacy, PWA, health.
- [x] Welcome tour covers palette, settings and health; re-runnable.
- [x] `PROGRESS.txt` always lists completed/pending/next steps.
- [x] Release notes + limitations kept here (single markdown).
- **Acceptance:** a new user can reach a playable template, open settings, run
  project search and read shortcuts without external documentation.

### V10-8 · Final quality gate — `P0`
- [x] `node --check` every source file (also enforced by `npm run lint`).
- [x] `npm test` → **237/237 green** (baseline 223 + boot, import-graph and
  release suites).
- [x] `npm run build` → minified, hashed, SRI-pinned dist
  (≈1.33 MB raw / ≈455 kB gzipped; Studio first load ≈265 kB gzipped).
- [x] `npm run verify` → **78/78 checks** (static integrity + live HTTP smoke).
- [x] `npm run package` → one release ZIP, re-read and CRC-verified.
- [x] Invariants re-checked (WebGL 1, formats, 2× windDeform, modeler IDs,
  sole markdown, content counts, no restrictive dev-server CSP).

### V10-9 · Verification harness (added during the gate) — `P1`
- [x] `tests/boot.test.js` — boots the real `src/main.js` module graph in
  jsdom (WebGL/canvas/audio stubbed) and drives the shell: theme persistence,
  command palette, settings, shortcut/health dialogs, project search, editor
  tabs, explorer menu, program run and the error banner.
- [x] `tests/import-integrity.test.js` — every relative import resolves, every
  named import exists, no orphan modules, dynamic-import allowlist. This caught
  a real pre-existing Modeler crash (`parseOBJ`/`exportOBJ` imported from the
  wrong module), fixed in `src/modeler.js`.
- [x] `scripts/lint.mjs` — zero-dependency lint: syntax, `eval`/`new Function`
  bans, CSS balance, duplicate DOM ids, broken local links, CSP presence,
  stale version labels and lockfile/version drift.
- [x] Release archive is validated by re-reading it (`unzip()`), checking every
  entry length, required files and a content round-trip.

### V10-10 · Final release record
- Runtime: zero dependencies. Dev: `esbuild` (build) + `jsdom` (boot test).
- `npm run check` = lint → tests → build → verify. `npm run release` also
  produces `release/orvexa-studio-10.0.0.zip` + `.sha256`.
- Deployable artifact: `dist/` (static, SRI, service worker, Netlify headers).
- Known limits unchanged: synchronous interpreter (no true Stop), browser-held
  AI keys are not fully secret, no in-browser APK compilation, Modeler is a
  separate route with its own compact design tokens.
- [ ] `PROGRESS.txt` + this file updated with final numbers.
- [ ] Commit + push to `arena/5a01eb14-orevxa`.

---

## PART C — Design-system rules (apply to every future change)

1. **One primary action per screen**; everything else is secondary/quiet.
2. **Never ship a fake control.** If it cannot work, remove it or label the
   limitation in Docs — no disabled “coming soon” buttons.
3. **Every destructive action** requires confirmation with the exact object
   name and offers a snapshot/undo path.
4. **Keyboard first:** every pointer action has a keyboard equivalent; focus is
   always visible and restored after dialogs.
5. **Motion is optional:** all animation collapses under reduced motion.
6. **No dead ends:** empty states always explain the next action.
7. **Honest status:** version, build mode, offline state, provider and save
   state are visible and truthful.
8. **Local-first privacy:** no telemetry, no analytics, no silent network calls;
   hosted AI only after explicit user action/configuration.
9. **Budgets:** initial gzip JS target < 400 KB; each new dependency must
   justify itself; zero runtime dependencies remains the default.
10. **Tests before claims:** a feature is “done” only when its unit test, build
    and verification pass.

---

## PART D — Shipping checklist (every release)

- [ ] `git ls-files "*.md"` → only `PLAN.md`.
- [ ] `npm test` → 0 failures.
- [ ] `npm run build` → success, hashed assets, SRI present.
- [ ] `npm run verify` → all routes 200, headers correct, no raw `src/` in
  built HTML.
- [ ] `npm run package` → one ZIP, only `PLAN.md` markdown inside.
- [ ] Invariants from Part A.
- [ ] Version bump in `package.json`, `package-lock.json`, UI labels and this
  file.
- [ ] `PROGRESS.txt` accurate.
- [ ] Commit + push to the Arena branch.

---

## PART E — Continuation protocol

If context/time runs out mid-task:

1. Read `PROGRESS.txt` → it contains the current phase, completed items,
   pending items and the exact next command/file.
2. Read the relevant unchecked item in Part B above.
3. Run `npm test` first to confirm the checkpoint is green.
4. Continue from the first unchecked acceptance item; update both files after
   each phase.

**One line:** v10 does not chase line count — it turns an already impressive
creative studio into a trustworthy product: correct, fast, accessible,
offline-capable, secure-by-default and verifiable.
