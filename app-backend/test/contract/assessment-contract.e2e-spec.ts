import request from "supertest"
import { Express } from "express"
import { initializeTestApp, cleanupDatabase } from "../utils/e2e-helper"
import { assertErrorResponse } from "../utils/contract-assertions"
import "../utils/openapi-validator"

/**
 * 평가 API 계약 테스트
 *
 * Backend의 표준 응답 구조(ApiSuccessResponse, ApiErrorResponse)를 준수하는지 검증한다.
 * 인증이 필요한 엔드포인트에서 401 에러 응답 구조가 올바른지 확인한다.
 */
describe("Assessment API Contract", () => {
    let app: Express

    beforeAll(async () => {
        app = await initializeTestApp()
    })

    afterAll(async () => {
        await cleanupDatabase()
    })

    describe("GET /api/v1/assessments", () => {
        it("인증 없이 접근 시 401 에러 응답을 반환한다", async () => {
            const res = await request(app).get("/api/v1/assessments")

            expect(res.status).toBe(401)
            expect(res).toSatisfyApiSpec()
            assertErrorResponse(res.body)
        })
    })

    describe("POST /api/v1/assessments", () => {
        it("인증 없이 접근 시 401 에러 응답을 반환한다", async () => {
            const res = await request(app).post("/api/v1/assessments")

            expect(res.status).toBe(401)
            expect(res).toSatisfyApiSpec()
            assertErrorResponse(res.body)
        })
    })
})
