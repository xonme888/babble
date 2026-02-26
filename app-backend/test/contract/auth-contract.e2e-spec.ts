import request from "supertest"
import { Express } from "express"
import { initializeTestApp, cleanupDatabase } from "../utils/e2e-helper"
import {
    assertSuccessResponse,
    assertErrorResponse,
    assertUserShape,
} from "../utils/contract-assertions"
import "../utils/openapi-validator"

/**
 * 인증 API 계약 테스트
 *
 * Backend의 표준 응답 구조(ApiSuccessResponse, ApiErrorResponse)를 준수하는지 검증한다.
 * 기능 동작이 아닌 "응답 형태"에 초점을 맞춘다.
 */
describe("Auth API Contract", () => {
    let app: Express

    beforeAll(async () => {
        app = await initializeTestApp()
    })

    afterAll(async () => {
        await cleanupDatabase()
    })

    describe("POST /api/v1/auth/register", () => {
        it("성공 시 표준 성공 응답 구조를 반환한다", async () => {
            const res = await request(app).post("/api/v1/auth/register").send({
                email: "contract-test@example.com",
                password: "Test1234!@",
                firstName: "Contract",
                agreedToTerms: true,
            })

            // 201 또는 200 -- 구현에 따라
            expect([200, 201]).toContain(res.status)
            expect(res).toSatisfyApiSpec()
            assertSuccessResponse(res.body)

            if (res.body.data?.user) {
                assertUserShape(res.body.data.user)
            }
        })

        it("유효성 에러 시 표준 에러 응답 구조를 반환한다", async () => {
            const res = await request(app).post("/api/v1/auth/register").send({ email: "invalid" }) // 필수 필드 누락

            expect(res.status).toBeGreaterThanOrEqual(400)
            expect(res).toSatisfyApiSpec()
            assertErrorResponse(res.body)
        })
    })

    describe("POST /api/v1/auth/login", () => {
        it("잘못된 인증 시 표준 에러 응답 구조를 반환한다", async () => {
            const res = await request(app).post("/api/v1/auth/login").send({
                email: "nonexistent@example.com",
                password: "WrongPass1!",
            })

            expect(res.status).toBeGreaterThanOrEqual(400)
            expect(res).toSatisfyApiSpec()
            assertErrorResponse(res.body)
        })
    })
})
