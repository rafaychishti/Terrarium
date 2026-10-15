import type { SimEvent } from "../shared/types";

export class EventRingBuffer {
  private readonly events: Array<SimEvent | undefined>;
  private nextIndex = 0;
  private length = 0;

  constructor(readonly capacity = 256) {
    if (!Number.isSafeInteger(capacity) || capacity < 1) {
      throw new RangeError("Event ring capacity must be a positive safe integer");
    }
    this.events = new Array<SimEvent | undefined>(capacity);
  }

  append(event: SimEvent): void {
    this.events[this.nextIndex] = event;
    this.nextIndex = (this.nextIndex + 1) % this.capacity;
    this.length = Math.min(this.length + 1, this.capacity);
  }

  snapshot(): SimEvent[] {
    return this.readMatching(() => true);
  }

  atTick(tick: number): SimEvent[] {
    return this.readMatching((event) => event.tick === tick);
  }

  private readMatching(matches: (event: SimEvent) => boolean): SimEvent[] {
    const result: SimEvent[] = [];
    const firstIndex = (this.nextIndex - this.length + this.capacity) % this.capacity;
    for (let offset = 0; offset < this.length; offset += 1) {
      const event = this.events[(firstIndex + offset) % this.capacity];
      if (event === undefined) {
        throw new Error("Event ring buffer contains an uninitialized slot");
      }
      if (matches(event)) result.push(event);
    }
    return result;
  }
}
