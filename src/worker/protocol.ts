import type { StateLayout } from "../shared/layout";
import type { Seed } from "../shared/prng";
import type { Action, SimEvent } from "../shared/types";

export type WorkerRequest =
  | {
      readonly type: "init";
      readonly seed: Seed;
      readonly width?: number;
      readonly height?: number;
      readonly tickSeconds?: number;
      readonly speedMultiplier?: number;
    }
  | { readonly type: "action"; readonly action: Action }
  | { readonly type: "speed"; readonly multiplier: number }
  | { readonly type: "stop" };

export type WorkerResponse =
  | {
      readonly type: "ready";
      readonly storage: SharedArrayBuffer;
      readonly layout: StateLayout;
      readonly tick: number;
    }
  | { readonly type: "tick"; readonly tick: number; readonly events: readonly SimEvent[] }
  | { readonly type: "error"; readonly message: string };
