import { createCanvas, loadImage } from "@napi-rs/canvas";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";
import { CpuBackend } from "../src/sim/cpu-backend";
import type { LedgerTotals } from "../src/shared/ledger";
import { g, ml } from "../src/shared/units";
import {
  PAPER_COLOR,
  drawPaper,
  type PaperCanvasContext,
} from "../src/render/paper";
import type { Seed } from "../src/shared/prng";
import {
  assertLedgerBalanced,
  findLargestLedgerError,
  LEDGER_TOLERANCE,
  type LedgerDayTotals,
  type LedgerError,
  type LedgerSource,
} from "./ledger";

export const JAR_SECONDS_PER_TICK = 60;
export const TICKS_PER_DAY = (24 * 60 * 60) / JAR_SECONDS_PER_TICK;
const IMAGE_WIDTH = 384;
const IMAGE_HEIGHT = 576;
const CONTACT_COLUMNS = 4;

export interface JarOptions {
  readonly seed: Seed;
  readonly days: number;
  readonly out: string;
  readonly lampIntensity?: number;
}

export interface JarArguments extends JarOptions {}

interface JarReport {
  readonly seed: Seed;
  readonly days: number;
  readonly ticks: number;
  readonly timing: {
    readonly totalMs: number;
    readonly perTickMs: number;
  };
  readonly runtime: {
    readonly mode: "unbounded";
    readonly targetTicksPerSecond: null;
    readonly achievedTicksPerSecond: number;
    readonly slowdownFactor: null;
    readonly jarSecondsPerTick: number;
    readonly elapsedMs: number;
  };
  readonly stateBufferHash: string;
  readonly events: Readonly<Record<string, number>>;
  readonly ledger: {
    readonly days: readonly LedgerDayTotals[];
    readonly largestPerTickError: LedgerError;
  };
}

interface LedgerBackend extends CpuBackend {
  readonly ledger?: LedgerSource;
}

export function parseJarArguments(args: readonly string[]): JarArguments {
  let seed: number | undefined;
  let days: number | undefined;
  let out: string | undefined;
  let lampIntensity = 1;

  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    const value = args[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Expected a value after ${flag}`);
    }

    switch (flag) {
      case "--seed": {
        const parsed = Number(value);
        if (!Number.isSafeInteger(parsed)) {
          throw new RangeError("--seed must be a safe integer");
        }
        seed = parsed;
        break;
      }
      case "--days": {
        const parsed = Number(value);
        if (!Number.isSafeInteger(parsed) || parsed < 1) {
          throw new RangeError("--days must be a positive safe integer");
        }
        days = parsed;
        break;
      }
      case "--out":
        out = value;
        break;
      case "--lamp-intensity": {
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
          throw new RangeError("--lamp-intensity must be in [0, 1]");
        }
        lampIntensity = parsed;
        break;
      }
      default:
        throw new Error(`Unknown argument: ${flag}`);
    }
    index += 1;
  }

  if (seed === undefined) throw new Error("Missing required --seed");
  if (days === undefined) throw new Error("Missing required --days");
  if (out === undefined) throw new Error("Missing required --out");
  if (!Number.isSafeInteger(days * TICKS_PER_DAY)) {
    throw new RangeError("--days exceeds the safe simulation tick range");
  }

  return { seed, days, out, lampIntensity };
}

function countEvents(events: readonly { readonly type: string }[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const event of events) {
    counts[event.type] = (counts[event.type] ?? 0) + 1;
  }
  return counts;
}

function hashStateBuffer(backend: CpuBackend): string {
  const state = backend.read();
  const hash = createHash("sha256");
  for (const field of [
    state.materials,
    state.water,
    state.temperature,
    state.co2,
    state.oxygen,
    state.nutrients,
    state.microbes,
    state.light,
  ]) {
    hash.update(new Uint8Array(field.buffer, field.byteOffset, field.byteLength));
  }
  return hash.digest("hex");
}

function readLedgerTotals(backend: LedgerBackend): LedgerTotals {
  if (backend.ledger) return backend.ledger.totals();
  const state = backend.read();
  const total = (values: Float32Array): number => {
    let amount = 0;
    for (let index = 0; index < values.length; index += 1) {
      amount += values[index];
    }
    return amount;
  };
  return {
    water: ml(total(state.water)),
    carbon: g(total(state.co2)),
    nutrients: g(total(state.nutrients)),
  };
}

function largestError(
  initial: LedgerTotals,
  current: LedgerTotals,
  tick: number,
  module: string | null,
): LedgerError {
  return findLargestLedgerError(initial, current, tick, module);
}

function renderDay(backend: CpuBackend): Buffer {
  const canvas = createCanvas(IMAGE_WIDTH, IMAGE_HEIGHT);
  const context = canvas.getContext("2d") as unknown as PaperCanvasContext;
  drawPaper(context, backend.read(), backend.layout, {
    width: canvas.width,
    height: canvas.height,
  });
  return canvas.toBuffer("image/png");
}

async function writeContactSheet(images: readonly Buffer[], outputDirectory: string): Promise<void> {
  const rows = Math.ceil(images.length / CONTACT_COLUMNS);
  const canvas = createCanvas(CONTACT_COLUMNS * IMAGE_WIDTH, rows * IMAGE_HEIGHT);
  const context = canvas.getContext("2d");
  context.fillStyle = PAPER_COLOR;
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (let index = 0; index < images.length; index += 1) {
    const image = await loadImage(images[index]);
    const x = (index % CONTACT_COLUMNS) * IMAGE_WIDTH;
    const y = Math.floor(index / CONTACT_COLUMNS) * IMAGE_HEIGHT;
    context.drawImage(image, x, y, IMAGE_WIDTH, IMAGE_HEIGHT);
  }

  await writeFile(path.join(outputDirectory, "contact-sheet.png"), canvas.toBuffer("image/png"));
}

export async function runJar(options: JarOptions): Promise<JarReport> {
  if (!Number.isSafeInteger(options.days) || options.days < 1) {
    throw new RangeError("Days must be a positive safe integer");
  }
  const ticks = options.days * TICKS_PER_DAY;
  if (!Number.isSafeInteger(ticks)) {
    throw new RangeError("Total simulation ticks exceed the safe integer range");
  }

  const outputDirectory = options.out;
  await mkdir(outputDirectory, { recursive: true });
  const backend = new CpuBackend(options.seed) as LedgerBackend;
  const lampIntensity = options.lampIntensity ?? 1;
  if (!Number.isFinite(lampIntensity) || lampIntensity < 0 || lampIntensity > 1) {
    throw new RangeError("Lamp intensity must be in [0, 1]");
  }
  if (lampIntensity > 0) {
    backend.apply({
      tick: 1,
      type: "lamp",
      xMm: 1,
      yMm: 0,
      intensity: lampIntensity,
    });
  }
  const images: Buffer[] = [];
  const initialLedgerTotals = readLedgerTotals(backend);
  const ledgerDays: LedgerDayTotals[] = [];
  let largestPerTickError: LedgerError = {
    amount: 0,
    resource: null,
    module: null,
    tick: 0,
  };
  const start = performance.now();

  for (let day = 1; day <= options.days; day += 1) {
    if (backend.ledger) {
      for (let dayTick = 0; dayTick < TICKS_PER_DAY; dayTick += 1) {
        backend.step(1);
        const error = largestError(
          initialLedgerTotals,
          backend.ledger.totals(),
          backend.tick,
          backend.ledger.lastModule ?? null,
        );
        if (error.amount > largestPerTickError.amount) {
          largestPerTickError = error;
        }
        if (process.env.NODE_ENV !== "production") {
          assertLedgerBalanced(error, LEDGER_TOLERANCE);
        }
      }
    } else {
      backend.step(TICKS_PER_DAY);
    }
    const totals = readLedgerTotals(backend);
    const error = largestError(
      initialLedgerTotals,
      totals,
      backend.tick,
      backend.ledger?.lastModule ?? null,
    );
    if (error.amount > largestPerTickError.amount) {
      largestPerTickError = error;
    }
    if (process.env.NODE_ENV !== "production") {
      assertLedgerBalanced(error, LEDGER_TOLERANCE);
    }
    ledgerDays.push({ day, totals });
    const image = renderDay(backend);
    images.push(image);
    const filename = `day-${String(day).padStart(2, "0")}.png`;
    await writeFile(path.join(outputDirectory, filename), image);
  }

  const totalMs = performance.now() - start;
  if (!Number.isFinite(totalMs) || totalMs <= 0) {
    throw new RangeError("Simulation elapsed time must be a positive finite number");
  }
  const achievedTicksPerSecond = ticks / (totalMs / 1_000);
  if (!Number.isFinite(achievedTicksPerSecond) || achievedTicksPerSecond < 0) {
    throw new RangeError("Achieved simulation speed must be a finite non-negative number");
  }
  await writeContactSheet(images, outputDirectory);
  const report: JarReport = {
    seed: options.seed,
    days: options.days,
    ticks,
    timing: {
      totalMs,
      perTickMs: totalMs / ticks,
    },
    runtime: {
      mode: "unbounded",
      targetTicksPerSecond: null,
      achievedTicksPerSecond,
      slowdownFactor: null,
      jarSecondsPerTick: JAR_SECONDS_PER_TICK,
      elapsedMs: totalMs,
    },
    stateBufferHash: hashStateBuffer(backend),
    events: countEvents(backend.events.snapshot()),
    ledger: {
      days: ledgerDays,
      largestPerTickError,
    },
  };
  await writeFile(
    path.join(outputDirectory, "report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );
  return report;
}

async function main(): Promise<void> {
  const options = parseJarArguments(process.argv.slice(2));
  const report = await runJar(options);
  console.log(
    `Rendered ${report.days} days (${report.ticks} ticks) to ${options.out}`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
