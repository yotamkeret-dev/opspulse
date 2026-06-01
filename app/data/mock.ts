export const kpis = [
  { label: 'Systems Delivered', value: '32', note: 'Full systems, replacements and upgrades' },
  { label: 'Installations Completed', value: '11', note: 'Salesforce source' },
  { label: 'PO Created', value: '74', note: 'Oracle source' },
  { label: 'Cross-Team Support Hours', value: '126h', note: 'R&D, Defence, Product, Finance and CS' },
  { label: 'Procurement Activity', value: '$284K', note: 'Supplier payments and purchase activity' },
  { label: 'Activities Completed', value: '148', note: 'Weekly operational throughput' },
  { label: 'Projects Advanced', value: '6', note: 'Strategic initiatives moved forward' },
  { label: 'Executive Highlights', value: '9', note: 'Key wins for leadership review' }
];

export const activityByCategory = [
  { name: 'Logistics', value: 32 },
  { name: 'Procurement', value: 41 },
  { name: 'Deployments', value: 18 },
  { name: 'Inventory', value: 24 },
  { name: 'Cross-Team Support', value: 29 }
];

export const supportByDept = [
  { name: 'R&D', hours: 42 },
  { name: 'Defence', hours: 31 },
  { name: 'Product', hours: 22 },
  { name: 'Finance', hours: 18 },
  { name: 'CS', hours: 13 }
];

export const trend = [
  { week: 'W48', activities: 96 },
  { week: 'W49', activities: 114 },
  { week: 'W50', activities: 102 },
  { week: 'W51', activities: 137 },
  { week: 'W52', activities: 148 }
];

export const highlights = [
  { title: 'Defence shipment completed', text: 'Urgent procurement, packing coordination and shipment release were completed within the same week.', tag: 'Defence' },
  { title: 'MSC installation milestone completed', text: 'Customer readiness, technician scheduling and installation coordination were completed end-to-end.', tag: 'Deployments' },
  { title: 'Critical supplier payment released', text: 'Finance and Operations aligned to release a critical supplier payment and protect delivery timelines.', tag: 'Finance' },
  { title: 'BAZ systems moved to shipment-ready status', text: 'Multiple systems were prepared, packed and released from BAZ for customer delivery.', tag: 'Logistics' },
  { title: 'Emergency R&D request supported', text: 'Short-notice components were sourced, purchased and delivered to keep an internal project moving.', tag: 'R&D' },
  { title: 'Oracle inventory cleanup completed', text: 'BAZ inventory report was reviewed and aligned with Oracle records to improve stock visibility.', tag: 'Inventory' }
];

export const logistics = [
  { metric: 'Systems Shipped', value: '32', detail: 'Full systems, replacements and upgrades' },
  { metric: 'Ready to Ship at BAZ', value: '14', detail: 'Packed and awaiting final release' },
  { metric: 'Customs Clearance', value: '7', detail: 'Shipments currently in active clearance' },
  { metric: 'Spare Parts Sent', value: '46', detail: 'Screens, switches, computers and service kits' }
];

export const procurement = [
  { metric: 'PO Created', value: '74', detail: 'Oracle purchase orders created this week' },
  { metric: 'Emergency Procurement Requests', value: '19', detail: 'Short-notice requests for R&D, Defence and Product' },
  { metric: 'Supplier Payments', value: '$284K', detail: 'Processed together with Finance' },
  { metric: 'Estimated Cost Savings', value: '$18.5K', detail: 'Negotiation, supplier alternatives and bulk planning' }
];

export const deployments = [
  { metric: 'Installations Completed', value: '11', detail: 'Completed end-to-end' },
  { metric: 'Maintenance Activities', value: '16', detail: 'Ad-hoc and planned customer work' },
  { metric: 'Customer Kickoffs', value: '5', detail: 'New customers and expansion activity' },
  { metric: 'Trainings Delivered', value: '8', detail: 'Internal and external onboarding' }
];

export const teamPulseStatus = [
  { name: 'Yotam Keret', submitted: true },
  { name: 'Dan Cohen', submitted: true },
  { name: 'Amit Levy', submitted: true },
  { name: 'Noa Shaked', submitted: true },
  { name: 'Eliav Mizrahi', submitted: false },
  { name: 'Liora Ben David', submitted: false },
  { name: 'Omer Shapiro', submitted: false },
];

export const feed = [
  { date: 'Mon', title: '4 systems released from BAZ', area: 'Logistics', detail: 'Systems packed and moved into shipment-ready status.' },
  { date: 'Tue', title: 'Emergency R&D procurement closed', area: 'Procurement', detail: 'Supplier sourced, PO created and ETA secured.' },
  { date: 'Wed', title: 'MSC deployment coordination completed', area: 'Deployments', detail: 'Customer readiness and technician schedule confirmed.' },
  { date: 'Thu', title: 'Inventory reconciliation completed', area: 'Inventory', detail: 'BAZ report aligned with Oracle inventory records.' },
  { date: 'Fri', title: 'Supplier payment risk removed', area: 'Finance', detail: 'Critical supplier payment released before it could delay delivery.' }
];
