import { useState, useMemo } from 'react';
import {
  Clock, Ambulance, Download, MapPinLine, Warning,
  CalendarBlank, Timer, ArrowRight,
} from '@phosphor-icons/react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { useNotificationStore } from '../../stores/notificationStore';
import { useQuery } from '@tanstack/react-query';
import api from '../../api/client';

interface AnalyticsData {
  total: number;
  byGender: { gender: string; count: number }[];
  bySubCounty: { subCounty: string; count: number }[];
  byReferral: { facility: string; count: number }[];
  byStatus: { status: string; count: number }[];
  tat: {
    avgDispatchMinutes: number | null;
    avgSceneMinutes: number | null;
    avgHospitalMinutes: number | null;
  };
  trend: { date: string; count: number }[];
}

type Preset = '7d' | '30d' | '90d' | 'custom';

const GENDER_COLORS: Record<string, string> = {
  Male: '#006973',
  Female: '#88c241',
  Unknown: '#94a3b8',
};

const STATUS_COLORS: Record<string, string> = {
  RESOLVED: '#88c241',
  DISPATCHED: '#006973',
  DISPATCH_HANDLING: '#3b82f6',
  SUBMITTED: '#f59e0b',
  DRAFT: '#94a3b8',
  DISPATCH_ON_HOLD: '#6b7280',
};

function getDateRange(preset: Preset, customFrom: string, customTo: string): { from: string; to: string } {
  const now = new Date();
  if (preset === '7d') {
    return {
      from: new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0],
      to: now.toISOString().split('T')[0],
    };
  }
  if (preset === '30d') {
    return {
      from: new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0],
      to: now.toISOString().split('T')[0],
    };
  }
  if (preset === '90d') {
    return {
      from: new Date(now.getTime() - 90 * 86400000).toISOString().split('T')[0],
      to: now.toISOString().split('T')[0],
    };
  }
  return { from: customFrom, to: customTo };
}

const TOOLTIP_STYLE = {
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  background: '#fff',
  color: '#000',
};

export default function AnalyticsPage() {
  const { addNotification } = useNotificationStore();
  const [preset, setPreset] = useState<Preset>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const { from, to } = useMemo(
    () => getDateRange(preset, customFrom, customTo),
    [preset, customFrom, customTo]
  );

  const { data, isLoading } = useQuery<AnalyticsData>({
    queryKey: ['analytics', from, to],
    queryFn: async () => {
      const res = await api.get(`/analytics?from=${from}&to=${to}`);
      return res.data.data as AnalyticsData;
    },
    enabled: !!from && !!to,
  });

  function exportReport() {
    if (!data || data.total === 0) {
      addNotification({ type: 'info', title: 'No Data', message: 'No data to export for this period.' });
      return;
    }
    const rows = [
      ['Metric', 'Value'],
      ['Total Incidents', data.total],
      ['Avg Dispatch Time (min)', data.tat.avgDispatchMinutes ?? '—'],
      ['Avg Scene Arrival (min)', data.tat.avgSceneMinutes ?? '—'],
      ['Avg Hospital Arrival (min)', data.tat.avgHospitalMinutes ?? '—'],
      [],
      ['Sub-County', 'Incidents'],
      ...data.bySubCounty.map(r => [r.subCounty, r.count]),
      [],
      ['Gender', 'Count'],
      ...data.byGender.map(r => [r.gender, r.count]),
      [],
      ['Status', 'Count'],
      ...data.byStatus.map(r => [r.status, r.count]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `EOC_Analytics_${from}_to_${to}.csv`;
    a.click();
    addNotification({ type: 'success', title: 'Exported', message: 'Analytics report downloaded.' });
  }

  const resolvedCount = data?.byStatus.find(s => s.status === 'RESOLVED')?.count ?? 0;
  const submittedCount = data?.byStatus.find(s => s.status === 'SUBMITTED')?.count ?? 0;
  const hotZone = data?.bySubCounty[0]?.subCounty ?? '—';

  return (
    <div className="p-4 sm:p-6 lg:p-8 flex flex-col gap-6 max-w-[1600px] mx-auto w-full">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white p-5 rounded-xl border border-surface-border shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-brand-teal">Analytics Dashboard</h2>
          <p className="text-xs text-slate-text mt-0.5">Operational performance and incident data</p>
        </div>
        <button
          onClick={exportReport}
          className="w-full sm:w-auto bg-white border border-surface-border text-brand-teal hover:bg-slate-50 px-5 py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all"
        >
          <Download size={18} weight="bold" />
          Export Report
        </button>
      </div>

      {/* Date Range Picker */}
      <div className="bg-white border border-surface-border rounded-xl p-4 flex flex-wrap items-center gap-3">
        <CalendarBlank size={18} className="text-slate-400 shrink-0" />
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Date Range</span>
        {(['7d', '30d', '90d'] as Preset[]).map(p => (
          <button
            key={p}
            onClick={() => setPreset(p)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              preset === p
                ? 'bg-brand-teal text-white shadow-sm'
                : 'border border-surface-border text-slate-500 hover:border-brand-teal hover:text-brand-teal'
            }`}
          >
            {p === '7d' ? 'Last 7 days' : p === '30d' ? 'Last 30 days' : 'Last 90 days'}
          </button>
        ))}
        <button
          onClick={() => setPreset('custom')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            preset === 'custom'
              ? 'bg-brand-teal text-white shadow-sm'
              : 'border border-surface-border text-slate-500 hover:border-brand-teal hover:text-brand-teal'
          }`}
        >
          Custom
        </button>
        {preset === 'custom' && (
          <div className="flex items-center gap-2 ml-2">
            <input
              type="date"
              value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
              className="border border-surface-border rounded-lg px-3 py-2 text-xs text-brand-teal outline-none focus:ring-2 focus:ring-brand-teal"
            />
            <ArrowRight size={14} className="text-slate-400" />
            <input
              type="date"
              value={customTo}
              onChange={e => setCustomTo(e.target.value)}
              className="border border-surface-border rounded-lg px-3 py-2 text-xs text-brand-teal outline-none focus:ring-2 focus:ring-brand-teal"
            />
          </div>
        )}
        {isLoading && (
          <div className="ml-auto flex items-center gap-2 text-xs text-slate-400">
            <div className="w-4 h-4 border-2 border-brand-teal/20 border-t-brand-teal rounded-full animate-spin" />
            Loading...
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-surface-border shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-medium text-slate-text">Total Incidents</p>
            <Clock size={16} weight="fill" className="text-brand-green" />
          </div>
          <p className="text-3xl font-bold text-brand-teal leading-none">{data?.total ?? '—'}</p>
          <p className="text-xs font-medium text-brand-green mt-2">{resolvedCount} resolved</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-surface-border shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-medium text-slate-text">Awaiting Dispatch</p>
            <Warning size={16} weight="fill" className="text-status-danger" />
          </div>
          <p className="text-3xl font-bold text-brand-teal leading-none">{submittedCount}</p>
          <p className={`text-xs font-medium mt-2 ${submittedCount > 0 ? 'text-status-danger' : 'text-slate-text'}`}>
            {submittedCount > 0 ? 'Needs attention' : 'Queue clear'}
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-surface-border shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-medium text-slate-text">Avg Dispatch TAT</p>
            <Timer size={16} weight="fill" className="text-status-info" />
          </div>
          <p className="text-3xl font-bold text-brand-teal leading-none">
            {data?.tat.avgDispatchMinutes != null ? `${data.tat.avgDispatchMinutes}m` : '—'}
          </p>
          <p className="text-xs text-slate-text mt-2">from received to accepted</p>
        </div>

        <div className="bg-brand-sidebar p-5 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-medium text-slate-400">Incident Hotzone</p>
            <MapPinLine size={16} weight="fill" className="text-brand-green" />
          </div>
          <p className="text-3xl font-bold text-white leading-none truncate">{hotZone}</p>
          <p className="text-xs text-brand-green mt-2">{data?.bySubCounty[0]?.count ?? 0} cases logged</p>
        </div>
      </div>

      {/* TAT Breakdown */}
      <div className="bg-white border border-surface-border rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-brand-teal mb-4 flex items-center gap-2">
          <Timer size={16} weight="fill" /> Turnaround Time Breakdown
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Dispatch → Accepted', value: data?.tat.avgDispatchMinutes, desc: 'Time until crew accepts task', color: 'text-brand-green' },
            { label: 'Accepted → Scene Arrival', value: data?.tat.avgSceneMinutes, desc: 'Travel time to incident scene', color: 'text-status-info' },
            { label: 'Scene → Hospital', value: data?.tat.avgHospitalMinutes, desc: 'Patient transport time', color: 'text-status-warning' },
          ].map(item => (
            <div key={item.label} className="bg-slate-50 rounded-xl p-4 border border-surface-border">
              <p className="text-xs font-medium text-slate-400 mb-2">{item.label}</p>
              <p className={`text-4xl font-bold ${item.color} leading-none`}>
                {item.value != null ? `${item.value}` : '—'}
                {item.value != null && <span className="text-xl font-semibold ml-1">min</span>}
              </p>
              <p className="text-xs text-slate-400 mt-2">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Charts Grid — Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Incident Trend */}
        <div className="bg-white p-6 rounded-xl border border-surface-border shadow-sm flex flex-col h-[360px]">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-brand-teal">Incident Trend</h3>
            <p className="text-xs text-slate-400 mt-0.5">Daily cases in selected period</p>
          </div>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.trend ?? []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#88c241" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#88c241" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} dx={-10} allowDecimals={false} />
                <RechartsTooltip contentStyle={TOOLTIP_STYLE} itemStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="count" stroke="#88c241" strokeWidth={2.5} fill="url(#trendGrad)" name="Incidents" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sub-County Breakdown */}
        <div className="bg-white p-6 rounded-xl border border-surface-border shadow-sm flex flex-col h-[360px]">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-brand-teal">Incidents by Sub-County</h3>
            <p className="text-xs text-slate-400 mt-0.5">Top 8 areas by case volume</p>
          </div>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.bySubCounty ?? []} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 4" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} allowDecimals={false} />
                <YAxis type="category" dataKey="subCounty" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} width={100} />
                <RechartsTooltip contentStyle={TOOLTIP_STYLE} itemStyle={{ fontSize: 12 }} />
                <Bar dataKey="count" name="Cases" fill="#88c241" radius={[0, 4, 4, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts Grid — Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Gender Distribution */}
        <div className="bg-white p-6 rounded-xl border border-surface-border shadow-sm flex flex-col h-[320px]">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-brand-teal">Gender Distribution</h3>
            <p className="text-xs text-slate-400 mt-0.5">Patient demographics</p>
          </div>
          <div className="flex-1 w-full">
            {(data?.byGender.length ?? 0) > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data?.byGender}
                    dataKey="count"
                    nameKey="gender"
                    cx="50%"
                    cy="45%"
                    innerRadius="45%"
                    outerRadius="70%"
                    paddingAngle={3}
                  >
                    {data?.byGender.map(entry => (
                      <Cell key={entry.gender} fill={GENDER_COLORS[entry.gender] ?? '#cbd5e1'} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={TOOLTIP_STYLE} itemStyle={{ fontSize: 12 }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-300 text-sm">No data</div>
            )}
          </div>
        </div>

        {/* Case Outcomes */}
        <div className="bg-white p-6 rounded-xl border border-surface-border shadow-sm flex flex-col h-[320px]">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-brand-teal">Case Outcomes</h3>
            <p className="text-xs text-slate-400 mt-0.5">Status breakdown</p>
          </div>
          <div className="flex-1 w-full">
            {(data?.byStatus.length ?? 0) > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data?.byStatus}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="45%"
                    innerRadius="45%"
                    outerRadius="70%"
                    paddingAngle={3}
                  >
                    {data?.byStatus.map(entry => (
                      <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? '#cbd5e1'} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={TOOLTIP_STYLE}
                    itemStyle={{ fontSize: 12 }}
                    formatter={(value, name) => [value, String(name).replace(/_/g, ' ')]}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 10, paddingTop: 8 }}
                    formatter={value => String(value).replace(/_/g, ' ')}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-300 text-sm">No data</div>
            )}
          </div>
        </div>

        {/* Ambulance Utilization — fleet stats */}
        <div className="bg-white p-6 rounded-xl border border-surface-border shadow-sm flex flex-col h-[320px]">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-brand-teal">Ambulance Utilization</h3>
            <p className="text-xs text-slate-400 mt-0.5">Tasks per status in period</p>
          </div>
          <div className="flex flex-col gap-3 mt-2">
            {[
              { label: 'Total Tasks', value: data?.byStatus.reduce((a, s) => a + s.count, 0) ?? 0, color: 'bg-brand-teal' },
              { label: 'Resolved', value: resolvedCount, color: 'bg-brand-green' },
              { label: 'Active / Dispatched', value: (data?.byStatus.find(s => s.status === 'DISPATCHED')?.count ?? 0) + (data?.byStatus.find(s => s.status === 'DISPATCH_HANDLING')?.count ?? 0), color: 'bg-status-info' },
              { label: 'Pending', value: submittedCount, color: 'bg-status-warning' },
            ].map(item => (
              <div key={item.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">{item.label}</span>
                  <span className="font-semibold text-brand-teal">{item.value}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${item.color} rounded-full transition-all duration-700`}
                    style={{ width: data?.total ? `${Math.min(100, Math.round((item.value / data.total) * 100))}%` : '0%' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Hospital Referrals */}
      {(data?.byReferral.length ?? 0) > 0 && (
        <div className="bg-white p-6 rounded-xl border border-surface-border shadow-sm flex flex-col h-[320px]">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-brand-teal flex items-center gap-2">
              <Ambulance size={16} weight="fill" /> Hospital Referrals
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Top referred facilities in period</p>
          </div>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.byReferral ?? []} margin={{ top: 0, right: 20, left: 0, bottom: 30 }}>
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="facility"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  angle={-25}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} dx={-10} allowDecimals={false} />
                <RechartsTooltip contentStyle={TOOLTIP_STYLE} itemStyle={{ fontSize: 12 }} />
                <Bar dataKey="count" name="Referrals" fill="#006973" radius={[4, 4, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
