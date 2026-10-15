import { describe, expect, it } from "vitest";
import { CpuBackend } from "../../src/sim/cpu-backend";
import { generateJar } from "../../src/sim/generate";
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
    const first = new CpuBackend("replay-seed");
    const second = new CpuBackend("replay-seed");
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

  it("generates deterministic gravel, sand, and soil strata that vary by seed", () => {
    const layout = createStateLayout(256, 384);
    const first = generateJar(1, layout);
    const replay = generateJar(1, layout);
    const otherSeed = generateJar(2, layout);

    expect(first.materials).toEqual(replay.materials);
    expect(first.materials).not.toEqual(otherSeed.materials);
    expect(first.materials).toContain(2);
    expect(first.materials).toContain(3);
    expect(first.materials).toContain(4);
    expect(first.materials).toContain(1);
  });
});
