# Terrarium — Design

*Version 0.3, 15 October 2026. Owner: Faisal Chishti. Repository: public from day one.*

This is the one document every agent reads before touching the code. It says
what Terrarium is, the rules that settle design questions, how it is built,
how we know it works, and who builds which part. When this document and the
code disagree, the code is wrong or this document needs a change approved by
the lead.

---

## 1. The one idea

**A sealed glass terrarium on a desk, alive.**

It is a slab terrarium: a thin glass case, like an ant farm, so you see the
whole cross-section at once — gravel, soil, roots, a water table, moss and
plants above, air, and condensation on the glass. Inside, a real ecosystem
runs: water evaporates under the lamp, condenses on the cool glass and runs
back down; plants grow toward the light and roots toward water; tiny
creatures graze, decompose and evolve; what dies feeds what lives. Nothing
enters the jar but light.

You cannot command anything inside. You can only do what a person could do
to a real terrarium.

| What you do | What it is |
| --- | --- |
| Turn the lamp's dimmer, move the lamp | Light and heat (the main input) |
| Turn the lamp's clock | Speed of time |
| Mist through the lid | Add water (the one thing that breaks the seal, and it says so) |
| Drop in a seed or an egg from the packet | Add life |
| Tap the glass | Startle creatures |
| Hold the magnifying glass | Inspect: zoom, follow a creature, read its genome |
| Tilt the case | Granular material slides (sand, gravel, soil) |
| The paper tag tied to the jar | Settings (quality, units, language, seed) |
| The field notebook beside the jar | Statistics, history and journal entries |

There are no panels, sidebars or toolbars. If a feature cannot be expressed
as something on or beside the jar, it is redesigned until it can, or dropped.

### 1.1 Lineage: from Veridia

Terrarium is the successor to **Veridia**, an earlier small deterministic
world simulation in the browser (procedural terrain, wandering agents, a
day/night cycle). Veridia's agents wandered over a world they could not
change and that did not need them. Terrarium asks the next question: what if
survival depends on the world's physics, and the world depends on what lives
in it? Determinism carries over; everything else goes deeper — matter that
moves and balances, light as the energy that drives the system, and
creatures whose brains evolve.

---

## 2. Design rules

These decide most questions about where code goes and what it does.

1. **The jar is a place, not a UI.** Every control is a real-world action on
   a terrarium (§1). New features are designed by asking what a person at
   the desk would do.
2. **It is a closed system, and the books balance.** Water, carbon and
   nutrients are conserved: they move between forms (vapour, soil water,
   sugar, leaf, creature, detritus, CO₂) but are never created or destroyed.
   Only light energy enters; heat leaves. Misting is the single, logged
   exception. Conservation is checked by tests every tick in debug builds.
3. **Deterministic.** A seed plus the log of your actions reproduces a jar
   exactly: fixed timestep of 60 jar-seconds, seeded PRNG, no `Math.random`,
   no wall-clock time inside the simulation. This gives replays, share links, bug reports
   that reproduce, and headless testing. Because `Math.sin`, `Math.exp`,
   `Math.pow` and friends may differ between JavaScript engines, the
   simulation uses its own implementations of these from `src/shared/`;
   iteration order is always explicit (no iteration over object keys or
   `Set`s inside a tick). A process needing finer resolution uses
   deterministic internal substeps within the fixed tick.
4. **The simulation never waits for the screen.** The simulation runs in a
   Web Worker at a fixed tick; the renderer draws at the display's rate and
   interpolates between ticks. Neither blocks the other.
5. **One reference, one port.** The CPU simulation in TypeScript is the
   source of truth. The WebGPU compute version is a port of it and is
   checked against it by a parity test. A fix goes into the reference first.
6. **Same code, less work.** Quality levels (§6) change grid size, sample
   counts and effects, never which algorithm runs. There is no second
   implementation for weak machines.
7. **Build what is alive; borrow the rest.** We build the simulation, the
   creatures and the drawing of the jar. We borrow the build tool, test
   tools, small math helpers, storage and the language model. A new
   dependency needs the lead's approval and a line in §8.
8. **Real units.** Millimetres, millilitres, grams, degrees Celsius and
   jar-hours, converted at the edges. A bigger screen shows the same jar
   larger, not more jar.

---

## 3. What it is built with

| Concern | Choice | Why |
| --- | --- | --- |
| Language | TypeScript (strict) | One language for simulation, rendering and tools |
| Build | Vite | Fast dev server, static output |
| Simulation | Web Worker + `SharedArrayBuffer` | Rule 4; zero-copy hand-off to the renderer |
| GPU | WebGPU (compute + render) | Current Chrome, Edge, Firefox and Safari |
| Fallback renderer | WebGL2, then Canvas 2D | Every browser; also used headless |
| UI chrome (tag, notebook) | Plain DOM + CSS, drawn as paper and ink | No framework needed for a handful of objects |
| Storage | IndexedDB | Saved jars, notebook history |
| Tests | Vitest (unit, conservation), Playwright (browser, screenshots, GPU parity) | |
| Headless render | `@napi-rs/canvas` in Node | The preview tool (§7) |
| Hosting | Cloudflare Pages | Static, free, supports the COOP/COEP headers `SharedArrayBuffer` needs |
| Language model | — | The narrator is deferred beyond v0.1 (§5.6) |

---

## 4. Architecture

```
┌──────────────────────── Main thread ─────────────────────────┐
│  Input (pointer, keys) ──► Actions ──► postMessage to worker  │
│  Renderer (WebGPU | WebGL2 | Canvas2D) ◄── reads state views  │
│  Tag (settings), Notebook (stats, journal)                    │
└───────────────▲──────────────────────────────┬────────────────┘
                │ SharedArrayBuffer (double-buffered state)   │ actions
┌───────────────┴──────────── Sim worker ──────▼────────────────┐
│  Clock (fixed tick) → Field step → Plants → Creatures →        │
│  Ledger (conservation) → Event log → publish front buffer      │
│  Backend: CPU reference | WebGPU compute (same interface)      │
└───────────────────────────────────────────────────────────────┘
```

- **State** is plain typed arrays in one `SharedArrayBuffer`, double-buffered.
  The worker writes the back buffer, then flips an atomic index. The renderer
  only ever reads the front buffer. After publishing a tick batch, the worker
  waits for the main thread to copy that state and acknowledge its tick before
  publishing another batch, so a delayed message handler cannot read a newer
  state in place of the notified one.
- **Actions** (mist, seed, tilt, tap) are queued with the tick they apply to,
  which is what makes replays exact (Rule 3).
- **Events** (birth, death, bloom, drought, first flower) are appended to a
  ring buffer. The notebook reads them; the simulation never does.
- **Backends** implement one interface, `SimBackend { step(n), read(), apply(action) }`.
  The CPU backend is complete first; the WebGPU backend replaces the field
  step only, then grows.
- The worker uses a monotonic-time accumulator at the selected tick rate;
  it never drops simulation ticks. If it cannot sustain the requested rate,
  jar time slows and the achieved rate is reported. Publication waits for the
  main thread's acknowledgement after copying each batch state; accumulated
  tick debt remains in the scheduler while waiting. The renderer
  interpolates between the previous and current tick states.

The lamp-clock speed presets are **real time** (1 tick per 60 real seconds),
**1 jar-hour per real minute** (1 tick per real second), **default** (60
ticks per real second, about one jar-day per 24 real seconds), and **as fast
as the machine allows**. The default is provisional and will be revisited in
M4 when creatures need smooth motion at a finer timescale.

---

## 5. The simulation

### 5.1 The world

A 2D cross-section grid (default 256 × 384 cells, 1 cell ≈ 1 mm²) in a
case 256 mm wide. Each cell carries:

The case's side walls and floor are glass. The seeded M0 strata run from
bottom to top as drainage gravel, sand, then plant-supporting soil.

| Field | State property | Type | Notes |
| --- | --- | --- | --- |
| material | `materials` | u8 | air, glass, gravel, sand, soil, clay, rock, water, detritus |
| water | `water` | f32 | ml of water held (soil water, puddle, or vapour in air) |
| temperature | `temperature` | f32 | °C |
| CO₂ | `co2` | f32 | grams, in air and dissolved |
| O₂ | `oxygen` | f32 | grams, in air and dissolved |
| nutrients | `nutrients` | f32 | grams of mineral nutrient (a single pool in v1) |
| microbes | `microbes` | f32 | decomposer biomass as a field, not agents |
| light | `light` | f32 | computed each tick, not stored across ticks |

`src/shared/materials.ts` is the canonical material ID and property table.
Density is in g/cm³, porosity and albedo are fractions, and thermal
conductivity is in W/(m·K). The v1 values are representative starting
constants; a material's porosity is its pore-space fraction.

| Material | Density | Porosity | Conductivity | Albedo |
| --- | ---: | ---: | ---: | ---: |
| air | 0.0012 | 1.00 | 0.025 | 0.00 |
| glass | 2.5 | 0.00 | 1.0 | 0.08 |
| gravel | 1.7 | 0.40 | 0.4 | 0.18 |
| sand | 1.6 | 0.38 | 0.3 | 0.30 |
| soil | 1.2 | 0.50 | 0.25 | 0.15 |
| clay | 1.1 | 0.55 | 0.9 | 0.20 |
| rock | 2.7 | 0.02 | 2.5 | 0.25 |
| water | 1.0 | 0.00 | 0.6 | 0.06 |
| detritus | 0.2 | 0.80 | 0.1 | 0.20 |

### 5.2 Physical processes (each its own module)

1. **Light.** The lamp is a point/area source. Light is marched into the
   case and absorbed by glass, water, leaves and soil; it also heats what it
   hits.
2. **Heat.** Diffusion through materials; the glass loses heat to the room,
   so it is the coolest surface. The full-grid heat solver batches ten
   jar-minutes between updates and scales transfer to elapsed ticks.
3. **Granular motion.** Falling-sand cellular automaton for sand, gravel,
   soil and free water; tilting the case changes gravity's direction.
4. **Soil water.** Moisture moves through soil by a simplified Darcy flow
   (wet to dry, faster in sand than clay, pulled down by gravity).
5. **The water cycle.** Warm wet surfaces evaporate into the air; vapour
   diffuses; it condenses on the cool glass into droplets. Droplets are
   particles that grow, merge and run down the glass back into the soil.
   This is the heart of the look and must be beautiful.
6. **Decomposition.** Microbes turn detritus into nutrients and CO₂, faster
   when warm and damp.

### 5.3 Plants

- Grown by **space colonisation** for shoots (toward light) and for roots
  (toward water and nutrients), so shapes are emergent, not authored.
- Species are genomes, not hand-drawn assets: moss (a mat), fern, a
  creeping plant, a small flowering plant.
- **Photosynthesis**: CO₂ + water + light → sugar + O₂. **Respiration**
  reverses it. Sugar builds tissue; tissue that dies becomes detritus.
- Seeds come from flowers, so plants can spread and generations can change.

### 5.4 Creatures

- Three roles in v1: **springtails** (decomposers, eat detritus and
  microbes), **isopods** (grazers, eat moss and soft leaves), and a **jumping
  spider** (predator).
- Each creature has a body (size, speed, energy store), senses (smell
  gradients of food fields, light, moisture, nearby creatures) and a brain:
  a small fixed-shape neural network whose weights are its genome.
- **Evolution**: creatures reproduce when they have enough energy; the child
  inherits the genome with mutation. No fitness function is written —
  surviving and reproducing is the only score.
- Every gram a creature eats, burns or leaves behind goes through the ledger
  (Rule 2).

### 5.5 The ledger

Every tick, the ledger sums water, carbon and nutrients across every form
(fields, plants, creatures, droplets, detritus). In debug builds and in
tests, any change beyond floating-point tolerance that is not a logged
mist fails loudly with the module that caused it.

### 5.6 The notebook

The field notebook beside the jar is the stats and history view, drawn as a
naturalist's journal: population curves inked as hand-drawn lines, a sketch
of the jar each jar-day, and journal entries.

- **Default:** entries are written from the event log by templates
  ("Day 14. The first fern fronds unrolled near the left wall.").
  Deterministic and free.
- **Narrator (after v0.1):** a language model may later write the day's
  entry from that day's events and numbers only. It will never see or change
  the simulation. Deferred to protect scope and keep v0.1 fully deterministic.

---

## 6. Quality levels

Picked automatically on first run by a short benchmark (the **Jar Index**,
like DEsk's Experience Index), changeable on the tag. One code path at every
level (Rule 6).

| Level | Sim backend | Grid | Glass | Condensation | Target |
| --- | --- | --- | --- | --- | --- |
| Ultra | WebGPU | 512 × 768 | Refraction, caustics, soft shadows | Full droplet sim | Desktop GPU |
| High (default) | WebGPU | 256 × 384 | Refraction, soft shadows | Full | Laptop iGPU, 60 fps |
| Medium | CPU worker | 256 × 384 | Refraction | Reduced droplets | No WebGPU |
| Low | CPU worker | 128 × 192 | Flat glass, highlight | Few droplets | Old laptop, 30 fps |
| Paper | CPU worker | 128 × 192 | Drawn as an ink sketch | Drawn | Canvas 2D only, phones, headless |

Exact replay is guaranteed on the CPU backend: the same seed and actions
give the same jar bit for bit, on any machine and browser. GPU arithmetic is
not bit-exact across devices, so the WebGPU backend is held to the CPU
reference within tolerance by the parity test (§7). A save or share link
records the backend it ran on; opened elsewhere, it replays on the CPU
backend to be exact.

---

## 7. Checking the work

These tools exist so that agents can check their own work without a person
looking at a browser.

| Tool | What it does |
| --- | --- |
| `npm test` | Unit tests and conservation tests (every module) |
| `npm run jar -- --seed 7 --days 30 --out out/` | **The preview tool.** Runs the CPU simulation headless, writes a PNG of the jar each day (Paper renderer), a contact sheet, and `report.json` (populations, ledger totals, events, timing). The main way any change is checked. |
| `npm run survive -- --seeds 50 --days 60` | Runs many jars; reports how many still hold life. Guards against ecosystems that always collapse or explode. |
| `npm run parity` | Playwright: steps the CPU and WebGPU backends from the same seed and compares fields within tolerance. |
| `npm run shots` | Playwright: screenshots each view at each level, compared to approved images. |
| `npm run bench` | Frame and tick timings per level; fails if a budget in §9 is missed. |

Every task ends with `npm test` and a `npm run jar` contact sheet attached
to its summary.

---

## 8. Build vs borrow

| We build | We borrow |
| --- | --- |
| Simulation (fields, plants, creatures, ledger) | Vite, TypeScript, Vitest, Playwright |
| Renderers and the glass | `@napi-rs/canvas` (headless drawing) |
| The tag, notebook and every on-jar control | A seeded PRNG (or ~30 lines of our own) |
| The Jar Index benchmark | |
| The preview, survive, parity and bench tools | Cloudflare Pages |
| | TypeScript, Vite, Vitest, `tsx`, `@types/node` |

No UI framework, physics engine or game engine. Any addition goes here first.

---

## 9. Budgets

- First visit to an interactive jar: under 3 s on a mid laptop.
- Render: 60 fps at High on an integrated GPU; 30 fps at Low on a 2015
  laptop.
- Simulation: one tick under 8 ms at High on GPU, under 16 ms at Medium on
  CPU.
- Download: under 500 KB of JavaScript, gzip.
- Memory: under 300 MB at High.
- Headless M1 preview: 30 jar-days in under 120 seconds at Medium.

---

## 10. Repository layout

```
terrarium/
  docs/        DESIGN.md (this), ARCHITECTURE.md (grows from §4), JOURNAL.md (decisions log)
  src/
    shared/    types, units, PRNG, state layout       — lead only
    sim/       CPU reference: fields, plants, creatures, ledger, events
    gpu/       WebGPU compute backend and shaders
    render/    WebGPU, WebGL2 and Paper renderers; the glass
    ui/        tag, notebook, on-jar controls, input → actions
    worker/    the sim worker and buffer hand-off
  tools/       jar (preview), survive, parity, shots, bench
  tests/
```

---

## 11. Milestones

Each milestone ends in something you can open and look at. The QA agent signs
off on the acceptance checks before it comes to Faisal.

| # | Milestone | Done when |
| --- | --- | --- |
| M0 | **Skeleton** — repo, CI, worker, fixed tick, PRNG, state buffer, `npm run jar` producing an empty jar | CI green; the same seed gives byte-identical `report.json` twice |
| M1 | **The physical jar** — materials, granular motion, soil water, heat, light, the water cycle | Water balances to tolerance over 30 jar-days; condensation forms on the glass and runs down in the contact sheet; the 30-day Medium preview finishes within 2 minutes |
| M2 | **Seeing it** — WebGL2 and Paper renderers, the lamp, the glass, mist and tilt | A jar runs in the browser at 60 fps on Medium; lamp and mist visibly change the water cycle |
| M3 | **Plants** — growth, photosynthesis, death, decomposition, carbon and nutrient cycles | Carbon and nutrients balance; moss and fern survive 60 days in ≥ 80% of 50 seeds |
| M4 | **Creatures** — three roles, brains, reproduction, evolution, magnifying glass | Populations persist 60 days in ≥ 70% of seeds; genomes visibly drift across generations |
| M5 | **WebGPU** — compute port of the fields, WebGPU renderer, Ultra and High | Parity test passes; High meets its budgets |
| M6 | **The notebook and the tag** — stats, journal, saves, share links, Jar Index | A share link reproduces a jar exactly on another machine |
| M7 | **Release** — polish, README with GIFs, deploy | Live on Cloudflare Pages; all budgets met; v0.1 tagged |

---

## 12. The team

A small team, so it stays on task and cheap.

| Agent | Owns (may edit) | Job |
| --- | --- | --- |
| **Lead** | `docs/`, `src/shared/`, task list | Splits each milestone into tasks, writes the interface first, reviews and merges, keeps this document true |
| **Simulation** | `src/sim/`, `src/worker/` | The CPU reference: fields, plants, creatures, ledger |
| **Rendering** | `src/render/`, `src/ui/` | Renderers, the glass, the tag, notebook and controls |
| **GPU** (from M5) | `src/gpu/` | The WebGPU port, held to the parity test |
| **QA & tools** | `tools/`, `tests/`, CI | Builds the checking tools first; reviews every task against its acceptance check — never its own code |

Working rules:

- An agent edits only the folders it owns. A change to `src/shared/` goes
  through the lead.
- Every task names its acceptance check before work starts.
- Small commits, one task each; the message says what changed and how it
  was checked.
- No new dependency without a line in §8.
- Decisions that change this document go into `docs/JOURNAL.md` with the
  date and the reason.

**Faisal's part:** approve this document; at the end of each milestone, look
at the contact sheet or the live link (about five minutes) and say *go on*
or *change this*.

---

## 13. Decisions (15 October 2026)

| Question | Decision | Reason |
| --- | --- | --- |
| Name | **Terrarium** | Strong identity; no reason to delay |
| Narrator | **Deferred beyond v0.1** | Protects scope; keeps the core deterministic |
| Where agents work | **Claude Code on Faisal's Windows machine, repo on GitHub** | Better debugging, reproducibility and control |
| Repository | **Public from day one** | Engineering decisions and progress are visible |
| Simulation timestep | **60 jar-seconds per tick** | 60 Hz field updates produced 5.2 million ticks per jar-day; coarser ticks keep 30-day physical previews tractable while finer processes can substep deterministically |

The task board is `docs/TASKS.md`; the lead's operating rules are in
`CLAUDE.md`; each agent's brief is in `.claude/agents/`.
