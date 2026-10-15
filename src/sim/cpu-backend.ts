import { createStateLayout, type StateLayout, type StateView } from "../shared/layout";
import type { Action, SimEvent, SimBackend } from "../shared/types";
import { ActionQueue } from "./action-queue";
import { EventRingBuffer } from "./event-ring-buffer";
import { GranularMotion } from "./granular-motion";
import { HeatTransfer } from "./heat-transfer";
import { LightTransport, type AreaLamp } from "./light-transport";
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
  private readonly granularMotion: GranularMotion;
  private readonly lightTransport = new LightTransport();
  private readonly heatTransfer: HeatTransfer;
  private currentTick = 0;
  private tiltDegrees = 0;
  private granularSettled = false;
  private lamp: AreaLamp = { xMm: 0, yMm: 0, intensity: 0 };
  private thermalActive = false;
  private lightDirty = true;

  constructor(seed: number | string, options: CpuBackendOptions = {}) {
    this.layout =
      options.layout ??
      createStateLayout(DEFAULT_GRID_WIDTH, DEFAULT_GRID_HEIGHT);
    this.state = generateJar(seed, this.layout);
    this.granularMotion = new GranularMotion(this.layout);
    this.heatTransfer = new HeatTransfer(this.layout);
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
      if (actions) {
        for (let index = 0; index < actions.length; index += 1) {
          const action = actions[index];
          if (action.type === "tilt") {
            this.tiltDegrees = action.degrees;
            this.granularSettled = false;
          } else if (action.type === "lamp") {
            this.lamp = {
              xMm: action.xMm,
              yMm: action.yMm,
              intensity: action.intensity,
            };
            this.thermalActive ||= action.intensity > 0;
            this.lightDirty = true;
          }
          this.events.append(eventForAction(action));
        }
      }
      const materialsChanged =
        !this.granularSettled &&
        this.granularMotion.step(this.state, this.currentTick, this.tiltDegrees);
      if (!this.granularSettled && !materialsChanged) {
        this.granularSettled = true;
      }
      if (this.thermalActive) {
        if (materialsChanged) this.lightDirty = true;
        if (this.lightDirty) {
          this.lightTransport.step(this.state, this.layout, this.lamp);
          this.lightDirty = false;
        }
        this.thermalActive = !this.heatTransfer.step(
          this.state,
          this.layout,
          materialsChanged,
        );
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
