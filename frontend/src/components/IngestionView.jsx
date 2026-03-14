import React, { useState } from 'react';
import { Inbox, FileText, Brain, Fingerprint, Database, Layers, RotateCw, MoreHorizontal, Upload, RefreshCcw } from 'lucide-react';

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
  const [connectors, setConnectors] = useState([]);
  const [pipelineStatus, setPipelineStatus] = useState(null);
  const [mdmStatus, setMdmStatus] = useState(null);
  const [excelFile, setExcelFile] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [activeUpload, setActiveUpload] = useState('');

  const loadConnectors = async () => {
    try {
      const [res, pipelineRes, mdmRes] = await Promise.all([
        fetch('/api/ingestion/connectors'),
        fetch('/api/pipeline/status'),
        fetch('/api/mdm/status'),
      ]);
      if (!res.ok) {
        throw new Error(`Connector request failed with ${res.status}`);
      }
      const data = await res.json();
      setConnectors(data.connectors || []);
      setPipelineStatus(pipelineRes.ok ? await pipelineRes.json() : null);
      setMdmStatus(mdmRes.ok ? await mdmRes.json() : null);
    } catch (_e) {
      setConnectors([]);
      setPipelineStatus(null);
      setMdmStatus(null);
    }
  };

  React.useEffect(() => {
    loadConnectors();
    const t = setInterval(loadConnectors, 10000);
    return () => clearInterval(t);
  }, []);

  const triggerSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/ingest/all', { method: 'POST' });
      const raw = await res.text();
      let data = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch (_e) {
        throw new Error(raw || `Request failed with ${res.status}`);
      }

      if (!res.ok) {
        throw new Error(data?.message || data?.detail || `Request failed with ${res.status}`);
      }

      const total = data?.summary?.total_records || 0;
      const failedSources = Object.values(data?.results || {}).filter((item) => item?.status && item.status !== 'success');
      if (failedSources.length) {
        const details = failedSources.map((item) => `${item.source}: ${item.message || item.status}`).join('\n');
        alert(`Data Lake Sync completed with warnings. ${total} records processed.\n${details}`);
      } else {
        alert(`Data Lake Refreshed! ${total} records processed.`);
      }
      await loadConnectors();
    } catch(e) {
      alert('Sync Failed: ' + (e?.message || e));
    } finally {
      setIsSyncing(false);
    }
  };

  const uploadFile = async (kind, file) => {
    if (!file) {
      alert(`Please choose a ${kind.toUpperCase()} file first.`);
      return;
    }

    setActiveUpload(kind);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const endpoint = kind === 'excel' ? '/api/ingest/excel/upload' : '/api/ingest/pdf/upload';
      const res = await fetch(endpoint, { method: 'POST', body: formData });
      const raw = await res.text();
      const data = raw ? JSON.parse(raw) : {};
      if (!res.ok) {
        throw new Error(data?.detail || data?.message || `Upload failed with ${res.status}`);
      }
      alert(`${kind.toUpperCase()} uploaded and processed successfully. ${data.records || 0} records added.`);
      if (kind === 'excel') setExcelFile(null);
      if (kind === 'pdf') setPdfFile(null);
      await loadConnectors();
    } catch (error) {
      alert(`${kind.toUpperCase()} upload failed: ${error?.message || error}`);
    } finally {
      setActiveUpload('');
    }
  };

  const rebuildVector = async () => {
    try {
      const res = await fetch('/api/vector/rebuild', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.detail || data?.message || `Request failed with ${res.status}`);
      }
      alert(`Chroma index rebuilt successfully. ${data.indexed_records || 0} records indexed.`);
    } catch (error) {
      alert(`Vector rebuild failed: ${error?.message || error}`);
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white border border-corp-border rounded-2xl enterprise-shadow p-6">
          <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Upload Excel Source</div>
          <input type="file" accept=".xlsx,.xls" onChange={(e) => setExcelFile(e.target.files?.[0] || null)} className="block w-full text-sm font-semibold text-slate-500 file:mr-4 file:rounded-xl file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-xs file:font-black file:uppercase file:tracking-widest file:text-blue-600" />
          <button onClick={() => uploadFile('excel', excelFile)} disabled={activeUpload === 'excel'} className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-white hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
            <Upload size={14} /> {activeUpload === 'excel' ? 'Uploading Excel...' : 'Upload Excel'}
          </button>
        </div>
        <div className="bg-white border border-corp-border rounded-2xl enterprise-shadow p-6">
          <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Upload PDF Source</div>
          <input type="file" accept=".pdf" onChange={(e) => setPdfFile(e.target.files?.[0] || null)} className="block w-full text-sm font-semibold text-slate-500 file:mr-4 file:rounded-xl file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-xs file:font-black file:uppercase file:tracking-widest file:text-indigo-600" />
          <button onClick={() => uploadFile('pdf', pdfFile)} disabled={activeUpload === 'pdf'} className="mt-4 w-full rounded-xl bg-indigo-600 px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
            <Upload size={14} /> {activeUpload === 'pdf' ? 'Uploading PDF...' : 'Upload PDF'}
          </button>
        </div>
        <div className="bg-white border border-corp-border rounded-2xl enterprise-shadow p-6 flex flex-col justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Vector Knowledge Base</div>
            <div className="text-sm font-semibold text-slate-600">Rebuild Chroma after new synthetic data, uploads, or dashboard seed changes.</div>
          </div>
          <button onClick={rebuildVector} className="mt-4 w-full rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700 hover:bg-emerald-100 flex items-center justify-center gap-2">
            <RefreshCcw size={14} /> Rebuild Chroma Index
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white border border-corp-border rounded-2xl enterprise-shadow p-6">
          <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Scheduled ETL</div>
          <div className="text-2xl font-black text-corp-dark mb-2">{pipelineStatus?.enabled ? 'Enabled' : 'Disabled'}</div>
          <div className="text-sm font-semibold text-slate-600">Interval: every {pipelineStatus?.interval_minutes || 0} minutes</div>
          <div className="mt-2 text-xs font-bold text-gray-500">Next run: {pipelineStatus?.next_run_at || '-'}</div>
          <div className="mt-2 text-xs font-bold text-gray-500">Last status: {pipelineStatus?.last_status || '-'}</div>
        </div>
        <div className="bg-white border border-corp-border rounded-2xl enterprise-shadow p-6">
          <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">OCR + NLP Parsing</div>
          <div className="text-2xl font-black text-corp-dark mb-2">Active</div>
          <div className="text-sm font-semibold text-slate-600">PDF text extraction with OCR fallback and heuristic document parser.</div>
          <div className="mt-2 text-xs font-bold text-gray-500">Parser: {pipelineStatus?.nlp_parser || 'regex-heuristic-parser'}</div>
        </div>
        <div className="bg-white border border-corp-border rounded-2xl enterprise-shadow p-6">
          <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">MDM Governance</div>
          <div className="text-2xl font-black text-corp-dark mb-2">{mdmStatus?.resolution_count || 0}</div>
          <div className="text-sm font-semibold text-slate-600">Persisted entity resolutions across customers, products, and locations.</div>
          <div className="mt-2 text-xs font-bold text-gray-500">Customers: {mdmStatus?.entities?.customer || 0} | Products: {mdmStatus?.entities?.product || 0} | Locations: {mdmStatus?.entities?.location || 0}</div>
        </div>
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
          <PipelineStep icon={Fingerprint} label="Entity Res" status="Active" active={true} pulse={false} />
          <div className="flex-1 h-[2px] bg-gradient-to-r from-blue-500 to-blue-500/20 mx-4 opacity-30"></div>
          <PipelineStep icon={Database} label="DB Storage" status="Active" active={true} />
          <div className="flex-1 h-[2px] bg-gradient-to-r from-blue-500 to-blue-500/20 mx-4 opacity-30"></div>
          <PipelineStep icon={Layers} label="Vector Index" status="Active" active={true} />
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
              {(connectors.length ? connectors : [
                { source: 'erp', connector_type: 'REST API', status: 'Connected', records_ingested: 0, last_sync: '-' },
                { source: 'email', connector_type: 'EMAIL', status: 'Connected', records_ingested: 0, last_sync: '-' },
                { source: 'portal', connector_type: 'REST API', status: 'Connected', records_ingested: 0, last_sync: '-' },
                { source: 'pdf', connector_type: 'FILE SYSTEM', status: 'Connected', records_ingested: 0, last_sync: '-' },
                { source: 'excel', connector_type: 'SPREADSHEET', status: 'Connected', records_ingested: 0, last_sync: '-' },
              ]).map((c, idx) => (
                <ConnectionRow
                  key={`${c.source}-${idx}`}
                  name={c.name || `${String(c.source || c.key || 'unknown').toUpperCase()} Connector`}
                  type={c.type || c.connector_type || 'UNKNOWN'}
                  status={`● ${c.status || 'Unknown'}`}
                  time={c.last_sync || '-'}
                  volume={`${c.volume || c.records_ingested || 0} records`}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default IngestionView;
