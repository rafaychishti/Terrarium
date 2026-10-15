import { describe, expect, it } from "vitest";
import { CpuBackend } from "../../src/sim/cpu-backend";
import { HeatTransfer, ROOM_TEMPERATURE_C } from "../../src/sim/heat-transfer";
import { LightTransport } from "../../src/sim/light-transport";
import { generateJar, Material } from "../../src/sim/generate";
import { createStateLayout } from "../../src/shared/layout";

function averageTemperature(
  backend: CpuBackend,
  include: (index: number, x: number) => boolean,
): number {
  const { temperature } = backend.read();
  let sum = 0;
  let count = 0;
  for (let y = 0; y < backend.layout.height; y += 1) {
    for (let x = 0; x < backend.layout.width; x += 1) {
      const index = y * backend.layout.width + x;
      if (include(index, x)) {
        sum += temperature[index];
        count += 1;
      }
    }
  }
  return sum / count;
}

describe("lamp light and heat", () => {
  it("absorbs a broader area beam according to each material's shared albedo", () => {
    const layout = createStateLayout(12, 8);
    const state = generateJar(1, layout);
    state.materials.fill(Material.air);
    state.materials[3 * layout.width] = Material.glass;
    state.materials[5 * layout.width] = Material.sand;

    const transport = new LightTransport();
    const lamp = {
      xMm: 0,
      yMm: 4,
      intensity: 1,
    };
    transport.step(state, layout, lamp);

    expect(state.light[3 * layout.width]).toBeGreaterThan(
      state.light[5 * layout.width],
    );
    expect(state.light[4 * layout.width]).toBeGreaterThan(0);
    expect(state.light[4 * layout.width + 1]).toBeLessThan(
      state.light[4 * layout.width],
    );

    const fullIntensity = state.light[4 * layout.width];
    transport.step(state, layout, { ...lamp, intensity: 0.5 });
    expect(state.light[4 * layout.width]).toBeCloseTo(fullIntensity / 2, 6);
    transport.step(state, layout, { ...lamp, intensity: 0 });
    expect(state.light.every((value) => value === 0)).toBe(true);
  });

  it("diffuses heat conservatively and cools glass toward room temperature", () => {
    const layout = createStateLayout(5, 5);
    const state = generateJar(1, layout);
    state.materials.fill(Material.air);
    state.temperature.fill(ROOM_TEMPERATURE_C);
    const source = 2 * layout.width + 2;
    state.temperature[source] = 30;
    const totalBefore = state.temperature.reduce((sum, value) => sum + value, 0);
    const heat = new HeatTransfer(layout);

    heat.step(state, layout);

    expect(state.temperature[source]).toBeLessThan(30);
    expect(state.temperature[source - 1]).toBeGreaterThan(ROOM_TEMPERATURE_C);
    expect(
      state.temperature.reduce((sum, value) => sum + value, 0),
    ).toBeCloseTo(totalBefore, 4);

    const boundary = layout.width;
    state.materials[boundary] = Material.glass;
    state.temperature[boundary] = 24;
    heat.step(state, layout);
    expect(state.temperature[boundary]).toBeLessThan(24);
    expect(state.temperature[boundary]).toBeGreaterThan(ROOM_TEMPERATURE_C);
  });

  it("warms the lamp-side of the jar while glass remains the coolest surface after one jar-day", () => {
    const layout = createStateLayout(64, 96);
    const backend = new CpuBackend(7, { layout });
    const state = backend.read();
    backend.apply({
      tick: 1,
      type: "lamp",
      xMm: 1,
      yMm: layout.height / 2,
      intensity: 1,
    });

    backend.step(1_440);

    const lampSide = averageTemperature(backend, (index, x) =>
      x < layout.width / 3 && state.materials[index] !== Material.glass,
    );
    const farSide = averageTemperature(backend, (index, x) =>
      x >= (layout.width * 2) / 3 &&
      state.materials[index] !== Material.glass,
    );
    const glass = averageTemperature(
      backend,
      (index) => state.materials[index] === Material.glass,
    );
    const interior = averageTemperature(
      backend,
      (index) => state.materials[index] !== Material.glass,
    );

    expect(lampSide).toBeGreaterThan(farSide);
    expect(glass).toBeLessThan(interior);
    expect(backend.read().light.some((value) => value > 0)).toBe(true);
  });

  it("replays lamp-driven temperatures and light deterministically", () => {
    const layout = createStateLayout(24, 32);
    const first = new CpuBackend(11, { layout });
    const second = new CpuBackend(11, { layout });
    const lamp = {
      tick: 1,
      type: "lamp",
      xMm: 1,
      yMm: 16,
      intensity: 0.7,
    } as const;
    first.apply(lamp);
    second.apply(lamp);

    first.step(120);
    second.step(120);

    expect(first.read().temperature).toEqual(second.read().temperature);
    expect(first.read().light).toEqual(second.read().light);
  });
});
