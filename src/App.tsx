import { LogicHost } from "./runtime/logic";
import PulseLogic from "./logic/PulseLogic";
import AppShell from "./views/AppShell";

/* ── Backgrounds: change these per client ──────────────────────────────────
   Any CSS colour works (#hex, rgb(), oklch()). One colour each; the shading
   is worked out for you. */
const config = {
  /** Abstract background behind the Dashboard's KPI band. Hidden in the light theme. */
  dashboardBackdrop: "#5f8f63",
  /** Show the Dashboard background at all. */
  kpiBackdropOn: true,
  /** Wash behind the Records hero (Files and Contacts) and the New record dialog.
      Leave as "" to use the current theme's own gradient. */
  recordsBackdrop: "",
};

export default function App() {
  return <LogicHost logic={PulseLogic} view={AppShell} props={config} />;
}
