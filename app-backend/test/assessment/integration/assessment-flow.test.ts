import "reflect-metadata"
import request from "supertest"
import { Express } from "express"
import { AppDataSource } from "@shared/infra/persistence/data-source"
import { container } from "tsyringe"
import { initializeTestApp, cleanupDatabase, clearMockRedis } from "../../utils/e2e-helper"
import { User, UserRole } from "@features/user/domain/user.entity"
import { IRedisService } from "@shared/core/redis-service.interface"
import os from "os"
import fs from "fs"
import path from "path"
import { extractVerificationCode } from "../../utils/db-test-setup"

describe("진단 통합 흐름 (BDD)", () => {
    let app: Express
    let accessToken: string
    let testUserId: number
    let testScriptId: number
    const tempAudioPath = path.join(os.tmpdir(), `bdd_test_audio_${Date.now()}.wav`)

    const testUser = {
        email: "bdd_tester@example.com",
        password: "TestPassword123!",
        firstName: "BDD",
        lastName: "User",
        agreedToTerms: true,
    }

    let redisService: IRedisService
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let currentTestUser: any

    beforeAll(async () => {
        app = await initializeTestApp()
        redisService = container.resolve<IRedisService>("IRedisService")
        currentTestUser = {
            ...testUser,
            email: `bdd_tester_${Date.now()}_${Math.floor(Math.random() * 1000)}@example.com`,
        }
        fs.writeFileSync(tempAudioPath, "fake audio content")
    })

    beforeEach(() => {
        clearMockRedis()
    })

    afterAll(async () => {
        await cleanupDatabase()
        if (fs.existsSync(tempAudioPath)) {
            fs.unlinkSync(tempAudioPath)
        }
    })

    describe("설정 시나리오: 인증된 관리자 사용자 및 활성 구절", () => {
        it("진단을 위한 관리자 사용자와 구절이 준비되어 있어야 한다", async () => {
            // 등록 및 인증
            const regRes = await request(app)
                .post("/api/v1/auth/register")
                .send(currentTestUser)
                .expect(201)
            testUserId = regRes.body.data.id
            const code = extractVerificationCode()
            await request(app)
                .post("/api/v1/auth/verify-email")
                .send({ email: currentTestUser.email, code })
                .expect(200)

            // 관리자 권한 부여
            const userRepository = AppDataSource.getRepository(User)
            await userRepository.update(testUserId, { role: UserRole.ADMIN })

            // 로그인
            const loginRes = await request(app)
                .post("/api/v1/auth/login")
                .send({ email: currentTestUser.email, password: currentTestUser.password })
                .expect(200)
            accessToken = loginRes.body.data.accessToken

            // 스크립트 생성
            const scriptRes = await request(app)
                .post("/api/v1/scripts")
                .set("Authorization", `Bearer ${accessToken}`)
                .send({
                    title: "BDD Test Script",
                    content: "test content",
                    category: "test",
                    difficulty: "EASY",
                    articulationPlace: "MIXED",
                })
                .expect(201)
            testScriptId = scriptRes.body.data.id
        })
    })

    describe("사용자 활동: 진단 제출 및 모니터링", () => {
        it("사용자가 음성 진단을 제출하고 상태를 추적할 수 있어야 한다", async () => {
            // 제출
            const submitRes = await request(app)
                .post("/api/v1/assessments")
                .set("Authorization", `Bearer ${accessToken}`)
                .field("scriptId", testScriptId.toString())
                .field("duration", "10")
                .attach("audio", tempAudioPath)
                .expect(201)

            const assessmentId = submitRes.body.data.id
            expect(submitRes.body.data.status).toBe("PENDING")

            // 세부 정보 추적
            const detailRes = await request(app)
                .get(`/api/v1/assessments/${assessmentId}`)
                .set("Authorization", `Bearer ${accessToken}`)
                .expect(200)

            expect(detailRes.body.data.id).toBe(assessmentId)
        })

        it("사용자의 진단 이력에 진단이 표시되어야 한다", async () => {
            const historyRes = await request(app)
                .get("/api/v1/assessments")
                .set("Authorization", `Bearer ${accessToken}`)
                .expect(200)

            // 페이지네이션 응답: { items, total, limit, offset }
            expect(Array.isArray(historyRes.body.data.items)).toBe(true)
            expect(historyRes.body.data.items.length).toBeGreaterThan(0)
        })
    })

    describe("보안: 접근 제어", () => {
        it("권한이 없는 사용자의 진단 세부 정보 접근을 거부해야 한다", async () => {
            // 다른 사용자 등록
            const otherUser = {
                email: `other_${Date.now()}@example.com`,
                password: "Password123!",
                firstName: "Other",
                agreedToTerms: true,
            }
            await request(app).post("/api/v1/auth/register").send(otherUser).expect(201)
            const otherCode = extractVerificationCode()
            await request(app)
                .post("/api/v1/auth/verify-email")
                .send({ email: otherUser.email, code: otherCode })
                .expect(200)
            const loginRes = await request(app)
                .post("/api/v1/auth/login")
                .send({ email: otherUser.email, password: otherUser.password })
                .expect(200)
            const otherToken = loginRes.body.data.accessToken

            // 첫 번째 사용자의 평가에 접근 시도 (이력의 ID 사용)
            const historyRes = await request(app)
                .get("/api/v1/assessments")
                .set("Authorization", `Bearer ${accessToken}`)
            const assessmentId = historyRes.body.data.items[0].id

            await request(app)
                .get(`/api/v1/assessments/${assessmentId}`)
                .set("Authorization", `Bearer ${otherToken}`)
                .expect(404)
        })
    })
})
