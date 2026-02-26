import request from "supertest"
import { Express } from "express"
import {
    initializeTestApp,
    cleanupDatabase,
    truncateAllTables,
    clearMockRedis,
} from "../../utils/e2e-helper"
import { mockSendNotification, extractVerificationCode } from "../../utils/db-test-setup"

describe("인증 모듈 E2E", () => {
    let app: Express

    beforeAll(async () => {
        app = await initializeTestApp()
    })

    beforeEach(async () => {
        await truncateAllTables()
        mockSendNotification.mockClear()
        clearMockRedis()
    })

    afterAll(async () => {
        await cleanupDatabase()
    })

    const testUser = {
        email: "e2e@example.com",
        password: "Password123!",
        firstName: "E2E",
        lastName: "Tester",
        agreedToTerms: true,
    }

    it("새로운 사용자를 성공적으로 등록해야 한다", async () => {
        const response = await request(app).post("/api/v1/auth/register").send(testUser)

        expect(response.status).toBe(201)
        expect(response.body.success).toBe(true)
        expect(response.body.data.email).toBe(testUser.email)
    })

    it("미인증 상태의 동일 이메일 재등록은 409를 반환해야 한다", async () => {
        // 첫 번째 등록 (미인증 상태)
        await request(app).post("/api/v1/auth/register").send(testUser).expect(201)

        // 동일 이메일 재등록 — 미인증이라도 이미 존재하면 409
        const response = await request(app)
            .post("/api/v1/auth/register")
            .send({ ...testUser, password: "NewPassword456!" })

        expect(response.status).toBe(409)
    })

    it("인증 완료된 이메일로 재등록 시 409를 반환해야 한다", async () => {
        // Given: 등록 + 이메일 인증 완료
        await request(app).post("/api/v1/auth/register").send(testUser).expect(201)
        const code = extractVerificationCode()
        await request(app)
            .post("/api/v1/auth/verify-email")
            .send({ email: testUser.email, code })
            .expect(200)

        // When: 동일 이메일로 재등록 시도
        const response = await request(app).post("/api/v1/auth/register").send(testUser)

        // Then: 409 Conflict
        expect(response.status).toBe(409)
    })

    it("등록 및 인증 후 성공적으로 로그인해야 한다", async () => {
        // 1. 등록
        await request(app).post("/api/v1/auth/register").send(testUser).expect(201)

        // 2. 미인증 상태에서 로그인 시도 → 거부
        const loginFail = await request(app)
            .post("/api/v1/auth/login")
            .send({ email: testUser.email, password: testUser.password })

        expect(loginFail.status).toBe(403)

        // 3. 이메일 인증
        const code = extractVerificationCode()
        await request(app)
            .post("/api/v1/auth/verify-email")
            .send({ email: testUser.email, code })
            .expect(200)

        // 4. 인증 후 로그인 성공
        const loginSuccess = await request(app)
            .post("/api/v1/auth/login")
            .send({ email: testUser.email, password: testUser.password })

        expect(loginSuccess.status).toBe(200)
        expect(loginSuccess.body.data.accessToken).toBeDefined()
    })
})
