import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { mockExams } from '../../data/mockData';
import { examsApi } from '../../utils/api';

const statusConfig = {
  active: { label: 'Active', color: '#ccff00', bg: 'rgba(204,255,0,0.1)' },
  completed: { label: 'Completed', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  scheduled: { label: 'Scheduled', color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
};

function CreateExamModal({ onClose }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    duration: 60,
    allowedDomains: '',
    tabSwitchLimit: 3,
    faceAbsenceFrames: 30,
    multipleFaceTolerance: 0,
    students: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Map form fields to backend schema
      const payload = {
        title:          formData.title,
        description:    formData.description || undefined,
        scheduledDate:  formData.date ? new Date(formData.date).toISOString() : undefined,
        durationMinutes: Number(formData.duration) || 60,
        allowedDomains: formData.allowedDomains
          ? formData.allowedDomains.split(',').map((d) => d.trim()).filter(Boolean)
          : [],
        violationThresholds: {
          tabSwitchSeconds:       Number(formData.tabSwitchLimit)         || 3,
          faceAbsenceFrames:      Number(formData.faceAbsenceFrames)      || 30,
          multipleFaceTolerance:  Number(formData.multipleFaceTolerance)  || 0,
        },
      };
      await examsApi.create(payload);
      onClose(true); // pass true = reload list
    } catch (err) {
      alert(err.message || 'Failed to create exam.');
    }
  };

  const field = (label, id, type = 'text', extra = {}) => (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="tech-label" style={{ color: 'rgba(235,235,235,0.5)' }}>
        {label.toUpperCase()}
      </label>
      <input
        id={id}
        type={type}
        value={formData[id] || ''}
        onChange={(e) => setFormData({ ...formData, [id]: e.target.value })}
        className="w-full px-4 py-3 rounded-2xl text-sm text-[#ebebeb] outline-none"
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          fontFamily: 'Space Grotesk, sans-serif',
        }}
        onFocus={(e) => { e.target.style.borderColor = 'rgba(204,255,0,0.5)'; }}
        onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
        {...extra}
      />
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Create new exam"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[2.5rem] p-8"
        style={{
          background: 'rgba(12,12,12,0.98)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 40px 120px rgba(0,0,0,0.7)',
        }}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-[#ebebeb]" style={{ letterSpacing: '-0.03em' }}>
              Create New Exam
            </h2>
            <div className="tech-label" style={{ color: 'rgba(235,235,235,0.4)' }}>
              EXAM CONFIGURATION
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 glass rounded-full flex items-center justify-center text-sm hover:text-red-400 transition-colors"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {field('Exam Title', 'title', 'text', { placeholder: 'e.g. Advanced Mathematics Final', required: true })}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="description" className="tech-label" style={{ color: 'rgba(235,235,235,0.5)' }}>
              DESCRIPTION
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="w-full px-4 py-3 rounded-2xl text-sm text-[#ebebeb] outline-none resize-none"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                fontFamily: 'Space Grotesk, sans-serif',
              }}
              onFocus={(e) => { e.target.style.borderColor = 'rgba(204,255,0,0.5)'; }}
              onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {field('Date & Time', 'date', 'datetime-local')}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="duration" className="tech-label" style={{ color: 'rgba(235,235,235,0.5)' }}>
                DURATION (MINUTES)
              </label>
              <input
                id="duration"
                type="number"
                min={15}
                max={360}
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                className="w-full px-4 py-3 rounded-2xl text-sm text-[#ebebeb] outline-none"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  fontFamily: 'Space Grotesk, sans-serif',
                }}
                onFocus={(e) => { e.target.style.borderColor = 'rgba(204,255,0,0.5)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
              />
            </div>
          </div>

          {field('Allowed Domains (comma-separated)', 'allowedDomains', 'text', { placeholder: 'exam.university.edu, lms.uni.edu' })}

          {/* Violation thresholds */}
          <div
            className="rounded-2xl p-4 flex flex-col gap-4"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="tech-label" style={{ color: 'rgba(235,235,235,0.5)' }}>VIOLATION THRESHOLDS</div>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Tab Switch (count)', id: 'tabSwitchLimit' },
                { label: 'Face Absence (frames)', id: 'faceAbsenceFrames' },
                { label: 'Multiple Faces (tolerance)', id: 'multipleFaceTolerance' },
              ].map((f) => (
                <div key={f.id} className="flex flex-col gap-1.5">
                  <label htmlFor={f.id} className="tech-label" style={{ color: 'rgba(235,235,235,0.4)', fontSize: 9 }}>
                    {f.label.toUpperCase()}
                  </label>
                  <input
                    id={f.id}
                    type="number"
                    min={0}
                    value={formData[f.id]}
                    onChange={(e) => setFormData({ ...formData, [f.id]: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl text-sm text-[#ebebeb] outline-none"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      fontFamily: 'Space Grotesk, sans-serif',
                    }}
                    onFocus={(e) => { e.target.style.borderColor = 'rgba(204,255,0,0.5)'; }}
                    onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Students */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="students" className="tech-label" style={{ color: 'rgba(235,235,235,0.5)' }}>
              STUDENT EMAILS (ONE PER LINE OR CSV)
            </label>
            <textarea
              id="students"
              value={formData.students}
              onChange={(e) => setFormData({ ...formData, students: e.target.value })}
              rows={3}
              placeholder="student1@uni.edu&#10;student2@uni.edu"
              className="w-full px-4 py-3 rounded-2xl text-sm text-[#ebebeb] outline-none resize-none"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 12,
              }}
              onFocus={(e) => { e.target.style.borderColor = 'rgba(204,255,0,0.5)'; }}
              onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-2xl text-sm font-medium transition-all hover:bg-white/5"
              style={{ color: 'rgba(235,235,235,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-3 rounded-2xl text-sm font-semibold text-black transition-all hover:scale-[1.02]"
              style={{ backgroundColor: '#ccff00' }}
              aria-label="Create exam"
            >
              Create Exam
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

export default function ExamsPage() {
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState('all');
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchExams = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await examsApi.list({ status: filter === 'all' ? undefined : filter });
      // Backend returns { exams: [...], pagination: {...} }
      setExams(data?.exams ?? []);
    } catch (err) {
      setError(err.message || 'Failed to load exams.');
      setExams(mockExams); // fall back to mock on error
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchExams(); }, [fetchExams]);

  // Normalize backend exam shape to what the table expects
  const normalizeExam = (e) => ({
    id:       e.examId || e._id,
    title:    e.title,
    date:     e.scheduledDate
                ? new Date(e.scheduledDate).toLocaleString()
                : '—',
    status:   e.status,
    students: e.enrollmentCount ?? 0,
    violations: 0,
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
          onClick={() => setShowModal(true)}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          className="px-5 py-2.5 rounded-2xl text-sm font-semibold text-black flex items-center gap-2"
          style={{ backgroundColor: '#ccff00' }}
          aria-label="Create new exam"
        >
          + Create New Exam
        </motion.button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'active', 'scheduled', 'completed'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200"
            style={{
              background: filter === f ? '#ccff00' : 'rgba(255,255,255,0.05)',
              color: filter === f ? '#000' : 'rgba(235,235,235,0.6)',
              border: `1px solid ${filter === f ? '#ccff00' : 'rgba(255,255,255,0.1)'}`,
            }}
            aria-pressed={filter === f}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div
        className="rounded-[2rem] overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
        role="region"
        aria-label="Exams table"
      >
        {/* Table header */}
        <div
          className="grid gap-4 px-6 py-3 border-b"
          style={{
            gridTemplateColumns: '1.2fr 2fr 1.2fr 1fr 1fr 1fr',
            borderColor: 'rgba(255,255,255,0.06)',
          }}
        >
          {['Exam ID', 'Title', 'Date', 'Status', 'Students', 'Actions'].map((h) => (
            <div key={h} className="tech-label" style={{ color: 'rgba(235,235,235,0.4)' }}>{h}</div>
          ))}
        </div>

        {/* Rows */}
        {filtered.map((exam, i) => {
          const st = statusConfig[exam.status];
          return (
            <motion.div
              key={exam.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="grid gap-4 px-6 py-4 border-b items-center hover:bg-white/[0.02] transition-colors"
              style={{
                gridTemplateColumns: '1.2fr 2fr 1.2fr 1fr 1fr 1fr',
                borderColor: 'rgba(255,255,255,0.04)',
              }}
            >
              <span
                className="tech-label"
                style={{ color: 'rgba(235,235,235,0.5)', fontSize: 10 }}
              >
                {exam.id}
              </span>
              <span className="text-sm font-medium text-[#ebebeb]">{exam.title}</span>
              <span className="text-xs" style={{ color: 'rgba(235,235,235,0.5)' }}>
                {exam.date}
              </span>
              <span
                className="tech-label px-2 py-1 rounded-full w-fit"
                style={{ color: st.color, background: st.bg, fontSize: 9 }}
              >
                {st.label}
              </span>
              <span className="text-sm text-[#ebebeb]">{exam.students}</span>
              <div className="flex gap-2">
                <button
                  className="tech-label px-2 py-1 rounded-lg transition-colors hover:bg-white/10"
                  style={{ color: '#ccff00', fontSize: 9 }}
                  aria-label={`View ${exam.title}`}
                >
                  VIEW
                </button>
                <button
                  className="tech-label px-2 py-1 rounded-lg transition-colors hover:bg-white/10"
                  style={{ color: 'rgba(235,235,235,0.5)', fontSize: 9 }}
                  aria-label={`Edit ${exam.title}`}
                >
                  EDIT
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && <CreateExamModal onClose={(reload) => { setShowModal(false); if (reload) fetchExams(); }} />}
      </AnimatePresence>
    </div>
  );
}
