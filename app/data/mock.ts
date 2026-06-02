export type Period = 'weekly' | 'monthly' | 'quarterly';

export const timeRangeData = {
  weekly: {
    label: 'W22 · May 26 – Jun 1',
    kpis: [
      { label: 'Systems Shipped', value: '32', note: 'Full systems, replacements and upgrades', priority: 1 },
      { label: 'Delayed Shipments', value: '3', note: 'Require immediate attention', priority: 1 },
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
      { metric: 'Systems Shipped', value: '32', detail: 'Full systems, replacements and upgrades' },
      { metric: 'Ready to Ship at BAZ', value: '14', detail: 'Packed and awaiting final release' },
      { metric: 'Customs Clearance', value: '7', detail: 'Shipments currently in active clearance' },
      { metric: 'Spare Parts Sent', value: '46', detail: 'Screens, switches, computers and service kits' },
      { metric: 'Systems In Assembly', value: '11', detail: 'Currently being prepared at workshop' },
      { metric: 'Pending Deliveries', value: '8', detail: 'Awaiting customer confirmation or slot' },
      { metric: 'Delayed Shipments', value: '3', detail: 'Behind schedule — action required', alert: true },
    ],
    procurement: [
      { metric: 'PO Created', value: '74', detail: 'Oracle purchase orders created this week' },
      { metric: 'Emergency Requests', value: '19', detail: 'Short-notice requests for R&D, Defence and Product' },
      { metric: 'Supplier Payments', value: '$284K', detail: 'Processed together with Finance' },
      { metric: 'Estimated Cost Savings', value: '$18.5K', detail: 'Negotiation, supplier alternatives and bulk planning' },
    ],
    deployments: [
      { metric: 'Installations Completed', value: '11', detail: 'Completed end-to-end' },
      { metric: 'Maintenance Activities', value: '16', detail: 'Ad-hoc and planned customer work' },
      { metric: 'Customer Kickoffs', value: '5', detail: 'New customers and expansion activity' },
      { metric: 'Trainings Delivered', value: '8', detail: 'Internal and external onboarding' },
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
      { date: 'Fri', title: 'Supplier payment risk removed', area: 'Finance', detail: 'Critical supplier payment released before it could delay delivery.', owner: 'Yotam Keret', status: 'completed' },
    ],
    exceptions: [
      { type: 'delayed', count: 3, label: 'Delayed shipments', section: 'Logistics' },
      { type: 'overdue', count: 5, label: 'Overdue tasks', section: 'Activity Feed' },
      { type: 'customs', count: 1, label: 'Customs clearance issue', section: 'Logistics' },
      { type: 'waiting', count: 3, label: 'Systems awaiting shipment', section: 'Logistics' },
    ],
  },

  monthly: {
    label: 'May 2025',
    kpis: [
      { label: 'Systems Shipped', value: '127', note: 'Full systems, replacements and upgrades', priority: 1 },
      { label: 'Delayed Shipments', value: '5', note: 'Require immediate attention', priority: 1 },
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
      { metric: 'Delayed Shipments', value: '5', detail: 'Behind schedule — action required', alert: true },
    ],
    procurement: [
      { metric: 'PO Created', value: '298', detail: 'Oracle purchase orders created this month' },
      { metric: 'Emergency Requests', value: '74', detail: 'Short-notice requests for R&D, Defence and Product' },
      { metric: 'Supplier Payments', value: '$1.1M', detail: 'Processed together with Finance' },
      { metric: 'Estimated Cost Savings', value: '$76K', detail: 'Negotiation, supplier alternatives and bulk planning' },
    ],
    deployments: [
      { metric: 'Installations Completed', value: '43', detail: 'Completed end-to-end' },
      { metric: 'Maintenance Activities', value: '62', detail: 'Ad-hoc and planned customer work' },
      { metric: 'Customer Kickoffs', value: '18', detail: 'New customers and expansion activity' },
      { metric: 'Trainings Delivered', value: '31', detail: 'Internal and external onboarding' },
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
      { type: 'delayed', count: 5, label: 'Delayed shipments', section: 'Logistics' },
      { type: 'overdue', count: 8, label: 'Overdue tasks', section: 'Activity Feed' },
      { type: 'customs', count: 2, label: 'Customs clearance issues', section: 'Logistics' },
      { type: 'waiting', count: 6, label: 'Systems awaiting shipment', section: 'Logistics' },
    ],
  },

  quarterly: {
    label: 'Q2 2025',
    kpis: [
      { label: 'Systems Shipped', value: '384', note: 'Full systems, replacements and upgrades', priority: 1 },
      { label: 'Delayed Shipments', value: '8', note: 'Require immediate attention', priority: 1 },
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
      { metric: 'Delayed Shipments', value: '8', detail: 'Behind schedule — action required', alert: true },
    ],
    procurement: [
      { metric: 'PO Created', value: '891', detail: 'Oracle purchase orders created this quarter' },
      { metric: 'Emergency Requests', value: '218', detail: 'Short-notice requests for R&D, Defence and Product' },
      { metric: 'Supplier Payments', value: '$3.2M', detail: 'Processed together with Finance' },
      { metric: 'Estimated Cost Savings', value: '$228K', detail: 'Negotiation, supplier alternatives and bulk planning' },
    ],
    deployments: [
      { metric: 'Installations Completed', value: '127', detail: 'Completed end-to-end' },
      { metric: 'Maintenance Activities', value: '187', detail: 'Ad-hoc and planned customer work' },
      { metric: 'Customer Kickoffs', value: '54', detail: 'New customers and expansion activity' },
      { metric: 'Trainings Delivered', value: '94', detail: 'Internal and external onboarding' },
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
      { type: 'delayed', count: 8, label: 'Delayed shipments', section: 'Logistics' },
      { type: 'overdue', count: 12, label: 'Overdue tasks', section: 'Activity Feed' },
      { type: 'customs', count: 3, label: 'Customs clearance issues', section: 'Logistics' },
      { type: 'waiting', count: 9, label: 'Systems awaiting shipment', section: 'Logistics' },
    ],
  },
};

export const teamPulseStatus = [
  { name: 'Yotam Keret', submitted: true, lastUpdated: '2h ago' },
  { name: 'Dan Cohen', submitted: true, lastUpdated: '4h ago' },
  { name: 'Amit Levy', submitted: true, lastUpdated: '1d ago' },
  { name: 'Noa Shaked', submitted: true, lastUpdated: '1d ago' },
  { name: 'Eliav Mizrahi', submitted: false, lastUpdated: null },
  { name: 'Liora Ben David', submitted: false, lastUpdated: null },
  { name: 'Omer Shapiro', submitted: false, lastUpdated: null },
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

  'Delayed Shipments': {
    weekly: [
      { id: 'DELAY-201', name: 'System 124 – Horizon Defense', counterparty: 'Horizon Defense Ltd', counterpartyType: 'Customer', owner: 'Dan Cohen', status: 'customs-hold', priority: 'critical', date: 'Expected May 28', lastUpdated: '3d ago', notes: 'Customs documentation incomplete — legal reviewing' },
      { id: 'DELAY-202', name: 'Spare Parts Kit – Iota Systems', counterparty: 'Iota Systems', counterpartyType: 'Customer', owner: 'Yotam Keret', status: 'carrier-delay', priority: 'high', date: 'Expected Jun 2', lastUpdated: '6h ago', notes: 'Carrier rescheduled — new ETA confirmed' },
      { id: 'DELAY-203', name: 'System 107 – Kappa Corp', counterparty: 'Kappa Corp', counterpartyType: 'Customer', owner: 'Amit Levy', status: 'parts-missing', priority: 'critical', date: 'Expected May 30', lastUpdated: '2d ago', notes: 'Supplier component missing — alternative sourcing in progress' },
    ],
    monthly: [
      { id: 'DELAY-196', name: 'System 103 – Theta Defense', counterparty: 'Theta Defense', counterpartyType: 'Customer', owner: 'Noa Shaked', status: 'resolved', priority: 'high', date: 'Resolved May 9', lastUpdated: '3w ago', notes: 'Customs cleared after 4-day hold' },
      { id: 'DELAY-198', name: 'Spare Parts – Epsilon Security', counterparty: 'Epsilon Security', counterpartyType: 'Customer', owner: 'Dan Cohen', status: 'resolved', priority: 'medium', date: 'Resolved May 14', lastUpdated: '2w ago', notes: 'Alternate carrier dispatched — delivered 3 days late' },
      { id: 'DELAY-200', name: 'System 106 – Lambda Group', counterparty: 'Lambda Group', counterpartyType: 'Customer', owner: 'Yotam Keret', status: 'resolved', priority: 'high', date: 'Resolved May 21', lastUpdated: '1w ago', notes: 'Packaging issue corrected and reshipped' },
      { id: 'DELAY-201', name: 'System 124 – Horizon Defense', counterparty: 'Horizon Defense Ltd', counterpartyType: 'Customer', owner: 'Dan Cohen', status: 'customs-hold', priority: 'critical', date: 'Expected May 28', lastUpdated: '3d ago', notes: 'Customs documentation incomplete — legal reviewing' },
      { id: 'DELAY-203', name: 'System 107 – Kappa Corp', counterparty: 'Kappa Corp', counterpartyType: 'Customer', owner: 'Amit Levy', status: 'parts-missing', priority: 'critical', date: 'Expected May 30', lastUpdated: '2d ago', notes: 'Supplier component missing — alternative sourcing in progress' },
    ],
    quarterly: [
      { id: 'DELAY-181', name: 'System 89 – Sigma Defense', counterparty: 'Sigma Defense', counterpartyType: 'Customer', owner: 'Yotam Keret', status: 'resolved', priority: 'high', date: 'Resolved Apr 10', lastUpdated: '7w ago', notes: 'Freight damage — replaced and reshipped' },
      { id: 'DELAY-185', name: 'Systems 92–93 – Theta Corp', counterparty: 'Theta Corp', counterpartyType: 'Customer', owner: 'Dan Cohen', status: 'resolved', priority: 'critical', date: 'Resolved Apr 18', lastUpdated: '6w ago', notes: 'Customs cleared after compliance review' },
      { id: 'DELAY-190', name: 'Spare Parts – Omega Systems', counterparty: 'Omega Systems', counterpartyType: 'Customer', owner: 'Noa Shaked', status: 'resolved', priority: 'medium', date: 'Resolved Apr 29', lastUpdated: '5w ago', notes: 'Supplier lead time exceeded — expedited shipping used' },
      { id: 'DELAY-196', name: 'System 103 – Theta Defense', counterparty: 'Theta Defense', counterpartyType: 'Customer', owner: 'Noa Shaked', status: 'resolved', priority: 'high', date: 'Resolved May 9', lastUpdated: '3w ago', notes: 'Customs cleared after 4-day hold' },
      { id: 'DELAY-198', name: 'Spare Parts – Epsilon Security', counterparty: 'Epsilon Security', counterpartyType: 'Customer', owner: 'Dan Cohen', status: 'resolved', priority: 'medium', date: 'Resolved May 14', lastUpdated: '2w ago', notes: 'Alternate carrier — delivered 3 days late' },
      { id: 'DELAY-200', name: 'System 106 – Lambda Group', counterparty: 'Lambda Group', counterpartyType: 'Customer', owner: 'Yotam Keret', status: 'resolved', priority: 'high', date: 'Resolved May 21', lastUpdated: '1w ago', notes: 'Packaging issue corrected and reshipped' },
      { id: 'DELAY-201', name: 'System 124 – Horizon Defense', counterparty: 'Horizon Defense Ltd', counterpartyType: 'Customer', owner: 'Dan Cohen', status: 'customs-hold', priority: 'critical', date: 'Expected May 28', lastUpdated: '3d ago', notes: 'Customs documentation incomplete — legal reviewing' },
      { id: 'DELAY-203', name: 'System 107 – Kappa Corp', counterparty: 'Kappa Corp', counterpartyType: 'Customer', owner: 'Amit Levy', status: 'parts-missing', priority: 'critical', date: 'Expected May 30', lastUpdated: '2d ago', notes: 'Supplier component missing — alternative sourcing in progress' },
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
// My Tasks
// ---------------------------------------------------------------------------

export type Task = {
  id: string;
  title: string;
  owner: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'in-progress' | 'completed' | 'overdue';
  dueDate: string;
  lastUpdated: string;
  category: string;
  description?: string;
};

export const allTasks: Record<Period, Task[]> = {
  weekly: [
    // Yotam Keret
    { id: 'TASK-W001', title: 'Resolve System 124 customs documentation', owner: 'Yotam Keret', priority: 'critical', status: 'overdue', dueDate: 'May 24', lastUpdated: '3d ago', category: 'Logistics', description: 'Incomplete export certificate blocking customs release for Horizon Defense shipment' },
    { id: 'TASK-W002', title: 'Q2 logistics review with leadership', owner: 'Yotam Keret', priority: 'high', status: 'overdue', dueDate: 'May 26', lastUpdated: '2d ago', category: 'Operations', description: 'Weekly ops review — rescheduled, needs to happen before end of week' },
    { id: 'TASK-W003', title: 'Approve PO-4573 – System 120 components', owner: 'Yotam Keret', priority: 'high', status: 'open', dueDate: 'May 29', lastUpdated: '1d ago', category: 'Procurement', description: 'GlobalTech Supply — $34K, pending approval before assembly can begin' },
    { id: 'TASK-W004', title: 'Follow up on Kappa Corp delay resolution', owner: 'Yotam Keret', priority: 'critical', status: 'open', dueDate: 'May 29', lastUpdated: '2d ago', category: 'Logistics', description: 'Supplier component missing — confirm alternative source ETA' },
    { id: 'TASK-W005', title: 'BAZ capacity expansion – Phase 2 migration', owner: 'Yotam Keret', priority: 'high', status: 'in-progress', dueDate: 'Jun 20', lastUpdated: '1d ago', category: 'Projects', description: 'Stock migration to new racking — 60% complete, Phase 3 starts next week' },
    { id: 'TASK-W006', title: 'Supplier payment batch – W22 sign-off', owner: 'Yotam Keret', priority: 'high', status: 'in-progress', dueDate: 'May 28', lastUpdated: '8h ago', category: 'Finance', description: '$284K payment batch — 6 of 8 invoices approved, 2 pending Finance review' },
    { id: 'TASK-W007', title: 'System 118 shipment confirmed – Frontier Defense', owner: 'Yotam Keret', priority: 'high', status: 'completed', dueDate: 'May 27', lastUpdated: '1d ago', category: 'Logistics' },
    { id: 'TASK-W008', title: 'Defence urgent shipment preparation', owner: 'Yotam Keret', priority: 'critical', status: 'completed', dueDate: 'May 26', lastUpdated: '1d ago', category: 'Logistics' },
    { id: 'TASK-W009', title: 'Emergency R&D component procurement', owner: 'Yotam Keret', priority: 'critical', status: 'completed', dueDate: 'May 27', lastUpdated: '14h ago', category: 'Procurement' },
    { id: 'TASK-W010', title: 'Q2 inventory accuracy check', owner: 'Yotam Keret', priority: 'medium', status: 'completed', dueDate: 'May 25', lastUpdated: '2d ago', category: 'Inventory' },
    // Dan Cohen
    { id: 'TASK-W011', title: 'Customs follow-up – System 124 docs', owner: 'Dan Cohen', priority: 'critical', status: 'in-progress', dueDate: 'May 29', lastUpdated: '3d ago', category: 'Logistics' },
    { id: 'TASK-W012', title: 'Approve spare parts kit – Vanguard Tech', owner: 'Dan Cohen', priority: 'medium', status: 'open', dueDate: 'May 30', lastUpdated: '18h ago', category: 'Procurement' },
    { id: 'TASK-W013', title: 'PO-4572 expedite – Pacific Parts Direct', owner: 'Dan Cohen', priority: 'high', status: 'completed', dueDate: 'May 27', lastUpdated: '18h ago', category: 'Procurement' },
    // Amit Levy
    { id: 'TASK-W014', title: 'MSC deployment sign-off', owner: 'Amit Levy', priority: 'high', status: 'completed', dueDate: 'May 27', lastUpdated: '20h ago', category: 'Deployments' },
    { id: 'TASK-W015', title: 'Support hours report – W22', owner: 'Amit Levy', priority: 'medium', status: 'open', dueDate: 'May 30', lastUpdated: '1d ago', category: 'Operations' },
    // Noa Shaked
    { id: 'TASK-W016', title: 'BAZ inventory reconciliation', owner: 'Noa Shaked', priority: 'medium', status: 'completed', dueDate: 'May 25', lastUpdated: '2d ago', category: 'Inventory' },
    { id: 'TASK-W017', title: 'Zenith Site C – installation documentation', owner: 'Noa Shaked', priority: 'high', status: 'in-progress', dueDate: 'May 28', lastUpdated: '20h ago', category: 'Deployments' },
    // Eliav Mizrahi
    { id: 'TASK-W018', title: 'Frontier Site Alpha – installation report', owner: 'Eliav Mizrahi', priority: 'high', status: 'in-progress', dueDate: 'May 28', lastUpdated: '1d ago', category: 'Deployments' },
  ],

  monthly: [
    // Yotam Keret
    { id: 'TASK-M001', title: 'Monthly supplier payment cycle – May', owner: 'Yotam Keret', priority: 'high', status: 'completed', dueDate: 'May 26', lastUpdated: '1d ago', category: 'Finance' },
    { id: 'TASK-M002', title: 'BAZ capacity expansion – Phase 2', owner: 'Yotam Keret', priority: 'high', status: 'in-progress', dueDate: 'Jun 20', lastUpdated: '1d ago', category: 'Projects', description: 'Phase 2 of 3 — 60% complete, Phase 3 scoping next week' },
    { id: 'TASK-M003', title: 'Inventory system upgrade – UAT sign-off', owner: 'Yotam Keret', priority: 'critical', status: 'in-progress', dueDate: 'Jun 20', lastUpdated: '18h ago', category: 'Projects', description: 'UAT in progress — 3 critical bugs resolved, 2 remaining' },
    { id: 'TASK-M004', title: 'Resolve System 124 customs documentation', owner: 'Yotam Keret', priority: 'critical', status: 'overdue', dueDate: 'May 24', lastUpdated: '3d ago', category: 'Logistics' },
    { id: 'TASK-M005', title: 'Q2 logistics review with leadership', owner: 'Yotam Keret', priority: 'high', status: 'overdue', dueDate: 'May 26', lastUpdated: '2d ago', category: 'Operations' },
    { id: 'TASK-M006', title: 'Approve PO-4573 – System 120 components', owner: 'Yotam Keret', priority: 'high', status: 'open', dueDate: 'May 29', lastUpdated: '1d ago', category: 'Procurement' },
    { id: 'TASK-M007', title: 'Follow up on Kappa Corp delay', owner: 'Yotam Keret', priority: 'critical', status: 'open', dueDate: 'May 29', lastUpdated: '2d ago', category: 'Logistics' },
    { id: 'TASK-M008', title: 'New supplier onboarding – legal approval', owner: 'Yotam Keret', priority: 'medium', status: 'open', dueDate: 'Jun 15', lastUpdated: '3d ago', category: 'Procurement' },
    { id: 'TASK-M009', title: 'Emergency R&D component procurement', owner: 'Yotam Keret', priority: 'critical', status: 'completed', dueDate: 'May 27', lastUpdated: '14h ago', category: 'Procurement' },
    { id: 'TASK-M010', title: 'Frontier Defense – 12-system batch shipped', owner: 'Yotam Keret', priority: 'high', status: 'completed', dueDate: 'May 5', lastUpdated: '3w ago', category: 'Logistics' },
    { id: 'TASK-M011', title: 'Customs backlog clearance – 8 cases', owner: 'Yotam Keret', priority: 'high', status: 'completed', dueDate: 'May 19', lastUpdated: '1w ago', category: 'Logistics' },
    { id: 'TASK-M012', title: 'Q2 inventory close – accuracy audit', owner: 'Yotam Keret', priority: 'medium', status: 'completed', dueDate: 'Jun 1', lastUpdated: '12h ago', category: 'Inventory' },
    // Other owners
    { id: 'TASK-M013', title: 'Oracle accuracy project', owner: 'Dan Cohen', priority: 'high', status: 'completed', dueDate: 'May 20', lastUpdated: '1w ago', category: 'Inventory' },
    { id: 'TASK-M014', title: 'MSC full deployment sign-off', owner: 'Amit Levy', priority: 'high', status: 'completed', dueDate: 'May 14', lastUpdated: '2w ago', category: 'Deployments' },
    { id: 'TASK-M015', title: 'R&D monthly support coordination', owner: 'Noa Shaked', priority: 'medium', status: 'completed', dueDate: 'May 30', lastUpdated: '1d ago', category: 'Support' },
    { id: 'TASK-M016', title: 'Oracle–SAP data mapping session', owner: 'Dan Cohen', priority: 'high', status: 'in-progress', dueDate: 'Jun 30', lastUpdated: '2d ago', category: 'Projects' },
    { id: 'TASK-M017', title: 'Zenith Site C deployment docs', owner: 'Noa Shaked', priority: 'high', status: 'in-progress', dueDate: 'May 28', lastUpdated: '20h ago', category: 'Deployments' },
  ],

  quarterly: [
    // Yotam Keret
    { id: 'TASK-Q001', title: 'BAZ capacity expansion – full delivery', owner: 'Yotam Keret', priority: 'high', status: 'in-progress', dueDate: 'Jun 20', lastUpdated: '1d ago', category: 'Projects', description: 'Phase 2 of 3 complete — Phase 3 starts Jun 2' },
    { id: 'TASK-Q002', title: 'Inventory system upgrade – production release', owner: 'Yotam Keret', priority: 'critical', status: 'in-progress', dueDate: 'Jun 20', lastUpdated: '18h ago', category: 'Projects', description: 'UAT in progress — release gate review Jun 15' },
    { id: 'TASK-Q003', title: 'Regional deployment plan – Q3 handoff', owner: 'Yotam Keret', priority: 'high', status: 'open', dueDate: 'Jun 25', lastUpdated: '2d ago', category: 'Projects' },
    { id: 'TASK-Q004', title: 'Q2 ops review presentation', owner: 'Yotam Keret', priority: 'high', status: 'open', dueDate: 'Jun 30', lastUpdated: '1d ago', category: 'Operations' },
    { id: 'TASK-Q005', title: 'Resolve System 124 customs documentation', owner: 'Yotam Keret', priority: 'critical', status: 'overdue', dueDate: 'May 24', lastUpdated: '3d ago', category: 'Logistics' },
    { id: 'TASK-Q006', title: 'Q2 logistics review with leadership', owner: 'Yotam Keret', priority: 'high', status: 'overdue', dueDate: 'May 26', lastUpdated: '2d ago', category: 'Operations' },
    { id: 'TASK-Q007', title: 'Q2 supplier renegotiation – 3 contracts', owner: 'Yotam Keret', priority: 'high', status: 'completed', dueDate: 'Apr 15', lastUpdated: '6w ago', category: 'Procurement' },
    { id: 'TASK-Q008', title: 'BAZ safety audit and certification', owner: 'Yotam Keret', priority: 'medium', status: 'completed', dueDate: 'Apr 22', lastUpdated: '5w ago', category: 'Operations' },
    { id: 'TASK-Q009', title: 'Enterprise batch shipment – 28 units', owner: 'Yotam Keret', priority: 'high', status: 'completed', dueDate: 'Apr 18', lastUpdated: '7w ago', category: 'Logistics' },
    { id: 'TASK-Q010', title: 'Q2 inventory accuracy close', owner: 'Yotam Keret', priority: 'medium', status: 'completed', dueDate: 'Jun 1', lastUpdated: '12h ago', category: 'Inventory' },
    { id: 'TASK-Q011', title: 'Emergency R&D procurement programme', owner: 'Yotam Keret', priority: 'critical', status: 'completed', dueDate: 'May 27', lastUpdated: '14h ago', category: 'Procurement' },
    { id: 'TASK-Q012', title: 'Customs backlog clearance – Q2', owner: 'Yotam Keret', priority: 'high', status: 'completed', dueDate: 'May 19', lastUpdated: '1w ago', category: 'Logistics' },
    // Other owners
    { id: 'TASK-Q013', title: 'Oracle–SAP integration pilot', owner: 'Dan Cohen', priority: 'high', status: 'in-progress', dueDate: 'Jun 30', lastUpdated: '2d ago', category: 'Projects' },
    { id: 'TASK-Q014', title: 'New supplier onboarding – 4 vendors', owner: 'Amit Levy', priority: 'medium', status: 'in-progress', dueDate: 'Jun 15', lastUpdated: '3d ago', category: 'Procurement' },
    { id: 'TASK-Q015', title: 'Customer portal – ops module spec', owner: 'Noa Shaked', priority: 'high', status: 'in-progress', dueDate: 'Jun 30', lastUpdated: '1d ago', category: 'Projects' },
    { id: 'TASK-Q016', title: 'Q2 cross-functional support review', owner: 'Eliav Mizrahi', priority: 'medium', status: 'open', dueDate: 'Jun 25', lastUpdated: '4d ago', category: 'Support' },
    { id: 'TASK-Q017', title: 'Q1 ERP data cleanup', owner: 'Dan Cohen', priority: 'medium', status: 'completed', dueDate: 'Mar 31', lastUpdated: '9w ago', category: 'Projects' },
    { id: 'TASK-Q018', title: 'BAZ safety audit', owner: 'Noa Shaked', priority: 'medium', status: 'completed', dueDate: 'Apr 22', lastUpdated: '5w ago', category: 'Operations' },
  ],
};
