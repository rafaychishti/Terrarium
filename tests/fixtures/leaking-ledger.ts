import type { LedgerJar, LedgerSource } from "../../tools/ledger";
import type { LedgerTotals } from "../../src/shared/ledger";
import { ml } from "../../src/shared/units";

const initialTotals: LedgerTotals = { water: ml(12) };

const leakingLedger: LedgerSource = {
  totals: () => ({ water: ml(11.5) }),
  lastModule: "evaporation",
};

export const leakingJar: LedgerJar = {
  initialTotals,
  ledger: leakingLedger,
};
