import React, { useMemo } from 'react';
import CardNav from './CardNav';

const Layout = ({ children, currentTab, setTab, userRole, currentUser, onLogout }) => {
  const dashboardTitle = useMemo(() => {
    const titles = {
      dashboard: 'Trade Dashboard',
      ingestion: 'Data Ingestion',
      erp: 'ERP Data Hub',
      documents: 'Document Vault',
      companies: 'Company Ledger',
      shipments: 'Live Shipments',
      map: 'Global Trade Map',
      products: 'Product Catalog',
      ai: 'AI Assistant Terminal',
      'voice-agent': 'Live Voice Agent',
      analytics: 'Trade Analytics',
      reports: 'Enterprise Reports',
      admin: 'Admin Console',
      audit: 'Audit Control',
    };
    return titles[currentTab] || 'Trade Dashboard';
  }, [currentTab]);

  const navItems = useMemo(() => ([
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
        { label: 'Live Voice Agent', href: '#', onClick: (e) => { e.preventDefault(); setTab('voice-agent'); } },
        { label: 'Predictive Analytics', href: '#', onClick: (e) => { e.preventDefault(); setTab('analytics'); } },
        { label: 'Enterprise Reports', href: '#', onClick: (e) => { e.preventDefault(); setTab('reports'); } },
        ...(userRole === 'super' ? [{ label: 'Admin Console', href: '#', onClick: (e) => { e.preventDefault(); setTab('admin'); } }] : []),
        ...(userRole === 'super' ? [{ label: 'Audit Control', href: '#', onClick: (e) => { e.preventDefault(); setTab('audit'); } }] : []),
      ]
    }
  ]), [setTab, userRole]);

  return (
    <div className="flex h-screen bg-corp-light overflow-hidden font-sans relative">
      <CardNav 
        items={navItems} 
        logoText={dashboardTitle}
        showLogo={false}
        baseColor="#ffffff"
        menuColor="#0f172a"
        textColor="#0f172a"
        userRole={userRole}
        currentUser={currentUser}
        onLogout={onLogout}
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
