import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LuFolderOpen, LuSearch, LuUserPlus, LuX, LuRefreshCw, LuTrash2 } from 'react-icons/lu';
import { studentsApi } from '../../utils/api';
import { useToast } from '../../components/ui/Toast';
import { useConfirm } from '../../components/ui/ConfirmDialog';

const statusConfig = {
  active:   { color: '#ccff00',            bg: 'rgba(204,255,0,0.1)',   label: 'Active' },
  flagged:  { color: '#ef4444',            bg: 'rgba(239,68,68,0.1)',   label: 'Flagged' },
  inactive: { color: 'rgba(235,235,235,0.3)', bg: 'rgba(255,255,255,0.05)', label: 'Inactive' },
};

// ── Add Student Modal ──────────────────────────────────────────────────────────
function AddStudentModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    fullName: '', email: '', registrationNumber: '', department: '', level: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const field = (label, id, type = 'text', placeholder = '') => (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="tech-label" style={{ color: 'rgba(235,235,235,0.5)' }}>
        {label.toUpperCase()}
      </label>
      <input
        id={id}
        type={type}
        value={form[id] || ''}
        onChange={(e) => setForm({ ...form, [id]: e.target.value })}
        placeholder={placeholder}
        className="w-full px-4 py-3 rounded-2xl text-sm text-[#ebebeb] outline-none"
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          fontFamily: 'Space Grotesk, sans-serif',
        }}
        onFocus={(e) => { e.target.style.borderColor = 'rgba(204,255,0,0.5)'; }}
        onBlur={(e)  => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
      />
    </div>
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await studentsApi.create({
        fullName:           form.fullName.trim(),
        email:              form.email.trim(),
        registrationNumber: form.registrationNumber.trim(),
        department:         form.department.trim() || undefined,
        level:              form.level.trim()      || undefined,
      });
      onCreated();
    } catch (err) {
      setError(err.message || 'Failed to add student.');
    } finally {
      setLoading(false);
    }
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
      aria-label="Add new student"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-lg rounded-[2.5rem] p-8"
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
              Add Student
            </h2>
            <div className="tech-label" style={{ color: 'rgba(235,235,235,0.4)' }}>STUDENT DETAILS</div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 glass rounded-full flex items-center justify-center text-sm hover:text-red-400 transition-colors"
            aria-label="Close modal"
          >
            <LuX size={14} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {field('Full Name', 'fullName', 'text', 'Jane Doe')}
          {field('Email', 'email', 'email', 'jane@university.edu')}
          {field('Registration Number', 'registrationNumber', 'text', 'REG2024001')}
          <div className="grid grid-cols-2 gap-4">
            {field('Department', 'department', 'text', 'Computer Science')}
            {field('Level / Year', 'level', 'text', '300L')}
          </div>

          {error && (
            <div className="px-4 py-3 rounded-2xl text-sm"
              style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
              role="alert"
            >
              {error}
            </div>
          )}

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
              disabled={loading}
              className="flex-1 py-3 rounded-2xl text-sm font-semibold text-black flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ backgroundColor: '#ccff00' }}
              aria-label="Save student"
            >
              {loading && <LuRefreshCw size={14} className="animate-spin" aria-hidden="true" />}
              {loading ? 'Saving...' : 'Add Student'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function StudentsPage() {
  const [search, setSearch]         = useState('');
  const [filter, setFilter]         = useState('all');
  const [students, setStudents]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [csvError, setCsvError]     = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const toast = useToast();
  const confirm = useConfirm();

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await studentsApi.list({ search: search || undefined });
      setStudents(data?.students ?? []);
    } catch {
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => { fetchStudents(); }, 350);
    return () => clearTimeout(timer);
  }, [fetchStudents]);

  // Normalise backend student → card shape
  const normalize = (s) => ({
    id:             s._id,
    name:           s.fullName,
    email:          s.email,
    regNumber:      s.registrationNumber,
    examId:         s.examId || '—',
    examsCompleted: s.examsCompleted ?? 0,
    violationCount: s.violationCount  ?? 0,
    status:         s.isActive ? (s.violationCount > 3 ? 'flagged' : 'active') : 'inactive',
    avatar:         s.fullName?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '??',
  });

  const filtered = students
    .map(normalize)
    .filter((s) => filter === 'all' || s.status === filter);

  const handleCsvImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvError('');
    try {
      const result = await studentsApi.bulkImport(file);
      toast.success(`Import complete: ${result.created ?? 0} created, ${result.skipped ?? 0} skipped.`);
      fetchStudents();
    } catch (err) {
      setCsvError(err.message || 'CSV import failed.');
    }
    e.target.value = '';
  };

  const handleDeleteStudent = async (id, name) => {
    const ok = await confirm({
      title: 'Delete student permanently?',
      message: `Permanently delete "${name}" and all their exam data? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await studentsApi.delete(id);
      fetchStudents();
    } catch (err) {
      toast.error(err.message || 'Failed to remove student.');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-semibold text-[#ebebeb]" style={{ letterSpacing: '-0.03em' }}>
            Student Directory
          </h2>
          <div className="tech-label" style={{ color: 'rgba(235,235,235,0.4)' }}>
            {loading ? 'LOADING...' : `${filtered.length} STUDENTS`}
          </div>
        </div>
        <div className="flex gap-3">
          <label
            className="px-4 py-2 rounded-2xl text-sm glass transition-all hover:bg-white/10 flex items-center gap-2 cursor-pointer"
            style={{ color: 'rgba(235,235,235,0.7)' }}
            aria-label="Import students via CSV"
          >
            <LuFolderOpen size={15} aria-hidden="true" /> Import CSV
            <input type="file" accept=".csv" className="hidden" onChange={handleCsvImport} />
          </label>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-2xl text-sm font-semibold text-black flex items-center gap-1.5"
            style={{ backgroundColor: '#ccff00' }}
            aria-label="Add student manually"
          >
            <LuUserPlus size={15} aria-hidden="true" /> Add Student
          </button>
        </div>
      </div>

      {csvError && (
        <div className="px-4 py-3 rounded-2xl text-sm"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}
          role="alert"
        >
          {csvError}
        </div>
      )}

      {/* Search + filter */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true">
            <LuSearch size={15} style={{ color: 'rgba(235,235,235,0.4)' }} />
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or reg number..."
            className="w-full pl-9 pr-4 py-2.5 rounded-2xl text-sm text-[#ebebeb] outline-none"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              fontFamily: 'Space Grotesk, sans-serif',
            }}
            onFocus={(e) => { e.target.style.borderColor = 'rgba(204,255,0,0.4)'; }}
            onBlur={(e)  => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
            aria-label="Search students"
          />
        </div>
        {['all', 'active', 'flagged'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-4 py-2 rounded-full text-xs font-medium transition-all"
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

      {/* Student cards grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16" style={{ color: 'rgba(235,235,235,0.4)' }}>
          <LuRefreshCw size={20} className="animate-spin mr-2" aria-hidden="true" />
          Loading students...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((student, i) => {
            const st = statusConfig[student.status] || statusConfig.inactive;
            return (
              <motion.div
                key={student.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                whileHover={{ scale: 1.02, borderColor: 'rgba(204,255,0,0.25)' }}
                className="rounded-[2rem] p-5 flex flex-col gap-4 cursor-pointer transition-all duration-200"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
                role="article"
                aria-label={`${student.name} — ${student.status}`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center text-sm font-bold shrink-0"
                    style={{ background: 'rgba(204,255,0,0.1)', color: '#ccff00' }}
                    aria-hidden="true"
                  >
                    {student.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-[#ebebeb] truncate">{student.name}</div>
                    <div className="text-xs truncate" style={{ color: 'rgba(235,235,235,0.5)' }}>
                      {student.email}
                    </div>
                  </div>
                  <span
                    className="tech-label px-2 py-0.5 rounded-full shrink-0"
                    style={{ color: st.color, background: st.bg, fontSize: 9 }}
                  >
                    {st.label}
                  </span>
                </div>

                <div
                  className="tech-label px-2 py-1 rounded-xl text-center"
                  style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(235,235,235,0.4)', fontSize: 9 }}
                >
                  REG: {student.regNumber}
                </div>

                <div
                  className="tech-label px-2 py-1 rounded-xl text-center"
                  style={{ background: 'rgba(204,255,0,0.06)', color: '#ccff00', fontSize: 9, border: '1px solid rgba(204,255,0,0.15)' }}
                >
                  EXAM ID: {student.examId}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div
                    className="rounded-xl p-2.5 text-center"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <div className="text-lg font-bold text-[#ebebeb]">{student.examsCompleted}</div>
                    <div className="tech-label" style={{ color: 'rgba(235,235,235,0.4)', fontSize: 9 }}>EXAMS</div>
                  </div>
                  <div
                    className="rounded-xl p-2.5 text-center"
                    style={{
                      background: student.violationCount > 3 ? 'rgba(239,68,68,0.05)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${student.violationCount > 3 ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)'}`,
                    }}
                  >
                    <div
                      className="text-lg font-bold"
                      style={{ color: student.violationCount > 3 ? '#ef4444' : '#ebebeb' }}
                    >
                      {student.violationCount}
                    </div>
                    <div className="tech-label" style={{ color: 'rgba(235,235,235,0.4)', fontSize: 9 }}>VIOLATIONS</div>
                  </div>
                </div>

                {/* Delete button */}
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteStudent(student.id, student.name); }}
                  className="w-full py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all hover:bg-red-500/10"
                  style={{ color: 'rgba(235,235,235,0.4)', border: '1px solid rgba(255,255,255,0.06)' }}
                  aria-label={`Delete ${student.name}`}
                >
                  <LuTrash2 size={12} /> Remove Student
                </button>
              </motion.div>
            );
          })}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-16" style={{ color: 'rgba(235,235,235,0.3)' }}>
          <LuSearch size={40} className="mx-auto mb-3 opacity-30" aria-hidden="true" />
          <div className="text-sm">No students match your search.</div>
        </div>
      )}

      {/* Add student modal */}
      <AnimatePresence>
        {showAddModal && (
          <AddStudentModal
            onClose={() => setShowAddModal(false)}
            onCreated={() => { setShowAddModal(false); fetchStudents(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
