import { drawPaper } from "./render/paper";
import { createStateLayout, type StateLayout, type StateView } from "./shared/layout";

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
let state: StateView | undefined;
let layout: StateLayout | undefined;
let sharedStorage: SharedArrayBuffer | undefined;
let sharedViews: readonly [StateView, StateView] | undefined;

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
      error?: string;
      message?: string;
    };
    if (message.type === "error") {
      setStatus(message.message ?? message.error ?? "The simulation worker stopped.");
      return;
    }
    if (message.type === "ready") {
      layout = message.layout ?? createStateLayout(message.width ?? 128, message.height ?? 192);
      if (message.storage && typeof SharedArrayBuffer !== "undefined") {
        sharedStorage = message.storage;
        sharedViews = viewsFromStorage(message.storage, layout);
      }
      setStatus("A small world, sealed in glass.");
    } else if (message.layout && message.state) {
      layout = message.layout;
      state = message.state;
      setStatus("A small world, sealed in glass.");
    } else if (message.layout && typeof SharedArrayBuffer !== "undefined" && message.storage instanceof SharedArrayBuffer) {
      layout = message.layout;
      sharedStorage = message.storage;
      sharedViews = viewsFromStorage(message.storage, message.layout);
      setStatus("A small world, sealed in glass.");
    }
  });
  worker.addEventListener("error", () => setStatus("The simulation worker could not start."));
  setStatus("Starting the terrarium…");
  worker.postMessage({ type: "init", seed: 1, width: 128, height: 192, tickSeconds: 1 / 30 });
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

function frame(): void {
  resizeCanvas();
  if (sharedStorage && sharedViews) {
    state = sharedViews[Atomics.load(new Int32Array(sharedStorage, 0, 1), 0) as 0 | 1];
  }
  drawPaper(renderContext, state, layout, { width: canvas.width, height: canvas.height });
  requestAnimationFrame(frame);
}

window.addEventListener("resize", resizeCanvas);
requestAnimationFrame(frame);
