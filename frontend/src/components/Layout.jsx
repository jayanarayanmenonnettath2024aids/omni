import React from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

const Layout = ({ children, currentTab, setTab, userRole }) => {
  return (
    <div className="flex h-screen bg-corp-light overflow-hidden font-sans">
      <Sidebar currentTab={currentTab} setTab={setTab} userRole={userRole} />
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Header userRole={userRole} />
        <main className="flex-1 overflow-auto p-6 md:p-8 pt-6 custom-scrollbar">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
