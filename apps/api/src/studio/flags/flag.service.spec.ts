/**
 * Flag Service Unit Tests
 * 
 * Tests for feature flag scoped resolution logic
 */

import { Test, TestingModule } from '@nestjs/testing';
import { FlagService, FeatureFlagInfo } from './flag.service';
import { PrismaService } from '../../prisma/prisma.service';
import { FeatureFlagScope } from '@prisma/client';

describe('FlagService', () => {
  let service: FlagService;

  // Mock data
  const mockGlobalFlag = {
    id: 'global-flag-id',
    key: 'test.feature',
    enabled: false,
    scope: FeatureFlagScope.GLOBAL,
    orgId: null,
    projectId: null,
    metadataJson: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockOrgFlag = {
    id: 'org-flag-id',
    key: 'test.feature',
    enabled: true,
    scope: FeatureFlagScope.ORG,
    orgId: 'org-123',
    projectId: null,
    metadataJson: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockProjectFlag = {
    id: 'project-flag-id',
    key: 'test.feature',
    enabled: false,
    scope: FeatureFlagScope.PROJECT,
    orgId: 'org-123',
    projectId: 'project-456',
    metadataJson: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaService = {
    featureFlag: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FlagService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<FlagService>(FlagService);

    // Clear mocks between tests
    jest.clearAllMocks();
    
    // Clear cache before each test
    service.clearCache();
  });

  describe('isEnabled', () => {
    describe('Scope Resolution Priority', () => {
      it('should return GLOBAL flag value when no ORG/PROJECT flag exists', async () => {
        mockPrismaService.featureFlag.findFirst
          .mockResolvedValueOnce(null) // No PROJECT flag
          .mockResolvedValueOnce(null) // No ORG flag
          .mockResolvedValueOnce(mockGlobalFlag); // GLOBAL flag exists

        const result = await service.isEnabled('test.feature', {
          orgId: 'org-123',
          projectId: 'project-456',
        });

        expect(result).toBe(false); // Global flag is disabled
      });

      it('should return ORG flag value, overriding GLOBAL', async () => {
        mockPrismaService.featureFlag.findFirst
          .mockResolvedValueOnce(null) // No PROJECT flag
          .mockResolvedValueOnce(mockOrgFlag); // ORG flag exists

        const result = await service.isEnabled('test.feature', {
          orgId: 'org-123',
          projectId: 'project-456',
        });

        expect(result).toBe(true); // ORG flag is enabled
      });

      it('should return PROJECT flag value, overriding ORG and GLOBAL', async () => {
        mockPrismaService.featureFlag.findFirst
          .mockResolvedValueOnce(mockProjectFlag); // PROJECT flag exists

        const result = await service.isEnabled('test.feature', {
          orgId: 'org-123',
          projectId: 'project-456',
        });

        expect(result).toBe(false); // PROJECT flag is disabled
      });

      it('should skip PROJECT check when no projectId provided', async () => {
        mockPrismaService.featureFlag.findFirst
          .mockResolvedValueOnce(mockOrgFlag); // ORG flag

        const result = await service.isEnabled('test.feature', {
          orgId: 'org-123',
          // No projectId
        });

        expect(result).toBe(true);
        // Should not have queried for PROJECT scope
        expect(mockPrismaService.featureFlag.findFirst).toHaveBeenCalledTimes(1);
      });

      it('should skip ORG check when no orgId provided', async () => {
        mockPrismaService.featureFlag.findFirst
          .mockResolvedValueOnce(mockGlobalFlag); // GLOBAL flag

        const result = await service.isEnabled('test.feature', {
          // No orgId or projectId
        });

        expect(result).toBe(false);
        expect(mockPrismaService.featureFlag.findFirst).toHaveBeenCalledTimes(1);
      });
    });

    describe('Default Behavior', () => {
      it('should return false when no flag exists at any scope', async () => {
        mockPrismaService.featureFlag.findFirst.mockResolvedValue(null);

        const result = await service.isEnabled('unknown.flag', {
          orgId: 'org-123',
          projectId: 'project-456',
        });

        expect(result).toBe(false);
      });

      it('should return false on error (fail-safe)', async () => {
        mockPrismaService.featureFlag.findFirst.mockRejectedValue(
          new Error('Database error'),
        );

        const result = await service.isEnabled('test.feature');

        expect(result).toBe(false);
      });
    });

    describe('Caching', () => {
      it('should cache flag results', async () => {
        mockPrismaService.featureFlag.findFirst.mockResolvedValue(mockGlobalFlag);

        // First call
        await service.isEnabled('test.feature');
        // Second call (should use cache)
        await service.isEnabled('test.feature');

        // Should only query DB once
        expect(mockPrismaService.featureFlag.findFirst).toHaveBeenCalledTimes(1);
      });

      it('should use different cache keys for different contexts', async () => {
        mockPrismaService.featureFlag.findFirst.mockResolvedValue(mockGlobalFlag);

        await service.isEnabled('test.feature', { orgId: 'org-1' });
        await service.isEnabled('test.feature', { orgId: 'org-2' });

        // Should query DB twice (different contexts)
        expect(mockPrismaService.featureFlag.findFirst).toHaveBeenCalledTimes(2);
      });

      it('should invalidate cache when clearCache is called', async () => {
        mockPrismaService.featureFlag.findFirst.mockResolvedValue(mockGlobalFlag);

        await service.isEnabled('test.feature');
        service.clearCache();
        await service.isEnabled('test.feature');

        // Should query DB twice
        expect(mockPrismaService.featureFlag.findFirst).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('checkFlags', () => {
    it('should check multiple flags at once', async () => {
      mockPrismaService.featureFlag.findFirst
        .mockResolvedValueOnce({ ...mockGlobalFlag, key: 'flag1', enabled: true })
        .mockResolvedValueOnce({ ...mockGlobalFlag, key: 'flag2', enabled: false });

      const result = await service.checkFlags(['flag1', 'flag2']);

      expect(result).toEqual({
        flag1: true,
        flag2: false,
      });
    });

    it('should return false for non-existent flags', async () => {
      mockPrismaService.featureFlag.findFirst.mockResolvedValue(null);

      const result = await service.checkFlags(['unknown1', 'unknown2']);

      expect(result).toEqual({
        unknown1: false,
        unknown2: false,
      });
    });
  });

  describe('getEnabledFlags', () => {
    it('should return all applicable flags for context', async () => {
      mockPrismaService.featureFlag.findMany.mockResolvedValue([
        mockGlobalFlag,
        mockOrgFlag,
        mockProjectFlag,
      ]);

      const result = await service.getEnabledFlags({
        orgId: 'org-123',
        projectId: 'project-456',
      });

      expect(result.length).toBeGreaterThan(0);
    });

    it('should de-duplicate flags by key (most specific wins)', async () => {
      mockPrismaService.featureFlag.findMany.mockResolvedValue([
        mockGlobalFlag, // enabled: false
        mockOrgFlag,    // enabled: true (same key)
      ]);

      const result = await service.getEnabledFlags({
        orgId: 'org-123',
      });

      // Should only have one entry for 'test.feature'
      const testFeatureFlags = result.filter((f: FeatureFlagInfo) => f.key === 'test.feature');
      expect(testFeatureFlags.length).toBe(1);
      // ORG scope wins over GLOBAL
      expect(testFeatureFlags[0].enabled).toBe(true);
      expect(testFeatureFlags[0].scope).toBe(FeatureFlagScope.ORG);
    });
  });

  describe('toggleFlag', () => {
    it('should create flag if it does not exist', async () => {
      mockPrismaService.featureFlag.findFirst.mockResolvedValue(null);
      mockPrismaService.featureFlag.create.mockResolvedValue({
        ...mockGlobalFlag,
        enabled: true,
      });

      const result = await service.toggleFlag('new.flag');

      expect(mockPrismaService.featureFlag.create).toHaveBeenCalled();
      expect(result.enabled).toBe(true);
    });

    it('should toggle existing flag', async () => {
      mockPrismaService.featureFlag.findFirst.mockResolvedValue(mockGlobalFlag);
      mockPrismaService.featureFlag.update.mockResolvedValue({
        ...mockGlobalFlag,
        enabled: true, // Was false, now true
      });

      const result = await service.toggleFlag('test.feature');

      expect(mockPrismaService.featureFlag.update).toHaveBeenCalled();
      expect(result.enabled).toBe(true);
    });
  });

  describe('enableGlobal / disableGlobal', () => {
    it('enableGlobal should create or update flag to enabled', async () => {
      mockPrismaService.featureFlag.findFirst.mockResolvedValue(null);
      mockPrismaService.featureFlag.create.mockResolvedValue({
        ...mockGlobalFlag,
        enabled: true,
      });

      const result = await service.enableGlobal('test.feature');

      expect(result.enabled).toBe(true);
      expect(mockPrismaService.featureFlag.create).toHaveBeenCalled();
    });

    it('disableGlobal should create or update flag to disabled', async () => {
      mockPrismaService.featureFlag.findFirst.mockResolvedValue(mockGlobalFlag);
      mockPrismaService.featureFlag.update.mockResolvedValue({
        ...mockGlobalFlag,
        enabled: false,
      });

      const result = await service.disableGlobal('test.feature');

      expect(result.enabled).toBe(false);
    });
  });

  describe('enableForOrg / enableForProject', () => {
    it('enableForOrg should create ORG-scoped flag', async () => {
      mockPrismaService.featureFlag.findFirst.mockResolvedValue(null);
      mockPrismaService.featureFlag.create.mockResolvedValue(mockOrgFlag);

      const result = await service.enableForOrg('test.feature', 'org-123');

      expect(result.scope).toBe(FeatureFlagScope.ORG);
      expect(result.orgId).toBe('org-123');
      expect(result.enabled).toBe(true);
    });

    it('enableForProject should create PROJECT-scoped flag', async () => {
      mockPrismaService.featureFlag.findFirst.mockResolvedValue(null);
      mockPrismaService.featureFlag.create.mockResolvedValue({
        ...mockProjectFlag,
        enabled: true,
      });

      const result = await service.enableForProject(
        'test.feature',
        'org-123',
        'project-456',
      );

      expect(result.scope).toBe(FeatureFlagScope.PROJECT);
      expect(result.projectId).toBe('project-456');
      expect(result.enabled).toBe(true);
    });
  });

  describe('deleteFlag', () => {
    it('should delete existing flag', async () => {
      mockPrismaService.featureFlag.findFirst.mockResolvedValue(mockGlobalFlag);
      mockPrismaService.featureFlag.delete.mockResolvedValue(mockGlobalFlag);

      await service.deleteFlag(
        'test.feature',
        FeatureFlagScope.GLOBAL,
        null,
        null,
      );

      expect(mockPrismaService.featureFlag.delete).toHaveBeenCalledWith({
        where: { id: mockGlobalFlag.id },
      });
    });

    it('should throw error when flag not found', async () => {
      mockPrismaService.featureFlag.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteFlag('unknown.flag', FeatureFlagScope.GLOBAL, null, null),
      ).rejects.toThrow('Flag not found');
    });
  });
});
