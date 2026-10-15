# Task board

The lead keeps this file true. Statuses: `todo` → `doing` → `review` → `done`
(or `blocked`, with the reason). A task is **ready** when every task in its
*Needs* column is `done`. Ready tasks with different owners may run in
parallel.

Every task's acceptance check is written before work starts, and the QA
agent signs it off — never the agent that did the work.

Later milestones (M2–M7) are split into tasks by the lead when the previous
milestone is approved, so they can use what was learned.

---

## M0 — Skeleton

**Goal:** an empty jar that runs, deterministically, in the browser and
headless, with CI guarding it.
**Checkpoint for Faisal:** the M0 contact sheet and the jar on
`npm run dev`.

| ID | Owner | Needs | Status |
| --- | --- | --- | --- |
| M0-1 | Lead | — | done — scaffold and shared contracts pushed; CI green on Windows and Ubuntu |
| M0-2 | Simulation | M0-1 | done — QA passed; deterministic replay, scheduled actions, and seeded layers verified |
| M0-3 | Rendering | M0-1 | done — QA passed; Paper renderer tested in Node and browser preview |
| M0-4 | QA & tools | M0-2, M0-3 | done — QA confirmed 10 images, contact sheet, report, and repeated-run matching outputs |
| M0-5 | QA & tools | M0-4 | done — QA passed; repeated jar runs match, and both CI runners uploaded contact sheets |

### M0-1 · Scaffold and shared contracts — Lead

- Faisal creates the empty public repo `terrarium` on github.com (no
  README, licence or .gitignore). The lead adds it as `origin` and runs
  `git push -u origin main`; Git Credential Manager opens the browser to
  sign in on the first push. No GitHub CLI.
- `package.json` with the scripts named in DESIGN §7 (`dev`, `build`, `test`,
  `jar`, `survive`, `parity`, `shots`, `bench`; unbuilt ones print
  "not yet" and exit 0). Scripts must run in both PowerShell and bash: use
  Node scripts (run with `tsx`), never shell scripts.
- TypeScript strict, Vite, Vitest, `tsx`, `@napi-rs/canvas` (add each to
  DESIGN §8 if not already listed).
- `vite.config.ts` sends `Cross-Origin-Opener-Policy: same-origin` and
  `Cross-Origin-Embedder-Policy: require-corp` in dev and preview, so
  `SharedArrayBuffer` works.
- The folder layout in DESIGN §10, each folder with a one-paragraph
  `README.md` naming its owner.
- `src/shared/`: `units.ts` (mm, ml, g, °C, jar-hours), `prng.ts` (seeded,
  splittable, e.g. SplitMix32 or PCG32, with `next()`, `float()`, `int(n)`,
  `fork(label)`), `dmath.ts` (deterministic `sin`, `cos`, `exp`, `log`, `pow`,
  `sqrt` passes through), `layout.ts` (the state buffer: grid size, field
  offsets, double buffer, atomic front index), `types.ts` (`SimBackend`,
  `Action`, `SimEvent`, `JarReport`).
- GitHub Actions: `npm ci && npm test` on `windows-latest` and
  `ubuntu-latest`.

**Acceptance:** `npm ci`, `npm test` (an empty suite passes), `npm run dev`
and `npm run build` all succeed on Windows; CI is green on both runners;
`prng` gives the same first 1,000 values on both runners (a test with the
values checked in).

### M0-2 · The sim worker and CPU backend shell — Simulation

- `src/sim/cpu-backend.ts` implementing `SimBackend` against the layout in
  `src/shared/layout.ts`: `step(n)`, `read()`, `apply(action)`, with the
  fields allocated but no physics yet (every cell air except the glass walls
  and a flat soil layer).
- A fixed-tick clock (`src/sim/clock.ts`): tick length in jar-seconds,
  speed multiplier, no wall-clock time used inside a tick.
- An action queue keyed by tick, and an event ring buffer.
- `src/worker/sim.worker.ts`: owns a CPU backend, steps it on a timer,
  writes the back buffer and flips the atomic front index; receives actions
  by `postMessage`.
- A jar generator `src/sim/generate.ts` (seed → initial jar). For M0, layers
  of gravel, sand and soil whose depths vary with the seed.

**Acceptance:** unit tests show the same seed and actions give byte-identical
buffers after 10,000 ticks, and that actions apply on their stated tick; no
`Math.random`, `Date.now` or `performance.now` anywhere under `src/sim/`
(a test greps for them).

### M0-3 · The Paper renderer and the page — Rendering

- `src/render/paper.ts`: draws a jar state onto any Canvas 2D context (the
  browser's or `@napi-rs/canvas`'s) — the glass case outline with a
  highlight, each material in an ink-and-wash palette, a cream paper
  background. It takes a `CanvasRenderingContext2D`-shaped interface, nothing
  browser-only.
- `index.html` + `src/main.ts`: starts the worker, reads the front buffer
  each animation frame and draws it with the Paper renderer, centred and
  scaled in real units (DESIGN rule 8).
- A first pass at the look: write `src/render/STYLE.md` with the palette,
  line weights and paper texture approach, for all later renderers to follow.

**Acceptance:** `npm run dev` shows the jar in Chrome and Edge on Windows;
the same `paper.ts` renders the same state in Node (QA checks this in M0-4);
`STYLE.md` exists.

### M0-4 · The preview tool — QA & tools

- `tools/jar.ts`: `npm run jar -- --seed <n> --days <d> --out <dir>` runs the
  CPU backend directly (no worker) for `d` jar-days, writes `day-NN.png` with
  the Paper renderer via `@napi-rs/canvas`, a `contact-sheet.png` of all days,
  and `report.json` (seed, days, ticks, timing per tick, event counts, and an
  empty `ledger` object ready for M1).
- Paths built with `path.join`; works from PowerShell.

**Acceptance:** `npm run jar -- --seed 7 --days 10 --out out/m0` produces 10
day images, a contact sheet and a report on Windows and in CI.

### M0-5 · Determinism guard in CI — QA & tools

- A test that runs `tools/jar.ts` twice with the same seed and compares the
  `report.json` files (excluding timings) and the final state buffer's hash.
- CI uploads `out/ci/contact-sheet.png` as a build artefact.

**Acceptance:** CI fails if determinism breaks (prove it once by adding a
temporary `Math.random()` on a branch and showing the failure, then remove
it); the contact sheet is downloadable from the CI run.

---

## M1 — The physical jar

**Goal:** the jar's water cycle works and balances, with no life yet.
**Checkpoint for Faisal:** a 30-day contact sheet showing condensation
forming on the glass and running down, plus the ledger report.

| ID | Owner | Needs | Status |
| --- | --- | --- | --- |
| M1-0 | Lead | M0-5 | done — acceptance checks passed, including independent QA |
| M1-1 | Lead | M1-0 | todo |
| M1-2 | Simulation | M1-1 | todo |
| M1-3 | Simulation | M1-2 | todo |
| M1-4 | Simulation | M1-3 | todo |
| M1-5 | Simulation | M1-4 | todo |
| M1-6 | Rendering | M1-2 | todo |
| M1-7 | QA & tools | M1-1 | todo |
| M1-8 | QA & tools | M1-5, M1-6, M1-7 | todo |

### M1-0 · Correct the M0 foundation — Lead

- Invert generated strata to gravel at the bottom, sand in the middle, and
  soil on top; add a glass floor row and test the order.
- Set the fixed simulation tick to 60 jar-seconds. Processes requiring finer
  resolution use deterministic internal substeps.
- Decouple worker scheduling from display refresh using a
  ticks-per-second accumulator, never dropping due simulation ticks. Report
  achieved speed and any slowdown, and interpolate between tick states.
  Acknowledgement must keep each shared-buffer state stable until the renderer
  has copied it.
- Provide real-time (1 tick/60 seconds), 1 jar-hour per real minute (1
  tick/second), default (60 ticks/second), and unbounded speed settings for
  the lamp clock.
- Fill unused contact-sheet cells with the Paper background colour.
- Remove the temporary `.m0-5-randomness-check/` worktree without following
  or deleting its `node_modules` junction target.

**Acceptance:** tests verify layer order and glass floor; the clock defaults
to a 60-second tick and 60 ticks/second; worker accumulation processes all
due ticks without skipping and preserves published states until acknowledged;
all speed presets are mapped; interpolation is
tested; achieved speed and slowdown are reported; the 30-day preview finishes
in under 120 seconds; contact-sheet remainder matches the Paper background;
the named temporary folder is gone and the workspace `node_modules` remains.

### M1-1 · Fields and ledger contract — Lead

Add every DESIGN §5.1 field to `layout.ts`, the material table (density,
porosity, conductivity, albedo per material) to `src/shared/materials.ts`,
and the ledger interface (`totals()` for water, later carbon and nutrients).

**Acceptance:** types compile; DESIGN §5.1 and the code agree.

### M1-2 · Granular motion and tilt — Simulation

Falling-sand cellular automaton for sand, gravel, soil and free water, with
gravity's direction set by the tilt action; deterministic update order
(alternating scan direction chosen by tick parity, not by random).

**Acceptance:** a tilted jar's sand settles to a slope; total cells of each
material never change (test).

### M1-3 · Heat and light — Simulation

Lamp as an area source with position and dimmer; light marched into the
grid and absorbed per material; absorbed light becomes heat; heat diffuses;
the glass loses heat to the room.

**Acceptance:** with the lamp on one side, that side of the jar is warmer
after a day; the glass is the coolest surface (test on a report value).

### M1-4 · Soil water — Simulation

Simplified Darcy flow in soil: wet to dry, rate by material, pulled down by
gravity; free water soaks in.

**Acceptance:** a mist action wets the surface and the wet front moves
down over hours; water total unchanged except the logged mist (ledger test).

### M1-5 · The water cycle — Simulation

Evaporation from warm wet surfaces, vapour diffusion in air, condensation on
the glass into droplet particles; droplets grow, merge and run down the glass
into the soil.

**Acceptance:** in 30 jar-days with the lamp on, droplets form by day 2 and
some reach the soil; the ledger balances to 1e-6 relative every tick; the
cycle settles rather than drying out or flooding (report trend test).

### M1-6 · Seeing the water — Rendering

Paper renderer shows soil moisture as a wash, vapour as faint haze,
droplets on the glass, and the lamp; a debug view toggle (moisture,
temperature, light) for development.

**Acceptance:** each day image in the contact sheet makes the water cycle
readable without the report.

### M1-7 · Ledger in the report and in tests — QA & tools

`report.json` gains per-day ledger totals and the largest per-tick error;
a Vitest helper `expectBalanced(jar)` that any test can call; the debug-build
ledger check that fails loudly with the module name.

**Acceptance:** deliberately leaking water in a test fixture is caught and
names the module.

### M1-8 · M1 sign-off — QA & tools

Run the M1 acceptance set, `npm run jar -- --seed 7 --days 30 --out out/m1`,
finish the 30-day Medium preview within 2 minutes, and check tick timing
against the DESIGN §9 budget; write `docs/checkpoints/M1.md`.

**Acceptance:** every M1 check passes or is listed as a known gap with a
reason; `npm run jar -- --seed 7 --days 30 --out out/m1` completes in under
120 seconds at Medium.
