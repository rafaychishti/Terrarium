import { describe, expect, it } from "vitest";
import {
  createSharedStateBuffer,
  createStateLayout,
} from "../../src/shared/layout";

describe("shared state layout", () => {
  it("allocates two isolated buffers and atomically flips the front", () => {
    const layout = createStateLayout(3, 2);
    const state = createSharedStateBuffer(layout);

    expect(layout.cells).toBe(6);
    state.back().water[0] = 4.5;
    expect(state.front().water[0]).toBe(0);

    state.publishBack();
    expect(state.front().water[0]).toBe(4.5);
    expect(state.back().water[0]).toBe(0);
    expect(Atomics.load(state.frontIndex, 0)).toBe(1);
  });

  it("rejects invalid grid dimensions", () => {
    expect(() => createStateLayout(0, 4)).toThrow(RangeError);
    expect(() => createStateLayout(4, 1.5)).toThrow(RangeError);
  });
});
