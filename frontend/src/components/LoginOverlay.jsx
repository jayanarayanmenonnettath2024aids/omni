import React, { useState } from 'react';
import { Plane, Ship, Truck, ShieldAlert } from 'lucide-react';

const RoleButton = ({ role, label, icon: Icon, color, onClick }) => (
  <button 
    onClick={() => onClick(role)}
    className="w-full flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-500 hover:shadow-md hover:scale-[1.02] transition-all group active:scale-95"
  >
    <div className={`w-12 h-12 rounded-lg ${color} text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
      <Icon size={24} />
    </div>
    <div className="text-left">
      <div className="font-bold text-gray-800">{label}</div>
      <div className="text-[10px] text-gray-500 uppercase tracking-tight font-semibold">Terminal Access</div>
    </div>
  </button>
);

const LoginOverlay = ({ onLogin }) => {
  return (
    <div className="fixed inset-0 z-[100] bg-corp-navy/95 backdrop-blur-sm flex items-center justify-center p-6 transition-all duration-500">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl flex overflow-hidden border border-white/10 scale-in animate-zoom-in">
        <div className="w-5/12 bg-blue-700 p-12 text-white flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
          <div className="relative z-10">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mb-8 text-blue-700 font-extrabold text-xl shadow-xl">T</div>
            <h1 className="text-4xl font-black mb-6 leading-tight tracking-tight">Trade Intelligence Platform</h1>
            <p className="text-blue-100/80 leading-relaxed font-medium">Unified logistics monitoring with Role-Based Access Control. Select your department terminal to continue.</p>
          </div>
          <div className="text-[10px] text-blue-300 uppercase tracking-[0.2em] font-black opacity-60">KIT Hackathon Edition • TNI26184</div>
        </div>
        <div className="w-7/12 p-12 bg-gray-50 flex flex-col justify-center">
          <div className="mb-8">
            <h2 className="text-2xl font-black text-gray-900 mb-2">Access Terminal</h2>
            <p className="text-sm text-gray-500 font-medium">Authorized Personnel Only</p>
          </div>
          <div className="space-y-4">
            <RoleButton role="export" label="Export Management Desk" icon={Plane} color="bg-emerald-600" onClick={onLogin} />
            <RoleButton role="import" label="Global Import Desk" icon={Ship} color="bg-amber-600" onClick={onLogin} />
            <RoleButton role="domestic" label="Domestic Logistics Hub" icon={Truck} color="bg-blue-600" onClick={onLogin} />
            <RoleButton role="super" label="Port Authority (Super Access)" icon={ShieldAlert} color="bg-indigo-700" onClick={onLogin} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginOverlay;
