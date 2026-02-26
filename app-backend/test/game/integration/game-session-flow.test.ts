import "reflect-metadata"
import request from "supertest"
import { Express } from "express"
import { initializeTestApp, cleanupDatabase, truncateAllTables, clearMockRedis } from "../../utils/e2e-helper"
import { extractVerificationCode } from "../../utils/db-test-setup"

describe("게임 세션 통합 테스트", () => {
    let app: Express
    let accessToken: string

    let testUser: { email: string; password: string; firstName: string; lastName: string; agreedToTerms: boolean }

    beforeAll(async () => {
        app = await initializeTestApp()
    })

    beforeEach(async () => {
        await truncateAllTables()
        clearMockRedis()

        testUser = {
            email: `game_test_${Date.now()}_${Math.floor(Math.random() * 10000)}@example.com`,
            password: "TestPassword123!",
            firstName: "Game",
            lastName: "Tester",
            agreedToTerms: true,
        }

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

    describe("POST /api/v1/game-sessions", () => {
        it("유효한 게임 세션을 생성하면 201을 반환한다", async () => {
            const res = await request(app)
                .post("/api/v1/game-sessions")
                .set("Authorization", `Bearer ${accessToken}`)
                .send({
                    gameType: "WORD_MATCH",
                    difficulty: "EASY",
                    correctCount: 8,
                    totalCount: 10,
                    duration: 120,
                    score: 800,
                })

            expect(res.status).toBe(201)
            expect(res.body.success).toBe(true)
            expect(res.body.data).toHaveProperty("id")
            expect(res.body.data.gameType).toBe("WORD_MATCH")
            expect(res.body.data.difficulty).toBe("EASY")
            expect(res.body.data.score).toBe(800)
        })

        it("잘못된 gameType 전송 시 400을 반환한다", async () => {
            const res = await request(app)
                .post("/api/v1/game-sessions")
                .set("Authorization", `Bearer ${accessToken}`)
                .send({
                    gameType: "INVALID_TYPE",
                    difficulty: "EASY",
                    correctCount: 5,
                    totalCount: 10,
                    duration: 60,
                    score: 500,
                })

            expect(res.status).toBe(400)
            expect(res.body.success).toBe(false)
        })

        it("인증 없이 접근 시 401을 반환한다", async () => {
            const res = await request(app).post("/api/v1/game-sessions").send({
                gameType: "WORD_MATCH",
                difficulty: "EASY",
                correctCount: 5,
                totalCount: 10,
                duration: 60,
                score: 500,
            })

            expect(res.status).toBe(401)
        })
    })

    describe("GET /api/v1/game-sessions", () => {
        it("게임 세션 이력을 페이지네이션으로 조회한다", async () => {
            // 세션 1개 생성
            await request(app)
                .post("/api/v1/game-sessions")
                .set("Authorization", `Bearer ${accessToken}`)
                .send({
                    gameType: "PRONUNCIATION_QUIZ",
                    difficulty: "MEDIUM",
                    correctCount: 7,
                    totalCount: 10,
                    duration: 90,
                    score: 700,
                })
                .expect(201)

            const res = await request(app)
                .get("/api/v1/game-sessions")
                .set("Authorization", `Bearer ${accessToken}`)

            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(res.body.data).toHaveProperty("items")
            expect(res.body.data).toHaveProperty("total")
            expect(Array.isArray(res.body.data.items)).toBe(true)
            expect(res.body.data.total).toBeGreaterThanOrEqual(1)
        })

        it("인증 없이 접근 시 401을 반환한다", async () => {
            const res = await request(app).get("/api/v1/game-sessions")
            expect(res.status).toBe(401)
        })
    })
})
