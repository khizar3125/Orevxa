/**
 * Orvexa Studio v10 — Omega Templates: full production game blueprints,
 * full-stack web/app templates, multi-part kitbash prefabs, photoreal moods,
 * no-code UI blocks and a comprehensive deterministic Auto-Fix engine.
 * Every blueprint source below is a complete, runnable Orvexa (.orv/.realm)
 * program with state, HUD cards, lighting rigs, physics and animations.
 */

export const EXPERIENCE_MODES = Object.freeze([
  { id: 'beginner', label: 'Beginner Mode', name: 'Beginner', shortLabel: '🌱 Beginner Mode', description: 'Guided 3-click wizard, 1-click templates, prefabs, moods and sounds. No code required.', icon: '🌱', disclosure: 'guided' },
  { id: 'creator', label: 'Creator Mode', name: 'Creator', shortLabel: '🎨 Creator Mode', description: 'Templates plus visual editors for scenes, materials, models, sequencers and UI blocks.', icon: '🎨', disclosure: 'visual' },
  { id: 'pro', label: 'Pro Engine Mode', name: 'Pro', shortLabel: '🚀 Pro Engine Mode', description: 'Full code, Nanite LOD, node graphs, erosion lab, IK, path tracing and export pipelines.', icon: '🚀', disclosure: 'full' },
]);

export const GAME_BLUEPRINTS = Object.freeze([
  {
    id: "aetherfall-rpg",
    name: "Aetherfall RPG",
    title: "Aetherfall RPG",
    genre: "Open-world RPG",
    description: "Explore Aetherfall, speak to Guardians, read Lore Waystones, recover Sunshards and restore Firstlight Spire.",
    difficulty: "beginner",
    playable: true,
    controls: ["WASD move", "E Resonance Pulse / interact", "R Sunblade", "F Phase Dash", "B World Builder", "J Journal"],
    accent: "#56e0e8",
    objectCount: 23,
    source: `app "Aetherfall RPG"

state sunshards = 0
state shrinesAwakened = 0
state stalkerDefeats = 0
state wayfarerRank = 1

scene "Aetherfall RPG Scene" {
    camera(position: vec3(0, 2.6, 9))
    light(position: vec3(3, 6, 4), color: "#fff2dc")
    light(position: vec3(-4, 3, -2), color: "#8fb8ff")
    plane("Ground", position: vec3(0, -1.1, 0), size: 18, color: "#26304a")
    cube("Windmere Gatehouse", position: vec3(-3.82, 0, -0.2), size: 0.7, color: "#7c5cff")
    cube("Elderpine Marker", position: vec3(-1.36, 0, -0.5), size: 0.9, color: "#48e5e5")
    sphere("Sunshard Alpha", position: vec3(-0.3, 0.4, -0.5), radius: 0.42, color: "#ffb86b")
    torus("Firstlight Ring", position: vec3(2.16, 0.4, -0.2), size: 0.6, color: "#62b26f")
    cylinder("Waystone of Dawn", position: vec3(3.22, 0, -0.5), size: 1.3, color: "#ff6b9d")
    cube("Guardian Shrine Lyra", position: vec3(-3.12, 0, -2.7), size: 0.7, color: "#eab96d")
    sphere("Sunshard Beta", position: vec3(-2.06, 0.4, -2.4), radius: 0.35, color: "#9fdcff")
    cylinder("Waystone of Tides", position: vec3(0.4, 0, -2.7), size: 1.1, color: "#f28b5e")
    cube("Kael Warden Post", position: vec3(1.46, 0, -2.7), size: 0.6, color: "#8b79ff")
    sphere("Moonwater Orb", position: vec3(3.92, 0.4, -2.4), radius: 0.35, color: "#52d6c7")
    torus("Resonance Totem", position: vec3(-3.82, 0.4, -4.9), size: 0.7, color: "#7c5cff")
    cube("Sunspire Base", position: vec3(-1.36, 0, -4.9), size: 0.9, color: "#48e5e5")
    sphere("Sunshard Gamma", position: vec3(-0.3, 0.4, -4.6), radius: 0.35, color: "#ffb86b")
    cylinder("Waystone of Embers", position: vec3(2.16, 0, -4.9), size: 0.6, color: "#62b26f")
    cube("Highland Ruin", position: vec3(3.22, 0, -4.9), size: 1.3, color: "#ff6b9d")
    sphere("Elderpine Heart", position: vec3(-3.12, 0.4, -6.8), radius: 0.35, color: "#eab96d")
    torus("Beacon Halo", position: vec3(-2.06, 0.4, -7.1), size: 0.9, color: "#9fdcff")
    cube("Fallen Colonnade", position: vec3(0.4, 0, -7.1), size: 1.1, color: "#f28b5e")
    sphere("Sunshard Delta", position: vec3(1.46, 0.4, -6.8), radius: 0.35, color: "#8b79ff")
    cylinder("Skywatch Pillar", position: vec3(3.92, 0, -7.1), size: 1.3, color: "#52d6c7")
    rigidbody("Moonwater Orb", mass: 1, restitution: 0.45, friction: 0.35)
    controller("Moonwater Orb", speed: 3.2, jumpSpeed: 5)
    material("Firstlight Ring", metallic: 0.4, roughness: 0.25, emissive: 0.4)
    material("Sunspire Base", metallic: 0.2, roughness: 0.5, emissive: 0.05)
    animate("Firstlight Ring", rotation: vec3(0, 1, 0), speed: 0.8)
    animate("Beacon Halo", rotation: vec3(0, 1, 0), speed: 0.8)
}

page "Home" {
    column(gap: 14) {
        badge("AETHERFALL CHRONICLES")
        title("Aetherfall RPG", size: 32)
        paragraph("An open-world realm of four settlements, guardian shrines and a dying sun. Recover the Sunshards and relight Firstlight Spire.")
        row(gap: 10) {
            badge("Open World")
            badge("Guardians")
            badge("Sunshards")
            badge("Quests")
        }
        card(padding: 18) {
            title("Sunshards recovered", size: 20)
            text("Each shard relights one tier of Firstlight Spire. Find all four.")
            button("Collect shard: " + sunshards) {
                sunshards = sunshards + 1
                print("Sunshards recovered", sunshards)
            }
        }
        card(padding: 18) {
            title("Shrines awakened", size: 20)
            text("Resonance Pulse near a guardian shrine awakens its lore.")
            button("Awaken shrine: " + shrinesAwakened) {
                shrinesAwakened = shrinesAwakened + 1
                print("Shrines awakened", shrinesAwakened)
            }
        }
        card(padding: 18) {
            title("Shadow Stalkers defeated", size: 20)
            text("Sunblade Combat (R) scatters the stalkers of the veil.")
            button("Defeat stalker: " + stalkerDefeats) {
                stalkerDefeats = stalkerDefeats + 1
                print("Shadow Stalkers defeated", stalkerDefeats)
            }
        }
        card(padding: 18) {
            title("How to play", size: 20)
            text("WASD / arrows — move through the realm")
            text("E — Resonance Pulse and interact with Guardians")
            text("R — Sunblade Combat · F — Phase Dash")
            text("B — Live World Builder · J — Wayfarer Journal")
        }
    }
}

print("Aetherfall RPG ready — open Scene or World and press Play.")
`,
    world: true,
    realmSource: `⟦ REALM: AETHERFALL ⟧
☼ SKY: copper-dawn
▧ LAND: highlands | span 280 | detail 160 | seed 7412
⌖ ENTRY: 0, 0, 14
✧ SCATTER: elderpine × 240 | radius 128 | seed 704
✧ SCATTER: sunshard × 18 | radius 108 | seed 802
✧ SCATTER: crystal × 46 | radius 118 | seed 915
⌂ SETTLEMENT: windmere | at -48, 0, 18 | houses 8
⌂ SETTLEMENT: emberhold | at 52, 0, -30 | houses 6
⌂ SETTLEMENT: moonfen-port | at -30, 0, -58 | houses 7
⌂ SETTLEMENT: skywatch | at 34, 0, 44 | houses 5
≋ WATERS: moonwater | at -32, -1.9, 34 | radius 25
≋ WATERS: embermere | at 58, -1.7, 8 | radius 16
✦ BEACON: firstlight | at 18, 0, -64 | unlock 7
✦ SHRINE: dawn | at -18, 0, 26 | guardian Elder Lyra
✦ SHRINE: tides | at -38, 0, 44 | guardian Warden Kael
✦ SHRINE: embers | at 48, 0, -18 | guardian Forge-Mother Senn
✦ SHRINE: sky | at 26, 0, 38 | guardian Oracle Venn
⚙ RULES: explore, collect, sprint, jump, interact, sunblade, phasedash, builder
⚙ BIOMES: highlands, evergreen, goldenwood, moonfen, emberfall, alpine
✎ LORE: When the First Sun broke, its shards seeded the highlands. Wayfarers walk the copper dawn to gather them, awaken the guardian shrines, and relight Firstlight Spire before the veil-things finish eating the light.`,
  },
  {
    id: "cyber-overdrive",
    name: "Cyber Overdrive",
    title: "Cyber Overdrive",
    genre: "Neon arcade racer",
    description: "A neon city sprint: dodge traffic pylons, hit boost rings and chase the overdrive high score.",
    difficulty: "beginner",
    playable: true,
    controls: ["WASD / arrows steer", "Shift nitro boost"],
    accent: "#48e5e5",
    objectCount: 23,
    source: `app "Cyber Overdrive"

state speed = 0
state laps = 0
state score = 0
state nitro = 100

scene "Cyber Overdrive Scene" {
    camera(position: vec3(0, 2.6, 9))
    light(position: vec3(0, 7, 2), color: "#bfefff")
    light(position: vec3(-5, 4, -6), color: "#ff6b9d")
    plane("Ground", position: vec3(0, -1.1, 0), size: 18, color: "#141830")
    cube("Neon Tower 01", position: vec3(-3.82, 0, -0.2), size: 0.7, color: "#48e5e5")
    cube("Neon Tower 02", position: vec3(-1.36, 0, -0.5), size: 0.9, color: "#ff6b9d")
    cube("Neon Tower 03", position: vec3(-0.3, 0, -0.5), size: 1.1, color: "#8b79ff")
    cube("Neon Tower 04", position: vec3(2.16, 0, -0.2), size: 0.6, color: "#232a44")
    cylinder("Boost Pylon A", position: vec3(3.22, 0, -0.5), size: 1.3, color: "#48e5e5")
    torus("Overdrive Arch 1", position: vec3(-3.12, 0.4, -2.7), size: 0.7, color: "#ff6b9d")
    cube("Neon Tower 05", position: vec3(-2.06, 0, -2.4), size: 0.9, color: "#8b79ff")
    cube("Neon Tower 06", position: vec3(0.4, 0, -2.7), size: 1.1, color: "#232a44")
    sphere("Nitro Cell", position: vec3(1.46, 0.4, -2.7), radius: 0.42, color: "#48e5e5")
    torus("Overdrive Arch 2", position: vec3(3.92, 0.4, -2.4), size: 1.3, color: "#ff6b9d")
    cube("Neon Tower 07", position: vec3(-3.82, 0, -4.9), size: 0.7, color: "#8b79ff")
    cube("Neon Tower 08", position: vec3(-1.36, 0, -4.9), size: 0.9, color: "#232a44")
    cylinder("Boost Pylon B", position: vec3(-0.3, 0, -4.6), size: 1.1, color: "#48e5e5")
    torus("Overdrive Arch 3", position: vec3(2.16, 0.4, -4.9), size: 0.6, color: "#ff6b9d")
    cube("Neon Tower 09", position: vec3(3.22, 0, -4.9), size: 1.3, color: "#8b79ff")
    cube("Neon Tower 10", position: vec3(-3.12, 0, -6.8), size: 0.7, color: "#232a44")
    sphere("Checkpoint Orb", position: vec3(-2.06, 0.4, -7.1), radius: 0.5, color: "#48e5e5")
    cube("Neon Tower 11", position: vec3(0.4, 0, -7.1), size: 1.1, color: "#ff6b9d")
    cube("Neon Tower 12", position: vec3(1.46, 0, -6.8), size: 0.6, color: "#8b79ff")
    torus("Finish Arch", position: vec3(3.92, 0.4, -7.1), size: 1.3, color: "#232a44")
    rigidbody("Nitro Cell", mass: 1, restitution: 0.45, friction: 0.35)
    controller("Nitro Cell", speed: 6.5, jumpSpeed: 4)
    material("Overdrive Arch 1", metallic: 0.6, roughness: 0.2, emissive: 0.9)
    material("Finish Arch", metallic: 0.6, roughness: 0.2, emissive: 0.9)
    animate("Overdrive Arch 1", rotation: vec3(0, 1, 0), speed: 0.8)
    animate("Overdrive Arch 2", rotation: vec3(0, 1, 0), speed: 0.8)
    animate("Finish Arch", rotation: vec3(0, 1, 0), speed: 0.8)
}

page "Home" {
    column(gap: 14) {
        badge("NEON GP · SECTOR 7")
        title("Cyber Overdrive", size: 32)
        paragraph("Twelve neon towers line the midnight highway. Thread the arches, burn nitro, and set the Sector 7 lap record.")
        row(gap: 10) {
            badge("Nitro")
            badge("Laps")
            badge("High Score")
        }
        card(padding: 18) {
            title("Speed (km/h)", size: 20)
            text("Nitro telemetry from the chase camera rig.")
            button("Accelerate: " + speed) {
                speed = speed + 12
                print("Speed (km/h)", speed)
            }
        }
        card(padding: 18) {
            title("Laps completed", size: 20)
            text("Three clean arches complete a Sector 7 lap.")
            button("Complete lap: " + laps) {
                laps = laps + 1
                print("Laps completed", laps)
            }
        }
        card(padding: 18) {
            title("Overdrive score", size: 20)
            text("Boost rings multiply your score chain.")
            button("Score points: " + score) {
                score = score + 250
                print("Overdrive score", score)
            }
        }
        card(padding: 18) {
            title("How to play", size: 20)
            text("WASD / arrows — steer the racer")
            text("Shift — burn nitro for overdrive speed")
            text("Hit every arch to keep the score chain alive")
        }
    }
}

print("Cyber Overdrive ready — open Scene or World and press Play.")
`,
  },
  {
    id: "survival-island",
    name: "Survival Island",
    title: "Survival Island",
    genre: "Survival crafting",
    description: "Wash up on a procedurally scattered island, gather supplies, build a campfire sanctuary and survive the night.",
    difficulty: "creator",
    playable: true,
    controls: ["WASD move", "E gather / interact"],
    accent: "#62b26f",
    objectCount: 21,
    source: `app "Survival Island"

state health = 100
state hunger = 80
state wood = 0
state stone = 0

scene "Survival Island Scene" {
    camera(position: vec3(0, 2.6, 9))
    light(position: vec3(4, 6, 2), color: "#fff0c0")
    light(position: vec3(-3, 2, -4), color: "#ffd9a0")
    plane("Ground", position: vec3(0, -1.1, 0), size: 18, color: "#2e4a3a")
    cylinder("Palm Grove Trunk", position: vec3(-3.82, 0, -0.2), size: 0.7, color: "#62b26f")
    sphere("Coconut Cache", position: vec3(-1.36, 0.4, -0.5), radius: 0.5, color: "#8a6b46")
    cube("Crafting Station", position: vec3(-0.3, 0, -0.5), size: 1.1, color: "#6a737d")
    torus("Campfire Stone Ring", position: vec3(2.16, 0.4, -0.2), size: 0.6, color: "#ffb86b")
    sphere("Campfire Ember", position: vec3(3.22, 0.4, -0.5), radius: 0.5, color: "#62b26f")
    cube("Driftwood Pile", position: vec3(-3.12, 0, -2.7), size: 0.7, color: "#8a6b46")
    cube("Basalt Boulder", position: vec3(-2.06, 0, -2.4), size: 0.9, color: "#6a737d")
    sphere("Freshwater Spring", position: vec3(0.4, 0.4, -2.7), radius: 0.5, color: "#ffb86b")
    cube("Shelter Frame", position: vec3(1.46, 0, -2.7), size: 0.6, color: "#62b26f")
    cylinder("Palm Shade", position: vec3(3.92, 0, -2.4), size: 1.3, color: "#8a6b46")
    sphere("Berry Bush Orb", position: vec3(-3.82, 0.4, -4.9), radius: 0.5, color: "#6a737d")
    cube("Signal Fire Base", position: vec3(-1.36, 0, -4.9), size: 0.9, color: "#ffb86b")
    torus("Fishing Ring", position: vec3(-0.3, 0.4, -4.6), size: 1.1, color: "#62b26f")
    cube("Bamboo Rack", position: vec3(2.16, 0, -4.9), size: 0.6, color: "#8a6b46")
    sphere("Rain Collector", position: vec3(3.22, 0.4, -4.9), radius: 0.42, color: "#6a737d")
    cube("Stone Tool Bench", position: vec3(-3.12, 0, -6.8), size: 0.7, color: "#ffb86b")
    cylinder("Watch Palm", position: vec3(-2.06, 0, -7.1), size: 0.9, color: "#62b26f")
    sphere("Tide Pool Gem", position: vec3(0.4, 0.4, -7.1), radius: 0.42, color: "#8a6b46")
    rigidbody("Coconut Cache", mass: 1, restitution: 0.45, friction: 0.35)
    controller("Coconut Cache", speed: 3, jumpSpeed: 5)
    material("Campfire Ember", metallic: 0, roughness: 0.4, emissive: 1.2)
    animate("Fishing Ring", rotation: vec3(0, 1, 0), speed: 0.8)
}

page "Home" {
    column(gap: 14) {
        badge("CASTAWAY PROTOCOL")
        title("Survival Island", size: 32)
        paragraph("One island, one campfire, one long night. Gather wood and stone, craft a shelter, and keep the fire alive until dawn.")
        row(gap: 10) {
            badge("Crafting")
            badge("Day / Night")
            badge("Resources")
        }
        card(padding: 18) {
            title("Wood gathered", size: 20)
            text("Palm groves and driftwood feed the campfire.")
            button("Gather wood: " + wood) {
                wood = wood + 3
                print("Wood gathered", wood)
            }
        }
        card(padding: 18) {
            title("Stone gathered", size: 20)
            text("Basalt boulders craft stronger shelter walls.")
            button("Gather stone: " + stone) {
                stone = stone + 2
                print("Stone gathered", stone)
            }
        }
        card(padding: 18) {
            title("Meals cooked", size: 20)
            text("Cook at the campfire to restore hunger.")
            button("Cook meal: " + hunger) {
                hunger = hunger + 10
                print("Meals cooked", hunger)
            }
        }
        card(padding: 18) {
            title("How to play", size: 20)
            text("WASD — explore the island")
            text("E — gather, craft and cook at stations")
            text("Keep hunger above zero to protect health")
        }
    }
}

print("Survival Island ready — open Scene or World and press Play.")
`,
  },
  {
    id: "castle-siege",
    name: "Castle Siege",
    title: "Castle Siege",
    genre: "Strategy defence",
    description: "Raise a fortress, load five catapult boulders, and smash the 16-block destructible wall before the keep falls.",
    difficulty: "creator",
    playable: true,
    controls: ["WASD move", "E interact / fire"],
    accent: "#c9a35f",
    objectCount: 27,
    source: `app "Castle Siege"

state wallBlocks = 16
state bouldersFired = 0
state keepHealth = 100
state honor = 0

scene "Castle Siege Scene" {
    camera(position: vec3(0, 2.6, 9))
    light(position: vec3(5, 7, 3), color: "#ffe8c0")
    light(position: vec3(-4, 4, -3), color: "#c0d4ff")
    plane("Ground", position: vec3(0, -1.1, 0), size: 18, color: "#3a3630")
    cube("Wall Block 01", position: vec3(-3.82, 0, -0.2), size: 0.7, color: "#8d8578")
    cube("Wall Block 02", position: vec3(-1.36, 0, -0.5), size: 0.9, color: "#c9a35f")
    cube("Wall Block 03", position: vec3(-0.3, 0, -0.5), size: 1.1, color: "#5a6068")
    cube("Wall Block 04", position: vec3(2.16, 0, -0.2), size: 0.6, color: "#8d8578")
    cube("Wall Block 05", position: vec3(3.22, 0, -0.5), size: 1.3, color: "#c9a35f")
    cube("Wall Block 06", position: vec3(-3.12, 0, -2.7), size: 0.7, color: "#5a6068")
    cube("Wall Block 07", position: vec3(-2.06, 0, -2.4), size: 0.9, color: "#8d8578")
    cube("Wall Block 08", position: vec3(0.4, 0, -2.7), size: 1.1, color: "#c9a35f")
    cube("Wall Block 09", position: vec3(1.46, 0, -2.7), size: 0.6, color: "#5a6068")
    cube("Wall Block 10", position: vec3(3.92, 0, -2.4), size: 1.3, color: "#8d8578")
    cube("Wall Block 11", position: vec3(-3.82, 0, -4.9), size: 0.7, color: "#c9a35f")
    cube("Wall Block 12", position: vec3(-1.36, 0, -4.9), size: 0.9, color: "#5a6068")
    cube("Wall Block 13", position: vec3(-0.3, 0, -4.6), size: 1.1, color: "#8d8578")
    cube("Wall Block 14", position: vec3(2.16, 0, -4.9), size: 0.6, color: "#c9a35f")
    cube("Wall Block 15", position: vec3(3.22, 0, -4.9), size: 1.3, color: "#5a6068")
    cube("Wall Block 16", position: vec3(-3.12, 0, -6.8), size: 0.7, color: "#8d8578")
    cylinder("Keep Tower West", position: vec3(-2.06, 0, -7.1), size: 0.9, color: "#c9a35f")
    cylinder("Keep Tower East", position: vec3(0.4, 0, -7.1), size: 1.1, color: "#5a6068")
    sphere("Catapult Boulder 1", position: vec3(1.46, 0.4, -6.8), radius: 0.35, color: "#8d8578")
    sphere("Catapult Boulder 2", position: vec3(3.92, 0.4, -7.1), radius: 0.5, color: "#c9a35f")
    sphere("Catapult Boulder 3", position: vec3(-3.82, 0.4, -9.3), radius: 0.42, color: "#5a6068")
    sphere("Catapult Boulder 4", position: vec3(-1.36, 0.4, -9.0), radius: 0.35, color: "#8d8578")
    sphere("Catapult Boulder 5", position: vec3(-0.3, 0.4, -9.3), radius: 0.5, color: "#c9a35f")
    torus("Siege Honor Ring", position: vec3(2.16, 0.4, -9.3), size: 0.6, color: "#5a6068")
    rigidbody("Catapult Boulder 1", mass: 1, restitution: 0.45, friction: 0.35)
    rigidbody("Catapult Boulder 2", mass: 1, restitution: 0.45, friction: 0.35)
    rigidbody("Catapult Boulder 3", mass: 1, restitution: 0.45, friction: 0.35)
    controller("Catapult Boulder 1", speed: 4, jumpSpeed: 6)
    material("Keep Tower West", metallic: 0.2, roughness: 0.6, emissive: 0)
    animate("Siege Honor Ring", rotation: vec3(0, 1, 0), speed: 0.8)
}

page "Home" {
    column(gap: 14) {
        badge("SIEGE PROTOCOL")
        title("Castle Siege", size: 32)
        paragraph("A sixteen-block destructible fortress wall, twin keep towers and five rigid-body catapult boulders. Breach it or defend it.")
        row(gap: 10) {
            badge("Destruction")
            badge("Catapults")
            badge("Fortress")
        }
        card(padding: 18) {
            title("Boulders fired", size: 20)
            text("Every catapult shot physics-tests the wall.")
            button("Fire boulder: " + bouldersFired) {
                bouldersFired = bouldersFired + 1
                print("Boulders fired", bouldersFired)
            }
        }
        card(padding: 18) {
            title("Wall blocks standing", size: 20)
            text("Voronoi-destructible blocks — breach them all.")
            button("Breach block: " + wallBlocks) {
                wallBlocks = wallBlocks + -1
                print("Wall blocks standing", wallBlocks)
            }
        }
        card(padding: 18) {
            title("Honor earned", size: 20)
            text("Clean breaches earn siege honor.")
            button("Earn honor: " + honor) {
                honor = honor + 25
                print("Honor earned", honor)
            }
        }
        card(padding: 18) {
            title("How to play", size: 20)
            text("WASD — move the siege engineer")
            text("E — load and fire the catapult")
            text("Destroy all 16 wall blocks to win")
        }
    }
}

print("Castle Siege ready — open Scene or World and press Play.")
`,
  },
  {
    id: "space-station",
    name: "Space Station",
    title: "Space Station",
    genre: "Sci-fi exploration",
    description: "Dock with a modular orbital station in 1.62 m/s² gravity, restore the reactor and keep oxygen flowing.",
    difficulty: "pro",
    playable: true,
    controls: ["WASD move", "Space low-g jump"],
    accent: "#8b79ff",
    objectCount: 21,
    source: `app "Space Station"

state oxygen = 100
state power = 42
state dockedModules = 3
state science = 0

scene "Space Station Scene" {
    camera(position: vec3(0, 2.6, 9))
    light(position: vec3(0, 6, 6), color: "#dfeaff")
    light(position: vec3(6, 2, -4), color: "#8b79ff")
    plane("Ground", position: vec3(0, -1.1, 0), size: 18, color: "#1b2138")
    torus("Centrifuge Ring", position: vec3(-3.82, 0.4, -0.2), size: 0.7, color: "#8b79ff")
    cylinder("Reactor Core", position: vec3(-1.36, 0, -0.5), size: 0.9, color: "#dfeaff")
    cube("Solar Array West", position: vec3(-0.3, 0, -0.5), size: 1.1, color: "#48e5e5")
    cube("Solar Array East", position: vec3(2.16, 0, -0.2), size: 0.6, color: "#ffb86b")
    sphere("Oxygen Tank Alpha", position: vec3(3.22, 0.4, -0.5), radius: 0.5, color: "#8b79ff")
    sphere("Oxygen Tank Beta", position: vec3(-3.12, 0.4, -2.7), radius: 0.42, color: "#dfeaff")
    cube("Docking Clamp", position: vec3(-2.06, 0, -2.4), size: 0.9, color: "#48e5e5")
    cube("Hydroponics Bay", position: vec3(0.4, 0, -2.7), size: 1.1, color: "#ffb86b")
    cylinder("Comms Mast", position: vec3(1.46, 0, -2.7), size: 0.6, color: "#8b79ff")
    sphere("Science Sample", position: vec3(3.92, 0.4, -2.4), radius: 0.35, color: "#dfeaff")
    cube("Airlock Frame", position: vec3(-3.82, 0, -4.9), size: 0.7, color: "#48e5e5")
    torus("Docking Ring", position: vec3(-1.36, 0.4, -4.9), size: 0.9, color: "#ffb86b")
    cube("Battery Bank", position: vec3(-0.3, 0, -4.6), size: 1.1, color: "#8b79ff")
    sphere("Coolant Orb", position: vec3(2.16, 0.4, -4.9), radius: 0.5, color: "#dfeaff")
    cube("Crew Habitat", position: vec3(3.22, 0, -4.9), size: 1.3, color: "#48e5e5")
    cylinder("Antenna Spire", position: vec3(-3.12, 0, -6.8), size: 0.7, color: "#ffb86b")
    sphere("Navigation Beacon", position: vec3(-2.06, 0.4, -7.1), radius: 0.5, color: "#8b79ff")
    cube("Cargo Crate Stack", position: vec3(0.4, 0, -7.1), size: 1.1, color: "#dfeaff")
    rigidbody("Science Sample", mass: 1, restitution: 0.45, friction: 0.35)
    controller("Science Sample", speed: 2.2, jumpSpeed: 2.5)
    material("Reactor Core", metallic: 0.5, roughness: 0.25, emissive: 0.8)
    material("Centrifuge Ring", metallic: 0.7, roughness: 0.3, emissive: 0.1)
    animate("Centrifuge Ring", rotation: vec3(0, 1, 0), speed: 0.8)
    animate("Docking Ring", rotation: vec3(0, 1, 0), speed: 0.8)
}

page "Home" {
    column(gap: 14) {
        badge("ORBITAL STATION KEPLER-9")
        title("Space Station", size: 32)
        paragraph("Low gravity, a spinning centrifuge ring and a reactor that will not wait. Restore power before oxygen runs dry.")
        row(gap: 10) {
            badge("Zero-G")
            badge("Reactor")
            badge("Oxygen")
        }
        card(padding: 18) {
            title("Reactor power %", size: 20)
            text("Solar arrays plus reactor core keep the lights on.")
            button("Restore power: " + power) {
                power = power + 10
                print("Reactor power %", power)
            }
        }
        card(padding: 18) {
            title("Science samples", size: 20)
            text("Zero-G experiments drift near the airlock.")
            button("Collect sample: " + science) {
                science = science + 1
                print("Science samples", science)
            }
        }
        card(padding: 18) {
            title("Modules docked", size: 20)
            text("Clamp new modules onto the docking ring.")
            button("Dock module: " + dockedModules) {
                dockedModules = dockedModules + 1
                print("Modules docked", dockedModules)
            }
        }
        card(padding: 18) {
            title("How to play", size: 20)
            text("WASD — drift through the station")
            text("Space — gentle low-gravity jump (1.62 m/s²)")
            text("Watch oxygen: refill at the green tanks")
        }
    }
}

print("Space Station ready — open Scene or World and press Play.")
`,
  },
  {
    id: "sky-parkour",
    name: "Sky Parkour",
    title: "Sky Parkour",
    genre: "Platformer",
    description: "Leap between 12 floating platforms, dodge rotating beams, hit bounce pads and beat the checkpoint timer.",
    difficulty: "pro",
    playable: true,
    controls: ["WASD move", "Space jump", "F Phase Dash"],
    accent: "#9fdcff",
    objectCount: 23,
    source: `app "Sky Parkour"

state checkpoints = 0
state bestTime = 0
state falls = 0
state crowns = 0

scene "Sky Parkour Scene" {
    camera(position: vec3(0, 2.6, 9))
    light(position: vec3(2, 8, 4), color: "#ffffff")
    light(position: vec3(-4, 5, -2), color: "#9fdcff")
    plane("Ground", position: vec3(0, -1.1, 0), size: 20, color: "#22355c")
    cube("Platform 01 Start", position: vec3(-3.82, 0, -0.2), size: 0.7, color: "#9fdcff")
    cube("Platform 02", position: vec3(-1.36, 0, -0.5), size: 0.9, color: "#ffffff")
    cube("Platform 03", position: vec3(-0.3, 0, -0.5), size: 1.1, color: "#ffb86b")
    cube("Bounce Pad Alpha", position: vec3(2.16, 0, -0.2), size: 0.6, color: "#ff6b9d")
    cube("Platform 04", position: vec3(3.22, 0, -0.5), size: 1.3, color: "#9fdcff")
    cube("Rotating Beam Base", position: vec3(-3.12, 0, -2.7), size: 0.7, color: "#ffffff")
    cube("Platform 05", position: vec3(-2.06, 0, -2.4), size: 0.9, color: "#ffb86b")
    cube("Platform 06", position: vec3(0.4, 0, -2.7), size: 1.1, color: "#ff6b9d")
    cube("Bounce Pad Beta", position: vec3(1.46, 0, -2.7), size: 0.6, color: "#9fdcff")
    cube("Platform 07", position: vec3(3.92, 0, -2.4), size: 1.3, color: "#ffffff")
    cube("Platform 08", position: vec3(-3.82, 0, -4.9), size: 0.7, color: "#ffb86b")
    cube("Rotating Beam Spire", position: vec3(-1.36, 0, -4.9), size: 0.9, color: "#ff6b9d")
    cube("Platform 09", position: vec3(-0.3, 0, -4.6), size: 1.1, color: "#9fdcff")
    cube("Platform 10", position: vec3(2.16, 0, -4.9), size: 0.6, color: "#ffffff")
    sphere("Checkpoint Orb 1", position: vec3(3.22, 0.4, -4.9), radius: 0.42, color: "#ffb86b")
    sphere("Checkpoint Orb 2", position: vec3(-3.12, 0.4, -6.8), radius: 0.35, color: "#ff6b9d")
    cube("Platform 11", position: vec3(-2.06, 0, -7.1), size: 0.9, color: "#9fdcff")
    cube("Platform 12 Summit", position: vec3(0.4, 0, -7.1), size: 1.1, color: "#ffffff")
    torus("Summit Crown Ring", position: vec3(1.46, 0.4, -6.8), size: 0.6, color: "#ffb86b")
    sphere("Golden Crown", position: vec3(3.92, 0.4, -7.1), radius: 0.5, color: "#ff6b9d")
    rigidbody("Golden Crown", mass: 1, restitution: 0.45, friction: 0.35)
    controller("Checkpoint Orb 1", speed: 4.5, jumpSpeed: 7)
    material("Bounce Pad Alpha", metallic: 0.2, roughness: 0.3, emissive: 0.6)
    animate("Summit Crown Ring", rotation: vec3(0, 1, 0), speed: 0.8)
}

page "Home" {
    column(gap: 14) {
        badge("SKY OBYY · SEASON 3")
        title("Sky Parkour", size: 32)
        paragraph("Twelve ascending platforms, rotating sweeper beams and spring bounce pads. Every checkpoint banks your time — falling restarts the climb.")
        row(gap: 10) {
            badge("Parkour")
            badge("Timer")
            badge("Checkpoints")
        }
        card(padding: 18) {
            title("Checkpoints banked", size: 20)
            text("Touch a glowing orb to lock your respawn.")
            button("Bank checkpoint: " + checkpoints) {
                checkpoints = checkpoints + 1
                print("Checkpoints banked", checkpoints)
            }
        }
        card(padding: 18) {
            title("Crowns collected", size: 20)
            text("Optional crowns hide beyond the beams.")
            button("Collect crown: " + crowns) {
                crowns = crowns + 1
                print("Crowns collected", crowns)
            }
        }
        card(padding: 18) {
            title("Runs completed", size: 20)
            text("Summit finishes record your best time.")
            button("Finish run: " + bestTime) {
                bestTime = bestTime + 1
                print("Runs completed", bestTime)
            }
        }
        card(padding: 18) {
            title("How to play", size: 20)
            text("WASD — run the platforms")
            text("Space — jump · F — Phase Dash gaps")
            text("Bounce pads launch you to higher tiers")
        }
    }
}

print("Sky Parkour ready — open Scene or World and press Play.")
`,
  },
  {
    id: "dungeon-crawler",
    name: "Dungeon Crawler",
    title: "Dungeon Crawler",
    genre: "Arcane dungeon crawler",
    description: "Torchlit corridors, a boss altar, treasure chests and potion caches — generate a floor and crawl it.",
    difficulty: "creator",
    playable: true,
    controls: ["WASD move", "E open / drink"],
    accent: "#b48cff",
    objectCount: 21,
    source: `app "Dungeon Crawler"

state health = 100
state mana = 60
state gold = 0
state bossHealth = 100

scene "Dungeon Crawler Scene" {
    camera(position: vec3(0, 2.6, 9))
    light(position: vec3(2, 4, 2), color: "#ffb86b")
    light(position: vec3(-3, 3, -3), color: "#b48cff")
    plane("Ground", position: vec3(0, -1.1, 0), size: 18, color: "#241f2e")
    cube("Torch Corridor Wall", position: vec3(-3.82, 0, -0.2), size: 0.7, color: "#5a5468")
    cylinder("Torch Pillar A", position: vec3(-1.36, 0, -0.5), size: 0.9, color: "#ffb86b")
    cylinder("Torch Pillar B", position: vec3(-0.3, 0, -0.5), size: 1.1, color: "#b48cff")
    cube("Treasure Chest 1", position: vec3(2.16, 0, -0.2), size: 0.6, color: "#eab96d")
    cube("Treasure Chest 2", position: vec3(3.22, 0, -0.5), size: 1.3, color: "#5a5468")
    sphere("Health Potion", position: vec3(-3.12, 0.4, -2.7), radius: 0.42, color: "#ffb86b")
    sphere("Mana Potion", position: vec3(-2.06, 0.4, -2.4), radius: 0.35, color: "#b48cff")
    cube("Boss Altar", position: vec3(0.4, 0, -2.7), size: 1.1, color: "#eab96d")
    torus("Warden Summoning Ring", position: vec3(1.46, 0.4, -2.7), size: 0.6, color: "#5a5468")
    cube("Collapsed Archway", position: vec3(3.92, 0, -2.4), size: 1.3, color: "#ffb86b")
    sphere("Soul Ember", position: vec3(-3.82, 0.4, -4.9), radius: 0.5, color: "#b48cff")
    cube("Iron Gate", position: vec3(-1.36, 0, -4.9), size: 0.9, color: "#eab96d")
    cylinder("Crypt Column", position: vec3(-0.3, 0, -4.6), size: 1.1, color: "#5a5468")
    cube("Skeleton Throne", position: vec3(2.16, 0, -4.9), size: 0.6, color: "#ffb86b")
    sphere("Arcane Rune Orb", position: vec3(3.22, 0.4, -4.9), radius: 0.42, color: "#b48cff")
    cube("Trap Plate", position: vec3(-3.12, 0, -6.8), size: 0.7, color: "#eab96d")
    torus("Portal Exit Ring", position: vec3(-2.06, 0.4, -7.1), size: 0.9, color: "#5a5468")
    cube("Ancient Sarcophagus", position: vec3(0.4, 0, -7.1), size: 1.1, color: "#ffb86b")
    rigidbody("Soul Ember", mass: 1, restitution: 0.45, friction: 0.35)
    controller("Soul Ember", speed: 3.4, jumpSpeed: 5)
    material("Warden Summoning Ring", metallic: 0.4, roughness: 0.3, emissive: 0.9)
    material("Boss Altar", metallic: 0.3, roughness: 0.4, emissive: 0.3)
    animate("Warden Summoning Ring", rotation: vec3(0, 1, 0), speed: 0.8)
    animate("Portal Exit Ring", rotation: vec3(0, 1, 0), speed: 0.8)
}

page "Home" {
    column(gap: 14) {
        badge("CRYPT OF EMBERS")
        title("Dungeon Crawler", size: 32)
        paragraph("Torchlit stone corridors hide treasure chests, mana potions and the Ember Warden boss altar. No two generated floors crawl alike.")
        row(gap: 10) {
            badge("Boss")
            badge("Loot")
            badge("Potions")
        }
        card(padding: 18) {
            title("Gold looted", size: 20)
            text("Chests respawn every generated floor.")
            button("Loot chest: " + gold) {
                gold = gold + 40
                print("Gold looted", gold)
            }
        }
        card(padding: 18) {
            title("Potions drunk", size: 20)
            text("Red restores health, blue restores mana.")
            button("Drink potion: " + mana) {
                mana = mana + 20
                print("Potions drunk", mana)
            }
        }
        card(padding: 18) {
            title("Boss damage dealt", size: 20)
            text("Burn the Ember Warden at its altar.")
            button("Strike boss: " + bossHealth) {
                bossHealth = bossHealth + -15
                print("Boss damage dealt", bossHealth)
            }
        }
        card(padding: 18) {
            title("How to play", size: 20)
            text("WASD — crawl the corridors")
            text("E — open chests, drink potions, fight")
            text("Reach the portal ring to descend")
        }
    }
}

print("Dungeon Crawler ready — open Scene or World and press Play.")
`,
  },
  {
    id: "mech-arena",
    name: "Mech Arena",
    title: "Mech Arena",
    genre: "Mech combat arena",
    description: "Pilot a rigged colossus mech: energy shields, plasma turrets and destructible cover pillars in a neon arena.",
    difficulty: "pro",
    playable: true,
    controls: ["WASD move", "R plasma volley"],
    accent: "#ff9f5e",
    objectCount: 21,
    source: `app "Mech Arena"

state armor = 100
state shield = 100
state heat = 0
state victories = 0

scene "Mech Arena Scene" {
    camera(position: vec3(0, 2.6, 9))
    light(position: vec3(6, 8, 0), color: "#ffe0c0")
    light(position: vec3(-6, 4, -4), color: "#48e5e5")
    plane("Ground", position: vec3(0, -1.1, 0), size: 20, color: "#2b2438")
    cube("Colossus Torso", position: vec3(-3.82, 0, -0.2), size: 0.7, color: "#ff9f5e")
    cylinder("Colossus Leg L", position: vec3(-1.36, 0, -0.5), size: 0.9, color: "#8d99ae")
    cylinder("Colossus Leg R", position: vec3(-0.3, 0, -0.5), size: 1.1, color: "#48e5e5")
    cube("Plasma Turret A", position: vec3(2.16, 0, -0.2), size: 0.6, color: "#eab96d")
    cube("Plasma Turret B", position: vec3(3.22, 0, -0.5), size: 1.3, color: "#ff9f5e")
    torus("Shield Generator Ring", position: vec3(-3.12, 0.4, -2.7), size: 0.7, color: "#8d99ae")
    cube("Cover Pillar 1", position: vec3(-2.06, 0, -2.4), size: 0.9, color: "#48e5e5")
    cube("Cover Pillar 2", position: vec3(0.4, 0, -2.7), size: 1.1, color: "#eab96d")
    cube("Cover Pillar 3", position: vec3(1.46, 0, -2.7), size: 0.6, color: "#ff9f5e")
    cube("Cover Pillar 4", position: vec3(3.92, 0, -2.4), size: 1.3, color: "#8d99ae")
    sphere("Energy Cell", position: vec3(-3.82, 0.4, -4.9), radius: 0.5, color: "#48e5e5")
    cube("Enemy Mech Torso", position: vec3(-1.36, 0, -4.9), size: 0.9, color: "#eab96d")
    cylinder("Enemy Leg L", position: vec3(-0.3, 0, -4.6), size: 1.1, color: "#ff9f5e")
    cylinder("Enemy Leg R", position: vec3(2.16, 0, -4.9), size: 0.6, color: "#8d99ae")
    sphere("Plasma Core", position: vec3(3.22, 0.4, -4.9), radius: 0.42, color: "#48e5e5")
    cube("Arena Gate", position: vec3(-3.12, 0, -6.8), size: 0.7, color: "#eab96d")
    torus("Victory Halo", position: vec3(-2.06, 0.4, -7.1), size: 0.9, color: "#ff9f5e")
    cube("Repair Bay", position: vec3(0.4, 0, -7.1), size: 1.1, color: "#8d99ae")
    rigidbody("Plasma Core", mass: 1, restitution: 0.45, friction: 0.35)
    controller("Energy Cell", speed: 3.8, jumpSpeed: 5)
    material("Shield Generator Ring", metallic: 0.6, roughness: 0.2, emissive: 0.8)
    material("Plasma Turret A", metallic: 0.7, roughness: 0.25, emissive: 0.5)
    animate("Shield Generator Ring", rotation: vec3(0, 1, 0), speed: 0.8)
    animate("Victory Halo", rotation: vec3(0, 1, 0), speed: 0.8)
}

page "Home" {
    column(gap: 14) {
        badge("TITAN PROTOCOL")
        title("Mech Arena", size: 32)
        paragraph("Two colossus mechs, plasma turrets and destructible cover pillars. Manage shield energy or get melted in the Titan Arena.")
        row(gap: 10) {
            badge("Mechs")
            badge("Shields")
            badge("Plasma")
        }
        card(padding: 18) {
            title("Plasma victories", size: 20)
            text("Drop the enemy core to win the round.")
            button("Win round: " + victories) {
                victories = victories + 1
                print("Plasma victories", victories)
            }
        }
        card(padding: 18) {
            title("Shield recharged", size: 20)
            text("Stand in the generator ring to recharge.")
            button("Recharge shield: " + shield) {
                shield = shield + 20
                print("Shield recharged", shield)
            }
        }
        card(padding: 18) {
            title("Energy cells", size: 20)
            text("Cells vent weapon heat when collected.")
            button("Vent heat: " + heat) {
                heat = heat + -25
                print("Energy cells", heat)
            }
        }
        card(padding: 18) {
            title("How to play", size: 20)
            text("WASD — stomp the arena")
            text("R — plasma volley (watch heat)")
            text("Use pillars as destructible cover")
        }
    }
}

print("Mech Arena ready — open Scene or World and press Play.")
`,
  },
  {
    id: "mars-colony",
    name: "Mars Colony",
    title: "Mars Colony",
    genre: "Colony builder simulation",
    description: "Terraform a red canyon: biodomes, rover fleet and a solar grid balancing O2, water and power.",
    difficulty: "creator",
    playable: true,
    controls: ["WASD move", "E build / repair"],
    accent: "#f28b5e",
    objectCount: 21,
    source: `app "Mars Colony"

state oxygen = 60
state water = 45
state power = 70
state colonists = 12

scene "Mars Colony Scene" {
    camera(position: vec3(0, 2.6, 9))
    light(position: vec3(5, 6, 3), color: "#ffd9b0")
    light(position: vec3(-4, 3, -2), color: "#f2a65e")
    plane("Ground", position: vec3(0, -1.1, 0), size: 20, color: "#5e3226")
    sphere("Biodome Alpha", position: vec3(-3.82, 0.4, -0.2), radius: 0.35, color: "#f28b5e")
    sphere("Biodome Beta", position: vec3(-1.36, 0.4, -0.5), radius: 0.5, color: "#dfeaff")
    cube("Solar Panel Array", position: vec3(-0.3, 0, -0.5), size: 1.1, color: "#eab96d")
    cylinder("Water Extractor", position: vec3(2.16, 0, -0.2), size: 0.6, color: "#9fdcff")
    cube("Rover Unit 1", position: vec3(3.22, 0, -0.5), size: 1.3, color: "#f28b5e")
    cube("Rover Unit 2", position: vec3(-3.12, 0, -2.7), size: 0.7, color: "#dfeaff")
    cube("Habitat Module", position: vec3(-2.06, 0, -2.4), size: 0.9, color: "#eab96d")
    cylinder("O2 Scrubber Tower", position: vec3(0.4, 0, -2.7), size: 1.1, color: "#9fdcff")
    sphere("Ice Deposit", position: vec3(1.46, 0.4, -2.7), radius: 0.42, color: "#f28b5e")
    cube("Greenhouse Frame", position: vec3(3.92, 0, -2.4), size: 1.3, color: "#dfeaff")
    torus("Landing Ring", position: vec3(-3.82, 0.4, -4.9), size: 0.7, color: "#eab96d")
    cube("Comms Dish Base", position: vec3(-1.36, 0, -4.9), size: 0.9, color: "#9fdcff")
    sphere("Regolith Sample", position: vec3(-0.3, 0.4, -4.6), radius: 0.35, color: "#f28b5e")
    cube("Battery Storage", position: vec3(2.16, 0, -4.9), size: 0.6, color: "#dfeaff")
    cylinder("Drill Rig", position: vec3(3.22, 0, -4.9), size: 1.3, color: "#eab96d")
    cube("Cargo Pod", position: vec3(-3.12, 0, -6.8), size: 0.7, color: "#9fdcff")
    sphere("Dust Sensor Orb", position: vec3(-2.06, 0.4, -7.1), radius: 0.5, color: "#f28b5e")
    cube("Med Bay Module", position: vec3(0.4, 0, -7.1), size: 1.1, color: "#dfeaff")
    rigidbody("Regolith Sample", mass: 1, restitution: 0.45, friction: 0.35)
    controller("Rover Unit 1", speed: 3.5, jumpSpeed: 4)
    material("Biodome Alpha", metallic: 0.1, roughness: 0.15, emissive: 0.2)
    material("Solar Panel Array", metallic: 0.8, roughness: 0.25, emissive: 0.1)
    animate("Landing Ring", rotation: vec3(0, 1, 0), speed: 0.8)
}

page "Home" {
    column(gap: 14) {
        badge("ARES TERRAFORMING")
        title("Mars Colony", size: 32)
        paragraph("Red canyon terrain, glass biodomes and a thirsty solar grid. Balance oxygen, water and power or the colony sleeps forever.")
        row(gap: 10) {
            badge("Terraform")
            badge("Resources")
            badge("Rovers")
        }
        card(padding: 18) {
            title("Oxygen produced", size: 20)
            text("Scrubber towers plus greenhouses feed the domes.")
            button("Produce O2: " + oxygen) {
                oxygen = oxygen + 8
                print("Oxygen produced", oxygen)
            }
        }
        card(padding: 18) {
            title("Water extracted", size: 20)
            text("Drill ice deposits before the tanks run dry.")
            button("Extract water: " + water) {
                water = water + 10
                print("Water extracted", water)
            }
        }
        card(padding: 18) {
            title("Colonists housed", size: 20)
            text("New habitat modules welcome more crew.")
            button("House colonist: " + colonists) {
                colonists = colonists + 4
                print("Colonists housed", colonists)
            }
        }
        card(padding: 18) {
            title("How to play", size: 20)
            text("WASD — drive the rover fleet")
            text("E — build and repair colony modules")
            text("Keep all three resources above zero")
        }
    }
}

print("Mars Colony ready — open Scene or World and press Play.")
`,
  },
  {
    id: "drift-city",
    name: "Drift City",
    title: "Drift City",
    genre: "Midnight drift racing",
    description: "Tokyo midnight drift: wet asphalt, neon billboards, overpass ramps and a drift-score multiplier HUD.",
    difficulty: "creator",
    playable: true,
    controls: ["WASD steer", "Shift handbrake drift"],
    accent: "#ff6b9d",
    objectCount: 21,
    source: `app "Drift City"

state driftScore = 0
state multiplier = 1
state speed = 0
state fans = 0

scene "Drift City Scene" {
    camera(position: vec3(0, 2.6, 9))
    light(position: vec3(0, 7, -3), color: "#ffd7ec")
    light(position: vec3(5, 4, 5), color: "#48e5e5")
    plane("Ground", position: vec3(0, -1.1, 0), size: 20, color: "#181824")
    cube("Neon Billboard A", position: vec3(-3.82, 0, -0.2), size: 0.7, color: "#ff6b9d")
    cube("Neon Billboard B", position: vec3(-1.36, 0, -0.5), size: 0.9, color: "#48e5e5")
    cube("Overpass Ramp", position: vec3(-0.3, 0, -0.5), size: 1.1, color: "#8b79ff")
    cube("Drift Gate 1", position: vec3(2.16, 0, -0.2), size: 0.6, color: "#23233a")
    torus("Drift Ring Alpha", position: vec3(3.22, 0.4, -0.5), size: 1.3, color: "#ff6b9d")
    cube("Rain Puddle Slab", position: vec3(-3.12, 0, -2.7), size: 0.7, color: "#48e5e5")
    cube("Neon Billboard C", position: vec3(-2.06, 0, -2.4), size: 0.9, color: "#8b79ff")
    cube("Streetlight Row", position: vec3(0.4, 0, -2.7), size: 1.1, color: "#23233a")
    sphere("Multiplier Orb", position: vec3(1.46, 0.4, -2.7), radius: 0.42, color: "#ff6b9d")
    torus("Drift Ring Beta", position: vec3(3.92, 0.4, -2.4), size: 1.3, color: "#48e5e5")
    cube("Overpass Pillar", position: vec3(-3.82, 0, -4.9), size: 0.7, color: "#8b79ff")
    cube("Rooftop Sign", position: vec3(-1.36, 0, -4.9), size: 0.9, color: "#23233a")
    cube("Drift Gate 2", position: vec3(-0.3, 0, -4.6), size: 1.1, color: "#ff6b9d")
    sphere("Fan Drone", position: vec3(2.16, 0.4, -4.9), radius: 0.5, color: "#48e5e5")
    cube("Tire Stack", position: vec3(3.22, 0, -4.9), size: 1.3, color: "#8b79ff")
    torus("Final Drift Ring", position: vec3(-3.12, 0.4, -6.8), size: 0.7, color: "#23233a")
    cube("Podium Block", position: vec3(-2.06, 0, -7.1), size: 0.9, color: "#ff6b9d")
    sphere("Champion Helmet", position: vec3(0.4, 0.4, -7.1), radius: 0.42, color: "#48e5e5")
    rigidbody("Multiplier Orb", mass: 1, restitution: 0.45, friction: 0.35)
    controller("Multiplier Orb", speed: 6, jumpSpeed: 4)
    material("Drift Ring Alpha", metallic: 0.6, roughness: 0.2, emissive: 0.9)
    material("Final Drift Ring", metallic: 0.6, roughness: 0.2, emissive: 1)
    animate("Drift Ring Alpha", rotation: vec3(0, 1, 0), speed: 0.8)
    animate("Drift Ring Beta", rotation: vec3(0, 1, 0), speed: 0.8)
    animate("Final Drift Ring", rotation: vec3(0, 1, 0), speed: 0.8)
}

page "Home" {
    column(gap: 14) {
        badge("MIDNIGHT DRIFT GP")
        title("Drift City", size: 32)
        paragraph("Rain-slick asphalt under neon billboards. Chain drifts across the overpass to grow your multiplier before the timer dies.")
        row(gap: 10) {
            badge("Drift")
            badge("Multiplier")
            badge("Night City")
        }
        card(padding: 18) {
            title("Drift score", size: 20)
            text("Long slides through rings bank big points.")
            button("Bank drift: " + driftScore) {
                driftScore = driftScore + 500
                print("Drift score", driftScore)
            }
        }
        card(padding: 18) {
            title("Multiplier", size: 20)
            text("Clean gates raise the chain multiplier.")
            button("Raise multiplier: " + multiplier) {
                multiplier = multiplier + 1
                print("Multiplier", multiplier)
            }
        }
        card(padding: 18) {
            title("Fans impressed", size: 20)
            text("Podium finishes grow the midnight crowd.")
            button("Impress fans: " + fans) {
                fans = fans + 120
                print("Fans impressed", fans)
            }
        }
        card(padding: 18) {
            title("How to play", size: 20)
            text("WASD — steer through the city")
            text("Shift — handbrake to initiate drifts")
            text("Chain rings without crashing to keep multiplier")
        }
    }
}

print("Drift City ready — open Scene or World and press Play.")
`,
  },
  {
    id: "tower-defense",
    name: "Tower Defense",
    title: "Tower Defense",
    genre: "Crystal tower defense",
    description: "Defend the Crystal Sanctum: enemy lane waypoints, arcane cannons, frost pylons, wave spawner and gold economy.",
    difficulty: "beginner",
    playable: true,
    controls: ["E place / upgrade", "Mouse select lane"],
    accent: "#52d6c7",
    objectCount: 21,
    source: `app "Tower Defense"

state gold = 150
state wave = 1
state crystalHealth = 100
state enemiesDefeated = 0

scene "Tower Defense Scene" {
    camera(position: vec3(0, 2.6, 9))
    light(position: vec3(3, 6, 3), color: "#eafffa")
    light(position: vec3(-4, 4, -4), color: "#52d6c7")
    plane("Ground", position: vec3(0, -1.1, 0), size: 20, color: "#20303a")
    cube("Lane Waypoint 1", position: vec3(-3.82, 0, -0.2), size: 0.7, color: "#52d6c7")
    cube("Lane Waypoint 2", position: vec3(-1.36, 0, -0.5), size: 0.9, color: "#8b79ff")
    cube("Lane Waypoint 3", position: vec3(-0.3, 0, -0.5), size: 1.1, color: "#9fdcff")
    cube("Lane Waypoint 4", position: vec3(2.16, 0, -0.2), size: 0.6, color: "#eab96d")
    cylinder("Arcane Cannon 1", position: vec3(3.22, 0, -0.5), size: 1.3, color: "#52d6c7")
    cylinder("Arcane Cannon 2", position: vec3(-3.12, 0, -2.7), size: 0.7, color: "#8b79ff")
    cylinder("Frost Pylon 1", position: vec3(-2.06, 0, -2.4), size: 0.9, color: "#9fdcff")
    cylinder("Frost Pylon 2", position: vec3(0.4, 0, -2.7), size: 1.1, color: "#eab96d")
    sphere("Sanctum Crystal", position: vec3(1.46, 0.4, -2.7), radius: 0.42, color: "#52d6c7")
    torus("Crystal Shield Ring", position: vec3(3.92, 0.4, -2.4), size: 1.3, color: "#8b79ff")
    cube("Tower Plot A", position: vec3(-3.82, 0, -4.9), size: 0.7, color: "#9fdcff")
    cube("Tower Plot B", position: vec3(-1.36, 0, -4.9), size: 0.9, color: "#eab96d")
    cube("Tower Plot C", position: vec3(-0.3, 0, -4.6), size: 1.1, color: "#52d6c7")
    sphere("Wave Spawn Orb", position: vec3(2.16, 0.4, -4.9), radius: 0.5, color: "#8b79ff")
    cube("Gold Vault", position: vec3(3.22, 0, -4.9), size: 1.3, color: "#9fdcff")
    cylinder("Storm Spire", position: vec3(-3.12, 0, -6.8), size: 0.7, color: "#eab96d")
    sphere("Frost Core", position: vec3(-2.06, 0.4, -7.1), radius: 0.5, color: "#52d6c7")
    cube("Sanctum Gate", position: vec3(0.4, 0, -7.1), size: 1.1, color: "#8b79ff")
    rigidbody("Wave Spawn Orb", mass: 1, restitution: 0.45, friction: 0.35)
    controller("Wave Spawn Orb", speed: 2.5, jumpSpeed: 4)
    material("Sanctum Crystal", metallic: 0.2, roughness: 0.15, emissive: 0.9)
    material("Crystal Shield Ring", metallic: 0.5, roughness: 0.2, emissive: 0.7)
    animate("Crystal Shield Ring", rotation: vec3(0, 1, 0), speed: 0.8)
}

page "Home" {
    column(gap: 14) {
        badge("CRYSTAL SANCTUM DEFENSE")
        title("Tower Defense", size: 32)
        paragraph("Waves march the serpent lane toward the Sanctum Crystal. Place arcane cannons and frost pylons, earn gold, survive wave ten.")
        row(gap: 10) {
            badge("Waves")
            badge("Towers")
            badge("Gold Economy")
        }
        card(padding: 18) {
            title("Gold earned", size: 20)
            text("Defeated enemies pay gold for new towers.")
            button("Earn gold: " + gold) {
                gold = gold + 25
                print("Gold earned", gold)
            }
        }
        card(padding: 18) {
            title("Wave reached", size: 20)
            text("Each wave marches faster down the lane.")
            button("Start wave: " + wave) {
                wave = wave + 1
                print("Wave reached", wave)
            }
        }
        card(padding: 18) {
            title("Enemies defeated", size: 20)
            text("Frost slows, arcane cannons finish.")
            button("Defeat enemy: " + enemiesDefeated) {
                enemiesDefeated = enemiesDefeated + 5
                print("Enemies defeated", enemiesDefeated)
            }
        }
        card(padding: 18) {
            title("How to play", size: 20)
            text("E — place or upgrade towers on plots")
            text("Frost pylons slow, cannons damage")
            text("Protect the Sanctum Crystal at all costs")
        }
    }
}

print("Tower Defense ready — open Scene or World and press Play.")
`,
  },
  {
    id: "voxel-sandbox",
    name: "Voxel Sandbox",
    title: "Voxel Sandbox",
    genre: "Creative physics sandbox",
    description: "A creative voxel sandbox: multi-material blocks, domino physics chains, gravity toggle and blueprint saver.",
    difficulty: "beginner",
    playable: true,
    controls: ["WASD move", "E place block", "B builder"],
    accent: "#eab96d",
    objectCount: 21,
    source: `app "Voxel Sandbox"

state blocksPlaced = 0
state dominoesToppled = 0
state gravityMode = 1
state creationsSaved = 0

scene "Voxel Sandbox Scene" {
    camera(position: vec3(0, 2.6, 9))
    light(position: vec3(4, 7, 4), color: "#ffffff")
    light(position: vec3(-3, 4, -3), color: "#ffe9b0")
    plane("Ground", position: vec3(0, -1.1, 0), size: 18, color: "#2c3444")
    cube("Oak Voxel Block", position: vec3(-3.82, 0, -0.2), size: 0.7, color: "#b08954")
    cube("Stone Voxel Block", position: vec3(-1.36, 0, -0.5), size: 0.9, color: "#8d99ae")
    cube("Glass Voxel Block", position: vec3(-0.3, 0, -0.5), size: 1.1, color: "#9fdcff")
    cube("Neon Voxel Block", position: vec3(2.16, 0, -0.2), size: 0.6, color: "#48e5e5")
    cube("Domino 1", position: vec3(3.22, 0, -0.5), size: 1.3, color: "#eab96d")
    cube("Domino 2", position: vec3(-3.12, 0, -2.7), size: 0.7, color: "#b08954")
    cube("Domino 3", position: vec3(-2.06, 0, -2.4), size: 0.9, color: "#8d99ae")
    cube("Domino 4", position: vec3(0.4, 0, -2.7), size: 1.1, color: "#9fdcff")
    cube("Domino 5", position: vec3(1.46, 0, -2.7), size: 0.6, color: "#48e5e5")
    sphere("Gravity Orb", position: vec3(3.92, 0.4, -2.4), radius: 0.35, color: "#eab96d")
    cube("Ramp Voxel", position: vec3(-3.82, 0, -4.9), size: 0.7, color: "#b08954")
    cube("Arch Voxel L", position: vec3(-1.36, 0, -4.9), size: 0.9, color: "#8d99ae")
    cube("Arch Voxel R", position: vec3(-0.3, 0, -4.6), size: 1.1, color: "#9fdcff")
    torus("Blueprint Ring", position: vec3(2.16, 0.4, -4.9), size: 0.6, color: "#48e5e5")
    cube("Storage Crate", position: vec3(3.22, 0, -4.9), size: 1.3, color: "#eab96d")
    sphere("Bouncy Voxel Ball", position: vec3(-3.12, 0.4, -6.8), radius: 0.35, color: "#b08954")
    cube("Ice Voxel Block", position: vec3(-2.06, 0, -7.1), size: 0.9, color: "#8d99ae")
    cube("Magma Voxel Block", position: vec3(0.4, 0, -7.1), size: 1.1, color: "#9fdcff")
    rigidbody("Bouncy Voxel Ball", mass: 1, restitution: 0.45, friction: 0.35)
    rigidbody("Domino 1", mass: 1, restitution: 0.45, friction: 0.35)
    controller("Bouncy Voxel Ball", speed: 3.5, jumpSpeed: 6)
    material("Glass Voxel Block", metallic: 0.1, roughness: 0.1, emissive: 0.3)
    material("Neon Voxel Block", metallic: 0.3, roughness: 0.3, emissive: 1)
    animate("Blueprint Ring", rotation: vec3(0, 1, 0), speed: 0.8)
}

page "Home" {
    column(gap: 14) {
        badge("VOXEL PLAYGROUND")
        title("Voxel Sandbox", size: 32)
        paragraph("Snap multi-material voxel blocks into towers, rig domino physics chains, flip gravity and save your blueprint for friends.")
        row(gap: 10) {
            badge("Voxel")
            badge("Physics")
            badge("Blueprints")
        }
        card(padding: 18) {
            title("Blocks placed", size: 20)
            text("Every snapped block joins the physics world.")
            button("Place block: " + blocksPlaced) {
                blocksPlaced = blocksPlaced + 5
                print("Blocks placed", blocksPlaced)
            }
        }
        card(padding: 18) {
            title("Dominoes toppled", size: 20)
            text("Rig a chain and push the first domino.")
            button("Topple domino: " + dominoesToppled) {
                dominoesToppled = dominoesToppled + 3
                print("Dominoes toppled", dominoesToppled)
            }
        }
        card(padding: 18) {
            title("Creations saved", size: 20)
            text("Blueprint saver stores your build locally.")
            button("Save creation: " + creationsSaved) {
                creationsSaved = creationsSaved + 1
                print("Creations saved", creationsSaved)
            }
        }
        card(padding: 18) {
            title("How to play", size: 20)
            text("WASD — fly the sandbox")
            text("E — place / remove voxel blocks")
            text("Toggle gravity and watch dominoes fly")
        }
    }
}

print("Voxel Sandbox ready — open Scene or World and press Play.")
`,
  },
  {"id": "kart-racing-cup", "name": "Kart Racing Cup", "title": "Kart Racing Cup", "genre": "Arcade kart racer", "description": "A rainbow kart cup with boost pads, banana hazards, lap timing and a championship podium.", "difficulty": "beginner", "playable": true, "controls": ["WASD / arrows — steer the kart", "Shift — boost on straights"], "accent": "#ff6b9d", "objectCount": 20, "source": "app \"Kart Racing Cup\"\n\nstate racePosition = 4\nstate laps = 0\nstate boost = 60\nstate coinsCollected = 0\nstate bestLapSeconds = 48\n\nscene \"Kart Racing Cup Scene\" {\n    camera(position: vec3(0, 2.6, 9))\n    light(position: vec3(3, 6, 4), color: \"#ffd94a\")\n    light(position: vec3(-4, 3, -2), color: \"#ff6b9d\")\n    plane(\"Ground\", position: vec3(0, -1.1, 0), size: 18, color: \"#20243a\")\n    cube(\"Start Gantry\", position: vec3(-3.82, 0, -0.2), size: 0.7, color: \"#ff6b9d\")\n    sphere(\"Boost Pad Alpha\", position: vec3(-1.36, 0.8, -0.2), radius: 0.42, color: \"#ffd94a\")\n    torus(\"Banana Hazard\", position: vec3(-0.3, 0.4, -0.2), size: 1.1, color: \"#48e5e5\")\n    cylinder(\"Hairpin Barrier\", position: vec3(2.16, 0, -0.2), size: 0.6, color: \"#3a2c5e\")\n    cube(\"Coin Trail One\", position: vec3(3.22, 0.4, -0.2), size: 1.3, color: \"#ff6b9d\")\n    sphere(\"Pit Lane Tent\", position: vec3(-3.82, 0.4, -2.5), radius: 0.42, color: \"#ffd94a\")\n    torus(\"Turbo Ramp\", position: vec3(-1.36, 0.4, -2.5), size: 0.9, color: \"#48e5e5\")\n    cylinder(\"Grandstand Tower\", position: vec3(-0.3, 0.4, -2.5), size: 1.1, color: \"#3a2c5e\")\n    cube(\"Checkpoint Arch B\", position: vec3(2.16, 0, -2.5), size: 0.6, color: \"#ff6b9d\")\n    sphere(\"Drift Zone Sign\", position: vec3(3.22, 0.4, -2.5), radius: 0.42, color: \"#ffd94a\")\n    torus(\"Podium One\", position: vec3(-3.82, 0.8, -4.8), size: 0.7, color: \"#48e5e5\")\n    cylinder(\"Champion Kart\", position: vec3(-1.36, 0, -4.8), size: 0.9, color: \"#3a2c5e\")\n    material(\"Boost Pad Alpha\", metallic: 0.45, roughness: 0.28, emissive: 0.06)\n    animate(\"Banana Hazard\", rotation: vec3(0, 1, 0), speed: 0.7)\n    controller(\"Boost Pad Alpha\", speed: 3.4, jumpSpeed: 5)\n    rigidbody(\"Hairpin Barrier\", mass: 1, restitution: 0.45, friction: 0.6, gravity: vec3(0, 1, 0), speed: 0.8)\n}\n\npage \"Home\" {\n    column(gap: 14) {\n        badge(\"RAINBOW CUP · KART GP\")\n        title(\"Kart Racing Cup\", size: 34)\n        paragraph(\"Drift the hairpins, chain boost pads and steal the Rainbow Cup on the final lap.\")\n        row(gap: 10) {\n            badge(\"Boost pads\")\n            badge(\"Lap timing\")\n            badge(\"Podium cup\")\n        }\n        card(padding: 18) {\n            title(\"Race position\", size: 20)\n            text(\"Overtake a rival with a clean boost line.\")\n            button(\"Overtake rival: \" + racePosition) {\n                racePosition = racePosition + -1\n                print(\"Race position\", racePosition)\n            }\n        }\n        card(padding: 18) {\n            title(\"Laps\", size: 20)\n            text(\"Every clean lap brings the cup closer.\")\n            button(\"Complete lap: \" + laps) {\n                laps = laps + 1\n                print(\"Laps\", laps)\n            }\n        }\n        card(padding: 18) {\n            title(\"Boost meter\", size: 20)\n            text(\"Pads and drifts refill turbo boost.\")\n            button(\"Collect boost: \" + boost) {\n                boost = boost + 20\n                print(\"Boost meter\", boost)\n            }\n        }\n        card(padding: 18) {\n            title(\"Coins\", size: 20)\n            text(\"Coins unlock kart paint in the cup shop.\")\n            button(\"Collect coins: \" + coinsCollected) {\n                coinsCollected = coinsCollected + 10\n                print(\"Coins\", coinsCollected)\n            }\n        }\n        card(padding: 18) {\n            title(\"How it works\", size: 20)\n            text(\"WASD / arrows — steer the kart\")\n            text(\"Shift — boost on straights\")\n            text(\"Space — hop the hairpin kerb\")\n            text(\"R — reset to track\")\n        }\n    }\n}\n\npage \"Guide\" {\n    column(gap: 12) {\n        title(\"Kart Racing Cup Guide\", size: 26)\n        paragraph(\"Everything in Kart Racing Cup runs on live Orvexa state. Use the Home cards to drive the numbers, then open Scene or World view to explore the 3D set.\")\n        text(\"Race position — Overtake a rival with a clean boost line.\")\n        text(\"Laps — Every clean lap brings the cup closer.\")\n        text(\"Boost meter — Pads and drifts refill turbo boost.\")\n        text(\"Coins — Coins unlock kart paint in the cup shop.\")\n        button(\"Celebrate progress\") {\n            print(\"Guide celebration for Kart Racing Cup\")\n        }\n    }\n}\n\nprint(\"Kart Racing Cup ready — open Scene or World and press Play.\")\n"},
  {"id": "zombie-wave-defense", "name": "Zombie Wave Defense", "title": "Zombie Wave Defense", "genre": "Survival wave shooter", "description": "Hold the farmhouse against moonlit zombie waves with barricades, traps and a trusty blaster.", "difficulty": "beginner", "playable": true, "controls": ["WASD — patrol the farmyard", "Mouse / Space — fire blaster"], "accent": "#8aff5e", "objectCount": 20, "source": "app \"Zombie Wave Defense\"\n\nstate wave = 1\nstate zombiesDefeated = 0\nstate barricades = 6\nstate ammo = 40\nstate survivors = 3\n\nscene \"Zombie Wave Defense Scene\" {\n    camera(position: vec3(0, 2.6, 9))\n    light(position: vec3(3, 6, 4), color: \"#ffd94a\")\n    light(position: vec3(-4, 3, -2), color: \"#8aff5e\")\n    plane(\"Ground\", position: vec3(0, -1.1, 0), size: 18, color: \"#1c2418\")\n    sphere(\"Farmhouse Gate\", position: vec3(-3.82, 0.4, -0.2), radius: 0.42, color: \"#ffd94a\")\n    torus(\"Barricade Alpha\", position: vec3(-1.36, 0.8, -0.2), size: 0.9, color: \"#ff5c5c\")\n    cylinder(\"Moon Lantern\", position: vec3(-0.3, 0, -0.2), size: 1.1, color: \"#2c3a26\")\n    cube(\"Trap Pit One\", position: vec3(2.16, 0, -0.2), size: 0.6, color: \"#8aff5e\")\n    sphere(\"Ammo Crate\", position: vec3(3.22, 0.8, -0.2), radius: 0.42, color: \"#ffd94a\")\n    torus(\"Watchtower\", position: vec3(-3.82, 0.4, -2.5), size: 0.7, color: \"#ff5c5c\")\n    cylinder(\"Scarecrow Sentinel\", position: vec3(-1.36, 0, -2.5), size: 0.9, color: \"#2c3a26\")\n    cube(\"Well of Dawn\", position: vec3(-0.3, 0.4, -2.5), size: 1.1, color: \"#8aff5e\")\n    sphere(\"Hay Bale Cover\", position: vec3(2.16, 0.4, -2.5), radius: 0.42, color: \"#ffd94a\")\n    torus(\"Boss Brute Gate\", position: vec3(3.22, 0.4, -2.5), size: 1.3, color: \"#ff5c5c\")\n    cylinder(\"Dawn Bell\", position: vec3(-3.82, 0.4, -4.8), size: 0.7, color: \"#2c3a26\")\n    cube(\"Victory Flag\", position: vec3(-1.36, 0, -4.8), size: 0.9, color: \"#8aff5e\")\n    material(\"Barricade Alpha\", metallic: 0.45, roughness: 0.28, emissive: 0.06)\n    animate(\"Moon Lantern\", rotation: vec3(0, 1, 0), speed: 0.7)\n    controller(\"Barricade Alpha\", speed: 3.4, jumpSpeed: 5)\n    rigidbody(\"Trap Pit One\", mass: 1, restitution: 0.45, friction: 0.6, gravity: vec3(0, 1, 0), speed: 0.8)\n}\n\npage \"Home\" {\n    column(gap: 14) {\n        badge(\"MOONLIT FARM · WAVE DEFENSE\")\n        title(\"Zombie Wave Defense\", size: 34)\n        paragraph(\"Board the windows, set the traps and survive until dawn breaks over the farm.\")\n        row(gap: 10) {\n            badge(\"Wave system\")\n            badge(\"Barricades\")\n            badge(\"Dawn finale\")\n        }\n        card(padding: 18) {\n            title(\"Wave\", size: 20)\n            text(\"Survive to push the horde wave higher.\")\n            button(\"Survive wave: \" + wave) {\n                wave = wave + 1\n                print(\"Wave\", wave)\n            }\n        }\n        card(padding: 18) {\n            title(\"Zombies defeated\", size: 20)\n            text(\"Every fallen zombie buys breathing room.\")\n            button(\"Defeat zombies: \" + zombiesDefeated) {\n                zombiesDefeated = zombiesDefeated + 5\n                print(\"Zombies defeated\", zombiesDefeated)\n            }\n        }\n        card(padding: 18) {\n            title(\"Barricades\", size: 20)\n            text(\"Rebuild boards between waves.\")\n            button(\"Repair barricade: \" + barricades) {\n                barricades = barricades + 1\n                print(\"Barricades\", barricades)\n            }\n        }\n        card(padding: 18) {\n            title(\"Ammo\", size: 20)\n            text(\"Scavenge bullets from the barn crates.\")\n            button(\"Scavenge ammo: \" + ammo) {\n                ammo = ammo + 12\n                print(\"Ammo\", ammo)\n            }\n        }\n        card(padding: 18) {\n            title(\"How it works\", size: 20)\n            text(\"WASD — patrol the farmyard\")\n            text(\"Mouse / Space — fire blaster\")\n            text(\"E — repair barricades\")\n            text(\"Shift — sprint to a trap\")\n        }\n    }\n}\n\npage \"Guide\" {\n    column(gap: 12) {\n        title(\"Zombie Wave Defense Guide\", size: 26)\n        paragraph(\"Everything in Zombie Wave Defense runs on live Orvexa state. Use the Home cards to drive the numbers, then open Scene or World view to explore the 3D set.\")\n        text(\"Wave — Survive to push the horde wave higher.\")\n        text(\"Zombies defeated — Every fallen zombie buys breathing room.\")\n        text(\"Barricades — Rebuild boards between waves.\")\n        text(\"Ammo — Scavenge bullets from the barn crates.\")\n        button(\"Celebrate progress\") {\n            print(\"Guide celebration for Zombie Wave Defense\")\n        }\n    }\n}\n\nprint(\"Zombie Wave Defense ready — open Scene or World and press Play.\")\n"},
  {"id": "fishing-village", "name": "Fishing Village", "title": "Fishing Village", "genre": "Cozy life sim", "description": "A cozy harbour village: catch fish, upgrade the boat, feed the village and light the lighthouse.", "difficulty": "beginner", "playable": true, "controls": ["WASD — walk the harbour", "E — cast / interact"], "accent": "#56b6ff", "objectCount": 20, "source": "app \"Fishing Village\"\n\nstate fishCaught = 0\nstate coins = 20\nstate boatLevel = 1\nstate villagersFed = 0\nstate lighthouse = 0\n\nscene \"Fishing Village Scene\" {\n    camera(position: vec3(0, 2.6, 9))\n    light(position: vec3(3, 6, 4), color: \"#ffd9a0\")\n    light(position: vec3(-4, 3, -2), color: \"#56b6ff\")\n    plane(\"Ground\", position: vec3(0, -1.1, 0), size: 18, color: \"#24343a\")\n    sphere(\"Harbour Pier\", position: vec3(-3.82, 0.4, -0.2), radius: 0.42, color: \"#ffd9a0\")\n    torus(\"Fishing Boat Alba\", position: vec3(-1.36, 0.8, -0.2), size: 0.9, color: \"#3ddc97\")\n    cylinder(\"Market Stall\", position: vec3(-0.3, 0, -0.2), size: 1.1, color: \"#31456b\")\n    cube(\"Lighthouse Rock\", position: vec3(2.16, 0, -0.2), size: 0.6, color: \"#56b6ff\")\n    sphere(\"Crab Pot One\", position: vec3(3.22, 0.8, -0.2), radius: 0.42, color: \"#ffd9a0\")\n    torus(\"Net Dryer\", position: vec3(-3.82, 0.4, -2.5), size: 0.7, color: \"#3ddc97\")\n    cylinder(\"Village Well\", position: vec3(-1.36, 0, -2.5), size: 0.9, color: \"#31456b\")\n    cube(\"Bakery Hut\", position: vec3(-0.3, 0.4, -2.5), size: 1.1, color: \"#56b6ff\")\n    sphere(\"Tide Pool\", position: vec3(2.16, 0.4, -2.5), radius: 0.42, color: \"#ffd9a0\")\n    torus(\"Seagull Post\", position: vec3(3.22, 0.4, -2.5), size: 1.3, color: \"#3ddc97\")\n    cylinder(\"Boat Workshop\", position: vec3(-3.82, 0.4, -4.8), size: 0.7, color: \"#31456b\")\n    cube(\"Lantern Dock\", position: vec3(-1.36, 0, -4.8), size: 0.9, color: \"#56b6ff\")\n    material(\"Fishing Boat Alba\", metallic: 0.45, roughness: 0.28, emissive: 0.06)\n    animate(\"Market Stall\", rotation: vec3(0, 1, 0), speed: 0.7)\n    controller(\"Fishing Boat Alba\", speed: 3.4, jumpSpeed: 5)\n    rigidbody(\"Lighthouse Rock\", mass: 1, restitution: 0.45, friction: 0.6, gravity: vec3(0, 1, 0), speed: 0.8)\n}\n\npage \"Home\" {\n    column(gap: 14) {\n        badge(\"COZY HARBOUR · LIFE SIM\")\n        title(\"Fishing Village\", size: 34)\n        paragraph(\"Catch the dawn run, sell at the market and save enough to relight the old lighthouse.\")\n        row(gap: 10) {\n            badge(\"Fishing loop\")\n            badge(\"Boat upgrades\")\n            badge(\"Lighthouse goal\")\n        }\n        card(padding: 18) {\n            title(\"Fish caught\", size: 20)\n            text(\"The dawn run is richest near the rocks.\")\n            button(\"Catch fish: \" + fishCaught) {\n                fishCaught = fishCaught + 3\n                print(\"Fish caught\", fishCaught)\n            }\n        }\n        card(padding: 18) {\n            title(\"Coins\", size: 20)\n            text(\"Sell the catch at the market stall.\")\n            button(\"Sell catch: \" + coins) {\n                coins = coins + 15\n                print(\"Coins\", coins)\n            }\n        }\n        card(padding: 18) {\n            title(\"Boat level\", size: 20)\n            text(\"A better boat reaches deeper water.\")\n            button(\"Upgrade boat: \" + boatLevel) {\n                boatLevel = boatLevel + 1\n                print(\"Boat level\", boatLevel)\n            }\n        }\n        card(padding: 18) {\n            title(\"Villagers fed\", size: 20)\n            text(\"Warm meals keep the harbour happy.\")\n            button(\"Feed villager: \" + villagersFed) {\n                villagersFed = villagersFed + 1\n                print(\"Villagers fed\", villagersFed)\n            }\n        }\n        card(padding: 18) {\n            title(\"How it works\", size: 20)\n            text(\"WASD — walk the harbour\")\n            text(\"E — cast / interact\")\n            text(\"F — set sail in the boat\")\n            text(\"B — open the workshop\")\n        }\n    }\n}\n\npage \"Guide\" {\n    column(gap: 12) {\n        title(\"Fishing Village Guide\", size: 26)\n        paragraph(\"Everything in Fishing Village runs on live Orvexa state. Use the Home cards to drive the numbers, then open Scene or World view to explore the 3D set.\")\n        text(\"Fish caught — The dawn run is richest near the rocks.\")\n        text(\"Coins — Sell the catch at the market stall.\")\n        text(\"Boat level — A better boat reaches deeper water.\")\n        text(\"Villagers fed — Warm meals keep the harbour happy.\")\n        button(\"Celebrate progress\") {\n            print(\"Guide celebration for Fishing Village\")\n        }\n    }\n}\n\nprint(\"Fishing Village ready — open Scene or World and press Play.\")\n"},
  {"id": "ninja-dojo-runner", "name": "Ninja Dojo Runner", "title": "Ninja Dojo Runner", "genre": "Reflex runner", "description": "Sprint the moonlit dojo rooftops: slide under bamboo traps, leap lantern gaps and master the silent arts.", "difficulty": "beginner", "playable": true, "controls": ["WASD — sprint the rooftops", "Space — leap lantern gaps"], "accent": "#e8e4ff", "objectCount": 20, "source": "app \"Ninja Dojo Runner\"\n\nstate scrolls = 0\nstate combo = 0\nstate distance = 0\nstate alarms = 0\nstate rank = 1\n\nscene \"Ninja Dojo Runner Scene\" {\n    camera(position: vec3(0, 2.6, 9))\n    light(position: vec3(3, 6, 4), color: \"#ff8a5c\")\n    light(position: vec3(-4, 3, -2), color: \"#e8e4ff\")\n    plane(\"Ground\", position: vec3(0, -1.1, 0), size: 18, color: \"#1a2030\")\n    cube(\"Dojo Gate\", position: vec3(-3.82, 0, -0.2), size: 0.7, color: \"#e8e4ff\")\n    sphere(\"Bamboo Trap One\", position: vec3(-1.36, 0.8, -0.2), radius: 0.42, color: \"#ff8a5c\")\n    torus(\"Lantern Gap\", position: vec3(-0.3, 0.4, -0.2), size: 1.1, color: \"#56f0e8\")\n    cylinder(\"Training Dummy\", position: vec3(2.16, 0, -0.2), size: 0.6, color: \"#2c3550\")\n    cube(\"Roof Ridge Alpha\", position: vec3(3.22, 0.4, -0.2), size: 1.3, color: \"#e8e4ff\")\n    sphere(\"Shuriken Target\", position: vec3(-3.82, 0.4, -2.5), radius: 0.42, color: \"#ff8a5c\")\n    torus(\"Tea House Roof\", position: vec3(-1.36, 0.4, -2.5), size: 0.9, color: \"#56f0e8\")\n    cylinder(\"Silent Bell Rope\", position: vec3(-0.3, 0.4, -2.5), size: 1.1, color: \"#2c3550\")\n    cube(\"Bamboo Grove\", position: vec3(2.16, 0, -2.5), size: 0.6, color: \"#e8e4ff\")\n    sphere(\"Master Statue\", position: vec3(3.22, 0.4, -2.5), radius: 0.42, color: \"#ff8a5c\")\n    torus(\"Dawn Bell\", position: vec3(-3.82, 0.8, -4.8), size: 0.7, color: \"#56f0e8\")\n    cylinder(\"Moon Bridge\", position: vec3(-1.36, 0, -4.8), size: 0.9, color: \"#2c3550\")\n    material(\"Bamboo Trap One\", metallic: 0.45, roughness: 0.28, emissive: 0.06)\n    animate(\"Lantern Gap\", rotation: vec3(0, 1, 0), speed: 0.7)\n    controller(\"Bamboo Trap One\", speed: 3.4, jumpSpeed: 5)\n    rigidbody(\"Training Dummy\", mass: 1, restitution: 0.45, friction: 0.6, gravity: vec3(0, 1, 0), speed: 0.8)\n}\n\npage \"Home\" {\n    column(gap: 14) {\n        badge(\"MOONLIT DOJO · REFLEX RUN\")\n        title(\"Ninja Dojo Runner\", size: 34)\n        paragraph(\"Chain silent moves across the dojo roofs and ring the Dawn Bell without being seen.\")\n        row(gap: 10) {\n            badge(\"Combo chaining\")\n            badge(\"Trap roofs\")\n            badge(\"Rank arts\")\n        }\n        card(padding: 18) {\n            title(\"Scrolls\", size: 20)\n            text(\"Hidden scrolls teach new silent arts.\")\n            button(\"Collect scroll: \" + scrolls) {\n                scrolls = scrolls + 1\n                print(\"Scrolls\", scrolls)\n            }\n        }\n        card(padding: 18) {\n            title(\"Combo\", size: 20)\n            text(\"Link moves without stopping to grow combo.\")\n            button(\"Link move: \" + combo) {\n                combo = combo + 1\n                print(\"Combo\", combo)\n            }\n        }\n        card(padding: 18) {\n            title(\"Distance\", size: 20)\n            text(\"Every rooftop crossed adds distance.\")\n            button(\"Cross rooftop: \" + distance) {\n                distance = distance + 25\n                print(\"Distance\", distance)\n            }\n        }\n        card(padding: 18) {\n            title(\"Rank\", size: 20)\n            text(\"Flawless runs raise your ninja rank.\")\n            button(\"Rank up: \" + rank) {\n                rank = rank + 1\n                print(\"Rank\", rank)\n            }\n        }\n        card(padding: 18) {\n            title(\"How it works\", size: 20)\n            text(\"WASD — sprint the rooftops\")\n            text(\"Space — leap lantern gaps\")\n            text(\"Shift — slide under traps\")\n            text(\"E — ring bells silently\")\n        }\n    }\n}\n\npage \"Guide\" {\n    column(gap: 12) {\n        title(\"Ninja Dojo Runner Guide\", size: 26)\n        paragraph(\"Everything in Ninja Dojo Runner runs on live Orvexa state. Use the Home cards to drive the numbers, then open Scene or World view to explore the 3D set.\")\n        text(\"Scrolls — Hidden scrolls teach new silent arts.\")\n        text(\"Combo — Link moves without stopping to grow combo.\")\n        text(\"Distance — Every rooftop crossed adds distance.\")\n        text(\"Rank — Flawless runs raise your ninja rank.\")\n        button(\"Celebrate progress\") {\n            print(\"Guide celebration for Ninja Dojo Runner\")\n        }\n    }\n}\n\nprint(\"Ninja Dojo Runner ready — open Scene or World and press Play.\")\n"},
  {"id": "farm-tycoon", "name": "Farm Tycoon", "title": "Farm Tycoon", "genre": "Cozy tycoon sim", "description": "Grow a tiny plot into a golden farm empire: crops, barns, tractors, markets and seasonal festivals.", "difficulty": "beginner", "playable": true, "controls": ["WASD — walk the farm", "E — plant / harvest"], "accent": "#ffd94a", "objectCount": 20, "source": "app \"Farm Tycoon\"\n\nstate coins = 50\nstate cropsHarvested = 0\nstate barns = 1\nstate tractors = 0\nstate festivalStars = 0\n\nscene \"Farm Tycoon Scene\" {\n    camera(position: vec3(0, 2.6, 9))\n    light(position: vec3(3, 6, 4), color: \"#62b26f\")\n    light(position: vec3(-4, 3, -2), color: \"#ffd94a\")\n    plane(\"Ground\", position: vec3(0, -1.1, 0), size: 18, color: \"#2a3418\")\n    cylinder(\"Starter Plot\", position: vec3(-3.82, 0, -0.2), size: 0.7, color: \"#3c4a26\")\n    cube(\"Wheat Field One\", position: vec3(-1.36, 0.4, -0.2), size: 0.9, color: \"#ffd94a\")\n    sphere(\"Barn Alpha\", position: vec3(-0.3, 0.4, -0.2), radius: 0.42, color: \"#62b26f\")\n    torus(\"Tractor Shed\", position: vec3(2.16, 0.4, -0.2), size: 0.6, color: \"#ff9a5c\")\n    cylinder(\"Market Truck\", position: vec3(3.22, 0.4, -0.2), size: 1.3, color: \"#3c4a26\")\n    cube(\"Windmill\", position: vec3(-3.82, 0, -2.5), size: 0.7, color: \"#ffd94a\")\n    sphere(\"Scarecrow King\", position: vec3(-1.36, 0.4, -2.5), radius: 0.42, color: \"#62b26f\")\n    torus(\"Irrigation Pond\", position: vec3(-0.3, 0.8, -2.5), size: 1.1, color: \"#ff9a5c\")\n    cylinder(\"Greenhouse\", position: vec3(2.16, 0, -2.5), size: 0.6, color: \"#3c4a26\")\n    cube(\"Festival Stage\", position: vec3(3.22, 0, -2.5), size: 1.3, color: \"#ffd94a\")\n    sphere(\"Silo Tower\", position: vec3(-3.82, 0.8, -4.8), radius: 0.42, color: \"#62b26f\")\n    torus(\"Golden Gate\", position: vec3(-1.36, 0.4, -4.8), size: 0.9, color: \"#ff9a5c\")\n    material(\"Wheat Field One\", metallic: 0.45, roughness: 0.28, emissive: 0.06)\n    animate(\"Barn Alpha\", rotation: vec3(0, 1, 0), speed: 0.7)\n    controller(\"Wheat Field One\", speed: 3.4, jumpSpeed: 5)\n    rigidbody(\"Tractor Shed\", mass: 1, restitution: 0.45, friction: 0.6, gravity: vec3(0, 1, 0), speed: 0.8)\n}\n\npage \"Home\" {\n    column(gap: 14) {\n        badge(\"GOLDEN ACRES · TYCOON\")\n        title(\"Farm Tycoon\", size: 34)\n        paragraph(\"Plant, harvest and reinvest until Golden Acres wins the Harvest Festival crown.\")\n        row(gap: 10) {\n            badge(\"Crop cycles\")\n            badge(\"Reinvest loop\")\n            badge(\"Festival crown\")\n        }\n        card(padding: 18) {\n            title(\"Coins\", size: 20)\n            text(\"Sell harvests to grow the empire.\")\n            button(\"Sell harvest: \" + coins) {\n                coins = coins + 25\n                print(\"Coins\", coins)\n            }\n        }\n        card(padding: 18) {\n            title(\"Crops harvested\", size: 20)\n            text(\"Every crop cycle feeds the market.\")\n            button(\"Harvest crops: \" + cropsHarvested) {\n                cropsHarvested = cropsHarvested + 10\n                print(\"Crops harvested\", cropsHarvested)\n            }\n        }\n        card(padding: 18) {\n            title(\"Barns\", size: 20)\n            text(\"More barns hold more livestock.\")\n            button(\"Build barn: \" + barns) {\n                barns = barns + 1\n                print(\"Barns\", barns)\n            }\n        }\n        card(padding: 18) {\n            title(\"Festival stars\", size: 20)\n            text(\"Win events to crown Golden Acres.\")\n            button(\"Win event: \" + festivalStars) {\n                festivalStars = festivalStars + 1\n                print(\"Festival stars\", festivalStars)\n            }\n        }\n        card(padding: 18) {\n            title(\"How it works\", size: 20)\n            text(\"WASD — walk the farm\")\n            text(\"E — plant / harvest\")\n            text(\"F — drive the tractor\")\n            text(\"B — open the build shed\")\n        }\n    }\n}\n\npage \"Guide\" {\n    column(gap: 12) {\n        title(\"Farm Tycoon Guide\", size: 26)\n        paragraph(\"Everything in Farm Tycoon runs on live Orvexa state. Use the Home cards to drive the numbers, then open Scene or World view to explore the 3D set.\")\n        text(\"Coins — Sell harvests to grow the empire.\")\n        text(\"Crops harvested — Every crop cycle feeds the market.\")\n        text(\"Barns — More barns hold more livestock.\")\n        text(\"Festival stars — Win events to crown Golden Acres.\")\n        button(\"Celebrate progress\") {\n            print(\"Guide celebration for Farm Tycoon\")\n        }\n    }\n}\n\nprint(\"Farm Tycoon ready — open Scene or World and press Play.\")\n"},
  {"id": "pinball-neon", "name": "Neon Pinball", "title": "Neon Pinball", "genre": "Arcade pinball", "description": "A neon pinball table in a playable 3D arcade: bumpers, ramps, multi-ball and a wizard mode chase.", "difficulty": "beginner", "playable": true, "controls": ["A / D — flippers", "Space — plunge the ball"], "accent": "#ff6b9d", "objectCount": 20, "source": "app \"Neon Pinball\"\n\nstate score = 0\nstate balls = 3\nstate multiplier = 1\nstate bumpersLit = 0\nstate jackpots = 0\n\nscene \"Neon Pinball Scene\" {\n    camera(position: vec3(0, 2.6, 9))\n    light(position: vec3(3, 6, 4), color: \"#56f0e8\")\n    light(position: vec3(-4, 3, -2), color: \"#ff6b9d\")\n    plane(\"Ground\", position: vec3(0, -1.1, 0), size: 18, color: \"#181233\")\n    cylinder(\"Plunger Lane\", position: vec3(-3.82, 0, -0.2), size: 0.7, color: \"#33255e\")\n    cube(\"Bumper Alpha\", position: vec3(-1.36, 0.4, -0.2), size: 0.9, color: \"#ff6b9d\")\n    sphere(\"Bumper Beta\", position: vec3(-0.3, 0.4, -0.2), radius: 0.42, color: \"#56f0e8\")\n    torus(\"Sky Ramp\", position: vec3(2.16, 0.4, -0.2), size: 0.6, color: \"#ffd94a\")\n    cylinder(\"Spinner Gate\", position: vec3(3.22, 0.4, -0.2), size: 1.3, color: \"#33255e\")\n    cube(\"Drop Target One\", position: vec3(-3.82, 0, -2.5), size: 0.7, color: \"#ff6b9d\")\n    sphere(\"Neon Signboard\", position: vec3(-1.36, 0.4, -2.5), radius: 0.42, color: \"#56f0e8\")\n    torus(\"Multi-Ball Lock\", position: vec3(-0.3, 0.8, -2.5), size: 1.1, color: \"#ffd94a\")\n    cylinder(\"Flipper Left Post\", position: vec3(2.16, 0, -2.5), size: 0.6, color: \"#33255e\")\n    cube(\"Jackpot Cup\", position: vec3(3.22, 0, -2.5), size: 1.3, color: \"#ff6b9d\")\n    sphere(\"Wizard Portal\", position: vec3(-3.82, 0.8, -4.8), radius: 0.42, color: \"#56f0e8\")\n    torus(\"Highscore Totem\", position: vec3(-1.36, 0.4, -4.8), size: 0.9, color: \"#ffd94a\")\n    material(\"Bumper Alpha\", metallic: 0.45, roughness: 0.28, emissive: 0.06)\n    animate(\"Bumper Beta\", rotation: vec3(0, 1, 0), speed: 0.7)\n    controller(\"Bumper Alpha\", speed: 3.4, jumpSpeed: 5)\n    rigidbody(\"Sky Ramp\", mass: 1, restitution: 0.45, friction: 0.6, gravity: vec3(0, 1, 0), speed: 0.8)\n}\n\npage \"Home\" {\n    column(gap: 14) {\n        badge(\"NEON ARCADE · PINBALL\")\n        title(\"Neon Pinball\", size: 34)\n        paragraph(\"Light every bumper, ride the sky ramp and trigger Wizard Mode for the jackpot.\")\n        row(gap: 10) {\n            badge(\"Wizard mode\")\n            badge(\"Multi-ball\")\n            badge(\"Jackpot chase\")\n        }\n        card(padding: 18) {\n            title(\"Score\", size: 20)\n            text(\"Bumpers and ramps bank neon points.\")\n            button(\"Bank points: \" + score) {\n                score = score + 1000\n                print(\"Score\", score)\n            }\n        }\n        card(padding: 18) {\n            title(\"Multiplier\", size: 20)\n            text(\"Clean ramp rides raise the multiplier.\")\n            button(\"Raise multiplier: \" + multiplier) {\n                multiplier = multiplier + 1\n                print(\"Multiplier\", multiplier)\n            }\n        }\n        card(padding: 18) {\n            title(\"Bumpers lit\", size: 20)\n            text(\"Light all bumpers to arm Wizard Mode.\")\n            button(\"Light bumper: \" + bumpersLit) {\n                bumpersLit = bumpersLit + 1\n                print(\"Bumpers lit\", bumpersLit)\n            }\n        }\n        card(padding: 18) {\n            title(\"Jackpots\", size: 20)\n            text(\"Wizard Mode pays the mega jackpot.\")\n            button(\"Win jackpot: \" + jackpots) {\n                jackpots = jackpots + 1\n                print(\"Jackpots\", jackpots)\n            }\n        }\n        card(padding: 18) {\n            title(\"How it works\", size: 20)\n            text(\"A / D — flippers\")\n            text(\"Space — plunge the ball\")\n            text(\"Shift — nudge the table\")\n            text(\"R — new game\")\n        }\n    }\n}\n\npage \"Guide\" {\n    column(gap: 12) {\n        title(\"Neon Pinball Guide\", size: 26)\n        paragraph(\"Everything in Neon Pinball runs on live Orvexa state. Use the Home cards to drive the numbers, then open Scene or World view to explore the 3D set.\")\n        text(\"Score — Bumpers and ramps bank neon points.\")\n        text(\"Multiplier — Clean ramp rides raise the multiplier.\")\n        text(\"Bumpers lit — Light all bumpers to arm Wizard Mode.\")\n        text(\"Jackpots — Wizard Mode pays the mega jackpot.\")\n        button(\"Celebrate progress\") {\n            print(\"Guide celebration for Neon Pinball\")\n        }\n    }\n}\n\nprint(\"Neon Pinball ready — open Scene or World and press Play.\")\n"},
  {"id": "chef-rush-3d", "name": "Chef Rush 3D", "title": "Chef Rush 3D", "genre": "Cooking rush game", "description": "A sizzling 3D kitchen rush: fire orders, plate dishes and keep the dinner crowd cheering.", "difficulty": "beginner", "accent": "#ff9a5c", "source": "app \"Chef Rush 3D\"\n\nstate ordersDone = 0\nstate combo = 0\nstate tips = 0\nstate burnt = 0\nstate ladleStars = 0\n\nscene \"Chef Rush 3D Scene\" {\n    camera(position: vec3(0, 2.6, 9))\n    light(position: vec3(3, 6, 4), color: \"#ffd94a\")\n    light(position: vec3(-4, 3, -2), color: \"#ff9a5c\")\n    plane(\"Ground\", position: vec3(0, -1.1, 0), size: 18, color: \"#33241a\")\n    sphere(\"Grill Station\", position: vec3(-3.82, 0.4, -0.2), radius: 0.42, color: \"#ffd94a\")\n    torus(\"Order Rail One\", position: vec3(-1.36, 0.8, -0.2), size: 0.9, color: \"#3ddc97\")\n    cylinder(\"Plating Counter\", position: vec3(-0.3, 0, -0.2), size: 1.1, color: \"#4a3320\")\n    cube(\"Sizzle Pan Alpha\", position: vec3(2.16, 0, -0.2), size: 0.6, color: \"#ff9a5c\")\n    sphere(\"Herb Garden Box\", position: vec3(3.22, 0.8, -0.2), radius: 0.42, color: \"#ffd94a\")\n    torus(\"Ticket Bell\", position: vec3(-3.82, 0.4, -2.5), size: 0.7, color: \"#3ddc97\")\n    cylinder(\"Fridge Tower\", position: vec3(-1.36, 0, -2.5), size: 0.9, color: \"#4a3320\")\n    cube(\"Sauce Fountain\", position: vec3(-0.3, 0.4, -2.5), size: 1.1, color: \"#ff9a5c\")\n    sphere(\"Dessert Shelf\", position: vec3(2.16, 0.4, -2.5), radius: 0.42, color: \"#ffd94a\")\n    torus(\"Waiting Bench\", position: vec3(3.22, 0.4, -2.5), size: 1.3, color: \"#3ddc97\")\n    cylinder(\"Golden Ladle\", position: vec3(-3.82, 0.4, -4.8), size: 0.7, color: \"#4a3320\")\n    cube(\"VIP Table\", position: vec3(-1.36, 0, -4.8), size: 0.9, color: \"#ff9a5c\")\n    material(\"Order Rail One\", metallic: 0.45, roughness: 0.28, emissive: 0.06)\n    animate(\"Plating Counter\", rotation: vec3(0, 1, 0), speed: 0.7)\n    controller(\"Order Rail One\", speed: 3.4, jumpSpeed: 5)\n    rigidbody(\"Sizzle Pan Alpha\", mass: 1, restitution: 0.45, friction: 0.6, gravity: vec3(0, 1, 0), speed: 0.8)\n}\n\npage \"Home\" {\n    column(gap: 14) {\n        badge(\"SIZZLE KITCHEN · RUSH\")\n        title(\"Chef Rush 3D\", size: 34)\n        paragraph(\"Fire every ticket before the timer burns out and earn the Golden Ladle.\")\n        row(gap: 10) {\n            badge(\"Order rush\")\n            badge(\"Combo plating\")\n            badge(\"Golden Ladle\")\n        }\n        card(padding: 18) {\n            title(\"Orders done\", size: 20)\n            text(\"Plate a dish and send it out hot.\")\n            button(\"Serve dish: \" + ordersDone) {\n                ordersDone = ordersDone + 1\n                print(\"Orders done\", ordersDone)\n            }\n        }\n        card(padding: 18) {\n            title(\"Combo\", size: 20)\n            text(\"Fast plates chain the rush combo.\")\n            button(\"Chain plate: \" + combo) {\n                combo = combo + 1\n                print(\"Combo\", combo)\n            }\n        }\n        card(padding: 18) {\n            title(\"Tips\", size: 20)\n            text(\"Happy tables tip the kitchen.\")\n            button(\"Earn tip: \" + tips) {\n                tips = tips + 20\n                print(\"Tips\", tips)\n            }\n        }\n        card(padding: 18) {\n            title(\"Ladle stars\", size: 20)\n            text(\"Perfect nights earn Golden Ladle stars.\")\n            button(\"Earn star: \" + ladleStars) {\n                ladleStars = ladleStars + 1\n                print(\"Ladle stars\", ladleStars)\n            }\n        }\n        card(padding: 18) {\n            title(\"How it works\", size: 20)\n            text(\"WASD — run the kitchen\")\n            text(\"E — cook / plate\")\n            text(\"F — ring the ticket bell\")\n            text(\"Shift — rush between stations\")\n        }\n    }\n}\n\npage \"Guide\" {\n    column(gap: 12) {\n        title(\"Chef Rush 3D Guide\", size: 26)\n        paragraph(\"Everything in Chef Rush 3D runs on live Orvexa state. Use the Home cards to drive the numbers, then open Scene or World view to explore the 3D set.\")\n        text(\"Orders done — Plate a dish and send it out hot.\")\n        text(\"Combo — Fast plates chain the rush combo.\")\n        text(\"Tips — Happy tables tip the kitchen.\")\n        text(\"Ladle stars — Perfect nights earn Golden Ladle stars.\")\n        button(\"Celebrate progress\") {\n            print(\"Guide celebration for Chef Rush 3D\")\n        }\n    }\n}\n\nprint(\"Chef Rush 3D ready — open Scene or World and press Play.\")\n", "playable": true, "controls": ["WASD — run the kitchen", "E — cook / plate"], "objectCount": 20},
  {"id": "pet-rescue-adventure", "name": "Pet Rescue Adventure", "title": "Pet Rescue Adventure", "genre": "Rescue adventure", "description": "Rescue lost pets across a sunny valley: treats, trails, the shelter and happy reunions.", "difficulty": "beginner", "accent": "#ffd94a", "source": "app \"Pet Rescue Adventure\"\n\nstate petsRescued = 0\nstate treats = 10\nstate friendship = 0\nstate shelterBeds = 4\nstate reunions = 0\n\nscene \"Pet Rescue Adventure Scene\" {\n    camera(position: vec3(0, 2.6, 9))\n    light(position: vec3(3, 6, 4), color: \"#ff8ac2\")\n    light(position: vec3(-4, 3, -2), color: \"#ffd94a\")\n    plane(\"Ground\", position: vec3(0, -1.1, 0), size: 18, color: \"#24381f\")\n    cube(\"Shelter Gate\", position: vec3(-3.82, 0, -0.2), size: 0.7, color: \"#ffd94a\")\n    sphere(\"Lost Puppy Rock\", position: vec3(-1.36, 0.8, -0.2), radius: 0.42, color: \"#ff8ac2\")\n    torus(\"Treat Basket\", position: vec3(-0.3, 0.4, -0.2), size: 1.1, color: \"#3ddc97\")\n    cylinder(\"Healing Den\", position: vec3(2.16, 0, -0.2), size: 0.6, color: \"#35502c\")\n    cube(\"Kitten Tree\", position: vec3(3.22, 0.4, -0.2), size: 1.3, color: \"#ffd94a\")\n    sphere(\"Trail Sign One\", position: vec3(-3.82, 0.4, -2.5), radius: 0.42, color: \"#ff8ac2\")\n    torus(\"Duck Pond\", position: vec3(-1.36, 0.4, -2.5), size: 0.9, color: \"#3ddc97\")\n    cylinder(\"Agility Ring\", position: vec3(-0.3, 0.4, -2.5), size: 1.1, color: \"#35502c\")\n    cube(\"Vet Clinic\", position: vec3(2.16, 0, -2.5), size: 0.6, color: \"#ffd94a\")\n    sphere(\"Reunion Arch\", position: vec3(3.22, 0.4, -2.5), radius: 0.42, color: \"#ff8ac2\")\n    torus(\"Ball Pit\", position: vec3(-3.82, 0.8, -4.8), size: 0.7, color: \"#3ddc97\")\n    cylinder(\"Lantern Path\", position: vec3(-1.36, 0, -4.8), size: 0.9, color: \"#35502c\")\n    material(\"Lost Puppy Rock\", metallic: 0.45, roughness: 0.28, emissive: 0.06)\n    animate(\"Treat Basket\", rotation: vec3(0, 1, 0), speed: 0.7)\n    controller(\"Lost Puppy Rock\", speed: 3.4, jumpSpeed: 5)\n    rigidbody(\"Healing Den\", mass: 1, restitution: 0.45, friction: 0.6, gravity: vec3(0, 1, 0), speed: 0.8)\n}\n\npage \"Home\" {\n    column(gap: 14) {\n        badge(\"SUNNY VALLEY · PET RESCUE\")\n        title(\"Pet Rescue Adventure\", size: 34)\n        paragraph(\"Find every lost pet, heal them at the shelter and reunite them with their families.\")\n        row(gap: 10) {\n            badge(\"Pet rescue\")\n            badge(\"Treat trails\")\n            badge(\"Reunions\")\n        }\n        card(padding: 18) {\n            title(\"Pets rescued\", size: 20)\n            text(\"Bring a lost pet safely home.\")\n            button(\"Rescue pet: \" + petsRescued) {\n                petsRescued = petsRescued + 1\n                print(\"Pets rescued\", petsRescued)\n            }\n        }\n        card(padding: 18) {\n            title(\"Treats\", size: 20)\n            text(\"Treats win shy pets over.\")\n            button(\"Collect treats: \" + treats) {\n                treats = treats + 3\n                print(\"Treats\", treats)\n            }\n        }\n        card(padding: 18) {\n            title(\"Friendship\", size: 20)\n            text(\"Gentle care grows pet friendship.\")\n            button(\"Bond with pet: \" + friendship) {\n                friendship = friendship + 5\n                print(\"Friendship\", friendship)\n            }\n        }\n        card(padding: 18) {\n            title(\"Reunions\", size: 20)\n            text(\"Match pets to families for reunions.\")\n            button(\"Reunite family: \" + reunions) {\n                reunions = reunions + 1\n                print(\"Reunions\", reunions)\n            }\n        }\n        card(padding: 18) {\n            title(\"How it works\", size: 20)\n            text(\"WASD — explore the valley\")\n            text(\"E — call / rescue pet\")\n            text(\"F — offer a treat\")\n            text(\"B — open the shelter\")\n        }\n    }\n}\n\npage \"Guide\" {\n    column(gap: 12) {\n        title(\"Pet Rescue Adventure Guide\", size: 26)\n        paragraph(\"Everything in Pet Rescue Adventure runs on live Orvexa state. Use the Home cards to drive the numbers, then open Scene or World view to explore the 3D set.\")\n        text(\"Pets rescued — Bring a lost pet safely home.\")\n        text(\"Treats — Treats win shy pets over.\")\n        text(\"Friendship — Gentle care grows pet friendship.\")\n        text(\"Reunions — Match pets to families for reunions.\")\n        button(\"Celebrate progress\") {\n            print(\"Guide celebration for Pet Rescue Adventure\")\n        }\n    }\n}\n\nprint(\"Pet Rescue Adventure ready — open Scene or World and press Play.\")\n", "playable": true, "controls": ["WASD — explore the valley", "E — call / rescue pet"], "objectCount": 20},
  {"id": "castle-builder-tycoon", "name": "Castle Builder Tycoon", "title": "Castle Builder Tycoon", "genre": "Builder tycoon", "description": "Raise a tiny keep into a legendary castle: quarries, towers, banners and royal festivals.", "difficulty": "beginner", "accent": "#eab96d", "source": "app \"Castle Builder Tycoon\"\n\nstate stone = 40\nstate towers = 1\nstate gold = 25\nstate banners = 0\nstate royalStars = 0\n\nscene \"Castle Builder Tycoon Scene\" {\n    camera(position: vec3(0, 2.6, 9))\n    light(position: vec3(3, 6, 4), color: \"#9aa3b0\")\n    light(position: vec3(-4, 3, -2), color: \"#eab96d\")\n    plane(\"Ground\", position: vec3(0, -1.1, 0), size: 18, color: \"#2c2c26\")\n    sphere(\"Keep Foundation\", position: vec3(-3.82, 0.4, -0.2), radius: 0.42, color: \"#9aa3b0\")\n    torus(\"Quarry Pit\", position: vec3(-1.36, 0.8, -0.2), size: 0.9, color: \"#c88a4a\")\n    cylinder(\"Tower One\", position: vec3(-0.3, 0, -0.2), size: 1.1, color: \"#3d3a30\")\n    cube(\"Blacksmith Forge\", position: vec3(2.16, 0, -0.2), size: 0.6, color: \"#eab96d\")\n    sphere(\"Banner Pole\", position: vec3(3.22, 0.8, -0.2), radius: 0.42, color: \"#9aa3b0\")\n    torus(\"Moat Bridge\", position: vec3(-3.82, 0.4, -2.5), size: 0.7, color: \"#c88a4a\")\n    cylinder(\"Royal Hall\", position: vec3(-1.36, 0, -2.5), size: 0.9, color: \"#3d3a30\")\n    cube(\"Guard Barracks\", position: vec3(-0.3, 0.4, -2.5), size: 1.1, color: \"#eab96d\")\n    sphere(\"Festival Ground\", position: vec3(2.16, 0.4, -2.5), radius: 0.42, color: \"#9aa3b0\")\n    torus(\"Dragon Banner\", position: vec3(3.22, 0.4, -2.5), size: 1.3, color: \"#c88a4a\")\n    cylinder(\"Throne Steps\", position: vec3(-3.82, 0.4, -4.8), size: 0.7, color: \"#3d3a30\")\n    cube(\"Clocktower\", position: vec3(-1.36, 0, -4.8), size: 0.9, color: \"#eab96d\")\n    material(\"Quarry Pit\", metallic: 0.45, roughness: 0.28, emissive: 0.06)\n    animate(\"Tower One\", rotation: vec3(0, 1, 0), speed: 0.7)\n    controller(\"Quarry Pit\", speed: 3.4, jumpSpeed: 5)\n    rigidbody(\"Blacksmith Forge\", mass: 1, restitution: 0.45, friction: 0.6, gravity: vec3(0, 1, 0), speed: 0.8)\n}\n\npage \"Home\" {\n    column(gap: 14) {\n        badge(\"STONEVALE · BUILDER TYCOON\")\n        title(\"Castle Builder Tycoon\", size: 34)\n        paragraph(\"Quarry stone, raise towers and host the royal festival in a legendary castle.\")\n        row(gap: 10) {\n            badge(\"Quarry loop\")\n            badge(\"Tower raising\")\n            badge(\"Royal festival\")\n        }\n        card(padding: 18) {\n            title(\"Stone\", size: 20)\n            text(\"Quarry blocks for every wall.\")\n            button(\"Quarry stone: \" + stone) {\n                stone = stone + 20\n                print(\"Stone\", stone)\n            }\n        }\n        card(padding: 18) {\n            title(\"Towers\", size: 20)\n            text(\"Raise a tower to guard the vale.\")\n            button(\"Build tower: \" + towers) {\n                towers = towers + 1\n                print(\"Towers\", towers)\n            }\n        }\n        card(padding: 18) {\n            title(\"Gold\", size: 20)\n            text(\"Taxes and festivals fill the vault.\")\n            button(\"Earn gold: \" + gold) {\n                gold = gold + 30\n                print(\"Gold\", gold)\n            }\n        }\n        card(padding: 18) {\n            title(\"Royal stars\", size: 20)\n            text(\"Festivals earn royal approval stars.\")\n            button(\"Host festival: \" + royalStars) {\n                royalStars = royalStars + 1\n                print(\"Royal stars\", royalStars)\n            }\n        }\n        card(padding: 18) {\n            title(\"How it works\", size: 20)\n            text(\"WASD — walk the castle grounds\")\n            text(\"E — build / quarry\")\n            text(\"F — raise a banner\")\n            text(\"B — open the builder scroll\")\n        }\n    }\n}\n\npage \"Guide\" {\n    column(gap: 12) {\n        title(\"Castle Builder Tycoon Guide\", size: 26)\n        paragraph(\"Everything in Castle Builder Tycoon runs on live Orvexa state. Use the Home cards to drive the numbers, then open Scene or World view to explore the 3D set.\")\n        text(\"Stone — Quarry blocks for every wall.\")\n        text(\"Towers — Raise a tower to guard the vale.\")\n        text(\"Gold — Taxes and festivals fill the vault.\")\n        text(\"Royal stars — Festivals earn royal approval stars.\")\n        button(\"Celebrate progress\") {\n            print(\"Guide celebration for Castle Builder Tycoon\")\n        }\n    }\n}\n\nprint(\"Castle Builder Tycoon ready — open Scene or World and press Play.\")\n", "playable": true, "controls": ["WASD — walk the castle grounds", "E — build / quarry"], "objectCount": 20},
  {"id": "submarine-treasure-hunt", "name": "Submarine Treasure Hunt", "title": "Submarine Treasure Hunt", "genre": "Underwater adventure", "description": "Pilot a tiny sub through coral canyons: pearls, shipwrecks, sonar pings and the Kraken Chest.", "difficulty": "beginner", "accent": "#56b6ff", "source": "app \"Submarine Treasure Hunt\"\n\nstate pearls = 0\nstate wrecksFound = 0\nstate oxygen = 100\nstate sonarPings = 0\nstate treasureGold = 0\n\nscene \"Submarine Treasure Hunt Scene\" {\n    camera(position: vec3(0, 2.6, 9))\n    light(position: vec3(3, 6, 4), color: \"#ffd94a\")\n    light(position: vec3(-4, 3, -2), color: \"#56b6ff\")\n    plane(\"Ground\", position: vec3(0, -1.1, 0), size: 18, color: \"#10222e\")\n    torus(\"Dock Crane\", position: vec3(-3.82, 0.4, -0.2), size: 0.7, color: \"#3ddc97\")\n    cylinder(\"Coral Arch One\", position: vec3(-1.36, 0.4, -0.2), size: 0.9, color: \"#1d3a4a\")\n    cube(\"Pearl Clam\", position: vec3(-0.3, 0, -0.2), size: 1.1, color: \"#56b6ff\")\n    sphere(\"Sunken Galleon\", position: vec3(2.16, 0.4, -0.2), radius: 0.42, color: \"#ffd94a\")\n    torus(\"Sonar Buoy\", position: vec3(3.22, 0.8, -0.2), size: 1.3, color: \"#3ddc97\")\n    cylinder(\"Kelp Forest\", position: vec3(-3.82, 0, -2.5), size: 0.7, color: \"#1d3a4a\")\n    cube(\"Anchor Ruin\", position: vec3(-1.36, 0, -2.5), size: 0.9, color: \"#56b6ff\")\n    sphere(\"Treasure Cave\", position: vec3(-0.3, 0.8, -2.5), radius: 0.42, color: \"#ffd94a\")\n    torus(\"Turtle Rocks\", position: vec3(2.16, 0.4, -2.5), size: 0.6, color: \"#3ddc97\")\n    cylinder(\"Kraken Chest\", position: vec3(3.22, 0, -2.5), size: 1.3, color: \"#1d3a4a\")\n    cube(\"Lighthouse Beam\", position: vec3(-3.82, 0.4, -4.8), size: 0.7, color: \"#56b6ff\")\n    sphere(\"Return Beacon\", position: vec3(-1.36, 0.4, -4.8), radius: 0.42, color: \"#ffd94a\")\n    material(\"Coral Arch One\", metallic: 0.45, roughness: 0.28, emissive: 0.06)\n    animate(\"Pearl Clam\", rotation: vec3(0, 1, 0), speed: 0.7)\n    controller(\"Coral Arch One\", speed: 3.4, jumpSpeed: 5)\n    rigidbody(\"Sunken Galleon\", mass: 1, restitution: 0.45, friction: 0.6, gravity: vec3(0, 1, 0), speed: 0.8)\n}\n\npage \"Home\" {\n    column(gap: 14) {\n        badge(\"CORAL DEEP · TREASURE HUNT\")\n        title(\"Submarine Treasure Hunt\", size: 34)\n        paragraph(\"Chart the coral canyons, ping the wrecks and raise the legendary Kraken Chest.\")\n        row(gap: 10) {\n            badge(\"Sonar pings\")\n            badge(\"Oxygen dives\")\n            badge(\"Kraken Chest\")\n        }\n        card(padding: 18) {\n            title(\"Pearls\", size: 20)\n            text(\"Clams hide shining pearls.\")\n            button(\"Collect pearls: \" + pearls) {\n                pearls = pearls + 2\n                print(\"Pearls\", pearls)\n            }\n        }\n        card(padding: 18) {\n            title(\"Wrecks found\", size: 20)\n            text(\"Sonar reveals sunken wrecks.\")\n            button(\"Find wreck: \" + wrecksFound) {\n                wrecksFound = wrecksFound + 1\n                print(\"Wrecks found\", wrecksFound)\n            }\n        }\n        card(padding: 18) {\n            title(\"Treasure gold\", size: 20)\n            text(\"Raise gold from the deep wrecks.\")\n            button(\"Raise gold: \" + treasureGold) {\n                treasureGold = treasureGold + 50\n                print(\"Treasure gold\", treasureGold)\n            }\n        }\n        card(padding: 18) {\n            title(\"Sonar pings\", size: 20)\n            text(\"Ping to reveal hidden caves.\")\n            button(\"Ping sonar: \" + sonarPings) {\n                sonarPings = sonarPings + 1\n                print(\"Sonar pings\", sonarPings)\n            }\n        }\n        card(padding: 18) {\n            title(\"How it works\", size: 20)\n            text(\"WASD — pilot the submarine\")\n            text(\"E — collect / open\")\n            text(\"F — sonar ping\")\n            text(\"Shift — surface for oxygen\")\n        }\n    }\n}\n\npage \"Guide\" {\n    column(gap: 12) {\n        title(\"Submarine Treasure Hunt Guide\", size: 26)\n        paragraph(\"Everything in Submarine Treasure Hunt runs on live Orvexa state. Use the Home cards to drive the numbers, then open Scene or World view to explore the 3D set.\")\n        text(\"Pearls — Clams hide shining pearls.\")\n        text(\"Wrecks found — Sonar reveals sunken wrecks.\")\n        text(\"Treasure gold — Raise gold from the deep wrecks.\")\n        text(\"Sonar pings — Ping to reveal hidden caves.\")\n        button(\"Celebrate progress\") {\n            print(\"Guide celebration for Submarine Treasure Hunt\")\n        }\n    }\n}\n\nprint(\"Submarine Treasure Hunt ready — open Scene or World and press Play.\")\n", "playable": true, "controls": ["WASD — pilot the submarine", "E — collect / open"], "objectCount": 20},
  {"id": "wizard-spell-arena", "name": "Wizard Spell Arena", "title": "Wizard Spell Arena", "genre": "Spell duel arena", "description": "Duel rival wizards in a floating rune arena: spell combos, mana crystals and the Archmage Cup.", "difficulty": "beginner", "accent": "#c88aff", "source": "app \"Wizard Spell Arena\"\n\nstate duelsWon = 0\nstate mana = 50\nstate comboSpells = 0\nstate crystals = 0\nstate cupPoints = 0\n\nscene \"Wizard Spell Arena Scene\" {\n    camera(position: vec3(0, 2.6, 9))\n    light(position: vec3(3, 6, 4), color: \"#56f0e8\")\n    light(position: vec3(-4, 3, -2), color: \"#c88aff\")\n    plane(\"Ground\", position: vec3(0, -1.1, 0), size: 18, color: \"#241c38\")\n    torus(\"Arena Gate Rune\", position: vec3(-3.82, 0.4, -0.2), size: 0.7, color: \"#ffd94a\")\n    cylinder(\"Mana Crystal One\", position: vec3(-1.36, 0.4, -0.2), size: 0.9, color: \"#3a2c5e\")\n    cube(\"Spell Circle\", position: vec3(-0.3, 0, -0.2), size: 1.1, color: \"#c88aff\")\n    sphere(\"Floating Isle A\", position: vec3(2.16, 0.4, -0.2), radius: 0.42, color: \"#56f0e8\")\n    torus(\"Rival Tower\", position: vec3(3.22, 0.8, -0.2), size: 1.3, color: \"#ffd94a\")\n    cylinder(\"Potion Shelf\", position: vec3(-3.82, 0, -2.5), size: 0.7, color: \"#3a2c5e\")\n    cube(\"Rune Pillar East\", position: vec3(-1.36, 0, -2.5), size: 0.9, color: \"#c88aff\")\n    sphere(\"Storm Orb\", position: vec3(-0.3, 0.8, -2.5), radius: 0.42, color: \"#56f0e8\")\n    torus(\"Archmage Throne\", position: vec3(2.16, 0.4, -2.5), size: 0.6, color: \"#ffd94a\")\n    cylinder(\"Spellbook Stand\", position: vec3(3.22, 0, -2.5), size: 1.3, color: \"#3a2c5e\")\n    cube(\"Victory Cup\", position: vec3(-3.82, 0.4, -4.8), size: 0.7, color: \"#c88aff\")\n    sphere(\"Star Bridge\", position: vec3(-1.36, 0.4, -4.8), radius: 0.42, color: \"#56f0e8\")\n    material(\"Mana Crystal One\", metallic: 0.45, roughness: 0.28, emissive: 0.06)\n    animate(\"Spell Circle\", rotation: vec3(0, 1, 0), speed: 0.7)\n    controller(\"Mana Crystal One\", speed: 3.4, jumpSpeed: 5)\n    rigidbody(\"Floating Isle A\", mass: 1, restitution: 0.45, friction: 0.6, gravity: vec3(0, 1, 0), speed: 0.8)\n}\n\npage \"Home\" {\n    column(gap: 14) {\n        badge(\"RUNE SKY · SPELL ARENA\")\n        title(\"Wizard Spell Arena\", size: 34)\n        paragraph(\"Chain spell combos, shatter mana crystals and lift the Archmage Cup.\")\n        row(gap: 10) {\n            badge(\"Spell combos\")\n            badge(\"Mana crystals\")\n            badge(\"Archmage Cup\")\n        }\n        card(padding: 18) {\n            title(\"Duels won\", size: 20)\n            text(\"Win a spell duel in the arena.\")\n            button(\"Win duel: \" + duelsWon) {\n                duelsWon = duelsWon + 1\n                print(\"Duels won\", duelsWon)\n            }\n        }\n        card(padding: 18) {\n            title(\"Mana crystals\", size: 20)\n            text(\"Shatter crystals to refill mana.\")\n            button(\"Collect crystal: \" + crystals) {\n                crystals = crystals + 1\n                print(\"Mana crystals\", crystals)\n            }\n        }\n        card(padding: 18) {\n            title(\"Combo spells\", size: 20)\n            text(\"Chain elements for combo damage.\")\n            button(\"Chain spell: \" + comboSpells) {\n                comboSpells = comboSpells + 1\n                print(\"Combo spells\", comboSpells)\n            }\n        }\n        card(padding: 18) {\n            title(\"Cup points\", size: 20)\n            text(\"Wins bank Archmage Cup points.\")\n            button(\"Bank points: \" + cupPoints) {\n                cupPoints = cupPoints + 25\n                print(\"Cup points\", cupPoints)\n            }\n        }\n        card(padding: 18) {\n            title(\"How it works\", size: 20)\n            text(\"WASD — glide around the arena\")\n            text(\"Space — cast spell\")\n            text(\"E — collect crystals\")\n            text(\"Shift — blink dash\")\n        }\n    }\n}\n\npage \"Guide\" {\n    column(gap: 12) {\n        title(\"Wizard Spell Arena Guide\", size: 26)\n        paragraph(\"Everything in Wizard Spell Arena runs on live Orvexa state. Use the Home cards to drive the numbers, then open Scene or World view to explore the 3D set.\")\n        text(\"Duels won — Win a spell duel in the arena.\")\n        text(\"Mana crystals — Shatter crystals to refill mana.\")\n        text(\"Combo spells — Chain elements for combo damage.\")\n        text(\"Cup points — Wins bank Archmage Cup points.\")\n        button(\"Celebrate progress\") {\n            print(\"Guide celebration for Wizard Spell Arena\")\n        }\n    }\n}\n\nprint(\"Wizard Spell Arena ready — open Scene or World and press Play.\")\n", "playable": true, "controls": ["WASD — glide around the arena", "Space — cast spell"], "objectCount": 20},
  {"id": "delivery-dash-city", "name": "Delivery Dash City", "title": "Delivery Dash City", "genre": "City delivery rush", "description": "Dash hot meals across a lively city: scooters, shortcuts, happy customers and five-star streaks.", "difficulty": "beginner", "accent": "#ffd94a", "source": "app \"Delivery Dash City\"\n\nstate deliveries = 0\nstate starStreak = 0\nstate tips = 0\nstate hotBonus = 0\nstate legendPoints = 0\n\nscene \"Delivery Dash City Scene\" {\n    camera(position: vec3(0, 2.6, 9))\n    light(position: vec3(3, 6, 4), color: \"#ff6b6b\")\n    light(position: vec3(-4, 3, -2), color: \"#ffd94a\")\n    plane(\"Ground\", position: vec3(0, -1.1, 0), size: 18, color: \"#20242e\")\n    cylinder(\"Restaurant Hub\", position: vec3(-3.82, 0, -0.2), size: 0.7, color: \"#323a4a\")\n    cube(\"Scooter Park\", position: vec3(-1.36, 0.4, -0.2), size: 0.9, color: \"#ffd94a\")\n    sphere(\"Customer Tower A\", position: vec3(-0.3, 0.4, -0.2), radius: 0.42, color: \"#ff6b6b\")\n    torus(\"Shortcut Alley\", position: vec3(2.16, 0.4, -0.2), size: 0.6, color: \"#3ddc97\")\n    cylinder(\"Traffic Light One\", position: vec3(3.22, 0.4, -0.2), size: 1.3, color: \"#323a4a\")\n    cube(\"Hot Box Station\", position: vec3(-3.82, 0, -2.5), size: 0.7, color: \"#ffd94a\")\n    sphere(\"Rooftop Garden\", position: vec3(-1.36, 0.4, -2.5), radius: 0.42, color: \"#ff6b6b\")\n    torus(\"Five Star Arch\", position: vec3(-0.3, 0.8, -2.5), size: 1.1, color: \"#3ddc97\")\n    cylinder(\"Rain Shelter\", position: vec3(2.16, 0, -2.5), size: 0.6, color: \"#323a4a\")\n    cube(\"Market Square\", position: vec3(3.22, 0, -2.5), size: 1.3, color: \"#ffd94a\")\n    sphere(\"Legend Statue\", position: vec3(-3.82, 0.8, -4.8), radius: 0.42, color: \"#ff6b6b\")\n    torus(\"Night Kiosk\", position: vec3(-1.36, 0.4, -4.8), size: 0.9, color: \"#3ddc97\")\n    material(\"Scooter Park\", metallic: 0.45, roughness: 0.28, emissive: 0.06)\n    animate(\"Customer Tower A\", rotation: vec3(0, 1, 0), speed: 0.7)\n    controller(\"Scooter Park\", speed: 3.4, jumpSpeed: 5)\n    rigidbody(\"Shortcut Alley\", mass: 1, restitution: 0.45, friction: 0.6, gravity: vec3(0, 1, 0), speed: 0.8)\n}\n\npage \"Home\" {\n    column(gap: 14) {\n        badge(\"YUM CITY · DELIVERY DASH\")\n        title(\"Delivery Dash City\", size: 34)\n        paragraph(\"Deliver every order hot, keep the five-star streak and become the city's dash legend.\")\n        row(gap: 10) {\n            badge(\"Hot deliveries\")\n            badge(\"Star streaks\")\n            badge(\"City shortcuts\")\n        }\n        card(padding: 18) {\n            title(\"Deliveries\", size: 20)\n            text(\"Drop a hot order at the door.\")\n            button(\"Deliver order: \" + deliveries) {\n                deliveries = deliveries + 1\n                print(\"Deliveries\", deliveries)\n            }\n        }\n        card(padding: 18) {\n            title(\"Star streak\", size: 20)\n            text(\"Fast drops grow the star streak.\")\n            button(\"Keep streak: \" + starStreak) {\n                starStreak = starStreak + 1\n                print(\"Star streak\", starStreak)\n            }\n        }\n        card(padding: 18) {\n            title(\"Tips\", size: 20)\n            text(\"Happy customers tip the dash.\")\n            button(\"Earn tip: \" + tips) {\n                tips = tips + 15\n                print(\"Tips\", tips)\n            }\n        }\n        card(padding: 18) {\n            title(\"Legend points\", size: 20)\n            text(\"Streaks bank dash legend points.\")\n            button(\"Bank points: \" + legendPoints) {\n                legendPoints = legendPoints + 20\n                print(\"Legend points\", legendPoints)\n            }\n        }\n        card(padding: 18) {\n            title(\"How it works\", size: 20)\n            text(\"WASD — ride the scooter\")\n            text(\"E — pick up / drop order\")\n            text(\"Shift — shortcut boost\")\n            text(\"R — new delivery run\")\n        }\n    }\n}\n\npage \"Guide\" {\n    column(gap: 12) {\n        title(\"Delivery Dash City Guide\", size: 26)\n        paragraph(\"Everything in Delivery Dash City runs on live Orvexa state. Use the Home cards to drive the numbers, then open Scene or World view to explore the 3D set.\")\n        text(\"Deliveries — Drop a hot order at the door.\")\n        text(\"Star streak — Fast drops grow the star streak.\")\n        text(\"Tips — Happy customers tip the dash.\")\n        text(\"Legend points — Streaks bank dash legend points.\")\n        button(\"Celebrate progress\") {\n            print(\"Guide celebration for Delivery Dash City\")\n        }\n    }\n}\n\nprint(\"Delivery Dash City ready — open Scene or World and press Play.\")\n", "playable": true, "controls": ["WASD — ride the scooter", "E — pick up / drop order"], "objectCount": 20}
]);

export const WEB_APP_TEMPLATES = Object.freeze([
  {
    id: "ai-saas", name: "AI SaaS Landing", title: "LumenAI SaaS Platform", category: "SaaS", description: "A launch-ready AI product platform with pricing tiers, live metrics and a conversion hero.",
    source: `app "LumenAI SaaS Platform"

state signups = 12840
state apiCalls = 482000
state activeTier = 2

scene "LumenAI SaaS Platform Showroom" {
    camera(position: vec3(0, 2.4, 8))
    light(position: vec3(3, 6, 4), color: "#fff2dc")
    plane("Showroom Floor", position: vec3(0, -1.1, 0), size: 14, color: "#232946")
    cube("Lumen Core", position: vec3(-2.4, 0, 0.0), size: 0.8, color: "#7c5cff")
    sphere("Model Orb A", position: vec3(-0.8, 0.3, 0.0), radius: 0.42, color: "#48e5e5")
    torus("Model Orb B", position: vec3(0.8, 0, 0.0), size: 1.0, color: "#56f0e8")
    cylinder("Training Ring", position: vec3(2.4, 0, 0.0), size: 0.9, color: "#7c5cff")
    cube("Inference Pillar", position: vec3(-2.4, 0, -1.8), size: 0.8, color: "#48e5e5")
    sphere("Data Crystal", position: vec3(-0.8, 0.3, -1.8), radius: 0.42, color: "#56f0e8")
    torus("Eval Halo", position: vec3(0.8, 0, -1.8), size: 1.0, color: "#7c5cff")
    cylinder("Edge Node", position: vec3(2.4, 0, -1.8), size: 0.9, color: "#48e5e5")
    material("Lumen Core", metallic: 0.45, roughness: 0.28, emissive: 0.06)
    animate("Edge Node", rotation: vec3(0, 1, 0), speed: 0.6)
}

page "Home" {
    column(gap: 16) {
        badge("LUMENAI · AI PLATFORM")
        title("LumenAI SaaS Platform", size: 34)
        paragraph("Ship AI features in an afternoon: hosted models, zero-key free tier, and usage analytics your CFO will love.")
        row(gap: 10) {
            badge("Free tier")
            badge("SOC2")
            badge("99.99% uptime")
        }
        card(padding: 18) {
            title("Signups", size: 20)
            text("Free-tier teams who shipped this week.")
            button("Join free: " + signups) {
                signups = signups + 37
                print("Signups", signups)
            }
        }
        card(padding: 18) {
            title("API calls served", size: 20)
            text("Median latency 84 ms across 40 regions.")
            button("Simulate traffic: " + apiCalls) {
                apiCalls = apiCalls + 1200
                print("API calls served", apiCalls)
            }
        }
        card(padding: 18) {
            title("Pricing tier", size: 20)
            text("Starter free · Pro usage-based · Enterprise SSO.")
            button("Upgrade tier: " + activeTier) {
                activeTier = activeTier + 1
                print("Pricing tier", activeTier)
            }
        }
        card(padding: 18) {
            title("Zero-key playground", size: 19)
            text("The Free Built-In AI tier needs no card and no key — upgrade only when traffic does.")
        }
        card(padding: 18) {
            title("Guardrails built in", size: 19)
            text("PII redaction, prompt-injection shields and audit logs on every request.")
        }
        card(padding: 18) {
            title("One-line integration", size: 19)
            text("Drop the Orvexa widget into any page and stream answers in under a minute.")
        }
        card(padding: 20) {
            title("Start building free", size: 22)
            text("Your first 10,000 calls are on us. No credit card, no sales call.")
            button("Create my workspace") {
                print("cta: ai-saas signup")
            }
        }
    }
}

print("LumenAI SaaS Platform template ready — edit any line and press Run.")
`,
  },
  {
    id: "creator-portfolio", name: "Creator Portfolio", title: "Aria Vale — Creative Director", category: "Portfolio", description: "Showcase games, 3D models and art with a bold interactive creator portfolio and showroom scene.",
    source: `app "Aria Vale — Creative Director"

state projectViews = 9200
state commissions = 3
state awards = 7

scene "Aria Vale — Creative Director Showroom" {
    camera(position: vec3(0, 2.4, 8))
    light(position: vec3(3, 6, 4), color: "#fff2dc")
    plane("Showroom Floor", position: vec3(0, -1.1, 0), size: 14, color: "#2b2237")
    cube("Portfolio Hero Statue", position: vec3(-2.4, 0, 0.0), size: 0.8, color: "#ff6b9d")
    sphere("Aetherfall Diorama", position: vec3(-0.8, 0.3, 0.0), radius: 0.42, color: "#56f0e8")
    torus("Neon Racer Model", position: vec3(0.8, 0, 0.0), size: 1.0, color: "#eab96d")
    cylinder("Crystal Study", position: vec3(2.4, 0, 0.0), size: 0.9, color: "#ff6b9d")
    cube("Award Trophy", position: vec3(-2.4, 0, -1.8), size: 0.8, color: "#56f0e8")
    sphere("Showreel Ring", position: vec3(-0.8, 0.3, -1.8), radius: 0.42, color: "#eab96d")
    torus("Sketch Pillar", position: vec3(0.8, 0, -1.8), size: 1.0, color: "#ff6b9d")
    cylinder("Client Logo Block", position: vec3(2.4, 0, -1.8), size: 0.9, color: "#56f0e8")
    material("Portfolio Hero Statue", metallic: 0.45, roughness: 0.28, emissive: 0.06)
    animate("Client Logo Block", rotation: vec3(0, 1, 0), speed: 0.6)
}

page "Home" {
    column(gap: 16) {
        badge("PORTFOLIO · ARIA VALE")
        title("Aria Vale — Creative Director", size: 34)
        paragraph("Games, worlds and brands by an independent creative director. Every project below is playable in the browser.")
        row(gap: 10) {
            badge("Game Design")
            badge("3D Art")
            badge("Available Q3")
        }
        card(padding: 18) {
            title("Project views", size: 20)
            text("Recruiters and studios exploring the work.")
            button("View showreel: " + projectViews) {
                projectViews = projectViews + 120
                print("Project views", projectViews)
            }
        }
        card(padding: 18) {
            title("Open commissions", size: 20)
            text("Two game-art slots and one brand slot remain.")
            button("Book a slot: " + commissions) {
                commissions = commissions + 0
                print("Open commissions", commissions)
            }
        }
        card(padding: 18) {
            title("Industry awards", size: 20)
            text("Including Best World Design at IndieForge.")
            button("See awards: " + awards) {
                awards = awards + 0
                print("Industry awards", awards)
            }
        }
        card(padding: 18) {
            title("Playable case studies", size: 19)
            text("Every case study embeds the actual Orvexa build — no screenshots, no vaporware.")
        }
        card(padding: 18) {
            title("Process breakdowns", size: 19)
            text("From greybox to Nanite-baked final, scroll the full production pipeline.")
        }
        card(padding: 18) {
            title("Direct booking", size: 19)
            text("Calendar, rates and NDA-friendly contact in one click.")
        }
        card(padding: 20) {
            title("Commission Aria", size: 22)
            text("Booking new worlds for next quarter.")
            button("Start a project") {
                print("cta: portfolio commission")
            }
        }
    }
}

print("Aria Vale — Creative Director template ready — edit any line and press Run.")
`,
  },
  {
    id: "product-customizer", name: "3D Product Customizer", title: "Velocity Sneaker Configurator", category: "Commerce", description: "Let shoppers recolour and configure a product in 3D, then bake the material live.",
    source: `app "Velocity Sneaker Configurator"

state configuredPrice = 180
state colourway = 1
state pairsSold = 4520

scene "Velocity Sneaker Configurator Showroom" {
    camera(position: vec3(0, 2.4, 8))
    light(position: vec3(3, 6, 4), color: "#fff2dc")
    plane("Showroom Floor", position: vec3(0, -1.1, 0), size: 14, color: "#26304a")
    cube("Velocity Runner", position: vec3(-2.4, 0, 0.0), size: 0.8, color: "#ff6b5e")
    sphere("Sole Unit", position: vec3(-0.8, 0.3, 0.0), radius: 0.42, color: "#48e5e5")
    torus("Lace Tower", position: vec3(0.8, 0, 0.0), size: 1.0, color: "#eab96d")
    cylinder("Colourway Orb Red", position: vec3(2.4, 0, 0.0), size: 0.9, color: "#ff6b5e")
    cube("Colourway Orb Teal", position: vec3(-2.4, 0, -1.8), size: 0.8, color: "#48e5e5")
    sphere("Colourway Orb Gold", position: vec3(-0.8, 0.3, -1.8), radius: 0.42, color: "#eab96d")
    torus("Display Ring", position: vec3(0.8, 0, -1.8), size: 1.0, color: "#ff6b5e")
    cylinder("Price Pedestal", position: vec3(2.4, 0, -1.8), size: 0.9, color: "#48e5e5")
    material("Velocity Runner", metallic: 0.45, roughness: 0.28, emissive: 0.06)
    animate("Price Pedestal", rotation: vec3(0, 1, 0), speed: 0.6)
}

page "Home" {
    column(gap: 16) {
        badge("VELOCITY · CONFIGURATOR")
        title("Velocity Sneaker Configurator", size: 34)
        paragraph("Spin the Velocity Runner, swap colourways, bake a material and check out — all without leaving the product page.")
        row(gap: 10) {
            badge("Live 3D")
            badge("Baked PBR")
            badge("Free shipping")
        }
        card(padding: 18) {
            title("Configured price ($)", size: 20)
            text("Carbon plate adds $40, knit upper included.")
            button("Add carbon plate: " + configuredPrice) {
                configuredPrice = configuredPrice + 40
                print("Configured price ($)", configuredPrice)
            }
        }
        card(padding: 18) {
            title("Colourway", size: 20)
            text("Six studio colourways baked as PBR maps.")
            button("Next colourway: " + colourway) {
                colourway = colourway + 1
                print("Colourway", colourway)
            }
        }
        card(padding: 18) {
            title("Pairs sold", size: 20)
            text("Limited midnight drop ends Sunday.")
            button("Reserve pair: " + pairsSold) {
                pairsSold = pairsSold + 1
                print("Pairs sold", pairsSold)
            }
        }
        card(padding: 18) {
            title("Real baked materials", size: 19)
            text("Material Lab graphs bake base, normal and emissive maps per colourway.")
        }
        card(padding: 18) {
            title("True-scale preview", size: 19)
            text("The showroom scene renders the exact export mesh, not a mock.")
        }
        card(padding: 18) {
            title("One-tap checkout", size: 19)
            text("Configuration, size and address in a single card flow.")
        }
        card(padding: 20) {
            title("Reserve your pair", size: 22)
            text("Midnight drop pricing ends soon.")
            button("Checkout") {
                print("cta: customizer checkout")
            }
        }
    }
}

print("Velocity Sneaker Configurator template ready — edit any line and press Run.")
`,
  },
  {
    id: "game-dashboard", name: "Game Dashboard", title: "Aetherfall Esports Command", category: "Games", description: "Player stats, tournament brackets and Sunshard telemetry in a live esports command center.",
    source: `app "Aetherfall Esports Command"

state viewers = 184000
state matchesLive = 12
state prizePool = 50000

scene "Aetherfall Esports Command Showroom" {
    camera(position: vec3(0, 2.4, 8))
    light(position: vec3(3, 6, 4), color: "#fff2dc")
    plane("Showroom Floor", position: vec3(0, -1.1, 0), size: 14, color: "#1d2b3a")
    cube("Trophy Core", position: vec3(-2.4, 0, 0.0), size: 0.8, color: "#eab96d")
    sphere("Bracket Pillar A", position: vec3(-0.8, 0.3, 0.0), radius: 0.42, color: "#48e5e5")
    torus("Bracket Pillar B", position: vec3(0.8, 0, 0.0), size: 1.0, color: "#ff6b9d")
    cylinder("Live Match Orb", position: vec3(2.4, 0, 0.0), size: 0.9, color: "#eab96d")
    cube("Telemetry Ring", position: vec3(-2.4, 0, -1.8), size: 0.8, color: "#48e5e5")
    sphere("Champion Statue", position: vec3(-0.8, 0.3, -1.8), radius: 0.42, color: "#ff6b9d")
    torus("Caster Desk", position: vec3(0.8, 0, -1.8), size: 1.0, color: "#eab96d")
    cylinder("Sponsor Halo", position: vec3(2.4, 0, -1.8), size: 0.9, color: "#48e5e5")
    material("Trophy Core", metallic: 0.45, roughness: 0.28, emissive: 0.06)
    animate("Sponsor Halo", rotation: vec3(0, 1, 0), speed: 0.6)
}

page "Home" {
    column(gap: 16) {
        badge("ESPORTS COMMAND CENTER")
        title("Aetherfall Esports Command", size: 34)
        paragraph("Live brackets, player telemetry and Sunshard economy for the Aetherfall championship circuit.")
        row(gap: 10) {
            badge("Live")
            badge("64 Teams")
            badge("Prize Pool $50K")
        }
        card(padding: 18) {
            title("Live viewers", size: 20)
            text("Championship Sunday peak across all regions.")
            button("Watch live: " + viewers) {
                viewers = viewers + 900
                print("Live viewers", viewers)
            }
        }
        card(padding: 18) {
            title("Matches live", size: 20)
            text("Bracket, telemetry and VOD in one grid.")
            button("Open match: " + matchesLive) {
                matchesLive = matchesLive + 1
                print("Matches live", matchesLive)
            }
        }
        card(padding: 18) {
            title("Prize pool ($)", size: 20)
            text("Sponsored by the Wayfarer Guild.")
            button("View breakdown: " + prizePool) {
                prizePool = prizePool + 0
                print("Prize pool ($)", prizePool)
            }
        }
        card(padding: 18) {
            title("Telemetry overlays", size: 19)
            text("APM, shard economy and dash cooldowns charted per player.")
        }
        card(padding: 18) {
            title("Fantasy league", size: 19)
            text("Draft pros, earn Sunshards, climb the global ladder.")
        }
        card(padding: 18) {
            title("Instant VOD chapters", size: 19)
            text("AI-tagged highlights searchable by play and player.")
        }
        card(padding: 20) {
            title("Enter the arena", size: 22)
            text("Fantasy drafts close at first blood.")
            button("Join fantasy league") {
                print("cta: dashboard join")
            }
        }
    }
}

print("Aetherfall Esports Command template ready — edit any line and press Run.")
`,
  },
  {
    id: "interactive-quiz", name: "Interactive Quiz", title: "Orvexa Academy Quiz Engine", category: "Education", description: "A gamified quiz and flashcard engine with streaks, levels and instant feedback.",
    source: `app "Orvexa Academy Quiz Engine"

state score = 0
state streak = 0
state level = 1
state cardsMastered = 0

scene "Orvexa Academy Quiz Engine Showroom" {
    camera(position: vec3(0, 2.4, 8))
    light(position: vec3(3, 6, 4), color: "#fff2dc")
    plane("Showroom Floor", position: vec3(0, -1.1, 0), size: 14, color: "#27354a")
    cube("Academy Mascot", position: vec3(-2.4, 0, 0.0), size: 0.8, color: "#62b26f")
    sphere("Question Orb", position: vec3(-0.8, 0.3, 0.0), radius: 0.42, color: "#ffb86b")
    torus("Flashcard Tower", position: vec3(0.8, 0, 0.0), size: 1.0, color: "#48e5e5")
    cylinder("Streak Flame", position: vec3(2.4, 0, 0.0), size: 0.9, color: "#62b26f")
    cube("Level Ring", position: vec3(-2.4, 0, -1.8), size: 0.8, color: "#ffb86b")
    sphere("Certificate Block", position: vec3(-0.8, 0.3, -1.8), radius: 0.42, color: "#48e5e5")
    torus("Library Pillar", position: vec3(0.8, 0, -1.8), size: 1.0, color: "#62b26f")
    cylinder("Boss Quiz Gate", position: vec3(2.4, 0, -1.8), size: 0.9, color: "#ffb86b")
    material("Academy Mascot", metallic: 0.45, roughness: 0.28, emissive: 0.06)
    animate("Boss Quiz Gate", rotation: vec3(0, 1, 0), speed: 0.6)
}

page "Home" {
    column(gap: 16) {
        badge("ORVEXA ACADEMY")
        title("Orvexa Academy Quiz Engine", size: 34)
        paragraph("Learn Orvexa, coding and world-building with streaks, flashcards and boss-level quizzes.")
        row(gap: 10) {
            badge("Streaks")
            badge("Flashcards")
            badge("Certificates")
        }
        card(padding: 18) {
            title("Score", size: 20)
            text("Correct answers bank XP toward the next level.")
            button("Answer correctly: " + score) {
                score = score + 10
                print("Score", score)
            }
        }
        card(padding: 18) {
            title("Day streak", size: 20)
            text("Daily quests keep the flame alive.")
            button("Extend streak: " + streak) {
                streak = streak + 1
                print("Day streak", streak)
            }
        }
        card(padding: 18) {
            title("Cards mastered", size: 20)
            text("Spaced repetition schedules your reviews.")
            button("Master card: " + cardsMastered) {
                cardsMastered = cardsMastered + 1
                print("Cards mastered", cardsMastered)
            }
        }
        card(padding: 18) {
            title("Adaptive difficulty", size: 19)
            text("Questions scale with your streak — boss quizzes at every fifth level.")
        }
        card(padding: 18) {
            title("Hinglish friendly", size: 19)
            text("Lessons and hints in English, Hindi and Hinglish.")
        }
        card(padding: 18) {
            title(" printable certificates", size: 19)
            text("Finish a track and export a shareable certificate.")
        }
        card(padding: 20) {
            title("Start learning free", size: 22)
            text("Your first track takes nine minutes.")
            button("Begin track 1") {
                print("cta: quiz start")
            }
        }
    }
}

print("Orvexa Academy Quiz Engine template ready — edit any line and press Run.")
`,
  },
  {
    id: "crypto-dex", name: "Web3 DEX Terminal", title: "NebulaSwap DeFi Terminal", category: "Web3", description: "A DeFi analytics and token swap terminal with liquidity pools and portfolio tracking.",
    source: `app "NebulaSwap DeFi Terminal"

state portfolioUsd = 12480
state gasGwei = 18
state poolApr = 24

scene "NebulaSwap DeFi Terminal Showroom" {
    camera(position: vec3(0, 2.4, 8))
    light(position: vec3(3, 6, 4), color: "#fff2dc")
    plane("Showroom Floor", position: vec3(0, -1.1, 0), size: 14, color: "#1a2436")
    cube("Nebula Core Token", position: vec3(-2.4, 0, 0.0), size: 0.8, color: "#8b79ff")
    sphere("Liquidity Orb", position: vec3(-0.8, 0.3, 0.0), radius: 0.42, color: "#56f0e8")
    torus("Swap Pillar", position: vec3(0.8, 0, 0.0), size: 1.0, color: "#eab96d")
    cylinder("Chart Ring", position: vec3(2.4, 0, 0.0), size: 0.9, color: "#8b79ff")
    cube("Vault Block", position: vec3(-2.4, 0, -1.8), size: 0.8, color: "#56f0e8")
    sphere("Oracle Crystal", position: vec3(-0.8, 0.3, -1.8), radius: 0.42, color: "#eab96d")
    torus("Staking Tower", position: vec3(0.8, 0, -1.8), size: 1.0, color: "#8b79ff")
    cylinder("Bridge Halo", position: vec3(2.4, 0, -1.8), size: 0.9, color: "#56f0e8")
    material("Nebula Core Token", metallic: 0.45, roughness: 0.28, emissive: 0.06)
    animate("Bridge Halo", rotation: vec3(0, 1, 0), speed: 0.6)
}

page "Home" {
    column(gap: 16) {
        badge("NEBULASWAP · DEFI TERMINAL")
        title("NebulaSwap DeFi Terminal", size: 34)
        paragraph("Swap, stake and chart the nebula economy with sub-second quotes and transparent pool analytics.")
        row(gap: 10) {
            badge("Non-custodial")
            badge("Audited")
            badge("0.25% fee")
        }
        card(padding: 18) {
            title("Portfolio ($)", size: 20)
            text("Tracked across three wallets and two chains.")
            button("Refresh portfolio: " + portfolioUsd) {
                portfolioUsd = portfolioUsd + 25
                print("Portfolio ($)", portfolioUsd)
            }
        }
        card(padding: 18) {
            title("Network gas (gwei)", size: 20)
            text("Live mempool estimate for instant swaps.")
            button("Recheck gas: " + gasGwei) {
                gasGwei = gasGwei + 1
                print("Network gas (gwei)", gasGwei)
            }
        }
        card(padding: 18) {
            title("Top pool APR (%)", size: 20)
            text("Nebula/ORV pair, audited and insured.")
            button("Stake now: " + poolApr) {
                poolApr = poolApr + 0
                print("Top pool APR (%)", poolApr)
            }
        }
        card(padding: 18) {
            title("Best-route swaps", size: 19)
            text("Quotes split across nine pools for minimal slippage.")
        }
        card(padding: 18) {
            title("Risk radar", size: 19)
            text("Contract audits, liquidity locks and whale alerts per token.")
        }
        card(padding: 18) {
            title("Tax-ready exports", size: 19)
            text("Every swap logged for one-click reporting.")
        }
        card(padding: 20) {
            title("Launch the terminal", size: 22)
            text("Connect a wallet or explore in read-only mode.")
            button("Open NebulaSwap") {
                print("cta: dex launch")
            }
        }
    }
}

print("NebulaSwap DeFi Terminal template ready — edit any line and press Run.")
`,
  },
  {
    id: "ecommerce-store", name: "Luxury Storefront", title: "Maison Orbit — Luxury Store", category: "Commerce", description: "A luxury 3D watch and streetwear storefront with curated drops and concierge checkout.",
    source: `app "Maison Orbit — Luxury Store"

state cartItems = 0
state dropEndsIn = 48
state members = 8200

scene "Maison Orbit — Luxury Store Showroom" {
    camera(position: vec3(0, 2.4, 8))
    light(position: vec3(3, 6, 4), color: "#fff2dc")
    plane("Showroom Floor", position: vec3(0, -1.1, 0), size: 14, color: "#2e2a33")
    cube("Orbit Chronograph", position: vec3(-2.4, 0, 0.0), size: 0.8, color: "#eab96d")
    sphere("Gold Display Pillar", position: vec3(-0.8, 0.3, 0.0), radius: 0.42, color: "#dfeaff")
    torus("Streetwear Mannequin", position: vec3(0.8, 0, 0.0), size: 1.0, color: "#ff6b9d")
    cylinder("Limited Sneaker Orb", position: vec3(2.4, 0, 0.0), size: 0.9, color: "#eab96d")
    cube("Salon Ring", position: vec3(-2.4, 0, -1.8), size: 0.8, color: "#dfeaff")
    sphere("Velvet Pedestal", position: vec3(-0.8, 0.3, -1.8), radius: 0.42, color: "#ff6b9d")
    torus("Heritage Watch", position: vec3(0.8, 0, -1.8), size: 1.0, color: "#eab96d")
    cylinder("Members Halo", position: vec3(2.4, 0, -1.8), size: 0.9, color: "#dfeaff")
    material("Orbit Chronograph", metallic: 0.45, roughness: 0.28, emissive: 0.06)
    animate("Members Halo", rotation: vec3(0, 1, 0), speed: 0.6)
}

page "Home" {
    column(gap: 16) {
        badge("MAISON ORBIT · PARIS")
        title("Maison Orbit — Luxury Store", size: 34)
        paragraph("Haute timepieces and limited streetwear, presented in a 3D salon with concierge checkout.")
        row(gap: 10) {
            badge("Limited Drops")
            badge("Concierge")
            badge("Insured Delivery")
        }
        card(padding: 18) {
            title("Cart items", size: 20)
            text("Concierge wraps every order by hand.")
            button("Add signature piece: " + cartItems) {
                cartItems = cartItems + 1
                print("Cart items", cartItems)
            }
        }
        card(padding: 18) {
            title("Drop ends (hours)", size: 20)
            text("The Orbit Chronograph drop is numbered to 300.")
            button("Set reminder: " + dropEndsIn) {
                dropEndsIn = dropEndsIn + 0
                print("Drop ends (hours)", dropEndsIn)
            }
        }
        card(padding: 18) {
            title("Members", size: 20)
            text("Early access opens 24 hours before public drops.")
            button("Join maison: " + members) {
                members = members + 15
                print("Members", members)
            }
        }
        card(padding: 18) {
            title("3D salon", size: 19)
            text("Inspect stitching, lume and case finishing in the showroom scene.")
        }
        card(padding: 18) {
            title("Numbered authenticity", size: 19)
            text("Every piece ships with a verifiable digital certificate.")
        }
        card(padding: 18) {
            title("White-glove delivery", size: 19)
            text("Insured, tracked and hand-delivered in 40 cities.")
        }
        card(padding: 20) {
            title("Shop the drop", size: 22)
            text("Numbered pieces sell out in hours.")
            button("Enter the salon") {
                print("cta: store enter")
            }
        }
    }
}

print("Maison Orbit — Luxury Store template ready — edit any line and press Run.")
`,
  },
  {
    id: "music-daw", name: "Music DAW Studio", title: "Waveforge Synth Studio", category: "Music", description: "A browser synth, drum machine and beatmaker studio with shareable loops.",
    source: `app "Waveforge Synth Studio"

state bpm = 128
state loopsSaved = 0
state plays = 3400

scene "Waveforge Synth Studio Showroom" {
    camera(position: vec3(0, 2.4, 8))
    light(position: vec3(3, 6, 4), color: "#fff2dc")
    plane("Showroom Floor", position: vec3(0, -1.1, 0), size: 14, color: "#33253a")
    cube("Master Synth", position: vec3(-2.4, 0, 0.0), size: 0.8, color: "#ff6b9d")
    sphere("Drum Pad Tower", position: vec3(-0.8, 0.3, 0.0), radius: 0.42, color: "#48e5e5")
    torus("Bass Orb", position: vec3(0.8, 0, 0.0), size: 1.0, color: "#ffb86b")
    cylinder("Sequencer Ring", position: vec3(2.4, 0, 0.0), size: 0.9, color: "#ff6b9d")
    cube("Waveform Pillar", position: vec3(-2.4, 0, -1.8), size: 0.8, color: "#48e5e5")
    sphere("Sampler Block", position: vec3(-0.8, 0.3, -1.8), radius: 0.42, color: "#ffb86b")
    torus("FX Halo", position: vec3(0.8, 0, -1.8), size: 1.0, color: "#ff6b9d")
    cylinder("Vinyl Pedestal", position: vec3(2.4, 0, -1.8), size: 0.9, color: "#48e5e5")
    material("Master Synth", metallic: 0.45, roughness: 0.28, emissive: 0.06)
    animate("Vinyl Pedestal", rotation: vec3(0, 1, 0), speed: 0.6)
}

page "Home" {
    column(gap: 16) {
        badge("WAVEFORGE · BROWSER DAW")
        title("Waveforge Synth Studio", size: 34)
        paragraph("Synths, drum pads and a step sequencer in your browser. Sketch a loop, export the WAV, share the vibe.")
        row(gap: 10) {
            badge("16 Pads")
            badge("WAV Export")
            badge("128 BPM")
        }
        card(padding: 18) {
            title("Tempo (BPM)", size: 20)
            text("Tap tempo or type it — everything quantizes.")
            button("Tempo up: " + bpm) {
                bpm = bpm + 2
                print("Tempo (BPM)", bpm)
            }
        }
        card(padding: 18) {
            title("Loops saved", size: 20)
            text("Your sketches live locally, export anytime.")
            button("Save loop: " + loopsSaved) {
                loopsSaved = loopsSaved + 1
                print("Loops saved", loopsSaved)
            }
        }
        card(padding: 18) {
            title("Community plays", size: 20)
            text("Shared loops charted every Friday.")
            button("Play trending: " + plays) {
                plays = plays + 40
                print("Community plays", plays)
            }
        }
        card(padding: 18) {
            title("Procedural synth engine", size: 19)
            text("The Orvexa AudioSynth renders every drum and bass note — no samples.")
        }
        card(padding: 18) {
            title("Step sequencer", size: 19)
            text("Sixteen steps, four tracks, swing and humanize controls.")
        }
        card(padding: 18) {
            title("One-click WAV", size: 19)
            text("Bounce your loop to a real .wav file instantly.")
        }
        card(padding: 20) {
            title("Make your first beat", size: 22)
            text("No install, no samples, no excuses.")
            button("Open Waveforge") {
                print("cta: daw open")
            }
        }
    }
}

print("Waveforge Synth Studio template ready — edit any line and press Run.")
`,
  },
  {
    id: "fitness-tracker", name: "Fitness AI Coach", title: "PulseFit AI Coach", category: "Health", description: "An AI workout, calorie and biometric coach with adaptive plans and recovery tracking.",
    source: `app "PulseFit AI Coach"

state calories = 420
state workoutStreak = 6
state recovery = 86

scene "PulseFit AI Coach Showroom" {
    camera(position: vec3(0, 2.4, 8))
    light(position: vec3(3, 6, 4), color: "#fff2dc")
    plane("Showroom Floor", position: vec3(0, -1.1, 0), size: 14, color: "#24352e")
    cube("Pulse Core", position: vec3(-2.4, 0, 0.0), size: 0.8, color: "#62e58b")
    sphere("Kettlebell Block", position: vec3(-0.8, 0.3, 0.0), radius: 0.42, color: "#ffb86b")
    torus("Recovery Orb", position: vec3(0.8, 0, 0.0), size: 1.0, color: "#48e5e5")
    cylinder("Streak Ring", position: vec3(2.4, 0, 0.0), size: 0.9, color: "#62e58b")
    cube("Mobility Pillar", position: vec3(-2.4, 0, -1.8), size: 0.8, color: "#ffb86b")
    sphere("Nutrition Crystal", position: vec3(-0.8, 0.3, -1.8), radius: 0.42, color: "#48e5e5")
    torus("Sleep Halo", position: vec3(0.8, 0, -1.8), size: 1.0, color: "#62e58b")
    cylinder("Goal Pedestal", position: vec3(2.4, 0, -1.8), size: 0.9, color: "#ffb86b")
    material("Pulse Core", metallic: 0.45, roughness: 0.28, emissive: 0.06)
    animate("Goal Pedestal", rotation: vec3(0, 1, 0), speed: 0.6)
}

page "Home" {
    column(gap: 16) {
        badge("PULSEFIT · AI COACH")
        title("PulseFit AI Coach", size: 34)
        paragraph("Adaptive workouts, calorie intelligence and recovery scores that learn from every session.")
        row(gap: 10) {
            badge("Adaptive")
            badge("Recovery")
            badge("Streaks")
        }
        card(padding: 18) {
            title("Calories burned", size: 20)
            text("Heart-rate zoned and device verified.")
            button("Log workout: " + calories) {
                calories = calories + 85
                print("Calories burned", calories)
            }
        }
        card(padding: 18) {
            title("Workout streak (days)", size: 20)
            text("Rest days count — recovery is training.")
            button("Complete today: " + workoutStreak) {
                workoutStreak = workoutStreak + 1
                print("Workout streak (days)", workoutStreak)
            }
        }
        card(padding: 18) {
            title("Recovery score (%)", size: 20)
            text("Sleep, HRV and soreness, one number.")
            button("Check recovery: " + recovery) {
                recovery = recovery + 1
                print("Recovery score (%)", recovery)
            }
        }
        card(padding: 18) {
            title("Adaptive plans", size: 19)
            text("Difficulty follows your recovery, not a rigid calendar.")
        }
        card(padding: 18) {
            title("Form cues", size: 19)
            text("Camera-based rep counting with gentle corrections.")
        }
        card(padding: 18) {
            title("Nutrition autopilot", size: 19)
            text("Meal targets recalculated nightly from your burn.")
        }
        card(padding: 20) {
            title("Start your streak", size: 22)
            text("First adaptive week is free.")
            button("Begin assessment") {
                print("cta: fitness start")
            }
        }
    }
}

print("PulseFit AI Coach template ready — edit any line and press Run.")
`,
  },
  {
    id: "kanban-workspace", name: "Kanban Workspace", title: "Flowboard Team Workspace", category: "Productivity", description: "An agile sprint, roadmap and docs workspace for small creative teams.",
    source: `app "Flowboard Team Workspace"

state tasksDone = 34
state sprintDay = 6
state blockedCards = 2

scene "Flowboard Team Workspace Showroom" {
    camera(position: vec3(0, 2.4, 8))
    light(position: vec3(3, 6, 4), color: "#fff2dc")
    plane("Showroom Floor", position: vec3(0, -1.1, 0), size: 14, color: "#263238")
    cube("Sprint Totem", position: vec3(-2.4, 0, 0.0), size: 0.8, color: "#48e5e5")
    sphere("Roadmap Pillar", position: vec3(-0.8, 0.3, 0.0), radius: 0.42, color: "#eab96d")
    torus("Docs Crystal", position: vec3(0.8, 0, 0.0), size: 1.0, color: "#ff8a7a")
    cylinder("Blocked Orb", position: vec3(2.4, 0, 0.0), size: 0.9, color: "#48e5e5")
    cube("Shipped Ring", position: vec3(-2.4, 0, -1.8), size: 0.8, color: "#eab96d")
    sphere("Retro Block", position: vec3(-0.8, 0.3, -1.8), radius: 0.42, color: "#ff8a7a")
    torus("Backlog Tower", position: vec3(0.8, 0, -1.8), size: 1.0, color: "#48e5e5")
    cylinder("Launch Halo", position: vec3(2.4, 0, -1.8), size: 0.9, color: "#eab96d")
    material("Sprint Totem", metallic: 0.45, roughness: 0.28, emissive: 0.06)
    animate("Launch Halo", rotation: vec3(0, 1, 0), speed: 0.6)
}

page "Home" {
    column(gap: 16) {
        badge("FLOWBOARD · TEAM OS")
        title("Flowboard Team Workspace", size: 34)
        paragraph("Sprints, roadmaps and docs in one calm board — built for small teams who ship.")
        row(gap: 10) {
            badge("Sprints")
            badge("Roadmaps")
            badge("Docs")
        }
        card(padding: 18) {
            title("Tasks done", size: 20)
            text("This sprint, across design and engineering.")
            button("Complete task: " + tasksDone) {
                tasksDone = tasksDone + 1
                print("Tasks done", tasksDone)
            }
        }
        card(padding: 18) {
            title("Sprint day", size: 20)
            text("Two-week cadence with Friday demos.")
            button("Advance day: " + sprintDay) {
                sprintDay = sprintDay + 1
                print("Sprint day", sprintDay)
            }
        }
        card(padding: 18) {
            title("Blocked cards", size: 20)
            text("@mention an owner to unblock instantly.")
            button("Unblock card: " + blockedCards) {
                blockedCards = blockedCards + -1
                print("Blocked cards", blockedCards)
            }
        }
        card(padding: 18) {
            title("Boards that write docs", size: 19)
            text("Finished cards compile into release notes automatically.")
        }
        card(padding: 18) {
            title("Roadmap sync", size: 19)
            text("Quarter goals stay linked to daily sprint reality.")
        }
        card(padding: 18) {
            title("Calm notifications", size: 19)
            text("Digests, not pings — focus is a feature.")
        }
        card(padding: 20) {
            title("Create your board", size: 22)
            text("Free for teams up to five.")
            button("Start sprint 1") {
                print("cta: kanban start")
            }
        }
    }
}

print("Flowboard Team Workspace template ready — edit any line and press Run.")
`,
  },
  {"id": "restaurant-orders", "name": "Restaurant Orders", "title": "Saffron Table Restaurant", "genre": "Restaurant app", "category": "Restaurant app", "description": "A warm restaurant app with live orders, chef queue, table bookings and a loyalty kitchen pass.", "difficulty": "beginner", "accent": "#ff9a5c", "source": "app \"Saffron Table Restaurant\"\n\nstate orders = 42\nstate tablesBooked = 8\nstate rating = 5\nstate loyaltyMembers = 320\nstate revenue = 18400\n\nscene \"Saffron Table Restaurant Scene\" {\n    camera(position: vec3(0, 2.6, 9))\n    light(position: vec3(3, 6, 4), color: \"#ffd94a\")\n    light(position: vec3(-4, 3, -2), color: \"#ff9a5c\")\n    plane(\"Ground\", position: vec3(0, -1.1, 0), size: 18, color: \"#33241a\")\n    sphere(\"Host Desk\", position: vec3(-3.82, 0.4, -0.2), radius: 0.42, color: \"#ffd94a\")\n    torus(\"Chef Pass Counter\", position: vec3(-1.36, 0.8, -0.2), size: 0.9, color: \"#3ddc97\")\n    cylinder(\"Table Lantern One\", position: vec3(-0.3, 0, -0.2), size: 1.1, color: \"#4a3320\")\n    cube(\"Spice Rack Tower\", position: vec3(2.16, 0, -0.2), size: 0.6, color: \"#ff9a5c\")\n    sphere(\"Booking Kiosk\", position: vec3(3.22, 0.8, -0.2), radius: 0.42, color: \"#ffd94a\")\n    torus(\"Dessert Display\", position: vec3(-3.82, 0.4, -2.5), size: 0.7, color: \"#3ddc97\")\n    cylinder(\"Wine Shelf\", position: vec3(-1.36, 0, -2.5), size: 0.9, color: \"#4a3320\")\n    cube(\"Kitchen Bell\", position: vec3(-0.3, 0.4, -2.5), size: 1.1, color: \"#ff9a5c\")\n    sphere(\"Patio Arch\", position: vec3(2.16, 0.4, -2.5), radius: 0.42, color: \"#ffd94a\")\n    torus(\"Review Wall\", position: vec3(3.22, 0.4, -2.5), size: 1.3, color: \"#3ddc97\")\n    cylinder(\"Delivery Scooter\", position: vec3(-3.82, 0.4, -4.8), size: 0.7, color: \"#4a3320\")\n    cube(\"Golden Sign\", position: vec3(-1.36, 0, -4.8), size: 0.9, color: \"#ff9a5c\")\n    material(\"Chef Pass Counter\", metallic: 0.45, roughness: 0.28, emissive: 0.06)\n    animate(\"Table Lantern One\", rotation: vec3(0, 1, 0), speed: 0.7)\n    animate(\"Dessert Display\", rotation: vec3(0, 1, 0), speed: 0.5)\n}\n\npage \"Home\" {\n    column(gap: 14) {\n        badge(\"SAFFRON TABLE · RESTAURANT OS\")\n        title(\"Saffron Table Restaurant\", size: 34)\n        paragraph(\"Run the dinner rush: seat guests, fire orders and keep the kitchen pass glowing.\")\n        row(gap: 10) {\n            badge(\"Live orders\")\n            badge(\"Bookings\")\n            badge(\"Loyalty pass\")\n        }\n        card(padding: 18) {\n            title(\"Orders\", size: 20)\n            text(\"Fire a new order to the kitchen.\")\n            button(\"New order: \" + orders) {\n                orders = orders + 1\n                print(\"Orders\", orders)\n            }\n        }\n        card(padding: 18) {\n            title(\"Tables booked\", size: 20)\n            text(\"Reserve a table for the rush.\")\n            button(\"Book table: \" + tablesBooked) {\n                tablesBooked = tablesBooked + 1\n                print(\"Tables booked\", tablesBooked)\n            }\n        }\n        card(padding: 18) {\n            title(\"Loyalty members\", size: 20)\n            text(\"Happy guests join the kitchen pass.\")\n            button(\"New member: \" + loyaltyMembers) {\n                loyaltyMembers = loyaltyMembers + 6\n                print(\"Loyalty members\", loyaltyMembers)\n            }\n        }\n        card(padding: 18) {\n            title(\"Revenue\", size: 20)\n            text(\"Every served table grows the night.\")\n            button(\"Serve table: \" + revenue) {\n                revenue = revenue + 450\n                print(\"Revenue\", revenue)\n            }\n        }\n        card(padding: 18) {\n            title(\"How it works\", size: 20)\n            text(\"Click cards to run the restaurant\")\n            text(\"Buttons update live ops state\")\n            text(\"Fully runnable — press Run\")\n            text(\"Beginner friendly layout\")\n        }\n    }\n}\n\npage \"Guide\" {\n    column(gap: 12) {\n        title(\"Saffron Table Restaurant Guide\", size: 26)\n        paragraph(\"Everything in Saffron Table Restaurant runs on live Orvexa state. Use the Home cards to drive the numbers, then open Scene or World view to explore the 3D set.\")\n        text(\"Orders — Fire a new order to the kitchen.\")\n        text(\"Tables booked — Reserve a table for the rush.\")\n        text(\"Loyalty members — Happy guests join the kitchen pass.\")\n        text(\"Revenue — Every served table grows the night.\")\n        button(\"Celebrate progress\") {\n            print(\"Guide celebration for Saffron Table Restaurant\")\n        }\n    }\n}\n\nprint(\"Saffron Table Restaurant ready — open Scene or World and press Play.\")\n"},
  {"id": "travel-booking", "name": "Travel Booking", "title": "Wanderly Travel Booking", "genre": "Travel app", "category": "Travel app", "description": "A dreamy travel booking app: trips, stays, wishlists and a live itinerary builder.", "difficulty": "beginner", "accent": "#56b6ff", "source": "app \"Wanderly Travel Booking\"\n\nstate tripsBooked = 0\nstate wishlist = 5\nstate travelers = 2\nstate miles = 12400\nstate deals = 3\n\nscene \"Wanderly Travel Booking Scene\" {\n    camera(position: vec3(0, 2.6, 9))\n    light(position: vec3(3, 6, 4), color: \"#ffd9a0\")\n    light(position: vec3(-4, 3, -2), color: \"#56b6ff\")\n    plane(\"Ground\", position: vec3(0, -1.1, 0), size: 18, color: \"#1d3040\")\n    cube(\"Departure Board\", position: vec3(-3.82, 0, -0.2), size: 0.7, color: \"#56b6ff\")\n    sphere(\"Suitcase Totem\", position: vec3(-1.36, 0.8, -0.2), radius: 0.42, color: \"#ffd9a0\")\n    torus(\"Hotel Key Desk\", position: vec3(-0.3, 0.4, -0.2), size: 1.1, color: \"#3ddc97\")\n    cylinder(\"Beach Umbrella\", position: vec3(2.16, 0, -0.2), size: 0.6, color: \"#2c4a5e\")\n    cube(\"Mountain Cabin\", position: vec3(3.22, 0.4, -0.2), size: 1.3, color: \"#56b6ff\")\n    sphere(\"City Tour Bus\", position: vec3(-3.82, 0.4, -2.5), radius: 0.42, color: \"#ffd9a0\")\n    torus(\"Airport Lounge\", position: vec3(-1.36, 0.4, -2.5), size: 0.9, color: \"#3ddc97\")\n    cylinder(\"Passport Kiosk\", position: vec3(-0.3, 0.4, -2.5), size: 1.1, color: \"#2c4a5e\")\n    cube(\"Map Table\", position: vec3(2.16, 0, -2.5), size: 0.6, color: \"#56b6ff\")\n    sphere(\"Hot Air Balloon\", position: vec3(3.22, 0.4, -2.5), radius: 0.42, color: \"#ffd9a0\")\n    torus(\"Travel Journal\", position: vec3(-3.82, 0.8, -4.8), size: 0.7, color: \"#3ddc97\")\n    cylinder(\"Compass Rose\", position: vec3(-1.36, 0, -4.8), size: 0.9, color: \"#2c4a5e\")\n    material(\"Suitcase Totem\", metallic: 0.45, roughness: 0.28, emissive: 0.06)\n    animate(\"Hotel Key Desk\", rotation: vec3(0, 1, 0), speed: 0.7)\n    animate(\"City Tour Bus\", rotation: vec3(0, 1, 0), speed: 0.5)\n}\n\npage \"Home\" {\n    column(gap: 14) {\n        badge(\"WANDERLY · TRAVEL\")\n        title(\"Wanderly Travel Booking\", size: 34)\n        paragraph(\"Plan the perfect trip: pick a stay, stack experiences and watch the itinerary come alive.\")\n        row(gap: 10) {\n            badge(\"Trip builder\")\n            badge(\"Wishlist\")\n            badge(\"Miles\")\n        }\n        card(padding: 18) {\n            title(\"Trips booked\", size: 20)\n            text(\"Confirm a dream trip.\")\n            button(\"Book trip: \" + tripsBooked) {\n                tripsBooked = tripsBooked + 1\n                print(\"Trips booked\", tripsBooked)\n            }\n        }\n        card(padding: 18) {\n            title(\"Wishlist\", size: 20)\n            text(\"Save places for later.\")\n            button(\"Save place: \" + wishlist) {\n                wishlist = wishlist + 1\n                print(\"Wishlist\", wishlist)\n            }\n        }\n        card(padding: 18) {\n            title(\"Miles\", size: 20)\n            text(\"Every booking earns wander miles.\")\n            button(\"Earn miles: \" + miles) {\n                miles = miles + 800\n                print(\"Miles\", miles)\n            }\n        }\n        card(padding: 18) {\n            title(\"Deals\", size: 20)\n            text(\"Flash deals refresh daily.\")\n            button(\"New deal: \" + deals) {\n                deals = deals + 1\n                print(\"Deals\", deals)\n            }\n        }\n        card(padding: 18) {\n            title(\"How it works\", size: 20)\n            text(\"Click cards to plan a trip\")\n            text(\"Buttons update live travel state\")\n            text(\"Fully runnable — press Run\")\n            text(\"Beginner friendly layout\")\n        }\n    }\n}\n\npage \"Guide\" {\n    column(gap: 12) {\n        title(\"Wanderly Travel Booking Guide\", size: 26)\n        paragraph(\"Everything in Wanderly Travel Booking runs on live Orvexa state. Use the Home cards to drive the numbers, then open Scene or World view to explore the 3D set.\")\n        text(\"Trips booked — Confirm a dream trip.\")\n        text(\"Wishlist — Save places for later.\")\n        text(\"Miles — Every booking earns wander miles.\")\n        text(\"Deals — Flash deals refresh daily.\")\n        button(\"Celebrate progress\") {\n            print(\"Guide celebration for Wanderly Travel Booking\")\n        }\n    }\n}\n\nprint(\"Wanderly Travel Booking ready — open Scene or World and press Play.\")\n"},
  {"id": "job-board", "name": "Job Board", "title": "BrightPath Job Board", "genre": "Careers app", "category": "Careers app", "description": "A friendly job board with role matches, applications, interview prep and skill badges.", "difficulty": "beginner", "accent": "#3ddc97", "source": "app \"BrightPath Job Board\"\n\nstate applications = 0\nstate matches = 12\nstate interviews = 0\nstate offers = 0\nstate skillBadges = 2\n\nscene \"BrightPath Job Board Scene\" {\n    camera(position: vec3(0, 2.6, 9))\n    light(position: vec3(3, 6, 4), color: \"#ffd94a\")\n    light(position: vec3(-4, 3, -2), color: \"#3ddc97\")\n    plane(\"Ground\", position: vec3(0, -1.1, 0), size: 18, color: \"#20302a\")\n    cube(\"Welcome Desk\", position: vec3(-3.82, 0, -0.2), size: 0.7, color: \"#3ddc97\")\n    sphere(\"Role Board Alpha\", position: vec3(-1.36, 0.8, -0.2), radius: 0.42, color: \"#ffd94a\")\n    torus(\"Role Board Beta\", position: vec3(-0.3, 0.4, -0.2), size: 1.1, color: \"#56b6ff\")\n    cylinder(\"Interview Room\", position: vec3(2.16, 0, -0.2), size: 0.6, color: \"#2c4638\")\n    cube(\"Resume Kiosk\", position: vec3(3.22, 0.4, -0.2), size: 1.3, color: \"#3ddc97\")\n    sphere(\"Skill Tree\", position: vec3(-3.82, 0.4, -2.5), radius: 0.42, color: \"#ffd94a\")\n    torus(\"Mentor Couch\", position: vec3(-1.36, 0.4, -2.5), size: 0.9, color: \"#56b6ff\")\n    cylinder(\"Offer Bell\", position: vec3(-0.3, 0.4, -2.5), size: 1.1, color: \"#2c4638\")\n    cube(\"Company Wall\", position: vec3(2.16, 0, -2.5), size: 0.6, color: \"#3ddc97\")\n    sphere(\"Coffee Corner\", position: vec3(3.22, 0.4, -2.5), radius: 0.42, color: \"#ffd94a\")\n    torus(\"Badge Gallery\", position: vec3(-3.82, 0.8, -4.8), size: 0.7, color: \"#56b6ff\")\n    cylinder(\"Celebration Arch\", position: vec3(-1.36, 0, -4.8), size: 0.9, color: \"#2c4638\")\n    material(\"Role Board Alpha\", metallic: 0.45, roughness: 0.28, emissive: 0.06)\n    animate(\"Role Board Beta\", rotation: vec3(0, 1, 0), speed: 0.7)\n    animate(\"Skill Tree\", rotation: vec3(0, 1, 0), speed: 0.5)\n}\n\npage \"Home\" {\n    column(gap: 14) {\n        badge(\"BRIGHTPATH · CAREERS\")\n        title(\"BrightPath Job Board\", size: 34)\n        paragraph(\"Match seekers to dream roles: apply, prep and celebrate every offer letter.\")\n        row(gap: 10) {\n            badge(\"Role matches\")\n            badge(\"Interview prep\")\n            badge(\"Skill badges\")\n        }\n        card(padding: 18) {\n            title(\"Applications\", size: 20)\n            text(\"Send a tailored application.\")\n            button(\"Apply now: \" + applications) {\n                applications = applications + 1\n                print(\"Applications\", applications)\n            }\n        }\n        card(padding: 18) {\n            title(\"Matches\", size: 20)\n            text(\"New roles matched to your skills.\")\n            button(\"New match: \" + matches) {\n                matches = matches + 1\n                print(\"Matches\", matches)\n            }\n        }\n        card(padding: 18) {\n            title(\"Interviews\", size: 20)\n            text(\"Prep turns matches into interviews.\")\n            button(\"Book interview: \" + interviews) {\n                interviews = interviews + 1\n                print(\"Interviews\", interviews)\n            }\n        }\n        card(padding: 18) {\n            title(\"Offers\", size: 20)\n            text(\"Celebrate every offer letter.\")\n            button(\"Receive offer: \" + offers) {\n                offers = offers + 1\n                print(\"Offers\", offers)\n            }\n        }\n        card(padding: 18) {\n            title(\"How it works\", size: 20)\n            text(\"Click cards to grow a career\")\n            text(\"Buttons update live board state\")\n            text(\"Fully runnable — press Run\")\n            text(\"Beginner friendly layout\")\n        }\n    }\n}\n\npage \"Guide\" {\n    column(gap: 12) {\n        title(\"BrightPath Job Board Guide\", size: 26)\n        paragraph(\"Everything in BrightPath Job Board runs on live Orvexa state. Use the Home cards to drive the numbers, then open Scene or World view to explore the 3D set.\")\n        text(\"Applications — Send a tailored application.\")\n        text(\"Matches — New roles matched to your skills.\")\n        text(\"Interviews — Prep turns matches into interviews.\")\n        text(\"Offers — Celebrate every offer letter.\")\n        button(\"Celebrate progress\") {\n            print(\"Guide celebration for BrightPath Job Board\")\n        }\n    }\n}\n\nprint(\"BrightPath Job Board ready — open Scene or World and press Play.\")\n"},
  {"id": "event-tickets", "name": "Event Tickets", "title": "Encore Event Tickets", "genre": "Events app", "category": "Events app", "description": "A buzzing events app: concerts, matches and festivals with seats, passes and fan clubs.", "difficulty": "beginner", "accent": "#c88aff", "source": "app \"Encore Event Tickets\"\n\nstate ticketsSold = 1200\nstate eventsLive = 6\nstate fanMembers = 840\nstate passes = 0\nstate hype = 72\n\nscene \"Encore Event Tickets Scene\" {\n    camera(position: vec3(0, 2.6, 9))\n    light(position: vec3(3, 6, 4), color: \"#ff6b9d\")\n    light(position: vec3(-4, 3, -2), color: \"#c88aff\")\n    plane(\"Ground\", position: vec3(0, -1.1, 0), size: 18, color: \"#2c1d38\")\n    torus(\"Box Office\", position: vec3(-3.82, 0.4, -0.2), size: 0.7, color: \"#ffd94a\")\n    cylinder(\"Stage Tower\", position: vec3(-1.36, 0.4, -0.2), size: 0.9, color: \"#42305e\")\n    cube(\"Seat Ring Alpha\", position: vec3(-0.3, 0, -0.2), size: 1.1, color: \"#c88aff\")\n    sphere(\"Seat Ring Beta\", position: vec3(2.16, 0.4, -0.2), radius: 0.42, color: \"#ff6b9d\")\n    torus(\"Merch Stall\", position: vec3(3.22, 0.8, -0.2), size: 1.3, color: \"#ffd94a\")\n    cylinder(\"Fan Wall\", position: vec3(-3.82, 0, -2.5), size: 0.7, color: \"#42305e\")\n    cube(\"Pass Kiosk\", position: vec3(-1.36, 0, -2.5), size: 0.9, color: \"#c88aff\")\n    sphere(\"Food Truck\", position: vec3(-0.3, 0.8, -2.5), radius: 0.42, color: \"#ff6b9d\")\n    torus(\"Light Rig\", position: vec3(2.16, 0.4, -2.5), size: 0.6, color: \"#ffd94a\")\n    cylinder(\"Encore Arch\", position: vec3(3.22, 0, -2.5), size: 1.3, color: \"#42305e\")\n    cube(\"Ticket Scanner\", position: vec3(-3.82, 0.4, -4.8), size: 0.7, color: \"#c88aff\")\n    sphere(\"Golden Mic\", position: vec3(-1.36, 0.4, -4.8), radius: 0.42, color: \"#ff6b9d\")\n    material(\"Stage Tower\", metallic: 0.45, roughness: 0.28, emissive: 0.06)\n    animate(\"Seat Ring Alpha\", rotation: vec3(0, 1, 0), speed: 0.7)\n    animate(\"Fan Wall\", rotation: vec3(0, 1, 0), speed: 0.5)\n}\n\npage \"Home\" {\n    column(gap: 14) {\n        badge(\"ENCORE · EVENTS\")\n        title(\"Encore Event Tickets\", size: 34)\n        paragraph(\"Fill the arena: sell seats, drop passes and grow the loudest fan club in town.\")\n        row(gap: 10) {\n            badge(\"Seat sales\")\n            badge(\"Fan club\")\n            badge(\"Pass drops\")\n        }\n        card(padding: 18) {\n            title(\"Tickets sold\", size: 20)\n            text(\"Every seat sold fills the arena.\")\n            button(\"Sell tickets: \" + ticketsSold) {\n                ticketsSold = ticketsSold + 25\n                print(\"Tickets sold\", ticketsSold)\n            }\n        }\n        card(padding: 18) {\n            title(\"Fan members\", size: 20)\n            text(\"Fans join the Encore club.\")\n            button(\"New fan: \" + fanMembers) {\n                fanMembers = fanMembers + 15\n                print(\"Fan members\", fanMembers)\n            }\n        }\n        card(padding: 18) {\n            title(\"Passes\", size: 20)\n            text(\"Drop a backstage pass.\")\n            button(\"Drop pass: \" + passes) {\n                passes = passes + 1\n                print(\"Passes\", passes)\n            }\n        }\n        card(padding: 18) {\n            title(\"Hype\", size: 20)\n            text(\"Announcements raise the hype meter.\")\n            button(\"Raise hype: \" + hype) {\n                hype = hype + 5\n                print(\"Hype\", hype)\n            }\n        }\n        card(padding: 18) {\n            title(\"How it works\", size: 20)\n            text(\"Click cards to fill the arena\")\n            text(\"Buttons update live event state\")\n            text(\"Fully runnable — press Run\")\n            text(\"Beginner friendly layout\")\n        }\n    }\n}\n\npage \"Guide\" {\n    column(gap: 12) {\n        title(\"Encore Event Tickets Guide\", size: 26)\n        paragraph(\"Everything in Encore Event Tickets runs on live Orvexa state. Use the Home cards to drive the numbers, then open Scene or World view to explore the 3D set.\")\n        text(\"Tickets sold — Every seat sold fills the arena.\")\n        text(\"Fan members — Fans join the Encore club.\")\n        text(\"Passes — Drop a backstage pass.\")\n        text(\"Hype — Announcements raise the hype meter.\")\n        button(\"Celebrate progress\") {\n            print(\"Guide celebration for Encore Event Tickets\")\n        }\n    }\n}\n\nprint(\"Encore Event Tickets ready — open Scene or World and press Play.\")\n"},
  {"id": "tutor-marketplace", "name": "Tutor Marketplace", "title": "BrightMinds Tutor Marketplace", "genre": "Learning marketplace", "description": "Find a friendly tutor in minutes: subjects, trial lessons, reviews and streak rewards.", "difficulty": "beginner", "accent": "#ffd94a", "source": "app \"BrightMinds Tutor Marketplace\"\n\nstate learners = 340\nstate sessionsBooked = 0\nstate tutors = 86\nstate avgRating = 5\nstate streaks = 0\n\nscene \"BrightMinds Tutor Marketplace Scene\" {\n    camera(position: vec3(0, 2.6, 9))\n    light(position: vec3(3, 6, 4), color: \"#7c5cff\")\n    light(position: vec3(-4, 3, -2), color: \"#ffd94a\")\n    plane(\"Ground\", position: vec3(0, -1.1, 0), size: 18, color: \"#24304a\")\n    cube(\"Welcome Board\", position: vec3(-3.82, 0, -0.2), size: 0.7, color: \"#ffd94a\")\n    sphere(\"Maths Tutor Desk\", position: vec3(-1.36, 0.8, -0.2), radius: 0.42, color: \"#7c5cff\")\n    torus(\"Science Lab Corner\", position: vec3(-0.3, 0.4, -0.2), size: 1.1, color: \"#56f0e8\")\n    cylinder(\"Language Lounge\", position: vec3(2.16, 0, -0.2), size: 0.6, color: \"#31405e\")\n    cube(\"Trial Lesson Pod\", position: vec3(3.22, 0.4, -0.2), size: 1.3, color: \"#ffd94a\")\n    sphere(\"Review Wall\", position: vec3(-3.82, 0.4, -2.5), radius: 0.42, color: \"#7c5cff\")\n    torus(\"Streak Flame\", position: vec3(-1.36, 0.4, -2.5), size: 0.9, color: \"#56f0e8\")\n    cylinder(\"Certificate Arch\", position: vec3(-0.3, 0.4, -2.5), size: 1.1, color: \"#31405e\")\n    cube(\"Parent Kiosk\", position: vec3(2.16, 0, -2.5), size: 0.6, color: \"#ffd94a\")\n    sphere(\"Scholarship Bell\", position: vec3(3.22, 0.4, -2.5), radius: 0.42, color: \"#7c5cff\")\n    torus(\"Study Garden\", position: vec3(-3.82, 0.8, -4.8), size: 0.7, color: \"#56f0e8\")\n    cylinder(\"Success Totem\", position: vec3(-1.36, 0, -4.8), size: 0.9, color: \"#31405e\")\n    material(\"Maths Tutor Desk\", metallic: 0.45, roughness: 0.28, emissive: 0.06)\n    animate(\"Science Lab Corner\", rotation: vec3(0, 1, 0), speed: 0.7)\n    animate(\"Review Wall\", rotation: vec3(0, 1, 0), speed: 0.5)\n}\n\npage \"Home\" {\n    column(gap: 14) {\n        badge(\"BRIGHTMINDS · TUTORS\")\n        title(\"BrightMinds Tutor Marketplace\", size: 34)\n        paragraph(\"Match every learner with a five-star tutor and celebrate the first trial lesson.\")\n        row(gap: 10) {\n            badge(\"Tutor matching\")\n            badge(\"Trial lessons\")\n            badge(\"Streak rewards\")\n        }\n        card(padding: 18) {\n            title(\"Sessions booked\", size: 20)\n            text(\"Book a trial lesson.\")\n            button(\"Book trial: \" + sessionsBooked) {\n                sessionsBooked = sessionsBooked + 1\n                print(\"Sessions booked\", sessionsBooked)\n            }\n        }\n        card(padding: 18) {\n            title(\"Learners\", size: 20)\n            text(\"New learners join BrightMinds.\")\n            button(\"New learner: \" + learners) {\n                learners = learners + 12\n                print(\"Learners\", learners)\n            }\n        }\n        card(padding: 18) {\n            title(\"Streaks\", size: 20)\n            text(\"Daily study lights a streak.\")\n            button(\"Light streak: \" + streaks) {\n                streaks = streaks + 1\n                print(\"Streaks\", streaks)\n            }\n        }\n        card(padding: 18) {\n            title(\"Tutors\", size: 20)\n            text(\"Welcome a new five-star tutor.\")\n            button(\"Onboard tutor: \" + tutors) {\n                tutors = tutors + 1\n                print(\"Tutors\", tutors)\n            }\n        }\n        card(padding: 18) {\n            title(\"How it works\", size: 20)\n            text(\"Click cards to run the marketplace\")\n            text(\"Buttons update live learning state\")\n            text(\"Fully runnable — press Run\")\n            text(\"Beginner friendly layout\")\n        }\n    }\n}\n\npage \"Guide\" {\n    column(gap: 12) {\n        title(\"BrightMinds Tutor Marketplace Guide\", size: 26)\n        paragraph(\"Everything in BrightMinds Tutor Marketplace runs on live Orvexa state. Use the Home cards to drive the numbers, then open Scene or World view to explore the 3D set.\")\n        text(\"Sessions booked — Book a trial lesson.\")\n        text(\"Learners — New learners join BrightMinds.\")\n        text(\"Streaks — Daily study lights a streak.\")\n        text(\"Tutors — Welcome a new five-star tutor.\")\n        button(\"Celebrate progress\") {\n            print(\"Guide celebration for BrightMinds Tutor Marketplace\")\n        }\n    }\n}\n\nprint(\"BrightMinds Tutor Marketplace ready — open Scene or World and press Play.\")\n", "category": "Learning marketplace"},
  {"id": "music-festival", "name": "Music Festival", "title": "Solstice Music Festival", "genre": "Festival app", "description": "Three stages, one sunset: lineups, food streets, passes and the loudest crowd in the valley.", "difficulty": "beginner", "accent": "#ff6b9d", "source": "app \"Solstice Music Festival\"\n\nstate passesSold = 2400\nstate stagesLit = 1\nstate artists = 24\nstate crowdLove = 88\nstate foodStalls = 12\n\nscene \"Solstice Music Festival Scene\" {\n    camera(position: vec3(0, 2.6, 9))\n    light(position: vec3(3, 6, 4), color: \"#ffd94a\")\n    light(position: vec3(-4, 3, -2), color: \"#ff6b9d\")\n    plane(\"Ground\", position: vec3(0, -1.1, 0), size: 18, color: \"#2c1d38\")\n    cube(\"Main Stage Tower\", position: vec3(-3.82, 0, -0.2), size: 0.7, color: \"#ff6b9d\")\n    sphere(\"Sunset Stage\", position: vec3(-1.36, 0.8, -0.2), radius: 0.42, color: \"#ffd94a\")\n    torus(\"Indie Dome\", position: vec3(-0.3, 0.4, -0.2), size: 1.1, color: \"#c88aff\")\n    cylinder(\"Food Street One\", position: vec3(2.16, 0, -0.2), size: 0.6, color: \"#42305e\")\n    cube(\"Pass Gate\", position: vec3(3.22, 0.4, -0.2), size: 1.3, color: \"#ff6b9d\")\n    sphere(\"Merch Tent\", position: vec3(-3.82, 0.4, -2.5), radius: 0.42, color: \"#ffd94a\")\n    torus(\"Ferris Wheel\", position: vec3(-1.36, 0.4, -2.5), size: 0.9, color: \"#c88aff\")\n    cylinder(\"Chill Meadow\", position: vec3(-0.3, 0.4, -2.5), size: 1.1, color: \"#42305e\")\n    cube(\"Artist Lounge\", position: vec3(2.16, 0, -2.5), size: 0.6, color: \"#ff6b9d\")\n    sphere(\"Light Rig Alpha\", position: vec3(3.22, 0.4, -2.5), radius: 0.42, color: \"#ffd94a\")\n    torus(\"Encore Arch\", position: vec3(-3.82, 0.8, -4.8), size: 0.7, color: \"#c88aff\")\n    cylinder(\"Firework Mortar\", position: vec3(-1.36, 0, -4.8), size: 0.9, color: \"#42305e\")\n    material(\"Sunset Stage\", metallic: 0.45, roughness: 0.28, emissive: 0.06)\n    animate(\"Indie Dome\", rotation: vec3(0, 1, 0), speed: 0.7)\n    animate(\"Merch Tent\", rotation: vec3(0, 1, 0), speed: 0.5)\n}\n\npage \"Home\" {\n    column(gap: 14) {\n        badge(\"SOLSTICE · FESTIVAL\")\n        title(\"Solstice Music Festival\", size: 34)\n        paragraph(\"Sell out the valley: drop the lineup, light the stages and grow the Solstice crowd.\")\n        row(gap: 10) {\n            badge(\"Three stages\")\n            badge(\"Pass drops\")\n            badge(\"Crowd love\")\n        }\n        card(padding: 18) {\n            title(\"Passes sold\", size: 20)\n            text(\"Every pass fills the valley.\")\n            button(\"Sell passes: \" + passesSold) {\n                passesSold = passesSold + 60\n                print(\"Passes sold\", passesSold)\n            }\n        }\n        card(padding: 18) {\n            title(\"Stages lit\", size: 20)\n            text(\"Light another Solstice stage.\")\n            button(\"Light stage: \" + stagesLit) {\n                stagesLit = stagesLit + 1\n                print(\"Stages lit\", stagesLit)\n            }\n        }\n        card(padding: 18) {\n            title(\"Artists\", size: 20)\n            text(\"Book a new headline artist.\")\n            button(\"Book artist: \" + artists) {\n                artists = artists + 1\n                print(\"Artists\", artists)\n            }\n        }\n        card(padding: 18) {\n            title(\"Crowd love\", size: 20)\n            text(\"Surprises grow crowd love.\")\n            button(\"Delight crowd: \" + crowdLove) {\n                crowdLove = crowdLove + 4\n                print(\"Crowd love\", crowdLove)\n            }\n        }\n        card(padding: 18) {\n            title(\"How it works\", size: 20)\n            text(\"Click cards to run the festival\")\n            text(\"Buttons update live crowd state\")\n            text(\"Fully runnable — press Run\")\n            text(\"Beginner friendly layout\")\n        }\n    }\n}\n\npage \"Guide\" {\n    column(gap: 12) {\n        title(\"Solstice Music Festival Guide\", size: 26)\n        paragraph(\"Everything in Solstice Music Festival runs on live Orvexa state. Use the Home cards to drive the numbers, then open Scene or World view to explore the 3D set.\")\n        text(\"Passes sold — Every pass fills the valley.\")\n        text(\"Stages lit — Light another Solstice stage.\")\n        text(\"Artists — Book a new headline artist.\")\n        text(\"Crowd love — Surprises grow crowd love.\")\n        button(\"Celebrate progress\") {\n            print(\"Guide celebration for Solstice Music Festival\")\n        }\n    }\n}\n\nprint(\"Solstice Music Festival ready — open Scene or World and press Play.\")\n", "category": "Festival app"},
  {"id": "real-estate-tour", "name": "Real Estate Tour", "title": "HavenKey Real Estate Tours", "genre": "Property app", "description": "Walk dream homes in 3D: tours, favourites, agent chats and open-house Saturdays.", "difficulty": "beginner", "accent": "#56b6ff", "source": "app \"HavenKey Real Estate Tours\"\n\nstate toursTaken = 0\nstate favourites = 3\nstate viewingsBooked = 0\nstate homesSold = 0\nstate agentChats = 0\n\nscene \"HavenKey Real Estate Tours Scene\" {\n    camera(position: vec3(0, 2.6, 9))\n    light(position: vec3(3, 6, 4), color: \"#ffd9a0\")\n    light(position: vec3(-4, 3, -2), color: \"#56b6ff\")\n    plane(\"Ground\", position: vec3(0, -1.1, 0), size: 18, color: \"#26343a\")\n    torus(\"Welcome Sign\", position: vec3(-3.82, 0.4, -0.2), size: 0.7, color: \"#3ddc97\")\n    cylinder(\"Sunny Villa\", position: vec3(-1.36, 0.4, -0.2), size: 0.9, color: \"#31456b\")\n    cube(\"Garden Cottage\", position: vec3(-0.3, 0, -0.2), size: 1.1, color: \"#56b6ff\")\n    sphere(\"City Loft\", position: vec3(2.16, 0.4, -0.2), radius: 0.42, color: \"#ffd9a0\")\n    torus(\"Lake House\", position: vec3(3.22, 0.8, -0.2), size: 1.3, color: \"#3ddc97\")\n    cylinder(\"Tour Flag One\", position: vec3(-3.82, 0, -2.5), size: 0.7, color: \"#31456b\")\n    cube(\"Agent Desk\", position: vec3(-1.36, 0, -2.5), size: 0.9, color: \"#56b6ff\")\n    sphere(\"Keys Bowl\", position: vec3(-0.3, 0.8, -2.5), radius: 0.42, color: \"#ffd9a0\")\n    torus(\"Open House Arch\", position: vec3(2.16, 0.4, -2.5), size: 0.6, color: \"#3ddc97\")\n    cylinder(\"Photo Corner\", position: vec3(3.22, 0, -2.5), size: 1.3, color: \"#31456b\")\n    cube(\"Map Table\", position: vec3(-3.82, 0.4, -4.8), size: 0.7, color: \"#56b6ff\")\n    sphere(\"Sold Banner\", position: vec3(-1.36, 0.4, -4.8), radius: 0.42, color: \"#ffd9a0\")\n    material(\"Sunny Villa\", metallic: 0.45, roughness: 0.28, emissive: 0.06)\n    animate(\"Garden Cottage\", rotation: vec3(0, 1, 0), speed: 0.7)\n    animate(\"Tour Flag One\", rotation: vec3(0, 1, 0), speed: 0.5)\n}\n\npage \"Home\" {\n    column(gap: 14) {\n        badge(\"HAVENKEY · PROPERTY\")\n        title(\"HavenKey Real Estate Tours\", size: 34)\n        paragraph(\"Tour every dream home, favourite the best and book an open-house Saturday.\")\n        row(gap: 10) {\n            badge(\"3D tours\")\n            badge(\"Favourites\")\n            badge(\"Open house\")\n        }\n        card(padding: 18) {\n            title(\"Tours taken\", size: 20)\n            text(\"Walk a dream home in 3D.\")\n            button(\"Take tour: \" + toursTaken) {\n                toursTaken = toursTaken + 1\n                print(\"Tours taken\", toursTaken)\n            }\n        }\n        card(padding: 18) {\n            title(\"Favourites\", size: 20)\n            text(\"Save a home to favourites.\")\n            button(\"Favourite home: \" + favourites) {\n                favourites = favourites + 1\n                print(\"Favourites\", favourites)\n            }\n        }\n        card(padding: 18) {\n            title(\"Viewings booked\", size: 20)\n            text(\"Book an open-house viewing.\")\n            button(\"Book viewing: \" + viewingsBooked) {\n                viewingsBooked = viewingsBooked + 1\n                print(\"Viewings booked\", viewingsBooked)\n            }\n        }\n        card(padding: 18) {\n            title(\"Homes sold\", size: 20)\n            text(\"Celebrate a sold banner.\")\n            button(\"Sell home: \" + homesSold) {\n                homesSold = homesSold + 1\n                print(\"Homes sold\", homesSold)\n            }\n        }\n        card(padding: 18) {\n            title(\"How it works\", size: 20)\n            text(\"Click cards to tour homes\")\n            text(\"Buttons update live property state\")\n            text(\"Fully runnable — press Run\")\n            text(\"Beginner friendly layout\")\n        }\n    }\n}\n\npage \"Guide\" {\n    column(gap: 12) {\n        title(\"HavenKey Real Estate Tours Guide\", size: 26)\n        paragraph(\"Everything in HavenKey Real Estate Tours runs on live Orvexa state. Use the Home cards to drive the numbers, then open Scene or World view to explore the 3D set.\")\n        text(\"Tours taken — Walk a dream home in 3D.\")\n        text(\"Favourites — Save a home to favourites.\")\n        text(\"Viewings booked — Book an open-house viewing.\")\n        text(\"Homes sold — Celebrate a sold banner.\")\n        button(\"Celebrate progress\") {\n            print(\"Guide celebration for HavenKey Real Estate Tours\")\n        }\n    }\n}\n\nprint(\"HavenKey Real Estate Tours ready — open Scene or World and press Play.\")\n", "category": "Property app"},
  {"id": "charity-fundraiser", "name": "Charity Fundraiser", "title": "DilSe Charity Fundraiser", "genre": "Fundraiser app", "description": "A warm fundraiser: causes, donors, live goals and celebration when every goal is met.", "difficulty": "beginner", "accent": "#ff8a5c", "source": "app \"DilSe Charity Fundraiser\"\n\nstate raised = 12500\nstate donors = 240\nstate mealsFunded = 800\nstate booksFunded = 320\nstate goalsMet = 1\n\nscene \"DilSe Charity Fundraiser Scene\" {\n    camera(position: vec3(0, 2.6, 9))\n    light(position: vec3(3, 6, 4), color: \"#ffd94a\")\n    light(position: vec3(-4, 3, -2), color: \"#ff8a5c\")\n    plane(\"Ground\", position: vec3(0, -1.1, 0), size: 18, color: \"#33261a\")\n    cube(\"Cause Wall\", position: vec3(-3.82, 0, -0.2), size: 0.7, color: \"#ff8a5c\")\n    sphere(\"Meal Counter\", position: vec3(-1.36, 0.8, -0.2), radius: 0.42, color: \"#ffd94a\")\n    torus(\"Book Shelf\", position: vec3(-0.3, 0.4, -0.2), size: 1.1, color: \"#ff6b9d\")\n    cylinder(\"Blanket Stack\", position: vec3(2.16, 0, -0.2), size: 0.6, color: \"#4a3520\")\n    cube(\"Donor Bell\", position: vec3(3.22, 0.4, -0.2), size: 1.3, color: \"#ff8a5c\")\n    sphere(\"Story Corner\", position: vec3(-3.82, 0.4, -2.5), radius: 0.42, color: \"#ffd94a\")\n    torus(\"Volunteer Desk\", position: vec3(-1.36, 0.4, -2.5), size: 0.9, color: \"#ff6b9d\")\n    cylinder(\"Goal Thermometer\", position: vec3(-0.3, 0.4, -2.5), size: 1.1, color: \"#4a3520\")\n    cube(\"Thank You Arch\", position: vec3(2.16, 0, -2.5), size: 0.6, color: \"#ff8a5c\")\n    sphere(\"Photo Wall\", position: vec3(3.22, 0.4, -2.5), radius: 0.42, color: \"#ffd94a\")\n    torus(\"Celebration Stage\", position: vec3(-3.82, 0.8, -4.8), size: 0.7, color: \"#ff6b9d\")\n    cylinder(\"Lantern Row\", position: vec3(-1.36, 0, -4.8), size: 0.9, color: \"#4a3520\")\n    material(\"Meal Counter\", metallic: 0.45, roughness: 0.28, emissive: 0.06)\n    animate(\"Book Shelf\", rotation: vec3(0, 1, 0), speed: 0.7)\n    animate(\"Story Corner\", rotation: vec3(0, 1, 0), speed: 0.5)\n}\n\npage \"Home\" {\n    column(gap: 14) {\n        badge(\"DILSE · FUNDRAISER\")\n        title(\"DilSe Charity Fundraiser\", size: 34)\n        paragraph(\"Fund every cause on the wall: meals, books and warm blankets for the winter drive.\")\n        row(gap: 10) {\n            badge(\"Live goals\")\n            badge(\"Cause wall\")\n            badge(\"Celebrations\")\n        }\n        card(padding: 18) {\n            title(\"Raised\", size: 20)\n            text(\"Every rupee brings a goal closer.\")\n            button(\"New donation: \" + raised) {\n                raised = raised + 500\n                print(\"Raised\", raised)\n            }\n        }\n        card(padding: 18) {\n            title(\"Donors\", size: 20)\n            text(\"Welcome a new kind donor.\")\n            button(\"New donor: \" + donors) {\n                donors = donors + 3\n                print(\"Donors\", donors)\n            }\n        }\n        card(padding: 18) {\n            title(\"Meals funded\", size: 20)\n            text(\"Fund warm meals for families.\")\n            button(\"Fund meals: \" + mealsFunded) {\n                mealsFunded = mealsFunded + 25\n                print(\"Meals funded\", mealsFunded)\n            }\n        }\n        card(padding: 18) {\n            title(\"Goals met\", size: 20)\n            text(\"Celebrate a completed cause.\")\n            button(\"Meet goal: \" + goalsMet) {\n                goalsMet = goalsMet + 1\n                print(\"Goals met\", goalsMet)\n            }\n        }\n        card(padding: 18) {\n            title(\"How it works\", size: 20)\n            text(\"Click cards to grow kindness\")\n            text(\"Buttons update live fundraiser state\")\n            text(\"Fully runnable — press Run\")\n            text(\"Beginner friendly layout\")\n        }\n    }\n}\n\npage \"Guide\" {\n    column(gap: 12) {\n        title(\"DilSe Charity Fundraiser Guide\", size: 26)\n        paragraph(\"Everything in DilSe Charity Fundraiser runs on live Orvexa state. Use the Home cards to drive the numbers, then open Scene or World view to explore the 3D set.\")\n        text(\"Raised — Every rupee brings a goal closer.\")\n        text(\"Donors — Welcome a new kind donor.\")\n        text(\"Meals funded — Fund warm meals for families.\")\n        text(\"Goals met — Celebrate a completed cause.\")\n        button(\"Celebrate progress\") {\n            print(\"Guide celebration for DilSe Charity Fundraiser\")\n        }\n    }\n}\n\nprint(\"DilSe Charity Fundraiser ready — open Scene or World and press Play.\")\n", "category": "Fundraiser app"}
]);

export const PREFAB_KITBASH_LIBRARY = Object.freeze([
  {
    id: "sun-temple", name: "Sun Temple", title: "Sun Temple", description: "Stepped temple plinth, four columns, lintel and a radiant sun crystal with ember VFX.",
    parts: [
      {
        type: "cube", primitive: "cube", name: "Temple Plinth",
        position: { x: 0, y: -0.4, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 4, y: 0.6, z: 4 },
        color: "#9a8a68",
      },
      {
        type: "cube", primitive: "cube", name: "Temple Step",
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 3.2, y: 0.35, z: 3.2 },
        color: "#a8946e",
      },
      {
        type: "cylinder", primitive: "cylinder", name: "Column NW",
        position: { x: -1.2, y: 1, z: -1.2 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.45, y: 2, z: 0.45 },
        color: "#c2b28a",
      },
      {
        type: "cylinder", primitive: "cylinder", name: "Column NE",
        position: { x: 1.2, y: 1, z: -1.2 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.45, y: 2, z: 0.45 },
        color: "#c2b28a",
      },
      {
        type: "cylinder", primitive: "cylinder", name: "Column SW",
        position: { x: -1.2, y: 1, z: 1.2 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.45, y: 2, z: 0.45 },
        color: "#c2b28a",
      },
      {
        type: "cylinder", primitive: "cylinder", name: "Column SE",
        position: { x: 1.2, y: 1, z: 1.2 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.45, y: 2, z: 0.45 },
        color: "#c2b28a",
      },
      {
        type: "cube", primitive: "cube", name: "Temple Lintel",
        position: { x: 0, y: 2.2, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 3.4, y: 0.4, z: 3.4 },
        color: "#b3a077",
      },
      {
        type: "sphere", primitive: "sphere", name: "Sun Crystal",
        position: { x: 0, y: 3, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.7, y: 0.7, z: 0.7 },
        color: "#ffd470",
        material: { metallic: 0.2, roughness: 0.15, emissive: 0.9 },
      },
      {
        type: "torus", primitive: "torus", name: "Sun Halo Ring",
        position: { x: 0, y: 3, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1.4, y: 1.4, z: 1.4 },
        color: "#ffb84d",
        material: { metallic: 0.6, roughness: 0.25, emissive: 0.6 },
      },
    ],
  },
  {
    id: "cyber-tower", name: "Cyber Tower", title: "Cyber Tower", description: "Stacked neon tower with core ring, antenna spire and holographic billboard fins.",
    parts: [
      {
        type: "cube", primitive: "cube", name: "Tower Base",
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1.6, y: 3, z: 1.6 },
        color: "#232a44",
      },
      {
        type: "cube", primitive: "cube", name: "Tower Mid",
        position: { x: 0, y: 2.2, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1.2, y: 1.6, z: 1.2 },
        color: "#2c3560",
      },
      {
        type: "torus", primitive: "torus", name: "Neon Core Ring",
        position: { x: 0, y: 0.8, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1.3, y: 1.3, z: 1.3 },
        color: "#48e5e5",
        material: { metallic: 0.6, roughness: 0.2, emissive: 0.9 },
      },
      {
        type: "cylinder", primitive: "cylinder", name: "Antenna",
        position: { x: 0, y: 3.6, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.12, y: 1.8, z: 0.12 },
        color: "#8b79ff",
      },
      {
        type: "sphere", primitive: "sphere", name: "Antenna Beacon",
        position: { x: 0, y: 4.6, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.22, y: 0.22, z: 0.22 },
        color: "#ff6b9d",
        material: { metallic: 0.3, roughness: 0.2, emissive: 1.2 },
      },
      {
        type: "cube", primitive: "cube", name: "Billboard Fin L",
        position: { x: -1, y: 1.4, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.15, y: 1.4, z: 1 },
        color: "#48e5e5",
        material: { metallic: 0.4, roughness: 0.3, emissive: 0.5 },
      },
      {
        type: "cube", primitive: "cube", name: "Billboard Fin R",
        position: { x: 1, y: 1.4, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.15, y: 1.4, z: 1 },
        color: "#ff6b9d",
        material: { metallic: 0.4, roughness: 0.3, emissive: 0.5 },
      },
      {
        type: "cube", primitive: "cube", name: "Roof Unit",
        position: { x: 0, y: 3.1, z: 0.4 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.7, y: 0.4, z: 0.7 },
        color: "#39406e",
      },
    ],
  },
  {
    id: "arcane-portal", name: "Arcane Portal", title: "Arcane Portal", description: "Runed portal ring with twin obelisks, vortex core, floating runestones and portal VFX anchor.",
    parts: [
      {
        type: "torus", primitive: "torus", name: "Portal Ring",
        position: { x: 0, y: 1.4, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 2.4, y: 2.4, z: 2.4 },
        color: "#8b79ff",
        material: { metallic: 0.3, roughness: 0.18, emissive: 0.8 },
      },
      {
        type: "cube", primitive: "cube", name: "Obelisk L",
        position: { x: -1.8, y: 0.5, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.45, y: 2, z: 0.45 },
        color: "#3a3358",
      },
      {
        type: "cube", primitive: "cube", name: "Obelisk R",
        position: { x: 1.8, y: 0.5, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.45, y: 2, z: 0.45 },
        color: "#3a3358",
      },
      {
        type: "sphere", primitive: "sphere", name: "Vortex Core",
        position: { x: 0, y: 1.4, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.6, y: 0.6, z: 0.6 },
        color: "#56f0e8",
        material: { metallic: 0.1, roughness: 0.1, emissive: 1.3 },
      },
      {
        type: "sphere", primitive: "sphere", name: "Runestone A",
        position: { x: -1, y: 2.6, z: 0.4 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.22, y: 0.22, z: 0.22 },
        color: "#8b79ff",
        material: { metallic: 0.2, roughness: 0.3, emissive: 0.7 },
      },
      {
        type: "sphere", primitive: "sphere", name: "Runestone B",
        position: { x: 1, y: 2.6, z: -0.4 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.22, y: 0.22, z: 0.22 },
        color: "#56f0e8",
        material: { metallic: 0.2, roughness: 0.3, emissive: 0.7 },
      },
      {
        type: "cube", primitive: "cube", name: "Portal Base",
        position: { x: 0, y: -0.5, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 3, y: 0.4, z: 1.2 },
        color: "#2c2747",
      },
      {
        type: "cylinder", primitive: "cylinder", name: "Rune Pillar",
        position: { x: 0, y: -0.1, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.3, y: 0.5, z: 0.3 },
        color: "#564a8a",
        material: { metallic: 0.4, roughness: 0.4, emissive: 0.4 },
      },
    ],
  },
  {
    id: "crystal-outcrop", name: "Crystal Outcrop", title: "Crystal Outcrop", description: "Arcane crystal cluster erupting from mossy basalt with shard satellites.",
    parts: [
      {
        type: "cylinder", primitive: "cylinder", name: "Basalt Base",
        position: { x: 0, y: -0.3, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 2.6, y: 0.5, z: 2.6 },
        color: "#2c3138",
      },
      {
        type: "cone", primitive: "cone", name: "Crystal Shard A",
        position: { x: -0.5, y: 0.8, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.65, y: 1.9, z: 0.65 },
        color: "#56f0e8",
        material: { metallic: 0.25, roughness: 0.12, emissive: 0.5 },
      },
      {
        type: "cone", primitive: "cone", name: "Crystal Shard B",
        position: { x: 0.6, y: 0.6, z: 0.3 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.5, y: 1.4, z: 0.5 },
        color: "#8b79ff",
        material: { metallic: 0.25, roughness: 0.12, emissive: 0.5 },
      },
      {
        type: "cone", primitive: "cone", name: "Crystal Shard C",
        position: { x: 0.1, y: 0.5, z: -0.6 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.4, y: 1.1, z: 0.4 },
        color: "#56f0e8",
        material: { metallic: 0.25, roughness: 0.12, emissive: 0.4 },
      },
      {
        type: "sphere", primitive: "sphere", name: "Crystal Heart",
        position: { x: 0, y: 0.2, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.35, y: 0.35, z: 0.35 },
        color: "#aef7ff",
        material: { metallic: 0.1, roughness: 0.1, emissive: 0.9 },
      },
      {
        type: "cube", primitive: "cube", name: "Moss Rock A",
        position: { x: -1.2, y: -0.1, z: 0.8 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.6, y: 0.4, z: 0.5 },
        color: "#3e5c46",
      },
      {
        type: "cube", primitive: "cube", name: "Moss Rock B",
        position: { x: 1.1, y: -0.1, z: -0.7 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.5, y: 0.35, z: 0.6 },
        color: "#3e5c46",
      },
    ],
  },
  {
    id: "campfire-sanctuary", name: "Campfire Sanctuary", title: "Campfire Sanctuary", description: "A safe rest stop: stone ring, log benches, ember glow and a hanging lantern.",
    parts: [
      {
        type: "torus", primitive: "torus", name: "Stone Ring",
        position: { x: 0, y: -0.2, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1.7, y: 0.5, z: 1.7 },
        color: "#6a737d",
      },
      {
        type: "sphere", primitive: "sphere", name: "Ember Glow",
        position: { x: 0, y: 0.15, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.42, y: 0.3, z: 0.42 },
        color: "#ff8a3c",
        material: { metallic: 0, roughness: 0.4, emissive: 1.4 },
      },
      {
        type: "cylinder", primitive: "cylinder", name: "Log Bench L",
        position: { x: -1.1, y: -0.1, z: 0.9 },
        rotation: { x: 0, y: 1.2, z: 0 },
        scale: { x: 0.22, y: 1.2, z: 0.22 },
        color: "#6b4a2f",
      },
      {
        type: "cylinder", primitive: "cylinder", name: "Log Bench R",
        position: { x: 1.1, y: -0.1, z: 0.9 },
        rotation: { x: 0, y: 1.2, z: 0 },
        scale: { x: 0.22, y: 1.2, z: 0.22 },
        color: "#6b4a2f",
      },
      {
        type: "cylinder", primitive: "cylinder", name: "Log Bench Back",
        position: { x: 0, y: -0.1, z: -1.2 },
        rotation: { x: 0, y: 1.57, z: 0 },
        scale: { x: 0.22, y: 1.4, z: 0.22 },
        color: "#6b4a2f",
      },
      {
        type: "cube", primitive: "cube", name: "Supply Crate",
        position: { x: 1.5, y: 0, z: -0.6 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.55, y: 0.55, z: 0.55 },
        color: "#8a6b46",
      },
      {
        type: "sphere", primitive: "sphere", name: "Hanging Lantern",
        position: { x: 0, y: 1.5, z: -0.9 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.2, y: 0.24, z: 0.2 },
        color: "#ffd470",
        material: { metallic: 0.2, roughness: 0.3, emissive: 1.1 },
      },
      {
        type: "cylinder", primitive: "cylinder", name: "Lantern Post",
        position: { x: 0, y: 0.7, z: -0.9 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.08, y: 1.6, z: 0.08 },
        color: "#4a3826",
      },
    ],
  },
  {
    id: "hero-statue", name: "Hero Statue", title: "Hero Statue", description: "A monumental hero on a plinth, sword raised, with cape block and memorial candles.",
    parts: [
      {
        type: "cube", primitive: "cube", name: "Statue Plinth",
        position: { x: 0, y: -0.5, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 2.1, y: 0.8, z: 2.1 },
        color: "#7d838e",
      },
      {
        type: "cube", primitive: "cube", name: "Plinth Step",
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1.6, y: 0.3, z: 1.6 },
        color: "#8d949e",
      },
      {
        type: "cylinder", primitive: "cylinder", name: "Hero Body",
        position: { x: 0, y: 0.9, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.55, y: 1.7, z: 0.55 },
        color: "#9aa3b0",
        material: { metallic: 0.55, roughness: 0.35, emissive: 0 },
      },
      {
        type: "sphere", primitive: "sphere", name: "Hero Head",
        position: { x: 0, y: 2.1, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.42, y: 0.42, z: 0.42 },
        color: "#9aa3b0",
        material: { metallic: 0.55, roughness: 0.35, emissive: 0 },
      },
      {
        type: "cube", primitive: "cube", name: "Sunblade",
        position: { x: 0.75, y: 1.8, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.12, y: 1.6, z: 0.12 },
        color: "#ffd470",
        material: { metallic: 0.8, roughness: 0.2, emissive: 0.4 },
      },
      {
        type: "cube", primitive: "cube", name: "Cape Block",
        position: { x: 0, y: 1, z: -0.35 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.7, y: 1.4, z: 0.18 },
        color: "#5a6a8a",
        material: { metallic: 0.2, roughness: 0.6, emissive: 0 },
      },
      {
        type: "sphere", primitive: "sphere", name: "Memorial Candle L",
        position: { x: -0.8, y: -0.05, z: 0.8 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.12, y: 0.16, z: 0.12 },
        color: "#ffb84d",
        material: { metallic: 0, roughness: 0.5, emissive: 1 },
      },
      {
        type: "sphere", primitive: "sphere", name: "Memorial Candle R",
        position: { x: 0.8, y: -0.05, z: 0.8 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.12, y: 0.16, z: 0.12 },
        color: "#ffb84d",
        material: { metallic: 0, roughness: 0.5, emissive: 1 },
      },
    ],
  },
  {
    id: "medieval-watchtower", name: "Medieval Watchtower", title: "Medieval Watchtower", description: "Stone watchtower with timber gallery, beacon brazier and signal banner for castle sieges.",
    parts: [
      {
        type: "cylinder", primitive: "cylinder", name: "Tower Shaft",
        position: { x: 0, y: 1.2, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1.5, y: 3.4, z: 1.5 },
        color: "#7d838e",
        material: { metallic: 0.1, roughness: 0.8, emissive: 0 },
      },
      {
        type: "cube", primitive: "cube", name: "Timber Gallery",
        position: { x: 0, y: 3.2, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 2.1, y: 0.7, z: 2.1 },
        color: "#6b4a2f",
      },
      {
        type: "cone", primitive: "cone", name: "Tower Roof",
        position: { x: 0, y: 4.3, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1.7, y: 1.5, z: 1.7 },
        color: "#8a4a3a",
      },
      {
        type: "sphere", primitive: "sphere", name: "Beacon Brazier",
        position: { x: 0, y: 3.8, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.35, y: 0.25, z: 0.35 },
        color: "#ff8a3c",
        material: { metallic: 0, roughness: 0.5, emissive: 1.3 },
      },
      {
        type: "cube", primitive: "cube", name: "Signal Banner",
        position: { x: 0.9, y: 2.6, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.08, y: 1, z: 0.6 },
        color: "#b03a4a",
      },
      {
        type: "cube", primitive: "cube", name: "Arrow Slit Block",
        position: { x: 0, y: 1.8, z: 0.8 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.3, y: 0.6, z: 0.15 },
        color: "#5a6068",
      },
      {
        type: "cube", primitive: "cube", name: "Tower Door",
        position: { x: 0, y: 0.1, z: 0.8 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.6, y: 1.1, z: 0.12 },
        color: "#4a3826",
      },
      {
        type: "cylinder", primitive: "cylinder", name: "Stair Drum",
        position: { x: 1.2, y: 0.6, z: -0.6 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.7, y: 1.6, z: 0.7 },
        color: "#6d757f",
      },
    ],
  },
  {
    id: "sci-fi-rover", name: "Sci-Fi Rover", title: "Sci-Fi Rover", description: "Six-wheel science rover with mast camera, sample arm and solar wing for Mars missions.",
    parts: [
      {
        type: "cube", primitive: "cube", name: "Rover Chassis",
        position: { x: 0, y: 0.5, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1.8, y: 0.6, z: 1.1 },
        color: "#d8dee9",
        material: { metallic: 0.6, roughness: 0.35, emissive: 0 },
      },
      {
        type: "cylinder", primitive: "cylinder", name: "Wheel FL",
        position: { x: -0.7, y: 0, z: 0.65 },
        rotation: { x: 0, y: 1.57, z: 0 },
        scale: { x: 0.42, y: 0.25, z: 0.42 },
        color: "#2c3138",
      },
      {
        type: "cylinder", primitive: "cylinder", name: "Wheel FR",
        position: { x: 0.7, y: 0, z: 0.65 },
        rotation: { x: 0, y: 1.57, z: 0 },
        scale: { x: 0.42, y: 0.25, z: 0.42 },
        color: "#2c3138",
      },
      {
        type: "cylinder", primitive: "cylinder", name: "Wheel BL",
        position: { x: -0.7, y: 0, z: -0.65 },
        rotation: { x: 0, y: 1.57, z: 0 },
        scale: { x: 0.42, y: 0.25, z: 0.42 },
        color: "#2c3138",
      },
      {
        type: "cylinder", primitive: "cylinder", name: "Wheel BR",
        position: { x: 0.7, y: 0, z: -0.65 },
        rotation: { x: 0, y: 1.57, z: 0 },
        scale: { x: 0.42, y: 0.25, z: 0.42 },
        color: "#2c3138",
      },
      {
        type: "cylinder", primitive: "cylinder", name: "Camera Mast",
        position: { x: -0.5, y: 1.3, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.09, y: 1.1, z: 0.09 },
        color: "#8d99ae",
      },
      {
        type: "cube", primitive: "cube", name: "Camera Head",
        position: { x: -0.5, y: 1.9, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.4, y: 0.22, z: 0.25 },
        color: "#39406e",
        material: { metallic: 0.5, roughness: 0.3, emissive: 0.3 },
      },
      {
        type: "cube", primitive: "cube", name: "Sample Arm",
        position: { x: 0.9, y: 0.7, z: 0.3 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.9, y: 0.14, z: 0.14 },
        color: "#eab96d",
        material: { metallic: 0.7, roughness: 0.3, emissive: 0 },
      },
      {
        type: "cube", primitive: "cube", name: "Solar Wing",
        position: { x: 0, y: 1, z: -0.9 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1.6, y: 0.08, z: 0.8 },
        color: "#2a4a8a",
        material: { metallic: 0.8, roughness: 0.2, emissive: 0.2 },
      },
      {
        type: "sphere", primitive: "sphere", name: "Comms Dish",
        position: { x: 0.5, y: 1.2, z: -0.3 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.4, y: 0.15, z: 0.4 },
        color: "#dfeaff",
        material: { metallic: 0.6, roughness: 0.3, emissive: 0 },
      },
    ],
  },
  {
    id: "floating-shrine", name: "Floating Shrine", title: "Floating Shrine", description: "A levitating sky shrine: floating rock, torii frame, spirit lanterns and a wind chime halo.",
    parts: [
      {
        type: "cone", primitive: "cone", name: "Floating Rock",
        position: { x: 0, y: -0.8, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1.8, y: 1.6, z: 1.8 },
        color: "#5a6a7a",
      },
      {
        type: "cube", primitive: "cube", name: "Shrine Deck",
        position: { x: 0, y: 0.2, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 2.2, y: 0.25, z: 2.2 },
        color: "#8a6b46",
      },
      {
        type: "cube", primitive: "cube", name: "Torii Beam Top",
        position: { x: 0, y: 1.9, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 2, y: 0.18, z: 0.18 },
        color: "#b03a4a",
      },
      {
        type: "cylinder", primitive: "cylinder", name: "Torii Pillar L",
        position: { x: -0.8, y: 1, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.14, y: 1.8, z: 0.14 },
        color: "#8a2f3e",
      },
      {
        type: "cylinder", primitive: "cylinder", name: "Torii Pillar R",
        position: { x: 0.8, y: 1, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.14, y: 1.8, z: 0.14 },
        color: "#8a2f3e",
      },
      {
        type: "sphere", primitive: "sphere", name: "Spirit Lantern L",
        position: { x: -0.8, y: 1.5, z: 0.5 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.18, y: 0.22, z: 0.18 },
        color: "#ffd470",
        material: { metallic: 0.1, roughness: 0.4, emissive: 1.1 },
      },
      {
        type: "sphere", primitive: "sphere", name: "Spirit Lantern R",
        position: { x: 0.8, y: 1.5, z: 0.5 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.18, y: 0.22, z: 0.18 },
        color: "#ffd470",
        material: { metallic: 0.1, roughness: 0.4, emissive: 1.1 },
      },
      {
        type: "torus", primitive: "torus", name: "Wind Chime Halo",
        position: { x: 0, y: 0.9, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1.2, y: 1.2, z: 1.2 },
        color: "#9fdcff",
        material: { metallic: 0.5, roughness: 0.25, emissive: 0.4 },
      },
      {
        type: "sphere", primitive: "sphere", name: "Shrine Pearl",
        position: { x: 0, y: 0.8, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.3, y: 0.3, z: 0.3 },
        color: "#aef7ff",
        material: { metallic: 0.1, roughness: 0.15, emissive: 0.9 },
      },
    ],
  },
  {
    id: "dragon-skeleton-arch", name: "Dragon Skeleton Arch", title: "Dragon Skeleton Arch", description: "Colossal dragon ribcage arch with skull gate and ember heart for dungeon entrances.",
    parts: [
      {
        type: "torus", primitive: "torus", name: "Ribcage Arch 1",
        position: { x: 0, y: 1.6, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 2.6, y: 2.6, z: 2.6 },
        color: "#d8cfb8",
        material: { metallic: 0.05, roughness: 0.7, emissive: 0 },
      },
      {
        type: "torus", primitive: "torus", name: "Ribcage Arch 2",
        position: { x: 0, y: 1.5, z: 0.9 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 2.3, y: 2.3, z: 2.3 },
        color: "#cfc4a8",
        material: { metallic: 0.05, roughness: 0.7, emissive: 0 },
      },
      {
        type: "torus", primitive: "torus", name: "Ribcage Arch 3",
        position: { x: 0, y: 1.4, z: 1.8 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 2, y: 2, z: 2 },
        color: "#d8cfb8",
        material: { metallic: 0.05, roughness: 0.7, emissive: 0 },
      },
      {
        type: "cube", primitive: "cube", name: "Dragon Skull",
        position: { x: 0, y: 1.2, z: -1.8 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 0.7, z: 1.4 },
        color: "#e4dcc4",
        material: { metallic: 0.05, roughness: 0.6, emissive: 0 },
      },
      {
        type: "cone", primitive: "cone", name: "Skull Horn L",
        position: { x: -0.5, y: 1.9, z: -2 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.18, y: 0.8, z: 0.18 },
        color: "#e4dcc4",
      },
      {
        type: "cone", primitive: "cone", name: "Skull Horn R",
        position: { x: 0.5, y: 1.9, z: -2 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.18, y: 0.8, z: 0.18 },
        color: "#e4dcc4",
      },
      {
        type: "sphere", primitive: "sphere", name: "Ember Heart",
        position: { x: 0, y: 0.8, z: 0.4 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.3, y: 0.3, z: 0.3 },
        color: "#ff6b3c",
        material: { metallic: 0, roughness: 0.4, emissive: 1.3 },
      },
      {
        type: "cube", primitive: "cube", name: "Tail Bone Segment",
        position: { x: 0, y: 0.3, z: 3 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.7, y: 0.4, z: 0.9 },
        color: "#cfc4a8",
      },
      {
        type: "cube", primitive: "cube", name: "Tail Bone Tip",
        position: { x: 0, y: 0.2, z: 3.9 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.45, y: 0.3, z: 0.6 },
        color: "#cfc4a8",
      },
    ],
  },
  {
    id: "neon-street-food-stall", name: "Neon Street Food Stall", title: "Neon Street Food Stall", description: "Cyberpunk street food stall with neon signage, steam vents and lantern string.",
    parts: [
      {
        type: "cube", primitive: "cube", name: "Stall Counter",
        position: { x: 0, y: 0.2, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 2.4, y: 0.9, z: 1.1 },
        color: "#39406e",
      },
      {
        type: "cube", primitive: "cube", name: "Stall Canopy",
        position: { x: 0, y: 1.7, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 2.7, y: 0.15, z: 1.5 },
        color: "#b03a6e",
      },
      {
        type: "cube", primitive: "cube", name: "Neon Sign Board",
        position: { x: 0, y: 2.2, z: 0.5 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 2, y: 0.5, z: 0.1 },
        color: "#48e5e5",
        material: { metallic: 0.3, roughness: 0.3, emissive: 1 },
      },
      {
        type: "cylinder", primitive: "cylinder", name: "Steam Vent L",
        position: { x: -0.8, y: 1, z: -0.3 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.16, y: 0.7, z: 0.16 },
        color: "#8d99ae",
        material: { metallic: 0.7, roughness: 0.35, emissive: 0 },
      },
      {
        type: "cylinder", primitive: "cylinder", name: "Steam Vent R",
        position: { x: 0.8, y: 1, z: -0.3 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.16, y: 0.7, z: 0.16 },
        color: "#8d99ae",
        material: { metallic: 0.7, roughness: 0.35, emissive: 0 },
      },
      {
        type: "sphere", primitive: "sphere", name: "Lantern 1",
        position: { x: -1, y: 1.4, z: 0.7 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.14, y: 0.17, z: 0.14 },
        color: "#ff6b9d",
        material: { metallic: 0.1, roughness: 0.4, emissive: 1 },
      },
      {
        type: "sphere", primitive: "sphere", name: "Lantern 2",
        position: { x: 0, y: 1.5, z: 0.7 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.14, y: 0.17, z: 0.14 },
        color: "#ffb84d",
        material: { metallic: 0.1, roughness: 0.4, emissive: 1 },
      },
      {
        type: "sphere", primitive: "sphere", name: "Lantern 3",
        position: { x: 1, y: 1.4, z: 0.7 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.14, y: 0.17, z: 0.14 },
        color: "#48e5e5",
        material: { metallic: 0.1, roughness: 0.4, emissive: 1 },
      },
      {
        type: "cube", primitive: "cube", name: "Ingredient Crate",
        position: { x: 1.5, y: -0.1, z: 0.3 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.5, y: 0.5, z: 0.5 },
        color: "#5a7a4a",
      },
      {
        type: "cube", primitive: "cube", name: "Menu Holo Panel",
        position: { x: -1.4, y: 0.9, z: 0.6 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.1, y: 0.9, z: 0.7 },
        color: "#8b79ff",
        material: { metallic: 0.3, roughness: 0.3, emissive: 0.8 },
      },
    ],
  },
  {
    id: "orbital-satellite", name: "Orbital Satellite", title: "Orbital Satellite", description: "Orbital satellite with twin solar wings, dish, thruster bells and blinking beacons.",
    parts: [
      {
        type: "cube", primitive: "cube", name: "Satellite Bus",
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1.1, y: 1.1, z: 1.1 },
        color: "#c8d2e0",
        material: { metallic: 0.7, roughness: 0.3, emissive: 0 },
      },
      {
        type: "cube", primitive: "cube", name: "Solar Wing L",
        position: { x: -1.9, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 2.4, y: 0.08, z: 1 },
        color: "#2a4a8a",
        material: { metallic: 0.8, roughness: 0.2, emissive: 0.25 },
      },
      {
        type: "cube", primitive: "cube", name: "Solar Wing R",
        position: { x: 1.9, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 2.4, y: 0.08, z: 1 },
        color: "#2a4a8a",
        material: { metallic: 0.8, roughness: 0.2, emissive: 0.25 },
      },
      {
        type: "sphere", primitive: "sphere", name: "Comms Dish",
        position: { x: 0, y: 0.9, z: 0.4 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.6, y: 0.2, z: 0.6 },
        color: "#eef4ff",
        material: { metallic: 0.6, roughness: 0.25, emissive: 0 },
      },
      {
        type: "cylinder", primitive: "cylinder", name: "Dish Mast",
        position: { x: 0, y: 0.6, z: 0.4 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.08, y: 0.5, z: 0.08 },
        color: "#8d99ae",
      },
      {
        type: "cone", primitive: "cone", name: "Thruster Bell A",
        position: { x: -0.3, y: -0.8, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.25, y: 0.4, z: 0.25 },
        color: "#5a6068",
        material: { metallic: 0.8, roughness: 0.3, emissive: 0 },
      },
      {
        type: "cone", primitive: "cone", name: "Thruster Bell B",
        position: { x: 0.3, y: -0.8, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.25, y: 0.4, z: 0.25 },
        color: "#5a6068",
        material: { metallic: 0.8, roughness: 0.3, emissive: 0 },
      },
      {
        type: "sphere", primitive: "sphere", name: "Beacon Light",
        position: { x: 0, y: 0.7, z: -0.5 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.12, y: 0.12, z: 0.12 },
        color: "#ff5e5e",
        material: { metallic: 0.2, roughness: 0.3, emissive: 1.4 },
      },
      {
        type: "cylinder", primitive: "cylinder", name: "Antenna Array",
        position: { x: 0, y: -0.4, z: -0.6 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.05, y: 0.9, z: 0.05 },
        color: "#8d99ae",
      },
      {
        type: "cube", primitive: "cube", name: "Instrument Box",
        position: { x: 0.7, y: -0.3, z: 0.5 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.4, y: 0.5, z: 0.3 },
        color: "#eab96d",
        material: { metallic: 0.7, roughness: 0.35, emissive: 0 },
      },
    ],
  },
]);

export const ATMOSPHERE_MOODS = Object.freeze([
  { id: "unreal-daylight", name: "Unreal Daylight", title: "Unreal Daylight", description: "Crisp UE5-style midday: ACES, Lumen GI and clean studio sky IBL.", environmentPreset: "studio", toneMapping: "aces", toneMappingMode: "aces", exposure: 1.15, environmentStrength: 1.1, fog: false, fogColor: "#9db8d8", fogDensity: 0.006, lumenGI: true, bloom: true, bloomStrength: 0.25, bloomThreshold: 0.85, sky: "day" },
  { id: "golden-hour", name: "Golden Hour", title: "Golden Hour", description: "Warm copper sunset, long shadows and a glowing horizon.", environmentPreset: "sunset", toneMapping: "aces", toneMappingMode: "aces", exposure: 1.25, environmentStrength: 1.2, fog: true, fogColor: "#d89a6a", fogDensity: 0.01, lumenGI: true, bloom: true, bloomStrength: 0.4, bloomThreshold: 0.85, sky: "sunset" },
  { id: "cyberpunk-neon", name: "Cyberpunk Neon", title: "Cyberpunk Neon", description: "Night city neon: deep blue IBL, AgX highlights and strong bloom.", environmentPreset: "night", toneMapping: "agx", toneMappingMode: "agx", exposure: 1.05, environmentStrength: 0.9, fog: true, fogColor: "#2a2350", fogDensity: 0.016, lumenGI: true, bloom: true, bloomStrength: 0.7, bloomThreshold: 0.85, sky: "night" },
  { id: "volcanic-forge", name: "Volcanic Forge", title: "Volcanic Forge", description: "Ember-lit forge gloom with filmic contrast and smoky fog.", environmentPreset: "ember", toneMapping: "filmic", toneMappingMode: "filmic", exposure: 1.1, environmentStrength: 1.0, fog: true, fogColor: "#6a3a28", fogDensity: 0.02, lumenGI: true, bloom: true, bloomStrength: 0.5, bloomThreshold: 0.85, sky: "ember" },
  { id: "arctic-blizzard", name: "Arctic Blizzard", title: "Arctic Blizzard", description: "Whiteout alpine storm: overcast IBL, AgX snow highlights and dense cold fog.", environmentPreset: "overcast", toneMapping: "agx", toneMappingMode: "agx", exposure: 1.2, environmentStrength: 1.05, fog: true, fogColor: "#cfe2f2", fogDensity: 0.028, lumenGI: true, bloom: true, bloomStrength: 0.3, bloomThreshold: 0.85, sky: "overcast" },
  { id: "emerald-rainforest", name: "Emerald Rainforest", title: "Emerald Rainforest", description: "Humid jungle canopy light with misty green fog and soft GI bounce.", environmentPreset: "studio", toneMapping: "aces", toneMappingMode: "aces", exposure: 1.08, environmentStrength: 1.15, fog: true, fogColor: "#4a7a5c", fogDensity: 0.018, lumenGI: true, bloom: true, bloomStrength: 0.32, bloomThreshold: 0.85, sky: "day" },
  { id: "noir-monochrome", name: "Noir Monochrome", title: "Noir Monochrome", description: "Hard monochrome contrast, filmic curve and a single rim of bloom.", environmentPreset: "night", toneMapping: "filmic", toneMappingMode: "filmic", exposure: 0.95, environmentStrength: 0.7, fog: true, fogColor: "#3a3f4a", fogDensity: 0.012, lumenGI: true, bloom: true, bloomStrength: 0.22, bloomThreshold: 0.85, sky: "night" },
  { id: "deep-space-nebula", name: "Deep Space Nebula", title: "Deep Space Nebula", description: "Starfield void with violet nebula IBL, AgX highlights and zero fog.", environmentPreset: "night", toneMapping: "agx", toneMappingMode: "agx", exposure: 1.0, environmentStrength: 1.3, fog: false, fogColor: "#120e2a", fogDensity: 0.002, lumenGI: true, bloom: true, bloomStrength: 0.65, bloomThreshold: 0.85, sky: "night" },
]);

export const VISUAL_UI_BLOCKS = Object.freeze([
  { id: "hero-banner", name: "Hero Banner", title: "Hero Banner", description: "Big title, supporting paragraph and primary action button.", snippet: "        title(\"Your next big idea\", size: 36)\n        paragraph(\"Built in one click with Orvexa Visual UI Blocks.\")\n        button(\"Get started\") {\n            print(\"hero clicked\")\n        }" },
  { id: "feature-card", name: "Feature Card", title: "Feature Card", description: "A padded card with heading and body copy for features or products.", snippet: "        card(padding: 20) {\n            title(\"Feature highlight\", size: 20)\n            text(\"Describe the feature, benefit or product in one or two lines.\")\n        }" },
  { id: "stats-row", name: "Stats Row", title: "Stats Row", description: "A row of badges for stats, tags or quick facts.", snippet: "        row(gap: 10) {\n            badge(\"Fast\")\n            badge(\"Local-first\")\n            badge(\"No API key needed\")\n        }" },
  { id: "call-to-action", name: "Call To Action", title: "Call To Action", description: "Closing pitch with a high-intent action button.", snippet: "        title(\"Ready when you are\", size: 24)\n        button(\"Start creating — it is free\") {\n            print(\"cta clicked\")\n        }" },
  { id: "faq-accordion", name: "FAQ Accordion", title: "FAQ Accordion", description: "Question-and-answer card pair for help and onboarding.", snippet: "        card(padding: 16) {\n            title(\"Frequently asked question?\", size: 18)\n            text(\"Answer it here in plain, friendly language a beginner can follow.\")\n        }" },
  { id: "pricing-table", name: "Pricing Table", title: "Pricing Table", description: "Three-tier pricing card row with a highlighted popular plan.", snippet: "        row(gap: 12) {\n            card(padding: 16) {\n                title(\"Starter — Free\", size: 18)\n                text(\"Everything a beginner needs to publish a first creation.\")\n            }\n            card(padding: 16) {\n                title(\"Creator — Popular\", size: 18)\n                text(\"Apex Engine tools, AI Agent credits and priority support.\")\n            }\n            card(padding: 16) {\n                title(\"Pro Studio\", size: 18)\n                text(\"Team workspaces, BYOK providers and export pipelines.\")\n            }\n        }" },
  { id: "testimonial-wall", name: "Testimonial Wall", title: "Testimonial Wall", description: "Customer quote cards with names and star badges.", snippet: "        row(gap: 12) {\n            card(padding: 16) {\n                title(\"★★★★★ — Priya, Mumbai\", size: 16)\n                text(\"Maine apna pehla game ek ghante me bana liya. No API key needed!\")\n            }\n            card(padding: 16) {\n                title(\"★★★★★ — Dan, Berlin\", size: 16)\n                text(\"The Nanite LOD and Material Lab feel like Unreal in a browser tab.\")\n            }\n        }" },
  { id: "countdown-banner", name: "Countdown Banner", title: "Countdown Banner", description: "Urgency banner with a live countdown state button.", snippet: "        card(padding: 16) {\n            badge(\"LIMITED TIME\")\n            title(\"Launch week ends soon\", size: 20)\n            button(\"Claim launch offer\") {\n                print(\"countdown offer claimed\")\n            }\n        }" },
  { id: "newsletter-signup", name: "Newsletter Signup", title: "Newsletter Signup", description: "Email capture card with a subscribe action.", snippet: "        card(padding: 18) {\n            title(\"Get creator tips weekly\", size: 20)\n            text(\"One short email with a template, a trick and a community showcase.\")\n            button(\"Subscribe free\") {\n                print(\"newsletter subscribed\")\n            }\n        }" },
  { id: "team-grid", name: "Team Grid", title: "Team Grid", description: "Team member cards with roles and contact buttons.", snippet: "        row(gap: 12) {\n            card(padding: 16) {\n                title(\"Ava — Creative Director\", size: 17)\n                button(\"Message Ava\") {\n                    print(\"message ava\")\n                }\n            }\n            card(padding: 16) {\n                title(\"Ravi — Engine Lead\", size: 17)\n                button(\"Message Ravi\") {\n                    print(\"message ravi\")\n                }\n            }\n        }" },
  { id: "gallery-grid", name: "Gallery Grid", title: "Gallery Grid", description: "A visual gallery of cards with captions.", snippet: "        row(gap: 12) {\n            card(padding: 14) {\n                title(\"Gallery piece one\", size: 17)\n                text(\"Caption for the first masterpiece.\")\n            }\n            card(padding: 14) {\n                title(\"Gallery piece two\", size: 17)\n                text(\"Caption for the second masterpiece.\")\n            }\n            card(padding: 14) {\n                title(\"Gallery piece three\", size: 17)\n                text(\"Caption for the third masterpiece.\")\n            }\n        }" },
  { id: "stats-band", name: "Stats Band", title: "Stats Band", description: "A full-width band of headline metrics.", snippet: "        card(padding: 18) {\n            title(\"Loved by creators everywhere\", size: 20)\n            row(gap: 10) {\n                badge(\"12,000+ games\")\n                badge(\"4.9 rating\")\n                badge(\"100% free start\")\n            }\n        }" },
  { id: "process-steps", name: "Process Steps", title: "Process Steps", description: "Numbered how-it-works steps for onboarding.", snippet: "        card(padding: 18) {\n            title(\"How it works\", size: 20)\n            text(\"1 — Pick a template or tell the AI your idea.\")\n            text(\"2 — Press Run and watch it come alive.\")\n            text(\"3 — Change colours, add your name, share it.\")\n        }" },
  { id: "reward-card", name: "Reward Card", title: "Reward Card", description: "Gamified reward card with a claim button.", snippet: "        card(padding: 18) {\n            badge(\"DAILY REWARD\")\n            title(\"You earned a creator badge!\", size: 20)\n            text(\"Come back tomorrow for the next reward.\")\n            button(\"Claim reward\") {\n                print(\"reward claimed\")\n            }\n        }" },
  { id: "level-progress", name: "Level Progress", title: "Level Progress", description: "XP level card with progress copy and level-up action.", snippet: "        card(padding: 18) {\n            title(\"Creator Level 3\", size: 20)\n            text(\"240 XP — finish two more projects to reach Level 4.\")\n            button(\"Start next project\") {\n                print(\"next project started\")\n            }\n        }" },
  { id: "menu-list", name: "Menu List", title: "Menu List", description: "A tasty menu / catalogue list with prices.", snippet: "        card(padding: 18) {\n            title(\"Today's specials\", size: 20)\n            text(\"Paneer Tikka — ₹240 · smoky and bright\")\n            text(\"Masala Dosa — ₹160 · crisp and golden\")\n            text(\"Cold Coffee — ₹120 · slow-brewed\")\n        }" },
  { id: "booking-card", name: "Booking Card", title: "Booking Card", description: "Appointment booking card with reserve action.", snippet: "        card(padding: 18) {\n            title(\"Book your slot\", size: 20)\n            text(\"Pick a time that suits you — confirmation is instant.\")\n            button(\"Reserve my slot\") {\n                print(\"slot reserved\")\n            }\n        }" },
  { id: "social-proof-bar", name: "Social Proof Bar", title: "Social Proof Bar", description: "Avatar-free proof strip with community badges.", snippet: "        row(gap: 10) {\n            badge(\"👩‍🎨 2,400 creators online\")\n            badge(\"🏆 Game of the week\")\n            badge(\"💬 Hinglish support\")\n        }" },
  {"id": "app-download", "name": "App Download", "title": "App Download", "description": "Phone-friendly download card with store badges and a QR hint.", "snippet": "        card(padding: 18) {\n            title(\"Take the app anywhere\", size: 20)\n            text(\"Scan the code or tap a store badge — your creations sync everywhere.\")\n            row(gap: 10) {\n                badge(\"🍎 App Store\")\n                badge(\"🤖 Google Play\")\n            }\n            button(\"Get the free app\") {\n                print(\"app download clicked\")\n            }\n        }"},
  {"id": "feature-compare", "name": "Feature Compare", "title": "Feature Compare", "description": "Side-by-side free vs pro comparison card pair.", "snippet": "        row(gap: 12) {\n            card(padding: 16) {\n                title(\"Free — start today\", size: 18)\n                text(\"All templates, Scene Studio and the AI Agent included.\")\n            }\n            card(padding: 16) {\n                title(\"Pro — go further\", size: 18)\n                text(\"Unreal-style engine tools, team spaces and priority exports.\")\n                button(\"Compare plans\") {\n                    print(\"compare plans clicked\")\n                }\n            }\n        }"},
  {"id": "how-to-video", "name": "How To Video", "title": "How To Video", "description": "Watch-and-do tutorial card with step checklist.", "snippet": "        card(padding: 18) {\n            badge(\"▶ WATCH & DO\")\n            title(\"Make your first game in 5 minutes\", size: 20)\n            text(\"Step 1 — Pick Neon Drift Kart. Step 2 — Press Run. Step 3 — Change the sky and your name.\")\n            button(\"Start the tutorial\") {\n                print(\"how-to started\")\n            }\n        }"},
  {"id": "winner-spotlight", "name": "Winner Spotlight", "title": "Winner Spotlight", "description": "Celebrate a community winner with trophy badges.", "snippet": "        card(padding: 18) {\n            badge(\"🏆 CREATOR OF THE WEEK\")\n            title(\"Meera built Sky Lantern Quest\", size: 20)\n            text(\"Started Monday, published Friday — 4,000 plays and counting.\")\n            row(gap: 10) {\n                badge(\"⭐ 4.9 community rating\")\n                badge(\"🎮 4,000 plays\")\n            }\n        }"},
  {"id": "daily-quest-card", "name": "Daily Quest Card", "title": "Daily Quest Card", "description": "A daily quest card with a go-do-it button, perfect for Home screens.", "snippet": "        card(padding: 18) {\n            badge(\"📅 AAJ KA QUEST\")\n            title(\"Remix a template your way\", size: 20)\n            text(\"Open any template, press Remix, change the colours and press Run. Easy +40 XP!\")\n            button(\"Start quest\") {\n                print(\"daily quest started\")\n            }\n        }"},
  {"id": "friend-invite", "name": "Friend Invite", "title": "Friend Invite", "description": "Invite-friends card with a share action.", "snippet": "        card(padding: 18) {\n            title(\"Doston ko bulao, saath banao!\", size: 20)\n            text(\"Share your game link — friends can play instantly, no install needed.\")\n            button(\"Copy invite link\") {\n                print(\"invite link copied\")\n            }\n        }"}
]);


function findUiBlock(blockId) {
  const block = VISUAL_UI_BLOCKS.find(b => b.id === blockId || b.name === blockId);
  if (!block) throw new Error(`Unknown visual UI block "${blockId}". Known blocks: ${VISUAL_UI_BLOCKS.map(b => b.id).join(', ')}.`);
  return block;
}

/**
 * Insert a visual UI block into the first page { ... } of an Orvexa source
 * (creating a Home page when none exists). Brace matching is string-aware so
 * braces inside string literals never corrupt the insertion point.
 */
export function insertVisualUiBlock(source, blockId) {
  const block = findUiBlock(blockId);
  const text = String(source ?? '');
  const pageMatch = text.match(/page\s+"[^"]*"\s*\{/);
  if (!pageMatch) {
    const base = text.trimEnd();
    return `${base}${base ? '\n\n' : ''}page "Home" {\n    column(gap: 14) {\n${block.snippet}\n    }\n}\n`;
  }
  const start = pageMatch.index + pageMatch[0].length;
  let depth = 1; let inString = false; let escaped = false; let end = -1;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) { if (escaped) escaped = false; else if (ch === '\\') escaped = true; else if (ch === '"') inString = false; continue; }
    if (ch === '"') { inString = true; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end < 0) throw new Error('Could not find the closing brace of the page block. Run Auto-Fix first.');
  const before = text.slice(0, end).trimEnd();
  const after = text.slice(end);
  return `${before}\n${block.snippet}\n${after}\n`;
}

const KEYWORD_TYPOS = Object.freeze([
  [/\bap\s+"/g, 'app "'], [/\bpag\s+"/g, 'page "'], [/\bscen\s+"/g, 'scene "'],
  [/\bprnt\s*\(/g, 'print('], [/\btitel\s*\(/g, 'title('], [/\bbuton\s*\(/g, 'button('],
  [/\bcollumn\s*\(/g, 'column('], [/\bparagraf\s*\(/g, 'paragraph('], [/\bcub\s*\(/g, 'cube('],
  [/\bspher\s*\(/g, 'sphere('], [/\bstat\s+/g, 'state '], [/\bfuntion\s+/g, 'function '],
  [/\bcamra\s*\(/g, 'camera('], [/\bligt\s*\(/g, 'light('], [/\bmateral\s*\(/g, 'material('],
  [/\banimat\s*\(/g, 'animate('], [/\bcontoller\s*\(/g, 'controller('], [/\brigdbody\s*\(/g, 'rigidbody('],
]);

/** Parse a numeric token leniently: strips units, commas and stray letters. */
export function sanitizeNumericToken(token) {
  const cleaned = String(token ?? '').replace(/,/g, '').replace(/[^0-9.+-]/g, '');
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function balanceDelimiters(text) {
  const stack = [];
  let inString = false; let escaped = false; let inLineComment = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inLineComment) { if (ch === '\n') inLineComment = false; continue; }
    if (inString) { if (escaped) escaped = false; else if (ch === '\\') escaped = true; else if (ch === '"') inString = false; continue; }
    if (ch === '/' && text[i + 1] === '/') { inLineComment = true; continue; }
    if (ch === '"') { inString = true; continue; }
    if (ch === '(' || ch === '{' || ch === '[') stack.push(ch);
    else if (ch === ')' || ch === '}' || ch === ']') {
      const open = ch === ')' ? '(' : ch === '}' ? '{' : '[';
      const idx = stack.lastIndexOf(open);
      if (idx >= 0) stack.length = idx; else return { balanced: false, stray: ch };
    }
  }
  return { balanced: stack.length === 0 && !inString, stack, unterminatedString: inString };
}

/**
 * Comprehensive deterministic Auto-Fix for Orvexa / RealmScript sources:
 *  - CRLF + smart quotes/dashes + full-width punctuation normalisation
 *  - keyword typo repair (ap / pag / scen / prnt / titel ...)
 *  - invalid numeric fields (size: "big", vec3 with words) repaired or dropped
 *  - unbalanced (), {}, [] and unterminated strings closed in stack order
 *  - scenes without camera/light receive safe defaults
 *  - missing `app "..."` header added for .orv files with pages/scenes
 * Returns the fixed source string. Pure and idempotent.
 */
export function autoFixProjectSource(source, filename = 'main.orv') {
  const isRealm = /\.realm$/i.test(String(filename));
  let text = String(source ?? '').replace(/\r\n?/g, '\n');
  text = text.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[–—]/g, '-')
    .replace(/：/g, ':').replace(/；/g, ';').replace(/，/g, ',').replace(/（/g, '(').replace(/）/g, ')');
  for (const [pattern, replacement] of KEYWORD_TYPOS) text = text.replace(pattern, replacement);
  // Repair unquoted malformed numerics such as size: 1..5 or radius: 0,5x.
  text = text.replace(/\b(size|radius|speed|jumpSpeed|gap|padding|mass|restitution|friction|metallic|roughness|emissive|clearcoat)\s*:\s*([^\s,}\]"]+)/g,
    (whole, key, raw) => { if (/^-?\d+(\.\d+)?$/.test(raw)) return whole; const m = String(raw).match(/-?\d+(?:\.\d+)?/); return m ? `${key}: ${m[0]}` : ''; });
  // Repair invalid numeric literal fields such as size: "big" or radius: abc.
  text = text.replace(/\b(size|radius|speed|jumpSpeed|gap|padding|mass|restitution|friction|metallic|roughness|emissive|clearcoat)\s*:\s*"([^"]*)"/g,
    (whole, key, raw) => { const n = sanitizeNumericToken(raw); return n === null ? '' : `${key}: ${n}`; });
  text = text.replace(/\bvec3\(\s*([^)]*)\)/g, (whole, inner) => {
    const parts = inner.split(',').map(part => { const n = sanitizeNumericToken(part); return n === null ? 0 : n; });
    while (parts.length < 3) parts.push(0);
    return `vec3(${parts.slice(0, 3).join(', ')})`;
  });
  const balance = balanceDelimiters(text);
  if (balance.unterminatedString) text += '"';
  if (balance.stack && balance.stack.length) {
    const closers = [...balance.stack].reverse().map(o => (o === '(' ? ')' : o === '{' ? '}' : ']')).join('');
    text = `${text.trimEnd()}\n${closers}\n`;
  }
  if (!isRealm) {
    // Ensure every scene has a camera and a light.
    text = text.replace(/scene\s+"([^"]*)"\s*\{([^}]*)\}/g, (whole, name, body) => {
      let next = body;
      if (!/\bcamera\s*\(/.test(next)) next = `\n    camera(position: vec3(0, 2.4, 8))${next}`;
      if (!/\blight\s*\(/.test(next)) next = `${next}\n    light(position: vec3(3, 6, 4), color: "#fff2dc")\n`;
      return `scene "${name}" {${next}}`;
    });
    if (text.trim() && !/\bapp\s+"/.test(text) && /\b(page|scene)\s+"/.test(text)) {
      const name = String(filename).split('/').pop().replace(/\.orv$/i, '').replace(/[-_]+/g, ' ').trim() || 'My Orvexa Creation';
      text = `app "${name.charAt(0).toUpperCase() + name.slice(1)}"\n\n${text}`;
    }
  }
  if (text && !text.endsWith('\n')) text += '\n';
  return text;
}

/** Validate + report what Auto-Fix would change, without mutating. */
export function diagnoseProjectSource(source, filename = 'main.orv') {
  const original = String(source ?? '');
  const fixed = autoFixProjectSource(original, filename);
  const balance = balanceDelimiters(original.replace(/\r\n?/g, '\n'));
  return {
    changed: fixed !== original,
    balanced: balance.balanced,
    unterminatedString: Boolean(balance.unterminatedString),
    missingAppHeader: !/\.realm$/i.test(String(filename)) && !/\bapp\s+"/.test(original) && /\b(page|scene)\s+"/.test(original),
    fixedSource: fixed,
  };
}

export function getGameBlueprint(blueprintId) {
  const bp = GAME_BLUEPRINTS.find(b => b.id === blueprintId);
  if (!bp) throw new Error(`Unknown game blueprint "${blueprintId}".`);
  return bp;
}
export function getWebAppTemplate(templateId) {
  const tpl = WEB_APP_TEMPLATES.find(x => x.id === templateId);
  if (!tpl) throw new Error(`Unknown web app template "${templateId}".`);
  return tpl;
}
export function getPrefabKitbash(prefabId) {
  const prefab = PREFAB_KITBASH_LIBRARY.find(x => x.id === prefabId);
  if (!prefab) throw new Error(`Unknown prefab "${prefabId}".`);
  return JSON.parse(JSON.stringify(prefab));
}
export function getAtmosphereMood(moodId) {
  const mood = ATMOSPHERE_MOODS.find(x => x.id === moodId);
  if (!mood) throw new Error(`Unknown atmosphere mood "${moodId}".`);
  return { ...mood };
}

/* ------------------------------------------------------------------ */
/* v8 Content Store: metadata, themes, remix and Hinglish search      */
/* ------------------------------------------------------------------ */

const TEMPLATE_EMOJI = { game: '🎮', web: '🌐', rpg: '🐉', racing: '🏎️', space: '🚀', horror: '👻', survival: '🏝️', ecommerce: '🛍️', fitness: '💪', crypto: '🪙', music: '🎵', education: '🎓' };

export function getTemplateMeta(entry) {
  const kind = entry?.realmSource || /rpg|quest|adventure/i.test(entry?.genre || '') ? 'game' : (entry?.category ? 'web' : 'game');
  const text = `${entry?.id || ''} ${entry?.genre || ''} ${entry?.name || ''}`.toLowerCase();
  const emojiKey = Object.keys(TEMPLATE_EMOJI).find(k => text.includes(k)) || kind;
  const lines = String(entry?.source || '').split('\n').length;
  return {
    id: entry?.id,
    kind,
    difficulty: entry?.difficulty || (lines > 120 ? 'pro' : lines > 95 ? 'creator' : 'beginner'),
    timeToMake: lines > 120 ? '10 min' : lines > 95 ? '5 min' : '2 min',
    lineCount: lines,
    tags: [entry?.genre || entry?.category || 'Orvexa', kind === 'game' ? 'Playable' : 'Interactive', '1-Click'],
    emoji: TEMPLATE_EMOJI[emojiKey] || '✦',
    whatYouLearn: kind === 'game'
      ? ['Scene mein 3D objects kaise bante hain', 'Buttons se score/state kaise badhta hai', 'Camera aur light ka kamaal']
      : ['Cards aur sections se page kaise banta hai', 'Buttons se live numbers kaise badalte hain', 'Apna naam/brand kaise lagayein'],
  };
}

export function listTemplateMetas() {
  return [...GAME_BLUEPRINTS, ...WEB_APP_TEMPLATES].map(getTemplateMeta);
}

export const APP_THEMES = Object.freeze([
  { id: 'neon-night', name: 'Neon Night', palette: ['#ff6b9d', '#48e5e5', '#8b79ff', '#ffd94a', '#23233a'] },
  { id: 'royal-gold', name: 'Royal Gold', palette: ['#eab96d', '#ffd77a', '#8a5c1c', '#fff2dc', '#3a2c14'] },
  { id: 'forest-calm', name: 'Forest Calm', palette: ['#62b26f', '#3ddc97', '#2ea84a', '#d8ffd0', '#20301e'] },
  { id: 'candy-pop', name: 'Candy Pop', palette: ['#ff8ac2', '#ffd94a', '#56f0e8', '#c88aff', '#3a1f3f'] },
  { id: 'ocean-deep', name: 'Ocean Deep', palette: ['#56b6ff', '#3ddc97', '#1c4d8a', '#cfe8ff', '#12283f'] },
  { id: 'sunset-glow', name: 'Sunset Glow', palette: ['#ff9a5c', '#ff6b6b', '#ffd94a', '#ffe8d8', '#40231a'] },
  { id: 'mono-noir', name: 'Mono Noir', palette: ['#e8e4d8', '#9aa3b0', '#5c6470', '#ffffff', '#1a1a1f'] },
  { id: 'royal-velvet', name: 'Royal Velvet', palette: ['#c88aff', '#ff6b9d', '#7c5cff', '#ffd9ec', '#2c1d38'] },
]);

export function getAppTheme(themeId) {
  const theme = APP_THEMES.find(x => x.id === themeId);
  if (!theme) throw new Error(`Unknown app theme "${themeId}".`);
  return theme;
}

/** Replace every hex colour in a source with the theme palette (in order of first appearance). */
export function applyAppTheme(source, themeId) {
  const theme = getAppTheme(themeId);
  const seen = new Map();
  return String(source ?? '').replace(/#[0-9a-fA-F]{6}\b/g, (hex) => {
    const key = hex.toLowerCase();
    if (!seen.has(key)) seen.set(key, theme.palette[seen.size % theme.palette.length]);
    return seen.get(key);
  });
}

/** Remix a blueprint/template: new title + themed palette + renamed app header. */
export function remixTemplate(entryId, options = {}) {
  const entry = [...GAME_BLUEPRINTS, ...WEB_APP_TEMPLATES].find(x => x.id === entryId);
  if (!entry) throw new Error(`Unknown template "${entryId}" for remix.`);
  const newTitle = String(options.title || `${entry.title} Remix`).slice(0, 60);
  let source = applyAppTheme(entry.source, options.themeId || 'neon-night');
  source = source.replace(/app "[^"]*"/, `app "${newTitle}"`);
  source = source.replace(new RegExp(`title\\("${entry.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g'), `title("${newTitle}"`);
  return { id: `${entry.id}-remix`, title: newTitle, kind: entry.category ? 'web' : 'game', themeId: options.themeId || 'neon-night', source, lineCount: source.split('\n').length, baseId: entry.id };
}

export const TEMPLATE_SEARCH_SYNONYMS = Object.freeze({
  dukaan: ['ecommerce', 'shop', 'store'], dukkan: ['ecommerce', 'shop'], shop: ['ecommerce', 'store'],
  khel: ['game', 'racing', 'rpg'], game: ['game'], khana: ['restaurant', 'food', 'menu'],
  gana: ['music', 'daw'], gaana: ['music'], safar: ['travel', 'booking'], naukri: ['job', 'career'],
  ticket: ['event', 'tickets'], hotel: ['travel', 'restaurant'], padhai: ['education', 'quiz', 'learn'],
  sehet: ['fitness', 'health'], race: ['racing', 'kart', 'drift'], bhoot: ['horror', 'zombie'],
  machli: ['fishing'], kheti: ['farm'], ladai: ['mech', 'zombie', 'defense'],
});

export function searchTemplates(query) {
  const raw = String(query || '').toLowerCase();
  const terms = new Set(raw.split(/[^a-z0-9]+/i).filter(Boolean));
  for (const key of Object.keys(TEMPLATE_SEARCH_SYNONYMS)) if (terms.has(key)) TEMPLATE_SEARCH_SYNONYMS[key].forEach(x => terms.add(x));
  const all = [
    ...GAME_BLUEPRINTS.map(e => ({ ...e, storeKind: 'game' })),
    ...WEB_APP_TEMPLATES.map(e => ({ ...e, storeKind: 'web' })),
    ...PREFAB_KITBASH_LIBRARY.map(e => ({ ...e, storeKind: 'prefab' })),
    ...ATMOSPHERE_MOODS.map(e => ({ ...e, storeKind: 'mood' })),
  ];
  if (!terms.size) return all;
  return all.filter(e => {
    const hay = `${e.id} ${e.name} ${e.title || ''} ${e.genre || ''} ${e.category || ''} ${e.description || ''} ${e.storeKind} ${getTemplateMeta(e).tags.join(' ')}`.toLowerCase();
    return [...terms].some(term => hay.includes(term));
  });
}

/** Deterministic template of the day (same all day, rotates daily). */
export function getTemplateOfTheDay(date = new Date()) {
  const dayIndex = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
  const pool = [...GAME_BLUEPRINTS, ...WEB_APP_TEMPLATES];
  return pool[((dayIndex % pool.length) + pool.length) % pool.length];
}

/** Move a named card block up/down inside the first page of a source (visual reorder). */
export function movePageCard(source, cardTitle, direction = 'up') {
  const text = String(source ?? '');
  const cardRe = /        card\(padding: \d+\) \{[\s\S]*?\n        \}/g;
  const cards = [...text.matchAll(cardRe)];
  const index = cards.findIndex(m => m[0].includes(`title("${cardTitle}"`));
  if (index < 0) throw new Error(`Card "${cardTitle}" not found in the first page.`);
  const swapWith = direction === 'down' ? index + 1 : index - 1;
  if (swapWith < 0 || swapWith >= cards.length) return text;
  const a = cards[index]; const b = cards[swapWith];
  const first = Math.min(a.index, b.index); const second = Math.max(a.index, b.index);
  const firstText = first === a.index ? a[0] : b[0];
  const secondText = first === a.index ? b[0] : a[0];
  return text.slice(0, first) + secondText + text.slice(first + firstText.length, second) + firstText + text.slice(second + secondText.length);
}

