import React, { useEffect, useMemo, useState } from 'react';
import { Building2, FileText, Ship, Database, Layers3 } from 'lucide-react';

const StatCard = ({ icon: Icon, label, value, hint }) => (
  <div className="bg-white border border-corp-border rounded-2xl enterprise-shadow p-5">
    <div className="flex items-start justify-between">
      <div>
        <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</div>
        <div className="mt-2 text-2xl font-black text-corp-dark">{value}</div>
        {hint ? <div className="mt-2 text-xs font-bold text-gray-500">{hint}</div> : null}
      </div>
      <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
        <Icon size={18} />
      </div>
    </div>
  </div>
);

const EmptyState = ({ icon: Icon, title, description }) => (
  <div className="bg-white border border-corp-border rounded-2xl enterprise-shadow p-12 text-center">
    <div className="mx-auto w-14 h-14 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mb-4">
      <Icon size={24} />
    </div>
    <h3 className="text-lg font-black text-corp-dark mb-2">{title}</h3>
    <p className="text-sm font-semibold text-gray-500">{description}</p>
  </div>
);

const MasterDataView = ({ view }) => {
  const [transactions, setTransactions] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [connectors, setConnectors] = useState([]);
  const [vectorStatus, setVectorStatus] = useState(null);
  const [storageStatus, setStorageStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');

  useEffect(() => {
    const load = async (showLoading = true) => {
      if (showLoading) setLoading(true);
      try {
        const calls = [];

        if (view === 'companies' || view === 'shipments') {
          calls.push(fetch('/erp/transactions').then((res) => (res.ok ? res.json() : [])));
        } else {
          calls.push(Promise.resolve([]));
        }

        if (view === 'shipments') {
          calls.push(fetch('/portal/shipments').then((res) => (res.ok ? res.json() : [])));
        } else {
          calls.push(Promise.resolve([]));
        }

        if (view === 'documents') {
          calls.push(fetch('/api/ingestion/connectors').then((res) => (res.ok ? res.json() : { connectors: [] })));
          calls.push(fetch('/api/vector/status').then((res) => (res.ok ? res.json() : null)));
          calls.push(fetch('/api/storage/status').then((res) => (res.ok ? res.json() : null)));
        } else {
          calls.push(Promise.resolve({ connectors: [] }));
          calls.push(Promise.resolve(null));
          calls.push(Promise.resolve(null));
        }

        const [tx, sh, connPayload, vec, storage] = await Promise.all(calls);
        setTransactions(Array.isArray(tx) ? tx : []);
        setShipments(Array.isArray(sh) ? sh : []);
        setConnectors(Array.isArray(connPayload?.connectors) ? connPayload.connectors : []);
        setVectorStatus(vec);
        setStorageStatus(storage);
        setLastUpdated(new Date().toLocaleTimeString('en-IN'));
      } catch (_error) {
        setTransactions([]);
        setShipments([]);
        setConnectors([]);
        setVectorStatus(null);
        setStorageStatus(null);
      } finally {
        if (showLoading) setLoading(false);
      }
    };

    load(true);

    const timer = setInterval(() => {
      load(false);
    }, 7000);

    return () => clearInterval(timer);
  }, [view]);

  const companies = useMemo(() => {
    const grouped = new Map();
    for (const row of transactions) {
      const key = `${row.client_name || 'Unknown'}|${row.gst_id || 'N/A'}`;
      const previous = grouped.get(key) || {
        client_name: row.client_name || 'Unknown',
        gst_id: row.gst_id || 'N/A',
        trade_types: new Set(),
        invoices: 0,
        total_value: 0,
        latest_date: row.date || '',
      };
      previous.trade_types.add((row.trade_type || 'DOMESTIC').toUpperCase());
      previous.invoices += 1;
      previous.total_value += Number(row.qty || 0) * Number(row.rate || 0);
      if ((row.date || '') > previous.latest_date) {
        previous.latest_date = row.date || previous.latest_date;
      }
      grouped.set(key, previous);
    }

    return Array.from(grouped.values())
      .map((entry) => ({
        ...entry,
        trade_types: Array.from(entry.trade_types).join(', '),
      }))
      .sort((a, b) => b.total_value - a.total_value);
  }, [transactions]);

  const shipmentRows = useMemo(() => {
    const txMap = new Map(transactions.map((row) => [row.invoice_no, row]));
    return shipments.map((row) => {
      const tx = txMap.get(row.invoice_no) || {};
      const value = Number(tx.qty || 0) * Number(tx.rate || 0);
      return {
        ...row,
        client_name: tx.client_name || 'N/A',
        item: tx.item || 'N/A',
        trade_type: (tx.trade_type || 'N/A').toUpperCase(),
        value,
      };
    });
  }, [transactions, shipments]);

  if (loading) {
    return (
      <div className="text-center py-20 text-xs font-black uppercase tracking-widest text-blue-600">
        Loading {view} data...
      </div>
    );
  }

  if (view === 'documents') {
    const connectedCount = connectors.filter((connector) => connector.status === 'Connected').length;
    const totalRecords = connectors.reduce((sum, connector) => sum + Number(connector.volume || 0), 0);
    const vectorCount = Number(vectorStatus?.count || storageStatus?.chroma?.count || 0);
    const operationalCount = Number(vectorStatus?.operational_count || storageStatus?.chroma?.operational_count || 0);

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-black text-corp-dark tracking-tight">Documents Hub</h2>
          <p className="text-sm text-gray-500 font-medium mt-1">Live status for ingested documents, connector health, and vector indexing.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <StatCard icon={FileText} label="Sources Connected" value={`${connectedCount}/${connectors.length}`} hint="ERP, Portal, PDF, Excel, Email" />
          <StatCard icon={Database} label="Indexed Records" value={new Intl.NumberFormat('en-IN').format(vectorCount)} hint={operationalCount ? `Operational records: ${new Intl.NumberFormat('en-IN').format(operationalCount)}` : 'Currently available in vector search'} />
          <StatCard icon={Layers3} label="Processed Items" value={new Intl.NumberFormat('en-IN').format(totalRecords)} hint="Total records handled by connectors" />
        </div>

        <div className="text-[11px] font-bold text-gray-500">Live sync: {lastUpdated || '-'} {vectorStatus?.rebuilt ? '| Chroma rebuilt from operational data' : ''}</div>

        <div className="bg-white border border-corp-border rounded-2xl enterprise-shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-corp-border bg-gray-50/50 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
            Connector Status
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-white text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] border-b border-corp-border">
                  <th className="px-6 py-4 text-left">Source</th>
                  <th className="px-6 py-4 text-left">Status</th>
                  <th className="px-6 py-4 text-right">Records</th>
                  <th className="px-6 py-4 text-left">Last Sync</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {connectors.length ? connectors.map((connector, idx) => (
                  <tr key={`${connector.key || connector.name || idx}`} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-6 py-4 text-sm font-bold text-corp-dark">{connector.name || String(connector.key || 'UNKNOWN').toUpperCase()}</td>
                    <td className="px-6 py-4 text-sm font-semibold">
                      <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-tight border ${connector.status === 'Connected' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                        {connector.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-black text-slate-900">{new Intl.NumberFormat('en-IN').format(Number(connector.volume || 0))}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-600">{connector.last_sync || '-'}</td>
                  </tr>
                )) : (
                  <tr><td colSpan="4" className="px-6 py-10 text-center text-sm font-semibold text-gray-400">No connector records yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border border-corp-border rounded-2xl enterprise-shadow p-5 text-sm font-semibold text-gray-600">
          <div>Storage backend: <span className="font-black text-corp-dark">{storageStatus?.backend || 'sqlite'}</span></div>
          <div className="mt-2">Vector store: <span className="font-black text-corp-dark">{vectorStatus?.collection || 'trade_knowledge_base'}</span></div>
        </div>
      </div>
    );
  }

  if (view === 'companies') {
    if (!companies.length) {
      return <EmptyState icon={Building2} title="No company records" description="Run ingestion to populate company master data." />;
    }

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-black text-corp-dark tracking-tight">Companies Master</h2>
          <p className="text-sm text-gray-500 font-medium mt-1">Unified company-level profile from ERP transaction history.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <StatCard icon={Building2} label="Companies" value={String(companies.length)} hint="Unique business partners" />
          <StatCard icon={Database} label="Total Invoices" value={new Intl.NumberFormat('en-IN').format(companies.reduce((sum, row) => sum + row.invoices, 0))} hint="Across all listed companies" />
          <StatCard icon={FileText} label="Trade Value" value={`INR ${new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(companies.reduce((sum, row) => sum + row.total_value, 0))}`} hint="Summed from invoice quantity x rate" />
        </div>

        <div className="bg-white border border-corp-border rounded-2xl enterprise-shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-corp-border bg-gray-50/50 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
            Company Records
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-white text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] border-b border-corp-border">
                  <th className="px-6 py-4 text-left">Company</th>
                  <th className="px-6 py-4 text-left">GST ID</th>
                  <th className="px-6 py-4 text-left">Trade Types</th>
                  <th className="px-6 py-4 text-right">Invoices</th>
                  <th className="px-6 py-4 text-right">Total Value</th>
                  <th className="px-6 py-4 text-left">Last Activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {companies.map((row, idx) => (
                  <tr key={`${row.client_name}-${idx}`} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-6 py-4 text-sm font-bold text-corp-dark">{row.client_name}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-600">{row.gst_id}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-600">{row.trade_types}</td>
                    <td className="px-6 py-4 text-right text-sm font-black text-slate-900">{new Intl.NumberFormat('en-IN').format(row.invoices)}</td>
                    <td className="px-6 py-4 text-right text-sm font-black text-slate-900 italic">INR {new Intl.NumberFormat('en-IN').format(Math.round(row.total_value))}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-600">{row.latest_date || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'shipments') {
    if (!shipmentRows.length) {
      return <EmptyState icon={Ship} title="No shipment records" description="No portal shipment records are available yet." />;
    }

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-black text-corp-dark tracking-tight">Shipments Master</h2>
          <p className="text-sm text-gray-500 font-medium mt-1">Operational view of shipment movement and clearance state.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <StatCard icon={Ship} label="Shipments" value={String(shipmentRows.length)} hint="Total records from portal" />
          <StatCard icon={Database} label="Pending Clearance" value={String(shipmentRows.filter((row) => String(row.clearance_status || '').toLowerCase().includes('pending') || String(row.clearance_status || '').toLowerCase().includes('awaiting')).length)} hint="Awaiting customs or inspection" />
          <StatCard icon={FileText} label="Linked Value" value={`INR ${new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(shipmentRows.reduce((sum, row) => sum + Number(row.value || 0), 0))}`} hint="Mapped from ERP transactions" />
        </div>

        <div className="bg-white border border-corp-border rounded-2xl enterprise-shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-corp-border bg-gray-50/50 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
            Shipment Records
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-white text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] border-b border-corp-border">
                  <th className="px-6 py-4 text-left">Shipment Bill</th>
                  <th className="px-6 py-4 text-left">Invoice Ref</th>
                  <th className="px-6 py-4 text-left">Company</th>
                  <th className="px-6 py-4 text-left">Port</th>
                  <th className="px-6 py-4 text-left">Clearance</th>
                  <th className="px-6 py-4 text-left">Date</th>
                  <th className="px-6 py-4 text-right">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {shipmentRows.map((row, idx) => (
                  <tr key={`${row.shipping_bill_no || row.invoice_no}-${idx}`} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-6 py-4 text-sm font-bold text-corp-dark">{row.shipping_bill_no || '-'}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-600">{row.invoice_no || '-'}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-600">{row.client_name}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-600">{row.port || '-'}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-600">{row.clearance_status || '-'}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-600">{row.clearance_date || '-'}</td>
                    <td className="px-6 py-4 text-right text-sm font-black text-slate-900 italic">INR {new Intl.NumberFormat('en-IN').format(Math.round(Number(row.value || 0)))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return <EmptyState icon={Database} title="View unavailable" description="This section is not configured yet." />;
};

export default MasterDataView;
