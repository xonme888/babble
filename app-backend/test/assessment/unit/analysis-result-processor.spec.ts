import "reflect-metadata"
import { AnalysisResultProcessor } from "@features/assessment/application/analysis-result-processor"
import { AssessmentStatus } from "@features/assessment/domain/assessment.entity"
import {
    createMockAssessmentRepository,
    createMockDomainEventDispatcher,
    createMockLogger,
    createMockChapterProgressService,
    createMockRedisService,
    createTestAssessment,
} from "../../utils/mock-factories"
import type { AssessmentRepository } from "@features/assessment/infrastructure/assessment.repository"
import type { IDomainEventDispatcher } from "@shared/core/domain-event-dispatcher.interface"
import type { ILogger } from "@shared/core/logger.interface"
import type { ChapterProgressService } from "@features/script/application/chapter-progress.service"
import type { IRedisService } from "@shared/core/redis-service.interface"
import type { DataSource } from "typeorm"
import type { AIAnalysisResult } from "@features/assessment/domain/ai-analysis-result.interface"

export {}

describe("AnalysisResultProcessor (분석 결과 처리기)", () => {
    let processor: AnalysisResultProcessor
    let assessmentRepo: jest.Mocked<AssessmentRepository>
    let eventDispatcher: jest.Mocked<IDomainEventDispatcher>
    let logger: jest.Mocked<ILogger>
    let chapterProgressService: jest.Mocked<ChapterProgressService>
    let redisService: jest.Mocked<IRedisService>
    let dataSource: jest.Mocked<DataSource>
    let mockManager: { save: jest.Mock }

    /** 기본 성공 분석 결과 */
    const createSuccessResult = (overrides?: Partial<AIAnalysisResult>): AIAnalysisResult => ({
        jobId: "job-123",
        assessmentId: 1,
        success: true,
        score: 85,
        transcribed_text: "안녕하세요",
        similarity: 0.9,
        alignment: [{ text: "안녕하세요", status: "correct" }],
        pitch_data: [{ t: 0, f0: 100 }],
        speaking_rate: 3.5,
        fa_score: 0.88,
        phoneme_accuracy: 0.92,
        ...overrides,
    })

    /** 기본 실패 분석 결과 */
    const createFailureResult = (overrides?: Partial<AIAnalysisResult>): AIAnalysisResult => ({
        jobId: "job-456",
        assessmentId: 1,
        success: false,
        message: "Audio too short",
        ...overrides,
    })

    beforeEach(() => {
        assessmentRepo = createMockAssessmentRepository()
        eventDispatcher = createMockDomainEventDispatcher()
        logger = createMockLogger()
        chapterProgressService = createMockChapterProgressService()
        redisService = createMockRedisService()
        mockManager = { save: jest.fn() }
        dataSource = {
            transaction: jest.fn().mockImplementation(async (cb) => cb(mockManager)),
        } as unknown as jest.Mocked<DataSource>

        processor = new AnalysisResultProcessor(
            assessmentRepo,
            eventDispatcher,
            chapterProgressService,
            redisService,
            dataSource,
            logger
        )
    })

    describe("정상 처리", () => {
        it("성공 분석 결과 처리 시 applyAnalysisResult 호출 + 트랜잭션 저장한다", async () => {
            // Given
            const assessment = createTestAssessment({
                id: 1,
                status: AssessmentStatus.ANALYZING,
            })
            assessment.userId = 10
            assessment.scriptId = 5
            assessmentRepo.findById.mockResolvedValue(assessment)
            const result = createSuccessResult()

            // When
            await processor.process(result)

            // Then
            expect(assessmentRepo.findById).toHaveBeenCalledWith(1)
            expect(assessment.status).toBe(AssessmentStatus.COMPLETED)
            expect(dataSource.transaction).toHaveBeenCalledTimes(1)
            expect(mockManager.save).toHaveBeenCalledTimes(2) // assessment + logEntry
        })

        it("성공 처리 후 Assessment 상태가 COMPLETED로 전환된다", async () => {
            // Given
            const assessment = createTestAssessment({
                id: 1,
                status: AssessmentStatus.ANALYZING,
            })
            assessment.userId = 10
            assessment.scriptId = 5
            assessmentRepo.findById.mockResolvedValue(assessment)

            // When
            await processor.process(createSuccessResult())

            // Then
            expect(assessment.status).toBe(AssessmentStatus.COMPLETED)
            expect(assessment.score).toBe(85)
        })

        it("SSE 알림과 Redis 키 정리를 수행한다", async () => {
            // Given
            const assessment = createTestAssessment({
                id: 1,
                status: AssessmentStatus.ANALYZING,
            })
            assessment.userId = 10
            assessment.scriptId = 5
            assessmentRepo.findById.mockResolvedValue(assessment)

            // When
            await processor.process(createSuccessResult())

            // Then
            expect(redisService.publish).toHaveBeenCalledWith(
                "sse:assessment:updated",
                expect.stringContaining("\"assessmentId\":1")
            )
            expect(redisService.delete).toHaveBeenCalledWith("ai:results:job-123")
        })

        it("성공 시 번들 완료 체크를 수행한다", async () => {
            // Given
            const assessment = createTestAssessment({
                id: 1,
                status: AssessmentStatus.ANALYZING,
            })
            assessment.userId = 10
            assessment.scriptId = 5
            assessmentRepo.findById.mockResolvedValue(assessment)

            // When
            await processor.process(createSuccessResult())

            // Then
            expect(chapterProgressService.checkBundleCompletion).toHaveBeenCalledWith(10, 5)
        })

        it("이벤트 발행 후 clearDomainEvents를 호출한다", async () => {
            // Given
            const assessment = createTestAssessment({
                id: 1,
                status: AssessmentStatus.ANALYZING,
            })
            assessment.userId = 10
            assessment.scriptId = 5
            assessmentRepo.findById.mockResolvedValue(assessment)

            // When
            await processor.process(createSuccessResult())

            // Then
            expect(eventDispatcher.dispatchAll).toHaveBeenCalledTimes(1)
            // clearDomainEvents 호출 후 이벤트가 비어있어야 함
            expect(assessment.getDomainEvents()).toHaveLength(0)
        })
    })

    describe("엣지 케이스", () => {
        it("이미 COMPLETED인 Assessment는 중복 스킵 + info 로그를 남긴다", async () => {
            // Given
            const assessment = createTestAssessment({
                id: 1,
                status: AssessmentStatus.COMPLETED,
            })
            assessmentRepo.findById.mockResolvedValue(assessment)

            // When
            await processor.process(createSuccessResult())

            // Then
            expect(logger.info).toHaveBeenCalledWith(
                expect.stringContaining("already COMPLETED — skipping duplicate")
            )
            expect(dataSource.transaction).not.toHaveBeenCalled()
            expect(eventDispatcher.dispatchAll).not.toHaveBeenCalled()
        })

        it("Assessment 미존재 시 error 로그 + 조기 종료한다", async () => {
            // Given
            assessmentRepo.findById.mockResolvedValue(null)

            // When
            await processor.process(createSuccessResult())

            // Then
            expect(logger.error).toHaveBeenCalledWith(
                expect.stringContaining("Assessment 1 not found")
            )
            expect(dataSource.transaction).not.toHaveBeenCalled()
        })

        it("실패 분석 결과도 정상 처리한다 (FAILED 상태 전환)", async () => {
            // Given
            const assessment = createTestAssessment({
                id: 1,
                status: AssessmentStatus.ANALYZING,
                retryCount: 1,
            })
            assessment.userId = 10
            assessmentRepo.findById.mockResolvedValue(assessment)

            // When
            await processor.process(createFailureResult())

            // Then
            expect(assessment.status).toBe(AssessmentStatus.FAILED)
            expect(dataSource.transaction).toHaveBeenCalledTimes(1)
            // 실패 시에는 번들 완료 체크하지 않음
            expect(chapterProgressService.checkBundleCompletion).not.toHaveBeenCalled()
        })
    })

    describe("에러 격리", () => {
        it("이벤트 발행 실패 시 throw 없이 warn 로그를 남긴다", async () => {
            // Given
            const assessment = createTestAssessment({
                id: 1,
                status: AssessmentStatus.ANALYZING,
            })
            assessment.userId = 10
            assessment.scriptId = 5
            assessmentRepo.findById.mockResolvedValue(assessment)
            eventDispatcher.dispatchAll.mockRejectedValue(new Error("Event bus down"))

            // When — throw 발생하지 않아야 함
            await processor.process(createSuccessResult())

            // Then
            expect(logger.warn).toHaveBeenCalledWith(
                expect.stringContaining("Event dispatch failed: Event bus down")
            )
            // SSE 알림과 Redis 정리는 계속 진행
            expect(redisService.publish).toHaveBeenCalled()
            expect(redisService.delete).toHaveBeenCalled()
        })

        it("번들 완료 체크 실패 시 throw 없이 warn 로그를 남긴다", async () => {
            // Given
            const assessment = createTestAssessment({
                id: 1,
                status: AssessmentStatus.ANALYZING,
            })
            assessment.userId = 10
            assessment.scriptId = 5
            assessmentRepo.findById.mockResolvedValue(assessment)
            chapterProgressService.checkBundleCompletion.mockRejectedValue(
                new Error("DB connection lost")
            )

            // When — throw 발생하지 않아야 함
            await processor.process(createSuccessResult())

            // Then
            expect(logger.warn).toHaveBeenCalledWith(
                expect.stringContaining("Bundle completion check failed: DB connection lost")
            )
            // SSE 알림은 bundleCompletion 없이 발행
            expect(redisService.publish).toHaveBeenCalledWith(
                "sse:assessment:updated",
                expect.not.stringContaining("bundleCompletion")
            )
        })
    })
})
