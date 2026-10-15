import { createSharedStateBuffer, createStateLayout, type StateView } from "../shared/layout";
import { CpuBackend } from "../sim/cpu-backend";
import {
  FixedTickClock,
  TickScheduler,
  type TicksPerSecondMode,
} from "../sim/clock";
import {
  DEFAULT_GRID_HEIGHT,
  DEFAULT_GRID_WIDTH,
} from "../sim/generate";
import type { SimEvent } from "../shared/types";
import type { WorkerRequest, WorkerResponse } from "./protocol";

const MAX_TICKS_PER_PUMP = 32;
const PUMP_INTERVAL_MILLISECONDS = 10;
const MIN_STATS_INTERVAL_MILLISECONDS = 1000;

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

export function installSimWorker(
  scope: SimWorkerScope,
  now: () => number = () => performance.now(),
): void {
  let backend: CpuBackend | undefined;
  let clock: FixedTickClock | undefined;
  let scheduler: TickScheduler | undefined;
  let sharedState: ReturnType<typeof createSharedStateBuffer> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false;
  let awaitingTickAcknowledgement: number | undefined;
  let lastStatsReportMilliseconds = 0;
  let pendingEvents: SimEvent[] = [];

  const stopTimer = (): void => {
    running = false;
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };

  const pump = (): void => {
    if (!scheduler || !backend || !clock || !sharedState) {
      throw new Error("Worker scheduler started before initialization completed");
    }
    if (awaitingTickAcknowledgement !== undefined) return;
    const nowMilliseconds = now();
    const stats = scheduler.pump(nowMilliseconds);
    if (stats.processedTicks > 0) {
      awaitingTickAcknowledgement = backend.tick;
      scope.postMessage({
        type: "tick",
        tick: backend.tick,
        ticksAdvanced: stats.processedTicks,
        ticksPerSecondMode: scheduler.ticksPerSecondMode,
        events: pendingEvents,
      });
      pendingEvents = [];
    }
    const statsIntervalMilliseconds = Math.max(
      MIN_STATS_INTERVAL_MILLISECONDS,
      scheduler.statsIntervalMilliseconds,
    );
    if (nowMilliseconds - lastStatsReportMilliseconds >= statsIntervalMilliseconds) {
      lastStatsReportMilliseconds = nowMilliseconds;
      scope.postMessage({
        type: "stats",
        tick: backend.tick,
        ticksPerSecondMode: scheduler.ticksPerSecondMode,
        achievedTicksPerSecond: stats.achievedTicksPerSecond,
        slowdown: stats.slowdown,
        pendingTicks: stats.pendingTicks,
      });
      scheduler.resetMeasurements(nowMilliseconds);
    }
  };

  const schedulePump = (): void => {
    if (
      !running ||
      timer !== undefined ||
      !scheduler ||
      awaitingTickAcknowledgement !== undefined
    ) return;
    const delay =
      scheduler.ticksPerSecondMode === "unbounded"
        ? 0
        : PUMP_INTERVAL_MILLISECONDS;
    timer = setTimeout(() => {
      timer = undefined;
      pump();
      schedulePump();
    }, delay);
  };

  const startTimer = (): void => {
    if (!scheduler) {
      scope.postMessage({ type: "error", message: "Worker must be initialized first" });
      return;
    }
    running = true;
    schedulePump();
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
        clock = new FixedTickClock();
        sharedState = createSharedStateBuffer(layout);
        copyState(backend.read(), sharedState.buffers[0]);
        copyState(backend.read(), sharedState.buffers[1]);
        const initialMode: TicksPerSecondMode = data.ticksPerSecond ?? "default";
        scheduler = new TickScheduler({
          mode: initialMode,
          maxTicksPerPump: MAX_TICKS_PER_PUMP,
          now,
          onTick: () => {
            if (!backend || !clock || !sharedState) {
              throw new Error("Worker state was cleared while its scheduler was active");
            }
            backend.step(1);
            clock.advance();
            if (clock.tick !== backend.tick) {
              throw new Error("Worker clock and simulation ticks diverged");
            }
            copyState(backend.read(), sharedState.back());
            sharedState.publishBack();
            pendingEvents.push(...backend.events.atTick(backend.tick));
          },
        });
        lastStatsReportMilliseconds = now();
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
      case "speed": {
        if (!scheduler) {
          scope.postMessage({ type: "error", message: "Worker must be initialized first" });
          return;
        }
        const wasRunning = running;
        const modeChangedAt = now();
        if (timer !== undefined) clearTimeout(timer);
        timer = undefined;
        scheduler.setMode(data.ticksPerSecond, modeChangedAt);
        lastStatsReportMilliseconds = modeChangedAt;
        if (wasRunning) schedulePump();
        else startTimer();
        return;
      }
      case "ack":
        if (awaitingTickAcknowledgement !== data.tick) {
          scope.postMessage({
            type: "error",
            message: `Unexpected tick acknowledgement: ${data.tick}`,
          });
          return;
        }
        awaitingTickAcknowledgement = undefined;
        schedulePump();
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
