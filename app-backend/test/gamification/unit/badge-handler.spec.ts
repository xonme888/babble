import "reflect-metadata"
import {
    AssessmentBadgeHandler,
    GameSessionBadgeHandler,
    LevelUpBadgeHandler,
} from "@features/gamification/handlers/badge.handler"
import { AssessmentCompletedEvent } from "@features/assessment/domain/events/assessment-completed.event"
import { GameSessionCompletedEvent } from "@features/game/domain/events/game-session-completed.event"
import { LevelUpEvent } from "@features/gamification/domain/events/level-up.event"
import { createMockLogger } from "../../utils/mock-factories"
import type { BadgeService } from "@features/gamification/application/badge.service"

/** BadgeService mock */
function createMockBadgeService(): jest.Mocked<BadgeService> {
    return {
        evaluateAndUnlock: jest.fn(),
    } as unknown as jest.Mocked<BadgeService>
}

describe("Badge 이벤트 핸들러", () => {
    let mockBadgeService: jest.Mocked<BadgeService>
    let mockLogger: ReturnType<typeof createMockLogger>

    beforeEach(() => {
        jest.clearAllMocks()
        mockBadgeService = createMockBadgeService()
        mockLogger = createMockLogger()
    })

    describe("AssessmentBadgeHandler (진단 완료 → 뱃지 체크)", () => {
        let handler: AssessmentBadgeHandler

        beforeEach(() => {
            handler = new AssessmentBadgeHandler(mockBadgeService, mockLogger)
        })

        it("eventType이 'AssessmentCompletedEvent'를 반환해야 한다", () => {
            expect(handler.eventType()).toBe("AssessmentCompletedEvent")
        })

        it("이벤트 수신 시 evaluateAndUnlock을 호출해야 한다", async () => {
            // Given
            const event = new AssessmentCompletedEvent(1, 100, 85, "Hello")

            // When
            await handler.handle(event)

            // Then
            expect(mockBadgeService.evaluateAndUnlock).toHaveBeenCalledWith(100)
        })

        it("evaluateAndUnlock 실패 시 throw하지 않고 error 로그를 남겨야 한다", async () => {
            // Given
            const event = new AssessmentCompletedEvent(42, 100, 85, "Hello")
            mockBadgeService.evaluateAndUnlock.mockRejectedValue(new Error("DB error"))

            // When
            await handler.handle(event)

            // Then
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining("42"),
                expect.any(Error)
            )
        })
    })

    describe("GameSessionBadgeHandler (게임 세션 완료 → 뱃지 체크)", () => {
        let handler: GameSessionBadgeHandler

        beforeEach(() => {
            handler = new GameSessionBadgeHandler(mockBadgeService, mockLogger)
        })

        it("eventType이 'GameSessionCompletedEvent'를 반환해야 한다", () => {
            expect(handler.eventType()).toBe("GameSessionCompletedEvent")
        })

        it("이벤트 수신 시 evaluateAndUnlock을 호출해야 한다", async () => {
            // Given
            const event = new GameSessionCompletedEvent(1, 200, "word_match", 90, 0.95, 120)

            // When
            await handler.handle(event)

            // Then
            expect(mockBadgeService.evaluateAndUnlock).toHaveBeenCalledWith(200)
        })

        it("evaluateAndUnlock 실패 시 throw하지 않고 error 로그를 남겨야 한다", async () => {
            // Given
            const event = new GameSessionCompletedEvent(77, 200, "word_match", 90, 0.95, 120)
            mockBadgeService.evaluateAndUnlock.mockRejectedValue(new Error("DB error"))

            // When
            await handler.handle(event)

            // Then
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining("77"),
                expect.any(Error)
            )
        })
    })

    describe("LevelUpBadgeHandler (레벨업 → 뱃지 체크)", () => {
        let handler: LevelUpBadgeHandler

        beforeEach(() => {
            handler = new LevelUpBadgeHandler(mockBadgeService, mockLogger)
        })

        it("eventType이 'LevelUpEvent'를 반환해야 한다", () => {
            expect(handler.eventType()).toBe("LevelUpEvent")
        })

        it("이벤트 수신 시 evaluateAndUnlock을 호출해야 한다", async () => {
            // Given
            const event = new LevelUpEvent(300, 5, 1000)

            // When
            await handler.handle(event)

            // Then
            expect(mockBadgeService.evaluateAndUnlock).toHaveBeenCalledWith(300)
        })

        it("evaluateAndUnlock 실패 시 throw하지 않고 error 로그를 남겨야 한다", async () => {
            // Given
            const event = new LevelUpEvent(300, 5, 1000)
            mockBadgeService.evaluateAndUnlock.mockRejectedValue(new Error("DB error"))

            // When
            await handler.handle(event)

            // Then
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining("300"),
                expect.any(Error)
            )
        })
    })
})
