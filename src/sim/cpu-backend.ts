import { createStateLayout, type StateLayout, type StateView } from "../shared/layout";
import type { LedgerTotals } from "../shared/ledger";
import type { Action, SimEvent, SimBackend } from "../shared/types";
import { g, ml } from "../shared/units";
import { ActionQueue } from "./action-queue";
import { EventRingBuffer } from "./event-ring-buffer";
import { GranularMotion } from "./granular-motion";
import { HeatTransfer } from "./heat-transfer";
import { LightTransport, type AreaLamp } from "./light-transport";
import { SoilWater } from "./soil-water";
import {
  DEFAULT_GRID_HEIGHT,
  DEFAULT_GRID_WIDTH,
  generateJar,
} from "./generate";

const THERMAL_UPDATE_INTERVAL_TICKS = 10;

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
  private ledgerTotals: LedgerTotals;
  private expectedLedgerTotals: LedgerTotals;
  private readonly actions = new ActionQueue();
  private readonly granularMotion: GranularMotion;
  private readonly soilWater: SoilWater;
  readonly ledger: {
    totals(): LedgerTotals;
    expectedTotals(): LedgerTotals;
    readonly lastModule?: string;
  };
  private readonly lightTransport = new LightTransport();
  private readonly heatTransfer: HeatTransfer;
  private currentTick = 0;
  private tiltDegrees = 0;
  private granularSettled = false;
  private lamp: AreaLamp = { xMm: 0, yMm: 0, intensity: 0 };
  private thermalActive = false;
  private lightDirty = true;
  private lastThermalUpdateTick = 0;

  constructor(seed: number | string, options: CpuBackendOptions = {}) {
    this.layout =
      options.layout ??
      createStateLayout(DEFAULT_GRID_WIDTH, DEFAULT_GRID_HEIGHT);
    this.state = generateJar(seed, this.layout);
    this.granularMotion = new GranularMotion(this.layout);
    this.soilWater = new SoilWater(this.layout);
    this.heatTransfer = new HeatTransfer(this.layout);
    this.events = new EventRingBuffer(options.eventCapacity);
    this.ledgerTotals = this.sumLedgerTotals();
    this.expectedLedgerTotals = this.ledgerTotals;
    const backend = this;
    this.ledger = {
      totals: () => this.ledgerTotals,
      expectedTotals: () => this.expectedLedgerTotals,
      get lastModule() {
        return backend.soilWater.lastWaterModule ?? undefined;
      },
    };
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
      let waterAddedThisTick = false;
      const actions = this.actions.take(this.currentTick);
      if (actions) {
        for (let index = 0; index < actions.length; index += 1) {
          const action = actions[index];
          if (action.type === "tilt") {
            this.tiltDegrees = action.degrees;
            this.granularSettled = false;
          } else if (action.type === "mist") {
            const actualWaterAdded = this.soilWater.mist(
              this.state,
              action.amount,
            );
            this.ledgerTotals = {
              ...this.ledgerTotals,
              water: ml(this.ledgerTotals.water + actualWaterAdded),
            };
            this.expectedLedgerTotals = {
              ...this.expectedLedgerTotals,
              water: ml(this.expectedLedgerTotals.water + action.amount),
            };
            waterAddedThisTick = action.amount > 0 || waterAddedThisTick;
          } else if (action.type === "lamp") {
            if (this.lamp.intensity === 0 && action.intensity > 0) {
              this.lastThermalUpdateTick = this.currentTick - 1;
            }
            this.lamp = {
              xMm: action.xMm,
              yMm: action.yMm,
              intensity: action.intensity,
            };
            this.thermalActive = true;
            this.lightDirty = true;
          }
          this.events.append(eventForAction(action));
        }
      }
      const materialsChanged =
        !this.granularSettled &&
        this.granularMotion.step(this.state, this.currentTick, this.tiltDegrees);
      const waterDelta = this.soilWater.step(
        this.state,
        this.currentTick,
        materialsChanged,
        waterAddedThisTick,
      );
      if (waterDelta !== 0) {
        this.ledgerTotals = {
          ...this.ledgerTotals,
          water: ml(this.ledgerTotals.water + waterDelta),
        };
      }
      if (!this.granularSettled && !materialsChanged) {
        this.granularSettled = true;
      }
      if (materialsChanged && this.lamp.intensity > 0) {
        this.thermalActive = true;
        this.lightDirty = true;
      }
      if (
        this.thermalActive &&
        (this.lightDirty ||
          materialsChanged ||
          this.currentTick - this.lastThermalUpdateTick >=
            THERMAL_UPDATE_INTERVAL_TICKS)
      ) {
        if (this.lightDirty) {
          this.lightTransport.step(this.state, this.layout, this.lamp);
          this.lightDirty = false;
        }
        const elapsedTicks = Math.max(
          1,
          this.currentTick - this.lastThermalUpdateTick,
        );
        const settled = this.heatTransfer.step(
          this.state,
          this.layout,
          materialsChanged,
          elapsedTicks,
        );
        this.thermalActive = !settled || this.lamp.intensity > 0;
        this.lastThermalUpdateTick = this.currentTick;
      }
    }
  }

  read(): StateView {
    return this.state;
  }

  private sumLedgerTotals(): LedgerTotals {
    let water = 0;
    let carbon = 0;
    let nutrients = 0;
    for (let index = 0; index < this.layout.cells; index += 1) {
      water += this.state.water[index];
      carbon += this.state.co2[index];
      nutrients += this.state.nutrients[index];
    }
    return {
      water: ml(water),
      carbon: g(carbon),
      nutrients: g(nutrients),
    };
  }

  apply(action: Action): void {
    this.actions.schedule(action, this.currentTick);
  }
}
