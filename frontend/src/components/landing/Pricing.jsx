import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const plans = [
  {
    name: 'Starter',
    price: '$49',
    period: '/month',
    description: 'Perfect for small institutions running occasional assessments.',
    features: [
      'Up to 50 students',
      '10 exams/month',
      'Basic violation detection',
      'PDF report export',
      'Email alerts',
      '7-day data retention',
    ],
    cta: 'Get Started',
    highlight: false,
  },
  {
    name: 'Professional',
    price: '$149',
    period: '/month',
    description: 'The full suite for institutions serious about exam integrity.',
    features: [
      'Up to 500 students',
      'Unlimited exams',
      'Full AI detection suite',
      'Live monitoring dashboard',
      'CSV + PDF exports',
      'API access',
      '90-day data retention',
      'Priority support',
    ],
    cta: 'Start Free Trial',
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'Built for universities and large-scale exam providers.',
    features: [
      'Unlimited students',
      'Unlimited exams',
      'Custom AI thresholds',
      'SSO & LMS integration',
      'Dedicated infrastructure',
      'SLA guarantee',
      'Unlimited data retention',
      'Dedicated support team',
    ],
    cta: 'Contact Sales',
    highlight: false,
  },
];

export default function Pricing() {
  const navigate = useNavigate();

  return (
    <section id="pricing" className="relative py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <span className="tech-label block mb-4" style={{ color: 'rgba(235,235,235,0.5)' }}>
            PRICING
          </span>
          <h2
            className="text-5xl font-bold tracking-tight mb-4"
            style={{ color: '#ebebeb', letterSpacing: '-0.05em' }}
          >
            Simple, transparent
            <br />
            <span style={{ color: '#ccff00' }}>pricing for every scale.</span>
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              whileHover={{ scale: 1.02 }}
              className="relative rounded-[2.5rem] p-8 flex flex-col"
              style={{
                background: plan.highlight ? 'rgba(204,255,0,0.06)' : 'rgba(255,255,255,0.03)',
                backdropFilter: 'blur(16px)',
                border: plan.highlight
                  ? '1px solid rgba(204,255,0,0.4)'
                  : '1px solid rgba(255,255,255,0.1)',
              }}
            >
              {plan.highlight && (
                <div
                  className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-semibold text-black"
                  style={{ backgroundColor: '#ccff00' }}
                >
                  MOST POPULAR
                </div>
              )}

              <div className="mb-6">
                <span className="tech-label block mb-2" style={{ color: plan.highlight ? '#ccff00' : 'rgba(235,235,235,0.5)' }}>
                  {plan.name.toUpperCase()}
                </span>
                <div className="flex items-end gap-1 mb-2">
                  <span
                    className="text-4xl font-bold tracking-tight"
                    style={{ color: '#ebebeb', letterSpacing: '-0.04em' }}
                  >
                    {plan.price}
                  </span>
                  <span className="text-sm mb-1" style={{ color: 'rgba(235,235,235,0.5)' }}>
                    {plan.period}
                  </span>
                </div>
                <p className="text-sm" style={{ color: 'rgba(235,235,235,0.6)' }}>
                  {plan.description}
                </p>
              </div>

              <ul className="flex flex-col gap-2.5 mb-8 flex-1">
                {plan.features.map((feat) => (
                  <li key={feat} className="flex items-center gap-2.5 text-sm" style={{ color: 'rgba(235,235,235,0.8)' }}>
                    <span style={{ color: '#ccff00', flexShrink: 0 }}>✓</span>
                    {feat}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => navigate(plan.name === 'Enterprise' ? '/login' : '/signup')}
                className="w-full py-3 rounded-2xl font-semibold text-sm transition-all duration-200 hover:scale-[1.02]"
                style={
                  plan.highlight
                    ? { backgroundColor: '#ccff00', color: '#000' }
                    : { background: 'rgba(255,255,255,0.08)', color: '#ebebeb', border: '1px solid rgba(255,255,255,0.1)' }
                }
                aria-label={`${plan.cta} — ${plan.name} plan`}
              >
                {plan.cta}
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
