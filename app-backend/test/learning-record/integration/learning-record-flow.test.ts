import "reflect-metadata"
import request from "supertest"
import { Express } from "express"
import { initializeTestApp, cleanupDatabase } from "../../utils/e2e-helper"
import { extractVerificationCode } from "../../utils/db-test-setup"

describe("학습 기록 통합 테스트", () => {
    let app: Express
    let accessToken: string

    const testUser = {
        email: `lr_test_${Date.now()}@example.com`,
        password: "TestPassword123!",
        firstName: "Learning",
        lastName: "Tester",
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

    describe("GET /api/v1/learning-records/streak", () => {
        it("인증된 사용자의 스트릭 정보를 반환한다", async () => {
            const res = await request(app)
                .get("/api/v1/learning-records/streak")
                .set("Authorization", `Bearer ${accessToken}`)

            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(res.body.data).toHaveProperty("currentStreak")
            expect(res.body.data).toHaveProperty("longestStreak")
            expect(typeof res.body.data.currentStreak).toBe("number")
            expect(typeof res.body.data.longestStreak).toBe("number")
        })

        it("인증 없이 접근 시 401을 반환한다", async () => {
            const res = await request(app).get("/api/v1/learning-records/streak")
            expect(res.status).toBe(401)
        })
    })

    describe("GET /api/v1/learning-records/daily-goal", () => {
        it("인증된 사용자의 일일 목표 현황을 반환한다", async () => {
            const res = await request(app)
                .get("/api/v1/learning-records/daily-goal")
                .set("Authorization", `Bearer ${accessToken}`)

            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(res.body.data).toHaveProperty("completedCount")
            expect(res.body.data).toHaveProperty("dailyGoalTarget")
            expect(res.body.data).toHaveProperty("isGoalAchieved")
            expect(typeof res.body.data.completedCount).toBe("number")
            expect(typeof res.body.data.isGoalAchieved).toBe("boolean")
        })

        it("인증 없이 접근 시 401을 반환한다", async () => {
            const res = await request(app).get("/api/v1/learning-records/daily-goal")
            expect(res.status).toBe(401)
        })
    })
})
