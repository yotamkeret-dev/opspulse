'use client';
import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { createClient } from '@/lib/supabase/client';
import {
  ACTIVITY_CATEGORIES, DashboardKpi, KPIRecord, MONTH_NAMES, Period, PeriodType,
  ProcurementCategory, ProcurementRecord, PROCUREMENT_CATEGORIES, PROCUREMENT_STATUSES,
  SupportLog, TeamMember, TimeFilter,
  currentTimeFilter, dashboardSections, filterLogsByTimeFilter, filterLogsByPeriod,
  getDateRangeForFilter, getTimeFilterLabel, kpiRecords, mockProcurementRecords, seedSupportLogs,
  teamMembers, timeRangeData,
} from './data/mock';

// Maps the new TimeFilter to the legacy Period for sub-pages that still use mock data.
function timeFilterToPeriod(tf: TimeFilter): Period {
  return tf.periodType === 'week' ? 'weekly' : tf.periodType === 'month' ? 'monthly' : 'quarterly';
}

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

// Fetches active team members from Supabase team_members table.
// Uses email as the stable TeamMember.id so the dropdown value is always email-based.
async function fetchTeamMembersFromDB(): Promise<TeamMember[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('team_members')
    .select('name, email, role')
    .eq('active', true)
    .order('name');
  if (error) { console.error('fetchTeamMembers:', error.message); return []; }
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id:    String(row.email),           // email as stable unique id
    name:  String(row.name),
    email: String(row.email),
    role:  String(row.role ?? 'Operations Specialist'),
  }));
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

// ─── Procurement DB helpers ────────────────────────────────────────────────

function rowToProcurementRecord(row: Record<string, unknown>): ProcurementRecord {
  return {
    id:           String(row.id),
    employeeId:   String(row.employee_id),
    employeeName: String(row.employee_name),
    poNumber:     String(row.po_number ?? ''),
    supplier:     String(row.supplier),
    amountUsd:    Number(row.amount_usd ?? 0),
    category:     String(row.category) as ProcurementRecord['category'],
    status:       String(row.status)   as ProcurementRecord['status'],
    notes:        String(row.notes ?? ''),
    date:         String(row.activity_date),
  };
}

async function fetchProcurementFromDB(tf: TimeFilter): Promise<ProcurementRecord[]> {
  const supabase = createClient();
  const { start, end } = getDateRangeForFilter(tf);
  const { data, error } = await supabase
    .from('procurement_records')
    .select('*')
    .gte('activity_date', start.toISOString().slice(0, 10))
    .lte('activity_date', end.toISOString().slice(0, 10))
    .order('activity_date', { ascending: false });
  if (error) { console.error('fetchProcurement:', error.message); return []; }
  return (data ?? []).map(rowToProcurementRecord);
}

async function insertProcurementToDB(record: ProcurementRecord): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('procurement_records').insert({
    id:            record.id,
    employee_id:   record.employeeId,
    employee_name: record.employeeName,
    po_number:     record.poNumber || null,
    supplier:      record.supplier,
    amount_usd:    record.amountUsd || null,
    category:      record.category,
    status:        record.status,
    notes:         record.notes,
    activity_date: record.date,
  });
  if (error) throw new Error(error.message);
}


const pages = [
  'Executive Dashboard', 'Team Contributions', 'Logistics', 'Procurement',
  'Cross Functional Support',
  'Weekly Highlights', 'Activity Feed', 'Add Weekly Activity',
];

type KPIItem = { label: string; value: string; note: string; priority: number };

// Returns the ISO 8601 week tag for a YYYY-MM-DD date string, e.g. "W23".
// Used as metadata on SupportLog entries (not used for filtering — see filterLogsByPeriod).
function getWeekTag(dateStr: string): string {
  const d = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
  // Find the Thursday of the ISO week (ISO weeks start on Monday; week 1 contains the first Thursday)
  const thursday = new Date(d);
  thursday.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(thursday.getFullYear(), 0, 1);
  const weekNum   = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `W${String(weekNum).padStart(2, '0')}`;
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

const FILTER_YEARS = (() => {
  const y = new Date().getFullYear();
  return [y - 1, y, y + 1].filter(x => x >= 2024);
})();

function HistoricalTimeFilter({ value, onChange }: { value: TimeFilter; onChange: (tf: TimeFilter) => void }) {
  const set = (patch: Partial<TimeFilter>) => onChange({ ...value, ...patch });
  return (
    <div className="hist-filter">
      <div className="time-filter">
        {(['week', 'month', 'quarter'] as PeriodType[]).map(pt => (
          <button key={pt} className={value.periodType === pt ? 'active' : ''} onClick={() => set({ periodType: pt })}>
            {pt.charAt(0).toUpperCase() + pt.slice(1)}
          </button>
        ))}
      </div>

      <select className="hist-select" value={value.selectedYear} onChange={e => set({ selectedYear: +e.target.value })}>
        {FILTER_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
      </select>

      {value.periodType === 'week' && (
        <select className="hist-select" value={value.selectedWeek} onChange={e => set({ selectedWeek: +e.target.value })}>
          {Array.from({ length: 53 }, (_, i) => i + 1).map(w => (
            <option key={w} value={w}>W{String(w).padStart(2, '0')}</option>
          ))}
        </select>
      )}

      {value.periodType === 'month' && (
        <select className="hist-select" value={value.selectedMonth} onChange={e => set({ selectedMonth: +e.target.value })}>
          {MONTH_NAMES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
        </select>
      )}

      {value.periodType === 'quarter' && (
        <div className="time-filter">
          {[1, 2, 3, 4].map(q => (
            <button key={q} className={value.selectedQuarter === q ? 'active' : ''} onClick={() => set({ selectedQuarter: q })}>
              Q{q}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Shell({ page, setPage, timeFilter, onTimeFilterChange, authEmail, onSignOut, children }: {
  page: string; setPage: (p: string) => void;
  timeFilter: TimeFilter; onTimeFilterChange: (tf: TimeFilter) => void;
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
            <HistoricalTimeFilter value={timeFilter} onChange={onTimeFilterChange} />
            <span className="badge">{getTimeFilterLabel(timeFilter)}</span>
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

function KPIDetailPanel({ kpi, timeFilter, onClose }: { kpi: DashboardKpi; timeFilter: TimeFilter; onClose: () => void }) {
  const period      = timeFilterToPeriod(timeFilter);
  const lookupKey   = kpi.kpiRecordKey ?? kpi.label;
  const records: KPIRecord[] = kpiRecords[lookupKey]?.[period] ?? [];
  const periodLabel = getTimeFilterLabel(timeFilter);
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
            <div className="small" style={{ marginTop: 4 }}>{records.length} record{records.length !== 1 ? 's' : ''} · {periodLabel}</div>
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

function TeamMemberPanel({ memberName, timeFilter, supportLogs, onClose }: {
  memberName: string; timeFilter: TimeFilter; supportLogs: SupportLog[]; onClose: () => void;
}) {
  const logs = filterLogsByTimeFilter(supportLogs, timeFilter).filter(l => l.employeeName === memberName);
  const hours = logs.reduce((s, l) => s + l.hours, 0);
  const depts = [...new Set(logs.map(l => l.department))];
  const byDept = buildSupportByDept(logs);
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
              {hours}h · {logs.length} activities · {depts.length} dept{depts.length !== 1 ? 's' : ''} · {getTimeFilterLabel(timeFilter)}
            </div>
          </div>
          <button className="panel-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="panel-body">
          {logs.length === 0 ? (
            <div className="panel-empty">
              <div className="panel-empty-icon">📊</div>
              <div>No contributions logged for this period</div>
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

function EmployeePanel({ member, timeFilter, supportLogs, onClose }: {
  member: TeamMember; timeFilter: TimeFilter; supportLogs: SupportLog[]; onClose: () => void;
}) {
  // Match by name for compatibility with both slug-id and email-id records
  const logs = filterLogsByTimeFilter(supportLogs, timeFilter).filter(l => l.employeeName === member.name);
  const hours = logs.reduce((s, l) => s + l.hours, 0);
  const depts = [...new Set(logs.map(l => l.department))];
  const byDept = buildSupportByDept(logs);

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
              {hours}h · {logs.length} activities · {depts.length} dept{depts.length !== 1 ? 's' : ''} · {getTimeFilterLabel(timeFilter)}
            </div>
          </div>
          <button className="panel-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="panel-body">
          {logs.length === 0 ? (
            <div className="panel-empty">
              <div className="panel-empty-icon">📊</div>
              <div>No contributions logged for this period</div>
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

function TeamContributions({ timeFilter, supportLogs, activeTeamMembers }: { timeFilter: TimeFilter; supportLogs: SupportLog[]; activeTeamMembers: TeamMember[] }) {
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const filtered = filterLogsByTimeFilter(supportLogs, timeFilter);

  const memberStats = activeTeamMembers.map(m => {
    // Match by name — works for both slug-id (legacy) and email-id (Supabase) records
    const logs = filtered.filter(l => l.employeeName === m.name);
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
        <EmployeePanel member={selectedMember} timeFilter={timeFilter} supportLogs={supportLogs} onClose={() => setSelectedMember(null)} />
      )}

      <div className="page-header">
        <h2>Team Contributions</h2>
        <div className="small">Operations team impact · {getTimeFilterLabel(timeFilter)}</div>
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

function Executive({ timeFilter, supportLogs, activeTeamMembers }: { timeFilter: TimeFilter; supportLogs: SupportLog[]; activeTeamMembers: TeamMember[] }) {
  const [selectedKpi,          setSelectedKpi]          = useState<DashboardKpi | null>(null);
  const [selectedMember,       setSelectedMember]       = useState<string | null>(null);
  const [selectedProcCategory, setSelectedProcCategory] = useState<ProcurementCategory | null>(null);
  const [procRecords,          setProcRecords]          = useState<ProcurementRecord[]>([]);

  // Maps the three Procurement Activity KPI labels to ProcurementCategory values.
  // Any label in this map routes to ProcurementDrillDown (live data) instead of KPIDetailPanel (mock).
  const PROC_DRILL_MAP: Partial<Record<string, ProcurementCategory>> = {
    'PO Created':         'PO Created',
    'Emergency Requests': 'Emergency Request',
    'Supplier Payments':  'Supplier Payment',
  };

  const openKpi = (kpi: DashboardKpi) => {
    setSelectedMember(null);
    const procCat = PROC_DRILL_MAP[kpi.label];
    if (procCat) {
      // Procurement card → live ProcurementDrillDown, not mock KPIDetailPanel
      setSelectedKpi(null);
      setSelectedProcCategory(procCat);
    } else {
      setSelectedProcCategory(null);
      setSelectedKpi(kpi);
    }
  };
  const openMember = (name: string) => { setSelectedKpi(null); setSelectedProcCategory(null); setSelectedMember(name); };

  // Fetch procurement records for the selected period — drives the Procurement Activity section
  useEffect(() => {
    const { start, end } = getDateRangeForFilter(timeFilter);
    end.setHours(23, 59, 59, 999);
    if (DEMO_MODE) {
      // Filter mock records client-side so demo mode respects the time filter too
      setProcRecords(
        mockProcurementRecords.filter(r => {
          if (!r.date) return false;
          const d = new Date(r.date + 'T00:00:00');
          return d >= start && d <= end;
        })
      );
    } else {
      fetchProcurementFromDB(timeFilter).then(setProcRecords);
    }
  }, [timeFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Derive live Procurement Activity KPI values from procurement_records
  const procPO    = procRecords.filter(r => r.category === 'PO Created');
  const procPay   = procRecords.filter(r => r.category === 'Supplier Payment');
  const procEmerg = procRecords.filter(r => r.category === 'Emergency Request');
  const procPoTotal  = procPO.reduce((s, r)  => s + r.amountUsd, 0);
  const procPayTotal = procPay.reduce((s, r) => s + r.amountUsd, 0);
  const procKpiOverrides: Record<string, { value: string; note: string }> = {
    'PO Created':         { value: String(procPO.length),    note: procPoTotal  > 0 ? `Total $${procPoTotal.toLocaleString()}`  : 'No POs this period'      },
    'Emergency Requests': { value: String(procEmerg.length), note: 'Short-notice requests across departments'                                               },
    'Supplier Payments':  { value: String(procPay.length),   note: procPayTotal > 0 ? `Total $${procPayTotal.toLocaleString()}` : 'No payments this period' },
  };

  // Derive live support metrics from SupportLog
  const filtered       = filterLogsByTimeFilter(supportLogs, timeFilter);
  const derivedHours   = filtered.reduce((s, l) => s + l.hours, 0);
  const derivedSupport = buildSupportByDept(filtered);

  return (
    <>
      {selectedKpi          && <KPIDetailPanel kpi={selectedKpi} timeFilter={timeFilter} onClose={() => setSelectedKpi(null)} />}
      {selectedProcCategory && <ProcurementDrillDown category={selectedProcCategory} records={procRecords} onClose={() => setSelectedProcCategory(null)} />}
      {selectedMember       && <TeamMemberPanel memberName={selectedMember} timeFilter={timeFilter} supportLogs={supportLogs} onClose={() => setSelectedMember(null)} />}

      {/* ── Three operational sections ───────────────────────────────── */}
      {dashboardSections.map(section => (
        <div key={section.title} style={{ marginBottom: 4 }}>
          <div className="dash-section-header">{section.title}</div>
          <div className="grid three">
            {section.kpis.map(kpi => {
              const clickable = Boolean(kpi.kpiRecordKey);
              // Apply live procurement data override for Procurement Activity section
              const override     = procKpiOverrides[kpi.label];
              const displayValue = override ? override.value : kpi.value;
              const displayNote  = override ? override.note  : kpi.note;
              return (
                <div
                  key={kpi.label}
                  className={`card${clickable ? ' kpi-clickable' : ''}`}
                  onClick={clickable ? () => openKpi(kpi) : undefined}
                  role={clickable ? 'button' : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  onKeyDown={clickable ? e => e.key === 'Enter' && openKpi(kpi) : undefined}
                >
                  <div className="kpi-label">{kpi.label}</div>
                  <div className="kpi-value">{displayValue}</div>
                  <div className="small">{displayNote}</div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* ── Live support data ────────────────────────────────────────── */}
      <div className="grid two" style={{ marginTop: 8 }}>
        <div className="card">
          <h2 className="section-title">Team Last Updates</h2>
          <div className="team-pulse-list">
            {activeTeamMembers.map(m => {
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
          {derivedSupport.length === 0 ? (
            <div className="panel-empty" style={{ padding: '32px 0' }}>
              <div className="panel-empty-icon">📊</div>
              <div>No support hours logged for this period</div>
            </div>
          ) : (
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
          )}
        </div>
      </div>
    </>
  );
}

// ─── Procurement Drill-Down Panel ─────────────────────────────────────────

function ProcurementDrillDown({ category, records, onClose }: {
  category: ProcurementCategory;
  records: ProcurementRecord[];
  onClose: () => void;
}) {
  const filtered  = records.filter(r => r.category === category);
  const totalUsd  = filtered.reduce((s, r) => s + r.amountUsd, 0);

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
            <h3>{category}</h3>
            <div className="small" style={{ marginTop: 4 }}>
              {filtered.length} record{filtered.length !== 1 ? 's' : ''}
              {totalUsd > 0 && ` · $${totalUsd.toLocaleString()}`}
            </div>
          </div>
          <button className="panel-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="panel-body">
          {filtered.length === 0 ? (
            <div className="panel-empty"><div className="panel-empty-icon">📋</div><div>No records for this period</div></div>
          ) : (
            <table className="record-table">
              <thead>
                <tr><th>PO Number</th><th>Supplier</th><th>Amount</th><th>Owner</th><th>Date</th><th>Status</th></tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id}>
                    <td><span className="rec-id">{r.poNumber || '—'}</span></td>
                    <td>
                      <div className="rec-name">{r.supplier}</div>
                      {r.notes && <div className="rec-notes">{r.notes}</div>}
                    </td>
                    <td style={{ fontWeight: 700, color: r.amountUsd > 0 ? 'var(--color-completed)' : 'var(--color-muted)', whiteSpace: 'nowrap' }}>
                      {r.amountUsd > 0 ? `$${r.amountUsd.toLocaleString()}` : '—'}
                    </td>
                    <td>{r.employeeName}</td>
                    <td><span className="small">{r.date}</span></td>
                    <td>
                      <span className={`status-badge ${r.status === 'Completed' ? 'status-completed' : r.status === 'In Progress' ? 'status-in-progress' : 'status-blocked'}`}>
                        {r.status}
                      </span>
                    </td>
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

// ─── Procurement Entry Form ────────────────────────────────────────────────

function ProcurementEntryForm({ onSave, onCancel, activeTeamMembers }: {
  onSave: (r: ProcurementRecord) => void;
  onCancel: () => void;
  activeTeamMembers: TeamMember[];
}) {
  const [employeeId, setEmployeeId] = useState('');
  const [category,   setCategory]   = useState<ProcurementCategory>(PROCUREMENT_CATEGORIES[0]);
  const [poNumber,   setPoNumber]   = useState('');
  const [supplier,   setSupplier]   = useState('');
  const [amountUsd,  setAmountUsd]  = useState('');
  const [status,     setStatus]     = useState<ProcurementRecord['status']>(PROCUREMENT_STATUSES[0]);
  const [notes,      setNotes]      = useState('');
  const [date,       setDate]       = useState(new Date().toISOString().slice(0, 10));

  const save = () => {
    if (!employeeId)              { alert('Please select an employee.'); return; }
    if (!supplier.trim())         { alert('Supplier is required.'); return; }
    if (category === 'PO Created' && !poNumber.trim()) { alert('PO Number is required for PO Created.'); return; }
    if (amountUsd && isNaN(parseFloat(amountUsd)))     { alert('Amount USD must be a valid number.'); return; }
    const member = activeTeamMembers.find(m => m.id === employeeId);
    if (!member) return;
    onSave({
      id:           `PR-${Date.now()}`,
      employeeId,
      employeeName: member.name,
      poNumber:     poNumber.trim(),
      supplier:     supplier.trim(),
      amountUsd:    amountUsd ? parseFloat(amountUsd) : 0,
      category,
      status,
      notes:        notes.trim(),
      date,
    });
  };

  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <h2 className="section-title">Log Procurement Activity</h2>
      <div className="grid two">
        <div>
          <div className="kpi-label">Employee *</div>
          <select className="input" value={employeeId} onChange={e => setEmployeeId(e.target.value)}>
            <option value="">— Select employee —</option>
            {activeTeamMembers.map(m => <option key={m.id} value={m.id}>{m.name} · {m.role}</option>)}
          </select>
        </div>
        <div>
          <div className="kpi-label">Category *</div>
          <select className="input" value={category} onChange={e => setCategory(e.target.value as ProcurementCategory)}>
            {PROCUREMENT_CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        {category === 'PO Created' && (
          <div>
            <div className="kpi-label">PO Number *</div>
            <input className="input" value={poNumber} onChange={e => setPoNumber(e.target.value)} placeholder="e.g. PO-4571" />
          </div>
        )}
        <div>
          <div className="kpi-label">Supplier *</div>
          <input className="input" value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="e.g. Elektra Components GmbH" />
        </div>
        <div>
          <div className="kpi-label">Amount USD</div>
          <input className="input" type="number" min="0" step="0.01" value={amountUsd} onChange={e => setAmountUsd(e.target.value)} placeholder="e.g. 12400" />
        </div>
        <div>
          <div className="kpi-label">Status</div>
          <select className="input" value={status} onChange={e => setStatus(e.target.value as ProcurementRecord['status'])}>
            {PROCUREMENT_STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
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
      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        <button className="save-button" style={{ marginTop: 0 }} onClick={save}>Save</button>
        <button onClick={onCancel} style={{ background: 'rgba(255,255,255,.07)', border: '1px solid var(--color-border)', color: '#e8eef7', borderRadius: 12, padding: '11px 20px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>Cancel</button>
      </div>
    </div>
  );
}

// ─── Procurement Page (live data) ──────────────────────────────────────────

function ProcurementPage({ timeFilter, activeTeamMembers }: {
  timeFilter: TimeFilter;
  activeTeamMembers: TeamMember[];
}) {
  const [records,  setRecords]  = useState<ProcurementRecord[]>(DEMO_MODE ? mockProcurementRecords : []);
  const [loading,  setLoading]  = useState(!DEMO_MODE);
  const [selected, setSelected] = useState<ProcurementCategory | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saveErr,  setSaveErr]  = useState('');

  useEffect(() => {
    if (DEMO_MODE) return;
    setLoading(true);
    fetchProcurementFromDB(timeFilter).then(data => { setRecords(data); setLoading(false); });
  }, [timeFilter]);

  // Derived KPIs
  const poCat   = records.filter(r => r.category === 'PO Created');
  const payCat  = records.filter(r => r.category === 'Supplier Payment');
  const emergCat = records.filter(r => r.category === 'Emergency Request');
  const poTotal  = poCat.reduce((s, r)  => s + r.amountUsd, 0);
  const payTotal = payCat.reduce((s, r) => s + r.amountUsd, 0);

  const handleSave = async (record: ProcurementRecord) => {
    setSaveErr('');
    try {
      if (!DEMO_MODE) await insertProcurementToDB(record);
      setRecords(prev => [record, ...prev]);
      setShowForm(false);
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : 'Failed to save record.');
    }
  };

  return (
    <>
      {selected && <ProcurementDrillDown category={selected} records={records} onClose={() => setSelected(null)} />}

      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h2>Procurement Activity</h2>
            <div className="small">Purchase orders, payments and emergency requests · {getTimeFilterLabel(timeFilter)}</div>
          </div>
          {!showForm && (
            <button className="save-button" style={{ marginTop: 0, flexShrink: 0 }} onClick={() => setShowForm(true)}>
              + Log Procurement
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <ProcurementEntryForm
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setSaveErr(''); }}
          activeTeamMembers={activeTeamMembers}
        />
      )}

      {saveErr && (
        <div style={{ fontSize: 13, color: 'var(--color-critical)', padding: '10px 14px', background: 'rgba(239,68,68,.08)', borderRadius: 10, marginBottom: 14 }}>
          {saveErr}
        </div>
      )}

      {loading ? (
        <div className="card"><div className="panel-empty"><div className="panel-empty-icon">⏳</div><div>Loading procurement records…</div></div></div>
      ) : (
        <div className="grid three">
          <div className="card kpi-clickable" role="button" tabIndex={0}
            onClick={() => setSelected('PO Created')} onKeyDown={e => e.key === 'Enter' && setSelected('PO Created')}>
            <div className="kpi-label">PO Created</div>
            <div className="kpi-value">{poCat.length}</div>
            <div className="small">{poTotal > 0 ? `Total $${poTotal.toLocaleString()}` : 'No payments this period'}</div>
          </div>
          <div className="card kpi-clickable" role="button" tabIndex={0}
            onClick={() => setSelected('Emergency Request')} onKeyDown={e => e.key === 'Enter' && setSelected('Emergency Request')}>
            <div className="kpi-label">Emergency Requests</div>
            <div className="kpi-value">{emergCat.length}</div>
            <div className="small">Short-notice requests</div>
          </div>
          <div className="card kpi-clickable" role="button" tabIndex={0}
            onClick={() => setSelected('Supplier Payment')} onKeyDown={e => e.key === 'Enter' && setSelected('Supplier Payment')}>
            <div className="kpi-label">Supplier Payments</div>
            <div className="kpi-value">{payCat.length}</div>
            <div className="small">{payTotal > 0 ? `Total $${payTotal.toLocaleString()}` : 'No payments this period'}</div>
          </div>
        </div>
      )}

      {!loading && records.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h2 className="section-title">All Records</h2>
          <table className="table">
            <thead>
              <tr><th>Category</th><th>PO Number</th><th>Supplier</th><th>Amount</th><th>Owner</th><th>Date</th><th>Status</th></tr>
            </thead>
            <tbody>
              {records.map(r => (
                <tr key={r.id}>
                  <td><span className="pill" style={{ fontSize: 11 }}>{r.category}</span></td>
                  <td><span className="rec-id">{r.poNumber || '—'}</span></td>
                  <td><b>{r.supplier}</b>{r.notes && <div className="small">{r.notes}</div>}</td>
                  <td style={{ fontWeight: 700, color: r.amountUsd > 0 ? 'var(--color-completed)' : 'var(--color-muted)', whiteSpace: 'nowrap' }}>
                    {r.amountUsd > 0 ? `$${r.amountUsd.toLocaleString()}` : '—'}
                  </td>
                  <td>{r.employeeName}</td>
                  <td>{r.date}</td>
                  <td>
                    <span className={`status-badge ${r.status === 'Completed' ? 'status-completed' : r.status === 'In Progress' ? 'status-in-progress' : 'status-blocked'}`}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && records.length === 0 && (
        <div className="card" style={{ marginTop: 8 }}>
          <div className="panel-empty">
            <div className="panel-empty-icon">📋</div>
            <div>No procurement records for this period. Use <b>+ Log Procurement</b> to add one.</div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Metric pages (Logistics / Deployments) ────────────────────────────────

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

function Support({ timeFilter, supportLogs }: { timeFilter: TimeFilter; supportLogs: SupportLog[] }) {
  const filtered = filterLogsByTimeFilter(supportLogs, timeFilter);
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
        <div className="small">Operations support hours by department · {getTimeFilterLabel(timeFilter)}</div>
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

function Highlights({ timeFilter }: { timeFilter: TimeFilter }) {
  const data = timeRangeData[timeFilterToPeriod(timeFilter)];
  return (
    <>
      <div className="page-header">
        <h2>Operational Highlights</h2>
        <div className="small">Key achievements and delivery milestones · {getTimeFilterLabel(timeFilter)}</div>
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

function ActivityFeed({ timeFilter, supportLogs }: { timeFilter: TimeFilter; supportLogs: SupportLog[] }) {
  const logs = filterLogsByTimeFilter(supportLogs, timeFilter);
  return (
    <>
      <div className="page-header">
        <h2>Operations Activity Feed</h2>
        <div className="small">Live contribution log · {getTimeFilterLabel(timeFilter)}</div>
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

function AddWeeklyActivity({ addLog, activeTeamMembers }: { addLog: (log: SupportLog) => void; activeTeamMembers: TeamMember[] }) {
  const [employeeId,  setEmployeeId]  = useState('');
  const [department,  setDepartment]  = useState('R&D');
  const [category,    setCategory]    = useState<string>(ACTIVITY_CATEGORIES[0]);
  const [title,       setTitle]       = useState('');
  const [hours,       setHours]       = useState('');
  const [date,        setDate]        = useState(new Date().toISOString().slice(0, 10));
  const [notes,       setNotes]       = useState('');
  const [recent,      setRecent]      = useState<SupportLog[]>([]);

  const save = () => {
    const member = activeTeamMembers.find(m => m.id === employeeId);
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
              {activeTeamMembers.length === 0
                ? <option disabled>Loading team…</option>
                : activeTeamMembers.map(m => <option key={m.id} value={m.id}>{m.name} · {m.role}</option>)
              }
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
  const [page, setPage]           = useState('Executive Dashboard');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>(currentTimeFilter);

  // ── Demo Mode state ──────────────────────────────────────────────────────
  const [userLogs, setUserLogs] = useState<SupportLog[]>([]);

  // ── Production Mode state ────────────────────────────────────────────────
  const [dbLogs,         setDbLogs]         = useState<SupportLog[]>([]);
  const [dbTeamMembers,  setDbTeamMembers]   = useState<TeamMember[]>([]);
  const [authUser,       setAuthUser]        = useState<{ id: string; email: string } | null>(null);
  const [dbLoading,      setDbLoading]       = useState(!DEMO_MODE);

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
          // Fetch logs and team members in parallel
          const [logs, members] = await Promise.all([
            fetchLogsFromDB(),
            fetchTeamMembersFromDB(),
          ]);
          setDbLogs(logs);
          if (members.length > 0) setDbTeamMembers(members);
        }
        setDbLoading(false);
      });
    }
  }, []);

  // ── Real-time: push inserts from other users into local state ────────────
  // Requires "Realtime" enabled on the support_logs table in Supabase dashboard.
  useEffect(() => {
    if (DEMO_MODE) return;
    const supabase = createClient();
    const channel = supabase
      .channel('opspulse:logs')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'support_logs' },
        (payload) => {
          const newLog = rowToLog(payload.new as Record<string, unknown>);
          setDbLogs(prev => (prev.some(l => l.id === newLog.id) ? prev : [newLog, ...prev]));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived log array ─────────────────────────────────────────────────────
  // Demo  → localStorage submissions + seed data
  // Prod  → only real DB records (seed data hidden)
  const supportLogs: SupportLog[] = DEMO_MODE
    ? [...userLogs, ...seedSupportLogs]
    : dbLogs;

  // ── Active team members ───────────────────────────────────────────────────
  // Demo  → hardcoded mock roster
  // Prod  → live Supabase team_members, with mock as fallback if fetch failed
  const activeTeamMembers: TeamMember[] = DEMO_MODE
    ? teamMembers
    : (dbTeamMembers.length > 0 ? dbTeamMembers : teamMembers);

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

  // Sub-pages still use mock timeRangeData keyed by legacy Period
  const period = timeFilterToPeriod(timeFilter);
  const data   = timeRangeData[period];

  let content = <Executive timeFilter={timeFilter} supportLogs={supportLogs} activeTeamMembers={activeTeamMembers} />;
  if (page === 'Team Contributions')           content = <TeamContributions timeFilter={timeFilter} supportLogs={supportLogs} activeTeamMembers={activeTeamMembers} />;
  if (page === 'Logistics')                    content = <MetricPage title="Logistics" intro="Shipment readiness, customs visibility, BAZ status and spare part movement." rows={data.logistics} />;
  if (page === 'Procurement')                  content = <ProcurementPage timeFilter={timeFilter} activeTeamMembers={activeTeamMembers} />;
  if (page === 'Cross Functional Support')     content = <Support timeFilter={timeFilter} supportLogs={supportLogs} />;
  if (page === 'Weekly Highlights')            content = <Highlights timeFilter={timeFilter} />;
  if (page === 'Activity Feed')                content = <ActivityFeed timeFilter={timeFilter} supportLogs={supportLogs} />;
  if (page === 'Add Weekly Activity')          content = <AddWeeklyActivity addLog={addLog} activeTeamMembers={activeTeamMembers} />;

  return (
    <Shell
      page={page} setPage={setPage}
      timeFilter={timeFilter} onTimeFilterChange={setTimeFilter}
      authEmail={authUser?.email}
      onSignOut={signOut}
    >
      {content}
    </Shell>
  );
}
