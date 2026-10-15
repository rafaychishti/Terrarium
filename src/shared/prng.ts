export type Seed = number | string;

const UINT32_RANGE = 0x1_0000_0000;

function hashText(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193);
  }
  return hash >>> 0;
}

function normalizeSeed(seed: Seed): number {
  if (typeof seed === "string") return hashText(seed);
  if (!Number.isSafeInteger(seed)) {
    throw new RangeError("A numeric seed must be a safe integer");
  }
  return seed >>> 0;
}

export class SeededRandom {
  private state: number;

  constructor(private readonly rootSeed: Seed) {
    this.state = normalizeSeed(rootSeed);
  }

  next(): number {
    this.state = (this.state + 0x9e3779b9) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
    value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
    return (value ^ (value >>> 15)) >>> 0;
  }

  float(): number {
    return this.next() / UINT32_RANGE;
  }

  int(maxExclusive: number): number {
    if (
      !Number.isInteger(maxExclusive) ||
      maxExclusive < 1 ||
      maxExclusive > UINT32_RANGE
    ) {
      throw new RangeError("maxExclusive must be an integer from 1 to 2^32");
    }

    const limit = UINT32_RANGE - (UINT32_RANGE % maxExclusive);
    let value = this.next();
    while (value >= limit) value = this.next();
    return value % maxExclusive;
  }

  fork(label: string): SeededRandom {
    const seed = normalizeSeed(this.rootSeed);
    return new SeededRandom((hashText(label) ^ seed) >>> 0);
  }
}

export function createRandom(seed: Seed): SeededRandom {
  return new SeededRandom(seed);
}
