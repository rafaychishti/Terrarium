import { execFileSync } from "node:child_process";
import { readdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { parseJarArguments, runJar } from "../../tools/jar";

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
    expect(report.ticks).toBe(60 * 60 * 24 * 60);
    expect(report.timing.perTickMs).toBeGreaterThanOrEqual(0);
    expect(report.events).toEqual({});
    expect(report.ledger).toEqual({});
    expect(writtenReport).toEqual(report);
    for (const imageName of ["day-01.png", "contact-sheet.png"]) {
      const image = await readFile(path.join(outputDirectory, imageName));
      expect(image.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    }
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
    const { timing: _firstTiming, stateBufferHash: _firstHash, ...firstStableReport } =
      firstReport;
    const { timing: _secondTiming, stateBufferHash: _secondHash, ...secondStableReport } =
      secondReport;

    expect(firstStableReport).toEqual(secondStableReport);
    expect(firstReport.stateBufferHash).toMatch(/^[\da-f]{64}$/);
    expect(secondReport.stateBufferHash).toBe(firstReport.stateBufferHash);
  }, 30_000);
});
