import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LuScanFace, LuTriangleAlert, LuX, LuCircleCheck, LuRefreshCw,
} from 'react-icons/lu';
import { monitoringApi } from '../../utils/api';
import { useSocket } from '../../context/SocketContext';

const statusConfig = {
  focused:   { label: 'Focused',   color: '#ccff00', bg: 'rgba(204,255,0,0.1)',  dot: '#ccff00' },
  warning:   { label: 'Warning',   color: '#f97316', bg: 'rgba(249,115,22,0.1)', dot: '#f97316' },
  violation: { label: 'Violation', color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  dot: '#ef4444' },
};

const severityColors = { high: '#ef4444', medium: '#f97316', low: '#eab308' };

function SessionExpandedView({ session, onClose }) {
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState(null);
  const [snapshotAt, setSnapshotAt] = useState(null);
  const { socket } = useSocket();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await monitoringApi.getTimeline(session.id);
        if (!cancelled) setTimeline(data?.timeline ?? data ?? []);
      } catch {
        if (!cancelled) setTimeline([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [session.id]);

  // Subscribe to live snapshots for this session
  useEffect(() => {
    if (!socket) return;
    const onSnapshot = (data) => {
      if (data.sessionId?.toString() !== session.id?.toString()) return;
      setSnapshot(data.snapshot);
      setSnapshotAt(data.capturedAt || Date.now());
    };
    socket.on('server:session-snapshot', onSnapshot);
    return () => socket.off('server:session-snapshot', onSnapshot);
  }, [socket, session.id]);

  // Format elapsed time from a timestamp offset from session start
  const formatOffset = (ts) => {
    if (!ts || !session.startedAt) return '—';
    const diffMs = new Date(ts) - new Date(session.startedAt);
    if (diffMs < 0) return '—';
    const h = Math.floor(diffMs / 3600000).toString().padStart(2, '0');
    const m = Math.floor((diffMs % 3600000) / 60000).toString().padStart(2, '0');
    const s = Math.floor((diffMs % 60000) / 1000).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
      role="dialog"
      aria-modal="true"
      aria-label={`Session details for ${session.studentName}`}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-xl rounded-[2.5rem] p-8"
        style={{
          background: 'rgba(12,12,12,0.98)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 40px 120px rgba(0,0,0,0.7)',
        }}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-[#ebebeb]" style={{ letterSpacing: '-0.03em' }}>
              {session.studentName}
            </h2>
            <div className="tech-label" style={{ color: 'rgba(235,235,235,0.4)' }}>
              {session.examName}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 glass rounded-full flex items-center justify-center transition-colors hover:text-red-400"
            aria-label="Close session details"
          >
            <LuX size={14} aria-hidden="true" />
          </button>
        </div>

        {/* Live webcam feed */}
        <div
          className="relative rounded-2xl overflow-hidden mb-4"
          style={{
            aspectRatio: '4 / 3',
            background: 'rgba(12,12,12,0.6)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {snapshot ? (
            <img
              src={snapshot}
              alt={`Live feed from ${session.studentName}`}
              className="w-full h-full object-cover"
              draggable={false}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2" style={{ color: 'rgba(235,235,235,0.4)' }}>
              <LuScanFace size={40} aria-hidden="true" />
              <span className="tech-label" style={{ fontSize: 10 }}>WAITING FOR FEED...</span>
            </div>
          )}

          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(12,12,12,0.85)', border: '1px solid rgba(239,68,68,0.4)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: '#ef4444' }} />
            <span className="tech-label" style={{ color: '#ef4444', fontSize: 9 }}>LIVE</span>
          </div>

          {snapshotAt && (
            <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(12,12,12,0.85)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <span className="tech-label" style={{ color: 'rgba(235,235,235,0.6)', fontSize: 9 }}>
                {new Date(snapshotAt).toLocaleTimeString()}
              </span>
            </div>
          )}
        </div>

        {/* Status + time */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Status',     value: statusConfig[session.status]?.label ?? 'Unknown', color: statusConfig[session.status]?.color ?? '#ebebeb' },
            { label: 'Elapsed',    value: session.elapsed, color: '#ebebeb' },
            { label: 'Violations', value: session.violationCount, color: session.violationCount > 0 ? '#ef4444' : '#ccff00' },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl p-3 text-center"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="text-lg font-bold" style={{ color: item.color }}>{item.value}</div>
              <div className="tech-label" style={{ color: 'rgba(235,235,235,0.4)', fontSize: 9 }}>{item.label}</div>
            </div>
          ))}
        </div>

        {/* Violation timeline */}
        <div className="tech-label mb-3" style={{ color: 'rgba(235,235,235,0.4)' }}>
          VIOLATION TIMELINE
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8" style={{ color: 'rgba(235,235,235,0.4)' }}>
            <LuRefreshCw size={18} className="animate-spin mr-2" aria-hidden="true" />
            Loading timeline...
          </div>
        ) : timeline.length > 0 ? (
          <div className="flex flex-col gap-2 max-h-60 overflow-y-auto no-scrollbar">
            {timeline.map((ev, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  borderLeft: `2px solid ${severityColors[ev.severity] ?? '#eab308'}`,
                }}
              >
                <span className="tech-label shrink-0" style={{ color: 'rgba(235,235,235,0.4)' }}>
                  {formatOffset(ev.timestamp)}
                </span>
                <span className="text-sm text-[#ebebeb] capitalize">
                  {(ev.eventType || '').replace(/_/g, ' ')}
                </span>
                <span
                  className="ml-auto tech-label px-2 py-0.5 rounded-full shrink-0"
                  style={{
                    color: severityColors[ev.severity] ?? '#eab308',
                    background: `${severityColors[ev.severity] ?? '#eab308'}1a`,
                    fontSize: 9,
                  }}
                >
                  {(ev.severity || '').toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8" style={{ color: 'rgba(235,235,235,0.3)' }}>
            <LuCircleCheck size={32} className="mx-auto mb-2" style={{ color: '#ccff00' }} aria-hidden="true" />
            <div className="text-sm">No violations recorded</div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

export default function MonitoringPage() {
  const [selectedSession, setSelectedSession] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  const { socket } = useSocket();

  const normalizeSessions = useCallback((rawSessions) =>
    rawSessions.map((s) => {
      // Already normalized (e.g. from socket push)
      if (s._normalized) return s;

      const enrollment = s.examEnrollmentId;
      const student    = enrollment?.studentId;
      const exam       = enrollment?.examId;

      const elapsedMs = s.startedAt ? Date.now() - new Date(s.startedAt).getTime() : 0;
      const h   = Math.floor(elapsedMs / 3600000).toString().padStart(2, '0');
      const m   = Math.floor((elapsedMs % 3600000) / 60000).toString().padStart(2, '0');
      const sec = Math.floor((elapsedMs % 60000) / 1000).toString().padStart(2, '0');

      const violations = s.totalViolations ?? 0;
      const status =
        violations >= 5 ? 'violation' :
        violations >= 2 ? 'warning'   :
        'focused';

      return {
        _normalized:    true,
        id:             s._id,
        startedAt:      s.startedAt,
        studentName:    student?.fullName    ?? 'Unknown',
        examName:       exam?.title          ?? 'Unknown Exam',
        elapsed:        `${h}:${m}:${sec}`,
        status,
        violationCount: violations,
        faceDetected:   s.status === 'active',
      };
    }), []);

  const fetchSessions = useCallback(async () => {
    try {
      const data = await monitoringApi.getLiveSessions();
      setSessions(normalizeSessions(data?.sessions ?? data ?? []));
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [normalizeSessions]);

  // Initial load + poll every 15 seconds
  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 15000);
    return () => clearInterval(interval);
  }, [fetchSessions]);

  // Real-time session events via Socket.io
  useEffect(() => {
    if (!socket) return;

    const onViolation = (data) => {
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== data.sessionId?.toString()) return s;
          const newCount = s.violationCount + 1;
          return {
            ...s,
            violationCount: newCount,
            status: newCount >= 5 ? 'violation' : newCount >= 2 ? 'warning' : 'focused',
          };
        })
      );
    };

    const onSessionStarted = () => {
      // Refresh list when a new session starts
      fetchSessions();
    };

    const onSessionEnded = (data) => {
      setSessions((prev) => prev.filter((s) => s.id !== data.sessionId?.toString()));
    };

    const onTerminated = (data) => {
      setSessions((prev) => prev.filter((s) => s.id !== data.sessionId?.toString()));
    };

    socket.on('server:violation-alert', onViolation);
    socket.on('server:session-started', onSessionStarted);
    socket.on('server:session-ended', onSessionEnded);
    socket.on('server:session-terminated', onTerminated);

    return () => {
      socket.off('server:violation-alert', onViolation);
      socket.off('server:session-started', onSessionStarted);
      socket.off('server:session-ended', onSessionEnded);
      socket.off('server:session-terminated', onTerminated);
    };
  }, [socket, fetchSessions]);

  const hasViolations = sessions.some((s) => s.status === 'violation');

  return (
    <div className="flex flex-col gap-6">
      {/* Header + alert banner */}
      <div>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div>
            <h2 className="text-xl font-semibold text-[#ebebeb]" style={{ letterSpacing: '-0.03em' }}>
              Live Monitoring
            </h2>
            <div className="tech-label" style={{ color: 'rgba(235,235,235,0.4)' }}>
              {loading ? 'LOADING...' : `${sessions.length} ACTIVE SESSIONS`}
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full glass">
            <span className="w-2 h-2 rounded-full animate-pulse-lime" style={{ backgroundColor: '#ccff00' }} />
            <span className="tech-label" style={{ color: '#ccff00', fontSize: 9 }}>REAL-TIME</span>
          </div>
        </div>

        {/* Alert banner */}
        <AnimatePresence>
          {hasViolations && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-center gap-3 px-4 py-3 rounded-2xl mb-2"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}
              role="alert"
              aria-live="assertive"
            >
              <LuTriangleAlert size={18} style={{ color: '#f87171', flexShrink: 0 }} aria-hidden="true" />
              <span className="text-sm font-medium" style={{ color: '#f87171' }}>
                Violation threshold exceeded — {sessions.filter((s) => s.status === 'violation').length} sessions flagged
              </span>
              <span className="tech-label ml-auto" style={{ color: 'rgba(248,113,113,0.6)', fontSize: 9 }}>NOW</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Session grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16" style={{ color: 'rgba(235,235,235,0.4)' }}>
          <LuRefreshCw size={20} className="animate-spin mr-2" aria-hidden="true" />
          Loading sessions...
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-16" style={{ color: 'rgba(235,235,235,0.3)' }}>
          <LuScanFace size={40} className="mx-auto mb-3 opacity-30" aria-hidden="true" />
          <div className="text-sm">No active sessions right now.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sessions.map((session, i) => {
            const st = statusConfig[session.status] ?? statusConfig.focused;
            return (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                whileHover={{ scale: 1.02 }}
                onClick={() => setSelectedSession(session)}
                className="rounded-[2rem] p-5 cursor-pointer transition-all duration-200 flex flex-col gap-4"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  backdropFilter: 'blur(16px)',
                  border: `1px solid ${session.status === 'violation' ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.08)'}`,
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setSelectedSession(session)}
                aria-label={`View session details for ${session.studentName}`}
              >
                {/* Student info */}
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ background: 'rgba(204,255,0,0.1)', color: '#ccff00' }}
                    aria-hidden="true"
                  >
                    {session.studentName.split(' ').map((n) => n[0]).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-[#ebebeb] truncate">{session.studentName}</div>
                    <div className="text-xs truncate" style={{ color: 'rgba(235,235,235,0.5)' }}>
                      {session.examName}
                    </div>
                  </div>
                  {/* Status indicator */}
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{
                        backgroundColor: st.dot,
                        boxShadow: session.status !== 'focused' ? `0 0 6px ${st.dot}` : 'none',
                      }}
                    />
                    <span className="tech-label" style={{ color: st.color, fontSize: 9 }}>
                      {st.label.toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Face detection indicator */}
                <div
                  className="relative rounded-2xl overflow-hidden flex items-center justify-center"
                  style={{
                    height: 100,
                    background: 'rgba(12,12,12,0.6)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                  aria-label={session.faceDetected ? 'Face detected' : 'Face not detected'}
                >
                  {session.faceDetected ? (
                    <>
                      <div
                        className="w-14 h-16 rounded-xl border-2 flex items-center justify-center"
                        style={{ borderColor: 'rgba(204,255,0,0.5)', filter: 'blur(1px)' }}
                      >
                        <LuScanFace size={28} style={{ color: '#ccff00', filter: 'blur(2px)' }} aria-hidden="true" />
                      </div>
                      <div
                        className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(12,12,12,0.9)', border: '1px solid rgba(204,255,0,0.3)' }}
                      >
                        <div className="w-1 h-1 rounded-full" style={{ backgroundColor: '#ccff00' }} />
                        <span className="tech-label" style={{ color: '#ccff00', fontSize: 8 }}>DETECTED</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <LuScanFace size={28} style={{ color: 'rgba(235,235,235,0.2)' }} aria-hidden="true" />
                      <span className="tech-label" style={{ color: '#ef4444', fontSize: 9 }}>NO FACE</span>
                    </div>
                  )}
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-2 gap-2">
                  <div
                    className="rounded-xl p-2 text-center"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
                  >
                    <div className="text-sm font-mono font-medium" style={{ color: '#ebebeb' }}>
                      {session.elapsed}
                    </div>
                    <div className="tech-label" style={{ color: 'rgba(235,235,235,0.4)', fontSize: 8 }}>ELAPSED</div>
                  </div>
                  <div
                    className="rounded-xl p-2 text-center"
                    style={{
                      background: session.violationCount > 0 ? 'rgba(239,68,68,0.05)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${session.violationCount > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)'}`,
                    }}
                  >
                    <div className="text-sm font-bold" style={{ color: session.violationCount > 0 ? '#ef4444' : '#ebebeb' }}>
                      {session.violationCount}
                    </div>
                    <div className="tech-label" style={{ color: 'rgba(235,235,235,0.4)', fontSize: 8 }}>VIOLATIONS</div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Expanded session modal */}
      <AnimatePresence>
        {selectedSession && (
          <SessionExpandedView
            session={selectedSession}
            onClose={() => setSelectedSession(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
