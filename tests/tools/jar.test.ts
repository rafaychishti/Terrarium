import { createCanvas, loadImage } from "@napi-rs/canvas";
import { execFileSync } from "node:child_process";
import { readdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { PAPER_COLOR } from "../../src/render/paper";
import {
  JAR_SECONDS_PER_TICK,
  parseJarArguments,
  runJar,
  TICKS_PER_DAY,
} from "../../tools/jar";

const outputDirectory = path.join(process.cwd(), "out", "test-jar");
const determinismDirectory = path.join(process.cwd(), "out", "test-jar-determinism");
const projectRoot = fileURLToPath(new URL("../..", import.meta.url));
const tsxCli = fileURLToPath(
  new URL("../../node_modules/tsx/dist/cli.mjs", import.meta.url),
);
const jarScript = fileURLToPath(new URL("../../tools/jar.ts", import.meta.url));

afterEach(async () => {
  await rm(outputDirectory, { recursive: true, force: true });
  await rm(determinismDirectory, { recursive: true, force: true });
});

describe("jar preview tool", () => {
  it("parses the required CLI flags and validates their values", () => {
    expect(parseJarArguments(["--seed", "7", "--days", "10", "--out", "out/m0"])).toEqual({
      seed: 7,
      days: 10,
      out: "out/m0",
    });
    expect(() => parseJarArguments(["--seed", "x", "--days", "1", "--out", "out"])).toThrow(
      RangeError,
    );
    expect(() => parseJarArguments(["--seed", "7", "--days", "0", "--out", "out"])).toThrow(
      RangeError,
    );
  });

  it("writes a day image, contact sheet, and timing/event/ledger report", async () => {
    const report = await runJar({ seed: 7, days: 1, out: outputDirectory });
    const files = await readdir(outputDirectory);
    const writtenReport = JSON.parse(
      await readFile(path.join(outputDirectory, "report.json"), "utf8"),
    ) as typeof report;

    expect(files.sort()).toEqual(["contact-sheet.png", "day-01.png", "report.json"]);
    expect(TICKS_PER_DAY).toBe(1_440);
    expect(JAR_SECONDS_PER_TICK).toBe(60);
    expect(report.ticks).toBe(TICKS_PER_DAY);
    expect(report.timing.perTickMs).toBeGreaterThanOrEqual(0);
    expect(report.runtime).toEqual({
      mode: "unbounded",
      targetTicksPerSecond: null,
      achievedTicksPerSecond: report.ticks / (report.runtime.elapsedMs / 1_000),
      slowdownFactor: null,
      jarSecondsPerTick: 60,
      elapsedMs: report.timing.totalMs,
    });
    expect(report.runtime.elapsedMs).toBeGreaterThan(0);
    expect(Number.isFinite(report.runtime.achievedTicksPerSecond)).toBe(true);
    expect(report.events).toEqual({});
    expect(report.ledger).toEqual({});
    expect(writtenReport).toEqual(report);
    const dayImage = await readFile(path.join(outputDirectory, "day-01.png"));
    const contactSheet = await readFile(path.join(outputDirectory, "contact-sheet.png"));
    for (const image of [dayImage, contactSheet]) {
      expect(image.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    }

    const decodedSheet = await loadImage(contactSheet);
    const sheetCanvas = createCanvas(decodedSheet.width, decodedSheet.height);
    const sheetContext = sheetCanvas.getContext("2d");
    sheetContext.drawImage(decodedSheet, 0, 0);
    const corner = sheetContext.getImageData(decodedSheet.width - 1, decodedSheet.height - 1, 1, 1).data;
    const color = PAPER_COLOR.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
    if (!color) throw new Error(`Unexpected Paper color: ${PAPER_COLOR}`);
    expect([...corner]).toEqual([
      Number.parseInt(color[1], 16),
      Number.parseInt(color[2], 16),
      Number.parseInt(color[3], 16),
      255,
    ]);
  });

  it("is deterministic across two CLI runs with the same seed", async () => {
    const firstOutput = path.join(determinismDirectory, "first");
    const secondOutput = path.join(determinismDirectory, "second");
    const args = ["--seed", "7", "--days", "1", "--out"];

    execFileSync(process.execPath, [tsxCli, jarScript, ...args, firstOutput], {
      cwd: projectRoot,
      stdio: "pipe",
      timeout: 120_000,
    });
    execFileSync(process.execPath, [tsxCli, jarScript, ...args, secondOutput], {
      cwd: projectRoot,
      stdio: "pipe",
      timeout: 120_000,
    });

    const firstReport = JSON.parse(
      await readFile(path.join(firstOutput, "report.json"), "utf8"),
    ) as Awaited<ReturnType<typeof runJar>>;
    const secondReport = JSON.parse(
      await readFile(path.join(secondOutput, "report.json"), "utf8"),
    ) as Awaited<ReturnType<typeof runJar>>;
    const {
      timing: _firstTiming,
      runtime: _firstRuntime,
      stateBufferHash: _firstHash,
      ...firstStableReport
    } = firstReport;
    const {
      timing: _secondTiming,
      runtime: _secondRuntime,
      stateBufferHash: _secondHash,
      ...secondStableReport
    } = secondReport;

    expect(firstStableReport).toEqual(secondStableReport);
    expect(firstReport.stateBufferHash).toMatch(/^[\da-f]{64}$/);
    expect(secondReport.stateBufferHash).toBe(firstReport.stateBufferHash);
  }, 30_000);
});
