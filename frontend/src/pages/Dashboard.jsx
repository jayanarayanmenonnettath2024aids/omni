import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, ComposedChart
} from 'recharts';
import { Plane, Ship, Truck, Warehouse, TrendingUp, TrendingDown, Clock, CheckCircle2 } from 'lucide-react';
import Layout from '../components/Layout';
import LoginOverlay from '../components/LoginOverlay';
import ERPDataView from '../components/ERPDataView';
import IngestionView from '../components/IngestionView';
import AIAssistantView from '../components/AIAssistantView';

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

const ActivityTable = ({ data }) => (
  <div className="bg-white border border-corp-border rounded-2xl enterprise-shadow overflow-hidden">
    <div className="px-6 py-5 border-b border-corp-border flex justify-between items-center bg-gray-50/50">
      <h3 className="text-sm font-black text-corp-dark uppercase tracking-widest">Recent Global Activity</h3>
      <button className="text-blue-600 text-xs font-black uppercase tracking-widest hover:underline hover:underline-offset-4 transition-all">View Analytics</button>
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

const Dashboard = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState('super');
  const [currentTab, setCurrentTab] = useState('dashboard');

  const handleLogin = (role) => {
    setUserRole(role);
    setIsLoggedIn(true);
  };

  const chartData = [
    { name: 'Jan', volume: 400, value: 2400 },
    { name: 'Feb', volume: 300, value: 1398 },
    { name: 'Mar', volume: 200, value: 9800 },
    { name: 'Apr', volume: 278, value: 3908 },
    { name: 'May', volume: 189, value: 4800 },
    { name: 'Jun', volume: 239, value: 3800 },
  ];

  const pieData = [
    { name: 'Electronics', value: 400 },
    { name: 'Machinery', value: 300 },
    { name: 'Textiles', value: 300 },
    { name: 'Food', value: 200 },
  ];

  const COLORS = ['#0052cc', '#00c7e5', '#ffab00', '#36b37e'];

  const activityData = [
    { id: 'SBC-EXP-552', company: 'TechCorp Industries', product: 'Electronics Mfg Components', origin: 'Chennai', destination: 'Dubai', status: 'Cleared', updated: '2026-03-30' },
    { id: 'SBC-IMP-109', company: 'Oceanic Importers', product: 'Specialty Machinery', origin: 'Singapore', destination: 'Chennai', status: 'Pending Customs', updated: '2026-04-01' },
    { id: 'SDB-DOM-004', company: 'Metro Retailers', product: 'FMCG Goods', origin: 'Coimbatore', destination: 'Chennai', status: 'In Transit', updated: '2026-03-31' },
  ];

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
                <button className="bg-corp-blue text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 font-bold text-xs uppercase tracking-widest shadow-lg shadow-blue-500/20 transition-all active:scale-95 flex items-center gap-2">
                  <CheckCircle2 size={14} /> Export Report
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <KPIWidget title="Active Exports" value="412" icon={Plane} color="text-emerald-600" active={userRole === 'export' || userRole === 'super'} subValue="+12.5%" />
              <KPIWidget title="Active Imports" value="189" icon={Ship} color="text-amber-600" active={userRole === 'import' || userRole === 'super'} subValue="+8.2%" />
              <KPIWidget title="Domestic Hub" value="647" icon={Truck} color="text-blue-600" active={userRole === 'domestic' || userRole === 'super'} subValue="+4.1%" />
              <KPIWidget title="Port Utilization" value="82%" icon={Warehouse} color="text-indigo-600" active={userRole === 'super'} subValue="+2.3%" />
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
                        <span className="text-xs font-bold text-corp-dark leading-none">{item.value}K</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <ActivityTable data={activityData} />
          </>
        );
      case 'erp':
        return <ERPDataView />;
      case 'ingestion':
        return <IngestionView />;
      case 'ai':
        return <AIAssistantView />;
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
