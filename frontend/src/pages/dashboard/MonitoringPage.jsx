import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LuScanFace, LuTriangleAlert, LuX, LuCircleCheck } from 'react-icons/lu';
import { mockActiveSessions } from '../../data/mockData';
import { monitoringApi } from '../../utils/api';

const statusConfig = {
  focused: { label: 'Focused', color: '#ccff00', bg: 'rgba(204,255,0,0.1)', dot: '#ccff00' },
  warning: { label: 'Warning', color: '#f97316', bg: 'rgba(249,115,22,0.1)', dot: '#f97316' },
  violation: { label: 'Violation', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', dot: '#ef4444' },
};

function SessionExpandedView({ session, onClose }) {
  const timeline = [
    { time: '00:04:22', type: 'Tab Switch', severity: 'low' },
    { time: '00:12:15', type: 'Window Blur', severity: 'low' },
    { time: '00:23:41', type: 'Face Absence', severity: 'high' },
    { time: '00:31:08', type: 'Multiple Faces', severity: 'high' },
  ].filter(() => session.violationCount > 0);

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

        {/* Status + time */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Status', value: statusConfig[session.status].label, color: statusConfig[session.status].color },
            { label: 'Elapsed', value: session.elapsed, color: '#ebebeb' },
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
        {timeline.length > 0 ? (
          <div className="flex flex-col gap-2">
            {timeline.map((ev, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  borderLeft: `2px solid ${ev.severity === 'high' ? '#ef4444' : ev.severity === 'medium' ? '#f97316' : '#eab308'}`,
                }}
              >
                <span className="tech-label" style={{ color: 'rgba(235,235,235,0.4)' }}>{ev.time}</span>
                <span className="text-sm text-[#ebebeb]">{ev.type}</span>
                <span
                  className="ml-auto tech-label px-2 py-0.5 rounded-full"
                  style={{
                    color: ev.severity === 'high' ? '#ef4444' : ev.severity === 'medium' ? '#f97316' : '#eab308',
                    background: ev.severity === 'high' ? 'rgba(239,68,68,0.1)' : ev.severity === 'medium' ? 'rgba(249,115,22,0.1)' : 'rgba(234,179,8,0.1)',
                    fontSize: 9,
                  }}
                >
                  {ev.severity.toUpperCase()}
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

  const fetchSessions = useCallback(async () => {
    try {
      const data = await monitoringApi.getLiveSessions();
      // Backend returns an array of populated MonitoringSession docs
      setSessions(data?.sessions ?? data ?? []);
    } catch {
      // Fall back to mock data if backend is unreachable
      setSessions(mockActiveSessions);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + poll every 15 seconds for live updates
  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 15000);
    return () => clearInterval(interval);
  }, [fetchSessions]);

  // Normalise backend session shape → what the card UI expects
  const normalizeSessions = (rawSessions) =>
    rawSessions.map((s) => {
      // Handle both real backend docs and mock data
      if (s.studentName) return s; // already mock-shaped

      const enrollment = s.examEnrollmentId;
      const student    = enrollment?.studentId;
      const exam       = enrollment?.examId;

      const elapsedMs = s.startedAt ? Date.now() - new Date(s.startedAt).getTime() : 0;
      const h = Math.floor(elapsedMs / 3600000).toString().padStart(2, '0');
      const m = Math.floor((elapsedMs % 3600000) / 60000).toString().padStart(2, '0');
      const sec = Math.floor((elapsedMs % 60000) / 1000).toString().padStart(2, '0');

      const violations = s.totalViolations ?? 0;
      const status =
        violations >= 5 ? 'violation' :
        violations >= 2 ? 'warning'   :
        'focused';

      return {
        id:             s._id,
        studentName:    student?.fullName    ?? 'Unknown',
        examName:       exam?.title          ?? 'Unknown Exam',
        elapsed:        `${h}:${m}:${sec}`,
        status,
        violationCount: violations,
        faceDetected:   s.status === 'active',
      };
    });

  const normalised  = normalizeSessions(sessions);
  const hasViolations = normalised.some((s) => s.status === 'violation');

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
              {loading ? 'LOADING...' : `${normalised.length} ACTIVE SESSIONS`}
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
                Violation threshold exceeded — {normalised.filter((s) => s.status === 'violation').length} sessions flagged
              </span>
              <span className="tech-label ml-auto" style={{ color: 'rgba(248,113,113,0.6)', fontSize: 9 }}>
                NOW
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Session grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {normalised.map((session, i) => {
          const st = statusConfig[session.status];
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
                  className="w-10 h-10 rounded-2xl flex items-center justify-center text-xs font-bold flex-shrink-0"
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
                      animation: session.status === 'violation' ? 'pulse-lime 1s ease-in-out infinite' : 'none',
                    }}
                  />
                  <span className="tech-label" style={{ color: st.color, fontSize: 9 }}>
                    {st.label.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Face detection mock */}
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
                  <div
                    className="text-sm font-mono font-medium"
                    style={{ color: '#ebebeb' }}
                  >
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
                  <div
                    className="text-sm font-bold"
                    style={{ color: session.violationCount > 0 ? '#ef4444' : '#ebebeb' }}
                  >
                    {session.violationCount}
                  </div>
                  <div className="tech-label" style={{ color: 'rgba(235,235,235,0.4)', fontSize: 8 }}>VIOLATIONS</div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

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
