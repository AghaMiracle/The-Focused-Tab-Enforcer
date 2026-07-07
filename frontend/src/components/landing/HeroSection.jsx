import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { LuScanFace } from 'react-icons/lu';

function HeroMockup() {
  return (
    <motion.div
      className="relative w-full"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.8, delay: 0.4, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* Main shell */}
      <div
        className="relative rounded-[2rem] p-6 noise-overlay overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.03)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        {/* Glow */}
        <div
          className="absolute -top-20 -right-20 w-64 h-64 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(204,255,0,0.12) 0%, transparent 70%)', filter: 'blur(40px)' }}
        />

        {/* Header bar */}
        <div className="flex items-center gap-2 mb-4">
          <div className="w-3 h-3 rounded-full bg-red-500/70" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'rgba(204,255,0,0.7)' }} />
          <div className="ml-3 flex-1 h-5 rounded-full glass" style={{ maxWidth: 140 }} />
        </div>

        {/* Webcam view */}
        <div
          className="relative rounded-xl mb-4 overflow-hidden flex items-center justify-center"
          style={{
            height: 160,
            background: 'linear-gradient(135deg, rgba(12,12,12,0.8), rgba(20,20,20,0.6))',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          {/* Scanning lines effect */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(204,255,0,0.02) 2px, rgba(204,255,0,0.02) 4px)',
            }}
          />
          {/* Face outline */}
          <div
            className="relative w-20 h-24 rounded-2xl border-2 flex items-end justify-center pb-2"
            style={{ borderColor: 'rgba(204,255,0,0.6)' }}
          >
            <LuScanFace
              size={36}
              style={{ color: 'rgba(204,255,0,0.7)', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-60%)' }}
              aria-hidden="true"
            />
            {/* Corner brackets */}
            {[
              'top-0 left-0 border-t-2 border-l-2 rounded-tl-lg',
              'top-0 right-0 border-t-2 border-r-2 rounded-tr-lg',
              'bottom-0 left-0 border-b-2 border-l-2 rounded-bl-lg',
              'bottom-0 right-0 border-b-2 border-r-2 rounded-br-lg',
            ].map((cls, i) => (
              <div
                key={i}
                className={`absolute w-4 h-4 ${cls}`}
                style={{ borderColor: '#ccff00' }}
              />
            ))}
          </div>
          {/* Status indicator */}
          <div
            className="absolute bottom-2 right-2 flex items-center gap-1.5 px-2 py-1 rounded-full"
            style={{ background: 'rgba(12,12,12,0.8)', border: '1px solid rgba(204,255,0,0.3)' }}
          >
            <div className="w-1.5 h-1.5 rounded-full animate-pulse-lime" style={{ backgroundColor: '#ccff00' }} />
            <span className="tech-label" style={{ color: '#ccff00' }}>FACE DETECTED</span>
          </div>
        </div>

        {/* Detection bars */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {['Attention', 'Tab Focus', 'Face', 'Activity'].map((label, i) => {
            const heights = [92, 78, 95, 65];
            return (
              <div key={label} className="flex flex-col items-center gap-1.5">
                <div
                  className="w-full rounded-full overflow-hidden"
                  style={{ height: 48, background: 'rgba(255,255,255,0.05)' }}
                >
                  <motion.div
                    className="w-full rounded-full"
                    style={{ backgroundColor: i === 2 ? '#ccff00' : i === 3 ? 'rgba(204,255,0,0.5)' : 'rgba(204,255,0,0.7)' }}
                    initial={{ height: 0 }}
                    animate={{ height: `${heights[i]}%` }}
                    transition={{ duration: 1.2, delay: 0.6 + i * 0.1, ease: [0.4, 0, 0.2, 1] }}
                    style={{ backgroundColor: '#ccff00', opacity: 0.5 + i * 0.1, height: `${heights[i]}%`, marginTop: 'auto' }}
                  />
                </div>
                <span className="tech-label text-center" style={{ color: 'rgba(235,235,235,0.5)', fontSize: 8 }}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Bottom status */}
        <div
          className="flex items-center justify-between px-3 py-2 rounded-xl"
          style={{ background: 'rgba(204,255,0,0.05)', border: '1px solid rgba(204,255,0,0.1)' }}
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full animate-pulse-lime" style={{ backgroundColor: '#ccff00' }} />
            <span className="text-xs font-medium" style={{ color: '#ccff00' }}>Session Active</span>
          </div>
          <span className="tech-label" style={{ color: 'rgba(235,235,235,0.5)' }}>00:42:18</span>
        </div>
      </div>

      {/* Floating cards */}
      <motion.div
        className="absolute -top-6 -right-6 glass rounded-2xl px-3 py-2 flex items-center gap-2 animate-float"
        style={{ border: '1px solid rgba(204,255,0,0.3)', background: 'rgba(12,12,12,0.9)' }}
      >
        <span className="text-lg">🚨</span>
        <div>
          <div className="text-xs font-semibold" style={{ color: '#ccff00' }}>Violation Alert</div>
          <div className="tech-label" style={{ color: 'rgba(235,235,235,0.5)' }}>Tab switch detected</div>
        </div>
      </motion.div>

      <motion.div
        className="absolute -bottom-4 -left-4 glass rounded-2xl px-3 py-2 flex items-center gap-2 animate-float2"
        style={{ border: '1px solid rgba(16,185,129,0.3)', background: 'rgba(12,12,12,0.9)' }}
      >
        <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs" style={{ backgroundColor: '#ccff00' }}>
          AI
        </div>
        <div>
          <div className="text-xs font-semibold text-[#ebebeb]">AI Cursor</div>
          <div className="tech-label" style={{ color: 'rgba(235,235,235,0.5)' }}>Monitoring active</div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function HeroSection() {
  const navigate = useNavigate();

  return (
    <section
      id="home"
      className="relative min-h-screen flex items-center pt-24 pb-16 px-6 overflow-hidden"
    >
      {/* Background glows */}
      <div
        className="absolute top-0 left-1/4 w-96 h-96 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(204,255,0,0.08) 0%, transparent 70%)', filter: 'blur(120px)' }}
      />
      <div
        className="absolute bottom-0 right-1/4 w-80 h-80 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)', filter: 'blur(120px)' }}
      />

      {/* Grid pattern */}
      <div className="absolute inset-0 grid-pattern opacity-30 pointer-events-none" />

      <div className="relative w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left — 7 cols */}
        <div className="lg:col-span-7">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          >
            {/* Label */}
            <div className="flex items-center gap-3 mb-6">
              <div
                className="h-px flex-1 max-w-[3rem]"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(204,255,0,0.5))' }}
              />
              <span className="tech-label" style={{ color: 'rgba(235,235,235,0.6)' }}>
                AI-POWERED EXAM MONITORING
              </span>
            </div>

            {/* Giant heading */}
            <h1 className="heading-giant text-[#ebebeb] mb-6">
              Keep Every
              <br />
              <em
                className="not-italic"
                style={{
                  background: 'linear-gradient(135deg, #ccff00 0%, #ffffff 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Exam Fair.
              </em>
            </h1>

            <p
              className="text-lg leading-relaxed mb-8 max-w-xl"
              style={{ color: 'rgba(235,235,235,0.6)', fontWeight: 400 }}
            >
              Real-time AI attention detection that monitors every session —
              tab switches, face presence, window focus — with millisecond precision.
              Built for institutions that refuse to compromise on integrity.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap gap-4 mb-10">
              <motion.button
                onClick={() => navigate('/signup')}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.98 }}
                className="px-8 py-4 rounded-full font-semibold text-black text-base transition-all"
                style={{
                  backgroundColor: '#ccff00',
                  boxShadow: '0 0 40px rgba(204,255,0,0.25)',
                }}
                aria-label="Start your free trial"
              >
                Start Free Trial
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
                className="px-8 py-4 rounded-full font-semibold text-[#ebebeb] text-base glass transition-all"
                aria-label="Watch how it works"
              >
                See How It Works →
              </motion.button>
            </div>

            {/* Social proof */}
            <div className="flex items-center gap-6">
              {[
                { num: '1,200+', label: 'Exams Monitored' },
                { num: '99.4%', label: 'Detection Accuracy' },
                { num: '40+', label: 'Institutions' },
              ].map((stat) => (
                <div key={stat.label}>
                  <div className="text-xl font-bold" style={{ color: '#ccff00' }}>{stat.num}</div>
                  <div className="tech-label" style={{ color: 'rgba(235,235,235,0.5)' }}>{stat.label}</div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Right — 5 cols */}
        <div className="lg:col-span-5">
          <HeroMockup />
        </div>
      </div>
    </section>
  );
}
