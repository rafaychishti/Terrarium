import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function sourceFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...sourceFiles(path));
    else if (entry.isFile() && entry.name.endsWith(".ts")) files.push(path);
  }
  return files;
}

describe("simulation determinism rules", () => {
  it("does not use unseeded randomness or wall-clock time", () => {
    const simDirectory = join(
      fileURLToPath(new URL("../..", import.meta.url)),
      "src",
      "sim",
    );
    const forbidden = /\b(?:Math\.random|Date\.now|performance\.now)\b/;
    const violations = sourceFiles(simDirectory).filter((path) =>
      forbidden.test(readFileSync(path, "utf8")),
    );

    expect(violations).toEqual([]);
  });
});
