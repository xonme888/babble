import "reflect-metadata"
import { extractVerificationCode } from "../../utils/db-test-setup"

import request from "supertest"
import { Express } from "express"
import { initializeTestApp, cleanupDatabase } from "../../utils/e2e-helper"

describe("사용자 흐름 통합 (BDD)", () => {
    let app: Express

    beforeAll(async () => {
        app = await initializeTestApp()
    })

    afterAll(async () => {
        await cleanupDatabase()
    })

    const testUser = {
        email: `bdd_integration_${Date.now()}@example.com`,
        password: "Password123!",
        firstName: "BDD",
        lastName: "Integration",
        agreedToTerms: true,
    }

    let accessToken: string

    describe("사용자 등록 및 인증", () => {
        it("새로운 사용자가 등록한 후 이메일을 인증할 수 있어야 한다", async () => {
            // 등록
            const regRes = await request(app)
                .post("/api/v1/auth/register")
                .send(testUser)
                .expect(201)

            expect(regRes.body.data.email).toBe(testUser.email)

            // 인증
            const code = extractVerificationCode()
            expect(code).toBeDefined()

            await request(app)
                .post("/api/v1/auth/verify-email")
                .send({ email: testUser.email, code })
                .expect(200)
        })

        it("이미 존재하는 이메일로 등록할 수 없어야 한다", async () => {
            await request(app).post("/api/v1/auth/register").send(testUser).expect(409)
        })
    })

    describe("인증 및 프로필 접근", () => {
        it("인증된 사용자가 로그인하여 자신의 프로필에 접근할 수 있어야 한다", async () => {
            // 로그인
            const loginRes = await request(app)
                .post("/api/v1/auth/login")
                .send({ email: testUser.email, password: testUser.password })
                .expect(200)

            accessToken = loginRes.body.data.accessToken
            expect(accessToken).toBeDefined()

            // 프로필 조회
            const profileRes = await request(app)
                .get("/api/v1/users/me")
                .set("Authorization", `Bearer ${accessToken}`)
                .expect(200)

            expect(profileRes.body.data.email).toBe(testUser.email)
        })

        it("유효하지 않은 토큰으로 프로필 접근을 거부해야 한다", async () => {
            await request(app)
                .get("/api/v1/users/me")
                .set("Authorization", `Bearer invalid_token`)
                .expect(401)
        })
    })
})
