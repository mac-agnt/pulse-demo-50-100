/* Demo data and pure helpers for the Pulse prototype (Kilbride Group). */

const INK="var(--ink)", BODY="var(--body)", DIM="var(--dim)", FAINT="var(--faint)";
const LIME="var(--accent)", GREEN="var(--ok)", AMBER="var(--warn)", RED="var(--bad)", NEUTRAL="var(--neutral)";
const MONO="var(--mono)";

const ICONS = {
  navHome:"M12 3.2 3.6 9.1v10a1.5 1.5 0 0 0 1.5 1.5h13.8a1.5 1.5 0 0 0 1.5-1.5v-10L12 3.2Z M8.9 13.1h2l1-2.6 1.5 5 1.1-2.4h1.6",
  navAgents:"M12 2.4v2.3 M12 2.4a.9.9 0 1 0 0-.02 M8.2 6.5h7.6A2.2 2.2 0 0 1 18 8.7v5.1a2.2 2.2 0 0 1-2.2 2.2H8.2A2.2 2.2 0 0 1 6 13.8V8.7a2.2 2.2 0 0 1 2.2-2.2Z M9.9 10.6v1.4 M14.1 10.6v1.4 M6 10h-1.9 M18 10h1.9 M9.2 18.6h5.6 M9.2 21.2h5.6",
  navDash:"M4 5.6h7.2v5.1H4V5.6Z M13.6 5.6H20v8.6h-6.4V5.6Z M4 13.1h7.2v5.3H4v-5.3Z M13.6 16.6H20v1.8h-6.4v-1.8Z",
  navWork:"M9.4 4.4h5.2a1.4 1.4 0 0 1 1.4 1.4v1.1h2.4A1.6 1.6 0 0 1 20 8.5v9.1a1.6 1.6 0 0 1-1.6 1.6H5.6A1.6 1.6 0 0 1 4 17.6V8.5a1.6 1.6 0 0 1 1.6-1.6H8V5.8a1.4 1.4 0 0 1 1.4-1.4Z M8 6.9h8 M9.6 13.3l1.8 1.8 3.4-3.6",
  navRecords:"M12 3.6c3.9 0 7 1.1 7 2.5S15.9 8.6 12 8.6 5 7.5 5 6.1 8.1 3.6 12 3.6Z M5 6.1v5.7c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6.1 M5 11.8v5.7c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-5.7",
  navActivity:"M4.6 4.6h14.8A1.6 1.6 0 0 1 21 6.2v11.6a1.6 1.6 0 0 1-1.6 1.6H4.6A1.6 1.6 0 0 1 3 17.8V6.2a1.6 1.6 0 0 1 1.6-1.6Z M6 12.4h2.2l1.5-4.1 2.3 8 1.9-5.4 1.2 1.5H18",
  navAdmin:"M12 2.9 5 5.6v5.9c0 4 2.8 7.1 7 8.6 4.2-1.5 7-4.6 7-8.6V5.6L12 2.9Z M12 8.6a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z M8.8 16.3a3.6 3.6 0 0 1 6.4 0",
  helios:"M21 11.5a8.4 8.4 0 0 1-9 8.4 9.9 9.9 0 0 1-4-.8L3 21l1.9-4.9A8.3 8.3 0 0 1 4 11.5 8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5Z M8 12h1.6l1.2-2.6 1.6 5 1.4-2.4H16",
  inbox:"M3 13h4l1.5 3h7l1.5-3h4 M3 13l2.4-7A2 2 0 0 1 7.3 4.6h9.4a2 2 0 0 1 1.9 1.4L21 13v4.4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V13Z",
  work:"M6 4.6h12a1.6 1.6 0 0 1 1.6 1.6v12.2A1.6 1.6 0 0 1 18 20H6a1.6 1.6 0 0 1-1.6-1.6V6.2A1.6 1.6 0 0 1 6 4.6Z M8.4 10.4l1.9 1.9 3.9-3.9 M8.4 15.6h7.2",
  approvals:"M12 3.6 19.5 6v6.1c0 4-3.1 6.9-7.5 8.3-4.4-1.4-7.5-4.3-7.5-8.3V6L12 3.6Z M9.2 12.2l2 2 3.6-3.7",
  insights:"M4.5 19.5V13 M9.7 19.5V7.5 M14.9 19.5v-8 M20 19.5V5",
  people:"M12 12.5a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2Z M5 20.2c.9-3.1 3.6-4.9 7-4.9s6.1 1.8 7 4.9",
  orgs:"M4.5 20V6.4A1.4 1.4 0 0 1 5.9 5h6.2a1.4 1.4 0 0 1 1.4 1.4V20 M13.5 10.5h4.6A1.4 1.4 0 0 1 19.5 12v8 M3 20h18 M7.5 8.5h2.5 M7.5 12h2.5 M7.5 15.5h2.5",
  teams:"M9 12a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 9 12Z M16.5 12.5a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2Z M2.6 19.6c.8-2.8 3.2-4.4 6.4-4.4s5.6 1.6 6.4 4.4 M17 15.4c2.2.4 3.7 1.8 4.3 4.2",
  locations:"M12 21s6.5-5.6 6.5-11a6.5 6.5 0 1 0-13 0C5.5 15.4 12 21 12 21Z M12 12.8a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2Z",
  visits:"M8 4v3 M16 4v3 M4.5 9.5h15 M6.4 6h11.2A1.9 1.9 0 0 1 19.5 8v10a1.9 1.9 0 0 1-1.9 1.9H6.4A1.9 1.9 0 0 1 4.5 18V8A1.9 1.9 0 0 1 6.4 6Z M9 13.5l1.6 1.6 3.4-3.4",
  autos:"M18.5 8.5A5 5 0 0 0 8.9 7.3 3.8 3.8 0 0 0 6 14.6 M8 17.5l3.2 3.2 M11.2 20.7l3.2-3.2 M11.2 20.7V9.6",
  health:"M3 12.5h3.4l2-5 3 10 2.2-5H21",
  modules:"M6.6 4.4h10.8a2.2 2.2 0 0 1 2.2 2.2v10.8a2.2 2.2 0 0 1-2.2 2.2H6.6a2.2 2.2 0 0 1-2.2-2.2V6.6a2.2 2.2 0 0 1 2.2-2.2Z M4.4 9.6h15.2 M9.6 19.6V9.6",
  agents:"M8.5 3.6h7A2.4 2.4 0 0 1 17.9 6v5.6a2.4 2.4 0 0 1-2.4 2.4h-7A2.4 2.4 0 0 1 6.1 11.6V6a2.4 2.4 0 0 1 2.4-2.4Z M9.6 8.2h.01 M14.4 8.2h.01 M12 14v2.6 M7.6 20.4h8.8 M12 16.6c-2.4 0-4.4 1.7-4.4 3.8h8.8c0-2.1-2-3.8-4.4-3.8Z",
  dash:"M4.4 4.4h6v6h-6v-6Z M13.6 4.4h6v3.6h-6V4.4Z M13.6 11.6h6v8h-6v-8Z M4.4 14h6v5.6h-6V14Z",
  files:"M5 7.2a1.8 1.8 0 0 1 1.8-1.8h3l1.8 2.2h5.6A1.8 1.8 0 0 1 19 9.4v7.4a1.8 1.8 0 0 1-1.8 1.8H6.8A1.8 1.8 0 0 1 5 16.8V7.2Z",
  pulseLine:"M2.5 12.5h3.6l2.1-6.4 3.2 12.2 2.6-8.4 1.8 2.6h5.7",
  records:"M6.4 3.6h7.4l4.2 4.2v12.6H6.4V3.6Z M13.4 3.8v4.2h4.2 M9 12.4h6 M9 16h4",
  tree:"M4.5 6h5 M4.5 12h5 M4.5 18h5 M12.5 6h7 M12.5 12h7 M12.5 18h7",
  graph:"M7 7.4a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8Z M17.6 10.4a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8Z M9.4 21.4a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8Z M8.6 6.4l7.6 2.6 M15.8 11.4l-5.6 5.2",
  bell:"M6 8.5a6 6 0 0 1 12 0c0 6.5 2.6 8.5 2.6 8.5H3.4S6 15 6 8.5Z M10.3 20.5a1.94 1.94 0 0 0 3.4 0"
};

/* Ontology stays first and is never removed (PulseLogic enforces this too). */
const REC_SECTIONS = [
  {id:"ontology", label:"Ontology", blurb:"How every record connects: entities, predicates and the paths between them."},
  {id:"files", label:"Files", blurb:"Documents, contracts and certificates — indexed where Helios can read them."},
  {id:"contacts", label:"Contacts", blurb:"Every person the business deals with, staff and external."}
];

const CONTACTS = [
  ["Aoife Nolan","Accounts manager","aoife@kilbridegroup.ie","Kilbride Group","staff","var(--accent)"],
  ["Séamus Byrne","Senior installer","seamus@kilbridegroup.ie","Kilbride Group","staff","#9fd6f0"],
  ["Tom Walsh","Operations lead","tom@kilbridegroup.ie","Kilbride Group","staff","#e6c78a"],
  ["Niamh Cronin","Trade counter","niamh@kilbridegroup.ie","Kilbride Group","staff","#c8b4f0"],
  ["Dermot Casey","Buyer","dermot@caseybuilders.ie","Casey Builders","customer","#9fd6f0"],
  ["Liam Dunne","Owner","liam@dunneandsons.ie","Dunne & Sons Ltd","on stop","#e2a08c"],
  ["Máire Fitzgerald","Director","maire@fitzheating.ie","Fitzgerald Heating","watch","#e6c78a"],
  ["Paul Ó Riain","Site foreman","paul@oriain.ie","Ó Riain, Glanmire","customer","#a8e0c0"],
  ["Cathal Moore","Account manager","cathal@munsterplumbing.ie","Munster Plumbing","supplier","#c8b4f0"]
];

const FILE_TREE = [
  {type:"folder", id:"f-org", name:"Organisations", depth:0},
  {type:"file", id:"fl-1", name:"Casey Builders — framework 2026.pdf", depth:1, parent:"f-org", indexed:true,
   path:"Organisations / Casey Builders", title:"Casey Builders — framework 2026",
   facts:[["TYPE","PDF · 6 pages"],["ADDED","12 Jan 2026"],["INDEXED","All 6 pages"],["OWNER","Aoife Nolan"]],
   body:["The framework sets the discount tiers for 2026 and the payment terms Casey Builders trade on. Tier two applies from €40k of annual spend, which they passed in August.",
     "Pricing is fixed to the June supplier agreement, so a change on the Munster side flows through here rather than being renegotiated separately.",
     "Termination requires sixty days' notice on either side. Nothing in the document blocks putting the account on stop for non-payment."],
   links:[["Casey Builders","org"],["Dermot Casey","person"],["PO-4471","order"]]},
  {type:"file", id:"fl-2", name:"Dunne & Sons — credit application.pdf", depth:1, parent:"f-org", indexed:true,
   path:"Organisations / Dunne & Sons Ltd", title:"Dunne & Sons — credit application",
   facts:[["TYPE","PDF · 4 pages"],["ADDED","3 Mar 2011"],["INDEXED","All 4 pages"],["OWNER","Aoife Nolan"]],
   body:["The original 2011 application, signed by Liam Dunne, setting a €20,000 limit against thirty-day terms.",
     "Days-to-pay ran at twelve for most of that period and moved to seventy-four after May 2026, which is what put the account on stop.",
     "The personal guarantee in section four is still in force and has never been called on."],
   links:[["Dunne & Sons Ltd","org"],["Liam Dunne","person"],["INV-10428","invoice"]]},
  {type:"folder", id:"f-cert", name:"Certificates", depth:0},
  {type:"file", id:"fl-3", name:"Séamus Byrne — gas safe 2026.pdf", depth:1, parent:"f-cert", indexed:true,
   path:"Certificates / Installers", title:"Séamus Byrne — gas safe 2026",
   facts:[["TYPE","PDF · 2 pages"],["EXPIRES","14 Nov 2026"],["INDEXED","Both pages"],["OWNER","Operations"]],
   body:["Registration covers domestic boilers and commercial water heaters, valid to 14 November 2026.",
     "The renewal reminder fires sixty days before expiry. That routine failed twice this week because Mallow yard has no contact on file."],
   links:[["Séamus Byrne","person"],["Certificate renewal reminder","workflow"]]},
  {type:"file", id:"fl-4", name:"Public liability — 2026.pdf", depth:1, parent:"f-cert", indexed:false,
   path:"Certificates / Insurance", title:"Public liability — 2026",
   facts:[["TYPE","PDF · 12 pages"],["EXPIRES","1 Apr 2027"],["INDEXED","Not indexed"],["OWNER","Operations"]],
   body:["Cover to €6.5m across all three locations. Not indexed, so Helios cannot answer questions from it yet.",
     "Indexing it would let the site-visits module check cover before a job is booked at a new address."],
   links:[["Head office","location"],["Ballincollig depot","location"]]},
  {type:"folder", id:"f-fin", name:"Finance", depth:0},
  {type:"file", id:"fl-5", name:"INV-10428.pdf", depth:1, parent:"f-fin", indexed:true,
   path:"Finance / Invoices", title:"INV-10428",
   facts:[["TYPE","PDF · 1 page"],["VALUE","€28,410"],["AGE","74 days"],["OWNER","Aoife Nolan"]],
   body:["The oldest unpaid invoice on the ledger and the reason Dunne & Sons is on stop.",
     "Two reminders have gone out. The third is drafted and waiting on the finance manager inside the chase workflow."],
   links:[["Dunne & Sons Ltd","org"],["Chase unpaid invoices","workflow"]]},
  {type:"file", id:"fl-6", name:"Month-end close — August.xlsx", depth:1, parent:"f-fin", indexed:false,
   path:"Finance / Close", title:"Month-end close — August",
   facts:[["TYPE","XLSX · 9 sheets"],["ADDED","1 Sep 2026"],["INDEXED","Not indexed"],["OWNER","Aoife Nolan"]],
   body:["The working file behind the August close. Cash collected came in at €368k against €358k in July.",
     "Spreadsheets are stored but not indexed by default — the numbers Helios quotes come from the ledger, not from here."],
   links:[["Finance","area"],["Month-end close","workflow"]]}
];

const ONTO_NODES = [
  ["Organisation","entity",500,300,1,"Customers and suppliers. Balances arrive from the ledger through the record spine."],
  ["Person","entity",300,190,1,"One entity for staff and external contacts, scoped by role rather than split in two."],
  ["Location","entity",700,190,1,"Multi-branch as a business concept: locations plus the location permission scope."],
  ["Team","entity",250,430,1,"Teams are records, so the team scope on a grant resolves against them."],
  ["Task","entity",690,430,1,"Work, whatever it is attached to. Queues are one permission-filtered query."],
  ["Approval","entity",850,320,0,"A request and its steps. Each decision is written as the person who made it."],
  ["Invoice","ledger",390,95,0,"Read through the spine — the wholesale ledger stays the source of truth."],
  ["Order","ledger",620,95,0,"Purchase and sales orders, linked to the organisation that raised them."],
  ["Visit","module",860,470,0,"Contributed by site-visits, with its own table, predicate and tools."],
  ["File","entity",140,300,0,"Documents against any record. Indexed pages are what Helios can read."],
  ["works at","predicate",395,240,0,"Person → Organisation."],
  ["located at","predicate",605,240,0,"Organisation → Location."],
  ["member of","predicate",360,370,0,"Person → Team."],
  ["relates to","predicate",600,370,0,"Task → anything."],
  ["attached to","predicate",140,372,0,"File → anything."]
];

const ONTO_EDGES = [
  [500,300,300,190],[500,300,700,190],[500,300,250,430],[500,300,690,430],
  [500,300,850,320],[500,300,390,95],[500,300,620,95],[500,300,140,300],
  [300,190,250,430],[700,190,860,470],[690,430,850,320],[690,430,860,470],
  [300,190,140,300],[390,95,620,95]
];

const REC_TEMPLATES = [
  ["Field sheet","Records","Labelled fields in a grid — the default for a person, organisation or location.",
   "M5 5.5h14v13H5v-13Z M5 10h14 M12 10v8.5","grid"],
  ["Contact card","Records","A portrait, key fields and every linked record in one compact panel.",
   "M12 11.5a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8Z M5.5 19c.8-3 3.3-4.7 6.5-4.7s5.7 1.7 6.5 4.7","card"],
  ["Directory","Records","A sortable table of many records at once, built for lists.",
   "M4.5 6.5h15 M4.5 12h15 M4.5 17.5h15 M4.5 6.5h.01 M4.5 12h.01 M4.5 17.5h.01","rows"],
  ["Timeline","Case work","Ordered events with who did what and when. Good for a case or a claim.",
   "M12 3.5v17 M12 7.5h6 M12 13h-6 M12 18h6","timeline"],
  ["Kanban board","Case work","Cards in columns by status. For anything that moves through stages.",
   "M5 5h4.5v14H5V5Z M9.75 5h4.5v9h-4.5V5Z M14.5 5H19v6h-4.5V5Z","kanban"],
  ["Checklist","Case work","Ticked steps in order, with an owner and a due date on each.",
   "M5 6.5h2l1.4 1.4L11 5.5 M5 12.5h2l1.4 1.4 2.6-2.4 M5 18.5h2l1.4 1.4 2.6-2.4 M15 6.5h4 M15 12.5h4 M15 18.5h4","checklist"],
  ["Ledger","Finance","Rows and running totals. For anything with amounts and dates.",
   "M4 6h16 M4 12h16 M4 18h16 M9 3.5v17","ledger"],
  ["Invoice","Finance","Line items, totals and a status — built to be sent, not just stored.",
   "M7 3.5h10v17H7v-17Z M9.5 8h5 M9.5 11.5h5 M9.5 15h3","invoice"],
  ["Document","Notes","Long-form text with linked records pulled out down the side.",
   "M7 3.5h7l5 5v12H7v-17Z M14 3.7v5h5 M10 13h6 M10 16.5h4","document"],
  ["Gallery","Notes","A wall of images and files with a caption on each — for a site or a job.",
   "M4.5 6h6v6h-6V6Z M13.5 6h6v6h-6V6Z M4.5 14h6v4h-6v-4Z M13.5 14h6v4h-6v-4Z","gallery"],
  ["Map & locations","Ops","A pinboard of places, with the record's fields beside each pin.",
   "M12 21s6.5-5.6 6.5-11a6.5 6.5 0 1 0-13 0C5.5 15.4 12 21 12 21Z M12 12.8a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2Z","map"],
  ["Schedule","Ops","A calendar of bookings against this record, with recurring rules.",
   "M8 4v3 M16 4v3 M4.5 9.5h15 M6.4 6h11.2A1.9 1.9 0 0 1 19.5 8v10a1.9 1.9 0 0 1-1.9 1.9H6.4A1.9 1.9 0 0 1 4.5 18V8A1.9 1.9 0 0 1 6.4 6Z","schedule"]
];
const REC_TEMPLATE_CATS = ["All","Records","Case work","Finance","Notes","Ops"];

/* ---- admin hub ---- */
/* ---- admin hub: 13 settings areas in five groups ---- */
const PEOPLE = [
  ["Aoife Nolan","Accounts manager","aoife@kilbridegroup.ie","Head office","active","Admin","2 min ago"],
  ["Séamus Byrne","Senior installer","seamus@kilbridegroup.ie","Ballincollig","active","Standard","1 h ago"],
  ["Tom Walsh","Operations lead","tom@kilbridegroup.ie","Head office","active","Manager","34 min ago"],
  ["Niamh Cronin","Trade counter","niamh@kilbridegroup.ie","Ballincollig","active","Standard","3 h ago"],
  ["Dermot Casey","Buyer · Casey Builders","dermot@caseybuilders.ie","—","external","External","2 days ago"],
  ["Liam Dunne","Owner · Dunne & Sons","liam@dunneandsons.ie","—","inactive","External","19 days ago"]
];
const ROLE_LEVELS = ["Admin","Manager","Standard","External"];
const PERM_KEYS = [["view","View records"],["edit","Edit records"],["approve","Approve payments"]];
const GRANT_DEFS = [
  ["view","View records","Read anything in scope"],
  ["edit","Edit records","Create and change records"],
  ["approve","Approve decisions","Say yes to parked work"],
  ["pay","Release payments","Send money out"],
  ["export","Export data","Download and share out"],
  ["agents","Manage agents","Create and grant agents"],
  ["settings","Change settings","Modules, roles, integrations"],
  ["audit","Read the audit log","Every action, everyone"]
];
const ROLE_SCOPES = ["All records","Their location","Assigned only"];
const DEFAULT_PERMS = {Admin:{view:true,edit:true,approve:true}, Manager:{view:true,edit:true,approve:true},
  Standard:{view:true,edit:true,approve:false}, External:{view:true,edit:false,approve:false}};
const INTEGRATIONS = [
  {name:"Gmail", blurb:"Mail in and out of Pulse — threads attach to the record they mention, and drafts wait for your yes.", tint:"#ea4335", status:"connected", statusKind:"ok",
   glyph:"M4 7.2 12 13 20 7.2 M4 7.2v10.6h16V7.2 M4 7.2 8.5 4h7L20 7.2",
   lastSync:"2 min ago", usage:"340 emails/day", auth:"OAuth 2.0", scopes:["Read","Send"]},
  {name:"Xero", blurb:"Invoices, payments and credit notes sync both ways, so the ledger and the record spine never drift.", tint:"#13b5ea", status:"disconnected", statusKind:"bad",
   glyph:"M4.5 12a7.5 7.5 0 0 1 12.8-5.3 M19.5 12a7.5 7.5 0 0 1-12.8 5.3 M17.3 4v3.3h-3.3 M6.7 20v-3.3H10",
   lastSync:"27 Feb — token expired", usage:"148 invoices queued", auth:"OAuth 2.0", scopes:["Read","Write"]},
  {name:"Sage", blurb:"Nightly read of the chart of accounts and balances, mapped onto Pulse organisations.", tint:"#00d639", status:"read only", statusKind:"warn",
   glyph:"M4 8 12 4.5 20 8 12 11.5 4 8Z M4 13 12 16.5 20 13 M4 18 12 21.5 20 18",
   lastSync:"14 min ago", usage:"9 accounts synced nightly", auth:"API key", scopes:["Read"]},
  {name:"HubSpot", blurb:"Contacts, companies and deals stay matched to Pulse records without a second address book.", tint:"#ff7a59", status:"connected", statusKind:"ok",
   glyph:"M12 9.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8Z M12 4v3.4 M12 16.6V20 M4 12h3.4 M16.6 12H20 M6.5 6.5l2.4 2.4 M15.1 15.1l2.4 2.4 M17.5 6.5l-2.4 2.4 M8.9 15.1l-2.4 2.4",
   lastSync:"6 min ago", usage:"1.1k contacts synced", auth:"OAuth 2.0", scopes:["Read","Write"]},
  {name:"WhatsApp Business", blurb:"Send updates and chase messages from the record, logged against it as they go.", tint:"#25d366", status:"write only", statusKind:"warn",
   glyph:"M4 19.5 5.3 15A7.7 7.7 0 1 1 8.6 18.2L4 19.5Z M8.6 10.3c0 3 2.4 5.4 5.4 5.4",
   lastSync:"11 min ago", usage:"62 messages/day", auth:"API key", scopes:["Send"]},
  {name:"Resend", blurb:"Transactional email for everything Pulse generates — reminders, briefings and receipts.", tint:"var(--accent)", status:"write only", statusKind:"warn",
   glyph:"M3.5 12 20.5 4 16 20l-3.4-6.6L3.5 12Z",
   lastSync:"38 min ago", usage:"210 emails/day", auth:"API key", scopes:["Send"]},
  {name:"Composio", blurb:"One connector for the long tail of tools, so a new system does not need a new build.", tint:DIM, status:"not connected", statusKind:"off",
   glyph:"M9 3v5 M15 3v5 M6 8h12v3.5a6 6 0 0 1-12 0V8Z M12 17.5V21",
   lastSync:"—", usage:"—", auth:"—", scopes:[]}
];

/* Background catalogue. Each entry is pure CSS so a tile is the real thing at
   thumbnail size, not a picture of it. */
const BG_DEFS = [
  {id:"bloom", name:"Bloom", cat:"Signature",
   css:"background:radial-gradient(60% 48% at 50% 34%, var(--accent-faint), transparent 72%), radial-gradient(44% 38% at 16% 84%, rgba(255,255,255,.05), transparent 70%)",
   thumb:"background:radial-gradient(62% 58% at 46% 34%, var(--accent-soft), transparent 74%), radial-gradient(50% 46% at 82% 84%, rgba(255,255,255,.08), transparent 72%), var(--surface-2)"},
  {id:"mist", name:"Mist", cat:"Signature",
   css:"background:radial-gradient(52% 44% at 24% 22%, rgba(255,255,255,.07), transparent 70%), radial-gradient(56% 46% at 80% 76%, rgba(255,255,255,.05), transparent 72%)",
   thumb:"background:radial-gradient(58% 52% at 24% 22%, rgba(255,255,255,.16), transparent 72%), radial-gradient(60% 54% at 82% 78%, rgba(255,255,255,.10), transparent 74%), var(--surface-2)"},
  {id:"grid", name:"Grid", cat:"Signature",
   css:"background-image:linear-gradient(var(--border) 1px, transparent 1px),linear-gradient(90deg, var(--border) 1px, transparent 1px);background-size:56px 56px;mask-image:radial-gradient(62% 56% at 50% 46%, #000, transparent 78%);-webkit-mask-image:radial-gradient(62% 56% at 50% 46%, #000, transparent 78%)",
   thumb:"background-color:var(--surface-2);background-image:linear-gradient(var(--border-strong) 1px, transparent 1px),linear-gradient(90deg, var(--border-strong) 1px, transparent 1px);background-size:14px 14px"},
  {id:"none", name:"None", cat:"Signature", css:"", thumb:"background:var(--surface-2)"},

  {id:"aurora", name:"Aurora", cat:"Gradient",
   css:"background:radial-gradient(70% 52% at 18% 8%, var(--bloom-a), transparent 66%), radial-gradient(64% 48% at 84% 22%, var(--bloom-b), transparent 68%), radial-gradient(70% 60% at 50% 104%, var(--bloom-c), transparent 70%);filter:blur(24px)",
   thumb:"background:radial-gradient(72% 60% at 16% 6%, var(--bloom-a), transparent 68%), radial-gradient(66% 54% at 86% 24%, var(--bloom-b), transparent 70%), radial-gradient(74% 66% at 50% 108%, var(--bloom-c), transparent 72%), var(--surface-2)"},
  {id:"horizon", name:"Horizon", cat:"Gradient",
   css:"background:linear-gradient(180deg, transparent 0%, var(--accent-faint) 58%, transparent 100%), radial-gradient(90% 40% at 50% 72%, var(--accent-soft), transparent 70%)",
   thumb:"background:linear-gradient(180deg, var(--surface-2) 0%, var(--accent-faint) 58%, var(--surface-2) 100%), radial-gradient(90% 44% at 50% 74%, var(--accent-soft), transparent 70%)"},
  {id:"dusk", name:"Dusk", cat:"Gradient",
   css:"background:linear-gradient(200deg, var(--bloom-c) -10%, transparent 46%), linear-gradient(20deg, var(--bloom-b) -10%, transparent 52%);opacity:.5",
   thumb:"background:linear-gradient(200deg, var(--bloom-c) -12%, transparent 48%), linear-gradient(20deg, var(--bloom-b) -12%, transparent 54%), var(--surface-2)"},
  {id:"ember", name:"Ember", cat:"Gradient",
   css:"background:radial-gradient(60% 70% at 84% 96%, var(--bloom-a), transparent 64%), radial-gradient(50% 60% at 10% 96%, var(--bloom-c), transparent 66%)",
   thumb:"background:radial-gradient(64% 76% at 84% 100%, var(--bloom-a), transparent 66%), radial-gradient(54% 66% at 8% 100%, var(--bloom-c), transparent 68%), var(--surface-2)"},

  {id:"mesh", name:"Mesh", cat:"Abstract",
   css:"background-image:radial-gradient(var(--border-strong) 1px, transparent 1px);background-size:22px 22px;mask-image:radial-gradient(70% 62% at 50% 46%, #000, transparent 76%);-webkit-mask-image:radial-gradient(70% 62% at 50% 46%, #000, transparent 76%)",
   thumb:"background-color:var(--surface-2);background-image:radial-gradient(var(--border-strong) 1px, transparent 1px);background-size:8px 8px"},
  {id:"contour", name:"Contour", cat:"Abstract",
   css:"background:repeating-radial-gradient(circle at 30% 110%, transparent 0 22px, var(--border) 22px 23px);mask-image:radial-gradient(80% 70% at 40% 80%, #000, transparent 78%);-webkit-mask-image:radial-gradient(80% 70% at 40% 80%, #000, transparent 78%)",
   thumb:"background:repeating-radial-gradient(circle at 26% 116%, var(--surface-2) 0 9px, var(--border-strong) 9px 10px)"},
  {id:"weave", name:"Weave", cat:"Abstract",
   css:"background:repeating-linear-gradient(48deg, transparent 0 16px, var(--border) 16px 17px), repeating-linear-gradient(-48deg, transparent 0 16px, var(--border) 16px 17px);opacity:.7",
   thumb:"background-color:var(--surface-2);background-image:repeating-linear-gradient(48deg, transparent 0 7px, var(--border-strong) 7px 8px), repeating-linear-gradient(-48deg, transparent 0 7px, var(--border-strong) 7px 8px)"},
  {id:"halo", name:"Halo", cat:"Abstract",
   css:"background:repeating-radial-gradient(circle at 50% 50%, transparent 0 46px, var(--accent-line) 46px 47px);mask-image:radial-gradient(60% 60% at 50% 50%, #000, transparent 72%);-webkit-mask-image:radial-gradient(60% 60% at 50% 50%, #000, transparent 72%)",
   thumb:"background:repeating-radial-gradient(circle at 50% 50%, var(--surface-2) 0 11px, var(--accent-line) 11px 12px)"},
  {id:"drift", name:"Drift", cat:"Abstract",
   css:"background:conic-gradient(from 210deg at 32% 38%, var(--bloom-b), transparent 38%), conic-gradient(from 20deg at 76% 70%, var(--bloom-a), transparent 34%);filter:blur(30px);opacity:.6",
   thumb:"background:conic-gradient(from 210deg at 32% 38%, var(--bloom-b), transparent 38%), conic-gradient(from 20deg at 76% 70%, var(--bloom-a), transparent 34%), var(--surface-2)"},
  {id:"scan", name:"Scanlines", cat:"Abstract",
   css:"background:repeating-linear-gradient(0deg, var(--border) 0 1px, transparent 1px 7px);mask-image:linear-gradient(180deg, #000, transparent 88%);-webkit-mask-image:linear-gradient(180deg, #000, transparent 88%)",
   thumb:"background-color:var(--surface-2);background-image:repeating-linear-gradient(0deg, var(--border-strong) 0 1px, transparent 1px 5px)"}
];

const THEMES = [
  {id:"dark", label:"Dark", group:"Dark", bg:"#0b0c0b", surface:"#1a1c19", ink:"#f2f3ef", accent:"#c8f04b"},
  {id:"indigo", label:"Indigo", group:"Dark", bg:"#0a0b13", surface:"#1a1b26", ink:"#f0f1fa", accent:"#8b93ff"},
  {id:"slate", label:"Slate", group:"Dark", bg:"#100e0c", surface:"#211c17", ink:"#f4f0ea", accent:"#e8a14a"},
  {id:"plum", label:"Plum", group:"Dark", bg:"#100a10", surface:"#20151f", ink:"#f6eef4", accent:"#f077b0"},
  {id:"ember", label:"Ember", group:"Dark", bg:"#0b0b0b", surface:"#1c1714", ink:"#f7f3ef", accent:"#f4561a"},
  {id:"harbour", label:"Harbour", group:"Dark", bg:"#0b0e10", surface:"#13171a", ink:"#f3f5f4", accent:"#5ee79a"},
  {id:"cargo", label:"Cargo", group:"Dark", bg:"#0a0a0a", surface:"#1a1c1a", ink:"#f2f5f2", accent:"#4ade80"},
  {id:"ocean", label:"Ocean", group:"Dark", bg:"#080e12", surface:"#141f25", ink:"#eaf4f8", accent:"#4fd4d0"},
  {id:"graphite", label:"Graphite", group:"Dark", bg:"#111112", surface:"#212124", ink:"#f4f4f5", accent:"#f4f4f5"},
  {id:"light", label:"Cream", group:"Light", bg:"#f4f2ed", surface:"#ffffff", ink:"#16181c", accent:"#0071e3"},
  {id:"warm", label:"Warm paper", group:"Light", bg:"#faf5ec", surface:"#fffdf9", ink:"#2a2016", accent:"#c9683f"},
  {id:"mist", label:"Mist", group:"Light", bg:"#eef1f4", surface:"#ffffff", ink:"#141e20", accent:"#0e9f6e"},
  {id:"sand", label:"Sand", group:"Light", bg:"#f6f1e6", surface:"#fffdf7", ink:"#221d12", accent:"#7d5fd6"}
];

const ADMIN_ICONS = {
  people:"M12 12.5a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2Z M5 20.2c.9-3.1 3.6-4.9 7-4.9s6.1 1.8 7 4.9",
  teams:"M9 12a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 9 12Z M16.5 12.5a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2Z M2.6 19.6c.8-2.8 3.2-4.4 6.4-4.4s5.6 1.6 6.4 4.4 M17 15.4c2.2.4 3.7 1.8 4.3 4.2",
  structure:"M4.5 20V6.4A1.4 1.4 0 0 1 5.9 5h6.2a1.4 1.4 0 0 1 1.4 1.4V20 M13.5 10.5h4.6A1.4 1.4 0 0 1 19.5 12v8 M3 20h18 M7.5 8.5h2.5 M7.5 12h2.5",
  shield:"M12 3.6 19.5 6v6.1c0 4-3.1 6.9-7.5 8.3-4.4-1.4-7.5-4.3-7.5-8.3V6L12 3.6Z M9.2 12.2l2 2 3.6-3.7",
  agent:"M2 12h4l2.5-6 3.5 12 3-8 2 2h5",
  flow:"M18.5 8.5A5 5 0 0 0 8.9 7.3 3.8 3.8 0 0 0 6 14.6 M8 17.5l3.2 3.2 M11.2 20.7l3.2-3.2 M11.2 20.7V9.6",
  plug:"M9 3.5v5 M15 3.5v5 M6.5 8.5h11v3a5.5 5.5 0 0 1-11 0v-3Z M12 17v3.5",
  modules:"M6.6 4.4h10.8a2.2 2.2 0 0 1 2.2 2.2v10.8a2.2 2.2 0 0 1-2.2 2.2H6.6a2.2 2.2 0 0 1-2.2-2.2V6.6a2.2 2.2 0 0 1 2.2-2.2Z M4.4 9.6h15.2 M9.6 19.6V9.6",
  health:"M3 12.5h3.4l2-5 3 10 2.2-5H21",
  lock:"M6.5 10.5h11a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19v-7a1.5 1.5 0 0 1 1.5-1.5Z M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3",
  audit:"M8 3.5h8l3.5 3.5v13a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5V5A1.5 1.5 0 0 1 6 3.5h2Z M9 12h6 M9 16h4",
  brand:"M12 3.5 14.6 9l6.4.6-4.8 4.2 1.4 6.2-5.6-3.3-5.6 3.3 1.4-6.2L3 9.6 9.4 9 12 3.5Z",
  bell:"M6 8.5a6 6 0 0 1 12 0c0 6.5 2.6 8.5 2.6 8.5H3.4S6 15 6 8.5Z M10.3 20.5a1.94 1.94 0 0 0 3.4 0",
  data:"M4.5 7.5c0-1.7 3.4-3 7.5-3s7.5 1.3 7.5 3-3.4 3-7.5 3-7.5-1.3-7.5-3Z M4.5 7.5v9c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-9 M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3"
};

const ADMIN_CARDS = [
  {id:"people", group:"ORGANISATION", title:"People & access", icon:"people", tint:"#6ad0f0",
   blurb:"Invite, suspend and offboard the people who use Pulse.",
   tags:["48 people","6 teams","3 locations"], badge:"3 waiting", badgeKind:"warn",
   footer:"Last login checked 4 minutes ago", action:"Review 3 invites",
   listLabel:"WHAT YOU CONTROL HERE",
   rows:[["Add, invite or remove employees","",""],["Create teams and departments","6 teams"],["Assign managers","4 reporting lines"],
     ["Set locations","Head office · Ballincollig · Mallow"],["Suspend accounts","2 suspended"],["View last login","48 people tracked"]]},
  {id:"teams", group:"ORGANISATION", title:"Roles & permissions", icon:"shield", tint:"var(--accent)",
   blurb:"Permission templates, and exactly what each person can reach.",
   tags:["4 roles","64 permissions","3 scopes"],
   heroLabel:"THE QUESTION THIS ANSWERS", heroAction:"Show me what someone can access",
   heroText:"Pick a person and see every record, action and export they can reach — resolved through their grants, not guessed from the menus.",
   footer:"Preview Pulse as another user", action:"Open preview",
   listLabel:"WHAT YOU CONTROL HERE",
   rows:[["Create permission templates","4 in use"],["View, edit, export and delete access","per permission"],
     ["Restrict by team, location or record owner","3 scopes"],["Set approval limits","€10,000 threshold"],["Preview Pulse as another user",""]]},
  {id:"structure", group:"ORGANISATION", title:"Company structure", icon:"structure", tint:"#f0c04b",
   blurb:"Who reports to whom, where they work and when.",
   tags:["3 locations","Europe/Dublin","EUR"],
   listLabel:"WHAT YOU CONTROL HERE",
   rows:[["Company details","Kilbride Group"],["Departments","5"],["Teams","6"],["Locations","3"],
     ["Reporting lines","4"],["Working hours","08:00–17:30, Mon–Fri"],["Holidays","Irish public holidays"],
     ["Default currency and timezone","EUR · Europe/Dublin"]]},

  {id:"agents", group:"CONTROL", title:"Agents & AI controls", icon:"agent", tint:"var(--accent)",
   blurb:"What agents may read, what they may do, and where they must stop.",
   tags:["7 agents","318 actions today","€0.62 spent"],
   heroLabel:"GLOBAL CONTROL", heroAction:"Pause every agent",
   heroText:"One switch stops every agent immediately. Anything mid-run finishes its current step and then holds.",
   footer:"Write and external tools always need a yes", action:"Review limits",
   listLabel:"WHAT YOU CONTROL HERE",
   rows:[["Create approved agent roles","7 approved"],["Control which data agents can read","by permission"],
     ["Control which actions agents can take","read · write · external"],["Set approval requirements","all write tools", true],
     ["Set spending and usage limits","€40/month cap"],["Manage agent memory and retention","90 days"]]},
  {id:"wf", group:"CONTROL", title:"Workflow controls", icon:"flow", tint:"#9d8cf5",
   blurb:"The guardrails, not the builder — that lives under Work.",
   tags:["Managers only","2 approval rules","Retry twice"],
   footer:"Building workflows happens in Work", action:"Open Work",
   listLabel:"WHAT YOU CONTROL HERE",
   rows:[["Who can create workflows","Managers only"],["Maximum autonomy","proposes, never sends", true],
     ["Approval rules","2 configured"],["Failure handling","retry twice, then notify"],
     ["Usage limits","500 runs/day"],["Global pause","all workflows", true],["Default notification settings","inbox only"]]},
  {id:"notif", group:"CONTROL", title:"Notifications", icon:"bell", tint:"#f0994b",
   blurb:"Which events reach people, on which channel, and when not to.",
   tags:["Inbox","WhatsApp","Quiet 19:00–07:00"],
   listLabel:"WHAT YOU CONTROL HERE",
   rows:[["Which events trigger notifications","14 of 21 events"],["Email","", true],["WhatsApp","", true],
     ["Mobile push","", false],["In-app","", true],["Escalation rules","after 4 hours unread"],
     ["Quiet hours","19:00–07:00"],["Daily and weekly summaries","07:00 daily"]]},

  {id:"integrations", group:"SYSTEMS", title:"Integrations", icon:"plug", tint:"#6ad0f0",
   blurb:"Email, accounting, CRM and messaging — and which way data flows.",
   tags:["6 connected","1 disconnected","2 read-only"], badge:"Xero down", badgeKind:"bad",
   footer:"Xero token expired 27 February", action:"Reconnect",
   listLabel:"CONNECTIONS",
   rows:[["Gmail","read and write"],["Xero","disconnected"],["Sage","read only"],["HubSpot","read and write"],
     ["WhatsApp Business","write only"],["Resend","write only"],["Composio","not connected"]]},
  {id:"modules", group:"SYSTEMS", title:"Modules & configuration", icon:"modules", tint:"#f0c04b",
   blurb:"Turn modules on, and make Pulse speak the business's own words.",
   tags:["3 installed","1 available","2 renamed terms"],
   heroLabel:"TERMINOLOGY", heroAction:"Edit terminology",
   heroText:"Organisation reads as Merchant, and Task reads as Job, everywhere in the interface — including what Helios says back to you.",
   listLabel:"WHAT YOU CONTROL HERE",
   rows:[["Enable or disable modules","3 installed"],["Rename business terminology","2 overridden"],
     ["Create custom fields","9 fields"],["Configure statuses","6 sets"],["Edit record types","7 types"],
     ["Set required information","per record type"],["Manage form layouts","4 layouts"]]},
  {id:"health", group:"SYSTEMS", title:"Data health", icon:"health", tint:"#e2705c",
   blurb:"What is wrong with the data, how bad it is, and the fix.",
   tags:["7 issue types","231 records affected"], badge:"74 duplicates", badgeKind:"bad",
   footer:"Last scanned 12 minutes ago", action:"Fix 3 automatically",
   listLabel:"ISSUES FOUND",
   trend:[312,289,274,256,248,241,231],
   bySeverity:[["High","137",RED],["Medium","59",AMBER],["Low","35",DIM]],
   issues:[["Duplicate records","74","high","Merge on matching name and VAT number","Fix automatically"],
     ["Missing required fields","62","high","4 organisations have no billing email","Fix automatically"],
     ["Failed imports","18","medium","Re-run the 14 August Sage batch","Retry"],
     ["Out-of-date information","41","medium","Not touched in over 18 months","Review"],
     ["Broken connections","1","high","Xero refresh token expired","Reconnect"],
     ["Unmatched records","23","low","Invoices with no organisation attached","Review"],
     ["Records needing review","12","low","Flagged by an agent as inconsistent","Review"]],
   rows:[]},

  {id:"security", group:"GOVERNANCE", title:"Security", icon:"lock", tint:"#8fa6ff",
   blurb:"Sign-in, sessions, devices and the keys that reach the API.",
   tags:["SSO on","2FA enforced","3 API keys"], badge:"2 advisories", badgeKind:"warn",
   footer:"2 security recommendations open", action:"Review",
   listLabel:"WHAT YOU CONTROL HERE",
   rows:[["Single sign-on","Google Workspace", true],["Two-factor authentication","enforced", true],
     ["Login policies","30-day session"],["Active sessions","51"],["Approved devices","44"],
     ["IP restrictions","off", false],["Security alerts","on", true],["API keys","3 active"],
     ["Data retention rules","7 years"]]},
  {id:"audit", group:"GOVERNANCE", title:"Audit log", icon:"audit", tint:"#9d8cf5",
   blurb:"A locked history of who changed what. Searchable, exportable, never editable.",
   tags:["Append-only","7-year retention"],
   footer:"Nobody can edit or delete entries", action:"Export",
   listLabel:"WHAT IS RECORDED",
   rows:[["Permission changes","41 this month"],["Employee access","118"],["Data exports","9"],
     ["Integration changes","6"],["Agent actions","2,140"],["Deleted records","3"],["Admin changes","27"]]},
  {id:"datamgmt", group:"GOVERNANCE", title:"Data management", icon:"data", tint:"#5fe0a8",
   blurb:"Import, export, restore and — carefully — delete.",
   tags:["Backup 02:00","30-day restore"],
   footer:"Last backup completed 02:00 today", action:"Run backup",
   listLabel:"WHAT YOU CONTROL HERE",
   rows:[["Import data","CSV, Sage, HubSpot"],["Export data","full or per module"],["Backup status","healthy · 02:00 daily"],
     ["Restore previous versions","30 days available"],["Merge records","74 candidates"],
     ["Data retention","7 years"],["Delete company data","requires two admins"]]},

  {id:"brand", group:"EXPERIENCE", title:"Branding", icon:"brand", tint:"var(--accent)",
   blurb:"Logo, accent colour, templates and how agents appear.",
   tags:["Lime accent","2 templates"],
   listLabel:"WHAT YOU CONTROL HERE",
   rows:[["Company logo","kilbride-mark.svg"],["Pulse accent colour","oklch(0.86 0.19 118)"],
     ["Email templates","3"],["Document templates","2"],["Agent appearance","12 faces · 6 shells"],
     ["Customer-facing portal branding","on", true]]},
  {id:"appearance", group:"EXPERIENCE", title:"Appearance & themes", icon:"brand", tint:"#6ad0f0",
   blurb:"Pick a light or dark theme for how Pulse looks to you.",
   tags:["8 themes","4 dark","4 light"],
   listLabel:"THEMES", rows:[]}
];

const ADMIN_GROUPS = [
  ["ORGANISATION", "repeat(3,1fr)"],
  ["CONTROL", "repeat(3,1fr)"],
  ["SYSTEMS", "repeat(3,1fr)"],
  ["GOVERNANCE", "repeat(3,1fr)"],
  ["EXPERIENCE", "repeat(3,1fr)"]
];

/* ---- activity feeds ---- */
const SRC_TINT = {Gmail:"#f07a9d", Pulse:"var(--accent)", Sage:"#6ad0f0", WhatsApp:"#5fe0a8",
  HubSpot:"#f0994b", Xero:"#8fa6ff", Agent:"var(--accent)"};
const SRC_ABBR = {Gmail:"GM", Pulse:"PL", Sage:"SG", WhatsApp:"WA", HubSpot:"HS", Xero:"XR", Agent:"AI"};

const DATA_EVENTS = [
  ["New customer created","McKenna Transport was added from a web enquiry.","Web form","McKenna Transport","Pulse","completed"],
  ["Invoice imported","INV-10512 for €3,240 arrived from Sage and matched to an open order.","Sage sync","Casey Builders","Sage","completed"],
  ["Email received","Purchase order attached — parsed and filed against the account.","accounts@caseybuilders.ie","Casey Builders","Gmail","completed"],
  ["File uploaded","Signed framework 2026.pdf — 6 pages indexed for Helios.","Aoife Nolan","Casey Builders","Pulse","completed"],
  ["42 records imported","Nightly Sage sync brought in 42 invoice lines across 9 accounts.","Sage sync","9 organisations","Sage","completed"],
  ["CRM record updated","Credit limit changed on the account after the August review.","HubSpot sync","Fitzgerald Heating","HubSpot","completed"],
  ["Form submitted","Site survey request for a boiler replacement in Glanmire.","Web form","Ó Riain, Glanmire","Pulse","completed"],
  ["WhatsApp message received","Photo of the meter reading filed against the visit.","Séamus Byrne","Ballincollig depot","WhatsApp","completed"],
  ["External system synced","Xero connection retried and failed — token still expired.","Xero","148 invoices queued","Xero","failed"]
];

const PEOPLE_EVENTS = [
  ["Aoife approved a refund","€412 written off on INV-10233 after the parts dispute closed.","Aoife Nolan","Glanmire Mechanical","Pulse","completed"],
  ["Tom changed a booking","Thursday's depot visit moved to 11:00 to fit the delivery window.","Tom Walsh","Ballincollig depot","Pulse","completed"],
  ["Mac assigned a task","Lease decision handed to himself, due Thursday.","Martin Kilbride","Ballincollig depot","Pulse","completed"],
  ["Finance uploaded a report","August month-end close workbook, nine sheets.","Aoife Nolan","Head office","Pulse","completed"],
  ["Niamh edited customer details","Billing email corrected so reminders stop bouncing.","Niamh Cronin","Dunne & Sons Ltd","Pulse","completed"],
  ["Séamus completed a visit","Warranty callback closed — parts ordered on the spot.","Séamus Byrne","Fitzgerald Heating","Pulse","completed"],
  ["Purchase order raised","PO-4471 for €14,280 sent up for sign-off.","Aoife Nolan","Munster Plumbing","Pulse","awaiting"],
  ["Credit limit increase requested","€10,000 to €18,000 — waiting on the second approval.","Niamh Cronin","Casey Builders","Pulse","awaiting"]
];

const AI_EVENTS = [
  ["Finance Agent checked 143 invoices","Three accounts over their limit and €41.2k past 60 days.","Finance Agent","3 organisations","Agent","working"],
  ["Sales Agent qualified a new lead","McKenna Transport scored 82/100 on company size, location and enquiry detail.","Sales Agent","McKenna Transport","HubSpot","working"],
  ["Operations Agent updated a schedule","Van 04's jobs redistributed across two installers.","Operations Agent","Ballincollig depot","Agent","working"],
  ["Helios prepared a report","Weekly management one-pager written and filed.","Helios","Management","Agent","working"],
  ["Agent paused for approval","Chase email to Dunne & Sons drafted — needs your yes before it sends.","Finance Agent","Dunne & Sons Ltd","Agent","awaiting"],
  ["Workflow failed","Certificate renewal reminder could not find a contact for Mallow yard.","Operations","Mallow yard","Agent","failed"],
  ["Stock Watch raised order lines","Two lines below reorder point before Thursday's jobs.","Stock Watch","Munster Plumbing","Agent","working"],
  ["Briefing Agent posted the morning brief","Two items needed you; the rest was noise.","Briefing Agent","Martin Kilbride","WhatsApp","completed"]
];

const STREAM_DEFS = [
  {id:"data", title:"New data", sub:"Information entering Pulse", pool:DATA_EVENTS, every:3200,
   tint:"#6ad0f0", icon:"M4.5 7.5c0-1.7 3.4-3 7.5-3s7.5 1.3 7.5 3-3.4 3-7.5 3-7.5-1.3-7.5-3Z M4.5 7.5v9c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-9 M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3"},
  {id:"people", title:"Employee activity", sub:"Decisions people made", pool:PEOPLE_EVENTS, every:6400,
   tint:"#f0c04b", icon:"M12 12.5a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2Z M5 20.2c.9-3.1 3.6-4.9 7-4.9s6.1 1.8 7 4.9"},
  {id:"ai", title:"AI activity", sub:"Agents at work", pool:AI_EVENTS, every:4600,
   tint:"var(--accent)", icon:"M2 12h4l2.5-6 3.5 12 3-8 2 2h5"}
];

const NAV = [
  {label:"Home", icon:"helios", page:"Home"},
  {label:"Agents", icon:"navAgents", page:"Agents"},
  {label:"Dashboard", icon:"navDash", page:"Dashboard", dot:true},
  {label:"Work", icon:"navWork", page:"Work"},
  {label:"Records", icon:"navRecords", page:"Records"},
  {label:"Activity", icon:"pulseLine", page:"Activity", dot:true}
];

/* Inbox items follow the real InboxItem shape: what happened, why it matters, what I can do. */
const ITEMS = {
  po:{kind:"Approval", importance:"high", icon:ICONS.approvals, age:"18m",
    title:"Purchase order PO-4471 — €14,280",
    why:"Raised by Aoife Nolan. €4,280 above your sign-off threshold, so it routed to you.",
    detail:"Both lines are below reorder point and committed to Thursday's jobs. Pricing matches the June supplier agreement. Approving writes the decision as you and fires core.approval.updated.",
    actionLabel:"Approve", secondaryLabel:"Request changes", group:"Approvals",
    fields:[{k:"Provider",v:"core.approvals"},{k:"Requested by",v:"Aoife Nolan"},{k:"Value",v:"€14,280"},{k:"Record",v:"PO-4471"}],
    history:[{when:"Today 08:54",text:"Aoife Nolan raised the request"},{when:"Today 08:54",text:"Routed to Martin Kilbride — over threshold"}]},
  sync:{kind:"Alert", importance:"critical", icon:ICONS.health, age:"6h",
    title:"Xero sync failed — expired token",
    why:"148 invoices have been queued since 02:14. Reconnecting posts them automatically.",
    detail:"The refresh token was last authorised on 27 February. Third failure this year; moving the connection to the service account would stop it recurring. The dispatcher retried twice before dead-lettering.",
    actionLabel:"Reconnect", secondaryLabel:"Snooze", group:"Alerts",
    fields:[{k:"Provider",v:"core.notifications"},{k:"Integration",v:"Xero"},{k:"Queued",v:"148 invoices"},{k:"Event",v:"core.automation.failed"}],
    history:[{when:"Today 02:14",text:"Sync failed — invalid_grant"},{when:"Today 02:16",text:"Retried twice, then dead-lettered"}]},
  visit:{kind:"Task", importance:"high", icon:ICONS.visits, age:"2h",
    title:"Site visit at Ballincollig depot is unassigned",
    why:"Scheduled for tomorrow 09:00 with no installer against it.",
    detail:"Contributed by the site-visits module through its own inbox provider. Core never learns what a visit is — it sorts by importance and age like everything else.",
    actionLabel:"Assign installer", secondaryLabel:"Reschedule", group:"Work",
    fields:[{k:"Provider",v:"site-visits.unassigned"},{k:"Entity",v:"site-visits.visit"},{k:"Scheduled",v:"Tomorrow 09:00"},{k:"Status",v:"scheduled"}],
    history:[{when:"Yesterday 16:20",text:"Visit created by Tom Walsh"},{when:"Today 07:00",text:"Flagged unassigned by the briefing job"}]},
  auto:{kind:"Alert", importance:"normal", icon:ICONS.autos, age:"3h",
    title:"“Overdue reminder” skipped 4 contacts",
    why:"Four organisations have no billing email, so the send step could not run.",
    detail:"The automation ran at 08:00 and sent six of ten reminders. Each step is recorded in automation_run_steps with its input, output and error.",
    actionLabel:"Fix the records", secondaryLabel:"Disable step", group:"Automations",
    fields:[{k:"Automation",v:"Overdue invoice reminder"},{k:"Run",v:"partial"},{k:"Sent",v:"6 of 10"},{k:"Failed step",v:"notify.email"}],
    history:[{when:"Today 08:00",text:"Run completed with warnings"},{when:"Yesterday 08:00",text:"Same 4 records skipped"}]},
  task:{kind:"Task", importance:"normal", icon:ICONS.work, age:"Thu",
    title:"Ballincollig lease renewal closes Thursday",
    why:"No decision recorded against the contract and the notice period is 30 days.",
    detail:"The lease runs to 31 October. Ballincollig carried 38% of counter revenue this year; rent is 4.1% of that.",
    actionLabel:"Open record", secondaryLabel:"Assign", group:"Work",
    fields:[{k:"Provider",v:"core.tasks"},{k:"Due",v:"Thu 27 Aug"},{k:"Assignee",v:"Martin Kilbride"},{k:"Priority",v:"high"}],
    history:[{when:"18 Aug",text:"Task materialised from a recurring rule"},{when:"2 Feb",text:"Contract uploaded by Aoife Nolan"}]}
};
const ORDER = ["sync","po","visit","auto","task"];

const ANSWERS = {
  credit:{tool:"core_search", effect:"read",
    text:"Three organisations are over their agreed limit this morning, and €41.2k of the balance is past 60 days. Dunne & Sons is the one to act on: days-to-pay went from 12 to 74 since May while order volume held steady.",
    cols:["Organisation","Balance","Over","Oldest"],
    rows:[["Dunne & Sons","€28,410","€8,410","74d"],["Fitzgerald Heating","€9,240","€2,240","63d"],["Riverside Devs","€3,560","€560","61d"]],
    actions:[["Draft chase emails",1],["Open Dunne & Sons",0]]},
  jobs:{tool:"core_tasks_find", effect:"read",
    text:"Eleven tasks are past their due date. Two slipped on Friday when Van 04 went off the road at Ballincollig; the other nine are waiting on stock. Ballincollig carries seven of the eleven, well above its usual share.",
    cols:["Task","Subject","Late","Owner"],
    rows:[["Boiler swap follow-up","Ó Riain, Glanmire","4d","S. Byrne"],["Bathroom fit sign-off","Casey Builders","3d","T. Walsh"],["Rad replace invoice","Kelleher, Cobh","2d","S. Byrne"]],
    actions:[["Reassign the two van tasks",1],["Open Work → Overdue",0]]},
  chase:{tool:"core_email_draft", effect:"write", confirm:true,
    confirmSummary:"Send one chase email to accounts@dunneandsons.ie referencing INV-10428 (€28,410, 74 days), offering two instalments to 30 September.",
    text:"Drafted. This is a write tool, so I have not sent it — the proposal is stored with a hash of the exact arguments, and confirming replays those stored arguments rather than anything from your yes.",
    actions:[["Confirm and send",1],["Edit draft",0]]},
  sync:{tool:"core_operations_health", effect:"read",
    text:"The Xero connection failed at 02:14 with an expired refresh token — last authorised 27 February. Nothing was lost: 148 invoices are queued and post once reconnected. This is the third token failure this year, so it is worth moving the connection to the service account.",
    actions:[["Open System health",1],["Assign to Aoife",0]]},
  visits:{tool:"site_visits_find", effect:"read",
    text:"Four site visits are booked this week and one has no installer against it. That tool is contributed by the site-visits module, not core — installing the module is what gave me the ability to answer this.",
    cols:["Visit","Organisation","When","Status"],
    rows:[["Boiler service","Casey Builders","Wed 09:00","scheduled"],["Survey","Ó Riain","Wed 14:00","scheduled"],["Depot check","Ballincollig","Thu 09:00","unassigned"]],
    actions:[["Assign the unassigned visit",1],["Open Site visits",0]]},
  fallback:{tool:"core_search", effect:"read",
    text:"I can answer that from the records you have access to. Everything I reach goes through a registered tool with a declared permission — there is no SQL tool — and a record you may not see comes back as not found rather than forbidden.",
    actions:[["Show me what you can do",0]]}
};

// Turns a plain-English filter name into a full dashboard area — the "primitive
// vibe-coding" bit: no real backend, just a seeded generator so the same phrase
// always produces the same numbers, with direction and vocabulary nudged by
// keywords in the text (expansion/growth trends up, risk/issue trends down, a
// region/cost/people/ops/customer word picks which metrics show).
function synthesizeCustomArea(name){
  const trimmed = (name || "").trim();
  if (!trimmed) return null;
  let seed = 0;
  for (let i = 0; i < trimmed.length; i++) seed = (seed * 31 + trimmed.charCodeAt(i)) >>> 0;
  const rnd = (n) => (((seed >>> (n % 24)) ^ (seed << ((n * 7) % 13))) >>> 0) % 997 / 997;
  const low = trimmed.toLowerCase();
  const has = (...words) => words.some(w => low.indexOf(w) > -1);
  const growth = has("expansion","growth","launch","scale","pilot","new site","open","opening","grow");
  const risk = has("risk","issue","delay","problem","complaint","fault","incident","churn","decline");
  const dir = risk ? -1 : (growth ? 1 : (rnd(2) > 0.45 ? 1 : -1));

  let vocab = "generic";
  if (has("scotland","ireland","wales","england","region","dublin","belfast","cork","galway","london","glasgow","edinburgh"))
    vocab = "region";
  else if (has("cost","spend","budget","saving","margin")) vocab = "cost";
  else if (has("staff","hiring","team","recruit","headcount")) vocab = "people";
  else if (has("supplier","stock","inventory","warehouse","fleet")) vocab = "ops";
  else if (has("customer","client","retention","account")) vocab = "customer";

  const V = {
    region:   {labels:["New enquiries","Orders won","Revenue","Site coverage"], unit:"EUR — 30 DAYS"},
    cost:     {labels:["Spend","Cost per job","Savings found","Budget used"], unit:"EUR — 30 DAYS"},
    people:   {labels:["Headcount","Open roles","Time to hire","Retention"], unit:"PEOPLE"},
    ops:      {labels:["Stock cover","Lead time","Stockouts","Reorders raised"], unit:"DAYS"},
    customer: {labels:["Active accounts","Repeat rate","Churn","NPS"], unit:"ACCOUNTS"},
    generic:  {labels:["Volume","Rate","Cost","Coverage"], unit:"ACTIVITY — 30 DAYS"}
  }[vocab];

  const months = ["Sep","Oct","Nov","Dec","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug"];
  let v0 = 40 + Math.floor(rnd(1) * 220);
  const chart = months.map((m, i) => {
    v0 = Math.max(8, Math.round(v0 * (1 + dir * (0.03 + rnd(i + 3) * 0.07))));
    return [m, v0, String(v0)];
  });
  const metrics = V.labels.map((label, i) => {
    const val = 20 + Math.floor(rnd(i + 5) * 400);
    const pct = 2 + Math.round(rnd(i + 9) * 18);
    const up = dir > 0 ? rnd(i + 12) > 0.25 : rnd(i + 12) > 0.7;
    const bars = [0,1,2,3,4,5,6,7,8].map(k => 0.3 + rnd(i * 3 + k) * 0.7);
    return [label, i === 1 ? pct + "%" : String(val), (up ? "+" : "\u2212") + pct + (i === 1 ? "pt" : "%"), up ? "up" : "down", "vs last month", bars];
  });
  const capName = trimmed.replace(/\b\w/g, c => c.toUpperCase());
  const split = [
    [capName + " \u2014 direct", String(Math.round(v0 * 0.5)), "48%", 1],
    ["Existing pipeline", String(Math.round(v0 * 0.3)), "31%", 0],
    ["Everything else", String(Math.round(v0 * 0.2)), "21%", 0]
  ];
  const table = [1,2,3].map(w => [capName + " \u2014 week " + w, String(20 + Math.floor(rnd(20 + w) * 200)),
    (dir > 0 ? "+" : "\u2212") + (3 + Math.floor(rnd(23 + w) * 14)) + "%", "Auto-tagged from records mentioning \u201c" + low + "\u201d"]);
  table.push(["Everything else", String(20 + Math.floor(rnd(30) * 200)), "\u2014", "Baseline"]);
  return {
    id: trimmed, label: capName, color: "var(--accent)", owner: "CUSTOM FILTER",
    description: "Generated from \u201c" + trimmed + "\u201d \u2014 a plain-English filter, not a registered metric set. Refine it and Pulse will tighten this up.",
    kind: "columns", chartTitle: capName + " over time", chartUnit: V.unit,
    chart, splitTitle: "Where \u201c" + low + "\u201d shows up", split,
    tableCols: ["Item","Value","Change","Note"], table,
    metrics, legend: [capName, "Pipeline", "Other"]
  };
}

function pickAnswer(q){
  const s = q.toLowerCase();
  if (/visit|site visit|installer/.test(s)) return ANSWERS.visits;
  if (/chase|email|draft|send/.test(s)) return ANSWERS.chase;
  if (/credit|limit|debtor|owe|outstanding|dunne/.test(s)) return ANSWERS.credit;
  if (/task|late|overdue|slip|work/.test(s)) return ANSWERS.jobs;
  if (/sync|xero|integration|token|fail|broke|health/.test(s)) return ANSWERS.sync;
  return ANSWERS.fallback;
}

const ORGS = [
  ["Dunne & Sons Ltd","Customer","€28,410","74 days","on stop"],
  ["Casey Builders","Customer","€6,120","12 days","active"],
  ["Fitzgerald Heating","Customer","€9,240","63 days","watch"],
  ["Munster Plumbing Supplies","Supplier","—","—","active"],
  ["Riverside Developments","Customer","€3,560","61 days","watch"],
  ["Glanmire Mechanical","Customer","€1,180","8 days","active"]
];
const TEAMS = [
  ["Accounts","3 members","Aoife Nolan","core:approval:decide"],
  ["Installers","9 members","Séamus Byrne","core:task:update"],
  ["Trade counter","6 members","Niamh Cronin","core:person:view"],
  ["Management","2 members","Martin Kilbride","all core permissions"]
];
const LOCATIONS = [
  ["Head office","Little Island, Cork","14 staff","active"],
  ["Ballincollig depot","Ballincollig, Cork","14 staff","lease review"],
  ["Mallow yard","Mallow, Cork","4 staff","active"]
];

const AGENT_DEFS = [
  {id:"close", name:"Month-end close", shape:"rim-capsule", tint:"#1b2430", state:"working", group:true,
   members:["credit","briefing","ops"], role:"Credit Control, Briefing and Ops Watchdog working the same close",
   when:"09:12", preview:"credit control: three accounts still open.",
   thread:[
     {kind:"stamp", text:"Today 09:04"},
     {kind:"routine", text:"Ran routine", routine:"Month-end close"},
     {kind:"agent", from:"credit", text:"three accounts are still open on the August ledger. Dunne & Sons is the only one that changed behaviour rather than just running late."},
     {kind:"agent", from:"ops", text:"nothing technical is holding it up — the Xero token is back and all 148 queued invoices posted at 09:02."},
     {kind:"agent", from:"briefing", text:"so the close is one decision, not three: what to do about Dunne. everything else reconciles."},
     {kind:"user", text:"instalments, two payments to end of september"},
     {kind:"agent", from:"credit", text:"drafted on those terms and parked it. sending is a write tool, so it waits for your yes."},
     {kind:"agent", from:"briefing", text:"once that goes, August closes. i'll put the confirmation in tomorrow's briefing."}
   ]},
  {id:"briefing", name:"Briefing", shape:"crown-pebble", tint:"#191c1f", state:"complete", role:"Reads the whole business every morning and tells you the two things that matter",
   when:"08:02", preview:"three things moved overnight. two need you.",
   thread:[
     {kind:"stamp", text:"Today 08:00"},
     {kind:"routine", text:"Ran routine", routine:"Morning briefing"},
     {kind:"agent", text:"morning briefing:", lines:[
       {k:"Cash", v:"€41.2k past 60 days · Dunne & Sons is 74 days"},
       {k:"Work", v:"11 tasks late · 7 of them at Ballincollig"},
       {k:"Approvals", v:"PO-4471 sitting with you since 08:54"}]},
     {kind:"agent", text:"two things need you today: the purchase order, and a yes/no on the Ballincollig lease. everything else is covered."},
     {kind:"user", text:"put the lease on Thursday"},
     {kind:"agent", text:"done — task created against Ballincollig depot, due Thursday, assigned to you. i'll remind you Wednesday afternoon."}
   ]},
  {id:"credit", name:"Credit Control", shape:"executive-capsule", tint:"#2a2118", state:"waiting", role:"Watches payment behaviour and drafts the chase before you ask",
   when:"Yesterday", preview:"three drafts parked. nothing sent.",
   thread:[
     {kind:"stamp", text:"Yesterday 16:40"},
     {kind:"agent", text:"three accounts changed behaviour this week. i've drafted a chase for each and parked them — sending is a write tool, so they wait for you."},
     {kind:"user", text:"what changed on dunne"},
     {kind:"agent", text:"days-to-pay went 12 → 74 since May while order volume held steady. that pattern is a cash problem, not a dispute. i'd offer two instalments to 30 September before putting them on stop again."}
   ]},
  {id:"visits", name:"Visit Scout", shape:"low-dome", tint:"#241b2e", state:"working", role:"Keeps the site-visit board honest and chases unassigned work",
   when:"Yesterday", preview:"thursday's depot check still has nobody on it.",
   thread:[
     {kind:"stamp", text:"Yesterday 07:00"},
     {kind:"agent", text:"four visits booked this week, one unassigned: Thursday 09:00 depot stock check. Séamus is the only installer free that morning."},
     {kind:"user", text:"give it to séamus"},
     {kind:"agent", text:"assigned. the module fired site-visits.visit.updated and the escalation automation stood down."}
   ]},
  {id:"stock", name:"Stock Watch", shape:"control-cube", tint:"#16241f", state:"thinking", role:"Reorder points, supplier lead times and what Thursday's jobs actually need",
   when:"Mon", preview:"two lines below reorder point before thursday.",
   thread:[
     {kind:"stamp", text:"Monday 11:20"},
     {kind:"agent", text:"two lines drop below reorder point before Thursday's jobs. Munster can cover both at the June agreement price — that's what PO-4471 is."}
   ]},
  {id:"ops", name:"Ops Watchdog", shape:"shield", tint:"#2b1b1e", state:"attention", role:"Sits on the event queue and tells you when something stopped working",
   when:"02:16", preview:"xero token expired. 148 invoices queued, nothing lost.",
   thread:[
     {kind:"stamp", text:"Today 02:16"},
     {kind:"agent", text:"the Xero connection failed at 02:14 — invalid_grant, token last authorised 27 February. 148 invoices are queued and post on reconnect. third time this year; move it to the service account."}
   ]},
  {id:"counter", name:"Counter Assistant", shape:"offset-pebble", tint:"#191c1f", state:"working", role:"Answers trade-counter questions on price, stock and account status",
   when:"Fri", preview:"14 questions answered, 2 handed to niamh.",
   thread:[
     {kind:"stamp", text:"Friday 17:30"},
     {kind:"agent", text:"14 counter questions answered this week. two went to Niamh: both were credit-limit calls, which i won't make on my own."}
   ]}
];

const KPI_DEFS = {
  revenue:{label:"Revenue", value:"€412,800", delta:"+6.2%", dir:"up", hint:"30 days", hero:true},
  cash:{label:"Cash collected", value:"€368,140", delta:"+4.1%", dir:"up", hint:"30 days"},
  overdue:{label:"Overdue debt", value:"€41,200", delta:"+€8,410", dir:"down", hint:"60 days+"},
  margin:{label:"Gross margin", value:"31.4%", delta:"−0.6pt", dir:"down", hint:"vs last month"},
  jobs:{label:"Jobs completed", value:"126", delta:"+4", dir:"up", hint:"30 days"},
  nps:{label:"Repeat rate", value:"68%", delta:"+3pt", dir:"up", hint:"customers ordering again"},
  pipeline:{label:"Open pipeline", value:"€212,400", delta:"+11%", dir:"up", hint:"quoted, not won"},
  utilisation:{label:"Installer hours", value:"84%", delta:"−2pt", dir:"down", hint:"billable share"}
};

const ASPECT_DEFS = [
  {id:"sales", label:"Sales", color:"var(--accent)", owner:"NIAMH CRONIN", description:"Counter, trade accounts and quotes out the door.",
   kind:"columns", chartTitle:"Revenue by month", chartUnit:"EUR",
   chart:[["Sep",288,"€0k"],["Oct",301,"€0k"],["Nov",352,"€0k"],["Dec",376,"€0k"],["Jan",268,"€0k"],["Feb",294,"€0k"],["Mar",318,"€0k"],["Apr",341,"€0k"],["May",362,"€0k"],["Jun",384,"€0k"],["Jul",398,"€0k"],["Aug",413,"€0k"]],
   splitTitle:"Where it came from",
   split:[["Trade counter","€214.6k","72%",1],["Contract accounts","€156.8k","53%",0],["Online orders","€41.4k","18%",0]],
   tableCols:["Account","Revenue","Change","Owner"],
   table:[["Casey Builders","€48,210","+12.4%","Niamh Cronin"],["Dunne & Sons Ltd","€28,410","−18.2%","Aoife Nolan"],["Fitzgerald Heating","€21,860","+4.1%","Niamh Cronin"],["Riverside Developments","€18,240","+9.6%","Tom Walsh"]],
   metrics:[["Revenue","€412,800","+6.2%","up","30 days",[.4,.55,.44,.62,.5,.7,.6,.78,1]],
     ["Orders","318","+22","up","30 days",[.5,.6,.44,.7,.55,.75,.62,.8,.9]],
     ["Average order","€1,298","+1.8%","up","vs last month",[.6,.58,.62,.6,.66,.64,.7,.68,.74]],
     ["Quotes won","41%","−3pt","down","conversion",[.7,.66,.7,.6,.62,.55,.58,.5,.48]]]},
  {id:"development", label:"Development", color:"#9fd6f0", owner:"TOM WALSH", description:"Modules shipped into the client build and what they contributed.",
   kind:"rows", rows:[["approval routing","412 runs",412],["overdue reminder","308 runs",308],["visit escalation","286 runs",286],["xero sync","198 runs",198],["briefing job","80 runs",80]], chartTitle:"Runs by automation", chartUnit:"RUNS · 30 DAYS",
   chart:[["Sep",620,"620"],["Oct",684,"684"],["Nov",712,"712"],["Dec",760,"760"],["Jan",802,"802"],["Feb",864,"864"],["Mar",918,"918"],["Apr",986,"986"],["May",1042,"1042"],["Jun",1128,"1128"],["Jul",1204,"1204"],["Aug",1284,"1284"]],
   splitTitle:"Runs by module",
   split:[["core","1,042","81%",1],["site-visits","198","15%",0],["ui-showcase","44","4%",0]],
   tableCols:["Module","Version","Contributions","State"],
   table:[["core","0.1.0","31 routes · 21 events","always installed"],["site-visits","1.0.0","1 entity · 2 tools","installed"],["ui-showcase","0.1.0","3 pages","installed"],["wholesale","—","6 entities · 9 tools","available"]],
   metrics:[["Modules live","3","+1","up","this quarter",[.2,.2,.4,.4,.4,.6,.6,.6,1]],
     ["Helios tools","11","+2","up","registered",[.4,.44,.5,.5,.6,.6,.7,.8,.9]],
     ["Automation runs","1,284","+9%","up","30 days",[.5,.55,.6,.58,.66,.7,.72,.8,.86]],
     ["Failure rate","0.9%","−0.4pt","up","of all runs",[.8,.74,.7,.62,.6,.5,.44,.4,.32]]]},
  {id:"marketing", label:"Marketing", color:"#e6c78a", owner:"AOIFE NOLAN", description:"Reach, enquiries and what turned into an account.",
   kind:"funnel", funnel:[["Enquiries","184","—",184],["Quoted","96","52% of enquiries",96],["Won","39","41% of quotes",39],["Repeat order","12","31% of wins",12]], chartTitle:"Enquiry to repeat order", chartUnit:"CONVERSION",
   chart:[["Sep",96,"96"],["Oct",104,"104"],["Nov",88,"88"],["Dec",112,"112"],["Jan",124,"124"],["Feb",118,"118"],["Mar",136,"136"],["Apr",142,"142"],["May",151,"151"],["Jun",164,"164"],["Jul",172,"172"],["Aug",184,"184"]],
   splitTitle:"Where they came from",
   split:[["Referral","78","42%",1],["Search","61","33%",0],["Trade shows","29","16%",0],["Direct","16","9%",0]],
   tableCols:["Channel","Enquiries","Change","Cost each"],
   table:[["Referral","78","+18.2%","€0.00"],["Search","61","+9.4%","€24.60"],["Trade shows","29","−6.1%","€41.20"],["Direct","16","+2.0%","€0.00"]],
   metrics:[["Enquiries","184","+31","up","30 days",[.3,.4,.36,.5,.46,.6,.58,.7,.86]],
     ["New accounts","12","+4","up","opened",[.2,.3,.24,.4,.36,.5,.44,.6,.7]],
     ["Cost per enquiry","€18.40","−€2.10","up","blended",[.8,.76,.7,.66,.6,.56,.5,.46,.4]],
     ["Repeat rate","68%","+3pt","up","ordering again",[.5,.54,.58,.56,.62,.64,.66,.7,.74]]]},
  {id:"operations", label:"Operations", color:"#dcded6", owner:"SÉAMUS BYRNE", description:"Installers, vans, site visits and the work queue.",
   kind:"stacked", legend:["Head office","Ballincollig depot","Mallow yard"], stacked:[["Sep",[34,28,9]],["Oct",[36,30,9]],["Nov",[39,32,10]],["Dec",[37,31,10]],["Jan",[32,27,8]],["Feb",[35,29,9]],["Mar",[40,33,10]],["Apr",[43,35,11]],["May",[46,37,12]],["Jun",[49,39,12]],["Jul",[52,42,13]],["Aug",[64,48,14]]], chartTitle:"Jobs completed by month", chartUnit:"JOBS",
   chart:[["Sep",88,"88"],["Oct",94,"94"],["Nov",102,"102"],["Dec",96,"96"],["Jan",84,"84"],["Feb",91,"91"],["Mar",104,"104"],["Apr",112,"112"],["May",118,"118"],["Jun",121,"121"],["Jul",124,"124"],["Aug",126,"126"]],
   splitTitle:"By location",
   split:[["Head office","64","51%",1],["Ballincollig depot","48","38%",0],["Mallow yard","14","11%",0]],
   tableCols:["Installer","Jobs","On time","Location"],
   table:[["Séamus Byrne","41","94%","Ballincollig"],["Tom Walsh","34","88%","Head office"],["Niamh Cronin","28","96%","Head office"],["Unassigned","4","—","Ballincollig"]],
   metrics:[["Jobs completed","126","+4","up","30 days",[.5,.6,.5,.66,.6,.7,.66,.76,.84]],
     ["Overdue tasks","11","+3","down","past due",[.3,.36,.3,.44,.4,.5,.56,.7,.85]],
     ["Visits completed","38","+11%","up","30 days",[.4,.5,.6,.5,.66,.6,.72,.8,.9]],
     ["Installer hours","84%","−2pt","down","billable",[.8,.78,.8,.76,.78,.74,.76,.72,.7]]]},
  {id:"finance", label:"Finance", color:"#7fd8a4", owner:"AOIFE NOLAN", description:"Cash in, debt ageing and margin after cost.",
   kind:"area", chartTitle:"Cash collected by month", chartUnit:"EUR",
   chart:[["Sep",252,"€0k"],["Oct",268,"€0k"],["Nov",296,"€0k"],["Dec",318,"€0k"],["Jan",246,"€0k"],["Feb",264,"€0k"],["Mar",288,"€0k"],["Apr",306,"€0k"],["May",324,"€0k"],["Jun",342,"€0k"],["Jul",358,"€0k"],["Aug",368,"€0k"]],
   splitTitle:"Debt by age",
   split:[["0–30 days","€184.2k","61%",1],["31–60 days","€82.4k","27%",0],["61–90 days","€28.6k","9%",0],["90 days plus","€12.6k","4%",0]],
   tableCols:["Account","Balance","Change","Oldest"],
   table:[["Dunne & Sons Ltd","€28,410","+42.0%","74 days"],["Fitzgerald Heating","€9,240","+11.2%","63 days"],["Riverside Developments","€3,560","−4.4%","61 days"],["Glanmire Mechanical","€1,180","−22.0%","8 days"]],
   metrics:[["Cash collected","€368,140","+4.1%","up","30 days",[.5,.56,.5,.62,.58,.68,.66,.74,.8]],
     ["Overdue debt","€41,200","+€8,410","down","60 days plus",[.3,.34,.4,.38,.46,.5,.6,.7,.84]],
     ["Gross margin","31.4%","−0.6pt","down","vs last month",[.7,.72,.7,.68,.68,.66,.64,.62,.6]],
     ["Days to pay","38","+6","down","weighted",[.4,.44,.42,.5,.52,.6,.62,.7,.76]]]},
  {id:"support", label:"Support", color:"#e2705c", owner:"NIAMH CRONIN", description:"Callbacks, warranty work and what came back twice.",
   kind:"dots", target:12, targetLabel:"Target: 12 callbacks a month or fewer", chartTitle:"Callbacks by month", chartUnit:"COUNT",
   chart:[["Sep",18,"18"],["Oct",16,"16"],["Nov",21,"21"],["Dec",19,"19"],["Jan",24,"24"],["Feb",22,"22"],["Mar",17,"17"],["Apr",15,"15"],["May",14,"14"],["Jun",12,"12"],["Jul",9,"9"],["Aug",7,"7"]],
   splitTitle:"By cause",
   split:[["Install fault","3","43%",1],["Part failure","2","29%",0],["User error","2","28%",0]],
   tableCols:["Site","Callbacks","First-visit fix","Cost"],
   table:[["Ó Riain, Glanmire","2","50%","€840"],["Casey Builders","2","100%","€410"],["Fitzgerald Heating","2","100%","€1,240"],["Kelleher, Cobh","1","100%","€650"]],
   metrics:[["Open callbacks","7","−2","up","live",[.6,.58,.54,.5,.48,.44,.4,.38,.34]],
     ["First-visit fix","82%","+4pt","up","of callbacks",[.5,.54,.56,.6,.6,.66,.7,.74,.8]],
     ["Warranty cost","€3,140","−€420","up","30 days",[.7,.66,.62,.6,.54,.5,.46,.44,.4]],
     ["Repeat faults","3","−1","up","same site",[.5,.5,.46,.4,.4,.36,.3,.3,.26]]]}
];

const FILTER_GROUPS = [
  {title:"AREA", items:["Sales","Development","Marketing","Operations","Finance","Support"]},
  {title:"SPINE", items:["Location","Team","Person","Organisation","Module"]},
  {title:"TIME", items:["This week","This month","This quarter","Year to date"]}
];

const OPS_DEFS = [
  {id:"o1", name:"Weekly management report", kind:"report", owner:"Chief of Staff", ownerKind:"agent", initials:"CS",
   trigger:"Mon, 08:00", triggerKind:"schedule", next:"3 days", last:"Sent to 4 people", status:"healthy", rate:98, on:true,
   what:"Pulls last week's numbers from every area, writes the commentary and sends one page to the management team before Monday's meeting.",
   why:"The meeting used to start with twenty minutes of people reading numbers off their own screens.",
   saved:"6 hours a month",
   steps:[["Trigger","Every Monday at 08:00"],["Find","Last week's metrics across all six areas"],["Check","Flag anything moving more than 10%"],["Draft","Write the one-page commentary"],["Send","Email the management team"],["Update","File the report against the week"]],
   runs:[["Mon 08:00","1m 12s","ok","4 recipients","€0.04"],["Mon 25 Aug 08:00","1m 04s","ok","4 recipients","€0.04"],["Mon 18 Aug 08:00","58s","ok","4 recipients","€0.03"]]},
  {id:"o2", name:"Chase unpaid invoices", kind:"automation", owner:"Finance Agent", ownerKind:"agent", initials:"FA",
   trigger:"Daily, 09:00", triggerKind:"schedule", next:"Tomorrow", last:"3 drafts waiting", status:"approval", rate:94, on:true,
   what:"Finds invoices past 14 days, excludes anything disputed, drafts a reminder in your tone and parks it for the finance manager.",
   why:"Chasing was happening in bursts, so the oldest debt got the least attention.",
   saved:"11 hours a month",
   steps:[["Trigger","Every weekday at 09:00"],["Find","Unpaid invoices older than 14 days"],["Check","Exclude disputed invoices"],["Draft","Create personalised reminders"],["Approval","Finance manager reviews","gate"],["Send","Email the customer"],["Update","Record the activity in Pulse"]],
   runs:[["Today 09:00","42s","partial","3 of 7 drafted","€0.02","4 organisations have no billing email"],["Yesterday 09:00","51s","ok","6 sent","€0.03"],["Mon 09:00","47s","ok","5 sent","€0.03"]]},
  {id:"o3", name:"New enquiry follow-up", kind:"automation", owner:"Sales Agent", ownerKind:"agent", initials:"SA",
   trigger:"New lead created", triggerKind:"event", next:"Event-based", last:"11 followed up today", status:"healthy", rate:99, on:true,
   what:"Answers a new enquiry within minutes, asks the two questions the counter always needs, and creates the quote task.",
   why:"Enquiries arriving after 5pm were sitting until the next morning.",
   saved:"14 hours a month",
   steps:[["Trigger","A lead is created in Pulse"],["Find","Match against existing organisations"],["Draft","Write the first reply"],["Send","Email the enquiry"],["Update","Create a quote task for the counter"]],
   runs:[["Today 16:20","6s","ok","1 lead","€0.01"],["Today 15:02","7s","ok","1 lead","€0.01"],["Today 11:48","6s","ok","1 lead","€0.01"]]},
  {id:"o4", name:"Certificate renewal reminder", kind:"routine", owner:"Operations", ownerKind:"person", initials:"TW",
   trigger:"60 days before expiry", triggerKind:"event", next:"14:20", last:"Failed — missing contact", status:"failed", rate:71, on:true,
   what:"Watches every installer certificate and insurance document, and gives sixty days' notice before one lapses.",
   why:"A lapsed certificate stopped two jobs last year.",
   saved:"3 hours a month",
   steps:[["Trigger","60 days before a document expires"],["Find","The owner of the certificate"],["Check","Has a renewal already been booked?"],["Send","Notify the owner and Operations"],["Update","Create the renewal task"]],
   runs:[["Today 14:20","3s","failed","0 of 2","€0.00","No contact on file for Mallow yard"],["Yesterday 14:20","4s","failed","0 of 1","€0.00","No contact on file for Mallow yard"],["Fri 14:20","5s","ok","1 notified","€0.01"]]},
  {id:"o5", name:"Morning briefing", kind:"routine", owner:"Briefing Agent", ownerKind:"agent", initials:"BR",
   trigger:"Weekdays, 07:00", triggerKind:"schedule", next:"Tomorrow", last:"Delivered 07:02", status:"healthy", rate:100, on:true,
   what:"Reads the whole business overnight and tells you the two things that actually need you.",
   why:"You were opening six screens before your first coffee.",
   saved:"9 hours a month",
   steps:[["Trigger","Every weekday at 07:00"],["Find","Overnight changes across cash, work and approvals"],["Check","Drop anything already handled"],["Draft","Write the briefing"],["Send","Post to Home and WhatsApp"]],
   runs:[["Today 07:00","22s","ok","1 briefing","€0.02"],["Yesterday 07:00","19s","ok","1 briefing","€0.02"],["Mon 07:00","24s","ok","1 briefing","€0.02"]]},
  {id:"o6", name:"Weekly stock check", kind:"task", owner:"Stock Watch", ownerKind:"agent", initials:"SW",
   trigger:"Thursdays, 09:00", triggerKind:"schedule", next:"Thu 09:00", last:"2 lines flagged", status:"healthy", rate:96, on:true,
   what:"Compares reorder points against what the week's jobs need and raises the purchase order lines.",
   why:"Two jobs were rescheduled in June for parts nobody had ordered.",
   saved:"5 hours a month",
   steps:[["Trigger","Every Thursday at 09:00"],["Find","Lines below reorder point"],["Check","What this week's jobs need"],["Approval","Buyer confirms the order","gate"],["Update","Raise the purchase order"]],
   runs:[["Thu 09:00","31s","ok","2 lines","€0.02"],["Thu 21 Aug 09:00","28s","ok","1 line","€0.02"]]},
  {id:"o7", name:"Xero invoice sync", kind:"automation", owner:"Ops Watchdog", ownerKind:"agent", initials:"OW",
   trigger:"Hourly", triggerKind:"schedule", next:"Paused", last:"Token expired", status:"failed", rate:62, on:false,
   what:"Posts every finalised invoice into Xero and reconciles what came back.",
   why:"Manual re-entry was the single biggest source of mismatched invoices.",
   saved:"18 hours a month",
   steps:[["Trigger","Every hour"],["Find","Invoices not yet in Xero"],["Send","Post to Xero","external"],["Check","Reconcile what came back"],["Update","Mark them synced"]],
   runs:[["Today 02:14","1.2s","failed","0 of 148","€0.00","invalid_grant: refresh token expired 27 February"],["Today 01:14","1.1s","failed","0 of 141","€0.00","invalid_grant: refresh token expired 27 February"],["Yesterday 23:14","4s","ok","12 posted","€0.01"]]},
  {id:"o8", name:"Weekend on-call handover", kind:"routine", owner:"Chief of Staff", ownerKind:"agent", initials:"CS",
   trigger:"Fri, 16:30", triggerKind:"schedule", next:"Fri 16:30", last:"Sent to 3 people", status:"healthy", rate:97, on:true,
   what:"Writes the weekend handover: open jobs, who is on call, and anything a customer is waiting on.",
   why:"Weekend calls were being answered by whoever picked up, with no context.",
   saved:"4 hours a month",
   steps:[["Trigger","Every Friday at 16:30"],["Find","Open jobs and unanswered customers"],["Draft","Write the handover note"],["Send","WhatsApp the on-call rota"]],
   runs:[["Fri 16:30","18s","ok","3 recipients","€0.02"],["Fri 15 Aug 16:30","21s","ok","3 recipients","€0.02"]]},
  {id:"o9", name:"Timesheet reminder", kind:"task", owner:"Operations", ownerKind:"person", initials:"TW",
   trigger:"Fri, 15:00", triggerKind:"schedule", next:"Fri 15:00", last:"9 of 12 submitted", status:"approval", rate:88, on:true,
   what:"Nudges anyone who has not filed hours, then sends Operations the list still outstanding.",
   why:"Payroll was chasing the same four people every week.",
   saved:"3 hours a month",
   steps:[["Trigger","Every Friday at 15:00"],["Find","Staff with no hours filed"],["Send","Remind each person"],["Approval","Operations signs off the week","gate"]],
   runs:[["Fri 15:00","12s","partial","9 of 12","€0.01"],["Fri 15 Aug 15:00","11s","ok","12 of 12","€0.01"]]},
  {id:"o10", name:"Overnight backup check", kind:"automation", owner:"Ops Watchdog", ownerKind:"agent", initials:"OW",
   trigger:"Daily, 03:00", triggerKind:"schedule", next:"Tonight", last:"All systems clean", status:"healthy", rate:100, on:true,
   what:"Confirms every nightly backup completed and the restore test passed, and raises an alert if not.",
   why:"A failed backup went unnoticed for eleven days in January.",
   saved:"2 hours a month",
   steps:[["Trigger","Every day at 03:00"],["Check","Every backup job completed"],["Check","Last restore test passed"],["Send","Alert only if something failed"]],
   runs:[["Today 03:00","8s","ok","6 jobs","€0.00"],["Yesterday 03:00","9s","ok","6 jobs","€0.00"]]},
  {id:"o11", name:"Month-end close pack", kind:"report", owner:"Finance Agent", ownerKind:"agent", initials:"FA",
   trigger:"1st, 07:00", triggerKind:"schedule", next:"1 Sep 07:00", last:"Delivered 1 Aug", status:"healthy", rate:95, on:true,
   what:"Assembles the close pack: aged debt, margin by area, cash position and the variance commentary.",
   why:"Close took three days of copying between spreadsheets.",
   saved:"16 hours a month",
   steps:[["Trigger","First of the month at 07:00"],["Find","Last month's ledger and margin data"],["Check","Reconcile against the bank"],["Draft","Write the variance commentary"],["Send","Email the pack to Finance"]],
   runs:[["1 Aug 07:00","3m 42s","ok","1 pack","€0.09"],["1 Jul 07:00","3m 51s","ok","1 pack","€0.09"]]}
];

const OPS_FILTERS = [
  ["all","All"], ["routine","Agent routines"], ["automation","Automations"],
  ["report","Scheduled reports"], ["task","Recurring tasks"], ["approval","Needs approval"], ["failed","Failed"]
];

const WORK_SECTIONS = [
  {id:"tasks", label:"Tasks", blurb:"Everything assigned to you or your team, in one permission-filtered list.",
   views:["All tasks","Due tasks","Review","Done"], filters:["Due date","Any status","Anyone","Any due date"]},
  {id:"approvals", label:"Approvals", blurb:"Requests and their steps. Every decision is written as the person who made it.",
   views:["Awaiting you","Awaiting others","Decided"], filters:["Raised date","Any value","Anyone"]},
  {id:"workflows", label:"Workflows", blurb:"Automations and agent routines — what runs on its own, and who owns it.",
   views:[], filters:[]},
  {id:"schedules", label:"Schedules", blurb:"The team calendar: when recurring work fires and what it costs the week.",
   views:[], filters:[]}
];

const WORK_TASKS = [
  {id:"w1", title:"Chase INV-10428 — Dunne & Sons", status:"In progress", priority:"High", who:"AN",
   due:"2d overdue", late:true, client:"Dunne & Sons Ltd", day:"Today", mins:"25 mins", view:"Due tasks"},
  {id:"w2", title:"Reassign Van 04 jobs off Ballincollig", status:"In progress", priority:"High", who:"MK",
   due:"Due today", late:false, client:"Ballincollig depot", day:"Today", mins:"50 mins", view:"Due tasks"},
  {id:"w3", title:"Approve purchase order PO-4471", status:"Review", priority:"Medium", who:"MK",
   due:"Due 12:00", late:false, client:"Munster Plumbing", day:"Today", mins:"15 mins", view:"Review"},
  {id:"w4", title:"Sign off August counter stocktake", status:"Not started", priority:"Medium", who:"SB",
   due:"No due date", late:false, client:"Head office", day:"Any day", mins:"Mins", view:"All tasks"},
  {id:"w5", title:"Ballincollig lease decision", status:"Not started", priority:"High", who:"MK",
   due:"Thursday", late:false, client:"Ballincollig depot", day:"Thu", mins:"1 hour", view:"All tasks"},
  {id:"w6", title:"VAT return — August", status:"Done", priority:"Medium", who:"AN",
   due:"Filed Friday", late:false, client:"Head office", day:"Fri", mins:"2 hours", view:"Done", done:true}
];

const WORKFLOWS = [
  {name:"Overdue invoice reminder", state:"live", trigger:"schedule · daily 08:00",
   actions:[["notify.email","write"],["tasks.create","write"]], lastRun:"Today 08:00",
   result:"6 of 10 sent · partial", resultKind:"warn", runSummary:"11 ok · 3 partial",
   runs:["ok","ok","partial","ok","ok","ok","partial","ok","ok","ok","ok","ok","partial","partial"]},
  {name:"Approval routing over €10k", state:"live", trigger:"event · core.approval.created",
   actions:[["approvals.route","read"],["notify.inbox","write"]], lastRun:"Today 08:54",
   result:"ok", resultKind:"ok", runSummary:"14 ok",
   runs:["ok","ok","ok","ok","ok","ok","ok","ok","ok","ok","ok","ok","ok","ok"]},
  {name:"Unassigned visit escalation", state:"live", trigger:"event · site-visits.visit.created",
   actions:[["notify.inbox","write"]], lastRun:"Today 07:00",
   result:"ok", resultKind:"ok", runSummary:"9 ok · 1 failed",
   runs:["idle","idle","ok","ok","failed","ok","ok","ok","idle","ok","ok","ok","ok","ok"]},
  {name:"Xero invoice sync", state:"failing", trigger:"schedule · hourly",
   actions:[["xero.post","external"]], lastRun:"Today 02:14",
   result:"invalid_grant · dead-lettered", resultKind:"bad", runSummary:"4 failed",
   runs:["ok","ok","ok","ok","ok","ok","ok","ok","ok","ok","failed","failed","failed","failed"]}
];

const SCHEDULES = [
  {id:"s1", name:"Morning briefing", cadence:"Every weekday · 07:00", next:"Tomorrow 07:00", owner:"Briefing agent", on:true, day:1},
  {id:"s2", name:"Overdue invoice reminder", cadence:"Daily · 08:00", next:"Tomorrow 08:00", owner:"Credit Control", on:true, day:1},
  {id:"s3", name:"Xero invoice sync", cadence:"Hourly", next:"Paused", owner:"Ops Watchdog", on:false, day:0},
  {id:"s4", name:"Weekly stock check", cadence:"Thursdays · 09:00", next:"Thu 09:00", owner:"Stock Watch", on:true, day:3},
  {id:"s5", name:"Month-end close", cadence:"Last working day · 17:00", next:"Fri 17:00", owner:"Month-end close", on:true, day:4}
];

const WIDGET_DEFS = [["inbox","Action inbox"],["work","My work"],["activity","Activity"],["kpi","Today's numbers"],["visits","Site visits"]];
const WORK_WIDGETS = [
  {id:"queue", label:"My queue", value:"8", hint:"assigned to you", icon:"work", queue:"mine"},
  {id:"late", label:"Running late", value:"11", hint:"past their due date", icon:"health", queue:"overdue"},
  {id:"unassigned", label:"Unassigned", value:"1", hint:"nobody owns it yet", icon:"teams", queue:"unassigned"},
  {id:"week", label:"Next 7 days", value:"4", hint:"due this week", icon:"visits", queue:"upcoming"}
];
const PERSONALITIES = ["Straight-talking","Warm","Formal","Dry"];
const ANSWER_STYLES = ["Short answers","Show the working","Ask before acting"];
/* Every context source and every registered tool the agent could be granted —
   the builder shows the whole catalogue, grouped, rather than a sample. */
const CONTEXT_DEFS = [
  ["Organisations","records","Accounts, limits, payment behaviour"],
  ["People","records","Contacts and internal staff"],
  ["Files","records","Indexed documents and certificates"],
  ["Tasks","work","Queues, owners, due dates"],
  ["Site visits","work","Bookings, installers, outcomes"],
  ["Approvals","work","What is waiting on a decision"],
  ["Invoices","money","Issued, paid, past due"],
  ["Quotes","money","Sent, accepted, expired"],
  ["Payments","money","Receipts and allocations"],
  ["Activity log","system","Every event, agent and human"],
  ["Modules","system","What this client has installed"],
  ["Insights","system","Saved metrics and trends"]
];
const CONTEXT_SOURCES = CONTEXT_DEFS.map(c => c[0]);
const SKILL_DEFS = [
  ["Search records","read"],["Summarise activity","read"],["Read invoices","read"],
  ["Read site visits","read"],["Check permissions","read"],
  ["Draft email","write"],["Create task","write"],["Update record","write"],
  ["Schedule visit","write"],["Raise approval","write"],
  ["Send email","external"],["Send WhatsApp","external"],["Post to Xero","external"],["Push to HubSpot","external"]
];
/* The two questions the agent asks back once it knows the job. */
const TRAIN_PHASES = [
  ["Reading the whole ontology", "4,820 records"],
  ["Learning how this business words things", "organisation → merchant"],
  ["Researching the trade-supply domain", "12 sources"],
  ["Writing its own system prompt", "1,240 tokens"]
];
const BRIEF_QUESTIONS = [
  {title:"What should it cover?", sub:"Pick as many as you like — we can refine later.",
   options:[["Calendar","Meetings and what is coming up"],["Email","Unread and actionable inbox items"],
            ["Records","Accounts that moved since yesterday"],["Money","Cash, overdue and anything at risk"],
            ["Something else","Tell me in the next message"]]},
  {title:"When should it land?", sub:"One is enough to start.",
   options:[["Every morning 07:30","Before the yard opens"],["Weekdays 08:00","Monday to Friday only"],
            ["Only when something changes","Event-driven, no noise"],["On demand","When you ask for it"]]}
];
/* The words under a name, keyed to the same state the face lights with. */
const STATE_LABELS = {working:"working", thinking:"thinking", waiting:"waiting on you",
  complete:"up to date", attention:"needs you", idle:"idle"};

const FACE_SHAPES = [
  ["crown-pebble","Crown pebble"],["executive-capsule","Executive capsule"],["shield","Shield"],
  ["glass-visor","Glass visor"],["control-cube","Control cube"],["low-dome","Low dome"],
  ["offset-pebble","Offset pebble"],["rim-capsule","Rim capsule"],["wide-eyed","Wide-eyed"],
  ["precision-brow","Precision brow"],["tall-unit","Tall unit"],["soft-asymmetric","Soft asymmetric"]
];
/* Shell colours only — deliberately desaturated so none of them reads as a
   state. The eyes, rim and dots always carry the state colour. */
const FACE_TINTS = [
  ["#191c1f","Graphite"],["#1b2430","Slate"],["#241b2e","Aubergine"],
  ["#2a2118","Bronze"],["#16241f","Pine"],["#2b1b1e","Oxblood"]
];

/* ---- ontology graph: generation, Dijkstra traversal, canvas render ---- */
const CLUSTERS = [
  ["Organisations", "#c8f04b", 0.00, 0.62, 46],
  ["People",        "#6ad0f0", 0.90, 0.70, 52],
  ["Files",         "#b06cf0", 1.75, 0.66, 58],
  ["Tasks",         "#f0c04b", 2.55, 0.72, 44],
  ["Invoices",      "#f0567f", 3.35, 0.60, 38],
  ["Site visits",   "#5fe0a8", 4.15, 0.70, 40],
  ["Locations",     "#f0803a", 4.95, 0.64, 30],
  ["Approvals",     "#5f7cf0", 5.65, 0.72, 34]
];

function mulberry(seed){
  return function(){
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* Hub-and-spoke clusters around a dense phyllotaxis core, in unit space
   (-1..1 on both axes) so the layout is resolution independent. */
const _hexCache = {};
function hexRGB(hex){
  if (_hexCache[hex]) return _hexCache[hex];
  const h = hex.replace("#", "");
  const v = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  _hexCache[hex] = v;
  return v;
}


function buildGraph(){
  const rnd = mulberry(20260902);
  const nodes = [], edges = [], adj = [];
  const add = (x, y, z, r, cluster, kind) => {
    nodes.push({x, y, z, r, cluster, kind}); adj.push([]); return nodes.length - 1;
  };
  const link = (a, b) => {
    const dx = nodes[a].x - nodes[b].x, dy = nodes[a].y - nodes[b].y, dz = nodes[a].z - nodes[b].z;
    const w = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.004;
    const id = edges.length;
    edges.push({a, b, w});
    adj[a].push([b, w, id]); adj[b].push([a, w, id]);
  };

  // the core is a filled sphere on a Fibonacci lattice, not a disc
  const CORE = 880, coreIds = [];
  for (let i = 0; i < CORE; i++){
    const t = (i + 0.5) / CORE;
    const phi = Math.acos(1 - 2 * t);
    const theta = i * 2.39996;
    const shell = 0.16 + 0.28 * Math.pow(rnd(), 0.5);
    const grade = rnd();
    coreIds.push(add(
      Math.sin(phi) * Math.cos(theta) * shell * 1.04,
      Math.cos(phi) * shell * 0.96,
      Math.sin(phi) * Math.sin(theta) * shell,
      grade < 0.06 ? 3.4 + rnd() * 1.4 : grade < 0.3 ? 2.1 + rnd() * 0.7 : 1.0 + rnd() * 0.8, 0, "core"));
  }
  // lattice neighbours plus a mesh of chords, so the sphere reads as a volume
  for (let i = 1; i < coreIds.length; i++){
    link(coreIds[i], coreIds[i - 1]);
    if (i >= 13) link(coreIds[i], coreIds[i - 13]);
    if (i >= 21 && i % 2 === 0) link(coreIds[i], coreIds[i - 21]);
    if (i >= 34 && i % 3 === 0) link(coreIds[i], coreIds[i - 34]);
    if (i >= 55 && i % 4 === 0) link(coreIds[i], coreIds[i - 55]);
    if (i >= 89 && i % 5 === 0) link(coreIds[i], coreIds[i - 89]);
    if (i % 6 === 0) link(coreIds[i], coreIds[Math.floor(rnd() * coreIds.length)]);
  }

  // a mid shell between the nucleus and the lobes: the layer that makes it
  // read as a network rather than a ball with satellites
  const MID = 560, midIds = [];
  for (let i = 0; i < MID; i++){
    const t = (i + 0.5) / MID;
    const phi = Math.acos(1 - 2 * t), theta = i * 2.39996 + 0.7;
    const d = 0.52 + 0.16 * Math.pow(rnd(), 0.6);
    const g2 = rnd();
    midIds.push(add(
      Math.sin(phi) * Math.cos(theta) * d * 1.02,
      Math.cos(phi) * d * 0.96,
      Math.sin(phi) * Math.sin(theta) * d,
      g2 < 0.05 ? 2.6 + rnd() * 1.0 : g2 < 0.3 ? 1.6 + rnd() * 0.6 : 0.8 + rnd() * 0.7, 0, "core"));
  }
  for (let i = 0; i < midIds.length; i++){
    if (i >= 1) link(midIds[i], midIds[i - 1]);
    if (i >= 17) link(midIds[i], midIds[i - 17]);
    if (i >= 29 && i % 2 === 0) link(midIds[i], midIds[i - 29]);
    // radial spokes tying the shell to the nucleus
    if (i % 2 === 0) link(midIds[i], coreIds[Math.floor(rnd() * coreIds.length)]);
    if (i % 9 === 0) link(midIds[i], coreIds[Math.floor(rnd() * coreIds.length)]);
  }

  // clusters ride a sphere: each hub gets its own latitude as well as longitude
  const hubs = [], clusterLeaves = [];
  const onSphere = (lon, lat, d0) => { const d = d0 * 1.22;
    return [Math.cos(lat) * Math.cos(lon) * d * 1.02, Math.sin(lat) * d * 0.96, Math.cos(lat) * Math.sin(lon) * d]; };
  CLUSTERS.forEach((c, ci) => {
    const [, , ang, dist, leaves] = c;
    const lat = (ci % 2 ? 1 : -1) * (0.26 + rnd() * 0.5);
    const wob = 1.06 + rnd() * 0.16;
    const hp = onSphere(ang, lat, dist * wob);
    const hub = add(hp[0], hp[1], hp[2], 5.4, ci, "hub");
    hubs.push(hub);
    const mine = [];
    clusterLeaves.push(mine);
    for (let k = 0; k < 3; k++) link(hub, coreIds[Math.floor(rnd() * coreIds.length)]);
    for (let k = 0; k < 5; k++) link(hub, midIds[Math.floor(rnd() * midIds.length)]);

    const subs = 5 + Math.floor(rnd() * 4);
    const subIds = [];
    for (let s = 0; s < subs; s++){
      const sa = ang + (rnd() - 0.5) * 0.52, sl = lat + (rnd() - 0.5) * 0.3;
      const sd = dist + 0.08 + rnd() * 0.18;
      const sp = onSphere(sa, sl, sd);
      const sub = add(sp[0], sp[1], sp[2], 3.2, ci, "sub");
      subIds.push(sub);
      link(sub, hub);
      if (s > 0 && rnd() < 0.7) link(sub, subIds[s - 1]);
      const fan = Math.floor((leaves * 7.4) / subs);
      const spread = 0.17 + rnd() * 0.2;
      let prev = -1;
      for (let l = 0; l < fan; l++){
        const la = sa + (rnd() - 0.5) * spread * 2 + (rnd() - 0.5) * 0.06;
        const ll = sl + (rnd() - 0.5) * spread * 1.1;
        const ld = sd + 0.03 + Math.pow(rnd(), 0.8) * 0.17;
        const lp = onSphere(la, ll, ld);
        const lg = rnd();
        const leaf = add(lp[0], lp[1], lp[2],
          lg < 0.08 ? 2.8 + rnd() * 1.2 : lg < 0.34 ? 1.8 + rnd() * 0.6 : 1.0 + rnd() * 0.7, ci, "leaf");
        link(leaf, sub);
        mine.push(leaf);
        if (rnd() < 0.14) link(leaf, hub);
        if (prev >= 0 && rnd() < 0.34) link(leaf, prev);
        if (rnd() < 0.16) link(leaf, midIds[Math.floor(rnd() * midIds.length)]);
        prev = leaf;
      }
    }
  });
  // far satellites hanging off the outer leaves
  CLUSTERS.forEach((c, ci) => {
    const [, , ang, dist] = c;
    for (let s = 0; s < 7; s++){
      const sa = ang + (rnd() - 0.5) * 1.5, sl = (rnd() - 0.5) * 1.3;
      const sd = dist + 0.42 + rnd() * 0.22;
      const ap = onSphere(sa, sl, sd);
      const anchor = add(ap[0], ap[1], ap[2], 2.4, ci, "sub");
      link(anchor, hubs[ci]);
      const n = 14 + Math.floor(rnd() * 18);
      for (let l = 0; l < n; l++){
        const la = sa + (rnd() - 0.5) * 0.9, ll = sl + (rnd() - 0.5) * 0.7;
        const ld = sd + 0.02 + Math.pow(rnd(), 0.8) * 0.18;
        const p = onSphere(la, ll, ld);
        const leaf = add(p[0], p[1], p[2], 0.8 + rnd() * 0.9, ci, "leaf");
        link(leaf, anchor);
        clusterLeaves[ci].push(leaf);
      }
    }
  });

  // two hub rings and long chords across the sphere
  hubs.forEach((h, i) => {
    link(h, hubs[(i + 1) % hubs.length]);
    link(h, hubs[(i + 2) % hubs.length]);
    if (i % 3 === 0) link(h, hubs[(i + 4) % hubs.length]);
  });
  // neighbouring clusters share records, so their leaves cross-link
  for (let ci = 0; ci < clusterLeaves.length; ci++){
    const a = clusterLeaves[ci], b = clusterLeaves[(ci + 1) % clusterLeaves.length];
    const n = 26 + Math.floor(rnd() * 16);
    for (let k = 0; k < n; k++){
      link(a[Math.floor(rnd() * a.length)], b[Math.floor(rnd() * b.length)]);
    }
    // and a good number reach right across to the far side
    for (let k = 0; k < 12; k++){
      const far = clusterLeaves[(ci + 3) % clusterLeaves.length];
      link(a[Math.floor(rnd() * a.length)], far[Math.floor(rnd() * far.length)]);
    }
    for (let k = 0; k < 8; k++){
      const far = clusterLeaves[(ci + 4) % clusterLeaves.length];
      link(a[Math.floor(rnd() * a.length)], far[Math.floor(rnd() * far.length)]);
    }
  }

  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, minZ = 1e9, maxZ = -1e9;
  for (const n of nodes){
    if (n.x < minX) minX = n.x; if (n.x > maxX) maxX = n.x;
    if (n.y < minY) minY = n.y; if (n.y > maxY) maxY = n.y;
    if (n.z < minZ) minZ = n.z; if (n.z > maxZ) maxZ = n.z;
  }
  const bounds = {minX, maxX, minY, maxY, cx:(minX + maxX) / 2, cy:(minY + maxY) / 2,
    cz:(minZ + maxZ) / 2, w:maxX - minX, h:maxY - minY, d:maxZ - minZ,
    radius: Math.max(maxX - minX, maxY - minY, maxZ - minZ) / 2,
    reach: nodes.reduce((m, n) => Math.max(m, Math.sqrt(n.x * n.x + n.y * n.y + n.z * n.z)), 0)};
  return {nodes, edges, adj, hubs, coreIds, bounds};
}

export {
  INK,
  BODY,
  DIM,
  FAINT,
  LIME,
  GREEN,
  AMBER,
  RED,
  NEUTRAL,
  MONO,
  ICONS,
  REC_SECTIONS,
  CONTACTS,
  FILE_TREE,
  ONTO_NODES,
  ONTO_EDGES,
  REC_TEMPLATES,
  REC_TEMPLATE_CATS,
  PEOPLE,
  ROLE_LEVELS,
  PERM_KEYS,
  GRANT_DEFS,
  ROLE_SCOPES,
  DEFAULT_PERMS,
  INTEGRATIONS,
  BG_DEFS,
  THEMES,
  ADMIN_ICONS,
  ADMIN_CARDS,
  ADMIN_GROUPS,
  SRC_TINT,
  SRC_ABBR,
  DATA_EVENTS,
  PEOPLE_EVENTS,
  AI_EVENTS,
  STREAM_DEFS,
  NAV,
  ITEMS,
  ORDER,
  ANSWERS,
  synthesizeCustomArea,
  pickAnswer,
  ORGS,
  TEAMS,
  LOCATIONS,
  AGENT_DEFS,
  KPI_DEFS,
  ASPECT_DEFS,
  FILTER_GROUPS,
  OPS_DEFS,
  OPS_FILTERS,
  WORK_SECTIONS,
  WORK_TASKS,
  WORKFLOWS,
  SCHEDULES,
  WIDGET_DEFS,
  WORK_WIDGETS,
  PERSONALITIES,
  ANSWER_STYLES,
  CONTEXT_DEFS,
  CONTEXT_SOURCES,
  SKILL_DEFS,
  TRAIN_PHASES,
  BRIEF_QUESTIONS,
  STATE_LABELS,
  FACE_SHAPES,
  FACE_TINTS,
  CLUSTERS,
  mulberry,
  _hexCache,
  hexRGB,
  buildGraph
};
