/* Records area wrapper. On Browse, Contacts, Files and Data quality it draws
   the original Records wash behind the page. On Relationships (the last tab)
   it adds the contextual strip above the illustrative graph: the record you
   came from and its actual relationships, so exploration stays tied to a
   selected record. The graph itself (RecordsOntology.tsx) is unchanged. */

import { useEffect, useSyncExternalStore } from "react";
import { useCore, store, openObject } from "../../core";
import "../../styles/records.css";

type Props = { v: { recSectionId?: string } };

/* The record Relationships was opened for. Kept outside React so it survives tab switches. */
let focused: string | null = null;
const subs = new Set<() => void>();
const setFocused = (id: string | null) => { focused = id; subs.forEach((f) => f()); };
const useFocused = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => focused, () => focused);

export default function Records({ v }: Props) {
  const rel = v.recSectionId === "relationships" || v.recSectionId === "ontology";
  if (!v.recSectionId) return null;
  if (rel) return <RelationshipFocus />;
  return (
    <div className="rh-wash-anchor" aria-hidden="true">
      <div className="rh-wash" />
    </div>
  );
}

function RelationshipFocus() {
  const { q, session } = useCore();
  const id = useFocused();
  useEffect(() => {
    const f = session.focus;
    if (f && f.kind === "record" && f.id) { setFocused(f.id); store.setSession({ focus: null }); }
  }, [session.focus]);
  const r = id ? q.record(id) : undefined;
  const related = r ? q.related(r.id) : [];
  return (
    <div className="rh-focus" role="note">
      {r ? (
        <>
          <span><b style={{ fontWeight: 500, color: "var(--ink)" }}>{r.ref} {r.title}</b>: {related.length ? related.length + " recorded relationship" + (related.length === 1 ? "" : "s") : "no recorded relationships"}</span>
          {related.slice(0, 6).map((x) => (
            <button key={x.record.id + x.direction} type="button" className="rh-qchip" onClick={() => openObject("record", x.record.id)}
              title={x.direction === "out" ? r.ref + " " + x.label + " " + x.record.ref : x.record.ref + " " + x.label + " " + r.ref}>
              {(x.direction === "out" ? x.label + " " : "") + x.record.ref + (x.direction === "in" ? " " + x.label + " this" : "")}
            </button>
          ))}
          <button type="button" className="pf-btn pf-btn--sm" onClick={() => openObject("record", r.id)}>Open {r.ref}</button>
          <button type="button" className="pf-btn pf-btn--sm" onClick={() => setFocused(null)}>Clear</button>
        </>
      ) : (
        <span>Open a record and choose Explore relationships to see its actual links here.</span>
      )}
      <span className="pk-faint" style={{ marginLeft: "auto", fontSize: 12 }}>The graph below is illustrative: it shows the kinds of entities and links, not this organisation's records.</span>
    </div>
  );
}
