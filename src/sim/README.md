# CPU simulation

Owned by Simulation. This folder contains the deterministic CPU reference
backend and the physical, plant, creature, and ledger systems.

The CPU backend applies tick-keyed lamp actions through `light-transport.ts`
and `heat-transfer.ts`. Light absorption uses the shared material albedo;
absorbed light heats the field, material conductivity diffuses heat, and glass
surfaces cool toward room temperature. The fields advance in deterministic
ten-tick batches (ten jar-minutes), scaling transfer and room cooling to the
elapsed ticks to keep the preview within budget.
