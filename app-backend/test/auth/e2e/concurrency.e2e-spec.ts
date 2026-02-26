import "reflect-metadata"
import request from "supertest"
import { Express } from "express"
import {
    initializeTestApp,
    cleanupDatabase,
    truncateAllTables,
    clearMockRedis,
} from "../../utils/e2e-helper"
import { mockSendNotification } from "../../utils/db-test-setup"

describe("동시성 E2E", () => {
    let app: Express

    beforeAll(async () => {
        app = await initializeTestApp()
    })

    afterAll(async () => {
        await cleanupDatabase()
    })

    beforeEach(async () => {
        await truncateAllTables()
        mockSendNotification.mockClear()
        clearMockRedis()
    })

    it("동일한 이메일에 대한 동시 등록 요청을 올바르게 처리해야 한다", async () => {
        const testUser = {
            email: "concurrent@example.com",
            password: "Password123!",
            firstName: "Concurrency",
            agreedToTerms: true,
        }

        // 실행: 두 개의 동일한 등록 요청을 동시에 보냄
        const promises = [
            request(app).post("/api/v1/auth/register").send(testUser),
            request(app).post("/api/v1/auth/register").send(testUser),
        ]

        const results = await Promise.all(promises)
        const statuses = results.map((r) => r.status).sort()

        // 결과: 두 요청 모두 성공해도 됨 (미인증 사용자 재등록 허용)
        // 또는 하나는 201, 다른 하나는 409 (DB 유니크 제약)
        // 중요한 것은 500이 아닌 정상적인 응답을 반환하는 것
        expect(statuses).not.toContain(500)
        expect(statuses[0]).toBe(201) // 최소 하나는 성공
        // 두 번째 요청: 201 (미인증 재등록) 또는 409 (유니크 제약)
        expect([201, 409]).toContain(statuses[1])
    })
})
