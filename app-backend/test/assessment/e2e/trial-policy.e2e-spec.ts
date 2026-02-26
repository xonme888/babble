import request from "supertest"
import { Express } from "express"
import { initializeTestApp, cleanupDatabase } from "../../utils/e2e-helper"
import { GUEST_MAX_TRIALS } from "@features/assessment/domain/guest-trial-policy"

export {}

describe("게스트 체험 정책 API E2E", () => {
    let app: Express

    beforeAll(async () => {
        app = await initializeTestApp()
    })

    afterAll(async () => {
        await cleanupDatabase()
    })

    describe("GET /api/v1/assessments/trial/policy", () => {
        it("인증 없이 게스트 정책을 반환한다", async () => {
            // When
            const res = await request(app)
                .get("/api/v1/assessments/trial/policy")
                .expect(200)

            // Then
            expect(res.body.success).toBe(true)
            expect(res.body.data.maxTrials).toEqual(GUEST_MAX_TRIALS)
        })

        it("maxTrials에 모든 GuestFeature 키가 포함되어야 한다", async () => {
            const res = await request(app)
                .get("/api/v1/assessments/trial/policy")
                .expect(200)

            const keys = Object.keys(res.body.data.maxTrials)
            expect(keys).toContain("PRACTICE")
            expect(keys).toContain("CONTINUOUS_READING")
            expect(keys).toContain("WORD_GAME")
            expect(keys).toContain("LEADERBOARD")
            expect(keys).toContain("HISTORY")
            expect(keys).toContain("PROFILE")
        })
    })
})
