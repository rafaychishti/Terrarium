import { describe, expect, it } from "vitest";
import {
  FixedTickClock,
  TickScheduler,
  ticksPerSecondFor,
  type TicksPerSecondMode,
} from "../../src/sim/clock";

describe("fixed-tick clock", () => {
  it("defaults to a 60 jar-second tick", () => {
    const clock = new FixedTickClock();

    expect(clock.tickSeconds).toBe(60);
    expect(clock.tick).toBe(0);
    expect(clock.advance(3)).toBe(3);
    expect(clock.advance()).toBe(4);
  });

  it("rejects invalid tick lengths and advances", () => {
    expect(() => new FixedTickClock({ tickSeconds: 0 })).toThrow(RangeError);
    const clock = new FixedTickClock();
    expect(() => clock.advance(-1)).toThrow(RangeError);
  });

  it("maps the requested ticks-per-second presets", () => {
    const rates: readonly [TicksPerSecondMode, number | undefined][] = [
      ["real-time", 1 / 60],
      ["hour-per-minute", 1],
      ["default", 60],
      ["unbounded", undefined],
    ];

    for (const [mode, expected] of rates) {
      expect(ticksPerSecondFor(mode)).toBe(expected);
    }
  });

  it("reports real-time speed only after at least one tick was due", () => {
    let now = 0;
    let ticks = 0;
    const scheduler = new TickScheduler({
      mode: "real-time",
      now: () => now,
      onTick: () => {
        ticks += 1;
      },
    });

    expect(scheduler.statsIntervalMilliseconds).toBe(60_000);
    now = 1_000;
    expect(scheduler.pump().slowdown).toBeNull();
    now = 60_000;
    const stats = scheduler.pump();
    expect(ticks).toBe(1);
    expect(stats.achievedTicksPerSecond).toBeCloseTo(1 / 60);
    expect(stats.slowdown).toBe(1);
  });

  it("resets measured throughput without discarding pending tick debt", () => {
    let now = 0;
    const scheduler = new TickScheduler({
      mode: "hour-per-minute",
      maxTicksPerPump: 1,
      now: () => now,
      onTick: () => {},
    });

    now = 5_000;
    const overloaded = scheduler.pump();
    expect(overloaded.pendingTicks).toBe(4);
    scheduler.resetMeasurements(now);
    now = 6_000;
    const nextSample = scheduler.pump();
    expect(nextSample.pendingTicks).toBe(4);
    expect(nextSample.achievedTicksPerSecond).toBe(1);
    expect(nextSample.slowdown).toBe(1);
  });

  it("eventually processes every due tick while retaining bounded-pump debt", () => {
    let now = 0;
    let ticks = 0;
    const scheduler = new TickScheduler({
      mode: "default",
      maxTicksPerPump: 4,
      now: () => now,
      onTick: () => {
        ticks += 1;
      },
    });

    now = 1000;
    const firstPump = scheduler.pump();
    expect(firstPump.processedTicks).toBe(4);
    expect(firstPump.pendingTicks).toBe(56);

    while (scheduler.pendingTicks > 0) scheduler.pump();
    expect(ticks).toBe(60);
    expect(scheduler.pendingTicks).toBe(0);
  });

  it("reports backlog slowdown without skipping due ticks", () => {
    let now = 0;
    let ticks = 0;
    const scheduler = new TickScheduler({
      mode: "hour-per-minute",
      maxTicksPerPump: 2,
      now: () => now,
      onTick: () => {
        ticks += 1;
      },
    });

    now = 10_000;
    const overloaded = scheduler.pump();
    expect(ticks).toBe(2);
    expect(overloaded.pendingTicks).toBe(8);
    expect(overloaded.achievedTicksPerSecond).toBeCloseTo(0.2);
    expect(overloaded.slowdown).toBeCloseTo(0.2);

    while (scheduler.pendingTicks > 0) scheduler.pump();
    expect(ticks).toBe(10);
  });

  it("reports measured slowdown even when there is no pending whole-tick debt", () => {
    let now = 0;
    const scheduler = new TickScheduler({
      mode: "hour-per-minute",
      now: () => now,
      onTick: () => {},
    });

    now = 1500;
    const stats = scheduler.pump();

    expect(stats.pendingTicks).toBe(0);
    expect(stats.achievedTicksPerSecond).toBeCloseTo(2 / 3);
    expect(stats.slowdown).toBeCloseTo(2 / 3);
  });

  it("accrues at the old rate and preserves fractional progress across speed changes", () => {
    let now = 0;
    let ticks = 0;
    const scheduler = new TickScheduler({
      mode: "hour-per-minute",
      maxTicksPerPump: 4,
      now: () => now,
      onTick: () => {
        ticks += 1;
      },
    });

    now = 500;
    scheduler.setMode("default");
    expect(scheduler.pendingTicks).toBe(0);
    now = 508.34;
    scheduler.pump();
    expect(ticks).toBe(1);
  });

  it("processes bounded batches in unbounded mode and reports no target slowdown", () => {
    let ticks = 0;
    const scheduler = new TickScheduler({
      mode: "unbounded",
      maxTicksPerPump: 3,
      now: () => 0,
      onTick: () => {
        ticks += 1;
      },
    });

    const stats = scheduler.pump();
    expect(ticks).toBe(3);
    expect(stats.processedTicks).toBe(3);
    expect(stats.slowdown).toBeNull();
  });
});
