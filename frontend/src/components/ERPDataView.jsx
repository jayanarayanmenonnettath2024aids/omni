import React, { useState, useEffect } from 'react';
import { Database, Filter, ChevronLeft, ChevronRight, MoreVertical } from 'lucide-react';

const ERPDataView = () => {
  const [activeSubTab, setActiveSubTab] = useState('transactions');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/erp/transactions')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load ERP transactions');
        return res.json();
      })
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, []);

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
          <button className="flex items-center gap-2 border border-corp-border bg-white text-corp-dark px-4 py-1.5 rounded-xl hover:bg-corp-hover text-[10px] font-black uppercase tracking-widest transition-all">
            <Filter size={14} className="text-gray-400" /> Filter
          </button>
        </div>
      </div>

      <div className="bg-white border border-corp-border rounded-3xl enterprise-shadow overflow-hidden group">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/50 text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] border-b border-corp-border">
                <th className="px-6 py-5 text-left">Invoice Ref</th>
                <th className="px-6 py-5 text-left">Business Partner</th>
                <th className="px-6 py-5 text-left">Category</th>
                <th className="px-6 py-5 text-left">Item Description</th>
                <th className="px-6 py-5 text-left">Post Date</th>
                <th className="px-6 py-5 text-right">Valuation (INR)</th>
                <th className="px-6 py-5 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan="7" className="p-20 text-center text-gray-400 font-bold uppercase tracking-widest animate-pulse">Loading ERP Records...</td></tr>
              ) : data.map((row, idx) => (
                <tr key={idx} className="hover:bg-blue-50/30 transition-colors group/row cursor-pointer">
                  <td className="px-6 py-5 font-bold text-corp-dark text-sm">{row.invoice_no}</td>
                  <td className="px-6 py-5 text-sm font-semibold text-slate-600">{row.client_name}</td>
                  <td className="px-6 py-5">
                    <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded-lg text-[10px] font-black uppercase tracking-tight border border-slate-200">
                      {row.category}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-sm text-slate-500 font-medium max-w-xs truncate">{row.item}</td>
                  <td className="px-6 py-5 text-sm text-slate-400 font-bold">{row.date}</td>
                  <td className="px-6 py-5 text-right text-sm font-black text-slate-900 italic">
                    INR {(row.qty * row.rate).toLocaleString()}
                  </td>
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
          <span>Showing {data.length} of 14,204 records</span>
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
