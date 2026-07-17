import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LuRefreshCw, LuX, LuPlay, LuSquare, LuPencil, LuEye, LuTrash2 } from 'react-icons/lu';
import { examsApi, studentsApi } from '../../utils/api';
import { useToast } from '../../components/ui/Toast';
import { useConfirm } from '../../components/ui/ConfirmDialog';

const statusConfig = {
  active:    { label: 'Active',    color: '#ccff00',  bg: 'rgba(204,255,0,0.1)' },
  completed: { label: 'Completed', color: '#10b981',  bg: 'rgba(16,185,129,0.1)' },
  scheduled: { label: 'Scheduled', color: '#60a5fa',  bg: 'rgba(96,165,250,0.1)' },
  draft:     { label: 'Draft',     color: 'rgba(235,235,235,0.4)', bg: 'rgba(255,255,255,0.05)' },
};


// ── Create / Edit Exam Modal ──────────────────────────────────────────────────
function ExamModal({ exam, onClose }) {
  const isEdit = !!exam;
  const [formData, setFormData] = useState({
    title:                 exam?.title          || '',
    description:           exam?.description    || '',
    date:                  exam?.scheduledDate  ? new Date(exam.scheduledDate).toISOString().slice(0, 16) : '',
    duration:              exam?.durationMinutes || 60,
    allowedDomains:        (exam?.allowedDomains || []).join(', '),
    tabSwitchLimit:        exam?.violationThresholds?.tabSwitchSeconds       ?? 3,
    faceAbsenceFrames:     exam?.violationThresholds?.faceAbsenceFrames      ?? 30,
    multipleFaceTolerance: exam?.violationThresholds?.multipleFaceTolerance  ?? 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = {
        title:           formData.title,
        description:     formData.description || undefined,
        scheduledDate:   formData.date ? new Date(formData.date).toISOString() : undefined,
        durationMinutes: Number(formData.duration) || 60,
        allowedDomains:  formData.allowedDomains
          ? formData.allowedDomains.split(',').map((d) => d.trim()).filter(Boolean)
          : [],
        violationThresholds: {
          tabSwitchSeconds:      Number(formData.tabSwitchLimit)         || 3,
          faceAbsenceFrames:     Number(formData.faceAbsenceFrames)      || 30,
          multipleFaceTolerance: Number(formData.multipleFaceTolerance)  || 0,
        },
      };
      if (isEdit) {
        await examsApi.update(exam._id, payload);
      } else {
        await examsApi.create(payload);
      }
      onClose(true);
    } catch (err) {
      setError(err.message || `Failed to ${isEdit ? 'update' : 'create'} exam.`);
    } finally {
      setLoading(false);
    }
  };

  const inp = (label, id, type = 'text', extra = {}) => (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="tech-label" style={{ color: 'rgba(235,235,235,0.5)' }}>
        {label.toUpperCase()}
      </label>
      <input
        id={id} type={type}
        value={formData[id] ?? ''}
        onChange={(e) => setFormData({ ...formData, [id]: e.target.value })}
        className="w-full px-4 py-3 rounded-2xl text-sm text-[#ebebeb] outline-none"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'Space Grotesk, sans-serif' }}
        onFocus={(e) => { e.target.style.borderColor = 'rgba(204,255,0,0.5)'; }}
        onBlur={(e)  => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
        {...extra}
      />
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
      role="dialog" aria-modal="true" aria-label={isEdit ? 'Edit exam' : 'Create new exam'}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ duration: 0.3 }}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[2.5rem] p-8"
        style={{ background: 'rgba(12,12,12,0.98)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 40px 120px rgba(0,0,0,0.7)' }}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-[#ebebeb]" style={{ letterSpacing: '-0.03em' }}>
              {isEdit ? 'Edit Exam' : 'Create New Exam'}
            </h2>
            <div className="tech-label" style={{ color: 'rgba(235,235,235,0.4)' }}>EXAM CONFIGURATION</div>
          </div>
          <button onClick={() => onClose(false)}
            className="w-8 h-8 glass rounded-full flex items-center justify-center text-sm hover:text-red-400 transition-colors"
            aria-label="Close modal"><LuX size={14} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {inp('Exam Title', 'title', 'text', { placeholder: 'e.g. Advanced Mathematics Final', required: true })}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="description" className="tech-label" style={{ color: 'rgba(235,235,235,0.5)' }}>DESCRIPTION</label>
            <textarea id="description" value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2} className="w-full px-4 py-3 rounded-2xl text-sm text-[#ebebeb] outline-none resize-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'Space Grotesk, sans-serif' }}
              onFocus={(e) => { e.target.style.borderColor = 'rgba(204,255,0,0.5)'; }}
              onBlur={(e)  => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {inp('Date & Time', 'date', 'datetime-local')}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="duration" className="tech-label" style={{ color: 'rgba(235,235,235,0.5)' }}>DURATION (MINUTES)</label>
              <input id="duration" type="number" min={15} max={360} value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                className="w-full px-4 py-3 rounded-2xl text-sm text-[#ebebeb] outline-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'Space Grotesk, sans-serif' }}
                onFocus={(e) => { e.target.style.borderColor = 'rgba(204,255,0,0.5)'; }}
                onBlur={(e)  => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
              />
            </div>
          </div>

          {inp('Allowed Domains (comma-separated)', 'allowedDomains', 'text', { placeholder: 'exam.university.edu, lms.uni.edu' })}

          <div className="rounded-2xl p-4 flex flex-col gap-4"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="tech-label" style={{ color: 'rgba(235,235,235,0.5)' }}>VIOLATION THRESHOLDS</div>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Tab Switch (count)',        id: 'tabSwitchLimit' },
                { label: 'Face Absence (frames)',     id: 'faceAbsenceFrames' },
                { label: 'Multiple Faces (tolerance)', id: 'multipleFaceTolerance' },
              ].map((f) => (
                <div key={f.id} className="flex flex-col gap-1.5">
                  <label htmlFor={f.id} className="tech-label" style={{ color: 'rgba(235,235,235,0.4)', fontSize: 9 }}>
                    {f.label.toUpperCase()}
                  </label>
                  <input id={f.id} type="number" min={0} value={formData[f.id]}
                    onChange={(e) => setFormData({ ...formData, [f.id]: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl text-sm text-[#ebebeb] outline-none"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', fontFamily: 'Space Grotesk, sans-serif' }}
                    onFocus={(e) => { e.target.style.borderColor = 'rgba(204,255,0,0.5)'; }}
                    onBlur={(e)  => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                  />
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="px-4 py-3 rounded-2xl text-sm"
              style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
              role="alert">{error}</div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => onClose(false)}
              className="flex-1 py-3 rounded-2xl text-sm font-medium transition-all hover:bg-white/5"
              style={{ color: 'rgba(235,235,235,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}>
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-3 rounded-2xl text-sm font-semibold text-black flex items-center justify-center gap-2 disabled:opacity-60 transition-all hover:scale-[1.02]"
              style={{ backgroundColor: '#ccff00' }} aria-label={isEdit ? 'Save changes' : 'Create exam'}>
              {loading && <LuRefreshCw size={14} className="animate-spin" aria-hidden="true" />}
              {loading ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Exam'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ── View Exam Modal ────────────────────────────────────────────────────────────
function ViewExamModal({ exam, onClose, onStatusChange }) {
  const [enrolledStudents, setEnrolledStudents] = useState([]);
  const [loadingStudents, setLoadingStudents]   = useState(true);
  const [actionLoading, setActionLoading]       = useState('');
  const [error, setError]                       = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await examsApi.getStudents(exam._id);
        if (!cancelled) setEnrolledStudents(data?.enrollments ?? []);
      } catch {
        if (!cancelled) setEnrolledStudents([]);
      } finally {
        if (!cancelled) setLoadingStudents(false);
      }
    })();
    return () => { cancelled = true; };
  }, [exam._id]);

  const handleStart = async () => {
    setActionLoading('start');
    setError('');
    try {
      await examsApi.start(exam._id);
      onStatusChange();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to start exam.');
    } finally {
      setActionLoading('');
    }
  };

  const handleEnd = async () => {
    setActionLoading('end');
    setError('');
    try {
      await examsApi.end(exam._id);
      onStatusChange();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to end exam.');
    } finally {
      setActionLoading('');
    }
  };

  const st = statusConfig[exam.status] || statusConfig.draft;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
      role="dialog" aria-modal="true" aria-label={`View exam: ${exam.title}`}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ duration: 0.3 }}
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-[2.5rem] p-8"
        style={{ background: 'rgba(12,12,12,0.98)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 40px 120px rgba(0,0,0,0.7)' }}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="tech-label mb-1" style={{ color: 'rgba(235,235,235,0.4)' }}>
              {exam.examId || exam._id}
            </div>
            <h2 className="text-xl font-semibold text-[#ebebeb]" style={{ letterSpacing: '-0.03em' }}>
              {exam.title}
            </h2>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 glass rounded-full flex items-center justify-center hover:text-red-400 transition-colors"
            aria-label="Close"><LuX size={14} /></button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Status',   value: st.label, color: st.color },
            { label: 'Duration', value: `${exam.durationMinutes}m`, color: '#ebebeb' },
            { label: 'Students', value: exam.enrollmentCount ?? enrolledStudents.length, color: '#ebebeb' },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl p-3 text-center"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="text-base font-bold" style={{ color: s.color }}>{s.value}</div>
              <div className="tech-label" style={{ color: 'rgba(235,235,235,0.4)', fontSize: 9 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Details */}
        {exam.description && (
          <p className="text-sm mb-4" style={{ color: 'rgba(235,235,235,0.6)' }}>{exam.description}</p>
        )}
        {exam.scheduledDate && (
          <div className="tech-label mb-4" style={{ color: 'rgba(235,235,235,0.4)' }}>
            SCHEDULED: {new Date(exam.scheduledDate).toLocaleString()}
          </div>
        )}

        {/* Enrolled students */}
        <div className="tech-label mb-3" style={{ color: 'rgba(235,235,235,0.4)' }}>ENROLLED STUDENTS</div>
        {loadingStudents ? (
          <div className="flex items-center justify-center py-6" style={{ color: 'rgba(235,235,235,0.4)' }}>
            <LuRefreshCw size={16} className="animate-spin mr-2" />Loading...
          </div>
        ) : enrolledStudents.length === 0 ? (
          <div className="text-center py-6 text-sm mb-4" style={{ color: 'rgba(235,235,235,0.3)' }}>
            No students enrolled yet.
          </div>
        ) : (
          <div className="flex flex-col gap-2 mb-6 max-h-48 overflow-y-auto no-scrollbar">
            {enrolledStudents.map((en) => {
              const s = en.studentId;
              return (
                <div key={en._id} className="flex items-center gap-3 px-3 py-2 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ background: 'rgba(204,255,0,0.1)', color: '#ccff00' }}>
                    {s?.fullName?.split(' ').map((n) => n[0]).join('').slice(0, 2) || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[#ebebeb] truncate">{s?.fullName || '—'}</div>
                    <div className="text-xs truncate" style={{ color: 'rgba(235,235,235,0.4)' }}>{s?.email}</div>
                  </div>
                  <span className="tech-label shrink-0" style={{ color: 'rgba(235,235,235,0.3)', fontSize: 9 }}>
                    {en.enrollmentStatus}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {error && (
          <div className="px-4 py-3 rounded-2xl text-sm mb-4"
            style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
            role="alert">{error}</div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {['draft', 'scheduled'].includes(exam.status) && (
            <button onClick={handleStart} disabled={actionLoading === 'start'}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold text-black disabled:opacity-60"
              style={{ backgroundColor: '#ccff00' }} aria-label="Start exam">
              {actionLoading === 'start' ? <LuRefreshCw size={14} className="animate-spin" /> : <LuPlay size={14} />}
              {actionLoading === 'start' ? 'Starting...' : 'Start Exam'}
            </button>
          )}
          {exam.status === 'active' && (
            <button onClick={handleEnd} disabled={actionLoading === 'end'}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold disabled:opacity-60"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}
              aria-label="End exam">
              {actionLoading === 'end' ? <LuRefreshCw size={14} className="animate-spin" /> : <LuSquare size={14} />}
              {actionLoading === 'end' ? 'Ending...' : 'End Exam'}
            </button>
          )}
          <button onClick={onClose}
            className="flex-1 py-3 rounded-2xl text-sm font-medium hover:bg-white/5 transition-all"
            style={{ color: 'rgba(235,235,235,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}>
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Enroll Students Modal ──────────────────────────────────────────────────────
function EnrollModal({ exam, onClose }) {
  const [allStudents, setAllStudents] = useState([]);
  const [search, setSearch]           = useState('');
  const [selected, setSelected]       = useState(new Set());
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await studentsApi.list({ limit: 200 });
        if (!cancelled) setAllStudents(data?.students ?? []);
      } catch {
        if (!cancelled) setAllStudents([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = allStudents.filter((s) => {
    const q = search.toLowerCase();
    return s.fullName?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q) || s.registrationNumber?.toLowerCase().includes(q);
  });

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    if (selected.size === 0) { setError('Select at least one student.'); return; }
    setSaving(true);
    setError('');
    try {
      await examsApi.enrollStudents(exam._id, [...selected]);
      onClose(true);
    } catch (err) {
      setError(err.message || 'Enrollment failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
      role="dialog" aria-modal="true" aria-label="Enroll students"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ duration: 0.3 }}
        className="w-full max-w-lg rounded-[2.5rem] p-8"
        style={{ background: 'rgba(12,12,12,0.98)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 40px 120px rgba(0,0,0,0.7)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-[#ebebeb]" style={{ letterSpacing: '-0.03em' }}>Enroll Students</h2>
            <div className="tech-label" style={{ color: 'rgba(235,235,235,0.4)' }}>{exam.title}</div>
          </div>
          <button onClick={() => onClose(false)} className="w-8 h-8 glass rounded-full flex items-center justify-center hover:text-red-400 transition-colors" aria-label="Close">
            <LuX size={14} />
          </button>
        </div>

        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search students..."
          className="w-full px-4 py-2.5 rounded-2xl text-sm text-[#ebebeb] outline-none mb-3"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'Space Grotesk, sans-serif' }}
          onFocus={(e) => { e.target.style.borderColor = 'rgba(204,255,0,0.4)'; }}
          onBlur={(e)  => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
        />

        <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto no-scrollbar mb-4">
          {loading ? (
            <div className="flex items-center justify-center py-6" style={{ color: 'rgba(235,235,235,0.4)' }}>
              <LuRefreshCw size={16} className="animate-spin mr-2" />Loading students...
            </div>
          ) : filtered.map((s) => (
            <button key={s._id} onClick={() => toggle(s._id)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
              style={{
                background: selected.has(s._id) ? 'rgba(204,255,0,0.08)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${selected.has(s._id) ? 'rgba(204,255,0,0.3)' : 'rgba(255,255,255,0.06)'}`,
              }}
            >
              <div className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: selected.has(s._id) ? '#ccff00' : 'rgba(255,255,255,0.2)' }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[#ebebeb] truncate">{s.fullName}</div>
                <div className="text-xs truncate" style={{ color: 'rgba(235,235,235,0.4)' }}>{s.email}</div>
              </div>
              <span className="tech-label shrink-0" style={{ color: 'rgba(235,235,235,0.3)', fontSize: 9 }}>
                {s.registrationNumber}
              </span>
            </button>
          ))}
        </div>

        <div className="tech-label mb-3" style={{ color: selected.size > 0 ? '#ccff00' : 'rgba(235,235,235,0.3)' }}>
          {selected.size} STUDENT{selected.size !== 1 ? 'S' : ''} SELECTED
        </div>

        {error && (
          <div className="px-4 py-3 rounded-2xl text-sm mb-3"
            style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
            role="alert">{error}</div>
        )}

        <div className="flex gap-3">
          <button onClick={() => onClose(false)}
            className="flex-1 py-3 rounded-2xl text-sm font-medium hover:bg-white/5 transition-all"
            style={{ color: 'rgba(235,235,235,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-3 rounded-2xl text-sm font-semibold text-black flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ backgroundColor: '#ccff00' }} aria-label="Enroll selected students">
            {saving && <LuRefreshCw size={14} className="animate-spin" />}
            {saving ? 'Enrolling...' : `Enroll ${selected.size > 0 ? selected.size : ''} Student${selected.size !== 1 ? 's' : ''}`}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Main Exams Page ────────────────────────────────────────────────────────────
export default function ExamsPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editExam, setEditExam]               = useState(null);
  const [viewExam, setViewExam]               = useState(null);
  const [enrollExam, setEnrollExam]           = useState(null);
  const [filter, setFilter]                   = useState('all');
  const [exams, setExams]                     = useState([]);
  const [loading, setLoading]                 = useState(true);
  const [error, setError]                     = useState('');

  const toast = useToast();
  const confirm = useConfirm();

  const fetchExams = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await examsApi.list({ status: filter === 'all' ? undefined : filter });
      setExams(data?.exams ?? []);
    } catch (err) {
      setError(err.message || 'Failed to load exams.');
      setExams([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchExams(); }, [fetchExams]);

  const handleDeleteExam = async (exam) => {
    const ok = await confirm({
      title: 'Delete exam?',
      message: `Delete "${exam.title}"? This action cannot be undone for active exams.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await examsApi.delete(exam._id);
      fetchExams();
    } catch (err) {
      toast.error(err.message || 'Failed to delete exam.');
    }
  };

  const normalizeExam = (e) => ({
    ...e,
    id:       e.examId || e._id,
    title:    e.title,
    date:     e.scheduledDate ? new Date(e.scheduledDate).toLocaleString() : '—',
    status:   e.status || 'draft',
    students: e.enrollmentCount ?? 0,
    duration: e.durationMinutes,
    _id:      e._id,
  });

  const filtered = exams.map(normalizeExam);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-semibold text-[#ebebeb]" style={{ letterSpacing: '-0.03em' }}>
            Exam Management
          </h2>
          <div className="tech-label" style={{ color: 'rgba(235,235,235,0.4)' }}>
            {loading ? 'LOADING...' : `${filtered.length} EXAMS`}
          </div>
        </div>
        <motion.button
          onClick={() => setShowCreateModal(true)}
          whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
          className="px-5 py-2.5 rounded-2xl text-sm font-semibold text-black flex items-center gap-2"
          style={{ backgroundColor: '#ccff00' }}
          aria-label="Create new exam">
          + Create New Exam
        </motion.button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'active', 'scheduled', 'draft', 'completed'].map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className="px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200"
            style={{
              background: filter === f ? '#ccff00' : 'rgba(255,255,255,0.05)',
              color:      filter === f ? '#000'    : 'rgba(235,235,235,0.6)',
              border:     `1px solid ${filter === f ? '#ccff00' : 'rgba(255,255,255,0.1)'}`,
            }}
            aria-pressed={filter === f}>{f.charAt(0).toUpperCase() + f.slice(1)}</button>
        ))}
      </div>

      {error && (
        <div className="px-4 py-3 rounded-2xl text-sm"
          style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
          role="alert">{error}</div>
      )}

      {/* Table */}
      <div className="rounded-[2rem] overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
        role="region" aria-label="Exams table"
      >
        {/* Header row */}
        <div className="hidden md:grid gap-4 px-6 py-3 border-b"
          style={{ gridTemplateColumns: '1.2fr 2fr 1.2fr 1fr 0.8fr 1.4fr', borderColor: 'rgba(255,255,255,0.06)' }}>
          {['Exam ID', 'Title', 'Date', 'Status', 'Students', 'Actions'].map((h) => (
            <div key={h} className="tech-label" style={{ color: 'rgba(235,235,235,0.4)' }}>{h}</div>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16" style={{ color: 'rgba(235,235,235,0.4)' }}>
            <LuRefreshCw size={20} className="animate-spin mr-2" aria-hidden="true" />
            Loading exams...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-sm" style={{ color: 'rgba(235,235,235,0.3)' }}>
            No exams found.
          </div>
        ) : filtered.map((exam, i) => {
          const st = statusConfig[exam.status] || statusConfig.draft;
          const canEdit = ['draft', 'scheduled'].includes(exam.status);
          return (
            <motion.div key={exam.id}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="grid gap-4 px-6 py-4 border-b items-center hover:bg-white/[0.02] transition-colors"
              style={{ gridTemplateColumns: '1.2fr 2fr 1.2fr 1fr 0.8fr 1.4fr', borderColor: 'rgba(255,255,255,0.04)' }}
            >
              <span className="tech-label" style={{ color: 'rgba(235,235,235,0.5)', fontSize: 10 }}>{exam.id}</span>
              <span className="text-sm font-medium text-[#ebebeb]">{exam.title}</span>
              <span className="text-xs" style={{ color: 'rgba(235,235,235,0.5)' }}>{exam.date}</span>
              <span className="tech-label px-2 py-1 rounded-full w-fit"
                style={{ color: st.color, background: st.bg, fontSize: 9 }}>{st.label}</span>
              <span className="text-sm text-[#ebebeb]">{exam.students}</span>
              <div className="flex gap-1.5 flex-wrap">
                <button onClick={() => setViewExam(exam)}
                  className="tech-label px-2 py-1 rounded-lg transition-colors hover:bg-white/10 flex items-center gap-1"
                  style={{ color: '#ccff00', fontSize: 9 }} aria-label={`View ${exam.title}`}>
                  <LuEye size={10} />VIEW
                </button>
                {canEdit && (
                  <button onClick={() => setEditExam(exam)}
                    className="tech-label px-2 py-1 rounded-lg transition-colors hover:bg-white/10 flex items-center gap-1"
                    style={{ color: 'rgba(235,235,235,0.5)', fontSize: 9 }} aria-label={`Edit ${exam.title}`}>
                    <LuPencil size={10} />EDIT
                  </button>
                )}
                {canEdit && (
                  <button onClick={() => setEnrollExam(exam)}
                    className="tech-label px-2 py-1 rounded-lg transition-colors hover:bg-white/10"
                    style={{ color: 'rgba(96,165,250,0.9)', fontSize: 9 }} aria-label={`Enroll students in ${exam.title}`}>
                    +ENROLL
                  </button>
                )}
                {exam.status !== 'active' && (
                  <button onClick={() => handleDeleteExam(exam)}
                    className="tech-label px-2 py-1 rounded-lg transition-colors hover:bg-red-500/10 flex items-center gap-1"
                    style={{ color: '#f87171', fontSize: 9 }} aria-label={`Delete ${exam.title}`}>
                    <LuTrash2 size={10} />DEL
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showCreateModal && (
          <ExamModal onClose={(reload) => { setShowCreateModal(false); if (reload) fetchExams(); }} />
        )}
        {editExam && (
          <ExamModal exam={editExam} onClose={(reload) => { setEditExam(null); if (reload) fetchExams(); }} />
        )}
        {viewExam && (
          <ViewExamModal exam={viewExam} onClose={() => setViewExam(null)} onStatusChange={fetchExams} />
        )}
        {enrollExam && (
          <EnrollModal exam={enrollExam} onClose={(reload) => { setEnrollExam(null); if (reload) fetchExams(); }} />
        )}
      </AnimatePresence>
    </div>
  );
}
