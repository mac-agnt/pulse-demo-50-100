/* Settings sections inside the five existing groups. The top bar, the
   navigator and the settings page all read this list. */

export type SettingsGroup = "ORGANISATION" | "CONTROL" | "SYSTEMS" | "GOVERNANCE" | "EXPERIENCE";

export interface SettingsSection { id: string; group: SettingsGroup; title: string; blurb: string }

export const SETTINGS_GROUPS: SettingsGroup[] = ["ORGANISATION", "CONTROL", "SYSTEMS", "GOVERNANCE", "EXPERIENCE"];

export const SETTINGS_SECTIONS: SettingsSection[] = [
  { id: "people", group: "ORGANISATION", title: "People & access", blurb: "Who is here, their status and team memberships." },
  { id: "structure", group: "ORGANISATION", title: "Teams & units", blurb: "Teams, optional units and who owns each." },
  { id: "roles", group: "ORGANISATION", title: "Roles & permissions", blurb: "Role definitions and who holds them, at what scope." },
  { id: "delegation", group: "ORGANISATION", title: "Ownership & delegation", blurb: "Delegated decision authority, with limits and expiry." },
  { id: "requestForms", group: "CONTROL", title: "Request forms", blurb: "Forms people use to raise requests, and what runs on approval." },
  { id: "approvals", group: "CONTROL", title: "Approval routing", blurb: "Stages, eligible roles, thresholds and self-approval rules." },
  { id: "workflows", group: "CONTROL", title: "Workflow templates", blurb: "Reusable steps, owners and triggers." },
  { id: "sla", group: "CONTROL", title: "Deadlines & escalation", blurb: "Service deadlines, business hours and escalation owners." },
  { id: "notifications", group: "CONTROL", title: "Notification routing", blurb: "Which events notify whom, and through which channel." },
  { id: "agents", group: "CONTROL", title: "Agent controls", blurb: "Agent purpose, responsible person, data scope and permitted actions." },
  { id: "connections", group: "SYSTEMS", title: "Connections & sync", blurb: "Connection status, sync health and recovery." },
  { id: "mappings", group: "SYSTEMS", title: "Field mapping & source of truth", blurb: "Which system owns each field, and code mappings." },
  { id: "recordTypes", group: "SYSTEMS", title: "Record types", blurb: "Record types, fields, validation and statuses." },
  { id: "metrics", group: "SYSTEMS", title: "Metric definitions", blurb: "How each dashboard figure is calculated." },
  { id: "access", group: "GOVERNANCE", title: "Access & audit policy", blurb: "Export rules, audit retention and permission summary." },
  { id: "documents", group: "GOVERNANCE", title: "Document governance", blurb: "Review cycles, restricted documents and use in answers." },
  { id: "audit", group: "GOVERNANCE", title: "Audit log", blurb: "Every configuration change, who made it and when." },
  { id: "terminology", group: "EXPERIENCE", title: "Terminology", blurb: "The words this organisation uses for units, teams, records and requests." },
  { id: "views", group: "EXPERIENCE", title: "Enabled views", blurb: "Which capabilities and tabs are switched on." },
  { id: "layouts", group: "EXPERIENCE", title: "Role defaults & dashboards", blurb: "Default Home view and dashboard for each role." },
  { id: "appearance", group: "EXPERIENCE", title: "Appearance & density", blurb: "Theme and display density." }
];
