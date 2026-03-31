/**
 * Feature Flag Service
 * 
 * Provides methods to check and manage feature flags with support for:
 * - GLOBAL scope: affects all orgs and projects
 * - ORG scope: affects all projects within an org
 * - PROJECT scope: affects a specific project only
 * 
 * Flag resolution order (most specific wins):
 * 1. PROJECT-scoped flag (if projectId provided)
 * 2. ORG-scoped flag (if orgId provided)
 * 3. GLOBAL-scoped flag
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma';
import { FeatureFlagScope, Prisma } from '@prisma/client';

// ============================================
// TYPES
// ============================================

export interface FlagCheckOptions {
  orgId?: string;
  projectId?: string;
}

export interface FeatureFlagInfo {
  key: string;
  enabled: boolean;
  scope: FeatureFlagScope;
  orgId?: string | null;
  projectId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface FlagCreateInput {
  key: string;
  enabled?: boolean;
  scope?: FeatureFlagScope;
  orgId?: string;
  projectId?: string;
  metadataJson?: Record<string, unknown>;
}

export interface FlagUpdateInput {
  enabled?: boolean;
  metadataJson?: Record<string, unknown>;
}

// ============================================
// WELL-KNOWN FLAGS
// ============================================

/**
 * Well-known feature flag keys for type safety
 */
export const FLAG_KEYS = {
  // Studio flags
  STUDIO_ENABLED: 'studio.enabled',
  
  // Tool flags
  TOOLS_TEMPLATES_V2: 'tools.templatesV2',
  TOOLS_DIFF_INSIGHTS: 'tools.diffInsights',
  TOOLS_PERFORMANCE: 'tools.performance',
  TOOLS_FIX_ENGINE: 'tools.fixEngine',
  TOOLS_SEO_HEALTH: 'tools.seoHealth',
  
  // Experimental features
  EXPERIMENTAL_AI_SUGGESTIONS: 'experimental.aiSuggestions',
  EXPERIMENTAL_BULK_FIXES: 'experimental.bulkFixes',
} as const;

export type FlagKey = typeof FLAG_KEYS[keyof typeof FLAG_KEYS];

// ============================================
// SERVICE
// ============================================

@Injectable()
export class FlagService {
  private readonly logger = new Logger(FlagService.name);
  
  // In-memory cache for fast lookups (TTL: 60s)
  private cache = new Map<string, { value: boolean; expiresAt: number }>();
  private readonly CACHE_TTL_MS = 60_000; // 60 seconds

  constructor(private readonly prisma: PrismaService) {}

  // ============================================
  // CORE METHODS
  // ============================================

  /**
   * Check if a feature flag is enabled
   * 
   * Resolution order (most specific wins):
   * 1. PROJECT-scoped flag (if projectId provided)
   * 2. ORG-scoped flag (if orgId provided)
   * 3. GLOBAL-scoped flag
   * 
   * Returns false if no flag found (fail-safe)
   */
  async isEnabled(key: string, options: FlagCheckOptions = {}): Promise<boolean> {
    const { orgId, projectId } = options;
    const cacheKey = this.buildCacheKey(key, orgId, projectId);
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }
    
    try {
      // 1. Check PROJECT scope first (most specific)
      if (projectId && orgId) {
        const projectFlag = await this.prisma.featureFlag.findFirst({
          where: {
            key,
            scope: FeatureFlagScope.PROJECT,
            orgId,
            projectId,
          },
        });
        
        if (projectFlag) {
          this.setCache(cacheKey, projectFlag.enabled);
          return projectFlag.enabled;
        }
      }
      
      // 2. Check ORG scope
      if (orgId) {
        const orgFlag = await this.prisma.featureFlag.findFirst({
          where: {
            key,
            scope: FeatureFlagScope.ORG,
            orgId,
          },
        });
        
        if (orgFlag) {
          this.setCache(cacheKey, orgFlag.enabled);
          return orgFlag.enabled;
        }
      }
      
      // 3. Check GLOBAL scope (fallback)
      const globalFlag = await this.prisma.featureFlag.findFirst({
        where: {
          key,
          scope: FeatureFlagScope.GLOBAL,
        },
      });
      
      if (globalFlag) {
        this.setCache(cacheKey, globalFlag.enabled);
        return globalFlag.enabled;
      }
      
      // No flag found - default to false (fail-safe)
      this.setCache(cacheKey, false);
      return false;
    } catch (error) {
      this.logger.error(`Error checking flag ${key}:`, error);
      // On error, fail-safe to false
      return false;
    }
  }

  /**
   * Check multiple flags at once
   * Returns a map of flag key -> enabled status
   */
  async checkFlags(
    keys: string[],
    options: FlagCheckOptions = {}
  ): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    // Check each flag (could be parallelized but keeps cache consistent)
    await Promise.all(
      keys.map(async (key) => {
        results[key] = await this.isEnabled(key, options);
      })
    );
    
    return results;
  }

  /**
   * Get all enabled flags for a given context
   * Useful for fetching flags at login
   */
  async getEnabledFlags(options: FlagCheckOptions = {}): Promise<FeatureFlagInfo[]> {
    const { orgId, projectId } = options;
    
    // Build OR conditions for flags that might apply
    const orConditions: Prisma.FeatureFlagWhereInput[] = [
      // Global flags
      { scope: FeatureFlagScope.GLOBAL },
    ];
    
    if (orgId) {
      orConditions.push({ scope: FeatureFlagScope.ORG, orgId });
    }
    
    if (projectId && orgId) {
      orConditions.push({ scope: FeatureFlagScope.PROJECT, orgId, projectId });
    }
    
    const flags = await this.prisma.featureFlag.findMany({
      where: {
        OR: orConditions,
      },
      orderBy: [
        { key: 'asc' },
        { scope: 'desc' }, // PROJECT > ORG > GLOBAL
      ],
    });
    
    // De-duplicate by key (most specific scope wins)
    const flagMap = new Map<string, FeatureFlagInfo>();
    
    // Process in reverse order so most specific overwrites
    for (const flag of flags) {
      const existing = flagMap.get(flag.key);
      
      // If no existing, or this is more specific scope
      if (!existing || this.scopePriority(flag.scope) > this.scopePriority(existing.scope)) {
        flagMap.set(flag.key, {
          key: flag.key,
          enabled: flag.enabled,
          scope: flag.scope,
          orgId: flag.orgId,
          projectId: flag.projectId,
          metadata: flag.metadataJson as Record<string, unknown> | undefined,
        });
      }
    }
    
    return Array.from(flagMap.values());
  }

  /**
   * Get all flags (for admin)
   */
  async getAllFlags(): Promise<FeatureFlagInfo[]> {
    const flags = await this.prisma.featureFlag.findMany({
      orderBy: [
        { key: 'asc' },
        { scope: 'asc' },
      ],
    });
    
    return flags.map((flag) => ({
      key: flag.key,
      enabled: flag.enabled,
      scope: flag.scope,
      orgId: flag.orgId,
      projectId: flag.projectId,
      metadata: flag.metadataJson as Record<string, unknown> | undefined,
    }));
  }

  // ============================================
  // ADMIN METHODS
  // ============================================

  /**
   * Create a new feature flag
   */
  async createFlag(input: FlagCreateInput): Promise<FeatureFlagInfo> {
    const flag = await this.prisma.featureFlag.create({
      data: {
        key: input.key,
        enabled: input.enabled ?? false,
        scope: input.scope ?? FeatureFlagScope.GLOBAL,
        orgId: input.orgId ?? null,
        projectId: input.projectId ?? null,
        metadataJson: input.metadataJson as Prisma.InputJsonValue ?? Prisma.JsonNull,
      },
    });
    
    // Invalidate cache for this key
    this.invalidateCache(input.key);
    
    this.logger.log(`Created flag: ${input.key} (${flag.scope})`);
    
    return {
      key: flag.key,
      enabled: flag.enabled,
      scope: flag.scope,
      orgId: flag.orgId,
      projectId: flag.projectId,
      metadata: flag.metadataJson as Record<string, unknown> | undefined,
    };
  }

  /**
   * Update an existing flag
   */
  async updateFlag(
    key: string,
    scope: FeatureFlagScope,
    orgId: string | null,
    projectId: string | null,
    input: FlagUpdateInput
  ): Promise<FeatureFlagInfo> {
    // Find the flag first
    const existing = await this.prisma.featureFlag.findFirst({
      where: {
        key,
        scope,
        orgId: orgId ?? undefined,
        projectId: projectId ?? undefined,
      },
    });
    
    if (!existing) {
      throw new Error(`Flag not found: ${key} (${scope})`);
    }
    
    const updateData: Prisma.FeatureFlagUpdateInput = {};
    if (input.enabled !== undefined) {
      updateData.enabled = input.enabled;
    }
    if (input.metadataJson !== undefined) {
      updateData.metadataJson = input.metadataJson as Prisma.InputJsonValue;
    }
    
    const flag = await this.prisma.featureFlag.update({
      where: { id: existing.id },
      data: updateData,
    });
    
    // Invalidate cache for this key
    this.invalidateCache(key);
    
    this.logger.log(`Updated flag: ${key} (${scope}) -> enabled=${flag.enabled}`);
    
    return {
      key: flag.key,
      enabled: flag.enabled,
      scope: flag.scope,
      orgId: flag.orgId,
      projectId: flag.projectId,
      metadata: flag.metadataJson as Record<string, unknown> | undefined,
    };
  }

  /**
   * Toggle a flag's enabled status
   */
  async toggleFlag(
    key: string,
    scope: FeatureFlagScope = FeatureFlagScope.GLOBAL,
    orgId: string | null = null,
    projectId: string | null = null
  ): Promise<FeatureFlagInfo> {
    const existing = await this.prisma.featureFlag.findFirst({
      where: {
        key,
        scope,
        orgId: orgId ?? undefined,
        projectId: projectId ?? undefined,
      },
    });
    
    if (!existing) {
      // Create the flag if it doesn't exist
      return this.createFlag({
        key,
        enabled: true,
        scope,
        orgId: orgId ?? undefined,
        projectId: projectId ?? undefined,
      });
    }
    
    return this.updateFlag(key, scope, orgId, projectId, {
      enabled: !existing.enabled,
    });
  }

  /**
   * Delete a feature flag
   */
  async deleteFlag(
    key: string,
    scope: FeatureFlagScope,
    orgId: string | null,
    projectId: string | null
  ): Promise<void> {
    const existing = await this.prisma.featureFlag.findFirst({
      where: {
        key,
        scope,
        orgId: orgId ?? undefined,
        projectId: projectId ?? undefined,
      },
    });
    
    if (!existing) {
      throw new Error(`Flag not found: ${key} (${scope})`);
    }
    
    await this.prisma.featureFlag.delete({
      where: { id: existing.id },
    });
    
    // Invalidate cache for this key
    this.invalidateCache(key);
    
    this.logger.log(`Deleted flag: ${key} (${scope})`);
  }

  // ============================================
  // BULK OPERATIONS
  // ============================================

  /**
   * Enable a flag globally (creates if doesn't exist)
   */
  async enableGlobal(key: string): Promise<FeatureFlagInfo> {
    const existing = await this.prisma.featureFlag.findFirst({
      where: {
        key,
        scope: FeatureFlagScope.GLOBAL,
      },
    });
    
    let flag;
    if (existing) {
      flag = await this.prisma.featureFlag.update({
        where: { id: existing.id },
        data: { enabled: true },
      });
    } else {
      flag = await this.prisma.featureFlag.create({
        data: {
          key,
          enabled: true,
          scope: FeatureFlagScope.GLOBAL,
        },
      });
    }
    
    this.invalidateCache(key);
    return {
      key: flag.key,
      enabled: flag.enabled,
      scope: flag.scope,
      orgId: flag.orgId,
      projectId: flag.projectId,
    };
  }

  /**
   * Disable a flag globally
   */
  async disableGlobal(key: string): Promise<FeatureFlagInfo> {
    const existing = await this.prisma.featureFlag.findFirst({
      where: {
        key,
        scope: FeatureFlagScope.GLOBAL,
      },
    });
    
    let flag;
    if (existing) {
      flag = await this.prisma.featureFlag.update({
        where: { id: existing.id },
        data: { enabled: false },
      });
    } else {
      flag = await this.prisma.featureFlag.create({
        data: {
          key,
          enabled: false,
          scope: FeatureFlagScope.GLOBAL,
        },
      });
    }
    
    this.invalidateCache(key);
    return {
      key: flag.key,
      enabled: flag.enabled,
      scope: flag.scope,
      orgId: flag.orgId,
      projectId: flag.projectId,
    };
  }

  /**
   * Enable a flag for a specific org
   */
  async enableForOrg(key: string, orgId: string): Promise<FeatureFlagInfo> {
    const existing = await this.prisma.featureFlag.findFirst({
      where: {
        key,
        scope: FeatureFlagScope.ORG,
        orgId,
      },
    });
    
    let flag;
    if (existing) {
      flag = await this.prisma.featureFlag.update({
        where: { id: existing.id },
        data: { enabled: true },
      });
    } else {
      flag = await this.prisma.featureFlag.create({
        data: {
          key,
          enabled: true,
          scope: FeatureFlagScope.ORG,
          orgId,
        },
      });
    }
    
    this.invalidateCache(key);
    return {
      key: flag.key,
      enabled: flag.enabled,
      scope: flag.scope,
      orgId: flag.orgId,
      projectId: flag.projectId,
    };
  }

  /**
   * Enable a flag for a specific project
   */
  async enableForProject(key: string, orgId: string, projectId: string): Promise<FeatureFlagInfo> {
    const existing = await this.prisma.featureFlag.findFirst({
      where: {
        key,
        scope: FeatureFlagScope.PROJECT,
        orgId,
        projectId,
      },
    });
    
    let flag;
    if (existing) {
      flag = await this.prisma.featureFlag.update({
        where: { id: existing.id },
        data: { enabled: true },
      });
    } else {
      flag = await this.prisma.featureFlag.create({
        data: {
          key,
          enabled: true,
          scope: FeatureFlagScope.PROJECT,
          orgId,
          projectId,
        },
      });
    }
    
    this.invalidateCache(key);
    return {
      key: flag.key,
      enabled: flag.enabled,
      scope: flag.scope,
      orgId: flag.orgId,
      projectId: flag.projectId,
    };
  }

  // ============================================
  // CACHE HELPERS
  // ============================================

  private buildCacheKey(key: string, orgId?: string, projectId?: string): string {
    return `${key}:${orgId || 'global'}:${projectId || 'all'}`;
  }

  private setCache(cacheKey: string, value: boolean): void {
    this.cache.set(cacheKey, {
      value,
      expiresAt: Date.now() + this.CACHE_TTL_MS,
    });
  }

  private invalidateCache(key: string): void {
    // Invalidate all cached entries for this key
    for (const cacheKey of this.cache.keys()) {
      if (cacheKey.startsWith(`${key}:`)) {
        this.cache.delete(cacheKey);
      }
    }
  }

  /**
   * Clear all cached flags
   */
  clearCache(): void {
    this.cache.clear();
    this.logger.log('Flag cache cleared');
  }

  private scopePriority(scope: FeatureFlagScope): number {
    switch (scope) {
      case FeatureFlagScope.PROJECT:
        return 3;
      case FeatureFlagScope.ORG:
        return 2;
      case FeatureFlagScope.GLOBAL:
        return 1;
      default:
        return 0;
    }
  }
}
