# Development tools

Owned by QA & tools. This folder contains headless preview, survival,
parity, screenshot, and benchmark commands.

The jar preview starts with the lamp on at intensity 1. Set
`--lamp-intensity 0` for a dark jar, or pass a value in `[0, 1]` to choose a
dimmer setting. The preview report includes a SHA-256 `stateBufferHash` of the final
materials and field buffers so repeated runs can be checked independently of
their timing measurements. Its `ledger.days` array records water, carbon, and
nutrient totals (when supplied by the ledger) after each jar-day; the
``largestPerTickError` entry records the greatest absolute drift from the
starting totals. Debug runs fail when that drift exceeds the floating-point
tolerance, and include the ledger's `lastModule` when present. Backends that
expose `ledger.totals()` are checked every tick; until a water-changing module
supplies that incremental ledger, water, CO₂, and nutrient fields are summed
at each day boundary.

Tests can import `expectBalanced` from `tests/helpers/expect-balanced.ts` and
pass a jar with `initialTotals` and a `ledger.totals()` implementation. Ledger
totals always require water and may add carbon and nutrients without changing
the helper's API.
