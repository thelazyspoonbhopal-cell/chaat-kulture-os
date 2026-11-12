import React from 'react';
import { DevToolbar } from './DevToolbar';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { ToastContainer } from '../ui/ToastContainer';
import { TestingSandboxModal } from '../sandbox/TestingSandboxModal';

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased">
      {/* Local Development & Role Simulator Toolbar */}
      <DevToolbar />

      {/* Main Top Header */}
      <Header />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar */}
        <Sidebar />

        {/* Content View */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6 bg-slate-950">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>

      {/* Mobile Touch Bottom Nav */}
      <MobileNav />

      {/* Global Notifications */}
      <ToastContainer />

      {/* Testing Sandbox Modal */}
      <TestingSandboxModal />
    </div>
  );
};
