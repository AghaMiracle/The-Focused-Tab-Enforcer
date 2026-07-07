import { motion } from 'framer-motion';
import {
  LuZap,
  LuScanFace,
  LuShieldCheck,
  LuMonitor,
  LuSiren,
  LuScrollText,
  LuSlidersHorizontal,
} from 'react-icons/lu';

function AnimatedBars() {
  const bars = [40, 65, 80, 55, 90, 45, 75, 60, 85, 50, 70, 95];
  return (
    <div className="flex items-end gap-1 h-20 mt-auto">
      {bars.map((h, i) => (
        <motion.div
          key={i}
          className="flex-1 rounded-t-sm"
          style={{ backgroundColor: 'rgba(204,255,0,0.6)' }}
          animate={{ height: [`${h * 0.5}%`, `${h}%`, `${h * 0.7}%`, `${h}%`] }}
          transition={{
            duration: 2 + i * 0.2,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 0.1,
          }}
        />
      ))}
    </div>
  );
}

const features = [
  {
    id: 'tab-monitoring',
    size: 'large',
    title: 'Real-Time Tab Monitoring',
    description: 'Detects every tab switch, new window, and domain change the moment it happens — with configurable tolerance thresholds.',
    Icon: LuZap,
  },
  {
    id: 'facial-detection',
    size: 'tall',
    title: 'Facial Presence Detection',
    description: 'On-device AI verifies the right student is present throughout the exam.',
    Icon: LuScanFace,
    states: [
      { label: 'Present', color: '#ccff00', dot: '#ccff00' },
      { label: 'Absent',  color: '#ef4444', dot: '#ef4444' },
      { label: 'Multiple',color: '#f97316', dot: '#f97316' },
      { label: 'Partial', color: '#eab308', dot: '#eab308' },
    ],
  },
  {
    id: 'privacy',
    size: 'accent',
    title: 'Privacy First',
    description: 'All AI processing happens entirely on the student\'s device. Zero frames uploaded. Zero data leaves the browser.',
    Icon: LuShieldCheck,
    accent: true,
  },
  {
    id: 'window-focus',
    size: 'standard',
    title: 'Window Focus Tracking',
    description: 'Logs every second the exam window is out of focus, with precise duration tracking.',
    Icon: LuMonitor,
  },
  {
    id: 'alerts',
    size: 'standard',
    title: 'Instant Violation Alerts',
    description: 'Real-time alerts pushed to admin dashboard the moment thresholds are crossed.',
    Icon: LuSiren,
  },
  {
    id: 'logs',
    size: 'standard',
    title: 'Comprehensive Session Logs',
    description: 'Full timeline of every event — exportable to PDF or CSV for academic records.',
    Icon: LuScrollText,
  },
  {
    id: 'thresholds',
    size: 'standard',
    title: 'Configurable Thresholds',
    description: 'Set custom sensitivity per exam: tab switch tolerance, face absence limits, multiple-face policy.',
    Icon: LuSlidersHorizontal,
  },
];

function FeatureCard({ feature, index }) {
  const baseClass = `relative rounded-[2.5rem] p-6 overflow-hidden group transition-all duration-300 cursor-default`;
  const glassStyle = {
    background: feature.accent ? '#ccff00' : 'rgba(255,255,255,0.03)',
    backdropFilter: feature.accent ? 'none' : 'blur(16px)',
    border: `1px solid ${feature.accent ? 'transparent' : 'rgba(255,255,255,0.1)'}`,
  };

  const gridClass = {
    large: 'col-span-2 row-span-2',
    tall: 'col-span-1 row-span-2',
    accent: 'col-span-1 row-span-1',
    standard: 'col-span-1 row-span-1',
  }[feature.size];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: [0.4, 0, 0.2, 1] }}
      whileHover={{
        scale: 1.02,
        borderColor: 'rgba(204,255,0,0.4)',
        transition: { duration: 0.2 },
      }}
      className={`${baseClass} ${gridClass}`}
      style={{
        ...glassStyle,
        ...(feature.id === 'tab-monitoring' ? { minHeight: 280 } : {}),
      }}
      role="article"
      aria-label={feature.title}
    >
      {/* Noise overlay for accent card */}
      {feature.accent && (
        <div
          className="absolute inset-0 pointer-events-none rounded-[2.5rem]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.15'/%3E%3C/svg%3E")`,
            opacity: 0.3,
          }}
        />
      )}

      {/* Hover glow */}
      {!feature.accent && (
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-[2.5rem]"
          style={{ background: 'radial-gradient(circle at 50% 0%, rgba(204,255,0,0.05) 0%, transparent 60%)' }}
        />
      )}

      <div className="relative z-10 h-full flex flex-col">
        <div className="flex items-start justify-between mb-3">
          <feature.Icon
            size={24}
            style={{ color: feature.accent ? '#000' : '#ccff00' }}
            aria-hidden="true"
          />
          <div
            className="tech-label px-2 py-1 rounded-full"
            style={{
              background: feature.accent ? 'rgba(0,0,0,0.15)' : 'rgba(204,255,0,0.1)',
              color: feature.accent ? '#000' : '#ccff00',
            }}
          >
            ACTIVE
          </div>
        </div>

        <h3
          className="text-lg font-semibold mb-2 tracking-tight"
          style={{
            color: feature.accent ? '#000' : '#ebebeb',
            letterSpacing: '-0.03em',
          }}
        >
          {feature.title}
        </h3>
        <p
          className="text-sm leading-relaxed"
          style={{ color: feature.accent ? 'rgba(0,0,0,0.7)' : 'rgba(235,235,235,0.6)' }}
        >
          {feature.description}
        </p>

        {/* Large card: animated bars */}
        {feature.size === 'large' && (
          <div className="mt-auto pt-4 flex flex-col gap-1">
            <span className="tech-label mb-2" style={{ color: 'rgba(235,235,235,0.4)' }}>
              DETECTION ACTIVITY
            </span>
            <AnimatedBars />
          </div>
        )}

        {/* Tall card: detection state swatches */}
        {feature.size === 'tall' && feature.states && (
          <div className="mt-auto pt-4 flex flex-col gap-2">
            {feature.states.map((state) => (
              <div
                key={state.label}
                className="flex items-center gap-3 px-3 py-2 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: state.dot }} />
                <span className="text-sm" style={{ color: 'rgba(235,235,235,0.8)' }}>{state.label}</span>
                <div
                  className="ml-auto h-1.5 rounded-full"
                  style={{
                    width: state.label === 'Present' ? 60 : state.label === 'Absent' ? 20 : state.label === 'Multiple' ? 12 : 35,
                    backgroundColor: state.color,
                    opacity: 0.7,
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function BentoFeatures() {
  return (
    <section id="features" className="relative py-24 px-6">
      {/* Background glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.06) 0%, transparent 70%)', filter: 'blur(120px)' }}
      />

      <div className="relative max-w-7xl mx-auto">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <span className="tech-label block mb-4" style={{ color: 'rgba(235,235,235,0.5)' }}>
            CAPABILITIES
          </span>
          <h2
            className="text-5xl font-bold tracking-tight mb-4"
            style={{ color: '#ebebeb', letterSpacing: '-0.05em' }}
          >
            Everything you need to
            <br />
            <span style={{ color: '#ccff00' }}>enforce academic integrity.</span>
          </h2>
          <p className="text-base max-w-lg mx-auto" style={{ color: 'rgba(235,235,235,0.5)' }}>
            A full suite of AI detection tools, packaged in a lightweight browser extension
            that requires zero infrastructure from students.
          </p>
        </motion.div>

        {/* Bento grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 auto-rows-[180px]">
          {features.map((feature, i) => (
            <FeatureCard key={feature.id} feature={feature} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
