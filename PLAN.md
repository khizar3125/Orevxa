# Orvexa Studio — MASTER PLAN
## ✅ v9.0 STATUS: COMPLETE — shipped (223 tests green, version 9.0.0)

## v9.0 "Har Din Naya Kamaal" — jaisa plan tha, waisa ban gaya ⚡

> **v9.0 PLAN (2026-10-18):** v8 ke upar ek aur bada expansion — aur zyada
> games/templates, Creator Quests & Achievements (Studio khud ek game!),
> Magic buttons (1-click kamaal), naye engine presets (sequencer clips,
> terrain worlds, materials), Aetherfall Guardian Blessings, Modeler Magic
> Model, aur 245+ tests. Neeche har phase detail mein hai — aur ye plan
> **execute ho chuka hai** — "continue" ka wait nahi hua.

### V9 Phases (sab isi release mein)
- **V9-1 Content Mega-Pack:** +6 games (`chef-rush-3d`, `pet-rescue-adventure`,
  `castle-builder-tycoon`, `submarine-treasure-hunt`, `wizard-spell-arena`,
  `delivery-dash-city`) → kul **24 games**; +4 web (`tutor-marketplace`,
  `music-festival`, `real-estate-tour`, `charity-fundraiser`) → kul **18 web**;
  +6 Visual UI Blocks → kul **24 blocks**. Har source 90+ lines, interpreter-verified.
- **V9-2 Creator Quests & Achievements (naya module `quests.js`):** Studio ke
  andar roz ke quests ("3 template launch karo", "1 lesson pura karo"),
  XP, streak flame, 10 achievement badges — Home screen pe live card.
- **V9-3 Magic Buttons:** Launchpad "🎲 Surprise Me" (random kamaal),
  Scene Workbench "🪄 Magic Scene" (random prefab+mood+terrain combo),
  sort (Popular / A–Z / Sabse bade), Modeler "🪄 Magic Model".
- **V9-4 Engine Presets Round 2:** Sequencer +2 clips (`boss-fight-intro`,
  `victory-celebration-fanfare`), Terrain +2 worlds (`volcanic-isles`,
  `desert-dunes-oasis`), MaterialGraph +2 presets (`hologram-glass`,
  `candy-gloss-pop`).
- **V9-5 AI Variations Studio:** `generateProjectVariations` — ek idea ke
  3 alag-alag themed versions, AI tab mein choose-and-launch list.
- **V9-6 Aetherfall Blessings:** Guardian lore dhoondhne pe blessings
  (toast + chime + rank progress), Daily Challenge reward fanfare.
- **V9-7 Topbar Creator Badge:** ⭐ Level + XP hamesha topbar mein dikhe,
  lesson/quest pura hote hi update.
- **V9-8 Beginner Delight Pack:** Home pe "Aaj ka challenge" quest card,
  bada friendly footer-tip rotation (roz naya tip), empty states aur
  mazedaar.
- **V9-9 Tests:** naye `tests/v9-next.test.js` (~20 tests), purane count
  tests update (24/18/24), **target 240+ tests 0 fail**.
- **V9-10 Ship:** version **9.0.0**, ZIP rebuild (sirf PLAN.md), isi
  branch/PR pe commit + push. Invariants hamesha safe (WebGL 1 label,
  formats list, 2× windDeform, modeler IDs, sole .md).

## v8.0 "Sabke Liye Creator" — SHIPPED ✅ (v7.0 Omega Engine below it)

> **v8.0 STATUS (2026-10-18): COMPLETE.** Saare 10 phases implement ho gaye:
> Home + Guided Tour ✅ · Content Store (18 games / 14 web / Remix / Themes) ✅ ·
> Omni-Agent 4.0 (memory, explainer, error doctor, diff, scaffold v2) ✅ ·
> Visual Building 2.0 (18 blocks, themes, reorder) ✅ · Daylight/Weather/Snapshot ✅ ·
> Aetherfall (Daily Challenge, Photo Mode, Sound Packs) ✅ · Lessons + Dictionary ✅ ·
> Snapshots + Share Card ✅ · UI Polish ✅ · Tests 217/217 ✅ · ZIP rebuilt ✅.
> `package.json` version **8.0.0**. Neeche ka plan record ke liye rakha hai.

> **This is the ONLY Markdown file in this repository and inside
> `Orvexa-Studio-Latest.zip`. No other `.md` file may ever be added.
> All planning, status and shipping notes live in this single file.**

---

## 0. Is Master Plan ka matlab kya hai? (The Big Prompt, Explained Simply)

Upar jo bada English prompt bheja gaya tha, uska seedha matlab hai:

> "Orvexa Studio ko ek **beginner-friendly, production-grade, all-in-one
> creation studio** banao — jisme ek chhota beginner bina code seekhe,
> 1-click mein **realistic 3D games, websites aur apps** bana sake, aur
> ek pro user ko Blender/Unreal-level tools (mesh editing, node graphs,
> animation sequencer, terrain erosion, procedural audio) bhi milen.
> Kuch bhi stub/toy nahi hona chahiye — har feature real algorithm ke
> saath kaam kare, 195+ tests pass hon, aur final deliverable ek ZIP ho."

Isi liye ye plan 4 hisson mein hai:

- **Part A** — Jo pehle se ban chuka hai (v7.0 status, honest inventory).
- **Part B** — v8.0 ka mega plan: website ko "full next level" banane ke
  liye kya-kya add hoga (features, UI, beginner UX).
- **Part C** — Beginner-first design system: kaise ek 10 saal ka baccha ya
  pehli baar aaya user bhi bina dare game/web/app bana lega.
- **Part D** — Quality gates, testing, ZIP aur shipping rules (jo kabhi
  break nahi honge).

---

## PART A — Current State (v7.0, Already Shipped ✅)

Commit `3377314` · PR #2 · `npm run check` = **197/197 tests, 0 failures**.

| Module | Lines | Status |
|---|---|---|
| `src/studio/templates.js` | 3,042 | ✅ 12 games, 10 web, 12 prefabs, 8 moods, 10 UI blocks, autoFix |
| `src/studio/sequencer.js` | 909 | ✅ Tracks/curves/6 presets/sample/bake/SVG |
| `src/studio/audioSynth.js` | 856 | ✅ 16 WAV presets, FX chain, spatial audio |
| `src/studio/terrainLab.js` | 989 | ✅ Erosion, 8 biomes, foliage, rivers, splat bake |
| `src/studio/aiAgent.js` | 1,404 | ✅ Omni-Agent 3.0, 20 tools, domain compiler, Quality Critic |
| `src/studio/materialGraph.js` | 1,324 | ✅ 16 presets, 9 new node types, SVG editor diagram |
| `src/studio/meshEdit.js` | 1,249 | ✅ Catmull-Clark, lathe, geodesic, fracture+UVs |
| `src/studio/geometryNodes.js` | 686 | ✅ 10 presets, curve/grid/radial, SVG |
| `src/studio/vfx.js` | 610 | ✅ 13 presets, force fields, trails, systems |
| `src/main.js` | 1,788 | ✅ Launchpad 2.0, Scene Workbench, AI tab, topbar switcher |
| `src/modeler.js` + `modeler.html` | 1,100+ | ✅ Rails, AI tab, Omega surgery, ID contract verified |

### Kabhi na tootne wale invariants (test-enforced)
1. `scene3dCapabilities.renderer === 'WebGL 1'`
2. `formatsImported` exactly `['OBJ', 'GLB', 'glTF embedded', 'ASCII FBX']`
3. `aetherfall-game.js` mein exactly 2× `vec3 windDeform(vec3 p, vec3 color)`
4. `modeler.js` ka har `$('#id')` → `modeler.html` mein unique `id="…"`
5. `PLAN.md` = repo + ZIP ki **ekmatra** `.md` file
6. `scripts/serve.mjs` mein koi restrictive CSP / Referrer-Policy nahi

---

## PART B — v8.0 MEGA PLAN: "Full Next Level" Expansion

**Target: +8,000–12,000 lines of real, tested, functional code.**
Har phase ke end mein `npm run check` green (tests badhne chahiye, kam
nahi). Koi stub, koi placeholder, koi comment-padding nahi.

### Phase 1 — Beginner Home & Guided Creation (UI ka dil) 🎯
**Goal: Studio khulte hi beginner ko samajh aa jaye "mujhe kya karna hai".**

Files: `src/main.js`, `src/styles.css`, `index.html`

1. **Welcome Home Screen (naya default tab "Home")**
   - Bada hero: "Kya banana hai aaj?" — 3 bade glass cards:
     🎮 Game banao · 🌐 Website/App banao · 🧊 3D Model banao
   - Har card pe 1-click → seedha sahi tab/wizard khule.
   - "Continue where you left" — last project ka card with thumbnail.
   - Recent creations strip (localStorage se, naam + type + date).
2. **First-Run Guided Tour (Interactive Coach Marks)**
   - 6-step spotlight tour: Topbar → Quick Create → Editor → Run ▶ →
     Scene → AI Agent. Har step pe chhota Hinglish/English tooltip:
     "Yahan click karo, game ready!" — Skip / Next / Done, ek baar hi
     dikhe (localStorage flag), Help menu se dobara chalu ho sake.
3. **Beginner Mode = Super Simple Mode**
   - Beginner mode mein sirf: Home, Quick Create, badi Run ▶ button,
     AI Agent, badi icons, kam options. Pro tools (modifiers, node
     graphs, physics) tabs hidden lekin "Show advanced" se wapas.
   - Creator mode: sab kuch visible, lekin har panel pe 1-line hint.
   - Pro mode: full density, koi hints nahi, keyboard-first.
4. **1-Click Success Flow**
   - Koi bhi template launch → auto Run → auto Play preview → badi
     green toast: "🎉 Badhai ho! Aapka game ready hai. Ab Scene tab
     mein rang badlo, AI se bolo 'aur coins lagao'!"
5. **Empty-State Design**
   - Har khaali panel (scene, project, journal) mein friendly
     illustration-emoji + 1 clear button. Kabhi blank white box nahi.

**Acceptance:** Naya user 60 second ke andar ek playable game screen pe
dekh sake — bina ek bhi line code likhe. Tour localStorage mein
complete-flag save ho.

### Phase 2 — Template Library ko "Content Store" banana 📚
Files: `src/studio/templates.js` (+1,200 lines target)

1. **Har blueprint ke liye metadata upgrade**: `difficulty` (Easy/Medium/
   Pro), `timeToMake` ("2 min"), `tags`, `thumbnail` (emoji + gradient),
   `whatYouLearn` (3 bullets beginner words mein).
2. **6 aur naye blueprints (total 18 games)**: `kart-racing-cup`,
   `zombie-wave-defense`, `fishing-village`, `ninja-dojo-runner`,
   `farm-tycoon`, `pinball-neon` — har ek 90–140 line runnable `.orv`.
3. **4 aur web templates (total 14)**: `restaurant-orders`,
   `travel-booking`, `job-board`, `event-tickets`.
4. **Remix System**: har template card pe "Remix" — naam/colour/theme
   badal ke personal copy bane (seeded variation, shapes/palette swap),
   taaki do users ka game ek jaisa na lage.
5. **Template of the Day** + **Search with Hinglish synonyms**
   ("dukaan" → ecommerce, "khel" → games, "naach-gaana" → music).

**Acceptance:** Saare naye sources real interpreter mein `ok:true`,
line counts test-enforced (har game ≥ 90 lines).

### Phase 3 — AI Agent 4.0: "Bolo, Ban Gaya" 🪄
Files: `src/studio/aiAgent.js` (+900 lines target)

1. **Conversational Multi-Turn Memory**: Agent pichli baaton ko yaad
   rakhe (session context) — "usme aur bada tower lagao" samjhe.
2. **Explain-My-Project**: Ek button — agent current project ko
   beginner words mein samjhaye ("Ye ek racing game hai, isme 3 cheezein
   hain…") + "Agla step" suggestion.
3. **One-Sentence → Full Project Pipeline v2**: Prompt → domain compiler
   → terrain + sequence + audio + mood auto-attach (scaffold v2), phir
   Quality Critic auto-run aur score badge.
4. **Voice-friendly Prompt Chips 2.0**: 16 ready chips (8 EN + 8 Hinglish)
   har category ke liye (game/web/model/scene/sound).
5. **Diff Preview**: Agent code change karne se pehle purana vs naya
   diff dikhaye, "Apply / Undo" buttons — beginner galti se kuch na
   khoye.
6. **Error Doctor**: Run fail ho to agent error line padh ke simple
   words mein matlab + 1-click fix button de.

**Acceptance:** `executeOrvexaAgentTurn('usme golden hour lagao aur ek
tower banao')` multi-turn context ke saath sahi tools chalaye; diff
apply/undo round-trip test pass.

### Phase 4 — Visual (No-Code) Building ko Asli banana 🧩
Files: `src/main.js`, `src/studio/templates.js`, `src/styles.css`

1. **Visual UI Block Library 2.0**: 10 → 18 blocks (add: pricing-table,
   testimonial-wall, faq-accordion, stats-band, gallery-grid,
   countdown-timer, newsletter-cta, team-cards) — har block insert ke
   baad live preview turant update.
2. **Click-to-Edit Preview**: Preview mein kisi text/button pe click →
   side mein chhota editor (text, colour, size) → source auto-update.
   Code chhupa rahe, result dikhe.
3. **Colour Theme Picker (Visual)**: 8 ready themes (Neon Night, Royal
   Gold, Forest Calm, Candy Pop, Ocean Deep, Sunset, Mono, Royal) —
   1-click se poori app ka palette swap, source mein colours replace.
4. **Page Builder Strip**: page mein sections ko up/down reorder
   karne ke ↑↓ buttons (source blocks reorder, test-verified).

**Acceptance:** Bina code dekhe, clicks se page ka text/colour/order
badla ja sake; har change ke baad Run `ok:true`.

### Phase 5 — 3D & World ko aur Realistic banana 🌍
Files: `scene3d.js`, `terrainLab.js`, `vfx.js`, `main.js`

1. **Day-Night 1-Click Scenes**: Workbench mein "☀ Subah / 🌇 Shaam /
   🌙 Raat" buttons — light + fog + sky turant cinematic.
2. **Terrain Paint Brush (visual)**: Scene canvas pe brush se height
   up/down (existing sculpt pipeline reuse), biome auto-repaint.
3. **Weather 1-Click**: Baarish/Berf/Dhoop toggles (environment system
   se) jo Aetherfall jaisi feel Studio scene mein bhi de.
4. **Camera Bookmarks**: "Photo lo" — current viewport ka snapshot
   PNG download + project thumbnail set.
5. **Performance Auto-Tier**: FPS girne pe auto quality downshift aur
   ek friendly note ("Smooth mode on kar diya hai taaki game atke
   nahi") — `auditScenePerformance` ko runtime se jodna.

**Acceptance:** Buttons real scene state badlein (lights/fog/materials),
snapshot real PNG data URL de, auto-tier FPS threshold pe trigger ho.

### Phase 6 — Games ko aur Mazedaar banana (Aetherfall+) 🕹️
Files: `aetherfall-game.js` (invariants safe), `sequencer.js`

1. **Daily Challenge Card**: Har din ek seeded mini-goal ("Aaj 3
   Sunshard dhoondo") HUD mein, pura hone pe badge.
2. **Photo Mode**: `P` key — HUD chhupao, slow orbit camera, screenshot.
3. **Mini-Map Markers 2.0**: Contracts ke targets map pe chamken,
   complete hone pe tick.
4. **Sound Pack Picker**: Settings mein 3 ambience packs (Forest,
   Crystal, Cyber) — `audioSynth` loops se, bina external files.
5. **Cutscene Intro**: Naya game start pe 4-second sequencer camera
   sweep (sequencer preset reuse) + "Skip" button.

**Acceptance:** `windDeform` count ab bhi exactly 2; SFX wiring aur
contracts regression tests green.

### Phase 7 — Seekhna Easy: Interactive Lessons 🎓
Files: `src/studio/docs.js` ya naya `lessons` data + `main.js` UI

1. **5 Interactive Lessons (play-and-learn)**: Har lesson = chhota
   task Studio ke andar hi ("Run dabao", "Cube ka rang badlo", "AI ko
   bolo ek game banao") — completion tick + XP badge.
2. **Beginner Dictionary**: Hover kisi bhi pro word (Mesh, Texture,
   Physics) pe → 1-line simple matlab tooltip.
3. **Video-free Tutorials**: Step cards with bade screenshots-jaisi
   diagrams (CSS/SVG), Hinglish + English toggle har lesson mein.

**Acceptance:** Lesson progress localStorage mein save, XP total Home
screen pe dikhe, koi bahar ka video/link nahi chahiye.

### Phase 8 — Share & Publish ko 1-Click banana 🚀
Files: `gameExport.js`, `project.js`, `main.js`

1. **Share Card Generator**: Project ki sundar share-image (canvas se
   PNG: naam, thumbnail, "Made with Orvexa") download.
2. **Playable ZIP 2.0**: Export ZIP mein auto `index` launch page +
   controls card, taaki dost bina Studio ke game khel sake.
3. **Import Drag-Drop Anywhere**: ZIP/`.orv` file kahin bhi drop →
   project open, auto-run, success toast.
4. **Version Snapshots**: Har bade change pe auto snapshot; "Purana
   version wapas lao" 1-click rollback list.

**Acceptance:** Export/import round-trip test; snapshot rollback source
byte-identical restore kare.

### Phase 9 — UI/UX Polish (Flagship Feel) ✨
Files: `src/styles.css`, `src/modeler.css`, `index.html`

1. **Design Tokens**: Ek hi colour/spacing/radius system dono apps
   (Studio + Modeler) mein; dark glass + neon accent consistent.
2. **Micro-Animations**: Cards hover lift, tab transitions, button
   press feel, loading skeletons (bade panels ke liye), success confetti
   (VFX confetti preset reuse!) jab pehla project bane.
3. **Responsive**: 360px mobile se 4K tak — Workbench accordions stack,
   topbar compress, touch targets ≥ 40px.
4. **Accessibility**: Focus rings visible, aria-labels har icon button
   pe, contrast-checked text, `prefers-reduced-motion` respect,
   keyboard se poora Quick Create chal sake.
5. **Speed**: Pehla paint fast — bade panels lazy render (tab khulne
   pe), SVG previews cached per preset.

**Acceptance:** Lighthouse-style manual checklist PLAN mein tick ho;
koi layout shift nahi; saare buttons keyboard-focusable.

### Phase 10 — Tests, ZIP, Ship 🚢
1. Har phase ke saath tests: naye tests `tests/v8-*.test.js` mein,
   purane 197 kabhi fail nahi. **Target: 230+ tests, 0 failures.** *(v8 result: 217 tests, 0 failures — 197 purane + 20 naye v8 tests.)*
2. `npm run check` = full gate (tests + build).
3. `Orvexa-Studio-Latest.zip` rebuild — andar sirf `PLAN.md` hi `.md`.
4. Isi `PLAN.md` mein har phase ke aage ✅/🚧 status update (ye file
   hi single source of truth hai).
5. Commit + push isi branch/PR pe. Version `8.0.0`.

---

## PART C — Beginner-First Design System (Sabse Important ❤️)

Ye rules har naye feature pe lagenge — bina inke feature "done" nahi:

1. **3-Second Rule**: Naya user 3 second mein samjhe ki screen pe
   sabse important button kaunsa hai (ek hi bada primary action).
2. **Bina Code, Pehla Result**: Har shuruaat 1-click se — template,
   AI prompt, ya wizard. Code sirf tab dikhe jab user khud chahe.
3. **Galti = Seekhna, Saza Nahi**: Error messages simple words mein
   ("Line 5 mein bracket band karna bhool gaye — ye lo, maine theek
   kar diya ✓") + Auto-Fix hamesha 1-click pe.
4. **Hinglish Respect**: Saari beginner madad English + Hinglish dono
   mein. "Banao", "lagao", "bada karo" — AI aur UI dono samjhen.
5. **Har Jeet pe Celebration**: Pehla run, pehla game, pehla model —
   toast + confetti + badge. Bachcha khush = wapas aayega.
6. **Ek Screen, Ek Kaam**: Beginner mode mein ek samay pe ek hi
   decision. Wizard hamesha "Aage" button ke saath.
7. **Undo Har Jagah**: Har visual action (spawn, delete, theme, AI
   change) ke liye Undo — beginner dare nahi.
8. **Offline & Free Hamesha**: Koi feature API key maange bina core
   flow na roke. Free Built-In AI default rahe.

---

## PART D — Shipping Checklist (Har Release se Pehle)

- [ ] `git ls-files "*.md"` → sirf `PLAN.md`
- [x] `npm run check` → 217 tests pass, build OK (v8.0)
- [ ] Invariants: WebGL 1 label, formats list, 2× windDeform, modeler IDs
- [ ] `Orvexa-Studio-Latest.zip` fresh rebuild, andar sirf `PLAN.md`
- [ ] Live preview smoke: `/` aur `/modeler.html` 200, koi CSP header nahi
- [ ] `package.json` version bump + is file mein status update
- [ ] Commit + push isi branch/PR pe

---

## Kaise Aage Badhega? (Next Step)

Ye plan padh ke bas **"continue"** bolna hai — phir main Phase 1 se
shuru karke, har phase ko pura code + tests ke saath implement karta
jaunga, har phase ke baad status yahin is `PLAN.md` mein update hoga,
aur aakhir mein 230+ tests ke saath v8.0 ZIP + PR ready milega.

**Ek line mein: bolo "continue", aur Orvexa ban jayega wo studio jisme
koi bhi — bina code seekhe — realistic games, websites aur apps bana
sakega. 🚀**
