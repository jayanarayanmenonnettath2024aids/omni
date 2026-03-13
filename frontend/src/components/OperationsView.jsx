import React, { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { BarChart3, Box, Database, FileDown, RefreshCcw, Settings2, ShieldCheck, FileText, Layers3, Activity } from 'lucide-react';

const formatCurrencyCompact = (value) => new Intl.NumberFormat('en-IN', {
  notation: 'compact',
  maximumFractionDigits: 1,
}).format(Number(value || 0));

const formatInteger = (value) => new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 0,
}).format(Number(value || 0));

const StatCard = ({ icon: Icon, label, value, hint }) => (
  <div className="bg-white border border-corp-border rounded-2xl enterprise-shadow p-6">
    <div className="flex justify-between items-start gap-4">
      <div>
        <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</div>
        <div className="mt-2 text-3xl font-black text-corp-dark">{value}</div>
        {hint ? <div className="mt-3 text-xs font-bold text-gray-500">{hint}</div> : null}
      </div>
      <div className="p-3 rounded-xl bg-blue-50 text-blue-600">
        <Icon size={20} />
      </div>
    </div>
  </div>
);

const SectionCard = ({ title, subtitle, children, action }) => (
  <div className="bg-white border border-corp-border rounded-2xl enterprise-shadow overflow-hidden">
    <div className="px-6 py-5 border-b border-corp-border bg-gray-50/50 flex items-center justify-between gap-4">
      <div>
        <div className="text-sm font-black text-corp-dark uppercase tracking-widest">{title}</div>
        {subtitle ? <div className="mt-1 text-xs font-semibold text-gray-500">{subtitle}</div> : null}
      </div>
      {action || null}
    </div>
    <div className="p-6">{children}</div>
  </div>
);

const OperationsView = ({ view, dashboardData, userRole }) => {
  const [connectors, setConnectors] = useState([]);
  const [storageStatus, setStorageStatus] = useState(null);
  const [auditReport, setAuditReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rebuildState, setRebuildState] = useState({ running: false, message: '' });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [connectorsRes, storageRes, auditRes] = await Promise.all([
          fetch('/api/ingestion/connectors'),
          fetch('/api/storage/status'),
          view === 'admin' || view === 'reports' ? fetch('/api/audit/report') : Promise.resolve(null),
        ]);

        const [connectorsPayload, storagePayload, auditPayload] = await Promise.all([
          connectorsRes?.ok ? connectorsRes.json() : { connectors: [] },
          storageRes?.ok ? storageRes.json() : null,
          auditRes && auditRes.ok ? auditRes.json() : null,
        ]);

        if (!cancelled) {
          setConnectors(Array.isArray(connectorsPayload?.connectors) ? connectorsPayload.connectors : []);
          setStorageStatus(storagePayload);
          setAuditReport(auditPayload);
        }
      } catch (_error) {
        if (!cancelled) {
          setConnectors([]);
          setStorageStatus(null);
          setAuditReport(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [view]);

  const transactions = dashboardData?.transactions || [];
  const insights = dashboardData?.insights || {};

  const productRows = useMemo(() => {
    const grouped = new Map();
    for (const tx of transactions) {
      const name = tx.item || 'Unknown Product';
      const previous = grouped.get(name) || {
        name,
        category: tx.category || 'General',
        shipments: 0,
        totalValue: 0,
        tradeTypes: new Set(),
      };
      previous.shipments += 1;
      previous.totalValue += Number(tx.qty || 0) * Number(tx.rate || 0);
      previous.tradeTypes.add((tx.trade_type || 'DOMESTIC').toUpperCase());
      grouped.set(name, previous);
    }
    return Array.from(grouped.values())
      .map((row) => ({ ...row, tradeTypes: Array.from(row.tradeTypes).join(', ') }))
      .sort((a, b) => b.totalValue - a.totalValue);
  }, [transactions]);

  const productChart = productRows.slice(0, 6).map((row) => ({
    name: row.name.length > 18 ? `${row.name.slice(0, 18)}...` : row.name,
    value: Math.round(row.totalValue / 1000),
  }));

  const monthlySeries = (insights.monthly || []).map((entry) => ({
    month: entry.month,
    value: Math.round(Number(entry.value || 0) / 100000),
  }));

  const tradeMix = [
    { name: 'Export', value: transactions.filter((tx) => String(tx.trade_type || '').toUpperCase() === 'EXPORT').length },
    { name: 'Import', value: transactions.filter((tx) => String(tx.trade_type || '').toUpperCase() === 'IMPORT').length },
    { name: 'Domestic', value: transactions.filter((tx) => String(tx.trade_type || '').toUpperCase() === 'DOMESTIC').length },
  ].filter((row) => row.value > 0);

  const tradeMixColors = ['#0052cc', '#0f766e', '#7c3aed'];

  const recentInvoices = transactions.slice(0, 10).map((tx) => ({
    invoice: tx.invoice_no,
    company: tx.client_name,
    type: tx.trade_type,
    value: Number(tx.qty || 0) * Number(tx.rate || 0),
    date: tx.date,
  }));

  const rebuildVector = async () => {
    setRebuildState({ running: true, message: 'Rebuilding vector index...' });
    try {
      const response = await fetch('/api/vector/rebuild', { method: 'POST' });
      const payload = await response.json();
      setRebuildState({ running: false, message: `Indexed ${payload.indexed_records || payload.count || 0} records` });
      const storageRes = await fetch('/api/storage/status');
      const storagePayload = storageRes.ok ? await storageRes.json() : null;
      setStorageStatus(storagePayload);
    } catch (_error) {
      setRebuildState({ running: false, message: 'Vector rebuild failed' });
    }
  };

  if (loading) {
    return <div className="text-center py-20 text-xs font-black uppercase tracking-widest text-blue-600">Loading {view} workspace...</div>;
  }

  if (view === 'products') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-black text-corp-dark tracking-tight leading-none mb-3">Products <span className="text-blue-600">Portfolio</span></h1>
          <p className="text-sm text-gray-500 font-medium">Role-scoped product mix based on current ERP transactions.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard icon={Box} label="Visible Products" value={formatInteger(productRows.length)} hint="Distinct products in current role view" />
          <StatCard icon={Layers3} label="Product Shipments" value={formatInteger(productRows.reduce((sum, row) => sum + row.shipments, 0))} hint="Total shipment occurrences" />
          <StatCard icon={Database} label="Product Value" value={`INR ${formatCurrencyCompact(productRows.reduce((sum, row) => sum + row.totalValue, 0))}`} hint="Combined trade value" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2">
            <SectionCard title="Top Product Value" subtitle="Highest gross value items in current desk scope">
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={productChart} layout="vertical" margin={{ left: 10, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eef2f7" />
                    <XAxis type="number" axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={110} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#2563eb" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
          </div>
          <div className="lg:col-span-3">
            <SectionCard title="Product Ledger" subtitle="Live ERP-backed product summary table">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] border-b border-corp-border">
                      <th className="px-4 py-3 text-left">Product</th>
                      <th className="px-4 py-3 text-left">Category</th>
                      <th className="px-4 py-3 text-left">Trade Types</th>
                      <th className="px-4 py-3 text-right">Shipments</th>
                      <th className="px-4 py-3 text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {productRows.slice(0, 12).map((row) => (
                      <tr key={row.name} className="hover:bg-blue-50/20 transition-colors">
                        <td className="px-4 py-3 text-sm font-bold text-corp-dark">{row.name}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-slate-600">{row.category}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-slate-600">{row.tradeTypes}</td>
                        <td className="px-4 py-3 text-right text-sm font-black text-slate-900">{formatInteger(row.shipments)}</td>
                        <td className="px-4 py-3 text-right text-sm font-black text-slate-900 italic">INR {formatInteger(Math.round(row.totalValue))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'analytics') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-black text-corp-dark tracking-tight leading-none mb-3">Trade <span className="text-blue-600">Analytics</span></h1>
          <p className="text-sm text-gray-500 font-medium">Deeper role-scoped analytics beyond the main dashboard cards.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <SectionCard title="Monthly Value Trend" subtitle="Trailing monthly trade movement">
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlySeries}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
          </div>
          <div>
            <SectionCard title="Trade Mix" subtitle="Distribution by trade type">
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={tradeMix} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={6}>
                      {tradeMix.map((entry, idx) => <Cell key={entry.name} fill={tradeMixColors[idx % tradeMixColors.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
          </div>
        </div>

        <SectionCard title="Route And Port Highlights" subtitle="Operational concentration by current desk">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Top Routes</div>
              <div className="space-y-3">
                {(insights.top_routes || []).map((route) => (
                  <div key={route.route} className="rounded-xl border border-gray-100 bg-gray-50/70 px-4 py-3 flex items-center justify-between gap-4">
                    <span className="text-sm font-bold text-corp-dark">{route.route}</span>
                    <span className="text-xs font-black text-blue-600 uppercase tracking-wide">INR {formatCurrencyCompact(route.value)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Port Activity</div>
              <div className="space-y-3">
                {(insights.port_activity || []).map((port) => (
                  <div key={port.port} className="rounded-xl border border-gray-100 bg-gray-50/70 px-4 py-3">
                    <div className="flex items-center justify-between gap-4 mb-2">
                      <span className="text-sm font-bold text-corp-dark">{port.port}</span>
                      <span className="text-xs font-black text-emerald-600 uppercase tracking-wide">{port.count} movements</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-emerald-500 to-blue-600 rounded-full" style={{ width: `${Math.max(8, port.pct || 0)}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SectionCard>
      </div>
    );
  }

  if (view === 'reports') {
    const anomalyCount = Array.isArray(auditReport?.anomalies) ? auditReport.anomalies.length : 0;
    const delayCount = Array.isArray(auditReport?.delays) ? auditReport.delays.length : 0;

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-black text-corp-dark tracking-tight leading-none mb-3">Operational <span className="text-blue-600">Reports</span></h1>
          <p className="text-sm text-gray-500 font-medium">Export and review the live datasets behind the dashboard.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard icon={FileDown} label="CSV Exports" value="1" hint="Role-scoped ERP export available" />
          <StatCard icon={Activity} label="Audit Anomalies" value={formatInteger(anomalyCount)} hint="Current consistency findings" />
          <StatCard icon={ShieldCheck} label="Delay Flags" value={formatInteger(delayCount)} hint="Shipment delays in audit scan" />
        </div>

        <SectionCard
          title="Report Actions"
          subtitle="Generate data extracts and inspect recent transactions"
          action={
            <button
              onClick={() => window.open(`/api/export/report?role=${encodeURIComponent(userRole)}`, '_blank')}
              className="bg-blue-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all"
            >
              Download CSV
            </button>
          }
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-5">
              <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Available Outputs</div>
              <div className="space-y-3 text-sm font-semibold text-slate-600">
                <div>ERP transactions CSV for the active role</div>
                <div>Audit report from current unified data lake snapshot</div>
                <div>Storage and vector sync status summary</div>
              </div>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-5">
              <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Recent Invoices</div>
              <div className="space-y-3">
                {recentInvoices.slice(0, 6).map((row) => (
                  <div key={row.invoice} className="flex items-center justify-between gap-4 text-sm">
                    <div>
                      <div className="font-bold text-corp-dark">{row.invoice}</div>
                      <div className="text-xs font-semibold text-gray-500">{row.company} • {row.type}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-slate-900">INR {formatCurrencyCompact(row.value)}</div>
                      <div className="text-xs font-semibold text-gray-500">{row.date}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SectionCard>
      </div>
    );
  }

  if (view === 'admin') {
    const connectorUp = connectors.filter((connector) => connector.status === 'Connected').length;
    const sqliteRows = storageStatus?.sqlite?.rows || 0;
    const pgRows = storageStatus?.postgres?.rows || 0;
    const chromaRows = storageStatus?.chroma?.count || 0;

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-black text-corp-dark tracking-tight leading-none mb-3">Admin <span className="text-blue-600">Settings</span></h1>
          <p className="text-sm text-gray-500 font-medium">System health, storage state, and maintenance actions.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCard icon={Settings2} label="Connector Health" value={`${connectorUp}/${connectors.length}`} hint="Connected pipelines" />
          <StatCard icon={Database} label="SQLite Rows" value={formatInteger(sqliteRows)} hint="Unified local storage" />
          <StatCard icon={Layers3} label="Postgres Rows" value={formatInteger(pgRows)} hint={storageStatus?.postgres?.ready ? 'Remote DB connected' : 'Fallback currently active'} />
          <StatCard icon={ShieldCheck} label="Chroma Records" value={formatInteger(chromaRows)} hint="Vector search index size" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SectionCard
            title="Maintenance"
            subtitle="Operational system controls"
            action={
              <button
                onClick={rebuildVector}
                disabled={rebuildState.running}
                className="bg-blue-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all disabled:opacity-60"
              >
                {rebuildState.running ? 'Running...' : 'Rebuild Vector'}
              </button>
            }
          >
            <div className="space-y-4 text-sm font-semibold text-slate-600">
              <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4">Active role policy: <span className="font-black text-corp-dark">{String(userRole || 'super').toUpperCase()}</span></div>
              <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4">Vector sync state: <span className="font-black text-corp-dark">{storageStatus?.chroma?.in_sync ? 'In Sync' : 'Needs Refresh'}</span></div>
              <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4">Latest action: <span className="font-black text-corp-dark">{rebuildState.message || 'No maintenance actions in this session'}</span></div>
            </div>
          </SectionCard>

          <SectionCard title="Connector Control Plane" subtitle="Latest state of ingestion channels">
            <div className="space-y-3">
              {connectors.map((connector) => (
                <div key={connector.key} className="rounded-xl border border-gray-100 bg-gray-50/70 px-4 py-3 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-bold text-corp-dark">{connector.name}</div>
                    <div className="text-xs font-semibold text-gray-500">{connector.type} • Last sync {connector.last_sync || '-'}</div>
                  </div>
                  <div className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-tight border ${connector.status === 'Connected' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                    {connector.status}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    );
  }

  return <div className="text-center py-20 text-gray-400 font-bold uppercase tracking-widest">View Under Development</div>;
};

export default OperationsView;