# Journal

Decisions that shape Terrarium, newest last. One entry per decision: the
date, what was decided, and why.

- **2026-10-15 — Concept.** Terrarium chosen over Cartographer's Table, Bazaar
  and Orrery: it fits the hobby portfolio's artificial-life focus and is the
  natural successor to Veridia (DESIGN §1.1).
- **2026-10-15 — Platform.** Browser app in TypeScript with WebGPU, WebGL2
  and Canvas 2D renderers, so anyone can try it from a link.
- **2026-10-15 — Name kept: Terrarium.**
- **2026-10-15 — Narrator deferred beyond v0.1** to protect scope and keep
  the core fully deterministic.
- **2026-10-15 — Agents run in Claude Code on Faisal's Windows machine, repo
  on GitHub,** for debugging, reproducibility and control. Everything must
  therefore run from PowerShell.
- **2026-10-15 — Repository public from day one.**
- **2026-10-15 — Exact replay is a CPU-backend guarantee.** GPU floating
  point is not bit-exact across devices, so the WebGPU backend is held to the
  CPU reference within tolerance, and shared jars replay on the CPU backend
  (DESIGN §6). The simulation uses its own deterministic maths functions
  because engine `Math.sin`/`exp`/`pow` may differ between browsers.
- **2026-10-15 — Team models.** Simulation and GPU use the lead's model
  (hardest reasoning); Rendering and QA use Sonnet to keep costs down.
  Change in `.claude/agents/*.md` if quality suffers.
- **2026-10-15 — No GitHub CLI.** Faisal could not set up `gh`, so the
  team uses plain git: tasks merge into `main` locally with a squash merge
  and are pushed; Faisal creates the repo on github.com in the browser.
- **2026-10-15 — Simulation tick is 60 jar-seconds.** M0's 1/60-second tick
  required 5.2 million ticks per jar-day and would make M1's 30-day physical
  preview impractical. Processes needing finer resolution substep
  deterministically within the coarser tick; M1-8 now requires its Medium
  preview to finish within two minutes.
- **2026-10-15 — Default clock speed is 60 ticks per real second.** The
  worker accumulates wall time independently of fixed simulation ticks,
  without dropping ticks, and the renderer interpolates between tick states.
  Lamp-clock settings also include real time (1 tick per 60 seconds), one
  jar-hour per real minute (1 tick per second), and unbounded speed. If the
  worker cannot sustain a selected rate, jar time slows and the achieved
  rate is reported. Revisit the default in M4 when creatures need smoother
  motion at a finer timescale.
- **2026-10-15 — A published worker state stays stable until the main thread
  acknowledges its copy.** Without this handshake, delayed message handling
  could read a later shared-buffer state for an earlier tick notification.
  The scheduler retains due-tick debt while waiting, preserving both state
  order and the no-skipped-ticks guarantee.
- **2026-10-15 — Material properties use explicit real-unit scales.** The
  shared material table stores density in g/cm³, thermal conductivity in
  W/(m·K), and porosity/albedo as fractions. Representative initial values
  give the M1 physics modules one consistent source; the ledger contract
  begins with water totals, with carbon and nutrient totals reserved for
  later milestones.
