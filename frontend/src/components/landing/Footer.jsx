import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

export default function Footer() {
  const navigate = useNavigate();
  const year = new Date().getFullYear();

  return (
    <footer
      id="contact"
      className="relative pt-24 pb-8 px-6 overflow-hidden"
      style={{ backgroundColor: '#000000' }}
      aria-label="Site footer"
    >
      {/* Massive watermark */}
      <div
        className="absolute top-12 left-0 right-0 text-center pointer-events-none select-none"
        style={{
          fontSize: 'clamp(5rem, 12vw, 10rem)',
          fontWeight: 700,
          letterSpacing: '-0.06em',
          color: 'rgba(235,235,235,0.05)',
          fontFamily: 'Space Grotesk, sans-serif',
          lineHeight: 1,
          userSelect: 'none',
        }}
        aria-hidden="true"
      >
        FOCUSED
      </div>

      {/* CTA block */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7 }}
        className="relative max-w-4xl mx-auto text-center mb-20"
      >
        <span className="tech-label block mb-6" style={{ color: 'rgba(235,235,235,0.4)' }}>
          GET STARTED TODAY
        </span>
        <h2
          className="text-5xl md:text-6xl font-bold tracking-tight mb-8"
          style={{ color: '#ebebeb', letterSpacing: '-0.05em' }}
        >
          Your next exam deserves
          <br />
          <span style={{ color: '#ccff00' }}>real protection.</span>
        </h2>

        {/* Oversized lime CTA with hover animation */}
        <div className="relative inline-block group">
          <button
            onClick={() => navigate('/signup')}
            className="relative z-10 px-12 py-5 rounded-full text-lg font-bold text-black overflow-hidden transition-all duration-300 group-hover:text-black"
            style={{ backgroundColor: '#ccff00', boxShadow: '0 0 60px rgba(204,255,0,0.2)' }}
            aria-label="Deploy Focused Tab Enforcer now"
          >
            {/* Slide-up white bg on hover */}
            <span
              className="absolute inset-0 bg-white rounded-full transform translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out"
              aria-hidden="true"
            />
            <span className="relative z-10">Deploy Now — It's Free →</span>
          </button>
        </div>
      </motion.div>

      {/* Footer bottom */}
      <div
        className="relative max-w-7xl mx-auto border-t pt-10"
        style={{ borderColor: 'rgba(255,255,255,0.08)' }}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">
          {/* Brand col */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm text-black"
                style={{ backgroundColor: '#ccff00' }}
              >
                FT
              </div>
              <span className="font-semibold text-[#ebebeb]">Focused Tab Enforcer</span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(235,235,235,0.4)' }}>
              AI-powered exam monitoring for institutions that value academic integrity above all.
            </p>
          </div>

          {/* Links col */}
          <div>
            <h4 className="tech-label mb-4" style={{ color: 'rgba(235,235,235,0.4)' }}>PRODUCT</h4>
            <ul className="flex flex-col gap-2">
              {['Features', 'Pricing', 'How It Works', 'Documentation', 'Changelog'].map((l) => (
                <li key={l}>
                  <button
                    className="text-sm transition-colors hover:text-[#ccff00]"
                    style={{ color: 'rgba(235,235,235,0.5)' }}
                  >
                    {l}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal col */}
          <div>
            <h4 className="tech-label mb-4" style={{ color: 'rgba(235,235,235,0.4)' }}>LEGAL & SUPPORT</h4>
            <ul className="flex flex-col gap-2">
              {['Privacy Policy', 'Terms of Service', 'Cookie Policy', 'Data Retention', 'Contact Support'].map((l) => (
                <li key={l}>
                  <button
                    className="text-sm transition-colors hover:text-[#ccff00]"
                    style={{ color: 'rgba(235,235,235,0.5)' }}
                  >
                    {l}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="flex flex-col md:flex-row items-center justify-between gap-4 pt-6 border-t"
          style={{ borderColor: 'rgba(255,255,255,0.06)' }}
        >
          <span
            className="tech-label text-center"
            style={{ color: 'rgba(235,235,235,0.3)' }}
          >
            © {year} FOCUSED TAB ENFORCER — ALL RIGHTS RESERVED
          </span>

          {/* Social icons — hollow circles */}
          <div className="flex items-center gap-3">
            {[
              { label: 'Twitter/X', icon: '✕' },
              { label: 'GitHub', icon: '⌥' },
              { label: 'LinkedIn', icon: 'in' },
              { label: 'Email', icon: '@' },
            ].map((s) => (
              <button
                key={s.label}
                aria-label={s.label}
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs transition-all duration-200 hover:border-[#ccff00] hover:text-[#ccff00]"
                style={{
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: 'rgba(235,235,235,0.5)',
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              >
                {s.icon}
              </button>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
