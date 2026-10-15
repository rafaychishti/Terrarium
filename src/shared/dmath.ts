const PI = 3.141592653589793;
const HALF_PI = 1.5707963267948966;
const TAU = 6.283185307179586;
const LN2 = 0.6931471805599453;

function reduceAngle(value: number): number {
  return value - Math.floor((value + PI) / TAU) * TAU;
}

export function sin(value: number): number {
  let x = reduceAngle(value);
  if (x > HALF_PI) x = PI - x;
  else if (x < -HALF_PI) x = -PI - x;

  const square = x * x;
  return (
    x *
    (1 +
      square *
        (-1 / 6 +
          square *
            (1 / 120 +
              square *
                (-1 / 5040 +
                  square *
                    (1 / 362880 +
                      square *
                        (-1 / 39916800 +
                          square * (1 / 6227020800 +
                            square * (-1 / 1307674368000))))))))
  );
}

export function cos(value: number): number {
  let x = reduceAngle(value);
  let sign = 1;
  if (x > HALF_PI) {
    x = PI - x;
    sign = -1;
  } else if (x < -HALF_PI) {
    x = -PI - x;
    sign = -1;
  }

  const square = x * x;
  return (
    sign *
    (1 +
      square *
        (-1 / 2 +
          square *
            (1 / 24 +
              square *
                (-1 / 720 +
                  square *
                    (1 / 40320 +
                      square *
                        (-1 / 3628800 +
                          square * (1 / 479001600 +
                            square * (-1 / 87178291200))))))))
  );
}

export function exp(value: number): number {
  if (Number.isNaN(value)) return Number.NaN;
  if (value > 709.782712893384) return Number.POSITIVE_INFINITY;
  if (value < -745.1332191019411) return 0;

  const exponent = Math.floor(value / LN2 + 0.5);
  const x = value - exponent * LN2;
  let term = 1;
  let sum = 1;
  for (let order = 1; order <= 14; order += 1) {
    term = (term * x) / order;
    sum += term;
  }
  return sum * 2 ** exponent;
}

export function log(value: number): number {
  if (Number.isNaN(value) || value < 0) return Number.NaN;
  if (value === 0) return Number.NEGATIVE_INFINITY;
  if (value === Number.POSITIVE_INFINITY) return Number.POSITIVE_INFINITY;

  let mantissa = value;
  let exponent = 0;
  while (mantissa >= 1.4142135623730951) {
    mantissa *= 0.5;
    exponent += 1;
  }
  while (mantissa < 0.7071067811865476) {
    mantissa *= 2;
    exponent -= 1;
  }

  const ratio = (mantissa - 1) / (mantissa + 1);
  const square = ratio * ratio;
  let term = ratio;
  let sum = term;
  for (let denominator = 3; denominator <= 29; denominator += 2) {
    term *= square;
    sum += term / denominator;
  }
  return 2 * sum + exponent * LN2;
}

export function pow(base: number, exponent: number): number {
  if (exponent === 0) return 1;
  if (base === 0) {
    return exponent < 0 ? Number.POSITIVE_INFINITY : 0;
  }
  if (base < 0) {
    if (!Number.isInteger(exponent)) return Number.NaN;
    const magnitude = exp(exponent * log(-base));
    return Math.abs(exponent % 2) === 1 ? -magnitude : magnitude;
  }
  return exp(exponent * log(base));
}

export function sqrt(value: number): number {
  return Math.sqrt(value);
}
