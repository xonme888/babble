import "reflect-metadata"
import { GamificationService } from "@features/gamification/application/gamification.service"
import { GamificationRedisKeys, GamificationCacheTTL } from "@features/gamification/domain/gamification-redis-keys"
import { createMockRedisService, createMockLogger } from "../../utils/mock-factories"

import type { UserLevelRepository } from "@features/gamification/infrastructure/user-level.repository"
import type { XpTransactionRepository } from "@features/gamification/infrastructure/xp-transaction.repository"
import type { BadgeService } from "@features/gamification/application/badge.service"
import type { LearningRecordService } from "@features/learning/application/learning-record.service"

describe("GamificationService (게이미피케이션 통합 서비스)", () => {
    let service: GamificationService
    let levelRepo: jest.Mocked<UserLevelRepository>
    let xpRepo: jest.Mocked<XpTransactionRepository>
    let badgeService: jest.Mocked<BadgeService>
    let learningRecordService: jest.Mocked<LearningRecordService>
    let redisService: ReturnType<typeof createMockRedisService>
    let logger: ReturnType<typeof createMockLogger>

    beforeEach(() => {
        jest.clearAllMocks()

        levelRepo = {
            findOrCreateByUserId: jest.fn(),
            updateLastSeenLevel: jest.fn(),
            getLeaderboard: jest.fn().mockResolvedValue([]),
        } as unknown as jest.Mocked<UserLevelRepository>

        xpRepo = {
            getWeeklyXp: jest.fn().mockResolvedValue(0),
        } as unknown as jest.Mocked<XpTransactionRepository>

        badgeService = {
            getUnseenBadges: jest.fn().mockResolvedValue([]),
            markBadgesAsSeen: jest.fn(),
            getUnlockedBadges: jest.fn().mockResolvedValue([]),
            getAllBadges: jest.fn().mockResolvedValue([]),
        } as unknown as jest.Mocked<BadgeService>

        learningRecordService = {
            getStreak: jest.fn().mockResolvedValue({ currentStreak: 0, longestStreak: 0 }),
        } as unknown as jest.Mocked<LearningRecordService>

        redisService = createMockRedisService()
        logger = createMockLogger()

        service = new GamificationService(
            levelRepo,
            xpRepo,
            badgeService,
            learningRecordService,
            redisService,
            logger
        )
    })

    describe("getProfile (게임화 프로필 조회)", () => {
        it("레벨, XP, 스트릭, 뱃지 수를 통합하여 반환한다", async () => {
            // Given
            levelRepo.findOrCreateByUserId.mockResolvedValue({
                level: 5,
                totalXp: 1200,
                xpToNextLevel: 300,
                levelProgress: 0.8,
            } as any)
            xpRepo.getWeeklyXp.mockResolvedValue(150)
            learningRecordService.getStreak.mockResolvedValue({
                currentStreak: 7,
                longestStreak: 14,
            })
            badgeService.getUnlockedBadges.mockResolvedValue([
                { badgeId: 1 } as any,
                { badgeId: 2 } as any,
                { badgeId: 3 } as any,
            ])

            // When
            const result = await service.getProfile(42)

            // Then
            expect(result).toEqual({
                level: 5,
                totalXp: 1200,
                xpToNextLevel: 300,
                levelProgress: 0.8,
                weeklyXp: 150,
                currentStreak: 7,
                longestStreak: 14,
                unlockedBadgeCount: 3,
            })
        })

        it("levelProgress를 소수점 2자리로 반올림한다", async () => {
            // Given
            levelRepo.findOrCreateByUserId.mockResolvedValue({
                level: 1,
                totalXp: 33,
                xpToNextLevel: 67,
                levelProgress: 0.33333,
            } as any)
            badgeService.getUnlockedBadges.mockResolvedValue([])

            // When
            const result = await service.getProfile(1)

            // Then
            expect(result.levelProgress).toBe(0.33)
        })

        it("4개 데이터를 Promise.all로 병렬 조회한다", async () => {
            // Given
            levelRepo.findOrCreateByUserId.mockResolvedValue({
                level: 1, totalXp: 0, xpToNextLevel: 100, levelProgress: 0,
            } as any)

            // When
            await service.getProfile(1)

            // Then — 4개 종속성 모두 호출 확인
            expect(levelRepo.findOrCreateByUserId).toHaveBeenCalledWith(1)
            expect(xpRepo.getWeeklyXp).toHaveBeenCalledWith(1, expect.any(Date))
            expect(learningRecordService.getStreak).toHaveBeenCalledWith(1)
            expect(badgeService.getUnlockedBadges).toHaveBeenCalledWith(1)
        })

        it("캐시 히트 시 DB 조회를 건너뛴다", async () => {
            // Given
            const cachedProfile = {
                level: 5, totalXp: 1200, xpToNextLevel: 300, levelProgress: 0.8,
                weeklyXp: 150, currentStreak: 7, longestStreak: 14, unlockedBadgeCount: 3,
            }
            redisService.get.mockResolvedValue(JSON.stringify(cachedProfile))

            // When
            const result = await service.getProfile(42)

            // Then
            expect(result).toEqual(cachedProfile)
            expect(levelRepo.findOrCreateByUserId).not.toHaveBeenCalled()
            expect(badgeService.getUnlockedBadges).not.toHaveBeenCalled()
        })

        it("캐시 미스 시 DB 조회 후 캐시에 저장한다", async () => {
            // Given
            redisService.get.mockResolvedValue(null)
            levelRepo.findOrCreateByUserId.mockResolvedValue({
                level: 3, totalXp: 600, xpToNextLevel: 200, levelProgress: 0.75,
            } as any)
            xpRepo.getWeeklyXp.mockResolvedValue(80)
            learningRecordService.getStreak.mockResolvedValue({ currentStreak: 3, longestStreak: 5 })
            badgeService.getUnlockedBadges.mockResolvedValue([{ badgeId: 1 } as any])

            // When
            await service.getProfile(42)

            // Then
            expect(redisService.set).toHaveBeenCalledWith(
                GamificationRedisKeys.profile(42),
                expect.any(String),
                GamificationCacheTTL.PROFILE
            )
        })

        it("Redis 장애 시 DB에서 정상 조회한다", async () => {
            // Given
            redisService.get.mockRejectedValue(new Error("Redis connection failed"))
            levelRepo.findOrCreateByUserId.mockResolvedValue({
                level: 1, totalXp: 0, xpToNextLevel: 100, levelProgress: 0,
            } as any)
            badgeService.getUnlockedBadges.mockResolvedValue([])

            // When
            const result = await service.getProfile(1)

            // Then
            expect(result.level).toBe(1)
            expect(logger.warn).toHaveBeenCalledWith(
                "게임화 프로필 캐시 조회 실패, DB에서 조회",
                expect.any(Error)
            )
        })
    })

    describe("getBadgesRaw (뱃지 raw 데이터 조회)", () => {
        it("전체 뱃지와 해금 뱃지를 분리하여 반환한다", async () => {
            // Given
            const unlockedAt = new Date("2026-01-15")
            const allBadges = [
                { id: 1, code: "STREAK_7", title: "7일 연속", description: "d1", iconName: "fire", category: "streak" } as any,
                { id: 2, code: "LEVEL_5", title: "레벨 5", description: "d2", iconName: "star", category: "level" } as any,
            ]
            const unlockedBadges = [{ badgeId: 1, unlockedAt } as any]
            badgeService.getAllBadges.mockResolvedValue(allBadges)
            badgeService.getUnlockedBadges.mockResolvedValue(unlockedBadges)

            // When
            const result = await service.getBadgesRaw(42)

            // Then
            expect(result.allBadges).toBe(allBadges)
            expect(result.unlockedBadges).toBe(unlockedBadges)
        })

        it("해금된 뱃지가 없으면 빈 배열을 반환한다", async () => {
            // Given
            badgeService.getAllBadges.mockResolvedValue([
                { id: 1, code: "b1", title: "t1", description: "d1", iconName: "i1", category: "c1" } as any,
            ])
            badgeService.getUnlockedBadges.mockResolvedValue([])

            // When
            const result = await service.getBadgesRaw(1)

            // Then
            expect(result.allBadges).toHaveLength(1)
            expect(result.unlockedBadges).toHaveLength(0)
        })
    })

    describe("getLeaderboard (리더보드 조회)", () => {
        it("순위를 1부터 매겨 반환한다", async () => {
            // Given
            levelRepo.getLeaderboard.mockResolvedValue([
                { userId: 10, level: 8, totalXp: 2000, user: { firstName: "Alice" } } as any,
                { userId: 20, level: 5, totalXp: 1200, user: { firstName: "Bob" } } as any,
            ])

            // When
            const result = await service.getLeaderboard(10)

            // Then
            expect(result).toEqual([
                { rank: 1, userId: 10, firstName: "Alice", level: 8, totalXp: 2000 },
                { rank: 2, userId: 20, firstName: "Bob", level: 5, totalXp: 1200 },
            ])
        })

        it("user 정보가 없으면 '익명'으로 대체한다", async () => {
            // Given
            levelRepo.getLeaderboard.mockResolvedValue([
                { userId: 1, level: 3, totalXp: 500, user: null } as any,
            ])

            // When
            const result = await service.getLeaderboard()

            // Then
            expect(result[0].firstName).toBe("익명")
        })

        it("기본 limit 10을 사용한다", async () => {
            // When
            await service.getLeaderboard()

            // Then
            expect(levelRepo.getLeaderboard).toHaveBeenCalledWith(10)
        })

        it("캐시 히트 시 DB 조회를 건너뛴다", async () => {
            // Given
            const cachedLeaderboard = [
                { rank: 1, userId: 10, firstName: "Alice", level: 8, totalXp: 2000 },
            ]
            redisService.get.mockResolvedValue(JSON.stringify(cachedLeaderboard))

            // When
            const result = await service.getLeaderboard(10)

            // Then
            expect(result).toEqual(cachedLeaderboard)
            expect(levelRepo.getLeaderboard).not.toHaveBeenCalled()
        })

        it("캐시 미스 시 DB 조회 후 캐시에 저장한다", async () => {
            // Given
            redisService.get.mockResolvedValue(null)
            levelRepo.getLeaderboard.mockResolvedValue([
                { userId: 10, level: 8, totalXp: 2000, user: { firstName: "Alice" } } as any,
            ])

            // When
            await service.getLeaderboard(10)

            // Then
            expect(redisService.set).toHaveBeenCalledWith(
                GamificationRedisKeys.leaderboard(10),
                expect.any(String),
                GamificationCacheTTL.LEADERBOARD
            )
        })

        it("Redis 장애 시 DB에서 정상 조회한다", async () => {
            // Given
            redisService.get.mockRejectedValue(new Error("Redis connection failed"))
            levelRepo.getLeaderboard.mockResolvedValue([
                { userId: 1, level: 3, totalXp: 500, user: { firstName: "Test" } } as any,
            ])

            // When
            const result = await service.getLeaderboard()

            // Then
            expect(result).toHaveLength(1)
            expect(logger.warn).toHaveBeenCalledWith(
                "리더보드 캐시 조회 실패, DB에서 조회",
                expect.any(Error)
            )
        })
    })

    describe("getAchievements (업적 목록 조회)", () => {
        it("getBadges를 위임 호출하여 id를 문자열로 변환한다", async () => {
            // Given
            badgeService.getAllBadges.mockResolvedValue([
                { id: 42, code: "c", title: "T", description: "D", iconName: "icon", category: "cat" } as any,
            ])
            badgeService.getUnlockedBadges.mockResolvedValue([])

            // When
            const result = await service.getAchievements(1)

            // Then
            expect(result[0].id).toBe("42")
            expect(result[0].title).toBe("T")
            expect(result[0].isUnlocked).toBe(false)
            expect(result[0].unlockedAt).toBeNull()
        })
    })

    describe("getUnseenRewards (미확인 보상 조회)", () => {
        it("미확인 뱃지와 레벨업 정보를 반환한다", async () => {
            // Given
            const unlockedAt = new Date()
            badgeService.getUnseenBadges.mockResolvedValue([
                {
                    badge: { id: 1, code: "b1", title: "B1", description: "D1", iconName: "i1", category: "c1" } as any,
                    unlockedAt,
                } as any,
            ])
            const updatedAt = new Date()
            levelRepo.findOrCreateByUserId.mockResolvedValue({
                level: 2,
                lastSeenLevel: 1,
                updatedAt,
                getUnseenLevelUp: () => ({ fromLevel: 1, toLevel: 2 }),
            } as any)

            // When
            const result = await service.getUnseenRewards(1)

            // Then
            expect(result.newBadges).toHaveLength(1)
            expect(result.newBadges[0].id).toBe(1)
            expect(result.levelUps).toHaveLength(1)
            expect(result.levelUps[0]).toEqual({
                fromLevel: 1,
                toLevel: 2,
                achievedAt: updatedAt,
            })
        })

        it("레벨업이 없으면 빈 levelUps를 반환한다", async () => {
            // Given
            badgeService.getUnseenBadges.mockResolvedValue([])
            levelRepo.findOrCreateByUserId.mockResolvedValue({
                level: 1,
                lastSeenLevel: 1,
                getUnseenLevelUp: () => null,
            } as any)

            // When
            const result = await service.getUnseenRewards(1)

            // Then
            expect(result.newBadges).toHaveLength(0)
            expect(result.levelUps).toHaveLength(0)
        })
    })

    describe("acknowledgeRewards (보상 확인 처리)", () => {
        it("뱃지 확인과 레벨 업데이트를 수행한다", async () => {
            // Given
            levelRepo.findOrCreateByUserId.mockResolvedValue({
                level: 2,
                lastSeenLevel: 1,
                getUnseenLevelUp: () => ({ fromLevel: 1, toLevel: 2 }),
                canAcknowledgeLevel: (l: number) => l > 1 && l <= 2,
            } as any)

            // When
            const result = await service.acknowledgeRewards(1, [1, 2], 2)

            // Then
            expect(badgeService.markBadgesAsSeen).toHaveBeenCalledWith(1, [1, 2])
            expect(levelRepo.updateLastSeenLevel).toHaveBeenCalledWith(1, 2)
            expect(result.acknowledgedBadges).toBe(2)
            expect(result.acknowledgedLevel).toBe(2)
        })

        it("빈 badgeIds면 markBadgesAsSeen을 호출하지 않는다", async () => {
            // Given
            levelRepo.findOrCreateByUserId.mockResolvedValue({
                level: 2,
                lastSeenLevel: 1,
                canAcknowledgeLevel: (l: number) => l > 1 && l <= 2,
            } as any)

            // When
            await service.acknowledgeRewards(1, [])

            // Then
            expect(badgeService.markBadgesAsSeen).not.toHaveBeenCalled()
        })

        it("요청 레벨이 현재 레벨보다 높으면 무시한다 (유효하지 않은 값)", async () => {
            // Given
            levelRepo.findOrCreateByUserId.mockResolvedValue({
                level: 3,
                lastSeenLevel: 2,
                canAcknowledgeLevel: (l: number) => l > 2 && l <= 3,
            } as any)

            // When
            const result = await service.acknowledgeRewards(1, [], 5)

            // Then
            expect(levelRepo.updateLastSeenLevel).not.toHaveBeenCalled()
            expect(result.acknowledgedLevel).toBeNull()
        })

        it("요청 레벨이 lastSeenLevel 이하이면 무시한다", async () => {
            // Given
            levelRepo.findOrCreateByUserId.mockResolvedValue({
                level: 3,
                lastSeenLevel: 3,
                canAcknowledgeLevel: (l: number) => l > 3 && l <= 3,
            } as any)

            // When
            const result = await service.acknowledgeRewards(1, [], 3)

            // Then
            expect(levelRepo.updateLastSeenLevel).not.toHaveBeenCalled()
            expect(result.acknowledgedLevel).toBeNull()
        })

        it("levelAcknowledged가 undefined면 레벨 처리를 건너뛴다", async () => {
            // When
            const result = await service.acknowledgeRewards(1, [])

            // Then
            expect(levelRepo.findOrCreateByUserId).not.toHaveBeenCalled()
            expect(result.acknowledgedLevel).toBeNull()
        })
    })
})
