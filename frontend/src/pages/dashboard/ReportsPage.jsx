import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LuSearch, LuDownload, LuFileText, LuTableProperties,
  LuArrowRightLeft, LuMonitor, LuScanFace, LuUsersRound, LuTriangleAlert,
  LuX, LuCircleCheck, LuFolder, LuRefreshCw,
} from 'react-icons/lu';
import { examsApi, reportsApi } from '../../utils/api';
import { useToast } from '../../components/ui/Toast';

const severityConfig = {
  high:   { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)' },
  medium: { color: '#f97316', bg: 'rgba(249,115,22,0.1)',  border: 'rgba(249,115,22,0.3)' },
  low:    { color: '#eab308', bg: 'rgba(234,179,8,0.1)',   border: 'rgba(234,179,8,0.3)' },
};

const violationTypeIcons = {
  tab_switch:     LuArrowRightLeft,
  window_blur:    LuMonitor,
  face_absence:   LuScanFace,
  multiple_faces: LuUsersRound,
  // legacy display strings (from mock data)
  'Tab Switch':     LuArrowRightLeft,
  'Window Blur':    LuMonitor,
  'Face Absence':   LuScanFace,
  'Multiple Faces': LuUsersRound,
};

// ─── Exam Summary Modal ────────────────────────────────────────────────────────
function ExamSummaryModal({ exam, onClose }) {
  const [summary, setSummary] = useState(null);
  const [violations, setViolations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [sum, viol] = await Promise.all([
          reportsApi.getExamSummary(exam._id || exam.id),
          reportsApi.getExamViolations(exam._id || exam.id, { limit: 50 }),
        ]);
        if (!cancelled) {
          setSummary(sum);
          setViolations(viol?.violations ?? []);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load report.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [exam]);

  const handleExport = async (format) => {
    setExporting(true);
    try {
      const res = await reportsApi.exportExam(exam._id || exam.id, format);
      // res is a raw fetch Response for file downloads
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `exam-${exam.examId || exam.id}-report.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.message || 'Export failed.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
      role="dialog"
      aria-modal="true"
      aria-label={`Report for ${exam.title}`}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[2.5rem] p-8"
        style={{
          background: 'rgba(12,12,12,0.99)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 40px 120px rgba(0,0,0,0.8)',
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="tech-label mb-1" style={{ color: 'rgba(235,235,235,0.4)' }}>EXAM REPORT</div>
            <h2 className="text-xl font-bold text-[#ebebeb]" style={{ letterSpacing: '-0.04em' }}>
              {exam.title}
            </h2>
            <p className="text-sm mt-0.5" style={{ color: 'rgba(235,235,235,0.5)' }}>
              {exam.examId || exam.id}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 glass rounded-full flex items-center justify-center hover:text-red-400 transition-colors flex-shrink-0"
            aria-label="Close report"
          >
            <LuX size={14} aria-hidden="true" />
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12" style={{ color: 'rgba(235,235,235,0.4)' }}>
            <LuRefreshCw size={20} className="animate-spin mr-2" aria-hidden="true" />
            Loading report...
          </div>
        )}

        {error && (
          <div className="px-4 py-3 rounded-2xl text-sm mb-4" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
            {error}
          </div>
        )}

        {!loading && summary && (
          <>
            {/* Summary stats */}
            <div className="grid grid-cols-4 gap-3 mb-6">
              {[
                { label: 'Students',   value: summary.enrollment?.total ?? 0 },
                { label: 'Violations', value: summary.violations?.total ?? 0, danger: (summary.violations?.total ?? 0) > 10 },
                { label: 'High Sev.',  value: summary.violations?.bySeverity?.high ?? 0, danger: (summary.violations?.bySeverity?.high ?? 0) > 0 },
                { label: 'Avg / Std',  value: summary.violations?.averagePerStudent ?? 0 },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-2xl p-3 text-center"
                  style={{
                    background: s.danger ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${s.danger ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.07)'}`,
                  }}
                >
                  <div className="text-base font-bold mb-0.5" style={{ color: s.danger ? '#ef4444' : '#ebebeb', letterSpacing: '-0.02em' }}>
                    {s.value}
                  </div>
                  <div className="tech-label" style={{ color: 'rgba(235,235,235,0.4)', fontSize: 9 }}>
                    {s.label.toUpperCase()}
                  </div>
                </div>
              ))}
            </div>

            {/* Violation type breakdown */}
            {summary.violations?.byType && Object.keys(summary.violations.byType).length > 0 && (
              <div className="mb-6">
                <div className="tech-label mb-3" style={{ color: 'rgba(235,235,235,0.4)' }}>VIOLATION BREAKDOWN</div>
                <div className="flex flex-col gap-2">
                  {Object.entries(summary.violations.byType).map(([type, count]) => {
                    const VIcon = violationTypeIcons[type] ?? LuTriangleAlert;
                    return (
                      <div key={type} className="flex items-center gap-3 px-4 py-2.5 rounded-2xl"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                      >
                        <VIcon size={14} style={{ color: 'rgba(235,235,235,0.5)' }} aria-hidden="true" />
                        <span className="text-sm text-[#ebebeb] flex-1 capitalize">{type.replace(/_/g, ' ')}</span>
                        <span className="tech-label" style={{ color: '#ccff00' }}>{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recent violations list */}
            {violations.length > 0 && (
              <>
                <div className="tech-label mb-3" style={{ color: 'rgba(235,235,235,0.4)' }}>
                  RECENT VIOLATIONS — {violations.length} EVENTS
                </div>
                <div className="flex flex-col gap-2 mb-6">
                  {violations.slice(0, 20).map((v, i) => {
                    const sev = severityConfig[v.severity] || severityConfig.low;
                    const VIcon = violationTypeIcons[v.eventType] ?? LuTriangleAlert;
                    const student = v.examEnrollmentId?.studentId;
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="flex items-start gap-3 px-4 py-3 rounded-2xl"
                        style={{ background: sev.bg, border: `1px solid ${sev.border}` }}
                      >
                        <VIcon size={16} style={{ color: sev.color, flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-[#ebebeb] capitalize">
                              {(v.eventType || '').replace(/_/g, ' ')}
                            </span>
                            <span className="tech-label px-2 py-0.5 rounded-full"
                              style={{ color: sev.color, background: sev.bg, border: `1px solid ${sev.border}`, fontSize: 9 }}>
                              {(v.severity || '').toUpperCase()}
                            </span>
                            {student?.fullName && (
                              <span className="text-xs" style={{ color: 'rgba(235,235,235,0.5)' }}>
                                {student.fullName}
                              </span>
                            )}
                          </div>
                          {v.duration > 0 && (
                            <div className="tech-label mt-0.5" style={{ color: 'rgba(235,235,235,0.4)', fontSize: 9 }}>
                              Duration: {v.duration}s
                            </div>
                          )}
                        </div>
                        <span className="tech-label flex-shrink-0" style={{ color: 'rgba(235,235,235,0.35)', fontSize: 9 }}>
                          {v.timestamp ? new Date(v.timestamp).toLocaleTimeString() : ''}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
              </>
            )}

            {violations.length === 0 && (
              <div className="text-center py-8 mb-6" style={{ color: 'rgba(235,235,235,0.3)' }}>
                <LuCircleCheck size={32} className="mx-auto mb-2" style={{ color: '#ccff00' }} aria-hidden="true" />
                <div className="text-sm">No violations recorded for this exam.</div>
              </div>
            )}
          </>
        )}

        {/* Export buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => handleExport('json')}
            disabled={exporting || loading}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-medium transition-all hover:bg-white/10 disabled:opacity-50"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(235,235,235,0.7)' }}
            aria-label="Export as JSON"
          >
            <LuFileText size={15} aria-hidden="true" /> Export JSON
          </button>
          <button
            onClick={() => handleExport('csv')}
            disabled={exporting || loading}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-medium transition-all hover:bg-white/10 disabled:opacity-50"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(235,235,235,0.7)' }}
            aria-label="Export as CSV"
          >
            <LuTableProperties size={15} aria-hidden="true" /> Export CSV
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Reports Page ─────────────────────────────────────────────────────────
export default function ReportsPage() {
  const [selectedExam, setSelectedExam]   = useState(null);
  const [exams, setExams]                 = useState([]);
  const [loading, setLoading]             = useState(true);
  const [search, setSearch]               = useState('');
  const [filterStatus, setFilterStatus]   = useState('all');

  const toast = useToast();

  const fetchExams = useCallback(async () => {
    setLoading(true);
    try {
      const data = await examsApi.list({ limit: 100 });
      setExams(data?.exams ?? []);
    } catch {
      setExams([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchExams(); }, [fetchExams]);

  const statusColors = {
    active:    { color: '#ccff00',  bg: 'rgba(204,255,0,0.1)' },
    completed: { color: '#10b981',  bg: 'rgba(16,185,129,0.1)' },
    scheduled: { color: '#60a5fa',  bg: 'rgba(96,165,250,0.1)' },
    draft:     { color: 'rgba(235,235,235,0.4)', bg: 'rgba(255,255,255,0.05)' },
    cancelled: { color: '#ef4444',  bg: 'rgba(239,68,68,0.1)' },
  };

  const filtered = exams.filter((e) => {
    const matchSearch =
      e.title?.toLowerCase().includes(search.toLowerCase()) ||
      e.examId?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || e.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-semibold text-[#ebebeb]" style={{ letterSpacing: '-0.03em' }}>
            Exam Reports
          </h2>
          <div className="tech-label" style={{ color: 'rgba(235,235,235,0.4)' }}>
            {loading ? 'LOADING...' : `${filtered.length} EXAMS`}
          </div>
        </div>
        <button
          onClick={fetchExams}
          className="px-4 py-2 rounded-2xl text-sm glass transition-all hover:bg-white/10 flex items-center gap-2"
          style={{ color: 'rgba(235,235,235,0.7)' }}
          aria-label="Refresh exam list"
        >
          <LuRefreshCw size={15} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true">
            <LuSearch size={15} style={{ color: 'rgba(235,235,235,0.4)' }} />
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or exam ID..."
            className="w-full pl-9 pr-4 py-2.5 rounded-2xl text-sm text-[#ebebeb] outline-none"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              fontFamily: 'Space Grotesk, sans-serif',
            }}
            onFocus={(e) => { e.target.style.borderColor = 'rgba(204,255,0,0.4)'; }}
            onBlur={(e)  => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
            aria-label="Search reports"
          />
        </div>

        {/* Status filter */}
        {['all', 'completed', 'active', 'scheduled'].map((f) => (
          <button
            key={f}
            onClick={() => setFilterStatus(f)}
            className="px-4 py-2 rounded-full text-xs font-medium transition-all"
            style={{
              background: filterStatus === f ? '#ccff00' : 'rgba(255,255,255,0.05)',
              color:      filterStatus === f ? '#000'    : 'rgba(235,235,235,0.6)',
              border:     `1px solid ${filterStatus === f ? '#ccff00' : 'rgba(255,255,255,0.1)'}`,
            }}
            aria-pressed={filterStatus === f}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Exams table */}
      <div
        className="rounded-[2rem] overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(16px)',
        }}
        role="region"
        aria-label="Exam reports table"
      >
        {/* Table header */}
        <div
          className="hidden md:grid gap-4 px-6 py-3 border-b"
          style={{ gridTemplateColumns: '1.5fr 2.5fr 1.2fr 1fr 1fr 1fr', borderColor: 'rgba(255,255,255,0.06)' }}
        >
          {['Exam ID', 'Title', 'Date', 'Status', 'Students', 'Action'].map((h) => (
            <div key={h} className="tech-label" style={{ color: 'rgba(235,235,235,0.4)' }}>{h}</div>
          ))}
        </div>

        {/* Rows */}
        {loading ? (
          <div className="flex items-center justify-center py-16" style={{ color: 'rgba(235,235,235,0.4)' }}>
            <LuRefreshCw size={20} className="animate-spin mr-2" aria-hidden="true" />
            Loading exams...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16" style={{ color: 'rgba(235,235,235,0.3)' }}>
            <LuFolder size={40} className="mx-auto mb-3 opacity-30" aria-hidden="true" />
            <div className="text-sm">No exams match your filters.</div>
          </div>
        ) : (
          filtered.map((exam, i) => {
            const sc = statusColors[exam.status] || statusColors.draft;
            return (
              <motion.div
                key={exam._id || exam.examId}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="grid gap-4 px-6 py-4 border-b items-center hover:bg-white/[0.02] transition-colors"
                style={{ gridTemplateColumns: '1.5fr 2.5fr 1.2fr 1fr 1fr 1fr', borderColor: 'rgba(255,255,255,0.04)' }}
              >
                <span className="tech-label" style={{ color: 'rgba(235,235,235,0.5)', fontSize: 10 }}>
                  {exam.examId || '—'}
                </span>
                <span className="text-sm font-medium text-[#ebebeb]">{exam.title}</span>
                <span className="text-xs" style={{ color: 'rgba(235,235,235,0.5)' }}>
                  {exam.scheduledDate ? new Date(exam.scheduledDate).toLocaleDateString() : '—'}
                </span>
                <span
                  className="tech-label px-2 py-0.5 rounded-full w-fit"
                  style={{ color: sc.color, background: sc.bg, fontSize: 9 }}
                >
                  {(exam.status || 'draft').toUpperCase()}
                </span>
                <span className="text-sm text-[#ebebeb]">{exam.enrollmentCount ?? 0}</span>
                <button
                  onClick={() => setSelectedExam(exam)}
                  className="tech-label px-2 py-1 rounded-lg hover:bg-white/10 transition-colors w-fit"
                  style={{ color: '#ccff00', fontSize: 9 }}
                  aria-label={`View report for ${exam.title}`}
                >
                  VIEW REPORT
                </button>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Violation severity legend */}
      <div
        className="rounded-[2rem] p-5 flex items-center gap-6 flex-wrap"
        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <span className="tech-label" style={{ color: 'rgba(235,235,235,0.4)' }}>SEVERITY LEGEND</span>
        {Object.entries(severityConfig).map(([key, val]) => (
          <div key={key} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: val.color }} />
            <span className="text-xs" style={{ color: 'rgba(235,235,235,0.6)' }}>
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </span>
          </div>
        ))}
      </div>

      {/* Detail modal */}
      <AnimatePresence>
        {selectedExam && (
          <ExamSummaryModal
            exam={selectedExam}
            onClose={() => setSelectedExam(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
