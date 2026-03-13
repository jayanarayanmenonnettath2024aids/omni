import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, RefreshCcw, ShieldAlert, Siren, ScanSearch, Clock3 } from 'lucide-react';

const StatCard = ({ icon: Icon, label, value, hint, tone = 'blue' }) => {
  const toneMap = {
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    emerald: 'bg-emerald-50 text-emerald-600',
  };

  return (
    <div className="bg-white border border-corp-border rounded-2xl enterprise-shadow p-6">
      <div className="flex justify-between items-start gap-4">
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</div>
          <div className="mt-2 text-3xl font-black text-corp-dark">{value}</div>
          {hint ? <div className="mt-3 text-xs font-bold text-gray-500">{hint}</div> : null}
        </div>
        <div className={`p-3 rounded-xl ${toneMap[tone] || toneMap.blue}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
};

const IssueCard = ({ item, accent }) => (
  <div className={`bg-white border-l-4 ${accent} rounded-xl border-y border-r border-gray-100 p-4 shadow-sm`}>
    <div className="flex items-start justify-between gap-3 mb-2">
      <div>
        <div className="text-sm font-black text-corp-dark">{item.invoice_no || 'Unknown Invoice'}</div>
        <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-1">{item.type || 'Issue'}</div>
      </div>
      <div className={`text-[10px] font-black uppercase tracking-widest ${String(item.severity || '').toLowerCase() === 'critical' ? 'text-red-600' : String(item.severity || '').toLowerCase() === 'high' ? 'text-amber-600' : 'text-blue-600'}`}>
        {item.severity || 'Info'}
      </div>
    </div>
    <p className="text-sm font-semibold text-slate-600 leading-relaxed">{item.details}</p>
    <div className="mt-3 text-[10px] font-black uppercase tracking-widest text-gray-400">{item.location || 'N/A'}</div>
    {Array.isArray(item.involved_sources) && item.involved_sources.length ? (
      <div className="mt-3 flex flex-wrap gap-2">
        {item.involved_sources.map((src) => (
          <span key={`${item.invoice_no}-${src}`} className="px-2 py-1 rounded-lg border border-gray-200 bg-gray-50 text-[10px] font-black uppercase tracking-tight text-gray-500">
            {src}
          </span>
        ))}
      </div>
    ) : null}
  </div>
);

const AuditControlView = () => {
  const [auditData, setAuditData] = useState({ discrepancies: [], compliance_risks: [], anomalies: [], delays: [], summary: {} });
  const [loading, setLoading] = useState(true);

  const refreshAudit = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/audit/report');
      const payload = response.ok ? await response.json() : { discrepancies: [], compliance_risks: [], anomalies: [], delays: [], summary: {} };
      setAuditData(payload);
    } catch (_error) {
      setAuditData({ discrepancies: [], compliance_risks: [], anomalies: [], delays: [], summary: {} });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAudit();
  }, []);

  const priorityQueue = useMemo(() => {
    const combined = [
      ...(auditData.discrepancies || []).map((item) => ({ ...item, bucket: 'Discrepancy' })),
      ...(auditData.compliance_risks || []).map((item) => ({ ...item, bucket: 'Compliance' })),
      ...(auditData.anomalies || []).map((item) => ({ ...item, bucket: 'Anomaly' })),
    ];
    const severityRank = { Critical: 0, High: 1, Medium: 2, Low: 3 };
    return combined
      .sort((a, b) => {
        const rankA = severityRank[a.severity] ?? 9;
        const rankB = severityRank[b.severity] ?? 9;
        return rankA - rankB;
      })
      .slice(0, 8);
  }, [auditData]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-corp-dark tracking-tight leading-none mb-3">Audit <span className="text-blue-600">Control</span></h1>
          <p className="text-sm text-gray-500 font-medium">Live compliance checker and anomaly detector across ERP, portal, and document layers.</p>
        </div>
        <button
          onClick={refreshAudit}
          className="bg-blue-600 text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center gap-2"
        >
          <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} />
          Run Scan
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <StatCard icon={ScanSearch} label="Records Scanned" value={String(auditData.summary?.scanned_records || 0)} hint="Unified records evaluated" tone="blue" />
        <StatCard icon={AlertTriangle} label="Discrepancies" value={String(auditData.summary?.discrepancy_count || 0)} hint="Cross-source mismatches" tone="red" />
        <StatCard icon={ShieldAlert} label="Compliance Risks" value={String(auditData.summary?.compliance_count || 0)} hint="Tax or process violations" tone="amber" />
        <StatCard icon={Siren} label="Anomaly Signals" value={String(auditData.summary?.anomaly_count || 0)} hint="Outlier and delay signals" tone="emerald" />
        <StatCard icon={Clock3} label="Delay Flags" value={String(auditData.summary?.delay_count || 0)} hint={auditData.generated_at ? `Last scan ${auditData.generated_at.replace('T', ' ')}` : 'Shipment lag detections'} tone="blue" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-1 bg-white border border-corp-border rounded-2xl enterprise-shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-corp-border bg-gray-50/50 text-sm font-black text-corp-dark uppercase tracking-widest">Priority Queue</div>
          <div className="p-4 space-y-3">
            {priorityQueue.length ? priorityQueue.map((item, idx) => (
              <div key={`${item.bucket}-${item.invoice_no}-${idx}`} className="rounded-xl border border-gray-100 bg-gray-50/70 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-black text-corp-dark">{item.invoice_no}</div>
                  <div className="text-[10px] font-black uppercase tracking-tight text-blue-600">{item.bucket}</div>
                </div>
                <div className="mt-2 text-xs font-semibold text-slate-600">{item.type}</div>
                <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-gray-400">{item.severity || 'Info'}</div>
              </div>
            )) : (
              <div className="text-sm font-semibold text-gray-400">No issues detected.</div>
            )}
          </div>
        </div>

        <div className="xl:col-span-3 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-4">
            <div className="text-sm font-black text-red-600 uppercase tracking-widest">Data Discrepancies</div>
            {(auditData.discrepancies || []).length ? auditData.discrepancies.map((item, idx) => (
              <IssueCard key={`disc-${item.invoice_no}-${idx}`} item={item} accent="border-red-500" />
            )) : <div className="bg-white border border-corp-border rounded-xl p-6 text-sm font-semibold text-gray-400">No discrepancies found.</div>}
          </div>

          <div className="space-y-4">
            <div className="text-sm font-black text-amber-600 uppercase tracking-widest">Compliance Checker</div>
            {(auditData.compliance_risks || []).length ? auditData.compliance_risks.map((item, idx) => (
              <IssueCard key={`risk-${item.invoice_no}-${idx}`} item={item} accent="border-amber-500" />
            )) : <div className="bg-white border border-corp-border rounded-xl p-6 text-sm font-semibold text-gray-400">No compliance risks found.</div>}
          </div>

          <div className="space-y-4">
            <div className="text-sm font-black text-blue-600 uppercase tracking-widest">Anomaly Detector</div>
            {(auditData.anomalies || []).length ? auditData.anomalies.map((item, idx) => (
              <IssueCard key={`anomaly-${item.invoice_no}-${idx}`} item={item} accent="border-blue-500" />
            )) : <div className="bg-white border border-corp-border rounded-xl p-6 text-sm font-semibold text-gray-400">No anomaly signals found.</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuditControlView;
