'use client';

import Link from 'next/link';

const PLANS = [
  {
    name: 'Guest',
    price: '$0',
    period: 'forever',
    description: 'Try the full platform instantly',
    features: [
      { text: 'Unlimited crawls', included: true },
      { text: '500 pages per crawl', included: true },
      { text: '1 project', included: true },
      { text: 'AI Copilot (5 queries/day)', included: true },
      { text: 'Issue detection (15+ rules)', included: true },
      { text: 'Crawl diffs', included: true },
      { text: 'Dark mode dashboard', included: true },
      { text: 'Competitor analysis', included: false },
      { text: 'JavaScript rendering', included: false },
      { text: 'Performance auditing', included: false },
    ],
    cta: 'Try it now',
    ctaHref: '/',
    highlight: false,
  },
  {
    name: 'Starter',
    price: '$8.99',
    period: '/month',
    description: 'For individuals and growing sites',
    features: [
      { text: 'Unlimited crawls', included: true },
      { text: '10,000 pages per crawl', included: true },
      { text: '3 projects', included: true },
      { text: 'AI Copilot (25 queries/day)', included: true },
      { text: 'Competitor analysis', included: true },
      { text: 'Template clustering', included: true },
      { text: 'Fix suggestions', included: true },
      { text: 'CSV export', included: true },
      { text: 'JavaScript rendering', included: false },
      { text: 'Performance auditing', included: false },
    ],
    cta: 'Sign up',
    ctaHref: '/signup',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '$49',
    period: '/month',
    description: 'For agencies and serious SEO teams',
    features: [
      { text: 'Unlimited crawls', included: true },
      { text: '50,000 pages per crawl', included: true },
      { text: 'Unlimited projects', included: true },
      { text: 'Unlimited AI Copilot', included: true },
      { text: 'Competitor deep insights', included: true },
      { text: 'JavaScript rendering (Puppeteer)', included: true },
      { text: 'Performance auditing (Lighthouse)', included: true },
      { text: 'Marketing studio', included: true },
      { text: 'Up to 5 team members', included: true },
      { text: 'Priority support', included: true },
    ],
    cta: 'Coming soon',
    ctaHref: null,
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For large organizations',
    features: [
      { text: 'Unlimited everything', included: true },
      { text: 'Unlimited pages per crawl', included: true },
      { text: 'Unlimited team members', included: true },
      { text: 'White-label branding', included: true },
      { text: 'Custom integrations', included: true },
      { text: 'Dedicated infrastructure', included: true },
      { text: 'SSO / SAML', included: true },
      { text: 'SLA guarantee', included: true },
      { text: 'Dedicated account manager', included: true },
      { text: 'On-premise deployment', included: true },
    ],
    cta: 'Contact us',
    ctaHref: null,
    highlight: false,
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-gray-800/50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold tracking-tight">
            Hydra<span className="text-blue-400">Frog</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors">
              Sign in
            </Link>
            <Link href="/signup" className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors">
              Sign up
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">Crawl unlimited. Pay for depth.</h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Every plan includes unlimited crawls. As you upgrade, you unlock more pages per crawl, deeper analysis, JS rendering, performance auditing, and competitor insights.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl border p-6 flex flex-col ${
                plan.highlight
                  ? 'border-blue-500 bg-blue-950/30 ring-1 ring-blue-500/50'
                  : 'border-gray-800 bg-gray-900/50'
              }`}
            >
              {plan.highlight && (
                <div className="text-xs font-semibold text-blue-400 uppercase tracking-wide mb-3">Most popular</div>
              )}
              <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
              <div className="mb-1">
                <span className="text-3xl font-bold">{plan.price}</span>
                {plan.period && <span className="text-gray-400 text-sm ml-1">{plan.period}</span>}
              </div>
              <p className="text-sm text-gray-400 mb-6">{plan.description}</p>

              <ul className="space-y-2.5 mb-8 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature.text} className={`flex items-start gap-2 text-sm ${feature.included ? 'text-gray-300' : 'text-gray-600'}`}>
                    {feature.included ? (
                      <CheckIcon className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    ) : (
                      <XMarkIcon className="w-4 h-4 text-gray-700 mt-0.5 flex-shrink-0" />
                    )}
                    {feature.text}
                  </li>
                ))}
              </ul>

              {plan.ctaHref ? (
                <Link
                  href={plan.ctaHref}
                  className={`w-full py-2.5 rounded-lg text-center text-sm font-semibold transition-colors ${
                    plan.highlight
                      ? 'bg-blue-600 hover:bg-blue-500 text-white'
                      : 'bg-white/5 hover:bg-white/10 border border-gray-700 text-gray-200'
                  }`}
                >
                  {plan.cta}
                </Link>
              ) : (
                <button
                  disabled
                  className="w-full py-2.5 rounded-lg text-center text-sm font-semibold bg-white/5 border border-gray-700 text-gray-500 cursor-not-allowed"
                >
                  {plan.cta}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* What unlocks with each upgrade */}
        <div className="mt-24">
          <h2 className="text-2xl font-bold text-center mb-12">What unlocks as you upgrade</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <UpgradeCard
              tier="Starter"
              tagline="Sign up to unlock"
              items={[
                'Crawl up to 10,000 pages per run',
                'Competitor analysis — see how you stack up',
                'AI fix suggestions ranked by impact',
                'Template clustering — find template-wide issues',
                'Manage up to 3 projects',
              ]}
            />
            <UpgradeCard
              tier="Pro"
              tagline="$49/mo to unlock"
              items={[
                'Crawl up to 50,000 pages per run',
                'JavaScript rendering — crawl SPAs properly',
                'Lighthouse performance auditing — Core Web Vitals',
                'Competitor deep insights with detailed breakdowns',
                'Marketing studio for content planning',
                'Up to 5 team members',
                'Unlimited AI Copilot queries',
                'Unlimited projects',
              ]}
            />
            <UpgradeCard
              tier="Enterprise"
              tagline="Custom pricing"
              items={[
                'Unlimited pages per crawl',
                'White-label branding — your logo, your colors',
                'SSO / SAML authentication',
                'Dedicated infrastructure',
                'Custom API integrations',
                'SLA guarantee',
                'Unlimited team members',
              ]}
            />
          </div>
        </div>

        <div className="text-center mt-16 text-sm text-gray-500">
          All plans include unlimited crawls, AI SEO Copilot, crawl diffs, issue detection, CSV export, and dark mode.
        </div>
      </div>

      <footer className="border-t border-gray-800/50 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <span>Built by <a href="https://github.com/BalaShankar9" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-white">Bala Shankar</a> at Bala Labs</span>
          <div className="flex items-center gap-6">
            <a href="https://github.com/BalaShankar9/hydra-frog-os" target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 transition-colors">GitHub</a>
            <Link href="/" className="hover:text-gray-300 transition-colors">Home</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function UpgradeCard({ tier, tagline, items }: { tier: string; tagline: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
      <h3 className="text-lg font-bold text-white mb-1">{tier}</h3>
      <p className="text-sm text-blue-400 mb-4">{tagline}</p>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-gray-300">
            <ArrowIcon className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
    </svg>
  );
}

function XMarkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
    </svg>
  );
}

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
    </svg>
  );
}
