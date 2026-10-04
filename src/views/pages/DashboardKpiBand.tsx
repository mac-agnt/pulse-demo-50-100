import KpiBackdrop from "./KpiBackdrop";
import { KpiBand, useReducedMotion } from "../../ui/dashboard/KpiBand";
import { areaOf } from "../../ui/dashboard/state";
import { useCore } from "../../core";

type Props = { v: { dashArea?: string; kpiBackdrop?: string; kpiBackdropOn?: boolean } };

/* The green core KPI band with the abstract backdrop (coloured by v.kpiBackdrop),
   driven by the metric engine. The area in the title follows v.dashArea, which
   the top bar page switcher sets. See src/ui/dashboard. */
export default function DashboardKpiBand({ v }: Props) {
  const still = useReducedMotion();
  const { core } = useCore();
  const area = areaOf(core, v.dashArea);
  return (
    <KpiBand area={v.dashArea === "reports" ? "Reports" : area ? area.label : "Dashboard"} backdropColor={v.kpiBackdrop}
      backdrop={v.kpiBackdropOn ? <KpiBackdrop v={v} still={still} /> : null} />
  );
}
