import { describe, expect, it } from "vitest";
import { interpolateState, MATERIAL_SWITCH_ALPHA } from "../../src/render/interpolate";
import type { StateView } from "../../src/shared/layout";

function makeState(cells: number): StateView {
  return {
    materials: new Uint8Array(cells),
    water: new Float32Array(cells),
    temperature: new Float32Array(cells),
    co2: new Float32Array(cells),
    oxygen: new Float32Array(cells),
    nutrients: new Float32Array(cells),
    microbes: new Float32Array(cells),
    light: new Float32Array(cells),
  };
}

describe("state interpolation", () => {
  it("interpolates numeric fields into the reusable output", () => {
    const previous = makeState(2);
    const current = makeState(2);
    const output = makeState(2);
    const outputWater = output.water;
    previous.water.set([0, 10]);
    current.water.set([10, 20]);
    previous.temperature.set([2, 8]);
    current.temperature.set([6, 4]);

    interpolateState(previous, current, 0.25, output);

    expect([...output.water]).toEqual([2.5, 12.5]);
    expect([...output.temperature]).toEqual([3, 7]);
    interpolateState(previous, current, 0.5, output);
    expect(output.water).toBe(outputWater);
    expect([...output.water]).toEqual([5, 15]);
  });

  it("switches discrete materials at the defined midpoint", () => {
    const previous = makeState(2);
    const current = makeState(2);
    const output = makeState(2);
    previous.materials.set([2, 3]);
    current.materials.set([7, 8]);

    interpolateState(previous, current, MATERIAL_SWITCH_ALPHA - 0.001, output);
    expect([...output.materials]).toEqual([2, 3]);

    interpolateState(previous, current, MATERIAL_SWITCH_ALPHA, output);
    expect([...output.materials]).toEqual([7, 8]);
  });

  it("clamps alpha and rejects mismatched states", () => {
    const previous = makeState(1);
    const current = makeState(1);
    const output = makeState(1);
    previous.water[0] = 3;
    current.water[0] = 9;

    interpolateState(previous, current, 2, output);
    expect(output.water[0]).toBe(9);
    expect(() => interpolateState(previous, makeState(2), 0.5, output)).toThrow(RangeError);
  });
});
