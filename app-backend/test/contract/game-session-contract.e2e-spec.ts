import request from "supertest"
import { Express } from "express"
import { AppDataSource } from "@shared/infra/persistence/data-source"
import { initializeTestApp, cleanupDatabase } from "../utils/e2e-helper"
import { assertErrorResponse } from "../utils/contract-assertions"
import { extractVerificationCode } from "../utils/db-test-setup"
import "../utils/openapi-validator"

describe("Game Session API Contract", () => {
    let app: Express
    let accessToken: string
    let testScriptId: number

    const testUser = {
        email: `game_contract_${Date.now()}@example.com`,
        password: "TestPassword123!",
        firstName: "Game",
        lastName: "Contract",
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

        // 테스트용 스크립트 직접 삽입 (FK 참조 충족)
        const result = await AppDataSource.query(
            `INSERT INTO "scripts" ("title", "content", "category", "difficulty", "isActive", "createdAt", "updatedAt")
             VALUES ('test script', 'test content', 'daily', 'EASY', true, now(), now())
             RETURNING "id"`
        )
        testScriptId = result[0].id
    })

    afterAll(async () => {
        await cleanupDatabase()
    })

    describe("POST /api/v1/game-sessions", () => {
        it("인증 없이 접근 시 401 에러 응답을 반환한다", async () => {
            const res = await request(app).post("/api/v1/game-sessions").send({
                gameType: "WORD_MATCH",
                difficulty: "EASY",
                correctCount: 5,
                totalCount: 10,
                duration: 60,
                score: 500,
            })

            expect(res.status).toBe(401)
            expect(res).toSatisfyApiSpec()
            assertErrorResponse(res.body)
        })

        it("wordResults 없이 요청하면 기존 응답을 반환한다 (하위 호환)", async () => {
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
            expect(res.body.data).toHaveProperty("gameType", "WORD_MATCH")
            expect(res.body.data).not.toHaveProperty("xpBreakdown")
        })

        it("comboMaxStreak 필드를 포함하여 생성한다", async () => {
            const res = await request(app)
                .post("/api/v1/game-sessions")
                .set("Authorization", `Bearer ${accessToken}`)
                .send({
                    gameType: "WORD_MATCH",
                    difficulty: "MEDIUM",
                    correctCount: 10,
                    totalCount: 10,
                    duration: 90,
                    score: 1000,
                    comboMaxStreak: 7,
                })

            expect(res.status).toBe(201)
            expect(res.body.success).toBe(true)
            expect(res.body.data.comboMaxStreak).toBe(7)
        })

        it("wordResults 포함 시 xpBreakdown 응답을 반환한다", async () => {
            const res = await request(app)
                .post("/api/v1/game-sessions")
                .set("Authorization", `Bearer ${accessToken}`)
                .send({
                    gameType: "WORD_MATCH",
                    difficulty: "EASY",
                    correctCount: 3,
                    totalCount: 3,
                    duration: 60,
                    score: 300,
                    comboMaxStreak: 3,
                    wordResults: [
                        {
                            scriptId: testScriptId,
                            word: "hello",
                            wordIndex: 0,
                            isCorrect: true,
                            attempts: 1,
                            hintUsed: false,
                        },
                        {
                            scriptId: testScriptId,
                            word: "world",
                            wordIndex: 1,
                            isCorrect: true,
                            attempts: 1,
                            hintUsed: false,
                        },
                        {
                            scriptId: testScriptId,
                            word: "test",
                            wordIndex: 2,
                            isCorrect: true,
                            attempts: 1,
                            hintUsed: false,
                        },
                    ],
                })

            expect(res.status).toBe(201)
            expect(res.body.success).toBe(true)
            expect(res.body.data).toHaveProperty("xpBreakdown")
            expect(res.body.data.xpBreakdown).toHaveProperty("finalXp")
            expect(res.body.data.xpBreakdown).toHaveProperty("scripts")
            expect(res.body.data.xpBreakdown).toHaveProperty("sessionCap")
            expect(res.body.data.xpBreakdown.scripts[0]).toHaveProperty("type", "first_clear")
        })
    })

    describe("GET /api/v1/game-sessions", () => {
        it("인증 없이 접근 시 401 에러 응답을 반환한다", async () => {
            const res = await request(app).get("/api/v1/game-sessions")

            expect(res.status).toBe(401)
            expect(res).toSatisfyApiSpec()
            assertErrorResponse(res.body)
        })
    })
})
