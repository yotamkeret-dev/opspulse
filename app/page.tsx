'use client';
import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  ACTIVITY_CATEGORIES, KPIRecord, Period, SupportLog, TeamMember,
  filterLogsByPeriod, kpiRecords, seedSupportLogs,
  teamMembers, teamPulseStatus, timeRangeData,
} from './data/mock';
import { createClient } from '@/lib/supabase/client';

// ─── Mode flag ─────────────────────────────────────────────────────────────
// DEMO_MODE=true  → seed data + localStorage, no auth required (default when env var absent)
// DEMO_MODE=false → Supabase DB + email authentication enforced by middleware
const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';

// ─── localStorage persistence (Demo Mode only) ─────────────────────────────
const USER_LOGS_KEY = 'opspulse-user-logs';

function loadUserLogs(): SupportLog[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(USER_LOGS_KEY);
    return raw ? (JSON.parse(raw) as SupportLog[]) : [];
  } catch { return []; }
}

function persistUserLogs(logs: SupportLog[]): void {
  try { localStorage.setItem(USER_LOGS_KEY, JSON.stringify(logs)); } catch { /* silent */ }
}

// ─── Supabase helpers (Production Mode only) ───────────────────────────────
// Maps DB snake_case rows to our SupportLog camelCase type.
function rowToLog(row: Record<string, unknown>): SupportLog {
  return {
    id:           String(row.id),
    employeeId:   String(row.employee_id),
    employeeName: String(row.employee_name),
    department:   String(row.department),
    category:     String(row.category),
    title:        String(row.title),
    hours:        Number(row.hours),
    date:         String(row.date),
    week:         String(row.week),
    notes:        String(row.notes ?? ''),
  };
}

async function fetchLogsFromDB(): Promise<SupportLog[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('support_logs')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error('fetchLogs:', error.message); return []; }
  return (data ?? []).map(rowToLog);
}

async function insertLogToDB(
  log: SupportLog,
  userId: string,
  userEmail: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('support_logs').insert({
    id:             log.id,
    employee_id:    log.employeeId,
    employee_name:  log.employeeName,
    employee_email: userEmail,
    department:     log.department,
    category:       log.category,
    title:          log.title,
    hours:          log.hours,
    date:           log.date,
    week:           log.week,
    notes:          log.notes,
    created_by:     userId,
  });
  if (error) throw new Error(error.message);
}

const pages = [
  'Executive Dashboard', 'Team Contributions', 'Logistics', 'Procurement',
  'Deployments & Installations', 'Cross Functional Support',
  'Weekly Highlights', 'Activity Feed', 'Add Weekly Activity',
];

type KPIItem = { label: string; value: string; note: string; priority: number };

// Maps a YYYY-MM-DD date string to the nearest week tag used in PERIOD_WEEKS
function getWeekTag(dateStr: string): string {
  if (!dateStr) return 'W22';
  const d = new Date(dateStr);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  if (m >= 6) return 'W22';
  if (m === 5) {
    if (day >= 26) return 'W22';
    if (day >= 19) return 'W21';
    if (day >= 12) return 'W20';
    if (day >= 5)  return 'W19';
    return 'W18';
  }
  if (m === 4) {
    if (day >= 21) return 'W17';
    if (day >= 14) return 'W16';
    if (day >= 7)  return 'W15';
    return 'W14';
  }
  return 'W13';
}

// Derive support chart data from logs
function buildSupportByDept(logs: SupportLog[]): { name: string; hours: number }[] {
  const map: Record<string, number> = {};
  logs.forEach(l => { map[l.department] = (map[l.department] || 0) + l.hours; });
  return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([name, hours]) => ({ name, hours }));
}

// ─── Base components ───────────────────────────────────────────────────────

function KPIGrid({ items, onKpiClick }: { items: KPIItem[]; onKpiClick: (item: KPIItem) => void }) {
  return (
    <div className="grid kpis">
      {items.map(item => (
        <div
          className={`card kpi-p${item.priority} kpi-clickable`}
          key={item.label}
          onClick={() => onKpiClick(item)}
          role="button" tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && onKpiClick(item)}
        >
          <div className="kpi-label">{item.label}</div>
          <div className="kpi-value">{item.value}</div>
          <div className="kpi-note">{item.note}</div>
        </div>
      ))}
    </div>
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

function Shell({ page, setPage, period, setPeriod, authEmail, onSignOut, children }: {
  page: string; setPage: (p: string) => void;
  period: Period; setPeriod: (p: Period) => void;
  authEmail?: string;
  onSignOut?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="logo">OpsPulse</div>
        <div className="tagline">Orca Operations Platform</div>
        <div className="nav">
          {pages.map(p => (
            <button
              key={p}
              className={[p === page ? 'active' : '', p === 'Team Contributions' ? 'nav-contrib' : ''].filter(Boolean).join(' ')}
              onClick={() => setPage(p)}
            >{p}</button>
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
            {DEMO_MODE && <span className="badge badge-demo">Demo</span>}
            {!DEMO_MODE && authEmail && (
              <div className="auth-user">
                <span className="small auth-email">{authEmail}</span>
                <button className="signout-btn" onClick={onSignOut}>Sign out</button>
              </div>
            )}
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}

// ─── KPI Detail Panel ──────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  delivered: 'status-completed', completed: 'status-completed',
  paid: 'status-completed', resolved: 'status-completed', approved: 'status-completed',
  'in-progress': 'status-in-progress', 'in-transit': 'status-in-progress',
  'pending-approval': 'status-in-progress', pending: 'status-in-progress',
  'customs-hold': 'status-blocked',
};

function KPIDetailPanel({ kpi, period, onClose }: { kpi: KPIItem; period: Period; onClose: () => void }) {
  const records: KPIRecord[] = kpiRecords[kpi.label]?.[period] ?? [];
  const periodLabel = timeRangeData[period].label;
  const counterpartyHeader = records[0]?.counterpartyType ?? 'Counterparty';

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <>
      <div className="panel-overlay" onClick={onClose} />
      <div className="detail-panel" onClick={e => e.stopPropagation()}>
        <div className="panel-header">
          <div>
            <h3>{kpi.label}</h3>
            <div className="small" style={{ marginTop: 4 }}>
              {records.length} record{records.length !== 1 ? 's' : ''} · {periodLabel}
            </div>
          </div>
          <button className="panel-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="panel-body">
          {records.length === 0 ? (
            <div className="panel-empty"><div className="panel-empty-icon">📋</div><div>No records for this period</div></div>
          ) : (
            <table className="record-table">
              <thead>
                <tr>
                  <th>Ref</th><th>Name</th>
                  {records.some(r => r.counterparty) && <th>{counterpartyHeader}</th>}
                  <th>Owner</th><th>Status</th><th>Priority</th><th>Date</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
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
                    <td><span className={`status-badge ${STATUS_COLORS[r.status] ?? 'status-in-progress'}`}>{r.status.replace(/-/g, ' ')}</span></td>
                    <td><span className={`priority-label priority-${r.priority}`}><span className="priority-dot" />{r.priority}</span></td>
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

// ─── Team Member Contribution Panel (Last Updates on Executive Dashboard) ──

function TeamMemberPanel({ memberName, period, supportLogs, onClose }: {
  memberName: string; period: Period; supportLogs: SupportLog[]; onClose: () => void;
}) {
  const logs = filterLogsByPeriod(supportLogs, period).filter(l => l.employeeName === memberName);
  const hours = logs.reduce((s, l) => s + l.hours, 0);
  const depts = [...new Set(logs.map(l => l.department))];
  const byDept = buildSupportByDept(logs);
  const periodWord = period === 'weekly' ? 'week' : period === 'monthly' ? 'month' : 'quarter';

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <>
      <div className="panel-overlay" onClick={onClose} />
      <div className="detail-panel" onClick={e => e.stopPropagation()}>
        <div className="panel-header">
          <div>
            <h3>{memberName}</h3>
            <div className="small" style={{ marginTop: 4 }}>
              {hours}h · {logs.length} activities · {depts.length} dept{depts.length !== 1 ? 's' : ''} · {timeRangeData[period].label}
            </div>
          </div>
          <button className="panel-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="panel-body">
          {logs.length === 0 ? (
            <div className="panel-empty">
              <div className="panel-empty-icon">📊</div>
              <div>No contributions logged this {periodWord}</div>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 20 }}>
                <div className="task-section-header" style={{ marginBottom: 8 }}>
                  <span className="task-section-title">Hours by Department</span>
                </div>
                {byDept.map(({ name, hours: h }) => (
                  <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.05)', fontSize: 13 }}>
                    <span>{name}</span>
                    <span style={{ fontWeight: 700, color: 'var(--color-completed)' }}>{h}h</span>
                  </div>
                ))}
              </div>
              <div>
                <div className="task-section-header" style={{ marginBottom: 8 }}>
                  <span className="task-section-title">Activity Log</span>
                  <span className="task-count">{logs.length}</span>
                </div>
                <table className="record-table">
                  <thead><tr><th>Activity</th><th>Dept</th><th>Hours</th><th>Date</th></tr></thead>
                  <tbody>
                    {logs.map(l => (
                      <tr key={l.id}>
                        <td>
                          <div className="rec-name">{l.title}</div>
                          {l.notes && <div className="rec-notes">{l.notes}</div>}
                        </td>
                        <td><span className="pill" style={{ fontSize: 11, padding: '2px 6px' }}>{l.department}</span></td>
                        <td style={{ fontWeight: 700, color: 'var(--color-completed)', whiteSpace: 'nowrap' }}>{l.hours}h</td>
                        <td><span className="small">{l.date}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Employee Contribution Panel (Team Contributions page) ─────────────────

function EmployeePanel({ member, period, supportLogs, onClose }: {
  member: TeamMember; period: Period; supportLogs: SupportLog[]; onClose: () => void;
}) {
  const logs = filterLogsByPeriod(supportLogs, period).filter(l => l.employeeId === member.id);
  const hours = logs.reduce((s, l) => s + l.hours, 0);
  const depts = [...new Set(logs.map(l => l.department))];
  const byDept = buildSupportByDept(logs);
  const periodWord = period === 'weekly' ? 'week' : period === 'monthly' ? 'month' : 'quarter';

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <>
      <div className="panel-overlay" onClick={onClose} />
      <div className="detail-panel" onClick={e => e.stopPropagation()}>
        <div className="panel-header">
          <div>
            <h3>{member.name}</h3>
            <div className="small" style={{ marginTop: 2 }}>{member.role}</div>
            <div className="small" style={{ marginTop: 4 }}>
              {hours}h · {logs.length} activities · {depts.length} dept{depts.length !== 1 ? 's' : ''} · {timeRangeData[period].label}
            </div>
          </div>
          <button className="panel-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="panel-body">
          {logs.length === 0 ? (
            <div className="panel-empty">
              <div className="panel-empty-icon">📊</div>
              <div>No contributions logged this {periodWord}</div>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 20 }}>
                <div className="task-section-header" style={{ marginBottom: 8 }}>
                  <span className="task-section-title">Hours by Department</span>
                </div>
                {byDept.map(({ name, hours: h }) => (
                  <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,.05)', fontSize: 13 }}>
                    <span>{name}</span>
                    <span style={{ fontWeight: 700, color: 'var(--color-completed)' }}>{h}h</span>
                  </div>
                ))}
              </div>
              <div>
                <div className="task-section-header" style={{ marginBottom: 8 }}>
                  <span className="task-section-title">Contribution History</span>
                  <span className="task-count">{logs.length}</span>
                </div>
                <table className="record-table">
                  <thead><tr><th>Activity</th><th>Department</th><th>Hours</th><th>Date</th></tr></thead>
                  <tbody>
                    {logs.map(l => (
                      <tr key={l.id}>
                        <td>
                          <div className="rec-name">{l.title}</div>
                          {l.notes && <div className="rec-notes">{l.notes}</div>}
                        </td>
                        <td><span className="pill" style={{ fontSize: 11, padding: '2px 6px' }}>{l.department}</span></td>
                        <td style={{ fontWeight: 700, color: 'var(--color-completed)', whiteSpace: 'nowrap' }}>{l.hours}h</td>
                        <td><span className="small">{l.date}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Team Contributions page ───────────────────────────────────────────────

function TeamContributions({ period, supportLogs }: { period: Period; supportLogs: SupportLog[] }) {
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const filtered = filterLogsByPeriod(supportLogs, period);

  const memberStats = teamMembers.map(m => {
    const logs = filtered.filter(l => l.employeeId === m.id);
    const hours = logs.reduce((s, l) => s + l.hours, 0);
    const depts = [...new Set(logs.map(l => l.department))];
    const lastLog = logs[0];
    return { member: m, hours, activities: logs.length, depts, lastLog };
  }).filter(s => s.activities > 0);

  const totalHours = filtered.reduce((s, l) => s + l.hours, 0);
  const totalActivities = filtered.length;
  const activeMembersCount = memberStats.length;
  const deptCount = [...new Set(filtered.map(l => l.department))].length;

  return (
    <>
      {selectedMember && (
        <EmployeePanel member={selectedMember} period={period} supportLogs={supportLogs} onClose={() => setSelectedMember(null)} />
      )}

      <div className="page-header">
        <h2>Team Contributions</h2>
        <div className="small">Operations team impact · {timeRangeData[period].label}</div>
      </div>

      <div className="grid kpis">
        <div className="card kpi-p1">
          <div className="kpi-label">Total Support Hours</div>
          <div className="kpi-value">{totalHours}h</div>
          <div className="kpi-note">Team combined output</div>
        </div>
        <div className="card kpi-p1">
          <div className="kpi-label">Activities Logged</div>
          <div className="kpi-value">{totalActivities}</div>
          <div className="kpi-note">Completed contributions</div>
        </div>
        <div className="card kpi-p2">
          <div className="kpi-label">Active Contributors</div>
          <div className="kpi-value">{activeMembersCount}</div>
          <div className="kpi-note">Members with activity</div>
        </div>
        <div className="card kpi-p2">
          <div className="kpi-label">Departments Supported</div>
          <div className="kpi-value">{deptCount}</div>
          <div className="kpi-note">Cross-functional reach</div>
        </div>
      </div>

      {memberStats.length === 0 ? (
        <div className="card"><div className="panel-empty"><div className="panel-empty-icon">📊</div><div>No contributions logged for this period</div></div></div>
      ) : (
        <div className="contrib-grid">
          {memberStats.map(({ member, hours, activities, depts, lastLog }) => (
            <div key={member.id} className="contrib-card" onClick={() => setSelectedMember(member)} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && setSelectedMember(member)}>
              <div className="contrib-header">
                <div className="contrib-name">{member.name}</div>
                <div className="small">{member.role}</div>
              </div>
              <div className="contrib-stats">
                <div className="contrib-stat">
                  <div className="contrib-stat-value">{hours}h</div>
                  <div className="contrib-stat-label">Hours</div>
                </div>
                <div className="contrib-stat">
                  <div className="contrib-stat-value">{activities}</div>
                  <div className="contrib-stat-label">Activities</div>
                </div>
                <div className="contrib-stat">
                  <div className="contrib-stat-value">{depts.length}</div>
                  <div className="contrib-stat-label">Depts</div>
                </div>
              </div>
              <div className="contrib-depts">
                {depts.slice(0, 3).map(d => <span key={d} className="pill" style={{ fontSize: 11 }}>{d}</span>)}
              </div>
              {lastLog && <div className="contrib-last small">Latest: {lastLog.title}</div>}
              <button className="last-updates-btn" style={{ marginTop: 10, width: '100%', justifyContent: 'center' }}>
                View Contributions ↗
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ─── Executive Dashboard ───────────────────────────────────────────────────

function Executive({ period, supportLogs }: { period: Period; supportLogs: SupportLog[] }) {
  const data = timeRangeData[period];
  const [selectedKpi, setSelectedKpi]       = useState<KPIItem | null>(null);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);

  const openKpi    = (kpi: KPIItem) => { setSelectedMember(null); setSelectedKpi(kpi); };
  const openMember = (name: string) => { setSelectedKpi(null); setSelectedMember(name); };

  // Derive live metrics from SupportLog
  const filtered        = filterLogsByPeriod(supportLogs, period);
  const derivedActivities = filtered.length;
  const derivedHours    = filtered.reduce((s, l) => s + l.hours, 0);
  const derivedSupport  = buildSupportByDept(filtered);

  // Override two KPI values with live derived data
  const kpis = data.kpis.map(k => {
    if (k.label === 'Activities Completed')      return { ...k, value: String(derivedActivities) };
    if (k.label === 'Cross-Team Support Hours')  return { ...k, value: `${derivedHours}h` };
    return k;
  });

  return (
    <>
      {selectedKpi    && <KPIDetailPanel kpi={selectedKpi} period={period} onClose={() => setSelectedKpi(null)} />}
      {selectedMember && <TeamMemberPanel memberName={selectedMember} period={period} supportLogs={supportLogs} onClose={() => setSelectedMember(null)} />}

      <KPIGrid items={kpis} onKpiClick={openKpi} />

      <div className="grid two">
        <div className="card">
          <h2 className="section-title">Team Last Updates</h2>
          <div className="team-pulse-list">
            {teamPulseStatus.filter(m => m.submitted).map(m => {
              const memberLogs = filtered.filter(l => l.employeeName === m.name);
              const hours = memberLogs.reduce((s, l) => s + l.hours, 0);
              const depts = [...new Set(memberLogs.map(l => l.department))];
              const lines: string[] = [];
              if (hours > 0) lines.push(`${hours}h delivered`);
              if (depts.length > 0) lines.push(depts.slice(0, 2).join(' · '));
              return (
                <div key={m.name} className="team-pulse-item">
                  <span className="pulse-check">✓</span>
                  <div className="pulse-info">
                    <div className="pulse-name">{m.name}</div>
                    {lines.length > 0 && <div className="pulse-summary">{lines.join(' · ')}</div>}
                  </div>
                  <button className="last-updates-btn" onClick={() => openMember(m.name)}>
                    Last Updates ↗
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <h2 className="section-title">Support Hours by Department</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={derivedSupport} layout="vertical" margin={{ top: 4, right: 54, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.07)" />
              <XAxis type="number" stroke="var(--color-muted)" tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="name" stroke="var(--color-muted)" tick={{ fontSize: 12 }} width={72} />
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

// ─── Metric pages (Logistics / Procurement / Deployments) ─────────────────

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

// ─── Cross Functional Support (fully derived) ──────────────────────────────

function Support({ period, supportLogs }: { period: Period; supportLogs: SupportLog[] }) {
  const filtered = filterLogsByPeriod(supportLogs, period);
  const byDept   = buildSupportByDept(filtered);
  const impacts: Record<string, string> = {
    'R&D': 'Urgent builds, testing support',
    'Defence': 'Project procurement and shipments',
    'Product': 'Operational enablement',
    'Finance': 'Supplier payments',
    'Customer Success': 'Customer coordination',
    'Sales': 'Sales support and enablement',
    'Operations': 'Internal operations support',
  };

  return (
    <>
      <div className="page-header">
        <h2>Cross Functional Support</h2>
        <div className="small">Operations support hours by department · {timeRangeData[period].label}</div>
      </div>
      <div className="card">
        {byDept.length === 0 ? (
          <div className="panel-empty"><div className="panel-empty-icon">📊</div><div>No support hours logged for this period</div></div>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Department</th><th>Support Hours</th><th>Activities</th><th>Primary Impact</th></tr>
            </thead>
            <tbody>
              {byDept.map(({ name, hours }) => {
                const activities = filtered.filter(l => l.department === name).length;
                return (
                  <tr key={name}>
                    <td><b>{name}</b></td>
                    <td>{hours}h</td>
                    <td>{activities}</td>
                    <td>{impacts[name] ?? 'Cross-functional support'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

// ─── Highlights ────────────────────────────────────────────────────────────

function Highlights({ period }: { period: Period }) {
  const data = timeRangeData[period];
  return (
    <>
      <div className="page-header">
        <h2>Operational Highlights</h2>
        <div className="small">Key achievements and delivery milestones · {timeRangeData[period].label}</div>
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

// ─── Activity Feed (derived from SupportLog) ───────────────────────────────

function ActivityFeed({ period, supportLogs }: { period: Period; supportLogs: SupportLog[] }) {
  const logs = filterLogsByPeriod(supportLogs, period);
  return (
    <>
      <div className="page-header">
        <h2>Operations Activity Feed</h2>
        <div className="small">Live contribution log · {timeRangeData[period].label}</div>
      </div>
      {logs.length === 0 ? (
        <div className="card"><div className="panel-empty"><div className="panel-empty-icon">📋</div><div>No activities logged for this period</div></div></div>
      ) : (
        <div className="timeline">
          {logs.map(l => (
            <div key={l.id} className="event">
              <div><span className="pill">{l.date}</span></div>
              <div>
                <span className="pill">{l.department}</span>
                <h3 style={{ margin: '6px 0 4px', fontSize: 15 }}>{l.title}</h3>
                {l.notes && <div className="small">{l.notes}</div>}
                <div className="event-meta">
                  <span className="owner-tag">↳ {l.employeeName}</span>
                  <span className="status-badge status-completed">{l.hours}h</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ─── Add Weekly Activity (primary contribution logging engine) ─────────────

function AddWeeklyActivity({ addLog }: { addLog: (log: SupportLog) => void }) {
  const [employeeId,  setEmployeeId]  = useState('');
  const [department,  setDepartment]  = useState('R&D');
  const [category,    setCategory]    = useState<string>(ACTIVITY_CATEGORIES[0]);
  const [title,       setTitle]       = useState('');
  const [hours,       setHours]       = useState('');
  const [date,        setDate]        = useState(new Date().toISOString().slice(0, 10));
  const [notes,       setNotes]       = useState('');
  const [recent,      setRecent]      = useState<SupportLog[]>([]);

  const save = () => {
    const member = teamMembers.find(m => m.id === employeeId);
    if (!member || !title.trim() || !hours || parseFloat(hours) <= 0) {
      alert('Please fill in all required fields (Employee, Title, Hours).');
      return;
    }
    const log: SupportLog = {
      id: `LOG-${Date.now()}`,
      employeeId,
      employeeName: member.name,
      department,
      category,
      title,
      hours: parseFloat(hours),
      date,
      week: getWeekTag(date),
      notes,
    };
    addLog(log);
    setRecent(prev => [log, ...prev]);
    setTitle(''); setHours(''); setNotes('');
  };

  return (
    <>
      <div className="page-header">
        <h2>Add Weekly Activity</h2>
        <div className="small">Log completed support and operational contributions. All submissions update the dashboard in real time.</div>
      </div>

      <div className="card">
        <h2 className="section-title">Log Contribution</h2>
        <div className="grid two">
          <div>
            {/*
              auth-note: once login is added, employeeId will be set from session
              and this field will be auto-filled + locked for regular users.
              Admins/managers may retain the ability to log on behalf of others.
            */}
            <div className="kpi-label">Employee *</div>
            <select className="input" value={employeeId} onChange={e => setEmployeeId(e.target.value)}>
              <option value="">— Select employee —</option>
              {teamMembers.map(m => <option key={m.id} value={m.id}>{m.name} · {m.role}</option>)}
            </select>
            <div className="form-note">For now, select the employee manually. This will be auto-filled after login is added.</div>
          </div>
          <div>
            <div className="kpi-label">Department Supported *</div>
            <select className="input" value={department} onChange={e => setDepartment(e.target.value)}>
              {['R&D','Product','Finance','Customer Success','Sales','Defence','Operations'].map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <div className="kpi-label">Activity Type / Category</div>
            <select className="input" value={category} onChange={e => setCategory(e.target.value)}>
              {ACTIVITY_CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <div className="kpi-label">Hours Invested *</div>
            <input className="input" type="number" min="0.5" step="0.5" value={hours} onChange={e => setHours(e.target.value)} placeholder="e.g. 2.5" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <div className="kpi-label">Activity Title *</div>
            <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Test system preparation for R&D sprint" />
          </div>
          <div>
            <div className="kpi-label">Activity Date</div>
            <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <div className="kpi-label">Notes</div>
            <input className="input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional context or outcome" />
          </div>
        </div>
        <button className="save-button" onClick={save}>Log Activity</button>
      </div>

      {recent.length > 0 && (
        <div className="card">
          <h2 className="section-title">Submitted This Session</h2>
          <table className="table">
            <thead><tr><th>Employee</th><th>Department</th><th>Activity</th><th>Hours</th><th>Date</th></tr></thead>
            <tbody>
              {recent.map(l => (
                <tr key={l.id}>
                  <td>{l.employeeName}</td>
                  <td>{l.department}</td>
                  <td><b>{l.title}</b>{l.notes && <div className="small">{l.notes}</div>}</td>
                  <td style={{ fontWeight: 700, color: 'var(--color-completed)' }}>{l.hours}h</td>
                  <td>{l.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ─── App ───────────────────────────────────────────────────────────────────

export default function App() {
  const [page, setPage]     = useState('Executive Dashboard');
  const [period, setPeriod] = useState<Period>('weekly');

  // ── Demo Mode state ──────────────────────────────────────────────────────
  const [userLogs, setUserLogs] = useState<SupportLog[]>([]);

  // ── Production Mode state ────────────────────────────────────────────────
  const [dbLogs,    setDbLogs]    = useState<SupportLog[]>([]);
  const [authUser,  setAuthUser]  = useState<{ id: string; email: string } | null>(null);
  const [dbLoading, setDbLoading] = useState(!DEMO_MODE);

  // ── Bootstrap ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (DEMO_MODE) {
      const saved = loadUserLogs();
      if (saved.length > 0) setUserLogs(saved);
    } else {
      // Verify session (middleware already redirects if no session)
      const supabase = createClient();
      supabase.auth.getUser().then(async ({ data: { user } }) => {
        if (user) {
          setAuthUser({ id: user.id, email: user.email ?? '' });
          const logs = await fetchLogsFromDB();
          setDbLogs(logs);
        }
        setDbLoading(false);
      });
    }
  }, []);

  // ── Derived log array ─────────────────────────────────────────────────────
  // Demo  → localStorage submissions + seed data
  // Prod  → only real DB records (seed data hidden)
  const supportLogs: SupportLog[] = DEMO_MODE
    ? [...userLogs, ...seedSupportLogs]
    : dbLogs;

  // ── Add log ───────────────────────────────────────────────────────────────
  const addLog = async (log: SupportLog) => {
    if (DEMO_MODE) {
      setUserLogs(prev => {
        const updated = [log, ...prev];
        persistUserLogs(updated);
        return updated;
      });
    } else {
      try {
        await insertLogToDB(log, authUser!.id, authUser!.email);
        setDbLogs(prev => [log, ...prev]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        alert(`Failed to save activity: ${msg}`);
      }
    }
  };

  // ── Sign out ──────────────────────────────────────────────────────────────
  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  // ── Loading screen (production only, first paint) ─────────────────────────
  if (dbLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#07111f', color: '#8fa3bb', fontFamily: 'Inter, sans-serif', fontSize: 14 }}>
        Loading OpsPulse…
      </div>
    );
  }

  const data = timeRangeData[period];

  let content = <Executive period={period} supportLogs={supportLogs} />;
  if (page === 'Team Contributions')           content = <TeamContributions period={period} supportLogs={supportLogs} />;
  if (page === 'Logistics')                    content = <MetricPage title="Logistics" intro="Shipment readiness, customs visibility, BAZ status and spare part movement." rows={data.logistics} />;
  if (page === 'Procurement')                  content = <MetricPage title="Procurement" intro="Purchase orders, emergency requests, supplier payments and cost savings." rows={data.procurement} />;
  if (page === 'Deployments & Installations')  content = <MetricPage title="Deployments & Installations" intro="Installations, maintenance, customer kickoffs and training activity." rows={data.deployments} />;
  if (page === 'Cross Functional Support')     content = <Support period={period} supportLogs={supportLogs} />;
  if (page === 'Weekly Highlights')            content = <Highlights period={period} />;
  if (page === 'Activity Feed')                content = <ActivityFeed period={period} supportLogs={supportLogs} />;
  if (page === 'Add Weekly Activity')          content = <AddWeeklyActivity addLog={addLog} />;

  return (
    <Shell
      page={page} setPage={setPage}
      period={period} setPeriod={setPeriod}
      authEmail={authUser?.email}
      onSignOut={signOut}
    >
      {content}
    </Shell>
  );
}
