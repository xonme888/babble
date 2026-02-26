import "reflect-metadata"
import { AssessmentCompletedStatsHandler } from "@features/user/handlers/assessment-completed-stats.handler"
import { AssessmentCompletedEvent } from "@features/assessment/domain/events/assessment-completed.event"
import { createMockLogger } from "../../utils/mock-factories"
import type { IUserStatsUpdater } from "@features/user/domain/user-stats-updater.interface"

describe("AssessmentCompletedStatsHandler (통계 캐시 무효화)", () => {
    let mockLogger: ReturnType<typeof createMockLogger>
    let mockUserStatsUpdater: jest.Mocked<IUserStatsUpdater>
    let handler: AssessmentCompletedStatsHandler

    beforeEach(() => {
        jest.clearAllMocks()
        mockLogger = createMockLogger()
        mockUserStatsUpdater = {
            invalidateStatsCache: jest.fn().mockResolvedValue(undefined),
        }
        handler = new AssessmentCompletedStatsHandler(mockLogger, mockUserStatsUpdater)
    })

    it("eventType이 'AssessmentCompletedEvent'를 반환해야 한다", () => {
        expect(handler.eventType()).toBe("AssessmentCompletedEvent")
    })

    it("userId가 있으면 사용자 통계 캐시를 무효화해야 한다", async () => {
        // Given
        const event = new AssessmentCompletedEvent(42, 100, 85.5, "Hello world spoken text")

        // When
        await handler.handle(event)

        // Then
        expect(mockUserStatsUpdater.invalidateStatsCache).toHaveBeenCalledWith(100)
    })

    it("userId가 null이면 캐시 무효화를 호출하지 않아야 한다", async () => {
        // Given
        const event = new AssessmentCompletedEvent(42, null as unknown as number, 85.5, "Hello world")

        // When
        await handler.handle(event)

        // Then
        expect(mockUserStatsUpdater.invalidateStatsCache).not.toHaveBeenCalled()
    })

    it("캐시 무효화 실패 시 throw하지 않고 error 로그를 남겨야 한다", async () => {
        // Given
        const event = new AssessmentCompletedEvent(42, 100, 85.5, "Hello world")
        mockUserStatsUpdater.invalidateStatsCache.mockRejectedValue(new Error("Redis error"))

        // When
        await handler.handle(event)

        // Then
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining("[AssessmentCompletedStatsHandler] 처리 실패"),
            expect.any(Error)
        )
    })
})
