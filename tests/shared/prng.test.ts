import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { createRandom } from "../../src/shared/prng";

describe("seeded random numbers", () => {
  it("matches the checked-in 1,000-value sequence", async () => {
    const expected = JSON.parse(
      await readFile(new URL("../fixtures/prng-vector.json", import.meta.url), "utf8"),
    ) as number[];
    const random = createRandom(0x12345678);
    const actual = Array.from({ length: 1000 }, () => random.next());

    expect(actual).toEqual(expected);
  });

  it("forks a stable stream without consuming the parent", () => {
    const random = createRandom(42);
    const first = random.fork("plants");
    random.next();
    const second = random.fork("plants");

    expect(Array.from({ length: 8 }, () => first.next())).toEqual(
      Array.from({ length: 8 }, () => second.next()),
    );
  });

  it("returns values in the requested ranges", () => {
    const random = createRandom("terrarium");
    expect(random.int(1)).toBe(0);
    for (let index = 0; index < 100; index += 1) {
      const value = random.int(7);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(7);
    }
    expect(random.float()).toBeGreaterThanOrEqual(0);
    expect(random.float()).toBeLessThan(1);
  });

  it("rejects invalid bounds and unsafe seeds", () => {
    expect(() => createRandom(1).int(0)).toThrow(RangeError);
    expect(() => createRandom(Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError);
  });
});
