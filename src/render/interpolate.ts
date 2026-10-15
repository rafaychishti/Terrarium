import type { StateView } from "../shared/layout";

const FLOAT_FIELDS = [
  "water",
  "temperature",
  "co2",
  "oxygen",
  "nutrients",
  "microbes",
  "light",
] as const;

export const MATERIAL_SWITCH_ALPHA = 0.5;

export function interpolateState(
  previous: StateView,
  current: StateView,
  alpha: number,
  output: StateView,
): void {
  if (!Number.isFinite(alpha)) {
    throw new RangeError("Interpolation alpha must be finite");
  }

  const amount = Math.min(1, Math.max(0, alpha));
  const cells = previous.materials.length;
  if (
    current.materials.length !== cells
    || output.materials.length !== cells
    || FLOAT_FIELDS.some((field) =>
      previous[field].length !== cells
      || current[field].length !== cells
      || output[field].length !== cells
    )
  ) {
    throw new RangeError("Interpolated states must have matching field lengths");
  }

  output.materials.set(amount < MATERIAL_SWITCH_ALPHA ? previous.materials : current.materials);
  for (const field of FLOAT_FIELDS) {
    const from = previous[field];
    const to = current[field];
    const result = output[field];
    for (let i = 0; i < cells; i += 1) {
      result[i] = (from[i] ?? 0) + ((to[i] ?? 0) - (from[i] ?? 0)) * amount;
    }
  }
}
