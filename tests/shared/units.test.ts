import { describe, expect, it } from "vitest";
import {
  centimetresToMillimetres,
  kilogramsToGrams,
  litresToMillilitres,
} from "../../src/shared/units";

describe("unit conversions", () => {
  it("converts at the edges without changing the base units", () => {
    expect(centimetresToMillimetres(2.5)).toBe(25);
    expect(litresToMillilitres(0.75)).toBe(750);
    expect(kilogramsToGrams(1.25)).toBe(1250);
  });
});
