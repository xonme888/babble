import "reflect-metadata"
import type { AssessmentRepository } from "@features/assessment/infrastructure/assessment.repository"
import type { IAnalysisQueue } from "@shared/core/queue.interface"
import { NotFoundException } from "@shared/core/exceptions/domain-exceptions"
import {
    createMockAssessmentRepository,
    createMockDomainEventDispatcher,
    createMockLogger,
    createMockAnalysisQueue,
    createTestAssessment,
} from "../../utils/mock-factories"
import { AssessmentAnalysisService } from "@features/assessment/application/assessment-analysis.service"

describe("AssessmentAnalysisService (평가 분석 서비스)", () => {
    let service: AssessmentAnalysisService
    let mockRepository: jest.Mocked<AssessmentRepository>
    let mockAnalysisQueue: jest.Mocked<IAnalysisQueue>

    beforeEach(() => {
        jest.clearAllMocks()

        mockRepository = createMockAssessmentRepository()
        const mockEventDispatcher = createMockDomainEventDispatcher()
        const mockLogger = createMockLogger()
        mockAnalysisQueue = createMockAnalysisQueue()
        service = new AssessmentAnalysisService(
            mockRepository,
            mockEventDispatcher,
            mockLogger,
            mockAnalysisQueue
        )
    })

    describe("analyzeAssessment (평가 분석)", () => {
        it("평가를 찾고 큐에 분석 작업을 추가해야 한다", async () => {
            const mockAssessment = createTestAssessment({
                scriptSnapshotContent: "Hello world",
            })

            mockRepository.findByIdOrThrow.mockResolvedValue(mockAssessment)

            await service.analyzeAssessment(1)

            expect(mockRepository.findByIdOrThrow).toHaveBeenCalledWith(1)
            expect(mockAnalysisQueue.enqueue).toHaveBeenCalledWith(
                {
                    assessmentId: 1,
                    audioUrl: "test.wav",
                    scriptContent: "Hello world",
                },
                {
                    jobId: "assessment-1-0",
                }
            )
        })

        it("평가를 찾지 못한 경우 NotFoundException을 throw해야 한다", async () => {
            mockRepository.findByIdOrThrow.mockRejectedValue(
                new NotFoundException("assessment.not_found")
            )

            await expect(service.analyzeAssessment(999)).rejects.toThrow(NotFoundException)

            expect(mockRepository.findByIdOrThrow).toHaveBeenCalled()
            expect(mockAnalysisQueue.enqueue).not.toHaveBeenCalled()
        })

        it("큐 추가 실패 시 Assessment를 실패 상태로 업데이트하고 에러를 재throw해야 한다", async () => {
            const mockAssessment = createTestAssessment()
            mockAssessment.failAnalysis = jest.fn()
            mockAssessment.getDomainEvents = jest.fn().mockReturnValue([])
            mockAssessment.clearDomainEvents = jest.fn()

            mockRepository.findByIdOrThrow.mockResolvedValue(mockAssessment)
            mockAnalysisQueue.enqueue.mockRejectedValue(new Error("Queue connection failed"))

            await expect(service.analyzeAssessment(1)).rejects.toThrow("Queue connection failed")

            expect(mockAssessment.failAnalysis).toHaveBeenCalledWith(
                "Queue error: Queue connection failed"
            )
            expect(mockRepository.save).toHaveBeenCalled()
        })
    })
})
