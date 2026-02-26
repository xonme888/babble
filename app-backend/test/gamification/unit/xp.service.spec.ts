import "reflect-metadata"
import { XpService } from "@features/gamification/application/xp.service"
import { XpSource } from "@features/gamification/domain/xp-transaction.entity"
import { UserLevel } from "@features/gamification/domain/user-level.entity"
import { GamificationRedisKeys } from "@features/gamification/domain/gamification-redis-keys"
import {
    createMockLogger,
    createMockDomainEventDispatcher,
    createMockRedisService,
} from "../../utils/mock-factories"

import type { XpTransactionRepository } from "@features/gamification/infrastructure/xp-transaction.repository"
import type { UserLevelRepository } from "@features/gamification/infrastructure/user-level.repository"

describe("XpService (XP 서비스)", () => {
    let service: XpService
    let xpRepo: jest.Mocked<XpTransactionRepository>
    let levelRepo: jest.Mocked<UserLevelRepository>
    let eventDispatcher: ReturnType<typeof createMockDomainEventDispatcher>
    let redisService: ReturnType<typeof createMockRedisService>
    let logger: ReturnType<typeof createMockLogger>

    beforeEach(() => {
        xpRepo = {
            save: jest.fn().mockImplementation(async (tx) => ({ ...tx, id: 1 })),
            getWeeklyXp: jest.fn().mockResolvedValue(0),
            existsBySourceAndReference: jest.fn().mockResolvedValue(false),
        } as unknown as jest.Mocked<XpTransactionRepository>

        levelRepo = {
            findOrCreateByUserId: jest.fn(),
            save: jest.fn().mockImplementation(async (ul) => ul),
        } as unknown as jest.Mocked<UserLevelRepository>

        eventDispatcher = createMockDomainEventDispatcher()
        redisService = createMockRedisService()
        logger = createMockLogger()

        service = new XpService(xpRepo, levelRepo, eventDispatcher, redisService, logger)
    })

    describe("awardXp (XP 부여)", () => {
        it("0 이하 XP는 무시한다", async () => {
            await service.awardXp({ userId: 1, amount: 0, source: XpSource.ASSESSMENT })
            await service.awardXp({ userId: 1, amount: -10, source: XpSource.GAME })

            expect(xpRepo.save).not.toHaveBeenCalled()
        })

        it("XP 트랜잭션을 저장하고 레벨을 갱신한다", async () => {
            // Given
            const userLevel = UserLevel.create(1)
            levelRepo.findOrCreateByUserId.mockResolvedValue(userLevel)

            // When
            await service.awardXp({
                userId: 1,
                amount: 50,
                source: XpSource.ASSESSMENT,
                referenceId: 100,
                description: "Assessment 완료",
            })

            // Then
            expect(xpRepo.save).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: 1,
                    amount: 50,
                    source: XpSource.ASSESSMENT,
                    referenceId: 100,
                })
            )
            expect(levelRepo.save).toHaveBeenCalledWith(userLevel)
            expect(userLevel.totalXp).toBe(50)
        })

        it("레벨업 시 LevelUpEvent를 발행한다", async () => {
            // Given — 레벨 2 필요 XP: 240
            const userLevel = UserLevel.create(1)
            levelRepo.findOrCreateByUserId.mockResolvedValue(userLevel)

            // When
            await service.awardXp({ userId: 1, amount: 240, source: XpSource.ASSESSMENT })

            // Then
            expect(userLevel.level).toBe(2)
            expect(eventDispatcher.dispatchAsync).toHaveBeenCalledWith(
                expect.objectContaining({ userId: 1 })
            )
        })

        it("레벨업이 없으면 이벤트를 발행하지 않는다", async () => {
            // Given
            const userLevel = UserLevel.create(1)
            levelRepo.findOrCreateByUserId.mockResolvedValue(userLevel)

            // When
            await service.awardXp({ userId: 1, amount: 10, source: XpSource.DAILY_GOAL })

            // Then
            expect(eventDispatcher.dispatchAsync).not.toHaveBeenCalled()
        })

        it("XP 부여 후 프로필과 리더보드 캐시를 무효화한다", async () => {
            // Given
            const userLevel = UserLevel.create(1)
            levelRepo.findOrCreateByUserId.mockResolvedValue(userLevel)

            // When
            await service.awardXp({ userId: 42, amount: 50, source: XpSource.ASSESSMENT })

            // Then
            expect(redisService.delete).toHaveBeenCalledWith(GamificationRedisKeys.profile(42))
            expect(redisService.delete).toHaveBeenCalledWith(GamificationRedisKeys.leaderboard(10))
        })

        it("캐시 무효화 실패 시 XP 부여는 정상 완료된다", async () => {
            // Given
            const userLevel = UserLevel.create(1)
            levelRepo.findOrCreateByUserId.mockResolvedValue(userLevel)
            redisService.delete.mockRejectedValue(new Error("Redis connection failed"))

            // When
            await service.awardXp({ userId: 1, amount: 50, source: XpSource.ASSESSMENT })

            // Then
            expect(xpRepo.save).toHaveBeenCalled()
            expect(levelRepo.save).toHaveBeenCalled()
            expect(logger.warn).toHaveBeenCalledWith(
                "게임화 캐시 무효화 실패",
                expect.any(Error)
            )
        })
    })

    describe("getWeeklyXp (주간 XP 조회)", () => {
        it("xpRepo.getWeeklyXp에 위임한다", async () => {
            xpRepo.getWeeklyXp.mockResolvedValue(150)

            const result = await service.getWeeklyXp(42)

            expect(result).toBe(150)
            expect(xpRepo.getWeeklyXp).toHaveBeenCalledWith(42, expect.any(Date))
        })
    })
})
