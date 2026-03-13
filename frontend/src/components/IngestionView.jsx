import React, { useState } from 'react';
import { Inbox, FileText, Brain, Fingerprint, Database, Layers, CheckCircle2, RotateCw, MoreHorizontal } from 'lucide-react';

const PipelineStep = ({ icon: Icon, label, status, active, pulse }) => (
  <div className={`flex flex-col items-center group transition-all duration-500 ${!active ? 'opacity-40 grayscale' : ''}`}>
    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 border-2 transition-all duration-500 shadow-lg ${
      status === 'Processing' 
        ? 'bg-blue-600 text-white border-blue-200' 
        : 'bg-blue-50 text-blue-600 border-blue-100'
    } ${pulse ? 'animate-pulse' : ''} group-hover:scale-110`}>
      <Icon size={24} />
    </div>
    <span className="text-[10px] font-black text-corp-dark uppercase tracking-widest">{label}</span>
    <span className={`text-[8px] font-black uppercase mt-1 tracking-tighter ${
      status === 'Active' ? 'text-emerald-500' : 
      status === 'Processing' ? 'text-blue-500' : 'text-gray-400'
    }`}>
      {status === 'Active' && '* '} {status}
    </span>
  </div>
);

const ConnectionRow = ({ name, type, status, time, volume }) => (
  <tr className="hover:bg-blue-50/30 transition-colors group/row cursor-pointer">
    <td className="px-6 py-5 font-bold text-corp-dark text-sm">{name}</td>
    <td className="px-6 py-5 text-sm font-semibold text-slate-600 truncate">
      <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-[10px] font-black uppercase tracking-tight border border-indigo-100">
        {type}
      </span>
    </td>
    <td className="px-6 py-5">
      <span className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${
        status.includes('Connected') ? 'text-emerald-500' : 'text-amber-500'
      }`}>
        <div className={`w-1.5 h-1.5 rounded-full ${status.includes('Connected') ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
        {status}
      </span>
    </td>
    <td className="px-6 py-5 text-sm text-slate-400 font-bold">{time}</td>
    <td className="px-6 py-5 text-sm text-slate-800 font-black">{volume}</td>
    <td className="px-6 py-5 text-center">
      <button className="p-2 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
        <MoreHorizontal size={18} />
      </button>
    </td>
  </tr>
);

const IngestionView = () => {
  const [isSyncing, setIsSyncing] = useState(false);

  const triggerSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/pipeline/sync', { method: 'POST' });
      const data = await res.json();
      alert(`Data Lake Refreshed! ${data.summary.total_records} records processed.`);
    } catch(e) {
      alert('Sync Failed: ' + e);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black text-corp-dark tracking-tight leading-none mb-3">Data <span className="text-blue-600">Ingestion</span> Pipeline</h1>
          <p className="text-sm text-gray-500 font-medium">Real-time ETL and Master Data Management status console.</p>
        </div>
        <button 
          onClick={triggerSync}
          disabled={isSyncing}
          className="bg-white border-2 border-corp-border text-corp-dark px-6 py-3 rounded-2xl hover:bg-corp-hover hover:border-gray-400 font-black text-[10px] uppercase tracking-[0.2em] transition-all disabled:opacity-50 flex items-center gap-3 shadow-lg shadow-black/5 active:scale-95"
        >
          <RotateCw size={16} className={isSyncing ? 'animate-spin' : ''} />
          {isSyncing ? 'Syncing Pipeline...' : 'Run Manual Sync'}
        </button>
      </div>

      <div className="bg-white border border-corp-border rounded-[2.5rem] enterprise-shadow p-10 mb-10 overflow-hidden relative group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full -mr-32 -mt-32 blur-3xl opacity-50 transition-all duration-1000 group-hover:scale-150"></div>
        <h3 className="text-[10px] font-black text-corp-dark uppercase tracking-[0.3em] mb-10 border-b border-gray-100 pb-4">Real-time ETL Processing Architecture</h3>
        <div className="flex justify-between items-center px-4 relative z-10">
          <PipelineStep icon={Inbox} label="Collection" status="Active" active={true} />
          <div className="flex-1 h-[2px] bg-gradient-to-r from-blue-500 to-blue-500/20 mx-4 opacity-30"></div>
          <PipelineStep icon={FileText} label="OCR/Parsing" status="Active" active={true} />
          <div className="flex-1 h-[2px] bg-gradient-to-r from-blue-500 to-blue-500/20 mx-4 opacity-30"></div>
          <PipelineStep icon={Brain} label="NLP Extraction" status="Active" active={true} />
          <div className="flex-1 h-[2px] bg-gradient-to-r from-blue-500 to-blue-500/20 mx-4 opacity-30 animate-pulse"></div>
          <PipelineStep icon={Fingerprint} label="Entity Res" status="Processing" active={true} pulse={true} />
          <div className="flex-1 h-[2px] bg-gray-200 mx-4 opacity-30"></div>
          <PipelineStep icon={Database} label="DB Storage" status="Waiting" active={false} />
          <div className="flex-1 h-[2px] bg-gray-200 mx-4 opacity-30"></div>
          <PipelineStep icon={Layers} label="Vector Index" status="Waiting" active={false} />
        </div>
      </div>

      <div className="bg-white border border-corp-border rounded-[2.5rem] enterprise-shadow overflow-hidden group">
        <div className="px-8 py-6 border-b border-corp-border flex justify-between items-center bg-gray-50/50">
          <h3 className="text-[10px] font-black text-corp-dark uppercase tracking-[0.3em]">Active Data Source Connectors</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-white text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] border-b border-corp-border">
                <th className="px-6 py-5 text-left">Connector Name</th>
                <th className="px-6 py-5 text-left">Type</th>
                <th className="px-6 py-5 text-left">Status</th>
                <th className="px-6 py-5 text-left">Last Sync Time</th>
                <th className="px-6 py-5 text-left">Volume (24h)</th>
                <th className="px-6 py-5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <ConnectionRow name="ERP Database Sync (SAP)" type="REST API" status="● Connected" time="2 mins ago" volume="4,502 records" />
              <ConnectionRow name="Corporate IMAP Mailbox" type="EMAIL" status="● Connected" time="5 mins ago" volume="115 emails" />
              <ConnectionRow name="Regional Portals Tracker" type="REST API" status="● Connected" time="15 mins ago" volume="82 updates" />
              <ConnectionRow name="Customs PDF Directory" type="FILE SYSTEM" status="● Connected" time="1 hr ago" volume="14 files" />
              <ConnectionRow name="Monthly Master Data" type="SPREADSHEET" status="● Scheduled" time="Yesterday" volume="1 file" />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default IngestionView;
