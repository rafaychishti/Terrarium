import { describe, expect, it } from "vitest";
import { CpuBackend } from "../../src/sim/cpu-backend";
import { Material } from "../../src/shared/materials";
import { createStateLayout } from "../../src/shared/layout";

function materialCounts(materials: Uint8Array): number[] {
  const counts = new Array<number>(Material.detritus + 1).fill(0);
  for (let index = 0; index < materials.length; index += 1) {
    counts[materials[index]] += 1;
  }
  return counts;
}

function tiltedSand(): CpuBackend {
  const layout = createStateLayout(20, 16);
  const backend = new CpuBackend(1, { layout });
  const state = backend.read();
  state.materials.fill(Material.air);
  for (let y = 0; y < layout.height; y += 1) {
    state.materials[y * layout.width] = Material.glass;
    state.materials[y * layout.width + layout.width - 1] = Material.glass;
  }
  state.materials.fill(
    Material.glass,
    (layout.height - 1) * layout.width,
  );
  for (let y = 2; y < 8; y += 1) {
    for (let x = 6; x < 12; x += 1) {
      state.materials[y * layout.width + x] = Material.sand;
    }
  }
  return backend;
}

describe("granular motion", () => {
  it("settles tilted sand into a deterministic slope without changing material counts", () => {
    const first = tiltedSand();
    const second = tiltedSand();
    const originalCounts = materialCounts(first.read().materials);
    const tilt = { tick: 1, type: "tilt", degrees: 30 } as const;
    first.apply(tilt);
    second.apply(tilt);

    first.step(200);
    second.step(200);

    const firstState = first.read();
    const secondState = second.read();
    expect(materialCounts(firstState.materials)).toEqual(originalCounts);
    expect(firstState.materials).toEqual(secondState.materials);

    const sandByColumn = new Array<number>(first.layout.width).fill(0);
    for (let y = 0; y < first.layout.height; y += 1) {
      for (let x = 0; x < first.layout.width; x += 1) {
        if (firstState.materials[y * first.layout.width + x] === Material.sand) {
          sandByColumn[x] += 1;
        }
      }
    }
    expect(sandByColumn.filter((count) => count > 0).length).toBeGreaterThan(2);
    expect(new Set(sandByColumn).size).toBeGreaterThan(2);
    expect(
      sandByColumn.slice(12, 19).reduce((sum, count) => sum + count, 0),
    ).toBeGreaterThan(
      sandByColumn.slice(1, 10).reduce((sum, count) => sum + count, 0),
    );
  });

  it("moves free water and all granular materials without creating or losing cells", () => {
    const layout = createStateLayout(12, 12);
    const backend = new CpuBackend(2, { layout });
    const state = backend.read();
    state.materials.fill(Material.air);
    for (let y = 0; y < layout.height; y += 1) {
      state.materials[y * layout.width] = Material.glass;
      state.materials[y * layout.width + layout.width - 1] = Material.glass;
    }
    state.materials.fill(Material.glass, (layout.height - 1) * layout.width);
    state.materials[2 * layout.width + 3] = Material.gravel;
    state.materials[2 * layout.width + 4] = Material.sand;
    state.materials[2 * layout.width + 5] = Material.soil;
    state.materials[2 * layout.width + 6] = Material.water;
    const originalCounts = materialCounts(state.materials);

    backend.step(20);

    expect(materialCounts(state.materials)).toEqual(originalCounts);
    expect(state.materials[2 * layout.width + 3]).toBe(Material.air);
    expect(state.materials[2 * layout.width + 6]).toBe(Material.air);
  });
});
