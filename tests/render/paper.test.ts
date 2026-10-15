import { createCanvas } from "@napi-rs/canvas";
import { describe, expect, it } from "vitest";
import { drawPaper, type PaperCanvasContext } from "../../src/render/paper";
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

function render(state: StateView, layout: ReturnType<typeof createStateLayout>): Buffer {
  const canvas = createCanvas(180, 240);
  const context = canvas.getContext("2d") as unknown as PaperCanvasContext;
  drawPaper(context, state, layout, { width: canvas.width, height: canvas.height });
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
});
