import React from 'react';
import { Search, Bell, ChevronDown, Menu } from 'lucide-react';

const Header = ({ userRole }) => {
  return (
    <header className="h-14 bg-white border-b border-corp-border flex items-center justify-between px-6 z-10 sticky top-0">
      <div className="flex items-center gap-6">
        <Menu size={20} className="text-corp-gray cursor-pointer hover:text-corp-dark transition-colors" />
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={16} />
          <input 
            type="text" 
            placeholder="Search shipments, invoices, clients..." 
            className="pl-10 pr-4 py-1.5 w-80 bg-corp-light border border-corp-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
          />
        </div>
      </div>
      
      <div className="flex items-center gap-6">
        <div className="flex flex-col items-end border-r border-corp-border pr-6">
          <span className="text-[10px] font-bold text-corp-gray uppercase tracking-wider">Event Countdown</span>
          <span className="text-[10px] text-blue-600 font-bold animate-pulse">14-03-2026 @ KIT</span>
        </div>
        
        <div className="flex items-center gap-3">
          <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm">KIT HACKATHON</span>
          <span className="bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold px-2 py-1 rounded">
            {userRole === 'super' ? 'Port Authority' : 'Trade Admin'}
          </span>
        </div>

        <div className="relative cursor-pointer group">
          <Bell size={20} className="text-corp-gray hover:text-corp-dark transition-colors" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white ring-1 ring-red-500/50"></span>
        </div>
        
        <div className="flex items-center gap-3 cursor-pointer pl-2 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 rounded-full bg-corp-navy text-white flex items-center justify-center font-bold text-xs shadow-sm shadow-corp-navy/20">JS</div>
          <div className="flex flex-col">
            <span className="text-xs font-bold leading-tight">John Smith</span>
            <span className="text-[10px] text-corp-gray">Fleet Manager</span>
          </div>
          <ChevronDown size={14} className="text-corp-gray" />
        </div>
      </div>
    </header>
  );
};

export default Header;
