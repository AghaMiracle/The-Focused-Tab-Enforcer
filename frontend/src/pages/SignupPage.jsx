import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LuEye, LuEyeOff, LuCircleCheck } from 'react-icons/lu';
import { useAuth } from '../context/AuthContext';

// Stable particles — computed once outside render to avoid hydration flicker
const PARTICLES = Array.from({ length: 24 }, (_, i) => ({
  id: i,
  left: `${(i * 13.7 + 5) % 100}%`,
  top: `${(i * 17.3 + 8) % 100}%`,
  size: (i % 3) + 1.5,
  duration: 5 + (i % 4),
  delay: (i % 5) * 0.6,
}));

function FloatingParticle({ p }) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{
        width: p.size,
        height: p.size,
        backgroundColor: 'rgba(204,255,0,0.35)',
        left: p.left,
        top: p.top,
      }}
      animate={{ y: [0, -55, 0], opacity: [0, 1, 0] }}
      transition={{ duration: p.duration, repeat: Infinity, delay: p.delay, ease: 'easeInOut' }}
    />
  );
}

// Password strength scorer
function scorePassword(pw) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s; // 0-5
}

const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent'];
const strengthColors = ['', '#ef4444', '#f97316', '#eab308', '#10b981', '#ccff00'];

function PasswordStrength({ password }) {
  const score = scorePassword(password);
  if (!password) return null;
  return (
    <div className="flex flex-col gap-1.5 mt-1">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full transition-all duration-300"
            style={{
              backgroundColor: i <= score ? strengthColors[score] : 'rgba(255,255,255,0.1)',
            }}
          />
        ))}
      </div>
      <span className="tech-label" style={{ color: strengthColors[score], fontSize: 9 }}>
        {strengthLabels[score]}
      </span>
    </div>
  );
}

// Reusable styled input
function Field({ id, label, type = 'text', value, onChange, placeholder, required, autoComplete, children }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="tech-label" style={{ color: 'rgba(235,235,235,0.5)' }}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        className="w-full px-4 py-3.5 rounded-2xl text-sm text-[#ebebeb] outline-none transition-all duration-200"
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          fontFamily: 'Space Grotesk, sans-serif',
        }}
        onFocus={(e) => {
          e.target.style.borderColor = 'rgba(204,255,0,0.5)';
          e.target.style.boxShadow = '0 0 0 2px rgba(204,255,0,0.08)';
        }}
        onBlur={(e) => {
          e.target.style.borderColor = 'rgba(255,255,255,0.1)';
          e.target.style.boxShadow = 'none';
        }}
      />
      {children}
    </div>
  );
}

// Step indicator
function StepDots({ step, total }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className="rounded-full transition-all duration-300"
          style={{
            width: i === step ? 24 : 6,
            height: 6,
            backgroundColor: i === step ? '#ccff00' : i < step ? 'rgba(204,255,0,0.4)' : 'rgba(255,255,255,0.1)',
          }}
        />
      ))}
      <span className="tech-label ml-2" style={{ color: 'rgba(235,235,235,0.35)', fontSize: 9 }}>
        STEP {step + 1} OF {total}
      </span>
    </div>
  );
}

export default function SignupPage() {
  const [step, setStep] = useState(0); // 0 = institution info, 1 = account, 2 = success
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreed, setAgreed] = useState(false);

  // Step 0 fields
  const [institutionName, setInstitutionName] = useState('');
  const [institutionType, setInstitutionType] = useState('');
  const [country, setCountry] = useState('');
  const [website, setWebsite] = useState('');

  // Step 1 fields
  const [adminName, setAdminName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const { register } = useAuth();
  const navigate = useNavigate();

  const institutionTypes = [
    'University / College',
    'Secondary School',
    'Professional Training',
    'Online Learning Platform',
    'Corporate Training',
    'Other',
  ];

  // Step 0 validation
  const step0Valid = institutionName.trim() && institutionType && country.trim();

  // Step 1 validation
  const pwScore = scorePassword(password);
  const step1Valid =
    adminName.trim() &&
    email.trim() &&
    password.length >= 8 &&
    password === confirmPassword &&
    agreed;

  const handleNext = (e) => {
    e.preventDefault();
    setError('');
    if (!step0Valid) {
      setError('Please fill in all required fields.');
      return;
    }
    setStep(1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (pwScore < 2) {
      setError('Password is too weak. Add uppercase letters, numbers, or symbols.');
      return;
    }

    setLoading(true);

    const result = await register({
      institutionName,
      institutionType,
      country,
      website,
      adminName,
      email,
      password,
    });

    setLoading(false);

    if (result.success) {
      setStep(2);
    } else {
      setError(result.error || 'Registration failed. Please try again.');
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden px-4 py-12"
      style={{ backgroundColor: '#000000' }}
    >
      {/* Grid */}
      <div className="absolute inset-0 grid-pattern opacity-40 pointer-events-none" />

      {/* Glow spheres */}
      <div
        className="absolute top-1/4 right-1/4 w-96 h-96 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(204,255,0,0.07) 0%, transparent 70%)', filter: 'blur(120px)' }}
      />
      <div
        className="absolute bottom-1/4 left-1/4 w-80 h-80 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.07) 0%, transparent 70%)', filter: 'blur(120px)' }}
      />

      {/* Particles */}
      {PARTICLES.map((p) => <FloatingParticle key={p.id} p={p} />)}

      {/* Back to home */}
      <Link
        to="/"
        className="absolute top-6 left-6 flex items-center gap-2 text-sm transition-colors hover:text-[#ccff00]"
        style={{ color: 'rgba(235,235,235,0.5)' }}
        aria-label="Back to home"
      >
        ← Back to home
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
        className="relative w-full max-w-md"
      >
        <div
          className="rounded-[2.5rem] p-8 md:p-10 overflow-hidden"
          style={{
            background: 'rgba(255,255,255,0.03)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 40px 120px rgba(0,0,0,0.65)',
          }}
        >
          {/* Card header */}
          <div className="flex items-center gap-3 mb-8">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm text-black shrink-0"
              style={{ backgroundColor: '#ccff00' }}
            >
              FT
            </div>
            <div>
              <div className="font-semibold text-[#ebebeb] text-sm">Focused Tab Enforcer</div>
              <div className="tech-label" style={{ color: 'rgba(235,235,235,0.4)' }}>Institution Registration</div>
            </div>
            <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full glass">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse-lime" style={{ backgroundColor: '#ccff00' }} />
              <span className="tech-label" style={{ color: '#ccff00', fontSize: 9 }}>SECURE</span>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {/* ── Step 0: Institution Info ── */}
            {step === 0 && (
              <motion.div
                key="step0"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <StepDots step={0} total={2} />
                <h1
                  className="text-3xl font-bold tracking-tight mb-1"
                  style={{ color: '#ebebeb', letterSpacing: '-0.04em' }}
                >
                  Register your institution
                </h1>
                <p className="text-sm mb-6" style={{ color: 'rgba(235,235,235,0.5)' }}>
                  Tell us about your organization first.
                </p>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-4 px-4 py-3 rounded-2xl text-sm"
                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}
                    role="alert"
                  >
                    {error}
                  </motion.div>
                )}

                <form onSubmit={handleNext} className="flex flex-col gap-4" noValidate>
                  <Field
                    id="institutionName"
                    label="INSTITUTION NAME *"
                    value={institutionName}
                    onChange={(e) => setInstitutionName(e.target.value)}
                    placeholder="e.g. Greenfield University"
                    required
                    autoComplete="organization"
                  />

                  {/* Institution type — custom select */}
                  <div className="flex flex-col gap-2">
                    <label htmlFor="institutionType" className="tech-label" style={{ color: 'rgba(235,235,235,0.5)' }}>
                      INSTITUTION TYPE *
                    </label>
                    <select
                      id="institutionType"
                      value={institutionType}
                      onChange={(e) => setInstitutionType(e.target.value)}
                      required
                      className="w-full px-4 py-3.5 rounded-2xl text-sm text-[#ebebeb] outline-none transition-all duration-200 appearance-none"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        fontFamily: 'Space Grotesk, sans-serif',
                        cursor: 'pointer',
                      }}
                      onFocus={(e) => { e.target.style.borderColor = 'rgba(204,255,0,0.5)'; }}
                      onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                      aria-label="Institution type"
                    >
                      <option value="" disabled style={{ background: '#0c0c0c' }}>Select a type...</option>
                      {institutionTypes.map((t) => (
                        <option key={t} value={t} style={{ background: '#0c0c0c', color: '#ebebeb' }}>{t}</option>
                      ))}
                    </select>
                  </div>

                  <Field
                    id="country"
                    label="COUNTRY *"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="e.g. United States"
                    required
                    autoComplete="country-name"
                  />

                  <Field
                    id="website"
                    label="WEBSITE (OPTIONAL)"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://institution.edu"
                    autoComplete="url"
                  />

                  <motion.button
                    type="submit"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-4 rounded-2xl font-semibold text-black text-sm mt-2"
                    style={{ backgroundColor: '#ccff00', boxShadow: '0 0 30px rgba(204,255,0,0.2)' }}
                    aria-label="Continue to account setup"
                  >
                    Continue →
                  </motion.button>
                </form>

                <p className="text-center text-xs mt-5" style={{ color: 'rgba(235,235,235,0.3)' }}>
                  Already have an account?{' '}
                  <Link to="/login" className="transition-colors hover:text-[#ccff00]" style={{ color: 'rgba(235,235,235,0.55)' }}>
                    Sign in
                  </Link>
                </p>
              </motion.div>
            )}

            {/* ── Step 1: Admin Account ── */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <StepDots step={1} total={2} />

                <button
                  onClick={() => { setStep(0); setError(''); }}
                  className="flex items-center gap-2 text-sm mb-5 transition-colors hover:text-[#ccff00]"
                  style={{ color: 'rgba(235,235,235,0.5)' }}
                  aria-label="Back to institution info"
                >
                  ← Back
                </button>

                <h1
                  className="text-3xl font-bold tracking-tight mb-1"
                  style={{ color: '#ebebeb', letterSpacing: '-0.04em' }}
                >
                  Create your account
                </h1>
                <p className="text-sm mb-6" style={{ color: 'rgba(235,235,235,0.5)' }}>
                  Set up the admin credentials for{' '}
                  <span style={{ color: '#ccff00' }}>{institutionName}</span>.
                </p>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-4 px-4 py-3 rounded-2xl text-sm"
                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}
                    role="alert"
                  >
                    {error}
                  </motion.div>
                )}

                <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
                  <Field
                    id="adminName"
                    label="FULL NAME *"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    placeholder="Dr. Jane Smith"
                    required
                    autoComplete="name"
                  />

                  <Field
                    id="email"
                    label="INSTITUTION EMAIL *"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@institution.edu"
                    required
                    autoComplete="email"
                  />

                  {/* Password with show/hide */}
                  <div className="flex flex-col gap-2">
                    <label htmlFor="password" className="tech-label" style={{ color: 'rgba(235,235,235,0.5)' }}>
                      PASSWORD *
                    </label>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Min. 8 characters"
                        required
                        autoComplete="new-password"
                        className="w-full px-4 py-3.5 pr-11 rounded-2xl text-sm text-[#ebebeb] outline-none transition-all duration-200"
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          fontFamily: 'Space Grotesk, sans-serif',
                        }}
                        onFocus={(e) => { e.target.style.borderColor = 'rgba(204,255,0,0.5)'; e.target.style.boxShadow = '0 0 0 2px rgba(204,255,0,0.08)'; }}
                        onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }}
                        aria-label="Password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors hover:text-[#ccff00]"
                        style={{ color: 'rgba(235,235,235,0.4)' }}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword
                          ? <LuEyeOff size={16} aria-hidden="true" />
                          : <LuEye    size={16} aria-hidden="true" />
                        }
                      </button>
                    </div>
                    <PasswordStrength password={password} />
                  </div>

                  {/* Confirm password */}
                  <div className="flex flex-col gap-2">
                    <label htmlFor="confirmPassword" className="tech-label" style={{ color: 'rgba(235,235,235,0.5)' }}>
                      CONFIRM PASSWORD *
                    </label>
                    <div className="relative">
                      <input
                        id="confirmPassword"
                        type={showConfirm ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter password"
                        required
                        autoComplete="new-password"
                        className="w-full px-4 py-3.5 pr-11 rounded-2xl text-sm text-[#ebebeb] outline-none transition-all duration-200"
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          border: `1px solid ${confirmPassword && confirmPassword !== password ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.1)'}`,
                          fontFamily: 'Space Grotesk, sans-serif',
                        }}
                        onFocus={(e) => { e.target.style.borderColor = 'rgba(204,255,0,0.5)'; e.target.style.boxShadow = '0 0 0 2px rgba(204,255,0,0.08)'; }}
                        onBlur={(e) => {
                          e.target.style.borderColor = confirmPassword && confirmPassword !== password ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.1)';
                          e.target.style.boxShadow = 'none';
                        }}
                        aria-label="Confirm password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors hover:text-[#ccff00]"
                        style={{ color: 'rgba(235,235,235,0.4)' }}
                        aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                      >
                        {showConfirm
                          ? <LuEyeOff size={16} aria-hidden="true" />
                          : <LuEye    size={16} aria-hidden="true" />
                        }
                      </button>
                    </div>
                    {confirmPassword && confirmPassword !== password && (
                      <span className="tech-label" style={{ color: '#ef4444', fontSize: 9 }}>
                        PASSWORDS DO NOT MATCH
                      </span>
                    )}
                    {confirmPassword && confirmPassword === password && (
                      <span className="tech-label" style={{ color: '#ccff00', fontSize: 9 }}>
                        ✓ PASSWORDS MATCH
                      </span>
                    )}
                  </div>

                  {/* Terms agreement */}
                  <label className="flex items-start gap-3 cursor-pointer" htmlFor="agree">
                    <button
                      id="agree"
                      type="button"
                      role="checkbox"
                      aria-checked={agreed}
                      onClick={() => setAgreed(!agreed)}
                      className="w-5 h-5 rounded-md shrink-0 mt-0.5 flex items-center justify-center transition-all duration-200 border"
                      style={{
                        background: agreed ? '#ccff00' : 'rgba(255,255,255,0.05)',
                        borderColor: agreed ? '#ccff00' : 'rgba(255,255,255,0.2)',
                      }}
                    >
                      {agreed && <span className="text-black text-xs font-bold leading-none">✓</span>}
                    </button>
                    <span className="text-xs leading-relaxed" style={{ color: 'rgba(235,235,235,0.55)' }}>
                      I agree to the{' '}
                      <button type="button" className="underline transition-colors hover:text-[#ccff00]" style={{ color: 'rgba(235,235,235,0.75)' }}>
                        Terms of Service
                      </button>{' '}
                      and{' '}
                      <button type="button" className="underline transition-colors hover:text-[#ccff00]" style={{ color: 'rgba(235,235,235,0.75)' }}>
                        Privacy Policy
                      </button>
                    </span>
                  </label>

                  <motion.button
                    type="submit"
                    disabled={loading || !step1Valid}
                    whileHover={{ scale: loading || !step1Valid ? 1 : 1.02 }}
                    whileTap={{ scale: loading || !step1Valid ? 1 : 0.98 }}
                    className="w-full py-4 rounded-2xl font-semibold text-black text-sm mt-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: '#ccff00', boxShadow: '0 0 30px rgba(204,255,0,0.2)' }}
                    aria-label="Create institution account"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                        Creating account...
                      </span>
                    ) : (
                      'Create Account'
                    )}
                  </motion.button>
                </form>

                <p className="text-center text-xs mt-5" style={{ color: 'rgba(235,235,235,0.3)' }}>
                  Already have an account?{' '}
                  <Link to="/login" className="transition-colors hover:text-[#ccff00]" style={{ color: 'rgba(235,235,235,0.55)' }}>
                    Sign in
                  </Link>
                </p>
              </motion.div>
            )}

            {/* ── Step 2: Success ── */}
            {step === 2 && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                className="text-center py-4"
              >
                {/* Animated checkmark ring */}
                <motion.div
                  initial={{ scale: 0, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ duration: 0.5, delay: 0.1, ease: [0.4, 0, 0.2, 1] }}
                  className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
                  style={{
                    background: 'rgba(204,255,0,0.1)',
                    border: '2px solid rgba(204,255,0,0.4)',
                    boxShadow: '0 0 40px rgba(204,255,0,0.15)',
                  }}
                >
                  <LuCircleCheck size={36} style={{ color: '#ccff00' }} aria-hidden="true" />
                </motion.div>

                <h2
                  className="text-3xl font-bold mb-2"
                  style={{ color: '#ebebeb', letterSpacing: '-0.04em' }}
                >
                  Account created!
                </h2>
                <p className="text-sm mb-2" style={{ color: 'rgba(235,235,235,0.55)' }}>
                  Welcome to Focused Tab Enforcer,
                </p>
                <p className="text-base font-semibold mb-6" style={{ color: '#ccff00' }}>
                  {institutionName}
                </p>

                {/* Details summary */}
                <div
                  className="rounded-2xl p-4 text-left mb-8 flex flex-col gap-2"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  {[
                    { label: 'ADMIN', value: adminName },
                    { label: 'EMAIL', value: email },
                    { label: 'TYPE', value: institutionType },
                    { label: 'COUNTRY', value: country },
                  ].map((r) => (
                    <div key={r.label} className="flex items-center gap-3">
                      <span className="tech-label w-16 shrink-0" style={{ color: 'rgba(235,235,235,0.35)' }}>{r.label}</span>
                      <span className="text-sm text-[#ebebeb] truncate">{r.value}</span>
                    </div>
                  ))}
                </div>

                <motion.button
                  onClick={() => navigate('/dashboard')}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="w-full py-4 rounded-2xl font-semibold text-black text-sm mb-4"
                  style={{ backgroundColor: '#ccff00', boxShadow: '0 0 30px rgba(204,255,0,0.2)' }}
                  aria-label="Go to dashboard"
                >
                  Go to Dashboard →
                </motion.button>

                <p className="text-xs" style={{ color: 'rgba(235,235,235,0.3)' }}>
                  A verification email has been sent to{' '}
                  <span style={{ color: 'rgba(235,235,235,0.6)' }}>{email}</span>
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
