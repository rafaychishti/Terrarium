import { createSharedStateBuffer, createStateLayout, type StateView } from "../shared/layout";
import { CpuBackend } from "../sim/cpu-backend";
import { FixedTickClock } from "../sim/clock";
import {
  DEFAULT_GRID_HEIGHT,
  DEFAULT_GRID_WIDTH,
} from "../sim/generate";
import type { WorkerRequest, WorkerResponse } from "./protocol";

export interface SimWorkerMessageEvent {
  readonly data: WorkerRequest;
}

export interface SimWorkerScope {
  onmessage: ((event: SimWorkerMessageEvent) => void) | null;
  postMessage(message: WorkerResponse): void;
}

function copyState(source: StateView, destination: StateView): void {
  destination.materials.set(source.materials);
  destination.water.set(source.water);
  destination.temperature.set(source.temperature);
  destination.co2.set(source.co2);
  destination.oxygen.set(source.oxygen);
  destination.nutrients.set(source.nutrients);
  destination.microbes.set(source.microbes);
  destination.light.set(source.light);
}

export function installSimWorker(scope: SimWorkerScope): void {
  let backend: CpuBackend | undefined;
  let clock: FixedTickClock | undefined;
  let sharedState: ReturnType<typeof createSharedStateBuffer> | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;

  const stopTimer = (): void => {
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
  };

  const startTimer = (): void => {
    if (!backend || !clock || !sharedState) {
      scope.postMessage({ type: "error", message: "Worker must be initialized first" });
      return;
    }
    stopTimer();
    timer = setInterval(() => {
      clock?.advance();
      backend?.step(1);
      if (!backend || !clock || !sharedState) {
        throw new Error("Worker state was cleared while its timer was active");
      }
      if (clock.tick !== backend.tick) {
        throw new Error("Worker clock and simulation ticks diverged");
      }
      copyState(backend.read(), sharedState.back());
      sharedState.publishBack();
      scope.postMessage({
        type: "tick",
        tick: backend.tick,
        events: backend.events.atTick(backend.tick),
      });
    }, clock.intervalMilliseconds);
  };

  scope.onmessage = ({ data }): void => {
    switch (data.type) {
      case "init": {
        if (backend) {
          scope.postMessage({ type: "error", message: "Worker is already initialized" });
          return;
        }
        const layout = createStateLayout(
          data.width ?? DEFAULT_GRID_WIDTH,
          data.height ?? DEFAULT_GRID_HEIGHT,
        );
        backend = new CpuBackend(data.seed, { layout });
        clock = new FixedTickClock({
          tickSeconds: data.tickSeconds,
          speedMultiplier: data.speedMultiplier,
        });
        sharedState = createSharedStateBuffer(layout);
        copyState(backend.read(), sharedState.buffers[0]);
        copyState(backend.read(), sharedState.buffers[1]);
        scope.postMessage({
          type: "ready",
          storage: sharedState.storage,
          layout,
          tick: backend.tick,
        });
        startTimer();
        return;
      }
      case "action":
        if (!backend) {
          scope.postMessage({ type: "error", message: "Worker must be initialized first" });
          return;
        }
        backend.apply(data.action);
        return;
      case "speed":
        if (!clock) {
          scope.postMessage({ type: "error", message: "Worker must be initialized first" });
          return;
        }
        clock.setSpeedMultiplier(data.multiplier);
        startTimer();
        return;
      case "stop":
        stopTimer();
        return;
    }
  };
}

if (typeof self !== "undefined" && typeof document === "undefined") {
  installSimWorker(self as unknown as SimWorkerScope);
}
