import request from "supertest"
import { Express } from "express"
import { initializeTestApp, cleanupDatabase } from "../utils/e2e-helper"
import { assertErrorResponse } from "../utils/contract-assertions"
import { extractVerificationCode } from "../utils/db-test-setup"
import "../utils/openapi-validator"

describe("GET /api/v1/scripts/word-game/today Contract", () => {
    let app: Express
    let accessToken: string

    const testUser = {
        email: `wg_today_${Date.now()}@example.com`,
        password: "TestPassword123!",
        firstName: "WordGame",
        lastName: "Today",
        agreedToTerms: true,
    }

    beforeAll(async () => {
        app = await initializeTestApp()

        // 회원가입 → 이메일 인증 → 로그인
        await request(app).post("/api/v1/auth/register").send(testUser).expect(201)
        const code = extractVerificationCode()
        await request(app)
            .post("/api/v1/auth/verify-email")
            .send({ email: testUser.email, code })
            .expect(200)
        const loginRes = await request(app)
            .post("/api/v1/auth/login")
            .send({ email: testUser.email, password: testUser.password })
            .expect(200)
        accessToken = loginRes.body.data.accessToken
    })

    afterAll(async () => {
        await cleanupDatabase()
    })

    it("인증 없이 접근 시 401 에러 응답을 반환한다", async () => {
        const res = await request(app).get("/api/v1/scripts/word-game/today")

        expect(res.status).toBe(401)
        expect(res).toSatisfyApiSpec()
        assertErrorResponse(res.body)
    })

    it("인증 시 200 성공 배열을 반환한다", async () => {
        const res = await request(app)
            .get("/api/v1/scripts/word-game/today")
            .set("Authorization", `Bearer ${accessToken}`)

        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)
        expect(Array.isArray(res.body.data)).toBe(true)
    })

    it("count 파라미터를 지원한다", async () => {
        const res = await request(app)
            .get("/api/v1/scripts/word-game/today?count=3")
            .set("Authorization", `Bearer ${accessToken}`)

        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)
        expect(Array.isArray(res.body.data)).toBe(true)
    })
})
