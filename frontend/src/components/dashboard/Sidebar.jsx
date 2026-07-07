import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LuLayoutDashboard,
  LuClipboardList,
  LuUsers,
  LuRadio,
  LuChartBar,
  LuSettings,
  LuLogOut,
  LuChevronLeft,
  LuChevronRight,
} from 'react-icons/lu';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { path: '/dashboard',             label: 'Dashboard',    Icon: LuLayoutDashboard, end: true },
  { path: '/dashboard/exams',       label: 'Exams',        Icon: LuClipboardList },
  { path: '/dashboard/students',    label: 'Students',     Icon: LuUsers },
  { path: '/dashboard/monitoring',  label: 'Live Monitor', Icon: LuRadio },
  { path: '/dashboard/reports',     label: 'Reports',      Icon: LuChartBar },
  { path: '/dashboard/settings',    label: 'Settings',     Icon: LuSettings },
];

export default function Sidebar({ collapsed, setCollapsed }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 240 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="relative flex-shrink-0 h-full flex flex-col py-4 overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(24px)',
        borderRight: '1px solid rgba(255,255,255,0.08)',
      }}
      aria-label="Dashboard sidebar navigation"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 mb-8 overflow-hidden">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm text-black flex-shrink-0"
          style={{ backgroundColor: '#ccff00' }}
          aria-hidden="true"
        >
          FT
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="text-sm font-semibold text-[#ebebeb] whitespace-nowrap"
            >
              Focused Tab
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Nav links */}
      <nav className="flex flex-col gap-1 px-2 flex-1" aria-label="Main sections">
        {navItems.map(({ path, label, Icon, end }) => (
          <NavLink
            key={path}
            to={path}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm transition-all duration-200 overflow-hidden ${
                isActive ? 'text-black font-semibold' : 'hover:bg-white/5'
              }`
            }
            style={({ isActive }) => ({
              backgroundColor: isActive ? '#ccff00' : 'transparent',
              color: isActive ? '#000' : 'rgba(235,235,235,0.7)',
            })}
            aria-label={label}
            title={collapsed ? label : undefined}
          >
            <Icon size={18} className="flex-shrink-0" aria-hidden="true" />
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6 }}
                  transition={{ duration: 0.2 }}
                  className="whitespace-nowrap"
                >
                  {label}
                </motion.span>
              )}
            </AnimatePresence>
          </NavLink>
        ))}
      </nav>

      {/* Bottom: user + logout */}
      <div className="px-2 pt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        {/* User info */}
        <div className="flex items-center gap-3 px-3 py-2 mb-2 overflow-hidden">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ background: 'rgba(204,255,0,0.15)', color: '#ccff00' }}
            aria-hidden="true"
          >
            {user?.name?.slice(0, 2).toUpperCase() || 'AD'}
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="text-xs font-medium text-[#ebebeb] truncate max-w-[130px]">
                  {user?.name || 'Admin'}
                </div>
                <div className="tech-label truncate max-w-[130px]" style={{ color: 'rgba(235,235,235,0.4)', fontSize: 9 }}>
                  INSTITUTION ADMIN
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-2xl text-sm transition-all duration-200 hover:bg-red-500/10 overflow-hidden"
          style={{ color: 'rgba(235,235,235,0.5)' }}
          aria-label="Logout"
          title={collapsed ? 'Logout' : undefined}
        >
          <LuLogOut size={18} className="flex-shrink-0" aria-hidden="true" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="whitespace-nowrap"
              >
                Logout
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full mt-2 py-2 rounded-2xl text-xs transition-all hover:bg-white/5"
          style={{ color: 'rgba(235,235,235,0.3)' }}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed
            ? <LuChevronRight size={16} aria-hidden="true" />
            : <LuChevronLeft  size={16} aria-hidden="true" />
          }
        </button>
      </div>
    </motion.aside>
  );
}
