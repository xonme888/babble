import "reflect-metadata"
import { AssessmentCompletedLearningHandler } from "@features/learning/handlers/assessment-completed-learning.handler"
import { AssessmentCompletedEvent } from "@features/assessment/domain/events/assessment-completed.event"
import { ActivityType } from "@features/learning/domain/learning-record.entity"
import { createMockLogger, createMockLearningRecordService } from "../../utils/mock-factories"

describe("AssessmentCompletedLearningHandler (진단 완료 → 학습 기록)", () => {
    let handler: AssessmentCompletedLearningHandler
    let mockLearningRecordService: ReturnType<typeof createMockLearningRecordService>
    let mockLogger: ReturnType<typeof createMockLogger>

    beforeEach(() => {
        jest.clearAllMocks()
        mockLearningRecordService = createMockLearningRecordService()
        mockLogger = createMockLogger()
        handler = new AssessmentCompletedLearningHandler(mockLearningRecordService, mockLogger)
    })

    it("eventType이 'AssessmentCompletedEvent'를 반환해야 한다", () => {
        expect(handler.eventType()).toBe("AssessmentCompletedEvent")
    })

    it("이벤트 수신 시 recordActivity를 올바른 파라미터로 호출해야 한다", async () => {
        // Given
        const event = new AssessmentCompletedEvent(42, 100, 85, "Hello world")

        // When
        await handler.handle(event)

        // Then
        expect(mockLearningRecordService.recordActivity).toHaveBeenCalledWith({
            userId: 100,
            activityType: ActivityType.ASSESSMENT,
            referenceId: 42,
            score: 85,
        })
    })

    it("recordActivity 성공 시 info 로그를 남겨야 한다", async () => {
        // Given
        const event = new AssessmentCompletedEvent(42, 100, 85, "Hello world")

        // When
        await handler.handle(event)

        // Then
        expect(mockLogger.info).toHaveBeenCalledWith(
            expect.stringContaining("42")
        )
    })

    it("recordActivity 실패 시 throw하지 않고 error 로그를 남겨야 한다", async () => {
        // Given
        const event = new AssessmentCompletedEvent(42, 100, 85, "Hello world")
        mockLearningRecordService.recordActivity.mockRejectedValue(new Error("DB error"))

        // When
        await handler.handle(event)

        // Then
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining("42"),
            expect.any(Error)
        )
    })
})
