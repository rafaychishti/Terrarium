import { createCanvas } from "@napi-rs/canvas";
import { describe, expect, it } from "vitest";
import { drawPaper, type PaperCanvasContext, type PaperDebugView } from "../../src/render/paper";
import { createStateLayout, type StateView } from "../../src/shared/layout";

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

function render(
  state: StateView,
  layout: ReturnType<typeof createStateLayout>,
  debugView?: PaperDebugView,
): Buffer {
  const canvas = createCanvas(180, 240);
  const context = canvas.getContext("2d") as unknown as PaperCanvasContext;
  drawPaper(context, state, layout, {
    width: canvas.width,
    height: canvas.height,
    debugView,
  });
  return canvas.toBuffer("image/png");
}

describe("Paper renderer", () => {
  it("renders deterministic, distinct jar states to a Canvas 2D-shaped context", () => {
    const layout = createStateLayout(4, 6);
    const emptyState = makeState(layout.cells);
    const fullState = makeState(layout.cells);
    fullState.materials.fill(4);

    const first = render(emptyState, layout);
    const repeat = render(emptyState, layout);
    const filled = render(fullState, layout);

    expect(first.equals(repeat)).toBe(true);
    expect(first.equals(filled)).toBe(false);
  });

  it("renders the water cycle and deterministic field-debug views", () => {
    const layout = createStateLayout(8, 12);
    const state = makeState(layout.cells);
    state.materials.fill(4);
    state.materials[0] = 1;
    state.materials[1] = 0;
    state.materials[7] = 1;
    state.materials[6] = 0;
    state.water[0] = 0.12;
    state.water[1] = 0.015;
    state.water[6] = 0.004;
    state.water[7] = 0.08;
    state.water[12] = 0.08;
    state.temperature.fill(18);
    state.temperature[60] = 34;
    state.light.fill(0);
    state.light[20] = 0.5;

    const normal = render(state, layout);
    const moisture = render(state, layout, "moisture");
    const temperature = render(state, layout, "temperature");
    const light = render(state, layout, "light");
    const dry = makeState(layout.cells);
    dry.materials.set(state.materials);
    dry.temperature.set(state.temperature);
    dry.light.set(state.light);

    expect(normal.equals(render(state, layout))).toBe(true);
    expect(moisture.equals(render(state, layout, "moisture"))).toBe(true);
    expect(normal.equals(render(dry, layout))).toBe(false);
    expect(normal.equals(moisture)).toBe(false);
    expect(moisture.equals(temperature)).toBe(false);
    expect(temperature.equals(light)).toBe(false);
  });
});
