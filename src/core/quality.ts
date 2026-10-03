/* Data-quality detection. Stored issues (duplicates, conflicts, unmapped
   codes, unmatched source rows) come from sync and agents; missing-field
   issues are derived from the record types' required fields every time, so
   filling a field resolves its issue without anyone closing it by hand. */

import type { CoreState, DataIssue, FieldValue, RecordItem } from "./types";

export const isEmpty = (v: FieldValue | undefined) => v === null || v === undefined || v === "";

export function missingFields(s: CoreState, r: RecordItem): string[] {
  const t = s.config.recordTypes.find((x) => x.id === r.typeId);
  if (!t) return [];
  return t.fields.filter((f) => f.required && isEmpty(r.fields[f.key])).map((f) => f.key);
}

export function derivedIssues(s: CoreState): DataIssue[] {
  const out: DataIssue[] = [];
  const stored = new Map(s.data.issues.map((i) => [i.id, i]));
  for (const r of s.data.records) {
    if (r.mergedInto) continue;
    for (const key of missingFields(s, r)) {
      // A stored issue already explains this gap (an unmapped code, for example).
      const explained = s.data.issues.some((i) => i.recordIds.includes(r.id) && i.field === key && i.kind !== "missing_field" && (i.state === "open" || i.state === "in_progress"));
      if (explained) continue;
      const id = "miss:" + r.id + ":" + key;
      const override = stored.get(id);
      const t = s.config.recordTypes.find((x) => x.id === r.typeId);
      const label = t?.fields.find((f) => f.key === key)?.label || key;
      const src = r.fieldMeta[key]?.sourceId;
      out.push({
        id, kind: "missing_field", severity: key === "reference" ? "high" : "medium",
        title: label + " is missing", recordIds: [r.id], field: key, ownerId: override?.ownerId || r.ownerId,
        state: override?.state === "dismissed" ? "dismissed" : override?.state === "in_progress" ? "in_progress" : "open",
        detectedAt: override?.detectedAt || r.updatedAt, sourceIds: [src || "pulse"], derived: true, resolution: override?.resolution
      });
    }
  }
  return out;
}

/** Every issue: stored ones (minus derived overrides) plus live missing-field issues. */
export function allIssues(s: CoreState): DataIssue[] {
  const stored = s.data.issues.filter((i) => !i.derived);
  return [...stored, ...derivedIssues(s)];
}

export const ISSUE_LABEL: Record<DataIssue["kind"], string> = {
  missing_field: "Missing field", duplicate: "Duplicate", unmapped_value: "Unmapped value",
  conflict: "Conflict", unmatched: "Unmatched source row"
};

export const ISSUE_PATH: Record<DataIssue["kind"], string> = {
  missing_field: "Fill the field on the record, or dismiss with a reason.",
  duplicate: "Compare both records, preview the merge, then merge or mark as distinct.",
  unmapped_value: "Map the source code to a configured value.",
  conflict: "Compare the values and their timestamps, then choose which one stands.",
  unmatched: "Link the source row to an existing record, or create a record from it."
};
