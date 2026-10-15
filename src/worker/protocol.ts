import type { StateLayout } from "../shared/layout";
import type { Seed } from "../shared/prng";
import type { Action, SimEvent } from "../shared/types";
import type { TicksPerSecondMode } from "../sim/clock";

export type WorkerRequest =
  | {
      readonly type: "init";
      readonly seed: Seed;
      readonly width?: number;
      readonly height?: number;
      readonly ticksPerSecond?: TicksPerSecondMode;
    }
  | { readonly type: "action"; readonly action: Action }
  | { readonly type: "speed"; readonly ticksPerSecond: TicksPerSecondMode }
  | { readonly type: "ack"; readonly tick: number }
  | { readonly type: "stop" };

export type WorkerResponse =
  | {
      readonly type: "ready";
      readonly storage: SharedArrayBuffer;
      readonly layout: StateLayout;
      readonly tick: number;
    }
  | {
      readonly type: "tick";
      readonly tick: number;
      readonly ticksAdvanced: number;
      readonly ticksPerSecondMode: TicksPerSecondMode;
      readonly events: readonly SimEvent[];
    }
  | {
      readonly type: "stats";
      readonly tick: number;
      readonly ticksPerSecondMode: TicksPerSecondMode;
      readonly achievedTicksPerSecond: number;
      readonly slowdown: number | null;
      readonly pendingTicks: number;
    }
  | { readonly type: "error"; readonly message: string };
