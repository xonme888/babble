export {}

// typeorm-transactional을 no-op mock (단위 테스트에서 DB 불필요)
jest.mock("typeorm-transactional", () => ({
    Transactional:
        () => (_target: Record<string, unknown>, _key: string, descriptor: PropertyDescriptor) =>
            descriptor,
    initializeTransactionalContext: jest.fn(),
    addTransactionalDataSource: (dataSource: unknown) => dataSource,
}))

import "reflect-metadata"
import { DailyChallengeService } from "@features/game/application/daily-challenge.service"
import { DailyChallenge, ChallengeStatus } from "@features/game/domain/daily-challenge.entity"
import { ChallengeParticipation } from "@features/game/domain/challenge-participation.entity"
import {
    createMockDailyChallengeRepository,
    createMockChallengeParticipationRepository,
    createMockScriptRepository,
    createMockXpService,
    createMockRedisService,
    createMockLogger,
} from "../../utils/mock-factories"

describe("DailyChallengeService", () => {
    let service: DailyChallengeService
    let challengeRepo: ReturnType<typeof createMockDailyChallengeRepository>
    let participationRepo: ReturnType<typeof createMockChallengeParticipationRepository>
    let scriptRepo: ReturnType<typeof createMockScriptRepository>
    let xpService: ReturnType<typeof createMockXpService>
    let redisService: ReturnType<typeof createMockRedisService>
    let logger: ReturnType<typeof createMockLogger>

    beforeEach(() => {
        challengeRepo = createMockDailyChallengeRepository()
        participationRepo = createMockChallengeParticipationRepository()
        scriptRepo = createMockScriptRepository()
        xpService = createMockXpService()
        redisService = createMockRedisService()
        logger = createMockLogger()

        service = new DailyChallengeService(
            challengeRepo,
            participationRepo,
            scriptRepo,
            xpService,
            redisService,
            logger
        )
    })

    describe("generateTodayChallenge", () => {
        it("이미 존재하면 기존 챌린지를 반환한다", async () => {
            const existing = DailyChallenge.create({
                challengeDate: "2026-02-24",
                scriptIds: [1, 2, 3],
            })
            Object.assign(existing, { id: 1 })
            challengeRepo.findByDate.mockResolvedValue(existing)

            const result = await service.generateTodayChallenge()

            expect(result.id).toBe(1)
            expect(challengeRepo.save).not.toHaveBeenCalled()
        })

        it("존재하지 않으면 새 챌린지를 생성한다", async () => {
            challengeRepo.findByDate.mockResolvedValue(null)
            scriptRepo.findRandom.mockResolvedValue([
                { id: 1 }, { id: 2 }, { id: 3 },
            ] as never)

            await service.generateTodayChallenge()

            expect(challengeRepo.save).toHaveBeenCalledWith(
                expect.objectContaining({
                    scriptIds: [1, 2, 3],
                    status: ChallengeStatus.ACTIVE,
                })
            )
        })

        it("활성 스크립트가 없으면 에러를 던진다", async () => {
            challengeRepo.findByDate.mockResolvedValue(null)
            scriptRepo.findRandom.mockResolvedValue([])

            await expect(service.generateTodayChallenge()).rejects.toThrow(
                "챌린지 스크립트를 선택할 수 없습니다"
            )
        })
    })

    describe("submitParticipation", () => {
        const activeChallenge = DailyChallenge.create({
            challengeDate: "2026-02-24",
            scriptIds: [1, 2],
        })

        beforeEach(() => {
            Object.assign(activeChallenge, { id: 1, participantCount: 0 })
            challengeRepo.findActiveByDate.mockResolvedValue(activeChallenge)
        })

        it("참여 결과를 저장하고 순위를 반환한다", async () => {
            participationRepo.countAboveScore.mockResolvedValue(2)

            const result = await service.submitParticipation({
                challengeId: 1,
                userId: 100,
                gameSessionId: null,
                correctCount: 8,
                totalCount: 10,
                duration: 60,
                comboMaxStreak: 5,
            })

            expect(participationRepo.save).toHaveBeenCalled()
            expect(xpService.awardXp).toHaveBeenCalled()
            expect(result.rank).toBe(3)
        })

        it("이미 참여했으면 ConflictException을 던진다", async () => {
            participationRepo.save.mockRejectedValue(new Error("duplicate key value violates unique constraint"))

            await expect(
                service.submitParticipation({
                    challengeId: 1,
                    userId: 100,
                    gameSessionId: null,
                    correctCount: 8,
                    totalCount: 10,
                    duration: 60,
                    comboMaxStreak: 5,
                })
            ).rejects.toThrow("이미 챌린지에 참여했습니다")
        })

        it("활성 챌린지가 없으면 NotFoundException을 던진다", async () => {
            challengeRepo.findActiveByDate.mockResolvedValue(null)

            await expect(
                service.submitParticipation({
                    challengeId: 999,
                    userId: 100,
                    gameSessionId: null,
                    correctCount: 8,
                    totalCount: 10,
                    duration: 60,
                    comboMaxStreak: 5,
                })
            ).rejects.toThrow("활성 챌린지를 찾을 수 없습니다")
        })
    })

    describe("getChallengeLeaderboard", () => {
        it("캐시된 리더보드가 있으면 파싱하여 반환한다", async () => {
            const cached = JSON.stringify([
                { rank: 1, userId: 1, firstName: "Alice", compositeScore: 9000 },
            ])
            redisService.get.mockResolvedValue(cached)

            const result = await service.getChallengeLeaderboard(1)

            expect(result).toHaveLength(1)
            expect(result[0].firstName).toBe("Alice")
            expect(participationRepo.getLeaderboard).not.toHaveBeenCalled()
        })

        it("캐시가 없으면 DB에서 조회 후 캐시에 저장한다", async () => {
            redisService.get.mockResolvedValue(null)

            const mockParticipation = {
                userId: 1,
                compositeScore: 8000,
                correctCount: 8,
                totalCount: 10,
                duration: 100,
                comboMaxStreak: 5,
                user: { firstName: "Bob" },
            } as unknown as ChallengeParticipation
            participationRepo.getLeaderboard.mockResolvedValue([mockParticipation])

            const result = await service.getChallengeLeaderboard(1)

            expect(result).toHaveLength(1)
            expect(result[0].rank).toBe(1)
            expect(result[0].firstName).toBe("Bob")
            expect(redisService.set).toHaveBeenCalledWith(
                "challenge:leaderboard:1",
                expect.any(String),
                30
            )
        })
    })

    describe("getMyRank", () => {
        it("참여하지 않았으면 null을 반환한다", async () => {
            participationRepo.findByUserAndChallenge.mockResolvedValue(null)

            const result = await service.getMyRank(1, 100)

            expect(result.rank).toBeNull()
            expect(result.participation).toBeNull()
        })

        it("참여했으면 순위를 계산하여 반환한다", async () => {
            const p = { compositeScore: 5000 } as ChallengeParticipation
            participationRepo.findByUserAndChallenge.mockResolvedValue(p)
            participationRepo.countAboveScore.mockResolvedValue(3)

            const result = await service.getMyRank(1, 100)

            expect(result.rank).toBe(4)
        })
    })

    describe("settleYesterdayChallenge", () => {
        it("미정산 챌린지가 없으면 바로 리턴한다", async () => {
            challengeRepo.findUnsettledBefore.mockResolvedValue([])

            await service.settleYesterdayChallenge()

            expect(participationRepo.findAllByChallenge).not.toHaveBeenCalled()
        })

        it("참여자가 없으면 챌린지만 정산 처리한다", async () => {
            const challenge = DailyChallenge.create({
                challengeDate: "2026-02-23",
                scriptIds: [1],
            })
            Object.assign(challenge, { id: 1 })
            challengeRepo.findUnsettledBefore.mockResolvedValue([challenge])
            participationRepo.findAllByChallenge.mockResolvedValue([])

            await service.settleYesterdayChallenge()

            expect(challengeRepo.save).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: ChallengeStatus.COMPLETED,
                    rewardsSettled: true,
                })
            )
        })
    })
})
