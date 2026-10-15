import { describe, expect, it } from "vitest";
import { EventRingBuffer } from "../../src/sim/event-ring-buffer";

describe("event ring buffer", () => {
  it("retains the newest events in chronological order", () => {
    const events = new EventRingBuffer(2);
    events.append({ tick: 1, type: "first" });
    events.append({ tick: 2, type: "second" });
    events.append({ tick: 3, type: "third" });

    expect(events.snapshot()).toEqual([
      { tick: 2, type: "second" },
      { tick: 3, type: "third" },
    ]);
    expect(events.atTick(2)).toEqual([{ tick: 2, type: "second" }]);
  });

  it("rejects an empty capacity", () => {
    expect(() => new EventRingBuffer(0)).toThrow(RangeError);
  });
});
