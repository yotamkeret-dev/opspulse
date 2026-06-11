export type Period = 'weekly' | 'monthly' | 'quarterly';

// ─── Historical Time Filter ────────────────────────────────────────────────

export type PeriodType = 'week' | 'month' | 'quarter';

export interface TimeFilter {
  periodType:      PeriodType;
  selectedYear:    number;
  selectedWeek:    number;    // ISO 1-53, used when periodType='week'
  selectedMonth:   number;    // 1-12,    used when periodType='month'
  selectedQuarter: number;    // 1-4,     used when periodType='quarter'
}

export const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
] as const;

// ─── Israeli business week: Sunday start, Saturday end ────────────────────
// Year assignment uses the Thursday of the week (same principle as ISO).
// Example: Israeli W24/2026 = Sun Jun 7 – Sat Jun 13, 2026.

function israeliWeekOfDate(date: Date): { week: number; year: number } {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  // Thursday of this week (Sun=0 → Thu=4)
  const thu = new Date(d);
  thu.setDate(d.getDate() - d.getDay() + 4);
  const year = thu.getFullYear();           // year the week belongs to
  // Sunday of this week
  const sun = new Date(d);
  sun.setDate(d.getDate() - d.getDay());
  // Sunday of the first week of `year`
  const jan1    = new Date(year, 0, 1);
  const jan1Sun = new Date(jan1);
  jan1Sun.setDate(jan1.getDate() - jan1.getDay());
  const week = Math.round((sun.getTime() - jan1Sun.getTime()) / (7 * 86400000)) + 1;
  return { week, year };
}

function israeliWeekRange(year: number, week: number): { start: Date; end: Date } {
  const jan1    = new Date(year, 0, 1);
  const jan1Sun = new Date(jan1);
  jan1Sun.setDate(jan1.getDate() - jan1.getDay()); // Sunday of first week
  const start   = new Date(jan1Sun);
  start.setDate(jan1Sun.getDate() + (week - 1) * 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);                // Saturday
  return { start, end };
}

export function getDateRangeForFilter(tf: TimeFilter): { start: Date; end: Date } {
  if (tf.periodType === 'week') return israeliWeekRange(tf.selectedYear, tf.selectedWeek);
  if (tf.periodType === 'month') return {
    start: new Date(tf.selectedYear, tf.selectedMonth - 1, 1),
    end:   new Date(tf.selectedYear, tf.selectedMonth,     0),
  };
  // quarter
  const qStart = (tf.selectedQuarter - 1) * 3;
  return {
    start: new Date(tf.selectedYear, qStart,     1),
    end:   new Date(tf.selectedYear, qStart + 3, 0),
  };
}

export function filterLogsByTimeFilter(logs: SupportLog[], tf: TimeFilter): SupportLog[] {
  const { start, end } = getDateRangeForFilter(tf);
  end.setHours(23, 59, 59, 999);
  return logs.filter(l => {
    if (!l.date) return false;
    const d = new Date(l.date + 'T00:00:00');
    return d >= start && d <= end;
  });
}

export function getTimeFilterLabel(tf: TimeFilter): string {
  if (tf.periodType === 'week') {
    const { start, end } = israeliWeekRange(tf.selectedYear, tf.selectedWeek);
    const fmt = (d: Date) => `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
    // Append (Sun–Sat) to make the Israeli week convention explicit
    return `W${String(tf.selectedWeek).padStart(2, '0')} · ${fmt(start)} – ${fmt(end)}, ${tf.selectedYear}`;
  }
  if (tf.periodType === 'month') return `${MONTH_NAMES[tf.selectedMonth - 1]} ${tf.selectedYear}`;
  return `Q${tf.selectedQuarter} ${tf.selectedYear}`;
}

/** Returns the period immediately before the given TimeFilter. Handles year-boundary rollovers. */
export function getPreviousPeriod(tf: TimeFilter): TimeFilter {
  if (tf.periodType === 'week') {
    if (tf.selectedWeek > 1) return { ...tf, selectedWeek: tf.selectedWeek - 1 };
    // W1 → find the Saturday right before W1 starts (= last day of prev year's last week)
    const w1Start  = israeliWeekRange(tf.selectedYear, 1).start;
    const satBefore = new Date(w1Start);
    satBefore.setDate(w1Start.getDate() - 1); // the Saturday before W1
    const { week: lastWeek, year: prevYear } = israeliWeekOfDate(satBefore);
    return { ...tf, selectedYear: prevYear, selectedWeek: lastWeek };
  }
  if (tf.periodType === 'month') {
    if (tf.selectedMonth > 1) return { ...tf, selectedMonth: tf.selectedMonth - 1 };
    return { ...tf, selectedYear: tf.selectedYear - 1, selectedMonth: 12 };
  }
  // quarter
  if (tf.selectedQuarter > 1) return { ...tf, selectedQuarter: tf.selectedQuarter - 1 };
  return { ...tf, selectedYear: tf.selectedYear - 1, selectedQuarter: 4 };
}

export function currentTimeFilter(): TimeFilter {
  const now = new Date();
  const { week, year } = israeliWeekOfDate(now);  // Israeli week (Sun–Sat)
  return {
    periodType:      'week',
    selectedYear:    year,
    selectedWeek:    week,
    selectedMonth:   now.getMonth() + 1,
    selectedQuarter: Math.ceil((now.getMonth() + 1) / 3),
  };
}

// ─── Executive Dashboard sections ─────────────────────────────────────────

export type DashboardKpi = {
  label:          string;
  value:          string;
  note:           string;
  kpiRecordKey?:  string; // when set, card opens the kpiRecords drill-down panel
};

export type DashboardSection = {
  title: string;
  kpis:  DashboardKpi[];
};

export const dashboardSections: DashboardSection[] = [
  {
    title: 'Production',
    kpis: [
      { label: 'Ready to Ship at BAZ',    value: '0', note: 'No records this period' },
      { label: 'Systems Waiting for ATP', value: '0', note: 'No records this period' },
      { label: 'Systems After ATP',       value: '0', note: 'No records this period' },
    ],
  },
  {
    title: 'Operations',
    kpis: [
      { label: 'Systems Shipped',         value: '0', note: 'No records this period' },
      { label: 'Installations Completed', value: '0', note: 'No records this period' },
      { label: 'Spares Shipped',          value: '0', note: 'No records this period' },
    ],
  },
  {
    title: 'Procurement Activity',
    kpis: [
      { label: 'PO Created',              value:  '74', note: 'Oracle source',                          kpiRecordKey: 'PO Created'               },
      { label: 'Emergency Requests',      value:  '19', note: 'Short-notice requests across departments'                                          },
      { label: 'Supplier Payments',       value: '$284K', note: 'Processed together with Finance',      kpiRecordKey: 'Procurement Activity'     },
    ],
  },
];

// ─── Procurement Record (Supabase table: procurement_records) ─────────────
export const PROCUREMENT_CATEGORIES = [
  'PO Created',
  'Supplier Payment',
  'Emergency Request',
] as const;
export type ProcurementCategory = typeof PROCUREMENT_CATEGORIES[number];

export const PROCUREMENT_STATUSES = [
  'Open',
  'In Progress',
  'Completed',
] as const;
export type ProcurementStatus = typeof PROCUREMENT_STATUSES[number];

export type ProcurementRecord = {
  id:           string;
  employeeId:   string;           // → employee_id
  employeeName: string;           // → employee_name
  poNumber:     string;           // → po_number (required for 'PO Created')
  supplier:     string;           // required
  amountUsd:    number;           // → amount_usd (0 if not applicable)
  category:     ProcurementCategory;
  status:       ProcurementStatus;
  notes:        string;
  date:         string;           // YYYY-MM-DD → activity_date
};

// Demo-mode seed records (current week W23, Jun 1–4 2026)
export const mockProcurementRecords: ProcurementRecord[] = [
  { id:'PR-001', employeeId:'yotam-keret',  employeeName:'Yotam Keret',  poNumber:'PO-4571', supplier:'Elektra Components GmbH', amountUsd:12400, category:'PO Created',       status:'Completed',   notes:'Emergency R&D components — sourced under 24h',      date:'2026-06-11' },
  { id:'PR-002', employeeId:'dan-cohen',     employeeName:'Dan Cohen',     poNumber:'PO-4572', supplier:'Pacific Parts Direct',    amountUsd: 8200, category:'PO Created',       status:'Completed',   notes:'BAZ spare parts replenishment',                     date:'2026-06-10' },
  { id:'PR-003', employeeId:'amit-levy',     employeeName:'Amit Levy',     poNumber:'PO-4573', supplier:'GlobalTech Supply',       amountUsd:34000, category:'PO Created',       status:'In Progress', notes:'System 120 assembly components — awaiting sign-off', date:'2026-06-10' },
  { id:'PR-004', employeeId:'noa-shaked',    employeeName:'Noa Shaked',    poNumber:'PO-4574', supplier:'Meridian Electronics',    amountUsd:56000, category:'PO Created',       status:'Completed',   notes:'Defence project materials Q2',                      date:'2026-06-09' },
  { id:'PR-005', employeeId:'yotam-keret',  employeeName:'Yotam Keret',  poNumber:'PO-4575', supplier:'Core Components Ltd',     amountUsd: 9600, category:'PO Created',       status:'Completed',   notes:'Inventory replenishment — screens batch',            date:'2026-06-08' },
  { id:'PR-006', employeeId:'yotam-keret',  employeeName:'Yotam Keret',  poNumber:'',        supplier:'Elektra Components GmbH', amountUsd:84000, category:'Supplier Payment', status:'Completed',   notes:'Q2 framework settlement',                           date:'2026-06-11' },
  { id:'PR-007', employeeId:'amit-levy',     employeeName:'Amit Levy',     poNumber:'',        supplier:'Meridian Electronics',    amountUsd:56000, category:'Supplier Payment', status:'Completed',   notes:'Defence project invoice cleared',                   date:'2026-06-09' },
  { id:'PR-008', employeeId:'dan-cohen',     employeeName:'Dan Cohen',     poNumber:'',        supplier:'Pacific Parts Direct',    amountUsd:12400, category:'Supplier Payment', status:'Completed',   notes:'Emergency parts — same-day payment released',       date:'2026-06-10' },
  { id:'PR-009', employeeId:'amit-levy',     employeeName:'Amit Levy',     poNumber:'PO-4571', supplier:'Elektra Components GmbH', amountUsd:12400, category:'Emergency Request',status:'Completed',   notes:'R&D sprint blocker — component sourced in 4h',     date:'2026-06-11' },
  { id:'PR-010', employeeId:'noa-shaked',    employeeName:'Noa Shaked',    poNumber:'PO-4574', supplier:'Meridian Electronics',    amountUsd:56000, category:'Emergency Request',status:'Completed',   notes:'Defence shipment — last-minute approval obtained',  date:'2026-06-09' },
  { id:'PR-011', employeeId:'yotam-keret',  employeeName:'Yotam Keret',  poNumber:'PO-4577', supplier:'Precision Parts Co',     amountUsd: 7100, category:'Emergency Request',status:'In Progress', notes:'Product support materials — awaiting delivery',     date:'2026-06-08' },
];

export const timeRangeData = {
  weekly: {
    label: 'W22 · May 26 – Jun 1',
    kpis: [
      { label: 'Systems Shipped', value: '32', note: 'Full systems, replacements and upgrades', priority: 1 },
      { label: 'Spare Parts Sent', value: '46', note: 'Released for customer delivery', priority: 1 },
      { label: 'PO Created', value: '74', note: 'Oracle source', priority: 1 },
      { label: 'Installations Completed', value: '11', note: 'Salesforce source', priority: 2 },
      { label: 'Cross-Team Support Hours', value: '126h', note: 'R&D, Defence, Product, Finance and CS', priority: 2 },
      { label: 'Procurement Activity', value: '$284K', note: 'Supplier payments and purchase activity', priority: 2 },
      { label: 'Activities Completed', value: '148', note: 'Weekly operational throughput', priority: 3 },
      { label: 'Projects Advanced', value: '6', note: 'Strategic initiatives moved forward', priority: 3 },
    ],
    supportByDept: [
      { name: 'R&D', hours: 42 },
      { name: 'Defence', hours: 31 },
      { name: 'Product', hours: 22 },
      { name: 'Finance', hours: 18 },
      { name: 'CS', hours: 13 },
    ],
    logistics: [
      { metric: 'Systems Shipped',       value: '0', detail: 'No records this period' },
      { metric: 'Ready to Ship at BAZ',  value: '0', detail: 'No records this period' },
      { metric: 'Customs Clearance',     value: '0', detail: 'No records this period' },
      { metric: 'Spare Parts Sent',      value: '0', detail: 'No records this period' },
      { metric: 'Systems In Assembly',   value: '0', detail: 'No records this period' },
      { metric: 'Pending Deliveries',    value: '0', detail: 'No records this period' },
    ],
    procurement: [
      { metric: 'PO Created', value: '74', detail: 'Oracle purchase orders created this week' },
      { metric: 'Emergency Requests', value: '19', detail: 'Short-notice requests for R&D, Defence and Product' },
      { metric: 'Supplier Payments', value: '$284K', detail: 'Processed together with Finance' },
      { metric: 'Estimated Cost Savings', value: '$18.5K', detail: 'Negotiation, supplier alternatives and bulk planning' },
    ],
    activityByCategory: [
      { name: 'Logistics', value: 32 },
      { name: 'Procurement', value: 41 },
      { name: 'Deployments', value: 18 },
      { name: 'Inventory', value: 24 },
      { name: 'Cross-Team', value: 29 },
    ],
    trend: [
      { week: 'W18', activities: 96 },
      { week: 'W19', activities: 114 },
      { week: 'W20', activities: 102 },
      { week: 'W21', activities: 137 },
      { week: 'W22', activities: 148 },
    ],
    highlights: [
      { title: 'Defence shipment completed', text: 'Urgent procurement, packing coordination and shipment release completed within the same week.', tag: 'Defence' },
      { title: 'MSC installation milestone', text: 'Customer readiness, technician scheduling and installation coordination completed end-to-end.', tag: 'Deployments' },
      { title: 'Critical supplier payment released', text: 'Finance and Operations aligned to release a critical supplier payment and protect delivery timelines.', tag: 'Finance' },
      { title: 'BAZ systems shipment-ready', text: 'Multiple systems were prepared, packed and released from BAZ for customer delivery.', tag: 'Logistics' },
      { title: 'Emergency R&D request supported', text: 'Short-notice components sourced, purchased and delivered to keep an internal project moving.', tag: 'R&D' },
      { title: 'Oracle inventory cleanup completed', text: 'BAZ inventory report reviewed and aligned with Oracle records to improve stock visibility.', tag: 'Inventory' },
    ],
    feed: [
      { date: 'Mon', title: '4 systems released from BAZ', area: 'Logistics', detail: 'Systems packed and moved into shipment-ready status.', owner: 'Yotam Keret', status: 'completed' },
      { date: 'Tue', title: 'Emergency R&D procurement closed', area: 'Procurement', detail: 'Supplier sourced, PO created and ETA secured.', owner: 'Dan Cohen', status: 'completed' },
      { date: 'Wed', title: 'MSC deployment coordination', area: 'Deployments', detail: 'Customer readiness and technician schedule confirmed.', owner: 'Amit Levy', status: 'completed' },
      { date: 'Thu', title: 'Inventory reconciliation', area: 'Inventory', detail: 'BAZ report aligned with Oracle inventory records.', owner: 'Noa Shaked', status: 'completed' },
      { date: 'Fri', title: 'Supplier payment risk removed', area: 'Finance', detail: 'Critical supplier payment released on time, protecting delivery commitments.', owner: 'Yotam Keret', status: 'completed' },
    ],
    exceptions: [
      { type: 'attention', count: 3, label: 'Shipments need coordination', section: 'Logistics' },
      { type: 'overdue', count: 5, label: 'Overdue tasks', section: 'Activity Feed' },
      { type: 'customs', count: 1, label: 'Customs clearance issue', section: 'Logistics' },
      { type: 'waiting', count: 3, label: 'Systems awaiting shipment', section: 'Logistics' },
    ],
  },

  monthly: {
    label: 'May 2025',
    kpis: [
      { label: 'Systems Shipped', value: '127', note: 'Full systems, replacements and upgrades', priority: 1 },
      { label: 'Spare Parts Sent', value: '184', note: 'Released for customer delivery', priority: 1 },
      { label: 'PO Created', value: '298', note: 'Oracle source', priority: 1 },
      { label: 'Installations Completed', value: '43', note: 'Salesforce source', priority: 2 },
      { label: 'Cross-Team Support Hours', value: '498h', note: 'R&D, Defence, Product, Finance and CS', priority: 2 },
      { label: 'Procurement Activity', value: '$1.1M', note: 'Supplier payments and purchase activity', priority: 2 },
      { label: 'Activities Completed', value: '586', note: 'Monthly operational throughput', priority: 3 },
      { label: 'Projects Advanced', value: '24', note: 'Strategic initiatives moved forward', priority: 3 },
    ],
    supportByDept: [
      { name: 'R&D', hours: 168 },
      { name: 'Defence', hours: 124 },
      { name: 'Product', hours: 88 },
      { name: 'Finance', hours: 72 },
      { name: 'CS', hours: 46 },
    ],
    logistics: [
      { metric: 'Systems Shipped', value: '127', detail: 'Full systems, replacements and upgrades' },
      { metric: 'Ready to Ship at BAZ', value: '22', detail: 'Packed and awaiting final release' },
      { metric: 'Customs Clearance', value: '12', detail: 'Shipments currently in active clearance' },
      { metric: 'Spare Parts Sent', value: '184', detail: 'Screens, switches, computers and service kits' },
      { metric: 'Systems In Assembly', value: '18', detail: 'Currently being prepared at workshop' },
      { metric: 'Pending Deliveries', value: '14', detail: 'Awaiting customer confirmation or slot' },
    ],
    procurement: [
      { metric: 'PO Created', value: '298', detail: 'Oracle purchase orders created this month' },
      { metric: 'Emergency Requests', value: '74', detail: 'Short-notice requests for R&D, Defence and Product' },
      { metric: 'Supplier Payments', value: '$1.1M', detail: 'Processed together with Finance' },
      { metric: 'Estimated Cost Savings', value: '$76K', detail: 'Negotiation, supplier alternatives and bulk planning' },
    ],
    activityByCategory: [
      { name: 'Logistics', value: 128 },
      { name: 'Procurement', value: 164 },
      { name: 'Deployments', value: 72 },
      { name: 'Inventory', value: 96 },
      { name: 'Cross-Team', value: 116 },
    ],
    trend: [
      { week: 'Jan', activities: 412 },
      { week: 'Feb', activities: 487 },
      { week: 'Mar', activities: 531 },
      { week: 'Apr', activities: 549 },
      { week: 'May', activities: 586 },
    ],
    highlights: [
      { title: 'Q2 procurement milestone reached', text: 'Operations processed over 1,000 POs in Q2, exceeding the quarterly target by 12%.', tag: 'Procurement' },
      { title: 'MSC full site deployment', text: 'Customer site fully deployed with 3 systems, training completed and handover signed.', tag: 'Deployments' },
      { title: 'BAZ clearance backlog resolved', text: 'All customs-held shipments cleared within the month — no outstanding cases at month end.', tag: 'Logistics' },
      { title: 'R&D support streak', text: 'Operations supported R&D every week of the month — 168 hours of direct engineering support.', tag: 'R&D' },
      { title: 'Supplier payment SLA achieved', text: 'All supplier payments processed within agreed payment windows for the full month.', tag: 'Finance' },
      { title: 'Inventory accuracy improved', text: 'BAZ stock accuracy improved from 87% to 96% after Oracle reconciliation project.', tag: 'Inventory' },
    ],
    feed: [
      { date: 'May 5', title: '12 systems shipped in single week', area: 'Logistics', detail: 'Largest single-week shipment volume of the quarter.', owner: 'Yotam Keret', status: 'completed' },
      { date: 'May 9', title: 'Emergency procurement: defence project', area: 'Procurement', detail: '7 emergency POs closed within 48 hours.', owner: 'Dan Cohen', status: 'completed' },
      { date: 'May 14', title: 'MSC site deployment completed', area: 'Deployments', detail: '3 systems installed, training delivered, handover signed.', owner: 'Amit Levy', status: 'completed' },
      { date: 'May 19', title: 'Customs backlog cleared', area: 'Logistics', detail: 'All 8 pending customs cases resolved.', owner: 'Noa Shaked', status: 'completed' },
      { date: 'May 26', title: 'Month-end supplier payments', area: 'Finance', detail: '$1.1M in supplier payments processed on schedule.', owner: 'Yotam Keret', status: 'completed' },
    ],
    exceptions: [
      { type: 'attention', count: 5, label: 'Shipments need coordination', section: 'Logistics' },
      { type: 'overdue', count: 8, label: 'Overdue tasks', section: 'Activity Feed' },
      { type: 'customs', count: 2, label: 'Customs clearance issues', section: 'Logistics' },
      { type: 'waiting', count: 6, label: 'Systems awaiting shipment', section: 'Logistics' },
    ],
  },

  quarterly: {
    label: 'Q2 2025',
    kpis: [
      { label: 'Systems Shipped', value: '384', note: 'Full systems, replacements and upgrades', priority: 1 },
      { label: 'Spare Parts Sent', value: '542', note: 'Released for customer delivery', priority: 1 },
      { label: 'PO Created', value: '891', note: 'Oracle source', priority: 1 },
      { label: 'Installations Completed', value: '127', note: 'Salesforce source', priority: 2 },
      { label: 'Cross-Team Support Hours', value: '1,496h', note: 'R&D, Defence, Product, Finance and CS', priority: 2 },
      { label: 'Procurement Activity', value: '$3.2M', note: 'Supplier payments and purchase activity', priority: 2 },
      { label: 'Activities Completed', value: '1,763', note: 'Quarterly operational throughput', priority: 3 },
      { label: 'Projects Advanced', value: '71', note: 'Strategic initiatives moved forward', priority: 3 },
    ],
    supportByDept: [
      { name: 'R&D', hours: 504 },
      { name: 'Defence', hours: 372 },
      { name: 'Product', hours: 264 },
      { name: 'Finance', hours: 216 },
      { name: 'CS', hours: 140 },
    ],
    logistics: [
      { metric: 'Systems Shipped', value: '384', detail: 'Full systems, replacements and upgrades' },
      { metric: 'Ready to Ship at BAZ', value: '22', detail: 'Packed and awaiting final release' },
      { metric: 'Customs Clearance', value: '12', detail: 'Shipments currently in active clearance' },
      { metric: 'Spare Parts Sent', value: '542', detail: 'Screens, switches, computers and service kits' },
      { metric: 'Systems In Assembly', value: '18', detail: 'Currently being prepared at workshop' },
      { metric: 'Pending Deliveries', value: '14', detail: 'Awaiting customer confirmation or slot' },
    ],
    procurement: [
      { metric: 'PO Created', value: '891', detail: 'Oracle purchase orders created this quarter' },
      { metric: 'Emergency Requests', value: '218', detail: 'Short-notice requests for R&D, Defence and Product' },
      { metric: 'Supplier Payments', value: '$3.2M', detail: 'Processed together with Finance' },
      { metric: 'Estimated Cost Savings', value: '$228K', detail: 'Negotiation, supplier alternatives and bulk planning' },
    ],
    activityByCategory: [
      { name: 'Logistics', value: 384 },
      { name: 'Procurement', value: 492 },
      { name: 'Deployments', value: 216 },
      { name: 'Inventory', value: 288 },
      { name: 'Cross-Team', value: 348 },
    ],
    trend: [
      { week: 'Q3\'24', activities: 1482 },
      { week: 'Q4\'24', activities: 1621 },
      { week: 'Q1\'25', activities: 1587 },
      { week: 'Q2\'25', activities: 1763 },
    ],
    highlights: [
      { title: 'Q2 record shipment volume', text: '384 systems shipped — highest quarterly volume in company history.', tag: 'Logistics' },
      { title: 'Enterprise contract fulfilment', text: 'All Q2 committed deliveries fulfilled on time, zero SLA breaches.', tag: 'Deployments' },
      { title: 'Procurement efficiency gains', text: 'Average PO-to-delivery time reduced from 14 days to 9 days across Q2.', tag: 'Procurement' },
      { title: 'Cross-functional support record', text: '1,496 hours of direct department support — up 18% from Q1.', tag: 'R&D' },
      { title: 'Supplier base expanded', text: '12 new approved suppliers added, reducing single-source dependency risks.', tag: 'Finance' },
      { title: 'BAZ zero-loss quarter', text: 'Full inventory accuracy maintained throughout Q2 — no loss events recorded.', tag: 'Inventory' },
    ],
    feed: [
      { date: 'Apr 2', title: 'Q2 operations kickoff', area: 'Operations', detail: 'Quarter plan locked, priorities aligned with leadership.', owner: 'Yotam Keret', status: 'completed' },
      { date: 'Apr 18', title: 'Enterprise batch shipment', area: 'Logistics', detail: '28 systems shipped to 3 enterprise customers in one week.', owner: 'Dan Cohen', status: 'completed' },
      { date: 'May 5', title: 'Procurement partner review', area: 'Procurement', detail: '8 suppliers reviewed, 3 contracts renegotiated for Q3 savings.', owner: 'Amit Levy', status: 'completed' },
      { date: 'May 21', title: 'Regional deployment complete', area: 'Deployments', detail: '6 customer sites deployed across 3 countries.', owner: 'Noa Shaked', status: 'completed' },
      { date: 'Jun 1', title: 'Q2 inventory close', area: 'Inventory', detail: 'BAZ full stock count completed — 96% accuracy achieved.', owner: 'Yotam Keret', status: 'completed' },
    ],
    exceptions: [
      { type: 'attention', count: 8, label: 'Shipments need coordination', section: 'Logistics' },
      { type: 'overdue', count: 12, label: 'Overdue tasks', section: 'Activity Feed' },
      { type: 'customs', count: 3, label: 'Customs clearance issues', section: 'Logistics' },
      { type: 'waiting', count: 9, label: 'Systems awaiting shipment', section: 'Logistics' },
    ],
  },
};

export const teamPulseStatus = [
  { name: 'Rami Moscovich',  submitted: true, lastUpdated: null },
  { name: 'Yotam Keret',     submitted: true, lastUpdated: null },
  { name: 'Amir Meiri',      submitted: true, lastUpdated: null },
  { name: 'Yaron Yahbes',    submitted: true, lastUpdated: null },
  { name: 'Leon Gutnik',     submitted: true, lastUpdated: null },
  { name: 'Zohar Bar',       submitted: true, lastUpdated: null },
  { name: 'Israel Kalaora',  submitted: true, lastUpdated: null },
  { name: 'Jacob Reingold',  submitted: true, lastUpdated: null },
  { name: 'Tal Matza',       submitted: true, lastUpdated: null },
  { name: 'Guy Hadad',       submitted: true, lastUpdated: null },
];

export type KPIRecord = {
  id: string;
  name: string;
  counterparty?: string;
  counterpartyType?: 'Customer' | 'Supplier' | 'Department';
  owner: string;
  status: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  date: string;
  lastUpdated: string;
  notes?: string;
};

export const kpiRecords: Record<string, Record<Period, KPIRecord[]>> = {

  'Systems Shipped': {
    weekly: [
      { id: 'SHIP-2201', name: 'System 118 – Full Unit', counterparty: 'Frontier Defense Systems', counterpartyType: 'Customer', owner: 'Yotam Keret', status: 'delivered', priority: 'high', date: 'May 27', lastUpdated: '1d ago' },
      { id: 'SHIP-2202', name: 'System 119 – Replacement', counterparty: 'Meridian Security Corp', counterpartyType: 'Customer', owner: 'Dan Cohen', status: 'delivered', priority: 'medium', date: 'May 26', lastUpdated: '2d ago' },
      { id: 'SHIP-2203', name: 'System 120 – Upgrade Kit', counterparty: 'Apex Operations Ltd', counterpartyType: 'Customer', owner: 'Amit Levy', status: 'in-transit', priority: 'medium', date: 'May 28', lastUpdated: '8h ago' },
      { id: 'SHIP-2204', name: 'System 121 + 122 – Batch (2)', counterparty: 'Centuria Intelligence', counterpartyType: 'Customer', owner: 'Noa Shaked', status: 'delivered', priority: 'high', date: 'May 25', lastUpdated: '2d ago' },
      { id: 'SHIP-2205', name: 'System 123 – New Unit', counterparty: 'Orion Systems Group', counterpartyType: 'Customer', owner: 'Yotam Keret', status: 'delivered', priority: 'high', date: 'May 26', lastUpdated: '1d ago' },
      { id: 'SHIP-2206', name: 'System 124 – New Unit', counterparty: 'Horizon Defense Ltd', counterpartyType: 'Customer', owner: 'Dan Cohen', status: 'customs-hold', priority: 'critical', date: 'May 24', lastUpdated: '3d ago', notes: 'Customs hold — documentation incomplete' },
      { id: 'SHIP-2207', name: 'Systems 125–128 – Batch (4)', counterparty: 'Zenith Command', counterpartyType: 'Customer', owner: 'Amit Levy', status: 'delivered', priority: 'high', date: 'May 27', lastUpdated: '18h ago' },
      { id: 'SHIP-2208', name: 'Spare Parts Kit – 3 units', counterparty: 'Vanguard Tech', counterpartyType: 'Customer', owner: 'Noa Shaked', status: 'delivered', priority: 'medium', date: 'May 26', lastUpdated: '1d ago' },
    ],
    monthly: [
      { id: 'SHIP-2175', name: 'System 109 + 110 – Batch (2)', counterparty: 'Stratos Security', counterpartyType: 'Customer', owner: 'Yotam Keret', status: 'delivered', priority: 'high', date: 'May 6', lastUpdated: '3w ago' },
      { id: 'SHIP-2179', name: 'Systems 111–113 – Batch (3)', counterparty: 'Citadel Corp', counterpartyType: 'Customer', owner: 'Dan Cohen', status: 'delivered', priority: 'high', date: 'May 9', lastUpdated: '3w ago' },
      { id: 'SHIP-2183', name: 'System 114 – Replacement', counterparty: 'Alpha Defense Ltd', counterpartyType: 'Customer', owner: 'Amit Levy', status: 'delivered', priority: 'medium', date: 'May 12', lastUpdated: '2w ago' },
      { id: 'SHIP-2187', name: 'System 115 – Full Unit', counterparty: 'Beta Systems Inc', counterpartyType: 'Customer', owner: 'Noa Shaked', status: 'delivered', priority: 'high', date: 'May 14', lastUpdated: '2w ago' },
      { id: 'SHIP-2191', name: 'Spare Parts Kit – 8 units', counterparty: 'Meridian Security Corp', counterpartyType: 'Customer', owner: 'Dan Cohen', status: 'delivered', priority: 'medium', date: 'May 19', lastUpdated: '1w ago' },
      { id: 'SHIP-2194', name: 'Systems 116 + 117 – Batch (2)', counterparty: 'Centuria Intelligence', counterpartyType: 'Customer', owner: 'Noa Shaked', status: 'delivered', priority: 'high', date: 'May 22', lastUpdated: '6d ago' },
      { id: 'SHIP-2201', name: 'System 118 – Full Unit', counterparty: 'Frontier Defense Systems', counterpartyType: 'Customer', owner: 'Yotam Keret', status: 'delivered', priority: 'high', date: 'May 27', lastUpdated: '1d ago' },
      { id: 'SHIP-2203', name: 'System 120 – Upgrade Kit', counterparty: 'Apex Operations Ltd', counterpartyType: 'Customer', owner: 'Amit Levy', status: 'in-transit', priority: 'medium', date: 'May 28', lastUpdated: '8h ago' },
      { id: 'SHIP-2206', name: 'System 124 – New Unit', counterparty: 'Horizon Defense Ltd', counterpartyType: 'Customer', owner: 'Dan Cohen', status: 'customs-hold', priority: 'critical', date: 'May 24', lastUpdated: '3d ago', notes: 'Customs hold — documentation incomplete' },
      { id: 'SHIP-2207', name: 'Systems 125–128 – Batch (4)', counterparty: 'Zenith Command', counterpartyType: 'Customer', owner: 'Amit Levy', status: 'delivered', priority: 'high', date: 'May 27', lastUpdated: '18h ago' },
    ],
    quarterly: [
      { id: 'SHIP-2101', name: 'Systems 82–86 – Enterprise Batch (5)', counterparty: 'Citadel Corp', counterpartyType: 'Customer', owner: 'Yotam Keret', status: 'delivered', priority: 'high', date: 'Apr 7', lastUpdated: '8w ago' },
      { id: 'SHIP-2110', name: 'System 87 – New Site Setup', counterparty: 'Frontier Defense Systems', counterpartyType: 'Customer', owner: 'Dan Cohen', status: 'delivered', priority: 'high', date: 'Apr 14', lastUpdated: '7w ago' },
      { id: 'SHIP-2118', name: 'Systems 88–90 – Regional Batch (3)', counterparty: 'Stratos Security', counterpartyType: 'Customer', owner: 'Amit Levy', status: 'delivered', priority: 'high', date: 'Apr 21', lastUpdated: '6w ago' },
      { id: 'SHIP-2126', name: 'System 91 – Upgrade Kit', counterparty: 'Orion Systems Group', counterpartyType: 'Customer', owner: 'Noa Shaked', status: 'delivered', priority: 'medium', date: 'Apr 28', lastUpdated: '5w ago' },
      { id: 'SHIP-2134', name: 'Systems 92–96 – Batch (5)', counterparty: 'Vanguard Tech', counterpartyType: 'Customer', owner: 'Yotam Keret', status: 'delivered', priority: 'high', date: 'May 5', lastUpdated: '4w ago' },
      { id: 'SHIP-2141', name: 'System 97 – Replacement', counterparty: 'Alpha Defense Ltd', counterpartyType: 'Customer', owner: 'Dan Cohen', status: 'delivered', priority: 'medium', date: 'May 9', lastUpdated: '3w ago' },
      { id: 'SHIP-2147', name: 'Systems 98–101 – Batch (4)', counterparty: 'Centuria Intelligence', counterpartyType: 'Customer', owner: 'Amit Levy', status: 'delivered', priority: 'high', date: 'May 14', lastUpdated: '2w ago' },
      { id: 'SHIP-2156', name: 'Systems 102–106 – Enterprise Batch (5)', counterparty: 'Citadel Corp', counterpartyType: 'Customer', owner: 'Noa Shaked', status: 'delivered', priority: 'high', date: 'May 19', lastUpdated: '1w ago' },
      { id: 'SHIP-2194', name: 'Systems 116 + 117 – Batch (2)', counterparty: 'Beta Systems Inc', counterpartyType: 'Customer', owner: 'Yotam Keret', status: 'delivered', priority: 'high', date: 'May 22', lastUpdated: '6d ago' },
      { id: 'SHIP-2201', name: 'System 118 – Full Unit', counterparty: 'Frontier Defense Systems', counterpartyType: 'Customer', owner: 'Yotam Keret', status: 'delivered', priority: 'high', date: 'May 27', lastUpdated: '1d ago' },
      { id: 'SHIP-2203', name: 'System 120 – Upgrade Kit', counterparty: 'Apex Operations Ltd', counterpartyType: 'Customer', owner: 'Amit Levy', status: 'in-transit', priority: 'medium', date: 'May 28', lastUpdated: '8h ago' },
      { id: 'SHIP-2206', name: 'System 124 – New Unit', counterparty: 'Horizon Defense Ltd', counterpartyType: 'Customer', owner: 'Dan Cohen', status: 'customs-hold', priority: 'critical', date: 'May 24', lastUpdated: '3d ago', notes: 'Customs hold — documentation incomplete' },
    ],
  },

  'Spare Parts Sent': {
    weekly: [
      { id: 'PARTS-W01', name: 'Screen replacement kit – 4 units', counterparty: 'Frontier Defense Systems', counterpartyType: 'Customer', owner: 'Yotam Keret', status: 'delivered', priority: 'high', date: 'May 27', lastUpdated: '1d ago' },
      { id: 'PARTS-W02', name: 'Switch module batch – 6 units', counterparty: 'Centuria Intelligence', counterpartyType: 'Customer', owner: 'Dan Cohen', status: 'delivered', priority: 'medium', date: 'May 26', lastUpdated: '2d ago' },
      { id: 'PARTS-W03', name: 'Computer assembly kit – System 120', counterparty: 'Apex Operations Ltd', counterpartyType: 'Customer', owner: 'Amit Levy', status: 'delivered', priority: 'medium', date: 'May 26', lastUpdated: '2d ago' },
      { id: 'PARTS-W04', name: 'Full service kit – Zenith Site C', counterparty: 'Zenith Command', counterpartyType: 'Customer', owner: 'Noa Shaked', status: 'delivered', priority: 'high', date: 'May 27', lastUpdated: '18h ago' },
      { id: 'PARTS-W05', name: 'Screen + switch bundle – 3 units', counterparty: 'Orion Systems Group', counterpartyType: 'Customer', owner: 'Yotam Keret', status: 'delivered', priority: 'medium', date: 'May 25', lastUpdated: '2d ago' },
      { id: 'PARTS-W06', name: 'Emergency R&D components – Elektra', counterparty: 'R&D', counterpartyType: 'Department', owner: 'Amit Levy', status: 'delivered', priority: 'critical', date: 'May 27', lastUpdated: '14h ago' },
      { id: 'PARTS-W07', name: 'BAZ replenishment kit – mixed batch', counterparty: 'Operations', counterpartyType: 'Department', owner: 'Dan Cohen', status: 'delivered', priority: 'medium', date: 'May 24', lastUpdated: '3d ago' },
      { id: 'PARTS-W08', name: 'Customer onsite spare kit – Vanguard', counterparty: 'Vanguard Tech', counterpartyType: 'Customer', owner: 'Noa Shaked', status: 'in-transit', priority: 'medium', date: 'May 28', lastUpdated: '8h ago' },
    ],
    monthly: [
      { id: 'PARTS-M01', name: 'Bulk screen batch – 18 units', counterparty: 'Citadel Corp', counterpartyType: 'Customer', owner: 'Dan Cohen', status: 'delivered', priority: 'high', date: 'May 7', lastUpdated: '3w ago' },
      { id: 'PARTS-M02', name: 'Switch module batch – 24 units', counterparty: 'Stratos Security', counterpartyType: 'Customer', owner: 'Yotam Keret', status: 'delivered', priority: 'high', date: 'May 12', lastUpdated: '2w ago' },
      { id: 'PARTS-M03', name: 'R&D lab components – monthly run', counterparty: 'R&D', counterpartyType: 'Department', owner: 'Amit Levy', status: 'delivered', priority: 'high', date: 'May 14', lastUpdated: '2w ago' },
      { id: 'PARTS-M04', name: 'Service kits batch – 8 customers', counterparty: 'Meridian Security Corp', counterpartyType: 'Customer', owner: 'Noa Shaked', status: 'delivered', priority: 'medium', date: 'May 19', lastUpdated: '1w ago' },
      { id: 'PARTS-M05', name: 'Assembly components – Systems 116–117', counterparty: 'Centuria Intelligence', counterpartyType: 'Customer', owner: 'Dan Cohen', status: 'delivered', priority: 'high', date: 'May 22', lastUpdated: '6d ago' },
      { id: 'PARTS-M06', name: 'Screen replacement kit – 4 units', counterparty: 'Frontier Defense Systems', counterpartyType: 'Customer', owner: 'Yotam Keret', status: 'delivered', priority: 'high', date: 'May 27', lastUpdated: '1d ago' },
      { id: 'PARTS-M07', name: 'Customer onsite spare kit – Vanguard', counterparty: 'Vanguard Tech', counterpartyType: 'Customer', owner: 'Noa Shaked', status: 'in-transit', priority: 'medium', date: 'May 28', lastUpdated: '8h ago' },
    ],
    quarterly: [
      { id: 'PARTS-Q01', name: 'Q2 opener – screen batch x40', counterparty: 'Citadel Corp', counterpartyType: 'Customer', owner: 'Yotam Keret', status: 'delivered', priority: 'high', date: 'Apr 4', lastUpdated: '8w ago' },
      { id: 'PARTS-Q02', name: 'Defence strategic stockpile – switches', counterparty: 'Defence', counterpartyType: 'Department', owner: 'Dan Cohen', status: 'delivered', priority: 'high', date: 'Apr 14', lastUpdated: '7w ago' },
      { id: 'PARTS-Q03', name: 'R&D quarterly component suite', counterparty: 'R&D', counterpartyType: 'Department', owner: 'Amit Levy', status: 'delivered', priority: 'high', date: 'Apr 22', lastUpdated: '6w ago' },
      { id: 'PARTS-Q04', name: 'Regional deployment pre-ship kits x6', counterparty: 'Stratos Security', counterpartyType: 'Customer', owner: 'Noa Shaked', status: 'delivered', priority: 'high', date: 'May 5', lastUpdated: '4w ago' },
      { id: 'PARTS-Q05', name: 'BAZ Q2 full replenishment – mixed', counterparty: 'Operations', counterpartyType: 'Department', owner: 'Yotam Keret', status: 'delivered', priority: 'medium', date: 'May 9', lastUpdated: '3w ago' },
      { id: 'PARTS-Q06', name: 'Bulk screen batch – 18 units', counterparty: 'Citadel Corp', counterpartyType: 'Customer', owner: 'Dan Cohen', status: 'delivered', priority: 'high', date: 'May 7', lastUpdated: '3w ago' },
      { id: 'PARTS-Q07', name: 'Assembly components – Systems 116–117', counterparty: 'Centuria Intelligence', counterpartyType: 'Customer', owner: 'Dan Cohen', status: 'delivered', priority: 'high', date: 'May 22', lastUpdated: '6d ago' },
      { id: 'PARTS-Q08', name: 'Customer onsite spare kit – Vanguard', counterparty: 'Vanguard Tech', counterpartyType: 'Customer', owner: 'Noa Shaked', status: 'in-transit', priority: 'medium', date: 'May 28', lastUpdated: '8h ago' },
    ],
  },

  'PO Created': {
    weekly: [
      { id: 'PO-4571', name: 'Emergency R&D components – urgent', counterparty: 'Elektra Components GmbH', counterpartyType: 'Supplier', owner: 'Amit Levy', status: 'approved', priority: 'critical', date: 'May 27', lastUpdated: '14h ago', notes: 'Amount: $12,400' },
      { id: 'PO-4572', name: 'BAZ spare parts replenishment', counterparty: 'Pacific Parts Direct', counterpartyType: 'Supplier', owner: 'Dan Cohen', status: 'approved', priority: 'high', date: 'May 27', lastUpdated: '16h ago', notes: 'Amount: $8,200' },
      { id: 'PO-4573', name: 'System 120 assembly components', counterparty: 'GlobalTech Supply', counterpartyType: 'Supplier', owner: 'Yotam Keret', status: 'pending-approval', priority: 'high', date: 'May 26', lastUpdated: '1d ago', notes: 'Amount: $34,000' },
      { id: 'PO-4574', name: 'Defence project materials – Q2', counterparty: 'Meridian Electronics', counterpartyType: 'Supplier', owner: 'Noa Shaked', status: 'approved', priority: 'critical', date: 'May 25', lastUpdated: '2d ago', notes: 'Amount: $56,000' },
      { id: 'PO-4575', name: 'Inventory replenishment – screens', counterparty: 'Core Components Ltd', counterpartyType: 'Supplier', owner: 'Dan Cohen', status: 'approved', priority: 'medium', date: 'May 24', lastUpdated: '3d ago', notes: 'Amount: $9,600' },
      { id: 'PO-4576', name: 'Customer site spare kit – Frontier', counterparty: 'FastTrack Logistics', counterpartyType: 'Supplier', owner: 'Amit Levy', status: 'approved', priority: 'high', date: 'May 26', lastUpdated: '22h ago', notes: 'Amount: $14,800' },
      { id: 'PO-4577', name: 'Product team support materials', counterparty: 'Precision Parts Co', counterpartyType: 'Supplier', owner: 'Yotam Keret', status: 'approved', priority: 'high', date: 'May 27', lastUpdated: '12h ago', notes: 'Amount: $7,100' },
      { id: 'PO-4578', name: 'Routine supplies – switches batch', counterparty: 'Allied Materials', counterpartyType: 'Supplier', owner: 'Noa Shaked', status: 'pending-approval', priority: 'low', date: 'May 28', lastUpdated: '4h ago', notes: 'Amount: $4,300' },
    ],
    monthly: [
      { id: 'PO-4421', name: 'Q2 R&D component framework deal', counterparty: 'Elektra Components GmbH', counterpartyType: 'Supplier', owner: 'Amit Levy', status: 'approved', priority: 'high', date: 'May 3', lastUpdated: '4w ago', notes: 'Amount: $86,000 — monthly framework' },
      { id: 'PO-4438', name: 'BAZ full restocking – Q2', counterparty: 'Pacific Parts Direct', counterpartyType: 'Supplier', owner: 'Dan Cohen', status: 'approved', priority: 'high', date: 'May 8', lastUpdated: '3w ago', notes: 'Amount: $42,000' },
      { id: 'PO-4452', name: 'Defence urgent batch – 3 lines', counterparty: 'Meridian Electronics', counterpartyType: 'Supplier', owner: 'Noa Shaked', status: 'approved', priority: 'critical', date: 'May 12', lastUpdated: '2w ago', notes: 'Amount: $118,000' },
      { id: 'PO-4467', name: 'System 115–117 components', counterparty: 'GlobalTech Supply', counterpartyType: 'Supplier', owner: 'Yotam Keret', status: 'approved', priority: 'high', date: 'May 16', lastUpdated: '2w ago', notes: 'Amount: $74,000' },
      { id: 'PO-4491', name: 'Preventive maintenance kits', counterparty: 'Core Components Ltd', counterpartyType: 'Supplier', owner: 'Dan Cohen', status: 'approved', priority: 'medium', date: 'May 20', lastUpdated: '1w ago', notes: 'Amount: $28,500' },
      { id: 'PO-4510', name: 'Customer pre-ship spare kits x4', counterparty: 'FastTrack Logistics', counterpartyType: 'Supplier', owner: 'Amit Levy', status: 'approved', priority: 'high', date: 'May 23', lastUpdated: '5d ago', notes: 'Amount: $32,000' },
      { id: 'PO-4571', name: 'Emergency R&D components – urgent', counterparty: 'Elektra Components GmbH', counterpartyType: 'Supplier', owner: 'Amit Levy', status: 'approved', priority: 'critical', date: 'May 27', lastUpdated: '14h ago', notes: 'Amount: $12,400' },
      { id: 'PO-4573', name: 'System 120 assembly components', counterparty: 'GlobalTech Supply', counterpartyType: 'Supplier', owner: 'Yotam Keret', status: 'pending-approval', priority: 'high', date: 'May 26', lastUpdated: '1d ago', notes: 'Amount: $34,000' },
    ],
    quarterly: [
      { id: 'PO-4201', name: 'Q2 opener – framework agreement', counterparty: 'Elektra Components GmbH', counterpartyType: 'Supplier', owner: 'Yotam Keret', status: 'approved', priority: 'high', date: 'Apr 2', lastUpdated: '9w ago', notes: 'Amount: $240,000 — quarterly framework' },
      { id: 'PO-4225', name: 'Enterprise batch – Systems 82–90', counterparty: 'GlobalTech Supply', counterpartyType: 'Supplier', owner: 'Dan Cohen', status: 'approved', priority: 'high', date: 'Apr 9', lastUpdated: '8w ago', notes: 'Amount: $310,000' },
      { id: 'PO-4248', name: 'Defence strategic stockpile', counterparty: 'Meridian Electronics', counterpartyType: 'Supplier', owner: 'Noa Shaked', status: 'approved', priority: 'critical', date: 'Apr 17', lastUpdated: '7w ago', notes: 'Amount: $198,000' },
      { id: 'PO-4280', name: 'BAZ Q2 full inventory replenish', counterparty: 'Pacific Parts Direct', counterpartyType: 'Supplier', owner: 'Amit Levy', status: 'approved', priority: 'high', date: 'Apr 25', lastUpdated: '6w ago', notes: 'Amount: $145,000' },
      { id: 'PO-4320', name: 'R&D quarterly component suite', counterparty: 'Core Components Ltd', counterpartyType: 'Supplier', owner: 'Yotam Keret', status: 'approved', priority: 'high', date: 'May 6', lastUpdated: '4w ago', notes: 'Amount: $187,000' },
      { id: 'PO-4452', name: 'Defence urgent batch – 3 lines', counterparty: 'Meridian Electronics', counterpartyType: 'Supplier', owner: 'Noa Shaked', status: 'approved', priority: 'critical', date: 'May 12', lastUpdated: '2w ago', notes: 'Amount: $118,000' },
      { id: 'PO-4510', name: 'Customer pre-ship spare kits x4', counterparty: 'FastTrack Logistics', counterpartyType: 'Supplier', owner: 'Amit Levy', status: 'approved', priority: 'high', date: 'May 23', lastUpdated: '5d ago', notes: 'Amount: $32,000' },
      { id: 'PO-4571', name: 'Emergency R&D components – urgent', counterparty: 'Elektra Components GmbH', counterpartyType: 'Supplier', owner: 'Amit Levy', status: 'approved', priority: 'critical', date: 'May 27', lastUpdated: '14h ago', notes: 'Amount: $12,400' },
    ],
  },

  'Installations Completed': {
    weekly: [
      { id: 'INST-1101', name: 'Frontier – Site Alpha, new install', counterparty: 'Frontier Defense Systems', counterpartyType: 'Customer', owner: 'Eliav Mizrahi', status: 'completed', priority: 'high', date: 'May 26', lastUpdated: '1d ago' },
      { id: 'INST-1102', name: 'Meridian – Site B expansion', counterparty: 'Meridian Security Corp', counterpartyType: 'Customer', owner: 'Amit Levy', status: 'completed', priority: 'high', date: 'May 27', lastUpdated: '18h ago' },
      { id: 'INST-1103', name: 'Apex – System 120 upgrade', counterparty: 'Apex Operations Ltd', counterpartyType: 'Customer', owner: 'Noa Shaked', status: 'completed', priority: 'medium', date: 'May 26', lastUpdated: '1d ago' },
      { id: 'INST-1104', name: 'Centuria – System 98 maintenance', counterparty: 'Centuria Intelligence', counterpartyType: 'Customer', owner: 'Dan Cohen', status: 'completed', priority: 'low', date: 'May 25', lastUpdated: '2d ago' },
      { id: 'INST-1105', name: 'Horizon – System 99 new site', counterparty: 'Horizon Defense Ltd', counterpartyType: 'Customer', owner: 'Yotam Keret', status: 'completed', priority: 'high', date: 'May 26', lastUpdated: '1d ago' },
      { id: 'INST-1106', name: 'Orion – System refresh (3 units)', counterparty: 'Orion Systems Group', counterpartyType: 'Customer', owner: 'Eliav Mizrahi', status: 'completed', priority: 'medium', date: 'May 24', lastUpdated: '3d ago' },
      { id: 'INST-1107', name: 'Zenith – Site C deployment', counterparty: 'Zenith Command', counterpartyType: 'Customer', owner: 'Amit Levy', status: 'completed', priority: 'high', date: 'May 27', lastUpdated: '20h ago' },
      { id: 'INST-1108', name: 'Vanguard – System 102 upgrade', counterparty: 'Vanguard Tech', counterpartyType: 'Customer', owner: 'Dan Cohen', status: 'completed', priority: 'medium', date: 'May 28', lastUpdated: '8h ago' },
      { id: 'INST-1109', name: 'Stratos – new installation', counterparty: 'Stratos Security', counterpartyType: 'Customer', owner: 'Noa Shaked', status: 'completed', priority: 'high', date: 'May 26', lastUpdated: '1d ago' },
      { id: 'INST-1110', name: 'Citadel – site expansion (2 units)', counterparty: 'Citadel Corp', counterpartyType: 'Customer', owner: 'Yotam Keret', status: 'completed', priority: 'high', date: 'May 25', lastUpdated: '2d ago' },
      { id: 'INST-1111', name: 'Alpha Defense – Site II setup', counterparty: 'Alpha Defense Ltd', counterpartyType: 'Customer', owner: 'Eliav Mizrahi', status: 'completed', priority: 'medium', date: 'May 26', lastUpdated: '30h ago' },
    ],
    monthly: [
      { id: 'INST-1068', name: 'Beta Systems – Site A full deploy', counterparty: 'Beta Systems Inc', counterpartyType: 'Customer', owner: 'Yotam Keret', status: 'completed', priority: 'high', date: 'May 5', lastUpdated: '4w ago' },
      { id: 'INST-1074', name: 'Frontier – Site Beta expansion', counterparty: 'Frontier Defense Systems', counterpartyType: 'Customer', owner: 'Amit Levy', status: 'completed', priority: 'high', date: 'May 8', lastUpdated: '3w ago' },
      { id: 'INST-1081', name: 'Sigma – preventive maintenance x3', counterparty: 'Sigma Defense', counterpartyType: 'Customer', owner: 'Dan Cohen', status: 'completed', priority: 'medium', date: 'May 12', lastUpdated: '2w ago' },
      { id: 'INST-1086', name: 'Orion – System 97 replacement', counterparty: 'Orion Systems Group', counterpartyType: 'Customer', owner: 'Noa Shaked', status: 'completed', priority: 'high', date: 'May 15', lastUpdated: '2w ago' },
      { id: 'INST-1092', name: 'Omega – 4-unit customer site', counterparty: 'Omega Systems', counterpartyType: 'Customer', owner: 'Eliav Mizrahi', status: 'completed', priority: 'high', date: 'May 19', lastUpdated: '1w ago' },
      { id: 'INST-1098', name: 'Citadel – Systems 100-101 install', counterparty: 'Citadel Corp', counterpartyType: 'Customer', owner: 'Yotam Keret', status: 'completed', priority: 'high', date: 'May 22', lastUpdated: '6d ago' },
      { id: 'INST-1101', name: 'Frontier – Site Alpha, new install', counterparty: 'Frontier Defense Systems', counterpartyType: 'Customer', owner: 'Eliav Mizrahi', status: 'completed', priority: 'high', date: 'May 26', lastUpdated: '1d ago' },
      { id: 'INST-1107', name: 'Zenith – Site C deployment', counterparty: 'Zenith Command', counterpartyType: 'Customer', owner: 'Amit Levy', status: 'completed', priority: 'high', date: 'May 27', lastUpdated: '20h ago' },
    ],
    quarterly: [
      { id: 'INST-1012', name: 'Stratos – Q2 regional rollout (4 sites)', counterparty: 'Stratos Security', counterpartyType: 'Customer', owner: 'Yotam Keret', status: 'completed', priority: 'high', date: 'Apr 8', lastUpdated: '8w ago' },
      { id: 'INST-1028', name: 'Citadel – enterprise batch deployment', counterparty: 'Citadel Corp', counterpartyType: 'Customer', owner: 'Dan Cohen', status: 'completed', priority: 'high', date: 'Apr 17', lastUpdated: '7w ago' },
      { id: 'INST-1041', name: 'Sigma – 3 sites maintenance sweep', counterparty: 'Sigma Defense', counterpartyType: 'Customer', owner: 'Noa Shaked', status: 'completed', priority: 'medium', date: 'Apr 25', lastUpdated: '6w ago' },
      { id: 'INST-1056', name: 'Orion – new customer site x2', counterparty: 'Orion Systems Group', counterpartyType: 'Customer', owner: 'Amit Levy', status: 'completed', priority: 'high', date: 'May 5', lastUpdated: '4w ago' },
      { id: 'INST-1068', name: 'Beta Systems – Site A full deploy', counterparty: 'Beta Systems Inc', counterpartyType: 'Customer', owner: 'Yotam Keret', status: 'completed', priority: 'high', date: 'May 5', lastUpdated: '4w ago' },
      { id: 'INST-1086', name: 'Orion – System 97 replacement', counterparty: 'Orion Systems Group', counterpartyType: 'Customer', owner: 'Noa Shaked', status: 'completed', priority: 'high', date: 'May 15', lastUpdated: '2w ago' },
      { id: 'INST-1092', name: 'Omega – 4-unit customer site', counterparty: 'Omega Systems', counterpartyType: 'Customer', owner: 'Eliav Mizrahi', status: 'completed', priority: 'high', date: 'May 19', lastUpdated: '1w ago' },
      { id: 'INST-1101', name: 'Frontier – Site Alpha, new install', counterparty: 'Frontier Defense Systems', counterpartyType: 'Customer', owner: 'Eliav Mizrahi', status: 'completed', priority: 'high', date: 'May 26', lastUpdated: '1d ago' },
    ],
  },

  'Cross-Team Support Hours': {
    weekly: [
      { id: 'SUP-801', name: 'R&D – emergency component sourcing', counterparty: 'R&D', counterpartyType: 'Department', owner: 'Amit Levy', status: 'completed', priority: 'critical', date: 'May 25–27', lastUpdated: '1d ago', notes: '16h — sourced 4 components under 24h' },
      { id: 'SUP-802', name: 'R&D – prototype testing coordination', counterparty: 'R&D', counterpartyType: 'Department', owner: 'Yotam Keret', status: 'completed', priority: 'high', date: 'May 26', lastUpdated: '1d ago', notes: '14h — test equipment procurement and setup' },
      { id: 'SUP-803', name: 'R&D – lab supply run', counterparty: 'R&D', counterpartyType: 'Department', owner: 'Dan Cohen', status: 'completed', priority: 'medium', date: 'May 24–25', lastUpdated: '3d ago', notes: '12h — 8 items sourced and delivered' },
      { id: 'SUP-804', name: 'Defence – shipment coordination', counterparty: 'Defence', counterpartyType: 'Department', owner: 'Noa Shaked', status: 'completed', priority: 'critical', date: 'May 25–27', lastUpdated: '18h ago', notes: '18h — end-to-end logistics for urgent Defence shipment' },
      { id: 'SUP-805', name: 'Defence – procurement support', counterparty: 'Defence', counterpartyType: 'Department', owner: 'Yotam Keret', status: 'completed', priority: 'high', date: 'May 26–27', lastUpdated: '1d ago', notes: '13h — 4 POs raised and approved same day' },
      { id: 'SUP-806', name: 'Product – materials for roadmap demo', counterparty: 'Product', counterpartyType: 'Department', owner: 'Dan Cohen', status: 'completed', priority: 'medium', date: 'May 24–28', lastUpdated: '8h ago', notes: '22h — 3 kits prepared for internal showcase' },
      { id: 'SUP-807', name: 'Finance – supplier payment processing', counterparty: 'Finance', counterpartyType: 'Department', owner: 'Amit Levy', status: 'completed', priority: 'high', date: 'May 26–27', lastUpdated: '1d ago', notes: '18h — coordinated $284K payment batch with Finance' },
      { id: 'SUP-808', name: 'CS – customer handover support', counterparty: 'Customer Success', counterpartyType: 'Department', owner: 'Noa Shaked', status: 'completed', priority: 'medium', date: 'May 27–28', lastUpdated: '8h ago', notes: '13h — coordinated delivery docs for 3 customers' },
    ],
    monthly: [
      { id: 'SUP-762', name: 'R&D – monthly component framework', counterparty: 'R&D', counterpartyType: 'Department', owner: 'Yotam Keret', status: 'completed', priority: 'high', date: 'May 1–30', lastUpdated: '1d ago', notes: '168h total — ongoing sprint support' },
      { id: 'SUP-770', name: 'Defence – Q2 logistics sprint', counterparty: 'Defence', counterpartyType: 'Department', owner: 'Dan Cohen', status: 'completed', priority: 'critical', date: 'May 5–28', lastUpdated: '1d ago', notes: '124h — peak project delivery period' },
      { id: 'SUP-778', name: 'Product – roadmap enablement', counterparty: 'Product', counterpartyType: 'Department', owner: 'Amit Levy', status: 'completed', priority: 'medium', date: 'May 8–28', lastUpdated: '1d ago', notes: '88h — spec reviews and prototype materials' },
      { id: 'SUP-785', name: 'Finance – payment cycles x4', counterparty: 'Finance', counterpartyType: 'Department', owner: 'Noa Shaked', status: 'completed', priority: 'high', date: 'May 1–30', lastUpdated: '1d ago', notes: '72h — 4 payment runs coordinated' },
      { id: 'SUP-791', name: 'CS – customer delivery coordination', counterparty: 'Customer Success', counterpartyType: 'Department', owner: 'Eliav Mizrahi', status: 'completed', priority: 'medium', date: 'May 6–28', lastUpdated: '1d ago', notes: '46h — 8 customer handovers supported' },
    ],
    quarterly: [
      { id: 'SUP-701', name: 'R&D – Q2 full engineering support', counterparty: 'R&D', counterpartyType: 'Department', owner: 'Yotam Keret', status: 'completed', priority: 'high', date: 'Apr–Jun', lastUpdated: '1d ago', notes: '504h — highest quarterly support volume' },
      { id: 'SUP-712', name: 'Defence – strategic project support', counterparty: 'Defence', counterpartyType: 'Department', owner: 'Dan Cohen', status: 'completed', priority: 'critical', date: 'Apr–Jun', lastUpdated: '1d ago', notes: '372h — 3 major procurement programmes' },
      { id: 'SUP-723', name: 'Product – Q2 roadmap enablement', counterparty: 'Product', counterpartyType: 'Department', owner: 'Amit Levy', status: 'completed', priority: 'medium', date: 'Apr–Jun', lastUpdated: '1d ago', notes: '264h — 2 product launches supported' },
      { id: 'SUP-734', name: 'Finance – quarterly payment cycles', counterparty: 'Finance', counterpartyType: 'Department', owner: 'Noa Shaked', status: 'completed', priority: 'high', date: 'Apr–Jun', lastUpdated: '1d ago', notes: '216h — $3.2M in payments coordinated' },
      { id: 'SUP-745', name: 'CS – quarterly customer onboarding', counterparty: 'Customer Success', counterpartyType: 'Department', owner: 'Eliav Mizrahi', status: 'completed', priority: 'medium', date: 'Apr–Jun', lastUpdated: '1d ago', notes: '140h — 54 customer touchpoints' },
    ],
  },

  'Procurement Activity': {
    weekly: [
      { id: 'PAY-701', name: 'Q2 framework settlement – Elektra', counterparty: 'Elektra Components GmbH', counterpartyType: 'Supplier', owner: 'Yotam Keret', status: 'paid', priority: 'high', date: 'May 26', lastUpdated: '1d ago', notes: 'Amount: $84,000' },
      { id: 'PAY-702', name: 'Emergency parts – Pacific Parts', counterparty: 'Pacific Parts Direct', counterpartyType: 'Supplier', owner: 'Dan Cohen', status: 'paid', priority: 'critical', date: 'May 27', lastUpdated: '18h ago', notes: 'Amount: $12,400' },
      { id: 'PAY-703', name: 'System 120 components – GlobalTech', counterparty: 'GlobalTech Supply', counterpartyType: 'Supplier', owner: 'Amit Levy', status: 'pending', priority: 'medium', date: 'Due May 30', lastUpdated: '8h ago', notes: 'Amount: $44,000' },
      { id: 'PAY-704', name: 'Defence project invoice – Meridian', counterparty: 'Meridian Electronics', counterpartyType: 'Supplier', owner: 'Noa Shaked', status: 'paid', priority: 'critical', date: 'May 25', lastUpdated: '2d ago', notes: 'Amount: $56,000' },
      { id: 'PAY-705', name: 'BAZ restocking – Core Components', counterparty: 'Core Components Ltd', counterpartyType: 'Supplier', owner: 'Dan Cohen', status: 'paid', priority: 'medium', date: 'May 24', lastUpdated: '3d ago', notes: 'Amount: $28,000' },
      { id: 'PAY-706', name: 'Field service parts – FastTrack', counterparty: 'FastTrack Logistics', counterpartyType: 'Supplier', owner: 'Yotam Keret', status: 'paid', priority: 'high', date: 'May 26', lastUpdated: '1d ago', notes: 'Amount: $18,000' },
      { id: 'PAY-707', name: 'Customer kit materials – Precision', counterparty: 'Precision Parts Co', counterpartyType: 'Supplier', owner: 'Amit Levy', status: 'paid', priority: 'high', date: 'May 27', lastUpdated: '12h ago', notes: 'Amount: $22,000' },
      { id: 'PAY-708', name: 'Routine supplies – Allied Materials', counterparty: 'Allied Materials', counterpartyType: 'Supplier', owner: 'Noa Shaked', status: 'pending', priority: 'low', date: 'Due Jun 3', lastUpdated: '4h ago', notes: 'Amount: $20,000' },
    ],
    monthly: [
      { id: 'PAY-660', name: 'Monthly framework – Elektra', counterparty: 'Elektra Components GmbH', counterpartyType: 'Supplier', owner: 'Yotam Keret', status: 'paid', priority: 'high', date: 'May 2', lastUpdated: '4w ago', notes: 'Amount: $240,000' },
      { id: 'PAY-668', name: 'BAZ Q2 restocking – Pacific Parts', counterparty: 'Pacific Parts Direct', counterpartyType: 'Supplier', owner: 'Dan Cohen', status: 'paid', priority: 'high', date: 'May 7', lastUpdated: '3w ago', notes: 'Amount: $188,000' },
      { id: 'PAY-676', name: 'Defence batch invoice – Meridian', counterparty: 'Meridian Electronics', counterpartyType: 'Supplier', owner: 'Noa Shaked', status: 'paid', priority: 'critical', date: 'May 12', lastUpdated: '2w ago', notes: 'Amount: $312,000' },
      { id: 'PAY-683', name: 'Systems 115–117 – GlobalTech', counterparty: 'GlobalTech Supply', counterpartyType: 'Supplier', owner: 'Amit Levy', status: 'paid', priority: 'high', date: 'May 17', lastUpdated: '2w ago', notes: 'Amount: $198,000' },
      { id: 'PAY-690', name: 'Maintenance kits – Core Components', counterparty: 'Core Components Ltd', counterpartyType: 'Supplier', owner: 'Dan Cohen', status: 'paid', priority: 'medium', date: 'May 22', lastUpdated: '6d ago', notes: 'Amount: $86,000' },
      { id: 'PAY-701', name: 'Q2 settlement – Elektra', counterparty: 'Elektra Components GmbH', counterpartyType: 'Supplier', owner: 'Yotam Keret', status: 'paid', priority: 'high', date: 'May 26', lastUpdated: '1d ago', notes: 'Amount: $84,000' },
    ],
    quarterly: [
      { id: 'PAY-601', name: 'Q2 master agreement – Elektra', counterparty: 'Elektra Components GmbH', counterpartyType: 'Supplier', owner: 'Yotam Keret', status: 'paid', priority: 'high', date: 'Apr 1', lastUpdated: '9w ago', notes: 'Amount: $720,000' },
      { id: 'PAY-615', name: 'Enterprise batch – GlobalTech', counterparty: 'GlobalTech Supply', counterpartyType: 'Supplier', owner: 'Dan Cohen', status: 'paid', priority: 'high', date: 'Apr 10', lastUpdated: '8w ago', notes: 'Amount: $580,000' },
      { id: 'PAY-629', name: 'Defence stockpile – Meridian', counterparty: 'Meridian Electronics', counterpartyType: 'Supplier', owner: 'Noa Shaked', status: 'paid', priority: 'critical', date: 'Apr 22', lastUpdated: '7w ago', notes: 'Amount: $640,000' },
      { id: 'PAY-643', name: 'BAZ full replenish – Pacific Parts', counterparty: 'Pacific Parts Direct', counterpartyType: 'Supplier', owner: 'Amit Levy', status: 'paid', priority: 'high', date: 'May 5', lastUpdated: '4w ago', notes: 'Amount: $420,000' },
      { id: 'PAY-660', name: 'Monthly framework – Elektra', counterparty: 'Elektra Components GmbH', counterpartyType: 'Supplier', owner: 'Yotam Keret', status: 'paid', priority: 'high', date: 'May 2', lastUpdated: '4w ago', notes: 'Amount: $240,000' },
      { id: 'PAY-676', name: 'Defence batch invoice – Meridian', counterparty: 'Meridian Electronics', counterpartyType: 'Supplier', owner: 'Noa Shaked', status: 'paid', priority: 'critical', date: 'May 12', lastUpdated: '2w ago', notes: 'Amount: $312,000' },
      { id: 'PAY-701', name: 'Q2 settlement – Elektra', counterparty: 'Elektra Components GmbH', counterpartyType: 'Supplier', owner: 'Yotam Keret', status: 'paid', priority: 'high', date: 'May 26', lastUpdated: '1d ago', notes: 'Amount: $84,000' },
      { id: 'PAY-708', name: 'Routine supplies – Allied Materials', counterparty: 'Allied Materials', counterpartyType: 'Supplier', owner: 'Noa Shaked', status: 'pending', priority: 'low', date: 'Due Jun 3', lastUpdated: '4h ago', notes: 'Amount: $20,000' },
    ],
  },

  'Activities Completed': {
    weekly: [
      { id: 'ACT-1001', name: 'Systems 125–128 released from BAZ', counterparty: 'Zenith Command', counterpartyType: 'Customer', owner: 'Yotam Keret', status: 'completed', priority: 'high', date: 'May 26', lastUpdated: '1d ago' },
      { id: 'ACT-1002', name: 'Customs follow-up – System 124', counterparty: 'Horizon Defense Ltd', counterpartyType: 'Customer', owner: 'Dan Cohen', status: 'completed', priority: 'critical', date: 'May 27', lastUpdated: '18h ago' },
      { id: 'ACT-1003', name: 'Emergency R&D procurement closed', counterparty: 'Elektra Components GmbH', counterpartyType: 'Supplier', owner: 'Amit Levy', status: 'completed', priority: 'critical', date: 'May 27', lastUpdated: '14h ago' },
      { id: 'ACT-1004', name: 'BAZ inventory reconciliation', counterparty: 'Operations', counterpartyType: 'Department', owner: 'Noa Shaked', status: 'completed', priority: 'medium', date: 'May 25', lastUpdated: '2d ago' },
      { id: 'ACT-1005', name: 'Supplier payment batch processed', counterparty: 'Finance', counterpartyType: 'Department', owner: 'Yotam Keret', status: 'completed', priority: 'high', date: 'May 26', lastUpdated: '1d ago' },
      { id: 'ACT-1006', name: 'Frontier Site Alpha installation confirmed', counterparty: 'Frontier Defense Systems', counterpartyType: 'Customer', owner: 'Eliav Mizrahi', status: 'completed', priority: 'high', date: 'May 26', lastUpdated: '1d ago' },
      { id: 'ACT-1007', name: 'BAZ packing and labeling – 8 units', counterparty: 'Operations', counterpartyType: 'Department', owner: 'Amit Levy', status: 'completed', priority: 'medium', date: 'May 24', lastUpdated: '3d ago' },
      { id: 'ACT-1008', name: 'Oracle inventory update', counterparty: 'Operations', counterpartyType: 'Department', owner: 'Dan Cohen', status: 'completed', priority: 'low', date: 'May 25', lastUpdated: '2d ago' },
      { id: 'ACT-1009', name: 'Defence shipment preparation – urgent', counterparty: 'Defence', counterpartyType: 'Department', owner: 'Noa Shaked', status: 'completed', priority: 'critical', date: 'May 26', lastUpdated: '1d ago' },
      { id: 'ACT-1010', name: 'Zenith deployment coordination', counterparty: 'Zenith Command', counterpartyType: 'Customer', owner: 'Dan Cohen', status: 'completed', priority: 'high', date: 'May 27', lastUpdated: '20h ago' },
    ],
    monthly: [
      { id: 'ACT-0940', name: 'MSC full site deployment complete', counterparty: 'MSC Security', counterpartyType: 'Customer', owner: 'Amit Levy', status: 'completed', priority: 'high', date: 'May 14', lastUpdated: '2w ago' },
      { id: 'ACT-0953', name: 'Customs backlog cleared – 8 cases', counterparty: 'Operations', counterpartyType: 'Department', owner: 'Noa Shaked', status: 'completed', priority: 'critical', date: 'May 19', lastUpdated: '1w ago' },
      { id: 'ACT-0961', name: 'Oracle accuracy project completed', counterparty: 'Operations', counterpartyType: 'Department', owner: 'Dan Cohen', status: 'completed', priority: 'high', date: 'May 20', lastUpdated: '1w ago' },
      { id: 'ACT-0971', name: 'Month-end supplier payment run', counterparty: 'Finance', counterpartyType: 'Department', owner: 'Yotam Keret', status: 'completed', priority: 'high', date: 'May 26', lastUpdated: '1d ago' },
      { id: 'ACT-0980', name: 'R&D sprint support – 4 sessions', counterparty: 'R&D', counterpartyType: 'Department', owner: 'Amit Levy', status: 'completed', priority: 'high', date: 'May 28', lastUpdated: '8h ago' },
    ],
    quarterly: [
      { id: 'ACT-0801', name: 'Q2 BAZ capacity project delivered', counterparty: 'Operations', counterpartyType: 'Department', owner: 'Yotam Keret', status: 'completed', priority: 'high', date: 'Apr 30', lastUpdated: '5w ago' },
      { id: 'ACT-0824', name: 'Enterprise batch deployment – 28 units', counterparty: 'Citadel Corp', counterpartyType: 'Customer', owner: 'Dan Cohen', status: 'completed', priority: 'high', date: 'Apr 18', lastUpdated: '7w ago' },
      { id: 'ACT-0847', name: 'Procurement partner review – 8 suppliers', counterparty: 'Operations', counterpartyType: 'Department', owner: 'Amit Levy', status: 'completed', priority: 'medium', date: 'May 5', lastUpdated: '4w ago' },
      { id: 'ACT-0863', name: 'Regional deployment – 6 sites, 3 countries', counterparty: 'Stratos Security', counterpartyType: 'Customer', owner: 'Noa Shaked', status: 'completed', priority: 'high', date: 'May 21', lastUpdated: '1w ago' },
      { id: 'ACT-0878', name: 'Q2 inventory close – 96% accuracy', counterparty: 'Operations', counterpartyType: 'Department', owner: 'Yotam Keret', status: 'completed', priority: 'medium', date: 'Jun 1', lastUpdated: '12h ago' },
    ],
  },

  'Projects Advanced': {
    weekly: [
      { id: 'PROJ-601', name: 'Q2 BAZ capacity expansion', counterparty: 'Operations', counterpartyType: 'Department', owner: 'Yotam Keret', status: 'in-progress', priority: 'high', date: 'Due Jun 20', lastUpdated: '1d ago', notes: 'Phase 2 of 3 — racking installed, stock migration pending' },
      { id: 'PROJ-602', name: 'Oracle–SAP integration pilot', counterparty: 'IT / Operations', counterpartyType: 'Department', owner: 'Dan Cohen', status: 'in-progress', priority: 'high', date: 'Due Jun 30', lastUpdated: '2d ago', notes: '60% complete — data mapping signed off this week' },
      { id: 'PROJ-603', name: 'New supplier onboarding – 4 vendors', counterparty: 'Procurement', counterpartyType: 'Department', owner: 'Amit Levy', status: 'in-progress', priority: 'medium', date: 'Due Jun 15', lastUpdated: '3d ago', notes: '2 vendors approved, 2 in legal review' },
      { id: 'PROJ-604', name: 'Customer portal – ops module', counterparty: 'Product / Ops', counterpartyType: 'Department', owner: 'Noa Shaked', status: 'in-progress', priority: 'high', date: 'Due Jun 30', lastUpdated: '1d ago', notes: 'Spec finalised — development started this week' },
      { id: 'PROJ-605', name: 'Inventory system upgrade', counterparty: 'Operations', counterpartyType: 'Department', owner: 'Yotam Keret', status: 'in-progress', priority: 'critical', date: 'Due Jun 20', lastUpdated: '18h ago', notes: 'UAT in progress — 3 critical bugs resolved this week' },
      { id: 'PROJ-606', name: 'Regional deployment plan – Q3', counterparty: 'Deployments', counterpartyType: 'Department', owner: 'Eliav Mizrahi', status: 'in-progress', priority: 'high', date: 'Due Jun 25', lastUpdated: '2d ago', notes: 'Site survey complete — logistics plan drafted' },
    ],
    monthly: [
      { id: 'PROJ-601', name: 'Q2 BAZ capacity expansion', counterparty: 'Operations', counterpartyType: 'Department', owner: 'Yotam Keret', status: 'in-progress', priority: 'high', date: 'Due Jun 20', lastUpdated: '1d ago', notes: 'Phase 2 of 3 — 70% complete' },
      { id: 'PROJ-602', name: 'Oracle–SAP integration pilot', counterparty: 'IT / Operations', counterpartyType: 'Department', owner: 'Dan Cohen', status: 'in-progress', priority: 'high', date: 'Due Jun 30', lastUpdated: '2d ago', notes: '60% complete — data mapping signed off' },
      { id: 'PROJ-603', name: 'New supplier onboarding – 4 vendors', counterparty: 'Procurement', counterpartyType: 'Department', owner: 'Amit Levy', status: 'in-progress', priority: 'medium', date: 'Due Jun 15', lastUpdated: '3d ago', notes: '2 vendors approved, 2 in legal review' },
      { id: 'PROJ-604', name: 'Customer portal – ops module', counterparty: 'Product / Ops', counterpartyType: 'Department', owner: 'Noa Shaked', status: 'in-progress', priority: 'high', date: 'Due Jun 30', lastUpdated: '1d ago', notes: 'Spec finalised — development started' },
      { id: 'PROJ-605', name: 'Inventory system upgrade', counterparty: 'Operations', counterpartyType: 'Department', owner: 'Yotam Keret', status: 'in-progress', priority: 'critical', date: 'Due Jun 20', lastUpdated: '18h ago', notes: 'UAT in progress — 3 critical bugs resolved' },
      { id: 'PROJ-606', name: 'Regional deployment plan – Q3', counterparty: 'Deployments', counterpartyType: 'Department', owner: 'Eliav Mizrahi', status: 'in-progress', priority: 'high', date: 'Due Jun 25', lastUpdated: '2d ago', notes: 'Site survey complete — logistics plan drafted' },
      { id: 'PROJ-591', name: 'Q1 supplier renegotiation – closed', counterparty: 'Procurement', counterpartyType: 'Department', owner: 'Amit Levy', status: 'completed', priority: 'high', date: 'Closed Apr 15', lastUpdated: '6w ago', notes: 'Saved $76K annually across 3 contracts' },
      { id: 'PROJ-594', name: 'BAZ safety audit – closed', counterparty: 'Operations', counterpartyType: 'Department', owner: 'Noa Shaked', status: 'completed', priority: 'medium', date: 'Closed Apr 22', lastUpdated: '5w ago', notes: 'Zero findings — certification renewed' },
    ],
    quarterly: [
      { id: 'PROJ-601', name: 'Q2 BAZ capacity expansion', counterparty: 'Operations', counterpartyType: 'Department', owner: 'Yotam Keret', status: 'in-progress', priority: 'high', date: 'Due Jun 20', lastUpdated: '1d ago', notes: 'Phase 2 of 3 — 70% complete' },
      { id: 'PROJ-602', name: 'Oracle–SAP integration pilot', counterparty: 'IT / Operations', counterpartyType: 'Department', owner: 'Dan Cohen', status: 'in-progress', priority: 'high', date: 'Due Jun 30', lastUpdated: '2d ago', notes: '60% complete' },
      { id: 'PROJ-603', name: 'New supplier onboarding – 4 vendors', counterparty: 'Procurement', counterpartyType: 'Department', owner: 'Amit Levy', status: 'in-progress', priority: 'medium', date: 'Due Jun 15', lastUpdated: '3d ago', notes: '2 of 4 vendors approved' },
      { id: 'PROJ-604', name: 'Customer portal – ops module', counterparty: 'Product / Ops', counterpartyType: 'Department', owner: 'Noa Shaked', status: 'in-progress', priority: 'high', date: 'Due Jun 30', lastUpdated: '1d ago', notes: 'Development started this week' },
      { id: 'PROJ-605', name: 'Inventory system upgrade', counterparty: 'Operations', counterpartyType: 'Department', owner: 'Yotam Keret', status: 'in-progress', priority: 'critical', date: 'Due Jun 20', lastUpdated: '18h ago', notes: 'UAT in progress' },
      { id: 'PROJ-606', name: 'Regional deployment plan – Q3', counterparty: 'Deployments', counterpartyType: 'Department', owner: 'Eliav Mizrahi', status: 'in-progress', priority: 'high', date: 'Due Jun 25', lastUpdated: '2d ago', notes: 'Site survey complete' },
      { id: 'PROJ-578', name: 'Q1 ERP data cleanup – closed', counterparty: 'IT / Operations', counterpartyType: 'Department', owner: 'Dan Cohen', status: 'completed', priority: 'medium', date: 'Closed Mar 31', lastUpdated: '9w ago', notes: '14,000 records cleaned and validated' },
      { id: 'PROJ-582', name: 'Supplier diversity programme – closed', counterparty: 'Procurement', counterpartyType: 'Department', owner: 'Amit Levy', status: 'completed', priority: 'high', date: 'Closed Apr 8', lastUpdated: '8w ago', notes: '12 new approved suppliers added' },
    ],
  },

};

// ---------------------------------------------------------------------------
// Team Members  (auth-ready: id maps to future userId)
// ---------------------------------------------------------------------------

export type TeamMember = {
  id: string;     // auth-ready: replace with UUID from identity provider
  name: string;
  email: string;  // auth-ready: becomes the login identifier
  role: string;
};

export const teamMembers: TeamMember[] = [
  { id: 'rami-moscovich',  name: 'Rami Moscovich',  email: 'rami@orca-ai.io',         role: 'Director of Operations' },
  { id: 'yotam-keret',     name: 'Yotam Keret',     email: 'yotam.keret@orca-ai.io',  role: 'Operations Specialist' },
  { id: 'amir-meiri',      name: 'Amir Meiri',      email: 'amir.m@orca-ai.io',       role: 'Operations Specialist' },
  { id: 'yaron-yahbes',    name: 'Yaron Yahbes',    email: 'yaron.y@orca-ai.io',      role: 'Operations Specialist' },
  { id: 'leon-gutnik',     name: 'Leon Gutnik',     email: 'leon.gutnik@orca-ai.io',  role: 'Operations Specialist' },
  { id: 'zohar-bar',       name: 'Zohar Bar',       email: 'zohar.b@orca-ai.io',      role: 'Operations Specialist' },
  { id: 'israel-kalaora',  name: 'Israel Kalaora',  email: 'israel@orca-ai.io',       role: 'Operations Specialist' },
  { id: 'jacob-reingold',  name: 'Jacob Reingold',  email: 'jacob@orca-ai.io',        role: 'Operations Specialist' },
  { id: 'tal-matza',       name: 'Tal Matza',       email: 'tal.matza@orca-ai.io',    role: 'Operations Specialist' },
  { id: 'guy-hadad',       name: 'Guy Hadad',       email: 'guy.hadad@orca-ai.io',    role: 'Operations Specialist' },
];

// ---------------------------------------------------------------------------
// Support Log  (single source of truth for all contribution tracking)
// ---------------------------------------------------------------------------

export type SupportLog = {
  id: string;
  employeeId: string;   // auth-ready: maps to TeamMember.id; swap for session userId once auth added
  employeeName: string; // denormalized for display
  department: string;
  category: string;
  title: string;
  hours: number;
  date: string;   // 'YYYY-MM-DD'
  week: string;   // period bucket: 'W22', 'W21', …
  notes: string;
};

// Filter by actual date ranges so new real DB entries are always visible.
// "weekly"    → Monday of the current ISO week → today
// "monthly"   → first day of the current month → today
// "quarterly" → first day of the current quarter → today
export function filterLogsByPeriod(logs: SupportLog[], period: Period): SupportLog[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  let cutoff: Date;

  if (period === 'weekly') {
    const day = (now.getDay() + 6) % 7; // 0 = Mon … 6 = Sun
    cutoff = new Date(now);
    cutoff.setDate(now.getDate() - day);
  } else if (period === 'monthly') {
    cutoff = new Date(now.getFullYear(), now.getMonth(), 1);
  } else {
    const q = Math.floor(now.getMonth() / 3);
    cutoff = new Date(now.getFullYear(), q * 3, 1);
  }

  return logs.filter(l => {
    if (!l.date) return false;
    return new Date(l.date + 'T00:00:00') >= cutoff;
  });
}

// Seed data — W22 sums to 126 h matching previous mock KPI values
export const seedSupportLogs: SupportLog[] = [
  // === W22 → mapped to current week Jun 1–4, 2026 ===
  { id:'LOG-2201', employeeId:'yotam-keret',    employeeName:'Yotam Keret',    department:'R&D',             category:'Procurement',     title:'Emergency R&D component sourcing',        hours:14, date:'2026-06-11', week:'W24', notes:'Sourced 4 components under 24h for R&D sprint' },
  { id:'LOG-2202', employeeId:'yotam-keret',    employeeName:'Yotam Keret',    department:'Finance',         category:'Finance Support', title:'Supplier payment batch sign-off',          hours:10, date:'2026-06-10', week:'W24', notes:'$284K payment batch coordinated with Finance' },
  { id:'LOG-2203', employeeId:'yotam-keret',    employeeName:'Yotam Keret',    department:'Defence',         category:'Logistics',       title:'Defence shipment preparation',             hours: 8, date:'2026-06-10', week:'W24', notes:'Urgent Defence shipment coordinated end-to-end' },
  { id:'LOG-2204', employeeId:'dan-cohen',       employeeName:'Dan Cohen',       department:'R&D',             category:'R&D Support',     title:'R&D prototype testing coordination',       hours:12, date:'2026-06-11', week:'W24', notes:'Test equipment procurement and setup for R&D' },
  { id:'LOG-2205', employeeId:'dan-cohen',       employeeName:'Dan Cohen',       department:'Defence',         category:'Procurement',     title:'Defence project procurement batch',         hours: 8, date:'2026-06-09', week:'W24', notes:'4 POs raised and approved same day' },
  { id:'LOG-2206', employeeId:'dan-cohen',       employeeName:'Dan Cohen',       department:'Customer Success', category:'CS Support',      title:'Customer delivery documentation',           hours: 8, date:'2026-06-11', week:'W24', notes:'Delivery docs coordinated for 3 customers' },
  { id:'LOG-2207', employeeId:'amit-levy',       employeeName:'Amit Levy',       department:'Product',         category:'Product Support', title:'Product roadmap materials preparation',     hours:14, date:'2026-06-10', week:'W24', notes:'3 kits prepared for internal product showcase' },
  { id:'LOG-2208', employeeId:'amit-levy',       employeeName:'Amit Levy',       department:'R&D',             category:'R&D Support',     title:'R&D lab component delivery',               hours: 8, date:'2026-06-08', week:'W24', notes:'8 components sourced and delivered to R&D lab' },
  { id:'LOG-2209', employeeId:'amit-levy',       employeeName:'Amit Levy',       department:'Finance',         category:'Finance Support', title:'Finance invoice reconciliation support',    hours: 6, date:'2026-06-11', week:'W24', notes:'Invoice review for Q2 framework agreement' },
  { id:'LOG-2210', employeeId:'noa-shaked',      employeeName:'Noa Shaked',      department:'Defence',         category:'Logistics',       title:'Defence logistics coordination',            hours: 9, date:'2026-06-09', week:'W24', notes:'End-to-end logistics for urgent Defence delivery' },
  { id:'LOG-2211', employeeId:'noa-shaked',      employeeName:'Noa Shaked',      department:'Customer Success', category:'CS Support',      title:'Customer handover support',                 hours: 5, date:'2026-06-11', week:'W24', notes:'3 customer handovers coordinated' },
  { id:'LOG-2212', employeeId:'noa-shaked',      employeeName:'Noa Shaked',      department:'Product',         category:'Product Support', title:'Product operational enablement',            hours: 8, date:'2026-06-10', week:'W24', notes:'Spec reviews and prototype materials' },
  { id:'LOG-2213', employeeId:'eliav-mizrahi',   employeeName:'Eliav Mizrahi',   department:'R&D',             category:'R&D Support',     title:'R&D emergency parts delivery',              hours: 8, date:'2026-06-11', week:'W24', notes:'Urgent component delivery for R&D sprint' },
  { id:'LOG-2214', employeeId:'eliav-mizrahi',   employeeName:'Eliav Mizrahi',   department:'Product',         category:'Product Support', title:'Product operations support',                hours: 6, date:'2026-06-11', week:'W24', notes:'Operational support for Product team deliverable' },
  { id:'LOG-2215', employeeId:'eliav-mizrahi',   employeeName:'Eliav Mizrahi',   department:'Finance',         category:'Finance Support', title:'Finance payment tracking',                  hours: 2, date:'2026-06-10', week:'W24', notes:'Payment status monitoring and reporting' },
  // === W21 (May 19 – 25) ===
  { id:'LOG-2121', employeeId:'yotam-keret',    employeeName:'Yotam Keret',    department:'R&D',             category:'R&D Support',     title:'R&D sprint component support',             hours:16, date:'2026-05-22', week:'W21', notes:'' },
  { id:'LOG-2122', employeeId:'yotam-keret',    employeeName:'Yotam Keret',    department:'Finance',         category:'Finance Support', title:'Weekly supplier payment run',              hours: 8, date:'2026-05-21', week:'W21', notes:'' },
  { id:'LOG-2123', employeeId:'dan-cohen',       employeeName:'Dan Cohen',       department:'Defence',         category:'Procurement',     title:'Defence procurement batch',                hours:14, date:'2026-05-20', week:'W21', notes:'' },
  { id:'LOG-2124', employeeId:'dan-cohen',       employeeName:'Dan Cohen',       department:'Customer Success', category:'CS Support',      title:'CS delivery coordination',                  hours: 7, date:'2026-05-22', week:'W21', notes:'' },
  { id:'LOG-2125', employeeId:'amit-levy',       employeeName:'Amit Levy',       department:'Product',         category:'Product Support', title:'Product sprint support',                   hours:12, date:'2026-05-21', week:'W21', notes:'' },
  { id:'LOG-2126', employeeId:'amit-levy',       employeeName:'Amit Levy',       department:'R&D',             category:'R&D Support',     title:'R&D component sourcing',                   hours: 8, date:'2026-05-20', week:'W21', notes:'' },
  { id:'LOG-2127', employeeId:'noa-shaked',      employeeName:'Noa Shaked',      department:'Customer Success', category:'CS Support',      title:'CS customer support sessions',              hours: 8, date:'2026-05-22', week:'W21', notes:'' },
  { id:'LOG-2128', employeeId:'noa-shaked',      employeeName:'Noa Shaked',      department:'Product',         category:'Product Support', title:'Product materials preparation',             hours: 7, date:'2026-05-20', week:'W21', notes:'' },
  // === W20 (May 12 – 18) ===
  { id:'LOG-2021', employeeId:'yotam-keret',    employeeName:'Yotam Keret',    department:'R&D',             category:'R&D Support',     title:'R&D weekly component support',             hours:18, date:'2026-05-15', week:'W20', notes:'' },
  { id:'LOG-2022', employeeId:'dan-cohen',       employeeName:'Dan Cohen',       department:'Defence',         category:'Logistics',       title:'Defence shipment support',                 hours:12, date:'2026-05-14', week:'W20', notes:'' },
  { id:'LOG-2023', employeeId:'amit-levy',       employeeName:'Amit Levy',       department:'Product',         category:'Product Support', title:'Product enablement support',               hours:14, date:'2026-05-15', week:'W20', notes:'' },
  { id:'LOG-2024', employeeId:'noa-shaked',      employeeName:'Noa Shaked',      department:'Finance',         category:'Finance Support', title:'Finance coordination',                      hours:12, date:'2026-05-13', week:'W20', notes:'' },
  { id:'LOG-2025', employeeId:'eliav-mizrahi',   employeeName:'Eliav Mizrahi',   department:'R&D',             category:'R&D Support',     title:'R&D lab support',                          hours: 9, date:'2026-05-15', week:'W20', notes:'' },
  // === W19 (May 5 – 11) ===
  { id:'LOG-1921', employeeId:'yotam-keret',    employeeName:'Yotam Keret',    department:'R&D',             category:'Procurement',     title:'R&D emergency procurement',                hours:16, date:'2026-05-08', week:'W19', notes:'' },
  { id:'LOG-1922', employeeId:'dan-cohen',       employeeName:'Dan Cohen',       department:'Customer Success', category:'CS Support',      title:'CS deployment support',                     hours:12, date:'2026-05-07', week:'W19', notes:'' },
  { id:'LOG-1923', employeeId:'amit-levy',       employeeName:'Amit Levy',       department:'Defence',         category:'Procurement',     title:'Defence materials procurement',             hours:14, date:'2026-05-08', week:'W19', notes:'' },
  { id:'LOG-1924', employeeId:'noa-shaked',      employeeName:'Noa Shaked',      department:'Finance',         category:'Finance Support', title:'Finance payment coordination',              hours:10, date:'2026-05-06', week:'W19', notes:'' },
  // === W18 (Apr 28 – May 4) ===
  { id:'LOG-1821', employeeId:'yotam-keret',    employeeName:'Yotam Keret',    department:'R&D',             category:'R&D Support',     title:'R&D engineering support',                  hours:18, date:'2026-05-01', week:'W18', notes:'' },
  { id:'LOG-1822', employeeId:'dan-cohen',       employeeName:'Dan Cohen',       department:'Product',         category:'Product Support', title:'Product ops support',                      hours:14, date:'2026-04-30', week:'W18', notes:'' },
  { id:'LOG-1823', employeeId:'amit-levy',       employeeName:'Amit Levy',       department:'Customer Success', category:'CS Support',      title:'CS customer coordination',                  hours:13, date:'2026-05-01', week:'W18', notes:'' },
  // === W17 (Apr 21 – 27) ===
  { id:'LOG-1721', employeeId:'yotam-keret',    employeeName:'Yotam Keret',    department:'R&D',             category:'R&D Support',     title:'Q2 R&D support kickoff',                   hours:20, date:'2026-04-24', week:'W17', notes:'' },
  { id:'LOG-1722', employeeId:'dan-cohen',       employeeName:'Dan Cohen',       department:'Defence',         category:'Procurement',     title:'Defence Q2 procurement',                   hours:16, date:'2026-04-23', week:'W17', notes:'' },
  { id:'LOG-1723', employeeId:'amit-levy',       employeeName:'Amit Levy',       department:'Product',         category:'Product Support', title:'Product Q2 enablement',                    hours:14, date:'2026-04-24', week:'W17', notes:'' },
  // === W16 (Apr 14 – 20) ===
  { id:'LOG-1621', employeeId:'yotam-keret',    employeeName:'Yotam Keret',    department:'Finance',         category:'Finance Support', title:'Q2 finance payment setup',                 hours:18, date:'2026-04-17', week:'W16', notes:'' },
  { id:'LOG-1622', employeeId:'noa-shaked',      employeeName:'Noa Shaked',      department:'R&D',             category:'R&D Support',     title:'R&D lab support session',                  hours:14, date:'2026-04-16', week:'W16', notes:'' },
  { id:'LOG-1623', employeeId:'dan-cohen',       employeeName:'Dan Cohen',       department:'Customer Success', category:'CS Support',      title:'CS onboarding support',                     hours:14, date:'2026-04-17', week:'W16', notes:'' },
  // === W15 (Apr 7 – 13) ===
  { id:'LOG-1521', employeeId:'yotam-keret',    employeeName:'Yotam Keret',    department:'R&D',             category:'Procurement',     title:'R&D component sourcing – Apr',             hours:22, date:'2026-04-10', week:'W15', notes:'' },
  { id:'LOG-1522', employeeId:'amit-levy',       employeeName:'Amit Levy',       department:'Defence',         category:'Procurement',     title:'Defence procurement – Apr',                hours:16, date:'2026-04-09', week:'W15', notes:'' },
  // === W14 (Mar 31 – Apr 6) ===
  { id:'LOG-1421', employeeId:'dan-cohen',       employeeName:'Dan Cohen',       department:'R&D',             category:'R&D Support',     title:'Q2 kickoff R&D support',                   hours:18, date:'2026-04-03', week:'W14', notes:'' },
  { id:'LOG-1422', employeeId:'noa-shaked',      employeeName:'Noa Shaked',      department:'Product',         category:'Product Support', title:'Product ops enablement',                   hours:16, date:'2026-04-02', week:'W14', notes:'' },
  // === W13 (Mar 24 – 30) ===
  { id:'LOG-1321', employeeId:'yotam-keret',    employeeName:'Yotam Keret',    department:'R&D',             category:'R&D Support',     title:'Q2 R&D preparation support',               hours:18, date:'2026-04-01', week:'W13', notes:'' },
  { id:'LOG-1322', employeeId:'dan-cohen',       employeeName:'Dan Cohen',       department:'Defence',         category:'Procurement',     title:'Q2 Defence prep procurement',              hours:14, date:'2026-04-01', week:'W13', notes:'' },
  { id:'LOG-1323', employeeId:'amit-levy',       employeeName:'Amit Levy',       department:'Product',         category:'Product Support', title:'Q2 Product support',                       hours:14, date:'2026-04-01', week:'W13', notes:'' },
];

// ─── Operations Record (Supabase table: operations_records) ──────────────
export const OPERATIONS_CATEGORIES = [
  'Systems Shipped',
  'Installations Completed',
  'Spares Shipped',
] as const;
export type OperationsCategory = typeof OPERATIONS_CATEGORIES[number];

export const OPERATIONS_STATUSES = ['Open', 'Completed'] as const;
export type OperationsStatus = typeof OPERATIONS_STATUSES[number];

export type OperationsRecord = {
  id:           string;
  employeeId:   string;           // → employee_id
  employeeName: string;           // → employee_name
  date:         string;           // YYYY-MM-DD → activity_date
  category:     OperationsCategory;
  quantity:     number;           // → quantity (units)
  notes:        string;
  status:       OperationsStatus;
};

// Demo-mode seed records (current week W23, Jun 1–4 2026)
export const mockOperationsRecords: OperationsRecord[] = [
  { id:'OPS-001', employeeId:'yotam-keret',   employeeName:'Yotam Keret',   date:'2026-06-04', category:'Systems Shipped',         quantity: 8, status:'Completed', notes:'Batch shipment to Frontier Defense and Centuria' },
  { id:'OPS-002', employeeId:'dan-cohen',      employeeName:'Dan Cohen',      date:'2026-06-03', category:'Systems Shipped',         quantity: 5, status:'Completed', notes:'Urgent shipment — Zenith Command' },
  { id:'OPS-003', employeeId:'yotam-keret',   employeeName:'Yotam Keret',   date:'2026-06-01', category:'Systems Shipped',         quantity: 6, status:'Completed', notes:'Standard batch delivery — Q2' },
  { id:'OPS-004', employeeId:'noa-shaked',     employeeName:'Noa Shaked',     date:'2026-06-02', category:'Installations Completed', quantity: 3, status:'Completed', notes:'MSC site installation completed end-to-end' },
  { id:'OPS-005', employeeId:'eliav-mizrahi',  employeeName:'Eliav Mizrahi',  date:'2026-06-02', category:'Installations Completed', quantity: 2, status:'Completed', notes:'Horizon Defense site upgrade' },
  { id:'OPS-006', employeeId:'noa-shaked',     employeeName:'Noa Shaked',     date:'2026-06-04', category:'Installations Completed', quantity: 1, status:'Open',      notes:'Zenith Site C — in progress' },
  { id:'OPS-007', employeeId:'amit-levy',      employeeName:'Amit Levy',      date:'2026-06-03', category:'Spares Shipped',          quantity:12, status:'Completed', notes:'Spare parts kits for CS customers' },
  { id:'OPS-008', employeeId:'dan-cohen',      employeeName:'Dan Cohen',      date:'2026-06-01', category:'Spares Shipped',          quantity: 9, status:'Completed', notes:'Switch and screen kits batch' },
];

// Predefined activity categories — single source of truth for both the form and future analytics
export const ACTIVITY_CATEGORIES = [
  'Logistics',
  'Procurement',
  'Deployment',
  'Installation',
  'Finance Support',
  'R&D Support',
  'Product Support',
  'Customer Support',
  'Defense Support',
  'Operations Support',
] as const;

export type ActivityCategory = typeof ACTIVITY_CATEGORIES[number];
