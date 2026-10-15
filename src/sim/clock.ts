export const TICKS_PER_SECOND = {
  "real-time": 1 / 60,
  "hour-per-minute": 1,
  default: 60,
} as const;

export type TicksPerSecondMode = keyof typeof TICKS_PER_SECOND | "unbounded";

export function ticksPerSecondFor(mode: TicksPerSecondMode): number | undefined {
  if (mode === "unbounded") return undefined;
  const rate = TICKS_PER_SECOND[mode];
  if (rate === undefined) throw new RangeError("Invalid ticks-per-second mode");
  return rate;
}

export interface FixedTickClockOptions {
  readonly tickSeconds?: number;
}

export class FixedTickClock {
  private currentTick = 0;
  readonly tickSeconds: number;

  constructor(options: FixedTickClockOptions = {}) {
    this.tickSeconds = options.tickSeconds ?? 60;
    if (!Number.isFinite(this.tickSeconds) || this.tickSeconds <= 0) {
      throw new RangeError("Tick length must be finite and positive");
    }
  }

  get tick(): number {
    return this.currentTick;
  }

  advance(ticks = 1): number {
    if (!Number.isSafeInteger(ticks) || ticks < 0) {
      throw new RangeError("Tick advance must be a non-negative safe integer");
    }
    if (!Number.isSafeInteger(this.currentTick + ticks)) {
      throw new RangeError("Clock tick exceeds the safe integer range");
    }
    this.currentTick += ticks;
    return this.currentTick;
  }
}

export interface TickSchedulerOptions {
  readonly mode?: TicksPerSecondMode;
  readonly maxTicksPerPump?: number;
  readonly now: () => number;
  readonly onTick: () => void;
}

export interface TickSchedulerStats {
  readonly achievedTicksPerSecond: number;
  readonly slowdown: number | null;
  readonly pendingTicks: number;
  readonly processedTicks: number;
}

export class TickScheduler {
  private mode: TicksPerSecondMode;
  private readonly maxTicksPerPump: number;
  private readonly now: () => number;
  private readonly onTick: () => void;
  private lastTimeMilliseconds: number;
  private sampleStartMilliseconds: number;
  private sampleTicks = 0;
  private accumulatedTicks = 0;

  constructor(options: TickSchedulerOptions) {
    this.mode = options.mode ?? "default";
    ticksPerSecondFor(this.mode);
    this.maxTicksPerPump = options.maxTicksPerPump ?? 32;
    this.now = options.now;
    this.onTick = options.onTick;
    if (
      !Number.isSafeInteger(this.maxTicksPerPump) ||
      this.maxTicksPerPump < 1
    ) {
      throw new RangeError("Maximum ticks per pump must be a positive safe integer");
    }
    const startTime = this.readTime();
    this.lastTimeMilliseconds = startTime;
    this.sampleStartMilliseconds = startTime;
  }

  get ticksPerSecondMode(): TicksPerSecondMode {
    return this.mode;
  }

  get pendingTicks(): number {
    return Math.floor(this.accumulatedTicks);
  }

  get statsIntervalMilliseconds(): number {
    const rate = ticksPerSecondFor(this.mode);
    return rate === undefined ? 1_000 : Math.max(1_000, 1_000 / rate);
  }

  setMode(mode: TicksPerSecondMode, nowMilliseconds = this.readTime()): void {
    ticksPerSecondFor(mode);
    const now = this.validateTime(nowMilliseconds);
    this.accrue(now);
    this.mode = mode;
    this.sampleStartMilliseconds = now;
    this.sampleTicks = 0;
  }

  pump(nowMilliseconds = this.readTime()): TickSchedulerStats {
    const now = this.validateTime(nowMilliseconds);
    this.accrue(now);
    const unbounded = this.mode === "unbounded";
    const ticksToProcess = unbounded
      ? this.maxTicksPerPump
      : Math.min(this.pendingTicks, this.maxTicksPerPump);
    let processedTicks = 0;
    for (; processedTicks < ticksToProcess; processedTicks += 1) {
      this.onTick();
      if (this.accumulatedTicks >= 1) this.accumulatedTicks -= 1;
    }

    this.sampleTicks += processedTicks;
    const elapsedSeconds = (now - this.sampleStartMilliseconds) / 1000;
    const achievedTicksPerSecond =
      elapsedSeconds > 0 ? this.sampleTicks / elapsedSeconds : 0;
    const requestedTicksPerSecond = ticksPerSecondFor(this.mode);
    const expectedTicks =
      requestedTicksPerSecond === undefined
        ? undefined
        : elapsedSeconds * requestedTicksPerSecond;

    return {
      achievedTicksPerSecond,
      slowdown:
        requestedTicksPerSecond === undefined ||
        expectedTicks === undefined ||
        expectedTicks < 1
          ? null
          : Math.min(1, achievedTicksPerSecond / requestedTicksPerSecond),
      pendingTicks: this.pendingTicks,
      processedTicks,
    };
  }

  resetMeasurements(nowMilliseconds = this.readTime()): void {
    const now = this.validateTime(nowMilliseconds);
    this.sampleStartMilliseconds = now;
    this.sampleTicks = 0;
  }

  private accrue(now: number): void {
    const elapsedMilliseconds = now - this.lastTimeMilliseconds;
    if (elapsedMilliseconds < 0) {
      throw new RangeError("Scheduler time must be monotonic");
    }
    const rate = ticksPerSecondFor(this.mode);
    if (rate !== undefined) {
      const accumulatedTicks =
        this.accumulatedTicks + (elapsedMilliseconds / 1000) * rate;
      if (
        !Number.isFinite(accumulatedTicks) ||
        accumulatedTicks > Number.MAX_SAFE_INTEGER
      ) {
        throw new RangeError("Scheduler tick backlog exceeds the safe integer range");
      }
      this.accumulatedTicks = accumulatedTicks;
    }
    this.lastTimeMilliseconds = now;
  }

  private readTime(): number {
    return this.validateTime(this.now());
  }

  private validateTime(now: number): number {
    if (!Number.isFinite(now)) {
      throw new RangeError("Scheduler time must be finite");
    }
    return now;
  }
}
