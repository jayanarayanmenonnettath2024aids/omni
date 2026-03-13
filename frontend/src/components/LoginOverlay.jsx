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
  const [mode, setMode] = useState('login');
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState('domestic');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!userId.trim() || !password.trim()) {
      setError('User ID and password are required.');
      return;
    }

    if (mode === 'register' && !displayName.trim()) {
      setError('Display name is required for registration.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const payload = mode === 'login'
        ? { user_id: userId.trim(), password }
        : { user_id: userId.trim(), password, display_name: displayName.trim(), role };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.detail || 'Authentication failed');
      }

      onLogin(data);
    } catch (e) {
      setError(e.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

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
            <div className="grid grid-cols-2 gap-2 bg-white p-1 rounded-xl border border-gray-200">
              <button
                onClick={() => setMode('login')}
                className={`py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${mode === 'login' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                Login
              </button>
              <button
                onClick={() => setMode('register')}
                className={`py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${mode === 'register' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                Register
              </button>
            </div>

            <input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="User ID"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold focus:outline-none focus:border-blue-500"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold focus:outline-none focus:border-blue-500"
            />

            {mode === 'register' && (
              <>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Display Name"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold focus:outline-none focus:border-blue-500"
                />
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold focus:outline-none focus:border-blue-500"
                >
                  <option value="export">Export</option>
                  <option value="import">Import</option>
                  <option value="domestic">Domestic</option>
                  <option value="super">Super</option>
                </select>
              </>
            )}

            {error && <div className="text-xs font-bold text-red-600">{error}</div>}

            <button
              onClick={submit}
              disabled={loading}
              className="w-full py-3 rounded-xl bg-blue-600 text-white text-xs font-black uppercase tracking-widest hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>

            <div className="pt-2">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2">Quick role preview</div>
              <div className="space-y-2">
                <RoleButton role="export" label="Export Management Desk" icon={Plane} color="bg-emerald-600" onClick={(selectedRole) => onLogin({ role: selectedRole, display_name: 'Preview User' })} />
                <RoleButton role="import" label="Global Import Desk" icon={Ship} color="bg-amber-600" onClick={(selectedRole) => onLogin({ role: selectedRole, display_name: 'Preview User' })} />
                <RoleButton role="domestic" label="Domestic Logistics Hub" icon={Truck} color="bg-blue-600" onClick={(selectedRole) => onLogin({ role: selectedRole, display_name: 'Preview User' })} />
                <RoleButton role="super" label="Port Authority (Super Access)" icon={ShieldAlert} color="bg-indigo-700" onClick={(selectedRole) => onLogin({ role: selectedRole, display_name: 'Preview User' })} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginOverlay;
