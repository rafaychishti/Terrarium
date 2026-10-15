import { describe, expect, it } from "vitest";
import { elapsedTickInterval } from "../../src/render/tick-interval";

describe("interpolation intervals", () => {
  it("uses the observed interval between published batches across speed changes", () => {
    const previousTickAt = 100;
    const notificationAt = 140;

    expect(elapsedTickInterval(previousTickAt, notificationAt, 1000 / 60)).toBe(40);
  });

  it("falls back safely for the first or non-monotonic tick timestamp", () => {
    expect(elapsedTickInterval(undefined, 10, 1000 / 60)).toBe(1000 / 60);
    expect(elapsedTickInterval(20, 10, 1000 / 60)).toBe(1000 / 60);
  });
});
