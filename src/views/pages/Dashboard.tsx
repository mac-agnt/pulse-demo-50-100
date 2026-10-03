import { DashboardPage } from "../../ui/dashboard/DashboardPage";

type Props = { v: { dashArea?: string; setDashArea?: (id: string) => void } };

/* Dashboard below the core KPI band, in the original Pulse design: area header,
   metric cards, weekly chart, where it came from, comparison and exceptions,
   all from the metric engine. The area comes from the top bar page switcher
   (v.dashArea). See src/ui/dashboard. */
export default function Dashboard({ v }: Props) {
  return <DashboardPage areaId={v.dashArea} setArea={v.setDashArea} />;
}
