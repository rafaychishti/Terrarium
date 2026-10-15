export interface FixedTickClockOptions {
  readonly tickSeconds?: number;
  readonly speedMultiplier?: number;
}

export class FixedTickClock {
  private currentTick = 0;
  private currentSpeedMultiplier: number;
  readonly tickSeconds: number;

  constructor(options: FixedTickClockOptions = {}) {
    this.tickSeconds = options.tickSeconds ?? 1 / 60;
    this.currentSpeedMultiplier = options.speedMultiplier ?? 1;
    this.validateTickSeconds(this.tickSeconds);
    this.validateSpeedMultiplier(this.currentSpeedMultiplier);
    this.validateInterval();
  }

  get tick(): number {
    return this.currentTick;
  }

  get speedMultiplier(): number {
    return this.currentSpeedMultiplier;
  }

  get intervalMilliseconds(): number {
    return (this.tickSeconds * 1000) / this.currentSpeedMultiplier;
  }

  setSpeedMultiplier(speedMultiplier: number): void {
    this.validateSpeedMultiplier(speedMultiplier);
    const intervalMilliseconds = (this.tickSeconds * 1000) / speedMultiplier;
    if (!Number.isFinite(intervalMilliseconds) || intervalMilliseconds <= 0) {
      throw new RangeError("Tick interval must be finite and positive");
    }
    this.currentSpeedMultiplier = speedMultiplier;
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

  private validateTickSeconds(tickSeconds: number): void {
    if (!Number.isFinite(tickSeconds) || tickSeconds <= 0) {
      throw new RangeError("Tick length must be finite and positive");
    }
  }

  private validateInterval(): void {
    const intervalMilliseconds = this.intervalMilliseconds;
    if (!Number.isFinite(intervalMilliseconds) || intervalMilliseconds <= 0) {
      throw new RangeError("Tick interval must be finite and positive");
    }
  }

  private validateSpeedMultiplier(speedMultiplier: number): void {
    if (!Number.isFinite(speedMultiplier) || speedMultiplier <= 0) {
      throw new RangeError("Speed multiplier must be finite and positive");
    }
  }
}
