/* Records > Files. Rendered from the shared core (src/ui/records/FilesView). */
import FilesView from "../../ui/records/FilesView";

type Props = { v: any };

export default function RecordsFiles({ v }: Props) {
  return <FilesView v={v} />;
}
