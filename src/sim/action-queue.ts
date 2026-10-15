import type { Action } from "../shared/types";

function validateAction(action: Action): void {
  if (!Number.isSafeInteger(action.tick) || action.tick < 1) {
    throw new RangeError("Action tick must be a positive safe integer");
  }

  switch (action.type) {
    case "mist":
      if (!Number.isFinite(action.amount) || action.amount < 0) {
        throw new RangeError("Mist amount must be finite and non-negative");
      }
      return;
    case "tilt":
      if (!Number.isFinite(action.degrees)) {
        throw new RangeError("Tilt angle must be finite");
      }
      return;
    case "lamp":
      if (
        !Number.isFinite(action.xMm) ||
        !Number.isFinite(action.yMm) ||
        !Number.isFinite(action.intensity) ||
        action.intensity < 0 ||
        action.intensity > 1
      ) {
        throw new RangeError(
          "Lamp coordinates must be finite and intensity must be in [0, 1]",
        );
      }
      return;
    case "seed":
      if (
        action.species.length === 0 ||
        !Number.isFinite(action.xMm) ||
        !Number.isFinite(action.yMm)
      ) {
        throw new RangeError("Seed species and coordinates must be valid");
      }
      return;
    case "tap":
      if (!Number.isFinite(action.xMm) || !Number.isFinite(action.yMm)) {
        throw new RangeError("Tap coordinates must be finite");
      }
      return;
  }
}

function copyAction(action: Action): Action {
  switch (action.type) {
    case "mist":
      return { tick: action.tick, type: action.type, amount: action.amount };
    case "tilt":
      return { tick: action.tick, type: action.type, degrees: action.degrees };
    case "lamp":
      return {
        tick: action.tick,
        type: action.type,
        xMm: action.xMm,
        yMm: action.yMm,
        intensity: action.intensity,
      };
    case "seed":
      return {
        tick: action.tick,
        type: action.type,
        species: action.species,
        xMm: action.xMm,
        yMm: action.yMm,
      };
    case "tap":
      return {
        tick: action.tick,
        type: action.type,
        xMm: action.xMm,
        yMm: action.yMm,
      };
  }
}

export class ActionQueue {
  private readonly byTick = new Map<number, Action[]>();

  schedule(action: Action, currentTick: number): void {
    validateAction(action);
    if (!Number.isSafeInteger(currentTick) || action.tick <= currentTick) {
      throw new RangeError("Action must be scheduled for a future tick");
    }

    const queued = this.byTick.get(action.tick);
    if (queued) queued.push(copyAction(action));
    else this.byTick.set(action.tick, [copyAction(action)]);
  }

  take(tick: number): readonly Action[] | undefined {
    const actions = this.byTick.get(tick);
    if (actions) this.byTick.delete(tick);
    return actions;
  }
}
