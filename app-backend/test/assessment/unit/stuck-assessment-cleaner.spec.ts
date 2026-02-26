import "reflect-metadata"
import { StuckAssessmentCleaner } from "@features/assessment/cron/stuck-assessment-cleaner"
import { AssessmentStatus } from "@features/assessment/domain/assessment.entity"
import {
    createMockAssessmentRepository,
    createMockAssessmentAnalysisService,
    createMockLogger,
    createMockRedisService,
    createTestAssessment,
} from "../../utils/mock-factories"

describe("StuckAssessmentCleaner (좀비 진단 정리기)", () => {
    let cleaner: StuckAssessmentCleaner
    let mockAssessmentRepo: ReturnType<typeof createMockAssessmentRepository>
    let mockAnalysisService: ReturnType<typeof createMockAssessmentAnalysisService>
    let mockLogger: ReturnType<typeof createMockLogger>
    let mockRedis: ReturnType<typeof createMockRedisService>

    beforeEach(() => {
        jest.clearAllMocks()
        mockAssessmentRepo = createMockAssessmentRepository()
        mockAnalysisService = createMockAssessmentAnalysisService()
        mockLogger = createMockLogger()
        mockRedis = createMockRedisService()

        cleaner = new StuckAssessmentCleaner(
            mockAssessmentRepo,
            mockAnalysisService,
            mockLogger,
            mockRedis
        )
    })

    describe("cleanUp (정리 실행)", () => {
        it("좀비 진단이 없으면 정리 없이 종료해야 한다", async () => {
            // Given
            mockAssessmentRepo.findStuckAssessments.mockResolvedValue([])

            // When
            await cleaner.cleanUp(30)

            // Then
            expect(mockAssessmentRepo.findStuckAssessments).toHaveBeenCalledWith(30)
            expect(mockAssessmentRepo.save).not.toHaveBeenCalled()
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining("No stuck assessments")
            )
        })

        it("기본 thresholdMinutes는 30이어야 한다", async () => {
            // Given
            mockAssessmentRepo.findStuckAssessments.mockResolvedValue([])

            // When
            await cleaner.cleanUp()

            // Then
            expect(mockAssessmentRepo.findStuckAssessments).toHaveBeenCalledWith(30)
        })

        it("이미 다른 프로세스에서 처리된 진단은 건너뛰어야 한다", async () => {
            // Given
            const stuckAssessment = createTestAssessment({
                id: 1,
                status: AssessmentStatus.ANALYZING,
            })
            mockAssessmentRepo.findStuckAssessments.mockResolvedValue([stuckAssessment])

            // 재조회 시 이미 COMPLETED 상태
            const resolved = createTestAssessment({
                id: 1,
                status: AssessmentStatus.COMPLETED,
            })
            mockAssessmentRepo.findByIdLight.mockResolvedValue(resolved)

            // When
            await cleaner.cleanUp()

            // Then
            expect(mockAssessmentRepo.save).not.toHaveBeenCalled()
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining("already resolved")
            )
        })

        it("재조회 시 null이면 건너뛰어야 한다", async () => {
            // Given
            const stuckAssessment = createTestAssessment({
                id: 1,
                status: AssessmentStatus.ANALYZING,
            })
            mockAssessmentRepo.findStuckAssessments.mockResolvedValue([stuckAssessment])
            mockAssessmentRepo.findByIdLight.mockResolvedValue(null)

            // When
            await cleaner.cleanUp()

            // Then
            expect(mockAssessmentRepo.save).not.toHaveBeenCalled()
        })

        it("캐시된 결과가 없으면 FAILED로 마킹해야 한다", async () => {
            // Given
            const stuckAssessment = createTestAssessment({
                id: 1,
                status: AssessmentStatus.ANALYZING,
                retryCount: 0,
            })
            mockAssessmentRepo.findStuckAssessments.mockResolvedValue([stuckAssessment])

            const current = createTestAssessment({
                id: 1,
                status: AssessmentStatus.ANALYZING,
                retryCount: 0,
            })
            mockAssessmentRepo.findByIdLight.mockResolvedValue(current)
            mockRedis.get.mockResolvedValue(null)

            // When
            await cleaner.cleanUp()

            // Then
            expect(mockAssessmentRepo.save).toHaveBeenCalled()
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining("FAILED (zombie)")
            )
        })

        it("캐시된 결과가 유효한 JSON이면 applyAnalysisResult를 호출해야 한다", async () => {
            // Given
            const stuckAssessment = createTestAssessment({
                id: 1,
                status: AssessmentStatus.ANALYZING,
                retryCount: 1,
            })
            mockAssessmentRepo.findStuckAssessments.mockResolvedValue([stuckAssessment])

            const current = createTestAssessment({
                id: 1,
                status: AssessmentStatus.ANALYZING,
                retryCount: 1,
            })
            current.applyAnalysisResult = jest.fn()
            mockAssessmentRepo.findByIdLight.mockResolvedValue(current)

            const cachedResult = JSON.stringify({
                assessmentId: 1,
                success: true,
                score: 85,
                transcribed_text: "Hello world",
            })
            mockRedis.get.mockResolvedValue(cachedResult)

            // When
            await cleaner.cleanUp()

            // Then
            expect(current.applyAnalysisResult).toHaveBeenCalledWith(
                expect.objectContaining({ success: true, score: 85 })
            )
            expect(mockRedis.delete).toHaveBeenCalled()
            expect(mockAssessmentRepo.save).toHaveBeenCalledWith(current)
        })

        it("캐시된 결과가 잘못된 JSON이면 FAILED로 마킹하고 캐시를 삭제해야 한다", async () => {
            // Given
            const stuckAssessment = createTestAssessment({
                id: 1,
                status: AssessmentStatus.ANALYZING,
                retryCount: 1,
            })
            mockAssessmentRepo.findStuckAssessments.mockResolvedValue([stuckAssessment])

            const current = createTestAssessment({
                id: 1,
                status: AssessmentStatus.ANALYZING,
                retryCount: 1,
            })
            mockAssessmentRepo.findByIdLight.mockResolvedValue(current)
            mockRedis.get.mockResolvedValue("{invalid json")

            // When
            await cleaner.cleanUp()

            // Then
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining("parse cached result")
            )
            expect(mockRedis.delete).toHaveBeenCalled()
            expect(mockAssessmentRepo.save).toHaveBeenCalled()
        })

        it("OptimisticLockVersionMismatchError 발생 시 건너뛰어야 한다", async () => {
            // Given
            const { OptimisticLockVersionMismatchError } = require("typeorm")
            const stuckAssessment = createTestAssessment({
                id: 1,
                status: AssessmentStatus.ANALYZING,
            })
            mockAssessmentRepo.findStuckAssessments.mockResolvedValue([stuckAssessment])
            mockAssessmentRepo.findByIdLight.mockRejectedValue(
                new OptimisticLockVersionMismatchError("Assessment", 1, 2)
            )

            // When
            await cleaner.cleanUp()

            // Then
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining("modified by another process")
            )
        })

        it("예상치 못한 에러 발생 시 error 로그를 남기고 계속해야 한다", async () => {
            // Given
            const stuckAssessment = createTestAssessment({
                id: 1,
                status: AssessmentStatus.ANALYZING,
            })
            mockAssessmentRepo.findStuckAssessments.mockResolvedValue([stuckAssessment])
            mockAssessmentRepo.findByIdLight.mockRejectedValue(new Error("DB connection lost"))

            // When
            await cleaner.cleanUp()

            // Then
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining("DB connection lost")
            )
        })

        it("PENDING 상태의 좀비 진단도 처리해야 한다", async () => {
            // Given
            const stuckAssessment = createTestAssessment({
                id: 2,
                status: AssessmentStatus.PENDING,
                retryCount: 0,
            })
            mockAssessmentRepo.findStuckAssessments.mockResolvedValue([stuckAssessment])

            const current = createTestAssessment({
                id: 2,
                status: AssessmentStatus.PENDING,
                retryCount: 0,
            })
            mockAssessmentRepo.findByIdLight.mockResolvedValue(current)
            mockRedis.get.mockResolvedValue(null)

            // When
            await cleaner.cleanUp()

            // Then
            expect(mockAssessmentRepo.save).toHaveBeenCalled()
        })

        it("retryCount-1 키로 캐시 결과를 복구해야 한다 (초기 분석: jobId 생성 후 startAnalysis에서 증가)", async () => {
            // Given: DB retryCount=1이지만 Redis 키는 retryCount=0으로 생성됨
            const stuckAssessment = createTestAssessment({
                id: 39,
                status: AssessmentStatus.ANALYZING,
                retryCount: 1,
            })
            mockAssessmentRepo.findStuckAssessments.mockResolvedValue([stuckAssessment])

            const current = createTestAssessment({
                id: 39,
                status: AssessmentStatus.ANALYZING,
                retryCount: 1,
            })
            current.applyAnalysisResult = jest.fn()
            mockAssessmentRepo.findByIdLight.mockResolvedValue(current)

            const cachedResult = JSON.stringify({
                assessmentId: 39,
                success: true,
                score: 90,
                transcribed_text: "test",
            })
            // heartbeat → null, retryCount=1 → null, retry-1 → null, retryCount-1=0 → hit
            mockRedis.get
                .mockResolvedValueOnce(null)  // ai:worker:heartbeat
                .mockResolvedValueOnce(null)  // assessment-39-1
                .mockResolvedValueOnce(null)  // assessment-39-retry-1
                .mockResolvedValueOnce(cachedResult)  // assessment-39-0 ← 여기서 발견

            // When
            await cleaner.cleanUp()

            // Then
            expect(mockRedis.get).toHaveBeenCalledWith("ai:results:assessment-39-0")
            expect(current.applyAnalysisResult).toHaveBeenCalledWith(
                expect.objectContaining({ success: true, score: 90 })
            )
            expect(mockRedis.delete).toHaveBeenCalledWith("ai:results:assessment-39-0")
            expect(mockAssessmentRepo.save).toHaveBeenCalledWith(current)
        })

        it("retryCount-1 키로 캐시 결과를 복구해야 한다 (재시도: retry- 접두사)", async () => {
            // Given: scheduleRetry에서 retryCount=1로 jobId 생성 → startAnalysis에서 2로 증가
            const stuckAssessment = createTestAssessment({
                id: 42,
                status: AssessmentStatus.ANALYZING,
                retryCount: 2,
            })
            mockAssessmentRepo.findStuckAssessments.mockResolvedValue([stuckAssessment])

            const current = createTestAssessment({
                id: 42,
                status: AssessmentStatus.ANALYZING,
                retryCount: 2,
            })
            current.applyAnalysisResult = jest.fn()
            mockAssessmentRepo.findByIdLight.mockResolvedValue(current)

            const cachedResult = JSON.stringify({
                assessmentId: 42,
                success: true,
                score: 75,
                transcribed_text: "retry test",
            })
            // heartbeat → null, retryCount=2 → null, retry-2 → null, 1 → null, retry-1 → hit
            mockRedis.get
                .mockResolvedValueOnce(null)  // ai:worker:heartbeat
                .mockResolvedValueOnce(null)  // assessment-42-2
                .mockResolvedValueOnce(null)  // assessment-42-retry-2
                .mockResolvedValueOnce(null)  // assessment-42-1
                .mockResolvedValueOnce(cachedResult)  // assessment-42-retry-1 ← 여기서 발견

            // When
            await cleaner.cleanUp()

            // Then
            expect(mockRedis.get).toHaveBeenCalledWith("ai:results:assessment-42-retry-1")
            expect(current.applyAnalysisResult).toHaveBeenCalledWith(
                expect.objectContaining({ success: true, score: 75 })
            )
            expect(mockRedis.delete).toHaveBeenCalledWith("ai:results:assessment-42-retry-1")
        })

        it("retryCount=0이면 retryCount-1 패턴을 추가하지 않아야 한다", async () => {
            // Given
            const stuckAssessment = createTestAssessment({
                id: 5,
                status: AssessmentStatus.ANALYZING,
                retryCount: 0,
            })
            mockAssessmentRepo.findStuckAssessments.mockResolvedValue([stuckAssessment])

            const current = createTestAssessment({
                id: 5,
                status: AssessmentStatus.ANALYZING,
                retryCount: 0,
            })
            mockAssessmentRepo.findByIdLight.mockResolvedValue(current)
            mockRedis.get.mockResolvedValue(null)

            // When
            await cleaner.cleanUp()

            // Then — heartbeat 1회 + retryCount=0이면 2개 키만 조회 (음수 키 없음)
            expect(mockRedis.get).toHaveBeenCalledTimes(3)
            expect(mockRedis.get).toHaveBeenCalledWith("ai:results:assessment-5-0")
            expect(mockRedis.get).toHaveBeenCalledWith("ai:results:assessment-5-retry-0")
        })

        it("복수의 좀비 진단을 순차적으로 처리해야 한다", async () => {
            // Given
            const stuck1 = createTestAssessment({ id: 1, status: AssessmentStatus.ANALYZING, retryCount: 0 })
            const stuck2 = createTestAssessment({ id: 2, status: AssessmentStatus.ANALYZING, retryCount: 0 })
            mockAssessmentRepo.findStuckAssessments.mockResolvedValue([stuck1, stuck2])

            const current1 = createTestAssessment({ id: 1, status: AssessmentStatus.ANALYZING, retryCount: 0 })
            const current2 = createTestAssessment({ id: 2, status: AssessmentStatus.ANALYZING, retryCount: 0 })
            mockAssessmentRepo.findByIdLight
                .mockResolvedValueOnce(current1)
                .mockResolvedValueOnce(current2)
            mockRedis.get.mockResolvedValue(null)

            // When
            await cleaner.cleanUp()

            // Then
            expect(mockAssessmentRepo.save).toHaveBeenCalledTimes(2)
        })
    })
})
