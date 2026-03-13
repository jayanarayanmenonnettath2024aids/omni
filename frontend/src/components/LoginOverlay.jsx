import React, { useState, useEffect } from 'react';
import { Plane, Ship, Truck, ShieldAlert } from 'lucide-react';
import './SlidingAuth.css';

const RoleButton = ({ role, label, icon: Icon, color, onClick }) => (
  <button 
    onClick={() => onClick(role)}
    className="w-full flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-xl hover:border-blue-500 hover:bg-white/10 hover:shadow-[0_0_20px_rgba(59,130,246,0.2)] hover:scale-[1.02] transition-all group active:scale-95"
  >
    <div className={`w-12 h-12 rounded-lg ${color} text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
      <Icon size={24} />
    </div>
    <div className="text-left">
      <div className="font-bold text-white">{label}</div>
      <div className="text-[10px] text-blue-300 uppercase tracking-tight font-semibold">Terminal Access</div>
    </div>
  </button>
);

const LoginOverlay = ({ onLogin }) => {
  const [step, setStep] = useState('auth'); // 'auth' or 'role'
  const [isPanelActive, setIsPanelActive] = useState(false);
  
  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  // Load Font Awesome dynamically for the snippet
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
    document.head.appendChild(link);
    return () => document.head.removeChild(link);
  }, []);

  const handleAuthSubmit = (e) => {
    e.preventDefault();
    setStep('role');
  };

  const handleRoleSelect = (role) => {
    onLogin({ 
      role: role.toLowerCase(), 
      display_name: isPanelActive ? (name || 'New Personnel') : 'Authorized Personnel',
      user_id: 'sliding_user_123'
    });
  };

  if (step === 'auth') {
    return (
      <div className="sliding-auth-container fixed inset-0 z-[100] bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center p-5">
        <div className={`auth-wrapper ${isPanelActive ? 'panel-active' : ''}`} id="authWrapper">
            
            {/* Register Form */}
            <div className="auth-form-box register-form-box">
                <form onSubmit={handleAuthSubmit}>
                    <h1>Create Account</h1>
                    <div className="social-links">
                        <a href="#" aria-label="Facebook"><i className="fab fa-facebook-f"></i></a>
                        <a href="#" aria-label="Google"><i className="fab fa-google"></i></a>
                        <a href="#" aria-label="LinkedIn"><i className="fab fa-linkedin-in"></i></a>
                    </div>
                    <span>or use your email for registration</span>
                    <input 
                      type="text" 
                      placeholder="Full Name" 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required 
                    />
                    <input 
                      type="email" 
                      placeholder="Email Address" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required 
                    />
                    <input 
                      type="password" 
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)} 
                      required 
                    />
                    <button type="submit">Sign Up</button>
                    <div className="mobile-switch">
                        <p>Already have an account?</p>
                        <button type="button" onClick={() => setIsPanelActive(false)}>Sign In</button>
                    </div>
                </form>
            </div>

            {/* Login Form */}
            <div className="auth-form-box login-form-box">
                <form onSubmit={handleAuthSubmit}>
                    <h1>Sign In</h1>
                    <div className="social-links">
                        <a href="#" aria-label="Facebook"><i className="fab fa-facebook-f"></i></a>
                        <a href="#" aria-label="Google"><i className="fab fa-google"></i></a>
                        <a href="#" aria-label="LinkedIn"><i className="fab fa-linkedin-in"></i></a>
                    </div>
                    <span>or use your account</span>
                    <input 
                      type="email" 
                      placeholder="Email Address" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required 
                    />
                    <input 
                      type="password" 
                      placeholder="Password" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required 
                    />
                    <a href="#">Forgot your password?</a>
                    <button type="submit">Sign In</button>
                    <div className="mobile-switch">
                        <p>Don't have an account?</p>
                        <button type="button" onClick={() => setIsPanelActive(true)}>Sign Up</button>
                    </div>
                </form>
            </div>

            {/* Sliding Overlay Panels */}
            <div className="slide-panel-wrapper">
                <div className="slide-panel">
                    <div className="panel-content panel-content-left">
                        <h1>Welcome Back!</h1>
                        <p>Stay connected by logging in with your credentials and continue your experience</p>
                        <button type="button" className="transparent-btn" onClick={() => setIsPanelActive(false)}>Sign In</button>
                    </div>
                    <div className="panel-content panel-content-right">
                        <h1>Hey There!</h1>
                        <p>Begin your amazing journey by creating an account with us today</p>
                        <button type="button" className="transparent-btn" onClick={() => setIsPanelActive(true)}>Sign Up</button>
                    </div>
                </div>
            </div>
        </div>
      </div>
    );
  }

  // Role Selection Step (Kept consistent with platform design)
  return (
    <div className="fixed inset-0 z-[100] bg-corp-navy flex items-center justify-center p-4 md:p-10 animate-fade-in overflow-y-auto">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900/40 via-corp-navy to-black/80 backdrop-blur-2xl"></div>
      
      <div className="relative z-10 w-full max-w-4xl min-h-[500px] flex flex-col rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/10 animate-zoom-in bg-black/40 backdrop-blur-md p-10 md:p-16 text-center">
        
        <div className="mb-10 animate-fade-in-up">
          <div className="inline-block px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-[10px] font-black uppercase mb-6 tracking-widest">
            Identity Verified
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tighter uppercase">
            Select Terminal
          </h2>
          <p className="text-sm text-gray-400 font-medium">
            Routing verified credentials to the assigned departmental environment...
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <RoleButton role="export" label="Export Desk" icon={Plane} color="bg-emerald-600" onClick={handleRoleSelect} />
          <RoleButton role="import" label="Import Desk" icon={Ship} color="bg-amber-600" onClick={handleRoleSelect} />
          <RoleButton role="domestic" label="Domestic Hub" icon={Truck} color="bg-blue-600" onClick={handleRoleSelect} />
          <RoleButton role="super" label="Port Authority" icon={ShieldAlert} color="bg-indigo-700" onClick={handleRoleSelect} />
        </div>

        <button 
          onClick={() => setStep('auth')}
          className="mt-12 text-[10px] font-black text-gray-500 uppercase tracking-widest hover:text-blue-400 transition-colors"
        >
          ← Back to Authentication
        </button>

      </div>
    </div>
  );
};

export default LoginOverlay;


