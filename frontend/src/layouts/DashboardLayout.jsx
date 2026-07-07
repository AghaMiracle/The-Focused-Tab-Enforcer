import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from '../components/dashboard/Sidebar';
import TopBar from '../components/dashboard/TopBar';

const pageTitles = {
  '/dashboard': 'Overview',
  '/dashboard/exams': 'Exams',
  '/dashboard/students': 'Students',
  '/dashboard/monitoring': 'Live Monitoring',
  '/dashboard/reports': 'Reports',
  '/dashboard/settings': 'Settings',
};

export default function DashboardLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const location = useLocation();
  const title = pageTitles[location.pathname] || 'Dashboard';

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ backgroundColor: '#000000' }}
    >
      {/* Grid bg */}
      <div className="absolute inset-0 grid-pattern opacity-20 pointer-events-none" />

      {/* Mobile sidebar backdrop */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 md:hidden"
            style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
            onClick={() => setMobileSidebarOpen(false)}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* Sidebar — desktop */}
      <div className="hidden md:flex relative z-10 h-full">
        <Sidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
      </div>

      {/* Sidebar — mobile */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <motion.div
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="fixed left-0 top-0 bottom-0 z-40 w-60 md:hidden"
          >
            <Sidebar collapsed={false} setCollapsed={() => setMobileSidebarOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 relative z-10">
        {/* Mobile hamburger in top bar */}
        <div className="md:hidden absolute top-4 left-4 z-20">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="w-9 h-9 glass rounded-xl flex items-center justify-center"
            aria-label="Open sidebar"
          >
            ☰
          </button>
        </div>

        <TopBar title={title} />

        <main className="flex-1 overflow-auto p-6" id="main-content" role="main">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="h-full"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
