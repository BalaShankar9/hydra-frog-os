'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { isAuthed, setToken } from '@/lib/auth';
import { authApi } from '@/lib/api';

export default function LandingPage() {
  const router = useRouter();

  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    if (isAuthed()) {
      router.replace('/dashboard');
    }
  }, [router]);

  const handleTryIt = async () => {
    setIsStarting(true);
    try {
      const res = await authApi.guest();
      setToken(res.accessToken);
      router.push('/dashboard');
    } catch {
      // If API is not connected, go to signup
      router.push('/signup');
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white overflow-hidden">
      {/* Nav */}
      <nav className="border-b border-gray-800/50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-xl font-bold tracking-tight text-white">
            Hydra<span className="text-blue-400">Frog</span>
          </span>
          <div className="flex items-center gap-3">
            <Link
              href="/pricing"
              className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
            >
              Pricing
            </Link>
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
            >
              Sign in
            </Link>
            <button
              onClick={handleTryIt} disabled={isStarting}
              className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors disabled:opacity-70"
            >
              {isStarting ? 'Starting...' : 'Try it'}
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(59,130,246,0.15)_0%,_transparent_70%)]" />
        <div className="relative max-w-4xl mx-auto px-6 pt-24 pb-20 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium mb-8">
            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
            Open source &middot; MIT Licensed
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
            Stop guessing.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
              Start crawling.
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            The SEO crawler that finds every broken link, missing tag, and performance issue on your site &mdash; then uses AI to tell you exactly what to fix first.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={handleTryIt} disabled={isStarting}
              className="w-full sm:w-auto px-8 py-3.5 text-base font-semibold bg-blue-600 hover:bg-blue-500 rounded-xl transition-all hover:shadow-lg hover:shadow-blue-500/25 disabled:opacity-70"
            >
              {isStarting ? 'Setting up...' : 'Try it now'}
            </button>
            <a
              href="https://github.com/BalaShankar9/hydra-frog-os"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-8 py-3.5 text-base font-semibold bg-white/5 hover:bg-white/10 border border-gray-700 hover:border-gray-600 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <GitHubIcon className="w-5 h-5" />
              View on GitHub
            </a>
          </div>

          <p className="mt-6 text-sm text-gray-500">
            No signup required &middot; Explore the full dashboard instantly
          </p>
        </div>
      </section>

      {/* Social proof bar */}
      <div className="border-y border-gray-800/50 py-6">
        <div className="max-w-4xl mx-auto px-6 flex flex-wrap items-center justify-center gap-x-12 gap-y-4 text-sm text-gray-500">
          <span>Built with <strong className="text-gray-300">NestJS</strong></span>
          <span className="hidden sm:inline text-gray-700">&middot;</span>
          <span>Powered by <strong className="text-gray-300">Groq AI</strong></span>
          <span className="hidden sm:inline text-gray-700">&middot;</span>
          <span>Hosted on <strong className="text-gray-300">Supabase</strong> + <strong className="text-gray-300">Vercel</strong></span>
        </div>
      </div>

      {/* Features grid */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Everything you need to audit any website</h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Crawl, analyze, compare, and fix &mdash; all from one platform.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <FeatureCard
            icon="🕷️"
            title="Distributed Crawler"
            description="Crawl thousands of pages in minutes with BullMQ workers. JavaScript rendering via Puppeteer for SPAs."
          />
          <FeatureCard
            icon="🤖"
            title="AI SEO Copilot"
            description="Ask questions in plain English. 'Show me pages with thin content' or 'What should I fix first?' — powered by Groq."
          />
          <FeatureCard
            icon="🔀"
            title="Competitor Analysis"
            description="Side-by-side comparison of your domain vs competitors. Find content gaps and technical advantages."
          />
          <FeatureCard
            icon="📊"
            title="Crawl Diffs"
            description="Track what changed between crawls. Detect new pages, removed URLs, status code changes, and regressions."
          />
          <FeatureCard
            icon="⚡"
            title="Performance Auditing"
            description="Lighthouse integration for Core Web Vitals. LCP, CLS, INP scores on every page with regression detection."
          />
          <FeatureCard
            icon="🔧"
            title="Fix Suggestions"
            description="AI-generated fix recommendations ranked by impact. Priority scores tell you what moves the needle most."
          />
          <FeatureCard
            icon="🗂️"
            title="Template Clustering"
            description="Automatically groups pages by structure. Find template-wide issues affecting hundreds of pages at once."
          />
          <FeatureCard
            icon="🏢"
            title="Multi-Tenant"
            description="Built for agencies. Unlimited organizations, projects, and team members with role-based access control."
          />
          <FeatureCard
            icon="🌙"
            title="Dark Mode"
            description="Full dark mode across every page. Sortable tables, CSV export, keyboard navigation, and accessibility built in."
          />
        </div>
      </section>

      {/* AI Copilot preview */}
      <section className="border-y border-gray-800/50 bg-gray-900/30">
        <div className="max-w-4xl mx-auto px-6 py-24">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ask your data anything</h2>
            <p className="text-gray-400 text-lg">The AI Copilot turns crawl data into actionable insights instantly.</p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-2xl mx-auto">
            <div className="space-y-4">
              <div className="flex justify-end">
                <div className="bg-blue-600 rounded-2xl rounded-br-md px-4 py-2.5 max-w-xs">
                  <p className="text-sm">What are my biggest SEO issues?</p>
                </div>
              </div>
              <div className="flex justify-start">
                <div className="bg-gray-800 rounded-2xl rounded-bl-md px-4 py-3 max-w-md">
                  <p className="text-sm text-gray-200 leading-relaxed">
                    Based on your crawl of <strong>1,247 pages</strong>:
                  </p>
                  <ul className="mt-2 text-sm text-gray-300 space-y-1.5">
                    <li className="flex items-start gap-2">
                      <span className="text-red-400 mt-0.5">1.</span>
                      <span><strong>12 pages</strong> missing title tags (critical)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-orange-400 mt-0.5">2.</span>
                      <span><strong>8 pages</strong> with duplicate meta descriptions</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-yellow-400 mt-0.5">3.</span>
                      <span><strong>3 broken internal links</strong> returning 404</span>
                    </li>
                  </ul>
                  <p className="mt-3 text-xs text-gray-500">llama-3.3-70b &middot; 847 tokens</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-6 py-24 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to find what&apos;s broken?</h2>
        <p className="text-gray-400 text-lg mb-10 max-w-xl mx-auto">
          No setup needed. Click and start crawling your site in seconds.
        </p>
        <button
          onClick={handleTryIt} disabled={isStarting}
          className="inline-block px-10 py-4 text-lg font-semibold bg-blue-600 hover:bg-blue-500 rounded-xl transition-all hover:shadow-lg hover:shadow-blue-500/25 cursor-pointer disabled:opacity-70"
        >
          {isStarting ? 'Setting up...' : 'Try it now'}
        </button>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800/50 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <span>Built by <a href="https://github.com/BalaShankar9" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-white">Bala Shankar</a> at Bala Labs</span>
          <div className="flex items-center gap-6">
            <a href="https://github.com/BalaShankar9/hydra-frog-os" target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 transition-colors">GitHub</a>
            <Link href="/pricing" className="hover:text-gray-300 transition-colors">Pricing</Link>
            <Link href="/login" className="hover:text-gray-300 transition-colors">Sign in</Link>
            <Link href="/signup" className="hover:text-gray-300 transition-colors">Sign up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="group p-6 rounded-2xl border border-gray-800 bg-gray-900/50 hover:border-gray-700 hover:bg-gray-900 transition-all">
      <div className="text-3xl mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-blue-400 transition-colors">{title}</h3>
      <p className="text-sm text-gray-400 leading-relaxed">{description}</p>
    </div>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}
