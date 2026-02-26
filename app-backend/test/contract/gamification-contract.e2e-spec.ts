import request from "supertest"
import { Express } from "express"
import { initializeTestApp, cleanupDatabase } from "../utils/e2e-helper"
import { assertErrorResponse } from "../utils/contract-assertions"
import "../utils/openapi-validator"

describe("Gamification API Contract", () => {
    let app: Express

    beforeAll(async () => {
        app = await initializeTestApp()
    })

    afterAll(async () => {
        await cleanupDatabase()
    })

    describe("GET /api/v1/gamification/profile", () => {
        it("인증 없이 접근 시 401 에러 응답을 반환한다", async () => {
            const res = await request(app).get("/api/v1/gamification/profile")

            expect(res.status).toBe(401)
            expect(res).toSatisfyApiSpec()
            assertErrorResponse(res.body)
        })
    })

    describe("GET /api/v1/gamification/badges", () => {
        it("인증 없이 접근 시 401 에러 응답을 반환한다", async () => {
            const res = await request(app).get("/api/v1/gamification/badges")

            expect(res.status).toBe(401)
            expect(res).toSatisfyApiSpec()
            assertErrorResponse(res.body)
        })
    })

    describe("GET /api/v1/gamification/leaderboard", () => {
        it("인증 없이 접근 시 401 에러 응답을 반환한다", async () => {
            const res = await request(app).get("/api/v1/gamification/leaderboard")

            expect(res.status).toBe(401)
            expect(res).toSatisfyApiSpec()
            assertErrorResponse(res.body)
        })
    })
})
