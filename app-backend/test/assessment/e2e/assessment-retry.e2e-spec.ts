import "reflect-metadata"
import request from "supertest"
import { AppDataSource } from "@shared/infra/persistence/data-source"
import { initializeTestApp, cleanupDatabase } from "../../utils/e2e-helper"
import { User, UserRole } from "@features/user/domain/user.entity"
import { Assessment, AssessmentStatus } from "@features/assessment/domain/assessment.entity"
import { Script, ScriptDifficulty } from "@features/script/domain/script.entity"
import { Express } from "express"
import { extractVerificationCode } from "../../utils/db-test-setup"

describe("Assessment Retry Flow E2E (평가 재시도 흐름 E2E 테스트)", () => {
    let app: Express
    let adminToken: string
    let testAssessmentId: number

    beforeAll(async () => {
        app = await initializeTestApp()

        // 1. 관리자 계정 생성 및 로그인
        const adminEmail = "e2e_admin@example.com"
        const password = "Password123!"

        await request(app).post("/api/v1/auth/register").send({
            email: adminEmail,
            password,
            firstName: "Admin",
            lastName: "E2E",
            agreedToTerms: true,
        })

        const code = extractVerificationCode()
        await request(app).post("/api/v1/auth/verify-email").send({ email: adminEmail, code })

        const userRepository = AppDataSource.getRepository(User)
        const user = await userRepository.findOne({ where: { email: adminEmail } })
        await userRepository.update(user!.id, { role: UserRole.ADMIN })

        const loginRes = await request(app)
            .post("/api/v1/auth/login")
            .send({ email: adminEmail, password })
        adminToken = loginRes.body.data.accessToken

        // 2. 테스트용 스크립트 생성 (FK 참조용)
        const scriptRepo = AppDataSource.getRepository(Script)
        const script = new Script()
        script.title = "Retry Test Script"
        script.content = "Test content"
        script.category = "test"
        script.difficulty = ScriptDifficulty.EASY
        await scriptRepo.save(script)

        // 3. 테스트용 실패한 평가 데이터 생성
        const assessmentRepo = AppDataSource.getRepository(Assessment)
        const assessment = Assessment.create(user!.id, "test.m4a", 15, script.id)
        assessment.status = AssessmentStatus.FAILED
        assessment.retryCount = 1
        await assessmentRepo.save(assessment)
        testAssessmentId = assessment.id
    })

    afterAll(async () => {
        await cleanupDatabase()
    })

    it("관리자가 실패한 평가에 대해 재시도를 요청하면 상태가 ANALYZING으로 변경되어야 한다", async () => {
        const res = await request(app)
            .post(`/api/v1/assessments/admin/${testAssessmentId}/retry`)
            .set("Authorization", `Bearer ${adminToken}`)
            .expect(200)

        expect(res.body.success).toBe(true)

        const assessmentRepo = AppDataSource.getRepository(Assessment)
        const updated = await assessmentRepo.findOne({ where: { id: testAssessmentId } })
        expect(updated?.status).toBe(AssessmentStatus.ANALYZING)
        expect(updated?.retryCount).toBe(2)
    })

    it("이미 분석 중인 평가에 대해서도 관리자는 재시도를 강제할 수 있어야 한다 (중복 호출 시 retryCount 미증가)", async () => {
        await request(app)
            .post(`/api/v1/assessments/admin/${testAssessmentId}/retry`)
            .set("Authorization", `Bearer ${adminToken}`)
            .expect(200)

        const assessmentRepo = AppDataSource.getRepository(Assessment)
        const updated = await assessmentRepo.findOne({ where: { id: testAssessmentId } })
        expect(updated?.status).toBe(AssessmentStatus.ANALYZING)
        // ANALYZING 상태에서 재시도 시 retryCount는 증가하지 않음 (중복 호출 방어)
        expect(updated?.retryCount).toBe(2)
    })

    it("성공한 평가에 대해서는 재시도가 거부되어야 한다", async () => {
        const assessmentRepo = AppDataSource.getRepository(Assessment)
        await assessmentRepo.update(testAssessmentId, { status: AssessmentStatus.COMPLETED })

        await request(app)
            .post(`/api/v1/assessments/admin/${testAssessmentId}/retry`)
            .set("Authorization", `Bearer ${adminToken}`)
            .expect(400)
    })
})
