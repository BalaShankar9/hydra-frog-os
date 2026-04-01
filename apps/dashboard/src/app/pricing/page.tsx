'use client';

import Link from 'next/link';

const PLANS = [
  {
    name: 'Guest',
    price: null,
    label: 'No account needed',
    description: 'Try the platform instantly',
    features: [
      '2 crawls',
      '100 pages per crawl',
      'AI SEO Copilot',
      'Competitor analysis',
      '1 project',
    ],
    cta: 'Try it now',
    ctaHref: '/',
    highlight: false,
    tier: 'GUEST',
  },
  {
    name: 'Starter',
    price: null,
    label: 'Create an account',
    description: 'For individuals and small sites',
    features: [
      '10 crawls',
      '500 pages per crawl',
      'AI SEO Copilot',
      'Competitor analysis',
      'Unlimited projects',
      'CSV export',
      'Crawl diffs',
    ],
    cta: 'Sign up',
    ctaHref: '/signup',
    highlight: false,
    tier: 'STARTER',
  },
  {
    name: 'Pro',
    price: '$29',
    label: '/month',
    description: 'For agencies and growing teams',
    features: [
      '100 crawls / month',
      '5,000 pages per crawl',
      'Everything in Starter',
      'JavaScript rendering',
      'Performance auditing',
      'Template clustering',
      'Fix suggestions',
      'Marketing studio',
      'White-label branding',
      'Priority support',
    ],
    cta: 'Coming soon',
    ctaHref: null,
    highlight: true,
    tier: 'PRO',
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    label: '',
    description: 'For large organizations',
    features: [
      'Unlimited crawls',
      '50,000 pages per crawl',
      'Everything in Pro',
      'SSO / SAML',
      'Dedicated infrastructure',
      'Custom integrations',
      'SLA guarantee',
      'Dedicated account manager',
    ],
    cta: 'Contact us',
    ctaHref: null,
    highlight: false,
    tier: 'ENTERPRISE',
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Nav */}
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
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">Simple, transparent pricing</h1>
          <p className="text-lg text-gray-400 max-w-xl mx-auto">
            Start crawling with no account. Scale up as you grow.
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
              <div className="mb-4">
                {plan.price ? (
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold">{plan.price}</span>
                    {plan.label && <span className="text-gray-400 text-sm">{plan.label}</span>}
                  </div>
                ) : (
                  <div className="text-sm text-gray-400 py-1">{plan.label}</div>
                )}
              </div>
              <p className="text-sm text-gray-400 mb-6">{plan.description}</p>

              <ul className="space-y-2.5 mb-8 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-gray-300">
                    <CheckIcon className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    {feature}
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
                  className="w-full py-2.5 rounded-lg text-center text-sm font-semibold bg-white/5 border border-gray-700 text-gray-400 cursor-not-allowed"
                >
                  {plan.cta}
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="text-center mt-16 text-sm text-gray-500">
          All plans include AI SEO Copilot, competitor analysis, and dark mode dashboard.
        </div>
      </div>

      {/* Footer */}
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

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
    </svg>
  );
}
