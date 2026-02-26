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
import { GameSessionService } from "@features/game/application/game-session.service"
import { GameType, GameDifficulty } from "@features/game/domain/game-session.entity"
import { GameScriptCompletion } from "@features/game/domain/game-script-completion.entity"
import { XpSource } from "@features/gamification/domain/xp-transaction.entity"
import { calculateGameSessionXp } from "@features/gamification/domain/xp-rules"
import {
    createMockGameSessionRepository,
    createMockGameScriptCompletionRepository,
    createMockGameWordResultRepository,
    createMockGameXpCalculator,
    createMockXpService,
    createMockDomainEventDispatcher,
    createMockLearningRecordService,
    createMockCompletionProcessor,
} from "../../utils/mock-factories"

describe("GameSessionService", () => {
    let service: GameSessionService
    let mockSessionRepo: ReturnType<typeof createMockGameSessionRepository>
    let mockCompletionRepo: ReturnType<typeof createMockGameScriptCompletionRepository>
    let mockWordResultRepo: ReturnType<typeof createMockGameWordResultRepository>
    let mockXpCalculator: ReturnType<typeof createMockGameXpCalculator>
    let mockXpService: ReturnType<typeof createMockXpService>
    let mockEventDispatcher: ReturnType<typeof createMockDomainEventDispatcher>
    let mockLearningRecordService: ReturnType<typeof createMockLearningRecordService>
    let mockCompletionProcessor: ReturnType<typeof createMockCompletionProcessor>

    const baseParams = {
        userId: 1,
        gameType: GameType.WORD_MATCH,
        difficulty: GameDifficulty.EASY,
        correctCount: 8,
        totalCount: 10,
        duration: 120,
        score: 800,
    }

    beforeEach(() => {
        mockSessionRepo = createMockGameSessionRepository()
        mockCompletionRepo = createMockGameScriptCompletionRepository()
        mockWordResultRepo = createMockGameWordResultRepository()
        mockXpCalculator = createMockGameXpCalculator()
        mockXpService = createMockXpService()
        mockEventDispatcher = createMockDomainEventDispatcher()
        mockLearningRecordService = createMockLearningRecordService()
        mockCompletionProcessor = createMockCompletionProcessor()

        // v1 경로에서 saved.accuracy getter를 사용하므로 클래스 인스턴스 보존
        mockSessionRepo.save.mockImplementation(async (s) => {
            Object.assign(s, { id: s.id ?? 1 })
            return s
        })

        service = new GameSessionService(
            mockSessionRepo,
            mockCompletionRepo,
            mockWordResultRepo,
            mockXpCalculator,
            mockXpService,
            mockEventDispatcher,
            mockLearningRecordService,
            mockCompletionProcessor
        )
    })

    describe("createSession -- wordResults 없을 때 (기존 로직)", () => {
        it("세션을 저장하고 이벤트를 발행한다", async () => {
            const result = await service.createSession(baseParams)

            expect(result.session).toBeDefined()
            expect(result.xpBreakdown).toBeUndefined()
            expect(mockSessionRepo.save).toHaveBeenCalledTimes(1)
            expect(mockLearningRecordService.recordActivity).toHaveBeenCalledTimes(1)
            expect(mockEventDispatcher.dispatchAsync).toHaveBeenCalledTimes(1)
        })

        it("이벤트에 wordResultsProvided=false를 포함한다", async () => {
            await service.createSession(baseParams)

            const event = mockEventDispatcher.dispatchAsync.mock.calls[0][0]
            expect(event.wordResultsProvided).toBe(false)
        })

        it("calculateGameSessionXp로 계산한 XP를 직접 부여한다", async () => {
            // accuracy = 80% (correctCount: 8, totalCount: 10) → 기본 + 보너스
            const expectedAmount = calculateGameSessionXp(80)

            await service.createSession(baseParams)

            expect(mockXpService.awardXp).toHaveBeenCalledTimes(1)
            expect(mockXpService.awardXp).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: 1,
                    amount: expectedAmount,
                    source: XpSource.GAME,
                })
            )
        })

        it("v2 XP 계산기(calculate)는 호출하지 않는다", async () => {
            await service.createSession(baseParams)

            expect(mockXpCalculator.calculate).not.toHaveBeenCalled()
        })
    })

    describe("createSession -- wordResults 있을 때 (v2 XP 차등)", () => {
        const wordResults = [
            {
                scriptId: 1,
                word: "hello",
                wordIndex: 0,
                isCorrect: true,
                attempts: 1,
                hintUsed: false,
            },
            {
                scriptId: 1,
                word: "world",
                wordIndex: 1,
                isCorrect: false,
                attempts: 2,
                hintUsed: true,
            },
        ]

        beforeEach(() => {
            mockXpCalculator.calculate.mockReturnValue({
                scripts: [
                    {
                        scriptId: 1,
                        type: "first_clear",
                        baseXp: 20,
                        perfectBonus: 0,
                        hintPenalty: 2,
                        comboBonus: 0,
                        subtotal: 18,
                    },
                ],
                rawTotal: 18,
                sessionCap: 60,
                cappedTotal: 18,
                overtimeMultiplier: 1,
                finalXp: 18,
            })
        })

        it("CompletionProcessor에 단어 결과 저장을 위임한다", async () => {
            await service.createSession({ ...baseParams, wordResults })

            expect(mockCompletionProcessor.saveWordResults).toHaveBeenCalledTimes(1)
            expect(mockCompletionProcessor.saveWordResults).toHaveBeenCalledWith(
                expect.any(Number),
                1,
                wordResults
            )
        })

        it("CompletionProcessor에 completion upsert를 위임한다", async () => {
            await service.createSession({ ...baseParams, wordResults })

            expect(mockCompletionProcessor.upsertCompletions).toHaveBeenCalledTimes(1)
            expect(mockCompletionProcessor.upsertCompletions).toHaveBeenCalledWith(1, wordResults)
        })

        it("XP 계산기를 호출하고 XP를 부여한다", async () => {
            await service.createSession({ ...baseParams, wordResults })

            expect(mockXpCalculator.calculate).toHaveBeenCalledTimes(1)
            expect(mockXpService.awardXp).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: 1,
                    amount: 18,
                    source: "GAME",
                })
            )
        })

        it("xpBreakdown을 반환한다", async () => {
            const result = await service.createSession({ ...baseParams, wordResults })

            expect(result.xpBreakdown).toBeDefined()
            expect(result.xpBreakdown!.finalXp).toBe(18)
        })

        it("이벤트에 wordResultsProvided=true를 포함한다", async () => {
            await service.createSession({ ...baseParams, wordResults })

            const event = mockEventDispatcher.dispatchAsync.mock.calls[0][0]
            expect(event.wordResultsProvided).toBe(true)
        })

        it("isOvertime 조회 후 XP 계산에 전달한다", async () => {
            mockLearningRecordService.isOvertime = jest.fn().mockResolvedValue(true)

            await service.createSession({ ...baseParams, wordResults })

            expect(mockLearningRecordService.isOvertime).toHaveBeenCalledWith(1)
            expect(mockXpCalculator.calculate).toHaveBeenCalledWith(
                expect.objectContaining({ isOvertime: true })
            )
        })

        it("finalXp가 0이면 awardXp를 호출하지 않는다", async () => {
            mockXpCalculator.calculate.mockReturnValue({
                scripts: [],
                rawTotal: 0,
                sessionCap: 60,
                cappedTotal: 0,
                overtimeMultiplier: 1,
                finalXp: 0,
            })

            await service.createSession({ ...baseParams, wordResults })

            expect(mockXpService.awardXp).not.toHaveBeenCalled()
        })
    })

    describe("createSession -- comboMaxStreak", () => {
        it("comboMaxStreak를 세션에 전달한다", async () => {
            await service.createSession({ ...baseParams, comboMaxStreak: 5 })

            const savedSession = mockSessionRepo.save.mock.calls[0][0]
            expect(savedSession.comboMaxStreak).toBe(5)
        })
    })

    describe("getWeakScripts (취약 스크립트 리포트)", () => {
        it("정답률 낮은 스크립트를 mostMissedWords와 함께 반환한다", async () => {
            // Given
            mockCompletionRepo.findWeakScripts.mockResolvedValue([
                {
                    scriptId: 1,
                    scriptContent: "테스트 문장",
                    totalAttempts: 10,
                    correctRate: 40,
                    lastPlayedAt: new Date("2026-02-18"),
                },
            ])
            mockWordResultRepo.findMostMissedWordsBatch.mockResolvedValue(
                new Map([[1, [{ word: "어려운단어", missCount: 5 }]]])
            )

            // When
            const result = await service.getWeakScripts(1, 10)

            // Then
            expect(result).toHaveLength(1)
            expect(result[0].scriptId).toBe(1)
            expect(result[0].correctRate).toBe(40)
            expect(result[0].mostMissedWords).toHaveLength(1)
            expect(result[0].mostMissedWords[0].word).toBe("어려운단어")
            expect(mockWordResultRepo.findMostMissedWordsBatch).toHaveBeenCalledWith(1, [1], 3)
        })

        it("데이터 없으면 빈 배열을 반환한다", async () => {
            // Given
            mockCompletionRepo.findWeakScripts.mockResolvedValue([])

            // When
            const result = await service.getWeakScripts(1, 10)

            // Then
            expect(result).toEqual([])
        })

        it("limit 30 초과 시 30으로 제한한다", async () => {
            // Given
            mockCompletionRepo.findWeakScripts.mockResolvedValue([])

            // When
            await service.getWeakScripts(1, 50)

            // Then
            expect(mockCompletionRepo.findWeakScripts).toHaveBeenCalledWith(1, 30)
        })

        it("limit 0 이하 시 1로 제한한다", async () => {
            // Given
            mockCompletionRepo.findWeakScripts.mockResolvedValue([])

            // When
            await service.getWeakScripts(1, 0)

            // Then
            expect(mockCompletionRepo.findWeakScripts).toHaveBeenCalledWith(1, 1)
        })
    })
})
