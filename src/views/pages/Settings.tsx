import SettingsPage, { type SettingsV } from "../../ui/settings/SettingsPage";

type Props = { v: any };

/* Settings, driven by the shared core configuration (src/ui/settings). The
   shell's top bar supplies the group filter and the open section. */
export default function Settings({ v }: Props) {
  const sv: SettingsV = {
    adminGroupSel: v?.adminGroupSel ?? null,
    adminOpenId: v?.adminOpenId ?? null,
    setAdminOpen: v?.setAdminOpen,
    appearance: v?.appearance
  };
  return <SettingsPage v={sv} />;
}
