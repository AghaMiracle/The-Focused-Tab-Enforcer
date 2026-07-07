import { motion } from 'framer-motion';
import { LuBuilding2, LuPuzzle, LuPlay, LuRadio } from 'react-icons/lu';

const steps = [
  {
    num: '01',
    title: 'Institution Registers',
    desc: 'Your institution creates an account, configures monitoring thresholds, and integrates with your existing LMS or exam portal in under 30 minutes.',
    Icon: LuBuilding2,
  },
  {
    num: '02',
    title: 'Student Installs Extension',
    desc: 'Students receive a one-click install link. The extension is lightweight, open-source, and requires only camera + tab permissions.',
    Icon: LuPuzzle,
  },
  {
    num: '03',
    title: 'Exam Session Starts',
    desc: 'The extension activates automatically on exam domains. AI models initialize locally — no data ever leaves the student\'s device.',
    Icon: LuPlay,
  },
  {
    num: '04',
    title: 'Real-Time Monitoring & Alerts',
    desc: 'Admins see a live dashboard of all sessions. Violations are flagged instantly with full context — timestamp, type, severity, and frame snapshot.',
    Icon: LuRadio,
  },
];

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="relative py-24 overflow-hidden"
      style={{ backgroundColor: '#e5e5e5' }}
    >
      {/* Rounded top corners */}
      <div
        className="absolute -top-12 left-0 right-0 h-16 pointer-events-none"
        style={{
          borderTopLeftRadius: '4rem',
          borderTopRightRadius: '4rem',
          backgroundColor: '#e5e5e5',
        }}
      />

      {/* Grid pattern on light bg */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,0,0,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.06) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      <div className="relative max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span
            className="tech-label block mb-4"
            style={{ color: 'rgba(0,0,0,0.4)' }}
          >
            PROCESS
          </span>
          <h2
            className="text-5xl font-bold tracking-tight mb-4"
            style={{ color: '#000000', letterSpacing: '-0.05em' }}
          >
            Up and running in
            <br />
            four simple steps.
          </h2>
          <p className="text-base max-w-lg mx-auto" style={{ color: 'rgba(0,0,0,0.55)' }}>
            No complex server setup. No student training. Just plug in and
            your exams are protected from day one.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, i) => (
            <motion.div
              key={step.num}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.5, delay: i * 0.12, ease: [0.4, 0, 0.2, 1] }}
              className="relative"
            >
              {/* Connector line */}
              {i < steps.length - 1 && (
                <div
                  className="hidden lg:block absolute top-10 left-[calc(100%_-_12px)] w-6 h-0.5 z-10"
                  style={{ background: 'rgba(0,0,0,0.2)' }}
                />
              )}

              <div
                className="rounded-[2.5rem] p-6 h-full flex flex-col transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
                style={{
                  background: '#fff',
                  border: '1px solid rgba(0,0,0,0.08)',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
                }}
              >
                {/* Step number circle */}
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center mb-5 flex-shrink-0"
                  style={{ background: '#000', color: '#ccff00' }}
                >
                  <span
                    style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 14,
                      fontWeight: 600,
                      letterSpacing: '0.05em',
                    }}
                  >
                    {step.num}
                  </span>
                </div>

                <step.Icon
                  size={28}
                  className="mb-3"
                  style={{ color: '#000' }}
                  aria-hidden="true"
                />

                <h3
                  className="text-lg font-semibold mb-2 tracking-tight"
                  style={{ color: '#000', letterSpacing: '-0.03em' }}
                >
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(0,0,0,0.6)' }}>
                  {step.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
