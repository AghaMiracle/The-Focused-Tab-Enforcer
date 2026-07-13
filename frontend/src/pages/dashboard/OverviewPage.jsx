import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  LuClipboardList, LuRadio, LuSiren, LuUsers,
  LuTimer, LuTarget, LuCalendar,
  LuScanFace, LuArrowRightLeft, LuMonitor, LuUsersRound,
} from 'react-icons/lu';
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import StatCard from '../../components/dashboard/StatCard';
import { institutionApi } from '../../utils/api';
import { useSocket } from '../../context/SocketContext';

const severityColors = { high: '#ef4444', medium: '#f97316', low: '#eab308' };

const ViolationIcon = ({ type }) => {
  const icons = {
    face_absence:   <LuScanFace      size={16} aria-hidden="true" />,
    tab_switch:     <LuArrowRightLeft size={16} aria-hidden="true" />,
    window_blur:    <LuMonitor       size={16} aria-hidden="true" />,
    multiple_faces: <LuUsersRound    size={16} aria-hidden="true" />,
  };
  return icons[type] ?? <LuSiren size={16} aria-hidden="true" />;
};

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="px-3 py-2 rounded-xl text-xs"
      style={{
        background: 'rgba(12,12,12,0.95)',
        border: '1px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(16px)',
      }}
    >
      <div className="tech-label mb-1" style={{ color: 'rgba(235,235,235,0.5)' }}>{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {p.value}
        </div>
      ))}
    </div>
  );
}

const MAX_ALERTS = 20;

export default function OverviewPage() {
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [trend, setTrend] = useState([]);
  const [loadingTrend, setLoadingTrend] = useState(true);
  const [alerts, setAlerts] = useState([]);

  const { socket } = useSocket();

  // ── Stats ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await institutionApi.getStats();
        if (!cancelled) setStats(data);
      } catch {
        // StatCards handle null gracefully
      } finally {
        if (!cancelled) setLoadingStats(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Trend ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await institutionApi.getTrend();
        if (!cancelled) setTrend(data?.trend ?? []);
      } catch {
        if (!cancelled) setTrend([]);
      } finally {
        if (!cancelled) setLoadingTrend(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Live Alerts via Socket.io ──
  useEffect(() => {
    if (!socket) return;

    const handler = (data) => {
      setAlerts((prev) => {
        const newAlert = {
          id: data.alertId || Date.now(),
          type: data.violationType || 'unknown',
          student: data.studentName || 'Unknown',
          message: data.message || `${data.violationType} detected`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          severity: data.severity || 'medium',
        };
        return [newAlert, ...prev].slice(0, MAX_ALERTS);
      });
    };

    socket.on('server:violation-alert', handler);
    return () => socket.off('server:violation-alert', handler);
  }, [socket]);

  // Normalise backend shape → flat values for StatCard
  const totalExams       = stats?.exams?.total         ?? '—';
  const activeSessions   = stats?.sessions?.active     ?? '—';
  const violationsToday  = stats?.violations?.today    ?? '—';
  const studentsMonitored = stats?.students?.total     ?? '—';

  return (
    <div className="flex flex-col gap-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="TOTAL EXAMS"        value={totalExams}         Icon={LuClipboardList} trend={12} loading={loadingStats} />
        <StatCard label="ACTIVE SESSIONS"    value={activeSessions}     Icon={LuRadio}         highlight  trend={8}  loading={loadingStats} />
        <StatCard label="VIOLATIONS TODAY"   value={violationsToday}    Icon={LuSiren}         trend={-5} loading={loadingStats} />
        <StatCard label="STUDENTS MONITORED" value={studentsMonitored}  Icon={LuUsers}         trend={3}  loading={loadingStats} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Violation trend chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2 rounded-[2rem] p-6"
          style={{
            background: 'rgba(255,255,255,0.03)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
          aria-label="Violation trend chart"
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-semibold text-[#ebebeb] tracking-tight">Violation Trend</h3>
              <div className="tech-label" style={{ color: 'rgba(235,235,235,0.4)' }}>TODAY — HOURLY</div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 rounded" style={{ backgroundColor: '#ccff00' }} />
                <span className="tech-label" style={{ color: 'rgba(235,235,235,0.5)', fontSize: 9 }}>VIOLATIONS</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 rounded" style={{ backgroundColor: '#10b981' }} />
                <span className="tech-label" style={{ color: 'rgba(235,235,235,0.5)', fontSize: 9 }}>SESSIONS</span>
              </div>
            </div>
          </div>

          {loadingTrend ? (
            <div className="flex items-center justify-center h-[220px]" style={{ color: 'rgba(235,235,235,0.3)' }}>
              Loading...
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={trend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="limeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ccff00" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#ccff00" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="emeraldGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                <XAxis dataKey="time" tick={{ fill: 'rgba(235,235,235,0.35)', fontSize: 10, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'rgba(235,235,235,0.35)', fontSize: 10, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="violations" name="Violations" stroke="#ccff00" strokeWidth={2} fill="url(#limeGrad)" dot={false} activeDot={{ r: 4, fill: '#ccff00' }} />
                <Area type="monotone" dataKey="sessions"   name="Sessions"   stroke="#10b981" strokeWidth={2} fill="url(#emeraldGrad)" dot={false} activeDot={{ r: 4, fill: '#10b981' }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* Live activity feed via Socket.io */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-[2rem] p-6 flex flex-col"
          style={{
            background: 'rgba(255,255,255,0.03)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
          aria-label="Live activity feed"
          aria-live="polite"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[#ebebeb] tracking-tight">Live Alerts</h3>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full animate-pulse-lime" style={{ backgroundColor: '#ccff00' }} />
              <span className="tech-label" style={{ color: '#ccff00', fontSize: 9 }}>LIVE</span>
            </div>
          </div>

          <div className="flex flex-col gap-2 overflow-y-auto no-scrollbar flex-1">
            {alerts.length === 0 ? (
              <div className="flex-1 flex items-center justify-center" style={{ color: 'rgba(235,235,235,0.25)' }}>
                <span className="text-xs text-center">No alerts yet — violations<br />will appear here in real time.</span>
              </div>
            ) : (
              alerts.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-start gap-3 p-3 rounded-xl"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    borderLeft: `2px solid ${severityColors[item.severity] || 'rgba(255,255,255,0.1)'}`,
                  }}
                >
                  <span className="shrink-0 mt-0.5" style={{ color: severityColors[item.severity] || 'rgba(235,235,235,0.5)' }}>
                    <ViolationIcon type={item.type} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-[#ebebeb] truncate">{item.student}</div>
                    <div className="text-xs truncate" style={{ color: 'rgba(235,235,235,0.5)' }}>{item.message}</div>
                  </div>
                  <span className="tech-label shrink-0" style={{ color: 'rgba(235,235,235,0.35)', fontSize: 9 }}>{item.time}</span>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      </div>

      {/* Quick stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Avg Session Duration', value: stats?.sessions?.avgDurationMinutes != null ? `${Math.floor(stats.sessions.avgDurationMinutes)}m` : '—', Icon: LuTimer },
          { label: 'Detection Accuracy',   value: '99.4%',  Icon: LuTarget },
          { label: 'Exams This Week',       value: stats?.exams?.scheduled != null ? String(stats.exams.scheduled) : '—', Icon: LuCalendar },
        ].map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.07 }}
            className="rounded-[2rem] p-5 flex items-center gap-4"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <item.Icon size={24} style={{ color: '#ccff00' }} aria-hidden="true" />
            <div>
              <div className="text-xl font-bold text-[#ebebeb]" style={{ letterSpacing: '-0.03em' }}>{item.value}</div>
              <div className="tech-label" style={{ color: 'rgba(235,235,235,0.4)' }}>{item.label}</div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
