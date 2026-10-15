import type { StateView } from "./layout";
import type { Millilitres } from "./units";

export type Action =
  | { readonly tick: number; readonly type: "mist"; readonly amount: Millilitres }
  | { readonly tick: number; readonly type: "tilt"; readonly degrees: number }
  | {
      readonly tick: number;
      readonly type: "lamp";
      readonly xMm: number;
      readonly yMm: number;
      readonly intensity: number;
    }
  | {
      readonly tick: number;
      readonly type: "seed";
      readonly species: string;
      readonly xMm: number;
      readonly yMm: number;
    }
  | {
      readonly tick: number;
      readonly type: "tap";
      readonly xMm: number;
      readonly yMm: number;
    };

export interface SimEvent {
  readonly tick: number;
  readonly type: string;
  readonly payload?: Readonly<Record<string, string | number | boolean | null>>;
}

export interface SimBackend {
  step(ticks: number): void;
  read(): StateView;
  apply(action: Action): void;
}

export interface JarReport {
  readonly seed: number | string;
  readonly days: number;
  readonly ticks: number;
  readonly events: Readonly<Record<string, number>>;
  readonly ledger: Readonly<Record<string, number>>;
  readonly stateHash?: string;
}
