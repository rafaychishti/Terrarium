import type { Grams, Millilitres } from "./units";

export interface LedgerTotals {
  readonly water: Millilitres;
  readonly carbon?: Grams;
  readonly nutrients?: Grams;
}

export interface Ledger {
  totals(): LedgerTotals;
}
