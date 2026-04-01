'use client';

import { useState, useRef, useEffect } from 'react';
import { Protected } from '@/components/Protected';
import { AppShell } from '@/components/AppShell';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { apiFetch, projectsApi } from '@/lib/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  tokensUsed?: number;
}

interface Project {
  id: string;
  name: string;
  domain: string;
}

interface CrawlRun {
  id: string;
  status: string;
  totalPages: number;
  totalIssues: number;
  createdAt: string;
}

function AiCopilotContent() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [crawlRuns, setCrawlRuns] = useState<CrawlRun[]>([]);
  const [selectedCrawlRun, setSelectedCrawlRun] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    projectsApi.list().then(setProjects).catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedProject) return;
    apiFetch<{ items: CrawlRun[] } | CrawlRun[]>(`/crawl/runs?projectId=${selectedProject}&page=1&pageSize=10`)
      .then((data) => {
        const items = Array.isArray(data) ? data : data.items || [];
        setCrawlRuns(items);
        if (items.length > 0) setSelectedCrawlRun(items[0].id);
      })
      .catch(console.error);
  }, [selectedProject]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || !selectedProject || !selectedCrawlRun || isLoading) return;

    const userMessage: Message = { role: 'user', content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await apiFetch<{ answer: string; model: string; tokensUsed: number }>('/ai/query', {
        method: 'POST',
        body: {
          projectId: selectedProject,
          crawlRunId: selectedCrawlRun,
          question: userMessage.content,
        },
      });
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: response.answer,
        model: response.model,
        tokensUsed: response.tokensUsed,
      }]);
    } catch (err) {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : 'Failed to get response'}`,
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickQuestions = [
    'What are the top 5 most critical SEO issues?',
    'Show me all pages with thin content (under 300 words)',
    'Which pages are missing canonical tags?',
    'List all 404 and 500 error pages',
    'What is the overall SEO health of this site?',
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <Breadcrumbs items={[{ label: 'AI Copilot' }]} />

      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AI SEO Copilot</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Ask questions about your crawl data in natural language</p>
        </div>
      </div>

      {/* Project/Crawl Selector */}
      <div className="flex items-center gap-3 mb-4">
        <select
          value={selectedProject}
          onChange={(e) => { setSelectedProject(e.target.value); setMessages([]); }}
          className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm"
          aria-label="Select project"
        >
          <option value="">Select project...</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.domain})</option>)}
        </select>
        {crawlRuns.length > 0 && (
          <select
            value={selectedCrawlRun}
            onChange={(e) => { setSelectedCrawlRun(e.target.value); setMessages([]); }}
            className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm"
            aria-label="Select crawl run"
          >
            {crawlRuns.map((r) => (
              <option key={r.id} value={r.id}>
                {new Date(r.createdAt).toLocaleDateString()} — {r.totalPages} pages, {r.totalIssues} issues
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Chat Area */}
      <div className="flex-1 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-5xl mb-4">🤖</div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Ask me anything about your SEO data</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 max-w-md">
                I can analyze your crawl results, find issues, suggest fixes, and answer questions about your website's SEO health.
              </p>
              {selectedProject && selectedCrawlRun && (
                <div className="flex flex-wrap gap-2 max-w-lg justify-center">
                  {quickQuestions.map((q) => (
                    <button
                      key={q}
                      onClick={() => { setInput(q); }}
                      className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                }`}>
                  <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                  {msg.model && (
                    <div className="mt-2 text-xs opacity-60">
                      {msg.model} · {msg.tokensUsed} tokens
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 dark:border-gray-800 p-4">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder={selectedProject ? 'Ask about your SEO data...' : 'Select a project first'}
              disabled={!selectedProject || !selectedCrawlRun}
              className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500 disabled:opacity-50"
              aria-label="Message input"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || !selectedProject || !selectedCrawlRun || isLoading}
              className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              aria-label="Send message"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AiCopilotPage() {
  return (
    <Protected>
      <AppShell>
        <AiCopilotContent />
      </AppShell>
    </Protected>
  );
}
