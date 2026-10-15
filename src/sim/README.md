# CPU simulation

Owned by Simulation. This folder contains the deterministic CPU reference
backend and the physical, plant, creature, and ledger systems.

The CPU backend applies tick-keyed lamp actions through `light-transport.ts`
and `heat-transfer.ts`. Light absorption uses the shared material albedo;
absorbed light heats the field, material conductivity diffuses heat, and glass
surfaces cool toward room temperature.
