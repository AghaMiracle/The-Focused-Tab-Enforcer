import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useEffect, useState } from 'react';

function AnimatedNumber({ value }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const controls = animate(0, value, {
      duration: 1.5,
      ease: [0.4, 0, 0.2, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return controls.stop;
  }, [value]);

  return <span>{display.toLocaleString()}</span>;
}

export default function StatCard({ label, value, unit = '', Icon, trend, highlight = false, loading = false }) {
  if (loading) {
    return (
      <div
        className="rounded-[2rem] p-6 animate-pulse"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="w-8 h-8 rounded-xl bg-white/5 mb-4" />
        <div className="w-16 h-7 rounded-lg bg-white/5 mb-2" />
        <div className="w-24 h-4 rounded-lg bg-white/5" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, borderColor: 'rgba(204,255,0,0.3)' }}
      transition={{ duration: 0.3 }}
      className="rounded-[2rem] p-6 flex flex-col gap-2"
      style={{
        background: highlight ? 'rgba(204,255,0,0.06)' : 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(16px)',
        border: highlight ? '1px solid rgba(204,255,0,0.25)' : '1px solid rgba(255,255,255,0.08)',
      }}
      role="region"
      aria-label={`${label}: ${value}${unit}`}
    >
      <div className="flex items-center justify-between">
        {Icon && (
          <Icon
            size={22}
            style={{ color: highlight ? '#ccff00' : 'rgba(235,235,235,0.5)' }}
            aria-hidden="true"
          />
        )}
        {trend !== undefined && (
          <span
            className="tech-label px-2 py-0.5 rounded-full"
            style={{
              color: trend >= 0 ? '#ccff00' : '#f87171',
              background: trend >= 0 ? 'rgba(204,255,0,0.1)' : 'rgba(239,68,68,0.1)',
            }}
          >
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div>
        <div
          className="text-3xl font-bold tracking-tight"
          style={{ color: highlight ? '#ccff00' : '#ebebeb', letterSpacing: '-0.04em' }}
        >
          <AnimatedNumber value={typeof value === 'number' ? value : parseInt(value) || 0} />
          {unit && <span className="text-lg ml-0.5">{unit}</span>}
        </div>
        <div className="tech-label mt-1" style={{ color: 'rgba(235,235,235,0.45)' }}>
          {label}
        </div>
      </div>
    </motion.div>
  );
}
