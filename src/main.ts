import { drawPaper, type PaperDebugView } from "./render/paper";
import { interpolateState } from "./render/interpolate";
import { elapsedTickInterval } from "./render/tick-interval";
import { createStateLayout, type StateLayout, type StateView } from "./shared/layout";
import type { TicksPerSecondMode } from "./sim/clock";

const DEFAULT_TICK_INTERVAL_MS = 1000 / 60;

const app = document.querySelector<HTMLElement>("#app");
const scene = document.querySelector<HTMLElement>("#scene");
if (!app || !scene) throw new Error("Terrarium page containers are missing");
const sceneElement = scene;

const canvas = document.createElement("canvas");
canvas.className = "terrarium-canvas";
canvas.setAttribute("role", "img");
canvas.setAttribute("aria-label", "A living terrarium in a glass case");
scene.append(canvas);

const context = canvas.getContext("2d");
if (!context) throw new Error("Canvas 2D is unavailable");
const renderContext = context;

const status = document.querySelector<HTMLElement>("#status");
const debugControl = document.querySelector<HTMLLabelElement>("#debug-control");
const debugSelect = document.querySelector<HTMLSelectElement>("#debug-view");
let state: StateView | undefined;
let previousState: StateView | undefined;
let currentState: StateView | undefined;
let lastTickAt: number | undefined;
let lastTickIntervalMs = DEFAULT_TICK_INTERVAL_MS;
let unboundedTicks = false;
let layout: StateLayout | undefined;
let sharedStorage: SharedArrayBuffer | undefined;
let sharedViews: readonly [StateView, StateView] | undefined;
let debugView: PaperDebugView | undefined;

const isDevelopment = Boolean(
  (import.meta as ImportMeta & { readonly env?: { readonly DEV: boolean } }).env?.DEV,
);
if (isDevelopment && debugControl && debugSelect) {
  debugControl.hidden = false;
  debugSelect.addEventListener("change", () => {
    const selected = debugSelect.value;
    debugView = selected === "moisture" || selected === "temperature" || selected === "light"
      ? selected
      : undefined;
    canvas.setAttribute(
      "aria-label",
      debugView
        ? `Terrarium development view: ${debugView}`
        : "A living terrarium in a glass case",
    );
  });
}

function createState(cells: number): StateView {
  return {
    materials: new Uint8Array(cells),
    water: new Float32Array(cells),
    temperature: new Float32Array(cells),
    co2: new Float32Array(cells),
    oxygen: new Float32Array(cells),
    nutrients: new Float32Array(cells),
    microbes: new Float32Array(cells),
    light: new Float32Array(cells),
  };
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

function setInterpolationMode(mode: TicksPerSecondMode): void {
  unboundedTicks = mode === "unbounded";
}

function acceptTickState(source: StateView, timestamp: number): void {
  if (!layout) return;
  lastTickIntervalMs = elapsedTickInterval(
    lastTickAt,
    timestamp,
    DEFAULT_TICK_INTERVAL_MS,
  );
  if (!state || state.materials.length !== layout.cells) {
    previousState = createState(layout.cells);
    currentState = createState(layout.cells);
    state = createState(layout.cells);
    copyState(source, previousState);
    copyState(source, currentState);
  } else if (previousState && currentState) {
    copyState(currentState, previousState);
    copyState(source, currentState);
  }
  lastTickAt = timestamp;
}

function viewsFromStorage(storage: SharedArrayBuffer, stateLayout: StateLayout): readonly [StateView, StateView] {
  const createView = (bufferIndex: number): StateView => {
    const offset = Int32Array.BYTES_PER_ELEMENT + bufferIndex * stateLayout.bytesPerBuffer;
    const floats = (field: keyof StateLayout["fieldOffsets"]): Float32Array =>
      new Float32Array(storage, offset + stateLayout.fieldOffsets[field], stateLayout.cells);
    return {
      materials: new Uint8Array(storage, offset + stateLayout.materialOffset, stateLayout.cells),
      water: floats("water"),
      temperature: floats("temperature"),
      co2: floats("co2"),
      oxygen: floats("oxygen"),
      nutrients: floats("nutrients"),
      microbes: floats("microbes"),
      light: floats("light"),
    };
  };
  return [createView(0), createView(1)];
}

function setStatus(text: string): void {
  if (status) status.textContent = text;
}

try {
  const worker = new Worker(new URL("./worker/sim.worker.ts", import.meta.url), {
    type: "module",
    name: "terrarium-sim",
  });
  worker.addEventListener("message", (event: MessageEvent<unknown>) => {
    const message = event.data as {
      type?: string;
      storage?: SharedArrayBuffer;
      layout?: StateLayout;
      width?: number;
      height?: number;
      state?: StateView;
      ticksPerSecondMode?: TicksPerSecondMode;
      ticksAdvanced?: number;
      tick?: number;
      error?: string;
      message?: string;
    };
    if (message.type === "error") {
      setStatus(message.message ?? message.error ?? "The simulation worker stopped.");
      return;
    }
    if (message.type === "stats") {
      if (message.ticksPerSecondMode) {
        setInterpolationMode(message.ticksPerSecondMode);
      }
    } else if (message.type === "ready") {
      layout = message.layout ?? createStateLayout(message.width ?? 128, message.height ?? 192);
      if (message.storage && typeof SharedArrayBuffer !== "undefined") {
        sharedStorage = message.storage;
        sharedViews = viewsFromStorage(message.storage, layout);
        acceptTickState(sharedViews[Atomics.load(new Int32Array(sharedStorage, 0, 1), 0) as 0 | 1], performance.now());
      }
      setStatus("A small world, sealed in glass.");
    } else if (message.type === "tick") {
      if (sharedStorage && sharedViews) {
        if (message.ticksPerSecondMode) {
          setInterpolationMode(message.ticksPerSecondMode);
        }
        const frontIndex = Atomics.load(new Int32Array(sharedStorage, 0, 1), 0) as 0 | 1;
        acceptTickState(sharedViews[frontIndex], performance.now());
        if (message.tick !== undefined) {
          worker.postMessage({ type: "ack", tick: message.tick });
        }
      }
    } else if (message.layout && message.state) {
      layout = message.layout;
      acceptTickState(message.state, performance.now());
      setStatus("A small world, sealed in glass.");
    } else if (message.layout && typeof SharedArrayBuffer !== "undefined" && message.storage instanceof SharedArrayBuffer) {
      layout = message.layout;
      sharedStorage = message.storage;
      sharedViews = viewsFromStorage(message.storage, message.layout);
      acceptTickState(sharedViews[Atomics.load(new Int32Array(sharedStorage, 0, 1), 0) as 0 | 1], performance.now());
      setStatus("A small world, sealed in glass.");
    }
  });
  worker.addEventListener("error", () => setStatus("The simulation worker could not start."));
  setStatus("Starting the terrarium…");
  worker.postMessage({ type: "init", seed: 1, width: 128, height: 192 });
} catch {
  setStatus("The simulation worker could not start.");
}

function resizeCanvas(): void {
  const bounds = sceneElement.getBoundingClientRect();
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(bounds.width * pixelRatio));
  const height = Math.max(1, Math.round(bounds.height * pixelRatio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function frame(timestamp: number): void {
  resizeCanvas();
  if (state && previousState && currentState && lastTickAt !== undefined) {
    const alpha = unboundedTicks
      ? 1
      : Math.min(1, Math.max(0, (timestamp - lastTickAt) / lastTickIntervalMs));
    interpolateState(previousState, currentState, alpha, state);
  }
  drawPaper(renderContext, state, layout, {
    width: canvas.width,
    height: canvas.height,
    debugView,
  });
  requestAnimationFrame(frame);
}

window.addEventListener("resize", resizeCanvas);
requestAnimationFrame(frame);
