/* Opens the reusable unit profile (src/ui/units/UnitProfile.tsx: Overview /
   Performance / Work / Projects / People / Files / Activity) from a
   comparison row. Every number in the row itself opens the metric panel. */

import type { MetricDef } from "../../core";
import { UnitProfilePanel } from "../units/UnitProfile";
import type { CompRow } from "./Comparison";

export function UnitProfileHost({ row, onClose }: { row: CompRow | null; defs?: MetricDef[]; onClose: () => void }) {
  if (!row || (row.scope.kind !== "unit" && row.scope.kind !== "team")) return null;
  return <UnitProfilePanel key={row.key} target={{ kind: row.scope.kind, id: row.scope.id }} onClose={onClose} />;
}
