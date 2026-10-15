import { describe, expect, it } from "vitest";
import { CpuBackend } from "../../src/sim/cpu-backend";
import { generateJar, Material } from "../../src/sim/generate";
import { createStateLayout } from "../../src/shared/layout";
import { ml } from "../../src/shared/units";

function bytesForState(state: ReturnType<CpuBackend["read"]>): Uint8Array[] {
  return [
    new Uint8Array(state.materials.buffer, state.materials.byteOffset, state.materials.byteLength),
    new Uint8Array(state.water.buffer, state.water.byteOffset, state.water.byteLength),
    new Uint8Array(
      state.temperature.buffer,
      state.temperature.byteOffset,
      state.temperature.byteLength,
    ),
    new Uint8Array(state.co2.buffer, state.co2.byteOffset, state.co2.byteLength),
    new Uint8Array(state.oxygen.buffer, state.oxygen.byteOffset, state.oxygen.byteLength),
    new Uint8Array(
      state.nutrients.buffer,
      state.nutrients.byteOffset,
      state.nutrients.byteLength,
    ),
    new Uint8Array(
      state.microbes.buffer,
      state.microbes.byteOffset,
      state.microbes.byteLength,
    ),
    new Uint8Array(state.light.buffer, state.light.byteOffset, state.light.byteLength),
  ];
}

describe("CPU reference backend", () => {
  it("replays the same seed and tick-keyed actions byte-for-byte after 10,000 ticks", () => {
    const layout = createStateLayout(64, 96);
    const first = new CpuBackend("replay-seed", { layout });
    const second = new CpuBackend("replay-seed", { layout });
    const actions = [
      { tick: 1, type: "mist", amount: ml(2) },
      { tick: 3500, type: "tilt", degrees: 12 },
      { tick: 10_000, type: "tap", xMm: 30, yMm: 20 },
    ] as const;

    for (const action of actions) {
      first.apply(action);
      second.apply(action);
    }
    first.step(10_000);
    second.step(10_000);

    const firstBytes = bytesForState(first.read());
    const secondBytes = bytesForState(second.read());
    expect(firstBytes).toHaveLength(secondBytes.length);
    for (let index = 0; index < firstBytes.length; index += 1) {
      expect(firstBytes[index]).toEqual(secondBytes[index]);
    }
    expect(first.events.snapshot()).toEqual(second.events.snapshot());
  }, 30_000);

  it("applies actions on their stated tick and rejects actions scheduled in the past", () => {
    const backend = new CpuBackend(7);
    backend.apply({ tick: 3, type: "mist", amount: ml(2) });

    backend.step(2);
    expect(backend.events.snapshot()).toEqual([]);
    backend.step(1);
    expect(backend.events.snapshot()).toEqual([
      { tick: 3, type: "action", payload: { action: "mist", amount: 2 } },
    ]);
    expect(() => backend.apply({ tick: 3, type: "tap", xMm: 1, yMm: 1 })).toThrow(
      RangeError,
    );
  });

  it("generates gravel below sand and soil above it with a glass floor and sides", () => {
    const layout = createStateLayout(256, 384);
    const first = generateJar(1, layout);
    const replay = generateJar(1, layout);
    const otherSeed = generateJar(2, layout);

    expect(first.materials).toEqual(replay.materials);
    expect(first.materials).not.toEqual(otherSeed.materials);

    const centerX = Math.floor(layout.width / 2);
    const strata = new Set<number>();
    for (let y = 0; y < layout.height - 1; y += 1) {
      const material = first.materials[y * layout.width + centerX];
      if (
        material === Material.gravel ||
        material === Material.sand ||
        material === Material.soil
      ) {
        strata.add(material);
      }
    }
    expect([...strata]).toEqual([Material.soil, Material.sand, Material.gravel]);
    expect(
      first.materials[(layout.height - 2) * layout.width + centerX],
    ).toBe(Material.gravel);

    const bottomRow = first.materials.subarray(
      (layout.height - 1) * layout.width,
    );
    expect(bottomRow).toEqual(new Uint8Array(layout.width).fill(Material.glass));
    for (let y = 0; y < layout.height; y += 1) {
      expect(first.materials[y * layout.width]).toBe(Material.glass);
      expect(first.materials[y * layout.width + layout.width - 1]).toBe(
        Material.glass,
      );
    }
  });
});
