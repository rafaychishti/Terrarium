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
