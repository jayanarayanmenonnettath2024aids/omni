import React from 'react';
import CardNav from './CardNav';

const Layout = ({ children, currentTab, setTab, userRole, currentUser }) => {
  const navItems = [
    {
      label: 'Operations Center',
      bgColor: '#0f172a', // corp-navy
      textColor: '#ffffff',
      links: [
        { label: 'Intelligence Dashboard', href: '#', onClick: (e) => { e.preventDefault(); setTab('dashboard'); } },
        { label: 'Data Ingestion', href: '#', onClick: (e) => { e.preventDefault(); setTab('ingestion'); } },
        { label: 'ERP Data Hub', href: '#', onClick: (e) => { e.preventDefault(); setTab('erp'); } },
        { label: 'Document Vault', href: '#', onClick: (e) => { e.preventDefault(); setTab('documents'); } },
      ]
    },
    {
      label: 'Global Assets',
      bgColor: '#2563eb', // blue-600
      textColor: '#ffffff',
      links: [
        { label: 'Company Ledger', href: '#', onClick: (e) => { e.preventDefault(); setTab('companies'); } },
        { label: 'Live Shipments', href: '#', onClick: (e) => { e.preventDefault(); setTab('shipments'); } },
        { label: 'Global Trade Map', href: '#', onClick: (e) => { e.preventDefault(); setTab('map'); } },
        { label: 'Product Catalog', href: '#', onClick: (e) => { e.preventDefault(); setTab('products'); } },
      ]
    },
    {
      label: 'Neural Insights',
      bgColor: '#059669', // emerald-600
      textColor: '#ffffff',
      links: [
        { label: 'AI Trade Assistant', href: '#', onClick: (e) => { e.preventDefault(); setTab('ai'); } },
        { label: 'Predictive Analytics', href: '#', onClick: (e) => { e.preventDefault(); setTab('analytics'); } },
        { label: 'Enterprise Reports', href: '#', onClick: (e) => { e.preventDefault(); setTab('reports'); } },
        ...(userRole === 'super' ? [{ label: 'Audit Control', href: '#', onClick: (e) => { e.preventDefault(); setTab('audit'); } }] : []),
      ]
    }
  ];

  return (
    <div className="flex h-screen bg-corp-light overflow-hidden font-sans relative">
      <CardNav 
        items={navItems} 
        logoText="OMNI"
        baseColor="#ffffff"
        menuColor="#0f172a"
        textColor="#0f172a"
        userRole={userRole}
        currentUser={currentUser}
        className="z-50 shadow-sm border-b border-corp-border/50"
      />
      
      <div className="flex-1 flex flex-col h-full overflow-hidden pt-16"> {/* PT-16 for the fixed CardNav height (64px) */}
        <main className="flex-1 overflow-auto p-6 md:p-8 pt-6 custom-scrollbar bg-slate-50">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
