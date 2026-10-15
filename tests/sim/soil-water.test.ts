import { describe, expect, it } from "vitest";
import { CpuBackend } from "../../src/sim/cpu-backend";
import { Material } from "../../src/shared/materials";
import { createStateLayout } from "../../src/shared/layout";
import { ml } from "../../src/shared/units";

function soilJar(material: number = Material.soil): CpuBackend {
  const layout = createStateLayout(18, 24);
  const backend = new CpuBackend(5, { layout });
  const state = backend.read();
  state.materials.fill(material);
  for (let y = 0; y < layout.height; y += 1) {
    state.materials[y * layout.width] = Material.glass;
    state.materials[y * layout.width + layout.width - 1] = Material.glass;
  }
  state.materials.fill(Material.glass, (layout.height - 1) * layout.width);
  return backend;
}

function deepestWetRow(backend: CpuBackend): number {
  const { width, height } = backend.layout;
  const state = backend.read();
  let deepest = -1;
  for (let y = 0; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      if (state.water[y * width + x] > 1e-7) deepest = y;
    }
  }
  return deepest;
}

function totalWater(backend: CpuBackend): number {
  return backend.read().water.reduce((total, amount) => total + amount, 0);
}

describe("soil water", () => {
  it("moves a deterministic wet front down over hours and conserves water except for logged mist", () => {
    const first = soilJar();
    const replay = soilJar();
    const mist = { tick: 1, type: "mist", amount: ml(0.1) } as const;
    const initialWater = first.ledger.totals().water;
    first.apply(mist);
    replay.apply(mist);

    first.step(1);
    replay.step(1);
    const initialWetFront = deepestWetRow(first);
    const waterAfterMist = first.ledger.totals().water;
    expect(initialWetFront).toBe(0);
    expect(waterAfterMist).toBeCloseTo(initialWater + 0.1, 5);
    expect(totalWater(first)).toBeCloseTo(waterAfterMist, 5);
    expect(first.events.snapshot()).toContainEqual({
      tick: 1,
      type: "action",
      payload: { action: "mist", amount: 0.1 },
    });
    expect(first.ledger.lastModule).toBe("mist");

    for (let tick = 0; tick < 240; tick += 1) {
      first.step(1);
      expect(first.ledger.totals().water).toBeCloseTo(waterAfterMist, 5);
    }
    replay.step(240);

    expect(deepestWetRow(first)).toBeGreaterThan(initialWetFront);
    expect(deepestWetRow(first)).toBe(deepestWetRow(replay));
    expect(first.read().water).toEqual(replay.read().water);
    expect(first.ledger.totals().water).toBeCloseTo(waterAfterMist, 5);
    expect(totalWater(first)).toBeCloseTo(waterAfterMist, 5);
    expect(first.ledger.totals()).toEqual(replay.ledger.totals());
  });

  it("infiltrates free water into adjacent porous soil without losing its mass", () => {
    const backend = soilJar();
    const state = backend.read();
    const freeWater = 4 * backend.layout.width + 8;
    state.materials[freeWater] = Material.water;
    state.water[freeWater] = 0.02;

    const before = totalWater(backend);
    backend.step(1);

    expect(state.water[freeWater]).toBeLessThan(0.02);
    expect(totalWater(backend)).toBeCloseTo(before, 5);
    expect(backend.ledger.lastModule).toBe("soil-water");
  });

  it("moves water faster through sand than clay", () => {
    function waterInSecondRow(material: number): number {
      const backend = soilJar(material);
      backend.apply({ tick: 1, type: "mist", amount: ml(0.1) });
      backend.step(60);
      backend.step(60);
      let water = 0;
      for (let x = 1; x < backend.layout.width - 1; x += 1) {
        water += backend.read().water[backend.layout.width + x];
      }
      return water;
    }

    expect(waterInSecondRow(Number(Material.sand))).toBeGreaterThan(
      waterInSecondRow(Material.clay),
    );
  });
});
