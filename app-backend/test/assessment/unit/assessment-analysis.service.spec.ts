import "reflect-metadata"
import type { AssessmentRepository } from "@features/assessment/infrastructure/assessment.repository"
import type { IAnalysisQueue } from "@shared/core/queue.interface"
import { AnalysisType } from "@shared/core/queue.interface"
import { NotFoundException } from "@shared/core/exceptions/domain-exceptions"
import { AssessmentType } from "@shared/core/constants/api-contract"
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
        it("스크립트가 있는 평가를 SCRIPT 타입으로 큐에 추가해야 한다", async () => {
            const mockAssessment = createTestAssessment({
                scriptSnapshotContent: "Hello world",
            })

            mockRepository.findByIdOrThrow.mockResolvedValue(mockAssessment)

            await service.analyzeAssessment(1)

            expect(mockRepository.findByIdOrThrow).toHaveBeenCalledWith(1)
            expect(mockAnalysisQueue.enqueue).toHaveBeenCalledWith(
                {
                    analysisType: AnalysisType.SCRIPT,
                    assessmentId: 1,
                    audioUrl: "test.wav",
                    scriptContent: "Hello world",
                },
                {
                    jobId: "assessment-1-0",
                }
            )
        })

        it("WORD_PRACTICE 유형의 평가를 WORD 분석 타입으로 큐에 추가해야 한다", async () => {
            const mockAssessment = createTestAssessment({
                scriptSnapshotContent: "사과",
                assessmentType: AssessmentType.WORD_PRACTICE,
            })

            mockRepository.findByIdOrThrow.mockResolvedValue(mockAssessment)

            await service.analyzeAssessment(1)

            expect(mockAnalysisQueue.enqueue).toHaveBeenCalledWith(
                {
                    analysisType: AnalysisType.WORD,
                    assessmentId: 1,
                    audioUrl: "test.wav",
                    scriptContent: "사과",
                },
                {
                    jobId: "assessment-1-0",
                }
            )
        })

        it("스크립트가 없는 평가를 FREE_SPEECH 타입으로 큐에 추가해야 한다", async () => {
            const mockAssessment = createTestAssessment()

            mockRepository.findByIdOrThrow.mockResolvedValue(mockAssessment)

            await service.analyzeAssessment(1)

            expect(mockAnalysisQueue.enqueue).toHaveBeenCalledWith(
                {
                    analysisType: AnalysisType.FREE_SPEECH,
                    assessmentId: 1,
                    audioUrl: "test.wav",
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

    describe("scheduleRetry (재시도 예약)", () => {
        it("WORD_PRACTICE 유형의 재시도를 WORD 분석 타입으로 예약해야 한다", async () => {
            const mockAssessment = createTestAssessment({
                scriptSnapshotContent: "바나나",
                assessmentType: AssessmentType.WORD_PRACTICE,
            })

            mockRepository.findById.mockResolvedValue(mockAssessment)

            await service.scheduleRetry(1, 5000)

            expect(mockAnalysisQueue.enqueue).toHaveBeenCalledWith(
                {
                    analysisType: AnalysisType.WORD,
                    assessmentId: 1,
                    audioUrl: "test.wav",
                    scriptContent: "바나나",
                },
                {
                    jobId: "assessment-1-retry-0",
                    delay: 5000,
                }
            )
        })
    })
})
