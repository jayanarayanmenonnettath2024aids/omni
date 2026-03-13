import React from 'react';
import { LayoutDashboard, Network, Database, FileText, Building2, Ship, Globe, Box, Bot, Microscope, PieChart, FileSearch, Settings, ChevronRight } from 'lucide-react';

const NavItem = ({ icon: Icon, label, active, onClick, badge }) => (
  <div 
    onClick={onClick}
    className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-all border-l-4 ${
      active 
        ? 'bg-white/10 text-white border-blue-500' 
        : 'text-gray-400 border-transparent hover:bg-white/5 hover:text-white'
    }`}
  >
    <Icon size={18} className={active ? 'text-blue-400' : ''} />
    <span className="text-sm font-medium flex-1">{label}</span>
    {badge && (
      <span className="bg-blue-600/20 text-blue-400 text-[10px] font-bold px-1.5 py-0.5 rounded">
        {badge}
      </span>
    )}
    {active && <ChevronRight size={14} className="text-blue-400" />}
  </div>
);

const Sidebar = ({ currentTab, setTab, userRole }) => {
  return (
    <aside className="w-64 bg-corp-navy flex flex-col h-full flex-shrink-0 z-20">
      <div className="h-14 flex items-center px-5 border-b border-gray-700 bg-[#0b1731]">
        <div className="w-6 h-6 bg-blue-500 rounded flex items-center justify-center mr-3 text-white text-xs font-bold shadow-lg shadow-blue-500/20">T</div>
        <span className="text-white font-bold text-sm tracking-wide">Trade Intelligence</span>
      </div>
      
      <div className="flex-1 overflow-y-auto py-4 custom-scrollbar">
        <div className="px-5 mb-2 text-xs font-bold text-gray-500 uppercase tracking-widest">Main</div>
        <NavItem icon={LayoutDashboard} label="Dashboard" active={currentTab === 'dashboard'} onClick={() => setTab('dashboard')} />
        <NavItem icon={Network} label="Data Ingestion" active={currentTab === 'ingestion'} onClick={() => setTab('ingestion')} />
        <NavItem icon={Database} label="ERP Data" active={currentTab === 'erp'} onClick={() => setTab('erp')} />
        <NavItem icon={FileText} label="Documents" />
        
        <div className="px-5 mb-2 mt-6 text-xs font-bold text-gray-500 uppercase tracking-widest">Master Data</div>
        <NavItem icon={Building2} label="Companies" />
        <NavItem icon={Ship} label="Shipments" />
        <NavItem icon={Globe} label="Trade Map" active={currentTab === 'map'} onClick={() => setTab('map')} />
        <NavItem icon={Box} label="Products" />
        
        <div className="px-5 mb-2 mt-6 text-xs font-bold text-gray-500 uppercase tracking-widest">Intelligence</div>
        <NavItem icon={Bot} label="AI Assistant" active={currentTab === 'ai'} onClick={() => setTab('ai')} badge="BETA" />
        {userRole === 'super' && (
          <NavItem icon={Microscope} label="Audit Control" active={currentTab === 'audit'} onClick={() => setTab('audit')} />
        )}
        <NavItem icon={PieChart} label="Trade Analytics" />
        <NavItem icon={FileSearch} label="Reports" />

        <div className="px-5 mb-2 mt-6 text-xs font-bold text-gray-500 uppercase tracking-widest">System</div>
        <NavItem icon={Settings} label="Admin Settings" />
      </div>
    </aside>
  );
};

export default Sidebar;
