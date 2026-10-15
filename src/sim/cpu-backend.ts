import { createStateLayout, type StateLayout, type StateView } from "../shared/layout";
import type { Action, SimEvent, SimBackend } from "../shared/types";
import { ActionQueue } from "./action-queue";
import { EventRingBuffer } from "./event-ring-buffer";
import {
  DEFAULT_GRID_HEIGHT,
  DEFAULT_GRID_WIDTH,
  generateJar,
} from "./generate";

export interface CpuBackendOptions {
  readonly layout?: StateLayout;
  readonly eventCapacity?: number;
}

function eventForAction(action: Action): SimEvent {
  switch (action.type) {
    case "mist":
      return {
        tick: action.tick,
        type: "action",
        payload: { action: action.type, amount: action.amount },
      };
    case "tilt":
      return {
        tick: action.tick,
        type: "action",
        payload: { action: action.type, degrees: action.degrees },
      };
    case "lamp":
      return {
        tick: action.tick,
        type: "action",
        payload: {
          action: action.type,
          xMm: action.xMm,
          yMm: action.yMm,
          intensity: action.intensity,
        },
      };
    case "seed":
      return {
        tick: action.tick,
        type: "action",
        payload: {
          action: action.type,
          species: action.species,
          xMm: action.xMm,
          yMm: action.yMm,
        },
      };
    case "tap":
      return {
        tick: action.tick,
        type: "action",
        payload: { action: action.type, xMm: action.xMm, yMm: action.yMm },
      };
  }
}

export class CpuBackend implements SimBackend {
  readonly layout: StateLayout;
  readonly events: EventRingBuffer;
  private readonly state: StateView;
  private readonly actions = new ActionQueue();
  private currentTick = 0;

  constructor(seed: number | string, options: CpuBackendOptions = {}) {
    this.layout =
      options.layout ??
      createStateLayout(DEFAULT_GRID_WIDTH, DEFAULT_GRID_HEIGHT);
    this.state = generateJar(seed, this.layout);
    this.events = new EventRingBuffer(options.eventCapacity);
  }

  get tick(): number {
    return this.currentTick;
  }

  step(ticks: number): void {
    if (!Number.isSafeInteger(ticks) || ticks < 0) {
      throw new RangeError("Step count must be a non-negative safe integer");
    }
    if (!Number.isSafeInteger(this.currentTick + ticks)) {
      throw new RangeError("Simulation tick exceeds the safe integer range");
    }

    const targetTick = this.currentTick + ticks;
    while (this.currentTick < targetTick) {
      this.currentTick += 1;
      const actions = this.actions.take(this.currentTick);
      if (!actions) continue;
      for (let index = 0; index < actions.length; index += 1) {
        this.events.append(eventForAction(actions[index]));
      }
    }
  }

  read(): StateView {
    return this.state;
  }

  apply(action: Action): void {
    this.actions.schedule(action, this.currentTick);
  }
}
