import { motion } from 'framer-motion';
import { testimonials } from '../../data/mockData';

export default function Testimonials() {
  return (
    <section className="relative py-24 px-6">
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[400px] pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(204,255,0,0.05) 0%, transparent 70%)', filter: 'blur(100px)' }}
      />

      <div className="relative max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <span className="tech-label block mb-4" style={{ color: 'rgba(235,235,235,0.5)' }}>
            TESTIMONIALS
          </span>
          <h2
            className="text-5xl font-bold tracking-tight"
            style={{ color: '#ebebeb', letterSpacing: '-0.05em' }}
          >
            Trusted by educators
            <br />
            <span style={{ color: '#ccff00' }}>across the world.</span>
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.12 }}
              whileHover={{
                scale: 1.02,
                borderColor: 'rgba(204,255,0,0.3)',
                transition: { duration: 0.2 },
              }}
              className="rounded-[2.5rem] p-7 flex flex-col gap-5"
              style={{
                background: 'rgba(255,255,255,0.03)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
              role="article"
              aria-label={`Testimonial from ${t.author}`}
            >
              {/* Stars */}
              <div className="flex gap-1">
                {Array.from({ length: 5 }).map((_, si) => (
                  <span key={si} style={{ color: '#ccff00', fontSize: 14 }}>★</span>
                ))}
              </div>

              <blockquote
                className="text-base leading-relaxed flex-1"
                style={{ color: 'rgba(235,235,235,0.8)' }}
              >
                "{t.quote}"
              </blockquote>

              <div className="flex items-center gap-3 pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{ backgroundColor: 'rgba(204,255,0,0.15)', color: '#ccff00' }}
                >
                  {t.avatar}
                </div>
                <div>
                  <div className="text-sm font-semibold text-[#ebebeb]">{t.author}</div>
                  <div className="tech-label" style={{ color: 'rgba(235,235,235,0.4)' }}>{t.role}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
