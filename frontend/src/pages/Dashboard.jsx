import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area, ComposedChart
} from 'recharts';
import { Plane, Ship, Truck, Warehouse, TrendingUp, TrendingDown, Clock, CheckCircle2 } from 'lucide-react';
import Layout from '../components/Layout';
import LoginOverlay from '../components/LoginOverlay';
import ERPDataView from '../components/ERPDataView';
import IngestionView from '../components/IngestionView';
import AIAssistantView from '../components/AIAssistantView';
import LiveVoiceAgentView from '../components/LiveVoiceAgentView';
import MasterDataView from '../components/MasterDataView';
import TradeMapView from '../components/TradeMapView';
import OperationsView from '../components/OperationsView';
import AuditControlView from '../components/AuditControlView';

const formatCurrencyCompact = (value) => new Intl.NumberFormat('en-IN', {
  notation: 'compact',
  maximumFractionDigits: 1,
}).format(Number(value || 0));

const formatInteger = (value) => new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 0,
}).format(Number(value || 0));

const formatMonthLabel = (month) => {
  if (!month) return '-';
  const [year, monthIndex] = String(month).split('-');
  return new Date(Number(year), Number(monthIndex) - 1, 1).toLocaleDateString('en-IN', {
    month: 'short',
    year: '2-digit',
  });
};

const KPIWidget = ({ title, value, icon: Icon, color, active, subValue }) => (
  <div className={`bg-white p-6 rounded-2xl border border-corp-border enterprise-shadow transition-all duration-300 ${!active ? 'opacity-40 grayscale' : 'hover:shadow-lg hover:-translate-y-1'}`}>
    <div className="flex justify-between items-start mb-4">
      <div>
        <span className={`text-[10px] font-black uppercase tracking-widest ${color}`}>{title}</span>
        <div className="text-3xl font-black text-corp-dark mt-1">{value}</div>
      </div>
      <div className={`p-3 rounded-xl ${color.replace('text-', 'bg-').replace('600', '100')} ${color}`}>
        <Icon size={24} />
      </div>
    </div>
    {subValue && (
      <div className="flex items-center gap-1.5 mt-2">
        <TrendingUp size={14} className="text-emerald-500" />
        <span className="text-xs font-bold text-emerald-500">{subValue}</span>
        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">vs last month</span>
      </div>
    )}
  </div>
);

const ActivityTable = ({ data, title = 'Recent Activity', onViewAnalytics }) => (
  <div className="bg-white border border-corp-border rounded-2xl enterprise-shadow overflow-hidden">
    <div className="px-6 py-5 border-b border-corp-border flex justify-between items-center bg-gray-50/50">
      <h3 className="text-sm font-black text-corp-dark uppercase tracking-widest">{title}</h3>
      <button
        onClick={onViewAnalytics}
        className="text-blue-600 text-xs font-black uppercase tracking-widest hover:underline hover:underline-offset-4 transition-all"
      >
        View Analytics
      </button>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="bg-white text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] border-b border-corp-border">
            <th className="px-6 py-4 text-left">Shipment ID</th>
            <th className="px-6 py-4 text-left">Company</th>
            <th className="px-6 py-4 text-left">Product</th>
            <th className="px-6 py-4 text-left">Route</th>
            <th className="px-6 py-4 text-left">Status</th>
            <th className="px-6 py-4 text-right">Last Updated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.map((row, idx) => (
            <tr key={idx} className="hover:bg-blue-50/30 transition-colors group cursor-pointer">
              <td className="px-6 py-4 font-bold text-blue-600 text-sm">{row.id}</td>
              <td className="px-6 py-4 text-sm font-semibold text-corp-dark">{row.company}</td>
              <td className="px-6 py-4 text-sm text-corp-gray font-medium">{row.product}</td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2 text-xs font-bold text-corp-dark">
                  <span>{row.origin}</span>
                  <div className="h-[2px] w-4 bg-gray-200 rounded-full"></div>
                  <span>{row.destination}</span>
                </div>
              </td>
              <td className="px-6 py-4">
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tight flex items-center gap-1.5 w-fit border ${
                  row.status === 'Cleared' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                  row.status === 'In Transit' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                  'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    row.status === 'Cleared' ? 'bg-emerald-500' :
                    row.status === 'In Transit' ? 'bg-blue-500' :
                    'bg-amber-500'
                  }`}></div>
                  {row.status}
                </span>
              </td>
              <td className="px-6 py-4 text-right text-corp-gray text-[10px] font-black">{row.updated}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const AnalyticsListCard = ({ title, rows, valueLabel }) => (
  <div className="bg-white border border-corp-border rounded-2xl enterprise-shadow p-8 hover:shadow-lg transition-shadow">
    <h3 className="text-sm font-black text-corp-dark uppercase tracking-widest mb-6">{title}</h3>
    <div className="space-y-4">
      {rows.length ? rows.map((row, index) => (
        <div key={`${row.label}-${index}`} className="rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3">
          <div className="flex items-center justify-between gap-4 mb-2">
            <span className="text-sm font-bold text-corp-dark">{row.label}</span>
            <span className="text-xs font-black text-blue-600 uppercase tracking-wider">{row.value}</span>
          </div>
          <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-emerald-400" style={{ width: `${Math.max(8, Math.min(100, row.pct || 0))}%` }}></div>
          </div>
          <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-gray-400">{valueLabel}</div>
        </div>
      )) : (
        <div className="text-sm font-semibold text-gray-400">No analytics available.</div>
      )}
    </div>
  </div>
);

const Dashboard = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState('super');
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [dashboardData, setDashboardData] = useState(null);
  const [loadingData, setLoadingData] = useState(false);
  const [dashboardError, setDashboardError] = useState('');

  const handleLogin = (user) => {
    setUserRole((user?.role || 'super').toLowerCase());
    setIsLoggedIn(true);
  };

  useEffect(() => {
    if (!isLoggedIn) return;
    let cancelled = false;

    const load = async () => {
      setLoadingData(true);
      try {
        const deskRes = await fetch(`/api/dashboard/data?role=${encodeURIComponent(userRole)}`);
        const rawBody = await deskRes.text();
        let deskData = null;
        try {
          deskData = rawBody ? JSON.parse(rawBody) : null;
        } catch (_e) {
          deskData = null;
        }

        if (!deskRes.ok) {
          const detail = deskData?.detail || deskData?.message || rawBody || `Request failed with ${deskRes.status}`;
          throw new Error(typeof detail === 'string' ? detail : `Request failed with ${deskRes.status}`);
        }

        if (!deskData || typeof deskData !== 'object') {
          throw new Error('Dashboard service returned an empty response.');
        }

        if (!cancelled) {
          setDashboardData(deskData);
          setDashboardError('');
        }
      } catch (error) {
        if (!cancelled) {
          setDashboardError(error?.message || 'Unable to load dashboard data.');
        }
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    };

    load();
    const t = setInterval(load, 10000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [isLoggedIn, userRole]);

  const chartData = useMemo(() => {
    const monthly = dashboardData?.insights?.monthly || [];
    if (!monthly.length) return [];
    return monthly.map((m) => ({
      name: formatMonthLabel(m.month),
      volume: Math.max(1, Math.round((m.value || 0) / 1000000)),
      value: Number((m.value || 0) / 100000).toFixed(1),
    }));
  }, [dashboardData]);

  const pieData = useMemo(() => {
    const labels = dashboardData?.insights?.labels || [];
    const values = dashboardData?.insights?.values || [];
    return labels.map((label, idx) => ({
      name: label,
      value: values[idx] || 0,
    }));
  }, [dashboardData]);

  const COLORS = ['#0052cc', '#00c7e5', '#ffab00', '#36b37e', '#7c3aed', '#ef4444'];

  const activityData = useMemo(() => {
    const tx = dashboardData?.transactions || [];
    return tx.slice(0, 12).map((t) => ({
      id: t.invoice_no,
      company: t.client_name,
      product: t.item,
      origin: t.origin || '-',
      destination: t.destination || '-',
      status: (t.trade_type || 'DOMESTIC') === 'EXPORT' ? 'Cleared' : (t.trade_type || 'DOMESTIC') === 'IMPORT' ? 'Pending Customs' : 'In Transit',
      updated: t.date,
    }));
  }, [dashboardData]);

  const insights = dashboardData?.insights || {};

  const totalTransactions = dashboardData?.transactions?.length || 0;
  const exportCount = (dashboardData?.transactions || []).filter((t) => (t.trade_type || '').toUpperCase() === 'EXPORT').length;
  const importCount = (dashboardData?.transactions || []).filter((t) => (t.trade_type || '').toUpperCase() === 'IMPORT').length;
  const domesticCount = (dashboardData?.transactions || []).filter((t) => (t.trade_type || '').toUpperCase() === 'DOMESTIC').length;

  const routeRows = (insights.top_routes || []).map((route) => ({
    label: route.route,
    value: `INR ${formatCurrencyCompact(route.value)}`,
    pct: insights.total_value ? Math.round((route.value / insights.total_value) * 100) : 0,
  }));

  const portRows = (insights.port_activity || []).map((port) => ({
    label: port.port,
    value: `${port.count} shipments`,
    pct: port.pct || 0,
  }));

  const exportReport = () => {
    window.open(`/api/export/report?role=${encodeURIComponent(userRole)}`, '_blank');
  };

  if (!isLoggedIn) return <LoginOverlay onLogin={handleLogin} />;

  const renderContent = () => {
    switch (currentTab) {
      case 'dashboard':
        return (
          <>
            <div className="flex justify-between items-center mb-10">
              <div>
                <h1 className="text-3xl font-black text-corp-dark tracking-tight leading-none mb-3">
                  {userRole.charAt(0).toUpperCase() + userRole.slice(1)} <span className="text-blue-600">Terminal</span> Control
                </h1>
                <p className="text-sm text-gray-500 font-medium">
                  {userRole === 'super' ? 'Global unified view of all trade channels.' : 
                   userRole === 'export' ? 'Tracking outgoing shipments and international manifests.' :
                   'Departmental logistics monitoring and management.'}
                </p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsLoggedIn(false)} 
                  className="bg-white border border-red-200 text-red-600 px-5 py-2.5 rounded-xl hover:bg-red-50 font-bold text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2"
                >
                  <Clock size={14} /> Switch Desk
                </button>
                <button onClick={exportReport} className="bg-corp-blue text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 font-bold text-xs uppercase tracking-widest shadow-lg shadow-blue-500/20 transition-all active:scale-95 flex items-center gap-2">
                  <CheckCircle2 size={14} /> Export Report
                </button>
              </div>
            </div>

            {loadingData && (
              <div className="mb-6 text-xs font-black uppercase tracking-widest text-blue-600">Syncing live dashboard data...</div>
            )}

            {dashboardError && (
              <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {dashboardError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <KPIWidget title="Trade Value" value={`INR ${formatCurrencyCompact(insights.total_value)}`} icon={TrendingUp} color="text-emerald-600" active={true} subValue={`${formatInteger(totalTransactions)} visible records`} />
              <KPIWidget title="Visible Shipments" value={formatInteger(insights.total_shipments)} icon={Warehouse} color="text-indigo-600" active={true} subValue={`${formatInteger(insights.pending_shipments)} pending`} />
              <KPIWidget title="Role Export Count" value={String(exportCount)} icon={Plane} color="text-emerald-600" active={userRole === 'export' || userRole === 'super'} subValue={`${formatInteger(importCount)} imports in this view`} />
              <KPIWidget title="Average Ticket" value={`INR ${formatCurrencyCompact(insights.avg_ticket)}`} icon={Truck} color="text-blue-600" active={true} subValue={`${formatInteger(domesticCount)} domestic records`} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white border border-corp-border rounded-2xl enterprise-shadow p-6">
                <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Role Shipments</div>
                <div className="text-3xl font-black text-corp-dark">{formatInteger(insights.total_shipments)}</div>
                <div className="mt-3 text-xs font-bold text-gray-500">Analytics shown for the {userRole.toUpperCase()} desk only.</div>
              </div>
              <div className="bg-white border border-corp-border rounded-2xl enterprise-shadow p-6">
                <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Role Visible Value</div>
                <div className="text-3xl font-black text-corp-dark">INR {formatCurrencyCompact(insights.total_value)}</div>
                <div className="mt-3 text-xs font-bold text-gray-500">Current desk filter: {userRole.toUpperCase()}</div>
              </div>
              <div className="bg-white border border-corp-border rounded-2xl enterprise-shadow p-6">
                <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Port Coverage</div>
                <div className="text-3xl font-black text-corp-dark">{formatInteger((insights.port_activity || []).length)}</div>
                <div className="mt-3 text-xs font-bold text-gray-500">Ports active in the current desk view.</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              <div className="lg:col-span-2 bg-white border border-corp-border rounded-2xl enterprise-shadow p-8 hover:shadow-lg transition-shadow">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-sm font-black text-corp-dark uppercase tracking-widest">Trade Volume & Revenue Performance</h3>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                      <span className="text-[10px] font-black text-gray-400 uppercase">Volume</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
                      <span className="text-[10px] font-black text-gray-400 uppercase">Revenue</span>
                    </div>
                  </div>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData}>
                      <defs>
                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0052cc" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#0052cc" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                        itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                      />
                      <Area type="monotone" dataKey="value" stroke="#0052cc" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
                      <Bar dataKey="volume" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              <div className="bg-white border border-corp-border rounded-2xl enterprise-shadow p-8 flex flex-col hover:shadow-lg transition-shadow">
                <h3 className="text-sm font-black text-corp-dark uppercase tracking-widest mb-8">Cargo Distribution</h3>
                <div className="flex-1 min-h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={8}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} cornerRadius={4} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-6">
                  {pieData.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2.5 p-2 rounded-lg bg-gray-50 border border-gray-100">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-gray-500 uppercase leading-none mb-1">{item.name}</span>
                        <span className="text-xs font-bold text-corp-dark leading-none">INR {formatCurrencyCompact((insights.distribution || {})[item.name] || 0)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <AnalyticsListCard title="Top Trade Routes" rows={routeRows} valueLabel="Share of total trade value" />
              <AnalyticsListCard title="Port Activity" rows={portRows} valueLabel="Share of active movement" />
            </div>

            <ActivityTable
              data={activityData}
              title={`${userRole === 'super' ? 'Recent Global Activity' : `Recent ${userRole.toUpperCase()} Activity`}`}
              onViewAnalytics={() => setCurrentTab('analytics')}
            />
          </>
        );
      case 'erp':
        return <ERPDataView />;
      case 'ingestion':
        return <IngestionView />;
      case 'ai':
        return <AIAssistantView />;
      case 'voice-agent':
        return <LiveVoiceAgentView />;
      case 'documents':
        return <MasterDataView view="documents" />;
      case 'companies':
        return <MasterDataView view="companies" />;
      case 'shipments':
        return <MasterDataView view="shipments" />;
      case 'map':
        return <TradeMapView userRole={userRole} />;
      case 'products':
        return <OperationsView view="products" dashboardData={dashboardData} userRole={userRole} />;
      case 'analytics':
        return <OperationsView view="analytics" dashboardData={dashboardData} userRole={userRole} />;
      case 'reports':
        return <OperationsView view="reports" dashboardData={dashboardData} userRole={userRole} />;
      case 'admin':
        return <OperationsView view="admin" dashboardData={dashboardData} userRole={userRole} />;
      case 'audit':
        return <AuditControlView />;
      default:
        return <div className="text-center py-20 text-gray-400 font-bold uppercase tracking-widest">View Under Development</div>;
    }
  };

  return (
    <Layout currentTab={currentTab} setTab={setCurrentTab} userRole={userRole}>
      {renderContent()}
    </Layout>
  );
};

export default Dashboard;
