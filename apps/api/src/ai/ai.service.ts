/**
 * AI SEO Copilot Service
 *
 * Natural language interface over crawl data powered by Groq (cloud) or Ollama (local).
 * Ask questions like "show me pages with thin content" or "what are the worst SEO issues?"
 */

import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import Groq from 'groq-sdk';

interface AiQuery {
  projectId: string;
  crawlRunId: string;
  question: string;
}

interface AiResponse {
  answer: string;
  data?: unknown;
  model: string;
  tokensUsed: number;
}

@Injectable()
export class AiService {
  private groq: Groq | null = null;
  private readonly model: string;

  constructor(private readonly prisma: PrismaService) {
    const apiKey = process.env.GROQ_API_KEY;
    if (apiKey) {
      this.groq = new Groq({ apiKey });
    }
    this.model = process.env.AI_MODEL || 'llama-3.3-70b-versatile';
  }

  async query(userId: string, query: AiQuery): Promise<AiResponse> {
    if (!this.groq) {
      throw new BadRequestException(
        'AI Copilot requires GROQ_API_KEY. Set it in your environment variables.',
      );
    }

    // Verify access
    const project = await this.prisma.project.findUnique({
      where: { id: query.projectId },
      select: { orgId: true, name: true, domain: true },
    });
    if (!project) throw new BadRequestException('Project not found');

    const membership = await this.prisma.orgMember.findUnique({
      where: { orgId_userId: { orgId: project.orgId, userId } },
    });
    if (!membership) throw new BadRequestException('Access denied');

    // Gather crawl context
    const context = await this.buildCrawlContext(query.crawlRunId);

    // Build the prompt
    const systemPrompt = `You are an expert SEO analyst. You have access to crawl data for the website "${project.domain}" (project: "${project.name}").

Here is the crawl data summary:
${context}

Answer the user's question about this crawl data. Be specific, cite URLs and numbers from the data. If asked to find or filter pages, list them with their details. Format your response in clear markdown with headers, bullet points, and tables where appropriate.

If the question cannot be answered from the available data, say so clearly.`;

    const completion = await this.groq.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query.question },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const answer = completion.choices[0]?.message?.content || 'No response generated.';
    const tokensUsed = completion.usage?.total_tokens || 0;

    return {
      answer,
      model: this.model,
      tokensUsed,
    };
  }

  async getSuggestions(userId: string, projectId: string, crawlRunId: string): Promise<AiResponse> {
    return this.query(userId, {
      projectId,
      crawlRunId,
      question: 'Analyze this crawl and give me the top 5 most impactful SEO improvements I should make, ranked by estimated traffic impact. For each, explain what the issue is, how many pages are affected, and the specific fix.',
    });
  }

  private async buildCrawlContext(crawlRunId: string): Promise<string> {
    const [crawlRun, pageStats, topIssues, samplePages] = await Promise.all([
      this.prisma.crawlRun.findUnique({
        where: { id: crawlRunId },
        select: { status: true, totalPages: true, totalIssues: true, startedAt: true, finishedAt: true, totalsJson: true },
      }),
      this.prisma.page.groupBy({
        by: ['statusCode'],
        where: { crawlRunId },
        _count: true,
        orderBy: { _count: { statusCode: 'desc' } },
      }),
      this.prisma.issue.groupBy({
        by: ['type', 'severity'],
        where: { crawlRunId },
        _count: true,
        orderBy: { _count: { type: 'desc' } },
        take: 20,
      }),
      this.prisma.page.findMany({
        where: { crawlRunId },
        select: { url: true, statusCode: true, title: true, wordCount: true, h1Count: true, canonical: true },
        take: 50,
        orderBy: { discoveredAt: 'asc' },
      }),
    ]);

    const parts: string[] = [];

    if (crawlRun) {
      parts.push(`## Crawl Summary
- Status: ${crawlRun.status}
- Total Pages: ${crawlRun.totalPages}
- Total Issues: ${crawlRun.totalIssues}
- Started: ${crawlRun.startedAt}
- Finished: ${crawlRun.finishedAt}`);
    }

    if (pageStats.length > 0) {
      parts.push(`## Status Code Distribution
${pageStats.map((s) => `- ${s.statusCode ?? 'unknown'}: ${s._count} pages`).join('\n')}`);
    }

    if (topIssues.length > 0) {
      parts.push(`## Top Issues (by type)
${topIssues.map((i) => `- ${i.type} (${i.severity}): ${i._count} occurrences`).join('\n')}`);
    }

    if (samplePages.length > 0) {
      parts.push(`## Sample Pages (first 50)
${samplePages.map((p) => `- [${p.statusCode}] ${p.url} | title: "${p.title || 'none'}" | words: ${p.wordCount ?? 'N/A'} | h1s: ${p.h1Count ?? 'N/A'} | canonical: ${p.canonical ? 'set' : 'missing'}`).join('\n')}`);
    }

    return parts.join('\n\n');
  }
}
