import "reflect-metadata"
import { BadgeService } from "@features/gamification/application/badge.service"
import { BadgeConditionEvaluator } from "@features/gamification/domain/badge-condition-evaluator"
import { Badge, BadgeCategory } from "@features/gamification/domain/badge.entity"
import { UserBadge } from "@features/gamification/domain/user-badge.entity"
import { GamificationRedisKeys } from "@features/gamification/domain/gamification-redis-keys"
import { createMockLogger, createMockRedisService } from "../../utils/mock-factories"

import type { BadgeRepository } from "@features/gamification/infrastructure/badge.repository"
import type { UserBadgeRepository } from "@features/gamification/infrastructure/user-badge.repository"
import type { UserLevelRepository } from "@features/gamification/infrastructure/user-level.repository"
import type { LearningRecordService } from "@features/learning/application/learning-record.service"
import type { AssessmentRepository } from "@features/assessment/infrastructure/assessment.repository"

function createMockBadge(id: number, conditionType: string, value: number): Badge {
    const badge = new Badge()
    badge.id = id
    badge.code = `${conditionType.toUpperCase()}_${value}`
    badge.title = `${conditionType} ${value}`
    badge.description = "test"
    badge.iconName = "icon"
    badge.category = BadgeCategory.STREAK
    badge.condition = { type: conditionType, value }
    badge.orderIndex = id
    return badge
}

describe("BadgeService (뱃지 서비스)", () => {
    let service: BadgeService
    let badgeRepo: jest.Mocked<BadgeRepository>
    let userBadgeRepo: jest.Mocked<UserBadgeRepository>
    let levelRepo: jest.Mocked<UserLevelRepository>
    let learningRecordService: jest.Mocked<LearningRecordService>
    let assessmentRepo: jest.Mocked<AssessmentRepository>
    let redisService: ReturnType<typeof createMockRedisService>

    beforeEach(() => {
        badgeRepo = {
            findAll: jest.fn().mockResolvedValue([]),
            findByCode: jest.fn(),
            findById: jest.fn(),
            save: jest.fn(),
        } as unknown as jest.Mocked<BadgeRepository>

        userBadgeRepo = {
            save: jest.fn(),
            saveAll: jest.fn().mockImplementation(async (ubs) =>
                ubs.map((ub: UserBadge, i: number) => ({ ...ub, id: i + 1 }))
            ),
            existsByUserAndBadge: jest.fn(),
            findUnlockedBadgeIdsByUser: jest.fn().mockResolvedValue(new Set()),
            findUnlockedByUserId: jest.fn(),
            findUnseenByUserId: jest.fn(),
            markAllAsSeen: jest.fn(),
            markAsSeen: jest.fn(),
        } as unknown as jest.Mocked<UserBadgeRepository>

        levelRepo = {
            findOrCreateByUserId: jest.fn(),
        } as unknown as jest.Mocked<UserLevelRepository>

        learningRecordService = {
            getStreak: jest.fn(),
        } as unknown as jest.Mocked<LearningRecordService>

        assessmentRepo = {
            hasScoreAbove: jest.fn(),
            getStatsByUserId: jest.fn(),
        } as unknown as jest.Mocked<AssessmentRepository>

        redisService = createMockRedisService()

        service = new BadgeService(
            badgeRepo,
            userBadgeRepo,
            levelRepo,
            learningRecordService,
            assessmentRepo,
            redisService,
            createMockLogger(),
            new BadgeConditionEvaluator()
        )
    })

    describe("evaluateAndUnlock (뱃지 해금 평가)", () => {
        it("모든 뱃지가 이미 해금되었으면 빈 배열을 반환한다", async () => {
            // Given
            const badges = [createMockBadge(1, "streak", 7)]
            badgeRepo.findAll.mockResolvedValue(badges)
            userBadgeRepo.findUnlockedBadgeIdsByUser.mockResolvedValue(new Set([1]))

            // When
            const result = await service.evaluateAndUnlock(42)

            // Then
            expect(result).toEqual([])
        })

        it("뱃지가 없으면 빈 배열을 반환한다", async () => {
            badgeRepo.findAll.mockResolvedValue([])

            const result = await service.evaluateAndUnlock(42)

            expect(result).toEqual([])
        })

        it("streak 조건을 충족하면 뱃지를 해금한다", async () => {
            // Given
            const badge = createMockBadge(1, "streak", 7)
            badgeRepo.findAll.mockResolvedValue([badge])
            userBadgeRepo.findUnlockedBadgeIdsByUser.mockResolvedValue(new Set())
            learningRecordService.getStreak.mockResolvedValue({ currentStreak: 10, longestStreak: 10 })

            // When
            const result = await service.evaluateAndUnlock(42)

            // Then
            expect(result).toHaveLength(1)
            expect(userBadgeRepo.saveAll).toHaveBeenCalledWith(
                expect.arrayContaining([expect.objectContaining({ userId: 42, badgeId: 1 })])
            )
        })

        it("score 조건을 충족하면 뱃지를 해금한다", async () => {
            // Given
            const badge = createMockBadge(1, "score", 90)
            badgeRepo.findAll.mockResolvedValue([badge])
            userBadgeRepo.findUnlockedBadgeIdsByUser.mockResolvedValue(new Set())
            assessmentRepo.hasScoreAbove.mockResolvedValue(true)

            // When
            const result = await service.evaluateAndUnlock(42)

            // Then
            expect(result).toHaveLength(1)
        })

        it("count 조건을 충족하면 뱃지를 해금한다", async () => {
            // Given
            const badge = createMockBadge(1, "count", 5)
            badgeRepo.findAll.mockResolvedValue([badge])
            userBadgeRepo.findUnlockedBadgeIdsByUser.mockResolvedValue(new Set())
            assessmentRepo.getStatsByUserId.mockResolvedValue({
                totalLessons: 10, completedLessons: 7, averageScore: 85, totalPracticeSeconds: 3600,
            })

            // When
            const result = await service.evaluateAndUnlock(42)

            // Then
            expect(result).toHaveLength(1)
        })

        it("level 조건을 충족하면 뱃지를 해금한다", async () => {
            // Given
            const badge = createMockBadge(1, "level", 5)
            badgeRepo.findAll.mockResolvedValue([badge])
            userBadgeRepo.findUnlockedBadgeIdsByUser.mockResolvedValue(new Set())
            levelRepo.findOrCreateByUserId.mockResolvedValue({ level: 5 } as any)

            // When
            const result = await service.evaluateAndUnlock(42)

            // Then
            expect(result).toHaveLength(1)
        })

        it("조건을 충족하지 않으면 해금하지 않는다", async () => {
            // Given
            const badge = createMockBadge(1, "streak", 30)
            badgeRepo.findAll.mockResolvedValue([badge])
            userBadgeRepo.findUnlockedBadgeIdsByUser.mockResolvedValue(new Set())
            learningRecordService.getStreak.mockResolvedValue({ currentStreak: 5, longestStreak: 10 })

            // When
            const result = await service.evaluateAndUnlock(42)

            // Then
            expect(result).toEqual([])
            expect(userBadgeRepo.saveAll).not.toHaveBeenCalled()
        })

        it("배치 조회로 N+1을 방지한다 (findAll + findUnlockedBadgeIdsByUser만 호출)", async () => {
            // Given
            const badges = [createMockBadge(1, "streak", 7), createMockBadge(2, "streak", 14)]
            badgeRepo.findAll.mockResolvedValue(badges)
            userBadgeRepo.findUnlockedBadgeIdsByUser.mockResolvedValue(new Set())
            learningRecordService.getStreak.mockResolvedValue({ currentStreak: 15, longestStreak: 15 })

            // When
            await service.evaluateAndUnlock(42)

            // Then — streak 데이터를 1회만 조회
            expect(learningRecordService.getStreak).toHaveBeenCalledTimes(1)
            // existsByUserAndBadge는 호출하지 않음 (배치 조회)
            expect(userBadgeRepo.existsByUserAndBadge).not.toHaveBeenCalled()
        })

        it("새 뱃지 해금 시 프로필 캐시를 무효화한다", async () => {
            // Given
            const badge = createMockBadge(1, "streak", 7)
            badgeRepo.findAll.mockResolvedValue([badge])
            userBadgeRepo.findUnlockedBadgeIdsByUser.mockResolvedValue(new Set())
            learningRecordService.getStreak.mockResolvedValue({ currentStreak: 10, longestStreak: 10 })

            // When
            await service.evaluateAndUnlock(42)

            // Then
            expect(redisService.delete).toHaveBeenCalledWith(GamificationRedisKeys.profile(42))
        })

        it("뱃지 해금이 없으면 캐시 무효화를 호출하지 않는다", async () => {
            // Given
            badgeRepo.findAll.mockResolvedValue([])

            // When
            await service.evaluateAndUnlock(42)

            // Then
            expect(redisService.delete).not.toHaveBeenCalled()
        })
    })

    describe("getAllBadges (전체 뱃지 조회)", () => {
        it("badgeRepo.findAll에 위임한다", async () => {
            const badges = [createMockBadge(1, "streak", 7)]
            badgeRepo.findAll.mockResolvedValue(badges)

            const result = await service.getAllBadges()

            expect(result).toBe(badges)
        })
    })

    describe("markBadgesAsSeen (뱃지 확인 처리)", () => {
        it("badgeIds가 있으면 markAsSeen을 호출한다", async () => {
            await service.markBadgesAsSeen(42, [1, 2])
            expect(userBadgeRepo.markAsSeen).toHaveBeenCalledWith(42, [1, 2])
        })

        it("badgeIds가 없으면 markAllAsSeen을 호출한다", async () => {
            await service.markBadgesAsSeen(42)
            expect(userBadgeRepo.markAllAsSeen).toHaveBeenCalledWith(42)
        })
    })
})
