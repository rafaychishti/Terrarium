import { describe, expect, it } from "vitest";
import { FixedTickClock } from "../../src/sim/clock";

describe("fixed-tick clock", () => {
  it("advances by whole ticks and derives its timer interval from speed", () => {
    const clock = new FixedTickClock({ tickSeconds: 0.25, speedMultiplier: 2 });

    expect(clock.tick).toBe(0);
    expect(clock.intervalMilliseconds).toBe(125);
    expect(clock.advance(3)).toBe(3);
    clock.setSpeedMultiplier(0.5);
    expect(clock.intervalMilliseconds).toBe(500);
    expect(clock.advance()).toBe(4);
  });

  it("rejects invalid tick lengths, speeds, and advances", () => {
    expect(() => new FixedTickClock({ tickSeconds: 0 })).toThrow(RangeError);
    expect(() => new FixedTickClock({ speedMultiplier: Number.NaN })).toThrow(
      RangeError,
    );
    const clock = new FixedTickClock();
    expect(() => clock.advance(-1)).toThrow(RangeError);
    expect(() => clock.setSpeedMultiplier(0)).toThrow(RangeError);
  });
});
