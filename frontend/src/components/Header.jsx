import React, { useState, useRef, useEffect } from 'react';
import { Search, Bell, ChevronDown, User, Settings, LogOut } from 'lucide-react';

const Header = ({ userRole }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Format the user role for display
  const getRoleDisplay = (role) => {
    switch(role?.toLowerCase()) {
      case 'super': return 'Trade Admin';
      case 'export': return 'Export Manager';
      case 'import': return 'Import Controller';
      case 'domestic': return 'Domestic Fleets';
      default: return 'Data Manager';
    }
  };

  const roleName = getRoleDisplay(userRole);

  return (
    <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-end px-6 gap-6 z-10 sticky top-0 relative">
      
      {/* Search Bar - hidden on very small screens, responsive width */}
      <div className="relative group hidden sm:block">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={16} />
        <input 
          type="text" 
          placeholder="Search shipments, invoices, clients..." 
          className="pl-10 pr-4 py-2 w-48 md:w-64 lg:w-80 bg-gray-50 border border-gray-200 rounded-full text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
        />
      </div>
      
      {/* Notification Bell */}
      <button className="relative p-2 rounded-full hover:bg-gray-50 transition-colors group flex items-center justify-center">
        <Bell size={20} className="text-gray-500 group-hover:text-gray-900 transition-colors" />
        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white ring-1 ring-red-500/50"></span>
      </button>

      {/* Trade Admin Status Box */}
      <div className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-[11px] font-bold tracking-wide shadow-sm flex-shrink-0">
        {roleName}
      </div>

      {/* User Profile Section */}
      <div className="relative flex-shrink-0" ref={dropdownRef}>
        <button 
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center gap-3 p-1 pr-2 rounded-full hover:bg-gray-50 transition-colors border border-transparent focus:outline-none focus:border-gray-200"
        >
          <div className="w-9 h-9 rounded-full bg-[#0b1731] text-white flex items-center justify-center font-bold text-sm shadow-sm ring-2 ring-white">
            JS
          </div>
          <div className="hidden md:flex flex-col items-start pr-1">
            <span className="text-sm font-bold text-gray-900 leading-tight">John Smith</span>
            <span className="text-xs text-gray-500 font-medium">{roleName}</span>
          </div>
          <ChevronDown size={14} className="text-gray-400 hidden md:block" />
        </button>

        {/* Dropdown Menu */}
        {isDropdownOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 origin-top-right z-50">
            <button className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
              <User size={16} className="text-gray-400" />
              <span className="font-medium">Profile</span>
            </button>
            <button className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
              <Settings size={16} className="text-gray-400" />
              <span className="font-medium">Settings</span>
            </button>
            <div className="h-px bg-gray-100 my-1.5 mx-2"></div>
            <button className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors group">
              <LogOut size={16} className="text-red-400 group-hover:text-red-600" />
              <span className="font-medium">Logout</span>
            </button>
          </div>
        )}
      </div>
      
    </header>
  );
};

export default Header;
