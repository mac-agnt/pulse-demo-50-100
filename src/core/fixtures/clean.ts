/* Clean template: configuration defaults only. No people beyond the person
   setting it up, no records, no metrics with values, no client names. */

import { baseConfig } from "../config";
import type { CoreState } from "../types";

export function cleanState(): CoreState {
  const config = baseConfig();
  return {
    mode: "clean",
    config,
    seq: 1,
    data: {
      people: [{ id: "p-you", name: "You", email: "you@your-organisation.example", title: "Administrator", kind: "staff", status: "active" }],
      employment: [], leave: [],
      memberships: [],
      roleAssignments: [{ id: "ra-you", personId: "p-you", roleId: "admin", scope: { kind: "organisation" } }],
      delegations: [], records: [], relationships: [], files: [], tasks: [], requests: [], approvals: [],
      runs: [], schedules: [], issues: [], events: [], views: [], reportSchedules: [],
      projects: [], milestones: [], risks: [], projectUpdates: [], comments: [], companyUpdates: [], appointments: [],
      budgets: [], receivables: [], transactions: [], suppliers: [], orders: [], receipts: [], invoices: [],
      obligations: [], checkRuns: [], policyAcks: [], agentRuns: [],
      sync: [{ sourceId: "pulse", lastAttemptAt: null, lastSuccessAt: null, status: "ok", message: "Entered in Pulse" }]
    }
  };
}

export const CLEAN_DEFAULT_VIEWER = "p-you";
