import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const links = ['Home', 'Features', 'How It Works', 'Pricing', 'Contact'];

  const scrollTo = (id) => {
    const el = document.getElementById(id.toLowerCase().replace(/\s+/g, '-'));
    if (el) el.scrollIntoView({ behavior: 'smooth' });
    setMobileOpen(false);
  };

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
      className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-4 px-4"
      aria-label="Main navigation"
    >
      <div
        className={`w-full max-w-6xl flex items-center justify-between px-4 py-3 rounded-2xl transition-all duration-300 ${
          scrolled
            ? 'glass shadow-2xl shadow-black/50'
            : 'bg-transparent'
        }`}
      >
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3" aria-label="Focused Tab Enforcer Home">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm text-black"
            style={{ backgroundColor: '#ccff00' }}>
            FT
          </div>
          <span className="font-semibold text-[#ebebeb] text-sm hidden sm:block tracking-tight">
            Focused Tab Enforcer
          </span>
        </Link>

        {/* Center pill nav — desktop */}
        <nav
          className="hidden md:flex items-center gap-1 px-4 py-2 rounded-full"
          style={{
            background: 'rgba(255,255,255,0.05)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
          aria-label="Page sections"
        >
          {links.map((link) => (
            <button
              key={link}
              onClick={() => scrollTo(link)}
              className="px-3 py-1.5 text-sm rounded-full transition-all duration-200 hover:text-[#ccff00] hover:bg-white/5"
              style={{ color: 'rgba(235,235,235,0.7)', fontFamily: 'Space Grotesk, sans-serif' }}
            >
              {link}
            </button>
          ))}
        </nav>

        {/* Right */}
        <div className="hidden md:flex items-center gap-4">
          {/* System status */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full glass">
            <span
              className="w-2 h-2 rounded-full animate-pulse-lime"
              style={{ backgroundColor: '#ccff00' }}
            />
            <span className="tech-label" style={{ color: 'rgba(235,235,235,0.7)' }}>
              System Online
            </span>
          </div>
          <button
            onClick={() => navigate('/signup')}
            className="px-5 py-2 rounded-full text-sm font-semibold text-black transition-all duration-200 hover:scale-105 hover:shadow-lg"
            style={{ backgroundColor: '#ccff00', boxShadow: '0 0 20px rgba(204,255,0,0.3)' }}
            aria-label="Get started — register your institution"
          >
            Get Started
          </button>
        </div>

        {/* Hamburger — mobile */}
        <button
          className="md:hidden flex flex-col gap-1.5 p-2"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
        >
          <span className={`w-5 h-0.5 bg-[#ebebeb] transition-all duration-200 ${mobileOpen ? 'rotate-45 translate-y-2' : ''}`} />
          <span className={`w-5 h-0.5 bg-[#ebebeb] transition-all duration-200 ${mobileOpen ? 'opacity-0' : ''}`} />
          <span className={`w-5 h-0.5 bg-[#ebebeb] transition-all duration-200 ${mobileOpen ? '-rotate-45 -translate-y-2' : ''}`} />
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full mt-2 left-4 right-4 glass rounded-2xl p-4 flex flex-col gap-2"
            style={{ background: 'rgba(12,12,12,0.95)' }}
          >
            {links.map((link) => (
              <button
                key={link}
                onClick={() => scrollTo(link)}
                className="text-left px-4 py-3 rounded-xl text-sm hover:bg-white/5 transition-colors"
                style={{ color: 'rgba(235,235,235,0.7)' }}
              >
                {link}
              </button>
            ))}
            <div className="border-t border-white/10 mt-2 pt-4 flex flex-col gap-2">
              <button
                onClick={() => { navigate('/signup'); setMobileOpen(false); }}
                className="px-5 py-3 rounded-xl text-sm font-semibold text-black text-center"
                style={{ backgroundColor: '#ccff00' }}
              >
                Get Started
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
