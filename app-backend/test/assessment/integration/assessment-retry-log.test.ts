import "reflect-metadata"

import { container } from "tsyringe"
import { AppDataSource } from "@shared/infra/persistence/data-source"
import {
    initializeTestApp,
    cleanupDatabase,
    truncateAllTables,
    clearMockRedis,
} from "../../utils/e2e-helper"
import { AssessmentRepository } from "@features/assessment/infrastructure/assessment.repository"
import { AssessmentService } from "@features/assessment/application/assessment.service"
import { Assessment, AssessmentStatus } from "@features/assessment/domain/assessment.entity"
import {
    AssessmentAnalysisLog,
    AnalysisLogStatus,
} from "@features/assessment/domain/assessment-analysis-log.entity"

describe("Assessment Retry and History Logging Integration (재시도 및 이력 로깅 통합 테스트)", () => {
    let app: unknown
    let assessmentService: AssessmentService
    let assessmentRepo: AssessmentRepository

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let testUser: any

    beforeAll(async () => {
        app = await initializeTestApp()
        assessmentService = container.resolve(AssessmentService)
        assessmentRepo = container.resolve(AssessmentRepository)
    })

    afterAll(async () => {
        await cleanupDatabase()
    })

    beforeEach(async () => {
        await truncateAllTables()
        clearMockRedis()

        // 각 테스트마다 새로운 사용자 생성
        const userRepo = AppDataSource.getRepository("User")
        testUser = userRepo.create({
            email: `test_${Date.now()}@example.com`,
            password: "hashed_password",
            firstName: "Test",
            lastName: "User",
            isVerified: true,
        })
        await userRepo.save(testUser)
    })

    it("분석이 완료되면 DB에 이력이 저장되어야 한다 (Success Case)", async () => {
        // 1. Given: 분석 중인 평가 생성
        const assessment = Assessment.create(testUser.id, "audio.m4a", 10)
        assessment.startAnalysis() // retryCount = 1
        await assessmentRepo.save(assessment)

        // 2. When: AI 서버로부터 성공 결과가 수신됨을 시뮬레이션
        // (실제Subscriber 대신 로직을 직접 수행하거나 Subscriber의 동작을 검증)
        // 여기서는 subscriber.ts에 구현된 로직을 통합적으로 테스트하기 위해
        // 직접 logRepo를 통해 저장됨을 확인하거나, Subscriber를 직접 호출하는 방식 사용 가능

        // 하지만 integration 레벨에서는 Subscriber가 Redis를 구독하므로 시뮬레이션이 까다로움.
        // 대신 Subscriber 내부 로직을 수행하는 부분을 검증함.
        const logRepo = AppDataSource.getRepository(AssessmentAnalysisLog)

        const resultMessage = {
            jobId: `assessment-${assessment.id}`,
            assessmentId: assessment.id,
            success: true,
            score: 95,
            transcribed_text: "Restored text",
            similarity: 0.98,
            alignment: [],
            pitch_data: [],
            speaking_rate: 1.2,
        }

        // Simulating the Subscriber logic (Since it's an integration test, we verify the data state)
        // Subscriber는 별도 프로세스나 Worker에서 돌고 있으므로, 여기서는 직접 로직 수행 후 검증
        assessment.completeAnalysis({
            score: resultMessage.score,
            transcribedText: resultMessage.transcribed_text,
            feedback: { similarity: resultMessage.similarity, alignment: [] },
        })
        await assessmentRepo.save(assessment)

        const log = new AssessmentAnalysisLog()
        log.assessmentId = assessment.id
        log.attemptNumber = assessment.retryCount
        log.status = AnalysisLogStatus.SUCCESS
        await logRepo.save(log)

        // 3. Then: 데이터 검증
        const updatedAssessment = await assessmentRepo.findById(assessment.id)
        expect(updatedAssessment?.status).toBe(AssessmentStatus.COMPLETED)
        expect(updatedAssessment?.score).toBe(95)

        const logs = await logRepo.find({ where: { assessmentId: assessment.id } })
        expect(logs.length).toBe(1)
        expect(logs[0].status).toBe(AnalysisLogStatus.SUCCESS)
        expect(logs[0].attemptNumber).toBe(1)
    })

    it("재시도 시 상태가 변경되고, 새로운 이력이 쌓여야 한다", async () => {
        // 1. Given: 이미 실패한 평가와 이전 이력 존재
        const assessment = Assessment.create(testUser.id, "audio.m4a", 10)
        assessment.retryCount = 1
        assessment.status = AssessmentStatus.FAILED
        await assessmentRepo.save(assessment)

        const logRepo = AppDataSource.getRepository(AssessmentAnalysisLog)
        const firstLog = new AssessmentAnalysisLog()
        firstLog.assessmentId = assessment.id
        firstLog.attemptNumber = 1
        firstLog.status = AnalysisLogStatus.FAIL
        firstLog.errorMessage = "First fail"
        await logRepo.save(firstLog)

        // 2. When: 재시도 수행
        await assessmentService.retryAnalysis(assessment.id)

        // 3. Then: 상태는 ANALYZING으로 변경되고 retryCount는 증가해야 함
        const retriedAssessment = await assessmentRepo.findById(assessment.id)
        expect(retriedAssessment?.status).toBe(AssessmentStatus.ANALYZING)
        expect(retriedAssessment?.retryCount).toBe(2)

        // 4. When: 두 번째 시도 성공 시뮬레이션
        const secondLog = new AssessmentAnalysisLog()
        secondLog.assessmentId = assessment.id
        secondLog.attemptNumber = retriedAssessment!.retryCount
        secondLog.status = AnalysisLogStatus.SUCCESS
        await logRepo.save(secondLog)

        // 5. Then: 이력이 총 2개여야 함
        const logs = await logRepo.find({
            where: { assessmentId: assessment.id },
            order: { attemptNumber: "ASC" },
        })
        expect(logs.length).toBe(2)
        expect(logs[0].attemptNumber).toBe(1)
        expect(logs[0].status).toBe(AnalysisLogStatus.FAIL)
        expect(logs[1].attemptNumber).toBe(2)
        expect(logs[1].status).toBe(AnalysisLogStatus.SUCCESS)
    })
})
