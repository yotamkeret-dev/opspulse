'use client';
import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { KPIRecord, Period, kpiRecords, teamPulseStatus, timeRangeData } from './data/mock';

const pages = ['Executive Dashboard', 'Logistics', 'Procurement', 'Deployments & Installations', 'Cross Functional Support', 'Weekly Highlights', 'Activity Feed', 'Add Weekly Activity'];

type KPIItem = { label: string; value: string; note: string; priority: number };

function KPIGrid({ items, onKpiClick }: { items: KPIItem[]; onKpiClick: (item: KPIItem) => void }) {
  return (
    <div className="grid kpis">
      {items.map((item) => (
        <div
          className={`card kpi-p${item.priority} kpi-clickable`}
          key={item.label}
          onClick={() => onKpiClick(item)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onKpiClick(item)}
        >
          <div className="kpi-label">{item.label}</div>
          <div className="kpi-value">{item.value}</div>
          <div className="kpi-note">{item.note}</div>
        </div>
      ))}
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  delivered: 'status-completed',
  completed: 'status-completed',
  paid: 'status-completed',
  resolved: 'status-completed',
  approved: 'status-completed',
  'in-progress': 'status-in-progress',
  'in-transit': 'status-in-progress',
  'pending-approval': 'status-in-progress',
  pending: 'status-in-progress',
  delayed: 'status-blocked',
  'customs-hold': 'status-blocked',
  'parts-missing': 'status-blocked',
  'carrier-delay': 'status-blocked',
};

function KPIDetailPanel({ kpi, period, onClose }: { kpi: KPIItem; period: Period; onClose: () => void }) {
  const records: KPIRecord[] = kpiRecords[kpi.label]?.[period] ?? [];
  const periodLabel = timeRangeData[period].label;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const counterpartyHeader = records[0]?.counterpartyType ?? 'Counterparty';

  return (
    <>
      <div className="panel-overlay" onClick={onClose} />
      <div className="detail-panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-header">
          <div>
            <h3>{kpi.label}</h3>
            <div className="small">{records.length} record{records.length !== 1 ? 's' : ''} · {periodLabel}</div>
          </div>
          <button className="panel-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="panel-body">
          {records.length === 0 ? (
            <div className="panel-empty">
              <div className="panel-empty-icon">📋</div>
              <div>No records for this period</div>
            </div>
          ) : (
            <table className="record-table">
              <thead>
                <tr>
                  <th>Ref</th>
                  <th>Name</th>
                  {records.some(r => r.counterparty) && <th>{counterpartyHeader}</th>}
                  <th>Owner</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id}>
                    <td><span className="rec-id">{r.id}</span></td>
                    <td>
                      <div className="rec-name">{r.name}</div>
                      {r.notes && <div className="rec-notes">{r.notes}</div>}
                    </td>
                    {records.some(rec => rec.counterparty) && (
                      <td><span className="rec-counterparty">{r.counterparty ?? '—'}</span></td>
                    )}
                    <td>{r.owner}</td>
                    <td>
                      <span className={`status-badge ${STATUS_COLORS[r.status] ?? 'status-in-progress'}`}>
                        {r.status.replace(/-/g, ' ')}
                      </span>
                    </td>
                    <td>
                      <span className={`priority-label priority-${r.priority}`}>
                        <span className="priority-dot" />
                        {r.priority}
                      </span>
                    </td>
                    <td><span className="small">{r.date}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

function TimeFilter({ period, setPeriod }: { period: Period; setPeriod: (p: Period) => void }) {
  return (
    <div className="time-filter">
      {(['weekly', 'monthly', 'quarterly'] as Period[]).map(o => (
        <button key={o} className={o === period ? 'active' : ''} onClick={() => setPeriod(o)}>
          {o.charAt(0).toUpperCase() + o.slice(1)}
        </button>
      ))}
    </div>
  );
}

function Shell({ page, setPage, period, setPeriod, children }: {
  page: string;
  setPage: (p: string) => void;
  period: Period;
  setPeriod: (p: Period) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="logo">OpsPulse</div>
        <div className="tagline">Orca Operations Platform</div>
        <div className="nav">
          {pages.map((p) => (
            <button key={p} className={p === page ? 'active' : ''} onClick={() => setPage(p)}>{p}</button>
          ))}
        </div>
      </aside>
      <main className="main">
        <div className="topbar">
          <div>
            <b style={{ fontSize: 16 }}>{page}</b>
            <div className="small">Orca Operations Intelligence Platform</div>
          </div>
          <div className="topbar-right">
            <TimeFilter period={period} setPeriod={setPeriod} />
            <span className="badge">{timeRangeData[period].label}</span>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}

function Executive({ period }: { period: Period }) {
  const data = timeRangeData[period];
  const [selectedKpi, setSelectedKpi] = useState<KPIItem | null>(null);
  return (
    <>
      {selectedKpi && <KPIDetailPanel kpi={selectedKpi} period={period} onClose={() => setSelectedKpi(null)} />}
      <KPIGrid items={data.kpis} onKpiClick={setSelectedKpi} />

      <div className="grid two">
        <div className="card">
          <h2 className="section-title">Team Tasks Updates</h2>
          <div className="team-pulse-list">
            {teamPulseStatus.filter(m => m.submitted).map(m => (
              <div key={m.name} className="team-pulse-item">
                <span className="pulse-check">✓</span>
                <span className="pulse-name">{m.name}</span>
                <span className="small" style={{ color: 'var(--color-muted)' }}>{m.lastUpdated}</span>
                <span className="pill pill-green">Submitted</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="section-title">Support Hours by Department</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.supportByDept} layout="vertical" margin={{ top: 4, right: 54, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.07)" />
              <XAxis type="number" stroke="var(--color-muted)" tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="name" stroke="var(--color-muted)" tick={{ fontSize: 12 }} width={52} />
              <Tooltip contentStyle={{ background: '#0d192b', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10 }} />
              <Bar dataKey="hours" fill="var(--color-completed)" radius={[0, 8, 8, 0]}>
                <LabelList dataKey="hours" position="right" formatter={(v: unknown) => `${v}h`} style={{ fill: '#ffffff', fontWeight: 700, fontSize: 12 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h2 className="section-title">Operational Highlights</h2>
        <div className="grid two">
          {data.highlights.slice(0, 6).map(h => (
            <div className="highlight-item" key={h.title}>
              <span className="pill">{h.tag}</span>
              <b>{h.title}</b>
              <div className="small">{h.text}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function MetricPage({ title, intro, rows }: { title: string; intro: string; rows: { metric: string; value: string; detail: string; alert?: boolean }[] }) {
  return (
    <>
      <div className="page-header">
        <h2>{title}</h2>
        <div className="small">{intro}</div>
      </div>
      <div className="grid kpis">
        {rows.map(r => (
          <div className={`card${r.alert ? ' card-alert' : ''}`} key={r.metric}>
            <div className="kpi-label">{r.metric}</div>
            <div className="kpi-value">{r.value}</div>
            <div className="small">{r.detail}</div>
          </div>
        ))}
      </div>
    </>
  );
}

function Support({ period }: { period: Period }) {
  const data = timeRangeData[period];
  const activityCounts = { weekly: [18, 12, 9, 7, 6], monthly: [72, 48, 36, 28, 24], quarterly: [216, 144, 108, 84, 72] };
  const counts = activityCounts[period];
  const impacts = ['Urgent builds, testing support', 'Project procurement and shipments', 'Operational enablement', 'Supplier payments', 'Customer coordination'];
  return (
    <>
      <div className="page-header">
        <h2>Cross Functional Support</h2>
        <div className="small">Operations support hours by department — {timeRangeData[period].label}</div>
      </div>
      <div className="card">
        <table className="table">
          <thead>
            <tr><th>Department</th><th>Support Hours</th><th>Activities</th><th>Primary Impact</th></tr>
          </thead>
          <tbody>
            {data.supportByDept.map((d, i) => (
              <tr key={d.name}>
                <td><b>{d.name}</b></td>
                <td>{d.hours}h</td>
                <td>{counts[i]}</td>
                <td>{impacts[i]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Highlights({ period }: { period: Period }) {
  const data = timeRangeData[period];
  return (
    <>
      <div className="page-header">
        <h2>Operational Highlights</h2>
        <div className="small">Key achievements and delivery milestones — {timeRangeData[period].label}</div>
      </div>
      <div className="card highlight">
        {data.highlights.map(h => (
          <div className="highlight-item" key={h.title}>
            <span className="pill">{h.tag}</span>
            <b>{h.title}</b>
            <div className="small">{h.text}</div>
          </div>
        ))}
      </div>
    </>
  );
}

function ActivityFeed({ period }: { period: Period }) {
  const data = timeRangeData[period];
  return (
    <>
      <div className="page-header">
        <h2>Operations Activity Feed</h2>
        <div className="small">Timeline of operational activities — {timeRangeData[period].label}</div>
      </div>
      <div className="timeline">
        {data.feed.map(e => (
          <div className="event" key={e.title}>
            <div><span className="pill">{e.date}</span></div>
            <div>
              <span className="pill">{e.area}</span>
              <h3 style={{ margin: '6px 0 4px', fontSize: 15 }}>{e.title}</h3>
              <div className="small">{e.detail}</div>
              <div className="event-meta">
                <span className="owner-tag">↳ {e.owner}</span>
                <span className={`status-badge status-${e.status}`}>{e.status}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function AddWeeklyActivity() {
  const [activities, setActivities] = useState([
    { employee: 'Ops Team', category: 'Procurement', department: 'R&D', title: 'Emergency R&D procurement completed', highlight: 'Yes' },
    { employee: 'Ops Team', category: 'Logistics', department: 'Operations', title: '4 systems released from BAZ', highlight: 'Yes' }
  ]);
  const [category, setCategory] = useState('Procurement');
  const [department, setDepartment] = useState('Operations');
  const [employee, setEmployee] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [highlight, setHighlight] = useState(false);

  const saveActivity = () => {
    if (!title.trim()) { alert('Please enter an activity title'); return; }
    setActivities([{ employee, category, department, title, highlight: highlight ? 'Yes' : 'No' }, ...activities]);
    setEmployee(''); setTitle(''); setDescription(''); setHighlight(false);
  };

  return (
    <>
      <div className="page-header">
        <h2>Add Weekly Activity</h2>
        <div className="small">Capture completed work, achievements and operational impact.</div>
      </div>

      <div className="card">
        <h2 className="section-title">Weekly Team Input</h2>
        <div className="grid two">
          <div>
            <div className="kpi-label">Category</div>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option>Procurement</option>
              <option>Logistics</option>
              <option>Deployments &amp; Installations</option>
              <option>Inventory</option>
              <option>Finance Support</option>
              <option>Cross Functional Support</option>
            </select>
          </div>
          <div>
            <div className="kpi-label">Department Supported</div>
            <select className="input" value={department} onChange={(e) => setDepartment(e.target.value)}>
              <option>Operations</option>
              <option>R&amp;D</option>
              <option>Defence</option>
              <option>Product</option>
              <option>Finance</option>
              <option>Customer Success</option>
            </select>
          </div>
          <div>
            <div className="kpi-label">Employee Name</div>
            <input className="input" value={employee} onChange={(e) => setEmployee(e.target.value)} placeholder="Enter employee name" />
          </div>
          <div>
            <div className="kpi-label">Activity Title</div>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Example: Emergency R&D procurement completed" />
          </div>
        </div>
        <div style={{ marginTop: 18 }}>
          <div className="kpi-label">Short Description</div>
          <textarea className="input" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe what was completed and why it mattered." />
        </div>
        <div style={{ marginTop: 16 }}>
          <label style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={highlight} onChange={(e) => setHighlight(e.target.checked)} />
            Include in Weekly Highlights
          </label>
        </div>
        <button className="save-button" onClick={saveActivity}>Save Activity</button>
      </div>

      <div className="card">
        <h2 className="section-title">Recent Team Activities</h2>
        <table className="table">
          <thead>
            <tr><th>Employee</th><th>Category</th><th>Department</th><th>Activity</th><th>Highlight</th></tr>
          </thead>
          <tbody>
            {activities.map((a, i) => (
              <tr key={i}>
                <td>{a.employee || '—'}</td>
                <td>{a.category}</td>
                <td>{a.department}</td>
                <td><b>{a.title}</b></td>
                <td>{a.highlight}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function App() {
  const [page, setPage] = useState('Executive Dashboard');
  const [period, setPeriod] = useState<Period>('weekly');
  const data = timeRangeData[period];

  let content = <Executive period={period} />;
  if (page === 'Logistics') content = <MetricPage title="Logistics" intro="Shipment readiness, customs visibility, BAZ status and spare part movement." rows={data.logistics} />;
  if (page === 'Procurement') content = <MetricPage title="Procurement" intro="Purchase orders, emergency requests, supplier payments and cost savings." rows={data.procurement} />;
  if (page === 'Deployments & Installations') content = <MetricPage title="Deployments & Installations" intro="Installations, maintenance, customer kickoffs and training activity." rows={data.deployments} />;
  if (page === 'Cross Functional Support') content = <Support period={period} />;
  if (page === 'Weekly Highlights') content = <Highlights period={period} />;
  if (page === 'Activity Feed') content = <ActivityFeed period={period} />;
  if (page === 'Add Weekly Activity') content = <AddWeeklyActivity />;

  return <Shell page={page} setPage={setPage} period={period} setPeriod={setPeriod}>{content}</Shell>;
}
