import type { LedgerTotals } from "../src/shared/ledger";

export const LEDGER_TOLERANCE = 1e-5;

export type LedgerResource = keyof LedgerTotals;

export interface LedgerError {
  readonly amount: number;
  readonly resource: LedgerResource | null;
  readonly module: string | null;
  readonly tick: number;
}

export interface LedgerDayTotals {
  readonly day: number;
  readonly totals: LedgerTotals;
}

export interface LedgerDiagnostic {
  readonly days: readonly LedgerDayTotals[];
  readonly largestPerTickError: LedgerError;
}

export interface LedgerSource {
  totals(): LedgerTotals;
  expectedTotals?(): LedgerTotals;
  readonly lastModule?: string;
}

export interface LedgerJar {
  readonly initialTotals: LedgerTotals;
  readonly ledger: LedgerSource;
}

const RESOURCES: readonly LedgerResource[] = ["water", "carbon", "nutrients"];

export function findLargestLedgerError(
  initial: LedgerTotals,
  current: LedgerTotals,
  tick: number,
  module: string | null,
): LedgerError {
  let largest: LedgerError = {
    amount: 0,
    resource: null,
    module: null,
    tick,
  };
  for (const resource of RESOURCES) {
    const initialAmount = initial[resource] ?? 0;
    const currentAmount = current[resource] ?? 0;
    const amount = Math.abs(currentAmount - initialAmount);
    if (!Number.isFinite(amount)) {
      throw new RangeError(`Ledger total for ${resource} is not finite`);
    }
    if (amount > largest.amount) {
      largest = { amount, resource, module, tick };
    }
  }
  return largest;
}

export function assertLedgerBalanced(
  error: LedgerError,
  tolerance = LEDGER_TOLERANCE,
): void {
  if (error.amount > tolerance) {
    const module = error.module ?? "unknown module";
    throw new Error(
      `[ledger] ${module} leaked ${error.resource ?? "material"}: ` +
        `${error.amount} at tick ${error.tick} (tolerance ${tolerance})`,
    );
  }
}

export function expectBalanced(
  jar: LedgerJar,
  tolerance = LEDGER_TOLERANCE,
): void {
  const error = findLargestLedgerError(
    jar.initialTotals,
    jar.ledger.totals(),
    0,
    jar.ledger.lastModule ?? null,
  );
  assertLedgerBalanced(error, tolerance);
}
