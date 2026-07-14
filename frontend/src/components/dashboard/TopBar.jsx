import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LuBell, LuChevronDown, LuLogOut, LuUser, LuBookOpen } from 'react-icons/lu';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';

export default function TopBar({ title }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { socket, connected } = useSocket();
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [activeSessions, setActiveSessions] = useState(0);

  // Listen for real-time alerts via Socket.io
  useEffect(() => {
    if (!socket) return;

    const onViolation = (data) => {
      setNotifications((prev) => {
        const item = {
          id: data.alertId || Date.now(),
          text: data.message || `${data.violationType} — ${data.studentName}`,
          time: 'Just now',
          type: data.severity === 'high' ? 'high' : 'info',
        };
        return [item, ...prev].slice(0, 10);
      });
    };

    const onHeartbeat = (data) => {
      if (data?.activeSessions != null) setActiveSessions(data.activeSessions);
    };

    socket.on('server:violation-alert', onViolation);
    socket.on('server:heartbeat', onHeartbeat);

    return () => {
      socket.off('server:violation-alert', onViolation);
      socket.off('server:heartbeat', onHeartbeat);
    };
  }, [socket]);

  const profileItems = [
    { label: 'Profile Settings', Icon: LuUser },
    { label: 'Help & Docs',      Icon: LuBookOpen },
  ];

  return (
    <header
      className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
      style={{ borderColor: 'rgba(255,255,255,0.06)' }}
      role="banner"
    >
      {/* Title */}
      <div>
        <h1 className="text-xl font-semibold text-[#ebebeb] tracking-tight" style={{ letterSpacing: '-0.03em' }}>
          {title || 'Dashboard'}
        </h1>
        <div className="tech-label" style={{ color: 'rgba(235,235,235,0.4)' }}>
          {user?.name || 'Institution Admin'}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* System status */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full glass">
          <span className="w-2 h-2 rounded-full animate-pulse-lime" style={{ backgroundColor: connected ? '#ccff00' : 'rgba(235,235,235,0.3)' }} />
          <span className="tech-label" style={{ color: 'rgba(235,235,235,0.6)' }}>
            {activeSessions > 0 ? `${activeSessions} ACTIVE` : connected ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => { setNotifOpen(!notifOpen); setProfileOpen(false); }}
            className="relative w-9 h-9 rounded-full glass flex items-center justify-center transition-all hover:border-[#ccff00]/30"
            aria-label="Notifications"
            aria-expanded={notifOpen}
            aria-haspopup="true"
          >
            <LuBell size={17} style={{ color: 'rgba(235,235,235,0.7)' }} aria-hidden="true" />
            {notifications.length > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-black flex items-center justify-center"
                style={{ backgroundColor: '#ccff00', fontSize: 9, fontWeight: 700 }}
                aria-label={`${notifications.length} unread notifications`}
              >
                {notifications.length}
              </span>
            )}
          </button>

          <AnimatePresence>
            {notifOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.2 }}
                className="absolute right-0 top-full mt-2 w-80 rounded-2xl p-3 z-50"
                style={{
                  background: 'rgba(12,12,12,0.98)',
                  backdropFilter: 'blur(24px)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                }}
                role="menu"
                aria-label="Notifications dropdown"
              >
                <div className="tech-label mb-3 px-2" style={{ color: 'rgba(235,235,235,0.4)' }}>
                  RECENT ALERTS
                </div>
                {notifications.length === 0 ? (
                  <div className="text-center py-6 text-xs" style={{ color: 'rgba(235,235,235,0.3)' }}>
                    No alerts yet — violations will<br />appear here in real time.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className="flex items-start gap-3 px-2 py-2.5 rounded-xl hover:bg-white/5 cursor-pointer transition-colors"
                      role="menuitem"
                    >
                      <div
                        className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                        style={{
                          backgroundColor:
                            n.type === 'high' ? '#ef4444' : n.type === 'success' ? '#ccff00' : '#60a5fa',
                        }}
                      />
                      <div>
                        <div className="text-xs text-[#ebebeb]">{n.text}</div>
                        <div className="tech-label mt-0.5" style={{ color: 'rgba(235,235,235,0.35)', fontSize: 9 }}>
                          {n.time}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Profile */}
        <div className="relative">
          <button
            onClick={() => { setProfileOpen(!profileOpen); setNotifOpen(false); }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full glass transition-all hover:border-white/20"
            aria-label="Profile menu"
            aria-expanded={profileOpen}
            aria-haspopup="true"
          >
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ background: 'rgba(204,255,0,0.15)', color: '#ccff00' }}
            >
              {user?.name?.slice(0, 2).toUpperCase() || 'AD'}
            </div>
            <span className="text-sm text-[#ebebeb] hidden sm:block max-w-[120px] truncate">
              {user?.name || 'Admin'}
            </span>
            <LuChevronDown size={14} style={{ color: 'rgba(235,235,235,0.4)' }} aria-hidden="true" />
          </button>

          <AnimatePresence>
            {profileOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.2 }}
                className="absolute right-0 top-full mt-2 w-48 rounded-2xl p-2 z-50"
                style={{
                  background: 'rgba(12,12,12,0.98)',
                  backdropFilter: 'blur(24px)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                }}
                role="menu"
              >
                {profileItems.map(({ label, Icon }) => (
                  <button
                    key={label}
                    className="w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-white/5 transition-colors flex items-center gap-2.5"
                    style={{ color: 'rgba(235,235,235,0.7)' }}
                    role="menuitem"
                  >
                    <Icon size={14} aria-hidden="true" />
                    {label}
                  </button>
                ))}
                <div className="border-t mt-1 pt-1" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  <button
                    onClick={() => { logout(); navigate('/'); }}
                    className="w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-red-500/10 transition-colors flex items-center gap-2.5"
                    style={{ color: '#f87171' }}
                    role="menuitem"
                  >
                    <LuLogOut size={14} aria-hidden="true" />
                    Logout
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
