import { describe, expect, it } from "vitest";
import { cos, exp, log, pow, sin, sqrt } from "../../src/shared/dmath";

describe("deterministic math", () => {
  it("approximates the common elementary functions accurately", () => {
    for (const value of [-6, -2, -0.5, 0, 0.5, 2, 6]) {
      expect(Math.abs(sin(value) - Math.sin(value))).toBeLessThan(1e-11);
      expect(Math.abs(cos(value) - Math.cos(value))).toBeLessThan(1e-11);
    }
    for (const value of [-10, -1, 0, 1, 10]) {
      expect(Math.abs(exp(value) - Math.exp(value))).toBeLessThan(1e-10);
    }
    for (const value of [0.01, 0.5, 1, 2, 100]) {
      expect(Math.abs(log(value) - Math.log(value))).toBeLessThan(1e-11);
    }
  });

  it("covers powers and delegates square root", () => {
    expect(pow(2, 3)).toBeCloseTo(8, 10);
    expect(pow(-2, 3)).toBeCloseTo(-8, 10);
    expect(pow(-2, 0.5)).toBeNaN();
    expect(sqrt(9)).toBe(3);
  });
});
