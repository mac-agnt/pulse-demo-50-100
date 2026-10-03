/* Records area wrapper. Draws the original Records wash (the theme's
   --hero-grad, or the colour set in App.tsx) behind the hero of every
   non-ontology tab. Each tab (Files, Contacts, Browse, Data quality) renders
   its own hero and search from src/ui/records, because the search drives the
   list on that tab. Ontology keeps its own layout. */

import "../../styles/records.css";

type Props = { v: { recSectionId?: string } };

export default function Records({ v }: Props) {
  if (!v.recSectionId || v.recSectionId === "ontology") return null;
  return (
    <div className="rh-wash-anchor" aria-hidden="true">
      <div className="rh-wash" />
    </div>
  );
}
