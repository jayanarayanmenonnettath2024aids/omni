import React, { useState, useEffect, useMemo } from 'react';
import { Filter, ChevronLeft, ChevronRight, MoreVertical } from 'lucide-react';

const ERPDataView = () => {
  const [activeSubTab, setActiveSubTab] = useState('transactions');
  const [transactions, setTransactions] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [tradeTypeFilter, setTradeTypeFilter] = useState('all');
  const [shipmentStatusFilter, setShipmentStatusFilter] = useState('all');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [txRes, shRes] = await Promise.all([
          fetch('/erp/transactions'),
          fetch('/portal/shipments'),
        ]);
        const [txData, shData] = await Promise.all([
          txRes.ok ? txRes.json() : [],
          shRes.ok ? shRes.json() : [],
        ]);
        setTransactions(Array.isArray(txData) ? txData : []);
        setShipments(Array.isArray(shData) ? shData : []);
      } catch (_e) {
        setTransactions([]);
        setShipments([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const customers = useMemo(() => {
    const grouped = new Map();
    for (const row of transactions) {
      const name = row.client_name || 'Unknown Customer';
      const key = `${name}|${row.gst_id || ''}`;
      const previous = grouped.get(key) || {
        client_name: name,
        gst_id: row.gst_id || 'N/A',
        category: row.category || 'General',
        invoice_count: 0,
        total_value: 0,
        latest_date: row.date || '',
      };
      const value = Number(row.qty || 0) * Number(row.rate || 0);
      previous.invoice_count += 1;
      previous.total_value += value;
      if ((row.date || '') > previous.latest_date) {
        previous.latest_date = row.date || previous.latest_date;
      }
      grouped.set(key, previous);
    }
    return Array.from(grouped.values()).sort((a, b) => b.total_value - a.total_value);
  }, [transactions]);

  const shipmentRows = useMemo(() => {
    const txMap = new Map(transactions.map((row) => [row.invoice_no, row]));
    return shipments.map((shipment) => {
      const tx = txMap.get(shipment.invoice_no) || {};
      return {
        invoice_no: shipment.invoice_no,
        shipping_bill_no: shipment.shipping_bill_no,
        client_name: tx.client_name || 'N/A',
        item: tx.item || 'N/A',
        port: shipment.port || 'N/A',
        clearance_status: shipment.clearance_status || 'N/A',
        clearance_date: shipment.clearance_date || 'N/A',
        value: Number(tx.qty || 0) * Number(tx.rate || 0),
      };
    });
  }, [shipments, transactions]);

  const tableConfig = useMemo(() => {
    if (activeSubTab === 'customers') {
      return {
        title: 'Customer Master Records',
        rows: customers,
        columns: [
          { key: 'client_name', label: 'Customer Name' },
          { key: 'gst_id', label: 'GST ID' },
          { key: 'category', label: 'Primary Category' },
          { key: 'invoice_count', label: 'Invoices' },
          { key: 'latest_date', label: 'Last Activity' },
          { key: 'total_value', label: 'Total Value (INR)', align: 'right', isMoney: true },
        ],
      };
    }

    if (activeSubTab === 'shipments') {
      return {
        title: 'Shipment Tracking Records',
        rows: shipmentRows,
        columns: [
          { key: 'shipping_bill_no', label: 'Shipping Bill' },
          { key: 'invoice_no', label: 'Invoice Ref' },
          { key: 'client_name', label: 'Business Partner' },
          { key: 'port', label: 'Port' },
          { key: 'clearance_status', label: 'Clearance Status' },
          { key: 'clearance_date', label: 'Clearance Date' },
        ],
      };
    }

    return {
      title: 'Transaction Ledger',
      rows: transactions,
      columns: [
        { key: 'invoice_no', label: 'Invoice Ref' },
        { key: 'client_name', label: 'Business Partner' },
        { key: 'category', label: 'Category', badge: true },
        { key: 'item', label: 'Item Description' },
        { key: 'date', label: 'Post Date' },
        { key: 'valuation', label: 'Valuation (INR)', align: 'right', derived: (row) => Number(row.qty || 0) * Number(row.rate || 0), isMoney: true },
      ],
    };
  }, [activeSubTab, transactions, customers, shipmentRows]);

  const filteredRows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return (tableConfig.rows || []).filter((row) => {
      if (activeSubTab === 'transactions') {
        if (tradeTypeFilter !== 'all' && String(row.trade_type || '').toUpperCase() !== tradeTypeFilter) {
          return false;
        }
        if (!q) return true;
        return [row.invoice_no, row.client_name, row.category, row.item, row.origin, row.destination]
          .some((value) => String(value || '').toLowerCase().includes(q));
      }

      if (activeSubTab === 'customers') {
        if (!q) return true;
        return [row.client_name, row.gst_id, row.category, row.trade_types]
          .some((value) => String(value || '').toLowerCase().includes(q));
      }

      if (shipmentStatusFilter !== 'all') {
        const current = String(row.clearance_status || '').toLowerCase();
        if (shipmentStatusFilter === 'pending' && !(current.includes('pending') || current.includes('awaiting'))) {
          return false;
        }
        if (shipmentStatusFilter === 'cleared' && !current.includes('clear')) {
          return false;
        }
      }
      if (!q) return true;
      return [row.shipping_bill_no, row.invoice_no, row.client_name, row.port, row.clearance_status]
        .some((value) => String(value || '').toLowerCase().includes(q));
    });
  }, [activeSubTab, tableConfig.rows, searchTerm, tradeTypeFilter, shipmentStatusFilter]);

  const formatValue = (column, row) => {
    if (column.derived) {
      return column.derived(row);
    }
    return row[column.key];
  };

  const renderCell = (column, row) => {
    const value = formatValue(column, row);
    if (column.isMoney) {
      return `INR ${Number(value || 0).toLocaleString('en-IN')}`;
    }
    return String(value ?? 'N/A');
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black text-corp-dark tracking-tight leading-none mb-3">ERP <span className="text-blue-600">Data</span> Master</h1>
          <p className="text-sm text-gray-500 font-medium">Full visibility into the persistent ERP records and shipment logs.</p>
        </div>
      </div>
      
      <div className="border-b border-corp-border mb-8 flex gap-8">
        {['transactions', 'customers', 'shipments'].map(tab => (
          <div 
            key={tab}
            className={`pb-4 cursor-pointer font-black text-xs uppercase tracking-[0.2em] transition-all border-b-2 ${
              activeSubTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-corp-dark'
            }`} 
            onClick={() => setActiveSubTab(tab)}
          >
            {tab}
          </div>
        ))}
        
        <div className="ml-auto pb-4 flex gap-3">
          <button onClick={() => setShowFilters((prev) => !prev)} className="flex items-center gap-2 border border-corp-border bg-white text-corp-dark px-4 py-1.5 rounded-xl hover:bg-corp-hover text-[10px] font-black uppercase tracking-widest transition-all">
            <Filter size={14} className="text-gray-400" /> Filter
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="mb-6 rounded-2xl border border-corp-border bg-white p-4 flex flex-wrap items-center gap-3">
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={activeSubTab === 'customers' ? 'Search customer, GST, category...' : activeSubTab === 'shipments' ? 'Search shipment, invoice, port...' : 'Search invoice, partner, item...'}
            className="min-w-[260px] flex-1 rounded-xl border border-corp-border bg-white px-3 py-2 text-xs font-semibold text-corp-dark outline-none focus:border-blue-500"
          />

          {activeSubTab === 'transactions' && (
            <select value={tradeTypeFilter} onChange={(e) => setTradeTypeFilter(e.target.value)} className="rounded-xl border border-corp-border bg-white px-3 py-2 text-xs font-bold text-corp-dark outline-none focus:border-blue-500">
              <option value="all">All Trade Types</option>
              <option value="EXPORT">Export</option>
              <option value="IMPORT">Import</option>
              <option value="DOMESTIC">Domestic</option>
            </select>
          )}

          {activeSubTab === 'shipments' && (
            <select value={shipmentStatusFilter} onChange={(e) => setShipmentStatusFilter(e.target.value)} className="rounded-xl border border-corp-border bg-white px-3 py-2 text-xs font-bold text-corp-dark outline-none focus:border-blue-500">
              <option value="all">All Status</option>
              <option value="pending">Pending / Awaiting</option>
              <option value="cleared">Cleared</option>
            </select>
          )}

          <button
            onClick={() => {
              setSearchTerm('');
              setTradeTypeFilter('all');
              setShipmentStatusFilter('all');
            }}
            className="rounded-xl border border-corp-border bg-gray-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:bg-gray-100"
          >
            Clear
          </button>
        </div>
      )}

      <div className="bg-white border border-corp-border rounded-3xl enterprise-shadow overflow-hidden group">
        <div className="px-6 py-4 border-b border-corp-border bg-gray-50/50 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
          {tableConfig.title}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/50 text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] border-b border-corp-border">
                {tableConfig.columns.map((column) => (
                  <th key={column.key} className={`px-6 py-5 ${column.align === 'right' ? 'text-right' : 'text-left'}`}>
                    {column.label}
                  </th>
                ))}
                <th className="px-6 py-5 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan="7" className="p-20 text-center text-gray-400 font-bold uppercase tracking-widest animate-pulse">Loading ERP Records...</td></tr>
              ) : filteredRows.map((row, idx) => (
                <tr key={idx} className="hover:bg-blue-50/30 transition-colors group/row cursor-pointer">
                  {tableConfig.columns.map((column) => (
                    <td key={column.key} className={`px-6 py-5 text-sm ${column.align === 'right' ? 'text-right font-black text-slate-900 italic' : 'text-slate-600 font-semibold'}`}>
                      {column.badge ? (
                        <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded-lg text-[10px] font-black uppercase tracking-tight border border-slate-200">
                          {renderCell(column, row)}
                        </span>
                      ) : (
                        renderCell(column, row)
                      )}
                    </td>
                  ))}
                  <td className="px-6 py-5 text-center">
                    <button className="p-2 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
                      <MoreVertical size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-6 border-t border-corp-border text-[10px] font-black text-gray-400 flex justify-between items-center bg-gray-50/30 uppercase tracking-widest">
          <span>Showing {filteredRows.length} of {tableConfig.rows.length} records</span>
          <div className="flex gap-2">
            <button className="w-8 h-8 flex items-center justify-center border border-corp-border rounded-xl bg-white text-gray-300 transition-all" disabled><ChevronLeft size={16} /></button>
            <button className="w-8 h-8 flex items-center justify-center border border-blue-600 rounded-xl bg-blue-50 text-blue-600 shadow-sm">1</button>
            <button className="w-8 h-8 flex items-center justify-center border border-corp-border rounded-xl bg-white text-gray-400 hover:bg-corp-hover hover:border-gray-400 transition-all">2</button>
            <button className="w-8 h-8 flex items-center justify-center border border-corp-border rounded-xl bg-white text-gray-400 hover:bg-corp-hover hover:border-gray-400 transition-all">3</button>
            <button className="w-8 h-8 flex items-center justify-center border border-corp-border rounded-xl bg-white text-gray-400 hover:bg-corp-hover hover:border-gray-400 transition-all"><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ERPDataView;
