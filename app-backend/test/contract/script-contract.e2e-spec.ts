import request from "supertest"
import { Express } from "express"
import { initializeTestApp, cleanupDatabase } from "../utils/e2e-helper"
import { assertSuccessResponse } from "../utils/contract-assertions"
import "../utils/openapi-validator"

/**
 * 스크립트 API 계약 테스트
 *
 * Backend의 표준 응답 구조(ApiSuccessResponse, ApiErrorResponse)를 준수하는지 검증한다.
 * 기능 동작이 아닌 "응답 형태"에 초점을 맞춘다.
 */
describe("Script API Contract", () => {
    let app: Express

    beforeAll(async () => {
        app = await initializeTestApp()
    })

    afterAll(async () => {
        await cleanupDatabase()
    })

    describe("GET /api/v1/scripts", () => {
        it("표준 성공 응답 구조를 반환한다", async () => {
            const res = await request(app).get("/api/v1/scripts")

            expect(res.status).toBe(200)
            expect(res).toSatisfyApiSpec()
            assertSuccessResponse(res.body)
        })
    })

    // ==================== 챕터 접근 보안 계약 ====================

    describe("GET /api/v1/scripts/random/me", () => {
        it("인증 없이 접근 시 401을 반환한다", async () => {
            const res = await request(app).get("/api/v1/scripts/random/me")

            expect(res.status).toBe(401)
        })
    })

    describe("GET /api/v1/scripts/chapters/me", () => {
        it("인증 없이 접근 시 401을 반환한다", async () => {
            const res = await request(app).get("/api/v1/scripts/chapters/me")

            expect(res.status).toBe(401)
        })
    })

    describe("GET /api/v1/scripts/word-game", () => {
        it("인증 없이 접근 시 401을 반환한다", async () => {
            const res = await request(app).get("/api/v1/scripts/word-game")

            expect(res.status).toBe(401)
        })
    })

    describe("기존 비인증 엔드포인트 호환성", () => {
        it("GET /api/v1/scripts/chapters — 비인증 접근 가능", async () => {
            const res = await request(app).get("/api/v1/scripts/chapters")

            expect(res.status).toBe(200)
            assertSuccessResponse(res.body)
        })
    })
})
