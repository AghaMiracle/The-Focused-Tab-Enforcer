import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LuMailCheck } from 'react-icons/lu';
import { useAuth } from '../context/AuthContext';


function FloatingParticle({ style }) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{
        width: Math.random() * 4 + 1,
        height: Math.random() * 4 + 1,
        backgroundColor: 'rgba(204,255,0,0.4)',
        ...style,
      }}
      animate={{
        y: [0, -60, 0],
        opacity: [0, 1, 0],
      }}
      transition={{
        duration: Math.random() * 4 + 4,
        repeat: Infinity,
        delay: Math.random() * 3,
        ease: 'easeInOut',
      }}
    />
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, forgotPassword } = useAuth();
  const navigate = useNavigate();

  const particles = Array.from({ length: 20 }, (_, i) => ({
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 100}%`,
  }));

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(email, password);
    setLoading(false);

    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error || 'Invalid credentials. Please try again.');
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await forgotPassword(resetEmail);
    } catch {
      // Always show success to prevent email enumeration
    } finally {
      setLoading(false);
    }
    setResetSent(true);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden px-4"
      style={{ backgroundColor: '#000000' }}
    >
      {/* Grid pattern */}
      <div className="absolute inset-0 grid-pattern opacity-40 pointer-events-none" />

      {/* Glow spheres */}
      <div
        className="absolute top-1/4 left-1/4 w-96 h-96 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(204,255,0,0.08) 0%, transparent 70%)', filter: 'blur(120px)' }}
      />
      <div
        className="absolute bottom-1/4 right-1/4 w-80 h-80 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)', filter: 'blur(120px)' }}
      />

      {/* Particles */}
      {particles.map((p, i) => (
        <FloatingParticle key={i} style={{ left: p.left, top: p.top }} />
      ))}

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
            boxShadow: '0 40px 120px rgba(0,0,0,0.6)',
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm text-black"
              style={{ backgroundColor: '#ccff00' }}
            >
              FT
            </div>
            <div>
              <div className="font-semibold text-[#ebebeb] text-sm">Focused Tab Enforcer</div>
              <div className="tech-label" style={{ color: 'rgba(235,235,235,0.4)' }}>
                Admin Portal
              </div>
            </div>
            {/* Secure connection badge */}
            <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full glass">
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse-lime"
                style={{ backgroundColor: '#ccff00' }}
              />
              <span className="tech-label" style={{ color: '#ccff00', fontSize: 9 }}>
                SECURE
              </span>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {!showReset ? (
              <motion.div
                key="login"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
              >
                <h1
                  className="text-3xl font-bold tracking-tight mb-1"
                  style={{ color: '#ebebeb', letterSpacing: '-0.04em' }}
                >
                  Welcome back
                </h1>
                <p className="text-sm mb-8" style={{ color: 'rgba(235,235,235,0.5)' }}>
                  Sign in to your institution dashboard
                </p>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-4 px-4 py-3 rounded-2xl text-sm"
                    style={{
                      background: 'rgba(239,68,68,0.1)',
                      border: '1px solid rgba(239,68,68,0.3)',
                      color: '#f87171',
                    }}
                    role="alert"
                  >
                    {error}
                  </motion.div>
                )}

                <form onSubmit={handleLogin} className="flex flex-col gap-4" noValidate>
                  {/* Email */}
                  <div className="flex flex-col gap-2">
                    <label
                      htmlFor="email"
                      className="tech-label"
                      style={{ color: 'rgba(235,235,235,0.5)' }}
                    >
                      INSTITUTION EMAIL
                    </label>
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@university.edu"
                      required
                      className="w-full px-4 py-3.5 rounded-2xl text-sm text-[#ebebeb] outline-none transition-all duration-200 focus:ring-2"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        fontFamily: 'Space Grotesk, sans-serif',
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = 'rgba(204,255,0,0.5)';
                        e.target.style.boxShadow = '0 0 0 2px rgba(204,255,0,0.1)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = 'rgba(255,255,255,0.1)';
                        e.target.style.boxShadow = 'none';
                      }}
                      aria-label="Institution email address"
                    />
                  </div>

                  {/* Password */}
                  <div className="flex flex-col gap-2">
                    <label
                      htmlFor="password"
                      className="tech-label"
                      style={{ color: 'rgba(235,235,235,0.5)' }}
                    >
                      PASSWORD
                    </label>
                    <input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      required
                      className="w-full px-4 py-3.5 rounded-2xl text-sm text-[#ebebeb] outline-none transition-all duration-200"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        fontFamily: 'Space Grotesk, sans-serif',
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = 'rgba(204,255,0,0.5)';
                        e.target.style.boxShadow = '0 0 0 2px rgba(204,255,0,0.1)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = 'rgba(255,255,255,0.1)';
                        e.target.style.boxShadow = 'none';
                      }}
                      aria-label="Password"
                    />
                  </div>

                  {/* Remember + Forgot */}
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2.5 cursor-pointer" htmlFor="remember">
                      <button
                        id="remember"
                        type="button"
                        role="switch"
                        aria-checked={remember}
                        onClick={() => setRemember(!remember)}
                        className="relative w-9 h-5 rounded-full transition-all duration-200 flex-shrink-0"
                        style={{
                          background: remember ? '#ccff00' : 'rgba(255,255,255,0.1)',
                        }}
                      >
                        <span
                          className="absolute top-0.5 w-4 h-4 rounded-full bg-black transition-all duration-200"
                          style={{ left: remember ? 18 : 2 }}
                        />
                      </button>
                      <span className="text-sm" style={{ color: 'rgba(235,235,235,0.6)' }}>
                        Remember me
                      </span>
                    </label>

                    <button
                      type="button"
                      onClick={() => setShowReset(true)}
                      className="text-sm transition-colors hover:text-[#ccff00]"
                      style={{ color: 'rgba(235,235,235,0.5)' }}
                    >
                      Forgot password?
                    </button>
                  </div>

                  {/* Submit */}
                  <motion.button
                    type="submit"
                    disabled={loading}
                    whileHover={{ scale: loading ? 1 : 1.02 }}
                    whileTap={{ scale: loading ? 1 : 0.98 }}
                    className="w-full py-4 rounded-2xl font-semibold text-black text-sm transition-all duration-200 mt-2 disabled:opacity-60"
                    style={{
                      backgroundColor: '#ccff00',
                      boxShadow: '0 0 30px rgba(204,255,0,0.2)',
                    }}
                    aria-label="Sign in to dashboard"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                        Authenticating...
                      </span>
                    ) : (
                      'Sign In to Dashboard'
                    )}
                  </motion.button>
                </form>

                <p className="text-center text-xs mt-5" style={{ color: 'rgba(235,235,235,0.3)' }}>
                  Don't have an account?{' '}
                  <Link
                    to="/signup"
                    className="transition-colors hover:text-[#ccff00]"
                    style={{ color: 'rgba(235,235,235,0.55)' }}
                  >
                    Register your institution
                  </Link>
                </p>
                <p className="text-center text-xs mt-2" style={{ color: 'rgba(235,235,235,0.2)' }}>
                  Institution admin access only. Students use the browser extension.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="reset"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <button
                  onClick={() => { setShowReset(false); setResetSent(false); setResetEmail(''); }}
                  className="flex items-center gap-2 text-sm mb-6 transition-colors hover:text-[#ccff00]"
                  style={{ color: 'rgba(235,235,235,0.5)' }}
                  aria-label="Back to login"
                >
                  ← Back to login
                </button>

                {!resetSent ? (
                  <>
                    <h2
                      className="text-2xl font-bold tracking-tight mb-2"
                      style={{ color: '#ebebeb', letterSpacing: '-0.04em' }}
                    >
                      Reset Password
                    </h2>
                    <p className="text-sm mb-6" style={{ color: 'rgba(235,235,235,0.5)' }}>
                      Enter your institution email and we'll send a reset link.
                    </p>

                    <form onSubmit={handleReset} className="flex flex-col gap-4">
                      <div className="flex flex-col gap-2">
                        <label htmlFor="reset-email" className="tech-label" style={{ color: 'rgba(235,235,235,0.5)' }}>
                          INSTITUTION EMAIL
                        </label>
                        <input
                          id="reset-email"
                          type="email"
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          placeholder="admin@university.edu"
                          required
                          className="w-full px-4 py-3.5 rounded-2xl text-sm text-[#ebebeb] outline-none"
                          style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            fontFamily: 'Space Grotesk, sans-serif',
                          }}
                          onFocus={(e) => { e.target.style.borderColor = 'rgba(204,255,0,0.5)'; }}
                          onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                          aria-label="Email for password reset"
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full py-4 rounded-2xl font-semibold text-black text-sm"
                        style={{ backgroundColor: '#ccff00' }}
                        aria-label="Send password reset link"
                      >
                        Send Reset Link
                      </button>
                    </form>
                  </>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-6"
                  >
                    <LuMailCheck size={40} className="mx-auto mb-4" style={{ color: '#ccff00' }} aria-hidden="true" />
                    <h3 className="text-xl font-semibold text-[#ebebeb] mb-2">Check your inbox</h3>
                    <p className="text-sm" style={{ color: 'rgba(235,235,235,0.5)' }}>
                      A reset link has been sent to <strong style={{ color: '#ccff00' }}>{resetEmail}</strong>.
                      It expires in 15 minutes.
                    </p>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
