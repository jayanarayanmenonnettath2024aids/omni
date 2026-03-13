import React, { useState } from 'react';
import { ShoppingCart, LayoutDashboard, Building2, CheckCircle2, Package, Wine, Shirt as Tshirt, Palmtree as Mat } from 'lucide-react';

const ProductCard = ({ product, onOrder }) => {
  const Icon = product.icon;
  return (
    <div className="group relative flex flex-col bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-2xl hover:-translate-y-2 transition-all duration-500">
      <div className={`w-full aspect-[4/3] ${product.bg} flex items-center justify-center p-12 relative overflow-hidden`}>
        <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent"></div>
        <Icon size={80} className={`${product.color} relative z-10 group-hover:scale-125 transition-transform duration-700`} />
      </div>
      <div className="p-8 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-lg font-black text-slate-900 leading-tight">
              {product.name}
            </h3>
            <span className="bg-slate-100 text-slate-500 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter">In Stock</span>
          </div>
          <p className="text-xs text-slate-500 font-medium leading-relaxed mb-6 italic">{product.desc}</p>
        </div>
        <div className="flex items-center justify-between mt-auto pt-6 border-t border-slate-100">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Bulk Price</span>
            <span className="text-2xl font-black text-slate-900 leading-none">${product.price.toLocaleString()}</span>
          </div>
          <button 
            onClick={() => onOrder(product)}
            className="bg-indigo-600 text-white p-4 rounded-2xl shadow-lg shadow-indigo-600/30 hover:bg-indigo-700 hover:shadow-indigo-700/50 transition-all active:scale-95 group/btn"
          >
            <ShoppingCart size={20} className="group-hover/btn:rotate-12 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
};

const Storefront = () => {
  const [companyName, setCompanyName] = useState('TANCAM Innovations Ltd');
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const products = [
    { name: 'HydroFlask Pro (100 Pack)', price: 1500, desc: 'Stainless steel, double-walled. Corporate gifting.', icon: Package, color: 'text-indigo-400', bg: 'bg-indigo-50' },
    { name: 'ErgoChair Executive', price: 2500, desc: 'Premium ergonomic office seating for HQ.', icon: Wine, color: 'text-emerald-400', bg: 'bg-emerald-50' },
    { name: 'TerraCotton T-Shirts', price: 800, desc: 'Organic cotton, bulk 100-pack for events.', icon: Tshirt, color: 'text-amber-400', bg: 'bg-amber-50' },
    { name: 'ZenMaster Yoga Mat', price: 1000, desc: 'Premium non-slip, bulk 50-pack.', icon: Mat, color: 'text-purple-400', bg: 'bg-purple-50' },
  ];

  const handlePlaceOrder = async (product) => {
    const payload = {
      client_name: companyName || "Guest Company",
      item: product.name,
      qty: 1,
      rate: product.price
    };

    try {
      const response = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if(response.ok) {
        const data = await response.json();
        setToastMsg(`Invoice ${data.invoice_no} generated!`);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 4000);
      } else {
        alert("Error placing order.");
      }
    } catch (err) {
      console.error(err);
      alert("Server error.");
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans selection:bg-indigo-100">
      {/* Header */}
      <header className="bg-indigo-700 text-white shadow-2xl sticky top-0 z-50 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white/10 to-transparent"></div>
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-6 flex justify-between items-center relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-inner">
              <ShoppingCart className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight leading-none uppercase">OmniLogix</h1>
              <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-[0.3em]">Supply Store</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <a 
              href="/" 
              className="bg-white/10 backdrop-blur-md hover:bg-white/20 text-white flex items-center gap-2 font-black text-[10px] uppercase tracking-widest transition-all px-6 py-3 rounded-2xl border border-white/10"
            >
              <LayoutDashboard size={14} /> ERP Dashboard
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 lg:px-12 py-16">
        
        <div className="text-center mb-20 max-w-3xl mx-auto">
          <h2 className="text-6xl font-black text-slate-900 tracking-tighter mb-6 leading-[0.9]">Place a <span className="text-indigo-600">Wholesale</span> Order</h2>
          <p className="text-lg text-slate-400 font-medium leading-relaxed">
            Orders placed here will be instantly routed to the ERP system via <span className="text-slate-900 font-bold decoration-indigo-500/30 decoration-4 underline underline-offset-4">REST API integrations</span> and will appear immediately on your operational dashboard.
          </p>
        </div>

        {/* Global Order Config */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-indigo-950/5 border border-slate-100 mb-20 max-w-lg mx-auto transform hover:scale-[1.02] transition-all duration-500">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Checkout as Company</label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-300 group-focus-within:text-indigo-500 transition-colors">
              <Building2 size={20} />
            </div>
            <input 
              type="text" 
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Acme Corporation" 
              className="pl-14 pr-6 block w-full bg-slate-50 border-transparent rounded-2xl text-base font-bold text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:bg-white focus:border-indigo-500 transition-all py-4"
            />
          </div>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mt-4 flex items-center gap-2">
            <CheckCircle2 size={12} className="text-indigo-500" /> All orders will be generated under this customer profile.
          </p>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {products.map((p, idx) => (
            <ProductCard key={idx} product={p} onOrder={handlePlaceOrder} />
          ))}
        </div>
      </main>

      {/* Toast Notification */}
      <div className={`fixed bottom-10 right-10 bg-slate-900 text-white p-6 rounded-[2rem] shadow-2xl transform transition-all duration-700 flex items-center gap-6 z-[100] border border-white/10 backdrop-blur-xl ${showToast ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-20 opacity-0 scale-90 pointer-events-none'}`}>
        <div className="w-12 h-12 bg-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/40">
          <CheckCircle2 size={24} />
        </div>
        <div>
          <p className="font-black text-sm uppercase tracking-widest mb-1">Order Placed!</p>
          <p className="text-xs text-slate-400 font-bold" id="toastMsg">{toastMsg}</p>
        </div>
      </div>
    </div>
  );
};

export default Storefront;
